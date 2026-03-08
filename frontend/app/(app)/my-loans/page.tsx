// frontend/app/(app)/my-loans/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "../../../src/components/ui/Button";
import { Table, Td, Th } from "../../../src/components/ui/Table";
import StatusBadge from "../../../src/components/ui/StatusBadge";
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

export default function MyLoansPage() {
  const [groups, setGroups] = useState<GroupedLoans[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [requesting, setRequesting] = useState<Set<string>>(new Set());
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

  const onRequestReturn = async (loanItemId: string) => {
    if (requesting.has(loanItemId)) return;

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

          {groups.map((group) => (
            <section key={group.boxId} style={{ marginTop: 16 }} className="card-surface">
              <div style={{ padding: "12px 12px 0" }}>
                <h2 style={{ marginBottom: 4 }}>{group.boxDisplayName}</h2>
              </div>

              <div className="desktop-table my-loans-table">
                <Table>
                  <thead>
                    <tr>
                      <Th>工具名</Th>
                      <Th>工具ID</Th>
                      <Th>開始日</Th>
                      <Th>返却期日</Th>
                      <Th>状態</Th>
                      <Th>返却申請</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((item) => {
                      const requested = typeof item.returnRequestedAt === "string" && item.returnRequestedAt.length > 0;
                      const busy = requesting.has(item.loanItemId);
                      return (
                        <tr key={item.loanItemId}>
                          <Td>{item.toolName}</Td>
                          <Td>{item.assetNo}</Td>
                          <Td>{item.startDate}</Td>
                          <Td>{item.dueDate}</Td>
                          <Td>
                            <div style={{ display: "flex", justifyContent: "center" }}>
                              <StatusBadge status={item.status} />
                            </div>
                          </Td>
                          <Td>
                            <div style={{ display: "flex", justifyContent: "center" }}>
                            {requested ? (
                              <span>申請済み ({formatDateJa(item.returnRequestedAt ?? "")})</span>
                            ) : (
                              <Button type="button" disabled={busy} onClick={() => onRequestReturn(item.loanItemId)}>
                                {busy ? "申請中..." : "返却申請"}
                              </Button>
                            )}
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
                  const requested = typeof item.returnRequestedAt === "string" && item.returnRequestedAt.length > 0;
                  const busy = requesting.has(item.loanItemId);
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
                          <Button type="button" disabled={busy} onClick={() => onRequestReturn(item.loanItemId)}>
                            {busy ? "申請中..." : "返却申請"}
                          </Button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </>
      )}

      <style jsx>{`
        .my-loans-table :global(th),
        .my-loans-table :global(td) {
          text-align: center !important;
          vertical-align: middle;
        }
      `}</style>
    </main>
  );
}
