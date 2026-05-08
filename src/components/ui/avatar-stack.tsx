import { UserAvatar } from "@/components/admin/ui/user-avatar";
import { cn } from "@/lib/utils";

export type StackedUser = { name: string; email: string };

export function AvatarStack({
  users,
  max = 3,
  size = "sm",
  className,
}: {
  users: StackedUser[];
  max?: number;
  size?: "sm" | "md";
  className?: string;
}) {
  if (!users || users.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const visible = users.slice(0, max);
  const overflow = users.length - visible.length;
  return (
    <div className={cn("flex items-center -space-x-2", className)}>
      {visible.map((u) => (
        <UserAvatar
          key={u.email}
          email={u.email}
          name={u.name}
          size={size}
          className="ring-2 ring-background"
        />
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground ring-2 ring-background",
            size === "sm" ? "size-7" : "size-9",
          )}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
