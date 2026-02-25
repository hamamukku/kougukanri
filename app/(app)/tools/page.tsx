"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "../../../src/components/ui/Button";
import Input from "../../../src/components/ui/Input";
import Select from "../../../src/components/ui/Select";
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

const PAGE_SIZE = 25;

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());

  const [q, setQ] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

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

  const filteredTools = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return tools.filter((t) => {
      if (qq && !t.name.toLowerCase().includes(qq)) return false;
      if (warehouseFilter !== "all" && t.warehouseId !== warehouseFilter) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      return true;
    });
  }, [tools, q, warehouseFilter, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [q, warehouseFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredTools.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pageTools = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredTools.slice(start, start + PAGE_SIZE);
  }, [filteredTools, page]);

  const onAdd = (id: string) => {
    setAdded((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

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

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, marginTop: 12 }}>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>検索（工具名）</div>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="例: 工具050"
          />
        </div>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>倉庫</div>
          <Select
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
          >
            <option value="all">全て</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>状態</div>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">全て</option>
            <option value="available">available</option>
            <option value="loaned">loaned</option>
            <option value="repairing">repairing</option>
            <option value="lost">lost</option>
          </Select>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
        <div>表示件数: {filteredTools.length}</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Button
            type="button"
            variant="ghost"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </Button>
          <div>
            {page} / {totalPages}
          </div>
          <Button
            type="button"
            variant="ghost"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </Button>
        </div>
      </div>

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
          {pageTools.map((t) => {
            const isAdded = added.has(t.id);
            const isLoaned = t.status === "loaned";
            const disabled = isLoaned || isAdded;
            const label = isLoaned ? "貸出中" : isAdded ? "追加済み" : "貸出に追加";

            return (
              <tr key={t.id}>
                <Td>{t.name}</Td>
                <Td>{warehouseNameById.get(t.warehouseId) ?? t.warehouseId}</Td>
                <Td>{t.status}</Td>
                <Td>
                  <Button type="button" disabled={disabled} onClick={() => onAdd(t.id)}>
                    {label}
                  </Button>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </main>
  );
}
