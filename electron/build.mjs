// Bundle the Electron main + preload (with the Fastify server) into electron/dist.
//
// Dev (default):           fast, with sourcemaps.
// Release (VBD_RELEASE=1):  minified, NO sourcemaps, and the main bundle is
//                           obfuscated to deter reverse-engineering.
import { build } from "esbuild";
import { readFileSync, rmSync, writeFileSync } from "node:fs";

const RELEASE = process.env.VBD_RELEASE === "1";
const OBFUSCATE = RELEASE && process.env.VBD_OBFUSCATE !== "0";

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
  minify: RELEASE,
  // Sourcemaps would undo minification and leak the original source — off for release.
  sourcemap: RELEASE ? false : true,
  logLevel: "info",
});

if (OBFUSCATE) {
  // Conservative options: protect strings/identifiers + self-defending, but no
  // control-flow flattening / object-key mangling (those can break the bundled
  // server/native requires and hurt startup). Only the main bundle is obfuscated;
  // preload exposes named bridge keys the renderer relies on, so it's left alone.
  const { default: Obfuscator } = await import("javascript-obfuscator");
  const file = "electron/dist/main.cjs";
  const out = Obfuscator.obfuscate(readFileSync(file, "utf8"), {
    compact: true,
    identifierNamesGenerator: "hexadecimal",
    simplify: true,
    numbersToExpressions: true,
    stringArray: true,
    stringArrayEncoding: ["base64"],
    stringArrayThreshold: 0.8,
    splitStrings: true,
    splitStringsChunkLength: 10,
    selfDefending: true,
    controlFlowFlattening: false,
    deadCodeInjection: false,
    transformObjectKeys: false,
    debugProtection: false,
  });
  writeFileSync(file, out.getObfuscatedCode());
  console.log("✓ obfuscated electron/dist/main.cjs");
}

console.log(
  "✓ electron bundle → electron/dist/{main,preload}.cjs" +
    (RELEASE ? `  [release: minified${OBFUSCATE ? " + obfuscated" : ""}]` : "  [dev]"),
);
