import type { EnquiryStatus, EnquiryType, SendStatus } from "../../types";
import { cn } from "../../lib/cn";
import { Icon } from "./Icon";

const base = "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-helper font-semibold";

export function TypeBadge({ type }: { type: EnquiryType }) {
  return type === "TRIP" ? (
    <span className={cn(base, "border border-success bg-success-fill text-ink")}>Trip</span>
  ) : (
    <span className={cn(base, "border border-muted bg-muted text-ink")}>General</span>
  );
}

export function StatusBadge({ status }: { status: EnquiryStatus }) {
  return status === "RESOLVED" ? (
    <span className={cn(base, "border border-success-fill bg-success-fill text-ink")}>
      <Icon name="check" size={14} className="text-success" />
      Resolved
    </span>
  ) : (
    <span className={cn(base, "border border-primary-pressed bg-surface text-primary-pressed")}>Awaiting</span>
  );
}

export function SendBadge({ status }: { status: SendStatus }) {
  if (status === "SENT") {
    return (
      <span className={cn(base, "border border-success bg-success-fill text-ink")}>
        <Icon name="check" size={14} className="text-success" />
        Sent
      </span>
    );
  }
  if (status === "FAILED") {
    return (
      <span className={cn(base, "border border-error bg-error-fill text-error")}>
        <Icon name="alert" size={14} />
        Failed
      </span>
    );
  }
  return <span className={cn(base, "border border-muted bg-muted text-ink")}>Pending</span>;
}
