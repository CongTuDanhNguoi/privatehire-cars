// Layout for signed-in pages.
// Desktop (md+): navy sidebar (white brand strip with the logo, menu, staff + Log out).
// Mobile (<md): white top bar (logo, menu with awaiting count, Log out icon).
// The logo PNG has a white background, so it always sits on white and blends in (mix-blend-multiply) — no frame.
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

interface ShellProps {
  awaiting: number | undefined;
  signingOut: boolean;
  onSignOut: () => void;
}

function AwaitingBadge({ awaiting }: { awaiting: number | undefined }) {
  if (awaiting === undefined || awaiting <= 0) return null;
  return (
    <span className="rounded-full bg-primary px-2 text-helper font-bold text-ink tabular-nums">
      {awaiting}
      <span className="visually-hidden"> awaiting</span>
    </span>
  );
}

function Sidebar({ awaiting, signingOut, onSignOut }: ShellProps) {
  const { staff } = useAuth();
  return (
    <aside className="sticky top-0 hidden h-dvh w-[224px] shrink-0 flex-col bg-ink text-surface md:flex">
      <NavLink
        to="/enquiries"
        aria-label="PrivateHire Cars Staff Portal — Enquiries"
        className="flex flex-col items-start gap-1 bg-surface px-5 pt-5 pb-4 text-ink"
      >
        <img src={logo} alt="" width={140} height={72} className="h-12 w-auto mix-blend-multiply" />
        <span className="text-helper font-semibold text-ink/70 uppercase">Staff Portal</span>
      </NavLink>

      <nav aria-label="Main" className="flex-1 px-3 pt-6">
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
              <AwaitingBadge awaiting={awaiting} />
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
          onClick={onSignOut}
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

// Mobile top bar. Comes after the sidebar in the DOM, so on desktop the sidebar's "Log out" is the first match.
function MobileHeader({ awaiting, signingOut, onSignOut }: ShellProps) {
  const { staff } = useAuth();
  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-muted bg-surface px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] md:hidden">
      <NavLink to="/enquiries" aria-label="PrivateHire Cars Staff Portal — Enquiries" className="shrink-0">
        <img src={logo} alt="" width={140} height={72} className="h-9 w-auto mix-blend-multiply" />
      </NavLink>
      <nav aria-label="Main mobile" className="min-w-0 flex-1">
        <NavLink
          to="/enquiries"
          className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-label font-semibold text-ink hover:bg-muted/60"
        >
          <Icon name="inbox" size={18} />
          <span className="truncate">Enquiries</span>
          <AwaitingBadge awaiting={awaiting} />
        </NavLink>
      </nav>
      {staff && <Avatar name={staff.fullName} />}
      <button
        type="button"
        onClick={onSignOut}
        disabled={signingOut}
        aria-label={signingOut ? "Signing out…" : "Log out"}
        className="grid size-10 shrink-0 place-items-center rounded-lg border border-muted text-ink hover:bg-muted/60 disabled:cursor-progress"
      >
        {signingOut ? <Spinner small label="Signing out…" /> : <Icon name="logOut" size={18} />}
      </button>
    </header>
  );
}

export function AppShell() {
  const emailSettings = useEmailSettings();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [signingOut, setSigningOut] = useState(false);

  // Number of enquiries still waiting for a reply (refreshed on every page change). Hidden while loading / on error.
  const { data } = useAsync(
    (signal) => enquiriesApi.list({ type: "ALL", status: "AWAITING", q: "", sort: "newest", page: 1 }, signal),
    [location.pathname, location.search],
  );

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      // replace: the browser Back button cannot return to a signed-in page.
      navigate("/login", { replace: true });
    }
  }

  const shell: ShellProps = { awaiting: data?.counts.awaiting, signingOut, onSignOut: () => void handleSignOut() };

  return (
    <EmailSettingsContext.Provider value={emailSettings}>
      <div className="flex min-h-dvh flex-col md:flex-row">
        <Sidebar {...shell} />
        <MobileHeader {...shell} />
        <div className="flex min-w-0 flex-1 flex-col">
          {emailSettings && (emailSettings.provider === "MOCK" || emailSettings.testMode) && (
            <div className="mx-auto w-full max-w-[1280px] px-4 pt-4 md:px-8 md:pt-6">
              <EmailModeBanner settings={emailSettings} />
            </div>
          )}
          <main id="main" className="mx-auto w-full max-w-[1280px] flex-1 p-4 md:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </EmailSettingsContext.Provider>
  );
}
