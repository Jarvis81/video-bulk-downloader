import type { DownloadStatus, Platform } from "@vbd/shared";
import { platformLabel } from "@vbd/shared";

// Brand-ish dots that stay legible on both light and dark surfaces.
const PLATFORM_DOT: Record<Platform, string> = {
  youtube: "#ff3b30",
  tiktok: "#ff2d55",
  douyin: "#12b5c9",
  bilibili: "#fb7299",
  unknown: "var(--color-text-subtle)",
};

export function PlatformBadge({ platform }: { platform: Platform }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-[var(--color-text-muted)]">
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: PLATFORM_DOT[platform] }}
      />
      {platformLabel(platform)}
    </span>
  );
}

const STATUS: Record<DownloadStatus, { label: string; color: string }> = {
  idle: { label: "Idle", color: "var(--color-text-subtle)" },
  queued: { label: "Queued", color: "var(--color-warn)" },
  downloading: { label: "Downloading", color: "var(--color-accent)" },
  completed: { label: "Completed", color: "var(--color-ok)" },
  error: { label: "Error", color: "var(--color-danger)" },
  skipped: { label: "Skipped", color: "var(--color-text-subtle)" },
  canceled: { label: "Canceled", color: "var(--color-text-subtle)" },
};

export function StatusBadge({ status }: { status: DownloadStatus }) {
  const s = STATUS[status];
  return (
    <span className="text-xs font-semibold" style={{ color: s.color }}>
      {s.label}
    </span>
  );
}
