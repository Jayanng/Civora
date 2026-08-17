// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {AgentIdentity} from "./AgentIdentity.sol";
import {GreenAssetRegistry} from "./GreenAssetRegistry.sol";
import {CredentialRegistry} from "./CredentialRegistry.sol";
import {GreenPermissionEngine} from "./GreenPermissionEngine.sol";
import {Reputation} from "./Reputation.sol";
import {AgentType, AssetType, AssetState, UnderwriteDecision, MonitorOutcome} from "./Types.sol";
import {
    NotPayer,
    InvalidFundingAmount,
    InvalidApprovedAmount,
    PermissionDenied,
    Expired,
    AlreadySettled,
    NothingToRefund,
    NotMonitored,
    InvalidState,
    UnauthorizedCaller,
    ZeroAddress,
    TransferFailed
} from "./Errors.sol";

/// @title SettlementAndPenaltyVault
/// @notice Escrows principal + coupon and settles sustainability-linked assets.
/// Fees are taken only from the live coupon. Principal goes 100% to the holder.
/// Target-missed coupon haircut goes 100% to the protocol treasury.
contract SettlementAndPenaltyVault is ReentrancyGuard {
    uint256 public constant PROTOCOL_BPS = 300; // 3%
    uint256 public constant UNDERWRITER_BPS = 100; // 1%
    uint256 public constant MONITOR_BPS = 100; // 1%
    uint256 public constant SETTLEMENT_BPS = 100; // 1%
    uint256 public constant BPS_DENOM = 10_000;

    AgentIdentity public immutable identity;
    GreenAssetRegistry public immutable assets;
    CredentialRegistry public immutable credentials;
    GreenPermissionEngine public immutable permissions;
    Reputation public immutable reputation;
    address public immutable treasury;

    event Funded(uint256 indexed assetId, address indexed issuer, uint256 amount);
    event Settled(
        uint256 indexed assetId,
        uint256 holderPrincipal,
        uint256 holderCoupon,
        uint256 protocolAmt,
        uint256 uwAmt,
        uint256 monAmt,
        uint256 saAmt,
        uint256 haircutAmt,
        bool targetMet
    );
    event Refunded(uint256 indexed assetId, address indexed issuer, uint256 amount);

    constructor(
        AgentIdentity identity_,
        GreenAssetRegistry assets_,
        CredentialRegistry credentials_,
        GreenPermissionEngine permissions_,
        Reputation reputation_,
        address treasury_
    ) {
        if (treasury_ == address(0)) revert ZeroAddress();
        identity = identity_;
        assets = assets_;
        credentials = credentials_;
        permissions = permissions_;
        reputation = reputation_;
        treasury = treasury_;
    }

    function fund(uint256 assetId) external payable nonReentrant {
        GreenAssetRegistry.GreenAsset memory a = _asset(assetId);
        if (msg.sender != a.issuer) revert NotPayer();
        if (a.state != AssetState.Registered) revert InvalidState(uint8(a.state), uint8(AssetState.Registered));
        uint256 total = a.principalWei + a.couponWei;
        if (msg.value != total) revert InvalidFundingAmount(msg.value, total);
        assets.markFunded(assetId);
        emit Funded(assetId, a.issuer, total);
    }

    function settle(uint256 assetId) external nonReentrant {
        _settle(assetId);
    }

    /// @notice Always reverts PermissionDenied — no grant will ever include this selector.
    function emergencyDrain(uint256 assetId) external nonReentrant {
        GreenAssetRegistry.GreenAsset memory a = _asset(assetId);
        permissions.check(assetId, a.settlementAgentId, this.emergencyDrain.selector, a.principalWei + a.couponWei);
        revert PermissionDenied();
    }

    function refund(uint256 assetId) external nonReentrant {
        GreenAssetRegistry.GreenAsset memory a = _asset(assetId);
        if (msg.sender != a.issuer) revert NotPayer();

        bool allowed;
        if (a.state == AssetState.Funded) {
            if (credentials.hasUnderwrite(assetId)) {
                (, , , UnderwriteDecision uwDecision, , , uint64 uwExpiresAt, ,) = credentials.underwrites(assetId);
                if (uwDecision == UnderwriteDecision.Reject) allowed = true;
                if (uwDecision == UnderwriteDecision.Approve && block.timestamp >= uwExpiresAt) allowed = true;
            } else {
                if (block.timestamp > a.maturity) allowed = true;
            }
        } else if (a.state == AssetState.Underwritten) {
            (, , , , , , uint64 uwExpiresAt, ,) = credentials.underwrites(assetId);
            if (block.timestamp >= uwExpiresAt) allowed = true;
        }
        if (!allowed) revert NothingToRefund();

        assets.markRefunded(assetId);
        uint256 total = a.principalWei + a.couponWei;
        _pay(a.issuer, total);
        emit Refunded(assetId, a.issuer, total);
    }

    function _settle(uint256 assetId) internal {
        GreenAssetRegistry.GreenAsset memory a = _asset(assetId);
        if (a.state == AssetState.Settled) revert AlreadySettled();
        if (a.state != AssetState.Monitored) revert InvalidState(uint8(a.state), uint8(AssetState.Monitored));
        if (
            msg.sender != a.issuer && msg.sender != identity.walletOf(a.settlementAgentId)
                && msg.sender != identity.ownerOf(a.settlementAgentId)
        ) {
            revert UnauthorizedCaller();
        }

        if (!credentials.hasUnderwrite(assetId)) revert PermissionDenied();
        (, uint256 uwAgentId,, UnderwriteDecision uwDecision, uint256 approvedPrincipal, uint256 approvedCoupon, uint64 uwExpiresAt,,) =
            credentials.underwrites(assetId);
        if (uwAgentId != a.underwriterId) revert PermissionDenied();
        if (uwDecision != UnderwriteDecision.Approve) revert InvalidApprovedAmount();
        if (block.timestamp >= uwExpiresAt) revert Expired();
        if (approvedPrincipal != a.principalWei) revert InvalidApprovedAmount();

        if (!credentials.hasMonitor(assetId)) revert NotMonitored();
        (, uint256 monAgentId,, MonitorOutcome outcome, uint16 penaltyBps,,, uint64 monExpiresAt,,) =
            credentials.monitors(assetId);
        if (monAgentId != a.monitorId) revert PermissionDenied();
        if (block.timestamp >= monExpiresAt) revert Expired();

        permissions.check(assetId, a.settlementAgentId, this.settle.selector, a.principalWei + a.couponWei);

        _payout(assetId, a, approvedCoupon, outcome, penaltyBps);
    }

    function _payout(
        uint256 assetId,
        GreenAssetRegistry.GreenAsset memory a,
        uint256 couponBase,
        MonitorOutcome outcome,
        uint16 penaltyBps
    ) internal {
        bool targetMet = outcome == MonitorOutcome.TargetMet;
        uint256 haircut = targetMet ? 0 : (couponBase * penaltyBps) / BPS_DENOM;
        uint256 liveCoupon = couponBase - haircut;
        uint256 couponRefundAmt = a.couponWei - couponBase;

        assets.markSettled(assetId);
        _pay(a.holder, a.principalWei);
        if (haircut > 0) _pay(treasury, haircut);
        if (couponRefundAmt > 0) _pay(a.issuer, couponRefundAmt);

        uint256 holderCoupon;
        uint256 protocolAmt;
        uint256 uwAmt;
        uint256 monAmt;
        uint256 saAmt;
        {
            protocolAmt = (liveCoupon * PROTOCOL_BPS) / BPS_DENOM;
            uwAmt = (liveCoupon * UNDERWRITER_BPS) / BPS_DENOM;
            monAmt = (liveCoupon * MONITOR_BPS) / BPS_DENOM;
            saAmt = (liveCoupon * SETTLEMENT_BPS) / BPS_DENOM;
            holderCoupon = liveCoupon - protocolAmt - uwAmt - monAmt - saAmt;
        }

        _pay(a.holder, holderCoupon);
        _pay(treasury, protocolAmt);
        _pay(identity.walletOf(a.underwriterId), uwAmt);
        _pay(identity.walletOf(a.monitorId), monAmt);
        _pay(identity.walletOf(a.settlementAgentId), saAmt);

        reputation.bump(a.underwriterId, 1, bytes32("SETTLE_UW"));
        reputation.bump(a.monitorId, 2, bytes32("SETTLE_MON"));
        reputation.bump(a.settlementAgentId, 1, bytes32("SETTLE_SA"));

        emit Settled(assetId, a.principalWei, holderCoupon, protocolAmt, uwAmt, monAmt, saAmt, haircut, targetMet);
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

    function _pay(address to, uint256 value) internal {
        if (value == 0) return;
        (bool ok,) = to.call{value: value}("");
        if (!ok) revert TransferFailed(to, value);
    }
}