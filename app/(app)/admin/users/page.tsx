"use client";

import { useCallback, useEffect, useState } from "react";
import Button from "../../../../src/components/ui/Button";
import Input from "../../../../src/components/ui/Input";
import { HttpError, apiFetchJson } from "../../../../src/utils/http";

type AdminUser = {
  id: string;
  username: string;
  role: "user" | "admin";
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [err, setErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingUsername, setEditingUsername] = useState("");
  const [editingRole, setEditingRole] = useState<"user" | "admin">("user");
  const [submitting, setSubmitting] = useState<Set<string>>(new Set());

  const handleApiError = (error: unknown): string | null => {
    if (!(error instanceof HttpError)) return "通信に失敗しました";

    if (error.status === 401) {
      window.location.href = "/login";
      return null;
    }

    if (error.status === 403) {
      return error.message || "権限がありません";
    }

    return error.message || "通信に失敗しました";
  };

  const loadData = useCallback(async () => {
    try {
      const data = await apiFetchJson<AdminUser[]>('/api/admin/users');
      setUsers(data);
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
    if (!username.trim()) return;
    if (submitting.has('add')) return;
    setSubmitting((prev) => new Set(prev).add('add'));
    try {
      await apiFetchJson<{ ok: true } & Record<string, unknown>>('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), role }),
      });
      setUsername('');
      setRole('user');
      await loadData();
    } catch (e: unknown) {
      const message = handleApiError(e);
      if (message) setErr(message);
    } finally {
      setSubmitting((prev) => {
        const next = new Set(prev);
        next.delete('add');
        return next;
      });
    }
  };

  const onDelete = async (id: string) => {
    if (!window.confirm('このユーザーを削除しますか？')) return;
    if (submitting.has(id)) return;
    setSubmitting((prev) => new Set(prev).add(id));
    try {
      await apiFetchJson<{ ok: true } & Record<string, unknown>>(`/api/admin/users/${id}`, {
        method: 'DELETE',
      });
      if (editingId === id) {
        setEditingId(null);
        setEditingUsername('');
        setEditingRole('user');
      }
      await loadData();
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
    setEditingRole(user.role);
  };

  const onCancelEdit = () => {
    setEditingId(null);
    setEditingUsername('');
    setEditingRole('user');
  };

  const onSaveEdit = async (id: string) => {
    const nextUsername = editingUsername.trim();
    if (!nextUsername) return;
    if (submitting.has(id)) return;
    setSubmitting((prev) => new Set(prev).add(id));
    try {
      await apiFetchJson<{ ok: true } & Record<string, unknown>>(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: nextUsername, role: editingRole }),
      });
      onCancelEdit();
      await loadData();
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

  const onResetData = async () => {
    if (submitting.has('reset')) return;
    if (!window.confirm('MSWデータを初期化しますか？')) return;
    setSubmitting((prev) => new Set(prev).add('reset'));
    try {
      await apiFetchJson<{ ok: true } & Record<string, unknown>>('/api/admin/dev/reset', {
        method: 'POST',
      });
      window.location.reload();
    } catch (e: unknown) {
      const message = handleApiError(e);
      if (message) setErr(message);
    } finally {
      setSubmitting((prev) => {
        const next = new Set(prev);
        next.delete('reset');
        return next;
      });
    }
  };

  if (loading) return <main style={{ padding: 16 }}>loading...</main>;
  if (err) return <main style={{ padding: 16 }}><p style={{ color: '#b91c1c' }}>error: {err}</p></main>;

  return (
    <main style={{ padding: 16 }}>
      {/* 一般導線にはメールを表示しない前提。 */}
      <h1>ユーザー管理</h1>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'user' | 'admin')}
            style={{ height: 36, borderRadius: 6, border: '1px solid #cbd5e1' }}
          >
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
          <Button type="button" onClick={onAdd} disabled={submitting.has('add')}>
            追加
          </Button>
        </div>

        <Button type="button" variant="ghost" onClick={onResetData} disabled={submitting.has('reset')}>
          データリセット
        </Button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: '8px 0' }}>ユーザー名</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: '8px 0' }}>ロール</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: '8px 0' }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const isEditing = editingId === user.id;
            const isBusy = submitting.has(user.id);
            return (
              <tr key={user.id}>
                <td style={{ padding: '8px 0' }}>
                  {isEditing ? (
                    <Input value={editingUsername} onChange={(e) => setEditingUsername(e.target.value)} />
                  ) : (
                    user.username
                  )}
                </td>
                <td style={{ padding: '8px 0' }}>
                  {isEditing ? (
                    <select
                      value={editingRole}
                      onChange={(e) => setEditingRole(e.target.value as 'user' | 'admin')}
                      style={{ height: 36, borderRadius: 6, border: '1px solid #cbd5e1' }}
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  ) : (
                    user.role
                  )}
                </td>
                <td style={{ padding: '8px 0' }}>
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
    </main>
  );
}
