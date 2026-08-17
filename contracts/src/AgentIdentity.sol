// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AgentType} from "./Types.sol";
import {NotFactory, InvalidAgentType, ZeroAddress, WalletAlreadySet, AlreadySet} from "./Errors.sol";

/// @title AgentIdentity
/// @notice ERC-721 + URIStorage identity registry (ERC-8004 Identity pattern).
contract AgentIdentity is ERC721, ERC721URIStorage, Ownable {
    address public factory;
    uint256 private _nextId = 1;

    mapping(uint256 agentId => AgentType) public agentTypeOf;
    mapping(uint256 agentId => address) public walletOf;
    mapping(uint256 agentId => string) public nameOf;

    event AgentRegistered(
        uint256 indexed agentId, address indexed owner, AgentType agentType, address wallet, string tokenURI
    );
    event WalletBound(uint256 indexed agentId, address indexed wallet);
    event FactorySet(address indexed factory);

    modifier onlyFactory() {
        if (msg.sender != factory) revert NotFactory();
        _;
    }

    constructor() ERC721("Civora Agent", "CIVORA") Ownable(msg.sender) {}

    function setFactory(address factory_) external onlyOwner {
        if (factory != address(0)) revert AlreadySet();
        if (factory_ == address(0)) revert ZeroAddress();
        factory = factory_;
        emit FactorySet(factory_);
    }

    function setTokenURI(uint256 agentId, string calldata uri) external onlyFactory {
        _setTokenURI(agentId, uri);
    }

    function mint(address to, AgentType agentType, string calldata tokenURI_)
        external
        onlyFactory
        returns (uint256 agentId)
    {
        if (to == address(0)) revert ZeroAddress();
        if (agentType != AgentType.Underwriter && agentType != AgentType.ComplianceMonitor && agentType != AgentType.Settlement) {
            revert InvalidAgentType();
        }
        agentId = _nextId++;
        agentTypeOf[agentId] = agentType;
        _safeMint(to, agentId);
        if (bytes(tokenURI_).length != 0) {
            _setTokenURI(agentId, tokenURI_);
        }
        emit AgentRegistered(agentId, to, agentType, address(0), tokenURI_);
    }

    function setName(uint256 agentId, string calldata name_) external onlyFactory {
        nameOf[agentId] = name_;
    }

    function bindWallet(uint256 agentId, address wallet) external onlyFactory {
        if (wallet == address(0)) revert ZeroAddress();
        if (walletOf[agentId] != address(0)) revert WalletAlreadySet();
        walletOf[agentId] = wallet;
        emit WalletBound(agentId, wallet);
    }

    function exists(uint256 agentId) external view returns (bool) {
        return _ownerOf(agentId) != address(0);
    }

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
