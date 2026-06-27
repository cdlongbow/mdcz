import { AppShell, type ShellLinkProps, SYSTEM_SHELL_NAV } from "@mdcz/views/shell";
import { Link, useLocation } from "@tanstack/react-router";
import { type ReactNode, useMemo } from "react";
import { AppTitleBar } from "@/components/AppTitleBar";
import { useCurrentConfig } from "@/hooks/configQueries";

interface LayoutProps {
  children: ReactNode;
}

const ShellLink = ({ to, onFocus, onMouseEnter, children }: ShellLinkProps) => (
  <Link to={to} preload="intent" onFocus={onFocus} onMouseEnter={onMouseEnter}>
    {children}
  </Link>
);

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const configQ = useCurrentConfig();
  const useCustomTitleBar = configQ.data?.ui?.useCustomTitleBar ?? true;

  const systemNav = useMemo(() => {
    const showLogsPanel = configQ.data?.ui?.showLogsPanel ?? true;
    return showLogsPanel ? SYSTEM_SHELL_NAV : SYSTEM_SHELL_NAV.filter((item) => item.to !== "/logs");
  }, [configQ.data?.ui?.showLogsPanel]);

  return (
    <AppShell
      currentPath={location.pathname}
      linkComponent={ShellLink}
      systemNav={systemNav}
      titlebar={useCustomTitleBar ? <AppTitleBar /> : null}
    >
      {children}
    </AppShell>
  );
}
