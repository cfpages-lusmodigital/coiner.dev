// src/lib/admin.jsx
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import React from 'react';
import { Crown } from 'lucide-react';

/**
 * Known Admin Solana Wallets Allowlist
 * Syamsul Alam's primary Solana wallet: 2di9sSnh1BYixnNw7Hw47XbMet9J5HFdF8NUMN2LZmaV
 * Can be extended dynamically via VITE_ADMIN_WALLET_ADDRESS or comma-separated VITE_ADMIN_WALLETS
 */
export const DEFAULT_ADMIN_WALLET = '2di9sSnh1BYixnNw7Hw47XbMet9J5HFdF8NUMN2LZmaV';

export const ADMIN_WALLETS = (() => {
  const rawList = [
    import.meta.env.VITE_ADMIN_WALLET_ADDRESS,
    ...(import.meta.env.VITE_ADMIN_WALLETS ? import.meta.env.VITE_ADMIN_WALLETS.split(',') : []),
    DEFAULT_ADMIN_WALLET,
  ];
  const validAddresses = [];
  for (const raw of rawList) {
    if (!raw || typeof raw !== 'string') continue;
    try {
      const canonical = new PublicKey(raw.trim()).toBase58();
      if (!validAddresses.includes(canonical)) {
        validAddresses.push(canonical);
      }
    } catch {
      // Ignore invalid public key formats in env
    }
  }
  return validAddresses;
})();

/**
 * Checks if a given address string is a valid canonical admin wallet (case-sensitive)
 */
export function isAdminAddress(address) {
  if (!address || typeof address !== 'string') return false;
  try {
    const canonical = new PublicKey(address.trim()).toBase58();
    return ADMIN_WALLETS.includes(canonical);
  } catch {
    return false;
  }
}

export const BASE_PUBLIC_FEE_SOL = 0.15;
export const CUSTOMIZATION_SURCHARGE_SOL = 0.05;

/**
 * Calculates platform fee:
 * - Admin (recognized wallet): 0.00 SOL
 * - Public: 0.15 SOL flat base (includes SPL creation, supply minting, IPFS pinning, and all 3 revocations: Freeze, Mint, Immutable)
 * - Customization: +0.05 SOL per kept authority
 */
export function calculatePlatformFee({ isAdmin, revokeFreeze, revokeMint, immutable }) {
  if (isAdmin) return 0.0;
  let fee = BASE_PUBLIC_FEE_SOL;
  if (!revokeFreeze) fee += CUSTOMIZATION_SURCHARGE_SOL;
  if (!revokeMint) fee += CUSTOMIZATION_SURCHARGE_SOL;
  if (!immutable) fee += CUSTOMIZATION_SURCHARGE_SOL;
  return Number(fee.toFixed(2));
}

/**
 * Hook to determine if connected wallet is an authorized administrator
 */
export function useAdminStatus() {
  const { publicKey, connected } = useWallet();
  const address = publicKey ? publicKey.toBase58() : '';
  const isAdmin = connected && Boolean(address) && isAdminAddress(address);

  return {
    isAdmin,
    adminRoleReason: isAdmin ? `Admin Wallet Recognized (${address.slice(0, 4)}...${address.slice(-4)})` : null,
    address,
    platformFeeSol: isAdmin ? 0.0 : BASE_PUBLIC_FEE_SOL,
    feeLabel: isAdmin ? '0.00 SOL (Admin)' : '0.15 SOL Flat',
  };
}

/**
 * Subtle Admin Badge displayed in the header when the connected wallet is an admin wallet
 */
export function AdminStatusBadge() {
  const { isAdmin } = useAdminStatus();
  if (!isAdmin) return null;
  return (
    <div
      title="Admin Wallet Recognized • 0.00 SOL Platform Fee"
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-semibold shadow-sm animate-in fade-in duration-200"
    >
      <Crown className="w-3.5 h-3.5 text-amber-400" />
      <span className="hidden sm:inline">Admin</span>
      <span className="text-[10px] text-emerald-400 font-bold">0 SOL Fee</span>
    </div>
  );
}
