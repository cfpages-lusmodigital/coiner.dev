# coiner.dev — Project Learned Taste & Copy Guidelines

## 1. Audience Persona & Tone
- **Audience:** Solana meme coin degens, community founders, and crypto creators who want to launch a token quickly and safely.
- **Tone:** Fast, punchy, confident, dead-simple, and action-oriented. No fluff, no academic lectures, no developer-internal spreadsheets.
- **Goal:** Frictionless conversion. User should land, connect wallet, fill 4 fields, and click launch within 60 seconds.

## 2. Public Pricing Simplicity
- **Hero Message:** "0.15 SOL Flat Fee — Everything Included."
- **Included Free:** Token Creation, 100% Supply Minting, IPFS Metadata Hosting, Revoke Freeze (Raydium ready), Revoke Mint (Fixed Supply), and Immutable Metadata.
- **Customization:** "+0.05 SOL per kept authority" if they choose not to revoke.
- **Do Not Disclose:** Do not break down internal account rents (82 bytes mint, 165 bytes ATA, 679 bytes PDA) or internal operational costs to the public. They only care about the final price.

## 3. Separation of Public vs. Owner Boundaries
- Public copy is for public customers.
- Owner perks (0.00 SOL admin exemption via native wallet recognition `2di9sSnh1BYixnNw7Hw47XbMet9J5HFdF8NUMN2LZmaV`, treasury address) are private and must never appear in hero copy, public FAQs, or landing text. Zero third-party auth (no Clerk, no email sign-in).
- When the admin wallet connects, the UI adapts quietly via the header badge and zero-fee button without altering the public pitch.
