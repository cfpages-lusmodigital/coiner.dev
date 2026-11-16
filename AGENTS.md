# AGENTS.md

## Package Manager

Use pnpm exclusively for this project. Run pnpm install, pnpm run <script>, and pnpm exec <tool>. Keep pnpm-lock.yaml committed, do not create alternate lockfiles, and avoid deleting node_modules unless replacing it with a fresh pnpm install.

## Public-Facing Product Voice vs. Internal Owner Invariant (Durable Rule)

1. **Target Audience Alignment**:
   - The primary users of `coiner.dev` are crypto degens, meme coin creators, and community founders.
   - Speak their language: fast, punchy, confident, and frictionless. Emulate top crypto tools (Pump.fun, DexLab, SlerfTools, Smithii) and be slightly better.
   - Do NOT overwhelm users with developer-level jargon, raw byte rents, lamport calculations, or infrastructure explanations.

2. **Pricing Presentation Invariant**:
   - Users only need to know what it costs **them**: **0.15 SOL Flat Fee** (All-Inclusive).
   - All 3 security revocations (Revoke Freeze, Revoke Mint, Immutable Metadata) and IPFS metadata pinning are included free with zero upsell.
   - Customization (retaining any authority) is simple: `+0.05 SOL per kept authority`.
   - NEVER expose internal infrastructure costs, account rent byte sizes (e.g. 82-byte mint, 165-byte ATA, 679-byte PDA), or our profit margins in public-facing UI.

3. **Strict Owner / Admin Boundary**:
   - Never talk to the public the way you talk to the platform owner (Syamsul Alam).
   - Never expose internal admin wallet allowlists, Admin Mode perk details, treasury wallet addresses, or backend architecture in public copy, hero banners, or public FAQs.
   - Admin recognition is 100% native Solana wallet address based (`2di9sSnh1BYixnNw7Hw47XbMet9J5HFdF8NUMN2LZmaV`); no third-party auth (no Clerk, no passwords, no email sign-in).
   - When the owner's authorized wallet connects, show a subtle admin badge (`👑 Admin • 0 SOL Fee`) in the header and zero out the platform fee dynamically on the button, while keeping public marketing copy 100% customer-facing.
