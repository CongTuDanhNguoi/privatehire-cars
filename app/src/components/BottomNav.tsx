// Thanh điều hướng dưới (Home / Activity / Alerts / Profile) — kiểu thiết kế Sprint 1:
// icon 22px, nhãn 12px, mục đang mở màu xanh #0b5cad, nền trắng mờ.
// Giữ data-testid tab-* và data-node-id 6:1030 / 6:1051 (self-test bấm theo chúng).
import { useNavigate } from "react-router-dom";
import Icon, { type IconName } from "./Icon";

type Tab = "home" | "activity" | "alerts" | "profile";

const TABS: { id: Tab; label: string; icon: IconName; to?: string; nodeId?: string }[] = [
  { id: "home", label: "Home", icon: "house", to: "/home", nodeId: "6:1030" },
  { id: "activity", label: "Activity", icon: "clock" },
  { id: "alerts", label: "Alerts", icon: "bell" },
  { id: "profile", label: "Profile", icon: "userCircle", to: "/profile", nodeId: "6:1051" },
];

export default function BottomNav({ active }: { active: Tab }) {
  const navigate = useNavigate();
  return (
    <nav className="absolute right-0 bottom-0 left-0 z-10 border-t border-[#e2e8f0] bg-white/95 px-4 pt-2.5 pb-3 backdrop-blur-md">
      <ul className="flex items-center justify-around">
        {TABS.map((tab) => {
          const isActive = tab.id === active;
          return (
            <li key={tab.id}>
              <button
                type="button"
                data-testid={`tab-${tab.id}`}
                data-node-id={tab.nodeId}
                aria-current={isActive ? "page" : undefined}
                onClick={() => tab.to && navigate(tab.to)}
                className={`flex w-16 flex-col items-center gap-1 font-['Inter',sans-serif] text-[12px] leading-4 ${
                  isActive ? "font-medium text-[#0b5cad]" : "text-[#334155]"
                } ${tab.to ? "cursor-pointer" : "cursor-default"}`}
              >
                <Icon name={tab.icon} size={22} strokeWidth={isActive ? 2.1 : 1.8} />
                {tab.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
