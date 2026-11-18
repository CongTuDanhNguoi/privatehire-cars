// Layout for signed-in pages: navy sidebar (logo, menu, staff + Log out), email-mode banner,
// centred content (max 1280px, 32px padding).
import { createContext, useContext, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import type { EmailSettings } from "../../types";
import logo from "../../assets/logo.png";
import { enquiriesApi } from "../../api/enquiries";
import { useAsync } from "../../lib/useAsync";
import { Avatar } from "../ui/Avatar";
import { Icon } from "../ui/Icon";
import { Spinner } from "../ui/Spinner";
import { cn } from "../../lib/cn";
import { EmailModeBanner, useEmailSettings } from "./EmailModeBanner";

const EmailSettingsContext = createContext<EmailSettings | null>(null);
export const useEmailSettingsContext = () => useContext(EmailSettingsContext);

// Focus ring that stays visible on the navy background.
const ON_NAVY_FOCUS = "focus-visible:outline-primary";

function Sidebar() {
  const { staff, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [signingOut, setSigningOut] = useState(false);

  // Number of enquiries still waiting for a reply (refreshed on every page change). Hidden while loading / on error.
  const { data } = useAsync(
    (signal) => enquiriesApi.list({ type: "ALL", status: "AWAITING", q: "", sort: "newest", page: 1 }, signal),
    [location.pathname, location.search],
  );
  const awaiting = data?.counts.awaiting;

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
    <aside className="sticky top-0 flex h-dvh w-[224px] shrink-0 flex-col bg-ink text-surface">
      <NavLink to="/enquiries" className={cn("flex items-center gap-3 px-5 pt-6 pb-8", ON_NAVY_FOCUS)}>
        <img src={logo} alt="" width={56} height={29} className="h-8 w-auto rounded bg-surface p-0.5" />
        <span className="flex flex-col">
          <span className="text-label font-bold whitespace-nowrap">PrivateHire Cars</span>
          <span className="text-helper text-surface/70">Staff Portal</span>
        </span>
      </NavLink>

      <nav aria-label="Main" className="flex-1 px-3">
        <ul className="flex flex-col gap-1">
          <li>
            <NavLink
              to="/enquiries"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg border-l-[3px] border-transparent px-3 py-2.5 text-label font-semibold transition-colors duration-150 hover:bg-surface/10",
                  isActive && "border-primary bg-surface/10",
                  ON_NAVY_FOCUS,
                )
              }
            >
              <Icon name="inbox" size={18} />
              <span className="flex-1">Enquiry Management</span>
              {awaiting !== undefined && awaiting > 0 && (
                <span className="rounded-full bg-primary px-2 text-helper font-bold text-ink tabular-nums">
                  {awaiting}
                  <span className="visually-hidden"> awaiting</span>
                </span>
              )}
            </NavLink>
          </li>
        </ul>
      </nav>

      <div className="flex flex-col gap-4 border-t border-surface/15 p-5">
        {staff && (
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={staff.fullName} size="md" />
            <div className="min-w-0">
              <p className="truncate text-label font-semibold">{staff.fullName}</p>
              <p className="truncate text-helper text-surface/70">{staff.email}</p>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className={cn(
            "flex h-11 items-center justify-center gap-2 rounded-lg border border-surface/40 text-label font-semibold transition-colors duration-150 hover:bg-surface/10 disabled:cursor-progress",
            ON_NAVY_FOCUS,
          )}
        >
          {signingOut ? (
            <>
              <Spinner small label="Signing out…" />
              Signing out…
            </>
          ) : (
            <>
              <Icon name="logOut" size={18} />
              Log out
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

export function AppShell() {
  const emailSettings = useEmailSettings();
  return (
    <EmailSettingsContext.Provider value={emailSettings}>
      <div className="flex min-h-dvh">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          {emailSettings && (emailSettings.provider === "MOCK" || emailSettings.testMode) && (
            <div className="mx-auto w-full max-w-[1280px] px-8 pt-6">
              <EmailModeBanner settings={emailSettings} />
            </div>
          )}
          <main id="main" className="mx-auto w-full max-w-[1280px] flex-1 p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </EmailSettingsContext.Provider>
  );
}
