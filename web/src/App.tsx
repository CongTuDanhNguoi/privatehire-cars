// Staff Portal routes.
//   /login            Staff Login (guests only)
//   /enquiries        Enquiry Inbox            (signed in)
//   /enquiries/:id    Enquiry Detail           (signed in)
//   /ui-kit           component gallery        (development only)
//   *                 Not found (signed in) / → /login (signed out)
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { GuestOnly, RequireStaff } from "./auth/RouteGuards";
import { AppShell } from "./components/layout/AppShell";
import { FullPageSpinner } from "./components/ui/Spinner";
import InboxPage from "./pages/InboxPage";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";

// Only bundled into development builds.
const UiKitPage = import.meta.env.DEV ? lazy(() => import("./pages/UiKitPage")) : null;

function FallbackRoute() {
  const { status } = useAuth();
  if (status === "loading") return <FullPageSpinner label="Checking your session" />;
  if (status === "signedOut") return <Navigate to="/login" replace />;
  return <NotFoundPage />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/enquiries" replace />} />
      <Route
        path="/login"
        element={
          <GuestOnly>
            <LoginPage />
          </GuestOnly>
        }
      />
      <Route
        element={
          <RequireStaff>
            <AppShell />
          </RequireStaff>
        }
      >
        <Route path="/enquiries" element={<InboxPage />} />
        <Route path="/enquiries/:id" element={<NotFoundPage title="Enquiry detail" description="The detail page is built in Phase 5." />} />
        <Route path="*" element={<FallbackRoute />} />
      </Route>
      {UiKitPage && (
        <Route
          path="/ui-kit"
          element={
            <Suspense fallback={<FullPageSpinner />}>
              <UiKitPage />
            </Suspense>
          }
        />
      )}
    </Routes>
  );
}
