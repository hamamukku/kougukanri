// frontend/app/(app)/admin/returns/page.tsx
﻿"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "../../../../src/components/ui/Button";
import { formatDateJa } from "../../../../src/utils/format";
import { Table, Td, Th } from "../../../../src/components/ui/Table";
import { apiFetchJson, getHttpErrorMessage, isHttpError } from "../../../../src/utils/http";
import { clearAuthSession } from "../../../../src/utils/auth";

type AdminReturnGroup = {
  boxId: string;
  boxDisplayName: string;
  borrowerUsername: string;
  startDate: string;
  dueDate: string;
  items: Array<{
    loanItemId: string;
    toolId: string;
    assetNo: string;
    toolName: string;
    startDate: string;
    dueDate: string;
    returnRequestedAt: string;
  }>;
};

export default function AdminReturnsPage() {
  const [groups, setGroups] = useState<AdminReturnGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<Set<string>>(new Set());
  const [selectedLoanItemIdsByBox, setSelectedLoanItemIdsByBox] = useState<Record<string, Set<string>>>({});
  const router = useRouter();

  const handleApiError = useCallback(
    (error: unknown): string | null => {
      if (isHttpError(error) && error.status === 401) {
        clearAuthSession();
        router.push("/login");
        return null;
      }

      if (isHttpError(error) && error.status === 403) {
        router.push("/tools");
        return null;
      }

      return getHttpErrorMessage(error);
    },
    [router],
  );

  const loadData = useCallback(async () => {
    try {
      const response = await apiFetchJson<AdminReturnGroup[]>("/api/admin/returns/requests");
      setGroups(response ?? []);
      setSelectedLoanItemIdsByBox({});
      setErr(null);
    } catch (e: unknown) {
      const message = handleApiError(e);
      if (message) setErr(message);
    } finally {
      setLoading(false);
    }
  }, [handleApiError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedForBox = useCallback(
    (boxId: string) => {
      const current = selectedLoanItemIdsByBox[boxId];
      return current ?? new Set<string>();
    },
    [selectedLoanItemIdsByBox],
  );

  const toggleLoanItem = (boxId: string, loanItemId: string, checked: boolean) => {
    setSelectedLoanItemIdsByBox((prev) => {
      const current = new Set(prev[boxId] ? Array.from(prev[boxId]) : []);
      if (checked) current.add(loanItemId);
      else current.delete(loanItemId);
      return { ...prev, [boxId]: current };
    });
  };

  const postApprove = async (boxId: string, loanItemIds?: string[]) => {
    const isPartial = Array.isArray(loanItemIds);
    setSubmitting((prev) => new Set(prev).add(boxId));
    try {
      if (isPartial) {
        await apiFetchJson<{ approvedCount: number }>("/api/admin/returns/approve-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ boxId, loanItemIds }),
        });
      } else {
        await apiFetchJson<{ approvedCount: number }>("/api/admin/returns/approve-box", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ boxId }),
        });
      }

      await loadData();
      if (isPartial) {
        setSelectedLoanItemIdsByBox((prev) => {
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

  const groupedSorted = useMemo(() => {
    return groups.slice().sort((a, b) => {
      const aTs = new Date(a.items[0]?.returnRequestedAt ?? 0).getTime();
      const bTs = new Date(b.items[0]?.returnRequestedAt ?? 0).getTime();
      return bTs - aTs;
    });
  }, [groups]);

  const checkboxStyle: React.CSSProperties = {
    width: 22,
    height: 22,
    transform: "scale(1.25)",
    transformOrigin: "center",
    cursor: "pointer",
  };

  if (loading) return <main style={{ padding: 16 }}>loading...</main>;
  if (err)
    return (
      <main style={{ padding: 16 }}>
        <p style={{ color: "#b91c1c" }}>error: {err}</p>
      </main>
    );

  return (
    <main style={{ padding: 16 }}>
      {groupedSorted.length === 0 ? (
        <section
          style={{
            minHeight: "60vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: 34, margin: 0 }}>返却承認</h1>
          <p style={{ fontSize: 20, margin: 0 }}>承認待ちの返却申請はありません。</p>
        </section>
      ) : (
        <>
          <h1 style={{ fontSize: 28, margin: "0 0 12px" }}>返却承認</h1>

          {groupedSorted.map((group) => {
            const selected = selectedForBox(group.boxId);
            const isBusy = submitting.has(group.boxId);

            return (
              <section key={group.boxId} style={{ marginBottom: 24 }}>
                <h2 style={{ marginBottom: 4 }}>
                  {group.boxDisplayName} / {group.borrowerUsername}
                </h2>
                <p style={{ marginTop: 0 }}>
                  開始日: {group.startDate} / 返却期日: {group.dueDate}
                </p>

                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <Button type="button" disabled={isBusy} onClick={() => postApprove(group.boxId)}>
                    {isBusy ? "承認中..." : "全件承認"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={selected.size === 0 || isBusy}
                    onClick={() => postApprove(group.boxId, Array.from(selected))}
                  >
                    {isBusy ? "承認中..." : "選択分を承認"}
                  </Button>
                </div>

                <Table>
                  <thead>
                    <tr>
                      <Th>選択</Th>
                      <Th>工具名</Th>
                      <Th>工具ID</Th>
                      <Th>開始日</Th>
                      <Th>返却期日</Th>
                      <Th>申請日時</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((item) => {
                      const checked = selected.has(item.loanItemId);
                      return (
                        <tr key={`${group.boxId}:${item.loanItemId}`}>
                          <Td>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={isBusy}
                              onChange={(e) => toggleLoanItem(group.boxId, item.loanItemId, e.target.checked)}
                              style={checkboxStyle}
                            />
                          </Td>
                          <Td>{item.toolName}</Td>
                          <Td>{item.assetNo}</Td>
                          <Td>{item.startDate}</Td>
                          <Td>{item.dueDate}</Td>
                          <Td>{formatDateJa(item.returnRequestedAt)}</Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </section>
            );
          })}
        </>
      )}
    </main>
  );
}