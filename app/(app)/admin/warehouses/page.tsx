"use client";

import { useCallback, useEffect, useState } from "react";
import Button from "../../../../src/components/ui/Button";
import Input from "../../../../src/components/ui/Input";
import { HttpError, apiFetchJson } from "../../../../src/utils/http";

type Warehouse = {
  id: string;
  name: string;
};

export default function AdminWarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
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
      const data = await apiFetchJson<Warehouse[]>("/api/admin/warehouses");
      setWarehouses(data);
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
    if (!name.trim()) return;
    if (submitting.has("add")) return;
    setSubmitting((prev) => new Set(prev).add("add"));
    try {
      await apiFetchJson<{ ok: true } & Record<string, unknown>>("/api/admin/warehouses", {
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
      setSubmitting((prev) => {
        const next = new Set(prev);
        next.delete("add");
        return next;
      });
    }
  };

  const onStartEdit = (warehouse: Warehouse) => {
    setEditingId(warehouse.id);
    setEditingName(warehouse.name);
  };

  const onCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const onSave = async (id: string) => {
    const nextName = editingName.trim();
    if (!nextName) return;
    if (submitting.has(id)) return;
    setSubmitting((prev) => new Set(prev).add(id));
    try {
      await apiFetchJson<{ ok: true } & Record<string, unknown>>(`/api/admin/warehouses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextName }),
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

  const onDelete = async (id: string) => {
    if (!window.confirm("この倉庫を削除しますか？")) return;
    if (submitting.has(id)) return;
    setSubmitting((prev) => new Set(prev).add(id));
    try {
      await apiFetchJson<{ ok: true } & Record<string, unknown>>(`/api/admin/warehouses/${id}`, {
        method: "DELETE",
      });
      if (editingId === id) {
        onCancelEdit();
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

  if (loading) return <main style={{ padding: 16 }}>loading...</main>;
  if (err) return <main style={{ padding: 16 }}><p style={{ color: '#b91c1c' }}>error: {err}</p></main>;

  return (
    <main style={{ padding: 16 }}>
      <h1>倉庫管理</h1>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="倉庫名" />
        <Button type="button" onClick={onAdd} disabled={submitting.has("add")}>
          追加
        </Button>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>ID</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>倉庫名</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {warehouses.map((warehouse) => {
            const isEditing = editingId === warehouse.id;
            const isBusy = submitting.has(warehouse.id);
            return (
              <tr key={warehouse.id}>
                <td style={{ padding: "8px 0" }}>{warehouse.id}</td>
                <td style={{ padding: "8px 0" }}>
                  {isEditing ? (
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      disabled={isBusy}
                    />
                  ) : (
                    warehouse.name
                  )}
                </td>
                <td style={{ padding: "8px 0" }}>
                  {isEditing ? (
                    <>
                      <Button type="button" onClick={() => onSave(warehouse.id)} disabled={isBusy}>
                        保存
                      </Button>
                      <Button type="button" variant="ghost" onClick={onCancelEdit} disabled={isBusy}>
                        キャンセル
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button type="button" onClick={() => onStartEdit(warehouse)} disabled={isBusy}>
                        編集
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => onDelete(warehouse.id)} disabled={isBusy}>
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
