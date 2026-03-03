"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

export default function LoginPage() {
  const router = useRouter();
  const [nextPath] = useState(() => {
    if (typeof window === "undefined") return "";
    const query = new URLSearchParams(window.location.search);
    const raw = query.get("next") || "";
    return raw.startsWith("/") ? raw : "";
  });

  const setCookie = (name: string, value: string) => {
    document.cookie = `${name}=${value}; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}; SameSite=Lax`;
  };

  const onLogin = (role: "user" | "admin", username: string) => {
    setCookie("auth", "1");
    setCookie("role", role);
    setCookie("username", encodeURIComponent(username));
    const fallbackPath = role === "admin" ? "/admin/returns" : "/tools";
    router.push(nextPath || fallbackPath);
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
      }}
    >
      <div style={{ width: 320, maxWidth: "90vw", display: "grid", gap: 12, textAlign: "center" }}>
        <h1>ログイン</h1>
        <button
          type="button"
          onClick={() => onLogin("user", "user")}
          style={{ width: "100%", height: 40 }}
        >
          一般ユーザーでログイン
        </button>
        <button
          type="button"
          onClick={() => onLogin("admin", "admin")}
          style={{ width: "100%", height: 40 }}
        >
          管理者でログイン
        </button>
        <Link href="/signup-request">
          <button type="button" style={{ width: "100%", height: 40 }}>
            アカウント作成申請
          </button>
        </Link>
      </div>
    </main>
  );
}
