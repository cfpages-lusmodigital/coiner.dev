import React, { useMemo } from 'react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { WalletProvider, ConnectionProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import '@solana/wallet-adapter-react-ui/styles.css';

import CreatorPage from './components/CreatorPage';
import { Rocket } from './components/ui/Icons';

const App = () => {
  // For this simplified app, we'll default to devnet.
  // The PRD doesn't specify a network selector, so we'll remove it for a cleaner UI.
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div className="min-h-screen bg-gray-900 text-white font-sans">
            <header className="py-4 px-8 flex justify-between items-center border-b border-gray-800 sticky top-0 bg-gray-900/80 backdrop-blur-sm z-50">
              <div className="flex items-center gap-2">
                  <Rocket className="h-6 w-6 text-primary" />
                  <div className="text-2xl font-bold">
                    Coiner<span className="text-primary">.fun</span>
                  </div>
              </div>
              <WalletMultiButton />
            </header>

            <main>
              <CreatorPage />
            </main>

            <footer className="py-8 px-8 text-center text-gray-500 border-t border-gray-800 mt-12">
              <p>Disclaimer: This is a tool for creating high-risk cryptocurrencies. Most meme coins lose their value. Never invest more than you are willing to lose.</p>
              <p className="mt-2">© {new Date().getFullYear()} Coiner.fun | All rights reserved.</p>
            </footer>
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default App;
