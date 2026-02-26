"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "../../../../src/components/ui/Button";
import { formatDateJa } from "../../../../src/utils/format";
import { Table, Td, Th } from "../../../../src/components/ui/Table";
import { apiFetchJson, getHttpErrorMessage, isHttpError } from "../../../../src/utils/http";

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
  const router = useRouter();

  const handleApiError = (error: unknown): string | null => {
    if (isHttpError(error) && error.status === 401) {
      router.push("/login");
      return null;
    }

    if (isHttpError(error) && error.status === 403) {
      router.push("/tools");
      return null;
    }

    return getHttpErrorMessage(error);
  };

  const loadData = useCallback(async () => {
    try {
      const [r, w] = await Promise.all([
        apiFetchJson<AdminReturnGroup[]>("/api/admin/returns"),
        apiFetchJson<Warehouse[]>("/api/warehouses"),
      ]);
      setGroups(
        r
          .map((group) => ({
            ...group,
            items: (group.items || []).filter(Boolean),
          }))
          .sort((a, b) => b.boxNo - a.boxNo),
      );
      setWarehouses(w);
      setSelectedToolIdsByBox({});
      setErr(null);
    } catch (e: unknown) {
      const message = handleApiError(e);
      if (message) setErr(message);
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
      await apiFetchJson<{ ok: true } & Record<string, unknown>>("/api/admin/returns/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await loadData();
      if (isPartial) {
        setSelectedToolIdsByBox((prev) => {
          const next = { ...prev };
          delete next[boxId];
          return next;
        });
      }
    } catch (e: unknown) {
      const message = handleApiError(e);
      if (message) setErr(message);
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
  if (err) return <main style={{ padding: 16 }}><p style={{ color: "#b91c1c" }}>error: {err}</p></main>;

  return (
    <main style={{ padding: 16 }}>
      <h1>返却承認</h1>

      {groups.length === 0 ? (
        <p>承認待ちの返却申請はありません。</p>
      ) : (
        groups.map((group) => {
          const selected = selectedForBox(group.boxId);
          const isBusy = submitting.has(group.boxId);
          const requestedItems = group.items.filter(Boolean);
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
                  {isBusy ? "処理中..." : "一括承認"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={selected.size === 0 || isBusy}
                  onClick={() => onApproveSelected(group.boxId)}
                >
                  {isBusy ? "処理中..." : "部分承認"}
                </Button>
              </div>
              <Table>
                <thead>
                  <tr>
                    <Th>選択</Th>
                    <Th>工具名</Th>
                    <Th>資産番号</Th>
                    <Th>倉庫</Th>
                    <Th>期限</Th>
                    <Th>申請日時</Th>
                  </tr>
                </thead>
                <tbody>
                  {requestedItems.map((item) => {
                    const checked = selected.has(item.toolId);
                    return (
                      <tr key={`${group.boxId}:${item.toolId}`}>
                        <Td>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isBusy}
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
