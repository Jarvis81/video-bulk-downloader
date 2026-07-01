"use client";

import { useState } from "react";
import { AlertCircle, Ban, Check, CheckCircle2, Clock, Copy, Loader2, RotateCw, Trash2, X } from "lucide-react";
import type { Scan } from "@vbd/shared";
import { PlatformBadge } from "./badges";
import { formatDate } from "@/lib/format";

interface Props {
  scans: Scan[];
  activeScanId: string | null;
  liveScanId: string | null;
  onSelect: (scanId: string) => void;
  onRescan: (scan: Scan) => void;
  onDelete: (scanId: string) => void;
  /** Scan currently being re-scanned / deleted (for spinner + dimming). */
  rescanningId: string | null;
  deletingId: string | null;
}

function shortTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function HistoryPanel({
  scans,
  activeScanId,
  liveScanId,
  onSelect,
  onRescan,
  onDelete,
  rescanningId,
  deletingId,
}: Props) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const copyLink = async (scan: Scan) => {
    try {
      await navigator.clipboard.writeText(scan.sourceUrl);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = scan.sourceUrl;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* ignore */
      }
      document.body.removeChild(ta);
    }
    setCopied(scan.id);
    window.setTimeout(() => setCopied((c) => (c === scan.id ? null : c)), 1500);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1.5 px-1.5 pb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-subtle)]">
        <Clock size={12} /> History
      </div>

      {scans.length === 0 ? (
        <p className="px-2 py-8 text-center text-[11px] text-[var(--color-text-subtle)]">
          No scans yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5 overflow-y-auto pr-0.5">
          {scans.map((s) => {
            const scanning = liveScanId === s.id || s.status === "scanning";
            const active = s.id === activeScanId;
            const deleting = deletingId === s.id;
            return (
              <li key={s.id}>
                <div
                  onClick={() => onSelect(s.id)}
                  title={`${s.sourceUrl}\n${formatDate(s.createdAt)}`}
                  className={`group relative w-full cursor-pointer rounded-[var(--radius)] border px-2.5 py-2 text-left transition ${
                    active
                      ? "border-[var(--color-accent)] bg-[var(--color-selected)]"
                      : "border-transparent bg-[var(--color-surface-2)] hover:border-[var(--color-border)]"
                  } ${deleting ? "pointer-events-none opacity-50" : ""}`}
                >
                  <div className="flex items-center gap-1.5">
                    {scanning ? (
                      <Loader2 size={12} className="shrink-0 animate-spin text-[var(--color-accent)]" />
                    ) : s.status === "error" ? (
                      <AlertCircle size={12} className="shrink-0 text-[var(--color-danger)]" />
                    ) : s.status === "canceled" ? (
                      <Ban size={12} className="shrink-0 text-[var(--color-text-subtle)]" />
                    ) : (
                      <CheckCircle2 size={12} className="shrink-0 text-[var(--color-ok)]" />
                    )}
                    <PlatformBadge platform={s.platform} />
                    <span className="mono ml-auto text-[10px] text-[var(--color-text-subtle)]">
                      {shortTime(s.createdAt)}
                    </span>

                    {confirming === s.id ? (
                      <span className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            onDelete(s.id);
                            setConfirming(null);
                          }}
                          title="Confirm delete"
                          className="icon-btn size-6 text-[var(--color-danger)]"
                        >
                          <Check size={13} />
                        </button>
                        <button
                          onClick={() => setConfirming(null)}
                          title="Keep"
                          className="icon-btn size-6"
                        >
                          <X size={13} />
                        </button>
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyLink(s);
                          }}
                          title="Copy scanned link"
                          className={`icon-btn size-6 transition group-hover:opacity-100 ${
                            copied === s.id ? "opacity-100" : "opacity-0"
                          }`}
                        >
                          {copied === s.id ? (
                            <Check size={13} className="text-[var(--color-ok)]" />
                          ) : (
                            <Copy size={13} />
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirming(s.id);
                          }}
                          title="Delete scan"
                          className="icon-btn size-6 opacity-0 transition hover:text-[var(--color-danger)] group-hover:opacity-100"
                        >
                          <Trash2 size={13} />
                        </button>
                      </span>
                    )}
                  </div>

                  <div className="mt-1.5 truncate text-[11px] font-medium text-[var(--color-text)]" title={s.sourceUrl}>
                    {s.sourceUrl.replace(/^https?:\/\/(www\.)?/, "")}
                  </div>
                  <div className="mono mt-0.5 text-[10px] text-[var(--color-text-subtle)]">
                    {scanning
                      ? "scanning…"
                      : s.status === "error"
                        ? "failed"
                        : `${s.status === "canceled" ? "stopped · " : ""}${s.sourceType} · ${
                            s.videoCount ?? 0
                          } videos`}
                  </div>

                  {active && !scanning && confirming !== s.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRescan(s);
                      }}
                      disabled={rescanningId === s.id}
                      title="Run this scan again"
                      className="mt-2 inline-flex items-center gap-1 rounded-full bg-[var(--color-surface)] px-2.5 py-1 text-[10px] font-semibold text-[var(--color-accent)] transition hover:bg-[var(--color-accent-soft)] disabled:opacity-50"
                    >
                      {rescanningId === s.id ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <RotateCw size={11} />
                      )}
                      Re-scan
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
