import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"
import { cn } from "@/lib/utils"

/**
 * Switch component — Enhanced for Obsidian & Gold aesthetic
 * U05 fix: Replaced undefined CSS variable tokens with explicit high-contrast Tailwind colors.
 * Checked = Radiant Gold with dark thumb; Unchecked = Deep Zinc with light thumb.
 */
function Switch({
  className,
  ...props
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-11 w-16 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors p-1",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-amber-400 data-[state=checked]:to-yellow-400 data-[state=checked]:border-amber-300 data-[state=checked]:shadow-[0_0_12px_rgba(245,158,11,0.35)]",
        "data-[state=unchecked]:bg-zinc-800 data-[state=unchecked]:border-zinc-700",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block h-8 w-8 rounded-full shadow-lg ring-0 transition-transform",
          "data-[state=checked]:translate-x-5 data-[state=checked]:bg-zinc-950",
          "data-[state=unchecked]:translate-x-0 data-[state=unchecked]:bg-zinc-300"
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch }
