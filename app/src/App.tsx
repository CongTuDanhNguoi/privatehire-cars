// =============================================================
// Điều hướng chính
//   /                    Welcome            (chỉ khi CHƯA đăng nhập)
//   /login               Login              (chỉ khi CHƯA đăng nhập)
//   /register            Registration       (chỉ khi CHƯA đăng nhập)
//   /verify-email        Nhập mã OTP xác nhận email (chỉ khi CHƯA đăng nhập)
//   /register/complete   Registration Complete
//   /forgot-password     Quên mật khẩu → /verify (mã 4 số) → /new (mật khẩu mới) → /done (SCRUM-65, chỉ khi CHƯA đăng nhập)
//   /home                Home               (BẮT BUỘC đăng nhập)
//   /services            Service Selection  (BẮT BUỘC đăng nhập)
//   /journey             Journey Details    (BẮT BUỘC đăng nhập)
//   /profile             My Profile         (BẮT BUỘC đăng nhập)
//   /support             Contact Support    (BẮT BUỘC đăng nhập; không có link ở màn cũ, gõ đường dẫn)
//   /checkout/:ref/price Price Review       (BẮT BUỘC đăng nhập; SCRUM-72)
//   /checkout/:ref/edit  Edit Journey 05A   (BẮT BUỘC đăng nhập; SCRUM-72)
//   /checkout/:ref/notify  Notification 01-03 (BẮT BUỘC đăng nhập; SCRUM-88)
//   /checkout/:ref/success Payment Successful (BẮT BUỘC đăng nhập; SCRUM-90)
//   /gallery             Xem các màn Figma tĩnh (không thuộc luồng chính)
// =============================================================
import { Navigate, Route, Routes } from "react-router-dom";
import { GuestOnly, RequireAuth } from "./components/RouteGuards";
import WelcomePage from "./pages/WelcomePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import RegistrationCompletePage from "./pages/RegistrationCompletePage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import { ChangePasswordPage, ForgotPasswordPage, PasswordChangedPage, VerifyResetCodePage } from "./pages/ForgotPasswordPages";
import PriceReviewPage from "./pages/checkout/PriceReviewPage";
import EditJourneyPage from "./pages/checkout/EditJourneyPage";
import NotificationPage from "./pages/checkout/NotificationPage";
import PaymentSuccessPage from "./pages/checkout/PaymentSuccessPage";
import HomePage from "./pages/HomePage";
import ServiceSelectionPage from "./pages/ServiceSelectionPage";
import JourneyDetailsPage from "./pages/JourneyDetailsPage";
import VehicleSizePage from "./pages/VehicleSizePage";
import AvailabilityPage from "./pages/AvailabilityPage";
import ProfilePage from "./pages/ProfilePage";
import SupportPage from "./pages/SupportPage";
import { GalleryIndex, GalleryScreen } from "./pages/GalleryPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<GuestOnly><WelcomePage /></GuestOnly>} />
      <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
      <Route path="/verify-email" element={<GuestOnly><VerifyEmailPage /></GuestOnly>} />
      <Route path="/register/complete" element={<RegistrationCompletePage />} />
      <Route path="/forgot-password" element={<GuestOnly><ForgotPasswordPage /></GuestOnly>} />
      <Route path="/forgot-password/verify" element={<GuestOnly><VerifyResetCodePage /></GuestOnly>} />
      <Route path="/forgot-password/new" element={<GuestOnly><ChangePasswordPage /></GuestOnly>} />
      <Route path="/forgot-password/done" element={<GuestOnly><PasswordChangedPage /></GuestOnly>} />

      <Route path="/home" element={<RequireAuth><HomePage /></RequireAuth>} />
      <Route path="/services" element={<RequireAuth><ServiceSelectionPage /></RequireAuth>} />
      <Route path="/journey" element={<RequireAuth><JourneyDetailsPage /></RequireAuth>} />
      <Route path="/vehicle" element={<RequireAuth><VehicleSizePage /></RequireAuth>} />
      <Route path="/availability" element={<RequireAuth><AvailabilityPage /></RequireAuth>} />
      <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
      <Route path="/support" element={<RequireAuth><SupportPage /></RequireAuth>} />
      <Route path="/checkout/:ref/price" element={<RequireAuth><PriceReviewPage /></RequireAuth>} />
      <Route path="/checkout/:ref/edit" element={<RequireAuth><EditJourneyPage /></RequireAuth>} />
      <Route path="/checkout/:ref/notify" element={<RequireAuth><NotificationPage /></RequireAuth>} />
      <Route path="/checkout/:ref/success" element={<RequireAuth><PaymentSuccessPage /></RequireAuth>} />

      <Route path="/gallery" element={<GalleryIndex />} />
      <Route path="/gallery/:slug" element={<GalleryScreen />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
