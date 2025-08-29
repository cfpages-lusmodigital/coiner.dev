# Project Deployment & Configuration Guide

## 1. Introduction

This guide provides a step-by-step walkthrough for deploying this application using Cloudflare Pages and its integrated Functions feature. The backend logic for creating tokens has been simplified and no longer requires a separate Cloudflare Worker setup.

## 2. Deployment Architecture

This project uses **Cloudflare Pages Functions** to handle server-side logic.

*   The frontend is a standard Vite/React application.
*   The backend logic for creating a Solana token resides in `/functions/api/token/create.js`. This function is automatically detected and deployed by Cloudflare Pages.

This approach simplifies deployment, as both the website and the serverless API are managed in a single place.

## 3. Deployment Steps

### Step 1: Connect Your Repository to Cloudflare Pages

1.  Push the project code to your own GitHub repository.
2.  In your Cloudflare dashboard, go to **Workers & Pages**.
3.  Click **Create Application** -> **Pages** -> **Connect to Git**.
4.  Select your project's repository and begin setup.

### Step 2: Configure the Build Settings

When prompted, use the following build settings:

*   **Framework Preset:** `Vite`
*   **Build command:** `npm run build`
*   **Build output directory:** `dist`
*   **Root directory:** (leave as is)

### Step 3: Set Required Environment Variables

This is the most critical step. The application will not work without these settings.

1.  In your new Pages project, go to **Settings** -> **Environment variables**.
2.  Add the following variables under **Production** (do not add them as Preview variables unless you intend to test in preview environments).
3.  For each variable, click **Encrypt** to ensure it is stored securely.

#### Required Variables:

1.  **`PINATA_API_KEY`**
    *   **Description**: Your API Key for the Pinata IPFS service, used for storing token metadata and images.
    *   **Value**: `Your_Pinata_API_Key_Here`

2.  **`PINATA_SECRET_API_KEY`**
    *   **Description**: Your secret API Key for the Pinata IPFS service.
    *   **Value**: `Your_Pinata_Secret_API_Key_Here`

3.  **`PAYER_PRIVATE_KEY`**
    *   **Description**: The private key of the Solana wallet that will pay for the token creation transactions. This key must be in a specific **stringified JSON array format**.
    *   **How to get it**: Export the secret key from your Phantom wallet (or other wallet) and format it as a JSON array of numbers.
    *   **Value Example**: `[123,45,67,89,...,234]` (Replace with your actual 64-byte secret key array).
    *   **IMPORTANT**: This wallet must have sufficient SOL on the **Devnet** to cover transaction fees.

### Step 4: Save and Deploy

1.  After configuring the build settings and environment variables, click **Save and Deploy**.
2.  Cloudflare will now build your project and deploy it. You can monitor the progress in the "Deployments" tab.

Once the deployment is complete, your Solana token creator application will be live. The frontend will be able to call the `/api/token/create` endpoint to create new tokens.
