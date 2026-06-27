import { AppShell, type ShellLinkProps, ThemeProvider } from "@mdcz/views/shell";
import { useQuery } from "@tanstack/react-query";
import { createRootRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { api } from "../client";
import { LoginPage } from "../components/auth/LoginPage";
import { useWebTaskSync } from "../hooks/useWebTaskSync";
import { queryKeys } from "../lib/queryKeys";

const PUBLIC_PATHS = new Set(["/setup", "/login"]);

const ShellLink = ({ to, className, onFocus, onMouseEnter, children }: ShellLinkProps) => (
  <Link className={className} to={to} preload="intent" onFocus={onFocus} onMouseEnter={onMouseEnter}>
    {children}
  </Link>
);

export const RootLayout = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const authQ = useQuery({ queryKey: queryKeys.auth.status, queryFn: () => api.auth.status(), retry: false });
  const setupRequired = Boolean(authQ.data?.setupRequired);
  const authenticated = Boolean(authQ.data?.authenticated);

  useEffect(() => {
    if (authQ.isLoading || !authQ.data) {
      return;
    }

    if (setupRequired && pathname !== "/setup") {
      void navigate({ to: "/setup", replace: true });
      return;
    }

    if (!setupRequired && pathname === "/setup") {
      void navigate({ to: "/", replace: true });
    }
  }, [authQ.data, authQ.isLoading, navigate, pathname, setupRequired]);

  if (authQ.isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-surface-canvas text-sm text-muted-foreground">
        加载中...
      </div>
    );
  }

  if (setupRequired && pathname !== "/setup") {
    return null;
  }

  if (!setupRequired && pathname === "/setup") {
    return null;
  }

  if (!setupRequired && !authenticated && !PUBLIC_PATHS.has(pathname)) {
    return <LoginPage nextPath={pathname} />;
  }

  if (PUBLIC_PATHS.has(pathname)) {
    return <>{children}</>;
  }

  return <AuthenticatedShell pathname={pathname}>{children}</AuthenticatedShell>;
};

const AuthenticatedShell = ({ children, pathname }: { children: ReactNode; pathname: string }) => {
  useWebTaskSync();

  return (
    <ThemeProvider>
      <AppShell currentPath={pathname} linkComponent={ShellLink}>
        {children}
      </AppShell>
    </ThemeProvider>
  );
};

export const Route = createRootRoute({
  component: () => (
    <RootLayout>
      <Outlet />
    </RootLayout>
  ),
});
