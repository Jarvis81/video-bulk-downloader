import { BrowserWindow } from "electron";
import type { ChannelEnumerator, ScanEntry } from "@vbd/server";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const POST_API = /\/aweme\/v1\/web\/aweme\/post\//;
const SCROLL_PAUSE_MS = 1800;
const MAX_ROUNDS = 100;
const STAGNANT_LIMIT = 4; // stop after this many scrolls with no new videos

function secUidFromUrl(url: string): string | null {
  const m = url.match(/douyin\.com\/user\/([^/?#]+)/);
  return m?.[1] ?? null;
}

function toEntry(a: any): ScanEntry | null {
  const id = String(a?.aweme_id ?? "");
  if (!id) return null;
  return {
    sourceId: id,
    title: String(a?.desc || id).replace(/\s+/g, " ").trim() || id,
    webpageUrl: `https://www.douyin.com/video/${id}`,
    thumbnailUrl: a?.video?.cover?.url_list?.[0] ?? a?.video?.origin_cover?.url_list?.[0] ?? null,
    duration: typeof a?.video?.duration === "number" ? Math.round(a.video.duration / 1000) : null,
    uploader: a?.author?.nickname ?? null,
    platform: "douyin",
  };
}

/**
 * Enumerate a Douyin user's videos by loading the page in a hidden window (with
 * the app's logged-in session) and intercepting its own `/aweme/.../post/` API
 * responses via the Chrome DevTools Protocol, auto-scrolling to paginate.
 */
export function createDouyinEnumerator(): ChannelEnumerator {
  return (url, _cookies, onEntry, limit) => {
    let canceled = false;
    let win: BrowserWindow | null = null;

    const promise = (async (): Promise<{ count: number }> => {
      const secUid = secUidFromUrl(url);
      if (!secUid) throw new Error("Not a Douyin user URL");

      win = new BrowserWindow({ show: false, width: 1100, height: 900 });
      const dbg = win.webContents.debugger;
      const seen = new Set<string>();
      let index = 0;
      const max = limit && limit > 0 ? limit : 2000;
      const matchedRequests = new Set<string>();

      const handleBody = async (requestId: string) => {
        try {
          const { body, base64Encoded } = (await dbg.sendCommand("Network.getResponseBody", {
            requestId,
          })) as { body: string; base64Encoded: boolean };
          const text = base64Encoded ? Buffer.from(body, "base64").toString("utf8") : body;
          const json = JSON.parse(text);
          for (const a of json?.aweme_list ?? []) {
            const entry = toEntry(a);
            if (!entry || seen.has(entry.sourceId) || index >= max) continue;
            seen.add(entry.sourceId);
            onEntry(entry, index++);
          }
        } catch {
          /* ignore unreadable/non-JSON bodies */
        }
      };

      dbg.on("message", (_e, method, params: any) => {
        if (method === "Network.responseReceived" && POST_API.test(params?.response?.url ?? "")) {
          matchedRequests.add(params.requestId);
        } else if (method === "Network.loadingFinished" && matchedRequests.has(params?.requestId)) {
          matchedRequests.delete(params.requestId);
          void handleBody(params.requestId);
        }
      });

      dbg.attach("1.3");
      await dbg.sendCommand("Network.enable");
      await win.loadURL(`https://www.douyin.com/user/${secUid}`);

      let stagnant = 0;
      for (let round = 0; round < MAX_ROUNDS && !canceled && index < max; round++) {
        const before = index;
        await win.webContents
          .executeJavaScript("window.scrollTo(0, document.body.scrollHeight); true")
          .catch(() => {});
        await sleep(SCROLL_PAUSE_MS);
        stagnant = index === before ? stagnant + 1 : 0;
        if (stagnant >= STAGNANT_LIMIT) break;
      }

      if (index === 0) {
        throw new Error(
          "No Douyin videos captured — sign in to Douyin (Sign in button) and try again.",
        );
      }
      return { count: index };
    })();

    return {
      promise,
      cancel: () => {
        canceled = true;
        try {
          win?.destroy();
        } catch {
          /* ignore */
        }
      },
    };
  };
}
