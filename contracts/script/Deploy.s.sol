// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {AgentIdentity} from "../src/AgentIdentity.sol";
import {AgentFactory} from "../src/AgentFactory.sol";
import {AttestationRegistry} from "../src/AttestationRegistry.sol";
import {PermissionEngine} from "../src/PermissionEngine.sol";
import {InvoiceRegistry} from "../src/InvoiceRegistry.sol";
import {Reputation} from "../src/Reputation.sol";
import {SettlementVault} from "../src/SettlementVault.sol";
import {Civora} from "../src/Civora.sol";

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

        AttestationRegistry attestations = new AttestationRegistry(identity);
        PermissionEngine permissions = new PermissionEngine(identity);
        InvoiceRegistry invoices = new InvoiceRegistry(identity);
        Reputation reputation = new Reputation();

        SettlementVault vault = new SettlementVault(
            identity, invoices, attestations, permissions, reputation, treasury
        );

        Civora civora = new Civora(identity, factory, invoices, attestations, permissions, vault, reputation);

        invoices.setVault(address(vault));
        invoices.setAttestor(address(civora));
        reputation.setVault(address(vault));
        attestations.setInvoiceRegistry(address(invoices));
        attestations.setCivora(address(civora));
        permissions.setAttestationRegistry(address(attestations));
        permissions.setCivora(address(civora));

        vm.stopBroadcast();

        console2.log("deployer", deployer);
        console2.log("treasury", treasury);
        console2.log("AgentIdentity", address(identity));
        console2.log("AgentFactory", address(factory));
        console2.log("AttestationRegistry", address(attestations));
        console2.log("PermissionEngine", address(permissions));
        console2.log("InvoiceRegistry", address(invoices));
        console2.log("Reputation", address(reputation));
        console2.log("SettlementVault", address(vault));
        console2.log("Civora", address(civora));
    }
}
