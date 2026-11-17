// Staff session on the client. On start it asks the API who is signed in (GET /api/staff/auth/me).
// Any protected API call that returns 401 clears the session and sends the user to /login with a notice.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { setUnauthorizedHandler } from "../api/client";
import { staffAuthApi } from "../api/staff";
import type { Staff } from "../types";

export const SESSION_EXPIRED_MESSAGE = "Your session has expired. Please sign in again.";

interface AuthState {
  status: "loading" | "signedIn" | "signedOut";
  staff: Staff | null;
  notice: string | null; // shown once on the login page
  signIn: (email: string, password: string) => Promise<Staff>;
  signOut: () => Promise<void>;
  clearNotice: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<AuthState["status"]>("loading");
  const [staff, setStaff] = useState<Staff | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    staffAuthApi
      .me()
      .then(({ staff }) => {
        if (cancelled) return;
        setStaff(staff);
        setStatus("signedIn");
      })
      .catch(() => {
        if (cancelled) return;
        setStaff(null);
        setStatus("signedOut");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setStaff(null);
      setStatus("signedOut");
      setNotice(SESSION_EXPIRED_MESSAGE);
      navigate("/login", { replace: true });
    });
    return () => setUnauthorizedHandler(null);
  }, [navigate]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { staff } = await staffAuthApi.login(email, password);
    setStaff(staff);
    setStatus("signedIn");
    setNotice(null);
    return staff;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await staffAuthApi.logout();
    } finally {
      setStaff(null);
      setStatus("signedOut");
    }
  }, []);

  const clearNotice = useCallback(() => setNotice(null), []);

  const value = useMemo(
    () => ({ status, staff, notice, signIn, signOut, clearNotice }),
    [status, staff, notice, signIn, signOut, clearNotice],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
