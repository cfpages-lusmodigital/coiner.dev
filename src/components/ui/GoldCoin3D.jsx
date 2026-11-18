import React, { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * GoldCoin3D — Ultra-modern 3D Gold Solana / SPL Coin Asset
 * Features physical metallic shading, embossed rim, Solana insignia, and specular gleam.
 * U13: Uses React.useId() to prevent duplicate SVG gradient IDs across multiple coin instances.
 */
export const GoldCoin3D = ({
  className,
  size = "md", // sm (w-12), md (w-20), lg (w-28), xl (w-36), bg (w-72)
  showShine = true,
  animate = true,
  badgeText = "SOL",
  opacity = 1,
}) => {
  const rawId = useId();
  const idPrefix = rawId.replace(/[^a-zA-Z0-9_-]/g, "");
  const grad1Id = `sol_gold_grad_1_${idPrefix}`;
  const grad2Id = `sol_gold_grad_2_${idPrefix}`;
  const grad3Id = `sol_gold_grad_3_${idPrefix}`;

  const sizeMap = {
    sm: "w-12 h-12 text-[10px]",
    md: "w-20 h-20 text-xs",
    lg: "w-28 h-28 text-sm",
    xl: "w-36 h-36 text-base",
    bg: "w-64 h-64 sm:w-80 sm:h-80 text-xl",
  };

  return (
    <div
      className={cn(
        "relative flex items-center justify-center select-none [perspective:800px]",
        animate && "hover:scale-105 transition-transform duration-300 ease-out motion-reduce:hover:scale-100",
        className
      )}
      style={{ opacity }}
      aria-hidden="true"
    >
      {/* Outer Golden Ambient Glow */}
      <div
        className={cn(
          "absolute inset-0 rounded-full bg-gradient-to-tr from-amber-600/35 via-yellow-400/25 to-amber-200/30 blur-2xl -z-10",
          animate && "animate-pulse motion-reduce:animate-none"
        )}
      />

      {/* 3D Physical Coin Container */}
      <div
        className={cn(
          "relative rounded-full flex items-center justify-center aspect-square shadow-2xl",
          sizeMap[size] || sizeMap.md,
          // Metallic Coin Edge & Specular Border
          "bg-gradient-to-b from-[#FFE57F] via-[#FFC107] to-[#B78103]",
          "border-[3px] border-[#FFEAA7] shadow-[0_8px_25px_rgba(180,120,0,0.45),inset_0_2px_4px_rgba(255,255,255,0.7),inset_0_-3px_6px_rgba(100,60,0,0.6)]"
        )}
        style={{
          transformStyle: "preserve-3d",
        }}
      >
        {/* Coin Inner Face (Milled Coin Rim) */}
        <div
          className="w-[88%] h-[88%] rounded-full bg-gradient-to-tr from-[#996515] via-[#FFD54F] to-[#FFF9C4] flex flex-col items-center justify-center relative overflow-hidden shadow-[inset_0_2px_5px_rgba(255,255,255,0.8),inset_0_-2px_5px_rgba(80,45,0,0.7)]"
        >
          {/* Subtle Radial Sunburst Texture */}
          <div
            className="absolute inset-0 opacity-25 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-100 via-yellow-600 to-transparent"
          />

          {/* Sweeping Specular Light Gleam */}
          {showShine && (
            <div
              className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/50 to-transparent transform -skew-x-12 animate-[shimmer_3.5s_infinite] motion-reduce:animate-none"
            />
          )}

          {/* Embossed Solana 3-Bar Insignia */}
          <svg
            className="w-[48%] h-[48%] drop-shadow-[0_2px_3px_rgba(80,45,0,0.6)] z-10 text-[#4E3402]"
            viewBox="0 0 397 311"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            {/* Top Bar */}
            <path
              d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z"
              fill={`url(#${grad1Id})`}
            />
            {/* Middle Bar */}
            <path
              d="M64.6 3.8C67 1.4 70.3 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5C.7 77.6-2.2 70.6 1.9 66.5L64.6 3.8z"
              fill={`url(#${grad2Id})`}
            />
            {/* Bottom Bar */}
            <path
              d="M333.1 120.9c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z"
              fill={`url(#${grad3Id})`}
            />
            <defs>
              <linearGradient id={grad1Id} x1="0" y1="270" x2="400" y2="270" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FFF9C4" />
                <stop offset="0.5" stopColor="#FFC107" />
                <stop offset="1" stopColor="#8D5B04" />
              </linearGradient>
              <linearGradient id={grad2Id} x1="0" y1="38" x2="400" y2="38" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FFF9C4" />
                <stop offset="0.5" stopColor="#FFC107" />
                <stop offset="1" stopColor="#8D5B04" />
              </linearGradient>
              <linearGradient id={grad3Id} x1="0" y1="154" x2="400" y2="154" gradientUnits="userSpaceOnUse">
                <stop stopColor="#8D5B04" />
                <stop offset="0.5" stopColor="#FFC107" />
                <stop offset="1" stopColor="#FFF9C4" />
              </linearGradient>
            </defs>
          </svg>

          {/* Micro Ticker Tag */}
          {badgeText && (
            <span
              className="font-sans font-black tracking-widest text-[#5D4037] drop-shadow-[0_1px_1px_rgba(255,255,255,0.7)] z-10 uppercase mt-0.5"
            >
              {badgeText}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
