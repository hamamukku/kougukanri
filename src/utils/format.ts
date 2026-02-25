export function statusLabel(status: string) {
  switch (status) {
    case "available":
      return "貸出可";
    case "loaned":
      return "貸出中";
    case "repairing":
      return "修理中";
    case "lost":
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