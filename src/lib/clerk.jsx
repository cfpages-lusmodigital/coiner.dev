// src/lib/clerk.jsx
// Sovereign Authentication & Admin Exemption Layer for coiner.dev
// Enforces Dual-Tier Fee Model: 0.10 SOL for Public Users, 0.00 SOL for Admin (admin@alampintar.org / Admin Wallet)

import React, { createContext, useContext, useMemo } from 'react';
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
  useUser,
} from '@clerk/clerk-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Crown, LogIn, User, ShieldCheck } from 'lucide-react';

const ADMIN_EMAIL = 'admin@alampintar.org';

const UnifiedAuthContext = createContext({
  isLoaded: true,
  isSignedIn: false,
  user: null,
  email: null,
  hasClerkKey: false,
});

/**
 * Internal bridge component running safely inside ClerkProvider
 */
function ClerkContextBridge({ children, publishableKey }) {
  const { user, isLoaded, isSignedIn } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase() || null;

  const value = useMemo(
    () => ({
      isLoaded,
      isSignedIn: !!isSignedIn,
      user: user || null,
      email,
      hasClerkKey: true,
    }),
    [user, isLoaded, isSignedIn, email]
  );

  return (
    <UnifiedAuthContext.Provider value={value}>
      {children}
    </UnifiedAuthContext.Provider>
  );
}

/**
 * Top-level provider that wraps Clerk if key is available, or gracefully falls back to local auth context
 */
export function ClerkAuthProvider({ children }) {
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    const fallbackValue = {
      isLoaded: true,
      isSignedIn: false,
      user: null,
      email: null,
      hasClerkKey: false,
    };

    return (
      <UnifiedAuthContext.Provider value={fallbackValue}>
        {children}
      </UnifiedAuthContext.Provider>
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <ClerkContextBridge publishableKey={publishableKey}>
        {children}
      </ClerkContextBridge>
    </ClerkProvider>
  );
}

/**
 * Hook to retrieve live admin exemption status and current fee tier
 */
export function useAdminStatus() {
  const auth = useContext(UnifiedAuthContext);
  const wallet = useWallet();

  const adminWalletAddress = import.meta.env.VITE_ADMIN_WALLET_ADDRESS;
  const connectedAddress = wallet.publicKey ? wallet.publicKey.toBase58() : null;

  return useMemo(() => {
    // 1. Check Clerk Authenticated Email (admin@alampintar.org or publicMetadata role)
    const email = auth.email || '';
    const isEmailAdmin =
      auth.isSignedIn &&
      (email === ADMIN_EMAIL.toLowerCase() || auth.user?.publicMetadata?.role === 'admin');

    // 2. Check Connected Admin Solana Wallet bypass
    const isWalletAdmin =
      Boolean(adminWalletAddress && connectedAddress && connectedAddress === adminWalletAddress);

    const isAdmin = isEmailAdmin || isWalletAdmin;
    const adminRoleReason = isEmailAdmin
      ? `Clerk Verified (${email})`
      : isWalletAdmin
      ? `Admin Wallet (${connectedAddress.slice(0, 4)}...${connectedAddress.slice(-4)})`
      : null;

    // Public users pay 0.10 SOL platform fee; Admin pays 0.00 SOL gas-only
    const platformFeeSol = isAdmin ? 0.0 : 0.1;

    return {
      isLoaded: auth.isLoaded,
      isSignedIn: auth.isSignedIn,
      user: auth.user,
      email: auth.email,
      isAdmin,
      adminRoleReason,
      platformFeeSol,
      feeLabel: isAdmin ? '0.00 SOL (Admin Exemption)' : '0.10 SOL (Public Service Fee)',
      hasClerkKey: auth.hasClerkKey,
    };
  }, [auth, connectedAddress, adminWalletAddress]);
}

/**
 * Header Widget for Clerk SignIn / UserButton / Admin Badge
 */
export function AdminAuthWidget() {
  const { isAdmin, adminRoleReason, isSignedIn, email, hasClerkKey } = useAdminStatus();

  if (!hasClerkKey) {
    if (isAdmin) {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 text-xs font-mono">
          <Crown className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-semibold hidden sm:inline">Admin</span>
          <span className="text-[10px] text-emerald-300">0 SOL Fee</span>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <SignedIn>
        {isAdmin ? (
          <div
            title={adminRoleReason || 'Admin exemption active'}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 text-xs font-mono"
          >
            <Crown className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-semibold hidden sm:inline">Admin</span>
            <span className="text-[10px] text-emerald-300 font-bold">0 SOL Fee</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-900 border border-gray-800 text-gray-300 text-xs font-mono">
            <User className="w-3 h-3 text-gray-400" />
            <span className="hidden sm:inline">{email ? email.split('@')[0] : 'User'}</span>
          </div>
        )}
        <UserButton afterSignOutUrl="/" />
      </SignedIn>

      <SignedOut>
        <SignInButton mode="modal">
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 text-gray-300 hover:text-white text-xs font-medium transition-all cursor-pointer shadow-sm"
          >
            <LogIn className="w-3.5 h-3.5 text-emerald-400" />
            <span>Admin Sign In</span>
          </button>
        </SignInButton>
      </SignedOut>
    </div>
  );
}
