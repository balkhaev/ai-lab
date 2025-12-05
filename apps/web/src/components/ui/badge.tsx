import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 font-medium text-xs transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-[0_0_10px_rgba(255,45,117,0.3)] hover:shadow-[0_0_15px_rgba(255,45,117,0.5)]",
        secondary:
          "border-border/50 bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-white shadow-[0_0_10px_rgba(239,68,68,0.3)]",
        outline:
          "border-border text-foreground hover:border-primary/50 hover:text-primary",
        neon: "border-primary/50 bg-primary/10 text-primary shadow-[0_0_10px_rgba(255,45,117,0.2)] hover:bg-primary/20 hover:shadow-[0_0_15px_rgba(255,45,117,0.4)]",
        purple:
          "border-accent/50 bg-accent/10 text-accent shadow-[0_0_10px_rgba(168,85,247,0.2)] hover:bg-accent/20 hover:shadow-[0_0_15px_rgba(168,85,247,0.4)]",
        cyan: "border-[oklch(0.75_0.15_195)]/50 bg-[oklch(0.75_0.15_195)]/10 text-[oklch(0.75_0.15_195)] shadow-[0_0_10px_rgba(6,182,212,0.2)] hover:bg-[oklch(0.75_0.15_195)]/20",
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
