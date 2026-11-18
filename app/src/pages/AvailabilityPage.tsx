// =============================================================
// AvailabilityPage — SCRUM-18 Check Vehicle Availability, dựng theo thiết kế Sprint 1:
//   "1. Checking Vehicle Availability", "03. Vehicles Available", "1A. Vehicle Unavailable".
// Một trang, 3 trạng thái: CHECKING → AVAILABLE hoặc UNAVAILABLE (quy tắc mô phỏng trong
// src/validation/availabilityRules — theo ngày/giờ, loại xe, số khách). Không tạo booking / thanh toán:
// nút "Proceed to Booking & Payment" của thiết kế được bỏ theo tiêu chí AC-15.
// Thông tin tài xế / biển số là nội dung mẫu của thiết kế. Giữ mọi data-testid các bài test dùng.
// =============================================================
import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import vanPhoto from "../assets/car-van-photo.png";
import standardPhoto from "../assets/car-standard-photo.png";
import AppBar from "../components/AppBar";
import Icon, { type IconName } from "../components/Icon";
import MobileFrame from "../components/MobileFrame";
import { useBooking } from "../context/BookingContext";
import { formatDateDisplay } from "../validation/journeyValidation";
import { calculateFleetAvailability, determineAvailability } from "../validation/availabilityRules";

const FONT = "font-['Inter',sans-serif]";
const CARD = "rounded-2xl bg-white shadow-[0px_1px_3px_rgba(15,23,42,0.06)]";

export type AvailabilityState = "CHECKING" | "AVAILABLE" | "UNAVAILABLE";

function Tile({ label, icon, children, testId }: { label: string; icon?: IconName; children: ReactNode; testId?: string }) {
  return (
    <div className="rounded-xl bg-[#eef3fb] px-3 py-2.5">
      <p className="flex items-center gap-1 text-[12px] text-[#475569]">
        {icon && <Icon name={icon} size={13} />} {label}
      </p>
      <p data-testid={testId} className="pt-0.5 text-[14.5px] leading-5 font-bold text-[#0b2341]">
        {children}
      </p>
    </div>
  );
}

export default function AvailabilityPage() {
  const navigate = useNavigate();
  const { selectedService, pickupLocation, destination, journeyDate, journeyTime, passengerCount, vehicleSize, availabilityResult, setAvailabilityResult } =
    useBooking();

  const [status, setStatus] = useState<AvailabilityState>(() => {
    if (availabilityResult === "available") return "AVAILABLE";
    if (availabilityResult === "unavailable") return "UNAVAILABLE";
    return "CHECKING";
  });
  const [bannerOpen, setBannerOpen] = useState(true);

  // Mô phỏng kiểm tra (600 ms để thấy rõ trạng thái đang kiểm tra)
  useEffect(() => {
    if (status !== "CHECKING" || !vehicleSize || !journeyDate || !journeyTime) return;
    const timer = setTimeout(() => {
      const result = determineAvailability(journeyDate, journeyTime, vehicleSize, passengerCount);
      setStatus(result === "available" ? "AVAILABLE" : "UNAVAILABLE");
      setAvailabilityResult(result);
    }, 600);
    return () => clearTimeout(timer);
  }, [status, journeyDate, journeyTime, vehicleSize, passengerCount, setAvailabilityResult]);

  // Điều kiện vào trang (sau khi khai báo hook)
  if (!selectedService) return <Navigate to="/services" replace />;
  if (!pickupLocation || !destination || !journeyDate || !journeyTime) return <Navigate to="/journey" replace />;
  if (!vehicleSize) return <Navigate to="/vehicle" replace />;
  if (passengerCount > (vehicleSize === "standard" ? 4 : 6)) return <Navigate to="/vehicle" replace />;

  const isVan = vehicleSize === "seven-seater";
  const fleetTitle = isVan ? "Seven-Seater" : "Standard Car";
  const fleet = calculateFleetAvailability(journeyDate, journeyTime, vehicleSize, passengerCount);
  const split = (full: string) => {
    const parts = full.split(",");
    return { title: parts[0]?.trim() || full, sub: parts.slice(1).join(",").trim() };
  };
  const pickup = split(pickupLocation);
  const dest = split(destination);
  // "25 Nov 2026, 14:30" như thiết kế (rơi về dd/mm/yyyy nếu ngày không đọc được)
  const parsed = new Date(`${journeyDate}T00:00:00`);
  const dateLabel = Number.isNaN(parsed.getTime())
    ? formatDateDisplay(journeyDate)
    : parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const dateShort = `${dateLabel}, ${journeyTime}`;

  const toJourney = () => navigate("/journey");
  const toVehicle = () => navigate("/vehicle");

  const changeLinks = (
    <div className="flex items-center justify-between gap-2 pt-3 text-[13.5px] font-medium text-[#0b5cad]">
      <button type="button" onClick={toJourney} className="flex cursor-pointer items-center gap-1.5 text-left hover:underline">
        <Icon name="calendar" size={14} /> Change Journey Details
      </button>
      <button type="button" onClick={toVehicle} className="flex cursor-pointer items-center gap-1.5 text-left hover:underline">
        <Icon name="sliders" size={14} /> Change Vehicle Size
      </button>
    </div>
  );

  return (
    <MobileFrame>
      <div
        data-testid="availability-page"
        className={`${FONT} relative flex min-h-[844px] flex-col bg-[#f4f6fd] shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)]`}
      >
        <p className="sr-only">
          <span data-testid="summary-service">{selectedService.title}</span>, <span data-testid="summary-passengers">{passengerCount} Passengers</span>,{" "}
          <span data-testid="summary-vehicle">{fleetTitle}</span>
        </p>
        <ol className="sr-only">
          <li data-testid="step-journey">Journey</li>
          <li data-testid="step-vehicle">Vehicle</li>
          <li data-testid="step-confirm">Review</li>
        </ol>

        <AppBar title="" onBack={toVehicle} backLabel="Back to Vehicle Size" backTestId="back-to-vehicle-btn" onCancel={() => navigate("/home")} cancelTestId="cancel-button" />

        <main className="flex flex-1 flex-col gap-4 px-5 pt-3 pb-8">
          <div>
            {status === "AVAILABLE" && (
              <p className="flex items-center gap-1.5 text-[13px] font-semibold tracking-[0.8px] text-[#0e7490]">
                <Icon name="badgeCheck" size={15} /> AVAILABILITY CHECK
              </p>
            )}
            <h1 className="text-[21px] leading-8 font-bold tracking-[0.2px] text-[#0b2341] uppercase">Check Vehicle Availability</h1>
            <p className="text-[14px] leading-5 text-[#334155]">Availability status for selected journey requirements</p>
          </div>

          {/* Banner xác nhận còn xe */}
          {status === "AVAILABLE" && bannerOpen && (
            <section className="relative flex gap-3 rounded-2xl bg-[#d4ecfb] p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#0b5c7a] text-white">
                <Icon name="badgeCheck" size={20} />
              </span>
              <div className="min-w-0 pr-5">
                <p className="flex flex-wrap items-center gap-2">
                  <span data-testid="vehicle-available-badge" className="text-[16px] leading-5 font-semibold tracking-[0.5px] text-[#0b2341]">
                    VEHICLE AVAILABLE
                  </span>
                  <span data-testid="available-pill" className="rounded-full bg-[#22b8ef] px-2 py-0.5 text-[11.5px] font-semibold text-[#0b2341]">
                    Confirmed
                  </span>
                </p>
                <p className="pt-1 text-[14px] leading-5 text-[#334155]">
                  Great news! A dedicated chauffeur vehicle has been allocated and secured for your travel slot.
                </p>
                <p className="flex items-center gap-1 pt-2 text-[12px] text-[#0b5cad]">
                  <Icon name="clock" size={13} /> Auto-confirmed for your selected schedule
                </p>
              </div>
              <button type="button" onClick={() => setBannerOpen(false)} aria-label="Dismiss" className="absolute top-3 right-3 cursor-pointer text-[#475569]">
                <Icon name="close" size={17} />
              </button>
            </section>
          )}

          {/* Tóm tắt hành trình */}
          <section data-testid="journey-summary-card" className={`${CARD} p-4`}>
            <div className="flex items-center justify-between pb-3">
              <p className="flex items-center gap-1.5 text-[14px] font-bold tracking-[0.6px] text-[#0b2341]">
                <Icon name="route" size={16} /> JOURNEY SUMMARY
              </p>
              <span className="rounded-full bg-[#dbeafe] px-2.5 py-0.5 text-[11.5px] font-medium text-[#0b4a8b]">
                {status === "CHECKING" ? "Reviewing" : status === "AVAILABLE" ? "Active Request" : "Step 2 of 3"}
              </span>
            </div>
            <div className="flex flex-col gap-2 rounded-xl bg-[#eef3fb] p-3 text-[13.5px]">
              <p className="flex justify-between gap-3">
                <span className="flex items-center gap-1.5 text-[#475569]">
                  <Icon name={selectedService.icon} size={14} /> Service
                </span>
                <span className="text-right font-semibold text-[#0b2341]">{selectedService.title}</span>
              </p>
              <p className="flex justify-between gap-3">
                <span className="flex shrink-0 items-center gap-1.5 text-[#475569]">
                  <span className="size-3 rounded-full border-2 border-[#0b4a8b]" /> Pickup
                </span>
                <span className="text-right font-semibold text-[#0b2341]">
                  <span data-testid="summary-pickup-title">{pickup.title}</span>
                  {pickup.sub && <span className="block text-[12px] font-normal text-[#475569]">{pickup.sub}</span>}
                </span>
              </p>
              <p className="flex justify-between gap-3">
                <span className="flex shrink-0 items-center gap-1.5 text-[#475569]">
                  <Icon name="mapPin" size={14} /> Destination
                </span>
                <span className="text-right font-semibold text-[#0b2341]">
                  <span data-testid="summary-dest-title">{dest.title}</span>
                  {dest.sub && <span className="block text-[12px] font-normal text-[#475569]">{dest.sub}</span>}
                </span>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Tile label="Date & Time" icon="clock" testId="summary-datetime-val">
                {dateShort}
              </Tile>
              <Tile label="Passengers" icon="users" testId="summary-passenger-val">
                {passengerCount} {passengerCount === 1 ? "Passenger" : "Passengers"}
              </Tile>
              <div className="col-span-2">
                <Tile label="Vehicle Size" icon="car" testId="summary-fleet-val">
                  {fleetTitle}
                </Tile>
              </div>
            </div>
            {changeLinks}
          </section>

          {/* ĐANG KIỂM TRA */}
          {status === "CHECKING" && (
            <>
              <section data-testid="checking-state-card" className={`${CARD} flex flex-col items-center p-5 text-center`} aria-live="polite">
                <div className="relative flex size-40 items-center justify-center rounded-full bg-[#e3effc]">
                  <div className="absolute inset-4 rounded-full bg-[#cfe5fb] motion-safe:animate-pulse" />
                  <div className="relative flex size-24 flex-col items-center justify-center rounded-full bg-white shadow-md">
                    <span className="flex size-10 items-center justify-center rounded-full bg-[#cfe5fb] text-[#0b4a8b]">
                      <Icon name="car" size={20} />
                    </span>
                    <span className="flex items-center gap-1 pt-1 text-[10px] font-bold tracking-[0.6px] text-[#0b4a8b]">
                      <span className="size-1.5 rounded-full bg-[#0b4a8b]" /> LIVE SCAN
                    </span>
                  </div>
                </div>
                <p className="pt-4 text-[17px] leading-6 font-bold text-[#0b2341]">CHECKING VEHICLE AVAILABILITY...</p>
                <p className="pt-1 text-[14px] leading-5 text-[#334155]">
                  Searching our live fleet for a suitable vehicle matching your selected journey and luggage capacity.
                </p>
                <div className="flex gap-1.5 pt-3" aria-hidden="true">
                  <span className="size-2 rounded-full bg-[#0b4a8b]" />
                  <span className="size-2 rounded-full bg-[#65b3fc]" />
                  <span className="size-2 rounded-full bg-[#22b8ef]" />
                </div>
                <div className="mt-4 flex w-full items-start gap-3 rounded-xl bg-[#e8eef9] p-3 text-left">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-[#0b5cad]">
                    <Icon name="repeat" size={15} />
                  </span>
                  <div>
                    <p className="text-[14px] font-semibold text-[#0b2341]">Checking availability...</p>
                    <p className="text-[12.5px] text-[#475569]">Please wait while we check vehicles. Loading — no action needed.</p>
                  </div>
                </div>
              </section>
              <section className="rounded-2xl bg-[#e8eef9] p-4">
                <div className="flex items-center justify-between pb-3">
                  <p className="text-[12.5px] font-medium tracking-[0.5px] text-[#334155]">FLEET DISPATCH CRITERIA</p>
                  <p className="text-[12.5px] font-semibold text-[#0b5cad]">Step 2 of 4</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { icon: "shield", t: "Licensed", s: "Private Hire" },
                      { icon: "luggage", t: isVan ? "4+ Bags" : "2 Bags", s: "Boot Capacity" },
                      { icon: "armchair", t: isVan ? "7 Seats" : "5 Seats", s: isVan ? "Spacious MPV" : "Saloon" },
                    ] as const
                  ).map((c) => (
                    <div key={c.s} className="flex flex-col items-center rounded-xl bg-white px-2 py-3 text-center">
                      <span className="text-[#0b5cad]">
                        <Icon name={c.icon} size={17} />
                      </span>
                      <p className="pt-1.5 text-[12.5px] font-bold text-[#0b2341]">{c.t}</p>
                      <p className="text-[11px] text-[#475569]">{c.s}</p>
                    </div>
                  ))}
                </div>
              </section>
              <button type="button" disabled className="flex h-12 w-full cursor-wait items-center justify-center gap-2 rounded-xl bg-[#3f84c4] text-[16px] font-semibold text-white">
                <span className="size-4 rounded-full border-2 border-white/40 border-t-white motion-safe:animate-spin" aria-hidden="true" /> Checking...
              </button>
            </>
          )}

          {/* CÒN XE */}
          {status === "AVAILABLE" && (
            <>
              <section data-testid="available-state-card" className={`${CARD} p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-semibold tracking-[0.8px] text-[#0e7490]">INVENTORY VERIFIED</p>
                    <p className="text-[17px] leading-6 font-semibold tracking-[0.3px] text-[#0b2341]">VEHICLES AVAILABLE</p>
                  </div>
                  <span className="flex items-center gap-1.5 rounded-full bg-[#cfe9fb] px-3 py-1 text-[12px] font-medium text-[#0b2341]">
                    <span className="size-2 rounded-full bg-[#0b4a8b]" /> Ready for Dispatch
                  </span>
                </div>

                <div className="mt-3 rounded-xl bg-[#eef3fb] p-3">
                  <div className="relative flex h-[150px] items-center justify-center rounded-lg bg-white">
                    <img src={isVan ? vanPhoto : standardPhoto} alt={isVan ? "Mercedes-Benz V-Class" : "Mercedes E-Class"} className="h-[120px] object-contain" />
                    <span className="absolute top-2 right-2 rounded-full bg-[#334155] px-2.5 py-0.5 text-[11px] font-semibold text-white">
                      {isVan ? "Premium Executive MPV" : "Executive Saloon"}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3 pt-3">
                    <div>
                      <p className="text-[17px] font-semibold text-[#0b2341]">{fleetTitle}</p>
                      <p className="text-[13.5px] leading-5 text-[#334155]">{isVan ? "Mercedes-Benz V-Class" : "Mercedes E-Class"} or executive equivalent</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[11.5px] text-[#475569]">Fixed transparent fare</p>
                      <p className="text-[20px] font-bold text-[#0b2341]">{isVan ? "£6.00" : "£4.00"}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 text-[12.5px] font-medium text-[#0b2341]">
                    {(
                      [
                        { icon: "users", t: `Up to ${isVan ? 6 : 4} passengers` },
                        { icon: "luggage", t: `Up to ${isVan ? 4 : 2} large bags` },
                        { icon: "armchair", t: "Extra Legroom" },
                        { icon: "wifi", t: "Free Wi-Fi & USB" },
                      ] as const
                    ).map((f) => (
                      <span key={f.t} className="flex items-center gap-1.5 rounded-md bg-white px-2 py-1.5">
                        <span className="text-[#0b5cad]">
                          <Icon name={f.icon} size={14} />
                        </span>
                        {f.t}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 flex items-start gap-2 rounded-lg bg-[#dbe8f8] px-3 py-2.5 text-[12.5px] text-[#334155]">
                    <span className="mt-0.5 shrink-0 text-[#0b5cad]">
                      <Icon name="badgeCheck" size={15} />
                    </span>
                    <span>
                      <span className="block font-semibold text-[#0b2341]">Guaranteed vehicle assigned for this slot</span>
                      Includes flight monitoring and 45 minutes complimentary wait time.
                    </span>
                  </p>

                  {/* Xe / tài xế được gán (nội dung mẫu) */}
                  <div className="mt-2 rounded-lg bg-white p-3">
                    <div className="flex items-center justify-between border-b border-[#eef2f7] pb-2.5">
                      <p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-[#0b2341]">
                        <Icon name="car" size={15} /> Assigned Vehicle
                      </p>
                      <p className="flex items-center gap-2 text-[12px] text-[#475569]">
                        <span className="rounded-md bg-[#dbe8f8] px-2 py-1 font-mono text-[12.5px] font-bold text-[#0b2341]">MC24 VCL</span>
                        2024 {isVan ? "V-Class" : "E-Class"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 pt-2.5">
                      <span className="flex size-10 items-center justify-center rounded-full bg-[#dbe8f8] text-[#0b5cad]">
                        <Icon name="user" size={19} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1 text-[14px] font-semibold text-[#0b2341]">
                          David Edwards <span className="text-[#0b5cad]"><Icon name="badgeCheck" size={14} /></span>
                        </p>
                        <p className="truncate text-[12px] text-[#475569]">Licensed Private Hire Chauffeur</p>
                      </div>
                      <span className="flex items-center gap-1 rounded-full bg-[#eef3fb] px-2 py-0.5 text-[12px] font-semibold text-[#0b2341]">
                        <span className="text-[#f59e0b]"><Icon name="star" size={12} /></span> 4.98 <span className="font-normal text-[#475569]">(520+)</span>
                      </span>
                    </div>
                    <div className="flex gap-2 pt-2.5 text-[11.5px] font-medium text-[#0b2341]">
                      <span className="flex items-center gap-1 rounded-full bg-[#cfe9fb] px-2.5 py-1">
                        <Icon name="shield" size={12} /> DBS Checked &amp; Certified
                      </span>
                      <span className="flex items-center gap-1 rounded-full bg-[#dbe8f8] px-2.5 py-1">
                        <Icon name="shield" size={12} /> TfGM Licensed
                      </span>
                    </div>
                    <p className="flex items-center justify-between pt-2.5 text-[12.5px] text-[#334155]">
                      <span className="flex items-center gap-1">
                        <Icon name="phone" size={13} /> Direct Contact:
                      </span>
                      <span className="font-semibold text-[#0b5cad]">+44 7700 900542</span>
                    </p>
                    <div className="grid grid-cols-2 gap-2 pt-2.5">
                      <a href="tel:+447700900542" className="flex h-11 items-center justify-center gap-2 rounded-lg bg-[#65b3fc] text-[14px] font-semibold text-[#0b2341] hover:bg-[#3f84c4] hover:text-white">
                        <Icon name="phone" size={16} /> Call Driver
                      </a>
                      <button type="button" className="flex h-11 cursor-default items-center justify-center gap-2 rounded-lg border border-[#cbd5e1] bg-white text-[14px] font-semibold text-[#0b2341]">
                        <Icon name="message" size={16} /> Message
                      </button>
                    </div>
                  </div>
                </div>
              </section>
              <div className="grid grid-cols-2 gap-2.5">
                <button type="button" data-testid="change-datetime-btn" onClick={toJourney} className={`${CARD} flex h-12 cursor-pointer items-center justify-center gap-1.5 text-[14px] font-semibold text-[#0b2341] hover:bg-[#fbfdff]`}>
                  <Icon name="calendar" size={15} /> Change Date or Time
                </button>
                <button type="button" data-testid="change-vehicle-btn" onClick={toVehicle} className={`${CARD} flex h-12 cursor-pointer items-center justify-center gap-1.5 text-[14px] font-semibold text-[#0b2341] hover:bg-[#fbfdff]`}>
                  <Icon name="repeat" size={15} /> Change Vehicle Size
                </button>
              </div>
              <button type="button" data-testid="back-to-journey-link" onClick={toJourney} className="mx-auto flex cursor-pointer items-center gap-1.5 text-[14px] font-medium text-[#334155] hover:underline">
                <Icon name="arrowLeft" size={15} /> Back to Journey Details
              </button>
            </>
          )}

          {/* HẾT XE */}
          {status === "UNAVAILABLE" && (
            <>
              <section data-testid="unavailable-state-card" className="rounded-2xl bg-[#fbe4e4] p-4">
                <div className="flex items-center justify-between gap-2">
                  <span data-testid="vehicle-unavailable-badge" className="flex items-center gap-1.5 rounded-lg bg-[#b91c1c] px-2.5 py-1 text-[12.5px] font-bold tracking-[0.5px] text-white">
                    <Icon name="alertCircle" size={14} /> STATUS: <span className="sr-only">VEHICLE </span>UNAVAILABLE
                  </span>
                  <span className="text-[14px] font-semibold text-[#b91c1c]">{fleetTitle}</span>
                </div>
                <div className="flex items-start gap-3 pt-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#f6c9c9] text-[#b91c1c]">
                    <Icon name="calendarX" size={19} />
                  </span>
                  <div>
                    <h2 className="text-[18px] leading-6 font-bold text-[#b91c1c]">No {fleetTitle} Available</h2>
                    <p className="pt-1 text-[14px] leading-5 text-[#334155]">
                      No suitable vehicle is available at your selected date and time. Please choose another date or time and check again.
                    </p>
                  </div>
                </div>
                <dl className="mt-3 flex flex-col gap-2.5 rounded-xl bg-white p-3.5 text-[13px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-[#475569]">Vehicle Class</dt>
                    <dd className="text-right font-semibold text-[#0b2341]">
                      {fleetTitle} (Up to {isVan ? "6 pax + 4 bags" : "4 pax + 2 bags"})
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[#475569]">Simulated Fleet</dt>
                    <dd className="font-semibold text-[#0b2341]">{fleet.eligibleVehicleCount} Vehicles assigned</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[#475569]">Slot Status</dt>
                    <dd data-testid="unavailable-pill" className="flex items-center gap-1.5 font-semibold text-[#dc2626]">
                      <span className="size-2 rounded-full bg-[#dc2626]" /> Fully booked for {journeyTime}
                    </dd>
                  </div>
                </dl>
              </section>
              <section className="flex gap-3 rounded-2xl bg-[#e8eef9] p-4">
                <span className="shrink-0 text-[#0b5cad]">
                  <Icon name="info" size={17} />
                </span>
                <div>
                  <p className="text-[14px] font-semibold text-[#0b2341]">Need a ride right away?</p>
                  <p className="pt-0.5 text-[13px] leading-[18px] text-[#334155]">
                    Shifting your departure by 30 to 45 minutes or picking an Executive or Standard Saloon often reveals open fleet slots.
                  </p>
                </div>
              </section>
              <button
                type="button"
                data-testid="change-datetime-btn"
                onClick={toJourney}
                className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#65b3fc] text-[15px] font-semibold text-white shadow-[0px_4px_10px_rgba(101,179,252,0.35)] hover:bg-[#3f84c4]"
              >
                <Icon name="clock" size={16} /> Change Date or Time
              </button>
              <button
                type="button"
                data-testid="change-vehicle-btn"
                onClick={toVehicle}
                className={`${CARD} flex h-12 w-full cursor-pointer items-center justify-center gap-2 text-[15px] font-semibold text-[#0b2341] hover:bg-[#fbfdff]`}
              >
                <Icon name="repeat" size={16} /> Change Vehicle Size
              </button>
              <button type="button" data-testid="back-to-journey-link" onClick={toJourney} className="mx-auto flex cursor-pointer items-center gap-1.5 text-[14px] font-medium text-[#334155] hover:underline">
                <Icon name="arrowLeft" size={15} /> Back to Journey Details
              </button>
            </>
          )}
        </main>
      </div>
    </MobileFrame>
  );
}
