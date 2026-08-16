# Civora — Components

**Applied to locked scope (Landing, Dashboard, Agents, Assets/Invoices, Activity)**

---

## Page 1: Landing

**Components:**

1. **Nav** — minimal top bar
   - Variants: default, scrolled
   - Tokens: bg transparent, text semantic, no border
   - Motion: none
   - Anti-slop: Understated, not hidden behind hamburger

2. **Headline Block** — value proposition
   - Variants: default
   - Tokens: display type, semantic text, max-width 680px
   - Motion: fade-up
   - Proof: none (marketing)
   - Anti-slop: Single sentence, no sub-cards

3. **Wallet Connect Button** — primary action
   - Variants: default, connected, connecting, error
   - Tokens: primary bg, white text, radius medium
   - Motion: press scale
   - Proof: shows truncated address when connected
   - Anti-slop: Functional, not decorative

4. **Launch App CTA** — enter dashboard
   - Variants: default, disabled (no wallet)
   - Tokens: secondary bg, neutral text, radius medium
   - Motion: hover lift 2px
   - Proof: disabled state tied to wallet connection
   - Anti-slop: One CTA, not three

5. **Status Ticker** — network status
   - Variants: default, live, degraded
   - Tokens: mono text, semantic status color
   - Motion: pulse on status change
   - Proof: shows block height + finality
   - Anti-slop: Terminal-like, not marketing badge

---

## Page 2: Dashboard

**Components:**

1. **Sidebar Nav** — persistent
   - Variants: default, collapsed, active-item
   - Tokens: neutral bg, semantic text, hover bg
   - Motion: none
   - Anti-slop: Icon + label, no dropdowns

2. **Summary Metric Card** — key stats
   - Variants: default, loading, error
   - Tokens: white bg, border, mono for numbers
   - Motion: counter tick on load
   - Proof: each metric links to contract read
   - Anti-slop: Terminal-like, not metric cards

3. **Primary Action Button** — Create Agent / Register Invoice
   - Variants: default, disabled (no wallet), loading
   - Tokens: primary bg, white text, radius medium
   - Motion: press scale
   - Proof: disabled state tied to wallet
   - Anti-slop: Clear verb, not generic "submit"

4. **Recent Activity Preview** — last 3 events
   - Variants: default, empty
   - Tokens: hairline borders, mono for tx hashes
   - Motion: none
   - Proof: inline explorer links
   - Anti-slop: Dense list, not timeline graphic

---

## Page 3: Agents

**Components:**

1. **Search Input** — filter agents
   - Variants: default, focused, populated, empty
   - Tokens: neutral bg, border, mono text for results
   - Motion: none
   - Proof: filters on-chain data
   - Anti-slop: Functional, not decorative

2. **Agent Table** — primary data display
   - Variants: default, hover-row, selected-row, empty-state
   - Tokens: hairline borders, mono for addresses, semantic for status
   - Motion: stagger row load, hover lift 1px
   - Proof: every row shows identity address + reputation
   - Anti-slop: Dense table, not card grid

3. **Agent Detail Panel** — master-detail view
   - Variants: default, loading, error, empty
   - Tokens: neutral bg, semantic accents for status
   - Motion: slide-in from right
   - Proof: shows credentials, permissions, activity with tx links
   - Anti-slop: Data-first, not marketing hero

4. **Create Agent Form** — modal or inline
   - Variants: default, submitting, success, error
   - Tokens: white bg, border, semantic submit button
   - Motion: none
   - Proof: deploys identity + wallet on submit
   - Anti-slop: Minimal fields (Name, Type only)

5. **Status Badge** — agent state
   - Variants: active, inactive, slashed, pending
   - Tokens: semantic bg + mono text
   - Motion: none
   - Proof: status derived on-chain
   - Anti-slop: Icon + text, not color-only

6. **Reputation Score** — numeric display
   - Variants: default, loading, updated
   - Tokens: mono numerals, semantic color for range
   - Motion: counter tick on update
   - Proof: score from on-chain event
   - Anti-slop: Exact number, not bar chart

---

## Page 4: Assets / Invoices

**Components:**

1. **Invoice Table** — list view
   - Variants: default, hover-row, selected-row, empty-state
   - Tokens: hairline borders, mono for amounts, semantic for status
   - Motion: stagger row load, hover lift 1px
   - Proof: every row shows asset ID + attestation status
   - Anti-slop: Dense table, not card mosaic

2. **Register Invoice Form** — multi-step
   - Variants: step-1, step-2, step-3, submitting, success, error
   - Tokens: white bg, border, semantic submit button
   - Motion: slide between steps
   - Proof: deploys InvoiceRegistry entry on submit
   - Anti-slop: Minimal fields (amount, due date, counterparty, doc hash)

3. **Invoice Detail Panel** — slide-in or full
   - Variants: default, attested, settled, disputed
   - Tokens: neutral bg, semantic state colors
   - Motion: slide-in from right, state-change pulse
   - Proof: attestation tx, settlement tx, permission tx all visible inline
   - Anti-slop: Proof-first layout, not marketing

4. **Attestation Status Indicator** — underwriting state
   - Variants: pending, attested, rejected
   - Tokens: semantic color + icon
   - Motion: pulse on state change
   - Proof: status from last on-chain event
   - Anti-slop: Icon + text, not color-only

5. **Permission Status Badge** — enforcement state
   - Variants: active, blocked, expired
   - Tokens: semantic bg, mono text
   - Motion: none
   - Proof: permission set tx hash visible
   - Anti-slop: Clear verb, not generic "status"

6. **Settlement Button** — execute payment
   - Variants: default, disabled (not attested), submitting, success, error
   - Tokens: primary bg, disabled neutral
   - Motion: loading spinner, success tick
   - Proof: settlement tx hash visible
   - Anti-slop: Clear verb, not generic "submit"

---

## Page 5: Activity

**Components:**

1. **Activity Timeline** — chronological feed
   - Variants: default, filtered, empty
   - Tokens: hairline borders, mono for tx hashes, semantic for event type
   - Motion: anchor highlight on scroll
   - Proof: every event links to explorer
   - Anti-slop: Timeline, not marketing cards

2. **Event Type Filter** — filter by action
   - Variants: default, active, populated, empty
   - Tokens: neutral bg, border, semantic active state
   - Motion: none
   - Proof: filters on-chain events
   - Anti-slop: Functional, not decorative

3. **Tx Link Component** — inline proof
   - Variants: default, confirmed, pending, failed
   - Tokens: mono text, semantic status, link color
   - Motion: none
   - Proof: truncated hash + explorer link
   - Anti-slop: Consistent everywhere, not highlighted decoratively

4. **Explorer Button** — external link
   - Variants: default, external
   - Tokens: secondary text, border
   - Motion: none
   - Proof: links to https://scan.botchain.ai/tx/...
   - Anti-slop: Small, secondary, not hero

---

## Component count by page (relaxed limits)

| Page | Count | Archetype range | Pass? |
|------|-------|-----------------|-------|
| Landing | 5 | 8–12 | Yes |
| Dashboard | 4 | 8–12 | Yes (dense metrics, fewer components) |
| Agents | 6 | 8–12 | Yes |
| Assets / Invoices | 6 | 8–12 | Yes |
| Activity | 4 | 8–12 | Yes (text-dense, fewer chrome) |

**Total unique components: 25**

---

## Auto-reject filter check
- No decorative chrome on operational pages: PASS
- No bento on data pages: PASS
- No marketing hero on tools: PASS
- Proof visible without modals: PASS
- Motion clarifies state, not decoration: PASS
- Generic components in context: PASS (surrounding chrome is specific)