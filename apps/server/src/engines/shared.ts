import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FFMPEG_DIR, FFMPEG_PATH, YTDLP_PATH, isWindows } from "../config.js";
import type { CookieConfig } from "../ytdlp.js";

/**
 * Helpers shared by every download/scan engine (yt-dlp, f2, BBDown). Kept here so
 * each engine spawns child processes, parses progress, and resolves cookies the
 * same way — `ytdlp.ts` imports these too so behaviour stays identical.
 */

/** Kill a process and (on Windows) its whole child tree (ffmpeg, PyInstaller child, …). */
export function killTree(child: ChildProcessWithoutNullStreams): void {
  if (child.pid == null) return;
  if (isWindows) {
    spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { windowsHide: true });
  } else {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }
  }
}

/* ------------------------------- progress ---------------------------------- */

/** Marker an engine prints on stdout so we can pick progress lines out of noise. */
export const PROGRESS_PREFIX = "vbdprog:";

function parsePercent(s: string): number | null {
  const m = s.match(/([\d.]+)\s*%/);
  if (!m) return null;
  const n = Number.parseFloat(m[1]!);
  return Number.isFinite(n) ? n : null;
}

/** Normalise a progress field, mapping "N/A"/"Unknown" placeholders to null. */
function cleanField(s: string): string | null {
  const t = s.trim();
  if (!t || t === "N/A" || /unknown/i.test(t)) return null;
  return t;
}

export interface ProgressLine {
  pct: number | null;
  speed: string | null;
  eta: string | null;
}

/**
 * Parse a `vbdprog:<pct>%|<speed>|<eta>` line. Returns null for lines without the
 * prefix so callers can keep handling other stdout (e.g. the final file path).
 */
export function parseProgressLine(line: string): ProgressLine | null {
  const idx = line.indexOf(PROGRESS_PREFIX);
  if (idx === -1) return null;
  const payload = line.slice(idx + PROGRESS_PREFIX.length);
  const [pctStr = "", speedStr = "", etaStr = ""] = payload.split("|");
  return { pct: parsePercent(pctStr), speed: cleanField(speedStr), eta: cleanField(etaStr) };
}

/* -------------------------------- cookies ---------------------------------- */

export interface CookieFile {
  /** A cookies.txt path to hand to an engine that only accepts a file, or null. */
  path: string | null;
  /** Remove any temp file created for this resolution (no-op for file mode). */
  cleanup: () => void;
}

const noop = (): void => {};

/**
 * Resolve a {@link CookieConfig} down to a cookies.txt path for engines (f2,
 * BBDown) that only accept a file:
 *  - file mode    → the user's path as-is
 *  - browser mode → export the full browser jar via yt-dlp into a temp file
 *  - none         → { path: null }
 *
 * `urlHint` is the URL yt-dlp runs against while exporting (it still dumps the
 * complete jar, so any reachable URL on the right site works). Caller MUST call
 * `cleanup()` once the engine process has exited.
 */
export async function materializeCookieFile(
  cookies: CookieConfig,
  urlHint: string,
): Promise<CookieFile> {
  if (cookies.cookieMode === "file" && cookies.cookieFilePath) {
    return { path: cookies.cookieFilePath, cleanup: noop };
  }
  if (cookies.cookieMode === "browser" && cookies.cookieBrowser) {
    const tmp = path.join(os.tmpdir(), `vbd-cookies-${process.pid}-${Date.now()}.txt`);
    await new Promise<void>((resolve) => {
      const child = spawn(
        YTDLP_PATH,
        [
          "--cookies-from-browser",
          cookies.cookieBrowser!,
          "--cookies",
          tmp,
          "--simulate",
          "--no-warnings",
          "--ignore-errors",
          urlHint,
        ],
        { windowsHide: true },
      );
      child.on("error", () => resolve());
      child.on("close", () => resolve());
    });
    const ok = fs.existsSync(tmp) && fs.statSync(tmp).size > 0;
    const cleanup = () => {
      try {
        fs.unlinkSync(tmp);
      } catch {
        /* ignore */
      }
    };
    return ok ? { path: tmp, cleanup } : { path: null, cleanup };
  }
  return { path: null, cleanup: noop };
}

/* ------------------------------- codec ------------------------------------- */

const FFPROBE_PATH = path.join(FFMPEG_DIR, isWindows ? "ffprobe.exe" : "ffprobe");
const H264_CODECS = new Set(["h264", "avc1", "avc"]);

/** Video codec of a media file via ffprobe (e.g. "h264", "hevc"); "" on failure. */
export function videoCodec(file: string): string {
  try {
    const r = spawnSync(
      FFPROBE_PATH,
      ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name", "-of", "default=nk=1:nw=1", file],
      { windowsHide: true, encoding: "utf8" },
    );
    return (r.stdout ?? "").trim().toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Guarantee a Windows-playable H.264 file: if `file` isn't already H.264, transcode
 * it in place (libx264 + AAC). Used for non-"best" Douyin downloads, where the
 * source Douyin stream is frequently HEVC (needs the paid HEVC extension to play).
 * On failure it leaves the original file rather than failing the whole download.
 */
export async function ensureH264(file: string, onConvert?: () => void): Promise<void> {
  if (!fs.existsSync(file)) return;
  if (H264_CODECS.has(videoCodec(file))) return;
  onConvert?.();
  const ext = path.extname(file) || ".mp4";
  const tmp = path.join(path.dirname(file), `${path.basename(file, ext)}.h264${ext}`);
  // Keep it light on the machine: fast preset + cap threads to ~half the cores so
  // a transcode doesn't peg the CPU.
  const threads = String(Math.max(1, Math.floor((os.cpus()?.length || 2) / 2)));
  const ok = await new Promise<boolean>((resolve) => {
    const c = spawn(
      FFMPEG_PATH,
      ["-y", "-threads", threads, "-i", file, "-c:v", "libx264", "-preset", "veryfast",
       "-crf", "23", "-c:a", "aac", "-movflags", "+faststart", tmp],
      { windowsHide: true },
    );
    c.on("error", () => resolve(false));
    c.on("close", (code) => resolve(code === 0));
  });
  if (!ok) {
    try {
      fs.rmSync(tmp, { force: true });
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    fs.rmSync(file, { force: true });
    fs.renameSync(tmp, file);
  } catch {
    /* ignore */
  }
}
