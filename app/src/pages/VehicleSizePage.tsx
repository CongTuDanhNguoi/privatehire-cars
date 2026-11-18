// =============================================================
// VehicleSizePage — SCRUM-17 Vehicle Size Selection, dựng theo thiết kế Sprint 1:
//   "1. Vehicle Size Selection (Normal State)"  — ≤ 4 khách: thẻ gọn (ảnh nhỏ, giá, tiện ích)
//   "1. Insufficient Capacity State"            — 5–6 khách: banner "Capacity mismatch", thẻ ảnh lớn,
//                                                 Standard Car bị khoá "Unavailable"
// Logic giữ nguyên: 1–6 khách; Standard tối đa 4, Seven-Seater tối đa 6; chỉ chọn 1;
// vượt sức chứa thì bỏ chọn và không tự chọn xe khác; nút Check Vehicle Availability tắt khi chưa có xe hợp lệ.
// Giữ mọi data-testid mà test-scrum17 / scrum18 / final-acceptance dùng.
// =============================================================
import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import standardPhoto from "../assets/car-standard-photo.png";
import standardThumb from "../assets/car-standard-thumb.png";
import vanPhoto from "../assets/car-van-photo.png";
import vanThumb from "../assets/car-van-thumb.png";
import AppBar from "../components/AppBar";
import Icon, { type IconName } from "../components/Icon";
import MobileFrame from "../components/MobileFrame";
import { useBooking } from "../context/BookingContext";

const FONT = "font-['Inter',sans-serif]";
const STANDARD_MAX = 4;
const SEVEN_SEATER_MAX = 6;

export type VehicleTypeId = "standard" | "seven-seater";

interface VehicleInfo {
  id: VehicleTypeId;
  testKey: "standard" | "seven-seater";
  name: string;
  tag: string;
  model: string;
  max: number;
  bags: number;
  price: string;
  thumb: string;
  photo: string;
  extra: { icon: IconName; label: string };
  footnote: { icon: IconName; label: string };
}

const VEHICLES: VehicleInfo[] = [
  {
    id: "standard",
    testKey: "standard",
    name: "Standard Car",
    tag: "Saloon",
    model: "Mercedes E-Class",
    max: STANDARD_MAX,
    bags: 2,
    price: "£4.00",
    thumb: standardThumb,
    photo: standardPhoto,
    extra: { icon: "snowflake", label: "A/C" },
    footnote: { icon: "badgeCheck", label: "Economical & reliable" },
  },
  {
    id: "seven-seater",
    testKey: "seven-seater",
    name: "Seven-Seater",
    tag: "Spacious MPV",
    model: "Mercedes-Benz V-Class",
    max: SEVEN_SEATER_MAX,
    bags: 4,
    price: "£6.00",
    thumb: vanThumb,
    photo: vanPhoto,
    extra: { icon: "wifi", label: "Free Wi-Fi" },
    footnote: { icon: "thumbsUp", label: "Recommended for groups & extra luggage" },
  },
];

function Radio({ selected, disabled, testKey }: { selected: boolean; disabled: boolean; testKey: string }) {
  if (disabled) return <span data-testid={`${testKey}-disabled-radio`} className="size-6 rounded-full bg-[#f1d4d4]" aria-hidden="true" />;
  if (selected)
    return (
      <span data-testid={`${testKey}-selected-indicator`} className="flex size-6 items-center justify-center rounded-full bg-[#22b8ef] text-[#0b2341]" aria-hidden="true">
        <Icon name="check" size={14} strokeWidth={3} />
      </span>
    );
  return <span data-testid={`${testKey}-unselected-indicator`} className="size-6 rounded-full bg-[#dbe7f7]" aria-hidden="true" />;
}

function Pill({ children, className }: { children: ReactNode; className: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${className}`}>{children}</span>;
}

export default function VehicleSizePage() {
  const navigate = useNavigate();
  const {
    selectedService,
    pickupLocation,
    destination,
    journeyDate,
    journeyTime,
    passengerCount: storedPassengers,
    vehicleSize: storedVehicleSize,
    setVehicleSelection,
  } = useBooking();

  // Số khách ban đầu: giá trị đã lưu, mặc định 3 (thiết kế)
  const [passengers, setPassengers] = useState<number>(() =>
    typeof storedPassengers === "number" && storedPassengers >= 1 && storedPassengers <= 6 ? storedPassengers : 3,
  );
  // Xe ban đầu: giá trị đã lưu (nếu còn đủ chỗ), mặc định Seven-Seater (thiết kế)
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleTypeId | null>(() => {
    if (storedVehicleSize === "standard") return (storedPassengers ?? 3) <= STANDARD_MAX ? "standard" : null;
    if (storedVehicleSize === "seven-seater") return (storedPassengers ?? 3) <= SEVEN_SEATER_MAX ? "seven-seater" : null;
    return "seven-seater";
  });

  // Vượt sức chứa thì bỏ chọn — không tự chọn xe khác
  useEffect(() => {
    if (selectedVehicle === "standard" && passengers > STANDARD_MAX) {
      setSelectedVehicle(null);
      setVehicleSelection(null, passengers);
    } else {
      setVehicleSelection(selectedVehicle, passengers);
    }
  }, [passengers, selectedVehicle, setVehicleSelection]);

  // Điều kiện vào trang (sau khi khai báo hook)
  if (!selectedService) return <Navigate to="/services" replace />;
  if (!pickupLocation || !destination || !journeyDate || !journeyTime) return <Navigate to="/journey" replace />;

  const eligible = (v: VehicleInfo) => passengers <= v.max;
  const mismatch = passengers > STANDARD_MAX;

  const changePassengers = (delta: number) => {
    const next = Math.min(6, Math.max(1, passengers + delta));
    setPassengers(next);
    if (selectedVehicle === "standard" && next > STANDARD_MAX) setSelectedVehicle(null);
  };

  const select = (v: VehicleInfo) => {
    if (!eligible(v)) return; // xe không đủ chỗ thì không chọn được
    setSelectedVehicle(v.id);
    setVehicleSelection(v.id, passengers);
  };

  const isContinueEnabled = Boolean(selectedVehicle && VEHICLES.some((v) => v.id === selectedVehicle && eligible(v)));
  const handleContinue = () => {
    if (!isContinueEnabled || !selectedVehicle) return;
    setVehicleSelection(selectedVehicle, passengers);
    navigate("/availability");
  };
  const handleBack = () => {
    setVehicleSelection(selectedVehicle, passengers);
    navigate("/journey");
  };

  const steps = [
    { key: "journey", n: 1, label: "Journey", tone: "bg-[#22b8ef] text-[#0b2341]" },
    { key: "vehicle", n: 2, label: "Vehicle Size", tone: "bg-[#0b4a8b] text-white" },
    { key: "confirm", n: 3, label: "Review", tone: "bg-[#dbe7f7] text-[#0b2341]" },
  ];

  return (
    <MobileFrame>
      <div
        data-testid="vehicle-size-page"
        className={`${FONT} relative flex min-h-[844px] flex-col bg-[#f4f6fd] shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)]`}
      >
        {/* Tóm tắt hành trình (ẩn, cho trình đọc màn hình và test) */}
        <p className="sr-only">
          <span data-testid="summary-pickup">{pickupLocation}</span> to <span data-testid="summary-destination">{destination}</span> at{" "}
          <span data-testid="summary-time">{journeyTime}</span>
        </p>

        <AppBar title="VEHICLE SIZE" onBack={handleBack} backLabel="Back to Journey Details" backTestId="back-button" onCancel={() => navigate("/home")} cancelTestId="cancel-button" />

        <main className="flex flex-1 flex-col gap-4 px-5 pt-3 pb-8">
          {/* Các bước */}
          <ol className="flex items-center gap-2 rounded-xl bg-[#e8eef9] px-3 py-2.5">
            {steps.map((s, i) => (
              <li key={s.key} data-testid={`step-${s.key}`} className="flex flex-1 items-center gap-1.5 last:flex-none">
                <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${s.tone}`}>{s.n}</span>
                <span className={`text-[12.5px] whitespace-nowrap ${s.key === "vehicle" ? "font-semibold text-[#0b2341]" : "text-[#334155]"}`}>{s.label}</span>
                {i < steps.length - 1 && <span className={`h-0.5 flex-1 rounded ${i === 0 ? "bg-[#22b8ef]" : "bg-[#cbd5e1]"}`} aria-hidden="true" />}
              </li>
            ))}
          </ol>

          <div>
            <h1 className="text-[22px] leading-8 font-bold text-[#0b2341]">Select Vehicle Size</h1>
            <p className="text-[14px] leading-5 text-[#334155]">Choose vehicle type based on passenger requirement.</p>
          </div>

          {mismatch && (
            <div role="alert" className="flex gap-2.5 rounded-2xl bg-[#fbe5e5] p-4">
              <span className="mt-0.5 shrink-0 text-[#dc2626]">
                <Icon name="alertCircle" size={18} />
              </span>
              <div>
                <p className="text-[14.5px] leading-5 font-bold text-[#b91c1c]">Capacity mismatch detected</p>
                <p className="pt-0.5 text-[12.5px] leading-[18px] text-[#334155]">
                  Your current party size exceeds the limit for smaller vehicle tiers. Available vehicles have been filtered accordingly.
                </p>
              </div>
            </div>
          )}

          {/* Số khách */}
          <section data-testid="passenger-selector" className="rounded-2xl bg-white p-4 shadow-[0px_1px_3px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between pb-2.5">
              <p className="text-[15px] font-semibold text-[#0b2341]">
                Passenger Count <span className="text-[#dc2626]">*</span>
              </p>
              <span data-testid="passenger-hint" className="text-[12.5px] text-[#475569]">
                {passengers <= STANDARD_MAX ? "Standard or 7-Seater suitable" : "7-Seater suitable"}
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-[#e8eef9] p-1.5">
              <button
                type="button"
                data-testid="decrease-passengers"
                onClick={() => changePassengers(-1)}
                disabled={passengers <= 1}
                aria-label="Fewer passengers"
                className="flex size-11 cursor-pointer items-center justify-center rounded-lg bg-white text-[#0b2341] shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Icon name="minus" size={20} />
              </button>
              <p data-testid="passenger-display" aria-live="polite" className="flex flex-1 items-center justify-center gap-2 text-[17px] font-bold text-[#0b2341]">
                <span className="text-[#0b5cad]">
                  <Icon name="users" size={19} />
                </span>
                {passengers} {passengers === 1 ? "Passenger" : "Passengers"}
              </p>
              <button
                type="button"
                data-testid="increase-passengers"
                onClick={() => changePassengers(1)}
                disabled={passengers >= 6}
                aria-label="More passengers"
                className="flex size-11 cursor-pointer items-center justify-center rounded-lg bg-white text-[#0b2341] shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Icon name="plus" size={20} />
              </button>
            </div>
          </section>

          {mismatch && (
            <div className="flex items-center justify-between px-1">
              <h2 className="text-[13px] font-semibold tracking-[0.8px] text-[#334155]">VEHICLE OPTIONS</h2>
              <span className="text-[12px] text-[#475569]">{VEHICLES.length} tiers available</span>
            </div>
          )}

          {/* Thẻ xe */}
          <div role="radiogroup" aria-label="Vehicle size" className="flex flex-col gap-4">
            {VEHICLES.map((v) => {
              const ok = eligible(v);
              const selected = selectedVehicle === v.id && ok;
              const fleetPill = (
                <Pill className={selected ? "bg-[#0b4a8b] text-white" : "bg-[#22b8ef] text-[#0b2341]"}>
                  <Icon name="badgeCheck" size={13} /> 2024 Fleet • {v.model}
                </Pill>
              );
              return (
                <div key={v.id} className="relative">
                  {selected && (
                    <span className="absolute -top-2.5 right-3 z-10 flex items-center gap-1 rounded-full bg-[#22b8ef] px-2.5 py-0.5 text-[11.5px] font-semibold text-[#0b2341]">
                      <Icon name="badgeCheck" size={12} /> Selected
                    </span>
                  )}
                  <div
                    role="radio"
                    aria-checked={selected}
                    tabIndex={ok ? 0 : -1}
                    data-testid={`vehicle-card-${v.testKey}`}
                    onClick={() => select(v)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        select(v);
                      }
                    }}
                    className={`rounded-2xl p-4 transition-colors ${
                      !ok
                        ? "cursor-not-allowed bg-[#fdf1f1]"
                        : selected
                          ? "cursor-pointer bg-[#e3effc] shadow-[0px_6px_16px_rgba(11,92,173,0.15)] ring-1 ring-[#b6d4f6]"
                          : "cursor-pointer bg-white shadow-[0px_1px_3px_rgba(15,23,42,0.06)] hover:bg-[#fbfdff]"
                    }`}
                  >
                    {mismatch ? (
                      <>
                        {/* Bố cục "Capacity mismatch": tiêu đề + nhãn, ảnh lớn */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="text-[18px] leading-6 font-bold text-[#0b2341]">{v.name}</p>
                            {ok ? (
                              <Pill className="bg-[#cfe9fb] text-[#0b4a8b]">
                                <Icon name="check" size={12} /> Suitable
                              </Pill>
                            ) : (
                              <span data-testid={`${v.testKey}-insufficient-badge`}>
                                <Pill className="bg-[#fde2e2] text-[#dc2626]">
                                  <Icon name="ban" size={12} /> Unavailable
                                </Pill>
                              </span>
                            )}
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-[18px] font-bold text-[#0b2341]">{v.price}</p>
                            <p className="text-[11px] leading-3 text-[#475569]">Base estimate</p>
                          </div>
                        </div>
                        <div className="pt-1.5">{fleetPill}</div>
                        <p className="pt-1.5 text-[13.5px] text-[#334155]">
                          Capacity: Up to {v.max} passengers • {v.bags} Luggage
                        </p>
                        <div className="mt-2.5 flex h-[110px] items-center justify-center overflow-hidden rounded-xl bg-[#eef2fb]">
                          <img src={v.photo} alt={`${v.name} — ${v.model}`} className={`h-full object-contain ${ok ? "" : "opacity-60 grayscale"}`} />
                        </div>
                        {ok ? (
                          <div className="flex items-center justify-between pt-3">
                            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[#0b5cad]">
                              <Icon name="armchair" size={15} /> Spacious interior &amp; luggage room
                            </p>
                            <span className="flex items-center gap-2 text-[13px] font-medium text-[#0b2341]">
                              {selected ? "Selected" : "Select"} <Radio selected={selected} disabled={false} testKey={v.testKey} />
                            </span>
                          </div>
                        ) : (
                          <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-[12.5px] font-semibold text-[#dc2626]">
                            <Icon name="alertCircle" size={15} /> This vehicle cannot accommodate {passengers} passengers.
                            <span className="sr-only">
                              <Radio selected={false} disabled testKey={v.testKey} />
                            </span>
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        {/* Bố cục thường: ảnh nhỏ bên trái */}
                        <div className="flex gap-3.5">
                          <img src={v.thumb} alt={`${v.name} — ${v.model}`} className="h-[64px] w-[96px] shrink-0 rounded-lg object-cover" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-[17px] leading-6 font-bold text-[#0b2341]">{v.name}</p>
                              <Radio selected={selected} disabled={!ok} testKey={v.testKey} />
                            </div>
                            <Pill className={selected ? "bg-[#9cc8f6] text-[#0b2341]" : "bg-[#e2e8f0] text-[#334155]"}>{v.tag}</Pill>
                            <div className="pt-1.5">{fleetPill}</div>
                            <p className="pt-1.5 text-[13.5px] leading-5 text-[#334155]">
                              Up to {v.max} passengers • {v.bags} Luggage
                            </p>
                            <div className="flex items-end justify-between pt-1">
                              <p className="flex items-center gap-2.5 text-[12.5px] text-[#334155]">
                                <span className="flex items-center gap-0.5">
                                  <Icon name="user" size={13} /> {v.max}
                                </span>
                                <span className="flex items-center gap-0.5">
                                  <Icon name="luggage" size={13} /> {v.bags}
                                </span>
                                <span className="flex items-center gap-0.5">
                                  <Icon name={v.extra.icon} size={13} /> {v.extra.label}
                                </span>
                              </p>
                              <p className="text-[19px] font-bold text-[#0b2341]">{v.price}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-2.5">
                          <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-[#0b5cad]">
                            {selected && <Icon name={v.footnote.icon} size={14} />}
                            {v.footnote.label}
                          </p>
                          <span className="text-[12.5px] font-semibold text-[#0b2341]">{selected ? "Confirmed" : "Tap to select"}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {!mismatch && (
            <p className="flex items-start gap-2.5 rounded-2xl bg-[#e8eef9] px-4 py-3 text-[12.5px] leading-[18px] text-[#334155]">
              <span className="shrink-0 text-[#0b5cad]">
                <Icon name="badgeCheck" size={16} />
              </span>
              All vehicles are fully licensed, sanitized prior to dispatch, and piloted by certified private-hire chauffeurs.
            </p>
          )}

          <button
            type="button"
            data-testid="check-availability-button"
            onClick={handleContinue}
            disabled={!isContinueEnabled}
            className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[16px] font-semibold transition-colors ${
              isContinueEnabled
                ? "cursor-pointer bg-[#65b3fc] text-white shadow-[0px_4px_10px_rgba(101,179,252,0.35)] hover:bg-[#3f84c4]"
                : "cursor-not-allowed bg-[#d6e6fb] text-[#64748b]"
            }`}
          >
            {!isContinueEnabled && <Icon name="calendar" size={17} />}
            Check Vehicle Availability
            {isContinueEnabled && <Icon name="arrowRight" size={18} />}
          </button>
          <button
            type="button"
            data-testid="back-to-journey"
            onClick={handleBack}
            className="mx-auto flex cursor-pointer items-center gap-1.5 text-[14px] font-semibold text-[#0b2341] hover:underline"
          >
            <Icon name="arrowLeft" size={16} /> Back to Journey Details
          </button>

          {mismatch && (
            <p className="flex items-center justify-center gap-6 rounded-xl bg-[#e8eef9] py-3 text-[12.5px] text-[#0b2341]">
              <span className="flex items-center gap-1.5">
                <Icon name="shield" size={15} /> Vetted Chauffeurs
              </span>
              <span className="flex items-center gap-1.5">
                <Icon name="clock" size={15} /> Free 15-min Wait
              </span>
            </p>
          )}
        </main>
      </div>
    </MobileFrame>
  );
}
