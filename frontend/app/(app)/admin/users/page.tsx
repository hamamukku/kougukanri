"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "../../../../src/components/ui/Button";
import Input from "../../../../src/components/ui/Input";
import { apiFetchJson, getHttpErrorMessage, isHttpError } from "../../../../src/utils/http";
import { clearAuthSession } from "../../../../src/utils/auth";

type Role = "user" | "admin";

type CreatedUser = {
  id: string;
  department: string;
  username: string;
  email: string;
  role: Role;
};

export default function AdminUsersPage() {
  const [department, setDepartment] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("user");
  const [created, setCreated] = useState<CreatedUser[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  const handleApiError = (error: unknown): string | null => {
    if (isHttpError(error) && error.status === 401) {
      clearAuthSession();
      router.push("/login");
      return null;
    }

    if (isHttpError(error) && error.status === 403) {
      router.push("/tools");
      return null;
    }

    return getHttpErrorMessage(error);
  };

  const onCreate = async () => {
    if (submitting) return;
    if (!department.trim() || !username.trim() || !email.trim() || !password) return;

    setSubmitting(true);
    setErr(null);

    try {
      const user = await apiFetchJson<CreatedUser>("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department: department.trim(),
          username: username.trim(),
          email: email.trim(),
          password,
          role,
        }),
      });

      setCreated((prev) => [user, ...prev].slice(0, 10));
      setUsername("");
      setEmail("");
      setPassword("");
      setRole("user");
    } catch (e: unknown) {
      const message = handleApiError(e);
      if (message) setErr(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main style={{ padding: 16 }}>
      <h1>ユーザー作成</h1>

      <div style={{ display: "grid", gap: 8, maxWidth: 560 }}>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>部署</div>
          <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="engineering" />
        </div>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>ユーザー名</div>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="user1" />
        </div>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>メール</div>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user1@example.com" />
        </div>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>パスワード</div>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>ロール</div>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            style={{ height: 36, borderRadius: 6, border: "1px solid #cbd5e1", padding: "0 10px" }}
          >
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
        </div>
        <div>
          <Button
            type="button"
            onClick={onCreate}
            disabled={
              submitting || !department.trim() || !username.trim() || !email.trim() || !password
            }
          >
            {submitting ? "作成中..." : "ユーザー作成"}
          </Button>
        </div>
      </div>

      {err ? <p style={{ color: "#b91c1c", marginTop: 12 }}>error: {err}</p> : null}

      <section style={{ marginTop: 20 }}>
        <h2 style={{ marginBottom: 8 }}>直近作成ユーザー</h2>
        {created.length === 0 ? (
          <p>まだ作成されていません。</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>ID</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>部署</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>ユーザー名</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>メール</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>ロール</th>
              </tr>
            </thead>
            <tbody>
              {created.map((item) => (
                <tr key={item.id}>
                  <td style={{ padding: "8px 0" }}>{item.id}</td>
                  <td style={{ padding: "8px 0" }}>{item.department}</td>
                  <td style={{ padding: "8px 0" }}>{item.username}</td>
                  <td style={{ padding: "8px 0" }}>{item.email}</td>
                  <td style={{ padding: "8px 0" }}>{item.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
