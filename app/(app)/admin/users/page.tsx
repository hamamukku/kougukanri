"use client";

import { useCallback, useEffect, useState } from "react";
import Button from "../../../../src/components/ui/Button";
import Input from "../../../../src/components/ui/Input";
import Toast from "../../../../src/components/ui/Toast";
import { apiFetchJson, getHttpErrorMessage, isHttpError } from "../../../../src/utils/http";

type AdminUser = {
  id: string;
  username: string;
  email: string;
  role: "user" | "admin";
};

type PendingUser = {
  id: string;
  username: string;
  email: string;
  password: string;
  status: "pending";
  requestedAt: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [err, setErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingUsername, setEditingUsername] = useState("");
  const [editingEmail, setEditingEmail] = useState("");
  const [editingRole, setEditingRole] = useState<"user" | "admin">("user");
  const [submitting, setSubmitting] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleApiError = (error: unknown): string | null => {
    if (isHttpError(error) && error.status === 401) {
      return "認証が必要です";
    }
    return getHttpErrorMessage(error);
  };

  const loadData = useCallback(async () => {
    try {
      const [usersData, pendingData] = await Promise.all([
        apiFetchJson<AdminUser[]>("/api/admin/users"),
        apiFetchJson<PendingUser[]>("/api/admin/user-requests"),
      ]);
      setUsers(usersData);
      setPendingUsers(pendingData);
      setErr(null);
    } catch (e: unknown) {
      const message = handleApiError(e);
      if (message) setErr(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onAdd = async () => {
    if (!username.trim() || !email.trim()) return;
    if (submitting.has("add")) return;
    setSubmitting((prev) => new Set(prev).add("add"));
    try {
      await apiFetchJson<{ ok: true } & Record<string, unknown>>("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), email: email.trim(), role }),
      });
      setUsername("");
      setEmail("");
      setRole("user");
      await loadData();
      setToastMessage("ユーザーを追加しました");
    } catch (e: unknown) {
      const message = handleApiError(e);
      if (message) setErr(message);
    } finally {
      setSubmitting((prev) => {
        const next = new Set(prev);
        next.delete("add");
        return next;
      });
    }
  };

  const onDelete = async (id: string) => {
    if (!window.confirm("このユーザーを削除しますか？")) return;
    if (submitting.has(id)) return;
    setSubmitting((prev) => new Set(prev).add(id));
    try {
      await apiFetchJson<{ ok: true } & Record<string, unknown>>(`/api/admin/users/${id}`, {
        method: "DELETE",
      });
      if (editingId === id) {
        setEditingId(null);
        setEditingUsername("");
        setEditingEmail("");
        setEditingRole("user");
      }
      await loadData();
      setToastMessage("ユーザーを削除しました");
    } catch (e: unknown) {
      const message = handleApiError(e);
      if (message) setErr(message);
    } finally {
      setSubmitting((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const onStartEdit = (user: AdminUser) => {
    setEditingId(user.id);
    setEditingUsername(user.username);
    setEditingEmail(user.email);
    setEditingRole(user.role);
  };

  const onCancelEdit = () => {
    setEditingId(null);
    setEditingUsername("");
    setEditingEmail("");
    setEditingRole("user");
  };

  const onSaveEdit = async (id: string) => {
    const nextUsername = editingUsername.trim();
    const nextEmail = editingEmail.trim();
    if (!nextUsername || !nextEmail) return;
    if (submitting.has(id)) return;
    setSubmitting((prev) => new Set(prev).add(id));
    try {
      await apiFetchJson<{ ok: true } & Record<string, unknown>>(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: nextUsername, email: nextEmail, role: editingRole }),
      });
      onCancelEdit();
      await loadData();
      setToastMessage("ユーザーを更新しました");
    } catch (e: unknown) {
      const message = handleApiError(e);
      if (message) setErr(message);
    } finally {
      setSubmitting((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const onApproveRequest = async (id: string) => {
    if (submitting.has(`approve:${id}`)) return;
    if (!window.confirm("この申請を承認しますか？")) return;
    setSubmitting((prev) => new Set(prev).add(`approve:${id}`));
    try {
      await apiFetchJson<{ ok: true } & Record<string, unknown>>(`/api/admin/user-requests/${id}/approve`, {
        method: "POST",
      });
      await loadData();
      setToastMessage("申請を承認しました");
    } catch (e: unknown) {
      const message = handleApiError(e);
      if (message) setErr(message);
    } finally {
      setSubmitting((prev) => {
        const next = new Set(prev);
        next.delete(`approve:${id}`);
        return next;
      });
    }
  };

  const onResetData = async () => {
    if (submitting.has("reset")) return;
    if (!window.confirm("MSWデータを初期化しますか？")) return;
    setSubmitting((prev) => new Set(prev).add("reset"));
    try {
      await apiFetchJson<{ ok: true } & Record<string, unknown>>("/api/admin/dev/reset", {
        method: "POST",
      });
      window.location.reload();
    } catch (e: unknown) {
      const message = handleApiError(e);
      if (message) setErr(message);
    } finally {
      setSubmitting((prev) => {
        const next = new Set(prev);
        next.delete("reset");
        return next;
      });
    }
  };

  if (loading) return <main style={{ padding: 16 }}>loading...</main>;
  if (err) return <main style={{ padding: 16 }}><p style={{ color: "#b91c1c" }}>error: {err}</p></main>;

  return (
    <main style={{ padding: 16 }}>
      <h1>ユーザー管理</h1>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" />
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "user" | "admin")}
            style={{ height: 36, borderRadius: 6, border: "1px solid #cbd5e1" }}
          >
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
          <Button type="button" onClick={onAdd} disabled={submitting.has("add")}>
            追加
          </Button>
        </div>

        <Button type="button" variant="ghost" onClick={onResetData} disabled={submitting.has("reset")}>
          データリセット
        </Button>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>ユーザー名</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>メール</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>ロール</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const isEditing = editingId === user.id;
            const isBusy = submitting.has(user.id);
            return (
              <tr key={user.id}>
                <td style={{ padding: "8px 0" }}>
                  {isEditing ? (
                    <Input value={editingUsername} onChange={(e) => setEditingUsername(e.target.value)} />
                  ) : (
                    user.username
                  )}
                </td>
                <td style={{ padding: "8px 0" }}>
                  {isEditing ? (
                    <Input value={editingEmail} onChange={(e) => setEditingEmail(e.target.value)} />
                  ) : (
                    user.email
                  )}
                </td>
                <td style={{ padding: "8px 0" }}>
                  {isEditing ? (
                    <select
                      value={editingRole}
                      onChange={(e) => setEditingRole(e.target.value as "user" | "admin")}
                      style={{ height: 36, borderRadius: 6, border: "1px solid #cbd5e1" }}
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  ) : (
                    user.role
                  )}
                </td>
                <td style={{ padding: "8px 0" }}>
                  {isEditing ? (
                    <>
                      <Button type="button" onClick={() => onSaveEdit(user.id)} disabled={isBusy}>
                        保存
                      </Button>
                      <Button type="button" variant="ghost" onClick={onCancelEdit}>
                        キャンセル
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button type="button" onClick={() => onStartEdit(user)}>
                        編集
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => onDelete(user.id)} disabled={isBusy}>
                        削除
                      </Button>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>申請待ちユーザー</h2>
        {pendingUsers.length === 0 ? (
          <p style={{ color: "#64748b" }}>申請待ちなし</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>ユーザー名</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>メール</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>申請日時</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {pendingUsers.map((pendingUser) => {
                const isBusy = submitting.has(`approve:${pendingUser.id}`);
                return (
                  <tr key={pendingUser.id}>
                    <td style={{ padding: "8px 0" }}>{pendingUser.username}</td>
                    <td style={{ padding: "8px 0" }}>{pendingUser.email}</td>
                    <td style={{ padding: "8px 0" }}>{pendingUser.requestedAt}</td>
                    <td style={{ padding: "8px 0" }}>
                      <Button
                        type="button"
                        onClick={() => onApproveRequest(pendingUser.id)}
                        disabled={isBusy}
                      >
                        承認
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
    </main>
  );
}
