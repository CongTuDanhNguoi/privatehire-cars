// Màn Welcome — dựng theo thiết kế Sprint 1 "1. Welcome - PrivateHire Cars":
// tên thương hiệu góc trái, logo lớn ở giữa, câu giới thiệu, 2 nút Sign Up (primary) / Login (secondary).
// Giữ data-node-id 6:470 / 6:476 của bản Figma cũ vì self-test và test của nhóm bấm theo chúng.
import { useNavigate } from "react-router-dom";
import { AuthFrame, BrandLogo, PrimaryButton, SecondaryButton } from "../components/auth/AuthUi";

export default function WelcomePage() {
  const navigate = useNavigate();
  return (
    <AuthFrame>
      <header className="px-6 pt-6">
        <p className="text-[16px] leading-6 font-bold text-[#0b2341]">PrivateHire Cars</p>
      </header>

      <main className="flex flex-1 flex-col px-6">
        <div className="flex flex-col items-center pt-20">
          <BrandLogo className="h-auto w-[320px]" />
          <p className="pt-3 text-center text-[14px] leading-5 text-[#475569]">Reliable ride-hailing &amp; vehicle hire</p>
        </div>

        <div className="mt-auto flex flex-col gap-3.5 pb-40">
          <PrimaryButton type="button" onClick={() => navigate("/register")} data-node-id="6:470">
            Sign Up
          </PrimaryButton>
          <SecondaryButton type="button" onClick={() => navigate("/login")} data-node-id="6:476">
            Login
          </SecondaryButton>
        </div>
      </main>
    </AuthFrame>
  );
}
