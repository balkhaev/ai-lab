"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

type EmptyStateProps = {
  /** Icon to display */
  icon: LucideIcon;
  /** Title text */
  title: string;
  /** Description text */
  description: string;
  /** Action button */
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  /** Alternative: custom action element */
  actionElement?: ReactNode;
  /** Additional class name */
  className?: string;
};

/**
 * Unified empty state component for consistent messaging when no content exists.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  actionElement,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 text-center",
        className
      )}
    >
      <div className="mb-4 rounded-full bg-secondary p-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mb-2 font-medium">{title}</h3>
      <p className="mb-4 max-w-sm text-muted-foreground text-sm">
        {description}
      </p>
      {action ? (
        <Button onClick={action.onClick} variant="outline">
          {action.icon ? <action.icon className="mr-2 h-4 w-4" /> : null}
          {action.label}
        </Button>
      ) : null}
      {actionElement ? actionElement : null}
    </div>
  );
}
