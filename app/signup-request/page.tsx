"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import Toast from "@/src/components/ui/Toast";
import { apiFetchJson, getHttpErrorMessage } from "@/src/utils/http";

type SignupRequestResponse = {
  ok: boolean;
};

export default function SignupRequestPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    if (!username.trim() || !email.trim() || !password.trim()) {
      setError("入力が不足しています。");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiFetchJson<SignupRequestResponse>("/api/public/signup/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
          password,
        }),
      });
      setUsername("");
      setEmail("");
      setPassword("");
      setToastMessage("申請しました。");
    } catch (err: unknown) {
      setError(getHttpErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
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
      <div style={{ width: 360, maxWidth: "90vw", display: "grid", gap: 12 }}>
        <h1>アカウント作成申請</h1>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="ユーザー名"
            style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
          />
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="メールアドレス"
            type="email"
            style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
          />
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="パスワード"
            type="password"
            style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
          />
          <button
            type="submit"
            disabled={submitting}
            style={{ width: "100%", height: 40, borderRadius: 6 }}
          >
            申請する
          </button>
        </form>
        {error && <p style={{ color: "#b91c1c" }}>error: {error}</p>}
        <div style={{ display: "grid", gap: 8 }}>
          <Link
            href="/login"
            style={{
              display: "inline-flex",
              width: "100%",
              height: 40,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 6,
              border: "1px solid #cbd5e1",
              background: "#f8fafc",
              color: "#0f172a",
              textDecoration: "none",
              boxSizing: "border-box",
            }}
          >
            ログインへ戻る
          </Link>
        </div>
      </div>
      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
    </main>
  );
}
