// frontend/app/(app)/admin/warehouses/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "../../../../src/components/ui/Button";
import Input from "../../../../src/components/ui/Input";
import ActionMenu from "../../../../src/components/ui/ActionMenu";
import { apiFetchJson, getHttpErrorMessage, isHttpError } from "../../../../src/utils/http";
import { clearAuthSession } from "../../../../src/utils/auth";

type Warehouse = {
  id: string;
  name: string;
  warehouseNo?: string | null;
};

export default function AdminWarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [warehouseNo, setWarehouseNo] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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

    const confirmed = window.confirm(`倉庫「${warehouse.name}」を削除します。よろしいですか？`);
    if (!confirmed) return;

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

  // ラベル大きく + 中央寄せ（入力欄の中央に合わせる）
  const labelStyle: React.CSSProperties = {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 6,
    textAlign: "center",
    lineHeight: 1.2,
  };

  // 入力欄も他ページと揃える（高さ・文字サイズ）
  const inputStyle: React.CSSProperties = {
    fontSize: 16,
    padding: "12px 12px",
  };

  // ✅ ボタンは「大きいけど横に伸びない」
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

  if (loading) return <main>loading...</main>;
  if (err)
    return (
      <main>
        <p style={{ color: "var(--danger)" }}>error: {err}</p>
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
              <td style={{ padding: "8px 0 8px 12px" }}>{warehouse.name}</td>
              <td style={{ padding: "8px 0" }}>
                {warehouse.warehouseNo && warehouse.warehouseNo.trim() ? warehouse.warehouseNo : "未設定"}
              </td>
              <td style={{ padding: "8px 0" }}>
                <ActionMenu
                  disabled={deletingId !== null}
                  items={[
                    {
                      key: "delete",
                      label: deletingId === warehouse.id ? "削除中..." : "削除",
                      onClick: () => void onDelete(warehouse),
                      danger: true,
                      disabled: deletingId !== null,
                    },
                  ]}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}