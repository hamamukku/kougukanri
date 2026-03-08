"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "../../../../src/components/ui/Button";
import Input from "../../../../src/components/ui/Input";
import { apiFetchJson, getHttpErrorMessage, isHttpError } from "../../../../src/utils/http";
import { clearAuthSession } from "../../../../src/utils/auth";

type Warehouse = {
  id: string;
  name: string;
  warehouseNo?: string | null;
};

type EditingWarehouseDraft = {
  name: string;
  warehouseNo: string;
};

function ConfirmModal(props: {
  open: boolean;
  title: string;
  message: string;
  okText?: string;
  cancelText?: string;
  busy?: boolean;
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
        <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 10 }}>{props.title}</div>

        <div style={{ fontSize: 16, lineHeight: 1.7, color: "#0f172a" }}>{props.message}</div>

        <div style={{ display: "flex", justifyContent: "center", gap: 14, marginTop: 18 }}>
          <Button type="button" variant="ghost" onClick={props.onCancel} disabled={props.busy} style={modalBtnStyle}>
            {props.cancelText ?? "キャンセル"}
          </Button>

          <Button
            type="button"
            variant="danger"
            onClick={props.onOk}
            disabled={props.busy}
            style={modalBtnStyle}
          >
            {props.busy ? "削除中..." : props.okText ?? "削除する"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminWarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [warehouseNo, setWarehouseNo] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<EditingWarehouseDraft | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<Warehouse | null>(null);
  const router = useRouter();

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

  const loadData = useCallback(async () => {
    try {
      const data = await apiFetchJson<Warehouse[]>("/api/warehouses");
      setWarehouses(data);
      setErr(null);
    } catch (e: unknown) {
      const message = handleApiError(e);
      if (message) setErr(message);
    } finally {
      setLoading(false);
    }
  }, [handleApiError]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const onAdd = async () => {
    if (!name.trim() || submitting) return;
    setSubmitting(true);

    try {
      await apiFetchJson<{ id: string; name: string; warehouseNo?: string | null }>("/api/admin/warehouses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          warehouseNo: warehouseNo.trim() || undefined,
        }),
      });
      setName("");
      setWarehouseNo("");
      await loadData();
    } catch (e: unknown) {
      const message = handleApiError(e);
      if (message) setErr(message);
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (warehouse: Warehouse) => {
    if (deletingId || submitting) return;

    setDeletingId(warehouse.id);
    setErr(null);
    try {
      await apiFetchJson<{ ok: boolean }>(`/api/admin/warehouses/${warehouse.id}`, {
        method: "DELETE",
      });
      await loadData();
    } catch (e: unknown) {
      const message = handleApiError(e);
      if (message) setErr(message);
    } finally {
      setDeletingId(null);
    }
  };

  const openDeleteConfirm = (warehouse: Warehouse) => {
    setConfirmTarget(warehouse);
    setConfirmMessage(`倉庫「${warehouse.name}」を削除します。よろしいですか？`);
    setConfirmOpen(true);
  };

  const closeDeleteConfirm = () => {
    if (confirmBusy) return;
    setConfirmOpen(false);
    setConfirmTarget(null);
  };

  const onConfirmDelete = async () => {
    if (!confirmTarget) return;
    setConfirmBusy(true);

    try {
      await onDelete(confirmTarget);
      setConfirmOpen(false);
      setConfirmTarget(null);
    } finally {
      setConfirmBusy(false);
    }
  };

  const startEditing = (warehouse: Warehouse) => {
    if (deletingId || submitting || savingId) return;
    setEditingId(warehouse.id);
    setEditingDraft({
      name: warehouse.name,
      warehouseNo: warehouse.warehouseNo ?? "",
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingDraft(null);
  };

  const onSave = async (warehouse: Warehouse) => {
    if (editingId !== warehouse.id || !editingDraft || savingId || deletingId) return;

    const editedName = editingDraft.name.trim();
    const editedNo = editingDraft.warehouseNo.trim();
    if (!editedName) {
      setErr("必須項目を入力してください。");
      return;
    }

    setSavingId(warehouse.id);
    setErr(null);
    try {
      await apiFetchJson<{ id: string; name: string; warehouseNo: string | null }>(
        `/api/admin/warehouses/${warehouse.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editedName,
            warehouseNo: editedNo || undefined,
          }),
        },
      );
      cancelEditing();
      await loadData();
    } catch (e: unknown) {
      const message = handleApiError(e);
      if (message) setErr(message);
    } finally {
      setSavingId(null);
    }
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 6,
    textAlign: "center",
    lineHeight: 1.2,
  };

  const inputStyle: React.CSSProperties = {
    fontSize: 16,
    padding: "12px 12px",
  };

  const buttonStyle: React.CSSProperties = {
    width: "auto",
    minWidth: 140,
    height: 52,
    fontSize: 18,
    fontWeight: 800,
    padding: "0 22px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
  };

  if (loading) return <main>読み込み中...</main>;
  if (err)
    return (
      <main>
        <p style={{ color: "var(--danger)" }}>エラー: {err}</p>
      </main>
    );

  return (
    <main>
      <h1>倉庫管理</h1>

      <div
        className="card-surface"
        style={{
          marginTop: 12,
          display: "grid",
          gap: 12,
          alignItems: "end",
          marginBottom: 12,
          padding: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        <div>
          <div style={labelStyle}>倉庫名</div>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="倉庫名" style={inputStyle} />
        </div>

        <div>
          <div style={labelStyle}>倉庫番号（任意）</div>
          <Input
            value={warehouseNo}
            onChange={(e) => setWarehouseNo(e.target.value)}
            placeholder="例: WH-001"
            style={inputStyle}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <Button type="button" onClick={onAdd} disabled={submitting} style={buttonStyle}>
            {submitting ? "登録中..." : "登録"}
          </Button>
        </div>
      </div>

      <table className="card-surface" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0 8px 12px" }}>倉庫名</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>倉庫番号</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {warehouses.map((warehouse) => (
            <tr key={warehouse.id}>
              <td style={{ padding: "8px 0 8px 12px" }}>
                {editingId === warehouse.id ? (
                  <Input
                    value={editingDraft?.name ?? ""}
                    onChange={(e) =>
                      setEditingDraft((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                    }
                  />
                ) : (
                  warehouse.name
                )}
              </td>
              <td style={{ padding: "8px 0" }}>
                {editingId === warehouse.id ? (
                  <Input
                    value={editingDraft?.warehouseNo ?? ""}
                    onChange={(e) =>
                      setEditingDraft((prev) => (prev ? { ...prev, warehouseNo: e.target.value } : prev))
                    }
                    placeholder="未設定"
                  />
                ) : warehouse.warehouseNo && warehouse.warehouseNo.trim() ? (
                  warehouse.warehouseNo
                ) : (
                  "未設定"
                )}
              </td>
              <td style={{ padding: "8px 0", display: "flex", gap: 8 }}>
                {editingId === warehouse.id ? (
                  <>
                    <Button
                      type="button"
                      onClick={() => void onSave(warehouse)}
                      disabled={savingId === warehouse.id || savingId !== null || deletingId !== null}
                    >
                      {savingId === warehouse.id ? "保存中..." : "保存"}
                    </Button>
                    <Button type="button" variant="ghost" onClick={cancelEditing} disabled={savingId !== null}>
                      キャンセル
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      onClick={() => startEditing(warehouse)}
                      disabled={editingId !== null || savingId !== null || deletingId !== null || confirmOpen}
                    >
                      編集
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      disabled={deletingId !== null || confirmOpen}
                      onClick={() => openDeleteConfirm(warehouse)}
                    >
                      {deletingId === warehouse.id ? "削除中..." : "削除"}
                    </Button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ConfirmModal
        open={confirmOpen}
        title="削除の確認"
        message={confirmMessage}
        okText="削除する"
        cancelText="キャンセル"
        busy={confirmBusy}
        onCancel={closeDeleteConfirm}
        onOk={() => void onConfirmDelete()}
      />
    </main>
  );
}
