"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Button from "../../../src/components/ui/Button";
import { Table, Td, Th } from "../../../src/components/ui/Table";
import StatusBadge from "../../../src/components/ui/StatusBadge";
import { useConfirm } from "../../../src/components/ui/ConfirmProvider";
import { formatDateJa, ToolDisplayStatus } from "../../../src/utils/format";
import { apiFetchJson, getHttpErrorMessage, isHttpError } from "../../../src/utils/http";
import { clearAuthSession } from "../../../src/utils/auth";

type MyLoanItem = {
  loanItemId: string;
  boxId: string;
  boxDisplayName: string;
  toolId: string;
  assetNo: string;
  toolName: string;
  startDate: string;
  dueDate: string;
  status: ToolDisplayStatus;
  returnRequestedAt?: string | null;
};

type GroupedLoans = {
  boxId: string;
  boxDisplayName: string;
  items: MyLoanItem[];
};

function isReturnRequested(item: MyLoanItem) {
  return typeof item.returnRequestedAt === "string" && item.returnRequestedAt.length > 0;
}

function getPendingReturnItems(group: GroupedLoans) {
  return group.items.filter((item) => !isReturnRequested(item));
}

export default function MyLoansPage() {
  const [groups, setGroups] = useState<GroupedLoans[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [requesting, setRequesting] = useState<Set<string>>(new Set());
  const [bulkRequesting, setBulkRequesting] = useState<Set<string>>(new Set());
  const [requestingAll, setRequestingAll] = useState(false);
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
      const items = await apiFetchJson<MyLoanItem[]>("/api/my/loans");

      const groupedMap = new Map<string, GroupedLoans>();
      for (const item of items) {
        const current = groupedMap.get(item.boxId);
        if (current) {
          current.items.push(item);
        } else {
          groupedMap.set(item.boxId, {
            boxId: item.boxId,
            boxDisplayName: item.boxDisplayName,
            items: [item],
          });
        }
      }

      const grouped = Array.from(groupedMap.values())
        .map((group) => ({
          ...group,
          items: group.items.slice().sort((a, b) => b.dueDate.localeCompare(a.dueDate)),
        }))
        .sort((a, b) => b.items[0].startDate.localeCompare(a.items[0].startDate));

      setGroups(grouped);
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

  const onRequestReturn = async (loanItemId: string, toolName: string, boxDisplayName: string) => {
    if (requesting.has(loanItemId)) return;

    const confirmed = await confirm({
      title: "確認",
      message: `${boxDisplayName}内の${toolName}を返却申請します。よろしいですか？`,
      okText: "はい",
      cancelText: "いいえ",
    });
    if (!confirmed) return;

    setRequesting((prev) => new Set(prev).add(loanItemId));
    try {
      await apiFetchJson<{ ok: boolean }>(`/api/my/loans/${loanItemId}/return-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      await loadData();
    } catch (e: unknown) {
      const message = handleApiError(e);
      if (message) setErr(message);
    } finally {
      setRequesting((prev) => {
        const next = new Set(prev);
        next.delete(loanItemId);
        return next;
      });
    }
  };

  const onRequestReturnBulk = async (group: GroupedLoans) => {
    const pendingItems = getPendingReturnItems(group);
    if (pendingItems.length === 0 || requestingAll || bulkRequesting.has(group.boxId)) return;

    const confirmed = await confirm({
      title: "確認",
      message: `${group.boxDisplayName}内の貸出をまとめて返却申請します。よろしいですか？`,
      okText: "はい",
      cancelText: "いいえ",
    });
    if (!confirmed) return;

    const targetIds = pendingItems.map((item) => item.loanItemId);
    setBulkRequesting((prev) => new Set(prev).add(group.boxId));
    setRequesting((prev) => {
      const next = new Set(prev);
      targetIds.forEach((id) => next.add(id));
      return next;
    });

    let requestedAny = false;
    try {
      for (const item of pendingItems) {
        await apiFetchJson<{ ok: boolean }>(`/api/my/loans/${item.loanItemId}/return-request`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        requestedAny = true;
      }
      await loadData();
    } catch (e: unknown) {
      const message = handleApiError(e);
      if (message) setErr(message);
      if (requestedAny) {
        await loadData();
      }
    } finally {
      setBulkRequesting((prev) => {
        const next = new Set(prev);
        next.delete(group.boxId);
        return next;
      });
      setRequesting((prev) => {
        const next = new Set(prev);
        targetIds.forEach((id) => next.delete(id));
        return next;
      });
    }
  };

  const allPendingItems = groups.flatMap((group) => getPendingReturnItems(group));

  const onRequestReturnAll = async () => {
    if (requestingAll || allPendingItems.length === 0) return;

    const confirmed = await confirm({
      title: "確認",
      message: "画面上の貸出をすべて返却申請します。よろしいですか？",
      okText: "はい",
      cancelText: "いいえ",
    });
    if (!confirmed) return;

    const targetIds = allPendingItems.map((item) => item.loanItemId);
    const targetBoxIds = groups.filter((group) => getPendingReturnItems(group).length > 0).map((group) => group.boxId);

    setRequestingAll(true);
    setBulkRequesting((prev) => {
      const next = new Set(prev);
      targetBoxIds.forEach((id) => next.add(id));
      return next;
    });
    setRequesting((prev) => {
      const next = new Set(prev);
      targetIds.forEach((id) => next.add(id));
      return next;
    });

    try {
      await apiFetchJson<{ requestedCount: number }>("/api/my/loans/return-request-all", {
        method: "POST",
      });
      await loadData();
    } catch (e: unknown) {
      const message = handleApiError(e);
      if (message) setErr(message);
    } finally {
      setRequestingAll(false);
      setBulkRequesting((prev) => {
        const next = new Set(prev);
        targetBoxIds.forEach((id) => next.delete(id));
        return next;
      });
      setRequesting((prev) => {
        const next = new Set(prev);
        targetIds.forEach((id) => next.delete(id));
        return next;
      });
    }
  };

  const returnActionCellStyle: CSSProperties = {
    minWidth: 260,
    width: "100%",
    whiteSpace: "nowrap",
    display: "flex",
    justifyContent: "center",
  };

  if (loading) return <main>loading...</main>;
  if (err)
    return (
      <main>
        <p style={{ color: "var(--danger)" }}>error: {err}</p>
      </main>
    );

  return (
    <main>
      {groups.length === 0 ? (
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
          <h1 style={{ fontSize: 34, margin: 0 }}>貸出一覧</h1>
          <p style={{ fontSize: 20, margin: 0 }}>表示する貸出情報がありません。</p>
        </section>
      ) : (
        <>
          <h1 style={{ fontSize: 28, margin: "0 0 12px" }}>貸出一覧</h1>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 16,
            }}
          >
            <Button
              type="button"
              disabled={requestingAll || bulkRequesting.size > 0 || requesting.size > 0 || allPendingItems.length === 0}
              onClick={onRequestReturnAll}
            >
              {requestingAll ? "全ボックス一括返却申請中..." : "全ボックス一括返却申請"}
            </Button>
          </div>

          {groups.map((group) => {
            const pendingItems = getPendingReturnItems(group);
            const bulkBusy = requestingAll || bulkRequesting.has(group.boxId);

            return (
              <section key={group.boxId} style={{ marginTop: 16 }} className="card-surface">
                <div className="my-loans-box-header" style={{ padding: "12px 12px 0", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <h2 style={{ margin: 0 }}>{group.boxDisplayName}</h2>
                  {pendingItems.length > 0 ? (
                    <Button type="button" disabled={bulkBusy} onClick={() => onRequestReturnBulk(group)}>
                      {bulkBusy ? "一括返却申請中..." : "一括返却"}
                    </Button>
                  ) : null}
                </div>

                <div className="desktop-table my-loans-table">
                  <Table>
                    <colgroup>
                      <col style={{ width: "260px" }} />
                      <col style={{ width: "26%" }} />
                      <col style={{ width: "16%" }} />
                      <col style={{ width: "14%" }} />
                      <col style={{ width: "14%" }} />
                      <col style={{ width: "12%" }} />
                    </colgroup>
                    <thead>
                      <tr className="bulk-action-row">
                        <th>
                          <div style={returnActionCellStyle}>
                            {pendingItems.length > 0 ? (
                              <Button type="button" disabled={bulkBusy} onClick={() => onRequestReturnBulk(group)}>
                                {bulkBusy ? "一括返却申請中..." : "一括返却"}
                              </Button>
                            ) : null}
                          </div>
                        </th>
                        <th />
                        <th />
                        <th />
                        <th />
                        <th />
                      </tr>
                      <tr>
                        <Th>
                          <div style={returnActionCellStyle}>返却申請</div>
                        </Th>
                        <Th>工具名</Th>
                        <Th>工具ID</Th>
                        <Th>開始日</Th>
                        <Th>返却期日</Th>
                        <Th>状態</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((item) => {
                        const requested = isReturnRequested(item);
                        const busy = requestingAll || requesting.has(item.loanItemId);

                        return (
                          <tr key={item.loanItemId}>
                            <Td>
                              <div
                                style={{
                                  ...returnActionCellStyle,
                                  justifyContent: requested ? "flex-start" : "center",
                                  paddingLeft: requested ? 8 : 0,
                                }}
                              >
                                {requested ? (
                                  <span>申請済み ({formatDateJa(item.returnRequestedAt ?? "")})</span>
                                ) : (
                                  <Button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => onRequestReturn(item.loanItemId, item.toolName, group.boxDisplayName)}
                                  >
                                    {busy ? "申請中..." : "返却申請"}
                                  </Button>
                                )}
                              </div>
                            </Td>
                            <Td>{item.toolName}</Td>
                            <Td>{item.assetNo}</Td>
                            <Td>{item.startDate}</Td>
                            <Td>{item.dueDate}</Td>
                            <Td>
                              <div style={{ display: "flex", justifyContent: "center" }}>
                                <StatusBadge status={item.status} />
                              </div>
                            </Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>

                <div className="mobile-cards" style={{ padding: 12 }}>
                  {group.items.map((item) => {
                    const requested = isReturnRequested(item);
                    const busy = requestingAll || requesting.has(item.loanItemId);

                    return (
                      <article key={item.loanItemId} className="card-surface" style={{ padding: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                          <strong>{item.toolName}</strong>
                          <StatusBadge status={item.status} />
                        </div>
                        <div style={{ marginTop: 8, fontSize: 13 }}>工具ID: {item.assetNo}</div>
                        <div style={{ marginTop: 4, fontSize: 13 }}>開始日: {item.startDate}</div>
                        <div style={{ marginTop: 4, fontSize: 13 }}>返却期日: {item.dueDate}</div>
                        <div style={{ marginTop: 8 }}>
                          {requested ? (
                            <span>申請済み ({formatDateJa(item.returnRequestedAt ?? "")})</span>
                          ) : (
                            <Button
                              type="button"
                              disabled={busy}
                              onClick={() => onRequestReturn(item.loanItemId, item.toolName, group.boxDisplayName)}
                            >
                              {busy ? "申請中..." : "返却申請"}
                            </Button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </>
      )}

      <style jsx>{`
        @media (min-width: 769px) {
          .my-loans-box-header :global(button) {
            display: none;
          }
        }

        .my-loans-table :global(table) {
          table-layout: fixed;
        }

        .my-loans-table :global(.bulk-action-row th) {
          background: #ffffff;
          border-bottom: 0;
          padding: 10px 12px 6px;
          text-align: center;
          vertical-align: middle;
        }

        .my-loans-table :global(th),
        .my-loans-table :global(td) {
          text-align: center !important;
          vertical-align: middle;
        }
      `}</style>
    </main>
  );
}
