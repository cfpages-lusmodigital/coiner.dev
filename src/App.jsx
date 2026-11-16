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
import { ClerkAuthProvider, AdminAuthWidget } from './lib/clerk';
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
    <ClerkAuthProvider>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>
            <div className="min-h-screen bg-gray-950 text-white font-sans selection:bg-emerald-500 selection:text-black">
              {/* Top Navigation */}
              <header className="py-3.5 px-4 sm:px-8 flex flex-wrap gap-3 justify-between items-center border-b border-gray-800/80 sticky top-0 bg-gray-950/85 backdrop-blur-md z-50">
                <CoinerLogo />

                {/* Right Header Actions */}
                <div className="flex items-center gap-2.5 sm:gap-3">
                  {/* Admin Auth Widget (Clerk / Admin Exemption Badge) */}
                  <AdminAuthWidget />

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
                      0.15 SOL Flat Public Fee (Bundled) • 0.00 SOL Admin Exemption
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    coiner.dev is an open-source sovereign utility designed to eliminate predatory third-party platform markups on Solana.
                    Public creators pay a flat, transparent 0.15 SOL service fee with all 3 security revocations (Freeze, Mint, Update) and IPFS pinning bundled 100% free (saving vs competitors charging 0.40–0.80 SOL for the same bundle),
                    while the platform administrator (admin@alampintar.org / Admin Wallet) launches gas-only with zero platform fees.
                    Non-standard customizations (retaining authorities) incur a +0.05 SOL fee. Users retain 100% of their minted supply in their own non-custodial wallet.
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
    </ClerkAuthProvider>
  );
};

export default App;
