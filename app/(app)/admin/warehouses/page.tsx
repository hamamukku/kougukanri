"use client";

import { useCallback, useEffect, useState } from "react";
import Button from "../../../../src/components/ui/Button";
import Input from "../../../../src/components/ui/Input";

type Warehouse = {
  id: string;
  name: string;
};

export default function AdminWarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/warehouses");
      if (!res.ok) throw new Error(`/api/admin/warehouses ${res.status}`);
      const data = (await res.json()) as Warehouse[];
      setWarehouses(data);
      setErr(null);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
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
      const res = await fetch("/api/admin/warehouses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const msg =
          body && typeof body === "object" && "message" in body
            ? String((body as { message?: unknown }).message)
            : `add failed ${res.status}`;
        throw new Error(msg);
      }
      setName("");
      await loadData();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
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
