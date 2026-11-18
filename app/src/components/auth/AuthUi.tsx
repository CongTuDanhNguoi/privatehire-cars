// =============================================================
// AuthUi — khối giao diện dùng chung cho Welcome / Login / Registration / Registration Complete / Verify Email,
// dựng theo bộ thiết kế "PrivateHire Cars – Sprint 1 – Core Booking" (thư mục PNG, SCRUM-65 Login, SCRUM-12).
// Màu: navy #0b2341 (chữ), primary #65b3fc (nút chính, viền #02284f 50%), link #0284c7,
// viền ô #94a3b8, lỗi #ef4444 / nền #fef2f2 / chữ #dc2626.
// =============================================================
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import logo from "../../assets/logo.png";
import Icon, { type IconName } from "../Icon";
import MobileFrame from "../MobileFrame";

export const FONT = "font-['Inter',sans-serif]";

// Khung màn hình điện thoại 390px, nền trắng hoặc xám nhạt (Login).
export function AuthFrame({ children, muted = false, testId }: { children: ReactNode; muted?: boolean; testId?: string }) {
  return (
    <MobileFrame>
      <div
        data-testid={testId}
        className={`${FONT} flex min-h-[844px] flex-col shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)] ${
          muted ? "bg-[#f1f5f9]" : "bg-white"
        }`}
      >
        {children}
      </div>
    </MobileFrame>
  );
}

// Logo thương hiệu (ảnh có nền nhạt như trong thiết kế).
// className phải tự có cả chiều cao/rộng (vd. "h-12 w-auto" hoặc "w-[320px] h-auto").
export function BrandLogo({ className = "h-12 w-auto" }: { className?: string }) {
  return <img src={logo} alt="PrivateHire Cars" className={`object-contain ${className}`} />;
}

// Thanh điều hướng 3 cột: trái | giữa | phải.
export function AuthNav({ left, center, right, bordered = true }: { left?: ReactNode; center?: ReactNode; right?: ReactNode; bordered?: boolean }) {
  return (
    <header className={`grid h-14 grid-cols-[1fr_auto_1fr] items-center bg-white px-5 ${bordered ? "border-b border-[#e2e8f0]" : ""}`}>
      <div className="justify-self-start">{left}</div>
      <div className="justify-self-center">{center}</div>
      <div className="justify-self-end">{right}</div>
    </header>
  );
}

export function NavLinkButton({ onClick, children, tone = "navy" }: { onClick: () => void; children: ReactNode; tone?: "navy" | "blue" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex cursor-pointer items-center gap-1 text-[14px] font-medium ${tone === "blue" ? "text-[#0284c7]" : "text-[#0b2341]"} hover:underline`}
    >
      {children}
    </button>
  );
}

// Ô nhập có nhãn, dấu * bắt buộc, icon trái, phần đuôi (nút Show / icon) và câu lỗi.
interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  id: string;
  label: string;
  hint?: ReactNode; // chữ nhỏ bên phải nhãn (vd. "Required", "Forgot Password?")
  icon?: IconName;
  error?: string;
  trailing?: ReactNode;
  inputRef?: (el: HTMLInputElement | null) => void;
  center?: boolean;
  soft?: boolean; // viền rất nhạt (thẻ form của màn Login)
  tint?: boolean; // nền hồng nhạt không viền đỏ (Login sai tài khoản)
}

export function AuthField({ id, label, hint, icon, error, trailing, inputRef, center, soft, tint, className = "", ...input }: FieldProps) {
  const errorId = `${id}-error`;
  const hasError = Boolean(error);
  return (
    <div className="flex w-full flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[13px] leading-4 font-semibold text-[#0b2341]">
          {label} <span className="text-[#ef4444]">*</span>
        </label>
        {hint}
      </div>
      <div
        className={`flex h-11 w-full items-center gap-2.5 rounded-lg px-3.5 transition-colors ${
          hasError
            ? "border border-[#ef4444] bg-[#fef2f2]"
            : tint
              ? "border border-transparent bg-[#fdf0f0] focus-within:border-[#0b2341]"
              : soft
                ? "border border-[#e2e8f0] bg-white focus-within:border-[#0b2341]"
                : "border border-[#94a3b8] bg-white focus-within:border-[#0b2341]"
        }`}
      >
        {icon && (
          <span className={hasError ? "text-[#ef4444]" : "text-[#64748b]"}>
            <Icon name={icon} size={18} />
          </span>
        )}
        <input
          id={id}
          ref={inputRef}
          aria-invalid={hasError}
          aria-describedby={hasError ? errorId : undefined}
          className={`h-full min-w-0 flex-1 bg-transparent text-[15px] text-[#0f172a] outline-none placeholder:text-[#94a3b8] ${center ? "text-center" : ""} ${className}`}
          {...input}
        />
        {trailing}
      </div>
      {hasError && (
        <p role="alert" className="flex items-start gap-1 text-[12px] leading-4 text-[#dc2626]">
          <span className="mt-px shrink-0">
            <Icon name="xCircle" size={13} />
          </span>
          <span>
            * <span id={errorId}>{error}</span>
          </span>
        </p>
      )}
    </div>
  );
}

// Nút chính theo UI Kit: nền primary, viền navy mờ, chữ trắng.
export function PrimaryButton({ children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#02284f]/50 bg-[#65b3fc] text-[16px] font-semibold text-white shadow-[0px_4px_6px_-1px_rgba(101,179,252,0.35)] transition-colors hover:bg-[#3f84c4] disabled:cursor-wait disabled:opacity-80 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

// Nút phụ: nền trắng, viền xám, chữ navy.
export function SecondaryButton({ children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#94a3b8] bg-white text-[16px] font-semibold text-[#0b2341] transition-colors hover:bg-[#f8fafc] ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

// Hộp báo lỗi đỏ (banner) — role="alert" để trình đọc màn hình đọc ngay.
export function ErrorBanner({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div role="alert" className="flex gap-2.5 rounded-xl border border-[#fecaca] bg-[#fef2f2] p-3.5">
      <span className="mt-0.5 shrink-0 text-[#dc2626]">
        <Icon name="alertCircle" size={18} />
      </span>
      <div className="flex flex-col gap-0.5">
        <p className="text-[14px] leading-5 font-semibold text-[#dc2626]">{title}</p>
        <p className="text-[12.5px] leading-[18px] text-[#b91c1c]">{children}</p>
      </div>
    </div>
  );
}
