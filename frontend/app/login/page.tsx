// frontend/app/login/page.tsx
"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "../../src/components/ui/Button";
import Input from "../../src/components/ui/Input";
import { writeAuthSession, clearAuthSession } from "../../src/utils/auth";
import { apiFetchJson, getHttpErrorMessage } from "../../src/utils/http";

type LoginResponse = {
  token: string;
  role: "admin" | "user";
  userName: string;
};

type MeResponse = {
  role: "admin" | "user";
  userName: string;
};

export default function LoginPage() {
  const router = useRouter();

  const [nextPath, setNextPath] = useState("");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const raw = query.get("next") || "";
    setNextPath(raw.startsWith("/") ? raw : "");
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const login = await apiFetchJson<LoginResponse>("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, password }),
      });

      writeAuthSession({ token: login.token, role: login.role, userName: login.userName });

      const me = await apiFetchJson<MeResponse>("/api/auth/me");
      writeAuthSession({
        token: login.token,
        role: me.role === "admin" ? "admin" : "user",
        userName: me.userName,
      });

      const fallbackPath = me.role === "admin" ? "/admin/returns" : "/tools";
      router.push(nextPath || fallbackPath);
      router.refresh();
    } catch (e: unknown) {
      clearAuthSession();
      setError(getHttpErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const buttonStyle: React.CSSProperties = {
    width: "100%",
    fontSize: 16,
    padding: "12px 12px",
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 520 }}>
        <h1 style={{ fontSize: 30, margin: "0 0 18px", textAlign: "center" }}>ログイン</h1>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 14 }}>
          <div>
            <div style={{ fontSize: 14, marginBottom: 6 }}>ログインID（ユーザー名またはメール）</div>
            <Input
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="例: admin"
              style={{ fontSize: 16, padding: "12px 12px" }}
            />
          </div>

          <div>
            <div style={{ fontSize: 14, marginBottom: 6 }}>パスワード</div>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ fontSize: 16, padding: "12px 12px" }}
            />
          </div>

          <Button type="submit" disabled={submitting || !loginId.trim() || !password} style={buttonStyle}>
            {submitting ? "ログイン中..." : "ログイン"}
          </Button>

          {/* アカウント申請：ログインボタンと同規格のボタン化 */}
          <Link href="/signup-request" style={{ textDecoration: "none" }}>
            <Button type="button" style={buttonStyle}>
              アカウント申請
            </Button>
          </Link>
        </form>

        {error ? (
          <p style={{ color: "#b91c1c", marginTop: 12, fontSize: 14, textAlign: "center" }}>
            エラー: {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}