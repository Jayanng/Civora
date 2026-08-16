// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

enum AgentType {
    None,
    Underwriter,
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
