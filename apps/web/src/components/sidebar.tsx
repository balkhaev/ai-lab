"use client";

import {
  Boxes,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Home,
  ImageIcon,
  MessageSquare,
  Video,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Logo, LogoIcon } from "./logo";
import { Button } from "./ui/button";

const navItems: {
  href: string;
  label: string;
  icon: typeof Home;
}[] = [
  { href: "/", label: "Главная", icon: Home },
  { href: "/chat", label: "Чат", icon: MessageSquare },
  { href: "/image", label: "Изображения", icon: ImageIcon },
  { href: "/video", label: "Видео", icon: Video },
  { href: "/3d", label: "3D", icon: Boxes },
  { href: "/models", label: "Модели", icon: Cpu },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "relative flex h-full flex-col transition-all duration-300 ease-out",
        "liquid-glass-subtle border-glass-border border-r",
        collapsed ? "w-[72px]" : "w-[240px]"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-center border-glass-border/50 border-b px-4">
        {collapsed ? (
          <LogoIcon className="transition-all duration-300" size={28} />
        ) : (
          <Logo animated={false} size="md" />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;

          return (
            <Link
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium text-sm transition-all duration-200",
                isActive
                  ? "liquid-glass liquid-glow-sm text-primary"
                  : "text-muted-foreground hover:bg-glass-bg/50 hover:text-foreground"
              )}
              href={href as never}
              key={href}
            >
              {/* Active indicator */}
              {isActive ? (
                <div className="-translate-y-1/2 absolute top-1/2 left-0 h-5 w-1 rounded-r-full bg-primary" />
              ) : null}

              <Icon
                className={cn(
                  "h-5 w-5 shrink-0 transition-all duration-200",
                  isActive ? "text-primary" : "group-hover:text-primary/70"
                )}
              />

              {!collapsed && (
                <span className="truncate transition-opacity duration-200">
                  {label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="border-glass-border/50 border-t p-3">
        <Button
          className="w-full justify-center"
          onClick={() => setCollapsed(!collapsed)}
          size="sm"
          variant="ghost"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              {!collapsed && <span className="ml-2">Свернуть</span>}
            </>
          )}
        </Button>
      </div>

      {/* Bottom glow effect */}
      <div
        className="pointer-events-none absolute right-0 bottom-0 left-0 h-32"
        style={{
          background:
            "linear-gradient(to top, oklch(0.65 0.18 250 / 0.05), transparent)",
        }}
      />
    </aside>
  );
}
