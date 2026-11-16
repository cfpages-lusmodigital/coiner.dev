# Product Requirements Document (PRD): coiner.dev — Sovereign Solana Token Creator

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
- `⏳ Planned` **Atomic Liquidity Burn Utility:** 1-click instruction to transfer newly minted LP tokens to the Solana dead address (`11111111111111111111111111111111`), immediately producing a verifiable "100% LP Burned" RugCheck audit badge.
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
