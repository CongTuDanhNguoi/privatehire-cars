// =============================================================
// ServiceSelectionPage — dựng theo thiết kế Sprint 1 "2. Select a Service":
// "STEP 1 OF 3 • CONFIGURATION", tiêu đề, lưới 6 thẻ (chọn 1, thẻ chọn: nền xanh nhạt + nhãn ACTIVE),
// thẻ "Flexible Reservation", hàng cam kết, nút "Continue to Journey Details" dính đáy.
// Hành vi giữ nguyên: mỗi lần chỉ chọn 1; Continue tắt khi chưa chọn; quay lại từ "Change" vẫn giữ lựa chọn.
// Giữ role="radio", aria-checked, data-testid service-<id> / continue cho self-test.
// =============================================================
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppBar from "../components/AppBar";
import Icon, { type IconName } from "../components/Icon";
import MobileFrame from "../components/MobileFrame";
import { useBooking } from "../context/BookingContext";
import { SERVICES, type ServiceId } from "../data/services";

const FONT = "font-['Inter',sans-serif]";

const PROMISES: { icon: IconName; label: string }[] = [
  { icon: "shield", label: "Licensed Chauffeurs" },
  { icon: "clock", label: "Free 60m Wait" },
  { icon: "badgeCheck", label: "Fixed Pricing" },
];

export default function ServiceSelectionPage() {
  const navigate = useNavigate();
  const { selectedService, selectService } = useBooking();
  const [pending, setPending] = useState<ServiceId | null>(selectedService?.id ?? null);

  function onContinue() {
    if (!pending) return;
    selectService(pending);
    navigate("/journey");
  }

  return (
    <MobileFrame>
      <div className={`${FONT} relative flex min-h-[844px] flex-col bg-[#f4f6fd] shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)]`}>
        <AppBar title="Service" onBack={() => navigate("/home")} backLabel="Back to Home" />

        <main className="flex-1 px-5 pt-3 pb-28">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold tracking-[0.8px] text-[#0e7490]">
            <Icon name="badgeCheck" size={15} /> STEP 1 OF 3 • CONFIGURATION
          </p>
          <h1 className="pt-1 text-[28px] leading-9 font-bold text-[#0b2341]">Select a Service</h1>
          <p className="pt-1 text-[14px] leading-[22px] text-[#475569]">Choose the premium mobility service that fits your journey schedule.</p>

          <div role="radiogroup" aria-label="Service" className="grid grid-cols-2 gap-3 pt-5">
            {SERVICES.map((service) => {
              const selected = pending === service.id;
              return (
                <button
                  key={service.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  data-testid={`service-${service.id}`}
                  onClick={() => setPending(service.id)}
                  className={`relative flex min-h-[136px] cursor-pointer flex-col items-start rounded-2xl p-3.5 text-left transition-colors ${
                    selected
                      ? "bg-[#d6e6fb] shadow-[0px_6px_16px_rgba(11,92,173,0.18)]"
                      : "bg-white shadow-[0px_1px_3px_rgba(15,23,42,0.06)] hover:bg-[#fbfdff]"
                  }`}
                >
                  <span
                    className={`flex size-10 items-center justify-center rounded-lg ${
                      selected ? "bg-[#0b4a8b] text-white" : "bg-[#eef3fb] text-[#0b2341]"
                    }`}
                  >
                    <Icon name={service.icon} size={20} strokeWidth={1.9} />
                  </span>
                  <span
                    aria-hidden="true"
                    className={`absolute top-3.5 right-3.5 flex size-5 items-center justify-center rounded-full ${
                      selected ? "bg-[#05c1fa] text-[#0b2341]" : "bg-[#dbe7f7]"
                    }`}
                  >
                    {selected && <Icon name="check" size={12} strokeWidth={3} />}
                  </span>
                  <span className="flex w-full items-end justify-between gap-1 pt-4">
                    <span className={`text-[15px] leading-5 text-[#0b2341] ${selected ? "font-bold" : "font-medium"}`}>{service.cardTitle}</span>
                    {selected && (
                      <span className="shrink-0 rounded-full bg-[#0b4a8b] px-2 py-0.5 text-[10px] font-semibold tracking-[0.6px] text-white">ACTIVE</span>
                    )}
                  </span>
                  <span className="line-clamp-2 pt-1 text-[12px] leading-4 text-[#475569]">{service.cardText}</span>
                </button>
              );
            })}
          </div>

          <section className="mt-5 flex gap-3 rounded-2xl bg-[#e8eef9] p-4">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#d6e2f5] text-[#0b4a8b]">
              <Icon name="info" size={17} />
            </span>
            <div>
              <p className="text-[14px] leading-5 font-semibold text-[#0b2341]">Flexible Reservation</p>
              <p className="pt-0.5 text-[12.5px] leading-[18px] text-[#475569]">
                1 service required to proceed. You can freely customize or switch selections prior to route confirmation.
              </p>
            </div>
          </section>

          <ul className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-white px-3 py-3 shadow-[0px_1px_3px_rgba(15,23,42,0.06)]">
            {PROMISES.map((p) => (
              <li key={p.label} className="flex items-center gap-1.5 text-[12px] leading-4 font-medium text-[#334155]">
                <span className="shrink-0 text-[#0b5cad]">
                  <Icon name={p.icon} size={15} />
                </span>
                {p.label}
              </li>
            ))}
          </ul>
        </main>

        {/* Nút Continue: tắt khi chưa chọn, bật khi đã chọn */}
        <div className="absolute right-0 bottom-0 left-0 border-t border-[#e2e8f0] bg-white/95 px-5 pt-3 pb-5 backdrop-blur-sm">
          <button
            type="button"
            data-testid="continue"
            disabled={!pending}
            onClick={onContinue}
            className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[16px] font-semibold transition-colors ${
              pending ? "cursor-pointer bg-[#65b3fc] text-white hover:bg-[#3f84c4]" : "cursor-not-allowed bg-[#e2e8f0] text-[#94a3b8]"
            }`}
          >
            Continue to Journey Details <Icon name="arrowRight" size={18} />
          </button>
        </div>
      </div>
    </MobileFrame>
  );
}
