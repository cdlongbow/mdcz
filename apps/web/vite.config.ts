import { resolve } from "node:path";
import { defineConfig } from "vite";

const workspaceResolve = (subpath: string): string => resolve(__dirname, "../..", subpath);

const isIgnorableUseClientWarning = (message: string): boolean =>
  message.includes("Module level directives cause errors when bundled") && message.includes('"use client"');

const isIgnorableUseClientSourcemapWarning = (message: string): boolean =>
  message.includes("Error when using sourcemap for reporting an error") &&
  message.includes("Can't resolve original location of error");

const manualChunk = (id: string): string | undefined => {
  const normalized = id.replace(/\\/gu, "/");
  if (normalized.includes("/node_modules/react") || normalized.includes("/node_modules/react-dom")) {
    return "vendor-react";
  }
  if (normalized.includes("/node_modules/@tanstack/")) {
    return "vendor-tanstack";
  }
  if (normalized.includes("/node_modules/radix-ui/")) {
    return "vendor-radix";
  }
  if (normalized.includes("/node_modules/lucide-react/")) {
    return "vendor-icons";
  }
  if (normalized.includes("/packages/views/src/")) {
    return "views";
  }
  if (normalized.includes("/packages/ui/src/")) {
    return "ui";
  }
  return undefined;
};

export default defineConfig({
  resolve: {
    alias: [
      { find: "@", replacement: workspaceResolve("apps/desktop/src/renderer/src") },
      { find: /^@mdcz\/shared$/, replacement: workspaceResolve("packages/shared/browser.ts") },
      { find: /^@mdcz\/shared\/(.+)$/, replacement: workspaceResolve("packages/shared/$1") },
      { find: /^@mdcz\/ui$/, replacement: workspaceResolve("packages/ui/src/index.ts") },
      { find: /^@mdcz\/views$/, replacement: workspaceResolve("packages/views/src/index.ts") },
      { find: /^@mdcz\/views\/about$/, replacement: workspaceResolve("packages/views/src/about/index.ts") },
      { find: /^@mdcz\/views\/common$/, replacement: workspaceResolve("packages/views/src/common/index.ts") },
      { find: /^@mdcz\/views\/config-form$/, replacement: workspaceResolve("packages/views/src/config-form/index.ts") },
      { find: /^@mdcz\/views\/detail$/, replacement: workspaceResolve("packages/views/src/detail/index.ts") },
      { find: /^@mdcz\/views\/library$/, replacement: workspaceResolve("packages/views/src/library/index.ts") },
      { find: /^@mdcz\/views\/logs$/, replacement: workspaceResolve("packages/views/src/logs/index.ts") },
      { find: /^@mdcz\/views\/maintenance$/, replacement: workspaceResolve("packages/views/src/maintenance/index.ts") },
      { find: /^@mdcz\/views\/nfo$/, replacement: workspaceResolve("packages/views/src/nfo/index.ts") },
      { find: /^@mdcz\/views\/overview$/, replacement: workspaceResolve("packages/views/src/overview/index.ts") },
      { find: /^@mdcz\/views\/scrape$/, replacement: workspaceResolve("packages/views/src/scrape/index.ts") },
      { find: /^@mdcz\/views\/settings$/, replacement: workspaceResolve("packages/views/src/settings/index.ts") },
      { find: /^@mdcz\/views\/tools$/, replacement: workspaceResolve("packages/views/src/tools/index.ts") },
      { find: /^@mdcz\/views\/workbench$/, replacement: workspaceResolve("packages/views/src/workbench/index.ts") },
    ],
  },
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: manualChunk,
      },
      onwarn(warning, warn) {
        if (isIgnorableUseClientWarning(warning.message)) {
          return;
        }
        if (isIgnorableUseClientSourcemapWarning(warning.message)) {
          return;
        }
        warn(warning);
      },
    },
  },
});
