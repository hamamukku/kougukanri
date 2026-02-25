"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { loanBoxIds, removeFromLoanBox, clearLoanBox } = useLoanBox();

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

  const loanBoxTools = useMemo(() => {
    return tools.filter((t) => loanBoxIds.has(t.id));
  }, [tools, loanBoxIds]);

  const loanBoxIdsList = useMemo(() => loanBoxTools.map((t) => t.id), [loanBoxTools]);

  const onCheckout = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/loans/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: loanBoxIdsList }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const msg =
          body && typeof body === "object" && "message" in body
            ? String((body as { message?: unknown }).message)
            : `checkout failed ${res.status}`;
        throw new Error(msg);
      }

      clearLoanBox();
      await loadData();
      setErr(null);
      alert("貸出を登録しました");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <main style={{ padding: 16 }}>loading...</main>;

  return (
    <main style={{ padding: 16 }}>
      <h1>貸出ボックス</h1>
      <div style={{ marginTop: 12, marginBottom: 12, display: "flex", gap: 8 }}>
        <Button type="button" variant="ghost" disabled={loanBoxTools.length === 0 || submitting} onClick={onCheckout}>
          貸出実行
        </Button>
        <Button type="button" variant="ghost" disabled={loanBoxTools.length === 0 || submitting} onClick={clearLoanBox}>
          箱を空にする
        </Button>
      </div>
      {err ? (
        <p style={{ color: "#b91c1c", marginBottom: 12 }}>error: {err}</p>
      ) : null}

      {loanBoxTools.length === 0 ? <p>貸出ボックスは空です</p> : (
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
