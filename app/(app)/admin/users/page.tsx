"use client";

import { useCallback, useEffect, useState } from "react";
import Button from "../../../../src/components/ui/Button";
import Input from "../../../../src/components/ui/Input";

type AdminUser = {
  id: string;
  username: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error(`/api/admin/users ${res.status}`);
      const data = (await res.json()) as AdminUser[];
      setUsers(data);
      setErr(null);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onAdd = async () => {
    if (!username.trim()) return;
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const msg =
          body && typeof body === "object" && "message" in body
            ? String((body as { message?: unknown }).message)
            : `add failed ${res.status}`;
        throw new Error(msg);
      }
      setUsername("");
      await loadData();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  if (loading) return <main style={{ padding: 16 }}>loading...</main>;
  if (err) return <main style={{ padding: 16 }}><p style={{ color: "#b91c1c" }}>error: {err}</p></main>;

  return (
    <main style={{ padding: 16 }}>
      <h1>ユーザー管理</h1>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ユーザー名" />
        <Button type="button" onClick={onAdd}>
          追加
        </Button>
      </div>

      <ul>
        {users.map((user) => (
          <li key={user.id}>{user.username}</li>
        ))}
      </ul>
    </main>
  );
}
