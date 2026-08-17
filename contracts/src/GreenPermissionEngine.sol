// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AgentIdentity} from "./AgentIdentity.sol";
import {CredentialRegistry} from "./CredentialRegistry.sol";
import {AgentType} from "./Types.sol";
import {
    NotController,
    NotSettlement,
    PermissionDenied,
    GrantRevoked,
    Expired,
    AlreadySet,
    NotAdmin,
    ZeroAddress
} from "./Errors.sol";

/// @title GreenPermissionEngine
/// @notice Scoped assetId grants for the green Civora path. Not invoice-coupled.
contract GreenPermissionEngine {
    struct Grant {
        uint256 assetId;
        uint256 agentId;
        bytes4 selector;
        uint256 maxValue;
        uint64 expiresAt;
        bool revoked;
        address granter;
    }

    AgentIdentity public immutable identity;
    address public immutable admin;
    CredentialRegistry public credentialRegistry;
    address public civora;

    uint256 private _nextGrantId = 1;
    mapping(uint256 grantId => Grant) public grants;
    mapping(bytes32 key => uint256 grantId) public grantIdOf;

    event PermissionGranted(
        uint256 indexed grantId, uint256 indexed assetId, uint256 indexed agentId,
        bytes4 selector, uint256 maxValue, uint64 expiresAt
    );
    event PermissionRevoked(uint256 indexed grantId);

    constructor(AgentIdentity identity_) {
        identity = identity_;
        admin = msg.sender;
    }

    function setCredentialRegistry(CredentialRegistry credentialRegistry_) external {
        if (msg.sender != admin) revert NotAdmin();
        if (address(credentialRegistry) != address(0)) revert AlreadySet();
        if (address(credentialRegistry_) == address(0)) revert ZeroAddress();
        credentialRegistry = credentialRegistry_;
    }

    function setCivora(address civora_) external {
        if (msg.sender != admin) revert NotAdmin();
        if (civora != address(0)) revert AlreadySet();
        if (civora_ == address(0)) revert ZeroAddress();
        civora = civora_;
    }

    function grant(uint256 assetId, uint256 agentId, bytes4 selector, uint256 maxValue, uint64 expiresAt)
        external
        returns (uint256 grantId)
    {
        if (identity.agentTypeOf(agentId) != AgentType.Settlement) revert NotSettlement();
        if (expiresAt <= block.timestamp) revert Expired();
        if (!credentialRegistry.hasUnderwrite(assetId)) revert PermissionDenied();

        (, uint256 underwriterId,,,,,,,) = credentialRegistry.underwrites(assetId);
        address underwriterController = identity.ownerOf(underwriterId);
        if (msg.sender != civora && msg.sender != underwriterController) revert NotController();

        bytes32 key = _key(assetId, agentId, selector);
        if (grantIdOf[key] != 0) revert AlreadySet();

        grantId = _nextGrantId++;
        grants[grantId] = Grant({
            assetId: assetId,
            agentId: agentId,
            selector: selector,
            maxValue: maxValue,
            expiresAt: expiresAt,
            revoked: false,
            granter: underwriterController
        });
        grantIdOf[key] = grantId;
        emit PermissionGranted(grantId, assetId, agentId, selector, maxValue, expiresAt);
    }

    function revoke(uint256 grantId) external {
        Grant storage g = grants[grantId];
        if (g.granter != msg.sender) revert NotController();
        g.revoked = true;
        emit PermissionRevoked(grantId);
    }

    function check(uint256 assetId, uint256 agentId, bytes4 selector, uint256 value) public view {
        uint256 grantId = grantIdOf[_key(assetId, agentId, selector)];
        if (grantId == 0) revert PermissionDenied();
        Grant storage g = grants[grantId];
        if (g.revoked) revert GrantRevoked();
        if (block.timestamp >= g.expiresAt) revert Expired();
        if (value > g.maxValue) revert PermissionDenied();
    }

    function _key(uint256 assetId, uint256 agentId, bytes4 selector) internal pure returns (bytes32) {
        return keccak256(abi.encode(assetId, agentId, selector));
    }
}