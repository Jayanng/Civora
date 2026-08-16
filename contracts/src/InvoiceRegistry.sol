// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AgentIdentity} from "./AgentIdentity.sol";
import {AgentType, InvoiceState} from "./Types.sol";
import {
    InvalidAmount,
    InvalidDueDate,
    InvalidDocumentHash,
    InvalidCounterparty,
    InvalidAgentType,
    InvalidState,
    NotVault,
    NotAttestor,
    ZeroAddress,
    AlreadySet,
    NotAdmin,
    NotController
} from "./Errors.sol";

/// @title InvoiceRegistry
/// @notice Registers invoices as on-chain RWA records. State transitions are gated.
contract InvoiceRegistry {
    struct Invoice {
        address payer;
        address counterparty;
        uint256 amount;
        uint64 dueDate;
        bytes32 documentHash;
        InvoiceState state;
        uint256 underwriterId;
        uint256 settlementAgentId;
    }

    AgentIdentity public immutable identity;
    address public immutable admin;
    address public vault;
    address public attestor;

    uint256 private _nextId = 1;
    mapping(uint256 invoiceId => Invoice) public invoices;

    event InvoiceRegistered(
        uint256 indexed invoiceId,
        address indexed payer,
        address indexed counterparty,
        uint256 amount,
        uint64 dueDate,
        bytes32 documentHash,
        uint256 underwriterId,
        uint256 settlementAgentId
    );
    event InvoiceStateChanged(uint256 indexed invoiceId, InvoiceState state);
    event VaultSet(address indexed vault);
    event AttestorSet(address indexed attestor);

    modifier onlyVault() {
        if (msg.sender != vault) revert NotVault();
        _;
    }

    modifier onlyAttestor() {
        if (msg.sender != attestor) revert NotAttestor();
        _;
    }

    constructor(AgentIdentity identity_) {
        identity = identity_;
        admin = msg.sender;
    }

    function setVault(address vault_) external {
        if (msg.sender != admin) revert NotAdmin();
        if (vault != address(0)) revert AlreadySet();
        if (vault_ == address(0)) revert ZeroAddress();
        vault = vault_;
        emit VaultSet(vault_);
    }

    function setAttestor(address attestor_) external {
        if (msg.sender != admin) revert NotAdmin();
        if (attestor != address(0)) revert AlreadySet();
        if (attestor_ == address(0)) revert ZeroAddress();
        attestor = attestor_;
        emit AttestorSet(attestor_);
    }

    function register(
        address counterparty,
        uint256 amount,
        uint64 dueDate,
        bytes32 documentHash,
        uint256 underwriterId,
        uint256 settlementAgentId
    ) external returns (uint256 invoiceId) {
        if (counterparty == address(0) || counterparty == msg.sender) {
            revert InvalidCounterparty();
        }
        if (amount == 0) revert InvalidAmount();
        if (dueDate <= block.timestamp) revert InvalidDueDate();
        if (documentHash == bytes32(0)) revert InvalidDocumentHash();
        if (identity.agentTypeOf(underwriterId) != AgentType.Underwriter) revert InvalidAgentType();
        if (identity.agentTypeOf(settlementAgentId) != AgentType.Settlement) revert InvalidAgentType();
        if (identity.ownerOf(underwriterId) != msg.sender) revert NotController();
        if (identity.ownerOf(settlementAgentId) != msg.sender) revert NotController();

        invoiceId = _nextId++;
        invoices[invoiceId] = Invoice({
            payer: msg.sender,
            counterparty: counterparty,
            amount: amount,
            dueDate: dueDate,
            documentHash: documentHash,
            state: InvoiceState.Registered,
            underwriterId: underwriterId,
            settlementAgentId: settlementAgentId
        });
        emit InvoiceRegistered(
            invoiceId, msg.sender, counterparty, amount, dueDate, documentHash, underwriterId, settlementAgentId
        );
    }

    function markFunded(uint256 invoiceId) external onlyVault {
        Invoice storage inv = invoices[invoiceId];
        if (inv.state != InvoiceState.Registered) {
            revert InvalidState(uint8(inv.state), uint8(InvoiceState.Registered));
        }
        inv.state = InvoiceState.Funded;
        emit InvoiceStateChanged(invoiceId, InvoiceState.Funded);
    }

    function markAttested(uint256 invoiceId) external onlyAttestor {
        Invoice storage inv = invoices[invoiceId];
        if (inv.state != InvoiceState.Funded) {
            revert InvalidState(uint8(inv.state), uint8(InvoiceState.Funded));
        }
        inv.state = InvoiceState.Attested;
        emit InvoiceStateChanged(invoiceId, InvoiceState.Attested);
    }

    function markSettled(uint256 invoiceId) external onlyVault {
        Invoice storage inv = invoices[invoiceId];
        if (inv.state != InvoiceState.Attested) {
            revert InvalidState(uint8(inv.state), uint8(InvoiceState.Attested));
        }
        inv.state = InvoiceState.Settled;
        emit InvoiceStateChanged(invoiceId, InvoiceState.Settled);
    }

    function markRefunded(uint256 invoiceId) external onlyVault {
        Invoice storage inv = invoices[invoiceId];
        if (inv.state != InvoiceState.Funded && inv.state != InvoiceState.Attested) {
            revert InvalidState(uint8(inv.state), uint8(InvoiceState.Funded));
        }
        inv.state = InvoiceState.Refunded;
        emit InvoiceStateChanged(invoiceId, InvoiceState.Refunded);
    }
}
