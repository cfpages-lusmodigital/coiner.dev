# Product Requirements Document (PRD): coiner.dev — Sovereign Solana Token Creator

## UI audit closure — 2026-11-18

- ✅ Completed: revalidated U01–U14 against the current production build; all fourteen findings closed for the tested UI profile.
- ✅ Completed: isolate asynchronous confirmation by attempt/signature/network, gate broadcast retries, and clear feedback when ownership changes.
- ✅ Completed: verify reduced motion, bounded decorative animation, beam movement, keyboard names/locks, clipboard failure, switch targets and palette.
- ✅ Completed: measured initial JavaScript at 204,480 gzip bytes (<204,800 bytes); DESIGN.md/CODEBASE.md reflect current browser evidence.

Evidence: `scripts/verify-ui.mjs`, `scripts/accept-ui.mjs`, `scratch/sol_ui_repair_evidence/` and the canonical OneDrive report `REPORT/REPORT-COINER-UI-CLOSURE-2026-11-18.md`. These tests use controlled RPC/upload/wallet fixtures; they do not certify real token creation or physical-wallet behavior.

**Product Name:** `coiner.dev`  
**Domain:** `https://coiner.dev` (Cloudflare Pages `coiner-dev`, project `db1e067e-925c-402e-96de-d0f3c2ef467b`)  
**Repository:** `cfpages-lusmodigital/coiner.dev`  
**Status:** In Active Evolution  
**Owner:** Syamsul Alam (`admin@alampintar.org`)  
**Lead Architects:** Secretary Gemini (Antigravity) & Engineer Sol (GPT-6.1 Sol in mcodex)  
**Last Updated:** 2026-11-16 (Asia/Jakarta)

---

## 1. Executive Summary & Vision

`coiner.dev` is a sovereign, non-custodial Solana SPL and meme coin creation suite. It eliminates the predatory markups, hidden fees, and custodial risks of third-party platforms (which routinely extract 0.40–0.80+ SOL per coin) while providing Syamsul with a zero-cost utility for launching personal degen and portfolio coins.

### Core Philosophy
1. **Sovereignty & Non-Custodial Security:** Zero server-side private keys or custodial wallets. All mint transactions are assembled in browser RAM and signed directly by the user's connected wallet (Phantom, Solflare, etc.).
2. **Dual-Tier Commercial & Bundled Security Model:**
   - **Administrator (`admin@alampintar.org` / Admin Wallet `2di9sSnh1BYixnNw7Hw47XbMet9J5HFdF8NUMN2LZmaV`):** **0.00 SOL** platform fee (pays strictly raw Solana rent and Metaplex protocol creation cost ~0.0168 SOL).
   - **Public Users:** **0.15 SOL** flat platform service fee with all 3 security revocations (Freeze, Mint, Update) and IPFS metadata pinning bundled 100% free with zero upsell. Customization to retain any authority (non-standard configuration) incurs a **+0.05 SOL** fee per kept authority. Fees transfer atomically on-chain to the treasury wallet (`2di9sSnh1BYixnNw7Hw47XbMet9J5HFdF8NUMN2LZmaV`).
3. **Atomic Settlement:** Token minting, account creation, supply distribution, Metaplex metadata registration, authority revocation, and fee transfer settle together or not at all.
4. **Transparent Economics:** No hidden fees, no token percentage extraction, no smart contract lockup. The creator retains 100% of supply in their own wallet immediately.
5. **Degen-First Public Voice & Strict Audience Separation:** Public-facing copy is written exclusively for the customer (fast, punchy, degen-friendly Web3 tone). Never expose internal admin credentials (`admin@alampintar.org`), Admin Mode perk details, or treasury wallet internals in public marketing copy, hero banners, or public FAQs. Never burden users with internal account byte sizes or rent accounting spreadsheets; public users only need to know their all-inclusive price: **0.15 SOL Flat Fee**.

---

## 2. In-Depth Competitor Analysis & Pricing Intelligence

A comprehensive audit of the Solana token creation landscape was conducted in November 2026 across market leaders:

| Platform | Base Creation Fee | Authority Revocations (Freeze / Mint / Update) | Total Creation Cost | Ancillary Ecosystem Tools & Add-on Fees | Primary Weaknesses & Vulnerabilities |
|---|---|---|---|---|---|
| **Smithii** (`tools.smithii.io`) | 0.50 SOL | +0.10 SOL Freeze<br/>+0.10 SOL Mint<br/>+0.10 SOL Update | **0.70 – 0.80 SOL** (~$140–$160+) | Raydium Pool Creation (0.1 SOL), OpenBook Market (0.2–2.8 SOL), Bundler (0.3 SOL), Volume Bot (0.1 SOL/100 wallets) | Heavily predatory pricing; fees stacked at every checkout step; aggressive upselling. |
| **Orion Tools** (`oriontools.io`) | 0.40 SOL | +0.10 SOL per authority toggle | **0.40 – 0.50 SOL** | Raydium pool wizard, LP Burn utility, OpenBook generator | Cluttered UI; complex multi-step forms; inconsistent fallback behavior. |
| **CoinFactory** (`coinfactory.app`) | 0.20 SOL | +0.10 SOL Freeze<br/>+0.10 SOL Mint<br/>+0.10 SOL Vanity | **0.40 – 0.50 SOL** | Multi-chain generator, custom tokenomics | Generic multi-chain interface not optimized for Solana high-speed meme mechanics. |
| **DexLab** (`dexlab.space`) | 0.15 SOL | Included at launch | **0.17 SOL** (with ~0.02 SOL rent) | Vesting schedules, DEX market creator | Complex developer UI; slow metadata propagation; dated visual design. |
| **SlerfTools** (`slerf.tools`) | ~0.10 SOL | Included at launch | **~0.12 SOL** | Multi-sender (0.002 SOL/addr), market creator, LP locker | Bare-bones interface; lacks real-time live preview or RugCheck simulations. |
| **Pump.fun** (`pump.fun`) | 0.00 SOL upfront | Built-in bonding curve | **0.00 SOL upfront**, but 1% trading fee + 2 SOL Raydium migration fee | Instant bonding curve, King of the Hill gamification, livestreaming, auto-graduation | Not a plain SPL creator; forces users into proprietary bonding curve with high slip and platform control. |
| **coiner.dev** (Our Platform) | **0.00 SOL** (Admin)<br/>**0.15 SOL** (Public Bundled) | **Included Free** (Revoke Freeze, Revoke Mint, Immutable); +0.05 SOL if customized | **~0.0168 SOL** (Admin)<br/>**~0.1668 SOL** (Public) | Live DEX preview, RugCheck predictor, 1-click Raydium CPMM link, Native wallet admin recognition | **Best-in-class bundled pricing; zero-fee admin mode; 100% non-custodial; no upsell traps.** |

---

## 3. Target Audience & User Personas

1. **Platform Owner (Syamsul Alam):** Needs an instantaneous, zero-overhead tool to deploy degen coins, test Solana mechanics, or bootstrap ecosystem assets without paying third-party markups or managing local CLI scripts.
2. **Crypto Degens & Meme Coin Creators:** Fast-moving creators launching tokens based on viral culture, social events, or TikTok/X trends. They prioritize speed, low upfront fees, RugCheck A-Grade compliance, and immediate Raydium pool creation.
3. **Community & Web3 Project Founders:** Founders launching governance, reward, or utility tokens who need clean SPL / Token-2022 metadata, immutable supply guarantees, and full retention of minted supply without custodial risk.

---

## 4. Multi-Phase Feature Roadmap & Implementation Tracker

### Phase 1: Sovereign Atomic SPL Creator (Core Platform) — `✅ Completed`
- `✅ Completed` **Non-Custodial Wallet Integration:** Full support for Solana Wallet-Adapter (Phantom, Solflare, etc.) with network toggle (Devnet vs Mainnet-beta).
- `✅ Completed` **Stateless IPFS Metadata Proxy (`functions/api/upload-metadata.js`):** Serverless Cloudflare Pages Function uploading token images and Metaplex JSON metadata to Pinata IPFS without baking secrets into client bundles.
- `✅ Completed` **Atomic Transaction Engine (`src/lib/solana.js`):** Client-side assembly of single atomic transaction featuring compute budget (250k CU), rent exemption, mint initialization, ATA creation, 100% supply minting, Metaplex V3 metadata registration, authority revocations, and platform fee transfer.
- `✅ Completed` **Dual-Tier Fee Model (`src/lib/admin.jsx`):** Native Solana wallet allowlist recognition (`2di9sSnh1BYixnNw7Hw47XbMet9J5HFdF8NUMN2LZmaV` and `VITE_ADMIN_WALLETS`). Public creators charged 0.15 SOL flat bundled fee; recognized admin receives 0.00 SOL exemption.
- `✅ Completed` **Live DEX Preview & Itemized Cost Breakdown:** Real-time token avatar and ticker card with predicted RugCheck rating and transparent on-chain rent itemization.
- `✅ Completed` **Multi-Step Launch Modal:** Animated step indicators, error boundaries, 1-click copy for Mint address, Solscan explorer links, RugCheck audit links, and Raydium pool shortcuts.
- `✅ Completed` **Domain & Edge Deployment:** Automated CI/CD from `cfpages-lusmodigital/coiner.dev` to `https://coiner.dev`.

---

### Phase 2: In-Browser Vanity Mint Address Generator — `⏳ Planned`
- `⏳ Planned` **Web Worker Grinder:** Browser-based Ed25519 keypair generation running multi-threaded Web Workers to find custom prefix/suffix addresses (e.g. `...coin`, `...pump`, `...sol`, `...degen`).
- `⏳ Planned` **Zero-Fee Vanity Ingestion:** Allow creators to select their vanity keypair as the mint account without paying the 0.10–0.20 SOL extra charged by CoinFactory.
- `⏳ Planned` **Performance Controls:** Difficulty estimator (expected search time in seconds based on character length) and CPU thread slider to prevent freezing mobile devices.

---

### Phase 3: Token-2022 (Token Extensions) Suite — `⏳ Planned`
- `⏳ Planned` **Transfer Fee Extension (Tax Tokens):** Ability to configure native protocol-level transfer taxes (e.g. 1% to 5% with fee cap in lamports) and specify the tax collector treasury wallet.
- `⏳ Planned` **Default Account State Extension:** Support for tokens frozen by default until creator verification or whitelisting.
- `⏳ Planned` **Non-Transferable / Soulbound Extension:** For community badges, certifications, or loyalty credentials.
- `⏳ Planned` **Permanent Delegate Extension:** For enterprise tokens requiring freeze/burn oversight.

---

### Phase 4: 1-Click Raydium Liquidity Pool & LP Burn Tool — `⏳ Planned`
- `⏳ Planned` **Raydium CPMM Pool Deployment:** Direct integration with Raydium Constant Product Market Maker (CPMM) smart contracts, enabling creators to deploy SOL/Token liquidity pools without paying 0.29–2.80 SOL for an OpenBook Market ID.
- `⏳ Planned` **Atomic Liquidity Burn Utility:** Instruction executing SPL `createBurnCheckedInstruction` to permanently burn creator LP tokens and reduce mint supply, immediately producing a verifiable "100% LP Burned" RugCheck audit badge (note: burning LP permanently relinquishes LP fee redemption rights).
- `⏳ Planned` **Meteora DLMM Pool Integration:** Dynamic Liquidity Market Maker pool creation for volatile meme coin launches with zero slippage bins.

---

### Phase 5: Jito MEV Bundler & Anti-Snipe Launcher — `⏳ Planned`
- `⏳ Planned` **Jito Block-0 Bundle Assembly:** Package token deployment, Raydium pool creation, and creator's initial buy orders into a single atomic Jito Bundle (up to 5 transactions).
- `⏳ Planned` **Validator Tip Configuration:** Configurable Jito tip (e.g. 0.01 to 0.05 SOL) to ensure block-0 priority landing.
- `⏳ Planned` **Transaction ordering goal:** Evaluate mechanisms that may reduce exposure to competing transactions. Verify observed execution and account for venue and network behavior.

---

### Phase 6: Multi-Sender Batch Airdrop Tool — `⏳ Planned`
- `⏳ Planned` **CSV / Bulk Address Ingestion:** Drag-and-drop CSV or paste address list with individual or uniform token distribution amounts.
- `⏳ Planned` **Transaction Packing Engine:** Packs up to 15–20 token transfers per Solana transaction using address lookup tables (LUTs) to minimize network fees.
- `⏳ Planned` **Real-Time Dispatch Progress:** Live progress bar tracking broadcast signatures, successful transfers, and retry handling for failed recipients.

---

### Phase 7: Obsidian, White & Metallic Gold Visual Redesign — `✅ Completed`
- `✅ Completed` **Purge All Green & Cyan Accents:** Eliminates emerald and cyan across wallet adapter, status badges, buttons, spinners, and preview cards in favor of a cohesive Obsidian Black, Crisp White, and Metallic Gold palette.
- `✅ Completed` **Logo Redesign (`src/components/CoinerLogo.jsx` & `public/favicon.svg`):** Sovereign Solana coin insignia with metallic gold rim and three-bar emblem designed by Engineer Sol, paired with crisp white `coiner` and gold `.dev`.
- `✅ Completed` **Typographic Unification:** Stripped all `font-mono` terminal classes in favor of unified `font-sans` clean modern typography across all screens, forms, statistics, and tables.
- `✅ Completed` **Ambient 3D Hero Depth & Specular Outlines:** Integrated physical 3D gold Solana coin (`GoldCoin3D`) as a subtle ambient backdrop behind the hero headline with specular white-to-gray text outline gradients (`.shiny-card`, `.shiny-pill`, `.shiny-button`).
- `✅ Completed` **Adversarial Audit Remediation (U01–U14):** Fixed narrow viewport clipping, sticky scrolling, recovery isolation, reduced-motion controls, reported contrast pairs (AA minimum), keyboard accessibility, 3D card float separation, and image blob revocation.

---

## 5. Technical Requirements & Security Boundaries

1. **Client Security:** No storage of secret keys in `localStorage`, cookies, or analytics. Keypair generation must utilize `crypto.getRandomValues()`.
2. **BigInt Precision:** Token calculations must use integer BigInt math with explicit decimal padding. Floating-point math (`Math.pow`) is strictly forbidden for token balances.
3. **u64 Limit Guard:** Enforce maximum supply limit `18,446,744,073,709,551,615n` to prevent Solana SPL token integer overflow.
4. **Cloudflare Serverless Integrity:** Cloudflare Pages Functions must validate all image uploads against MIME allowlists (`image/png`, `image/jpeg`, `image/webp`, `image/gif`, `image/svg+xml`) with a hard 5MB limit.
5. **Fail-Closed Treasury Invariant:** If `platformFeeSol > 0`, the transaction builder must enforce a valid `VITE_TREASURY_WALLET` or fail closed with an explicit error to prevent uncollected service fees.

---

## 6. Success Metrics & KPIs

| Metric | Target | Measurement Source |
|---|---|---|
| **Token Creation Success Rate** | > 99.0% | Client-side confirmation callbacks & RPC telemetry |
| **Public Platform Revenue** | 0.15 SOL flat bundled fee (+0.05 SOL if customized) | On-chain Treasury Wallet balance (`VITE_TREASURY_WALLET`) |
| **Admin SPL creation cost** | Measure on-chain fees and account deposits per mint | Finalized fee payer transaction receipts |
| **Time to Launch** | < 15 seconds from Form Submit to On-Chain Finality | Client stopwatch telemetry in `LaunchModal.jsx` |
| **RugCheck Compatibility** | 100% "Good" / A-Grade score | RugCheck API & on-chain authority inspection |

---

## 7. Launch strategy and evidence

Coiner supports a Solana SPL creator and a separate SOL-paired Pump lifecycle. The owner strategy is to test whether transparent launches can produce positive average net SOL after costs. Capital targets and individual success stories are hypotheses. The [launch and profitability SOP](GUIDE.md) owns qualification and sizing decisions. The CLI implements transaction safeguards and user-configured exit rules.

1. Validate financing and execute a funded simulation using the actual candidate, wallet, metadata URI, current network and fee state. Set a buy cap, a simulated launch cap, and an exit reserve. Use an isolated wallet with only the approved allocation.
2. Require the scope and budget for each live trial or policy to be authorized before broadcasting. A single controlled trial verifies live execution and produces one realized net result.
3. Require chronological out-of-sample evidence of positive mean net SOL after execution and operating costs before increasing spend or enabling repeated deployments. Evaluate downside, drawdown, data quality and unresolved exposure. Include failed and unfilled attempts. Equate continuous monitoring with the ability to pause when the measured edge weakens.

Authorize repeat deployment only after the [no-buyer downside model and per-run decision rules](https://md.codev.id/#/OPERATIONS/PROJECTS/COINER_LAUNCH_DOWNSIDE_MODEL.md) pass in a verified workflow. Separate realized performance and unsigned quote estimates. Keep unresolved exposure on the ledger and hold new launches until recovery.

As checked 2026-11-19, Pump's SOL-paired bonding curve schedule lists 1.25% total per trade, including 0.30% creator and 0.95% protocol fees. The live SDK fee configuration's initial tier agreed. Canonical PumpSwap fees vary by market-cap tier. Use the SDK and live configuration for the quote, and receipts for actual SOL changes. Account deposits, fee claims and actual recoveries belong in wallet accounting. Commercial fees for Coiner's public SPL creator are tracked separately. [Pump fees](https://pump.fun/docs/fees) · [Solana fees](https://solana.com/docs/core/fees)

---

## 8. Tooling gap analysis and platform expansion

- **Released CLI targets.** `create --target spl` creates a standalone SPL token. `create --target pump` creates a SOL-paired Token-2022 mint with its Pump curve and supports an optional atomic initial buy. This path supports a signature-verified simulation and `--auto-exit` when an initial buy is specified.
- **Web and Raydium proposals.** Web launch target selection, direct Raydium CPMM creation and LP management are separate roadmap work. Read current pool fees and verify support before considering another venue.
- **Cost estimation.** The Pump CLI uses the simulated wallet debit against `--max-spend-sol` and applies a separate initial buy cap. A funded simulation must precede any live trial. Prior nominal costs cannot substitute for current fees, account deposits or required exit reserves.

---

## 9. Market integrity and evidence

Create original or authorized token assets and use consistent public name, ticker and project links. Disclose creator allocation and any paid promotion. Keep candidate discovery separate from authority to launch. Scout scores, paid boosts and anecdotal outcomes do not establish expected returns or independent demand.

Exclude wash trades, manufactured volume, concealed coordinated buying and misleading affiliation or return claims. Collect data through authorized sources and record observable inflows, actual fills and costs. Use the [operator SOP](GUIDE.md#validate-before-repeating) to evaluate market evidence before repeat deployment. [Pump terms, section 21](https://pump.fun/docs/terms-and-conditions#21-prohibited-use)

---

## 10. Automated exit engine

Live `coiner-cli watch` and `create --target pump --auto-exit` use `src/lib/pumpLifecycle.js` and `src/lib/pumpPosition.js`. The installed Pump and PumpSwap SDKs build fee-aware quotes and execution instructions. The watcher verifies the RPC genesis, mint program, curve and pool ownership, and SOL quote mint. It routes to the bonding curve until completion, waits if migration is pending, and uses the canonical PumpSwap pool when it appears.

The watcher uses its first executable full-position quote as the baseline. Each later comparison adjusts for the remaining token quantity. The default sequence is:

| Trigger | Default rule | Attempted action |
|---|---|---|
| TP1 | Exit quote reaches 2.0x the normalized baseline | Sell up to half of initial tokens. |
| TP2 | Exit quote reaches 3.5x after a finalized TP1 | Sell up to a quarter of initial tokens. |
| Stop or timeout | Exit quote at or below 0.70x, or 25 minutes elapsed | Sell the full remaining position. Timeout has no additional multiplier requirement. |
| Explicit liquidation | Operator passes `--liquidate-now` on the existing position | Attempt the full remaining exit when an executable venue is available. |

Take-profit triggers express quotes rather than guaranteed returns. A trade uses a positive minimum amount out and a signature-verified simulation. Network failures, missing liquidity or a stale quote can delay or prevent a fill. The position file records pending signed bytes and finalized transaction receipts. Recovery uses the original signature, wallet, network and file. Actual SOL and base-token deltas come from finalized transactions. [CLI guide](GUIDE.md#cli-lifecycle-verification-and-recovery) · [Lifecycle reference](https://md.codev.id/#/KNOWLEDGE/KNOWLEDGE-COINER-PUMP-SOLANA-LIFECYCLE.md)

---

## 11. Public metadata and communications

Check that the on-chain name and ticker match the published metadata. Validate the image and JSON retrieval and keep proof of rights for the artwork. Use public channels the project operates or has permission to use, with clear attribution for any source material that is referenced. Provide accurate creator and project information without implying a third-party endorsement. Record promotional costs separately from actual trading proceeds. [Launch checklist](GUIDE.md#launch-checklist)

---

## 12. Implementation Progress Tracker & Quality Gates

| Gate ID | Subsystem / Feature | Target Milestone | Acceptance Criteria | Status |
|---|---|---|---|---|
| **GATE-PRD** | PRD Specifications | Complete Architecture | Sections 1–16 fully codified with mathematical, cognitive, and protocol schemas | `✅ Completed` |
| **GATE-PUMP-DATA** | Curve and pool state | `src/lib/pumpLifecycle.js` | Check the Pump owner, mint program and SOL quote. Resolve the canonical PumpSwap pool after migration. | Verified on local Devnet fork |
| **GATE-SELL-IX** | Pump and PumpSwap sell instructions | `src/lib/pumpLifecycle.js` | SDK fee-aware quotes, positive slippage floor and reconciled finalized token and wallet deltas. | Curve finalized on public Devnet. PumpSwap verified on the local fork. |
| **GATE-CLI-WATCH** | CLI Watcher & Auto-Exit | `bin/coiner-cli.js watch` | Serial trades, same-signature retries, resumed receipts and automatic timeout exit. | Automatic exit and saved-receipt recovery verified on public Devnet. Identical-byte retry verified in fixtures. |
| **GATE-CREATE-EXIT** | Unified Launch & Exit Flag | `coiner-cli create --target pump --auto-exit` | Finalize Token-2022 launch and initial buy, watch the funded position, then finalize its exit. | Finalized launch, buy and automatic curve exit on public Devnet and Mainnet. |
| **GATE-LAUNCH-ECONOMICS** | Owner strategy validation | [Operator SOP](GUIDE.md#validate-before-repeating) | Reconciled all-in net SOL across an out-of-sample cohort and defined loss limits before repeated live runs. | Strategy evidence pending. |
| **GATE-SCOUT** | Trend Scanner & Asset Harvester | `bin/coiner-cli.js scout` | Ingests DexScreener & Pump.fun feeds, extracts images, tickers, and viral social links | `✅ In Progress` |
| **GATE-AI-BRIDGE** | AI Bridge Cognitive Engine | `src/lib/ai-bridge.js` | Connects to `ai-bridge-codev` cascade; distills narrative, lore, virality, and ticker variations | `✅ In Progress` |
| **GATE-WALLET-CHECK** | Non-Custodial Keypair Validator | `coiner-cli wallet` | Inspects keypair public key against `2di...maV`, checks live SOL balance, zero-leakage | `✅ In Progress` |
| **GATE-SOL-REVIEW** | Independent review | Scout, wallet, UI and exit review ledgers | Use current runtime evidence per subsystem and recheck material CLI changes. | Prior findings remain historical where superseded |
| **GATE-UI-REDESIGN** | Obsidian, White & Gold UI Redesign | `src/` & `DESIGN.md` | Pure obsidian, white & gold aesthetic, unified sans typography, zero green/cyan, all 14 audit findings remediated, acceptance test 12/12 gates PASS | `✅ Completed` |
| **GATE-BUILD-QUAL** | Production Build & Verification | Repository-wide | `pnpm run build` passes 100% clean; zero regressions | `✅ Completed` |

---

## 13. Autonomous Intelligence, Trend Scanner (`coiner-cli scout`), and AI Bridge Integration

### 13.1 Market scanner and staging

`coiner-cli scout` reads DexScreener token profiles, paid boosts, and pair summaries for Solana. It ranks eligible entries using activity metrics and stages validated raster images and metadata previews. The ranking is an input to candidate selection. It does not measure organic demand, expected profitability or asset rights. Review rights and public claims before publishing a candidate. Use authorized endpoints and the [launch checklist](GUIDE.md#launch-checklist).

#### Strategy-launch qualification

- `scout --evidence-only` reports timestamped public comparable-pair activity, liquidity and paid boosts separately. It returns before staging, pinning or trading. Missing data is explicit. The snapshot measures comparable activity and never certifies audience demand, independent wallet ownership, or authorization to launch.
- Scout may sample a bounded set of finalized receipts from verified canonical SOL-quoted PumpSwap comparables. Report attributable wallet addresses and actual quote-vault changes with skipped and unavailable receipts. The sample excludes known creator addresses, remains observational, and cannot establish buyer independence or authorize a launch.
- Pump `create` accepts optional `--max-no-buyer-loss-sol` and `--min-exit-reserve-sol` together with optional `--outside-cost-sol` when both controls are set. Use these in simulation and live execution. Measure the post-buy curve, inventory and wallet from the exact signed launch simulation. Subtract the fee-aware full exit quote, add the estimated one-signature exit fee and declared outside costs, then enforce the modeled loss and reserve before writing a position or submitting. Recompute on every launch. A failed sell can lose more than the modeled fill.
- Commercial candidate selection, rights review and one-position-at-a-time admission remain explicit operator gates until comparable evidence and repeat behavior are validated. A Scout snapshot alone cannot advance those gates.

### 13.2 Sovereign AI Bridge (`ai-bridge-codev`) Cognitive Layer
The CLI connects to the workstation/fleet AI execution layer (`ai-bridge-codev`) to generate the *thinking components* essential for viral coin creation:

```
[Trending Market Signal]
           │
           ▼
┌────────────────────────────────────────────────────────┐
│  src/lib/ai-bridge.js Client Adapter                    │
│  - Loopback HTTP: http://127.0.0.1:8126/v1/chat/completions │
│  - Direct Python: ai_bridge.cascade.complete(prompt)   │
│  - Algorithmic Fallback: Deterministic templates       │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│  Unified AI Bridge Cascade Engine (`ai-bridge-codev`)   │
│  Tier 1: Headless Antigravity (AGY) Gemini ($0)        │
│  Tier 2: Google AI Pro OAuth Direct In-Memory ($0)     │
│  Tier 3: TokenHarbor Native Direct HTTP ($0)           │
│  Tier 4: OpenRouter Free Lane Direct HTTP ($0)         │
│  Tier 5: Amazon Bedrock Mantle / DeepSeek Direct       │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│  5 Cognitive Outputs:                                  │
│  1. Trench Lore & Punchy Description                   │
│  2. Optimized Ticker ($TICKER / $AGENT-TICKER)         │
│  3. Narrative Virality & Momentum Score (1–100)        │
│  4. Derivative Parody / Spin Angle                     │
│  5. Dynamic Exit & Volatility Parameter Advice         │
└────────────────────────────────────────────────────────┘
```

#### Fail-Closed & Offline Fallback Invariant
If the AI bridge daemon is offline, experiencing network timeout, or unreachable, the CLI does **not crash or abort**. It automatically fails over to deterministic narrative templates (combining trending keywords, viral tickers, and default degen lore) to produce staging suggestions. Live publication and trading still require an authorized candidate and risk envelope.

---

## 14. Non-Custodial Keypair & Wallet Authority Architecture

### 14.1 Cryptographic Key Separation (Public Key vs Secret Key)
To safeguard user capital and eliminate user anxiety regarding wallet funds:

1. **Public Key (`PublicKey`)**:
   - The user's shared address (`2di9sSnh1BYixnNw7Hw47XbMet9J5HFdF8NUMN2LZmaV`).
   - Acts as an immutable identity, treasury destination, and fee-exempt admin recognition key.
   - **Zero Debit Authority**: Knowing a public address provides **zero ability to spend funds**. It is cryptographically impossible for anyone (including `coiner-cli`) to pull funds using only a public key.
2. **Secret Key / Keypair (`Keypair`)**:
   - The 64-byte Ed25519 private key file stored locally on the user's secure filesystem (e.g. `~/.config/solana/id.json`).
   - Solana's consensus engine requires the valid cryptographic signature of the fee payer for every transaction.
   - **Zero Stranger Risk**: It is mathematically impossible for the CLI to pull money from strangers or third parties, because transactions without matching private key signatures are rejected instantly by all RPC nodes and validators with `Transaction signature verification failure`.

### 14.2 Keypair Discovery & Validation Hierarchy
The CLI loads signing authority in strict order:
1. Explicit CLI argument: `--keypair <path>`
2. Environment variable: `SOLANA_KEYPAIR_PATH` or `WALLET_KEYPAIR_PATH`
3. Standard Solana CLI path: `~/.config/solana/id.json`

#### Fail-Closed Wallet Inspection Command (`coiner-cli wallet`)
* Validates keypair read permissions, 64-element byte array integer bounds `[0..255]`, and Base58 public key consistency.
* Asserts whether the loaded keypair matches the authorized creator wallet (`2di9sSnh1BYixnNw7Hw47XbMet9J5HFdF8NUMN2LZmaV`).
* Queries the live Solana cluster for current SOL balance with explicit RPC error tracking and non-zero exit codes on connection failure.
* Evaluates balance against recommended creation buffer (0.05 SOL for Admin, 0.20 SOL for Public).

---

## 15. Scout, Staging and SPL Auto-launch

The autonomous pipeline executes across 5 distinct phases:

1. **Scout & Filter**: `coiner-cli scout` polls live trends and selects the highest momentum candidate meeting volume/boost thresholds.
2. **AI Bridge Synthesis**: Ingests narrative context into `ai-bridge-codev` to synthesize optimized token name, ticker, and viral lore.
3. **Asset Staging**: Creates a fresh run under the operator-owned staging parent. Writes the validated raster image and a local metadata preview into an exclusive candidate directory. The preview is for inspection before publication.
4. **Published Metadata and SPL Mint**: For live auto-launch without an explicit URI, send the validated image and token fields to the authenticated Pages proxy. The proxy pins the image and then constructs and pins Metaplex JSON. Create uses the returned metadata URI only after both CIDs validate. A validation or publishing failure stops before signing. An explicit `--metadata-uri` uses the operator's pre-published JSON. A dry run skips pinning and uses the explicit URI or a reserved simulation URI.
5. **Tradable Pump Launch and Exit**: `--target pump` launches a SOL-quoted Token-2022 coin. Supply an initial buy and `--auto-exit` to manage that position from the same CLI invocation. The watcher sells on the active bonding curve or routes to its canonical PumpSwap pool after migration. Standalone SPL creation still rejects live `--auto-exit`.

The [launch and profitability guide](GUIDE.md) owns live preflight, net SOL accounting and strategy validation. The [CLI recovery procedure](GUIDE.md#cli-lifecycle-verification-and-recovery) explains position files, confirmation, restart and manual liquidation. [Pump and Solana lifecycle reference](https://md.codev.id/#/KNOWLEDGE/KNOWLEDGE-COINER-PUMP-SOLANA-LIFECYCLE.md)

---

## 16. Security Invariants, Adversarial Hardening & Quality Gate Specifications

### S01–S04 remediation acceptance

- ✅ Implemented: Create exclusive staging runs and candidate outputs beneath a verified, operator-owned directory.
- ✅ Implemented: Limit market and image response bodies and include DNS and both market request phases in the applicable deadlines.
- ✅ Implemented: Reject nonpublic destinations and redirects. Keep the HTTPS hostname for certificate verification and connect to a validated address.
- ✅ Implemented: Require a validated image and an authenticated pinning response before automatic live creation. Dry runs and explicitly supplied URIs bypass automatic pinning.
- ✅ Verified: Production Pages uses encrypted scout and Pinata bindings. Anonymous requests and wrong bearers receive 401.
- ✅ Verified: The compiled Pages handler uses workerd-compatible manual redirects and rejects non-success statuses. Pinning diagnostics exclude credentials and request content.
- ✅ Verified: An authenticated production fixture pinned both files. The public JSON points to the returned image CID, and the retrieved image matches the original bytes.
- ✅ Verified: Funded signed SPL and Pump simulations passed on public Devnet. The Token-2022 launch and full automatic bonding-curve sale finalized there, and the separate PumpSwap test passed on the local fork. [Finalized launch](https://explorer.solana.com/tx/63PeyefbM27wpHQx4eXuWtNvjnWpTxFFtUJmS5ZgRxCHC1gp8LG12Bg5ayZXU4Hj3gY3VTZ4bAoNWYbqLTHS2BJJ?cluster=devnet) · [Finalized automatic exit](https://explorer.solana.com/tx/2LYxoQYDc2uy4cacuG5KAqzXHZbRcnbbGYZhQtaVeJ7kNsaWgm7Zhz7m49YWwAouG1jLrK8WPYWRjXhS2epN4ofF?cluster=devnet)
- ✅ Verified: On 2026-11-19, release `3436014` finalized a Mainnet launch and automatic bonding-curve exit for Coiner Trial (COTEST). The wallet ended with zero tracked tokens. Independent finalized RPC reads matched the journal, and a fresh watch returned the same receipts. The all-in cost including funding was 0.008734680 SOL. Two other wallets bought between launch and exit. This is one live execution and cost sample. [Finalized launch](https://explorer.solana.com/tx/4SmXu9k2pZrXsMQGALFpadT2VRLTQJMLLRBoNfeo251Sk1qkvNvQsMuMpfiPf4o8cYpNW82bB4opF4dv9DHJf3tj) · [Finalized exit](https://explorer.solana.com/tx/iKMrL68c3mgCGyJA3pwrboMU9C7yQpkHMUKwCrKd2fG6obE92S2hJFtwhMVHorabbhr5TzZDHFpL9LtuzNxXnF3)
- ✅ Verified: The standalone Worker serves no Coiner route. Its automatic Git builds are paused, and both Pages deployments succeeded on the subsequent commit.
- ✅ Verified: Pinata revoked the legacy Coiner admin credential. Production uses the scoped server-side JWT. Legacy variables were removed from Pages and Worker build settings.

### 16.1 Threat Model & Isolation Boundaries
1. **Third-Party Market Data Ingestion**:
   - Staging rejects linked directory components and uses exclusive runs, sanitized candidate names, and exclusive file creation. The staging parent must be writable only by the operator and trusted administrators (S01).
   - Scout HTTP(S) requests reject credentials, nonstandard ports, nonpublic IPv4 and IPv6 addresses, mixed public and nonpublic DNS results, and redirects. Connections use a validated address and retain the original HTTP host and TLS hostname (S03).
   - Images have a 5 MiB body cap and a 12-second default DNS-to-body deadline. Each market JSON response is capped at 1 MiB, with a shared 12-second default deadline for feed and pair requests. Rejected responses are closed. Pair membership is restricted to the queried batch of at most 30 addresses (S02, S08).
2. **AI Cascade Cognitive Boundary**:
   - The AI Bridge cognitive engine output is parsed with strict type guards (`typeof data.text === 'string'`) and isolated process execution (S07).
   - String fields are enforced within Solana protocol UTF-8 limits (32 bytes name, 10 bytes symbol) using code-point iteration that never introduces Unicode replacement characters `\uFFFD` (S05).
   - Tickers are sanitized to uppercase alphanumeric grammar without special characters (S05).
   - Post-rounding mathematical invariants guarantee that `suggestedTp2 > suggestedTp1` and `suggestedSl < 1.0` unconditionally (S05).
   - Operator CLI flags always take precedence over AI suggestions, with CLI defaults unmasked to allow AI parameters to flow when flags are omitted (S05).
3. **Cryptographic Signer Boundary**:
   - Non-custodial 64-byte Ed25519 secret key files are validated for strict byte integer ranges `[0..255]`. Public addresses provide zero debit authority.
   - Unified discovery hierarchy ensures consistent keypair selection across all CLI commands (`wallet`, `create`, `watch`) with explicit non-zero exit codes on discovery or RPC failure (S11).
4. **Metaplex On-Chain Standards**:
   - Metadata URIs are HTTP(S) URLs without credentials and at most 200 UTF-8 bytes. Automatic publishing requires the operator's `COINER_SCOUT_UPLOAD_TOKEN` and a matching Pages secret. Pinata credentials stay server-side. The authenticated route requires a verified raster signature, enforces byte limits before parsing, and validates the provider's image and JSON CIDv0 responses (S04).





