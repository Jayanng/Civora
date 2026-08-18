// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AgentIdentity} from "./AgentIdentity.sol";
import {AttestationRegistry} from "./AttestationRegistry.sol";
import {AgentType} from "./Types.sol";
import {
    NotController,
    InvalidAgentType,
    PermissionDenied,
    GrantRevoked,
    Expired,
    AlreadySet,
    NotAdmin,
    ZeroAddress
} from "./Errors.sol";

/// @title PermissionEngine
/// @notice Scoped grants: selector, value cap, time bound. Identity is not authority.
contract PermissionEngine {
    struct Grant {
        uint256 invoiceId;
        uint256 agentId;
        bytes4 selector;
        uint256 maxValue;
        uint64 expiresAt;
        bool revoked;
        address granter;
    }

    AgentIdentity public immutable identity;
    address public immutable admin;
    address public attestationRegistry;
    address public civora;

    uint256 private _nextGrantId = 1;
    mapping(uint256 grantId => Grant) public grants;
    mapping(bytes32 key => uint256 grantId) public grantIdOf;

    event PermissionGranted(
        uint256 indexed grantId,
        uint256 indexed invoiceId,
        uint256 indexed agentId,
        bytes4 selector,
        uint256 maxValue,
        uint64 expiresAt
    );
    event PermissionRevoked(uint256 indexed grantId);
    event AttestationRegistrySet(address indexed attestationRegistry);

    constructor(AgentIdentity identity_) {
        identity = identity_;
        admin = msg.sender;
    }

    function setAttestationRegistry(address attestationRegistry_) external {
        if (msg.sender != admin) revert NotAdmin();
        if (attestationRegistry != address(0)) revert AlreadySet();
        if (attestationRegistry_ == address(0)) revert ZeroAddress();
        attestationRegistry = attestationRegistry_;
        emit AttestationRegistrySet(attestationRegistry_);
    }

    function setCivora(address civora_) external {
        if (msg.sender != admin) revert NotAdmin();
        if (civora != address(0)) revert AlreadySet();
        if (civora_ == address(0)) revert ZeroAddress();
        civora = civora_;
    }

    function grant(uint256 invoiceId, uint256 agentId, bytes4 selector, uint256 maxValue, uint64 expiresAt)
        external
        returns (uint256 grantId)
    {
        if (identity.agentTypeOf(agentId) != AgentType.Settlement) revert InvalidAgentType();
        if (expiresAt <= block.timestamp) revert Expired();
        // A grant must follow a real attestation. Reading the default (empty) attestation would
        // surface a raw ERC721 error from ownerOf(0) instead of a clean PermissionDenied.
        if (!AttestationRegistry(attestationRegistry).hasAttestation(invoiceId)) revert PermissionDenied();

        (, uint256 underwriterId,,,,,,) = AttestationRegistry(attestationRegistry).attestations(invoiceId);
        address underwriterController = identity.ownerOf(underwriterId);
        if (msg.sender != civora && msg.sender != underwriterController) revert NotController();

        bytes32 key = _key(invoiceId, agentId, selector);
        if (grantIdOf[key] != 0) revert AlreadySet();

        grantId = _nextGrantId++;
        grants[grantId] = Grant({
            invoiceId: invoiceId,
            agentId: agentId,
            selector: selector,
            maxValue: maxValue,
            expiresAt: expiresAt,
            revoked: false,
            granter: underwriterController
        });
        grantIdOf[key] = grantId;
        emit PermissionGranted(grantId, invoiceId, agentId, selector, maxValue, expiresAt);
    }

    function revoke(uint256 grantId) external {
        Grant storage g = grants[grantId];
        if (g.granter != msg.sender) revert NotController();
        g.revoked = true;
        emit PermissionRevoked(grantId);
    }

    function check(uint256 invoiceId, uint256 agentId, bytes4 selector, uint256 value) public view {
        uint256 grantId = grantIdOf[_key(invoiceId, agentId, selector)];
        if (grantId == 0) revert PermissionDenied();
        Grant storage g = grants[grantId];
        if (g.revoked) revert GrantRevoked();
        if (block.timestamp >= g.expiresAt) revert Expired();
        if (value > g.maxValue) revert PermissionDenied();
    }

    function _key(uint256 invoiceId, uint256 agentId, bytes4 selector) internal pure returns (bytes32) {
        return keccak256(abi.encode(invoiceId, agentId, selector));
    }
}
