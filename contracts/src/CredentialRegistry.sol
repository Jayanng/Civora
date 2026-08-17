// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AgentIdentity} from "./AgentIdentity.sol";
import {AgentType, UnderwriteDecision, MonitorOutcome, CredentialKind} from "./Types.sol";
import {
    NotController,
    NotUnderwriter,
    NotMonitor,
    InvalidApprovedAmount,
    InvalidPenalty,
    InvalidMonitorOutcome,
    InvalidExpiry,
    AlreadyCredentialed,
    InvalidState,
    ZeroAddress,
    AlreadySet,
    NotAdmin
} from "./Errors.sol";

/// @title CredentialRegistry
/// @notice Underwrite and monitor credentials keyed by assetId. Not invoice-coupled.
contract CredentialRegistry {
    struct UnderwriteCredential {
        uint256 assetId;
        uint256 agentId;
        bytes32 reportHash;
        UnderwriteDecision decision;
        uint256 approvedPrincipalWei;
        uint256 approvedCouponWei;
        uint64 expiresAt;
        bytes32 modelId;
        uint64 issuedAt;
    }

    struct MonitorCredential {
        uint256 assetId;
        uint256 agentId;
        bytes32 reportHash;
        MonitorOutcome outcome;
        uint16 penaltyBps;
        bytes32 evidenceHash;
        uint64 observedAt;
        uint64 expiresAt;
        bytes32 modelId;
        uint64 issuedAt;
    }

    AgentIdentity public immutable identity;
    address public immutable admin;
    address public civora;

    mapping(uint256 assetId => UnderwriteCredential) public underwrites;
    mapping(uint256 assetId => MonitorCredential) public monitors;
    mapping(uint256 assetId => bool) public hasUnderwrite;
    mapping(uint256 assetId => bool) public hasMonitor;

    event UnderwriteCredentialed(
        uint256 indexed assetId,
        uint256 indexed agentId,
        bytes32 reportHash,
        UnderwriteDecision decision,
        uint256 approvedPrincipalWei,
        uint256 approvedCouponWei,
        uint64 expiresAt,
        bytes32 modelId
    );

    event MonitorCredentialed(
        uint256 indexed assetId,
        uint256 indexed agentId,
        bytes32 reportHash,
        MonitorOutcome outcome,
        uint16 penaltyBps,
        bytes32 evidenceHash,
        uint64 expiresAt,
        bytes32 modelId
    );

    constructor(AgentIdentity identity_) {
        if (address(identity_) == address(0)) revert ZeroAddress();
        identity = identity_;
        admin = msg.sender;
    }

    function setCivora(address civora_) external {
        if (msg.sender != admin) revert NotAdmin();
        if (civora != address(0)) revert AlreadySet();
        if (civora_ == address(0)) revert ZeroAddress();
        civora = civora_;
    }

    function submitUnderwrite(
        uint256 assetId,
        uint256 agentId,
        bytes32 reportHash,
        UnderwriteDecision decision,
        uint256 approvedPrincipalWei,
        uint256 approvedCouponWei,
        uint64 expiresAt,
        bytes32 modelId
    ) external {
        if (hasUnderwrite[assetId]) revert AlreadyCredentialed();
        if (identity.agentTypeOf(agentId) != AgentType.Underwriter) revert NotUnderwriter();
        address controller = identity.ownerOf(agentId);
        if (msg.sender != controller && msg.sender != civora) revert NotController();
        if (reportHash == bytes32(0)) revert InvalidApprovedAmount();
        if (expiresAt <= block.timestamp + 10 minutes) revert InvalidExpiry();

        if (decision == UnderwriteDecision.Reject) {
            if (approvedPrincipalWei != 0 || approvedCouponWei != 0) revert InvalidApprovedAmount();
        } else if (decision == UnderwriteDecision.Approve) {
            if (approvedPrincipalWei == 0 || approvedCouponWei == 0) revert InvalidApprovedAmount();
        } else {
            revert InvalidState(uint8(decision), uint8(UnderwriteDecision.Approve));
        }

        hasUnderwrite[assetId] = true;
        underwrites[assetId] = UnderwriteCredential({
            assetId: assetId,
            agentId: agentId,
            reportHash: reportHash,
            decision: decision,
            approvedPrincipalWei: approvedPrincipalWei,
            approvedCouponWei: approvedCouponWei,
            expiresAt: expiresAt,
            modelId: modelId,
            issuedAt: uint64(block.timestamp)
        });

        emit UnderwriteCredentialed(assetId, agentId, reportHash, decision, approvedPrincipalWei, approvedCouponWei, expiresAt, modelId);
    }

    function submitMonitor(
        uint256 assetId,
        uint256 agentId,
        bytes32 reportHash,
        MonitorOutcome outcome,
        uint16 penaltyBps,
        bytes32 evidenceHash,
        uint64 observedAt,
        uint64 expiresAt,
        bytes32 modelId
    ) external {
        if (hasMonitor[assetId]) revert AlreadyCredentialed();
        if (identity.agentTypeOf(agentId) != AgentType.ComplianceMonitor) revert NotMonitor();
        address controller = identity.ownerOf(agentId);
        if (msg.sender != controller && msg.sender != civora) revert NotController();
        if (reportHash == bytes32(0)) revert InvalidApprovedAmount();
        if (evidenceHash == bytes32(0)) revert InvalidApprovedAmount();
        if (observedAt > block.timestamp) revert InvalidExpiry();
        if (expiresAt <= block.timestamp + 10 minutes) revert InvalidExpiry();

        if (outcome == MonitorOutcome.TargetMet) {
            if (penaltyBps != 0) revert InvalidPenalty();
        } else if (outcome == MonitorOutcome.TargetMissed) {
            if (penaltyBps == 0 || penaltyBps > 10000) revert InvalidPenalty();
        } else {
            revert InvalidMonitorOutcome();
        }

        hasMonitor[assetId] = true;
        monitors[assetId] = MonitorCredential({
            assetId: assetId,
            agentId: agentId,
            reportHash: reportHash,
            outcome: outcome,
            penaltyBps: penaltyBps,
            evidenceHash: evidenceHash,
            observedAt: observedAt,
            expiresAt: expiresAt,
            modelId: modelId,
            issuedAt: uint64(block.timestamp)
        });

        emit MonitorCredentialed(assetId, agentId, reportHash, outcome, penaltyBps, evidenceHash, expiresAt, modelId);
    }
}