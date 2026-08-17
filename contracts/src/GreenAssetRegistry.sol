// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AgentIdentity} from "./AgentIdentity.sol";
import {AgentType, AssetType, AssetState} from "./Types.sol";
import {
    InvalidAmount,
    InvalidDocumentHash,
    InvalidAgentType,
    InvalidState,
    NotVault,
    NotAttestor,
    ZeroAddress,
    AlreadySet,
    NotAdmin,
    NotController,
    InvalidHolder,
    InvalidTargetHash,
    InvalidMaturity
} from "./Errors.sol";

/// @title GreenAssetRegistry
/// @notice Registers sustainability-linked bonds and green receivables on-chain.
contract GreenAssetRegistry {
    struct GreenAsset {
        address issuer;
        address holder;
        AssetType assetType;
        uint256 principalWei;
        uint256 couponWei;
        bytes32 targetHash;
        bytes32 documentHash;
        uint64 maturity;
        uint256 underwriterId;
        uint256 monitorId;
        uint256 settlementAgentId;
        AssetState state;
    }

    AgentIdentity public immutable identity;
    address public immutable admin;
    address public vault;
    address public attestor;

    uint256 private _nextId = 1;
    mapping(uint256 assetId => GreenAsset) public assets;

    event AssetRegistered(
        uint256 indexed assetId,
        address indexed issuer,
        address indexed holder,
        AssetType assetType,
        uint256 principalWei,
        uint256 couponWei,
        bytes32 targetHash,
        bytes32 documentHash,
        uint64 maturity,
        uint256 underwriterId,
        uint256 monitorId,
        uint256 settlementAgentId
    );

    event AssetStateChanged(uint256 indexed assetId, AssetState state);

    modifier onlyVault() {
        if (msg.sender != vault) revert NotVault();
        _;
    }

    modifier onlyAttestor() {
        if (msg.sender != attestor) revert NotAttestor();
        _;
    }

    constructor(AgentIdentity identity_) {
        if (address(identity_) == address(0)) revert ZeroAddress();
        identity = identity_;
        admin = msg.sender;
    }

    function setVault(address vault_) external {
        if (msg.sender != admin) revert NotAdmin();
        if (vault != address(0)) revert AlreadySet();
        if (vault_ == address(0)) revert ZeroAddress();
        vault = vault_;
    }

    function setAttestor(address attestor_) external {
        if (msg.sender != admin) revert NotAdmin();
        if (attestor != address(0)) revert AlreadySet();
        if (attestor_ == address(0)) revert ZeroAddress();
        attestor = attestor_;
    }

    function register(
        address holder,
        AssetType assetType,
        uint256 principalWei,
        uint256 couponWei,
        bytes32 targetHash,
        bytes32 documentHash,
        uint64 maturity,
        uint256 underwriterId,
        uint256 monitorId,
        uint256 settlementAgentId
    ) external returns (uint256 assetId) {
        if (holder == address(0) || holder == msg.sender) revert InvalidHolder();
        if (principalWei == 0 || couponWei == 0) revert InvalidAmount();
        if (targetHash == bytes32(0)) revert InvalidTargetHash();
        if (documentHash == bytes32(0)) revert InvalidDocumentHash();
        if (maturity <= block.timestamp) revert InvalidMaturity();
        if (assetType != AssetType.SustainabilityLinkedBond && assetType != AssetType.GreenReceivable) revert InvalidAgentType();
        if (identity.agentTypeOf(underwriterId) != AgentType.Underwriter) revert InvalidAgentType();
        if (identity.agentTypeOf(monitorId) != AgentType.ComplianceMonitor) revert InvalidAgentType();
        if (identity.agentTypeOf(settlementAgentId) != AgentType.Settlement) revert InvalidAgentType();
        if (identity.ownerOf(underwriterId) != msg.sender) revert NotController();
        if (identity.ownerOf(monitorId) != msg.sender) revert NotController();
        if (identity.ownerOf(settlementAgentId) != msg.sender) revert NotController();

        assetId = _nextId++;
        assets[assetId] = GreenAsset({
            issuer: msg.sender,
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
            state: AssetState.Registered
        });

        emit AssetRegistered(assetId, msg.sender, holder, assetType, principalWei, couponWei, targetHash, documentHash, maturity, underwriterId, monitorId, settlementAgentId);
    }

    function markFunded(uint256 assetId) external onlyVault {
        GreenAsset storage a = assets[assetId];
        if (a.state != AssetState.Registered) revert InvalidState(uint8(a.state), uint8(AssetState.Registered));
        a.state = AssetState.Funded;
        emit AssetStateChanged(assetId, AssetState.Funded);
    }

    function markUnderwritten(uint256 assetId) external onlyAttestor {
        GreenAsset storage a = assets[assetId];
        if (a.state != AssetState.Funded) revert InvalidState(uint8(a.state), uint8(AssetState.Funded));
        a.state = AssetState.Underwritten;
        emit AssetStateChanged(assetId, AssetState.Underwritten);
    }

    function markMonitored(uint256 assetId) external onlyAttestor {
        GreenAsset storage a = assets[assetId];
        if (a.state != AssetState.Underwritten) revert InvalidState(uint8(a.state), uint8(AssetState.Underwritten));
        a.state = AssetState.Monitored;
        emit AssetStateChanged(assetId, AssetState.Monitored);
    }

    function markSettled(uint256 assetId) external onlyVault {
        GreenAsset storage a = assets[assetId];
        if (a.state != AssetState.Monitored) revert InvalidState(uint8(a.state), uint8(AssetState.Monitored));
        a.state = AssetState.Settled;
        emit AssetStateChanged(assetId, AssetState.Settled);
    }

    function markRefunded(uint256 assetId) external onlyVault {
        GreenAsset storage a = assets[assetId];
        if (a.state != AssetState.Funded && a.state != AssetState.Underwritten && a.state != AssetState.Monitored) {
            revert InvalidState(uint8(a.state), uint8(AssetState.Funded));
        }
        a.state = AssetState.Refunded;
        emit AssetStateChanged(assetId, AssetState.Refunded);
    }
}