"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "../../../src/components/ui/Button";
import { Table, Td, Th } from "../../../src/components/ui/Table";
import { useLoanBox } from "../../../src/state/loanBoxStore";

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

export default function LoanBoxPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const { loanBoxIds, removeFromLoanBox, clearLoanBox } = useLoanBox();

  useEffect(() => {
    (async () => {
      try {
        const [tRes, wRes] = await Promise.all([fetch("/api/tools"), fetch("/api/warehouses")]);
        if (!tRes.ok) throw new Error(`/api/tools ${tRes.status}`);
        if (!wRes.ok) throw new Error(`/api/warehouses ${wRes.status}`);

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

  const loanBoxTools = useMemo(() => {
    return tools.filter((t) => loanBoxIds.has(t.id));
  }, [tools, loanBoxIds]);

  if (loading) return <main style={{ padding: 16 }}>loading...</main>;
  if (err) return <main style={{ padding: 16 }}><pre>error: {err}</pre></main>;

  return (
    <main style={{ padding: 16 }}>
      <h1>貸出ボックス</h1>
      <div style={{ marginTop: 12, marginBottom: 12 }}>
        <Button type="button" variant="ghost" disabled={loanBoxTools.length === 0} onClick={clearLoanBox}>
          箱を空にする
        </Button>
      </div>

      {loanBoxTools.length === 0 ? (
        <p>貸出ボックスは空です</p>
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
            {loanBoxTools.map((t) => (
              <tr key={t.id}>
                <Td>{t.name}</Td>
                <Td>{warehouseNameById.get(t.warehouseId) ?? t.warehouseId}</Td>
                <Td>{t.status}</Td>
                <Td>
                  <Button type="button" onClick={() => removeFromLoanBox(t.id)}>
                    箱から外す
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
