export function statusLabel(status: string) {
  switch (status.trim().toUpperCase()) {
    case "AVAILABLE":
      return "貸出可";
    case "LOANED":
      return "貸出中";
    case "RESERVED":
      return "予約中";
    case "REPAIRING":
    case "REPAIR":
      return "修理中";
    case "LOST":
    case "BROKEN":
      return "紛失";
    default:
      return status;
  }
}

export function formatDateJa(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("ja-JP");
}

export function getCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}
