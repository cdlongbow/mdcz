import { resolve } from "node:path";

import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import pkg from "./package.json" with { type: "json" };

const rootResolve = (subpath: string): string => resolve(__dirname, subpath);

const isIgnorableUseClientWarning = (message: string): boolean =>
  message.includes("Module level directives cause errors when bundled") && message.includes('"use client"');

const isIgnorableUseClientSourcemapWarning = (message: string): boolean =>
  message.includes("Error when using sourcemap for reporting an error") &&
  message.includes("Can't resolve original location of error");

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        "@main": rootResolve("src/main"),
        "@shared": rootResolve("packages/shared"),
      },
    },
    build: {
      rollupOptions: {
        external: Object.keys(pkg.dependencies),
        output: {
          inlineDynamicImports: true,
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        "@shared": rootResolve("packages/shared"),
      },
    },
    build: {
      rollupOptions: {
        output: {
          format: "cjs",
          entryFileNames: "index.js",
        },
      },
    },
  },
  renderer: {
    root: rootResolve("src/renderer"),
    base: "./",
    resolve: {
      alias: {
        "@": rootResolve("src/renderer/src"),
        "@renderer": rootResolve("src/renderer/src"),
        "@shared": rootResolve("packages/shared"),
      },
    },
    build: {
      rollupOptions: {
        input: {
          index: rootResolve("src/renderer/index.html"),
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
  },
});
