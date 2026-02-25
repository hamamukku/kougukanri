"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "../../../../src/components/ui/Button";
import Input from "../../../../src/components/ui/Input";
import { statusLabel } from "../../../../src/utils/format";
import { Table, Td, Th } from "../../../../src/components/ui/Table";

type Warehouse = {
  id: string;
  name: string;
};

type ToolStatus = "available" | "loaned" | "repairing" | "lost";

type Tool = {
  id: string;
  name: string;
  assetNo: string;
  warehouseId: string;
  status: ToolStatus;
};

export default function AdminToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [assetNo, setAssetNo] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [status, setStatus] = useState<ToolStatus>("available");

  const loadData = useCallback(async () => {
    try {
      const [tRes, wRes] = await Promise.all([fetch("/api/admin/tools"), fetch("/api/admin/warehouses")]);
      if (!tRes.ok) throw new Error(`/api/admin/tools ${tRes.status}`);
      if (!wRes.ok) throw new Error(`/api/admin/warehouses ${wRes.status}`);
      const t = (await tRes.json()) as Tool[];
      const w = (await wRes.json()) as Warehouse[];
      setTools(t);
      setWarehouses(w);
      if (!warehouseId && w.length > 0) setWarehouseId(w[0].id);
      setErr(null);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [warehouseId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const mapWarehouse = useMemo(() => {
    const map = new Map<string, string>();
    for (const w of warehouses) map.set(w.id, w.name);
    return map;
  }, [warehouses]);

  const onAdd = async () => {
    if (!name.trim() || !warehouseId) return;
    try {
      const res = await fetch("/api/admin/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          assetNo: assetNo.trim(),
          warehouseId,
          status,
        }),
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
      setAssetNo("");
      setStatus("available");
      await loadData();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  if (loading) return <main style={{ padding: 16 }}>loading...</main>;

  if (err) return <main style={{ padding: 16 }}><p style={{ color: "#b91c1c" }}>error: {err}</p></main>;

  return (
    <main style={{ padding: 16 }}>
      <h1>ツール管理</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>ツール名</div>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="工具名" />
        </div>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>資産番号</div>
          <Input value={assetNo} onChange={(e) => setAssetNo(e.target.value)} placeholder="A-0001" />
        </div>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>倉庫</div>
          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            style={{ height: 36, borderRadius: 6, border: "1px solid #cbd5e1", width: "100%" }}
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>状態</div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ToolStatus)}
            style={{ height: 36, borderRadius: 6, border: "1px solid #cbd5e1", width: "100%" }}
          >
            <option value="available">貸出可</option>
            <option value="loaned">貸出中</option>
            <option value="repairing">修理中</option>
            <option value="lost">紛失</option>
          </select>
        </div>
        <div>
          <Button type="button" onClick={onAdd} disabled={!warehouses.length}>
            追加
          </Button>
        </div>
      </div>

      <div style={{ marginTop: 12 }} />
      <Table>
        <thead>
          <tr>
            <Th>ツール名</Th>
            <Th>資産番号</Th>
            <Th>倉庫</Th>
            <Th>状態</Th>
          </tr>
        </thead>
        <tbody>
          {tools.map((t) => (
            <tr key={t.id}>
              <Td>{t.name}</Td>
              <Td>{t.assetNo}</Td>
              <Td>{mapWarehouse.get(t.warehouseId) ?? t.warehouseId}</Td>
              <Td>{statusLabel(t.status)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </main>
  );
}
