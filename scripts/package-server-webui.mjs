import { spawn } from "node:child_process";
import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const releaseDir = resolve(repoRoot, "release");
const stagingDir = resolve(releaseDir, "server-webui");
const artifactTagPrefix = "mdcz-server-webui";

const readJson = async (relativePath) => JSON.parse(await readFile(resolve(repoRoot, relativePath), "utf8"));

const requirePath = async (path, description) => {
  try {
    await stat(path);
  } catch {
    throw new Error(`${description} is missing: ${path}`);
  }
};

const run = (command, args) =>
  new Promise((resolveProcess, rejectProcess) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: "inherit",
    });

    child.on("error", rejectProcess);
    child.on("exit", (code) => {
      if (code === 0) {
        resolveProcess();
        return;
      }
      rejectProcess(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });

const dependencyVersion = (name, ...manifests) => {
  for (const manifest of manifests) {
    const version = manifest.dependencies?.[name] ?? manifest.optionalDependencies?.[name];
    if (version) {
      return version;
    }
  }
  throw new Error(`Missing release dependency version for ${name}`);
};

const rootPackage = await readJson("package.json");
const serverPackage = await readJson("apps/server/package.json");
const runtimePackage = await readJson("packages/runtime/package.json");

const releaseTag = process.env.MDCZ_RELEASE_TAG?.trim() || rootPackage.version;
const artifactPath = resolve(releaseDir, `${artifactTagPrefix}-${releaseTag}.tar.gz`);
const serverDist = resolve(repoRoot, "apps/server/dist");

await requirePath(resolve(serverDist, "server.js"), "Server bundle");
await requirePath(resolve(serverDist, "web/index.html"), "WebUI bundle");

await rm(stagingDir, { recursive: true, force: true });
await mkdir(stagingDir, { recursive: true });
await cp(serverDist, resolve(stagingDir, "dist"), { recursive: true });
await cp(resolve(repoRoot, "apps/server/README.md"), resolve(stagingDir, "README.md"));
await cp(resolve(repoRoot, "apps/server/.env.example"), resolve(stagingDir, ".env.example"));

const releasePackage = {
  name: "mdcz-server-webui",
  version: rootPackage.version,
  private: true,
  type: "module",
  packageManager: rootPackage.packageManager,
  scripts: {
    start: "node dist/server.js",
  },
  dependencies: {
    "@trpc/server": dependencyVersion("@trpc/server", serverPackage),
    "better-sqlite3": dependencyVersion("better-sqlite3", serverPackage),
    "drizzle-orm": dependencyVersion("drizzle-orm", serverPackage),
    fastify: dependencyVersion("fastify", serverPackage),
    impit: dependencyVersion("impit", runtimePackage),
  },
  engines: {
    node: ">=20",
  },
};

await writeFile(resolve(stagingDir, "package.json"), `${JSON.stringify(releasePackage, null, 2)}\n`);
await rm(artifactPath, { force: true });
await run("tar", ["-czf", artifactPath, "-C", releaseDir, "server-webui"]);

console.log(`Created ${artifactPath}`);
