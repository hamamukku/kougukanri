// frontend/app/(app)/admin/users/page.tsx
// 笨・window.confirm 繧偵ｄ繧√※縲檎判髱｢蜀・Δ繝ｼ繝繝ｫ縲阪↓縺吶ｋ螳悟・迚・
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
  userCode: string;
  username: string;
  email: string;
  role: Role;
  createdAt?: string;
};

type EditingUserDraft = {
  department: string;
  userCode: string;
  username: string;
  email: string;
  role: Role;
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

type Department = {
  id: string;
  name: string;
};

const USER_PAGE_SIZE = 10;
const ROLE_LABEL_MAP: Record<Role, string> = {
  user: "一般ユーザー",
  admin: "管理者",
};
const ROLE_OPTIONS: Array<{ value: Role; label: string }> = [
  { value: "user", label: ROLE_LABEL_MAP.user },
  { value: "admin", label: ROLE_LABEL_MAP.admin },
];

function getRoleLabel(role: Role): string {
  return ROLE_LABEL_MAP[role] ?? role;
}

function formatDateTime(value: string | undefined): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("ja-JP");
}

function ConfirmModal(props: {
  open: boolean;
  title?: string;
  message: string;
  okText?: string;
  cancelText?: string;
  busy?: boolean;
  dangerOk?: boolean;
  onOk: () => void;
  onCancel: () => void;
}) {
  if (!props.open) return null;

  const modalBtnStyle: React.CSSProperties = {
    minWidth: 140,
    height: 52,
    fontSize: 18,
    fontWeight: 800,
    padding: "0 20px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 9999,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !props.busy) props.onCancel();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          background: "#fff",
          borderRadius: 14,
          border: "1px solid #e2e8f0",
          boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
          padding: 18,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 10 }}>{props.title ?? "確認"}</div>

        <div style={{ fontSize: 16, lineHeight: 1.7, color: "#0f172a" }}>{props.message}</div>

        <div style={{ display: "flex", justifyContent: "center", gap: 14, marginTop: 18 }}>
          <Button type="button" variant="ghost" onClick={props.onCancel} disabled={props.busy} style={modalBtnStyle}>
            {props.cancelText ?? "キャンセル"}
          </Button>

          <Button
            type="button"
            variant={props.dangerOk ? "danger" : "primary"}
            onClick={props.onOk}
            disabled={props.busy}
            style={modalBtnStyle}
          >
            {props.busy ? "処理中..." : props.okText ?? "OK"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const [department, setDepartment] = useState("");
  const [userCode, setUserCode] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("user");

  const [departments, setDepartments] = useState<Department[]>([]);
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [savingDepartment, setSavingDepartment] = useState(false);
  const [deletingDepartmentId, setDeletingDepartmentId] = useState<string | null>(null);
  const [editingDepartmentId, setEditingDepartmentId] = useState<string | null>(null);
  const [editingDepartmentName, setEditingDepartmentName] = useState("");
  const [savingDepartmentId, setSavingDepartmentId] = useState<string | null>(null);

  const [users, setUsers] = useState<UserItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userPage, setUserPage] = useState(1);
  const [userTotal, setUserTotal] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUserDraft, setEditingUserDraft] = useState<EditingUserDraft | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  const [pendingRequests, setPendingRequests] = useState<SignupRequestItem[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  // 笨・confirm modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("確認");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmDanger, setConfirmDanger] = useState(false);
  const [confirmOkText, setConfirmOkText] = useState("OK");
  const [confirmCancelText, setConfirmCancelText] = useState("キャンセル");
  const [confirmAction, setConfirmAction] = useState<(() => Promise<void>) | null>(null);

  const openConfirm = (params: {
    title: string;
    message: string;
    dangerOk?: boolean;
    okText?: string;
    cancelText?: string;
    action: () => Promise<void>;
  }) => {
    setConfirmTitle(params.title);
    setConfirmMessage(params.message);
    setConfirmDanger(!!params.dangerOk);
    setConfirmOkText(params.okText ?? "OK");
    setConfirmCancelText(params.cancelText ?? "キャンセル");
    setConfirmAction(() => params.action);
    setConfirmBusy(false);
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    if (confirmBusy) return;
    setConfirmOpen(false);
    setConfirmAction(null);
  };

  const runConfirmAction = async () => {
    if (!confirmAction) return;
    setConfirmBusy(true);
    try {
      await confirmAction();
      setConfirmOpen(false);
      setConfirmAction(null);
    } finally {
      setConfirmBusy(false);
    }
  };

  const totalUserPages = useMemo(() => Math.max(1, Math.ceil(userTotal / USER_PAGE_SIZE)), [userTotal]);

  const startEditingUser = (item: UserItem) => {
    if (deletingId || savingUserId || editingUserId) return;
    setEditingUserId(item.id);
    setEditingUserDraft({
      department: item.department,
      userCode: item.userCode,
      username: item.username,
      email: item.email,
      role: item.role,
    });
  };

  const cancelEditingUser = () => {
    setEditingUserId(null);
    setEditingUserDraft(null);
  };

  const onSaveUser = async (item: UserItem) => {
    if (savingUserId || deletingId || editingUserId !== item.id || !editingUserDraft) return;

    const dept = editingUserDraft.department.trim();
    const nextUserCode = editingUserDraft.userCode.trim();
    const userName = editingUserDraft.username.trim();
    const userEmail = editingUserDraft.email.trim().toLowerCase();
    const userRole = editingUserDraft.role;

    if (!dept || !nextUserCode || !userName || !userEmail) {
      setErr("必須項目を入力してください。");
      return;
    }

    setSavingUserId(item.id);
    setErr(null);
    try {
      await apiFetchJson<UserItem>(`/api/admin/users/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department: dept,
          userCode: nextUserCode,
          username: userName,
          email: userEmail,
          role: userRole,
        }),
      });
      cancelEditingUser();
      await loadUsers(userPage);
    } catch (e: unknown) {
      const message = handleApiError(e);
      if (message) setErr(message);
    } finally {
      setSavingUserId(null);
    }
  };

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

      if (isHttpError(error)) {
        const body = error.body;
        if (body && typeof body === "object") {
          const envelope = body as {
            error?: { code?: unknown; message?: unknown };
            message?: unknown;
          };
          if (envelope.error?.code === "USER_CODE_DUPLICATE") {
            return "このユーザーIDは既に使われています";
          }
          if (envelope.error?.code === "USERNAME_DUPLICATE") {
            return "このユーザー名は既に使われています";
          }
          if (envelope.error?.code === "EMAIL_DUPLICATE") {
            return "このメールアドレスは既に使われています";
          }
          if (envelope.error?.message === "userCode already exists" || envelope.message === "userCode already exists") {
            return "このユーザーIDは既に使われています";
          }
          if (envelope.error?.message === "username already exists" || envelope.message === "username already exists") {
            return "このユーザー名は既に使われています";
          }
          if (envelope.error?.message === "email already exists" || envelope.message === "email already exists") {
            return "このメールアドレスは既に使われています";
          }
        }

        if (error.message === "userCode already exists") {
          return "このユーザーIDは既に使われています";
        }
        if (error.message === "username already exists") {
          return "このユーザー名は既に使われています";
        }
        if (error.message === "email already exists") {
          return "このメールアドレスは既に使われています";
        }
      }

      return getHttpErrorMessage(error);
    },
    [router],
  );

  const loadDepartments = useCallback(async () => {
    try {
      const items = await apiFetchJson<Department[]>("/api/departments");
      setDepartments(items);
      if (!department && items.length > 0) {
        setDepartment(items[0].name);
      }
      if (department && !items.some((item) => item.name === department)) {
        setDepartment(items[0]?.name ?? "");
      }
    } catch (e: unknown) {
      const message = handleApiError(e);
      if (message) setErr(message);
    }
  }, [department, handleApiError]);

  const loadUsers = useCallback(
    async (page: number) => {
      setLoadingUsers(true);

      try {
        const response = await apiFetchJson<UsersListResponse>(`/api/admin/users?page=${page}&pageSize=${USER_PAGE_SIZE}`);

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
    void loadDepartments();
  }, [loadDepartments]);

  useEffect(() => {
    void loadUsers(userPage);
  }, [loadUsers, userPage]);

  useEffect(() => {
    void loadPendingRequests();
  }, [loadPendingRequests]);

  const onCreate = async () => {
    if (submitting) return;
    if (!department || !userCode.trim() || !username.trim() || !email.trim() || !password) return;

    setSubmitting(true);
    setErr(null);

    try {
      await apiFetchJson<UserItem>("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department,
          userCode: userCode.trim(),
          username: username.trim(),
          email: email.trim(),
          password,
          role,
        }),
      });

      setUserCode("");
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

  // 笨・繝ｦ繝ｼ繧ｶ繝ｼ蜑企勁・・onfirm modal・・
  const onDelete = async (target: UserItem) => {
    if (deletingId || submitting || approvingId) return;

    openConfirm({
      title: "削除の確認",
      message: `ユーザー「${target.username}」を削除します。よろしいですか？`,
      dangerOk: true,
      okText: "削除する",
      cancelText: "キャンセル",
      action: async () => {
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
      },
    });
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

  const onAddDepartment = async () => {
    if (!newDepartmentName.trim() || savingDepartment) return;
    setSavingDepartment(true);
    setErr(null);
    try {
      const created = await apiFetchJson<Department>("/api/admin/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newDepartmentName.trim() }),
      });
      setDepartments((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewDepartmentName("");
      if (!department) setDepartment(created.name);
    } catch (e: unknown) {
      const message = handleApiError(e);
      if (message) setErr(message);
    } finally {
      setSavingDepartment(false);
    }
  };

  const startEditingDepartment = (target: Department) => {
    if (deletingDepartmentId || savingDepartment || savingDepartmentId || editingDepartmentId) return;
    setEditingDepartmentId(target.id);
    setEditingDepartmentName(target.name);
  };

  const cancelEditingDepartment = () => {
    setEditingDepartmentId(null);
    setEditingDepartmentName("");
  };

  const onSaveDepartment = async (target: Department) => {
    if (savingDepartmentId || deletingDepartmentId || editingDepartmentId !== target.id) return;

    const name = editingDepartmentName.trim();
    if (!name) {
      setErr("必須項目を入力してください。");
      return;
    }

    if (name === target.name) {
      cancelEditingDepartment();
      return;
    }

    setSavingDepartmentId(target.id);
    setErr(null);
    try {
      const updated = await apiFetchJson<Department>(`/api/admin/departments/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      await loadDepartments();
      if (department === target.name) {
        setDepartment(updated.name);
      }
      setEditingDepartmentId(null);
      setEditingDepartmentName("");
    } catch (e: unknown) {
      const message = handleApiError(e);
      if (message) setErr(message);
    } finally {
      setSavingDepartmentId(null);
    }
  };

  // 笨・驛ｨ鄂ｲ蜑企勁・・onfirm modal・・
  const onDeleteDepartment = async (target: Department) => {
    if (deletingDepartmentId || savingDepartment) return;

    openConfirm({
      title: "削除の確認",
      message: `部署「${target.name}」を削除します。よろしいですか？`,
      dangerOk: true,
      okText: "削除する",
      cancelText: "キャンセル",
      action: async () => {
        setDeletingDepartmentId(target.id);
        setErr(null);
        try {
          await apiFetchJson<{ ok: boolean }>(`/api/admin/departments/${target.id}`, {
            method: "DELETE",
          });
          setDepartments((prev) => prev.filter((item) => item.id !== target.id));
          if (department === target.name) {
            const remaining = departments.filter((item) => item.id !== target.id);
            setDepartment(remaining[0]?.name ?? "");
          }
          if (editingDepartmentId === target.id) {
            cancelEditingDepartment();
          }
        } catch (e: unknown) {
          const message = handleApiError(e);
          if (message) setErr(message);
        } finally {
          setDeletingDepartmentId(null);
        }
      },
    });
  };

  // ・医％縺薙°繧我ｸ九・縲√≠縺ｪ縺溘・迴ｾ陦袈I謾ｹ騾迚医↓蜷医ｏ縺帙※縺昴・縺ｾ縺ｾ・・
  const labelStyle: React.CSSProperties = {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 6,
    textAlign: "center",
    lineHeight: 1.2,
  };

  const selectStyle: React.CSSProperties = {
    height: 48,
    borderRadius: 6,
    border: "1px solid #cbd5e1",
    padding: "0 12px",
    width: "100%",
    fontSize: 16,
    lineHeight: "48px",
  };

  const inputStyle: React.CSSProperties = {
    fontSize: 16,
    padding: "12px 12px",
  };

  const createButtonWrapStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "flex-end",
  };

  const createButtonStyle: React.CSSProperties = {
    width: "100%",
    fontSize: 16,
    padding: "12px 12px",
  };

  return (
    <main className="admin-users-page">
      <ConfirmModal
        open={confirmOpen}
        title={confirmTitle}
        message={confirmMessage}
        okText={confirmOkText}
        cancelText={confirmCancelText}
        busy={confirmBusy}
        dangerOk={confirmDanger}
        onOk={runConfirmAction}
        onCancel={closeConfirm}
      />

      <h1>ユーザー・部署管理</h1>

      <section className="card-surface" style={{ marginTop: 12, padding: 12 }}>
        <h2 style={{ marginBottom: 8 }}>ユーザー作成</h2>

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <div>
            <div style={labelStyle}>ユーザーID</div>
            <Input value={userCode} onChange={(e) => setUserCode(e.target.value)} placeholder="" style={inputStyle} />
          </div>

          <div>
            <div style={labelStyle}>ユーザー名</div>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="" style={inputStyle} />
          </div>

          <div>
            <div style={labelStyle}>メール</div>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="" style={inputStyle} />
          </div>

          <div>
            <div style={labelStyle}>部署</div>
            <select value={department} onChange={(e) => setDepartment(e.target.value)} style={selectStyle}>
              {departments.map((item) => (
                <option key={item.id} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={labelStyle}>種別</div>
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} style={selectStyle}>
              {ROLE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={labelStyle}>パスワード</div>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
          </div>

          <div style={createButtonWrapStyle}>
            <Button
              type="button"
              onClick={onCreate}
              disabled={submitting || !department || !userCode.trim() || !username.trim() || !email.trim() || !password}
              style={createButtonStyle}
            >
              {submitting ? "読み込み中..." : "ユーザーを作成"}
            </Button>
          </div>
        </div>
      </section>

      {err ? <p style={{ color: "var(--danger)", marginTop: 12 }}>エラー: {err}</p> : null}

      <section className="card-surface" style={{ marginTop: 12, padding: 12 }}>
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
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>ユーザーID</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>ユーザー名</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>メール</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>部署</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>種別</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>作成日時</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((item) => (
                  <tr key={item.id}>
                    <td style={{ padding: "8px 0" }}>
                      {editingUserId === item.id ? (
                        <Input
                          value={editingUserDraft?.userCode ?? ""}
                          onChange={(e) =>
                            setEditingUserDraft((prev) => (prev ? { ...prev, userCode: e.target.value } : prev))
                          }
                          style={inputStyle}
                        />
                      ) : (
                        item.userCode
                      )}
                    </td>
                    <td style={{ padding: "8px 0" }}>
                      {editingUserId === item.id ? (
                        <Input
                          value={editingUserDraft?.username ?? ""}
                          onChange={(e) =>
                            setEditingUserDraft((prev) =>
                              prev ? { ...prev, username: e.target.value } : prev,
                            )
                          }
                          style={inputStyle}
                        />
                      ) : (
                        item.username
                      )}
                    </td>
                    <td style={{ padding: "8px 0" }}>
                      {editingUserId === item.id ? (
                        <Input
                          value={editingUserDraft?.email ?? ""}
                          onChange={(e) =>
                            setEditingUserDraft((prev) => (prev ? { ...prev, email: e.target.value } : prev))
                          }
                          style={inputStyle}
                        />
                      ) : (
                        item.email
                      )}
                    </td>
                    <td style={{ padding: "8px 0" }}>
                      {editingUserId === item.id ? (
                        <select
                          value={editingUserDraft?.department ?? ""}
                          onChange={(e) =>
                            setEditingUserDraft((prev) =>
                              prev ? { ...prev, department: e.target.value } : prev,
                            )
                          }
                          style={selectStyle}
                        >
                          {departments.map((departmentItem) => (
                            <option key={departmentItem.id} value={departmentItem.name}>
                              {departmentItem.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        item.department
                      )}
                    </td>
                    <td style={{ padding: "8px 0" }}>
                      {editingUserId === item.id ? (
                        <select
                          value={editingUserDraft?.role ?? "user"}
                          onChange={(e) =>
                            setEditingUserDraft((prev) =>
                              prev ? { ...prev, role: e.target.value as Role } : prev,
                            )
                          }
                          style={selectStyle}
                        >
                          {ROLE_OPTIONS.map((roleOption) => (
                            <option key={roleOption.value} value={roleOption.value}>
                              {roleOption.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        getRoleLabel(item.role)
                      )}
                    </td>
                    <td style={{ padding: "8px 0" }}>{formatDateTime(item.createdAt)}</td>
                    <td style={{ padding: "8px 0" }}>
                      {editingUserId === item.id ? (
                        <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
                          <Button
                            type="button"
                            onClick={() => void onSaveUser(item)}
                            disabled={savingUserId === item.id}
                          >
                            {savingUserId === item.id ? "保存中..." : "保存"}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={cancelEditingUser}
                            disabled={savingUserId !== null}
                          >
                            キャンセル
                          </Button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
                          <Button
                            type="button"
                            onClick={() => startEditingUser(item)}
                            disabled={deletingId !== null || savingUserId !== null || editingUserId !== null}
                          >
                            編集
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            disabled={deletingId !== null || savingUserId !== null}
                            onClick={() => void onDelete(item)}
                          >
                            {deletingId === item.id ? "削除中..." : "削除"}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setUserPage((prev) => prev - 1)}
                disabled={userPage <= 1 || loadingUsers}
              >
                前へ
              </Button>

              <span>
                {userPage} / {totalUserPages} {userTotal}件
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

      <section className="card-surface" style={{ marginTop: 12, padding: 12 }}>
        <h2 style={{ marginBottom: 8 }}>部署管理</h2>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: "0 1 320px", minWidth: 220 }}>
            <Input value={newDepartmentName} onChange={(e) => setNewDepartmentName(e.target.value)} placeholder="部署名" />
          </div>
          <Button type="button" onClick={onAddDepartment} disabled={savingDepartment || !newDepartmentName.trim()}>
            {savingDepartment ? "読み込み中..." : "部署を追加"}
          </Button>
        </div>

        <div style={{ marginTop: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>部署名</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((item) => (
                <tr key={item.id}>
                  <td style={{ padding: "8px 0" }}>
                    {editingDepartmentId === item.id ? (
                      <Input
                        value={editingDepartmentName}
                        onChange={(e) => setEditingDepartmentName(e.target.value)}
                        style={inputStyle}
                      />
                    ) : (
                      item.name
                    )}
                  </td>
                  <td style={{ padding: "8px 0" }}>
                    {editingDepartmentId === item.id ? (
                      <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
                        <Button
                          type="button"
                          onClick={() => void onSaveDepartment(item)}
                          disabled={savingDepartmentId === item.id || !editingDepartmentName.trim()}
                        >
                          {savingDepartmentId === item.id ? "保存中..." : "保存"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={savingDepartmentId !== null}
                          onClick={cancelEditingDepartment}
                        >
                          キャンセル
                        </Button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
                        <Button
                          type="button"
                          onClick={() => startEditingDepartment(item)}
                          disabled={
                            deletingDepartmentId !== null ||
                            savingDepartment ||
                            savingDepartmentId !== null ||
                            editingDepartmentId !== null
                          }
                        >
                          編集
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          disabled={deletingDepartmentId !== null || savingDepartmentId !== null || editingDepartmentId !== null}
                          onClick={() => void onDeleteDepartment(item)}
                        >
                          {deletingDepartmentId === item.id ? "削除中..." : "削除"}
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card-surface" style={{ marginTop: 12, padding: 12 }}>
        <h2 style={{ marginBottom: 8 }}>申請待ち一覧</h2>

        {loadingPending ? (
          <p>読み込み中...</p>
        ) : pendingRequests.length === 0 ? (
          <p>申請待ちはありません。</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>部署</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>ユーザー名</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>メール</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>申請日時</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>ステータス</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>操作</th>
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
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <Button type="button" onClick={() => onApprove(item.id)} disabled={approvingId !== null}>
                        {approvingId === item.id ? "承認中..." : "承認"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <style jsx>{`
        .admin-users-page > h1 {
          font-size: 28px;
          line-height: 1.2;
          margin: 0 0 12px;
        }

        .admin-users-page :global(table) {
          width: 100%;
          border-collapse: collapse;
          background: #ffffff;
          border: 1px solid #e2e8f0;
        }

        .admin-users-page :global(table th),
        .admin-users-page :global(table td) {
          text-align: center !important;
          vertical-align: middle;
          padding: 10px 12px !important;
          border-bottom: 1px solid #e2e8f0 !important;
          line-height: 1.4;
        }

        .admin-users-page :global(table th) {
          background: #f8fafc !important;
          font-weight: 700 !important;
        }
      `}</style>
    </main>
  );
}
