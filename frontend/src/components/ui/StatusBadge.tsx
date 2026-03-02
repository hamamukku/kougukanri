"use client";

import { statusLabel } from "../../utils/format";

type Tone = {
  bg: string;
  border: string;
  color: string;
};

const toneMap: Record<string, Tone> = {
  AVAILABLE: { bg: "#dcfce7", border: "#86efac", color: "#166534" },
  LOANED: { bg: "#fef3c7", border: "#fcd34d", color: "#92400e" },
  RESERVED: { bg: "#dbeafe", border: "#93c5fd", color: "#1d4ed8" },
  BROKEN: { bg: "#fee2e2", border: "#fca5a5", color: "#991b1b" },
  REPAIR: { bg: "#e9d5ff", border: "#c4b5fd", color: "#6b21a8" },
};

function resolveTone(status: string): Tone {
  const key = status.trim().toUpperCase();
  return toneMap[key] ?? { bg: "#e2e8f0", border: "#cbd5e1", color: "#334155" };
}

export default function StatusBadge({ status }: { status: string }) {
  const tone = resolveTone(status);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 10px",
        borderRadius: 999,
        border: `1px solid ${tone.border}`,
        background: tone.bg,
        color: tone.color,
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1.5,
      }}
    >
      {statusLabel(status)}
    </span>
  );
}
