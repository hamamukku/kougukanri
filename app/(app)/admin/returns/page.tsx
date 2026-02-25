"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "../../../../src/components/ui/Button";
import { formatDateJa } from "../../../../src/utils/format";
import { Table, Td, Th } from "../../../../src/components/ui/Table";

type AdminReturnGroup = {
  boxId: string;
  ownerUsername: string;
  boxNo: number;
  startDate: string;
  dueDate: string;
  items: Array<{
    toolId: string;
    toolName: string;
    assetNo: string;
    warehouseId: string;
    dueOverride?: string;
    dueEffective: string;
    requestedAt: string;
  }>;
};

type Warehouse = {
  id: string;
  name: string;
};

export default function AdminReturnsPage() {
  const [groups, setGroups] = useState<AdminReturnGroup[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<Set<string>>(new Set());
  const [selectedToolIdsByBox, setSelectedToolIdsByBox] = useState<Record<string, Set<string>>>({});

  const loadData = useCallback(async () => {
    try {
      const [returnsRes, warehouseRes] = await Promise.all([fetch("/api/admin/returns"), fetch("/api/warehouses")]);
      if (!returnsRes.ok) throw new Error(`/api/admin/returns ${returnsRes.status}`);
      if (!warehouseRes.ok) throw new Error(`/api/warehouses ${warehouseRes.status}`);

      const r = (await returnsRes.json()) as AdminReturnGroup[];
      const w = (await warehouseRes.json()) as Warehouse[];
      setGroups(r.map((group) => ({ ...group, items: group.items || [] })).sort((a, b) => b.boxNo - a.boxNo));
      setWarehouses(w);
      setSelectedToolIdsByBox({});
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

  const selectedForBox = (boxId: string) => {
    const current = selectedToolIdsByBox[boxId];
    return current ?? new Set<string>();
  };

  const toggleTool = (boxId: string, toolId: string, checked: boolean) => {
    setSelectedToolIdsByBox((prev) => {
      const current = new Set(prev[boxId] ? Array.from(prev[boxId]) : []);
      if (checked) current.add(toolId);
      else current.delete(toolId);
      return { ...prev, [boxId]: current };
    });
  };

  const postApprove = async (boxId: string, toolIds?: string[]) => {
    const isPartial = Array.isArray(toolIds);
    setSubmitting((prev) => new Set(prev).add(boxId));
    try {
      const body = toolIds ? { boxId, toolIds } : { boxId };
      const res = await fetch("/api/admin/returns/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const msg =
          body && typeof body === "object" && "message" in body
            ? String((body as { message?: unknown }).message)
            : `approve failed ${res.status}`;
        throw new Error(msg);
      }
      await loadData();
      if (isPartial) {
        setSelectedToolIdsByBox((prev) => {
          const next = { ...prev };
          delete next[boxId];
          return next;
        });
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting((prev) => {
        const next = new Set(prev);
        next.delete(boxId);
        return next;
      });
    }
  };

  const onApproveAll = (boxId: string) => postApprove(boxId);
  const onApproveSelected = (boxId: string) => {
    const ids = Array.from(selectedForBox(boxId));
    if (!ids.length) return;
    postApprove(boxId, ids);
  };

  if (loading) return <main style={{ padding: 16 }}>loading...</main>;
  if (err) return <main style={{ padding: 16 }}><pre>error: {err}</pre></main>;

  return (
    <main style={{ padding: 16 }}>
      <h1>返却承認</h1>

      {groups.length === 0 ? (
        <p>現在、承認対象の返却申請はありません</p>
      ) : (
        groups.map((group) => {
          const selected = selectedForBox(group.boxId);
          const isBusy = submitting.has(group.boxId);
          return (
            <section key={group.boxId} style={{ marginBottom: 24 }}>
              <h2 style={{ marginBottom: 4 }}>
                {group.ownerUsername}-ボックス{group.boxNo}
              </h2>
              <p style={{ marginTop: 0 }}>
                開始日: {group.startDate} / 期限日: {group.dueDate}
              </p>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <Button type="button" disabled={isBusy} onClick={() => onApproveAll(group.boxId)}>
                  ボックス一括承認
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={selected.size === 0 || isBusy}
                  onClick={() => onApproveSelected(group.boxId)}
                >
                  選択分のみ承認
                </Button>
              </div>
              <Table>
                <thead>
                  <tr>
                    <Th>選択</Th>
                    <Th>ツール名</Th>
                    <Th>資産番号</Th>
                    <Th>倉庫</Th>
                    <Th>期限</Th>
                    <Th>申請日時</Th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((item) => {
                    const checked = selected.has(item.toolId);
                    return (
                      <tr key={`${group.boxId}:${item.toolId}`}>
                        <Td>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => toggleTool(group.boxId, item.toolId, e.target.checked)}
                          />
                        </Td>
                        <Td>{item.toolName}</Td>
                        <Td>{item.assetNo}</Td>
                        <Td>{warehouseNameById.get(item.warehouseId) ?? item.warehouseId}</Td>
                        <Td>{item.dueEffective}</Td>
                        <Td>{formatDateJa(item.requestedAt)}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </section>
          );
        })
      )}
    </main>
  );
}
