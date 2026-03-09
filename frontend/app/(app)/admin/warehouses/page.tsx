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
  address?: string | null;
  warehouseNo?: string | null;
};

type EditingWarehouseDraft = {
  name: string;
  address: string;
  warehouseNo: string;
};

function ConfirmModal(props: {
  open: boolean;
  title: string;
  message: string;
  okText?: string;
  cancelText?: string;
  busy?: boolean;
  onOk: () => Promise<void> | void;
  onCancel: () => void;
}) {
  if (!props.open) return null;

  const buttonStyle: React.CSSProperties = {
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
          <Button type="button" variant="ghost" onClick={props.onCancel} disabled={props.busy} style={buttonStyle}>
            {props.cancelText ?? "キャンセル"}
          </Button>

          <Button type="button" variant="danger" onClick={props.onOk} disabled={props.busy} style={buttonStyle}>
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
  const [address, setAddress] = useState("");
  const [warehouseNo, setWarehouseNo] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<EditingWarehouseDraft | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<Warehouse | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
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
      const data = await apiFetchJson<Warehouse[]>("/api/admin/warehouses");
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
    if (!name.trim() || !warehouseNo.trim() || submitting) return;

    setSubmitting(true);
    setErr(null);
    try {
      await apiFetchJson<Warehouse>("/api/admin/warehouses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          address: address.trim() || undefined,
          warehouseNo: warehouseNo.trim(),
        }),
      });
      setName("");
      setAddress("");
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

  const startEditing = (warehouse: Warehouse) => {
    if (editingId !== null || deletingId !== null || savingId !== null || confirmOpen) return;
    setEditingId(warehouse.id);
    setEditingDraft({
      name: warehouse.name,
      address: warehouse.address ?? "",
      warehouseNo: warehouse.warehouseNo ?? "",
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingDraft(null);
  };

  const onSave = async (warehouse: Warehouse) => {
    if (editingId !== warehouse.id || !editingDraft || savingId || deletingId || submitting) return;

    const editedName = editingDraft.name.trim();
    if (!editedName) {
      setErr("必須項目を入力してください。");
      return;
    }

    setSavingId(warehouse.id);
    setErr(null);
    try {
      await apiFetchJson<Warehouse>(`/api/admin/warehouses/${warehouse.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editedName,
          address: editingDraft.address.trim(),
          warehouseNo: editingDraft.warehouseNo.trim(),
        }),
      });
      cancelEditing();
      await loadData();
    } catch (e: unknown) {
      const message = handleApiError(e);
      if (message) setErr(message);
    } finally {
      setSavingId(null);
    }
  };

  const openDeleteConfirm = (warehouse: Warehouse) => {
    setConfirmTarget(warehouse);
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

  const addressCellStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: 360,
    margin: "0 auto",
    whiteSpace: "normal",
    wordBreak: "break-word",
    lineHeight: 1.5,
  };

  if (loading) return <main>loading...</main>;
  if (err)
    return (
      <main>
        <p style={{ color: "var(--danger)" }}>error: {err}</p>
      </main>
    );

  return (
    <main className="admin-warehouses-page">
      <h1>場所管理</h1>

      <div className="card-surface warehouses-form" style={{ marginTop: 12, marginBottom: 12, padding: 12 }}>
        <div>
          <div style={labelStyle}>場所名</div>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="" style={inputStyle} />
        </div>

        <div>
          <div style={labelStyle}>住所</div>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="" style={inputStyle} />
        </div>

        <div>
          <div style={labelStyle}>管理番号</div>
          <Input
            value={warehouseNo}
            onChange={(e) => setWarehouseNo(e.target.value)}
            placeholder=""
            style={inputStyle}
          />
        </div>

        <div className="warehouses-form-button">
          <Button type="button" onClick={onAdd} disabled={submitting} style={buttonStyle}>
            {submitting ? "登録中..." : "登録"}
          </Button>
        </div>
      </div>

      <table className="card-surface admin-warehouses-table" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>場所名</th>
            <th>住所</th>
            <th>管理番号</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {warehouses.map((warehouse) => (
            <tr key={warehouse.id}>
              <td>
                {editingId === warehouse.id ? (
                  <Input
                    value={editingDraft?.name ?? ""}
                    onChange={(e) => setEditingDraft((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                    style={inputStyle}
                  />
                ) : (
                  warehouse.name
                )}
              </td>
              <td>
                {editingId === warehouse.id ? (
                  <Input
                    value={editingDraft?.address ?? ""}
                    onChange={(e) => setEditingDraft((prev) => (prev ? { ...prev, address: e.target.value } : prev))}
                    style={inputStyle}
                  />
                ) : warehouse.address && warehouse.address.trim() ? (
                  <div style={addressCellStyle}>{warehouse.address}</div>
                ) : (
                  "未設定"
                )}
              </td>
              <td>
                {editingId === warehouse.id ? (
                  <Input
                    value={editingDraft?.warehouseNo ?? ""}
                    onChange={(e) =>
                      setEditingDraft((prev) => (prev ? { ...prev, warehouseNo: e.target.value } : prev))
                    }
                    style={inputStyle}
                  />
                ) : warehouse.warehouseNo && warehouse.warehouseNo.trim() ? (
                  warehouse.warehouseNo
                ) : (
                  "未設定"
                )}
              </td>
              <td>
                {editingId === warehouse.id ? (
                  <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
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
                  </div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
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
                      onClick={() => openDeleteConfirm(warehouse)}
                      disabled={deletingId !== null || confirmOpen || savingId !== null}
                    >
                      {deletingId === warehouse.id ? "削除中..." : "削除"}
                    </Button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ConfirmModal
        open={confirmOpen}
        title="削除の確認"
        message={confirmTarget ? `場所「${confirmTarget.name}」を削除します。よろしいですか？` : ""}
        okText="削除する"
        cancelText="キャンセル"
        busy={confirmBusy}
        onCancel={closeDeleteConfirm}
        onOk={() => void onConfirmDelete()}
      />

      <style jsx>{`
        .admin-warehouses-page > h1 {
          font-size: 28px;
          line-height: 1.2;
          margin: 0 0 12px;
        }

        .warehouses-form {
          display: grid;
          gap: 12px;
          align-items: end;
          grid-template-columns: minmax(180px, 1fr) minmax(260px, 1.4fr) minmax(200px, 1fr) auto;
        }

        .warehouses-form-button {
          display: flex;
          justify-content: flex-start;
        }

        .admin-warehouses-table {
          background: #ffffff;
          border: 1px solid #e2e8f0 !important;
        }

        .admin-warehouses-table th,
        .admin-warehouses-table td {
          text-align: center !important;
          vertical-align: middle;
          padding: 10px 12px !important;
          border-bottom: 1px solid #e2e8f0 !important;
          line-height: 1.4;
        }

        .admin-warehouses-table th {
          background: #f8fafc !important;
          font-weight: 700 !important;
        }

        @media (max-width: 960px) {
          .warehouses-form {
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          }
        }
      `}</style>
    </main>
  );
}
