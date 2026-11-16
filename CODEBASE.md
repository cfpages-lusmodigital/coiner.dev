# coiner.dev — Codebase Architecture & Technical Reference

**Updated:** 2026-11-16 (Asia/Jakarta)  
**Domain:** `https://coiner.dev`  
**Hosting:** Cloudflare Pages (`coiner-dev`, project `db1e067e-925c-402e-96de-d0f3c2ef467b`)  
**Repository:** `cfpages-lusmodigital/coiner.dev`  
**Harness / Author:** Antigravity (Gemini 4 Hydrogen) & Engineer Sol (GPT-6.1 Sol in mcodex)

---

## 1. Architecture Overview

`coiner.dev` is a sovereign, non-custodial Solana SPL and meme coin creator designed to eliminate predatory third-party platform markups. It implements an atomic client-side Solana transaction engine coupled with a stateless Cloudflare Pages Functions IPFS metadata proxy and a Native Solana Wallet Allowlist Dual-Tier Fee Model.

### Key Architectural Invariants
1. **100% Non-Custodial:** User private keys are never requested, handled, or stored. The transaction fee payer, account-rent payer, supply recipient, and initial mint authority are strictly the user's connected wallet (Phantom, Solflare, etc.).
2. **Atomic Settlement:** The token creation instructions (compute budget, mint account creation, ATA creation, supply minting, Metaplex metadata registration, authority revocation, and optional platform fee transfer) are packed into a single atomic Solana transaction. If any instruction fails, the entire transaction reverts on-chain.
3. **Stateless IPFS Proxy:** Third-party pinning credentials (`PINATA_API_KEY`, `PINATA_SECRET_API_KEY`, `PINATA_JWT`) are kept strictly within Cloudflare Pages Functions serverless environment (`context.env`). They are never baked into public client JavaScript bundles.
4. **Dual-Tier Fee & Bundling Model:**
   - **Public Users:** Pay a flat **0.15 SOL** platform service fee with all 3 security revocations (Freeze, Mint, Update) and IPFS metadata pinning bundled 100% free with zero upsell. Customization to retain any authority (non-standard unbundled configuration) incurs a **+0.05 SOL** surcharge per kept authority. Fees transfer atomically on-chain directly to `TREASURY_WALLET` (`2di9sSnh1BYixnNw7Hw47XbMet9J5HFdF8NUMN2LZmaV`).
   - **Administrator:** Automatically receives a **0.00 SOL** platform fee exemption (gas-only deployment ~0.0168 SOL) when connecting an authorized admin Solana wallet (`2di9sSnh1BYixnNw7Hw47XbMet9J5HFdF8NUMN2LZmaV` or addresses configured in `VITE_ADMIN_WALLETS`). Zero third-party auth vendors (no Clerk, no email sign-in).

---

## 2. Directory Structure

```
coiner.dev/
├── functions/
│   └── api/
│       └── upload-metadata.js   # Stateless Cloudflare Pages Function (IPFS pinning proxy)
├── src/
│   ├── components/
│   │   ├── CreatorPage.jsx      # Top-level creator orchestrator & hero section
│   │   ├── FAQ.jsx              # Frequently asked questions & fee model disclosures
│   │   ├── LaunchModal.jsx      # Multi-step progress modal, explorer & DEX links
│   │   ├── LivePreview.jsx      # Real-time DEX / Explorer preview & fee comparison
│   │   ├── StepGuide.jsx        # 5-step interactive deployment guide
│   │   ├── TokenForm.jsx        # Token configuration form, priority selector, clean cost summary card
│   │   └── ui/                  # Radix UI + Tailwind component library
│   ├── lib/
│   │   ├── admin.jsx            # Native Solana wallet allowlist admin recognition & fee logic
│   │   ├── solana.js            # Client-side atomic transaction builder & BigInt arithmetic
│   │   └── utils.js             # Utility functions (cn class merging)
│   ├── App.jsx                  # Top-level App component, AdminStatusBadge & Wallet Providers
│   └── main.jsx                 # Application entrypoint with Buffer polyfill
├── public/                      # Static assets & favicon
├── dist/                        # Production build output
├── .env.example                 # Environment variables reference template
├── AGENTS.md                    # Repository operational guidelines (pnpm invariant)
├── AUDIT.md                     # Deep architectural audit report
├── CODEBASE.md                  # This file
└── vite.config.js               # Vite 6 configuration with optimized rollup chunks
```

---

## 3. Core Modules & Methods

### Brand assets and navbar (Codex, 2026-11-16)
- `public/favicon.svg`: scalable 64x64 coin mark; obsidian face, emerald concentric bevel, `</>` developer glyph, cyan slash and angled mint highlight. Referenced by `index.html` and the navbar so the small mark has one source.
- `public/logo.svg`: standalone 352x72 horizontal dark-mode logo, same coin geometry plus coiner.dev wordmark and product descriptor; transparent outer canvas, system font fallback for SVG text.
- `src/components/CoinerLogo.jsx`: `CoinerLogo()` takes no arguments and renders the fixed-size decorative image (`alt=""`) beside readable brand text; no state, effects, animation, external calls or new dependencies.
- `src/App.jsx`: imports `CoinerLogo`, removes the navbar Rocket icon, and permits header wrapping so narrow screens retain wallet actions. Existing wallet/auth providers and public/admin pricing remain unchanged.
- Verification: production `pnpm run build`, DESIGN validator, SVG XML parsing and byte equality of built assets; browser checks recorded in the linked OneDrive report. OCR attempted but provider authentication returned HTTP 403 before model review; no passing independent review or deployment is claimed.
- Pricing recommendations and evidence: `C:/Users/THINKPAD/OneDrive/MD/REPORT/REPORT-COINER-DEV-BRAND-AND-PRICING-2026-11-16.md`. Proposed 0.05 SOL is not implemented.

### 3.1 `src/lib/admin.jsx`
- **`DEFAULT_ADMIN_WALLET`**: Canonical fallback admin address (`2di9sSnh1BYixnNw7Hw47XbMet9J5HFdF8NUMN2LZmaV`).
- **`ADMIN_WALLETS`**: Allowlist array aggregating `VITE_ADMIN_WALLET_ADDRESS`, comma-separated `VITE_ADMIN_WALLETS`, and `DEFAULT_ADMIN_WALLET` with lowercase deduplication.
- **`calculatePlatformFee({ isAdmin, revokeFreeze, revokeMint, immutable })`**: Deterministically returns `0.00 SOL` for recognized admin wallets, or `0.15 SOL` flat base for public users (+`0.05 SOL` per retained/non-revoked authority).
- **`useAdminStatus()`**: Returns `{ isAdmin, platformFeeSol, adminRoleReason, feeLabel, address }` dynamically evaluated from `@solana/wallet-adapter-react`'s `useWallet().publicKey`. Zero external authentication network requests.
- **`AdminStatusBadge`**: Subtle header pill displaying `👑 Admin • 0 SOL Fee` when an allowlisted admin wallet is connected. Hidden for normal public users.

### 3.2 `src/lib/solana.js`
- **`calculateRawAmount(supplyStr, decimals)`**: Converts human-readable token supply strings (e.g., `"1,000,000,000"`) into raw BigInt lamport amounts with exact zero-padding. Enforces `u64::MAX` boundary checks.
- **`estimateRentCosts(connection, platformFeeSol, isMainnet, priorityFeeMicroLamports)`**: Pre-computes exact on-chain rent-exemption lamports from the RPC:
  - SPL Mint Account: 82 bytes (~0.00107 SOL)
  - Creator ATA: 165 bytes (~0.00149 SOL)
  - Metaplex Metadata PDA: ~679 bytes (~0.00410 SOL)
  - Metaplex Protocol Creation Fee: 0.01000 SOL (on Mainnet)
  - Dynamic Network Gas & Compute Priority: calculated dynamically based on speed (Normal: ~0.00002 SOL, Fast: ~0.00007 SOL, Turbo: ~0.00026 SOL)
  - Platform Service Fee: 0.15000 SOL bundled flat fee (+0.05 SOL per kept authority if customized) vs 0.00000 SOL (Admin)
- **`createSolanaToken({ connection, wallet, tokenConfig, onProgress })`**: Builds and broadcasts the atomic transaction:
  1. `ComputeBudgetProgram.setComputeUnitPrice` & `setComputeUnitLimit(250,000)`
  2. `SystemProgram.transfer` to `treasuryAddress` (only if `platformFeeSol > 0`). Fails closed if treasury is unconfigured.
  3. `SystemProgram.createAccount` for Mint
  4. `createInitializeMintInstruction`
  5. `createAssociatedTokenAccountIdempotentInstruction`
  6. `createMintToInstruction`
  7. Metaplex Metadata V3 Instruction via `@metaplex-foundation/mpl-token-metadata`
  8. `createSetAuthorityInstruction` (FreezeAccount -> null)
  9. `createSetAuthorityInstruction` (MintTokens -> null)
  10. Partial signs with ephemeral `mintKeypair` and broadcasts via `wallet.sendTransaction`.

### 3.3 `functions/api/upload-metadata.js`
- Handles `multipart/form-data` uploads on Cloudflare Pages.
- Validates file MIME types (`png`, `jpeg`, `webp`, `gif`, `svg`) and 5MB payload limit.
- Uploads image and Metaplex standard JSON metadata to Pinata IPFS using `PINATA_JWT` or `PINATA_API_KEY` + `PINATA_SECRET_API_KEY`.
- Returns `{ success: true, imageUri, metadataUri }`.

---

## 4. Environment Variables

| Variable | Scope | Purpose |
|---|---|---|
| `VITE_TREASURY_WALLET` | Public Client (Build-time) | Solana treasury address receiving public 0.15 SOL fees (`2di9sSnh1BYixnNw7Hw47XbMet9J5HFdF8NUMN2LZmaV`) |
| `VITE_ADMIN_WALLET_ADDRESS` | Public Client (Build-time) | Primary admin Solana wallet address (`2di9sSnh1BYixnNw7Hw47XbMet9J5HFdF8NUMN2LZmaV`) |
| `VITE_ADMIN_WALLETS` | Public Client (Build-time) | Optional comma-separated list of additional admin Solana wallet addresses |
| `VITE_SOLANA_RPC_MAINNET` | Public Client (Build-time) | Dedicated Solana Mainnet RPC endpoint |
| `VITE_SOLANA_RPC_DEVNET` | Public Client (Build-time) | Dedicated Solana Devnet RPC endpoint |
| `PINATA_API_KEY` / `VITE_PINATA_API_KEY` | Pages Functions (Runtime) | Pinata IPFS API Key |
| `PINATA_SECRET_API_KEY` / `VITE_PINATA_SECRET_API_KEY` | Pages Functions (Runtime) | Pinata IPFS Secret Key |
| `PINATA_JWT` | Pages Functions (Runtime) | Pinata Bearer JWT Token |
