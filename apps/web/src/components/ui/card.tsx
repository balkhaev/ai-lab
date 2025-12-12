import type * as React from "react";

import { cn } from "@/lib/utils";

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "group relative flex flex-col gap-6 rounded-2xl py-6 text-card-foreground transition-all duration-300",
        "liquid-glass liquid-interactive",
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

/* Glass variant card with accent glow for special sections */
function CardGlass({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "group relative flex flex-col gap-6 rounded-2xl py-6 text-card-foreground",
        "liquid-glass-strong liquid-border",
        "hover:liquid-glow-sm",
        "transition-all duration-500",
        className
      )}
      data-slot="card"
      {...props}
    />
  );
}

/* Stat card variant for dashboard */
function CardStat({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "group relative flex flex-col gap-2 rounded-2xl p-5 text-card-foreground",
        "liquid-glass liquid-interactive",
        className
      )}
      data-slot="card-stat"
      {...props}
    />
  );
}

export {
  Card,
  CardGlass,
  CardStat,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
};
