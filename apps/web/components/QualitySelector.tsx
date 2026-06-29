"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings2 } from "lucide-react";
import { QUALITIES, type Job, type Quality } from "@vbd/shared";
import { updateJob } from "@/lib/api";

const field =
  "rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-xs outline-none focus:border-indigo-500";

export function QualitySelector({ job }: { job: Job }) {
  const qc = useQueryClient();
  const mutate = useMutation({
    mutationFn: (quality: Quality) => updateJob(job.id, { quality }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace"] }),
  });

  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-slate-400">
      <Settings2 size={13} /> Quality:
      <select
        value={job.quality}
        onChange={(e) => mutate.mutate(e.target.value as Quality)}
        className={field}
        title="Applies to new downloads"
      >
        {QUALITIES.map((q) => (
          <option key={q.value} value={q.value}>
            {q.label}
          </option>
        ))}
      </select>
    </label>
  );
}
