import React from "react";
import { cn } from "@/lib/utils";

/**
 * Magic UI BorderBeam — Animated glowing border highlight in liquid gold
 * U08 fix: Declares explicit animation inline to ensure dynamic execution across all bundlers.
 * U03 fix: Respects prefers-reduced-motion.
 */
export const BorderBeam = ({
  className,
  size = 200,
  duration = 12,
  anchor = 90,
  borderWidth = 1.5,
  colorFrom = "#f59e0b", // Amber/Gold
  colorTo = "#fbbf24",   // Bright Gold
  delay = 0,
}) => {
  return (
    <div
      style={{
        "--size": size,
        "--duration": duration,
        "--anchor": anchor,
        "--border-width": borderWidth,
        "--color-from": colorFrom,
        "--color-to": colorTo,
        "--delay": `-${delay}s`,
      }}
      className={cn(
        "pointer-events-none absolute inset-0 rounded-[inherit] [border:calc(var(--border-width)*1px)_solid_transparent]",
        "![mask-clip:padding-box,border-box] ![mask-composite:intersect] [mask:linear-gradient(transparent,transparent),linear-gradient(white,white)]",
        "after:absolute after:aspect-square after:w-[calc(var(--size)*1px)] after:[offset-anchor:calc(var(--anchor)*1%)_50%]",
        "after:[offset-path:rect(0_auto_auto_0_round_calc(var(--size)*1px))]",
        "after:[background:linear-gradient(to_left,var(--color-from),var(--color-to),transparent)]",
        "border-beam-active",
        className
      )}
    >
      <style>{`
        @keyframes border-beam-anim {
          100% {
            offset-distance: 100%;
          }
        }
        @media (prefers-reduced-motion: no-preference) {
          .border-beam-active::after {
            animation: border-beam-anim calc(var(--duration) * 1s) infinite linear !important;
            animation-delay: var(--delay) !important;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .border-beam-active::after {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
};
