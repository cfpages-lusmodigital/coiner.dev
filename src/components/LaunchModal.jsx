// src/components/LaunchModal.jsx
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  CheckCircle2,
  Copy,
  Loader2,
  PartyPopper,
  Rocket,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Share2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = [
  { id: 'uploading', label: 'Pinning Logo & Metadata to IPFS' },
  { id: 'preparing', label: 'Assembling Atomic Solana Transaction' },
  { id: 'signing', label: 'Awaiting Wallet Approval (Phantom/Solflare)' },
  { id: 'broadcasting', label: 'Broadcasting & Confirming on Solana' },
];

const getStepStatus = (stepId, currentStatus) => {
  const order = ['uploading', 'preparing', 'signing', 'broadcasting', 'confirming', 'success'];
  const currentIndex = order.indexOf(currentStatus);
  const stepIndex = order.indexOf(stepId);

  if (currentStatus === 'success') return 'complete';
  if (currentIndex > stepIndex) return 'complete';
  if (currentIndex === stepIndex) return 'loading';
  return 'pending';
};

const ProgressStep = ({ text, status }) => (
  <div className="flex items-center gap-3">
    <div className="flex items-center justify-center w-6 h-6">
      {status === 'pending' && (
        <div className="w-5 h-5 rounded-full border-2 border-gray-700 bg-gray-900" />
      )}
      {status === 'loading' && (
        <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
      )}
      {status === 'complete' && (
        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
      )}
    </div>
    <p
      className={cn(
        'text-sm font-medium',
        status === 'complete' && 'text-gray-400 line-through',
        status === 'loading' && 'text-emerald-300 font-semibold',
        status === 'pending' && 'text-gray-500'
      )}
    >
      {text}
    </p>
  </div>
);

const LaunchModal = ({
  open,
  setOpen,
  tokenData,
  status,
  statusMessage,
  error,
  result,
  network = 'devnet',
  onRetry,
}) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isDevnet = network === 'devnet';
  const clusterParam = isDevnet ? '?cluster=devnet' : '';

  const mintAddress = result?.mintAddress || '';
  const signature = result?.signature || '';

  const solscanTokenUrl = mintAddress
    ? `https://solscan.io/token/${mintAddress}${clusterParam}`
    : '#';
  const rugcheckUrl = mintAddress
    ? `https://rugcheck.xyz/tokens/${mintAddress}`
    : '#';
  const raydiumPoolUrl = isDevnet
    ? `https://raydium.io/liquidity/create/?cluster=devnet`
    : `https://raydium.io/liquidity/create/`;

  const tweetText = `Just created $${tokenData?.symbol || 'COIN'} on @Solana with zero platform markup using coiner.dev! 🚀\n\nMint: ${mintAddress}\n\n#Solana #MemeCoin`;
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    tweetText
  )}`;

  const isWorking =
    status === 'uploading' ||
    status === 'preparing' ||
    status === 'signing' ||
    status === 'broadcasting' ||
    status === 'confirming';

  return (
    <Dialog open={open} onOpenChange={(v) => !isWorking && setOpen(v)}>
      <DialogContent
        className="sm:max-w-lg bg-gray-950 border border-gray-800 text-white"
        onInteractOutside={(e) => {
          if (isWorking) e.preventDefault();
        }}
      >
        {isWorking && (
          <div className="py-2">
            <DialogHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="relative">
                  <div className="absolute -inset-1 rounded-full bg-emerald-500/20 blur-md animate-pulse" />
                  <div className="relative p-3 rounded-full bg-gray-900 border border-emerald-500/40">
                    <Rocket className="w-8 h-8 text-emerald-400 animate-bounce" />
                  </div>
                </div>
              </div>
              <DialogTitle className="text-2xl font-bold">
                Deploying ${tokenData?.symbol || 'Token'}
              </DialogTitle>
              <DialogDescription className="text-gray-400">
                Single atomic transaction directly signed by your wallet.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-6 bg-gray-900/50 rounded-xl p-4 border border-gray-800/80 my-4">
              {STEPS.map((s) => (
                <ProgressStep
                  key={s.id}
                  text={s.label}
                  status={getStepStatus(s.id, status)}
                />
              ))}
            </div>

            {statusMessage && (
              <p className="text-xs text-center text-emerald-400/90 font-mono">
                {statusMessage}
              </p>
            )}

            <DialogFooter className="mt-4 text-center text-xs text-gray-500">
              Network: <span className="font-semibold text-gray-400 uppercase">{network}</span> • 100% Non-Custodial
            </DialogFooter>
          </div>
        )}

        {status === 'error' && (
          <div className="py-2">
            <DialogHeader className="text-center">
              <div className="flex justify-center mb-3">
                <div className="p-3 rounded-full bg-red-950/60 border border-red-500/40 text-red-400">
                  <AlertCircle className="w-8 h-8" />
                </div>
              </div>
              <DialogTitle className="text-xl font-bold text-red-300">
                Deployment Interrupted
              </DialogTitle>
              <DialogDescription className="text-gray-400 text-sm mt-1">
                The transaction was rejected or encountered a network error.
              </DialogDescription>
            </DialogHeader>

            <div className="my-4 p-3 bg-red-950/30 border border-red-900/50 rounded-lg text-xs font-mono text-red-300 break-all max-h-40 overflow-y-auto">
              {error || 'Unknown error occurred during deployment.'}
            </div>

            <DialogFooter className="flex gap-2 sm:justify-between">
              <Button
                variant="outline"
                className="border-gray-800 text-gray-300"
                onClick={() => setOpen(false)}
              >
                Close
              </Button>
              {onRetry && (
                <Button
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                  onClick={onRetry}
                >
                  Try Again
                </Button>
              )}
            </DialogFooter>
          </div>
        )}

        {status === 'success' && (
          <div className="py-2">
            <DialogHeader className="text-center">
              <div className="flex justify-center mb-3">
                <div className="p-3 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-400">
                  <PartyPopper className="w-8 h-8" />
                </div>
              </div>
              <DialogTitle className="text-2xl font-bold text-white">
                ${tokenData?.symbol} is Live!
              </DialogTitle>
              <DialogDescription className="text-emerald-400/90 text-sm">
                SPL Token and Metaplex metadata deployed successfully on Solana.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center gap-4 py-4">
              {tokenData?.image && (
                <img
                  src={
                    typeof tokenData.image === 'string'
                      ? tokenData.image
                      : URL.createObjectURL(tokenData.image)
                  }
                  alt={tokenData.name}
                  className="w-20 h-20 rounded-full object-cover border-2 border-emerald-500/40 shadow-lg"
                />
              )}

              <div className="text-center">
                <h3 className="text-lg font-bold text-white">
                  {tokenData?.name} (${tokenData?.symbol})
                </h3>
                <p className="text-xs text-gray-400">
                  Supply: {Number(tokenData?.supply || 0).toLocaleString()} • Decimals: {tokenData?.decimals || 6}
                </p>
              </div>

              {/* Mint Address Box */}
              <div className="w-full space-y-1.5">
                <div className="flex justify-between items-center text-xs text-gray-400">
                  <Label className="text-xs text-gray-400">Token Mint Address</Label>
                  {copied && (
                    <span className="text-emerald-400 text-xs font-semibold">
                      Copied to clipboard!
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={mintAddress}
                    className="bg-gray-900 border-gray-800 font-mono text-xs text-emerald-300"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="border-gray-800 hover:bg-gray-800 shrink-0"
                    onClick={() => copyToClipboard(mintAddress)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Security Badges */}
              <div className="flex flex-wrap gap-2 justify-center w-full">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-950/70 border border-emerald-500/40 text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" /> Freeze Revoked
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-950/70 border border-emerald-500/40 text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" /> Mint Revoked (Fixed Supply)
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-950/70 border border-emerald-500/40 text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" /> Immutable
                </span>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2.5 w-full pt-1">
                <Button
                  asChild
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                >
                  <a href={solscanTokenUrl} target="_blank" rel="noopener noreferrer">
                    Solscan <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                  </a>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="border-gray-800 hover:bg-gray-800 text-gray-200"
                >
                  <a href={rugcheckUrl} target="_blank" rel="noopener noreferrer">
                    RugCheck <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                  </a>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="border-gray-800 hover:bg-gray-800 text-gray-200 col-span-2"
                >
                  <a href={raydiumPoolUrl} target="_blank" rel="noopener noreferrer">
                    Create Raydium Liquidity Pool <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                  </a>
                </Button>
              </div>

              {/* Share */}
              <div className="w-full pt-2 border-t border-gray-800 text-center">
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-white"
                >
                  <a href={tweetUrl} target="_blank" rel="noopener noreferrer">
                    <Share2 className="w-3.5 h-3.5 mr-1.5" /> Share on X / Twitter
                  </a>
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button
                onClick={() => setOpen(false)}
                className="w-full bg-gray-800 hover:bg-gray-700 text-white"
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default LaunchModal;
