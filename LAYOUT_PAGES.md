# Civora — Layout & Pages

**Applied to locked scope (Landing, Dashboard, Agents, Assets/Invoices, Activity)**

---

## Page 1: Landing

**Primary task:** Explain what Civora is and connect wallet
**Layout:** Minimal hero with task clarity
**Sections:**
1. Value prop (one line)
2. Wallet connect
3. CTA to launch app

**Signature motion:** Fade-up on load
**Proof:** Wallet connection + first registration tx
**Anti-slop:** No bento grid, no 3-card feature layout, no stock photos

---

## Page 2: Dashboard

**Primary task:** Overview after wallet connect
**Layout:** Summary cards + primary actions
**Sections:**
1. Summary cards row: Active Agents | Registered Invoices | Total Settled | Agent Reputation
2. Two large primary buttons: “Create Agent” and “Register Invoice”
3. Recent activity preview

**Signature motion:** Counter tick on load
**Proof:** Every metric links to contract read
**Anti-slop:** Dense metrics, not SaaS cards

---

## Page 3: Agents

**Primary task:** List agents, create new, view details
**Layout:** Master-detail (list left, detail right)
**Sections:**
1. Agent list (Name, Type, Identity address, Wallet balance, Reputation, Status)
2. Agent detail panel (credentials, permissions, activity)

**Signature motion:** Stagger list load
**Proof:** Identity address + wallet address + reputation score visible
**Anti-slop:** Dense table, not card grid

---

## Page 4: Assets / Invoices

**Primary task:** List invoices, register new, view details
**Layout:** List + detail view
**Sections:**
1. List of registered invoices with status badges
2. “Register Invoice” multi-step form
3. Detail view: assigned agents, attestation, settlement history, current permissions

**Signature motion:** Slide-in detail panel
**Proof:** Attestation tx + settlement tx + permission set tx all visible
**Anti-slop:** Info-dense, not spacious

---

## Page 5: Activity

**Primary task:** Chronological feed of all on-chain events
**Layout:** Single-column timeline
**Sections:**
1. Chronological feed of all on-chain events
2. Filters + direct Explorer links for every transaction

**Signature motion:** Anchor highlight on scroll
**Proof:** Every event links to scan.botchain.ai
**Anti-slop:** Technical docs feel, not marketing

---

## Navigation

- **Pattern:** Persistent sidebar (Desktop)
- **Mobile:** Collapsible top bar
- **Rationale:** Infrastructure/OS archetype = 5 sections, so sidebar wins on desktop

---

## Motion summary (from locked design system)

1. **Fade-up** — landing page load (state: initial)
2. **Stagger list** — agent registry load (state: populated)
3. **Slide-in panel** — asset detail open (state: expanded)
4. **State-change pulse** — attestation status change (state: pending → attested)
5. **Counter tick** — dashboard metrics load (state: loading → resolved)

---

## Proof visibility rule

- Every tx has an inline hash + explorer link
- Bond amounts, slash amounts, and fees show on-chain source
- No modals for proof; proof is the default state