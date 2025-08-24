import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import CoinForm from './CoinForm';
import LivePreview from './LivePreview';
import LaunchModal from './LaunchModal';

const CreatorPage = () => {
  const { connected } = useWallet();
  const [formData, setFormData] = useState({
    name: '',
    ticker: '',
    description: '',
    image: null,
  });
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleLaunch = () => {
    console.log("Launching coin with data:", formData);
    setIsModalOpen(true);
  };

  return (
    <>
      <div className="container mx-auto py-12 px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
            Launch Your Own Meme Coin on Solana
          </h1>
          <p className="mt-4 text-lg text-gray-400">
            No code, no hassle. Go from idea to live market in minutes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
          <div>
            <CoinForm
              formData={formData}
              setFormData={setFormData}
              handleLaunch={handleLaunch}
              walletConnected={connected}
            />
          </div>
          <div>
            <LivePreview formData={formData} />
          </div>
        </div>
      </div>
      <LaunchModal
        open={isModalOpen}
        setOpen={setIsModalOpen}
        coinData={formData}
      />
    </>
  );
};

export default CreatorPage;
