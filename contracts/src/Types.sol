// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

enum AgentType {
    None,
    Underwriter,
    ComplianceMonitor,
    Settlement
}

enum InvoiceState {
    None,
    Registered,
    Funded,
    Attested,
    Settled,
    Refunded
}

enum Decision {
    None,
    Approve,
    Reject
}

enum AssetType {
    None,
    SustainabilityLinkedBond,
    GreenReceivable
}

enum AssetState {
    None,
    Registered,
    Funded,
    Underwritten,
    Monitored,
    Settled,
    Refunded
}

enum UnderwriteDecision {
    None,
    Approve,
    Reject
}

enum MonitorOutcome {
    None,
    TargetMet,
    TargetMissed
}

enum CredentialKind {
    None,
    Underwrite,
    Monitor
}