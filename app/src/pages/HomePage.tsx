// =============================================================
// HomePage — dựng theo thiết kế Sprint 1 "1. Home - PrivateHire Cars":
// trạng thái "Available now" + London HQ, lời chào theo tên, thẻ chính (ảnh xe, Book a Ride),
// chuyến gần đây, lưới 4 dịch vụ, thẻ "Guaranteed Punctuality" + đánh giá, thanh điều hướng dưới.
// Chuyến gần đây / đánh giá là nội dung mẫu của thiết kế (chưa có dữ liệu thật).
// Giữ data-node-id 6:1101 (Book a Ride) và 6:1115 (xem tất cả dịch vụ) cho các bài test.
// =============================================================
import { useNavigate } from "react-router-dom";
import hero from "../assets/home-hero.png";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import Icon, { type IconName } from "../components/Icon";
import MobileFrame from "../components/MobileFrame";
import { getCurrentUser } from "../services/auth";

const FONT = "font-['Inter',sans-serif]";

const HOME_SERVICES: { title: string; text: string; icon: IconName; tone: string }[] = [
  { title: "Local Travel", text: "Quick urban commutes", icon: "car", tone: "bg-[#e0edfd] text-[#0b2341]" },
  { title: "Airport Transfer", text: "Direct pickup & drop", icon: "planeTakeoff", tone: "bg-[#cfe3fb] text-[#0b2341]" },
  { title: "Long-Distance", text: "Intercity travel", icon: "route", tone: "bg-[#e0edfd] text-[#0b2341]" },
  { title: "Daily Hire", text: "Dedicated driver by day", icon: "calendar", tone: "bg-[#cfe3fb] text-[#0b2341]" },
];

export default function HomePage() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const firstName = user?.fullName.trim().split(/\s+/)[0] ?? "there";
  const goServices = () => navigate("/services");

  return (
    <MobileFrame>
      <div className={`${FONT} relative min-h-[844px] bg-[#f4f7fb] pb-24 shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)]`}>
        <AppBar title="Home" />

        <main className="flex flex-col gap-4 px-5 pt-3">
          {/* Trạng thái + lời chào */}
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-[12.5px] text-[#475569]">
              <span className="size-2 rounded-full bg-[#05c1fa]" aria-hidden="true" /> Available now in your city
            </p>
            <span className="rounded-md bg-[#dbeafe] px-2 py-0.5 text-[12px] font-semibold text-[#0b4a8b]">London HQ</span>
          </div>
          <div className="-mt-2">
            <h1 className="text-[22px] leading-8 font-bold text-[#0b2341]">Good day, {firstName}</h1>
            <p className="text-[14px] leading-5 text-[#475569]">Where would you like to travel today?</p>
          </div>

          {/* Thẻ chính */}
          <section className="rounded-3xl bg-[#e8f1fd] p-5 shadow-[0px_8px_24px_rgba(11,35,65,0.06)]">
            <div className="relative overflow-hidden rounded-2xl">
              <img src={hero} alt="Executive saloon waiting outside a hotel at night" className="h-[176px] w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/60 to-transparent px-3 pt-6 pb-2.5">
                <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-white">
                  <span className="text-[#05c1fa]">
                    <Icon name="badgeCheck" size={16} />
                  </span>
                  Licensed Private Chauffeurs
                </span>
                <span className="rounded-md bg-white/25 px-2 py-0.5 text-[11.5px] font-medium text-white">Fixed Rates</span>
              </div>
            </div>
            <h2 className="pt-4 text-[18px] leading-6 font-bold text-[#0b2341]">Reliable ride-hailing &amp; premium vehicle hire</h2>
            <p className="pt-2 text-[14px] leading-[22px] text-[#475569]">
              Punctual, vetted drivers for business, airport transfers, and bespoke daily journeys.
            </p>
            <button
              type="button"
              onClick={goServices}
              data-node-id="6:1101"
              className="mt-4 flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#65b3fc] text-[16px] font-semibold text-white shadow-[0px_4px_10px_rgba(101,179,252,0.35)] transition-colors hover:bg-[#3f84c4]"
            >
              Book a Ride <Icon name="arrowRight" size={18} />
            </button>
          </section>

          {/* Chuyến gần đây (nội dung mẫu) */}
          <section className="flex items-center gap-3 rounded-2xl bg-[#e0edfd] px-3.5 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#0b2341]">
              <Icon name="history" size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] leading-5 font-semibold text-[#0b2341]">Heathrow Airport (LHR) Terminal 5</p>
              <p className="truncate text-[12px] leading-4 text-[#475569]">Booked 3 days ago • Chauffeur Mercedes S-Class</p>
            </div>
            <button type="button" onClick={goServices} aria-label="Book this trip again" className="cursor-pointer text-[#0b5cad]">
              <Icon name="repeat" size={18} />
            </button>
          </section>

          {/* Dịch vụ */}
          <div className="flex items-center justify-between pt-1">
            <h2 className="text-[13px] font-bold tracking-[1px] text-[#0b2341]">SERVICES</h2>
            <button type="button" onClick={goServices} data-node-id="6:1115" className="cursor-pointer text-[12.5px] font-medium text-[#0b5cad] hover:underline">
              4 options available
            </button>
          </div>
          <div className="-mt-1 grid grid-cols-2 gap-3">
            {HOME_SERVICES.map((s) => (
              <button
                key={s.title}
                type="button"
                onClick={goServices}
                className="relative flex min-h-[128px] cursor-pointer flex-col items-start rounded-2xl bg-white p-4 text-left shadow-[0px_1px_3px_rgba(15,23,42,0.06)] transition-shadow hover:shadow-md"
              >
                <span className={`flex size-11 items-center justify-center rounded-xl ${s.tone}`}>
                  <Icon name={s.icon} size={20} />
                </span>
                <span className="absolute top-3.5 right-3.5 text-[#94a3b8]">
                  <Icon name="arrowUpRight" size={16} />
                </span>
                <span className="mt-auto pt-4 text-[14px] leading-5 font-semibold text-[#0b2341]">{s.title}</span>
                <span className="text-[12px] leading-4 text-[#475569]">{s.text}</span>
              </button>
            ))}
          </div>

          {/* Cam kết + đánh giá */}
          <section className="rounded-2xl bg-white p-4 shadow-[0px_1px_3px_rgba(15,23,42,0.06)]">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#dbeafe] text-[#0b5cad]">
                <Icon name="shield" size={18} />
              </span>
              <div>
                <p className="text-[14px] leading-5 font-semibold text-[#0b2341]">Guaranteed Punctuality</p>
                <p className="text-[12.5px] leading-[18px] text-[#475569]">Live flight &amp; traffic tracking included on all rides</p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-3">
              <p className="flex items-center gap-1 text-[14px] text-[#334155]">
                <span className="text-[#0b5cad]">
                  <Icon name="star" size={16} />
                </span>
                <span className="font-bold text-[#0b2341]">4.94</span> (1,280+ reviews)
              </p>
              <button type="button" onClick={goServices} className="cursor-pointer text-[13.5px] font-semibold text-[#0b5cad] hover:underline">
                View fleet info
              </button>
            </div>
          </section>
        </main>

        <BottomNav active="home" />
      </div>
    </MobileFrame>
  );
}
