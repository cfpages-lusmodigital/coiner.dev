## **Product Requirements Document (PRD): Solana Meme Coin Creator**

### **1. Introduction & Vision**

The **Solana Meme Coin Creator** is a web-based dApp (Decentralized Application) that radically simplifies the process of creating and launching a meme coin on the Solana blockchain.

*   **Vision:** To democratize token creation on Solana, allowing anyone with an idea—be it a community leader, artist, or meme enthusiast—to launch a coin in minutes without writing a single line of code.
*   **Problem:** Creating a Solana (SPL) token traditionally requires technical knowledge of command-line tools, smart contracts, and setting up liquidity, which is a significant barrier for non-developers.
*   **Solution:** This tool provides a simple, intuitive web interface that handles all the technical complexity on the backend. It automates token minting, metadata creation, and the setup of an initial market for trading via a bonding curve, inspired by platforms like `pump.fun`.

### **2. Target Audience & User Personas**

*   **The Community Creator:** A person who runs a social media account, Discord server, or online community and wants to create a token to engage and reward their members. They are not a developer.
*   **The Meme Enthusiast ("Degen"):** A crypto-native user who wants to quickly launch coins based on current events or trending memes to speculate and have fun. They value speed and low cost above all else.
*   **The Marketer:** An individual or agency looking to use a meme coin as part of a viral marketing campaign for a brand or product.

### **3. Core User Flow**

The user journey is designed to be as frictionless as possible:

1.  **Land on Page:** User arrives at the application's homepage.
2.  **Connect Wallet:** User clicks "Connect Wallet" and connects their preferred Solana wallet (e.g., Phantom, Solflare).
3.  **Fill Form:** User completes a simple form with the coin's **Name**, **Ticker**, **Description**, and uploads an **Image**.
4.  **Review & Pay:** The UI shows a summary and the creation fee in SOL.
5.  **Launch Coin:** User clicks the "Launch" button, which prompts them to approve a transaction in their wallet to pay the fee and deploy the token.
6.  **Confirmation:** The application deploys the token, creates the metadata, and establishes the bonding curve market.
7.  **Success:** A confirmation screen appears with links to the token on Solscan, the new trading page, and social sharing options.

### **4. Functional Requirements (Features)**

**FR1: Solana Wallet Integration**
*   Must support the Solana Wallet-Adapter standard.
*   Prominently display a "Connect Wallet" button.
*   Once connected, the button should show the user's truncated wallet address.
*   The application must be able to request transaction signatures from the user's wallet.

**FR2: Coin Creation Form**
*   **Name:** Text input. Max 32 characters.
*   **Ticker:** Text input. Max 8 characters. Must be uppercase.
*   **Description:** Text area. Max 280 characters.
*   **Image Upload:** File input for JPG, PNG, and GIF files. Max file size of 1MB. An image preview must be shown after upload.

**FR3: Automated Token Deployment (Backend/Smart Contract)**
*   The backend service must listen for successful launch transactions.
*   Upon confirmation, it must execute the following actions:
    *   Create a new SPL Token Mint with a fixed supply (e.g., 1 billion tokens).
    *   Create the token metadata account using the Metaplex Token Metadata standard, uploading the user's image to a permanent storage solution like Arweave.
    *   **Crucially, create a bonding curve market.** This means deploying a smart contract where a portion of the supply is held. Users can buy the token with SOL, and the price increases algorithmically as more SOL is deposited. The remaining supply is burned or held by the creator.
    *   The goal is for the bonding curve to reach a certain market cap (e.g., $69,000). Upon reaching this goal, the contract automatically deposits a portion of the collected SOL and tokens as liquidity onto a major Solana DEX like Raydium and burns the LP tokens, ensuring the market is permanent and decentralized.

**FR4: Fee & Payment**
*   A flat creation fee will be charged (e.g., **0.02 SOL**).
*   This fee must be clearly displayed to the user before they launch.
*   The "Launch" button will trigger the transaction to pay this fee.

**FR5: Post-Launch Confirmation & Shareability**
*   After a successful launch, the user must be shown a success page or modal.
*   This screen must contain:
    *   The token's contract address (with a one-click copy button).
    *   A direct link to view the token on an explorer like **Solscan**.
    *   A direct link to the new **trading page** on the platform itself.
    *   Pre-formatted social sharing buttons (Twitter, Telegram) to announce the new coin.

---

## **UI/UX Design & Component Instructions**

### **General Theme & Style**

*   **Theme:** Dark mode is preferred, as it's standard in the crypto space.
*   **Colors:** Use a primary accent color (e.g., electric blue, neon green) for buttons and key elements. Use white/light gray for text.
*   **Typography:** Use a clean, modern sans-serif font like Inter for body text. A more playful, bold font can be used for main headings to fit the "meme" theme.
*   **Layout:** A single-page application feel. The core creation process should happen on one main screen.

---

### **Screen 1: The Main Creator Page**

This is the only screen the user needs to interact with for the creation process.

#### **1. Navbar**

*   **Layout:** A simple, clean top navigation bar.
*   **Left Side:** The application's **Logo** and **Name**.
*   **Right Side:** A single Call-to-Action (CTA) button:
    *   **Initial State:** A primary button labeled **"Connect Wallet"**.
    *   **Connected State:** The button is replaced with a gray, pill-shaped element showing the user's truncated wallet address (e.g., `8aZ2...kL9P`).

#### **2. Main Content Area**

*   **Layout:** A two-column layout is ideal for desktop. On mobile, it will stack vertically.
    *   **Left Column:** The input form for creating the coin.
    *   **Right Column:** A live preview card that updates as the user types.

#### **2.1. Left Column: The "Create Your Coin" Form**

This section should be enclosed in a card or panel with a clear heading like **"Launch Your Legend"**.

1.  **Coin Name Input:**
    *   **Label:** `Coin Name`
    *   **Component:** Standard text input field.
    *   **Placeholder Text:** `e.g., Solana Cat`
    *   **Validation:** Required, max 32 characters.

2.  **Ticker Symbol Input:**
    *   **Label:** `Ticker`
    *   **Component:** Standard text input field.
    *   **Placeholder Text:** `e.g., SCAT`
    *   **Helper Text (below field):** `3-8 uppercase characters.`
    *   **Validation:** Required, all caps, max 8 characters.

3.  **Description Text Area:**
    *   **Label:** `Description`
    *   **Component:** A multi-line text area (textarea).
    *   **Placeholder Text:** `Tell the world about your coin's story.`
    *   **Validation:** Required, max 280 characters.

4.  **Image Upload Area:**
    *   **Label:** `Image / Logo`
    *   **Component:** A dashed-border box with an upload icon and text inside saying **"Drag & drop or click to upload"**.
    *   **Helper Text:** `Recommended: 400x400px. PNG, JPG, or GIF.`
    *   **Interaction:** Clicking it opens the file selector. Once an image is selected, the box should be replaced by a preview of the uploaded image.

#### **2.2. Right Column: The "Live Preview" Card**

This card shows the user what their coin will look like on trading sites. It updates in real-time as the user fills the form.

*   **Layout:** A vertical card.
*   **Top:** A circular frame displaying the uploaded **Image**. If no image is uploaded, show a placeholder icon.
*   **Middle:**
    *   The **Coin Name** in a large, bold font.
    *   The **Ticker Symbol** next to it, styled like a stock ticker (e.g., `$SCAT`).
*   **Bottom:** The **Description** text provided by the user.

#### **2.3. Action Section (Below the Form)**

1.  **Fee Display:**
    *   A clear, read-only text line: `Creation Fee: 0.02 SOL` 🪙. This should be prominently visible.

2.  **The Launch Button:**
    *   **Component:** A large, full-width primary button.
    *   **Disabled State:** Default, grayed out. Text: **"Fill All Fields to Launch"**.
    *   **Wallet Not Connected State:** Active, text: **"Connect Wallet to Launch"**.
    *   **Enabled State:** Primary accent color. Text: **"Let's Go! 🚀"** or **"Launch Coin"**.

---

### **Screen 2: The Launch Modal Lifecycle**

A single modal with two states: **In-Progress** and **Success**.

#### **State 1: "Launch in Progress"**

*   **Header:** Animated icon (🚀), `Launching [Coin Name]...`, `Your coin is being deployed...`
*   **Progress Checklist:** A vertical list of steps with updating icons (e.g., ⏳ -> ✅).
    1.  `Confirming transaction on-chain`
    2.  `Uploading image & metadata`
    3.  `Creating SPL Token`
    4.  `Deploying the trading market`
*   **Footer:** `This can take up to 60 seconds...`

#### **State 2: "Success"**

*   **Header:** Icon (🎉), `Congratulations! $[TICKER] is Live!`, `Your meme coin is now officially on the Solana blockchain.`
*   **Coin Identity Block:** Shows the coin's image, name, and ticker.
*   **Token Address Display:** A read-only text box with the token address and a one-click **Copy** button.
*   **Primary Action Buttons:**
    *   **`Trade [TICKER] Now`**: Links to the coin's trading page.
    *   **`View on Solscan`**: Opens Solscan in a new tab.
*   **Social Sharing Section:** Icon buttons for Twitter (X) and Telegram with pre-populated messages.
*   **Modal Close Button:** A "Done" button to close the modal.

---

### **Screen 3: The Coin's Trading Page (Post-Launch)**

A unique page at `ourplatform.com/coin/TOKEN_ADDRESS`.

*   **Layout:** Two-column layout with a chart/trading interface and an info panel.
*   **Left Column (Chart & Trading):**
    *   **Price Chart:** Real-time line chart of the token's price in SOL.
    *   **Trading Interface:** A "Buy" and "Sell" tabbed component. Users input SOL (for buying) or TOKEN (for selling) and see the calculated output.
*   **Right Column (Information Panel):**
    *   **Market Stats:** Market Cap, Creator's Holdings.
    *   **Raydium Progress Bar:** A visual bar showing progress towards the market cap goal for DEX liquidity.
    *   **Token Info:** Description, Token Address (with copy button), Creation Date.
    *   **Creator Info:** Creator's wallet address.

---

### **Section 5: Technical Stack & Architecture**

*   **Frontend:**
    *   **Framework:** **Next.js** or **Vite (with React)**.
    *   **Styling:** **Tailwind CSS** (`shadcn/ui`).
    *   **State Management:** **Zustand** or **Jotai**.
*   **Solana Integration:**
    *   **Wallet Connection:** `@solana/wallet-adapter`.
    *   **Blockchain Interaction:** `@solana/web3.js`.
*   **Smart Contracts (On-Chain Programs):**
    *   **Language:** **Rust** with the **Anchor** framework.
    *   **Required Contracts:** Token Deployer Program, Bonding Curve Program.
*   **Data & Storage:**
    *   **Metadata Storage:** **Arweave** or **IPFS**.
    *   **RPC Node:** A reliable Solana RPC provider like **Helius**, **Triton One**, or **QuickNode**.

---

### **Section 6: Monetization Strategy**

*   **Primary Revenue (Creation Fee):** **0.02 SOL** fee per coin creation to cover transaction/storage costs and platform profit.
*   **Secondary Revenue (Trading Fee):** A small, transparent fee (e.g., 1%) on every buy transaction on the bonding curve.

---

### **Section 7: V2 Roadmap & Future Features**

*   **Creator Dashboard:** Analytics for created coins.
*   **Commenting/Social Feed:** On-page community interaction.
*   **"Top Coins" Leaderboard:** Gamified discovery of popular tokens.
*   **Airdrop Tool:** For creators to distribute tokens.
*   **Multi-Chain Support:** Expansion to chains like **Base** or **Blast**.

---

### **Section 8: Critical Risks & Disclaimers**

*   **For Users/Traders:**
    *   Clear warnings about the high-risk nature of meme coins.
    *   "Do Your Own Research (DYOR)" advisories.
*   **For Creators:**
    *   Disclaimers about their legal and tax responsibilities.
*   **For the Platform:**
    *   Commitment to a third-party security audit for smart contracts.
    *   "As is" service disclaimer with no guarantee of financial outcomes.
