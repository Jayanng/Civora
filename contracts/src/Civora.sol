// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AgentIdentity} from "./AgentIdentity.sol";
import {AgentFactory} from "./AgentFactory.sol";
import {InvoiceRegistry} from "./InvoiceRegistry.sol";
import {AttestationRegistry} from "./AttestationRegistry.sol";
import {PermissionEngine} from "./PermissionEngine.sol";
import {SettlementVault} from "./SettlementVault.sol";
import {Reputation} from "./Reputation.sol";
import {Decision, InvoiceState} from "./Types.sol";
import {NotController, InvalidApprovedAmount, InvalidState} from "./Errors.sol";

/// @title Civora
/// @notice Facade: one-tx underwrite commit + address book for the frontend.
contract Civora {
    AgentIdentity public immutable identities;
    AgentFactory public immutable factory;
    InvoiceRegistry public immutable invoices;
    AttestationRegistry public immutable attestations;
    PermissionEngine public immutable permissions;
    SettlementVault public immutable vault;
    Reputation public immutable reputation;

    constructor(
        AgentIdentity identities_,
        AgentFactory factory_,
        InvoiceRegistry invoices_,
        AttestationRegistry attestations_,
        PermissionEngine permissions_,
        SettlementVault vault_,
        Reputation reputation_
    ) {
        identities = identities_;
        factory = factory_;
        invoices = invoices_;
        attestations = attestations_;
        permissions = permissions_;
        vault = vault_;
        reputation = reputation_;
    }

    /// @notice Attest + grant settlement permission + mark invoice Attested. One signature.
    function underwriteCommit(
        uint256 invoiceId,
        uint256 underwriterId,
        bytes32 reportHash,
        Decision decision,
        uint256 approvedAmount,
        uint64 expiresAt,
        bytes32 modelId
    ) external {
        if (identities.ownerOf(underwriterId) != msg.sender) revert NotController();

        (,, uint256 amount,,, InvoiceState state, uint256 invoiceUwId, uint256 settlementAgentId) =
            invoices.invoices(invoiceId);
        if (state != InvoiceState.Funded) {
            revert InvalidState(uint8(state), uint8(InvoiceState.Funded));
        }
        if (invoiceUwId != underwriterId) revert NotController();
        if (decision == Decision.Approve && approvedAmount > amount) revert InvalidApprovedAmount();

        attestations.attest(invoiceId, underwriterId, reportHash, decision, approvedAmount, expiresAt, modelId);

        if (decision == Decision.Approve) {
            permissions.grant(invoiceId, settlementAgentId, vault.settle.selector, approvedAmount, expiresAt);
        }

        invoices.markAttested(invoiceId);
    }
}
