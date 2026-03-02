"use client";

import { useCallback, useEffect, useState } from "react";
import Button from "../../../../src/components/ui/Button";
import Input from "../../../../src/components/ui/Input";
import ActionMenu from "../../../../src/components/ui/ActionMenu";
import { useConfirm } from "../../../../src/components/ui/ConfirmProvider";
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
  const { confirm } = useConfirm();

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
    if (!(await confirm({ message: "この倉庫を削除しますか？" }))) return;
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

      <section className="card-surface" style={{ marginTop: 12, padding: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="倉庫名" />
          <Button type="button" onClick={onAdd} disabled={submitting.has("add")}>
            追加
          </Button>
        </div>
      </section>

      <section className="card-surface" style={{ marginTop: 12, padding: 12 }}>
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
                    {isEditing ? <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} disabled={isBusy} /> : warehouse.name}
                  </td>
                  <td style={{ padding: "8px 0" }}>
                    {isEditing ? (
                      <ActionMenu
                        disabled={isBusy}
                        items={[
                          { key: "save", label: "保存", onClick: () => void onSave(warehouse.id), disabled: isBusy },
                          { key: "cancel", label: "キャンセル", onClick: onCancelEdit, disabled: isBusy },
                        ]}
                      />
                    ) : (
                      <ActionMenu
                        disabled={isBusy}
                        items={[
                          { key: "edit", label: "編集", onClick: () => onStartEdit(warehouse), disabled: isBusy },
                          { key: "delete", label: "削除", onClick: () => void onDelete(warehouse.id), danger: true, disabled: isBusy },
                        ]}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </main>
  );
}
