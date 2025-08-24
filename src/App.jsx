import React, { useState, useMemo } from 'react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { useWallet, WalletProvider, ConnectionProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import '@solana/wallet-adapter-react-ui/styles.css';

import TokenForm from './components/TokenForm';
import StepGuide from './components/StepGuide';
import FAQ from './components/FAQ';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';

const App = () => {
  const [network, setNetwork] = useState(WalletAdapterNetwork.Devnet);
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);
  const wallets = useMemo(() => [new PhantomWalletAdapter()], [network]);

  const fee = network === WalletAdapterNetwork.Mainnet ? 0.5 : 0.1;

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div className="min-h-screen bg-gray-900 text-white">
            <header className="py-4 px-8 flex justify-between items-center border-b border-gray-800">
              <div className="text-2xl font-bold">
                Coiner<span className="text-primary">.dev</span>
              </div>
              <div className="flex items-center gap-4">
                <Select value={network} onValueChange={setNetwork}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select network" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={WalletAdapterNetwork.Mainnet}>Mainnet</SelectItem>
                    <SelectItem value={WalletAdapterNetwork.Devnet}>Devnet</SelectItem>
                    <SelectItem value={WalletAdapterNetwork.Testnet}>Testnet</SelectItem>
                  </SelectContent>
                </Select>
                <WalletMultiButton style={{ backgroundColor: '#00BCD4', color: 'white' }} />
              </div>
            </header>

            <main className="container mx-auto py-12 px-4 space-y-12">
              <div className="text-center">
                <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
                  Create Your Own Solana SPL Token
                </h1>
                <p className="mt-4 text-lg text-gray-400">
                  No code required. Launch your token in minutes.
                </p>
              </div>

              <TokenCreator network={network} fee={fee} />
              
              <StepGuide />
              
              <FAQ />
            </main>

            <footer className="py-8 px-8 text-center text-gray-500 border-t border-gray-800">
              <p>© {new Date().getFullYear()} Coiner.dev | All rights reserved.</p>
            </footer>
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

const TokenCreator = ({ network, fee }) => {
  const { connected } = useWallet();
  
  if (!connected) {
    return (
      <Card className="w-full max-w-4xl mx-auto text-center">
        <CardHeader>
          <CardTitle>Connect Your Wallet</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4">You need to connect a Solana wallet to start creating your token.</p>
          <WalletMultiButton style={{ backgroundColor: '#00BCD4', color: 'white' }} />
        </CardContent>
      </Card>
    );
  }
  
  return <TokenForm network={network} fee={fee} />;
};

export default App;
