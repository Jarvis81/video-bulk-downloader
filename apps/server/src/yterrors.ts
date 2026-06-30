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
      "Couldn't read login cookies for this site. Use “Sign in” (in the settings bar), " +
      "finish logging in, then scan again."
    );
  }

  // Douyin has no user/channel extractor in yt-dlp.
  if (/unsupported url/i.test(msg) && ctx.platform === "douyin" && ctx.sourceType === "channel") {
    return (
      "Couldn't list this Douyin channel. Make sure you're signed in: click “Sign in: Douyin”, " +
      "finish logging in, then scan again."
    );
  }

  // Bilibili anti-crawler / risk-control (per-IP). Login cookies are the real fix.
  if (/http error 412|precondition failed|风控|risk.?control|请求过于频繁|-352|-799|-412/i.test(msg)) {
    return (
      "Bilibili blocked this network (anti-bot / risk-control). Best fix: click “Sign in: Bilibili”, " +
      "finish logging in, then scan again (a logged-in session passes risk-control). If it persists, " +
      "the IP is flagged — wait 15–60 min or switch network/VPN."
    );
  }

  if (/fresh cookies|sign in to confirm|not a bot|unable to extract.*render data/i.test(msg)) {
    return (
      "This content needs you to be signed in. Use “Sign in” (in the settings bar), finish " +
      "logging in, then scan again."
    );
  }

  if (/private|login required|members-?only|requires authentication|account.*(private|terminated)/i.test(msg)) {
    return "This content is private or requires login. Use “Sign in” for that platform, then retry.";
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
