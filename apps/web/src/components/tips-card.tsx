"use client";

import { Lightbulb } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type TipsCardProps = {
  /** Card title (default: "Советы") */
  title?: string;
  /** Tips content - can be string array or custom ReactNode */
  tips?: string[];
  /** Custom children instead of tips array */
  children?: ReactNode;
  /** Additional class name */
  className?: string;
};

/**
 * Unified tips card for sidebar with accent styling.
 */
export function TipsCard({
  title = "Советы",
  tips,
  children,
  className,
}: TipsCardProps) {
  return (
    <Card className={cn("border-accent/20 bg-accent/5", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 font-medium text-sm">
          <Lightbulb className="h-4 w-4 text-accent" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-muted-foreground text-xs">
        {tips !== undefined
          ? tips.map((tip) => <p key={tip}>• {tip}</p>)
          : (children ?? null)}
      </CardContent>
    </Card>
  );
}
