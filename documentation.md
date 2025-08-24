# Coiner.fun Deployment & Configuration Guide

## 1. Introduction

Welcome to the Coiner.fun setup guide! This document provides a detailed, step-by-step walkthrough for deploying and configuring your own instance of the Solana Meme Coin Creator.

This guide is written for beginners. We will assume you have very little prior knowledge of the technologies involved, but are eager to learn. We will cover everything from setting up your local environment to deploying a fully functional application.

## 2. Prerequisites

Before you begin, you will need the following:

*   **A GitHub Account:** This is where your code will live. If you don't have one, sign up at [github.com](https://github.com).
*   **Node.js and nvm:** The project requires Node.js version 20 or higher. We strongly recommend using `nvm` (Node Version Manager) to manage your Node.js versions.
    *   [Instructions for installing nvm](https://github.com/nvm-sh/nvm#installing-and-updating)
    *   Once nvm is installed, run `nvm install 20` and `nvm use 20` in your terminal.
*   **A Cloudflare Account:** We will use Cloudflare for hosting our website (Pages) and running our backend logic (Workers). Sign up at [cloudflare.com](https://dash.cloudflare.com).
*   **A Solana Wallet:** This wallet will be used to pay for transaction fees and will be the authority for the smart contracts. We recommend Phantom.
    *   Install the [Phantom Wallet browser extension](https://phantom.app/).
    *   Create a new wallet and make sure to securely store your seed phrase.
    *   You will need some SOL (Solana's native token) for fees. For testing, you can get free Devnet SOL from a faucet like [solfaucet.com](https://solfaucet.com/).

## 3. Local Development Setup

First, let's get the application running on your local machine.

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/your-username/coiner-fun.git
    cd coiner-fun
    ```
2.  **Install Dependencies:**
    ```bash
    npm install
    ```
3.  **Run the Development Server:**
    ```bash
    npm run dev
    ```
    This will start a local web server. You can open your browser and navigate to `http://localhost:5173` (or whatever port your terminal indicates) to see the application running.

## 4. Acquiring API Keys & Services

A fully functional version of this app requires several external services. Here’s how to get the necessary credentials.

### 4.1. Solana RPC Provider

The app needs to communicate with the Solana blockchain. While you can use public RPCs, they are often slow and unreliable. A dedicated RPC is essential for a good user experience.

1.  **Choose a Provider:** We recommend [Helius](https://helius.dev/).
2.  **Sign Up:** Create an account on their platform.
3.  **Get Your RPC URL:** Navigate to your dashboard and copy your dedicated RPC URL. It will look something like `https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY`.
4.  **Keep it Safe:** Save this URL. You will need it later.

### 4.2. Metadata Storage (Arweave)

Token metadata (name, description, image) must be stored permanently. Arweave is a permanent data storage solution. We'll use a service called [Irys](https://irys.xyz/) (formerly Bundlr) to easily upload data to Arweave.

1.  **Fund an Irys Node:** Irys works by funding a node with a specific token (like SOL). You can do this programmatically or through their interface. For a server-side uploader, you will need a private key for a wallet that has been used to fund an Irys node.
2.  **Generate a Wallet:** You can create a new Solana keypair to use specifically for uploads.
3.  **Fund It:** Send a small amount of SOL to this new wallet's public key.
4.  **Fund Irys:** Use the Irys tools or web interface to fund your Irys account from this wallet. 0.1 SOL is more than enough to start.
5.  **Get Private Key:** You will need the **private key** of this uploader wallet (as a byte array or base58 string) to configure your backend worker.

**Note:** This is an advanced step. For initial testing, the backend can be configured to use a free, temporary service like `arweave.net/upload`.

## 5. Smart Contract Deployment (Placeholder)

**THIS IS A CRITICAL STEP AND THE CODE IS NOT YET IMPLEMENTED.**

The core of this application is a set of on-chain programs (smart contracts) that handle token creation and the bonding curve market. These need to be written in Rust using the Anchor framework.

1.  **What Needs to be Built:**
    *   **Token Deployer Program:** A smart contract that can programmatically create a new SPL token with metadata.
    *   **Bonding Curve Program:** A smart contract that manages the buy/sell logic, holds the SOL and tokens, and handles the liquidity migration to a DEX like Raydium.
2.  **Deployment Steps (Future):**
    *   Install Rust and the Anchor framework.
    *   Write and test the smart contracts.
    *   Compile the contracts using `anchor build`.
    *   Deploy them to Solana using `anchor deploy`.
    *   After deployment, the CLI will output **Program IDs** for each contract.
3.  **Save the Program IDs:** You will need these Program IDs for your backend and frontend configuration.

## 6. Backend Setup (Cloudflare Worker)

Our backend logic runs on a serverless Cloudflare Worker. It will handle requests from the frontend, call the smart contracts, and upload metadata.

1.  **Install Wrangler:** This is the command-line tool for managing Cloudflare Workers.
    ```bash
    npm install -g wrangler
    ```
2.  **Login to Wrangler:**
    ```bash
    wrangler login
    ```
3.  **Configure the Worker:** The `workers/wrangler.toml` file contains the configuration. You may need to adjust the `name` of the worker to be unique.
4.  **Set Up Secrets:** Your worker needs sensitive information (like private keys) to function. **NEVER** put these directly in your code. Use Wrangler secrets.
    ```bash
    # In the `workers` directory:

    # Your RPC URL from step 4.1
    npx wrangler secret put RPC_URL
    # Paste your Helius URL when prompted

    # The private key of your Arweave/Irys uploader wallet from step 4.2
    npx wrangler secret put UPLOADER_PRIVATE_KEY
    # Paste the base58 string of the private key when prompted

    # The private key of the wallet that will pay fees for transactions
    npx wrangler secret put FEE_PAYER_PRIVATE_KEY
    # Paste the base58 string of your main wallet's private key
    ```
5.  **Deploy the Worker:**
    ```bash
    # In the `workers` directory:
    npx wrangler deploy
    ```
6.  **Get Worker URL:** After deployment, Wrangler will output the URL for your worker (e.g., `https://my-worker.my-username.workers.dev`). Save this URL.

## 7. Frontend Deployment (Cloudflare Pages)

Finally, let's deploy the user-facing website.

1.  **Push to GitHub:** Make sure your project is on your GitHub account.
2.  **Create a Cloudflare Pages Project:**
    *   In the Cloudflare dashboard, go to **Workers & Pages**.
    *   Click **Create Application** -> **Pages** -> **Connect to Git**.
    *   Select your project's repository.
3.  **Configure the Build:**
    *   **Project Name:** Choose a name for your site.
    *   **Production Branch:** Select `main` (or your primary branch).
    *   **Framework Preset:** Choose `Vite`.
    *   **Build command:** `npm run build`
    *   **Build output directory:** `dist`
4.  **Set Environment Variables:** This is the most important step for connecting the frontend to the backend and blockchain.
    *   Go to your project's **Settings** -> **Environment variables**.
    *   Add the following variables for **both Production and Preview** environments:
        *   `NODE_VERSION` (Build-time variable):
            *   **Variable name:** `NODE_VERSION`
            *   **Value:** `20`
        *   `VITE_SOLANA_RPC_HOST` (Runtime variable):
            *   **Variable name:** `VITE_SOLANA_RPC_HOST`
            *   **Value:** Your Helius RPC URL from step 4.1.
        *   `VITE_WORKER_URL` (Runtime variable):
            *   **Variable name:** `VITE_WORKER_URL`
            *   **Value:** Your deployed Cloudflare Worker URL from step 6.6.
        *   `VITE_BONDING_CURVE_PROGRAM_ID` (Runtime variable):
            *   **Variable name:** `VITE_BONDING_CURVE_PROGRAM_ID`
            *   **Value:** The Program ID from the (future) bonding curve contract.
        *   `VITE_TOKEN_DEPLOYER_PROGRAM_ID` (Runtime variable):
            *   **Variable name:** `VITE_TOKEN_DEPLOYER_PROGRAM_ID`
            *   **Value:** The Program ID from the (future) token deployer contract.
5.  **Save and Deploy:** Click **Save and Deploy**. Cloudflare will now build and deploy your site. You can watch the progress in the deployments tab.

Congratulations! Once the deployment is finished, your site will be live and ready for users.
