// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {NotController} from "./Errors.sol";

/// @title AgentWallet
/// @notice Per-agent smart wallet. Controller is the current AgentIdentity NFT owner.
contract AgentWallet {
    bytes4 internal constant ERC1271_MAGIC = 0x1626ba7e;
    bytes4 internal constant ERC1271_FAIL = 0xffffffff;

    address public immutable identity;
    uint256 public immutable agentId;

    event WalletExecuted(address indexed to, uint256 value, bytes4 selector);
    event Received(address indexed from, uint256 amount);

    constructor(address identity_, uint256 agentId_) {
        identity = identity_;
        agentId = agentId_;
    }

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    function controller() public view returns (address) {
        return IERC721(identity).ownerOf(agentId);
    }

    function execute(address to, uint256 value, bytes calldata data) external returns (bytes memory) {
        if (msg.sender != controller()) revert NotController();
        bytes4 selector;
        if (data.length >= 4) {
            selector = bytes4(data[0:4]);
        }
        (bool ok, bytes memory result) = to.call{value: value}(data);
        if (!ok) {
            assembly {
                revert(add(result, 0x20), mload(result))
            }
        }
        emit WalletExecuted(to, value, selector);
        return result;
    }

    function isValidSignature(bytes32 hash, bytes memory signature) external view returns (bytes4) {
        (address signer, ECDSA.RecoverError err,) = ECDSA.tryRecover(hash, signature);
        if (err == ECDSA.RecoverError.NoError && signer == controller()) return ERC1271_MAGIC;
        return ERC1271_FAIL;
    }
}
