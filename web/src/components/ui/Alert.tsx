// Feedback message (UI Kit "06 – Feedback Messages"): coloured bar on the left, bold title, description, one text action.
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Icon } from "./Icon";

export type AlertVariant = "error" | "success" | "info";

interface AlertProps {
  variant: AlertVariant;
  title: ReactNode;
  children?: ReactNode;
  action?: { label: string; onClick: () => void; loading?: boolean };
  className?: string;
}

const STYLES: Record<AlertVariant, { box: string; title: string; icon: "alert" | "check" | "info" }> = {
  error: { box: "border-error bg-error-fill", title: "text-error", icon: "alert" },
  success: { box: "border-success bg-success-fill", title: "text-ink", icon: "check" },
  info: { box: "border-ink bg-muted", title: "text-ink", icon: "info" },
};

export function Alert({ variant, title, children, action, className }: AlertProps) {
  const s = STYLES[variant];
  return (
    // Errors interrupt (role=alert); success/info are polite status messages.
    <div role={variant === "error" ? "alert" : "status"} className={cn("flex gap-3 rounded-lg border-l-4 px-4 py-3", s.box, className)}>
      <Icon name={s.icon} size={20} className={cn("mt-0.5 shrink-0", variant === "success" ? "text-success" : s.title)} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className={cn("text-label font-bold", s.title)}>{title}</p>
        {children && <div className="text-label text-ink">{children}</div>}
        {action && (
          <div>
            <button
              type="button"
              onClick={action.onClick}
              disabled={action.loading}
              aria-busy={action.loading || undefined}
              className="cursor-pointer text-label font-semibold text-ink underline underline-offset-4 disabled:cursor-progress disabled:text-line"
            >
              {action.loading ? "Please wait…" : action.label}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
