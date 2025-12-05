"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ThemeProvider } from "./theme-provider";
import { Toaster } from "./ui/sonner";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        disableTransitionOnChange
        forcedTheme="dark"
      >
        {children}
        <Toaster
          richColors
          theme="dark"
          toastOptions={{
            classNames: {
              toast: "bg-card/95 backdrop-blur-xl border-border/50 shadow-xl",
              title: "text-foreground",
              description: "text-muted-foreground",
            },
          }}
        />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
