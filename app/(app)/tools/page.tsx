"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "../../../src/components/ui/Button";
import { Table, Td, Th } from "../../../src/components/ui/Table";

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

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [tRes, wRes] = await Promise.all([
          fetch("/api/tools"),
          fetch("/api/warehouses"),
        ]);

        if (!tRes.ok) {
          throw new Error(`/api/tools ${tRes.status}`);
        }

        if (!wRes.ok) {
          throw new Error(`/api/warehouses ${wRes.status}`);
        }

        const t = (await tRes.json()) as Tool[];
        const w = (await wRes.json()) as Warehouse[];
        setTools(t);
        setWarehouses(w);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const warehouseNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of warehouses) m.set(w.id, w.name);
    return m;
  }, [warehouses]);

  if (loading) {
    return <main style={{ padding: 16 }}>loading...</main>;
  }

  if (err) {
    return (
      <main style={{ padding: 16 }}>
        <pre>error: {err}</pre>
      </main>
    );
  }

  return (
    <main style={{ padding: 16 }}>
      <h1>工具一覧</h1>

      <div style={{ height: 12 }} />

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
          {tools.map((t) => (
            <tr key={t.id}>
              <Td>{t.name}</Td>
              <Td>{warehouseNameById.get(t.warehouseId) ?? t.warehouseId}</Td>
              <Td>{t.status}</Td>
              <Td>
                <Button type="button">貸出に追加</Button>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </main>
  );
}