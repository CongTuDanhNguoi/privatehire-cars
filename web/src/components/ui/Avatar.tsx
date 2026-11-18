// Round initials badge. Decorative: the name is always shown as text next to it.
import { cn } from "../../lib/cn";

interface AvatarProps {
  name: string;
  size?: "sm" | "md";
}

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

export function Avatar({ name, size = "sm" }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-surface",
        size === "sm" ? "size-7 text-helper" : "size-9 text-label",
      )}
    >
      {initials(name)}
    </span>
  );
}
