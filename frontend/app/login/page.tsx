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

      // Save token first so /api/auth/me can reuse the same auth path and header policy.
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

  return (
    <main style={{ padding: 24, maxWidth: 420 }}>
      <h1>ログイン</h1>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>Login ID (username or email)</div>
          <Input value={loginId} onChange={(e) => setLoginId(e.target.value)} placeholder="admin" />
        </div>

        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>Password</div>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        <Button type="submit" disabled={submitting || !loginId.trim() || !password}>
          {submitting ? "ログイン中..." : "ログイン"}
        </Button>
      </form>

      <div style={{ marginTop: 12 }}>
        <Link href="/signup-request">アカウント申請</Link>
      </div>

      {error ? <p style={{ color: "#b91c1c", marginTop: 12 }}>error: {error}</p> : null}
    </main>
  );
}
