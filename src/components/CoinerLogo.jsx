import React from 'react';

export default function CoinerLogo() {
  return (
    <div className="flex shrink-0 items-center gap-3">
      <img src="/favicon.svg" width="36" height="36" alt="" className="h-9 w-9" />
      <div>
        <div className="text-xl font-extrabold tracking-tight">
          coiner<span className="text-emerald-400">.dev</span>
        </div>
        <span className="text-[10px] text-gray-400 font-mono hidden sm:inline-block">
          Sovereign Solana Token Creator
        </span>
      </div>
    </div>
  );
}
