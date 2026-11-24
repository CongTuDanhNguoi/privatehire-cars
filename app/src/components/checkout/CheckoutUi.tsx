// =============================================================
// CheckoutUi.tsx — Phần giao diện dùng chung cho các màn thanh toán (Price, Notification, Receipt…).
// Chỉ dùng trong app/src/pages/checkout. Màu và font lấy từ các màn còn lại của app.
// =============================================================
import type { ReactNode } from "react";
import Icon from "../Icon";
import { BrandLogo } from "../auth/AuthUi";

export const CARD = "rounded-2xl bg-white shadow-[0px_1px_3px_rgba(15,23,42,0.06)]";

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

// "The Lowry Hotel, M3 5LH" → ["The Lowry Hotel", "M3 5LH"]
export function splitPlace(place: string): [string, string] {
  const idx = place.lastIndexOf(",");
  return idx > 0 ? [place.slice(0, idx).trim(), place.slice(idx + 1).trim()] : [place, ""];
}

export function CheckoutHeader({ title, subtitle, onBack, onClose, avatarName }: { title: string; subtitle?: string; onBack: () => void; onClose: () => void; avatarName: string }) {
  return (
    <header className="flex items-center gap-2 px-4 pt-3 pb-2">
      <button type="button" onClick={onBack} aria-label="Back" className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#0b2341] hover:bg-[#e2e8f0]">
        <Icon name="arrowLeft" size={18} />
      </button>
      <BrandLogo className="h-9 w-auto shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] leading-5 font-bold text-[#0b2341]">{title}</p>
        {subtitle && <p className="truncate text-[11px] leading-4 text-[#64748b]">{subtitle}</p>}
      </div>
      <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#0b2341] text-[12px] font-bold text-white">
        {initials(avatarName)}
      </span>
      <button type="button" onClick={onClose} aria-label="Close" className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#0b2341] hover:bg-[#e2e8f0]">
        <Icon name="close" size={18} />
      </button>
    </header>
  );
}

// Step indicator. `current` is 0-based; earlier steps show a tick.
export function Stepper({ items, current }: { items: string[]; current: number }) {
  return (
    <ol aria-label="Booking progress" className={`${CARD} mx-4 grid grid-cols-4 gap-1 px-3 py-3`}>
      {items.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} aria-current={active ? "step" : undefined} className="flex flex-col items-center gap-1 text-center">
            <span
              className={`flex size-6 items-center justify-center rounded-full text-[11px] font-bold ${
                done || active ? "bg-[#0284c7] text-white" : "bg-[#e2e8f0] text-[#64748b]"
              }`}
            >
              {done ? <Icon name="check" size={12} strokeWidth={3} /> : i + 1}
            </span>
            <span className={`text-[10.5px] leading-3 ${active ? "font-semibold text-[#0b2341]" : "text-[#64748b]"}`}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function FareRow({ label, value, tone = "normal" }: { label: ReactNode; value: string; tone?: "normal" | "struck" | "discount" }) {
  if (tone === "discount") {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg bg-[#e0f2fe] px-3 py-2.5 text-[13px] font-semibold text-[#0369a1]">
        <span className="flex items-center gap-2">{label}</span>
        <span>{value}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-3 px-1 text-[13.5px] text-[#334155]">
      <span>{label}</span>
      <span className={tone === "struck" ? "text-[#94a3b8] line-through" : "font-semibold text-[#0b2341]"}>{value}</span>
    </div>
  );
}

export function Chip({ children, tone = "blue" }: { children: ReactNode; tone?: "blue" | "red" | "green" }) {
  const cls = tone === "red" ? "bg-[#fee2e2] text-[#b91c1c]" : tone === "green" ? "bg-[#dcfce7] text-[#166534]" : "bg-[#e0f2fe] text-[#0369a1]";
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.3px] ${cls}`}>{children}</span>;
}
