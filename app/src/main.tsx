import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { BookingProvider } from "./context/BookingContext";
import { initSession } from "./services/auth";
import "./index.css";

// Hỏi server ai đang đăng nhập (cookie) trước khi vẽ app, để RequireAuth / GuestOnly chạy đúng.
// Tài khoản demo alex.morgan@example.com / Password123 có sẵn trong database (backend/scripts/seed.ts).
void initSession().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <BrowserRouter>
        <BookingProvider>
          <App />
        </BookingProvider>
      </BrowserRouter>
    </StrictMode>
  );
});
