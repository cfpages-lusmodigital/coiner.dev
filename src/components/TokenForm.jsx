// src/components/TokenForm.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Upload,
  ShieldCheck,
  Zap,
  Info,
  CheckCircle2,
  Lock,
  Globe,
  Sparkles,
  Coins,
  Crown,
  Wallet,
} from 'lucide-react';
import { createSolanaToken, estimateRentCosts } from '@/lib/solana';
import { useAdminStatus, calculatePlatformFee, BASE_PUBLIC_FEE_SOL, CUSTOMIZATION_SURCHARGE_SOL } from '@/lib/clerk';

const PRIORITY_FEE_MAP = {
  normal: 50000,   // ~0.0000125 SOL at 250k CU
  fast: 250000,    // ~0.0000625 SOL at 250k CU
  turbo: 1000000,  // ~0.0002500 SOL at 250k CU
};

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

  // Calculate dynamic platform fee: 0.15 SOL bundled baseline; +0.05 SOL per kept authority if customized
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

  useEffect(() => {
    if (triggerSubmitRef) {
      triggerSubmitRef.current = handleCreateToken;
    }
  });

  const handleInputChange = (e) => {
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
      alert('Image size exceeds 5MB limit.');
      return;
    }
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

  // Priority fee mapping in microLamports
  const priorityFeeMap = {
    normal: 50000,   // ~0.00001 SOL
    fast: 250000,    // ~0.00005 SOL
    turbo: 1000000,  // ~0.00020 SOL
  };

  const isFormValid =
    formData.name?.trim().length > 0 &&
    (formData.symbol || formData.ticker)?.trim().length > 0 &&
    Number(formData.supply || 0) > 0;

  const handleCreateToken = async () => {
    if (!connected || !publicKey) {
      alert('Please connect your Solana wallet first.');
      return;
    }

    if (!isFormValid) {
      alert('Please fill in Token Name, Symbol, and Supply.');
      return;
    }

    try {
      onLaunchStart();

      // Step 1: Upload Metadata to Backend
      onLaunchProgress('uploading', 'Pinning token logo and metadata to IPFS...');
      const uploadData = new FormData();
      uploadData.append('name', formData.name);
      uploadData.append('symbol', (formData.symbol || formData.ticker).toUpperCase());
      uploadData.append('description', formData.description || '');
      const safeDecimalsVal =
        formData.decimals != null && formData.decimals !== ''
          ? parseInt(String(formData.decimals), 10)
          : 6;

      uploadData.append('decimals', String(Number.isNaN(safeDecimalsVal) ? 6 : safeDecimalsVal));
      uploadData.append('supply', formData.supply || '1000000000');
      uploadData.append('website', formData.website || '');
      uploadData.append('twitter', formData.twitter || '');
      uploadData.append('telegram', formData.telegram || '');
      uploadData.append('discord', formData.discord || '');

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

      // Step 2: Client-side Atomic Token Creation
      const result = await createSolanaToken({
        connection,
        wallet,
        tokenConfig: {
          name: formData.name,
          symbol: (formData.symbol || formData.ticker).toUpperCase(),
          decimals: Number.isNaN(safeDecimalsVal) ? 6 : safeDecimalsVal,
          supply: formData.supply || '1000000000',
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
      onLaunchError(err.message || 'Failed to create token. Please check wallet balance.');
    }
  };

  const imagePreviewUrl =
    typeof formData.image === 'string'
      ? formData.image
      : formData.image instanceof File
      ? URL.createObjectURL(formData.image)
      : null;

  return (
    <Card className="w-full bg-gray-900/90 border border-gray-800 shadow-2xl backdrop-blur-sm">
      <CardHeader className="border-b border-gray-800/80 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-extrabold text-white flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-emerald-400" /> Token Generator
            </CardTitle>
            <CardDescription className="text-gray-400 text-sm mt-0.5">
              {isAdmin
                ? '👑 Admin mode active: Zero platform fee applied.'
                : 'Deploy your SPL or meme coin in 60 seconds with all security revocations included.'}
            </CardDescription>
          </div>
          {isAdmin ? (
            <span
              title={adminRoleReason || 'Admin exemption active'}
              className="inline-flex items-center gap-1.5 text-xs font-mono px-3 py-1 rounded-full bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 font-bold shadow-sm"
            >
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span>Admin Mode</span>
            </span>
          ) : (
            <span className="hidden sm:inline-flex items-center gap-1 text-xs font-mono px-2.5 py-1 rounded-full bg-gray-900 border border-gray-800 text-gray-300">
              <Coins className="w-3.5 h-3.5 text-emerald-400" /> Flat 0.15 SOL (All-Inclusive)
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        {/* Token Basics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs font-medium text-gray-300">
              Token Name <span className="text-emerald-400">*</span>
            </Label>
            <Input
              id="name"
              name="name"
              placeholder="e.g., Solana Cat"
              value={formData.name || ''}
              onChange={handleInputChange}
              maxLength={32}
              className="bg-gray-950 border-gray-800 text-white placeholder-gray-600 focus:border-emerald-500"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="symbol" className="text-xs font-medium text-gray-300">
              Symbol / Ticker <span className="text-emerald-400">*</span>
            </Label>
            <Input
              id="symbol"
              name="symbol"
              placeholder="e.g., SCAT"
              value={formData.symbol || formData.ticker || ''}
              onChange={handleInputChange}
              maxLength={10}
              className="bg-gray-950 border-gray-800 font-mono text-emerald-400 uppercase placeholder-gray-600 focus:border-emerald-500"
              required
            />
          </div>
        </div>

        {/* Decimals & Supply */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <Label htmlFor="decimals" className="text-xs font-medium text-gray-300">
                Decimals
              </Label>
              <span className="text-[10px] text-gray-500">6 (Meme) or 9 (SPL)</span>
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
              className="bg-gray-950 border-gray-800 font-mono text-white focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <Label htmlFor="supply" className="text-xs font-medium text-gray-300">
                Total Supply <span className="text-emerald-400">*</span>
              </Label>
              <span className="text-[10px] text-emerald-400/80">100% minted to you</span>
            </div>
            <Input
              id="supply"
              name="supply"
              type="number"
              min="1"
              placeholder="1000000000"
              value={formData.supply ?? '1000000000'}
              onChange={handleInputChange}
              className="bg-gray-950 border-gray-800 font-mono text-white focus:border-emerald-500"
              required
            />
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label htmlFor="description" className="text-xs font-medium text-gray-300">
            Description / Story
          </Label>
          <Textarea
            id="description"
            name="description"
            placeholder="Describe your coin, community lore, or mission..."
            value={formData.description || ''}
            onChange={handleInputChange}
            rows={3}
            maxLength={500}
            className="bg-gray-950 border-gray-800 text-white placeholder-gray-600 focus:border-emerald-500 resize-none text-sm"
          />
        </div>

        {/* Logo / Image Upload */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-300">Token Logo (IPFS)</Label>
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="flex items-center justify-center w-full"
          >
            <label
              htmlFor="image-upload"
              className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-gray-800 hover:border-emerald-500/60 rounded-xl cursor-pointer bg-gray-950/60 hover:bg-gray-950 transition-colors p-4"
            >
              {imagePreviewUrl ? (
                <div className="flex items-center gap-4">
                  <img
                    src={imagePreviewUrl}
                    alt="Logo preview"
                    className="w-20 h-20 rounded-full object-cover border-2 border-emerald-500/50 shadow-md"
                  />
                  <div className="text-left">
                    <p className="text-sm font-semibold text-white">Logo Selected</p>
                    <p className="text-xs text-gray-400">Click or drag another image to replace</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center">
                  <Upload className="w-8 h-8 mb-2 text-gray-500" />
                  <p className="text-sm text-gray-300 font-medium">
                    <span className="text-emerald-400">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-gray-500 mt-1">PNG, JPG, WebP or GIF (Square, up to 5MB)</p>
                </div>
              )}
              <input
                id="image-upload"
                type="file"
                className="hidden"
                accept="image/png, image/jpeg, image/gif, image/webp"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleImageFile(e.target.files[0]);
                  }
                }}
              />
            </label>
          </div>
        </div>

        {/* Social Links (Collapsible/Accordion or Simple Grid) */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider font-mono">
              Social Links (Optional)
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              name="website"
              placeholder="Website URL (https://...)"
              value={formData.website || ''}
              onChange={handleInputChange}
              className="bg-gray-950 border-gray-800 text-xs text-white placeholder-gray-600"
            />
            <Input
              name="twitter"
              placeholder="Twitter / X (@handle or URL)"
              value={formData.twitter || ''}
              onChange={handleInputChange}
              className="bg-gray-950 border-gray-800 text-xs text-white placeholder-gray-600"
            />
            <Input
              name="telegram"
              placeholder="Telegram Link (t.me/...)"
              value={formData.telegram || ''}
              onChange={handleInputChange}
              className="bg-gray-950 border-gray-800 text-xs text-white placeholder-gray-600"
            />
            <Input
              name="discord"
              placeholder="Discord Invite Link"
              value={formData.discord || ''}
              onChange={handleInputChange}
              className="bg-gray-950 border-gray-800 text-xs text-white placeholder-gray-600"
            />
          </div>
        </div>

        {/* Security & Trust Controls */}
        <div className="space-y-3 pt-2 border-t border-gray-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Security & Authority Controls
            </span>
            <span className="text-[11px] font-mono">
              {customizationCount === 0 ? (
                <span className="text-emerald-400 font-bold">✓ 100% Free Bundled (0.15 SOL)</span>
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
                  <Label className="text-xs font-semibold text-white">Revoke Freeze Authority</Label>
                  {securityOptions.revokeFreeze ? (
                    <span className="text-[10px] bg-emerald-950 text-emerald-400 px-1.5 py-0.2 rounded border border-emerald-500/30">
                      ✓ Bundled Free
                    </span>
                  ) : (
                    <span className="text-[10px] bg-amber-950 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/40">
                      +0.05 SOL Customization
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-400">
                  Required to create Raydium pools and get verified on DexScreener/RugCheck.
                </p>
              </div>
              <Switch
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
                  <Label className="text-xs font-semibold text-white">Revoke Mint Authority</Label>
                  {securityOptions.revokeMint ? (
                    <span className="text-[10px] bg-emerald-950 text-emerald-400 px-1.5 py-0.2 rounded border border-emerald-500/30">
                      ✓ Bundled Free
                    </span>
                  ) : (
                    <span className="text-[10px] bg-amber-950 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/40">
                      +0.05 SOL Customization
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-400">
                  Caps total supply forever. No more tokens can ever be minted.
                </p>
              </div>
              <Switch
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
                  <Label className="text-xs font-semibold text-white">Immutable Metadata</Label>
                  {securityOptions.immutable ? (
                    <span className="text-[10px] bg-emerald-950 text-emerald-400 px-1.5 py-0.2 rounded border border-emerald-500/30">
                      ✓ Bundled Free
                    </span>
                  ) : (
                    <span className="text-[10px] bg-amber-950 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/40">
                      +0.05 SOL Customization
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-400">
                  Permanently locks token name, symbol, logo, and metadata.
                </p>
              </div>
              <Switch
                checked={securityOptions.immutable}
                onCheckedChange={(checked) =>
                  setSecurityOptions((prev) => ({ ...prev, immutable: checked }))
                }
              />
            </div>
          </div>
        </div>

        {/* Priority Fee Selection */}
        <div className="space-y-2 pt-2 border-t border-gray-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" /> Transaction Priority Fee
            </span>
            <span className="text-[11px] text-gray-400 font-mono">Faster Solana inclusion</span>
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
                    ? 'bg-emerald-950/60 border-emerald-500 text-white'
                    : 'bg-gray-950 border-gray-800 text-gray-400 hover:border-gray-700'
                }`}
              >
                <div className="text-xs font-bold">{p.name}</div>
                <div className="text-[10px] text-gray-500 font-mono mt-0.5">{p.fee}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Total Cost Summary Card */}
        <div className="bg-gray-950/90 rounded-xl p-4 border border-gray-800/90 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400 font-mono uppercase tracking-wider font-semibold">
              Total Service Fee
            </span>
            <span className="text-emerald-400 font-mono text-xs font-bold">
              All-Inclusive Bundle
            </span>
          </div>

          <div className="flex items-baseline justify-between pt-1">
            <div>
              <div className="text-3xl font-extrabold text-white font-mono flex items-center gap-2">
                {isAdmin ? '0.00 SOL' : `${currentPlatformFeeSol.toFixed(2)} SOL`}
                {isAdmin && (
                  <span className="text-xs font-normal text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                    <Crown className="w-3 h-3 text-amber-400" /> Admin Mode
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                {isAdmin
                  ? '👑 Platform fee waived (0.00 SOL)'
                  : customizationCount === 0
                  ? 'Flat fee • Zero upsells • All revocations included'
                  : `0.15 SOL flat base + ${(customizationCount * 0.05).toFixed(2)} SOL customization`}
              </p>
            </div>
            <div className="text-right text-[11px] text-gray-500 font-mono">
              + network gas ~0.015 SOL
            </div>
          </div>

          {/* Included Features Pill Grid */}
          <div className="pt-3 border-t border-gray-800/80 grid grid-cols-2 gap-2 text-[11px] text-gray-300">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Token Creation & Supply</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>IPFS Metadata Pinning</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Freeze Authority Revocation</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Mint Authority Revocation</span>
            </div>
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="pt-2">
          {!connected ? (
            <Button
              type="button"
              onClick={() => setVisible(true)}
              className="w-full h-12 text-base font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/50 transition-all cursor-pointer"
            >
              <Wallet className="w-5 h-5 mr-2" /> Connect Wallet to Launch
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleCreateToken}
              disabled={!isFormValid}
              className="w-full h-12 text-base font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {!isFormValid
                ? 'Fill in Token Name, Symbol & Supply'
                : isAdmin
                ? `Create $${(formData.symbol || formData.ticker || 'COIN').toUpperCase()} (0.00 SOL)`
                : `Create $${(formData.symbol || formData.ticker || 'COIN').toUpperCase()} (${currentPlatformFeeSol.toFixed(2)} SOL)`}
            </Button>
          )}
          <p className="text-[11px] text-center text-gray-500 mt-2">
            {isAdmin
              ? '👑 Admin Mode: 0.00 SOL platform fee applied.'
              : '⚡ Instant 1-click launch. Ready for Raydium liquidity pool in under 60 seconds.'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default TokenForm;
