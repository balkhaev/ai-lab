"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { SIDEBAR_WIDTH } from "./constants";

type SettingsSidebarProps = {
  /** Sidebar content */
  children: ReactNode;
  /** Title for mobile sheet */
  title?: string;
  /** Whether sidebar is open on mobile */
  open?: boolean;
  /** Callback when mobile sidebar should close */
  onOpenChange?: (open: boolean) => void;
  /** Additional class name */
  className?: string;
};

export function SettingsSidebar({
  children,
  title = "Настройки",
  open = false,
  onOpenChange,
  className,
}: SettingsSidebarProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden border-border/50 border-l bg-card/50 backdrop-blur-sm lg:block",
          className
        )}
        style={{ width: SIDEBAR_WIDTH }}
      >
        <div className="sticky top-0 h-full overflow-auto p-6">{children}</div>
      </aside>

      {/* Mobile sheet */}
      <Sheet onOpenChange={onOpenChange} open={open}>
        <SheetContent className="w-full sm:max-w-md" side="right">
          <SheetHeader className="mb-6">
            <div className="flex items-center justify-between">
              <SheetTitle>{title}</SheetTitle>
              <Button
                onClick={() => onOpenChange?.(false)}
                size="icon"
                variant="ghost"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>
          <div className="h-[calc(100vh-8rem)] overflow-auto">{children}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}
