import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { FullPageSpinner } from "../components/ui/Spinner";
import { useAuth } from "./AuthContext";

// Pages for signed-in staff only. Remembers where the user wanted to go.
export function RequireStaff({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <FullPageSpinner label="Checking your session" />;
  if (status === "signedOut") {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  return <>{children}</>;
}

// The login page: already signed in → straight to the inbox.
export function GuestOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === "loading") return <FullPageSpinner label="Checking your session" />;
  if (status === "signedIn") return <Navigate to="/enquiries" replace />;
  return <>{children}</>;
}
