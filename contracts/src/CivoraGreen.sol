// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AgentIdentity} from "./AgentIdentity.sol";
import {AgentFactory} from "./AgentFactory.sol";
import {GreenAssetRegistry} from "./GreenAssetRegistry.sol";
import {CredentialRegistry} from "./CredentialRegistry.sol";
import {GreenPermissionEngine} from "./GreenPermissionEngine.sol";
import {SettlementAndPenaltyVault} from "./SettlementAndPenaltyVault.sol";
import {Reputation} from "./Reputation.sol";
import {AssetType, AssetState, UnderwriteDecision, MonitorOutcome} from "./Types.sol";
import {NotController, InvalidApprovedAmount, InvalidState, InvalidCoupon} from "./Errors.sol";

/// @title CivoraGreen
/// @notice Facade: one-tx underwrite commit and one-tx monitor commit for green assets.
contract CivoraGreen {
    AgentIdentity public immutable identities;
    AgentFactory public immutable factory;
    GreenAssetRegistry public immutable assets;
    CredentialRegistry public immutable credentials;
    GreenPermissionEngine public immutable permissions;
    SettlementAndPenaltyVault public immutable vault;
    Reputation public immutable reputation;

    constructor(
        AgentIdentity identities_,
        AgentFactory factory_,
        GreenAssetRegistry assets_,
        CredentialRegistry credentials_,
        GreenPermissionEngine permissions_,
        SettlementAndPenaltyVault vault_,
        Reputation reputation_
    ) {
        identities = identities_;
        factory = factory_;
        assets = assets_;
        credentials = credentials_;
        permissions = permissions_;
        vault = vault_;
        reputation = reputation_;
    }

    function underwriteCommit(
        uint256 assetId,
        uint256 underwriterId,
        bytes32 reportHash,
        UnderwriteDecision decision,
        uint256 approvedPrincipalWei,
        uint256 approvedCouponWei,
        uint64 expiresAt,
        bytes32 modelId
    ) external {
        if (identities.ownerOf(underwriterId) != msg.sender) revert NotController();

        GreenAssetRegistry.GreenAsset memory a = _asset(assetId);
        if (a.state != AssetState.Funded) revert InvalidState(uint8(a.state), uint8(AssetState.Funded));
        if (a.underwriterId != underwriterId) revert NotController();
        if (decision == UnderwriteDecision.Approve) {
            if (approvedPrincipalWei != a.principalWei) revert InvalidApprovedAmount();
            if (approvedCouponWei == 0 || approvedCouponWei > a.couponWei) revert InvalidCoupon();
        }

        credentials.submitUnderwrite(
            assetId, underwriterId, reportHash, decision, approvedPrincipalWei, approvedCouponWei, expiresAt, modelId
        );

        if (decision == UnderwriteDecision.Approve) {
            permissions.grant(assetId, a.settlementAgentId, vault.settle.selector, a.principalWei + a.couponWei, expiresAt);
            assets.markUnderwritten(assetId);
        }
    }

    function monitorCommit(
        uint256 assetId,
        uint256 monitorId,
        bytes32 reportHash,
        MonitorOutcome outcome,
        uint16 penaltyBps,
        bytes32 evidenceHash,
        uint64 observedAt,
        uint64 expiresAt,
        bytes32 modelId
    ) external {
        if (identities.ownerOf(monitorId) != msg.sender) revert NotController();

        GreenAssetRegistry.GreenAsset memory a = _asset(assetId);
        if (a.state != AssetState.Underwritten) revert InvalidState(uint8(a.state), uint8(AssetState.Underwritten));
        if (a.monitorId != monitorId) revert NotController();

        credentials.submitMonitor(
            assetId, monitorId, reportHash, outcome, penaltyBps, evidenceHash, observedAt, expiresAt, modelId
        );

        assets.markMonitored(assetId);
    }

    function _asset(uint256 assetId) internal view returns (GreenAssetRegistry.GreenAsset memory a) {
        (
            address issuer,
            address holder,
            AssetType assetType,
            uint256 principalWei,
            uint256 couponWei,
            bytes32 targetHash,
            bytes32 documentHash,
            uint64 maturity,
            uint256 underwriterId,
            uint256 monitorId,
            uint256 settlementAgentId,
            AssetState state
        ) = assets.assets(assetId);
        return GreenAssetRegistry.GreenAsset({
            issuer: issuer,
            holder: holder,
            assetType: assetType,
            principalWei: principalWei,
            couponWei: couponWei,
            targetHash: targetHash,
            documentHash: documentHash,
            maturity: maturity,
            underwriterId: underwriterId,
            monitorId: monitorId,
            settlementAgentId: settlementAgentId,
            state: state
        });
    }
}