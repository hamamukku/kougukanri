// frontend/app/(app)/admin/returns/page.tsx
﻿"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "../../../../src/components/ui/Button";
import { formatDateJa } from "../../../../src/utils/format";
import { Table, Td, Th } from "../../../../src/components/ui/Table";
import { useConfirm } from "../../../../src/components/ui/ConfirmProvider";
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
  const [submittingAll, setSubmittingAll] = useState(false);
  const [selectedLoanItemIdsByBox, setSelectedLoanItemIdsByBox] = useState<Record<string, Set<string>>>({});
  const router = useRouter();
  const { confirm } = useConfirm();

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
    const selectedCount = loanItemIds?.length ?? 0;
    const confirmed = await confirm({
      title: "確認",
      message: isPartial
        ? selectedCount === 1
          ? "選択した1件の返却申請を承認します。よろしいですか？"
          : `選択した${selectedCount}件の返却申請を承認します。よろしいですか？`
        : "このBOX内の返却申請をすべて承認します。よろしいですか？",
      okText: "はい",
      cancelText: "いいえ",
    });
    if (!confirmed) return;

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

  const postApproveAll = async () => {
    if (submittingAll || groups.length === 0) return;
    const confirmed = await confirm({
      title: "確認",
      message: "画面上の返却申請をすべて一括承認します。よろしいですか？",
      okText: "はい",
      cancelText: "いいえ",
    });
    if (!confirmed) return;

    setSubmittingAll(true);
    try {
      await apiFetchJson<{ approvedCount: number }>("/api/admin/returns/approve-all", {
        method: "POST",
      });
      await loadData();
    } catch (e: unknown) {
      const message = handleApiError(e);
      if (message) setErr(message);
    } finally {
      setSubmittingAll(false);
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
            <div
              style={{
                display: "flex",
                justifyContent: "flex-start",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
                marginBottom: 16,
              }}
            >
              <Button
                type="button"
                disabled={submittingAll || submitting.size > 0 || groupedSorted.length === 0}
                onClick={postApproveAll}
              >
                {submittingAll ? "全ボックス一括承認中..." : "全ボックス一括承認"}
              </Button>
            </div>

            {groupedSorted.map((group) => {
              const selected = selectedForBox(group.boxId);
              const isBusy = submittingAll || submitting.has(group.boxId);

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

                <div className="admin-returns-table">
                  <Table>
                    <thead>
                      <tr>
                        <Th>選択</Th>
                        <Th>工具名</Th>
                        <Th>工具ID</Th>
                        <Th>貸出者</Th>
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
                              <div style={{ display: "flex", justifyContent: "center" }}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={isBusy}
                                  onChange={(e) => toggleLoanItem(group.boxId, item.loanItemId, e.target.checked)}
                                  style={checkboxStyle}
                                />
                              </div>
                            </Td>
                            <Td>{item.toolName}</Td>
                            <Td>{item.assetNo}</Td>
                            <Td>{group.borrowerUsername}</Td>
                            <Td>{item.startDate}</Td>
                            <Td>{item.dueDate}</Td>
                            <Td>{formatDateJa(item.returnRequestedAt)}</Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>
              </section>
            );
          })}
        </>
      )}

      <style jsx>{`
        .admin-returns-table :global(th),
        .admin-returns-table :global(td) {
          text-align: center !important;
          vertical-align: middle;
        }
      `}</style>
    </main>
  );
}
