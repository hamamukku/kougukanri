"use client";

import { useRouter } from "next/navigation";
import { clearAuthSession } from "../../src/utils/auth";

export default function LogoutButton() {
  const router = useRouter();

  const onLogout = () => {
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
