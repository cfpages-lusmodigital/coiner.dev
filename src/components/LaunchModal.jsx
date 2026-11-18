// src/components/LaunchModal.jsx
import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { checkSignatureStatus } from '@/lib/solana';
import { GoldCoin3D } from '@/components/ui/GoldCoin3D';
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
import { useAdminStatus } from '@/lib/admin';

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
        <div className="w-5 h-5 rounded-full border-2 border-zinc-700 bg-zinc-900" />
      )}
      {status === 'loading' && (
        <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
      )}
      {status === 'complete' && (
        <CheckCircle2 className="w-5 h-5 text-amber-400" />
      )}
    </div>
    <p
      className={cn(
        'text-sm font-sans',
        status === 'complete' && 'text-zinc-400 line-through',
        status === 'loading' && 'text-amber-300 font-semibold',
        status === 'pending' && 'text-zinc-500'
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
  const { connection } = useConnection();
  const { isAdmin } = useAdminStatus();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const copyTimeoutRef = useRef(null);
  const attemptIdRef = useRef(0);
  const [isCheckingSig, setIsCheckingSig] = useState(false);
  const [sigCheckMessage, setSigCheckMessage] = useState('');
  const [recoveredResult, setRecoveredResult] = useState(null);
  const [successImageUrl, setSuccessImageUrl] = useState(null);
  const [retryAuthorized, setRetryAuthorized] = useState(false);
  const confirmationOwner = useRef(null);

  const isWorking =
    status === 'uploading' ||
    status === 'preparing' ||
    status === 'signing' ||
    status === 'broadcasting' ||
    status === 'confirming';

  // U11: Managed image blob URL revocation
  useEffect(() => {
    if (tokenData?.image instanceof File) {
      const url = URL.createObjectURL(tokenData.image);
      setSuccessImageUrl(url);
      return () => URL.revokeObjectURL(url);
    } else if (typeof tokenData?.image === 'string') {
      setSuccessImageUrl(tokenData.image);
    } else {
      setSuccessImageUrl(null);
    }
  }, [tokenData?.image]);

  // U02: Reset recovered result and increment attempt ID when starting a new launch attempt
  useLayoutEffect(() => {
    if (status === 'uploading' || status === 'preparing') {
      attemptIdRef.current += 1;
      setRecoveredResult(null);
      setSigCheckMessage('');
      setIsCheckingSig(false);
    }
  }, [status]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  // Trigger celebration confetti on successful launch (Pure Gold & Silver palette)
  // U03: Respect prefers-reduced-motion guard; dynamically load confetti to optimize initial bundle
  useEffect(() => {
    let cancelled = false;
    let celebration;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const stop = () => { if (preference.matches) celebration?.reset(); };
    preference.addEventListener('change', stop);
    if (!isWorking && (status === 'success' || (status === 'error' && Boolean(recoveredResult)))) {
      import('canvas-confetti')
        .then((module) => {
          if (cancelled || preference.matches) return;
          const confettiFn = module.default || module;
          celebration = confettiFn;
          confettiFn({
            particleCount: 100,
            spread: 80,
            origin: { y: 0.6 },
            colors: ['#FFE259', '#FFA751', '#FFC107', '#E4E4E7', '#FFFFFF'],
            disableForReducedMotion: true,
          });
        })
        .catch(() => {
          // Safe fallback if canvas is unavailable
        });
    }
    return () => {
      cancelled = true;
      celebration?.reset();
      preference.removeEventListener('change', stop);
    };
  }, [status, recoveredResult, isWorking]);

  // U12: Asynchronous clipboard copy with error handling and timer cleanup
  const copyToClipboard = async (text) => {
    const owner = confirmationOwner.current;
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error('Clipboard API not supported');
      }
      await navigator.clipboard.writeText(text);
      if (confirmationOwner.current !== owner) return;
      setCopied(true);
      setCopyError(false);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      if (confirmationOwner.current !== owner) return;
      console.warn('Clipboard write failed:', err);
      setCopied(false);
      setCopyError(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopyError(false), 3000);
    }
  };

  const isDevnet = network === 'devnet';
  const clusterParam = isDevnet ? '?cluster=devnet' : '';

  const activeResult = recoveredResult || result;
  const mintAddress = activeResult?.mintAddress || '';
  const signature = activeResult?.signature || '';

  const solscanTokenUrl = mintAddress
    ? `https://solscan.io/token/${mintAddress}${clusterParam}`
    : '#';
  const rugcheckUrl = mintAddress
    ? `https://rugcheck.xyz/tokens/${mintAddress}`
    : '#';
  const raydiumPoolUrl = isDevnet
    ? `https://raydium.io/liquidity/create/?cluster=devnet`
    : `https://raydium.io/liquidity/create/`;

  const tweetText = `Just created $${tokenData?.symbol || 'COIN'} on @Solana using coiner.dev! 🚀\n\nMint: ${mintAddress}\n\n#Solana #MemeCoin`;
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    tweetText
  )}`;

  const rawErrorMessage = typeof error === 'string' ? error : error?.message || '';
  const broadcastSig =
    error?.signature ||
    error?.launchContext?.signature ||
    rawErrorMessage.match(/[1-9A-HJ-NP-Za-km-z]{64,88}/)?.[0] ||
    '';
  const launchContext = error?.launchContext;
  // Invalidate awaited responses whenever the visible transaction owner changes.
  useLayoutEffect(() => {
    const owner = { signature: broadcastSig, connection, network, status, open };
    confirmationOwner.current = owner;
    setIsCheckingSig(false);
    setRetryAuthorized(false);
    setSigCheckMessage('');
    setRecoveredResult(null);
    setCopied(false);
    setCopyError(false);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    return () => { if (confirmationOwner.current === owner) confirmationOwner.current = null; };
  }, [broadcastSig, connection, network, status, open, result, error]);

  return (
    <Dialog open={open} onOpenChange={(v) => !isWorking && setOpen(v)}>
      <DialogContent
        className="sm:max-w-lg max-h-[90dvh] overflow-y-auto shiny-card text-white rounded-2xl shadow-2xl font-sans"
        onInteractOutside={(e) => {
          if (isWorking) e.preventDefault();
        }}
      >
        {isWorking && (
          <div className="py-2">
            <DialogHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="relative">
                  <div className="absolute -inset-1 rounded-full bg-amber-500/20 blur-md animate-pulse" />
                  <div className="relative p-3 rounded-full bg-gray-900 border border-amber-500/40">
                    <Rocket className="w-8 h-8 text-amber-400 animate-bounce" />
                  </div>
                </div>
              </div>
              <DialogTitle className="text-2xl font-bold font-sans">
                Deploying ${tokenData?.symbol || 'Token'}
              </DialogTitle>
              <DialogDescription className="text-gray-400 font-sans">
                Single atomic transaction directly signed by your wallet.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-6 bg-gray-900/50 rounded-xl p-4 border border-zinc-800/80 my-4">
              {STEPS.map((s) => (
                <ProgressStep
                  key={s.id}
                  text={s.label}
                  status={getStepStatus(s.id, status)}
                />
              ))}
            </div>

            {statusMessage && (
              <p className="text-xs text-center text-amber-300 font-sans">
                {statusMessage}
              </p>
            )}

            <DialogFooter className="mt-4 text-center text-xs text-gray-400 font-sans">
              Network: <span className="font-semibold text-gray-300 uppercase">{network}</span> • 100% Non-Custodial {isAdmin && '• 👑 Admin (0 SOL)'}
            </DialogFooter>
          </div>
        )}

        {status === 'error' && !recoveredResult && (
          <div className="py-2">
            <DialogHeader className="text-center">
              <div className="flex justify-center mb-3">
                <div className="p-3 rounded-full bg-red-950/60 border border-red-500/40 text-red-400">
                  <AlertCircle className="w-8 h-8" />
                </div>
              </div>
              <DialogTitle className="text-xl font-bold text-red-300 font-sans">
                Deployment Interrupted
              </DialogTitle>
              <DialogDescription className="text-gray-400 text-sm mt-1 font-sans">
                The transaction was rejected or encountered a network error.
              </DialogDescription>
            </DialogHeader>

            <div className="my-4 space-y-3">
              <div className="p-3 bg-red-950/30 border border-red-900/50 rounded-lg text-xs font-sans text-red-300 break-all max-h-36 overflow-y-auto">
                {rawErrorMessage || 'Unknown error occurred during deployment.'}
              </div>

              {broadcastSig && (
                <div className="p-3 bg-amber-950/40 border border-amber-500/40 rounded-lg text-xs space-y-2 text-amber-200">
                  <div className="font-bold flex items-center gap-1.5 text-amber-300 font-sans">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    Transaction Broadcast Context Retained
                  </div>
                  <p className="text-[11px] text-gray-300 leading-normal font-sans">
                    The transaction was broadcast with signature:{' '}
                    <span className="font-sans text-amber-300 break-all font-semibold">{broadcastSig}</span>
                  </p>
                  <p className="text-[11px] text-gray-400 leading-normal font-sans">
                    Do not submit another transaction immediately to avoid duplicate token creation and fees. Verify confirmation first:
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-amber-500/50 text-amber-300 hover:bg-amber-950 text-xs h-7 font-sans"
                      asChild
                    >
                      <a href={`https://solscan.io/tx/${broadcastSig}${clusterParam}`} target="_blank" rel="noopener noreferrer">
                        View on Solscan <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      disabled={isCheckingSig}
                      className="bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black text-xs h-7 font-bold font-sans"
                      onClick={async () => {
                        const capturedAttempt = attemptIdRef.current;
                        const owner = confirmationOwner.current;
                        const isCurrent = () => confirmationOwner.current === owner && attemptIdRef.current === capturedAttempt;
                        setIsCheckingSig(true);
                        setRetryAuthorized(false);
                        setSigCheckMessage('Checking on-chain confirmation status...');
                        try {
                          const statusResult = await checkSignatureStatus(connection, broadcastSig);
                          if (!isCurrent()) {
                            return; // Discard stale async callback from previous attempt
                          }
                          if (statusResult?.kind === 'confirmed') {
                            setSigCheckMessage('Confirmed on-chain! Loading token details...');
                            if (launchContext?.mintAddress) {
                              setRecoveredResult(launchContext);
                            } else {
                              setSigCheckMessage('Transaction confirmed. Token details are unavailable; inspect the transaction on Solscan. Do not retry.');
                            }
                          } else if (statusResult?.kind === 'pending') {
                            setSigCheckMessage('Transaction is still pending on-chain. Please check again in a few moments.');
                          } else if (statusResult?.kind === 'failed') {
                            setRetryAuthorized(true);
                            setSigCheckMessage(`Transaction failed on-chain: ${JSON.stringify(statusResult.error || 'Custom error')}`);
                          } else if (statusResult?.kind === 'rpc_unavailable') {
                            setSigCheckMessage('RPC node unavailable: ' + statusResult.error);
                          } else {
                            setSigCheckMessage('Transaction not yet confirmed on RPC. Please verify on Solscan before retrying.');
                          }
                        } catch (checkErr) {
                          if (isCurrent()) {
                            setSigCheckMessage('RPC check error: ' + checkErr.message);
                          }
                        } finally {
                          if (isCurrent()) {
                            setIsCheckingSig(false);
                          }
                        }
                      }}
                    >
                      {isCheckingSig ? 'Checking...' : 'Check Confirmation Status'}
                    </Button>
                  </div>
                  {sigCheckMessage && (
                    <p className="text-[11px] font-sans text-amber-300 pt-1">{sigCheckMessage}</p>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="flex gap-2 sm:justify-between font-sans">
              <Button
                variant="outline"
                className="border-zinc-800 text-gray-300 font-sans"
                onClick={() => setOpen(false)}
              >
                Close
              </Button>
              {onRetry && (!broadcastSig || retryAuthorized) && !isCheckingSig && (
                <Button
                  className="bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-bold font-sans"
                  onClick={onRetry}
                >
                  Try Again
                </Button>
              )}
            </DialogFooter>
          </div>
        )}

        {!isWorking && (status === 'success' || (status === 'error' && Boolean(recoveredResult))) && (
          <div className="py-2">
            <DialogHeader className="text-center">
              <div className="flex justify-center mb-3">
                <div className="animate-float">
                  <GoldCoin3D size="md" badgeText={tokenData?.symbol?.slice(0, 4) || 'SOL'} />
                </div>
              </div>
              <DialogTitle className="text-2xl font-black text-white font-sans">
                ${tokenData?.symbol} is Live!
              </DialogTitle>
              <DialogDescription className="text-amber-300 font-sans text-sm">
                SPL Token and Metaplex metadata deployed successfully on Solana.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center gap-4 py-4 font-sans">
              {successImageUrl && (
                <img
                  src={successImageUrl}
                  alt={tokenData?.name || 'Token'}
                  className="w-20 h-20 rounded-full object-cover border-2 border-amber-500/40 shadow-lg"
                />
              )}

              <div className="text-center font-sans">
                <h3 className="text-lg font-bold text-white font-sans">
                  {tokenData?.name} (${tokenData?.symbol})
                </h3>
                <p className="text-xs text-gray-400 font-sans">
                  Supply: {Number(tokenData?.supply || 0).toLocaleString()} • Decimals: {tokenData?.decimals || 6}
                </p>
              </div>

              {/* Mint Address Box */}
              <div className="w-full space-y-1.5 font-sans">
                <div className="flex justify-between items-center text-xs text-gray-400">
                  <Label htmlFor="token-mint-address-input" className="text-xs text-gray-400 font-sans">Token Mint Address</Label>
                  {copied && (
                    <span className="text-amber-400 text-xs font-semibold font-sans">
                      Copied to clipboard!
                    </span>
                  )}
                  {copyError && (
                    <span className="text-red-400 text-xs font-semibold font-sans">
                      Copy failed. Please copy manually.
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    id="token-mint-address-input"
                    aria-label="Token Mint Address"
                    readOnly
                    value={mintAddress}
                    className="bg-gray-900 border-zinc-800 font-sans text-xs text-amber-300 font-semibold"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Copy token mint address to clipboard"
                    className="border-zinc-800 hover:bg-zinc-800 shrink-0"
                    onClick={() => copyToClipboard(mintAddress)}
                  >
                    <Copy className="h-4 w-4 text-zinc-300" />
                  </Button>
                </div>
              </div>

              {/* Security Badges */}
              <div className="flex flex-wrap gap-2 justify-center w-full font-sans">
                {tokenData?.revokeFreeze !== false ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-950/70 border border-amber-500/40 text-amber-300">
                    <ShieldCheck className="w-3.5 h-3.5" /> Freeze Revoked
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-950/70 border border-amber-500/40 text-amber-300">
                    <AlertCircle className="w-3.5 h-3.5" /> Freeze Retained (Custom)
                  </span>
                )}

                {tokenData?.revokeMint !== false ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-950/70 border border-amber-500/40 text-amber-300">
                    <ShieldCheck className="w-3.5 h-3.5" /> Mint Revoked (Fixed Supply)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-950/70 border border-amber-500/40 text-amber-300">
                    <AlertCircle className="w-3.5 h-3.5" /> Mint Retained (Custom)
                  </span>
                )}

                {tokenData?.immutable !== false ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-950/70 border border-amber-500/40 text-amber-300">
                    <ShieldCheck className="w-3.5 h-3.5" /> Immutable
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-950/70 border border-amber-500/40 text-amber-300">
                    <AlertCircle className="w-3.5 h-3.5" /> Mutable Metadata (Custom)
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2.5 w-full pt-1 font-sans">
                <Button
                  asChild
                  className="bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-bold font-sans"
                >
                  <a href={solscanTokenUrl} target="_blank" rel="noopener noreferrer">
                    Solscan <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                  </a>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="border-zinc-800 hover:bg-zinc-800 text-zinc-200 font-sans"
                >
                  <a href={rugcheckUrl} target="_blank" rel="noopener noreferrer">
                    RugCheck <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                  </a>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="border-zinc-800 hover:bg-zinc-800 text-zinc-200 col-span-2 font-sans"
                >
                  <a href={raydiumPoolUrl} target="_blank" rel="noopener noreferrer">
                    Create Raydium Liquidity Pool <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                  </a>
                </Button>
              </div>

              {/* Share */}
              <div className="w-full pt-2 border-t border-zinc-800 text-center font-sans">
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-white font-sans"
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
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-sans"
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
