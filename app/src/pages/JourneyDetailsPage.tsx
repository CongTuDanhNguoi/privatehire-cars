// =============================================================
// JourneyDetailsPage — SCRUM-16 Journey Details, dựng theo thiết kế Sprint 1:
//   "1. Journey Details - Normal", "1A. Journey Details - Validation Errors",
//   "2. Pickup Location Search", "3. Destination Search", "4. Set Location on Map".
// Một trang, 4 chế độ (form / tìm điểm đón / tìm điểm đến / bản đồ). Logic giữ như bản trước:
// kiểm tra lỗi (src/validation/journeyValidation), lưu vào BookingContext, đổi chỗ, chọn từ danh sách / bản đồ.
// Giữ id (#pickupLocation, #destination, #journeyDate, #journeyTime, #pickup-search-input, #dest-search-input),
// data-testid và data-node-id (6:1538 Change, 6:1613 Continue, 6:1619 Back) cho các bài test.
// =============================================================
import { useState, type FormEvent, type ReactNode } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import destinationHero from "../assets/destination-hero.png";
import AppBar from "../components/AppBar";
import Icon, { type IconName } from "../components/Icon";
import MobileFrame from "../components/MobileFrame";
import { useBooking } from "../context/BookingContext";
import { searchLocations, type MockLocation } from "../data/locations";
import { getDayOfWeek, getTodayIso, validateJourneyForm, type JourneyErrors, type JourneyFormData } from "../validation/journeyValidation";

const FONT = "font-['Inter',sans-serif]";
const CARD = "rounded-2xl bg-white shadow-[0px_1px_3px_rgba(15,23,42,0.06)]";

type ViewMode = "form" | "pickup-search" | "destination-search" | "map";
type Target = "pickup" | "destination";

interface Pin {
  title: string;
  address: string;
  fullValue: string;
  icon: IconName;
}

const MAP_DEFAULTS: Record<Target, Pin> = {
  pickup: {
    title: "Manchester Piccadilly Station",
    address: "Station Approach, Manchester, Postcode: M1 2PB",
    fullValue: "Manchester Piccadilly Station, M1 2PB",
    icon: "train",
  },
  destination: {
    title: "Manchester Airport Terminal 2",
    address: "Ringway, Manchester, Postcode: M90 4FP",
    fullValue: "Manchester Airport Terminal 2, M90 4FP",
    icon: "planeTakeoff",
  },
};

// ---------- khối nhỏ dùng chung ----------
function Screen({ children, title, onBack, onCancel }: { children: ReactNode; title: string; onBack: () => void; onCancel: () => void }) {
  return (
    <MobileFrame>
      <div className={`${FONT} relative flex min-h-[844px] flex-col bg-[#f4f6fd] shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)]`}>
        <AppBar title={title} onBack={onBack} onCancel={onCancel} />
        {children}
      </div>
    </MobileFrame>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p className="flex items-start gap-1 text-[12px] leading-4 text-[#dc2626]">
      <span className="mt-px shrink-0">
        <Icon name="alert" size={13} />
      </span>
      <span>
        * <span id={id} role="alert">{message}</span>
      </span>
    </p>
  );
}

function LocationRow({ loc, onSelect, dot }: { loc: MockLocation; onSelect: () => void; dot?: boolean }) {
  return (
    <button type="button" onClick={onSelect} className={`${CARD} flex w-full cursor-pointer items-center gap-3 px-3.5 py-3 text-left transition-shadow hover:shadow-md`}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#e0edfd] text-[#0b5cad]">
        <Icon name={loc.icon} size={19} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[14px] leading-5 font-semibold text-[#0b2341]">{loc.name}</span>
          {dot && <span className="size-1.5 shrink-0 rounded-full bg-[#0b5cad]" aria-hidden="true" />}
          {loc.tag && (
            <span className="shrink-0 rounded-md bg-[#dbeafe] px-1.5 py-0.5 text-[10px] font-semibold text-[#0b4a8b]">{loc.tag}</span>
          )}
        </span>
        <span className="block truncate text-[12.5px] leading-4 text-[#475569]">{loc.address}</span>
      </span>
      <span className="shrink-0 text-[#64748b]">
        <Icon name="chevronRight" size={18} />
      </span>
    </button>
  );
}

function SearchBox({ id, placeholder, value, onChange }: { id: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className={`${CARD} flex h-12 items-center gap-2.5 px-3.5`}>
      <span className="text-[#475569]">
        <Icon name="search" size={19} />
      </span>
      <label htmlFor={id} className="sr-only">
        {placeholder}
      </label>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus
        autoComplete="off"
        className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-[#0f172a] outline-none placeholder:text-[#64748b]"
      />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="Clear search" className="cursor-pointer text-[#64748b]">
          <Icon name="xCircle" size={18} />
        </button>
      )}
    </div>
  );
}

function QuickButtons({ onMap, onSaved }: { onMap: () => void; onSaved: () => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <button type="button" onClick={onMap} className={`${CARD} flex h-12 cursor-pointer items-center justify-center gap-2 text-[14px] font-semibold text-[#0b2341] hover:bg-[#fbfdff]`}>
        <Icon name="mapPin" size={17} /> Set on Map
      </button>
      <button type="button" onClick={onSaved} className={`${CARD} flex h-12 cursor-pointer items-center justify-center gap-2 text-[14px] font-semibold text-[#0b2341] hover:bg-[#fbfdff]`}>
        <Icon name="bookmark" size={17} /> Saved Places
      </button>
    </div>
  );
}

// ---------- trang ----------
export default function JourneyDetailsPage() {
  const navigate = useNavigate();
  const { selectedService, pickupLocation, destination, journeyDate, journeyTime, setJourneyDetails } = useBooking();

  const [viewMode, setViewMode] = useState<ViewMode>("form");
  const [mapTarget, setMapTarget] = useState<Target>("pickup");
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState<JourneyFormData>({
    pickupLocation: pickupLocation || "",
    destination: destination || "",
    journeyDate: journeyDate || "",
    journeyTime: journeyTime || "",
  });
  const [errors, setErrors] = useState<JourneyErrors>({});
  const [pinnedLocation, setPinnedLocation] = useState<Pin>(MAP_DEFAULTS.pickup);
  const [pin, setPin] = useState({ x: 50, y: 42 }); // vị trí ghim trên bản đồ (%)

  // Chưa chọn dịch vụ → quay lại Service Selection (sau khi khai báo hook)
  if (!selectedService) {
    return <Navigate to="/services" replace />;
  }

  function handleChange(field: keyof JourneyFormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setJourneyDetails({ [field]: value });
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleSwapLocations() {
    const newPickup = formData.destination;
    const newDest = formData.pickupLocation;
    setFormData((prev) => ({ ...prev, pickupLocation: newPickup, destination: newDest }));
    setJourneyDetails({ pickupLocation: newPickup, destination: newDest });
    setErrors((prev) => ({ ...prev, pickupLocation: undefined, destination: undefined }));
  }

  function openSearch(target: Target) {
    setSearchQuery("");
    setViewMode(target === "pickup" ? "pickup-search" : "destination-search");
  }

  function openMap(target: Target) {
    setMapTarget(target);
    setPinnedLocation(MAP_DEFAULTS[target]);
    setPin({ x: 50, y: 42 });
    setViewMode("map");
  }

  function handleSelectFromSearch(location: MockLocation, target: Target) {
    const fullAddress = `${location.name}, ${location.postcode}`;
    handleChange(target === "pickup" ? "pickupLocation" : "destination", fullAddress);
    setViewMode("form");
  }

  function handleConfirmFromMap() {
    handleChange(mapTarget === "pickup" ? "pickupLocation" : "destination", pinnedLocation.fullValue);
    setViewMode("form");
  }

  function handleUseCurrentLocation() {
    handleChange("pickupLocation", "Manchester Piccadilly Station, M1 2PB");
    setViewMode("form");
  }

  function handleSubmit(e?: FormEvent) {
    if (e) e.preventDefault();
    const validationErrors = validateJourneyForm(formData, new Date());
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      const first = (["pickupLocation", "destination", "journeyDate", "journeyTime"] as const).find((f) => validationErrors[f]);
      if (first) document.getElementById(first)?.focus();
      return;
    }
    setJourneyDetails(formData);
    navigate("/vehicle");
  }

  const cancel = () => navigate("/home");
  const dayOfWeekDisplay = getDayOfWeek(formData.journeyDate);
  const minDate = getTodayIso();
  const hasErrors = Object.values(errors).some(Boolean);

  // =========================================================================
  // Chọn điểm đón
  // =========================================================================
  if (viewMode === "pickup-search") {
    const results = searchLocations(searchQuery, "pickup");
    const recent = results.filter((l) => l.group === "recent");
    const hubs = results.filter((l) => l.group === "hub");
    return (
      <Screen title="Location Search" onBack={() => setViewMode("form")} onCancel={cancel}>
        <main className="flex flex-1 flex-col gap-4 px-5 pt-3 pb-8">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-[13px] text-[#0b2341]">
              <span className="flex size-5 items-center justify-center rounded-full bg-[#05c1fa] text-[11px] font-bold text-[#0b2341]">1</span>
              Step 1 of 3: Pickup
            </p>
            <p className="flex items-center gap-1 text-[12.5px] font-semibold text-[#0b5cad]">
              <span className="size-1.5 rounded-full bg-[#0b5cad]" aria-hidden="true" /> Live Dispatch
            </p>
          </div>
          <div>
            <h1 className="text-[22px] leading-8 font-bold text-[#0b2341]">Select Pickup Location</h1>
            <p className="pt-1 text-[14px] leading-5 text-[#475569]">Choose a suggested location or search by address or postcode.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <SearchBox id="pickup-search-input" placeholder="Search pickup location, postcode or address" value={searchQuery} onChange={setSearchQuery} />
            <div className="flex items-center justify-between px-1 text-[11.5px] text-[#475569]">
              <span>E.g., Piccadilly, M1 2PB, or Terminal 1</span>
              <button type="button" onClick={handleUseCurrentLocation} className="cursor-pointer font-semibold text-[#0b5cad] hover:underline">
                GPS autofill
              </button>
            </div>
          </div>
          <QuickButtons onMap={() => openMap("pickup")} onSaved={() => setSearchQuery("")} />

          {recent.length > 0 && (
            <section className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-[13px] font-bold tracking-[0.8px] text-[#0b2341]">RECENT &amp; SAVED PICKUPS</h2>
                <button type="button" onClick={() => setSearchQuery("")} className="cursor-pointer text-[12.5px] font-medium text-[#0b5cad]">
                  Clear
                </button>
              </div>
              {recent.map((loc) => (
                <LocationRow key={loc.id} loc={loc} onSelect={() => handleSelectFromSearch(loc, "pickup")} />
              ))}
            </section>
          )}
          {hubs.length > 0 && (
            <section className="flex flex-col gap-2.5 pt-1">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 text-[13px] font-bold tracking-[0.8px] text-[#0b2341]">
                  <Icon name="planeTakeoff" size={15} /> SUGGESTED HUBS
                </h2>
                <span className="text-[12px] text-[#475569]">Major Transit Points</span>
              </div>
              {hubs.map((loc) => (
                <LocationRow key={loc.id} loc={loc} onSelect={() => handleSelectFromSearch(loc, "pickup")} />
              ))}
            </section>
          )}
          {results.length === 0 && <p className="py-6 text-center text-[13px] text-[#475569]">No locations match “{searchQuery}”. Try a postcode or use Set on Map.</p>}

          <button type="button" onClick={() => setViewMode("form")} className="mx-auto flex cursor-pointer items-center gap-1.5 pt-2 text-[14px] font-semibold text-[#0b5cad] hover:underline">
            <Icon name="arrowLeft" size={16} /> Back to Journey Details
          </button>
          <p className="flex items-start gap-2 rounded-xl bg-[#e8eef9] px-3.5 py-2.5 text-[11.5px] leading-4 text-[#334155]">
            <span className="shrink-0 text-[#0b5cad]">
              <Icon name="shield" size={15} />
            </span>
            Licensed drivers verified with local city council regulations. Fixed transparent pricing guaranteed.
          </p>
        </main>
      </Screen>
    );
  }

  // =========================================================================
  // Chọn điểm đến
  // =========================================================================
  if (viewMode === "destination-search") {
    const results = searchLocations(searchQuery, "destination");
    const recent = results.filter((l) => l.group === "recent");
    const hubs = results.filter((l) => l.group === "hub");
    return (
      <Screen title="Location Search" onBack={() => setViewMode("form")} onCancel={cancel}>
        <main className="flex flex-1 flex-col gap-4 px-5 pt-3 pb-8">
          <img src={destinationHero} alt="Smart Route — Where are you heading?" className="h-[126px] w-full rounded-2xl object-cover" />
          <div>
            <h1 className="flex items-center gap-2 text-[16px] leading-6 font-bold tracking-[0.8px] text-[#0b2341]">
              <span className="h-5 w-1 rounded-full bg-[#0b5cad]" aria-hidden="true" /> <span className="uppercase">Select Destination</span>
            </h1>
            <p className="text-[13.5px] text-[#475569]">Select or search destination</p>
          </div>
          <SearchBox id="dest-search-input" placeholder="Search destination, postcode or airport..." value={searchQuery} onChange={setSearchQuery} />
          <QuickButtons onMap={() => openMap("destination")} onSaved={() => setSearchQuery("")} />

          {recent.length > 0 && (
            <section className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 text-[12.5px] font-bold tracking-[0.6px] text-[#334155]">
                  <Icon name="history" size={14} /> RECENT &amp; SAVED DESTINATIONS
                </h2>
                <span className="text-[12px] text-[#475569]">{recent.length} locations</span>
              </div>
              {recent.map((loc, i) => (
                <LocationRow key={loc.id} loc={loc} dot={i === 0 && !searchQuery} onSelect={() => handleSelectFromSearch(loc, "destination")} />
              ))}
            </section>
          )}
          {hubs.length > 0 && (
            <section className="flex flex-col gap-2.5 pt-1">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 text-[12.5px] font-bold tracking-[0.6px] text-[#334155]">
                  <Icon name="route" size={14} /> SUGGESTED HUBS
                </h2>
                <span className="text-[12px] font-medium text-[#0b5cad]">Popular</span>
              </div>
              {hubs.map((loc) => (
                <LocationRow key={loc.id} loc={loc} onSelect={() => handleSelectFromSearch(loc, "destination")} />
              ))}
            </section>
          )}
          {results.length === 0 && <p className="py-6 text-center text-[13px] text-[#475569]">No destinations match “{searchQuery}”. Try a postcode or use Set on Map.</p>}

          <button type="button" onClick={() => setViewMode("form")} className="mx-auto flex cursor-pointer items-center gap-1.5 pt-2 text-[14px] font-semibold text-[#0b5cad] hover:underline">
            <Icon name="arrowLeft" size={16} /> Back to Journey Details
          </button>
        </main>
      </Screen>
    );
  }

  // =========================================================================
  // Bản đồ (mô phỏng)
  // =========================================================================
  if (viewMode === "map") {
    const lat = (53.3653 + (42 - pin.y) * 0.0006).toFixed(4);
    const lng = (2.2728 - (pin.x - 50) * 0.0009).toFixed(4);
    return (
      <Screen title="Location Search" onBack={() => openSearch(mapTarget)} onCancel={cancel}>
        <main className="flex flex-1 flex-col gap-4 px-5 pt-3 pb-8">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-[17px] leading-6 font-bold tracking-[0.3px] text-[#0b2341]">
                <span className="sr-only">Set Location on Map — </span>
                <span className="uppercase">Choose location on map</span>
              </h1>
              <p className="text-[13.5px] text-[#334155]">Drag or tap simulated map to set pin position</p>
            </div>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#cfe9fb] text-[#0b5cad]">
              <Icon name="mapPin" size={19} />
            </span>
          </div>

          {/* Bản đồ mô phỏng: bấm để đặt ghim */}
          <div
            role="application"
            aria-label="Simulated map. Click to move the pin."
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setPin({ x: Math.round(((e.clientX - r.left) / r.width) * 100), y: Math.round(((e.clientY - r.top) / r.height) * 100) });
            }}
            className="relative h-[340px] cursor-crosshair overflow-hidden rounded-2xl bg-[#eef1f3] shadow-[0px_1px_3px_rgba(15,23,42,0.08)]"
          >
            <svg viewBox="0 0 360 340" className="absolute inset-0 size-full" aria-hidden="true">
              <path d="M0 10 Q70 0 120 40 T200 70 L190 0 L0 0Z" fill="#d6eadb" />
              <path d="M250 190 L360 170 L360 300 L270 310Z" fill="#d6eadb" />
              <path d="M0 280 Q90 240 180 262 T360 250 L360 272 Q270 282 180 290 T0 304Z" fill="#a7d8f5" />
              <path d="M70 0 L80 340 M250 0 L240 340 M0 120 L360 105 M140 120 L120 340" stroke="#c4ccd6" strokeWidth="6" fill="none" />
              <path d="M0 172 Q180 150 360 160" stroke="#f3c6c6" strokeWidth="12" fill="none" />
              <path d="M0 172 Q180 150 360 160" stroke="#5b9bd5" strokeWidth="2" strokeDasharray="8 6" fill="none" />
              <text x="16" y="135" fontSize="9" fill="#334155">Ringway Nature Park</text>
              <text x="180" y="88" fontSize="8.5" fontWeight="700" fill="#334155">MAN TERMINAL 2</text>
              <text x="262" y="150" fontSize="7.5" fontWeight="700" fill="#0b5cad">M56 J6 INTERCHANGE</text>
              <text x="250" y="230" fontSize="9" fill="#334155">Wilmslow Road</text>
            </svg>

            <div className="absolute top-3 right-3 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
              {(["+", "−"] as const).map((z) => (
                <button key={z} type="button" aria-label={z === "+" ? "Zoom in" : "Zoom out"} className="flex size-10 cursor-pointer items-center justify-center rounded-lg bg-white text-[20px] text-[#0b2341] shadow-sm">
                  {z}
                </button>
              ))}
              <button type="button" aria-label="Centre on my location" onClick={() => setPin({ x: 50, y: 42 })} className="flex size-10 cursor-pointer items-center justify-center rounded-lg bg-white text-[#0b2341] shadow-sm">
                <Icon name="crosshair" size={18} />
              </button>
            </div>

            <div className="pointer-events-none absolute" style={{ left: `${pin.x}%`, top: `${pin.y}%`, transform: "translate(-50%, -100%)" }}>
              <div className="mb-1 flex -translate-x-1/4 items-center gap-1.5 rounded-lg bg-[#0b2341] px-2.5 py-1.5 text-[11.5px] whitespace-nowrap text-white shadow-md">
                <span className="size-1.5 rounded-full bg-[#05c1fa]" />
                <span className="font-semibold">Pin Position</span>
                <span className="text-white/80">
                  {lat}° N, {lng}° W
                </span>
              </div>
              <div className="mx-auto flex size-9 items-center justify-center rounded-full bg-[#0b5cad] ring-4 ring-[#05c1fa]/30">
                <span className="size-3.5 rounded-full bg-[#05c1fa]" />
              </div>
            </div>

            <span className="absolute bottom-3 left-3 flex items-center gap-1 rounded-md bg-[#dbeafe] px-2 py-1 text-[11.5px] text-[#0b2341]">
              <Icon name="crosshair" size={13} /> Tap to relocate
            </span>
            <span className="absolute right-3 bottom-3 rounded-md bg-white px-2 py-1 text-[11.5px] text-[#0b2341] shadow-sm">Map Area: 1km²</span>
          </div>

          {/* Vị trí đã chọn */}
          <section className={`${CARD} p-4`}>
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-medium tracking-[0.6px] text-[#475569]">SELECTED LOCATION</p>
              <span className="flex items-center gap-1 rounded-full bg-[#cfe9fb] px-2.5 py-0.5 text-[11.5px] font-medium text-[#0b4a8b]">
                <span className="size-1.5 rounded-full bg-[#0b4a8b]" />
                {mapTarget === "pickup" ? "Pickup / Set Point" : "Destination / Drop Point"}
              </span>
            </div>
            <div className="flex items-start gap-3 pt-2">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#e0edfd] text-[#0b5cad]">
                <Icon name={pinnedLocation.icon} size={18} />
              </span>
              <div>
                <p className="text-[17px] leading-6 font-bold text-[#0b2341]">{pinnedLocation.title}</p>
                <p className="text-[13.5px] leading-5 text-[#334155]">Address: {pinnedLocation.address}</p>
              </div>
            </div>
            <button type="button" onClick={() => openSearch(mapTarget)} className="mt-2 ml-auto flex cursor-pointer items-center gap-1 text-[13.5px] font-semibold text-[#0b5cad] hover:underline">
              <Icon name="pencil" size={14} /> Edit Address or Reposition Pin
            </button>
          </section>

          <button
            type="button"
            onClick={handleConfirmFromMap}
            className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#65b3fc] text-[16px] font-semibold text-white shadow-[0px_4px_10px_rgba(101,179,252,0.35)] hover:bg-[#3f84c4]"
          >
            <Icon name="badgeCheck" size={18} /> Confirm Location
          </button>
          <button type="button" onClick={() => openSearch(mapTarget)} className="mx-auto flex cursor-pointer items-center gap-1 text-[14px] font-medium text-[#334155] hover:underline">
            <Icon name="chevronLeft" size={16} /> Back to Location Search
          </button>
        </main>
      </Screen>
    );
  }

  // =========================================================================
  // Form Journey Details
  // =========================================================================
  const inputBox = (hasError: boolean) =>
    `flex h-12 items-center gap-3 rounded-xl px-3.5 ${hasError ? "border border-[#ef4444] bg-[#fef2f2]" : "bg-white shadow-[0px_1px_3px_rgba(15,23,42,0.06)]"}`;

  return (
    <Screen title="Journey" onBack={() => navigate("/services")} onCancel={cancel}>
      <form noValidate onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 px-5 pt-3 pb-8">
        {hasErrors ? (
          <div role="alert" className="flex gap-2.5 rounded-2xl bg-[#fde2e2] p-4">
            <span className="mt-0.5 shrink-0 text-[#dc2626]">
              <Icon name="alertCircle" size={18} />
            </span>
            <div>
              <p className="text-[15px] leading-5 font-bold text-[#b91c1c]">Please review highlighted details</p>
              <p className="pt-0.5 text-[12.5px] leading-[18px] text-[#b91c1c]">
                We need a valid pickup, destination, and future date to calculate your private fare.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-[14px] font-semibold text-[#0b2341]">
              <span className="flex size-5 items-center justify-center rounded-full bg-[#0b4a8b] text-[11px] font-bold text-white">1</span>
              Trip Specifications
            </p>
            <span className="flex items-center gap-1.5 rounded-full bg-[#dbeafe] px-2.5 py-1 text-[12px] font-medium text-[#0b4a8b]">
              <span className="size-1.5 rounded-full bg-[#05c1fa]" /> Fixed Fare Guaranteed
            </span>
          </div>
        )}

        {/* Dịch vụ đã chọn */}
        <section className="rounded-2xl bg-[#e8f0fc] p-4">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-semibold tracking-[0.8px] text-[#0e5e7e]">{hasErrors ? "SELECTED SERVICE" : "ACTIVE BOOKING MODE"}</p>
            <button
              type="button"
              onClick={() => navigate("/services")}
              data-node-id="6:1538"
              className="flex cursor-pointer items-center gap-1 text-[14px] font-semibold text-[#0b5cad] hover:underline"
            >
              Change Service <Icon name="repeat" size={14} />
            </button>
          </div>
          <div className="flex items-start gap-3 pt-2.5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#0b5cad] shadow-sm">
              <Icon name={selectedService.icon} size={22} />
            </span>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2">
                <span data-testid="journey-service-title" className="text-[17px] leading-6 font-bold text-[#0b2341]">
                  {selectedService.title}
                </span>
                {hasErrors ? (
                  <span className="rounded-full bg-[#cfe9fb] px-2.5 py-1 text-[11.5px] font-semibold text-[#0b2341]">Fixed Rate</span>
                ) : (
                  <span className="rounded-md bg-[#cfe3fb] px-1.5 py-0.5 text-[11px] font-semibold text-[#0b4a8b]">Pre-booked</span>
                )}
              </p>
              <p data-testid="journey-service-description" className="text-[14px] leading-5 text-[#334155]">
                {selectedService.description}
              </p>
            </div>
          </div>
        </section>

        {/* Điểm đón / điểm đến */}
        <div className="relative flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="pickupLocation" className="text-[15px] font-semibold text-[#0b2341]">
                Pickup Location <span className="text-[#dc2626]">*</span>
              </label>
              <button type="button" data-testid="search-pickup" onClick={() => openSearch("pickup")} className="flex cursor-pointer items-center gap-1 text-[13px] font-semibold text-[#0b5cad] hover:underline">
                <Icon name="map" size={14} /> Search / Map
              </button>
            </div>
            <div className={inputBox(Boolean(errors.pickupLocation))}>
              <span className={`size-4 shrink-0 rounded-full border-[3px] ${errors.pickupLocation ? "border-[#dc2626]" : "border-[#0b4a8b]"}`} aria-hidden="true" />
              <input
                id="pickupLocation"
                name="pickupLocation"
                value={formData.pickupLocation}
                onChange={(e) => handleChange("pickupLocation", e.target.value)}
                placeholder="Enter pickup location"
                autoComplete="off"
                aria-invalid={Boolean(errors.pickupLocation)}
                aria-describedby={errors.pickupLocation ? "pickupLocation-error" : undefined}
                className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-[#0f172a] outline-none placeholder:text-[#64748b]"
              />
              {errors.pickupLocation ? (
                <span className="text-[#dc2626]">
                  <Icon name="alertCircle" size={18} />
                </span>
              ) : (
                formData.pickupLocation && (
                  <button type="button" onClick={() => handleChange("pickupLocation", "")} aria-label="Clear pickup location" className="cursor-pointer text-[#64748b]">
                    <Icon name="xCircle" size={18} />
                  </button>
                )
              )}
            </div>
            <FieldError id="pickupLocation-error" message={errors.pickupLocation} />
          </div>

          {/* đường nối + nút đổi chỗ */}
          <span className="pointer-events-none absolute top-[60px] left-[21px] h-[78px] w-px bg-[#94a3b8]/70" aria-hidden="true" />
          <div className="-my-2 flex justify-end">
            <button
              type="button"
              data-testid="swap-locations"
              onClick={handleSwapLocations}
              aria-label="Swap pickup and destination"
              className="flex size-9 cursor-pointer items-center justify-center rounded-full bg-white text-[#0b2341] shadow-[0px_2px_6px_rgba(15,23,42,0.12)] hover:bg-[#f8fafc]"
            >
              <Icon name="repeat" size={16} />
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="destination" className="text-[15px] font-semibold text-[#0b2341]">
                Destination <span className="text-[#dc2626]">*</span>
              </label>
              <button type="button" data-testid="search-destination" onClick={() => openSearch("destination")} className="flex cursor-pointer items-center gap-1 text-[13px] font-semibold text-[#0b5cad] hover:underline">
                <Icon name="mapPin" size={14} /> Search / Map
              </button>
            </div>
            <div className={inputBox(Boolean(errors.destination))}>
              <span className="shrink-0 text-[#dc2626]">
                <Icon name="mapPin" size={18} />
              </span>
              <input
                id="destination"
                name="destination"
                value={formData.destination}
                onChange={(e) => handleChange("destination", e.target.value)}
                placeholder="Enter destination"
                autoComplete="off"
                aria-invalid={Boolean(errors.destination)}
                aria-describedby={errors.destination ? "destination-error" : undefined}
                className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-[#0f172a] outline-none placeholder:text-[#64748b]"
              />
              {errors.destination ? (
                <span className="text-[#dc2626]">
                  <Icon name="alertCircle" size={18} />
                </span>
              ) : (
                formData.destination && (
                  <button type="button" onClick={() => handleChange("destination", "")} aria-label="Clear destination" className="cursor-pointer text-[#64748b]">
                    <Icon name="xCircle" size={18} />
                  </button>
                )
              )}
            </div>
            <FieldError id="destination-error" message={errors.destination} />
          </div>
        </div>

        {/* Ngày / giờ */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor="journeyDate" className="text-[15px] font-semibold text-[#0b2341]">
              Journey Date <span className="text-[#dc2626]">*</span>
            </label>
            <input
              id="journeyDate"
              name="journeyDate"
              type="date"
              min={minDate}
              value={formData.journeyDate}
              onChange={(e) => handleChange("journeyDate", e.target.value)}
              aria-invalid={Boolean(errors.journeyDate)}
              aria-describedby={errors.journeyDate ? "journeyDate-error" : undefined}
              className={`h-12 w-full rounded-xl px-3 text-[14px] text-[#0f172a] outline-none ${
                errors.journeyDate ? "border border-[#ef4444] bg-[#fef2f2]" : "bg-white shadow-[0px_1px_3px_rgba(15,23,42,0.06)] focus:ring-2 focus:ring-[#65b3fc]"
              }`}
            />
            {errors.journeyDate ? (
              <FieldError id="journeyDate-error" message={errors.journeyDate} />
            ) : (
              <p data-testid="date-day-of-week" className="pl-1 text-[11.5px] text-[#475569]">
                {dayOfWeekDisplay || "Day of week"}
              </p>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor="journeyTime" className="text-[15px] font-semibold text-[#0b2341]">
              Journey Time <span className="text-[#dc2626]">*</span>
            </label>
            <input
              id="journeyTime"
              name="journeyTime"
              type="time"
              value={formData.journeyTime}
              onChange={(e) => handleChange("journeyTime", e.target.value)}
              aria-invalid={Boolean(errors.journeyTime)}
              aria-describedby={errors.journeyTime ? "journeyTime-error" : undefined}
              className={`h-12 w-full rounded-xl px-3 text-[14px] text-[#0f172a] outline-none ${
                errors.journeyTime ? "border border-[#ef4444] bg-[#fef2f2]" : "bg-white shadow-[0px_1px_3px_rgba(15,23,42,0.06)] focus:ring-2 focus:ring-[#65b3fc]"
              }`}
            />
            {errors.journeyTime ? <FieldError id="journeyTime-error" message={errors.journeyTime} /> : <p className="pl-1 text-[11.5px] text-[#475569]">UK time (GMT)</p>}
          </div>
        </div>

        {/* Ước tính hoặc mẹo */}
        {formData.pickupLocation && formData.destination && !hasErrors ? (
          <p className="flex items-center justify-between rounded-xl bg-[#e3eefc] px-3.5 py-2.5 text-[12.5px] text-[#334155]">
            <span className="flex items-center gap-1.5">
              <Icon name="mapPin" size={14} /> Est. 10.4 miles • 22 mins
            </span>
            <span className="flex items-center gap-1.5 font-semibold text-[#0b4a8b]">
              <Icon name="planeTakeoff" size={14} /> Flight monitoring included
            </span>
          </p>
        ) : (
          <p className="flex items-center gap-3 rounded-xl bg-[#e8eef9] px-3.5 py-3 text-[12.5px] leading-[18px] text-[#334155]">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#cfe9fb] text-[#0b5cad]">
              <Icon name="info" size={17} />
            </span>
            <span>
              Tip: You can use <span className="font-semibold text-[#0b5cad]">Search / Map</span> to pinpoint terminal drop-offs, train stations, or any postcode.
            </span>
          </p>
        )}

        <button
          type="submit"
          data-testid="continue-to-vehicle"
          data-node-id="6:1613"
          className={`mt-1 flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl text-[16px] font-semibold transition-colors ${
            hasErrors ? "bg-[#d6e6fb] text-[#64748b]" : "bg-[#65b3fc] text-white shadow-[0px_4px_10px_rgba(101,179,252,0.35)] hover:bg-[#3f84c4]"
          }`}
        >
          {hasErrors && <Icon name="arrowRight" size={18} />}
          Continue to Vehicle Selection
          {!hasErrors && <Icon name="arrowRight" size={18} />}
        </button>
        <button
          type="button"
          onClick={() => navigate("/services")}
          data-node-id="6:1619"
          className="mx-auto flex cursor-pointer items-center gap-1 text-[14px] font-semibold text-[#0b5cad] hover:underline"
        >
          <Icon name="chevronLeft" size={16} /> Back to Service Selection
        </button>
        <p className="flex items-center justify-center gap-3 pt-3 text-[11.5px] text-[#475569]">
          <span className="flex items-center gap-1">
            <Icon name="shield" size={13} /> Licensed Private Hire
          </span>
          <span aria-hidden="true">•</span>
          <span className="flex items-center gap-1">
            <Icon name="car" size={13} /> Free cancellation up to 24h
          </span>
        </p>
      </form>
    </Screen>
  );
}
