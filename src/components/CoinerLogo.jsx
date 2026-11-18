import React from 'react';

export default function CoinerLogo() {
  return (
    <div className="flex min-w-0 items-center gap-2.5 font-sans sm:gap-3">
      <img
        src="/favicon.svg"
        width="40"
        height="40"
        alt=""
        aria-hidden="true"
        className="h-9 w-9 shrink-0 sm:h-10 sm:w-10"
      />
      <div className="min-w-0">
        <div className="whitespace-nowrap text-xl font-extrabold leading-none tracking-[-0.045em] text-white sm:text-2xl">
          coiner<span className="text-amber-400">.dev</span>
        </div>
        <span className="mt-1.5 hidden text-[11px] font-medium leading-tight tracking-[0.01em] text-zinc-400 sm:block">
          Sovereign Solana Token Creator
        </span>
      </div>
    </div>
  );
}
