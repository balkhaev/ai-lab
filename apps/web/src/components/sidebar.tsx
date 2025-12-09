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
        "relative flex h-full flex-col border-border/50 border-r bg-sidebar/80 backdrop-blur-xl transition-all duration-300",
        collapsed ? "w-[72px]" : "w-[240px]"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-center border-border/50 border-b px-4">
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
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium text-sm transition-all duration-200",
                isActive
                  ? "bg-primary/10 text-primary shadow-[0_0_15px_rgba(255,45,117,0.15)]"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
              href={href as never}
              key={href}
            >
              {/* Active indicator */}
              {isActive ? (
                <div className="-translate-y-1/2 absolute top-1/2 left-0 h-6 w-1 rounded-r-full bg-primary shadow-[0_0_10px_rgba(255,45,117,0.5)]" />
              ) : null}

              <Icon
                className={cn(
                  "h-5 w-5 shrink-0 transition-all duration-200",
                  isActive
                    ? "text-primary drop-shadow-[0_0_8px_rgba(255,45,117,0.5)]"
                    : "group-hover:text-primary"
                )}
              />

              {!collapsed && (
                <span className="truncate transition-opacity duration-200">
                  {label}
                </span>
              )}

              {/* Hover glow effect */}
              {!isActive && (
                <div className="absolute inset-0 rounded-lg opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <div className="absolute inset-0 rounded-lg bg-linear-to-r from-primary/5 to-accent/5" />
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="border-border/50 border-t p-3">
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
      <div className="pointer-events-none absolute right-0 bottom-0 left-0 h-32 bg-linear-to-t from-primary/5 to-transparent" />
    </aside>
  );
}
