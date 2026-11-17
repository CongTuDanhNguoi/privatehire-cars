// Short notifications ("Status updated") in one labelled region, bottom-right.
// Each toast is a popover="manual" (top layer, no light dismiss); without Popover support it still shows via
// position: fixed. Content is announced (ariaNotify / live region). Auto-hides after 5 s, paused while the
// pointer or keyboard focus is on it; it always has a Close button. The same information is also visible on
// the page itself (e.g. the status badge), so nothing is lost when a toast disappears.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { announce } from "../../lib/announce";
import { cn } from "../../lib/cn";
import { Icon } from "./Icon";

type ToastVariant = "success" | "error";
interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  returnFocusTo: Element | null;
}

const ToastContext = createContext<((message: string, variant?: ToastVariant) => void) | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const AUTO_HIDE_MS = 5000;
const TOAST_GAP_PX = 84;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const show = useCallback((message: string, variant: ToastVariant = "success") => {
    const id = nextId.current++;
    setToasts((list) => [...list, { id, message, variant, returnFocusTo: document.activeElement }]);
    announce(message, variant === "error" ? "assertive" : "polite");
  }, []);

  const dismiss = useCallback((id: number, viaKeyboardFocus: boolean) => {
    setToasts((list) => {
      const index = list.findIndex((t) => t.id === id);
      const rest = list.filter((t) => t.id !== id);
      if (viaKeyboardFocus) {
        // Move focus to the next toast, or back to where the user was before.
        const next = rest[Math.min(index, rest.length - 1)];
        requestAnimationFrame(() => {
          const target = next
            ? document.querySelector<HTMLButtonElement>(`[data-toast-close="${next.id}"]`)
            : (list[index]?.returnFocusTo as HTMLElement | null);
          target?.focus?.();
        });
      }
      return rest;
    });
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div role="region" aria-label="Notifications">
        {toasts.map((t, i) => (
          <Toast key={t.id} item={t} offset={(toasts.length - 1 - i) * TOAST_GAP_PX} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function Toast({ item, offset, onDismiss }: { item: ToastItem; offset: number; onDismiss: (id: number, viaFocus: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el && typeof el.showPopover === "function" && !el.matches(":popover-open")) el.showPopover();
  }, []);

  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => onDismiss(item.id, false), AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [paused, item.id, onDismiss]);

  return (
    <div
      ref={ref}
      popover="manual"
      className={cn(
        "toast flex w-96 max-w-[calc(100vw-48px)] items-start gap-3 rounded-lg border border-l-4 border-muted bg-surface px-4 py-3 shadow-lg",
        item.variant === "error" ? "border-l-error" : "border-l-success",
      )}
      style={{ bottom: 24 + offset }}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
      }}
    >
      <Icon name={item.variant === "error" ? "alert" : "check"} className={item.variant === "error" ? "text-error" : "text-success"} />
      <p className="flex-1 text-label font-semibold text-ink">{item.message}</p>
      <button
        type="button"
        data-toast-close={item.id}
        aria-label="Dismiss notification"
        className="grid size-7 cursor-pointer place-items-center rounded-md text-ink hover:bg-muted"
        onClick={(e) => onDismiss(item.id, e.currentTarget === document.activeElement)}
      >
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}
