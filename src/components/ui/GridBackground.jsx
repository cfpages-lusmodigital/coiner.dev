import React from "react";
import { cn } from "@/lib/utils";

/**
 * GridBackground — High-depth obsidian black canvas with subtle radial gold aura
 */
export const GridBackground = ({ children, className }) => {
  return (
    <div
      className={cn(
        "relative min-h-screen w-full bg-[#09090b] text-[#f4f4f5] overflow-x-clip",
        className
      )}
    >
      {/* Subtle Dark Grid Matrix */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.18]"
        style={{
          backgroundImage: `linear-gradient(to right, #27272a 1px, transparent 1px), linear-gradient(to bottom, #27272a 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse 65% 55% at 50% 15%, #000 60%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 65% 55% at 50% 15%, #000 60%, transparent 100%)",
        }}
      />

      {/* Radiant Top Gold Ambient Glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[450px] pointer-events-none -z-0 opacity-25 blur-[120px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(245, 158, 11, 0.35) 0%, rgba(217, 119, 6, 0.15) 45%, transparent 75%)",
        }}
      />

      {/* Main Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
};
