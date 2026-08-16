// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {NotVault, AlreadySet, NotAdmin, ZeroAddress} from "./Errors.sol";

/// @title Reputation
/// @notice Basic on-chain score. Only the vault may update after settlement.
contract Reputation {
    address public immutable admin;
    address public vault;
    mapping(uint256 agentId => uint256) public score;

    event ReputationUpdated(uint256 indexed agentId, uint256 newScore, bytes32 reason);
    event VaultSet(address indexed vault);

    constructor() {
        admin = msg.sender;
    }

    function setVault(address vault_) external {
        if (msg.sender != admin) revert NotAdmin();
        if (vault != address(0)) revert AlreadySet();
        if (vault_ == address(0)) revert ZeroAddress();
        vault = vault_;
        emit VaultSet(vault_);
    }

    function bump(uint256 agentId, uint256 delta, bytes32 reason) external {
        if (msg.sender != vault) revert NotVault();
        uint256 next = score[agentId] + delta;
        score[agentId] = next;
        emit ReputationUpdated(agentId, next, reason);
    }
}
