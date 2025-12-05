import { Loader2 } from "lucide-react";

export default function Loader() {
  return (
    <div className="flex h-full items-center justify-center py-12">
      <div className="relative">
        <div className="absolute inset-0 animate-glow-pulse rounded-full blur-lg" />
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    </div>
  );
}
