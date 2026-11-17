// Staff Portal routes (data router, needed for useBlocker on unsent replies).
//   /login            Staff Login (guests only)
//   /enquiries        Enquiry Inbox            (signed in)
//   /enquiries/:id    Enquiry Detail           (signed in)
//   /ui-kit           component gallery        (development only)
//   *                 Not found (signed in) / → /login (signed out)
import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate, Outlet, type RouteObject } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { GuestOnly, RequireStaff } from "./auth/RouteGuards";
import { AppShell } from "./components/layout/AppShell";
import { FullPageSpinner } from "./components/ui/Spinner";
import { ToastProvider } from "./components/ui/Toast";
import EnquiryDetailPage from "./pages/EnquiryDetailPage";
import InboxPage from "./pages/InboxPage";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";

// Only bundled into development builds.
const UiKitPage = import.meta.env.DEV ? lazy(() => import("./pages/UiKitPage")) : null;

// Providers that need the router (AuthProvider uses useNavigate).
function Root() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Outlet />
      </ToastProvider>
    </AuthProvider>
  );
}

function FallbackRoute() {
  const { status } = useAuth();
  if (status === "loading") return <FullPageSpinner label="Checking your session" />;
  if (status === "signedOut") return <Navigate to="/login" replace />;
  return <NotFoundPage />;
}

const routes: RouteObject[] = [
  {
    element: <Root />,
    children: [
      { path: "/", element: <Navigate to="/enquiries" replace /> },
      {
        path: "/login",
        element: (
          <GuestOnly>
            <LoginPage />
          </GuestOnly>
        ),
      },
      {
        element: (
          <RequireStaff>
            <AppShell />
          </RequireStaff>
        ),
        children: [
          { path: "/enquiries", element: <InboxPage /> },
          { path: "/enquiries/:id", element: <EnquiryDetailPage /> },
          { path: "*", element: <FallbackRoute /> },
        ],
      },
      ...(UiKitPage
        ? [
            {
              path: "/ui-kit",
              element: (
                <Suspense fallback={<FullPageSpinner />}>
                  <UiKitPage />
                </Suspense>
              ),
            },
          ]
        : []),
    ],
  },
];

export const router = createBrowserRouter(routes);
