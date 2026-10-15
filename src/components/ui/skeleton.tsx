import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-white/[0.06] before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer-sweep_1.4s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/[0.08] before:to-transparent motion-reduce:before:hidden",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
