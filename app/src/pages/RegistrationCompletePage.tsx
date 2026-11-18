// =============================================================
// RegistrationCompletePage — dựng theo thiết kế Sprint 1 "3. Registration Success":
// "← Registration", logo, vòng tick cyan, tiêu đề, thẻ thông tin email + ghi chú "không tự đăng nhập",
// nút Go to Login (primary) và "Back to Welcome".
// Khác chữ thiết kế: email đã được xác nhận thật bằng mã OTP (P0-18), nên không ghi "simulated".
// SCRUM-12: đăng ký không tự đăng nhập — "Go to Login" mang email sang màn Login.
// =============================================================
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import Icon from "../components/Icon";
import { AuthFrame, BrandLogo, PrimaryButton } from "../components/auth/AuthUi";

export default function RegistrationCompletePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = (location.state as { email?: string } | null)?.email;

  // Chỉ vào được ngay sau khi đăng ký (cần email trong state)
  if (!email) {
    return <Navigate to="/register" replace />;
  }

  return (
    <AuthFrame testId="registration-complete-page">
      <header className="flex h-14 items-center px-5">
        <button
          type="button"
          onClick={() => navigate("/register", { replace: true })}
          className="flex cursor-pointer items-center gap-2 text-[15px] font-semibold text-[#0b2341]"
        >
          <Icon name="arrowLeft" size={20} /> Registration
        </button>
      </header>

      <main className="flex flex-1 flex-col px-6 pb-8">
        <div className="flex flex-col items-center text-center">
          <BrandLogo className="h-9 w-auto" />
          <div className="mt-6 flex size-16 items-center justify-center rounded-full border-[3px] border-[#05c1fa] text-[#05c1fa]">
            <Icon name="check" size={32} strokeWidth={2.75} />
          </div>
          <h1 className="pt-5 text-[21px] leading-8 font-bold tracking-[-0.2px] text-[#0b2341]">Account Created Successfully</h1>
          <p className="px-2 pt-2 text-[15px] leading-6 text-[#334155]">
            Your account has been created and your email address has been verified.
          </p>

          <div className="mt-6 w-full rounded-xl border border-[#94a3b8]/70 bg-[#f0f7ff] p-4 text-left">
            <div className="flex items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[#dbeafe] text-[#0b2341]">
                <Icon name="mail" size={16} />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] leading-5 font-semibold text-[#0b2341]">Email Verified</p>
                <p data-testid="registered-email" className="truncate text-[15px] leading-5 text-[#0f172a]">
                  {email}
                </p>
              </div>
            </div>
            <p className="mt-3 border-t border-[#cbd5e1] pt-3 text-[12.5px] leading-[18px] text-[#334155]">
              <span className="font-semibold text-[#0b2341]">Note:</span> Registration does not automatically log you in. Please log in
              with your credentials to continue.
            </p>
          </div>
        </div>

        <div className="mt-auto flex flex-col items-center gap-4 pt-10">
          <PrimaryButton type="button" onClick={() => navigate("/login", { replace: true, state: { email } })} data-testid="go-to-login">
            Go to Login <Icon name="arrowRight" size={18} />
          </PrimaryButton>
          <button
            type="button"
            onClick={() => navigate("/", { replace: true })}
            data-testid="back-to-welcome"
            className="cursor-pointer text-[13px] font-medium text-[#334155] hover:underline"
          >
            Back to Welcome
          </button>
        </div>
      </main>
    </AuthFrame>
  );
}
