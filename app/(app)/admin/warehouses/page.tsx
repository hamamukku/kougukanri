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
    }
  };

  if (loading) return <main style={{ padding: 16 }}>loading...</main>;
  if (err) return <main style={{ padding: 16 }}><p style={{ color: "#b91c1c" }}>error: {err}</p></main>;

  return (
    <main style={{ padding: 16 }}>
      <h1>倉庫管理</h1>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="倉庫名" />
        <Button type="button" onClick={onAdd}>
          追加
        </Button>
      </div>

      <ul>
        {warehouses.map((w) => (
          <li key={w.id}>
            {w.id} / {w.name}
          </li>
        ))}
      </ul>
    </main>
  );
}
