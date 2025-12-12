import { cva, type VariantProps } from "class-variance-authority";
import { Slot as SlotPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium text-sm outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-md hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 active:scale-[0.98]",
        destructive:
          "bg-destructive text-white shadow-md hover:bg-destructive/90 hover:shadow-destructive/20 hover:shadow-lg active:scale-[0.98]",
        outline:
          "border border-glass-border bg-transparent hover:border-primary/40 hover:bg-glass-bg active:scale-[0.98]",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 active:scale-[0.98]",
        ghost: "hover:bg-glass-bg hover:text-foreground",
        link: "text-primary underline-offset-4 hover:text-primary/80 hover:underline",
        // Liquid Glass button - transparent with blur
        glass:
          "liquid-glass-subtle hover:bg-glass-bg-hover active:scale-[0.98]",
        // iOS-style accent button with glow
        accent:
          "bg-gradient-to-r from-primary to-accent text-white shadow-lg shadow-primary/25 hover:shadow-primary/30 hover:shadow-xl active:scale-[0.98]",
        // Neon variant (legacy support, maps to accent)
        neon: "bg-gradient-to-r from-primary to-accent text-white shadow-lg shadow-primary/25 hover:shadow-primary/30 hover:shadow-xl active:scale-[0.98]",
      },
      size: {
        default: "h-10 px-5 py-2 has-[>svg]:px-4",
        sm: "h-8 gap-1.5 rounded-lg px-3 text-xs has-[>svg]:px-2.5",
        lg: "h-12 rounded-xl px-8 text-base has-[>svg]:px-6",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? SlotPrimitive.Slot : "button";

  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      data-slot="button"
      {...props}
    />
  );
}

export { Button, buttonVariants };
