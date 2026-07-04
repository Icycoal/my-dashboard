// Shared class strings for the app's design language.
// Surfaces are hairline-bordered glass over the ink background; the primary
// action is white, secondary actions are ghost, accents use `blue` (iris).

export const card = "rounded-2xl border border-white/[0.06] bg-gray-900/60 shadow";

export const cardPad = `${card} p-5`;

export const input =
  "rounded-lg border border-white/[0.08] bg-gray-950/60 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 transition-colors focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/15";

export const btnPrimary =
  "rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-950 transition-colors hover:bg-gray-100 disabled:opacity-50";

export const btnGhost =
  "rounded-lg border border-white/[0.08] px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-white/5 hover:text-gray-100";

export const btnAccent =
  "text-sm font-medium text-blue-400 transition-colors hover:text-blue-300";

export const pageTitle = "font-display text-2xl font-semibold tracking-tight text-gray-50";

export const pageSubtitle = "mt-1 text-sm text-gray-500";

export const sectionLabel =
  "text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500";

export const listCard = `${card} divide-y divide-white/[0.05] overflow-hidden`;

// Recharts theme values (inline styles can't use Tailwind classes)
export const chart = {
  grid: "rgba(255,255,255,0.05)",
  axis: "#69718a",
  tick: "#97a0b5",
  line: "#666eff",
  area: "rgba(102,110,255,0.15)",
  tooltip: {
    backgroundColor: "rgba(17,20,29,0.95)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "10px",
    boxShadow: "0 8px 24px -12px rgba(0,0,0,0.5)",
  },
  tooltipLabel: { color: "#dde1ea" },
  tooltipItem: { color: "#a7adff" },
} as const;
