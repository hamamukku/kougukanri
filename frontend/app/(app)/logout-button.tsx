"use client";

import { useRouter } from "next/navigation";
import { clearAuthSession } from "../../src/utils/auth";
import { useLoanBox } from "../../src/state/loanBoxStore";

export default function LogoutButton() {
  const router = useRouter();
  const { selectedToolIds, clearSelection } = useLoanBox();

  const onLogout = () => {
    if (selectedToolIds.size > 0) {
      const confirmed = window.confirm(
        "チェック中の工具があります。ログアウトするとチェック状態は保存されません。ログアウトしますか？",
      );
      if (!confirmed) return;
    }

    clearSelection();
    clearAuthSession();
    router.push("/login");
    router.refresh();
  };

  return (
    <button type="button" onClick={onLogout}>
      ログアウト
    </button>
  );
}
