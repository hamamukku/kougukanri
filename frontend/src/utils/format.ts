export type ToolDisplayStatus = "AVAILABLE" | "LOANED" | "RESERVED" | "BROKEN" | "REPAIR";

export function statusLabel(status: string) {
  switch (status) {
    case "AVAILABLE":
      return "貸出可";
    case "LOANED":
      return "貸出中";
    case "RESERVED":
      return "予約中";
    case "BROKEN":
      return "故障";
    case "REPAIR":
      return "修理中";
    default:
      return status;
  }
}

export function formatDateJa(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("ja-JP");
}
