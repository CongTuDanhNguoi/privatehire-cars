// Confirmation built on the native <dialog> opened with showModal(): the browser provides the inert page,
// focus containment, Esc / back-gesture dismissal and focus return to the invoker.
import { useEffect, useId, useRef } from "react";
import { Button } from "./Button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void; // also called for Esc / dismiss
}

export function ConfirmDialog({ open, title, description, confirmLabel, cancelLabel = "Cancel", onConfirm, onCancel }: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const safeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descId = useId();
  // Keep the latest callbacks without re-binding the close listener.
  const handlers = useRef({ onConfirm, onCancel });
  handlers.current = { onConfirm, onCancel };

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // The safe action gets focus first in a destructive confirmation.
      safeRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    function handleClose() {
      const value = dialog!.returnValue;
      dialog!.returnValue = ""; // Esc sets no value; avoid a stale one leaking into the next open.
      if (value === "confirm") handlers.current.onConfirm();
      else handlers.current.onCancel();
    }
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      className="m-auto w-[440px] max-w-[calc(100vw-32px)] rounded-xl border border-muted bg-surface p-6 text-ink"
    >
      <h2 id={titleId} className="text-heading font-bold text-balance">
        {title}
      </h2>
      {description && (
        <p id={descId} className="mt-2 text-body">
          {description}
        </p>
      )}
      <form method="dialog" className="mt-6 flex justify-end gap-3">
        <Button ref={safeRef} type="submit" variant="secondary" value="cancel">
          {cancelLabel}
        </Button>
        <Button type="submit" variant="primary" value="confirm">
          {confirmLabel}
        </Button>
      </form>
    </dialog>
  );
}
