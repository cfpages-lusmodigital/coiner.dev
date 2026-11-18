// src/components/CreatorPage.jsx
import React, { useState, useRef } from 'react';
import TokenForm from './TokenForm';
import LivePreview from './LivePreview';
import LaunchModal from './LaunchModal';
import FAQ from './FAQ';
import StepGuide from './StepGuide';
import { GoldCoin3D } from '@/components/ui/GoldCoin3D';
import { Rocket, ShieldCheck, Zap, Coins, CheckCircle2, Crown, Sparkles } from 'lucide-react';
import { useAdminStatus } from '@/lib/admin';

const CreatorPage = ({ network = 'devnet' }) => {
  const { isAdmin } = useAdminStatus();
  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    description: '',
    supply: '1000000000',
    decimals: '6',
    image: null,
    website: '',
    twitter: '',
    telegram: '',
    discord: '',
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [launchStatus, setLaunchStatus] = useState('idle'); // idle | uploading | preparing | signing | broadcasting | confirming | success | error
  const [statusMessage, setStatusMessage] = useState('');
  const [launchError, setLaunchError] = useState('');
  const [launchResult, setLaunchResult] = useState(null);
  const formSubmitRef = useRef(null);

  const handleLaunchStart = () => {
    setLaunchError('');
    setLaunchResult(null);
    setLaunchStatus('uploading');
    setStatusMessage('Initiating token deployment...');
    setIsModalOpen(true);
  };

  const handleLaunchProgress = (step, msg) => {
    setLaunchStatus(step);
    setStatusMessage(msg);
  };

  const handleLaunchSuccess = (result) => {
    setLaunchStatus('success');
    setStatusMessage('Token successfully deployed on-chain!');
    setLaunchResult(result);
  };

  const handleLaunchError = (errorMsg) => {
    setLaunchStatus('error');
    setLaunchError(errorMsg);
  };

  return (
    <>
      <div className="container mx-auto py-10 px-4 max-w-7xl">
        {/* Modern 3D Hero Section with Ambient Background Coin */}
        <div className="relative text-center mb-14 max-w-3xl mx-auto space-y-6 pt-4">
          {/* Ambient 3D Gold Coin Background Layer */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none -z-0 opacity-20 blur-[1px] scale-110 sm:scale-135 transition-opacity">
            <GoldCoin3D size="bg" badgeText="SOL" animate={false} showShine={false} />
          </div>

          <div className="relative z-10 inline-flex items-center gap-2 px-4 py-1.5 rounded-full shiny-pill text-xs font-sans font-medium shadow-xs">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-zinc-200">
              ⚡ Sovereign Solana Token Creator • <strong className="text-amber-300">Flat 0.15 SOL</strong> • All Revocations Bundled Free
            </span>
          </div>

          <h1 className="relative z-10 header-specular-title text-4xl sm:text-6xl font-black tracking-tight leading-[1.1] text-stroke-subtle">
            Launch Your Solana Token in{' '}
            <span className="text-gradient-gold drop-shadow-[0_0_25px_rgba(245,158,11,0.4)]">
              Seconds
            </span>
          </h1>

          <p className="relative z-10 text-base sm:text-lg text-zinc-300 leading-relaxed max-w-2xl mx-auto">
            Create SPL & meme coins instantly. Flat 0.15 SOL with Revoke Freeze, Revoke Mint, and Immutable Metadata included 100% free. No hidden fees, Raydium LP ready.
          </p>

          {/* Quick Value Props with Specular Shiny Outlines */}
          <div className="relative z-10 flex flex-wrap items-center justify-center gap-3 pt-2 text-xs">
            <span className="flex items-center gap-1.5 shiny-pill px-3.5 py-1.5 rounded-xl text-zinc-200 font-medium">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              RugCheck A-Grade Ready
            </span>
            <span className="flex items-center gap-1.5 shiny-pill px-3.5 py-1.5 rounded-xl text-zinc-200 font-medium">
              <Zap className="w-4 h-4 text-amber-400" />
              Instant 1-Click Launch
            </span>
            <span className="flex items-center gap-1.5 shiny-pill px-3.5 py-1.5 rounded-xl text-zinc-200 font-medium">
              <Coins className="w-4 h-4 text-amber-400" />
              Raydium & Meteora LP Ready
            </span>
            <span className="flex items-center gap-1.5 shiny-pill px-3.5 py-1.5 rounded-xl text-zinc-200 font-medium">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              100% Non-Custodial
            </span>
          </div>
        </div>

        {/* Form and Preview Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7">
            <TokenForm
              formData={formData}
              setFormData={setFormData}
              onLaunchStart={handleLaunchStart}
              onLaunchProgress={handleLaunchProgress}
              onLaunchSuccess={handleLaunchSuccess}
              onLaunchError={handleLaunchError}
              network={network}
              triggerSubmitRef={formSubmitRef}
            />
          </div>

          <div className="lg:col-span-5">
            <LivePreview formData={formData} />
          </div>
        </div>

        {/* Step Guide & Educational Section */}
        <div className="mt-16 border-t border-gray-800/80 pt-12">
          <StepGuide />
        </div>

        {/* FAQ Section */}
        <div className="mt-12">
          <FAQ />
        </div>
      </div>

      <LaunchModal
        open={isModalOpen}
        setOpen={setIsModalOpen}
        tokenData={formData}
        status={launchStatus}
        statusMessage={statusMessage}
        error={launchError}
        result={launchResult}
        network={network}
        onRetry={() => {
          if (formSubmitRef.current) {
            formSubmitRef.current();
          } else {
            handleLaunchStart();
          }
        }}
      />
    </>
  );
};

export default CreatorPage;
