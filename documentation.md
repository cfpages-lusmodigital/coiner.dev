# coiner.dev — Sovereign Solana Token & Meme Coin Creator

A sovereign, trustless, client-side web utility for deploying Solana SPL tokens and meme coins at **raw network rent cost (~0.0067 to 0.015 SOL)** with **0.00 SOL platform fees** (saving 97%+ compared to predatory 0.20–0.50+ SOL third-party tools).

---

## 1. Architectural Overview

```
                      +---------------------------------------+
                      |           Connected User Wallet        |
                      |          (Phantom, Solflare, etc.)    |
                      +-------------------+-------------------+
                                          |
                      1. Uploads Image    | 3. Signs & broadcasts atomic tx
                         & Metadata       |    (User pays ~0.007 SOL rent)
                                          |
                                          v
+-----------------------------+     +-----------------------------------+
|   Cloudflare Pages Function |     |          Solana Blockchain        |
|  /api/upload-metadata.js    |     |                                   |
|  (Stateless IPFS Proxy)     |     |  1. ComputeBudget (Priority Fee)  |
|                             |     |  2. SystemProgram: Create Account |
|  - Validates MIME & size    |     |  3. SPL: InitializeMint           |
|  - Pins logo & JSON to IPFS |     |  4. SPL: Create ATA (Idempotent)  |
|  - Zero private keys/wallets|     |  5. SPL: MintTo (100% to ATA)     |
|  - Returns metadataUri      |     |  6. Metaplex: CreateMetadata V3   |
+-----------------------------+     |  7. SPL: Revoke FreezeAuthority   |
                                    |  8. SPL: Revoke MintAuthority     |
                                    +-----------------------------------+
```

### Key Pillars
- **Non-Custodial & Sovereign**: The server never holds a private key, never mints tokens, and never pays fees.
- **Single Atomic Transaction**: Mint creation, supply minting, Metaplex metadata attachment, freeze revocation, and mint revocation execute atomically in **one single transaction** (< 870 bytes wire size).
- **Raydium & RugCheck Ready**: Revoking Freeze Authority ensures full compatibility with Raydium CPMM / DLMM liquidity pools and delivers an A-Grade rating on RugCheck.xyz.

---

## 2. On-Chain Cost Breakdown

| Component | Account Size | Network Cost (Rent Exemption) |
|---|---|---|
| **SPL Mint Account** | 82 bytes | ~0.0010668 SOL |
| **Creator Associated Token Account (ATA)** | 165 bytes | ~0.00148844 SOL |
| **Metaplex Metadata PDA** | ~679 bytes | ~0.00409956 SOL |
| **Network Gas & Priority Fee** | — | ~0.00010000 SOL |
| **coiner.dev Platform Fee** | — | **0.00000000 SOL (FREE)** |
| **Total Estimated Cost** | — | **~0.00676 SOL** |

*Compare against Smithii / Orion / pump launchpads charging 0.20 to 0.70+ SOL.*

---

## 3. Local Development

### Prerequisites
- Node.js >= 20
- pnpm >= 10

### Quick Start
```bash
# Install dependencies
pnpm install

# Start local development server
pnpm run dev
```

The app will run at `http://localhost:5173`. When testing locally without Pinata credentials, `functions/api/upload-metadata.js` automatically produces deterministic mock IPFS URIs so token minting on Solana Devnet is never blocked.

---

## 4. Cloudflare Pages Deployment

This project is connected directly to Cloudflare Pages:
- **Project Name**: `coiner-app`
- **Subdomain**: `https://coiner-app-bze.pages.dev`
- **Source**: `cfpages-lusmodigital/coiner.dev` (Branch `main`)
- **Build Command**: `pnpm run build`
- **Build Output Directory**: `dist`
- **Functions Directory**: `functions/` (auto-detected by Cloudflare Pages)

### Optional Environment Variables (Cloudflare Pages Dashboard)
Under **Workers & Pages** -> **coiner-app** -> **Settings** -> **Environment variables**:
- `PINATA_JWT`: Secret Pinata Bearer JWT token for production IPFS pinning.
- `VITE_SOLANA_RPC_HOST`: Dedicated Helius RPC URL (e.g. `https://mainnet.helius-rpc.com/?api-key=...`).
