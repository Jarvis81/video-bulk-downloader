"use client";

/**
 * Floating "buy me a coffee" button pinned to the bottom-right corner. Hovering it
 * reveals a popup with a bank-transfer QR so users can donate. Pure CSS hover; the
 * popup wrapper's padding bridges the gap to the button so it doesn't flicker.
 */
export function BuyMeCoffee() {
  return (
    <div className="group fixed bottom-4 right-4 z-50">
      <div className="pointer-events-none absolute bottom-full right-0 pb-2 opacity-0 transition duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
        <div className="card w-[220px] p-3 text-center">
          <p className="mb-2 text-xs font-semibold text-[var(--color-text)]">Buy me a coffee ☕</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/BuyMeCoffee.png"
            alt="Bank transfer QR code"
            className="w-full rounded-[10px]"
          />
          <p className="mt-2 text-[11px] leading-snug text-[var(--color-text-muted)]">
            Support me if this tool brings you value 💋
          </p>
        </div>
      </div>

      <button
        type="button"
        aria-label="Buy me a coffee"
        title="Buy me a coffee"
        className="grid size-11 place-items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-lg shadow-[var(--shadow-pop)] transition hover:scale-105"
      >
        ☕
      </button>
    </div>
  );
}
