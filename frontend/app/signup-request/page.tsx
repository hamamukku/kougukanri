"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import Button from "../../src/components/ui/Button";
import Input from "../../src/components/ui/Input";
import Toast from "../../src/components/ui/Toast";
import { apiFetchJson, getHttpErrorMessage } from "../../src/utils/http";

type SignupRequestResponse = {
  ok: boolean;
};

export default function SignupRequestPage() {
  const [department, setDepartment] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    if (!department.trim() || !username.trim() || !email.trim() || !password.trim()) {
      setError("部署名・ユーザー名・メール・パスワードを入力してください。");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await apiFetchJson<SignupRequestResponse>("/api/public/signup/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department: department.trim(),
          username: username.trim(),
          email: email.trim(),
          password,
        }),
      });
      setDepartment("");
      setUsername("");
      setEmail("");
      setPassword("");
      setToastMessage("申請を受け付けました。");
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
        <h1>アカウント申請</h1>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>部署名</div>
            <Input
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              placeholder="engineering"
            />
          </div>
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>ユーザー名</div>
            <Input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="your_name"
            />
          </div>
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>メールアドレス</div>
            <Input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>パスワード</div>
            <Input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
            />
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "送信中..." : "申請する"}
          </Button>
        </form>

        {error ? <p style={{ color: "#b91c1c", margin: 0 }}>error: {error}</p> : null}

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

      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
    </main>
  );
}
