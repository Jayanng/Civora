// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentIdentity} from "../src/AgentIdentity.sol";
import {AgentFactory} from "../src/AgentFactory.sol";
import {AgentType} from "../src/Types.sol";
import {InvalidAgentType} from "../src/Errors.sol";

contract CivoraGreenTest is Test {
    AgentIdentity internal identity;
    AgentFactory internal factory;
    address internal alice = makeAddr("alice");

    function setUp() public {
        identity = new AgentIdentity();
        factory = new AgentFactory(identity);
        identity.setFactory(address(factory));
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
}