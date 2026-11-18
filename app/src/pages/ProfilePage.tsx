// =============================================================
// ProfilePage — dựng theo thiết kế Sprint 1 "3. My Profile":
// "‹ Back · Edit", tiêu đề, thẻ người dùng (avatar chữ cái, hạng thành viên), lưới SHORTCUTS,
// danh sách ACCOUNT INFORMATION, nút Log Out đỏ, thanh điều hướng dưới.
// Tên / email / số điện thoại / 4 số cuối thẻ lấy từ phiên đăng nhập (API /me).
// Các mục chưa có màn riêng (Saved Locations, Ride History…) là nội dung mẫu của thiết kế.
// Log Out → xoá dịch vụ đang chọn → về màn Login. Giữ data-testid profile-name / profile-email / logout.
// =============================================================
import { useNavigate } from "react-router-dom";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import Icon, { type IconName } from "../components/Icon";
import MobileFrame from "../components/MobileFrame";
import { useBooking } from "../context/BookingContext";
import { getCurrentUser, logout } from "../services/auth";

const FONT = "font-['Inter',sans-serif]";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

export default function ProfilePage() {
  const navigate = useNavigate();
  const { clearBooking } = useBooking();
  const user = getCurrentUser();
  if (!user) return null; // RequireAuth đã chặn trước

  const shortcuts: { title: string; text: string; icon: IconName }[] = [
    { title: "Saved Locations", text: "Home, Heathrow T5", icon: "bookmark" },
    { title: "Payment Methods", text: user.cardLast4 ? `Card ending in ${user.cardLast4}` : "No card saved", icon: "creditCard" },
    { title: "Ride History", text: "14 completed trips", icon: "receipt" },
    { title: "Chauffeur Prefs", text: "Quiet ride, 21°C", icon: "sliders" },
  ];

  const account: { label: string; value: string; testId?: string }[] = [
    { label: "Email", value: user.email },
    { label: "Phone", value: user.phone ?? "—" },
    { label: "Password & Security", value: "Password protected" },
    { label: "Notification Settings", value: "SMS & Email enabled" },
  ];

  function onLogout() {
    logout();
    clearBooking();
    navigate("/login", { replace: true });
  }

  return (
    <MobileFrame>
      <div className={`${FONT} relative min-h-[844px] bg-[#f4f6fd] pb-24 shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)]`}>
        <AppBar title="Profile" />

        <main className="px-5 pt-3">
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => navigate("/home")} className="flex cursor-pointer items-center gap-1 text-[15px] font-medium text-[#0b2341]">
              <Icon name="chevronLeft" size={20} /> Back
            </button>
            <button type="button" className="cursor-default text-[15px] font-semibold text-[#0b5cad]">
              Edit
            </button>
          </div>
          <h1 className="pt-2 text-[28px] leading-9 font-bold text-[#0b2341]">My Profile</h1>

          {/* Thẻ người dùng */}
          <section className="mt-4 flex items-center gap-4 rounded-2xl bg-white p-4 shadow-[0px_1px_3px_rgba(15,23,42,0.06)]">
            <div className="relative shrink-0">
              <div className="flex size-[60px] items-center justify-center rounded-full bg-[#cfe3fb] text-[20px] font-bold text-[#0b2341]">
                {initials(user.fullName)}
              </div>
              <span className="absolute -right-0.5 -bottom-0.5 flex size-5 items-center justify-center rounded-full bg-[#05c1fa] text-white ring-2 ring-white">
                <Icon name="check" size={11} strokeWidth={3} />
              </span>
            </div>
            <div className="min-w-0">
              <p data-testid="profile-name" className="truncate text-[17px] leading-6 font-semibold text-[#0b2341]">
                {user.fullName}
              </p>
              <p className="flex items-center gap-1.5 pt-0.5 text-[12.5px] text-[#475569]">
                <span className="rounded-md bg-[#dbeafe] px-2 py-0.5 text-[12px] font-medium text-[#0b4a8b]">Executive Member</span>
                • 4.98 ★
              </p>
            </div>
          </section>

          {/* Shortcuts */}
          <h2 className="pt-6 pb-2.5 text-[13px] font-bold tracking-[1px] text-[#334155]">SHORTCUTS</h2>
          <div className="grid grid-cols-2 gap-3">
            {shortcuts.map((s) => (
              <div key={s.title} className="flex flex-col items-start rounded-2xl bg-white p-4 shadow-[0px_1px_3px_rgba(15,23,42,0.06)]">
                <span className="flex size-10 items-center justify-center rounded-lg bg-[#e0edfd] text-[#0b5cad]">
                  <Icon name={s.icon} size={19} />
                </span>
                <p className="pt-3 text-[14px] leading-5 font-semibold text-[#0b2341]">{s.title}</p>
                <p className="text-[12px] leading-4 text-[#475569]">{s.text}</p>
              </div>
            ))}
          </div>

          {/* Account information */}
          <h2 className="pt-6 pb-2.5 text-[13px] font-bold tracking-[1px] text-[#334155]">ACCOUNT INFORMATION</h2>
          <ul className="overflow-hidden rounded-2xl bg-white shadow-[0px_1px_3px_rgba(15,23,42,0.06)]">
            {account.map((a, i) => (
              <li key={a.label} className={`flex items-center justify-between gap-3 px-4 py-3 ${i > 0 ? "border-t border-[#eef2f7]" : ""}`}>
                <div className="min-w-0">
                  <p className="text-[12px] leading-4 text-[#475569]">{a.label}</p>
                  <p
                    data-testid={a.label === "Email" ? "profile-email" : undefined}
                    className="truncate pt-0.5 text-[15px] leading-5 text-[#0b2341]"
                  >
                    {a.value}
                  </p>
                </div>
                <span className="shrink-0 text-[#94a3b8]">
                  <Icon name="chevronRight" size={18} />
                </span>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={onLogout}
            data-testid="logout"
            className="mx-auto mt-7 flex cursor-pointer items-center gap-1.5 text-[15px] font-semibold text-[#dc2626] hover:underline"
          >
            <Icon name="logOut" size={18} /> Log Out
          </button>
        </main>

        <BottomNav active="profile" />
      </div>
    </MobileFrame>
  );
}
