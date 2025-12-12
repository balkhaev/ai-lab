"use client";

import { Settings2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  /** Main title text */
  title: string;
  /** Part of title to highlight with gradient */
  highlight?: string;
  /** Description below the title */
  description?: string;
  /** Action buttons on the right side */
  actions?: ReactNode;
  /** Model selector or other widget next to title */
  titleExtra?: ReactNode;
  /** Show settings toggle button on mobile */
  showSettingsToggle?: boolean;
  /** Callback when settings toggle is clicked */
  onSettingsToggle?: () => void;
  /** Additional class name */
  className?: string;
};

export function PageHeader({
  title,
  highlight,
  description,
  actions,
  titleExtra,
  showSettingsToggle = false,
  onSettingsToggle,
  className,
}: PageHeaderProps) {
  // Split title to apply gradient to highlighted part
  const renderTitle = () => {
    if (!highlight) {
      return <span className="gradient-text-accent">{title}</span>;
    }

    const parts = title.split(highlight);
    if (parts.length === 1) {
      return title;
    }

    return (
      <>
        {parts[0]}
        <span className="gradient-text-accent">{highlight}</span>
        {parts.slice(1).join(highlight)}
      </>
    );
  };

  return (
    <div className={cn("mb-6", className)}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-semibold text-2xl tracking-tight">
            {renderTitle()}
          </h1>
          {titleExtra}
        </div>

        <div className="flex items-center gap-2">
          {actions}
          {showSettingsToggle === true && onSettingsToggle !== undefined ? (
            <Button
              className="lg:hidden"
              onClick={onSettingsToggle}
              size="sm"
              variant="glass"
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>

      {description !== undefined ? (
        <p className="mt-2 text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
