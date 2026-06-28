import type { CookieConfig, ScanEntry, ScanHandle } from "./ytdlp.js";

/**
 * Channel enumerator backed by a native (Electron) capability, injected at
 * runtime. Same contract as the yt-dlp scan / Bilibili enumerator so the scanner
 * can use it interchangeably. In web mode these stay null.
 */
export type ChannelEnumerator = (
  url: string,
  cookies: CookieConfig,
  onEntry: (entry: ScanEntry, index: number) => void,
  limit?: number,
) => ScanHandle;

let douyinEnumerator: ChannelEnumerator | null = null;

export function setDouyinEnumerator(fn: ChannelEnumerator | null): void {
  douyinEnumerator = fn;
}

export function getDouyinEnumerator(): ChannelEnumerator | null {
  return douyinEnumerator;
}
