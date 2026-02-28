"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "../../../../src/components/ui/Button";
import Input from "../../../../src/components/ui/Input";
import { apiFetchJson, getHttpErrorMessage, isHttpError } from "../../../../src/utils/http";
import { clearAuthSession } from "../../../../src/utils/auth";

type Role = "user" | "admin";

type UserItem = {
  id: string;
  department: string;
  username: string;
  email: string;
  role: Role;
  createdAt?: string;
};

type UsersListResponse = {
  items: UserItem[];
  page: number;
  pageSize: number;
  total: number;
};

type SignupRequestItem = {
  id: string;
  department: string;
  username: string;
  email: string;
  status: "pending" | "approved" | "rejected";
  requestedAt: string;
};

type ApproveSignupResponse = {
  ok: boolean;
  user: UserItem;
};

const USER_PAGE_SIZE = 10;

function formatDateTime(value: string | undefined): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("ja-JP");
}

export default function AdminUsersPage() {
  const [department, setDepartment] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("user");

  const [users, setUsers] = useState<UserItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userPage, setUserPage] = useState(1);
  const [userTotal, setUserTotal] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [pendingRequests, setPendingRequests] = useState<SignupRequestItem[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  const totalUserPages = useMemo(() => {
    return Math.max(1, Math.ceil(userTotal / USER_PAGE_SIZE));
  }, [userTotal]);

  const handleApiError = useCallback(
    (error: unknown): string | null => {
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
    },
    [router],
  );

  const loadUsers = useCallback(
    async (page: number) => {
      setLoadingUsers(true);

      try {
        const response = await apiFetchJson<UsersListResponse>(
          `/api/admin/users?page=${page}&pageSize=${USER_PAGE_SIZE}`,
        );

        if (response.items.length === 0 && response.total > 0 && page > 1) {
          setUserPage(page - 1);
          return;
        }

        setUsers(response.items);
        setUserPage(response.page);
        setUserTotal(response.total);
      } catch (e: unknown) {
        const message = handleApiError(e);
        if (message) setErr(message);
      } finally {
        setLoadingUsers(false);
      }
    },
    [handleApiError],
  );

  const loadPendingRequests = useCallback(async () => {
    setLoadingPending(true);

    try {
      const requests = await apiFetchJson<SignupRequestItem[]>("/api/admin/user-requests");
      setPendingRequests(requests);
    } catch (e: unknown) {
      const message = handleApiError(e);
      if (message) setErr(message);
    } finally {
      setLoadingPending(false);
    }
  }, [handleApiError]);

  useEffect(() => {
    void loadUsers(userPage);
  }, [loadUsers, userPage]);

  useEffect(() => {
    void loadPendingRequests();
  }, [loadPendingRequests]);

  const onCreate = async () => {
    if (submitting) return;
    if (!department.trim() || !username.trim() || !email.trim() || !password) return;

    setSubmitting(true);
    setErr(null);

    try {
      await apiFetchJson<UserItem>("/api/admin/users", {
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

      setDepartment("");
      setUsername("");
      setEmail("");
      setPassword("");
      setRole("user");

      if (userPage !== 1) {
        setUserPage(1);
      } else {
        await loadUsers(1);
      }
    } catch (e: unknown) {
      const message = handleApiError(e);
      if (message) setErr(message);
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (target: UserItem) => {
    if (deletingId || submitting || approvingId) return;

    const confirmed = window.confirm(`ユーザー「${target.username}」を削除します。よろしいですか？`);
    if (!confirmed) return;

    setDeletingId(target.id);
    setErr(null);

    try {
      await apiFetchJson<{ ok: boolean }>(`/api/admin/users/${target.id}`, { method: "DELETE" });

      const nextTotal = Math.max(0, userTotal - 1);
      const maxPage = Math.max(1, Math.ceil(nextTotal / USER_PAGE_SIZE));
      const nextPage = Math.min(userPage, maxPage);

      if (nextPage !== userPage) {
        setUserPage(nextPage);
      } else {
        await loadUsers(nextPage);
      }
    } catch (e: unknown) {
      const message = handleApiError(e);
      if (message) setErr(message);
    } finally {
      setDeletingId(null);
    }
  };

  const onApprove = async (requestId: string) => {
    if (approvingId) return;

    setApprovingId(requestId);
    setErr(null);

    try {
      await apiFetchJson<ApproveSignupResponse>(`/api/admin/user-requests/${requestId}/approve`, {
        method: "POST",
      });

      await Promise.all([loadPendingRequests(), loadUsers(userPage)]);
    } catch (e: unknown) {
      const message = handleApiError(e);
      if (message) setErr(message);
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <main style={{ padding: 16 }}>
      <h1>ユーザー管理</h1>

      <section style={{ marginTop: 12 }}>
        <h2 style={{ marginBottom: 8 }}>ユーザー作成</h2>
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
              disabled={submitting || !department.trim() || !username.trim() || !email.trim() || !password}
            >
              {submitting ? "作成中..." : "ユーザーを作成"}
            </Button>
          </div>
        </div>
      </section>

      {err ? <p style={{ color: "#b91c1c", marginTop: 12 }}>error: {err}</p> : null}

      <section style={{ marginTop: 20 }}>
        <h2 style={{ marginBottom: 8 }}>ユーザー一覧</h2>
        {loadingUsers ? (
          <p>読み込み中...</p>
        ) : users.length === 0 ? (
          <p>ユーザーがありません。</p>
        ) : (
          <>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>ID</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>部署</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>ユーザー名</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>メール</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>ロール</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>作成日時</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((item) => (
                  <tr key={item.id}>
                    <td style={{ padding: "8px 0" }}>{item.id}</td>
                    <td style={{ padding: "8px 0" }}>{item.department}</td>
                    <td style={{ padding: "8px 0" }}>{item.username}</td>
                    <td style={{ padding: "8px 0" }}>{item.email}</td>
                    <td style={{ padding: "8px 0" }}>{item.role}</td>
                    <td style={{ padding: "8px 0" }}>{formatDateTime(item.createdAt)}</td>
                    <td style={{ padding: "8px 0" }}>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={deletingId !== null}
                        onClick={() => onDelete(item)}
                        style={{ borderColor: "#dc2626", color: "#dc2626" }}
                      >
                        {deletingId === item.id ? "削除中..." : "削除"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
              <Button type="button" variant="ghost" onClick={() => setUserPage((prev) => prev - 1)} disabled={userPage <= 1 || loadingUsers}>
                前へ
              </Button>
              <span>
                {userPage} / {totalUserPages} ページ（全 {userTotal} 件）
              </span>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setUserPage((prev) => prev + 1)}
                disabled={userPage >= totalUserPages || loadingUsers}
              >
                次へ
              </Button>
            </div>
          </>
        )}
      </section>

      <section style={{ marginTop: 28 }}>
        <h2 style={{ marginBottom: 8 }}>申請待ち一覧</h2>
        {loadingPending ? (
          <p>読み込み中...</p>
        ) : pendingRequests.length === 0 ? (
          <p>申請待ちはありません。</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>
                  部署
                </th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>
                  ユーザー名
                </th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>
                  メール
                </th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>
                  申請日時
                </th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>
                  ステータス
                </th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {pendingRequests.map((item) => (
                <tr key={item.id}>
                  <td style={{ padding: "8px 0" }}>{item.department}</td>
                  <td style={{ padding: "8px 0" }}>{item.username}</td>
                  <td style={{ padding: "8px 0" }}>{item.email}</td>
                  <td style={{ padding: "8px 0" }}>{formatDateTime(item.requestedAt)}</td>
                  <td style={{ padding: "8px 0" }}>{item.status}</td>
                  <td style={{ padding: "8px 0" }}>
                    <Button type="button" onClick={() => onApprove(item.id)} disabled={approvingId !== null}>
                      {approvingId === item.id ? "承認中..." : "承認"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
