import type * as React from "react";

import { cn } from "@/lib/utils";

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "group relative flex flex-col gap-6 rounded-xl border border-border/50 bg-card/80 py-6 text-card-foreground backdrop-blur-sm transition-all duration-300",
        "hover:border-primary/30 hover:shadow-[0_0_30px_rgba(255,45,117,0.1)]",
        className
      )}
      data-slot="card"
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className
      )}
      data-slot="card-header"
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("font-semibold leading-none tracking-tight", className)}
      data-slot="card-title"
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("text-muted-foreground text-sm", className)}
      data-slot="card-description"
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      data-slot="card-action"
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("px-6", className)}
      data-slot="card-content"
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      data-slot="card-footer"
      {...props}
    />
  );
}

/* Glass variant card for special sections */
function CardGlass({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "group relative flex flex-col gap-6 rounded-xl py-6 text-card-foreground",
        "border border-primary/20 bg-card/40 backdrop-blur-xl",
        "shadow-[0_0_30px_rgba(255,45,117,0.1),inset_0_0_60px_rgba(168,85,247,0.05)]",
        "hover:border-primary/40 hover:shadow-[0_0_40px_rgba(255,45,117,0.2),inset_0_0_80px_rgba(168,85,247,0.08)]",
        "transition-all duration-500",
        className
      )}
      data-slot="card"
      {...props}
    />
  );
}

export {
  Card,
  CardGlass,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
};
