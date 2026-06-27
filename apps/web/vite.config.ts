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
      { find: /^@mdcz\/shared$/, replacement: workspaceResolve("packages/shared/browser.ts") },
      { find: /^@mdcz\/shared\/(.+)$/, replacement: workspaceResolve("packages/shared/$1") },
      { find: /^@mdcz\/ui$/, replacement: workspaceResolve("packages/ui/src/index.ts") },
      { find: /^@mdcz\/views$/, replacement: workspaceResolve("packages/views/src/index.ts") },
      { find: /^@mdcz\/views\/(.+)$/, replacement: workspaceResolve("packages/views/src/$1") },
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
