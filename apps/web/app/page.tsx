"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Clock, Download, FolderOpen, Loader2, Search } from "lucide-react";
import type { DownloadStatus, Scan, ServerEvent, Video } from "@vbd/shared";
import { platformLabel } from "@vbd/shared";
import {
  abortScan,
  cancelDownload,
  cancelScan,
  deleteScan,
  getCooldowns,
  getScan,
  getWorkspace,
  pickFolder,
  retryDownload,
  scanJob,
  startDownload,
  updateJob,
} from "@/lib/api";
import { useJobStream } from "@/hooks/useJobStream";
import { Sidebar } from "@/components/Sidebar";
import { QualitySelector } from "@/components/QualitySelector";
import { SignIn } from "@/components/SignIn";
import { VideoList } from "@/components/VideoList";
import { HistoryPanel } from "@/components/HistoryPanel";

type StatusFilter = "all" | "pending" | "active" | "completed" | "failed";

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "active", label: "Active" },
  { key: "completed", label: "Done" },
  { key: "failed", label: "Failed" },
];

function matchesFilter(status: DownloadStatus, f: StatusFilter): boolean {
  switch (f) {
    case "pending":
      return status === "idle";
    case "active":
      return status === "downloading" || status === "queued";
    case "completed":
      return status === "completed";
    case "failed":
      return status === "error" || status === "canceled";
    default:
      return true;
  }
}

export default function WorkspacePage() {
  const qc = useQueryClient();
  const wsQuery = useQuery({ queryKey: ["workspace"], queryFn: getWorkspace });
  const cooldownsQuery = useQuery({
    queryKey: ["cooldowns"],
    queryFn: getCooldowns,
    refetchInterval: 8000,
  });
  const cooldowns = cooldownsQuery.data ?? [];
  const job = wsQuery.data?.job;
  const jobId = job?.id ?? null;
  const scans: Scan[] = wsQuery.data?.scans ?? [];

  const [url, setUrl] = useState("");
  const [limit, setLimit] = useState("");
  const [activeScanId, setActiveScanId] = useState<string | null>(null);
  const [liveScanId, setLiveScanId] = useState<string | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scanFound, setScanFound] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const activeScanRef = useRef<string | null>(null);

  const scanQuery = useQuery({
    queryKey: ["scan", activeScanId],
    queryFn: () => getScan(activeScanId as string),
    enabled: !!activeScanId && activeScanId !== liveScanId,
  });

  useEffect(() => {
    if (!activeScanId && scans.length > 0) selectScan(scans[0]!.id, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scans, activeScanId]);

  useEffect(() => {
    if (scanQuery.data && scanQuery.data.scan.id === activeScanId) {
      setVideos(scanQuery.data.videos);
    }
  }, [scanQuery.data, activeScanId]);

  function selectScan(scanId: string, live: string | null = liveScanId) {
    // Already viewing this scan → keep its list; re-clicking shouldn't unload it.
    if (scanId === activeScanRef.current) return;
    activeScanRef.current = scanId;
    setActiveScanId(scanId);
    if (scanId !== live) setVideos([]);
    setSelected(new Set());
  }

  useJobStream(jobId, (e: ServerEvent) => {
    switch (e.type) {
      case "scan:started":
        activeScanRef.current = e.scan.id;
        setActiveScanId(e.scan.id);
        setLiveScanId(e.scan.id);
        setVideos([]);
        setSelected(new Set());
        setScanFound(0);
        qc.invalidateQueries({ queryKey: ["workspace"] });
        break;
      case "scan:progress":
        if (e.scanId === activeScanRef.current) setScanFound(e.found);
        break;
      case "video:added":
        if (e.video.scanId === activeScanRef.current)
          setVideos((prev) =>
            prev.some((v) => v.id === e.video.id) ? prev : [...prev, e.video],
          );
        break;
      case "scan:done":
      case "scan:error":
        setLiveScanId(null);
        qc.invalidateQueries({ queryKey: ["workspace"] });
        if (e.type === "scan:done") qc.invalidateQueries({ queryKey: ["scan", e.scan.id] });
        break;
      case "download:progress":
        setVideos((prev) =>
          prev.map((v) =>
            v.id === e.videoId ? { ...v, progress: e.progress, speed: e.speed, eta: e.eta } : v,
          ),
        );
        break;
      case "video:status":
        setVideos((prev) => prev.map((v) => (v.id === e.video.id ? e.video : v)));
        if (["completed", "error", "canceled"].includes(e.video.downloadStatus))
          qc.invalidateQueries({ queryKey: ["workspace"] });
        break;
    }
  });

  // Fallback: if an SSE terminal event is ever missed, poll the live scan so the
  // "scanning…" state always resolves and the final list loads.
  useEffect(() => {
    if (!liveScanId) return;
    const t = setInterval(async () => {
      try {
        const { scan } = await getScan(liveScanId);
        if (scan.status === "done" || scan.status === "error") {
          setLiveScanId(null);
          qc.invalidateQueries({ queryKey: ["workspace"] });
          qc.invalidateQueries({ queryKey: ["scan", liveScanId] });
        }
      } catch {
        /* ignore transient errors */
      }
    }, 3000);
    return () => clearInterval(t);
  }, [liveScanId, qc]);

  /* -------------------------------- actions -------------------------------- */
  // Switch the view to a freshly-started scan (shared by Scan + Re-scan) so the
  // loading state shows instantly, even before the first SSE frame arrives.
  function applyNewScan(scanRow: Scan) {
    activeScanRef.current = scanRow.id;
    setActiveScanId(scanRow.id);
    setLiveScanId(scanRow.id);
    setVideos([]);
    setSelected(new Set());
    setScanFound(0);
    qc.invalidateQueries({ queryKey: ["workspace"] });
  }

  const scan = useMutation({
    mutationFn: () => scanJob(jobId as string, url.trim(), limit ? Number(limit) : undefined),
    onSuccess: (scanRow) => {
      setUrl("");
      applyNewScan(scanRow);
    },
  });

  // Re-run a past scan's URL (from a History card).
  const rescan = useMutation({
    mutationFn: (s: Scan) => scanJob(jobId as string, s.sourceUrl, limit ? Number(limit) : undefined),
    onSuccess: (scanRow) => applyNewScan(scanRow),
  });

  // Delete a past scan (and its videos).
  const del = useMutation({
    mutationFn: (scanId: string) => deleteScan(scanId),
    onSuccess: (_d, scanId) => {
      if (scanId === liveScanId) setLiveScanId(null);
      if (scanId === activeScanRef.current) {
        // Cleared the active scan → drop the view; the auto-select effect picks
        // the next remaining scan after the workspace refetches.
        activeScanRef.current = null;
        setActiveScanId(null);
        setVideos([]);
        setSelected(new Set());
      }
      qc.invalidateQueries({ queryKey: ["workspace"] });
    },
  });

  const abort = useMutation({
    mutationFn: () => abortScan(activeScanId as string),
    onSuccess: () => {
      // Resolve the scanning state immediately; the scan:done SSE/poll follows.
      setLiveScanId(null);
      qc.invalidateQueries({ queryKey: ["workspace"] });
      if (activeScanId) qc.invalidateQueries({ queryKey: ["scan", activeScanId] });
    },
  });

  async function ensureFolder(): Promise<string | null> {
    if (job?.defaultFolder) return job.defaultFolder;
    const { path } = await pickFolder();
    if (path) {
      await updateJob(jobId as string, { defaultFolder: path });
      qc.invalidateQueries({ queryKey: ["workspace"] });
    }
    return path;
  }

  async function changeFolder() {
    const { path } = await pickFolder(job?.defaultFolder ?? undefined);
    if (path) {
      await updateJob(jobId as string, { defaultFolder: path });
      qc.invalidateQueries({ queryKey: ["workspace"] });
    }
  }

  const download = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) throw new Error("Select at least one video");
      const folder = await ensureFolder();
      if (!folder) return;
      await startDownload(jobId as string, ids, folder);
    },
  });

  /* ------------------------------- derived --------------------------------- */
  const activeScan = scans.find((s) => s.id === activeScanId);
  const isScanning =
    (liveScanId !== null && liveScanId === activeScanId) || activeScan?.status === "scanning";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return videos.filter(
      (v) =>
        matchesFilter(v.downloadStatus, statusFilter) &&
        (!q ||
          v.title.toLowerCase().includes(q) ||
          (v.uploader ?? "").toLowerCase().includes(q)),
    );
  }, [videos, search, statusFilter]);

  const counts = useMemo(() => {
    let done = 0;
    let failed = 0;
    for (const v of videos) {
      if (v.downloadStatus === "completed") done++;
      else if (v.downloadStatus === "error") failed++;
    }
    return { total: videos.length, done, failed };
  }, [videos]);

  const selectedCount = useMemo(
    () => videos.filter((v) => selected.has(v.id)).length,
    [videos, selected],
  );

  // Active downloads in the CURRENT scan only (cancel is scoped to this view).
  const hasActive = useMemo(
    () =>
      videos.some(
        (v) => v.downloadStatus === "downloading" || v.downloadStatus === "queued",
      ),
    [videos],
  );

  const allFilteredSelected = filtered.length > 0 && filtered.every((v) => selected.has(v.id));
  const someFilteredSelected = filtered.some((v) => selected.has(v.id));

  function setSelectedForFiltered(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const v of filtered) checked ? next.add(v.id) : next.delete(v.id);
      return next;
    });
  }

  /* --------------------------------- render -------------------------------- */
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* header + scan */}
        <header className="shrink-0 px-5 pt-5 sm:px-7">
          <div className="mx-auto w-full max-w-[1380px]">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-[22px] font-extrabold tracking-tight">Jerry Vids Downloader</h1>
                <p className="mt-0.5 text-[var(--color-text-muted)]">
                  Paste a channel or video link — every clip, one click.
                </p>
              </div>
              {job?.defaultFolder && (
                <button
                  onClick={changeFolder}
                  className="btn btn-soft max-w-full px-3 py-2 text-xs"
                  title="Change download folder"
                >
                  <FolderOpen size={14} className="shrink-0" />
                  <span className="truncate">{job.defaultFolder}</span>
                </button>
              )}
            </div>

            {/* scan card */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (jobId) scan.mutate();
              }}
              className="card flex flex-wrap items-center gap-2 p-2 sm:flex-nowrap"
            >
              <div className="relative min-w-[200px] flex-1">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-subtle)]"
                />
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste a channel URL (lists all videos) or a single video URL"
                  className="input w-full bg-transparent pl-9"
                />
              </div>
              <input
                value={limit}
                onChange={(e) => setLimit(e.target.value.replace(/\D/g, ""))}
                placeholder="Max"
                title="Max videos to list (blank = all)"
                className="input mono w-20 text-center"
              />
              <button
                type="submit"
                disabled={scan.isPending || !url.trim() || !jobId}
                className="btn btn-accent px-5 py-2.5"
              >
                {scan.isPending || isScanning ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Search size={15} />
                )}
                Scan
              </button>
              {isScanning && (
                <button
                  type="button"
                  onClick={() => activeScanId && abort.mutate()}
                  disabled={abort.isPending}
                  title="Stop scanning (keeps videos found so far)"
                  className="btn btn-danger px-4 py-2.5"
                >
                  <Ban size={15} /> Stop
                </button>
              )}
            </form>

            {/* settings strip */}
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--color-text-muted)]">
              {job && <QualitySelector job={job} />}
              {job && <SignIn job={job} />}
              {!job?.defaultFolder && (
                <button
                  onClick={changeFolder}
                  className="inline-flex items-center gap-1 hover:text-[var(--color-text)]"
                >
                  <FolderOpen size={13} /> Choose folder… (asked on first download)
                </button>
              )}
              {scan.error && (
                <span className="text-[var(--color-danger)]">{(scan.error as Error).message}</span>
              )}
            </div>
          </div>
        </header>

        {/* cooldown banner */}
        {cooldowns.length > 0 && (
          <div className="px-5 pt-3 sm:px-7">
            <div className="mx-auto w-full max-w-[1380px]">
              <div
                className="flex items-center gap-2 rounded-[var(--radius)] border px-3 py-2 text-xs"
                style={{
                  color: "var(--color-warn)",
                  borderColor: "color-mix(in srgb, var(--color-warn) 35%, transparent)",
                  backgroundColor: "color-mix(in srgb, var(--color-warn) 12%, transparent)",
                }}
              >
                <Clock size={14} className="shrink-0" />
                <span className="font-semibold">
                  {cooldowns
                    .map((c) => `${platformLabel(c.platform)} paused ~${Math.ceil(c.remainingMs / 60000)}m`)
                    .join(" · ")}
                </span>
                <span className="opacity-80">
                  — rate-limited; queued downloads resume automatically.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* main + history */}
        <div className="mx-auto flex min-h-0 w-full max-w-[1380px] flex-1 gap-5 px-5 pb-5 pt-3 sm:px-7">
          {/* main card */}
          <main className="card flex min-w-0 flex-1 flex-col overflow-hidden">
            {/* toolbar */}
            <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] px-3.5 py-2.5">
              <input
                type="checkbox"
                ref={(el) => {
                  if (el) el.indeterminate = someFilteredSelected && !allFilteredSelected;
                }}
                checked={allFilteredSelected}
                onChange={(e) => setSelectedForFiltered(e.target.checked)}
                className="size-3.5 accent-[var(--color-accent)]"
                title="Select all (filtered)"
              />
              <span className="mono text-xs text-[var(--color-text-muted)]">
                {selectedCount}/{counts.total}
              </span>
              <span className="hidden text-[11px] text-[var(--color-text-subtle)] sm:inline">
                · {counts.done} done{counts.failed ? ` · ${counts.failed} failed` : ""}
              </span>
              <div className="ml-1 flex items-center gap-1.5 text-[11px]">
                <button
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  onClick={() => setSelected(new Set())}
                >
                  None
                </button>
                <span className="text-[var(--color-border)]">|</span>
                <button
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  title="Select all not-yet-downloaded"
                  onClick={() =>
                    setSelected(
                      new Set(
                        filtered.filter((v) => v.downloadStatus !== "completed").map((v) => v.id),
                      ),
                    )
                  }
                >
                  Not done
                </button>
              </div>

              <div className="relative ml-2">
                <Search
                  size={12}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-subtle)]"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter…"
                  className="input w-40 py-1.5 pl-7 text-xs"
                />
              </div>

              <div className="flex items-center gap-1">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setStatusFilter(f.key)}
                    className={`chip px-2.5 py-1 text-[11px] font-medium ${
                      statusFilter === f.key ? "chip-active" : ""
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="ml-auto flex items-center gap-2">
                {hasActive && (
                  <button
                    onClick={() => activeScanId && cancelScan(activeScanId)}
                    title="Cancel queued + in-progress downloads in this scan"
                    className="btn btn-danger px-3 py-2 text-xs"
                  >
                    <Ban size={14} /> Cancel
                  </button>
                )}
                <button
                  onClick={() =>
                    download.mutate(videos.filter((v) => selected.has(v.id)).map((v) => v.id))
                  }
                  disabled={download.isPending || selectedCount === 0}
                  className="btn btn-accent px-4 py-2 text-xs"
                >
                  {download.isPending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Download size={14} />
                  )}
                  Download{selectedCount > 0 ? ` (${selectedCount})` : ""}
                </button>
              </div>
            </div>

            {(download.error || activeScan?.status === "error") && (
              <div className="border-b border-[var(--color-border)] px-3.5 py-1.5 text-xs text-[var(--color-danger)]">
                {download.error
                  ? (download.error as Error).message
                  : `Scan failed: ${activeScan?.error}`}
              </div>
            )}

            {/* scrollable list */}
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {isScanning && videos.length === 0 ? (
                <div
                  className="flex h-full items-center justify-center gap-2 text-sm"
                  style={{ color: "var(--color-accent)" }}
                >
                  <Loader2 size={16} className="animate-spin" /> Scanning…{" "}
                  <span className="mono">{scanFound}</span> found
                </div>
              ) : (
                <>
                  {isScanning && (
                    <div
                      className="mb-2 flex items-center gap-2 rounded-[var(--radius)] bg-[var(--color-accent-soft)] px-3 py-1.5 text-xs"
                      style={{ color: "var(--color-accent)" }}
                    >
                      <Loader2 size={13} className="animate-spin" /> Scanning…{" "}
                      <span className="mono">{scanFound}</span> found — select &amp; download, or press Stop
                    </div>
                  )}
                  <VideoList
                    videos={filtered}
                    selected={selected}
                    onToggle={(vid) =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        next.has(vid) ? next.delete(vid) : next.add(vid);
                        return next;
                      })
                    }
                    onCancel={(vid) => cancelDownload(vid)}
                    onRetry={(vid) => retryDownload(vid)}
                    onDownloadOne={(vid) => download.mutate([vid])}
                  />
                </>
              )}
            </div>
          </main>

          {/* history */}
          <aside className="hidden w-72 shrink-0 md:flex">
            <div className="card flex w-full flex-col overflow-hidden p-2">
              <HistoryPanel
                scans={scans}
                activeScanId={activeScanId}
                liveScanId={liveScanId}
                onSelect={(id) => selectScan(id)}
                onRescan={(s) => rescan.mutate(s)}
                onDelete={(id) => del.mutate(id)}
                rescanningId={rescan.isPending ? (rescan.variables as Scan).id : null}
                deletingId={del.isPending ? (del.variables as string) : null}
              />
            </div>
          </aside>
        </div>

        {wsQuery.error && (
          <p className="px-7 pb-2 text-xs text-[var(--color-danger)]">
            Cannot reach the backend ({(wsQuery.error as Error).message}). Is the server running on
            port 4319?
          </p>
        )}
      </div>
    </div>
  );
}
