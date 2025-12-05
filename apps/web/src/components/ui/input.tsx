import type * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "flex h-10 w-full min-w-0 rounded-lg border border-border bg-secondary/50 px-4 py-2 text-base shadow-sm outline-none transition-all duration-200",
        "selection:bg-primary/30 selection:text-foreground",
        "file:mr-3 file:inline-flex file:h-8 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary/20 file:px-3 file:font-medium file:text-primary file:text-sm",
        "placeholder:text-muted-foreground/60",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus:border-primary/50 focus:bg-secondary/70 focus:shadow-[0_0_15px_rgba(255,45,117,0.15)] focus:ring-1 focus:ring-primary/30",
        "hover:border-border/80 hover:bg-secondary/60",
        "aria-invalid:border-destructive aria-invalid:focus:shadow-[0_0_15px_rgba(239,68,68,0.2)]",
        "md:text-sm",
        className
      )}
      data-slot="input"
      type={type}
      {...props}
    />
  );
}

export { Input };
