#!/usr/bin/env node
/**
 * Fetches the Electron-ABI prebuilt of better-sqlite3 and copies it to
 * apps/desktop/native/better_sqlite3.node, while keeping the hoisted
 * node_modules copy at the Node ABI for server / vitest usage.
 *
 * Two .node files coexist after this runs:
 *   - node_modules/.../better-sqlite3/build/Release/better_sqlite3.node  (Node ABI)
 *   - apps/desktop/native/better_sqlite3.node                            (Electron ABI)
 *
 * DesktopPersistenceService passes the latter via better-sqlite3's
 * `nativeBinding` option so Electron loads the right one explicitly.
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

if (process.env.MDCZ_SKIP_ELECTRON_SQLITE === "1") {
  console.log("[postinstall] MDCZ_SKIP_ELECTRON_SQLITE=1, skipping");
  process.exit(0);
}

let electronVersion;
try {
  electronVersion = require("electron/package.json").version;
} catch {
  console.log("[postinstall] electron not yet installed, skipping");
  process.exit(0);
}

const sqlitePkgDir = path.dirname(require.resolve("better-sqlite3/package.json"));
const builtNode = path.join(sqlitePkgDir, "build", "Release", "better_sqlite3.node");
const backup = `${builtNode}.bak`;
const target = path.resolve(__dirname, "native", "better_sqlite3.node");

fs.mkdirSync(path.dirname(target), { recursive: true });

let backedUp = false;
if (fs.existsSync(builtNode)) {
  fs.copyFileSync(builtNode, backup);
  backedUp = true;
}

try {
  const result = spawnSync(
    process.execPath,
    [
      require.resolve("prebuild-install/bin.js", { paths: [sqlitePkgDir] }),
      "--runtime=electron",
      `--target=${electronVersion}`,
    ],
    { cwd: sqlitePkgDir, stdio: "inherit" },
  );
  if (result.status !== 0) throw new Error(`prebuild-install exited with code ${result.status}`);
  if (!fs.existsSync(builtNode)) throw new Error(`expected ${builtNode} after prebuild-install`);
  fs.copyFileSync(builtNode, target);
  console.log(`[postinstall] electron sqlite -> ${path.relative(process.cwd(), target)}`);
} finally {
  if (backedUp) {
    fs.copyFileSync(backup, builtNode);
    fs.unlinkSync(backup);
  }
}
