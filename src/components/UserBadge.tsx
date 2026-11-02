import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Initials({ name, className }: { name: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary font-display text-sm font-bold text-primary ring-2 ring-primary/40",
        className,
      )}
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

export function UserLink({
  username,
  displayName,
}: {
  username: string;
  displayName?: string | null;
}) {
  return (
    <Link to="/u/$username" params={{ username }} className="flex items-center gap-3 hover:opacity-90">
      <Initials name={displayName || username} />
      <div className="leading-tight">
        <div className="font-semibold">{displayName || username}</div>
        <div className="text-xs text-muted-foreground">@{username}</div>
      </div>
    </Link>
  );
}
