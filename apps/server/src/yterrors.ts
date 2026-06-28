import type { Platform, SourceType } from "@vbd/shared";

/**
 * Turn a raw yt-dlp stderr blob into a short, actionable message for the UI.
 * Keeps the original around (trimmed) when nothing matches.
 */
export function humanizeYtDlpError(
  raw: string,
  ctx: { platform: Platform; sourceType: SourceType },
): string {
  const msg = raw.trim();

  // Already-friendly messages thrown by our own code pass through unchanged.
  if (msg.startsWith("Couldn't read")) return msg;

  // Browser cookie DB couldn't be read (usually: the browser is open and locks it).
  if (/could not (copy|find).*cookie|permission denied.*cookies|cookie database|cookies database|failed to decrypt/i.test(msg)) {
    return (
      "Couldn't read your browser's cookies — on Windows the browser locks its cookie " +
      "database while running. Fix: fully quit the browser and retry, or (more reliable) " +
      "export a cookies.txt (e.g. the “Get cookies.txt LOCALLY” extension) and set " +
      "Cookies = “cookies.txt file”."
    );
  }

  // Douyin has no user/channel extractor in yt-dlp.
  if (/unsupported url/i.test(msg) && ctx.platform === "douyin" && ctx.sourceType === "channel") {
    return (
      "Listing a whole Douyin channel isn't supported yet — it's planned for the desktop " +
      "(Electron) build via an embedded browser. For now, paste individual Douyin video " +
      "URLs (douyin.com/video/…) with Cookies set to “From browser”."
    );
  }

  // Bilibili anti-crawler / risk-control (per-IP). Login cookies are the real fix.
  if (/http error 412|precondition failed|风控|risk.?control|请求过于频繁|-352|-799|-412/i.test(msg)) {
    return (
      "Bilibili blocked this network (anti-bot / risk-control). Best fix: LOG IN to " +
      "bilibili.com in your browser, then set Cookies = “From browser” (a logged-in session " +
      "passes risk-control and raises limits). If it persists, the IP is flagged — wait " +
      "15–60 min or switch network/VPN."
    );
  }

  if (/fresh cookies|sign in to confirm|not a bot|unable to extract.*render data/i.test(msg)) {
    return (
      "This content needs your browser cookies. Set Cookies (top-right) to “From browser”, " +
      "make sure you've opened the site in that browser recently, then scan again."
    );
  }

  if (/private|login required|members-?only|requires authentication|account.*(private|terminated)/i.test(msg)) {
    return "This content is private or requires login. Set cookies for a logged-in account, then retry.";
  }

  if (/unsupported url/i.test(msg)) {
    return (
      "This URL isn't supported by yt-dlp (or the site changed its URL scheme). " +
      "Double-check the link, or try a direct video URL."
    );
  }

  if (/unavailable|removed|deleted|not available/i.test(msg)) {
    return "This video/page is unavailable (removed, region-locked, or deleted).";
  }

  // Fall back to the last meaningful line of yt-dlp output.
  const lastLine = msg.split("\n").map((l) => l.trim()).filter(Boolean).pop();
  return lastLine?.slice(0, 400) ?? "Scan failed";
}
