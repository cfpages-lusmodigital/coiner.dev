// src/components/StepGuide.jsx
import React from 'react';

const StepGuide = () => {
  return (
    <div className="step-guide-container">
      <h2>How to use Solana Token Creator</h2>
      
      <ol className="steps-list">
        <li>
          <h3>Connect your Solana wallet</h3>
          <p>Click the "Connect Wallet" button to connect your Phantom wallet</p>
        </li>
        
        <li>
          <h3>Write the name you want for your Token</h3>
          <p>Choose a memorable and unique name for your token</p>
        </li>
        
        <li>
          <h3>Indicate the symbol (max 6 characters)</h3>
          <p>Create a short symbol that represents your token (e.g. BTC, ETH, SOL)</p>
        </li>
        
        <li>
          <h3>Set the decimals for your Solana Token, 9 for utility tokens</h3>
          <p>Solana tokens typically use 9 decimals</p>
        </li>
        
        <li>
          <h3>Write the description you want for your Token</h3>
          <p>Explain the purpose and utility of your token</p>
        </li>
        
        <li>
          <h3>Upload the image for your token (PNG)</h3>
          <p>Add a visual representation of your token</p>
        </li>
        
        <li>
          <h3>Pick the supply of your Token</h3>
          <p>Determine how many tokens will be created in total</p>
        </li>
        
        <li>
          <h3>Click on create, accept the transaction and wait until your token is ready</h3>
          <p>Confirm the transaction in your wallet and your token will be created</p>
        </li>
      </ol>
      
      <div className="fee-explanation">
        <h3>The cost of creating the Token is 0.5 SOL, it includes:</h3>
        <ul>
          <li>All fees required for the SPL Token Creation.</li>
          <li>The contract process will mint and will take some time. We encourage you to wait until you see the final message of the token in the wallet you chose.</li>
        </ul>
        <p>
          Check here's what's truly important 
          <a href="#"> how to create a Solana Token</a>.
        </p>
      </div>
    </div>
  );
};

export default StepGuide;
