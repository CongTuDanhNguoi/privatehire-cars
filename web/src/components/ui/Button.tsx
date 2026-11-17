import type { ButtonHTMLAttributes, MouseEvent, Ref } from "react";
import { cn } from "../../lib/cn";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "text" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  loadingText?: string;
  fullWidth?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "h-11 px-5 border border-primary-stroke bg-primary text-surface hover:bg-primary-pressed active:bg-primary-pressed " +
    "disabled:border-muted disabled:bg-muted disabled:text-line",
  secondary:
    "h-11 px-5 border border-ink bg-surface text-ink hover:bg-muted active:bg-muted " +
    "disabled:border-muted disabled:text-line disabled:hover:bg-surface",
  text: "px-1 py-1 text-ink underline-offset-4 hover:underline disabled:text-line disabled:no-underline",
  icon: "size-9 text-ink hover:bg-muted active:bg-muted disabled:text-line",
};

// UI Kit button. While `loading`, the button keeps focus (aria-disabled instead of disabled) but ignores clicks.
export function Button({
  variant = "primary",
  loading = false,
  loadingText,
  fullWidth = false,
  className,
  type = "button",
  children,
  onClick,
  ref,
  ...rest
}: ButtonProps) {
  function handleClick(e: MouseEvent<HTMLButtonElement>) {
    if (loading) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
  }
  return (
    <button
      ref={ref}
      type={type}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      onClick={handleClick}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg text-body font-semibold transition-colors",
        "disabled:cursor-not-allowed",
        VARIANTS[variant],
        loading && variant === "primary" && "cursor-progress bg-primary-pressed",
        loading && "cursor-progress",
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    >
      {loading && variant === "primary" && <Spinner small label={loadingText ?? "Loading"} />}
      {loading && loadingText ? loadingText : children}
    </button>
  );
}
