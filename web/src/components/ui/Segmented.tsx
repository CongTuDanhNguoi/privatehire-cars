// Segmented control built on a native radio group: arrow keys, one tab stop and "1 of 3" announcements
// come from the browser. The selected segment is a filled block (shape + contrast, not colour alone).
import { useId, type ReactNode } from "react";
import { cn } from "../../lib/cn";

interface SegmentedProps<T extends string> {
  legend: string;
  hideLegend?: boolean;
  value: T;
  options: Array<{ value: T; label: ReactNode }>;
  onChange: (value: T) => void;
  disabled?: boolean;
}

export function Segmented<T extends string>({ legend, hideLegend, value, options, onChange, disabled }: SegmentedProps<T>) {
  const name = useId();
  return (
    <fieldset disabled={disabled} className="flex flex-col gap-1.5 border-0 p-0">
      <legend className={cn("mb-1.5 text-label font-semibold text-ink", hideLegend && "visually-hidden")}>{legend}</legend>
      <div className="inline-flex w-fit rounded-lg border border-line bg-surface p-1">
        {options.map((o) => (
          <label key={o.value} className="relative">
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={o.value === value}
              onChange={() => onChange(o.value)}
              className="peer absolute inset-0 m-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
            />
            <span
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-md px-3 text-label font-semibold whitespace-nowrap text-ink",
                "peer-hover:bg-muted peer-checked:bg-ink peer-checked:text-surface",
                "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary-pressed",
                "peer-disabled:opacity-60",
              )}
            >
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
