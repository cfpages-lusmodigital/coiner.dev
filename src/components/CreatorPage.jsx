// src/components/CreatorPage.jsx
import React, { useState, useRef } from 'react';
import TokenForm from './TokenForm';
import LivePreview from './LivePreview';
import LaunchModal from './LaunchModal';
import FAQ from './FAQ';
import StepGuide from './StepGuide';
import { Rocket, ShieldCheck, Zap, Coins, CheckCircle2, Crown } from 'lucide-react';
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
        {/* Hero Section */}
        <div className="text-center mb-10 max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-950/70 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-medium shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>⚡ Fast Solana Token Creator • Flat 0.15 SOL • All Revocations Included</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Launch Your Solana Token in{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
              Seconds
            </span>
          </h1>

          <p className="text-base sm:text-lg text-gray-400 leading-relaxed">
            Create SPL & meme coins instantly. Flat 0.15 SOL with Revoke Freeze, Revoke Mint, and Immutable Metadata included 100% free. No hidden fees, Raydium LP ready.
          </p>

          {/* Quick Value Props */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2 text-xs text-gray-300">
            <span className="flex items-center gap-1.5 bg-gray-900 px-3 py-1.5 rounded-lg border border-gray-800">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              RugCheck A-Grade Ready
            </span>
            <span className="flex items-center gap-1.5 bg-gray-900 px-3 py-1.5 rounded-lg border border-gray-800">
              <Zap className="w-4 h-4 text-amber-400" />
              Instant 1-Click Launch
            </span>
            <span className="flex items-center gap-1.5 bg-gray-900 px-3 py-1.5 rounded-lg border border-gray-800">
              <Coins className="w-4 h-4 text-cyan-400" />
              Raydium & Meteora LP Ready
            </span>
            <span className="flex items-center gap-1.5 bg-gray-900 px-3 py-1.5 rounded-lg border border-gray-800">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
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
