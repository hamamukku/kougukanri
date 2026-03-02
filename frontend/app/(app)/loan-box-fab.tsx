"use client";

import { usePathname, useRouter } from "next/navigation";
import { useLoanBox } from "../../src/state/loanBoxStore";

const visiblePaths = ["/tools", "/loan-box", "/my-loans"];

export default function LoanBoxFab() {
  const pathname = usePathname();
  const router = useRouter();
  const { selectedToolIds } = useLoanBox();
  const count = selectedToolIds.size;

  const visible = visiblePaths.some((base) => pathname === base || pathname.startsWith(`${base}/`));
  if (!visible) return null;

  return (
    <button
      type="button"
      className="loan-box-fab"
      aria-label="貸出ボックスへ移動"
      onClick={() => router.push("/loan-box")}
    >
      カゴ
      <span className="loan-box-fab-badge">{count}</span>
    </button>
  );
}
