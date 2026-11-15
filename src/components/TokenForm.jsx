// src/components/TokenForm.jsx
import React, { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
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
} from 'lucide-react';
import { createSolanaToken, estimateRentCosts } from '@/lib/solana';

const TokenForm = ({
  formData,
  setFormData,
  onLaunchStart,
  onLaunchProgress,
  onLaunchSuccess,
  onLaunchError,
  network = 'devnet',
}) => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { connected, publicKey } = wallet;

  const [rentCosts, setRentCosts] = useState({
    mintRentSol: '0.00107',
    ataRentSol: '0.00149',
    metadataRentSol: '0.00410',
    estimatedTotalSol: '0.00676',
  });

  const [prioritySpeed, setPrioritySpeed] = useState('fast'); // normal | fast | turbo
  const [securityOptions, setSecurityOptions] = useState({
    revokeFreeze: true,
    revokeMint: true,
    immutable: true,
  });

  // Fetch live rent estimates from connected RPC
  useEffect(() => {
    let isMounted = true;
    estimateRentCosts(connection).then((costs) => {
      if (isMounted) setRentCosts(costs);
    });
    return () => {
      isMounted = false;
    };
  }, [connection]);

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
      uploadData.append('decimals', formData.decimals || '6');
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
          decimals: parseInt(formData.decimals || '6', 10),
          supply: formData.supply || '1000000000',
          metadataUri,
          revokeFreeze: securityOptions.revokeFreeze,
          revokeMint: securityOptions.revokeMint,
          immutable: securityOptions.immutable,
          priorityFeeMicroLamports: priorityFeeMap[prioritySpeed] || 250000,
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
              Atomic Solana token deployment at raw rent-exemption cost. Zero platform fees.
            </CardDescription>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1 text-xs font-mono px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-400">
            <Coins className="w-3.5 h-3.5" /> 100% Raw Gas
          </span>
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
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Rug-Proof Controls (Free)
            </span>
            <span className="text-[11px] text-emerald-400 font-mono">100% Free Included</span>
          </div>

          <div className="space-y-2.5 bg-gray-950/70 p-3.5 rounded-xl border border-gray-800/80">
            {/* Revoke Freeze */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5 pr-2">
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs font-semibold text-white">Revoke Freeze Authority</Label>
                  <span className="text-[10px] bg-emerald-950 text-emerald-400 px-1.5 py-0.2 rounded border border-emerald-500/30">
                    Raydium Essential
                  </span>
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
                  <span className="text-[10px] bg-emerald-950 text-emerald-400 px-1.5 py-0.2 rounded border border-emerald-500/30">
                    Zero Inflation
                  </span>
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
                  <span className="text-[10px] bg-emerald-950 text-emerald-400 px-1.5 py-0.2 rounded border border-emerald-500/30">
                    Permanent
                  </span>
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

        {/* Live Rent Cost Breakdown */}
        <div className="bg-gray-950 rounded-xl p-4 border border-gray-800/90 space-y-2">
          <div className="flex items-center justify-between text-xs pb-2 border-b border-gray-800">
            <span className="text-gray-400 font-mono uppercase">Cost Breakdown (On-Chain Rent)</span>
            <span className="text-emerald-400 font-mono font-bold">100% Transparent</span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-gray-400">
              <span>SPL Mint Account (82 bytes):</span>
              <span className="font-mono">{rentCosts.mintRentSol} SOL</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Creator Token ATA (165 bytes):</span>
              <span className="font-mono">{rentCosts.ataRentSol} SOL</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Metaplex Metadata PDA (~679 bytes):</span>
              <span className="font-mono">{rentCosts.metadataRentSol} SOL</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Priority & Network Fee:</span>
              <span className="font-mono">~0.00010 SOL</span>
            </div>
            <div className="flex justify-between text-emerald-400 font-semibold pt-1 border-t border-gray-800/60">
              <span>coiner.dev Platform Service Fee:</span>
              <span className="font-mono">0.00000 SOL (FREE)</span>
            </div>
            <div className="flex justify-between text-white font-bold text-sm pt-2 border-t border-gray-800">
              <span>Total Estimated Network Cost:</span>
              <span className="font-mono text-emerald-400">{rentCosts.estimatedTotalSol} SOL</span>
            </div>
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="pt-2">
          <Button
            onClick={handleCreateToken}
            disabled={!connected || !isFormValid}
            className="w-full h-12 text-base font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {!connected
              ? 'Connect Solana Wallet to Launch'
              : !isFormValid
              ? 'Fill in Token Name, Symbol & Supply'
              : `Create $${(formData.symbol || formData.ticker || 'COIN').toUpperCase()} (~${rentCosts.estimatedTotalSol} SOL)`}
          </Button>
          <p className="text-[11px] text-center text-gray-500 mt-2">
            No smart contract lockup. You retain 100% of supply in your own wallet immediately.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default TokenForm;
