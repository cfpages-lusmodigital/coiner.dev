// src/App.jsx
import React, { useState, useMemo } from 'react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { WalletProvider, ConnectionProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import '@solana/wallet-adapter-react-ui/styles.css';

import CreatorPage from './components/CreatorPage';
import CoinerLogo from './components/CoinerLogo';
import { AdminStatusBadge } from './lib/admin';
import { ShieldCheck, Coins } from 'lucide-react';

const App = () => {
  const [network, setNetwork] = useState(WalletAdapterNetwork.Devnet);

  const endpoint = useMemo(() => {
    // Distinct RPC endpoints per network with cluster fallback
    if (network === WalletAdapterNetwork.Mainnet) {
      return (
        import.meta.env.VITE_SOLANA_RPC_MAINNET ||
        import.meta.env.VITE_SOLANA_RPC_HOST ||
        clusterApiUrl('mainnet-beta')
      );
    }
    return import.meta.env.VITE_SOLANA_RPC_DEVNET || clusterApiUrl('devnet');
  }, [network]);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div className="min-h-screen bg-gray-950 text-white font-sans selection:bg-emerald-500 selection:text-black">
            {/* Top Navigation */}
            <header className="py-3.5 px-4 sm:px-8 flex flex-wrap gap-3 justify-between items-center border-b border-gray-800/80 sticky top-0 bg-gray-950/85 backdrop-blur-md z-50">
              <CoinerLogo />

              {/* Right Header Actions */}
              <div className="flex items-center gap-2.5 sm:gap-3">
                {/* Subtle Admin Status Badge */}
                <AdminStatusBadge />

                  {/* Network Switcher */}
                  <div className="flex items-center p-0.5 rounded-lg bg-gray-900 border border-gray-800 text-xs font-mono">
                    <button
                      type="button"
                      onClick={() => setNetwork(WalletAdapterNetwork.Devnet)}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        network === WalletAdapterNetwork.Devnet
                          ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Devnet
                    </button>
                    <button
                      type="button"
                      onClick={() => setNetwork(WalletAdapterNetwork.Mainnet)}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        network === WalletAdapterNetwork.Mainnet
                          ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Mainnet
                    </button>
                  </div>

                  {/* Wallet Multi Button */}
                  <WalletMultiButton className="!bg-emerald-600 hover:!bg-emerald-500 !text-white !font-bold !rounded-xl !h-10 !text-xs !transition-all" />
                </div>
              </header>

              {/* Main Application Body */}
              <main>
                <CreatorPage network={network === WalletAdapterNetwork.Mainnet ? 'mainnet-beta' : 'devnet'} />
              </main>

              {/* Modern Footer */}
              <footer className="py-10 px-6 text-center text-gray-500 border-t border-gray-800/80 mt-16 bg-gray-950">
                <div className="max-w-4xl mx-auto space-y-4">
                  <div className="flex flex-wrap justify-center gap-6 text-xs text-gray-400">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" /> 100% Non-Custodial & Trustless
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1.5">
                      <Coins className="w-4 h-4 text-cyan-400" /> Pure SPL & Metaplex Standard
                    </span>
                    <span>•</span>
                    <span className="text-emerald-400 font-medium">
                      Flat 0.15 SOL • All Revocations Bundled Free
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed max-w-2xl mx-auto">
                    coiner.dev is the fast, non-custodial Solana token creator.
                    Launch compliant SPL and meme coins in 60 seconds with a flat 0.15 SOL fee.
                    Freeze Authority Revocation, Mint Authority Revocation, and Immutable Metadata are included 100% free with zero upsell.
                    You retain 100% of your minted supply directly in your wallet.
                  </p>
                  <p className="text-xs text-gray-600 font-mono">
                    © {new Date().getFullYear()} coiner.dev • Sovereign Solana Infrastructure
                  </p>
                </div>
              </footer>
            </div>
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
  );
};

export default App;
