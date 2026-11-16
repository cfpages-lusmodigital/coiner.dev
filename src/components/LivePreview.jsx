// src/components/LivePreview.jsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ImageIcon,
  ShieldCheck,
  Globe,
  Send,
  Flame,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Crown,
} from 'lucide-react';
import { useAdminStatus } from '@/lib/clerk';

const LivePreview = ({ formData, advancedOptions = {} }) => {
  const { isAdmin } = useAdminStatus();
  const {
    name = '',
    symbol = '',
    ticker = '',
    description = '',
    image = null,
    supply = '1000000000',
    decimals = '6',
    website = '',
    twitter = '',
    telegram = '',
    discord = '',
  } = formData;

  const displayTicker = (symbol || ticker || 'TOKEN').toUpperCase();
  const displayName = name || 'Meme Coin Name';
  const displaySupply = Number(supply || 0).toLocaleString();

  const previewImage =
    typeof image === 'string'
      ? image
      : image instanceof File
      ? URL.createObjectURL(image)
      : null;

  return (
    <div className="w-full space-y-6 sticky top-24">
      {/* Live Card Preview */}
      <Card className="w-full bg-gray-900/90 border border-gray-800 shadow-xl overflow-hidden backdrop-blur-sm">
        <div className="h-2 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 bg-emerald-950/70 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
              Live Dex / Explorer Preview
            </span>
            <span className="text-xs text-gray-400 font-mono">SPL Token</span>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center text-center space-y-4 pt-2">
          <Avatar className="w-28 h-28 border-2 border-emerald-500/40 shadow-lg">
            <AvatarImage src={previewImage} alt={displayName} className="object-cover" />
            <AvatarFallback className="bg-gray-800">
              <ImageIcon className="w-12 h-12 text-gray-500" />
            </AvatarFallback>
          </Avatar>

          <div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              {displayName}
            </h2>
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className="text-lg font-bold text-emerald-400 font-mono">
                ${displayTicker}
              </span>
              <span className="text-xs text-gray-500 font-mono">• {decimals} Decimals</span>
            </div>
          </div>

          <p className="text-xs text-gray-300 min-h-[48px] max-w-sm line-clamp-3 leading-relaxed px-2">
            {description || 'Your coin story, mission, and viral meme lore will be permanently recorded in off-chain IPFS metadata.'}
          </p>

          {/* Social Badges */}
          <div className="flex items-center gap-2 pt-1">
            {website ? (
              <span className="p-1.5 rounded-full bg-gray-800 text-emerald-400 border border-gray-700">
                <Globe className="w-3.5 h-3.5" />
              </span>
            ) : null}
            {twitter ? (
              <span className="p-1.5 rounded-full bg-gray-800 text-sky-400 border border-gray-700 font-bold text-xs">
                𝕏
              </span>
            ) : null}
            {telegram ? (
              <span className="p-1.5 rounded-full bg-gray-800 text-cyan-400 border border-gray-700">
                <Send className="w-3.5 h-3.5" />
              </span>
            ) : null}
          </div>

          {/* Token Stats Grid */}
          <div className="grid grid-cols-2 gap-2 w-full pt-2 border-t border-gray-800/80 text-left">
            <div className="bg-gray-950/60 p-2.5 rounded-lg border border-gray-800/60">
              <span className="text-[10px] text-gray-400 uppercase font-mono block">Total Supply</span>
              <span className="text-sm font-bold text-white font-mono truncate block">
                {displaySupply}
              </span>
            </div>
            <div className="bg-gray-950/60 p-2.5 rounded-lg border border-gray-800/60">
              <span className="text-[10px] text-gray-400 uppercase font-mono block">Your Allocation</span>
              <span className="text-sm font-bold text-emerald-400 font-mono block">
                100% (Creator ATA)
              </span>
            </div>
          </div>

          {/* RugCheck / Security Score Simulation */}
          <div className="w-full bg-emerald-950/30 border border-emerald-500/20 rounded-lg p-3 text-left space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> RugCheck Predicted Score
              </span>
              <span
                className={`text-xs font-bold font-mono px-2 py-0.5 rounded border ${
                  formData.revokeFreeze !== false &&
                  formData.revokeMint !== false &&
                  formData.immutable !== false
                    ? 'text-emerald-300 bg-emerald-900/60 border-emerald-500/30'
                    : 'text-amber-300 bg-amber-900/60 border-amber-500/30'
                }`}
              >
                {formData.revokeFreeze !== false &&
                formData.revokeMint !== false &&
                formData.immutable !== false
                  ? 'GOOD (A-GRADE)'
                  : 'CAUTION (CUSTOM)'}
              </span>
            </div>
            <div className="text-[11px] text-gray-300 space-y-1 pt-1">
              <div className="flex items-center gap-1.5">
                {formData.revokeFreeze !== false ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span>Freeze Authority: <strong>Revoked</strong> (Raydium ready)</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
                    <span className="text-amber-200">Freeze Authority: <strong>Retained</strong> (+0.05 SOL custom)</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {formData.revokeMint !== false ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span>Mint Authority: <strong>Revoked</strong> (No inflation)</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
                    <span className="text-amber-200">Mint Authority: <strong>Retained</strong> (+0.05 SOL custom)</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {formData.immutable !== false ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span>Metadata: <strong>Immutable</strong> (Permanent)</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
                    <span className="text-amber-200">Metadata: <strong>Mutable</strong> (+0.05 SOL custom)</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cost Comparison Widget */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-white flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-amber-400" /> Platform Fee Comparison
          </span>
          <span className="text-emerald-400 font-mono font-bold">
            {isAdmin ? '👑 100% Free' : 'Zero Upsell • 100% Bundled'}
          </span>
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center bg-gray-900/80 p-2 rounded border border-emerald-500/30">
            <span className="text-gray-300 font-medium flex items-center gap-1">
              coiner.dev (Bundled):
              {isAdmin && <Crown className="w-3 h-3 text-amber-400" />}
            </span>
            <span className="font-mono text-emerald-400 font-bold">
              {isAdmin ? '0.00 SOL (Gas Only)' : '0.15 SOL Flat Fee'}
            </span>
          </div>
          <div className="flex justify-between items-center bg-gray-950/40 p-2 rounded border border-gray-800 text-gray-400">
            <span>Smithii / Orion (with Revocations):</span>
            <span className="font-mono text-red-400 line-through">0.40 – 0.80 SOL</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LivePreview;
