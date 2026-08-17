// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentIdentity} from "../src/AgentIdentity.sol";
import {AgentFactory} from "../src/AgentFactory.sol";
import {AgentType, UnderwriteDecision, MonitorOutcome} from "../src/Types.sol";
import {InvalidAgentType, InvalidApprovedAmount, InvalidPenalty, InvalidMonitorOutcome, AlreadyCredentialed, NotController} from "../src/Errors.sol";
import {CredentialRegistry} from "../src/CredentialRegistry.sol";

contract CivoraGreenTest is Test {
    AgentIdentity internal identity;
    AgentFactory internal factory;
    CredentialRegistry internal credentials;
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    uint256 internal uwId;
    uint256 internal monId;
    uint256 internal saId;

    bytes32 internal constant MODEL = keccak256("deepseek-ai/DeepSeek-V4-Flash");
    bytes32 internal constant REPORT = keccak256("report");
    bytes32 internal constant EVIDENCE = keccak256("evidence");

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
}