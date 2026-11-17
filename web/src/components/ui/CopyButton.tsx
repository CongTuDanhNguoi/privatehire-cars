// Copies a value with the Async Clipboard API. The feedback bubble is also the live region (role="status"),
// so sighted and screen-reader users get the same "Copied" / "Copy failed" message.
import { useRef, useState } from "react";
import { cn } from "../../lib/cn";
import { Icon } from "./Icon";

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  async function copy() {
    clearTimeout(timer.current);
    setState("idle");
    let ok = true;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      ok = false; // permission denied or not a secure context
    }
    requestAnimationFrame(() => setState(ok ? "copied" : "failed"));
    timer.current = setTimeout(() => setState("idle"), 2000);
  }

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onClick={copy}
        aria-label={label}
        className="grid min-h-7 min-w-7 cursor-pointer place-items-center rounded-md text-ink hover:bg-muted"
      >
        <Icon name={state === "copied" ? "check" : "copy"} size={16} className={state === "copied" ? "text-success" : undefined} />
      </button>
      <span
        role="status"
        className={cn(
          "pointer-events-none ml-1 text-helper font-semibold transition-opacity motion-reduce:transition-none",
          state === "idle" ? "opacity-0" : "opacity-100",
          state === "failed" ? "text-error" : "text-ink",
        )}
      >
        {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : ""}
      </span>
    </span>
  );
}
