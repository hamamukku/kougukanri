// app/(app)/my-loans/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "../../../src/components/ui/Button";
import StatusBadge from "../../../src/components/ui/StatusBadge";
import { Table, Td, Th } from "../../../src/components/ui/Table";
import { apiFetchJson, getHttpErrorMessage, isHttpError } from "../../../src/utils/http";

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
    status: "available" | "loaned" | "repairing" | "lost";
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
  const router = useRouter();

  const handleApiError = (error: unknown, options: { onForbiddenRedirect?: boolean } = {}): string | null => {
    if (isHttpError(error) && error.status === 401) {
      router.push("/login");
      return null;
    }

    if (isHttpError(error) && error.status === 403 && options.onForbiddenRedirect) {
      router.push("/tools");
      return null;
    }

    return getHttpErrorMessage(error);
  };

  const loadData = useCallback(async () => {
    try {
      const [b, w] = await Promise.all([
        apiFetchJson<MyBox[]>("/api/my/boxes?status=open"),
        apiFetchJson<Warehouse[]>("/api/warehouses"),
      ]);
      setBoxes(
        (b ?? [])
          .map((entry) => ({ ...entry, items: entry.items || [] }))
          .sort((a, bItem) => bItem.box.startDate.localeCompare(a.box.startDate)),
      );
      setWarehouses(w ?? []);
      setErr(null);
    } catch (e: unknown) {
      const message = handleApiError(e, { onForbiddenRedirect: true });
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

  const onRequestReturn = async (boxId: string, toolId: string) => {
    const key = `${boxId}:${toolId}`;
    if (requesting.has(key)) return;
    setRequesting((prev) => new Set(prev).add(key));
    try {
      await apiFetchJson<{ ok: true } & Record<string, unknown>>("/api/my/returns/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boxId, toolId }),
      });
      await loadData();
    } catch (e: unknown) {
      const message = handleApiError(e, { onForbiddenRedirect: true });
      if (message) setErr(message);
    } finally {
      setRequesting((prev) => {
        const next = new Set(prev);
        next.delete(key);
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
      {boxes.length === 0 ? (
        // ✅ 空のときだけ中央寄せ＋大型化
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

          {boxes.map((box) => {
            const visibleItems = box.items
              .filter((item) => item.returnStatus !== "approved")
              .slice()
              .sort((a, b) => b.dueEffective.localeCompare(a.dueEffective));

            return (
              <section key={box.box.id} style={{ marginTop: 16 }} className="card-surface">
                <div style={{ padding: "12px 12px 0" }}>
                  <h2 style={{ marginBottom: 4 }}>{`${box.box.ownerUsername}-ボックス${box.box.boxNo}`}</h2>
                  <p style={{ marginTop: 0 }}>
                    開始日: {box.box.startDate} / 期限日: {box.box.dueDate}
                  </p>
                </div>

                {visibleItems.length === 0 ? (
                  <p style={{ padding: "0 12px 12px" }}>返却申請可能な工具はありません。</p>
                ) : (
                  <>
                    <div className="desktop-table">
                      <Table>
                        <thead>
                          <tr>
                            <Th>工具名</Th>
                            <Th>工具ID</Th>
                            <Th>倉庫</Th>
                            <Th>期限</Th>
                            <Th>状態</Th>
                            <Th>返却申請</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleItems.map((item) => {
                            const key = `${box.box.id}:${item.toolId}`;
                            const requested = item.returnStatus === "requested";
                            const busy = requesting.has(key);
                            return (
                              <tr key={key}>
                                <Td>{item.toolName}</Td>
                                <Td>{item.assetNo}</Td>
                                <Td>{warehouseNameById.get(item.warehouseId) ?? "不明"}</Td>
                                <Td>{item.dueEffective}</Td>
                                <Td>
                                  <StatusBadge status={item.status} />
                                </Td>
                                <Td>
                                  <Button
                                    type="button"
                                    disabled={requested || busy}
                                    onClick={() => onRequestReturn(box.box.id, item.toolId)}
                                  >
                                    {requested ? "申請済" : busy ? "申請中..." : "返却申請"}
                                  </Button>
                                </Td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </Table>
                    </div>

                    <div className="mobile-cards" style={{ padding: 12 }}>
                      {visibleItems.map((item) => {
                        const key = `${box.box.id}:${item.toolId}`;
                        const requested = item.returnStatus === "requested";
                        const busy = requesting.has(key);
                        return (
                          <article key={key} className="card-surface" style={{ padding: 10 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                              <strong>{item.toolName}</strong>
                              <StatusBadge status={item.status} />
                            </div>
                            <div style={{ marginTop: 8, fontSize: 13 }}>工具ID: {item.assetNo}</div>
                            <div style={{ marginTop: 4, fontSize: 13 }}>
                              倉庫: {warehouseNameById.get(item.warehouseId) ?? "不明"}
                            </div>
                            <div style={{ marginTop: 4, fontSize: 13 }}>期限: {item.dueEffective}</div>
                            <div style={{ marginTop: 8 }}>
                              <Button
                                type="button"
                                disabled={requested || busy}
                                onClick={() => onRequestReturn(box.box.id, item.toolId)}
                              >
                                {requested ? "申請済" : busy ? "申請中..." : "返却申請"}
                              </Button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </>
                )}
              </section>
            );
          })}
        </>
      )}
    </main>
  );
}