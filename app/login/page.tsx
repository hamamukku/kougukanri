"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(
    () => searchParams.get("next") || "/tools",
    [searchParams]
  );

  const setCookie = (name: string, value: string) => {
    document.cookie = `${name}=${value}; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}; SameSite=Lax`;
  };

  const onLogin = (role: "user" | "admin", username: string) => {
    setCookie("auth", "1");
    setCookie("role", role);
    setCookie("username", encodeURIComponent(username));
    const to = nextPath.startsWith("/") ? nextPath : "/tools";
    router.push(to);
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>ログイン</h1>
      <div style={{ display: "grid", gap: 8 }}>
        <button type="button" onClick={() => onLogin("user", "一般ユーザー")}>
          一般ユーザーでログイン
        </button>
        <button type="button" onClick={() => onLogin("admin", "管理者")}>
          管理者でログイン
        </button>
      </div>
    </main>
  );
}
