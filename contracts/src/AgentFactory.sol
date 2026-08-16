// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AgentIdentity} from "./AgentIdentity.sol";
import {AgentWallet} from "./AgentWallet.sol";
import {AgentType} from "./Types.sol";
import {InvalidName, InvalidAgentType} from "./Errors.sol";

/// @title AgentFactory
/// @notice One tx: mint identity NFT + deploy AgentWallet + bind.
contract AgentFactory {
    AgentIdentity public immutable identity;

    event AgentCreated(
        uint256 indexed agentId, address indexed owner, AgentType agentType, address wallet, string name
    );

    constructor(AgentIdentity identity_) {
        identity = identity_;
    }

    function createAgent(AgentType agentType, string calldata name) external returns (uint256 agentId, address wallet) {
        uint256 nameLen = bytes(name).length;
        if (nameLen < 3 || nameLen > 32) revert InvalidName();
        if (agentType != AgentType.Underwriter && agentType != AgentType.Settlement) {
            revert InvalidAgentType();
        }

        agentId = identity.mint(msg.sender, agentType, "");
        identity.setName(agentId, name);
        identity.setTokenURI(agentId, string.concat("/api/agents/", _uintToString(agentId)));

        wallet = address(new AgentWallet(address(identity), agentId));
        identity.bindWallet(agentId, wallet);

        emit AgentCreated(agentId, msg.sender, agentType, wallet, name);
    }

    function _uintToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + (value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
