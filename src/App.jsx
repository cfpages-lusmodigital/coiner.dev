// src/App.jsx
import React, { useState, useMemo } from 'react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { WalletProvider, ConnectionProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import '@solana/wallet-adapter-react-ui/styles.css';

import CreatorPage from './components/CreatorPage';
import CoinerLogo from './components/CoinerLogo';
import { AdminStatusBadge } from './lib/admin';
import { GridBackground } from './components/ui/GridBackground';
import { ShieldCheck, Coins } from 'lucide-react';

const App = () => {
  const [network, setNetwork] = useState(WalletAdapterNetwork.Devnet);

  const endpoint = useMemo(() => {
    // Distinct RPC endpoints per network with cluster fallback
    if (network === WalletAdapterNetwork.Mainnet) {
      return (
        import.meta.env.VITE_SOLANA_RPC_MAINNET ||
        import.meta.env.VITE_SOLANA_RPC_HOST ||
        'https://api.mainnet-beta.solana.com'
      );
    }
    return import.meta.env.VITE_SOLANA_RPC_DEVNET || 'https://api.devnet.solana.com';
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
          <GridBackground>
            {/* Top Navigation */}
            <header className="py-3 px-4 sm:px-8 flex flex-wrap gap-3 justify-between items-center border-b border-zinc-800/80 sticky top-0 bg-[#09090b]/85 backdrop-blur-xl z-50">
              <CoinerLogo />

              {/* Right Header Actions */}
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                {/* Subtle Admin Status Badge */}
                <AdminStatusBadge />

                {/* Network Switcher with Specular Pill */}
                <div className="flex items-center p-0.5 rounded-xl shiny-pill text-xs font-sans">
                  <button
                    type="button"
                    onClick={() => setNetwork(WalletAdapterNetwork.Devnet)}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      network === WalletAdapterNetwork.Devnet
                        ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 shadow-xs'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Devnet
                  </button>
                  <button
                    type="button"
                    onClick={() => setNetwork(WalletAdapterNetwork.Mainnet)}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      network === WalletAdapterNetwork.Mainnet
                        ? 'bg-amber-500/25 text-amber-200 font-bold border border-amber-500/50 shadow-xs'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Mainnet
                  </button>
                </div>

                {/* Wallet Multi Button */}
                <WalletMultiButton className="!bg-gradient-to-r !from-amber-400 !via-amber-500 !to-yellow-500 hover:!from-amber-300 hover:!to-yellow-400 !text-black !font-extrabold !rounded-xl !h-10 !text-xs !shadow-[0_0_20px_rgba(245,158,11,0.35)] !transition-all" />
              </div>
            </header>

            {/* Main Application Body */}
            <main>
              <CreatorPage network={network === WalletAdapterNetwork.Mainnet ? 'mainnet-beta' : 'devnet'} />
            </main>

            {/* Modern Footer */}
            <footer className="py-12 px-6 text-center text-zinc-500 border-t border-zinc-800/80 mt-20 bg-[#09090b]/90">
              <div className="max-w-4xl mx-auto space-y-4">
                <div className="flex flex-wrap justify-center gap-6 text-xs text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-400" /> 100% Non-Custodial & Trustless
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-amber-400" /> Pure SPL & Metaplex Standard
                  </span>
                  <span>•</span>
                  <span className="text-amber-400 font-bold">
                    Flat 0.15 SOL • All Revocations Bundled Free
                  </span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed max-w-2xl mx-auto">
                  coiner.dev is the sovereign, non-custodial Solana token creator.
                  Launch compliant SPL and meme coins in 60 seconds with an all-inclusive 0.15 SOL flat fee.
                  Freeze Authority Revocation, Mint Authority Revocation, and Immutable Metadata are included 100% free with zero upsell.
                  You retain 100% of your minted supply directly in your wallet.
                </p>
                <p className="text-xs text-zinc-400 font-sans">
                  © {new Date().getFullYear()} coiner.dev • Sovereign Solana Infrastructure
                </p>
              </div>
            </footer>
          </GridBackground>
        </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
  );
};

export default App;
