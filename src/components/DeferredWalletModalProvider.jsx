import React, { lazy, Suspense, useState } from 'react';
import { WalletModalContext } from '@solana/wallet-adapter-react-ui';

const WalletPicker = lazy(() => import('./WalletPicker'));

// Keep the SDK's context and picker behavior; load its dialog only when requested.
export default function DeferredWalletModalProvider({ children }) {
  const [visible, setVisible] = useState(false);
  return (
    <WalletModalContext.Provider value={{ visible, setVisible }}>
      {children}
      {visible && <Suspense fallback={<div role="status" className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/90 text-white">Opening wallet picker…</div>}><WalletPicker /></Suspense>}
    </WalletModalContext.Provider>
  );
}
