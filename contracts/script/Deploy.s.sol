// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {AgentIdentity} from "../src/AgentIdentity.sol";
import {AgentFactory} from "../src/AgentFactory.sol";
import {CredentialRegistry} from "../src/CredentialRegistry.sol";
import {GreenPermissionEngine} from "../src/GreenPermissionEngine.sol";
import {GreenAssetRegistry} from "../src/GreenAssetRegistry.sol";
import {Reputation} from "../src/Reputation.sol";
import {SettlementAndPenaltyVault} from "../src/SettlementAndPenaltyVault.sol";
import {CivoraGreen} from "../src/CivoraGreen.sol";

contract Deploy is Script {
    function run() external {
        address treasury = vm.envAddress("CIVORA_TREASURY");
        require(treasury != address(0), "CIVORA_TREASURY");

        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);

        AgentIdentity identity = new AgentIdentity();
        AgentFactory factory = new AgentFactory(identity);
        identity.setFactory(address(factory));

        CredentialRegistry credentials = new CredentialRegistry(identity);
        GreenPermissionEngine permissions = new GreenPermissionEngine(identity);
        GreenAssetRegistry assets = new GreenAssetRegistry(identity);
        Reputation reputation = new Reputation();

        SettlementAndPenaltyVault vault = new SettlementAndPenaltyVault(
            identity, assets, credentials, permissions, reputation, treasury
        );

        CivoraGreen civora = new CivoraGreen(identity, factory, assets, credentials, permissions, vault, reputation);

        assets.setVault(address(vault));
        assets.setAttestor(address(civora));
        reputation.setVault(address(vault));
        credentials.setCivora(address(civora));
        permissions.setCredentialRegistry(credentials);
        permissions.setCivora(address(civora));

        vm.stopBroadcast();

        console2.log("deployer", deployer);
        console2.log("treasury", treasury);
        console2.log("AgentIdentity", address(identity));
        console2.log("AgentFactory", address(factory));
        console2.log("CredentialRegistry", address(credentials));
        console2.log("GreenPermissionEngine", address(permissions));
        console2.log("GreenAssetRegistry", address(assets));
        console2.log("Reputation", address(reputation));
        console2.log("SettlementAndPenaltyVault", address(vault));
        console2.log("CivoraGreen", address(civora));
    }
}