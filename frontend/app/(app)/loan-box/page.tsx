"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "../../../src/components/ui/Button";
import Input from "../../../src/components/ui/Input";
import { Table, Td, Th } from "../../../src/components/ui/Table";
import { statusLabel, ToolDisplayStatus } from "../../../src/utils/format";
import { apiFetchJson, getHttpErrorMessage, isHttpError } from "../../../src/utils/http";
import { clearAuthSession } from "../../../src/utils/auth";
import { useLoanBox } from "../../../src/state/loanBoxStore";

type Tool = {
  id: string;
  name: string;
  assetNo: string;
  warehouseId: string;
  warehouseName: string;
  status: ToolDisplayStatus;
};

type Warehouse = {
  id: string;
  name: string;
};

type DueOverrides = Record<string, string>;

type PagedResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

type LoanBoxResponse = {
  boxId: string;
  boxDisplayName: string;
  createdItems: Array<{
    loanItemId: string;
    toolId: string;
    startDate: string;
    dueDate: string;
  }>;
};

export default function LoanBoxPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [dueOverrides, setDueOverrides] = useState<DueOverrides>({});

  const router = useRouter();
  const { selectedToolIds, clearSelection } = useLoanBox();

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
      const [toolData, warehouseData] = await Promise.all([
        apiFetchJson<PagedResponse<Tool>>("/api/tools?page=1&pageSize=100"),
        apiFetchJson<Warehouse[]>("/api/warehouses"),
      ]);
      setTools(toolData.items ?? []);
      setWarehouses(warehouseData);
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

  const warehouseNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of warehouses) m.set(w.id, w.name);
    return m;
  }, [warehouses]);

  const toolsById = useMemo(() => {
    const m = new Map<string, Tool>();
    for (const tool of tools) m.set(tool.id, tool);
    return m;
  }, [tools]);

  const selectedToolIdList = useMemo(() => Array.from(selectedToolIds), [selectedToolIds]);

  const loanBoxTools = useMemo(() => {
    return selectedToolIdList.map((toolId) => toolsById.get(toolId)).filter((tool): tool is Tool => !!tool);
  }, [selectedToolIdList, toolsById]);

  const unknownToolIds = useMemo(() => {
    const known = new Set(loanBoxTools.map((tool) => tool.id));
    return selectedToolIdList.filter((toolId) => !known.has(toolId));
  }, [loanBoxTools, selectedToolIdList]);

  useEffect(() => {
    setDueOverrides((prev) => {
      const next: DueOverrides = {};
      for (const tool of loanBoxTools) {
        if (prev[tool.id]) next[tool.id] = prev[tool.id];
      }
      return next;
    });
  }, [loanBoxTools]);

  const invalidOverride = useMemo(() => {
    return loanBoxTools.some((tool) => {
      const override = dueOverrides[tool.id]?.trim();
      if (!override) return false;
      return override < startDate || override > dueDate;
    });
  }, [dueOverrides, loanBoxTools, startDate, dueDate]);

  const hasUnavailable = useMemo(() => loanBoxTools.some((tool) => tool.status !== "AVAILABLE"), [loanBoxTools]);
  const checkoutDisabled =
    submitting ||
    selectedToolIdList.length === 0 ||
    !startDate ||
    !dueDate ||
    dueDate < startDate ||
    invalidOverride ||
    hasUnavailable;

  const onCheckout = async () => {
    if (checkoutDisabled) return;
    if (!window.confirm("貸出を確定しますか？")) return;

    setSubmitting(true);
    setErr(null);

    try {
      const payloadOverrides: DueOverrides = {};
      for (const toolId of selectedToolIdList) {
        const value = dueOverrides[toolId]?.trim();
        if (value) payloadOverrides[toolId] = value;
      }

      await apiFetchJson<LoanBoxResponse>("/api/loan-boxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate,
          dueDate,
          toolIds: selectedToolIdList,
          itemDueOverrides: payloadOverrides,
        }),
      });

      clearSelection();
      setDueOverrides({});
      router.push("/my-loans");
    } catch (e: unknown) {
      const message = handleApiError(e);
      if (message) setErr(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <main style={{ padding: 16 }}>loading...</main>;

  return (
    <main style={{ padding: 16 }}>
      <h1>貸出ボックス</h1>

      <div style={{ display: "flex", gap: 12, alignItems: "end", marginTop: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>開始日</div>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>返却期日</div>
          <Input type="date" value={dueDate} min={startDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <Button type="button" disabled={checkoutDisabled} onClick={onCheckout}>
          {submitting ? "送信中..." : "確定"}
        </Button>
      </div>

      {dueDate < startDate && <p style={{ color: "#b91c1c", marginTop: 12 }}>返却期日は開始日以降にしてください。</p>}
      {invalidOverride && (
        <p style={{ color: "#b91c1c", marginTop: 12 }}>期限上書きは開始日から返却期日までの範囲にしてください。</p>
      )}
      {hasUnavailable && (
        <p style={{ color: "#b91c1c", marginTop: 12 }}>
          選択中に貸出不可の工具があります。tools 画面で選び直してください。
        </p>
      )}
      {unknownToolIds.length > 0 && (
        <p style={{ color: "#b91c1c", marginTop: 12 }}>
          一部の工具情報を取得できませんでした（IDs: {unknownToolIds.join(", ")}）。
        </p>
      )}

      {err ? <p style={{ color: "#b91c1c", marginTop: 12 }}>error: {err}</p> : null}

      <div style={{ marginTop: 12 }}>選択数: {selectedToolIdList.length}</div>
      {selectedToolIdList.length === 0 ? (
        <p style={{ marginTop: 12 }}>選択された工具がありません。</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>工具名</Th>
              <Th>資産番号</Th>
              <Th>倉庫</Th>
              <Th>状態</Th>
              <Th>期限上書き</Th>
            </tr>
          </thead>
          <tbody>
            {loanBoxTools.map((tool) => (
              <tr key={tool.id}>
                <Td>{tool.name}</Td>
                <Td>{tool.assetNo}</Td>
                <Td>{warehouseNameById.get(tool.warehouseId) ?? tool.warehouseName ?? tool.warehouseId}</Td>
                <Td>{statusLabel(tool.status)}</Td>
                <Td>
                  <Input
                    type="date"
                    min={startDate}
                    max={dueDate}
                    value={dueOverrides[tool.id] || ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      setDueOverrides((prev) => ({ ...prev, [tool.id]: value }));
                    }}
                  />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </main>
  );
}
