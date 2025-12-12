"use client";

import { GpuStatus } from "./gpu-status";
import { TaskQueue } from "./task-queue";
import UserMenu from "./user-menu";

export default function Header() {
  return (
    <header className="liquid-glass-subtle flex h-14 items-center justify-end border-glass-border/50 border-b px-6">
      <div className="flex items-center gap-3">
        <GpuStatus />
        <TaskQueue />
        <UserMenu />
      </div>
    </header>
  );
}
