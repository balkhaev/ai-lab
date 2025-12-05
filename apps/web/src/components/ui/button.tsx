import { cva, type VariantProps } from "class-variance-authority";
import { Slot as SlotPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium text-sm outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(255,45,117,0.3)] hover:bg-primary/90 hover:shadow-[0_0_25px_rgba(255,45,117,0.5)] active:scale-[0.98]",
        destructive:
          "bg-destructive text-white shadow-[0_0_15px_rgba(239,68,68,0.3)] hover:bg-destructive/90 hover:shadow-[0_0_25px_rgba(239,68,68,0.5)] active:scale-[0.98]",
        outline:
          "border border-border bg-transparent hover:border-primary/50 hover:bg-secondary hover:shadow-[0_0_15px_rgba(255,45,117,0.2)] active:scale-[0.98]",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:shadow-[0_0_10px_rgba(168,85,247,0.2)] active:scale-[0.98]",
        ghost: "hover:bg-secondary hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:text-primary/80 hover:underline",
        neon: "bg-gradient-to-r from-primary to-accent text-white shadow-[0_0_20px_rgba(255,45,117,0.4)] hover:shadow-[0_0_30px_rgba(255,45,117,0.6),0_0_60px_rgba(168,85,247,0.3)] active:scale-[0.98]",
      },
      size: {
        default: "h-10 px-5 py-2 has-[>svg]:px-4",
        sm: "h-8 gap-1.5 rounded-md px-3 text-xs has-[>svg]:px-2.5",
        lg: "h-12 rounded-lg px-8 text-base has-[>svg]:px-6",
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
