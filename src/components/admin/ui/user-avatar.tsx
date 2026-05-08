import { cn } from "@/lib/utils";

const SIZES = { sm: "size-7 text-xs", md: "size-9 text-sm", lg: "size-12 text-base" };

const PALETTE = [
  "bg-emerald-500",
  "bg-blue-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-indigo-500",
  "bg-fuchsia-500",
];

function hashToColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function UserAvatar({
  email,
  name,
  size = "md",
  className,
}: {
  email: string;
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const color = hashToColor(email);
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-medium text-white shrink-0",
        SIZES[size],
        color,
        className,
      )}
      title={name}
      aria-label={name}
    >
      {initials(name)}
    </span>
  );
}
