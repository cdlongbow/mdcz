import "./index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createHashHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { Suspense, useMemo } from "react";
import { BootFallback } from "./components/BootFallback";
import { Toaster } from "./components/ui/Sonner";
import { TooltipProvider } from "./components/ui/Tooltip";
import { ThemeProvider } from "./contexts/ThemeProvider";
import { ToastProvider } from "./contexts/ToastProvider";
import { useIpcSync } from "./hooks/useIpcSync";
import { useStylesReady } from "./hooks/useStylesReady";
import { routeTree } from "./routeTree.gen";

const shouldUseHashHistory = typeof window !== "undefined" && window.location.protocol === "file:";

const router = createRouter({
  routeTree,
  ...(shouldUseHashHistory ? { history: createHashHistory() } : {}),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const App = () => {
  const queryClient = useMemo(() => new QueryClient(), []);
  const { runtimeReady, runtimeError } = useIpcSync();
  const stylesReady = useStylesReady();

  if (runtimeError) {
    return <BootFallback message={runtimeError} />;
  }

  if (!runtimeReady || !stylesReady) {
    return <BootFallback message={stylesReady ? "Starting app..." : "Loading styles..."} />;
  }

  return (
    <ThemeProvider>
      <TooltipProvider>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <Suspense fallback={<BootFallback message="Loading page..." />}>
              <RouterProvider router={router} />
            </Suspense>
            <Toaster />
          </ToastProvider>
        </QueryClientProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
};

export default App;
