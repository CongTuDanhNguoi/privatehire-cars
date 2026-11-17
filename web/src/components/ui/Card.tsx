import { useId, type ReactNode } from "react";
import { cn } from "../../lib/cn";

interface CardProps {
  title?: ReactNode;
  actions?: ReactNode; // shown on the right of the title
  children: ReactNode;
  className?: string;
}

// White card, muted border, 12px radius, 24px padding. Titled cards are labelled sections.
export function Card({ title, actions, children, className }: CardProps) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={title ? headingId : undefined}
      className={cn("rounded-xl border border-muted bg-surface p-6", className)}
    >
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-4">
          {title && (
            <h2 id={headingId} className="text-heading font-bold text-ink">
              {title}
            </h2>
          )}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
