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
- `⏳ Planned` **Sniper Bot Defense:** Guarantees that external sniper bots cannot front-run or drain the initial liquidity before the creator's purchase executes.

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
| **Admin Creation Cost** | Raw on-chain gas only (~0.0168 SOL) | On-chain fee payer transaction receipts |
| **Time to Launch** | < 15 seconds from Form Submit to On-Chain Finality | Client stopwatch telemetry in `LaunchModal.jsx` |
| **RugCheck Compatibility** | 100% "Good" / A-Grade score | RugCheck API & on-chain authority inspection |

---

## 7. Strategic Launch Engine & Capital Optimization (The 1 SOL Compounding Ladder)

### 7.1 The Tactical Dilemma: Pump.fun vs. Raydium CPMM vs. Meteora DLMM
When operating with lean capital (e.g. **1.0 SOL** initial treasury bankroll), standard direct DEX deployments present severe existential risk:

1. **Raydium V3 CPMM Direct Deployment**:
   - Fixed pool creation fee: **0.20 SOL**.
   - Token minting gas: **~0.0168 SOL**.
   - Minimum viable liquidity pairing: **0.50 SOL**.
   - Permanent LP burn (required for RugCheck green locked status): Locks **0.50 SOL** irreversibly.
   - *Total cost per launch*: **~0.72 SOL**.
   - *Runway with 1.0 SOL*: **Exactly 1 launch**. If the initial token does not immediately achieve organic virality within the first 15 minutes, 72% of capital is destroyed, leaving the creator unable to fund a second pool.

2. **Pump.fun Bonding Curve Protocol**:
   - Upfront creation cost: **~0.02 SOL** (network gas only).
   - Atomic Block-0 Dev Buy: **0.08 SOL** (acquiring ~0.282% of total genesis supply at curve initial pricing with 30 SOL virtual reserves).
   - Permanent liquidity lock: **0.00 SOL** (bonding curve manages virtual liquidity; dev tokens remain liquid and sellable).
   - Creator Volume Fee Sharing (Pump.fun V2): Earns **0.300% (30 bps)** of all buy/sell volume directly in SOL, streamed to the creator vault.
   - *Total nominal cost per launch*: **~0.10 SOL**.
   - *Runway with 1.0 SOL*: **Controlled iterative launches with liquid capital reserve**.

### 7.2 The Two-Stage Capital Compounding Ladder
To maximize expected developer value while strictly protecting against capital ruin, `coiner.dev` implements a **Two-Stage Compounding Ladder**:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                   THE TWO-STAGE CAPITAL COMPOUNDING LADDER                       │
└──────────────────────────────────────────────────────────────────────────────────┘
                                          │
       ┌──────────────────────────────────┴──────────────────────────────────┐
       ▼                                                                     ▼
┌──────────────────────────────────────────┐    ┌──────────────────────────────────────────┐
│ STAGE 1: BOOTSTRAP CURVE (1.0 SOL BANK)  │    │ STAGE 2: SOVEREIGN POOL (>= 5.0 SOL BANK)│
├──────────────────────────────────────────┤    ├──────────────────────────────────────────┤
│ • Launch Target: Pump.fun Bonding Curve  │    │ • Launch Target: Raydium V3 CPMM Pool    │
│ • Capital per Launch: 0.10 SOL nominal   │    │ • Capital per Launch: 0.72 – 2.0 SOL     │
│ • Alloc: 0.02 deploy + 0.08 genesis buy  │    │ • Alloc: 0.20 pool fee + 0.5-2.0 SOL LP  │
│ • Execution: Atomic Block-0 Jito Bundle  │    │ • Execution: Atomic LP Burn (Green Lock) │
│ • Revenue: 0.3% creator fee stream       │    │ • Note: Burned LP destroys ordinary fees │
│   + Tiered trailing dev take-profits     │    │   + Uncapped open market upside          │
│ • Target: Compound 1.0 SOL ──► 5.0+ SOL  │    │ • Target: High-conviction cult brand     │
└──────────────────────────────────────────┘    └──────────────────────────────────────────┘
```

### 7.3 Field-Tested Micro-Capital Multiplier Sizing Rules (1 SOL ──► 100 SOL)
Field intelligence extracted from frontline small-capital operators (`fHDPR48GejQ`, `flZ3YSGXTEI`, `ynf5tXViPbQ`, `h_Sipiv6MxI`) codifies five strict operational invariants incorporated into the platform:
1. **The 15% Max-Risk Invariant**: Never commit >15%–20% of current bankroll per attempt (at 1.00 SOL bankroll, launch outlay is strictly 0.10–0.15 SOL), leaving a liquid reserve to withstand consecutive failures.
2. **The 10-Double Compounding Equation**: Turning 1.00 SOL into 100.00 SOL requires ~7 disciplined 2x compounding cycles ($1 \times 2^{6.64} = 100$), not a reckless 10,000% gamble.
3. **Copy-Trending / Vamping**: Ingest viral narratives from active DexScreener/X spikes and deploy higher-signal, 100% security-verified contracts within 90 seconds.
4. **Staggered Take-Profit Tranches**: Liquidate dev holdings in 3 disciplined tranches: 33% at 2x (retrieving 100% initial capital), 33% at 3x–4x (securing pure profit), and 34% moonbag.
5. **Interactive Operator Dashboard**: Actionable milestone tracking codified with interactive checkboxes in `GUIDE.md` and `%OneDrive%\MD\OPERATIONS\GUIDE-1-SOL-TO-100-SOL-MULTIPLIER.md`.

---

## 8. Tooling Gap Analysis & Platform Expansion Specifications

To execute both stages seamlessly via both Web UI and headless CLI, `coiner.dev` addresses four core tooling gaps:

### 8.1 Gap 1: Multi-Destination Launch Target Selector
* **Current State**: `coiner.dev` only creates standalone SPL mints, requiring users to manually navigate to Pump.fun or Raydium to seed pools.
* **Required Expansion**:
  - Add `--target <spl|pump|raydium>` flag to `bin/coiner-cli.js create`.
  - Add destination selector card to `TokenForm.jsx` (Basics / Review step) supporting:
    1. `SPL Standard`: Pure SPL token creation in creator wallet.
    2. `Pump.fun Curve`: Direct bonding curve initialization with optional atomic initial dev buy.
    3. `Raydium CPMM`: Raydium V3 pool initialization with user-specified quote SOL amount.

### 8.2 Gap 2: Pump.fun Program Instruction & Atomic Dev Buy
* **Current State**: Genesis buy requires a separate transaction that sniper bots routinely front-run.
* **Required Expansion**:
  - Integrate Pump.fun program ID `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`.
  - Package `create` and `buy` instructions in a single atomic transaction:
    - Creator inputs `--initial-buy-sol <amount>` (e.g. `0.08`).
    - Transaction derives `bondingCurve` and `associatedBondingCurve` PDAs.
    - Executes mint creation and immediate buy in the exact same block.

### 8.3 Gap 3: Raydium V3 CPMM Pool Deployment & Atomic LP Burn
* **Current State**: Creators must visit `raydium.io/liquidity/create`, upload tokens, manually approve pool creation (0.2 SOL), and navigate to Sol Incinerator to burn LP.
* **Required Expansion**:
  - Implement `coiner-cli.js pool create` using `@raydium-io/raydium-sdk-v2` or native CPMM program instructions.
  - Implement `coiner-cli.js lp burn` utility executing an atomic SPL token burn on the LP token account to guarantee 100% locked liquidity.

### 8.4 Gap 4: Real-Time Dynamic Cost Estimation
* **Current State**: `coiner-cli.js estimate` only calculates SPL rent and platform fee.
* **Required Expansion**:
  - Update `estimateRentCosts()` to accept `target` parameter:
    - If `target === 'pump'`, estimate = `0.02 SOL` creation + `initialBuySol`.
    - If `target === 'raydium'`, estimate = `0.0168 SOL` mint + `0.20 SOL` pool fee + `quoteSol`.

---

## 9. Multi-Player Perception Engineering & "POV-Jacking" Specification

### 9.1 The Trench Battlefield: 4 Distinct Actor POVs
Tokens on Solana do not achieve breakout velocity through pure luck or serendipitous discovery. In the modern trenches, market motion is governed by four adversarial market participants, each operating under rigid heuristics, automated filters, and psychological biases:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                   THE 4-ACTOR TRENCH PERCEPTION MATRIX                           │
└──────────────────────────────────────────────────────────────────────────────────┘
   [ Actor 1: The Automated Sniper ]   ──►  Algorithmic latency race, Jito Block-0/1
   [ Actor 2: The Retail Degen ]       ──►  Photon/BullX Memescope filters, anti-rug
   [ Actor 3: The Trench Scanner Bot ] ──►  On-chain slot-bundle forensics (@trench_scanner_bot)
   [ Actor 4: The Post-Bonding Whale ] ──►  DexScreener "Dex Paid", KOTH, 15s dip-reversals
```

#### 1. The Automated Sniper / MEV Bot Operator (Bloom, Padre, Trojan, Maestro, Photon Quick Buy)
* **Operational Lens**: Latency, Block-0/Block-1 positioning, and mathematical risk-reward. Snipers run automated bots hooked to Solana Yellowstone Geyser / WebSocket feeds monitoring new curve initialization events.
* **Exact Triggers**: Detection of valid mint + curve creation transaction where mint and freeze authorities are revoked.
* **Auto-Abort / Blacklist Filters**:
  - *Dev Buy > 1.50–2.00 SOL*: Snipers immediately blacklist or abort because high dev holdings signal an imminent developer dump farm.
  - *Unrevoked Authorities*: Any presence of freeze or mint authority triggers instant abort.
  - *Delayed Dev Buy*: If the creator deploys and buys in separate blocks, snipers frontrun the dev buy, sandwiching the creator.
* **Execution Behavior**: They blast buy transactions with aggressive Jito validator tips (0.005 to 0.50+ SOL) and high priority fees to land in Block 0 or Block 1, expecting a fast 2x–5x on the opening green wick.

#### 2. The Layman Retail Degen / Trench Trader (Photon, BullX, Axiom Memescope)
* **Operational Lens**: High FOMO tempered by acute trauma from past rug pulls. Degens rely on mechanical UI filter presets to sift through 1,000+ hourly launches on Photon and BullX.
* **Concrete Filter Thresholds (Harvested from Frontline Field Intelligence)**:
  - *Audit Checks*: `Revoke Freeze = YES`, `Revoke Mint = YES`.
  - *Dev Holding*: Maximum 5%–10% (ideally < 3%). If dev holds 0% or sells immediately, they check threads for a legitimate CTO (Community Takeover).
  - *Top 10 Holders*: Maximum 15%–25% (Axiom max 40%). If top 10 hold >30%, degens scream "Cabal scam!" and skip.
  - *Holder Count*: Minimum 3 to 5 unique wallets.
  - *Bonding Progress / Market Cap*: Minimum 12% pump progress ($8k–$9k market cap) to ensure the token has baseline traction.
  - *Transaction Health*: Minimum 4 buys AND **crucially at least 2 sells**! (Degens explicitly filter for coins with organic sells because fake dev bundles feature only buys and zero sells).
  - *Global Fees Paid*: Minimum 0.30–0.50 SOL total fees paid on curve (verifying real network fee burn against market cap).
  - *Social Presence*: At least 1 valid social link (Twitter/X, Telegram, or clean website) embedded in metadata.

#### 3. The On-Chain Trench Detective & Safety Bots (`@trench_scanner_bot`, BubbleMaps, RugCheck)
* **Operational Lens**: Forensic on-chain clustering and slot-bundle detection.
* **Exact Detection Mechanism**:
  - Degens copy the contract address (CA) and paste it into `@trench_scanner_bot` on Telegram.
  - The bot scans the blockchain slot-by-slot. If 10–15 wallets purchased supply in the *exact same Solana slot* accumulating >35% of total supply, the bot fires an immediate red siren:
    `🚨 FAKE SLOT BUNDLE SCAM: 15 wallets bought 47.2% in slot 284910291`.
  - Even if BubbleMaps shows unlinked wallets (due to CEX withdrawal obfuscation), slot-level timestamp analysis exposes the insider bundle. When degens see this red alert, buying drops to zero.

#### 4. The Post-Bonding Whale & DexScreener Momentum Hunter
* **Operational Lens**: Capital preservation and trend continuation. Whales ignore sub-$20k noise, scanning only "About to Graduate" ($50k+ King of the Hill) or "Graduated / Raydium Migration" ($100k+).
* **Exact Triggers**:
  - *"Dex Paid" Verification*: Green badge confirming the $299 DexScreener fast-track promotion fee has been deposited. Whales consider un-paid tokens to be low-effort abandonment risks.
  - *Post-Migration Dip Buying*: Whales wait for early Pump.fun snipers to dump after Raydium migration, creating a 40%–60% pullback to round-number support ($100k, $125k), and enter aggressively on the first higher-low reversal candle on the 15s/30s chart.

---

### 9.2 The "POV-Jacking" Technical Architecture
"POV-Jacking" is the intentional alignment of `coiner.dev`'s contract output, metadata, and liquidity dispatch to satisfy every actor's algorithmic and psychological criteria:

#### Rule 1: Genesis Atomic Dev Buy (Block-0 Invariant)
* **Target Actor**: Sniper Bots.
* **Mechanism**: In `bin/coiner-cli.js create --target pump --initial-buy-sol 0.08`, token creation and the creator buy are packed into the identical atomic transaction (Block 0).
* **Strategic Outcome**: The creator obtains the absolute lowest mathematical cost basis on the bonding curve. When external snipers blast their Jito bundles in Block 0/Block 1, they execute *after* our dev buy, instantly pumping the market cap from $5k to $15k–$25k. We harness the snipers' liquidity rather than becoming their victims.

#### Rule 2: The Sniper-Bait Dev Allocation (<1.5% Supply)
* **Target Actor**: Sniper Bots & Retail Degens.
* **Mechanism**: Dev buy size is strictly capped at **0.08 – 0.15 SOL** (acquiring ~0.282% to 0.55% of genesis supply).
* **Strategic Outcome**: Snipers scanning the contract evaluate the dev buy as an ultra-clean "fair community launch" rather than a dev dump farm. They do not trigger auto-abort filters, committing their maximum buy size.

#### Rule 3: 100% Memescope Filter Pass Guarantee
* **Target Actor**: Retail Degens (Photon, BullX, Axiom).
* **Mechanism**:
  - `Revoke Freeze`, `Revoke Mint`, and `Immutable Metadata` are enforced unconditionally.
  - Metaplex metadata generator validates that Twitter/X, Telegram, and Website links are populated with live, active endpoints.
  - Top 10 holder distribution is preserved below 15% (excluding the virtual bonding curve reserve).
  - Token immediately displays clean metrics, passing all 7 standard Memescope filters and surfacing on thousands of active degen monitors.

#### Rule 4: Clean Slot Architecture (Zero Trench-Scanner Red Flags)
* **Target Actor**: `@trench_scanner_bot` and On-Chain Investigators.
* **Mechanism**: Zero multi-wallet slot bundling. The creator does not coordinate 10–15 artificial wallets in Block 0.
* **Strategic Outcome**: When traders run `/scan <CA>` in `@trench_scanner_bot`, the bot reports:
  `✅ Bundle Analysis: 0.0% Bundled Supply | 1 Developer Wallet (<1.0%) | 100% Clean Genesis`.
  This clean bill of health converts cautious trench investigators into aggressive buyers.

#### Rule 5: Timed "Dex Paid" Fast-Track Badge Activation
* **Target Actor**: Post-Bonding Whales & DexScreener Hunters.
* **Mechanism**: As curve progress approaches 55%–65% ($50k–$60k King of the Hill), the creator deposits the $299 (~1.5 SOL) DexScreener fast-track payment utilizing accumulated take-profit gains.
* **Strategic Outcome**: The green "Dex Paid" badge lights up across DexScreener, Photon, and BullX prior to Raydium graduation. When pump.fun snipers dump at graduation, high-capital dip buyers immediately ape the pullback, launching the secondary leg from $100k to $500k+.

---

## 10. Automated Take-Profit & Exiting Engine Specification (`coiner-cli watch` / `--auto-exit`)

### 10.1 Mechanical & Program Invariants
Manual selling across web wallet popups introduces 5–15 seconds of human latency, during which sniper frontrunners dump and price advantages vanish. The automated exit engine interacts directly with the on-chain Pump.fun bonding curve via low-latency RPC/WebSocket feeds.

* **Target Program ID**: `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` (Pump.fun Mainnet)
* **Fee Recipient**: `CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM`
* **Bonding Curve PDA**: `PublicKey.findProgramAddressSync([Buffer.from('bonding-curve'), mint.toBuffer()], PUMP_PROGRAM_ID)`
* **Bonding Curve Associated Token Account (ATA)**: `getAssociatedTokenAddressSync(mint, bondingCurvePda, true)`
* **Event Authority PDA**: `PublicKey.findProgramAddressSync([Buffer.from('__event_authority')], PUMP_PROGRAM_ID)`
* **Global Account PDA**: `PublicKey.findProgramAddressSync([Buffer.from('global')], PUMP_PROGRAM_ID)`

#### Bonding Curve Account Data Schema (49 bytes)
```
[0..8]   Discriminator: 0x17b7f83760d8ac60 (sha256("account:BondingCurve")[0..8])
[8..16]  virtualTokenReserves: u64 LE
[16..24] virtualSolReserves: u64 LE
[24..32] realTokenReserves: u64 LE
[32..40] realSolReserves: u64 LE
[40..48] tokenTotalSupply: u64 LE
[48]     complete: u8 / bool (1 = bonded, ready for Raydium migration)
```

#### Spot Price & Curve Progress Formulation
$$\text{Spot Price (SOL/token)} = \frac{\text{virtualSolReserves}}{\text{virtualTokenReserves}}$$
$$\text{Multiplier} = \frac{\text{Spot Price}(t)}{\text{Spot Price}(t_0)}$$

### 10.2 Tranche Exit Triggers & Risk Guards
The engine enforces four automated triggers evaluated on every block confirmation or account change:

| Trigger | Condition | Action | Rationale |
|---|---|---|---|
| **TP1 (Capital Recovery)** | `multiplier >= 2.0x` (or `--tp1 <float>`) | Sell **50%** of user's initial tokens | Recovers 100% of initial SOL spend into early bids ($0.50 \times 2.0 = 1.00$). Zero principal risk remains. |
| **TP2 (Profit Lock)** | `multiplier >= 3.5x` (or `--tp2 <float>`) | Sell **25%** of user's initial tokens | Locks in pure profit (+0.15 to +0.25 SOL). |
| **TP3 (Moonbag / Migration)** | `complete === true` or curve >= 95% | Hold/sell remaining **25%** | Harvests the top of the curve prior to Raydium LP migration dump. |
| **Stop-Loss (SL)** | `multiplier <= 0.70x` (or `--sl <float>`) | Sell **100%** of remaining tokens | Cuts loss early if curve fails to maintain momentum. |
| **Timeout Stop-Loss** | `elapsed >= 25m` and `multiplier < 1.5x` | Sell **100%** of remaining tokens | Reclaims ~70% of initial capital to reallocate into the next viral trend. |

### 10.3 Sell Instruction Byte Assembly
* **Instruction Discriminator**: `33 e6 85 a4 01 7f 83 ad` (`sha256("global:sell")[0..8]`)
* **Payload Serialization**:
  ```
  [0..8]   Discriminator (8 bytes)
  [8..16]  amount: u64 LE (base token units to sell)
  [16..24] min_sol_output: u64 LE (minimum acceptable lamports with slippage protection)
  ```
* **Required Account Metas (14 accounts - Modern Pump IDL)**:
  1. `global` (read-only PDA)
  2. `fee_recipient` (writable)
  3. `mint` (read-only)
  4. `bonding_curve` (writable PDA)
  5. `associated_bonding_curve` (writable ATA)
  6. `associated_user` (writable ATA)
  7. `user` (writable, signer, fee payer)
  8. `system_program` (`11111111111111111111111111111111`)
  9. `creator_vault` (writable PDA `['creator-vault', creator]`)
  10. `token_program` (`TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`)
  11. `event_authority` (read-only PDA)
  12. `program` (`6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`)
  13. `fee_config` (read-only PDA `['fee_config', pump_program]` on fee program)
  14. `fee_program` (`pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ`)

---

## 11. Sovereign Social Media Strategy & Universal Master Portal Specification

### 11.1 Source Narrative Linking (Zero-Burner X Policy)
* **Problem**: Registering fresh Twitter/X burner accounts for every launch triggers immediate phone/SMS verification gates, IP rate limits, and shadowbans within 15 minutes when posting contract addresses.
* **Trench Invariant**: Link token metadata directly to the **original viral X post / author profile** (e.g. `https://x.com/elonmusk/status/...`).
* **Tactical Benefits**:
  1. *Instant Proof of Narrative*: Degens clicking the Twitter icon immediately see the real, trending context, eliminating doubts about token authenticity.
  2. *Filter Clearance*: Photon, BullX, and Axiom scrapers verify HTTP 200 on `x.com` links and award the "Social Verified" badge automatically.

### 11.2 Universal Master Telegram Portal (Cumulative Community)
* **Problem**: Spawning 10–20 disposable Telegram groups produces dead, unmoderated chat rooms that scream "abandoned rug" to incoming traders.
* **Architecture**: Establish a single, persistent **Master Telegram Supergroup** with native **Topics/Forums** enabled:
  - *URL*: One immutable portal link placed across all token launches (e.g. `https://t.me/coiner_portal`).
  - *Structure*: General channel for alpha announcements + dedicated Topics for each active coin (`#PNUT`, `#DOGE`).
  - *Compounding Effect*: Every token launch routes new degens into the same permanent community, building a cumulative following of raid-ready holders for future coins.

### 11.3 Visual Asset & Ticker Governance
* **Asset Ingestion**: Ingest the highest-resolution crop of the viral meme image directly from the trending post. Never distort, water-mark, or over-edit; recognizable memes maximize instant degen click-throughs.
* **Ticker Protocol**: Select the most direct, 3–6 character single-noun identifier (e.g. `$PNUT` > `$PEANUT_SOL`).

---

## 12. Implementation Progress Tracker & Quality Gates

| Gate ID | Subsystem / Feature | Target Milestone | Acceptance Criteria | Status |
|---|---|---|---|---|
| **GATE-PRD** | PRD Specifications | Complete Architecture | Sections 1–16 fully codified with mathematical, cognitive, and protocol schemas | `✅ Completed` |
| **GATE-PUMP-DATA** | Curve PDA & Account Parser | `src/lib/pump.js` | 49/81-byte layout parsed; `creator` extracted; spot price and progress derived | `✅ Completed` |
| **GATE-SELL-IX** | Pump Sell Instruction Builder | `src/lib/pump.js` | Modern 14-account official layout matching Pump IDL verified | `✅ Completed` |
| **GATE-CLI-WATCH** | CLI Watcher & Auto-Exit | `bin/coiner-cli.js watch` | Sequential polling loop, TP1/TP2/SL/Timeout triggers, dry-run simulation verified | `✅ Completed` |
| **GATE-CREATE-EXIT** | Unified Launch & Exit Flag | `coiner-cli create` | Fail-closed guards for unverified Pump targets; strict numeric bounds enforced | `✅ Completed` |
| **GATE-SCOUT** | Trend Scanner & Asset Harvester | `bin/coiner-cli.js scout` | Ingests DexScreener & Pump.fun feeds, extracts images, tickers, and viral social links | `✅ In Progress` |
| **GATE-AI-BRIDGE** | AI Bridge Cognitive Engine | `src/lib/ai-bridge.js` | Connects to `ai-bridge-codev` cascade; distills narrative, lore, virality, and ticker variations | `✅ In Progress` |
| **GATE-WALLET-CHECK** | Non-Custodial Keypair Validator | `coiner-cli wallet` | Inspects keypair public key against `2di...maV`, checks live SOL balance, zero-leakage | `✅ In Progress` |
| **GATE-SOL-REVIEW** | Engineer Sol Adversarial Review | Herdr `sol-coiner-exit` & `sol-coiner-ui` | All architecture, cognitive, wallet, and UI invariants audited by Engineer Sol; 14 findings remediated and verified | `✅ Completed` |
| **GATE-UI-REDESIGN** | Obsidian, White & Gold UI Redesign | `src/` & `DESIGN.md` | Pure obsidian, white & gold aesthetic, unified sans typography, zero green/cyan, all 14 audit findings remediated, acceptance test 12/12 gates PASS | `✅ Completed` |
| **GATE-BUILD-QUAL** | Production Build & Verification | Repository-wide | `pnpm run build` passes 100% clean; zero regressions | `✅ Completed` |

---

## 13. Autonomous Intelligence, Trend Scanner (`coiner-cli scout`), and AI Bridge Integration

### 13.1 Market Scanner Endpoints & Data Harvesting Architecture
The autonomous trend scanner (`coiner-cli scout`) identifies explosive viral meme narratives on Solana before manual creators can react. It polls high-velocity decentralized market feeds:

* **DexScreener Latest Token Profiles API**: `https://api.dexscreener.com/token-profiles/latest/v1`
  - Fetches newly active token profiles submitted with logos, headers, and social links.
  - Filters: `chainId === 'solana'`, profile completeness score.
* **DexScreener Top Boosts API**: `https://api.dexscreener.com/token-boosts/top/v1`
  - Fetches top community-promoted tokens experiencing real-time organic engagement.
* **Pump.fun King of the Hill / Coins Feed**: `https://frontend-api-v3.pump.fun/coins?sort=market_cap&order=DESC&limit=10`
  - Inspects top bonding curves nearing graduation to emulate high-converting themes.

#### Data Ingestion & Image Emulation Meta
* **Community Narrative Invariant**: In Solana degen culture, cloning and emulating trending memes is standard, accepted practice. Derivative coins (e.g. `$PNUT`, `$ACT`, `$GOAT`, `$MOODENG`, `$NEIRO`) frequently outperform originators when launched with faster execution and better liquidity.
* **Asset Ingestion Pipeline**:
  1. Extract high-resolution image URL (`icon`, `header`).
  2. Ingest viral social links (`twitter`, `telegram`, `website`).
  3. Validate image buffer integrity (ensure valid PNG/JPEG/WebP magic bytes; size <= 5MB).
  4. Pass raw narrative text to the AI Bridge for cognitive refinement.

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
If the AI bridge daemon is offline, experiencing network timeout, or unreachable, the CLI does **not crash or abort**. It automatically fails over to deterministic narrative templates (combining trending keywords, viral tickers, and default degen lore) so that token creation proceeds seamlessly without interruption.

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

## 15. End-to-End Autonomous Pipeline (`coiner-cli scout --auto-launch --auto-exit`)

The autonomous pipeline executes across 5 distinct phases:

1. **Scout & Filter**: `coiner-cli scout` polls live trends and selects the highest momentum candidate meeting volume/boost thresholds.
2. **AI Bridge Synthesis**: Ingests narrative context into `ai-bridge-codev` to synthesize optimized token name, ticker, and viral lore.
3. **Asset Staging**: Downloads trending meme graphics, validates format, formats Metaplex metadata, and computes a short content-hash-bound HTTP(S) metadata URI (66 bytes, <= 200 bytes).
4. **Autonomous Mint**: Executes `coiner-cli create` (simulated in `--dry-run`; on-chain broadcast requires explicit keypair and network confirmation).
5. **Autonomous Exit Watcher**: Transitions to `coiner-cli watch` monitoring curve dynamics and executing TP1 (2.0x, 50% sell), TP2 (3.5x, 25% sell), and Stop-Loss (0.70x, 100% sell).

---

## 16. Security Invariants, Adversarial Hardening & Quality Gate Specifications

### 16.1 Threat Model & Isolation Boundaries
1. **Third-Party Market Data Ingestion**:
   - Symbols and remote strings are strictly sanitized before reaching the filesystem. File paths are restricted to safe alphanumeric characters `[a-z0-9_-]` with explicit path containment assertion against the staging root directory and `lstatSync` reparse/symlink rejection (S01).
   - External image downloads are subject to a strict public-origin policy: rejecting RFC 1918 private IPv4, loopback `127.0.0.0/8`, link-local `169.254.0.0/16`, CGNAT `100.64.0.0/10`, IPv6 unique-local/link-local/IPv4-mapped, URL userinfo credentials, and HTTP redirects disabled via `redirect: 'error'` to prevent SSRF bypass (S02, S03).
   - Image downloads stream chunk-by-chunk with a strict 5 MB cap and full-body deadline cancellation (S02).
   - Upstream market data queries enforce bounded JSON streaming (max 2 MB) and restrict pair membership strictly to the queried 30-address batch (S08).
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
   - Metadata URIs are strictly formatted as valid HTTP/HTTPS URLs bounded to <= 200 UTF-8 bytes to fit Solana transaction MTU and Metaplex on-chain struct constraints (S04).





