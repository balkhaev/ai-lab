"use client";
import { ImageIcon, MessageSquare, Video } from "lucide-react";
import Link from "next/link";
import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

export default function Header() {
  const links = [
    { to: "/", label: "Home", icon: null },
    { to: "/compare", label: "Compare LLM", icon: MessageSquare },
    { to: "/image", label: "Image", icon: ImageIcon },
    { to: "/video", label: "Video", icon: Video },
  ] as const;

  return (
    <div>
      <div className="flex flex-row items-center justify-between px-4 py-2">
        <nav className="flex items-center gap-6">
          {links.map(({ to, label, icon: Icon }) => (
            <Link
              className="flex items-center gap-1.5 font-medium text-muted-foreground text-sm transition-colors hover:text-foreground"
              href={to}
              key={to}
            >
              {Icon && <Icon className="h-4 w-4" />}
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <UserMenu />
        </div>
      </div>
      <hr />
    </div>
  );
}
