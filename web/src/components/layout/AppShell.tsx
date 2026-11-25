// Layout for signed-in pages.
// Desktop (md+): light sidebar (logo, menu, staff + Log out). Mobile (<md): white top bar (logo, menu, Log out icon).
// logo-transparent.png = the brand logo with its pale background removed, so it sits on the page with no box.
import { createContext, useContext, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import type { EmailSettings } from "../../types";
import logo from "../../assets/logo-transparent.png";
import { enquiriesApi } from "../../api/enquiries";
import { useAsync } from "../../lib/useAsync";
import { Avatar } from "../ui/Avatar";
import { Icon } from "../ui/Icon";
import { Spinner } from "../ui/Spinner";
import { cn } from "../../lib/cn";
import { EmailModeBanner, useEmailSettings } from "./EmailModeBanner";

const EmailSettingsContext = createContext<EmailSettings | null>(null);
export const useEmailSettingsContext = () => useContext(EmailSettingsContext);


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
    <aside className="sticky top-0 hidden h-dvh w-[240px] shrink-0 flex-col border-r border-muted bg-surface text-ink md:flex">
      <NavLink
        to="/enquiries"
        aria-label="PrivateHire Cars Staff Portal — Enquiries"
        className="flex flex-col items-center gap-1 px-5 pt-6 pb-5"
      >
        <img src={logo} alt="" width={195} height={101} className="h-16 w-auto" />
        <span className="text-helper font-semibold text-ink/60 uppercase">Staff Portal</span>
      </NavLink>

      <p className="px-6 pb-2 text-helper font-semibold text-ink/50 uppercase">Menu</p>
      <nav aria-label="Main" className="flex-1 px-3">
        <ul className="flex flex-col gap-1">
          <li>
            <NavLink
              to="/enquiries"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-label font-semibold text-ink transition-colors duration-150 hover:bg-muted/50",
                  isActive && "bg-primary/15 text-primary-pressed hover:bg-primary/20",
                )
              }
            >
              <Icon name="inbox" size={18} />
              <span className="flex-1">Enquiry Management</span>
              <AwaitingBadge awaiting={awaiting} />
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/customers"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-label font-semibold text-ink transition-colors duration-150 hover:bg-muted/50",
                  isActive && "bg-primary/15 text-primary-pressed hover:bg-primary/20",
                )
              }
            >
              <Icon name="search" size={18} />
              <span className="flex-1">Customer Lookup</span>
            </NavLink>
          </li>
        </ul>
      </nav>

      <div className="m-3 flex flex-col gap-3 rounded-xl border border-muted bg-muted/20 p-4">
        {staff && (
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={staff.fullName} size="md" />
            <div className="min-w-0">
              <p className="truncate text-label font-semibold">{staff.fullName}</p>
              <p className="truncate text-helper text-ink/60">{staff.email}</p>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={onSignOut}
          disabled={signingOut}
          className={cn(
            "flex h-10 items-center justify-center gap-2 rounded-lg border border-ink bg-surface text-label font-semibold text-ink transition-colors duration-150 hover:bg-muted/60 disabled:cursor-progress",
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
        <img src={logo} alt="" width={195} height={101} className="h-10 w-auto" />
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
        <NavLink
          to="/customers"
          className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-label font-semibold text-ink hover:bg-muted/60"
        >
          <Icon name="search" size={18} />
          <span className="truncate">Customers</span>
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
