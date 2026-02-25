"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "../../../../src/components/ui/Button";
import { Table, Td, Th } from "../../../../src/components/ui/Table";

type Tool = {
  id: string;
  name: string;
  warehouseId: string;
};
type Warehouse = {
  id: string;
  name: string;
};
type Loan = {
  id: string;
  toolId: string;
  borrower: string;
  note?: string;
  loanedAt: string;
  returnedAt?: string;
  status: "open" | "closed";
};

export default function AdminReturnsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [tRes, wRes, lRes] = await Promise.all([
        fetch("/api/tools"),
        fetch("/api/warehouses"),
        fetch("/api/loans?status=open"),
      ]);

      if (!tRes.ok) throw new Error(`/api/tools ${tRes.status}`);
      if (!wRes.ok) throw new Error(`/api/warehouses ${wRes.status}`);
      if (!lRes.ok) throw new Error(`/api/loans ${lRes.status}`);

      const t = (await tRes.json()) as Tool[];
      const w = (await wRes.json()) as Warehouse[];
      const l = (await lRes.json()) as Loan[];
      setTools(t);
      setWarehouses(w);
      setLoans(l);
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

  const toolById = useMemo(() => {
    const m = new Map<string, Tool>();
    for (const t of tools) m.set(t.id, t);
    return m;
  }, [tools]);

  const rows = loans
    .map((loan) => {
      const tool = toolById.get(loan.toolId);
      return tool
        ? {
            loanId: loan.id,
            toolId: tool.id,
            name: tool.name,
            warehouseId: tool.warehouseId,
            borrower: loan.borrower,
            loanedAt: loan.loanedAt,
          }
        : null;
    })
    .filter(
      (
        row
      ): row is {
        loanId: string;
        toolId: string;
        name: string;
        warehouseId: string;
        borrower: string;
        loanedAt: string;
      } => row !== null
    );

  const onApprove = async (toolId: string) => {
    try {
      const res = await fetch(`/api/loans/return/${toolId}`, { method: "POST" });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const msg =
          body && typeof body === "object" && "message" in body
            ? String((body as { message?: unknown }).message)
            : `return failed ${res.status}`;
        throw new Error(msg);
      }

      await loadData();
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

      {rows.length === 0 ? (
        <p>貸出中の工具はありません</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>工具名</Th>
              <Th>倉庫</Th>
              <Th>借用先</Th>
              <Th>貸出日時</Th>
              <Th>操作</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.loanId}>
                <Td>{row.name}</Td>
                <Td>{warehouseNameById.get(row.warehouseId) ?? row.warehouseId}</Td>
                <Td>{row.borrower}</Td>
                <Td>{fmt(row.loanedAt)}</Td>
                <Td>
                  <Button type="button" onClick={() => onApprove(row.toolId)}>
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

const fmt = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("ja-JP");
};
