// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentIdentity} from "../src/AgentIdentity.sol";
import {AgentWallet} from "../src/AgentWallet.sol";
import {AgentFactory} from "../src/AgentFactory.sol";
import {AttestationRegistry} from "../src/AttestationRegistry.sol";
import {PermissionEngine} from "../src/PermissionEngine.sol";
import {InvoiceRegistry} from "../src/InvoiceRegistry.sol";
import {SettlementVault} from "../src/SettlementVault.sol";
import {Reputation} from "../src/Reputation.sol";
import {Civora} from "../src/Civora.sol";
import {AgentType, Decision, InvoiceState} from "../src/Types.sol";
import {
    InvalidFundingAmount,
    NotUnderwriter,
    PermissionDenied,
    Expired,
    AlreadySettled,
    InvalidState,
    NotController,
    UnauthorizedCaller,
    NotAdmin
} from "../src/Errors.sol";

contract ReenterPayee {
    SettlementVault public vault;
    uint256 public invoiceId;
    bool public armed;

    function arm(SettlementVault vault_, uint256 invoiceId_) external {
        vault = vault_;
        invoiceId = invoiceId_;
        armed = true;
    }

    receive() external payable {
        if (armed) {
            armed = false;
            vault.settle(invoiceId);
        }
    }
}

contract CivoraTest is Test {
    AgentIdentity internal identity;
    AgentFactory internal factory;
    AttestationRegistry internal attestations;
    PermissionEngine internal permissions;
    InvoiceRegistry internal invoices;
    SettlementVault internal vault;
    Reputation internal reputation;
    Civora internal civora;

    address internal deployer = address(this);
    address internal treasury = makeAddr("treasury");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal mallory = makeAddr("mallory");

    uint256 internal uwId;
    uint256 internal saId;
    address internal uwWallet;
    address internal saWallet;

    bytes32 internal constant MODEL = keccak256("deepseek-ai/DeepSeek-V4-Flash");
    bytes32 internal constant DOC = keccak256("invoice-doc-v1");

    function setUp() public {
        identity = new AgentIdentity();
        factory = new AgentFactory(identity);
        identity.setFactory(address(factory));

        attestations = new AttestationRegistry(identity);
        permissions = new PermissionEngine(identity);
        invoices = new InvoiceRegistry(identity);
        reputation = new Reputation();

        vault = new SettlementVault(identity, invoices, attestations, permissions, reputation, treasury);

        civora = new Civora(identity, factory, invoices, attestations, permissions, vault, reputation);

        invoices.setVault(address(vault));
        invoices.setAttestor(address(civora));
        reputation.setVault(address(vault));
        attestations.setInvoiceRegistry(address(invoices));
        attestations.setCivora(address(civora));
        permissions.setAttestationRegistry(address(attestations));
        permissions.setCivora(address(civora));

        vm.deal(alice, 10 ether);
        vm.startPrank(alice);
        (uwId, uwWallet) = factory.createAgent(AgentType.Underwriter, "Underwriter-01");
        (saId, saWallet) = factory.createAgent(AgentType.Settlement, "Settlement-01");
        vm.stopPrank();
    }

    function _register(uint256 amount, uint64 dueIn, address payee) internal returns (uint256 id) {
        vm.prank(alice);
        id = invoices.register(payee, amount, uint64(block.timestamp + dueIn), DOC, uwId, saId);
    }

    function _fund(uint256 id, uint256 amount) internal {
        vm.prank(alice);
        vault.fund{value: amount}(id);
    }

    function _commit(uint256 id, Decision d, uint256 approved, uint64 ttl) internal {
        vm.prank(alice);
        civora.underwriteCommit(id, uwId, keccak256("report"), d, approved, uint64(block.timestamp + ttl), MODEL);
    }

    function test_factoryMintsTypeAndWallet() public view {
        assertEq(identity.ownerOf(uwId), alice);
        assertEq(uint8(identity.agentTypeOf(uwId)), uint8(AgentType.Underwriter));
        assertEq(identity.walletOf(uwId), uwWallet);
        assertEq(identity.ownerOf(saId), alice);
        assertEq(uint8(identity.agentTypeOf(saId)), uint8(AgentType.Settlement));
        assertTrue(uwWallet != address(0));
        assertEq(AgentWallet(payable(uwWallet)).controller(), alice);
        assertEq(AgentWallet(payable(uwWallet)).agentId(), uwId);
    }

    function test_registerInvoice() public {
        uint256 amount = 0.05 ether;
        vm.expectEmit(true, true, true, true);
        emit InvoiceRegistry.InvoiceRegistered(
            1, alice, bob, amount, uint64(block.timestamp + 30 days), DOC, uwId, saId
        );
        uint256 id = _register(amount, 30 days, bob);
        (address payer, address counterparty, uint256 stored,, bytes32 hash, InvoiceState state, uint256 u, uint256 s) =
            invoices.invoices(id);
        assertEq(payer, alice);
        assertEq(counterparty, bob);
        assertEq(stored, amount);
        assertEq(hash, DOC);
        assertEq(uint8(state), uint8(InvoiceState.Registered));
        assertEq(u, uwId);
        assertEq(s, saId);
    }

    function test_fundWrongAmountReverts() public {
        uint256 id = _register(0.05 ether, 30 days, bob);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(InvalidFundingAmount.selector, 0.01 ether, 0.05 ether));
        vault.fund{value: 0.01 ether}(id);
    }

    function test_attestFromNonUnderwriterReverts() public {
        uint256 id = _register(0.05 ether, 30 days, bob);
        _fund(id, 0.05 ether);
        vm.prank(alice);
        vm.expectRevert(NotUnderwriter.selector);
        attestations.attest(
            id, saId, keccak256("x"), Decision.Approve, 0.05 ether, uint64(block.timestamp + 1 days), MODEL
        );
    }

    function test_approveThenSettleSplits() public {
        uint256 amount = 1 ether;
        uint256 id = _register(amount, 30 days, bob);
        _fund(id, amount);
        _commit(id, Decision.Approve, amount, 7 days);

        uint256 bobBefore = bob.balance;
        uint256 treBefore = treasury.balance;
        uint256 uwBefore = uwWallet.balance;
        uint256 saBefore = saWallet.balance;

        vm.prank(alice);
        vault.settle(id);

        uint256 protocol = amount * 300 / 10_000;
        uint256 uw = amount * 100 / 10_000;
        uint256 sa = amount * 100 / 10_000;
        uint256 payee = amount - protocol - uw - sa;

        assertEq(bob.balance - bobBefore, payee);
        assertEq(treasury.balance - treBefore, protocol);
        assertEq(uwWallet.balance - uwBefore, uw);
        assertEq(saWallet.balance - saBefore, sa);
        assertEq(alice.balance, 10 ether - amount); // no refund
        (,,,,, InvoiceState state,,) = invoices.invoices(id);
        assertEq(uint8(state), uint8(InvoiceState.Settled));
    }

    function test_approveLessRefundsDust() public {
        uint256 amount = 1 ether;
        uint256 approved = 0.4 ether;
        uint256 id = _register(amount, 30 days, bob);
        _fund(id, amount);

        uint256 aliceAfterFund = alice.balance;
        _commit(id, Decision.Approve, approved, 7 days);

        vm.prank(alice);
        vault.settle(id);

        uint256 protocol = approved * 300 / 10_000;
        uint256 uw = approved * 100 / 10_000;
        uint256 sa = approved * 100 / 10_000;
        uint256 payee = approved - protocol - uw - sa;
        uint256 refundAmt = amount - approved;

        assertEq(bob.balance, payee);
        assertEq(treasury.balance, protocol);
        assertEq(uwWallet.balance, uw);
        assertEq(saWallet.balance, sa);
        assertEq(alice.balance, aliceAfterFund + refundAmt);
    }

    function test_grantWithoutAttestationRevertsPermissionDenied() public {
        uint256 amount = 0.05 ether;
        uint256 id = _register(amount, 30 days, bob);
        _fund(id, amount);
        vm.prank(alice);
        vm.expectRevert(PermissionDenied.selector);
        permissions.grant(id, saId, vault.settle.selector, amount, uint64(block.timestamp + 7 days));
    }

    function test_rejectThenRefund() public {
        uint256 amount = 0.05 ether;
        uint256 id = _register(amount, 30 days, bob);
        _fund(id, amount);
        uint256 aliceAfterFund = alice.balance;
        _commit(id, Decision.Reject, 0, 7 days);

        vm.prank(alice);
        vault.refund(id);

        assertEq(alice.balance, aliceAfterFund + amount);
        assertEq(uwWallet.balance, 0);
        assertEq(saWallet.balance, 0);
        assertEq(treasury.balance, 0);
        assertEq(reputation.score(uwId), 0);
    }

    function test_emergencyDrainPermissionDenied() public {
        uint256 amount = 0.05 ether;
        uint256 id = _register(amount, 30 days, bob);
        _fund(id, amount);
        _commit(id, Decision.Approve, amount, 7 days);

        vm.prank(mallory);
        vm.expectRevert(PermissionDenied.selector);
        vault.emergencyDrain(id);
    }

    function test_settleAfterExpiryReverts() public {
        uint256 amount = 0.05 ether;
        uint256 id = _register(amount, 30 days, bob);
        _fund(id, amount);
        _commit(id, Decision.Approve, amount, 1 days);

        vm.warp(block.timestamp + 2 days);
        vm.prank(alice);
        vm.expectRevert(Expired.selector);
        vault.settle(id);
    }

    function test_settleTwiceReverts() public {
        uint256 amount = 0.05 ether;
        uint256 id = _register(amount, 30 days, bob);
        _fund(id, amount);
        _commit(id, Decision.Approve, amount, 7 days);
        vm.prank(alice);
        vault.settle(id);
        vm.prank(alice);
        vm.expectRevert(AlreadySettled.selector);
        vault.settle(id);
    }

    function test_reputationOnlyAfterSettle() public {
        uint256 amount = 0.05 ether;
        uint256 id = _register(amount, 30 days, bob);
        _fund(id, amount);
        assertEq(reputation.score(uwId), 0);
        assertEq(reputation.score(saId), 0);
        _commit(id, Decision.Approve, amount, 7 days);
        assertEq(reputation.score(uwId), 0);
        vm.prank(alice);
        vault.settle(id);
        assertEq(reputation.score(uwId), 1);
        assertEq(reputation.score(saId), 2);
    }

    function test_reentrancyOnSettleGuarded() public {
        ReenterPayee attacker = new ReenterPayee();
        uint256 amount = 1 ether;
        uint256 id = _register(amount, 30 days, address(attacker));
        _fund(id, amount);
        _commit(id, Decision.Approve, amount, 7 days);
        attacker.arm(vault, id);

        vm.prank(alice);
        vm.expectRevert();
        vault.settle(id);
    }

    function test_cannotAttestUnfundedInvoice() public {
        uint256 id = _register(0.05 ether, 30 days, bob);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(InvalidState.selector, uint8(InvoiceState.Registered), uint8(InvoiceState.Funded))
        );
        attestations.attest(
            id, uwId, keccak256("x"), Decision.Approve, 0.05 ether, uint64(block.timestamp + 1 days), MODEL
        );
    }

    function test_cannotRegisterWithOthersAgents() public {
        vm.prank(mallory);
        vm.expectRevert(NotController.selector);
        invoices.register(bob, 0.05 ether, uint64(block.timestamp + 30 days), DOC, uwId, saId);
    }

    function test_wiringNotAdminReverts() public {
        vm.prank(mallory);
        vm.expectRevert(NotAdmin.selector);
        invoices.setVault(mallory);
    }

    function test_settleUnauthorizedCallerReverts() public {
        uint256 amount = 0.05 ether;
        uint256 id = _register(amount, 30 days, bob);
        _fund(id, amount);
        _commit(id, Decision.Approve, amount, 7 days);
        vm.prank(mallory);
        vm.expectRevert(UnauthorizedCaller.selector);
        vault.settle(id);
    }

    function test_refundAfterApprovedExpiry() public {
        uint256 amount = 0.05 ether;
        uint256 id = _register(amount, 30 days, bob);
        _fund(id, amount);
        uint256 aliceAfterFund = alice.balance;
        _commit(id, Decision.Approve, amount, 1 days);
        vm.warp(block.timestamp + 2 days);
        vm.prank(alice);
        vault.refund(id);
        assertEq(alice.balance, aliceAfterFund + amount);
    }

    function test_erc1271MagicValue() public {
        uint256 pk = 0xA11CE;
        address owner = vm.addr(pk);
        vm.prank(owner);
        (, address wallet) = factory.createAgent(AgentType.Underwriter, "UW-1271");

        bytes32 hash = keccak256("civora-challenge");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, hash);
        bytes memory sig = abi.encodePacked(r, s, v);
        bytes4 magic = AgentWallet(payable(wallet)).isValidSignature(hash, sig);
        assertEq(magic, bytes4(0x1626ba7e));

        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(uint256(0xB0B), hash);
        bytes4 bad = AgentWallet(payable(wallet)).isValidSignature(hash, abi.encodePacked(r2, s2, v2));
        assertEq(bad, bytes4(0xffffffff));
    }
}
