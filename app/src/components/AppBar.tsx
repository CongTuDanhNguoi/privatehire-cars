// Thanh trên cùng của các màn sau đăng nhập (thiết kế Sprint 1: Home / Select a Service / My Profile):
// [‹ quay lại] logo  ……  tiêu đề + nút avatar tròn navy (mở My Profile).
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import Icon from "./Icon";

interface AppBarProps {
  title: string;
  onBack?: () => void;
  backLabel?: string;
}

export default function AppBar({ title, onBack, backLabel = "Back" }: AppBarProps) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-20 flex h-[60px] items-center gap-2 border-b border-[#eef2f7] bg-white/95 px-4 backdrop-blur-sm">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label={backLabel}
          className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#0b2341] hover:bg-[#f1f5f9]"
        >
          <Icon name="chevronLeft" size={22} />
        </button>
      )}
      <img src={logo} alt="PrivateHire Cars" className="h-11 w-auto object-contain" />
      <div className="ml-auto flex min-w-0 items-center gap-2.5">
        <p className="truncate font-['Inter',sans-serif] text-[18px] font-bold text-[#0b2341]">{title}</p>
        <button
          type="button"
          onClick={() => navigate("/profile")}
          aria-label="My Profile"
          className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#0b5cad] text-white hover:bg-[#0b2341]"
        >
          <Icon name="user" size={18} />
        </button>
      </div>
    </header>
  );
}
