"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "../../../src/components/ui/Button";
import Input from "../../../src/components/ui/Input";
import { Table, Td, Th } from "../../../src/components/ui/Table";
import { statusLabel } from "../../../src/utils/format";
import { HttpError, apiFetchJson } from "../../../src/utils/http";
import { useLoanBox } from "../../../src/state/loanBoxStore";

type ToolStatus = "available" | "loaned" | "repairing" | "lost";

type Tool = {
  id: string;
  name: string;
  assetNo: string;
  warehouseId: string;
  status: ToolStatus;
};

type Warehouse = {
  id: string;
  name: string;
};

type DueOverrides = Record<string, string>;

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

  const handleApiError = (error: unknown): string | null => {
    if (!(error instanceof HttpError)) return "通信に失敗しました";

    if (error.status === 401) {
      window.location.href = "/login";
      return null;
    }

    if (error.status === 403) {
      window.location.href = "/tools";
      return null;
    }

    return error.message || "通信に失敗しました";
  };

  const loadData = useCallback(async () => {
    try {
      const [toolData, warehouseData] = await Promise.all([
        apiFetchJson<Tool[]>("/api/tools"),
        apiFetchJson<Warehouse[]>("/api/warehouses"),
      ]);
      setTools(toolData);
      setWarehouses(warehouseData);
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
    const m = new Map<string, string>();
    for (const w of warehouses) m.set(w.id, w.name);
    return m;
  }, [warehouses]);

  const loanBoxTools = useMemo(() => tools.filter((tool) => selectedToolIds.has(tool.id)), [tools, selectedToolIds]);

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

  const hasUnavailable = useMemo(() => loanBoxTools.some((tool) => tool.status !== "available"), [loanBoxTools]);
  const checkoutDisabled =
    submitting ||
    loanBoxTools.length === 0 ||
    !startDate ||
    !dueDate ||
    dueDate < startDate ||
    invalidOverride ||
    hasUnavailable;

  const onCheckout = async () => {
    if (checkoutDisabled) return;
    if (!window.confirm("貸出内容を確定しますか？")) return;

    setSubmitting(true);
    setErr(null);
    try {
      const toolIds = loanBoxTools.map((tool) => tool.id);
      const payloadOverrides: DueOverrides = {};
      for (const toolId of toolIds) {
        const value = dueOverrides[toolId]?.trim();
        if (value) payloadOverrides[toolId] = value;
      }

      await apiFetchJson<{ ok: true } & Record<string, unknown>>("/api/boxes/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate,
          dueDate,
          toolIds,
          dueOverrides: payloadOverrides,
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
          <div style={{ fontSize: 12, marginBottom: 4 }}>返却期限</div>
          <Input type="date" value={dueDate} min={startDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <Button type="button" disabled={checkoutDisabled} onClick={onCheckout}>
          {submitting ? "送信中..." : "確認"}
        </Button>
      </div>

      {dueDate < startDate && <p style={{ color: "#b91c1c", marginTop: 12 }}>返却期限は開始日以降で指定してください</p>}
      {invalidOverride && (
        <p style={{ color: "#b91c1c", marginTop: 12 }}>期間上書き日付が期限範囲外です</p>
      )}
      {hasUnavailable && (
        <p style={{ color: "#b91c1c", marginTop: 12 }}>
          選択した工具のうち、貸出不可のものがあります。先にツールページで選択し直してください
        </p>
      )}

      {err ? <p style={{ color: "#b91c1c", marginTop: 12 }}>error: {err}</p> : null}

      <div style={{ marginTop: 12 }}>選択件数: {loanBoxTools.length}</div>
      {loanBoxTools.length === 0 ? (
        <p style={{ marginTop: 12 }}>選択された工具がありません</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>ツール名</Th>
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
                <Td>{warehouseNameById.get(tool.warehouseId) ?? tool.warehouseId}</Td>
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
