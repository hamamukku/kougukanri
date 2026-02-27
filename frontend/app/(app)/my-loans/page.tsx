"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "../../../src/components/ui/Button";
import { Table, Td, Th } from "../../../src/components/ui/Table";
import { formatDateJa, statusLabel, ToolDisplayStatus } from "../../../src/utils/format";
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

  if (loading) return <main style={{ padding: 16 }}>loading...</main>;
  if (err)
    return (
      <main style={{ padding: 16 }}>
        <p style={{ color: "#b91c1c" }}>error: {err}</p>
      </main>
    );

  return (
    <main style={{ padding: 16 }}>
      <h1>My Loans</h1>

      {groups.length === 0 ? (
        <p>表示する貸出情報がありません。</p>
      ) : (
        groups.map((group) => (
          <section key={group.boxId} style={{ marginBottom: 24 }}>
            <h2 style={{ marginBottom: 4 }}>{group.boxDisplayName}</h2>
            <Table>
              <thead>
                <tr>
                  <Th>工具名</Th>
                  <Th>資産番号</Th>
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
                      <Td>{statusLabel(item.status)}</Td>
                      <Td>
                        {requested ? (
                          <span>申請済み ({formatDateJa(item.returnRequestedAt ?? "")})</span>
                        ) : (
                          <Button
                            type="button"
                            disabled={busy}
                            onClick={() => onRequestReturn(item.loanItemId)}
                          >
                            {busy ? "申請中..." : "返却申請"}
                          </Button>
                        )}
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
