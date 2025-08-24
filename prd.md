# Product Requirements Document: Coiner.dev

## 1. Introduction

Coiner.dev is a web-based application that allows users to easily create and deploy Solana SPL tokens without needing to write any code. The goal is to provide a user-friendly, secure, and efficient tool for individuals and projects looking to launch their own tokens on the Solana blockchain.

## 2. Product Goals

*   **Simplicity**: To provide an intuitive and straightforward user interface that makes token creation accessible to everyone, regardless of their technical background.
*   **Modern UI/UX**: To create a visually appealing, modern, and professional-looking application that users can trust.
*   **Security**: To ensure the entire process is secure, with users always in control of their assets. All transactions are signed on the client-side, and we never have access to users' private keys.
*   **Speed**: To make the token creation process as fast as possible, limited only by the speed of the Solana network.
*   **Customization**: To offer a range of options for token creation, from simple tokens to more advanced configurations with features like freeze authority and custom metadata.

## 3. Target Audience

*   **Crypto enthusiasts and entrepreneurs**: Individuals who want to launch their own token for a project, community, or meme.
*   **Developers**: Developers who want a quick and easy way to create tokens for testing or for their applications without having to write the boilerplate code themselves.
*   **Startups and small businesses**: Companies that want to leverage the power of the Solana blockchain for their projects.

## 4. Features

### Current Features (v1)

*   SPL Token Creation on Solana Mainnet and Devnet.
*   Customizable token name, symbol, description, and image.
*   Customizable token supply and decimals.
*   Support for Phantom Wallet.
*   Option to add social links (website, Twitter, Telegram, Discord).
*   Advanced options:
    *   Modify creator metadata.
    *   Custom token address prefix.
    *   Multi-wallet supply distribution.
    *   Add mint authority.
    *   Configure freeze authorities (freeze, thaw, update).

### To-Do List (Future Features)

#### Common Features

*   **Support for more wallets**: Add support for Solflare, Slope, and other popular Solana wallets.
*   **Transaction history**: A dashboard where users can see a history of the tokens they have created.
*   **Token management**: Allow users to manage their created tokens (e.g., mint more tokens if they have mint authority).
*   **Burn tokens**: A feature to burn a certain amount of tokens.
*   **Liquidity Pool Creation**: A feature to easily create a liquidity pool on a DEX like Raydium or Orca.

#### Nice-to-Have Features

*   **Pre-sale/IDO launchpad**: A feature to help projects launch their tokens with a pre-sale or Initial DEX Offering.
*   **Airdrop tool**: A tool to easily airdrop tokens to a list of addresses.
*   **Token vesting schedules**: A feature to lock tokens for a certain period.
*   **Multi-language support**: Translate the application into multiple languages.
*   **Themes**: Allow users to choose between different color themes for the application.

## 5. Design & UI

### Design Philosophy

The application should have a modern, polished, and "glowing" aesthetic. It should feel professional and trustworthy, while also being visually engaging. The color palette should be retained, with a dark theme as the default.

### Tech Stack

*   **Framework**: React (with Vite)
*   **UI Library**: `shadcn/ui` with Tailwind CSS
*   **Blockchain Interaction**: `@solana/web3.js`, `@solana/spl-token`, `@metaplex-foundation/mpl-token-metadata`
*   **Wallet Integration**: `@solana/wallet-adapter`
*   **Backend/Worker**: Cloudflare Workers (for handling transactions and interacting with services like Pinata)
*   **Hosting**: Cloudflare Pages

## 6. Build & Deployment Notes

### Cloudflare Pages Environment

It is critical that the Cloudflare Pages build environment is configured correctly. The project relies on features available in newer versions of Node.js.

*   **Node.js Version**: The build and deployment pipeline must use **Node.js version 20 or higher**.
*   **Configuration**: In the Cloudflare Pages settings for the project, an environment variable named `NODE_VERSION` must be created and set to `20`.
*   **Reasoning**: Failure to set the correct Node.js version will result in build failures. Specifically, the version of Vite used in this project (`vite@^6.0.0`) requires a `crypto.getRandomValues` function that is only available in modern Node.js versions. Older default environments (like Node 16) will cause the build to crash.

### Local Development Environment

To ensure consistency between local development and the production/preview environments, the `.nvmrc` file is set to `20`. Developers using `nvm` will automatically switch to the correct Node.js version when entering the project directory.

### UI Component State

*   **Accordion Component**: The `Accordion` components located in `src/components/ui/accordion.jsx` are presentational only. They do not contain the state management logic typically found in a library like Radix UI. Any implementation of this accordion must include its own state management (e.g., using the `useState` hook in the parent component) to control which items are open or closed.
