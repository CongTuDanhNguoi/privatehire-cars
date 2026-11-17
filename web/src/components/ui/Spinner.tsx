import { cn } from "../../lib/cn";

// Native indeterminate <progress>, styled as a ring in index.css (respects reduced motion + forced colors).
export function Spinner({ label = "Loading", small = false, className }: { label?: string; small?: boolean; className?: string }) {
  return <progress aria-label={label} className={cn("loading-spinner", small && "spinner-sm", className)} />;
}

export function FullPageSpinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center">
      <Spinner label={label} />
    </div>
  );
}
