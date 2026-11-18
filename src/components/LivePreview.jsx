// src/components/LivePreview.jsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CardContainer, CardBody, CardItem } from '@/components/ui/3d-card';
import { GoldCoin3D } from '@/components/ui/GoldCoin3D';
import {
  ImageIcon,
  ShieldCheck,
  Globe,
  Send,
  Flame,
  CheckCircle2,
  AlertCircle,
  Crown,
  Sparkles,
} from 'lucide-react';
import { useAdminStatus } from '@/lib/admin';

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

  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    if (image instanceof File) {
      const url = URL.createObjectURL(image);
      setPreviewImage(url);
      return () => URL.revokeObjectURL(url);
    } else if (typeof image === 'string') {
      setPreviewImage(image);
    } else {
      setPreviewImage(null);
    }
  }, [image]);

  return (
    <div className="w-full space-y-6 sticky top-24">
      {/* Aceternity 3D Perspective Card Container */}
      <CardContainer containerClassName="py-0 w-full" className="w-full">
        <CardBody className="w-full">
          <Card className="shiny-card w-full shadow-2xl overflow-hidden rounded-2xl relative group/card hover:shadow-[0_20px_50px_rgba(245,158,11,0.15)] transition-shadow duration-500">
            {/* Top Specular Gradient Accent */}
            <div className="h-1 bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 opacity-90" />

            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardItem
                  translateZ="20"
                  className="inline-flex items-center gap-1.5 text-[11px] font-sans uppercase tracking-wider text-amber-300 bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-500/30 shadow-xs"
                >
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Interactive 3D Preview</span>
                </CardItem>
                <CardItem translateZ="20">
                  <span className="text-[11px] text-zinc-400 font-sans">SPL / Metaplex V3</span>
                </CardItem>
              </div>
            </CardHeader>

            <CardContent className="flex flex-col items-center text-center space-y-4 pt-2">
              {/* Center 3D Floating Avatar & Gold Coin Combo */}
              <div className="relative flex items-center justify-center my-2">
                <CardItem translateZ="60" className="relative z-10">
                  <Avatar className="w-24 h-24 sm:w-28 sm:h-28 border-2 border-zinc-700/80 shadow-[0_10px_25px_rgba(0,0,0,0.6)] ring-2 ring-white/10">
                    <AvatarImage src={previewImage} alt={displayName} className="object-cover" />
                    <AvatarFallback className="bg-zinc-900">
                      <ImageIcon className="w-12 h-12 text-zinc-600" />
                    </AvatarFallback>
                  </Avatar>
                </CardItem>

                {/* Floating 3D Gold Solana Coin Layered on Top-Right (U09: float on nested child, preserving translateZ) */}
                <CardItem
                  translateZ="100"
                  className="absolute -right-4 -bottom-2 z-20"
                >
                  <div className="animate-float">
                    <GoldCoin3D size="sm" badgeText={displayTicker.slice(0, 4)} />
                  </div>
                </CardItem>
              </div>

              {/* Title & Ticker */}
              <CardItem translateZ="40" className="w-full">
                <h2 className="text-2xl font-black text-white tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] font-sans">
                  {displayName}
                </h2>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className="text-lg font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 font-sans drop-shadow-[0_0_10px_rgba(251,191,36,0.3)]">
                    ${displayTicker}
                  </span>
                  <span className="text-xs text-zinc-400 font-sans">• {decimals} Decimals</span>
                </div>
              </CardItem>

              {/* Story Description */}
              <CardItem translateZ="30" className="w-full">
                <p className="text-xs text-zinc-300 min-h-[44px] max-w-sm mx-auto line-clamp-3 leading-relaxed px-2 font-sans">
                  {description || 'Your coin story, mission, and viral meme lore will be permanently recorded in off-chain IPFS metadata.'}
                </p>
              </CardItem>

              {/* Social Badges */}
              <CardItem translateZ="35" className="flex items-center justify-center gap-2 pt-1">
                {website ? (
                  <span className="p-1.5 rounded-full shiny-pill text-amber-400 shadow-xs" title={website}>
                    <Globe className="w-3.5 h-3.5" />
                  </span>
                ) : null}
                {twitter ? (
                  <span className="p-1.5 rounded-full shiny-pill text-zinc-200 font-bold text-xs shadow-xs" title={twitter}>
                    𝕏
                  </span>
                ) : null}
                {telegram ? (
                  <span className="p-1.5 rounded-full shiny-pill text-amber-400 shadow-xs" title={telegram}>
                    <Send className="w-3.5 h-3.5" />
                  </span>
                ) : null}
              </CardItem>

              {/* Token Stats Grid */}
              <CardItem translateZ="45" className="w-full">
                <div className="grid grid-cols-2 gap-2 w-full pt-2 border-t border-zinc-800/80 text-left">
                  <div className="shiny-pill p-2.5 rounded-xl">
                    <span className="text-[10px] text-zinc-400 uppercase font-sans block">Total Supply</span>
                    <span className="text-sm font-bold text-white font-sans truncate block">
                      {displaySupply}
                    </span>
                  </div>
                  <div className="shiny-pill p-2.5 rounded-xl">
                    <span className="text-[10px] text-zinc-400 uppercase font-sans block">Your Allocation</span>
                    <span className="text-sm font-bold text-amber-300 font-sans block">
                      100% (Creator ATA)
                    </span>
                  </div>
                </div>
              </CardItem>

              {/* Token Security Configuration */}
              <CardItem translateZ="50" className="w-full">
                <div className="w-full shiny-card rounded-xl p-3 text-left space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5 font-sans">
                      <ShieldCheck className="w-4 h-4 text-amber-400" /> Security Rating
                    </span>
                    <span
                      className={`text-[10px] font-bold font-sans px-2 py-0.5 rounded-md ${
                        formData.revokeFreeze !== false &&
                        formData.revokeMint !== false &&
                        formData.immutable !== false
                          ? 'text-amber-200 bg-amber-950/80 border border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.25)]'
                          : 'text-amber-300 bg-amber-950/80 border border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                      }`}
                    >
                      {formData.revokeFreeze !== false &&
                      formData.revokeMint !== false &&
                      formData.immutable !== false
                        ? 'RECOMMENDED SAFE'
                        : 'CUSTOM SETTINGS'}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-300 space-y-1 pt-1 font-sans">
                    <div className="flex items-center gap-1.5">
                      {formData.revokeFreeze !== false ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>Freeze: <strong className="text-white">Revoked</strong> (Raydium ready)</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="text-amber-200">
                            Freeze: <strong>Retained</strong> {isAdmin ? '(👑 Admin 0 SOL)' : '(+0.05 SOL custom)'}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {formData.revokeMint !== false ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>Mint: <strong className="text-white">Revoked</strong> (No inflation)</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="text-amber-200">
                            Mint: <strong>Retained</strong> {isAdmin ? '(👑 Admin 0 SOL)' : '(+0.05 SOL custom)'}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {formData.immutable !== false ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>Metadata: <strong className="text-white">Immutable</strong> (Permanent)</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="text-amber-200">
                            Metadata: <strong>Mutable</strong> {isAdmin ? '(👑 Admin 0 SOL)' : '(+0.05 SOL custom)'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardItem>
            </CardContent>
          </Card>
        </CardBody>
      </CardContainer>

      {/* Price Comparison Widget */}
      <div className="shiny-card rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-white flex items-center gap-1.5 font-sans">
            <Flame className="w-3.5 h-3.5 text-amber-400" /> Price Comparison
          </span>
          <span className="text-amber-300 font-sans font-bold text-xs bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-500/40">
            Save up to 75%
          </span>
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center shiny-pill p-2.5 rounded-xl">
            <span className="text-zinc-200 font-medium flex items-center gap-1.5 font-sans">
              coiner.dev (All-Inclusive):
              {isAdmin && <Crown className="w-3.5 h-3.5 text-amber-400" />}
            </span>
            <span className="font-sans text-amber-300 font-bold text-sm">
              {isAdmin ? '0.00 SOL' : '0.15 SOL Flat'}
            </span>
          </div>
          <div className="flex justify-between items-center p-2 rounded-xl bg-zinc-950/40 border border-zinc-800/60 text-zinc-400">
            <span className="font-sans">Smithii / Orion (with Revocations):</span>
            <span className="font-sans text-red-400 line-through">0.40 – 0.80 SOL</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LivePreview;
