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
};

export default function AdminWarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
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
      await apiFetchJson<{ id: string; name: string }>("/api/admin/warehouses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      setName("");
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

      <div className="card-surface" style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", marginBottom: 12, padding: 12 }}>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="倉庫名" />
        <Button type="button" onClick={onAdd} disabled={submitting}>
          {submitting ? "作成中..." : "作成"}
        </Button>
      </div>

      <table className="card-surface" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0 8px 12px" }}>倉庫名</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {warehouses.map((warehouse) => (
            <tr key={warehouse.id}>
              <td style={{ padding: "8px 0 8px 12px" }}>{warehouse.name}</td>
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
