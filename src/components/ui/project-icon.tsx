import { cn } from "@/lib/utils";

const PALETTE = [
  "bg-emerald-600",
  "bg-blue-600",
  "bg-violet-600",
  "bg-amber-600",
  "bg-rose-600",
  "bg-cyan-600",
  "bg-indigo-600",
  "bg-fuchsia-600",
  "bg-pink-600",
  "bg-teal-600",
];

function hashIndex(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h) % PALETTE.length;
}

const SIZES = {
  sm: "size-7 text-[11px] rounded-md",
  md: "size-9 text-sm rounded-lg",
  lg: "size-12 text-base rounded-xl",
};

export function ProjectIcon({
  name,
  seed,
  size = "md",
  className,
}: {
  name: string;
  seed?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const initial = (name?.trim()?.[0] ?? "?").toUpperCase();
  const color = PALETTE[hashIndex(seed ?? name ?? "x")];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-semibold text-white",
        SIZES[size],
        color,
        className,
      )}
      aria-hidden
    >
      {initial}
    </span>
  );
}
