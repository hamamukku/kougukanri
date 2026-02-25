"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "../../../src/components/ui/Button";
import { Table, Td, Th } from "../../../src/components/ui/Table";
import { statusLabel } from "../../../src/utils/format";

type MyBox = {
  box: {
    id: string;
    ownerUsername: string;
    boxNo: number;
    startDate: string;
    dueDate: string;
    status: "open" | "closed";
  };
  items: Array<{
    boxId: string;
    toolId: string;
    toolName: string;
    assetNo: string;
    warehouseId: string;
    dueOverride?: string;
    dueEffective: string;
    status: string;
    returnStatus?: "none" | "requested" | "approved";
    requestedAt?: string;
  }>;
};

type Warehouse = {
  id: string;
  name: string;
};

export default function MyLoansPage() {
  const [boxes, setBoxes] = useState<MyBox[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [requesting, setRequesting] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    try {
      const [myBoxesRes, warehouseRes] = await Promise.all([
        fetch("/api/my/boxes?status=open"),
        fetch("/api/warehouses"),
      ]);
      if (!myBoxesRes.ok) throw new Error(`/api/my/boxes ${myBoxesRes.status}`);
      if (!warehouseRes.ok) throw new Error(`/api/warehouses ${warehouseRes.status}`);

      const b = (await myBoxesRes.json()) as MyBox[];
      const w = (await warehouseRes.json()) as Warehouse[];
      setBoxes(
        b
          .map((entry) => ({ ...entry, items: entry.items || [] }))
          .sort((a, bItem) => bItem.box.startDate.localeCompare(a.box.startDate)),
      );
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
    const map = new Map<string, string>();
    for (const w of warehouses) map.set(w.id, w.name);
    return map;
  }, [warehouses]);

  const onRequestReturn = async (boxId: string, toolId: string) => {
    const key = `${boxId}:${toolId}`;
    setRequesting((prev) => new Set(prev).add(key));
    try {
      const res = await fetch("/api/my/returns/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boxId, toolId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const msg =
          body && typeof body === "object" && "message" in body
            ? String((body as { message?: unknown }).message)
            : `request failed ${res.status}`;
        throw new Error(msg);
      }
      await loadData();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setRequesting((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  if (loading) return <main style={{ padding: 16 }}>loading...</main>;
  if (err) return <main style={{ padding: 16 }}><pre>error: {err}</pre></main>;

  return (
    <main style={{ padding: 16 }}>
      <h1>My Loans</h1>

      {boxes.length === 0 ? (
        <p>現在、開いている借り出しはありません</p>
      ) : (
        boxes.map((box) => (
          <section key={box.box.id} style={{ marginBottom: 24 }}>
            <h2 style={{ marginBottom: 4 }}>
              {box.box.ownerUsername}-ボックス{box.box.boxNo}
            </h2>
            <p style={{ marginTop: 0 }}>
              開始日: {box.box.startDate} / 期限日: {box.box.dueDate}
            </p>
            <Table>
              <thead>
                <tr>
                  <Th>ツール名</Th>
                  <Th>資産番号</Th>
                  <Th>倉庫</Th>
                  <Th>期限</Th>
                  <Th>状態</Th>
                  <Th>返却申請</Th>
                </tr>
              </thead>
              <tbody>
                {box.items
                  .slice()
                  .sort((a, b) => b.dueEffective.localeCompare(a.dueEffective))
                  .map((item) => {
                    const key = `${box.box.id}:${item.toolId}`;
                    const requested = item.returnStatus === "requested";
                    const busy = requesting.has(key);
                    return (
                      <tr key={key}>
                        <Td>{item.toolName}</Td>
                        <Td>{item.assetNo}</Td>
                        <Td>{warehouseNameById.get(item.warehouseId) ?? item.warehouseId}</Td>
                        <Td>{item.dueEffective}</Td>
                        <Td>{statusLabel(item.status)}</Td>
                        <Td>
                          <Button
                            type="button"
                            disabled={requested || busy}
                            onClick={() => onRequestReturn(box.box.id, item.toolId)}
                          >
                            {requested ? "申請中" : busy ? "申請中..." : "返却申請"}
                          </Button>
                        </Td>
                      </tr>
                    );
                  })}
              </tbody>
            </Table>
          </section>
        ))
      )}
    </main>
  );
}
