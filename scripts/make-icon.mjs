// Generate build/icon.ico (the app/installer icon for electron-builder) from the
// source logo PNG. ICO entries max out at 256x256, so png-to-ico downsizes the
// 1254x1254 source to the standard icon sizes.
//
//   pnpm build:icon
import pngToIco from "png-to-ico";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "docs", "themes-references", "logo.png");
const OUT = path.join(ROOT, "build", "icon.ico");

const buf = await pngToIco(SRC);
mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, buf);
console.log(`✓ wrote ${OUT} (${buf.length} bytes)`);
