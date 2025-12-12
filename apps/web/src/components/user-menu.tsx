"use client";

import { LogOut, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";

export default function UserMenu() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <Skeleton className="h-10 w-24 rounded-xl" />;
  }

  if (!session) {
    return (
      <Button asChild variant="glass">
        <Link href="/login">Войти</Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="gap-2" variant="glass">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15">
            <User className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="max-w-[100px] truncate">{session.user.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="liquid-glass-strong w-56">
        <DropdownMenuLabel>Мой аккаунт</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-glass-border/50" />
        <DropdownMenuItem className="flex-col items-start gap-1 rounded-lg">
          <span className="text-muted-foreground text-xs">Email</span>
          <span className="w-full truncate">{session.user.email}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-glass-border/50" />
        <DropdownMenuItem
          className="cursor-pointer rounded-lg text-destructive focus:text-destructive"
          onClick={() => {
            authClient.signOut({
              fetchOptions: {
                onSuccess: () => {
                  router.push("/login");
                },
              },
            });
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Выйти
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
