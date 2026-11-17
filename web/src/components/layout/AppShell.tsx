// Layout for signed-in pages: TopBar, email-mode banner, centred content (max 1280px, 32px padding).
import { createContext, useContext, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import type { EmailSettings } from "../../types";
import logo from "../../assets/logo.png";
import { Button } from "../ui/Button";
import { cn } from "../../lib/cn";
import { EmailModeBanner, useEmailSettings } from "./EmailModeBanner";

const EmailSettingsContext = createContext<EmailSettings | null>(null);
export const useEmailSettingsContext = () => useContext(EmailSettingsContext);

function TopBar() {
  const { staff, signOut } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      // replace: the browser Back button cannot return to a signed-in page.
      navigate("/login", { replace: true });
    }
  }

  return (
    <header className="h-16 border-b border-muted bg-surface">
      <div className="mx-auto flex h-full max-w-[1280px] items-center gap-8 px-8">
        <NavLink to="/enquiries" className="flex items-center gap-3 rounded-md">
          <img src={logo} alt="" width={56} height={29} className="h-8 w-auto rounded" />
          <span className="text-body font-bold text-ink">
            PrivateHire Cars <span className="font-semibold">· Staff Portal</span>
          </span>
        </NavLink>
        <nav aria-label="Main">
          <ul className="flex gap-1">
            <li>
              <NavLink
                to="/enquiries"
                className={({ isActive }) =>
                  cn(
                    "block rounded-lg px-3 py-2 text-label font-semibold text-ink hover:bg-muted",
                    isActive && "bg-success-fill",
                  )
                }
              >
                Enquiries
              </NavLink>
            </li>
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-4">
          {staff && (
            <div className="text-right">
              <p className="text-label font-semibold text-ink">{staff.fullName}</p>
              <p className="text-helper text-ink">{staff.email}</p>
            </div>
          )}
          <Button variant="secondary" onClick={handleSignOut} loading={signingOut} loadingText="Signing out…">
            Log out
          </Button>
        </div>
      </div>
    </header>
  );
}

export function AppShell() {
  const emailSettings = useEmailSettings();
  return (
    <EmailSettingsContext.Provider value={emailSettings}>
      <div className="flex min-h-dvh flex-col bg-surface">
        <TopBar />
        {emailSettings && (emailSettings.provider === "MOCK" || emailSettings.testMode) && (
          <div className="mx-auto w-full max-w-[1280px] px-8 pt-4">
            <EmailModeBanner settings={emailSettings} />
          </div>
        )}
        <main id="main" className="mx-auto w-full max-w-[1280px] flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </EmailSettingsContext.Provider>
  );
}
