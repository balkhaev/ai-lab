"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageLayoutProps = {
  /** Main content area */
  children: ReactNode;
  /** Sidebar content (will be wrapped in SettingsSidebar) */
  sidebar?: ReactNode;
  /** Additional class name for the main content area */
  className?: string;
  /** Additional class name for the container */
  containerClassName?: string;
};

/**
 * Unified page layout with optional settings sidebar.
 * Provides consistent structure across all pages.
 */
export function PageLayout({
  children,
  sidebar,
  className,
  containerClassName,
}: PageLayoutProps) {
  return (
    <div className={cn("flex h-full flex-col lg:flex-row", containerClassName)}>
      {/* Main content area */}
      <div className={cn("flex-1 overflow-auto p-6", className)}>
        {children}
      </div>

      {/* Sidebar */}
      {sidebar}
    </div>
  );
}
