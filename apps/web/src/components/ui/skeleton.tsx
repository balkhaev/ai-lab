import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("animate-pulse rounded-lg bg-secondary/80", className)}
      data-slot="skeleton"
      {...props}
    />
  );
}

export { Skeleton };
