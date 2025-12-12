import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 font-medium text-xs transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-sm",
        secondary:
          "border-glass-border/50 bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-white",
        outline: "border-glass-border text-foreground",
        // Liquid Glass style badges
        glass:
          "border-glass-border bg-glass-bg/50 text-foreground backdrop-blur-sm",
        accent: "border-primary/30 bg-primary/10 text-primary",
        purple: "border-accent/30 bg-accent/10 text-accent",
        // Legacy support for neon (maps to accent)
        neon: "border-primary/30 bg-primary/10 text-primary",
        cyan: "border-liquid-cyan/30 bg-liquid-cyan/10 text-liquid-cyan",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
