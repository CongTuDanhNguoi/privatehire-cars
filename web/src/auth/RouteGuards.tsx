import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { NETWORK_ERROR_MESSAGE } from "../api/client";
import { Alert } from "../components/ui/Alert";
import { FullPageSpinner } from "../components/ui/Spinner";
import { useAuth } from "./AuthContext";

// Shown when the session check could not reach the API (server down / no connection).
export function ServerUnavailable() {
  const { retrySession } = useAuth();
  return (
    <main className="grid min-h-dvh place-items-center bg-muted px-4">
      <div className="w-[480px]">
        <Alert variant="error" title={NETWORK_ERROR_MESSAGE} action={{ label: "Try again", onClick: retrySession }}>
          The Staff Portal could not check your session.
        </Alert>
      </div>
    </main>
  );
}

// Pages for signed-in staff only. Remembers where the user wanted to go.
export function RequireStaff({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <FullPageSpinner label="Checking your session" />;
  if (status === "unavailable") return <ServerUnavailable />;
  if (status === "signedOut") {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  return <>{children}</>;
}

// The login page: already signed in → straight to the inbox.
export function GuestOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === "loading") return <FullPageSpinner label="Checking your session" />;
  if (status === "unavailable") return <ServerUnavailable />;
  if (status === "signedIn") return <Navigate to="/enquiries" replace />;
  return <>{children}</>;
}
