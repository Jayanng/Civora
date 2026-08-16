// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AgentIdentity} from "./AgentIdentity.sol";
import {InvoiceRegistry} from "./InvoiceRegistry.sol";
import {AgentType, Decision, InvoiceState} from "./Types.sol";
import {
    NotUnderwriter,
    NotController,
    AlreadyAttested,
    InvalidDecision,
    InvalidApprovedAmount,
    InvalidExpiry,
    InvalidState,
    AlreadySet,
    NotAdmin,
    ZeroAddress
} from "./Errors.sol";

/// @title AttestationRegistry
/// @notice On-chain commitments of underwriting reports (ERC-8004 Validation analogue).
contract AttestationRegistry {
    struct Attestation {
        uint256 invoiceId;
        uint256 agentId;
        bytes32 reportHash;
        Decision decision;
        uint256 approvedAmount;
        uint64 expiresAt;
        bytes32 modelId;
        uint64 issuedAt;
    }

    AgentIdentity public immutable identity;
    address public immutable admin;
    address public invoiceRegistry;
    address public civora;

    mapping(uint256 invoiceId => Attestation) public attestations;
    mapping(uint256 invoiceId => bool) public hasAttestation;

    event Attested(
        uint256 indexed invoiceId,
        uint256 indexed agentId,
        bytes32 reportHash,
        Decision decision,
        uint256 approvedAmount,
        uint64 expiresAt,
        bytes32 modelId
    );
    event InvoiceRegistrySet(address indexed invoiceRegistry);

    constructor(AgentIdentity identity_) {
        identity = identity_;
        admin = msg.sender;
    }

    function setInvoiceRegistry(address invoiceRegistry_) external {
        if (msg.sender != admin) revert NotAdmin();
        if (invoiceRegistry != address(0)) revert AlreadySet();
        if (invoiceRegistry_ == address(0)) revert ZeroAddress();
        invoiceRegistry = invoiceRegistry_;
        emit InvoiceRegistrySet(invoiceRegistry_);
    }

    function setCivora(address civora_) external {
        if (msg.sender != admin) revert NotAdmin();
        if (civora != address(0)) revert AlreadySet();
        if (civora_ == address(0)) revert ZeroAddress();
        civora = civora_;
    }

    function attest(
        uint256 invoiceId,
        uint256 agentId,
        bytes32 reportHash,
        Decision decision,
        uint256 approvedAmount,
        uint64 expiresAt,
        bytes32 modelId
    ) external {
        if (hasAttestation[invoiceId]) revert AlreadyAttested();
        if (identity.agentTypeOf(agentId) != AgentType.Underwriter) revert NotUnderwriter();
        address controller = identity.ownerOf(agentId);
        if (msg.sender != controller && msg.sender != civora) revert NotController();

        (,, uint256 invoiceAmount,,, InvoiceState state, uint256 invoiceUwId,) =
            InvoiceRegistry(invoiceRegistry).invoices(invoiceId);
        if (state != InvoiceState.Funded) {
            revert InvalidState(uint8(state), uint8(InvoiceState.Funded));
        }
        if (invoiceUwId != agentId) revert NotUnderwriter();
        if (decision != Decision.Approve && decision != Decision.Reject) revert InvalidDecision();
        if (decision == Decision.Reject && approvedAmount != 0) revert InvalidApprovedAmount();
        if (decision == Decision.Approve && (approvedAmount == 0 || approvedAmount > invoiceAmount)) {
            revert InvalidApprovedAmount();
        }
        if (expiresAt <= block.timestamp) revert InvalidExpiry();

        hasAttestation[invoiceId] = true;
        attestations[invoiceId] = Attestation({
            invoiceId: invoiceId,
            agentId: agentId,
            reportHash: reportHash,
            decision: decision,
            approvedAmount: approvedAmount,
            expiresAt: expiresAt,
            modelId: modelId,
            issuedAt: uint64(block.timestamp)
        });

        emit Attested(invoiceId, agentId, reportHash, decision, approvedAmount, expiresAt, modelId);
    }
}
