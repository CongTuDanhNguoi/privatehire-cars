// TextField / TextArea / Select following the UI Kit:
// label above (Label 14), red * for required, line border; error = error border + error fill + 12px message below.
// Accessibility: aria-invalid is always set ("false" until there is an error) and the error message is listed in
// aria-describedby ONLY while it is shown, so it is not read out before the user interacted.
import { useId, type InputHTMLAttributes, type ReactNode, type Ref, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

interface FieldShellProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: ReactNode;
  counter?: ReactNode;
  children: ReactNode;
}

function FieldShell({ id, label, required, error, hint, counter, children }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label font-semibold text-ink">
        {label}
        {required && (
          <span className="text-error" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </label>
      {children}
      {(error || hint || counter) && (
        <div className="flex items-start justify-between gap-4">
          <div>
            {error ? (
              <p id={`${id}-error`} className="text-helper text-error">
                {error}
              </p>
            ) : hint ? (
              <p id={`${id}-hint`} className="text-helper text-ink">
                {hint}
              </p>
            ) : null}
          </div>
          {counter && <div className="shrink-0 text-helper text-ink tabular-nums">{counter}</div>}
        </div>
      )}
    </div>
  );
}

const controlClass = (hasError: boolean) =>
  cn(
    "w-full rounded-lg border bg-surface px-3 text-body text-ink placeholder:text-line",
    "disabled:cursor-not-allowed disabled:bg-muted",
    hasError ? "border-error bg-error-fill" : "border-line",
  );

const describedBy = (id: string, error?: string, hint?: ReactNode) =>
  error ? `${id}-error` : hint ? `${id}-hint` : undefined;

// ---------- TextField ----------
interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  error?: string;
  hint?: ReactNode;
  id?: string;
  trailing?: ReactNode; // e.g. Show/Hide password button
  ref?: Ref<HTMLInputElement>;
}

export function TextField({ label, error, hint, id: idProp, required, trailing, className, ref, ...rest }: TextFieldProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <FieldShell id={id} label={label} required={required} error={error} hint={hint}>
      <div className="relative">
        <input
          ref={ref}
          id={id}
          required={required}
          aria-invalid={error ? true : false}
          aria-describedby={describedBy(id, error, hint)}
          className={cn(controlClass(!!error), "h-11", trailing ? "pr-20" : undefined, className)}
          {...rest}
        />
        {trailing && <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>}
      </div>
    </FieldShell>
  );
}

// ---------- TextArea (with optional character counter) ----------
interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
  label: string;
  error?: string;
  hint?: ReactNode;
  id?: string;
  maxChars?: number;
  ref?: Ref<HTMLTextAreaElement>;
}

export function TextArea({ label, error, hint, id: idProp, required, maxChars, value, className, ref, ...rest }: TextAreaProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const length = typeof value === "string" ? value.length : 0;
  return (
    <FieldShell
      id={id}
      label={label}
      required={required}
      error={error}
      hint={hint}
      counter={maxChars ? <span className={length > maxChars ? "text-error" : undefined}>{`${length}/${maxChars}`}</span> : undefined}
    >
      <textarea
        ref={ref}
        id={id}
        required={required}
        value={value}
        aria-invalid={error ? true : false}
        aria-describedby={describedBy(id, error, hint)}
        className={cn(controlClass(!!error), "resize-y py-2.5", className)}
        {...rest}
      />
    </FieldShell>
  );
}

// ---------- Select ----------
interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  label: string;
  error?: string;
  hint?: ReactNode;
  id?: string;
  ref?: Ref<HTMLSelectElement>;
}

export function Select({ label, error, hint, id: idProp, required, className, children, ref, ...rest }: SelectProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <FieldShell id={id} label={label} required={required} error={error} hint={hint}>
      <select
        ref={ref}
        id={id}
        required={required}
        aria-invalid={error ? true : false}
        aria-describedby={describedBy(id, error, hint)}
        className={cn(controlClass(!!error), "h-11 cursor-pointer pr-8", className)}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
}
