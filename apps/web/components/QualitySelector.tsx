"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings2 } from "lucide-react";
import { QUALITIES, type Job, type Quality } from "@vbd/shared";
import { updateJob } from "@/lib/api";

const field = "input py-1.5 text-xs";

export function QualitySelector({ job }: { job: Job }) {
  const qc = useQueryClient();
  const mutate = useMutation({
    mutationFn: (quality: Quality) => updateJob(job.id, { quality }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace"] }),
  });

  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
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
