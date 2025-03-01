// src/App.jsx
import React, { useState, useEffect } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { useWallet, WalletProvider, ConnectionProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import '@solana/wallet-adapter-react-ui/styles.css';
import './App.css';
import TokenForm from './components/TokenForm';
import StepGuide from './components/StepGuide';
import FAQ from './components/FAQ';

const App = () => {
  const [network, setNetwork] = useState('devnet');
  const endpoint = network === 'mainnet' 
    ? 'https://api.mainnet-beta.solana.com' 
    : 'https://api.devnet.solana.com';

  // Configure wallet adapters
  const wallets = [
    new PhantomWalletAdapter(),
  ];

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div className="app-container">
            <header>
              <div className="logo">
                <h1>Coiner.dev</h1>
                <span>Solana Token Creator</span>
              </div>
              <div className="header-right">
                <select 
                  className="network-selector"
                  value={network}
                  onChange={(e) => setNetwork(e.target.value)}
                >
                  <option value="devnet">Devnet</option>
                  <option value="mainnet">Mainnet</option>
                </select>
                <WalletMultiButton />
              </div>
            </header>
            
            <main>
              <div className="intro">
                <h2>Solana Token Creator</h2>
                <p>Easily Create your Solana SPL Token in just 5 steps without Coding.</p>
              </div>
              
              <TokenCreator network={network} />
              
              <StepGuide />
              
              <FAQ />
            </main>
            
            <footer>
              <p>© 2025 Coiner.dev | All rights reserved.</p>
            </footer>
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

const TokenCreator = ({ network }) => {
  const { publicKey, connected } = useWallet();
  const [fee, setFee] = useState(0.5);
  
  useEffect(() => {
    // Update fee based on network
    setFee(network === 'mainnet' ? 0.5 : 0.1);
  }, [network]);
  
  if (!connected) {
    return (
      <div className="connect-prompt">
        <h3>Connect your wallet to create a Solana token</h3>
        <WalletMultiButton />
      </div>
    );
  }
  
  return <TokenForm network={network} fee={fee} />;
};

export default App;
