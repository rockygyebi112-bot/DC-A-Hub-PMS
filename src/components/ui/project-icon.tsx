import { cn } from "@/lib/utils";

const PALETTE = [
  "from-emerald-400 to-emerald-600",
  "from-blue-400 to-blue-600",
  "from-violet-400 to-violet-600",
  "from-amber-400 to-amber-600",
  "from-rose-400 to-rose-600",
  "from-cyan-400 to-cyan-600",
  "from-indigo-400 to-indigo-600",
  "from-fuchsia-400 to-fuchsia-600",
  "from-pink-400 to-pink-600",
  "from-teal-400 to-teal-600",
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
        "inline-flex shrink-0 items-center justify-center bg-gradient-to-br font-semibold text-white shadow-sm",
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
