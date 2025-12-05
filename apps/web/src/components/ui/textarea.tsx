import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      "flex min-h-[100px] w-full resize-none rounded-lg border border-border bg-secondary/50 px-4 py-3 text-base shadow-sm outline-none transition-all duration-200",
      "selection:bg-primary/30 selection:text-foreground",
      "placeholder:text-muted-foreground/60",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "focus:border-primary/50 focus:bg-secondary/70 focus:shadow-[0_0_15px_rgba(255,45,117,0.15)] focus:ring-1 focus:ring-primary/30",
      "hover:border-border/80 hover:bg-secondary/60",
      "md:text-sm",
      className
    )}
    ref={ref}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export { Textarea };
