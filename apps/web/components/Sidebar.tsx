"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { getYtDlpVersion, updateYtDlp } from "@/lib/api";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Slim left navigation rail: brand mark on top; theme toggle and yt-dlp updater
 * pinned to the bottom.
 */
export function Sidebar() {
  const versionQuery = useQuery({ queryKey: ["ytdlp-version"], queryFn: getYtDlpVersion });
  const update = useMutation({
    mutationFn: updateYtDlp,
    onSettled: () => versionQuery.refetch(),
  });
  const v = versionQuery.data;

  return (
    <aside className="flex w-[68px] shrink-0 flex-col items-center gap-3 py-5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="Jerry Vids Downloader"
        title="Jerry Vids Downloader"
        className="size-11 rounded-full bg-white object-cover shadow-[var(--shadow-card)]"
      />
      <div className="h-px w-7 bg-[var(--color-border)]" />

      <div className="mt-auto flex flex-col items-center gap-2">
        <button
          onClick={() => update.mutate()}
          disabled={update.isPending || !v?.available}
          title={
            v?.available
              ? `yt-dlp ${v.version ?? "?"} — click to update`
              : "yt-dlp not found — run `pnpm setup`"
          }
          className="rail-item relative size-10"
          aria-label="Update yt-dlp"
        >
          <RefreshCw size={17} className={update.isPending ? "animate-spin" : ""} />
          {v && !v.available && (
            <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-[var(--color-warn)]" />
          )}
        </button>
        <ThemeToggle />
      </div>
    </aside>
  );
}
