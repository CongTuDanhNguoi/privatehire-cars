import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Icon, type IconName } from "./Icon";

// Grey placeholder block shown while data loads. Purely visual (hidden from screen readers).
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("rounded-md bg-muted motion-safe:animate-pulse", className)} />;
}

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ icon = "inbox", title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-muted text-ink">
        <Icon name={icon} size={24} />
      </span>
      <p className="text-heading font-bold text-ink">{title}</p>
      {description && <p className="max-w-md text-body text-ink">{description}</p>}
      {action}
    </div>
  );
}
