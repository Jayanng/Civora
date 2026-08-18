// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentIdentity} from "../src/AgentIdentity.sol";
import {AgentFactory} from "../src/AgentFactory.sol";
import {AgentType, UnderwriteDecision, MonitorOutcome} from "../src/Types.sol";
import {InvalidAgentType, InvalidApprovedAmount, InvalidPenalty, InvalidMonitorOutcome, AlreadyCredentialed, NotController, PermissionDenied, NotSettlement, Expired, GrantRevoked, InvalidFundingAmount, NotPayer, NothingToRefund, AlreadySettled, UnauthorizedCaller, NotMonitored, InvalidState, InvalidExpiry} from "../src/Errors.sol";
import {CredentialRegistry} from "../src/CredentialRegistry.sol";
import {GreenPermissionEngine} from "../src/GreenPermissionEngine.sol";
import {GreenAssetRegistry} from "../src/GreenAssetRegistry.sol";
import {AssetType, AssetState} from "../src/Types.sol";
import {InvalidHolder, InvalidTargetHash, InvalidMaturity} from "../src/Errors.sol";
import {SettlementAndPenaltyVault} from "../src/SettlementAndPenaltyVault.sol";
import {Reputation} from "../src/Reputation.sol";
import {CivoraGreen} from "../src/CivoraGreen.sol";

contract CivoraGreenTest is Test {
    AgentIdentity internal identity;
    AgentFactory internal factory;
    CredentialRegistry internal credentials;
    GreenPermissionEngine internal permissions;
    GreenAssetRegistry internal assets;
    SettlementAndPenaltyVault internal vault;
    Reputation internal reputation;
    CivoraGreen internal civora;
    address internal treasury = makeAddr("treasury");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    uint256 internal uwId;
    uint256 internal monId;
    uint256 internal saId;

    bytes32 internal constant MODEL = keccak256("deepseek-ai/DeepSeek-V4-Flash");
    bytes32 internal constant REPORT = keccak256("report");
    bytes32 internal constant EVIDENCE = keccak256("evidence");
    bytes32 internal constant TARGET = keccak256("target");
    bytes32 internal constant DOC = keccak256("doc");

    function setUp() public {
        identity = new AgentIdentity();
        factory = new AgentFactory(identity);
        identity.setFactory(address(factory));

        vm.startPrank(alice);
        (uwId,) = factory.createAgent(AgentType.Underwriter, "UW-01");
        (monId,) = factory.createAgent(AgentType.ComplianceMonitor, "MON-01");
        (saId,) = factory.createAgent(AgentType.Settlement, "SA-01");
        vm.stopPrank();

        credentials = new CredentialRegistry(identity);
        permissions = new GreenPermissionEngine(identity);
        permissions.setCredentialRegistry(credentials);
        assets = new GreenAssetRegistry(identity);
        reputation = new Reputation();
        vault = new SettlementAndPenaltyVault(identity, assets, credentials, permissions, reputation, treasury);
        assets.setVault(address(vault));
        reputation.setVault(address(vault));

        civora = new CivoraGreen(identity, factory, assets, credentials, permissions, vault, reputation);
        assets.setAttestor(address(civora));
        credentials.setCivora(address(civora));
        permissions.setCivora(address(civora));

        vm.deal(alice, 10 ether);
    }

    function _registerAsset(uint256 p, uint256 c) internal returns (uint256 assetId) {
        vm.prank(alice);
        assetId = assets.register(
            bob, AssetType.SustainabilityLinkedBond, p, c,
            TARGET, DOC, uint64(block.timestamp + 30 days), uwId, monId, saId
        );
    }

    function test_createThreeAgentTypes() public {
        vm.startPrank(alice);
        (uint256 uw,) = factory.createAgent(AgentType.Underwriter, "UW-01");
        (uint256 mon,) = factory.createAgent(AgentType.ComplianceMonitor, "MON-01");
        (uint256 sa,) = factory.createAgent(AgentType.Settlement, "SA-01");
        vm.stopPrank();
        assertEq(uint8(identity.agentTypeOf(uw)), uint8(AgentType.Underwriter));
        assertEq(uint8(identity.agentTypeOf(mon)), uint8(AgentType.ComplianceMonitor));
        assertEq(uint8(identity.agentTypeOf(sa)), uint8(AgentType.Settlement));
    }

    function test_rejectNoneAgentType() public {
        vm.prank(alice);
        vm.expectRevert(InvalidAgentType.selector);
        factory.createAgent(AgentType.None, "bad");
    }

    function test_agentTypeOrdinalsPreserveNoneFirst() public pure {
        assertEq(uint8(AgentType.None), 0);
        assertEq(uint8(AgentType.Underwriter), 1);
        assertEq(uint8(AgentType.ComplianceMonitor), 2);
        assertEq(uint8(AgentType.Settlement), 3);
    }

    function test_underwriteRejectRequiresZeroApprovals() public {
        vm.prank(alice);
        vm.expectRevert(InvalidApprovedAmount.selector);
        credentials.submitUnderwrite(
            1, uwId, REPORT, UnderwriteDecision.Reject, 1 ether, 0.1 ether,
            uint64(block.timestamp + 7 days), MODEL
        );
    }

    function test_monitorMissRequiresPositivePenalty() public {
        // first submit an underwrite approve
        vm.prank(alice);
        credentials.submitUnderwrite(
            1, uwId, REPORT, UnderwriteDecision.Approve, 1 ether, 0.1 ether,
            uint64(block.timestamp + 7 days), MODEL
        );
        vm.prank(alice);
        vm.expectRevert(InvalidPenalty.selector);
        credentials.submitMonitor(
            1, monId, REPORT, MonitorOutcome.TargetMissed, 0, EVIDENCE,
            uint64(block.timestamp), uint64(block.timestamp + 7 days), MODEL
        );
    }

    function test_monitorMetRequiresZeroPenalty() public {
        vm.prank(alice);
        credentials.submitUnderwrite(
            1, uwId, REPORT, UnderwriteDecision.Approve, 1 ether, 0.1 ether,
            uint64(block.timestamp + 7 days), MODEL
        );
        vm.prank(alice);
        vm.expectRevert(InvalidPenalty.selector);
        credentials.submitMonitor(
            1, monId, REPORT, MonitorOutcome.TargetMet, 500, EVIDENCE,
            uint64(block.timestamp), uint64(block.timestamp + 7 days), MODEL
        );
    }

    function test_doubleUnderwriteReverts() public {
        vm.prank(alice);
        credentials.submitUnderwrite(
            1, uwId, REPORT, UnderwriteDecision.Approve, 1 ether, 0.1 ether,
            uint64(block.timestamp + 7 days), MODEL
        );
        vm.prank(alice);
        vm.expectRevert(AlreadyCredentialed.selector);
        credentials.submitUnderwrite(
            1, uwId, REPORT, UnderwriteDecision.Reject, 0, 0,
            uint64(block.timestamp + 7 days), MODEL
        );
    }

    function _submitApprove() internal {
        vm.prank(alice);
        credentials.submitUnderwrite(
            1, uwId, REPORT, UnderwriteDecision.Approve, 1 ether, 0.1 ether,
            uint64(block.timestamp + 7 days), MODEL
        );
    }

    function test_civoraCanCreateGrant() public {
        _submitApprove();
        vm.prank(address(civora));
        uint256 grantId = permissions.grant(1, saId, bytes4(keccak256("settle(uint256)")), 1.1 ether, uint64(block.timestamp + 7 days));
        assertTrue(grantId > 0);
        permissions.check(1, saId, bytes4(keccak256("settle(uint256)")), 1.1 ether);
    }

    function test_underwriterControllerCanCreateGrant() public {
        _submitApprove();
        vm.prank(alice);
        uint256 grantId = permissions.grant(1, saId, bytes4(keccak256("settle(uint256)")), 1.1 ether, uint64(block.timestamp + 7 days));
        assertTrue(grantId > 0);
    }

    function test_nonSettlementAgentCannotReceiveGrant() public {
        _submitApprove();
        vm.prank(alice);
        vm.expectRevert(NotSettlement.selector);
        permissions.grant(1, uwId, bytes4(keccak256("settle(uint256)")), 1.1 ether, uint64(block.timestamp + 7 days));
    }

    function test_checkWithoutGrantRevertsPermissionDenied() public {
        _submitApprove();
        vm.prank(alice);
        vm.expectRevert(PermissionDenied.selector);
        permissions.check(1, saId, bytes4(keccak256("settle(uint256)")), 1.1 ether);
    }

    function test_rejectUnderwriteBlocksGrant() public {
        vm.prank(alice);
        credentials.submitUnderwrite(
            1, uwId, REPORT, UnderwriteDecision.Reject, 0, 0,
            uint64(block.timestamp + 7 days), MODEL
        );
        vm.prank(alice);
        vm.expectRevert(PermissionDenied.selector);
        permissions.grant(1, saId, bytes4(keccak256("settle(uint256)")), 1.1 ether, uint64(block.timestamp + 7 days));
    }

    function test_revokeBlocksCheck() public {
        _submitApprove();
        vm.prank(alice);
        uint256 grantId = permissions.grant(1, saId, bytes4(keccak256("settle(uint256)")), 1.1 ether, uint64(block.timestamp + 7 days));
        vm.prank(alice);
        permissions.revoke(grantId);
        vm.prank(alice);
        vm.expectRevert(GrantRevoked.selector);
        permissions.check(1, saId, bytes4(keccak256("settle(uint256)")), 1.1 ether);
    }

    function test_registerGreenAsset() public {
        uint256 id = _registerAsset(1 ether, 0.1 ether);
        (
            address issuer, address holder, AssetType assetType, uint256 principal, uint256 coupon,
            bytes32 targetHash, bytes32 docHash, uint64 maturity, uint256 uw, uint256 mon, uint256 sa, AssetState state
        ) = assets.assets(id);
        assertEq(issuer, alice);
        assertEq(holder, bob);
        assertEq(uint8(assetType), uint8(AssetType.SustainabilityLinkedBond));
        assertEq(principal, 1 ether);
        assertEq(coupon, 0.1 ether);
        assertEq(targetHash, TARGET);
        assertEq(docHash, DOC);
        assertEq(maturity, block.timestamp + 30 days);
        assertEq(uw, uwId);
        assertEq(mon, monId);
        assertEq(sa, saId);
        assertEq(uint8(state), uint8(AssetState.Registered));
    }

    function test_registerRejectsIssuerAsHolder() public {
        vm.prank(alice);
        vm.expectRevert(InvalidHolder.selector);
        assets.register(
            alice, AssetType.SustainabilityLinkedBond, 1 ether, 0.1 ether,
            TARGET, DOC, uint64(block.timestamp + 30 days), uwId, monId, saId
        );
    }

    function test_registerRequiresTargetAndMaturity() public {
        vm.prank(alice);
        vm.expectRevert(InvalidTargetHash.selector);
        assets.register(
            bob, AssetType.SustainabilityLinkedBond, 1 ether, 0.1 ether,
            bytes32(0), DOC, uint64(block.timestamp + 30 days), uwId, monId, saId
        );
        vm.prank(alice);
        vm.expectRevert(InvalidMaturity.selector);
        assets.register(
            bob, AssetType.SustainabilityLinkedBond, 1 ether, 0.1 ether,
            TARGET, DOC, uint64(block.timestamp), uwId, monId, saId
        );
    }

    function _fundAsset(uint256 id, uint256 p, uint256 c) internal {
        vm.prank(alice);
        vault.fund{value: p + c}(id);
    }

    function _driveToMonitored(uint256 assetId, uint256 p, uint256 c, MonitorOutcome outcome, uint16 penaltyBps) internal {
        vm.prank(alice);
        civora.underwriteCommit(assetId, uwId, REPORT, UnderwriteDecision.Approve, p, c, uint64(block.timestamp + 7 days), MODEL);
        vm.prank(alice);
        civora.monitorCommit(assetId, monId, REPORT, outcome, penaltyBps, EVIDENCE, uint64(block.timestamp), uint64(block.timestamp + 7 days), MODEL);
    }

    function test_fundRequiresPrincipalPlusCoupon() public {
        uint256 id = _registerAsset(1 ether, 0.1 ether);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(InvalidFundingAmount.selector, 0.05 ether, 1.1 ether));
        vault.fund{value: 0.05 ether}(id);
    }

    function test_settleTargetMetSplitsCouponOnly() public {
        uint256 p = 1 ether;
        uint256 c = 0.1 ether;
        uint256 id = _registerAsset(p, c);
        _fundAsset(id, p, c);
        _driveToMonitored(id, p, c, MonitorOutcome.TargetMet, 0);

        uint256 bobBefore = bob.balance;
        uint256 treBefore = treasury.balance;
        uint256 uwBefore = identity.walletOf(uwId).balance;
        uint256 monBefore = identity.walletOf(monId).balance;
        uint256 saBefore = identity.walletOf(saId).balance;

        vm.prank(alice);
        vault.settle(id);

        uint256 protocol = c * 300 / 10_000;
        uint256 uw = c * 100 / 10_000;
        uint256 mon = c * 100 / 10_000;
        uint256 sa = c * 100 / 10_000;
        uint256 holderCoupon = c - protocol - uw - mon - sa;

        assertEq(bob.balance - bobBefore, p + holderCoupon);
        assertEq(treasury.balance - treBefore, protocol);
        assertEq(identity.walletOf(uwId).balance - uwBefore, uw);
        assertEq(identity.walletOf(monId).balance - monBefore, mon);
        assertEq(identity.walletOf(saId).balance - saBefore, sa);
        (, , , , , , , , , , , AssetState state) = assets.assets(id);
        assertEq(uint8(state), uint8(AssetState.Settled));
    }

    function test_settleTargetMissedHaircutToTreasury() public {
        uint256 p = 1 ether;
        uint256 c = 0.1 ether;
        uint256 id = _registerAsset(p, c);
        _fundAsset(id, p, c);
        _driveToMonitored(id, p, c, MonitorOutcome.TargetMissed, 2000);

        uint256 bobBefore = bob.balance;
        uint256 treBefore = treasury.balance;

        vm.prank(alice);
        vault.settle(id);

        uint256 haircut = c * 2000 / 10_000;
        uint256 live = c - haircut;
        uint256 protocol = live * 300 / 10_000;
        uint256 uw = live * 100 / 10_000;
        uint256 mon = live * 100 / 10_000;
        uint256 sa = live * 100 / 10_000;
        uint256 holderCoupon = live - protocol - uw - mon - sa;

        assertEq(bob.balance - bobBefore, p + holderCoupon);
        assertEq(treasury.balance - treBefore, protocol + haircut);
    }

    function test_settleBeforeMonitorReverts() public {
        uint256 p = 1 ether;
        uint256 c = 0.1 ether;
        uint256 id = _registerAsset(p, c);
        _fundAsset(id, p, c);
        vm.prank(alice);
        civora.underwriteCommit(id, uwId, REPORT, UnderwriteDecision.Approve, p, c, uint64(block.timestamp + 7 days), MODEL);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(InvalidState.selector, 3, 4));
        vault.settle(id);
    }

    function test_settleRejectsMismatchedCredentialAgent() public {
        uint256 p = 1 ether;
        uint256 c = 0.1 ether;
        uint256 id = _registerAsset(p, c);
        _fundAsset(id, p, c);
        // submit underwrite from a DIFFERENT underwriter than the asset's assigned id
        vm.startPrank(alice);
        (uint256 otherUw,) = factory.createAgent(AgentType.Underwriter, "UW-02");
        vm.stopPrank();
        vm.prank(alice);
        credentials.submitUnderwrite(
            id, otherUw, REPORT, UnderwriteDecision.Approve, p, c,
            uint64(block.timestamp + 7 days), MODEL
        );
        vm.prank(alice);
        permissions.grant(id, saId, vault.settle.selector, p + c, uint64(block.timestamp + 7 days));
        vm.prank(address(civora));
        assets.markUnderwritten(id);
        vm.prank(address(civora));
        assets.markMonitored(id);
        vm.prank(alice);
        credentials.submitMonitor(
            id, monId, REPORT, MonitorOutcome.TargetMet, 0, EVIDENCE,
            uint64(block.timestamp), uint64(block.timestamp + 7 days), MODEL
        );
        vm.prank(alice);
        vm.expectRevert(PermissionDenied.selector);
        vault.settle(id);
    }

    function test_emergencyDrainPermissionDenied() public {
        uint256 p = 1 ether;
        uint256 c = 0.1 ether;
        uint256 id = _registerAsset(p, c);
        _fundAsset(id, p, c);
        vm.prank(alice);
        vm.expectRevert(PermissionDenied.selector);
        vault.emergencyDrain(id);
    }

    function test_reputationOnlyOnSettle() public {
        uint256 p = 1 ether;
        uint256 c = 0.1 ether;
        uint256 id = _registerAsset(p, c);
        _fundAsset(id, p, c);
        _driveToMonitored(id, p, c, MonitorOutcome.TargetMet, 0);

        assertEq(reputation.score(uwId), 0);
        assertEq(reputation.score(monId), 0);
        assertEq(reputation.score(saId), 0);

        vm.prank(alice);
        vault.settle(id);

        assertEq(reputation.score(uwId), 1);
        assertEq(reputation.score(monId), 2);
        assertEq(reputation.score(saId), 1);
    }

    function test_rejectUnderwriteRefundsFullEscrow() public {
        uint256 p = 1 ether;
        uint256 c = 0.1 ether;
        uint256 id = _registerAsset(p, c);
        _fundAsset(id, p, c);
        vm.prank(alice);
        civora.underwriteCommit(id, uwId, REPORT, UnderwriteDecision.Reject, 0, 0, uint64(block.timestamp + 7 days), MODEL);
        uint256 aliceAfterFund = alice.balance;
        vm.prank(alice);
        vault.refund(id);
        assertEq(alice.balance, aliceAfterFund + p + c);
    }

    function test_expiredFundedAssetRefundsIssuer() public {
        uint256 p = 1 ether;
        uint256 c = 0.1 ether;
        uint256 id = _registerAsset(p, c);
        _fundAsset(id, p, c);
        uint256 aliceAfterFund = alice.balance;
        vm.warp(block.timestamp + 31 days);
        vm.prank(alice);
        vault.refund(id);
        assertEq(alice.balance, aliceAfterFund + p + c);
    }

    function test_expiredUnderwrittenAssetWithoutMonitorRefundsIssuer() public {
        uint256 p = 1 ether;
        uint256 c = 0.1 ether;
        uint256 id = _registerAsset(p, c);
        _fundAsset(id, p, c);
        vm.prank(alice);
        civora.underwriteCommit(id, uwId, REPORT, UnderwriteDecision.Approve, p, c, uint64(block.timestamp + 7 days), MODEL);
        uint256 aliceAfterFund = alice.balance;
        vm.warp(block.timestamp + 8 days);
        vm.prank(alice);
        vault.refund(id);
        assertEq(alice.balance, aliceAfterFund + p + c);
    }

    function test_underwriteCommitApproveGrantsSettle() public {
        uint256 p = 1 ether;
        uint256 c = 0.1 ether;
        uint256 id = _registerAsset(p, c);
        _fundAsset(id, p, c);
        vm.prank(alice);
        civora.underwriteCommit(id, uwId, REPORT, UnderwriteDecision.Approve, p, c, uint64(block.timestamp + 7 days), MODEL);
        (, , , , , , , , , , , AssetState state) = assets.assets(id);
        assertEq(uint8(state), uint8(AssetState.Underwritten));
        permissions.check(id, saId, vault.settle.selector, p + c);
    }

    function test_underwriteCommitExpiryBoundedByMaturity() public {
        uint256 p = 1 ether;
        uint256 c = 0.1 ether;
        uint256 id = _registerAsset(p, c); // maturity = now + 30 days
        _fundAsset(id, p, c);
        vm.prank(alice);
        vm.expectRevert(InvalidExpiry.selector);
        civora.underwriteCommit(id, uwId, REPORT, UnderwriteDecision.Approve, p, c, uint64(block.timestamp + 31 days), MODEL);
    }

    function test_monitorCommitExpiryBoundedByMaturity() public {
        uint256 p = 1 ether;
        uint256 c = 0.1 ether;
        uint256 id = _registerAsset(p, c); // maturity = now + 30 days
        _fundAsset(id, p, c);
        vm.prank(alice);
        civora.underwriteCommit(id, uwId, REPORT, UnderwriteDecision.Approve, p, c, uint64(block.timestamp + 7 days), MODEL);
        vm.prank(alice);
        vm.expectRevert(InvalidExpiry.selector);
        civora.monitorCommit(id, monId, REPORT, MonitorOutcome.TargetMet, 0, EVIDENCE, uint64(block.timestamp), uint64(block.timestamp + 31 days), MODEL);
    }

    function test_underwriteCommitRejectLeavesFunded() public {
        uint256 p = 1 ether;
        uint256 c = 0.1 ether;
        uint256 id = _registerAsset(p, c);
        _fundAsset(id, p, c);
        vm.prank(alice);
        civora.underwriteCommit(id, uwId, REPORT, UnderwriteDecision.Reject, 0, 0, uint64(block.timestamp + 7 days), MODEL);
        (, , , , , , , , , , , AssetState state) = assets.assets(id);
        assertEq(uint8(state), uint8(AssetState.Funded));
        vm.prank(alice);
        vm.expectRevert(PermissionDenied.selector);
        permissions.check(id, saId, vault.settle.selector, p + c);
    }

    function test_monitorCommitThenSettle() public {
        uint256 p = 1 ether;
        uint256 c = 0.1 ether;
        uint256 id = _registerAsset(p, c);
        _fundAsset(id, p, c);
        vm.prank(alice);
        civora.underwriteCommit(id, uwId, REPORT, UnderwriteDecision.Approve, p, c, uint64(block.timestamp + 7 days), MODEL);
        vm.prank(alice);
        civora.monitorCommit(id, monId, REPORT, MonitorOutcome.TargetMet, 0, EVIDENCE, uint64(block.timestamp), uint64(block.timestamp + 7 days), MODEL);
        (, , , , , , , , , , , AssetState state) = assets.assets(id);
        assertEq(uint8(state), uint8(AssetState.Monitored));
        vm.prank(alice);
        vault.settle(id);
    }

    function test_fullMissedTargetPath() public {
        uint256 p = 1 ether;
        uint256 c = 0.1 ether;
        uint256 id = _registerAsset(p, c);
        _fundAsset(id, p, c);
        vm.prank(alice);
        civora.underwriteCommit(id, uwId, REPORT, UnderwriteDecision.Approve, p, c, uint64(block.timestamp + 7 days), MODEL);
        vm.prank(alice);
        civora.monitorCommit(id, monId, REPORT, MonitorOutcome.TargetMissed, 2000, EVIDENCE, uint64(block.timestamp), uint64(block.timestamp + 7 days), MODEL);
        uint256 bobBefore = bob.balance;
        uint256 treBefore = treasury.balance;
        vm.prank(alice);
        vault.settle(id);
        uint256 haircut = c * 2000 / 10_000;
        uint256 live = c - haircut;
        uint256 protocol = live * 300 / 10_000;
        uint256 uw = live * 100 / 10_000;
        uint256 mon = live * 100 / 10_000;
        uint256 sa = live * 100 / 10_000;
        uint256 holderCoupon = live - protocol - uw - mon - sa;
        assertEq(bob.balance - bobBefore, p + holderCoupon);
        assertEq(treasury.balance - treBefore, protocol + haircut);
    }
}