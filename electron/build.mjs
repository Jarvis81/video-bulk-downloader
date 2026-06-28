// Bundle the Electron main + preload (with the Fastify server) into electron/dist.
import { build } from "esbuild";
import { rmSync } from "node:fs";

rmSync("electron/dist", { recursive: true, force: true });

await build({
  entryPoints: ["electron/main.ts", "electron/preload.ts"],
  outdir: "electron/dist",
  outExtension: { ".js": ".cjs" },
  platform: "node",
  format: "cjs",
  target: "node20",
  bundle: true,
  // electron is provided by the runtime; better-sqlite3 is native (loaded at runtime).
  external: ["electron", "better-sqlite3"],
  sourcemap: true,
  logLevel: "info",
});

console.log("✓ electron bundle → electron/dist/{main,preload}.cjs");
