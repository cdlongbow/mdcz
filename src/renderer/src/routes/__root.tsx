import { createRootRoute, Outlet } from "@tanstack/react-router";
import Layout from "../components/Layout";
import { ShortcutHandler } from "../components/ShortcutHandler";

export const Route = createRootRoute({
  component: () => {
    return (
      <Layout>
        <ShortcutHandler />
        <Outlet />
      </Layout>
    );
  },
});
