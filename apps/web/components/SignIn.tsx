"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, LogIn, Loader2 } from "lucide-react";
import type { Job, Platform } from "@vbd/shared";
import { platformLabel } from "@vbd/shared";
import { updateJob } from "@/lib/api";

const PLATFORMS: Platform[] = ["bilibili", "douyin", "tiktok", "youtube"];

/**
 * Electron-only: per-platform "Sign in" that opens an embedded login window,
 * captures the session cookies into a cookies.txt, and switches the job to file
 * mode. Renders nothing in the plain web app.
 */
export function SignIn({ job }: { job: Job }) {
  const qc = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState<Platform | null>(null);
  const [done, setDone] = useState<Platform | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);
  if (!mounted || !window.electronAPI) return null;

  const login = async (p: Platform) => {
    setBusy(p);
    setError(null);
    try {
      const { path, loggedIn } = await window.electronAPI!.login(p);
      if (path && loggedIn) {
        // Real session cookie captured → switch to file mode and show ✓.
        await updateJob(job.id, { cookieMode: "file", cookieFilePath: path });
        qc.invalidateQueries({ queryKey: ["workspace"] });
        setDone(p);
      } else if (path) {
        // Got cookies but no logged-in session → still use them (helps anti-bot)
        // but don't claim success: the user likely closed before finishing login.
        await updateJob(job.id, { cookieMode: "file", cookieFilePath: path });
        qc.invalidateQueries({ queryKey: ["workspace"] });
        setError(`No signed-in session for ${platformLabel(p)} — finish logging in, then close the window.`);
      } else {
        setError(`No cookies captured for ${platformLabel(p)} (did you log in?)`);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
      <span className="inline-flex items-center gap-1">
        <LogIn size={13} /> Sign in:
      </span>
      {PLATFORMS.map((p) => {
        const signedIn = done === p;
        return (
          <button
            key={p}
            onClick={() => login(p)}
            disabled={busy !== null}
            title={`Open ${platformLabel(p)} login — log in, then close that window`}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium transition disabled:opacity-50 ${
              signedIn
                ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                : "bg-[var(--color-surface-2)] text-[var(--color-text)] hover:bg-[var(--color-border)]"
            }`}
          >
            {busy === p ? (
              <Loader2 size={11} className="animate-spin" />
            ) : signedIn ? (
              <Check size={12} />
            ) : null}
            {platformLabel(p)}
          </button>
        );
      })}
      {error && <span className="text-[var(--color-danger)]">{error}</span>}
    </div>
  );
}
