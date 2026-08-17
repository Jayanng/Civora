// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentIdentity} from "../src/AgentIdentity.sol";
import {AgentFactory} from "../src/AgentFactory.sol";
import {AgentType, UnderwriteDecision, MonitorOutcome} from "../src/Types.sol";
import {InvalidAgentType, InvalidApprovedAmount, InvalidPenalty, InvalidMonitorOutcome, AlreadyCredentialed, NotController, PermissionDenied, NotSettlement, Expired, GrantRevoked} from "../src/Errors.sol";
import {CredentialRegistry} from "../src/CredentialRegistry.sol";
import {GreenPermissionEngine} from "../src/GreenPermissionEngine.sol";
import {GreenAssetRegistry} from "../src/GreenAssetRegistry.sol";
import {AssetType, AssetState} from "../src/Types.sol";
import {InvalidHolder, InvalidTargetHash, InvalidMaturity} from "../src/Errors.sol";

contract CivoraGreenTest is Test {
    AgentIdentity internal identity;
    AgentFactory internal factory;
    CredentialRegistry internal credentials;
    GreenPermissionEngine internal permissions;
    GreenAssetRegistry internal assets;
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
        address civoraAddr = makeAddr("civora");
        permissions.setCivora(civoraAddr);
        vm.prank(civoraAddr);
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
}