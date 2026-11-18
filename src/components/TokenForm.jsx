// src/components/TokenForm.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { BorderBeam } from '@/components/ui/border-beam';
import {
  Upload,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Globe,
  Sparkles,
  Coins,
  Crown,
  Wallet,
  ArrowRight,
  ArrowLeft,
  Rocket,
  Check,
  AlertCircle,
  Flame,
} from 'lucide-react';
import { createSolanaToken, estimateRentCosts } from '@/lib/solana';
import { useAdminStatus, calculatePlatformFee } from '@/lib/admin';

const PRIORITY_FEE_MAP = {
  normal: 50000,   // ~0.0000125 SOL at 250k CU
  fast: 250000,    // ~0.0000625 SOL at 250k CU
  turbo: 1000000,  // ~0.0002500 SOL at 250k CU
};

const STEPS = [
  { id: 1, name: 'Basics', label: 'Token Basics', description: 'Token identity & supply', icon: Sparkles },
  { id: 2, name: 'Media', label: 'Media & Story', description: 'Logo & community lore', icon: Upload },
  { id: 3, name: 'Security', label: 'Security & Speed', description: 'On-chain security & speed', icon: ShieldCheck },
  { id: 4, name: 'Review', label: 'Review & Launch', description: 'Pre-flight verification', icon: Rocket },
];

const TokenForm = ({
  formData,
  setFormData,
  onLaunchStart,
  onLaunchProgress,
  onLaunchSuccess,
  onLaunchError,
  network = 'devnet',
  triggerSubmitRef,
}) => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { setVisible } = useWalletModal();
  const { connected, publicKey } = wallet;
  const { isAdmin, adminRoleReason } = useAdminStatus();

  const isMainnet = network === 'mainnet-beta' || network === 'mainnet';

  // Multi-step state: 1: Basics, 2: Media, 3: Security, 4: Review
  const [currentStep, setCurrentStep] = useState(1);
  const [stepError, setStepError] = useState('');
  const isSubmittingRef = useRef(false);

  // Managed image preview with automatic URL revocation
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  useEffect(() => {
    if (formData.image instanceof File) {
      const url = URL.createObjectURL(formData.image);
      setImagePreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else if (typeof formData.image === 'string') {
      setImagePreviewUrl(formData.image);
    } else {
      setImagePreviewUrl(null);
    }
  }, [formData.image]);

  const [prioritySpeed, setPrioritySpeed] = useState('fast'); // normal | fast | turbo
  const [securityOptions, setSecurityOptions] = useState({
    revokeFreeze: true,
    revokeMint: true,
    immutable: true,
  });

  // Sync security choices to formData so LivePreview and LaunchModal always reflect live state
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      revokeFreeze: securityOptions.revokeFreeze,
      revokeMint: securityOptions.revokeMint,
      immutable: securityOptions.immutable,
    }));
  }, [securityOptions, setFormData]);

  // Calculate dynamic platform fee: 0.15 SOL bundled baseline; +0.05 SOL per kept authority if customized (0.00 SOL for admin)
  const currentPlatformFeeSol = useMemo(() => {
    return calculatePlatformFee({
      isAdmin,
      revokeFreeze: securityOptions.revokeFreeze,
      revokeMint: securityOptions.revokeMint,
      immutable: securityOptions.immutable,
    });
  }, [isAdmin, securityOptions]);

  const customizationCount = useMemo(() => {
    let count = 0;
    if (!securityOptions.revokeFreeze) count++;
    if (!securityOptions.revokeMint) count++;
    if (!securityOptions.immutable) count++;
    return count;
  }, [securityOptions]);

  const [rentCosts, setRentCosts] = useState({
    mintRentSol: '0.00107',
    ataRentSol: '0.00149',
    metadataRentSol: '0.00410',
    metaplexProtocolSol: isMainnet ? '0.01000' : '0.00000',
    networkGasSol: '0.00010',
    platformFeeSol: currentPlatformFeeSol.toFixed(5),
    estimatedTotalSol: (0.00676 + (isMainnet ? 0.01 : 0) + currentPlatformFeeSol).toFixed(5),
  });

  // Fetch live rent estimates from connected RPC whenever connection, fee, network, or priority changes
  useEffect(() => {
    let isMounted = true;
    const microLamports = PRIORITY_FEE_MAP[prioritySpeed] || 250000;
    estimateRentCosts(connection, currentPlatformFeeSol, isMainnet, microLamports).then((costs) => {
      if (isMounted) setRentCosts(costs);
    });
    return () => {
      isMounted = false;
    };
  }, [connection, currentPlatformFeeSol, isMainnet, prioritySpeed]);

  const handleInputChange = (e) => {
    setStepError('');
    const { name, value } = e.target;
    let finalValue = value;
    if (name === 'symbol' || name === 'ticker') {
      finalValue = value.toUpperCase();
    }
    setFormData((prev) => ({ ...prev, [name]: finalValue }));
  };

  const handleImageFile = (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setStepError('Image size exceeds 5MB limit.');
      return;
    }
    setStepError('');
    setFormData((prev) => ({ ...prev, image: file }));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageFile(e.dataTransfer.files[0]);
    }
  };

  // Step 1 Validation
  const isStep1Valid = useMemo(() => {
    const hasName = formData.name && formData.name.trim().length > 0 && formData.name.trim().length <= 32;
    const symbolStr = (formData.symbol || formData.ticker || '').trim();
    const hasSymbol = symbolStr.length > 0 && symbolStr.length <= 10;
    const rawDecStr = String(formData.decimals ?? '6').trim();
    const validDecimals = /^[0-9]$/.test(rawDecStr);
    const supplyNum = Number(String(formData.supply || '').replace(/,/g, ''));
    const validSupply = !Number.isNaN(supplyNum) && supplyNum > 0;
    return hasName && hasSymbol && validDecimals && validSupply;
  }, [formData.name, formData.symbol, formData.ticker, formData.decimals, formData.supply]);

  // Overall validity for submission
  const isFormValid = isStep1Valid;

  const handleNextStep = () => {
    setStepError('');
    if (currentStep === 1) {
      if (!isStep1Valid) {
        if (!formData.name?.trim()) {
          setStepError('Please enter a Token Name (max 32 chars).');
          return;
        }
        if (!(formData.symbol || formData.ticker)?.trim()) {
          setStepError('Please enter a Token Symbol / Ticker (max 10 chars).');
          return;
        }
        setStepError('Please enter valid Decimals (0-9) and Total Supply (> 0).');
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      setCurrentStep(3);
    } else if (currentStep === 3) {
      setCurrentStep(4);
    }
  };

  const handlePrevStep = () => {
    setStepError('');
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStepClick = (stepId) => {
    // Only allow navigating forward to steps if prerequisites are met
    if (stepId > 1 && !isStep1Valid) {
      setStepError('Please complete Token Basics (Name, Symbol, Supply) first.');
      return;
    }
    setStepError('');
    setCurrentStep(stepId);
  };

  const handleCreateToken = async () => {
    if (isSubmittingRef.current) return;

    if (!connected || !publicKey) {
      setVisible(true);
      return;
    }

    if (!isFormValid) {
      setCurrentStep(1);
      setStepError('Please verify Token Name, Symbol, and Supply.');
      return;
    }

    const launchWalletAddress = publicKey.toBase58();
    isSubmittingRef.current = true;

    try {
      onLaunchStart();

      // Step 1: Upload Metadata to Backend
      onLaunchProgress('uploading', 'Pinning token logo and metadata to IPFS...');
      const uploadData = new FormData();
      uploadData.append('name', formData.name.trim());
      uploadData.append('symbol', (formData.symbol || formData.ticker).trim().toUpperCase());
      uploadData.append('description', (formData.description || '').trim());
      const rawDecStr = String(formData.decimals ?? '6').trim();
      const safeDecimalsVal = /^[0-9]$/.test(rawDecStr) ? Number(rawDecStr) : 6;
      uploadData.append('decimals', String(safeDecimalsVal));
      uploadData.append('supply', String(formData.supply || '1000000000').replace(/,/g, ''));
      uploadData.append('website', (formData.website || '').trim());
      uploadData.append('twitter', (formData.twitter || '').trim());
      uploadData.append('telegram', (formData.telegram || '').trim());
      uploadData.append('discord', (formData.discord || '').trim());

      if (formData.image instanceof File) {
        uploadData.append('image', formData.image);
      }

      const metaRes = await fetch('/api/upload-metadata', {
        method: 'POST',
        body: uploadData,
      });

      if (!metaRes.ok) {
        const errJson = await metaRes.json().catch(() => ({}));
        throw new Error(errJson.error || `Metadata upload failed with status ${metaRes.status}`);
      }

      const metaJson = await metaRes.json();
      if (!metaJson.success) {
        throw new Error(metaJson.error || 'Metadata upload returned unsuccessful response');
      }

      const metadataUri = metaJson.metadataUri;

      // Verify wallet has not drifted/switched during the asynchronous metadata upload
      if (!wallet.publicKey || wallet.publicKey.toBase58() !== launchWalletAddress) {
        throw new Error('Connected wallet was switched or disconnected during upload. Launch aborted for safety.');
      }

      // Step 2: Client-side Atomic Token Creation
      const result = await createSolanaToken({
        connection,
        wallet,
        tokenConfig: {
          name: formData.name.trim(),
          symbol: (formData.symbol || formData.ticker).trim().toUpperCase(),
          decimals: Number.isNaN(safeDecimalsVal) ? 6 : safeDecimalsVal,
          supply: String(formData.supply || '1000000000').replace(/,/g, ''),
          metadataUri,
          revokeFreeze: securityOptions.revokeFreeze,
          revokeMint: securityOptions.revokeMint,
          immutable: securityOptions.immutable,
          priorityFeeMicroLamports: PRIORITY_FEE_MAP[prioritySpeed] || 250000,
          platformFeeSol: currentPlatformFeeSol,
        },
        onProgress: (step, msg) => {
          onLaunchProgress(step, msg);
        },
      });

      onLaunchSuccess(result);
    } catch (err) {
      console.error('Token launch error:', err);
      onLaunchError(err);
    } finally {
      isSubmittingRef.current = false;
    }
  };

  useEffect(() => {
    if (triggerSubmitRef) {
      triggerSubmitRef.current = handleCreateToken;
    }
  });

  const progressPercentage = (currentStep / STEPS.length) * 100;

  return (
    <Card className="shiny-card relative w-full shadow-2xl overflow-hidden rounded-2xl">
      {/* Liquid Gold Border Beam (Magic UI) */}
      <BorderBeam size={300} duration={14} colorFrom="#f59e0b" colorTo="#fbbf24" borderWidth={1.5} />

      {/* Top Header */}
      <CardHeader className="border-b border-zinc-800/80 pb-4 relative z-10">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-black text-white flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-amber-400" /> Token Generator
            </CardTitle>
            <CardDescription className="text-zinc-400 text-sm mt-0.5">
              {isAdmin
                ? '👑 Admin mode active: Zero platform fee applied across all configurations.'
                : 'Deploy your SPL or meme coin in 4 easy steps with all security revocations included.'}
            </CardDescription>
          </div>
          {isAdmin ? (
            <span
              title={adminRoleReason || 'Admin exemption active'}
              className="inline-flex items-center gap-1.5 text-xs font-sans px-3 py-1 rounded-full bg-amber-950/60 border border-amber-500/40 text-amber-300 font-bold shadow-xs"
            >
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span>Admin Mode (0 SOL)</span>
            </span>
          ) : (
            <span className="hidden sm:inline-flex items-center gap-1 text-xs font-sans px-2.5 py-1 rounded-full shiny-pill text-zinc-300">
              <Coins className="w-3.5 h-3.5 text-amber-400" /> Flat 0.15 SOL Bundle
            </span>
          )}
        </div>

        {/* Visual Stepper Progression Bar */}
        <div className="mt-4 pt-2">
          {/* Progress Bar Line */}
          <div className="w-full bg-gray-950 h-1.5 rounded-full overflow-hidden border border-zinc-800/80 mb-3">
            <div
              className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 transition-all duration-300 ease-out shadow-xs shadow-amber-500/40"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          {/* Stepper Buttons */}
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
            {STEPS.map((s) => {
              const StepIcon = s.icon;
              const isActive = currentStep === s.id;
              const isPassed = currentStep > s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleStepClick(s.id)}
                  aria-label={`Step ${s.id}: ${s.name} (${s.description})`}
                  aria-current={isActive ? 'step' : undefined}
                  aria-disabled={s.id > 1 && !isStep1Valid ? true : undefined}
                  title={s.id > 1 && !isStep1Valid ? 'Complete Token Basics first' : undefined}
                  className={`flex items-center justify-center sm:justify-start gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-amber-950/60 border border-amber-500/60 text-amber-200 ring-1 ring-amber-500/30'
                      : isPassed
                      ? 'bg-gray-950 border border-amber-900/40 text-amber-400/90 hover:border-amber-700/50'
                      : 'bg-gray-950/60 border border-gray-800/60 text-gray-500 hover:text-gray-400'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-sans font-bold shrink-0 ${
                      isActive
                        ? 'bg-amber-400 text-black'
                        : isPassed
                        ? 'bg-amber-950 text-amber-300 border border-amber-500/30'
                        : 'bg-gray-800 text-gray-400'
                    }`}
                  >
                    {isPassed ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : s.id}
                  </span>
                  <span className="sr-only sm:not-sr-only font-sans truncate">{s.name}</span>
                </button>
              );
            })}
          </div>

          {/* Current Step Descriptor */}
          <div className="flex items-center justify-between text-xs text-gray-400 mt-2 px-1">
            <span className="font-sans text-amber-400 font-semibold flex items-center gap-1.5">
              Step {currentStep} of 4: {STEPS[currentStep - 1].label}
            </span>
            <span className="text-[11px] text-gray-400 font-sans">
              {currentStep === 1 && 'Token identity & supply'}
              {currentStep === 2 && 'Logo & community lore'}
              {currentStep === 3 && 'On-chain security & speed'}
              {currentStep === 4 && 'Pre-flight verification'}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        {stepError && (
          <div
            role="alert"
            aria-live="polite"
            className="flex items-center gap-2 p-3 bg-red-950/40 border border-red-500/40 rounded-lg text-xs text-red-300 animate-fadeIn"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{stepError}</span>
          </div>
        )}

        {/* STEP 1: TOKEN BASICS */}
        {currentStep === 1 && (
          <div className="space-y-5 animate-fadeIn">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-medium text-gray-300 flex justify-between">
                  <span>Token Name <span className="text-amber-400">*</span></span>
                  <span className="text-[10px] text-gray-400 font-sans">{formData.name?.length || 0}/32</span>
                </Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="e.g., Solana Cat"
                  value={formData.name || ''}
                  onChange={handleInputChange}
                  maxLength={32}
                  className="bg-gray-950 border-gray-800 text-white placeholder-gray-600 focus:border-amber-400 font-sans"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="symbol" className="text-xs font-medium text-gray-300 flex justify-between">
                  <span>Symbol / Ticker <span className="text-amber-400">*</span></span>
                  <span className="text-[10px] text-gray-400 font-sans">{(formData.symbol || formData.ticker)?.length || 0}/10</span>
                </Label>
                <Input
                  id="symbol"
                  name="symbol"
                  placeholder="e.g., SCAT"
                  value={formData.symbol || formData.ticker || ''}
                  onChange={handleInputChange}
                  maxLength={10}
                  className="bg-gray-950 border-gray-800 font-sans font-bold text-amber-300 uppercase placeholder-gray-600 focus:border-amber-400"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor="decimals" className="text-xs font-medium text-gray-300">
                    Decimals
                  </Label>
                  <span className="text-[10px] text-gray-400 font-sans">6 (Meme) or 9 (SPL)</span>
                </div>
                <Input
                  id="decimals"
                  name="decimals"
                  type="number"
                  min="0"
                  max="9"
                  placeholder="6"
                  value={formData.decimals ?? '6'}
                  onChange={handleInputChange}
                  className="bg-gray-950 border-gray-800 font-sans text-white focus:border-amber-400"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor="supply" className="text-xs font-medium text-gray-300">
                    Total Supply <span className="text-amber-400">*</span>
                  </Label>
                  <span className="text-[10px] text-amber-400 font-sans font-medium">100% to creator ATA</span>
                </div>
                <Input
                  id="supply"
                  name="supply"
                  type="text"
                  placeholder="1000000000"
                  value={formData.supply ?? '1000000000'}
                  onChange={handleInputChange}
                  className="bg-gray-950 border-gray-800 font-sans text-white focus:border-amber-400"
                  required
                />
              </div>
            </div>

            <div className="p-3 bg-gray-950/70 border border-gray-800/80 rounded-xl text-xs text-gray-300 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Standard meme coins typically launch with <strong>1,000,000,000</strong> supply and <strong>6 decimals</strong>.
                100% of supply is minted straight into your wallet with zero platform custody.
              </span>
            </div>
          </div>
        )}

        {/* STEP 2: MEDIA & COMMUNITY */}
        {currentStep === 2 && (
          <div className="space-y-5 animate-fadeIn">
            {/* Logo / Image Upload */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-300">Token Logo (IPFS Pinned)</Label>
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className="flex items-center justify-center w-full"
              >
                <div
                  tabIndex={0}
                  role="button"
                  aria-label="Upload token logo image (PNG, JPG, WebP, GIF, or SVG up to 5MB)"
                  onClick={() => document.getElementById('image-upload')?.click()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      document.getElementById('image-upload')?.click();
                    }
                  }}
                  className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-zinc-800 hover:border-amber-500/60 focus:border-amber-400 focus:outline-hidden focus:ring-1 focus:ring-amber-500/40 rounded-xl cursor-pointer bg-gray-950/60 hover:bg-gray-950 transition-colors p-4"
                >
                  {imagePreviewUrl ? (
                    <div className="flex items-center gap-4">
                      <img
                        src={imagePreviewUrl}
                        alt="Logo preview"
                        className="w-20 h-20 rounded-full object-cover border-2 border-amber-500/50 shadow-md"
                      />
                      <div className="text-left">
                        <p className="text-sm font-semibold text-white">Logo Selected</p>
                        <p className="text-xs text-amber-400">Click or press Enter to replace image</p>
                        <p className="text-[10px] text-gray-400 mt-1">Pinned to decentralized IPFS storage</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center">
                      <Upload className="w-8 h-8 mb-2 text-zinc-500" />
                      <p className="text-sm text-gray-300 font-medium">
                        <span className="text-amber-400">Click or press Enter to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-400 mt-1">PNG, JPG, WebP, GIF, or SVG (Square, up to 5MB)</p>
                    </div>
                  )}
                  <input
                    id="image-upload"
                    type="file"
                    className="hidden"
                    accept="image/png, image/jpeg, image/gif, image/webp, image/svg+xml"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleImageFile(e.target.files[0]);
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-xs font-medium text-gray-300 flex justify-between">
                <span>Description / Community Lore</span>
                <span className="text-[10px] text-gray-400 font-sans">{formData.description?.length || 0}/500</span>
              </Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Describe your coin, community lore, or mission..."
                value={formData.description || ''}
                onChange={handleInputChange}
                rows={3}
                maxLength={500}
                className="bg-gray-950 border-gray-800 text-white placeholder-gray-600 focus:border-amber-400 resize-none text-sm font-sans"
              />
            </div>

            {/* Social Links */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider font-sans">
                  Social Links (Optional)
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  name="website"
                  aria-label="Website URL"
                  placeholder="Website URL (https://...)"
                  value={formData.website || ''}
                  onChange={handleInputChange}
                  maxLength={100}
                  className="bg-gray-950 border-gray-800 text-xs text-white placeholder-gray-600 font-sans focus:border-amber-400"
                />
                <Input
                  name="twitter"
                  aria-label="Twitter or X handle or profile URL"
                  placeholder="Twitter / X (@handle or URL)"
                  value={formData.twitter || ''}
                  onChange={handleInputChange}
                  maxLength={100}
                  className="bg-gray-950 border-gray-800 text-xs text-white placeholder-gray-600 font-sans focus:border-amber-400"
                />
                <Input
                  name="telegram"
                  aria-label="Telegram group or channel invite"
                  placeholder="Telegram Link (t.me/...)"
                  value={formData.telegram || ''}
                  onChange={handleInputChange}
                  maxLength={100}
                  className="bg-gray-950 border-gray-800 text-xs text-white placeholder-gray-600 font-sans focus:border-amber-400"
                />
                <Input
                  name="discord"
                  aria-label="Discord server invite link"
                  placeholder="Discord Invite Link"
                  value={formData.discord || ''}
                  onChange={handleInputChange}
                  maxLength={100}
                  className="bg-gray-950 border-gray-800 text-xs text-white placeholder-gray-600 font-sans focus:border-amber-400"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: SECURITY & PRIORITY SPEED */}
        {currentStep === 3 && (
          <div className="space-y-5 animate-fadeIn">
            {/* Security Controls */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider font-sans flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-400" /> Authority & RugCheck Controls
                </span>
                <span className="text-[11px] font-sans">
                  {isAdmin ? (
                    <span className="text-amber-300 font-bold">👑 Admin Exemption (0.00 SOL)</span>
                  ) : customizationCount === 0 ? (
                    <span className="text-amber-300 font-bold">✓ 100% Free Bundled (0.15 SOL)</span>
                  ) : (
                    <span className="text-amber-400 font-bold">+{ (customizationCount * 0.05).toFixed(2) } SOL Customization</span>
                  )}
                </span>
              </div>

              <div className="space-y-2.5 bg-gray-950/70 p-3.5 rounded-xl border border-gray-800/80">
                {/* Revoke Freeze */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 pr-2">
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor="switch-revoke-freeze" className="text-xs font-semibold text-white cursor-pointer font-sans">Revoke Freeze Authority</Label>
                      {securityOptions.revokeFreeze ? (
                        <span className="text-[10px] bg-amber-950/80 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/30 font-sans font-medium">
                          ✓ Bundled Free
                        </span>
                      ) : isAdmin ? (
                        <span className="text-[10px] bg-amber-950/80 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/30 font-sans font-medium">
                          👑 Admin (0 SOL)
                        </span>
                      ) : (
                        <span className="text-[10px] bg-amber-950 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/40 font-sans font-medium">
                          +0.05 SOL Custom
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 font-sans">
                      Required for Raydium liquidity pool creation and verified DexScreener/RugCheck score.
                    </p>
                  </div>
                  <Switch
                    id="switch-revoke-freeze"
                    checked={securityOptions.revokeFreeze}
                    onCheckedChange={(checked) =>
                      setSecurityOptions((prev) => ({ ...prev, revokeFreeze: checked }))
                    }
                  />
                </div>

                {/* Revoke Mint */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-800/60">
                  <div className="space-y-0.5 pr-2">
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor="switch-revoke-mint" className="text-xs font-semibold text-white cursor-pointer font-sans">Revoke Mint Authority</Label>
                      {securityOptions.revokeMint ? (
                        <span className="text-[10px] bg-amber-950/80 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/30 font-sans font-medium">
                          ✓ Bundled Free
                        </span>
                      ) : isAdmin ? (
                        <span className="text-[10px] bg-amber-950/80 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/30 font-sans font-medium">
                          👑 Admin (0 SOL)
                        </span>
                      ) : (
                        <span className="text-[10px] bg-amber-950 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/40 font-sans font-medium">
                          +0.05 SOL Custom
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 font-sans">
                      Caps total supply forever. No more tokens can ever be minted, eliminating inflation risk.
                    </p>
                  </div>
                  <Switch
                    id="switch-revoke-mint"
                    checked={securityOptions.revokeMint}
                    onCheckedChange={(checked) =>
                      setSecurityOptions((prev) => ({ ...prev, revokeMint: checked }))
                    }
                  />
                </div>

                {/* Immutable Metadata */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-800/60">
                  <div className="space-y-0.5 pr-2">
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor="switch-immutable" className="text-xs font-semibold text-white cursor-pointer font-sans">Immutable Metadata</Label>
                      {securityOptions.immutable ? (
                        <span className="text-[10px] bg-amber-950/80 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/30 font-sans font-medium">
                          ✓ Bundled Free
                        </span>
                      ) : isAdmin ? (
                        <span className="text-[10px] bg-amber-950/80 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/30 font-sans font-medium">
                          👑 Admin (0 SOL)
                        </span>
                      ) : (
                        <span className="text-[10px] bg-amber-950 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/40 font-sans font-medium">
                          +0.05 SOL Custom
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 font-sans">
                      Permanently locks token name, symbol, logo, and IPFS metadata against tampering.
                    </p>
                  </div>
                  <Switch
                    id="switch-immutable"
                    checked={securityOptions.immutable}
                    onCheckedChange={(checked) =>
                      setSecurityOptions((prev) => ({ ...prev, immutable: checked }))
                    }
                  />
                </div>
              </div>
            </div>

            {/* Priority Fee Speed */}
            <div className="space-y-2 pt-2 border-t border-gray-800/80">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider font-sans flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-400" /> Transaction Priority Fee
                </span>
                <span className="text-[11px] text-gray-400 font-sans">High-priority compute budget for fast confirmation</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'normal', name: 'Normal', fee: '~0.00001 SOL' },
                  { id: 'fast', name: 'Fast', fee: '~0.00005 SOL' },
                  { id: 'turbo', name: 'Turbo', fee: '~0.00020 SOL' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPrioritySpeed(p.id)}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      prioritySpeed === p.id
                        ? 'bg-amber-950/60 border-amber-500 text-white shadow-xs ring-1 ring-amber-500/30'
                        : 'bg-gray-950 border-gray-800 text-gray-400 hover:border-gray-700'
                    }`}
                  >
                    <div className="text-xs font-bold font-sans">{p.name}</div>
                    <div className="text-[10px] text-gray-400 font-sans mt-0.5">{p.fee}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: REVIEW & LAUNCH */}
        {currentStep === 4 && (
          <div className="space-y-5 animate-fadeIn">
            {/* Pre-flight Overview Card */}
            <div className="bg-gray-950/80 rounded-xl p-4 border border-gray-800/90 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-800/80 pb-3">
                <div className="flex items-center gap-3">
                  {imagePreviewUrl ? (
                    <img
                      src={imagePreviewUrl}
                      alt="Logo"
                      className="w-12 h-12 rounded-full object-cover border border-amber-500/50 shadow-md"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center text-gray-500">
                      <Coins className="w-6 h-6" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2 font-sans">
                      {formData.name || 'Unnamed Coin'}
                      <span className="text-sm font-sans font-bold text-amber-300">
                        ${(formData.symbol || formData.ticker || 'COIN').toUpperCase()}
                      </span>
                    </h3>
                    <p className="text-xs text-gray-400 font-sans">
                      Supply: {Number(formData.supply || 1000000000).toLocaleString()} • {formData.decimals ?? 6} Decimals
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentStep(1)}
                  className="text-xs text-amber-400 hover:text-amber-300 font-sans"
                >
                  Edit
                </Button>
              </div>

              {/* Security Checklist */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="p-2.5 bg-gray-900/60 rounded-lg border border-gray-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-gray-300 font-sans">
                    Freeze: <strong>{securityOptions.revokeFreeze ? 'Revoked' : 'Retained'}</strong>
                  </span>
                </div>
                <div className="p-2.5 bg-gray-900/60 rounded-lg border border-gray-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-gray-300 font-sans">
                    Mint: <strong>{securityOptions.revokeMint ? 'Revoked' : 'Retained'}</strong>
                  </span>
                </div>
                <div className="p-2.5 bg-gray-900/60 rounded-lg border border-gray-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-gray-300 font-sans">
                    Metadata: <strong>{securityOptions.immutable ? 'Immutable' : 'Mutable'}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Total Cost Breakdown Card */}
            <div className="bg-gray-950/90 rounded-xl p-4 border border-gray-800/90 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400 font-sans uppercase tracking-wider font-semibold">
                  Total Service Outlay
                </span>
                <span className="text-amber-300 font-sans text-xs font-bold">
                  {isAdmin ? '👑 Admin Exemption' : 'All-Inclusive Bundle'}
                </span>
              </div>

              <div className="flex items-baseline justify-between pt-1">
                <div>
                  <div className="text-3xl font-extrabold text-white font-sans flex items-center gap-2">
                    {isAdmin ? '0.00 SOL' : `${currentPlatformFeeSol.toFixed(2)} SOL`}
                    {isAdmin && (
                      <span className="text-xs font-normal text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-500/30 flex items-center gap-1 font-sans">
                        <Crown className="w-3 h-3 text-amber-400" /> Admin Mode
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1 font-sans">
                    {isAdmin
                      ? '👑 Platform fee waived (0.00 SOL). Pure raw network cost.'
                      : customizationCount === 0
                      ? 'Flat fee • Zero upsells • All revocations included'
                      : `0.15 SOL flat base + ${(customizationCount * 0.05).toFixed(2)} SOL customization`}
                  </p>
                </div>
                <div className="text-right text-[11px] text-gray-400 font-sans">
                  + network gas & rent ~0.0168 SOL
                </div>
              </div>

              {/* Itemized Rent & Gas Transparency */}
              <div className="pt-3 border-t border-gray-800/80 grid grid-cols-2 gap-2 text-[11px] text-gray-300 font-sans">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Token Mint & 100% Supply</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>IPFS Metadata Pinning</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Freeze Authority Revocation</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Mint Authority Revocation</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP CONTROLS / NAVIGATION BUTTONS (Stacked cleanly on mobile - Sol U01) */}
        <div className="pt-4 border-t border-zinc-800/80 flex flex-col-reverse sm:flex-row items-center justify-between gap-3 relative z-10">
          {currentStep > 1 ? (
            <Button
              type="button"
              variant="outline"
              onClick={handlePrevStep}
              className="w-full sm:w-auto shiny-button rounded-xl text-zinc-300 hover:text-white font-sans text-xs px-4"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
            </Button>
          ) : (
            <div />
          )}

          {currentStep < 4 ? (
            <Button
              type="button"
              onClick={handleNextStep}
              className="w-full sm:w-auto bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-black font-black text-xs font-sans ml-auto shadow-[0_0_20px_rgba(245,158,11,0.3)] rounded-xl px-5"
            >
              Next: {STEPS[currentStep].name} <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          ) : (
            <div className="w-full sm:w-auto ml-auto">
              {!connected ? (
                <Button
                  type="button"
                  onClick={() => setVisible(true)}
                  className="w-full sm:w-auto h-11 px-6 text-sm font-black bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black shadow-[0_0_25px_rgba(245,158,11,0.4)] transition-all cursor-pointer rounded-xl font-sans"
                >
                  <Wallet className="w-4 h-4 mr-2" /> Connect Wallet to Launch
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleCreateToken}
                  disabled={!isFormValid}
                  className="w-full sm:w-auto h-11 px-8 text-sm font-black bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-black shadow-[0_0_25px_rgba(245,158,11,0.4)] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-sans"
                >
                  <Rocket className="w-4 h-4 mr-2" />
                  {!isFormValid
                    ? 'Verify Name, Symbol & Supply'
                    : isAdmin
                    ? `Create $${(formData.symbol || formData.ticker || 'COIN').toUpperCase()} (0.00 SOL)`
                    : `Create $${(formData.symbol || formData.ticker || 'COIN').toUpperCase()} (${currentPlatformFeeSol.toFixed(2)} SOL)`}
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TokenForm;
