# coiner.dev — Codebase Architecture & Technical Reference

**Updated:** 2026-11-16 (Asia/Jakarta)  
**Domain:** `https://coiner.dev`  
**Hosting:** Cloudflare Pages (`coiner-dev`, project `db1e067e-925c-402e-96de-d0f3c2ef467b`)  
**Repository:** `cfpages-lusmodigital/coiner.dev`  
**Harness / Author:** Antigravity (Gemini 4 Hydrogen) & Engineer Sol (GPT-6.1 Sol in mcodex)

---

## 1. Architecture Overview

`coiner.dev` is a sovereign, non-custodial Solana SPL and meme coin creator designed to eliminate predatory third-party platform markups. It implements an atomic client-side Solana transaction engine coupled with a stateless Cloudflare Pages Functions IPFS metadata proxy and a Clerk-powered Dual-Tier Fee Model.

### Key Architectural Invariants
1. **100% Non-Custodial:** User private keys are never requested, handled, or stored. The transaction fee payer, account-rent payer, supply recipient, and initial mint authority are strictly the user's connected wallet (Phantom, Solflare, etc.).
2. **Atomic Settlement:** The token creation instructions (compute budget, mint account creation, ATA creation, supply minting, Metaplex metadata registration, authority revocation, and optional platform fee transfer) are packed into a single atomic Solana transaction. If any instruction fails, the entire transaction reverts on-chain.
3. **Stateless IPFS Proxy:** Third-party pinning credentials (`PINATA_API_KEY`, `PINATA_SECRET_API_KEY`, `PINATA_JWT`) are kept strictly within Cloudflare Pages Functions serverless environment (`context.env`). They are never baked into public client JavaScript bundles.
4. **Dual-Tier Fee Model:**
   - **Public Users:** Pay a flat **0.10 SOL** platform service fee (transferred on-chain directly to `TREASURY_WALLET`).
   - **Administrator:** Automatically receives a **0.00 SOL** platform fee exemption (gas-only deployment) when authenticated as `admin@alampintar.org` via Clerk or when connecting an authorized admin Solana wallet (`ADMIN_WALLET_ADDRESS`).

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
│   │   ├── TokenForm.jsx        # Token configuration form, priority selector, live cost breakdown
│   │   └── ui/                  # Radix UI + Tailwind component library
│   ├── lib/
│   │   ├── clerk.jsx            # Unified Clerk authentication & admin exemption layer
│   │   ├── solana.js            # Client-side atomic transaction builder & BigInt arithmetic
│   │   └── utils.js             # Utility functions (cn class merging)
│   ├── App.jsx                  # Top-level App component, ClerkAuthProvider & Wallet Providers
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

### 3.1 `src/lib/clerk.jsx`
- **`ClerkAuthProvider`**: Wraps the tree with `<ClerkProvider>` when `VITE_CLERK_PUBLISHABLE_KEY` is present, or seamlessly falls back to `<UnifiedAuthContext.Provider>` without throwing missing-provider errors.
- **`useAdminStatus()`**: Returns `{ isAdmin, platformFeeSol, adminRoleReason, feeLabel, isLoaded, isSignedIn, email }`.
  - `isAdmin = (isEmailAdmin || isWalletAdmin)`.
  - `isEmailAdmin = isSignedIn && (email === 'admin@alampintar.org' || role === 'admin')`.
  - `isWalletAdmin = connectedAddress === VITE_ADMIN_WALLET_ADDRESS`.
- **`AdminAuthWidget`**: Header component showing `<SignInButton>` when signed out, `<UserButton>` when signed in, and a `👑 Admin Mode (0 SOL Fee)` badge when admin status is verified.

### 3.2 `src/lib/solana.js`
- **`calculateRawAmount(supplyStr, decimals)`**: Converts human-readable token supply strings (e.g., `"1,000,000,000"`) into raw BigInt lamport amounts with exact zero-padding. Enforces `u64::MAX` boundary checks.
- **`estimateRentCosts(connection, platformFeeSol, isMainnet)`**: Pre-computes exact on-chain rent-exemption lamports from the RPC:
  - SPL Mint Account: 82 bytes (~0.00107 SOL)
  - Creator ATA: 165 bytes (~0.00149 SOL)
  - Metaplex Metadata PDA: ~679 bytes (~0.00410 SOL)
  - Metaplex Protocol Creation Fee: 0.01000 SOL (on Mainnet)
  - Network Gas Buffer: ~0.00010 SOL
  - Platform Service Fee: 0.10000 SOL (Public) vs 0.00000 SOL (Admin)
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
| `VITE_TREASURY_WALLET` | Public Client (Build-time) | Solana treasury address receiving public 0.10 SOL fees |
| `VITE_ADMIN_WALLET_ADDRESS` | Public Client (Build-time) | Solana wallet address receiving 0.00 SOL admin exemption |
| `VITE_CLERK_PUBLISHABLE_KEY` | Public Client (Build-time) | Clerk publishable key for user authentication |
| `VITE_SOLANA_RPC_MAINNET` | Public Client (Build-time) | Dedicated Solana Mainnet RPC endpoint |
| `VITE_SOLANA_RPC_DEVNET` | Public Client (Build-time) | Dedicated Solana Devnet RPC endpoint |
| `PINATA_API_KEY` / `VITE_PINATA_API_KEY` | Pages Functions (Runtime) | Pinata IPFS API Key |
| `PINATA_SECRET_API_KEY` / `VITE_PINATA_SECRET_API_KEY` | Pages Functions (Runtime) | Pinata IPFS Secret Key |
| `PINATA_JWT` | Pages Functions (Runtime) | Pinata Bearer JWT Token |
