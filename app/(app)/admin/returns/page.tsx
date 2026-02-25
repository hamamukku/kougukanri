"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "../../../../src/components/ui/Button";
import { Table, Td, Th } from "../../../../src/components/ui/Table";

type Tool = {
  id: string;
  name: string;
  warehouseId: string;
  status: string;
};
type Warehouse = {
  id: string;
  name: string;
};

export default function AdminReturnsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [tRes, wRes] = await Promise.all([fetch("/api/tools"), fetch("/api/warehouses")]);
      if (!tRes.ok) throw new Error(`/api/tools ${tRes.status}`);
      if (!wRes.ok) throw new Error(`/api/warehouses ${wRes.status}`);

      const t = (await tRes.json()) as Tool[];
      const w = (await wRes.json()) as Warehouse[];
      setTools(t);
      setWarehouses(w);
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

  const warehouseNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of warehouses) m.set(w.id, w.name);
    return m;
  }, [warehouses]);

  const loanedTools = useMemo(() => tools.filter((t) => t.status === "loaned"), [tools]);

  const onApprove = async (tool: Tool) => {
    try {
      const res = await fetch(`/api/admin/returns/${tool.id}/approve`, { method: "POST" });
      if (!res.ok) {
        throw new Error(`/api/admin/returns/${tool.id}/approve ${res.status}`);
      }

      await loadData();
      alert(`返却承認しました: ${tool.name}`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  if (loading) return <main style={{ padding: 16 }}>loading...</main>;

  if (err) {
    return (
      <main style={{ padding: 16 }}>
        <pre>error: {err}</pre>
      </main>
    );
  }

  return (
    <main style={{ padding: 16 }}>
      <h1>返却承認</h1>

      {loanedTools.length === 0 ? (
        <p>貸出中の工具はありません</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>工具名</Th>
              <Th>倉庫</Th>
              <Th>状態</Th>
              <Th>操作</Th>
            </tr>
          </thead>
          <tbody>
            {loanedTools.map((t) => (
              <tr key={t.id}>
                <Td>{t.name}</Td>
                <Td>{warehouseNameById.get(t.warehouseId) ?? t.warehouseId}</Td>
                <Td>{t.status}</Td>
                <Td>
                  <Button type="button" onClick={() => onApprove(t)}>
                    返却承認
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </main>
  );
}
