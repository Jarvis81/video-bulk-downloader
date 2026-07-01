"use client";

import { Download, Loader2, RotateCw, X } from "lucide-react";
import type { Video } from "@vbd/shared";
import { Thumb } from "./Thumb";
import { PlatformBadge, StatusBadge } from "./badges";
import { formatBytes } from "@/lib/format";

interface Props {
  videos: Video[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onDownloadOne: (id: string) => void;
}

export function VideoList({
  videos,
  selected,
  onToggle,
  onCancel,
  onRetry,
  onDownloadOne,
}: Props) {
  if (videos.length === 0) {
    return (
      <p className="px-4 py-12 text-center text-xs text-[var(--color-text-subtle)]">
        No videos yet. Paste a channel or video URL above and click Scan.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1">
      {videos.map((v) => {
        const active = v.downloadStatus === "downloading" || v.downloadStatus === "queued";
        const processing = active || v.downloadStatus === "converting";
        const isSel = selected.has(v.id) && !processing;
        return (
          <li
            key={v.id}
            className={`flex items-center gap-3 rounded-[var(--radius)] px-2.5 py-2 transition ${
              isSel ? "bg-[var(--color-selected)]" : "hover:bg-[var(--color-surface-2)]"
            }`}
          >
            <input
              type="checkbox"
              checked={isSel}
              disabled={processing}
              onChange={() => onToggle(v.id)}
              title={processing ? "Already processing" : undefined}
              className="size-3.5 shrink-0 accent-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-40"
            />
            <Thumb video={v} />

            <div className="min-w-0 flex-1">
              <a
                href={v.webpageUrl}
                target="_blank"
                rel="noreferrer"
                className="block truncate text-[13px] font-semibold leading-tight hover:text-[var(--color-accent)]"
                title={v.title}
              >
                {v.title}
              </a>
              <div className="mt-1 flex items-center gap-2">
                <PlatformBadge platform={v.platform} />
                {v.uploader && (
                  <span className="truncate text-[11px] text-[var(--color-text-muted)]">
                    {v.uploader}
                  </span>
                )}
              </div>

              {active && (
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-2)]">
                  <div
                    className="h-full rounded-full bg-[var(--color-accent)] transition-all"
                    style={{ width: `${Math.max(3, v.progress)}%` }}
                  />
                </div>
              )}
              {v.downloadStatus === "error" && v.error && (
                <div
                  className="mt-1 truncate text-[11px] text-[var(--color-danger)]"
                  title={v.error}
                >
                  {v.error}
                </div>
              )}
            </div>

            <div className="flex w-32 shrink-0 flex-col items-end leading-tight">
              <StatusBadge status={v.downloadStatus} />
              {v.downloadStatus === "downloading" ? (
                <span className="mono text-[10px] text-[var(--color-text-muted)]">
                  {v.progress.toFixed(0)}%{v.speed ? ` · ${v.speed}` : ""}
                  {v.eta ? ` · ${v.eta}` : ""}
                </span>
              ) : v.downloadStatus === "completed" && v.filesize ? (
                <span className="mono text-[10px] text-[var(--color-text-subtle)]">
                  {formatBytes(v.filesize)}
                </span>
              ) : null}
            </div>

            <div className="flex w-8 shrink-0 justify-end">
              {active ? (
                <button onClick={() => onCancel(v.id)} className="icon-btn size-7" title="Cancel">
                  <X size={15} />
                </button>
              ) : v.downloadStatus === "converting" ? (
                <span className="icon-btn size-7" title="Converting to H.264">
                  <Loader2 size={15} className="animate-spin" />
                </span>
              ) : v.downloadStatus === "error" || v.downloadStatus === "canceled" ? (
                <button onClick={() => onRetry(v.id)} className="icon-btn size-7" title="Retry">
                  <RotateCw size={15} />
                </button>
              ) : (
                <button
                  onClick={() => onDownloadOne(v.id)}
                  className="icon-btn size-7"
                  title={v.downloadStatus === "completed" ? "Download again" : "Download"}
                >
                  <Download size={15} />
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
