"use client";

import { GpuStatus } from "./gpu-status";
import { TaskQueue } from "./task-queue";
import UserMenu from "./user-menu";

export default function Header() {
  return (
    <header className="flex h-14 items-center justify-end border-border/50 border-b bg-background/80 px-6 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <GpuStatus />
        <TaskQueue />
        <UserMenu />
      </div>
    </header>
  );
}
