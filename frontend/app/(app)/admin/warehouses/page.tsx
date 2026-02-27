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
};

export default function AdminWarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
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
    loadData();
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

  if (loading) return <main style={{ padding: 16 }}>loading...</main>;
  if (err)
    return (
      <main style={{ padding: 16 }}>
        <p style={{ color: "#b91c1c" }}>error: {err}</p>
      </main>
    );

  return (
    <main style={{ padding: 16 }}>
      <h1>倉庫作成</h1>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="倉庫名" />
        <Button type="button" onClick={onAdd} disabled={submitting}>
          {submitting ? "作成中..." : "作成"}
        </Button>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>ID</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>倉庫名</th>
          </tr>
        </thead>
        <tbody>
          {warehouses.map((warehouse) => (
            <tr key={warehouse.id}>
              <td style={{ padding: "8px 0" }}>{warehouse.id}</td>
              <td style={{ padding: "8px 0" }}>{warehouse.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
