// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {AgentIdentity} from "./AgentIdentity.sol";
import {InvoiceRegistry} from "./InvoiceRegistry.sol";
import {AttestationRegistry} from "./AttestationRegistry.sol";
import {PermissionEngine} from "./PermissionEngine.sol";
import {Reputation} from "./Reputation.sol";
import {InvoiceState, Decision} from "./Types.sol";
import {
    NotPayer,
    InvalidFundingAmount,
    InvalidApprovedAmount,
    PermissionDenied,
    Expired,
    AlreadySettled,
    NothingToRefund,
    InvalidState,
    ZeroAddress,
    UnauthorizedCaller,
    TransferFailed
} from "./Errors.sol";

/// @title SettlementVault
/// @notice Holds native BOT. Only contract that moves user funds.
contract SettlementVault is ReentrancyGuard {
    uint256 public constant PROTOCOL_BPS = 300; // 3%
    uint256 public constant UNDERWRITER_BPS = 100; // 1%
    uint256 public constant SETTLEMENT_BPS = 100; // 1%
    uint256 public constant BPS_DENOM = 10_000;

    AgentIdentity public immutable identity;
    InvoiceRegistry public immutable invoices;
    AttestationRegistry public immutable attestations;
    PermissionEngine public immutable permissions;
    Reputation public immutable reputation;
    address public immutable treasury;

    event Funded(uint256 indexed invoiceId, address indexed payer, uint256 amount);
    event Settled(
        uint256 indexed invoiceId,
        uint256 payeeAmt,
        uint256 protocolAmt,
        uint256 uwAmt,
        uint256 saAmt,
        uint256 refundAmt
    );
    event Refunded(uint256 indexed invoiceId, address indexed payer, uint256 amount);

    constructor(
        AgentIdentity identity_,
        InvoiceRegistry invoices_,
        AttestationRegistry attestations_,
        PermissionEngine permissions_,
        Reputation reputation_,
        address treasury_
    ) {
        if (treasury_ == address(0)) revert ZeroAddress();
        identity = identity_;
        invoices = invoices_;
        attestations = attestations_;
        permissions = permissions_;
        reputation = reputation_;
        treasury = treasury_;
    }

    function fund(uint256 invoiceId) external payable nonReentrant {
        (address payer,, uint256 amount,,, InvoiceState state,,) = invoices.invoices(invoiceId);
        if (msg.sender != payer) revert NotPayer();
        if (state != InvoiceState.Registered) {
            revert InvalidState(uint8(state), uint8(InvoiceState.Registered));
        }
        if (msg.value != amount) revert InvalidFundingAmount(msg.value, amount);
        invoices.markFunded(invoiceId);
        emit Funded(invoiceId, payer, amount);
    }

    function settle(uint256 invoiceId) external nonReentrant {
        _settle(invoiceId);
    }

    /// @notice Always reverts PermissionDenied — no grant will ever include this selector.
    function emergencyDrain(uint256 invoiceId) external nonReentrant {
        (,, uint256 amount,,,,, uint256 settlementAgentId) = invoices.invoices(invoiceId);
        permissions.check(invoiceId, settlementAgentId, this.emergencyDrain.selector, amount);
        revert PermissionDenied();
    }

    function refund(uint256 invoiceId) external nonReentrant {
        (address payer,, uint256 amount, uint64 dueDate,, InvoiceState state,,) = invoices.invoices(invoiceId);
        if (msg.sender != payer) revert NotPayer();

        bool allowed;
        if (state == InvoiceState.Funded && block.timestamp > dueDate) {
            allowed = true;
        } else if (state == InvoiceState.Attested || state == InvoiceState.Funded) {
            if (attestations.hasAttestation(invoiceId)) {
                (,,, Decision decision,, uint64 expiresAt,,) = attestations.attestations(invoiceId);
                if (decision == Decision.Reject) allowed = true;
                if (decision == Decision.Approve && block.timestamp >= expiresAt) allowed = true;
            }
        }
        if (!allowed) revert NothingToRefund();

        invoices.markRefunded(invoiceId);
        _pay(payer, amount);
        emit Refunded(invoiceId, payer, amount);
    }

    function _settle(uint256 invoiceId) internal {
        InvoiceRegistry.Invoice memory inv = _invoice(invoiceId);
        if (inv.state == InvoiceState.Settled) revert AlreadySettled();
        if (inv.state != InvoiceState.Attested) {
            revert InvalidState(uint8(inv.state), uint8(InvoiceState.Attested));
        }
        if (
            msg.sender != inv.payer && msg.sender != identity.walletOf(inv.settlementAgentId)
                && msg.sender != identity.ownerOf(inv.settlementAgentId)
        ) {
            revert UnauthorizedCaller();
        }

        (uint256 approvedAmount, uint256 settlementAgentId) = _validateAttestation(invoiceId, inv);
        permissions.check(invoiceId, settlementAgentId, this.settle.selector, approvedAmount);
        _payout(invoiceId, inv, approvedAmount);
    }

    function _invoice(uint256 invoiceId) internal view returns (InvoiceRegistry.Invoice memory) {
        (
            address payer,
            address counterparty,
            uint256 amount,
            uint64 dueDate,
            bytes32 documentHash,
            InvoiceState state,
            uint256 underwriterId,
            uint256 settlementAgentId
        ) = invoices.invoices(invoiceId);
        return InvoiceRegistry.Invoice({
            payer: payer,
            counterparty: counterparty,
            amount: amount,
            dueDate: dueDate,
            documentHash: documentHash,
            state: state,
            underwriterId: underwriterId,
            settlementAgentId: settlementAgentId
        });
    }

    function _validateAttestation(uint256 invoiceId, InvoiceRegistry.Invoice memory inv)
        internal
        view
        returns (uint256 approvedAmount, uint256 settlementAgentId)
    {
        (, uint256 attestedAgentId,, Decision decision, uint256 approved, uint64 expiresAt,,) =
            attestations.attestations(invoiceId);

        if (decision != Decision.Approve) revert InvalidApprovedAmount();
        if (attestedAgentId != inv.underwriterId) revert PermissionDenied();
        if (block.timestamp >= expiresAt) revert Expired();
        if (approved == 0 || approved > inv.amount) revert InvalidApprovedAmount();
        return (approved, inv.settlementAgentId);
    }

    function _payout(uint256 invoiceId, InvoiceRegistry.Invoice memory inv, uint256 approvedAmount) internal {
        uint256 protocolAmt = (approvedAmount * PROTOCOL_BPS) / BPS_DENOM;
        uint256 uwAmt = (approvedAmount * UNDERWRITER_BPS) / BPS_DENOM;
        uint256 saAmt = (approvedAmount * SETTLEMENT_BPS) / BPS_DENOM;
        uint256 payeeAmt = approvedAmount - protocolAmt - uwAmt - saAmt;
        uint256 refundAmt = inv.amount - approvedAmount;

        invoices.markSettled(invoiceId);

        _pay(inv.counterparty, payeeAmt);
        _pay(treasury, protocolAmt);
        _pay(identity.walletOf(inv.underwriterId), uwAmt);
        _pay(identity.walletOf(inv.settlementAgentId), saAmt);
        if (refundAmt > 0) _pay(inv.payer, refundAmt);

        reputation.bump(inv.underwriterId, 1, bytes32("SETTLE_UW"));
        reputation.bump(inv.settlementAgentId, 2, bytes32("SETTLE_SA"));

        emit Settled(invoiceId, payeeAmt, protocolAmt, uwAmt, saAmt, refundAmt);
    }

    function _pay(address to, uint256 value) internal {
        if (value == 0) return;
        (bool ok,) = to.call{value: value}("");
        if (!ok) revert TransferFailed(to, value);
    }
}
