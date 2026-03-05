// frontend/app/(app)/loan-box/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "../../../src/components/ui/Button";
import Input from "../../../src/components/ui/Input";
import { Table, Td, Th } from "../../../src/components/ui/Table";
import StatusBadge from "../../../src/components/ui/StatusBadge";
import { ToolDisplayStatus } from "../../../src/utils/format";
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

// yyyy/mm/dd を「年/月/日」に見せる（中身は type="date" のまま・カレンダー維持）
function DateInputJa(props: { value: string; onChange: (value: string) => void; min?: string; max?: string }) {
  const [focused, setFocused] = useState(false);
  const showHint = !props.value && !focused;

  return (
    <div style={{ position: "relative", width: "100%" }}>
      {showHint ? (
        <span
          style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            color: "#64748b",
            pointerEvents: "none",
            fontSize: 14,
          }}
        >
          年/月/日
        </span>
      ) : null}

      <Input
        type="date"
        min={props.min}
        max={props.max}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ color: showHint ? "transparent" : undefined }}
      />
    </div>
  );
}

function ConfirmModal(props: {
  open: boolean;
  title?: string;
  message: string;
  okText?: string;
  cancelText?: string;
  busy?: boolean;
  onOk: () => void;
  onCancel: () => void;
}) {
  if (!props.open) return null;

  const modalBtnStyle: React.CSSProperties = {
    minWidth: 140,
    height: 52,
    fontSize: 18,
    fontWeight: 800,
    padding: "0 20px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 9999,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !props.busy) props.onCancel();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          background: "#fff",
          borderRadius: 14,
          border: "1px solid #e2e8f0",
          boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
          padding: 18,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 10 }}>{props.title ?? "確認"}</div>

        <div style={{ fontSize: 16, lineHeight: 1.7, color: "#0f172a" }}>{props.message}</div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 14,
            marginTop: 18,
          }}
        >
          <Button type="button" variant="ghost" onClick={props.onCancel} disabled={props.busy} style={modalBtnStyle}>
            {props.cancelText ?? "キャンセル"}
          </Button>
          <Button type="button" onClick={props.onOk} disabled={props.busy} style={modalBtnStyle}>
            {props.busy ? "送信中..." : props.okText ?? "OK"}
          </Button>
        </div>
      </div>
    </div>
  );
}

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

  const [confirmOpen, setConfirmOpen] = useState(false);

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

  const doCheckout = async () => {
    if (checkoutDisabled) return;

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
      setConfirmOpen(false);
    }
  };

  const onClickCheckout = () => {
    if (checkoutDisabled) return;
    setConfirmOpen(true);
  };

  if (loading) return <main>loading...</main>;

  return (
    <main>
      <ConfirmModal
        open={confirmOpen}
        title="貸出の確定"
        message="貸出を確定しますか？"
        okText="確定する"
        cancelText="戻る"
        busy={submitting}
        onOk={doCheckout}
        onCancel={() => setConfirmOpen(false)}
      />

      <h1>貸出ボックス</h1>

      <div className="card-surface" style={{ marginTop: 12, padding: 12 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
            alignItems: "end",
          }}
        >
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>開始日</div>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>返却期日</div>
            <Input type="date" value={dueDate} min={startDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div>
            <Button type="button" disabled={checkoutDisabled} onClick={onClickCheckout}>
              {submitting ? "送信中..." : "確定"}
            </Button>
          </div>
        </div>
      </div>

      {dueDate < startDate && <p style={{ color: "var(--danger)", marginTop: 12 }}>返却期日は開始日以降にしてください。</p>}
      {invalidOverride && (
        <p style={{ color: "var(--danger)", marginTop: 12 }}>期限上書きは開始日から返却期日までの範囲にしてください。</p>
      )}
      {hasUnavailable && (
        <p style={{ color: "var(--danger)", marginTop: 12 }}>
          選択中に貸出不可の工具があります。tools 画面で選び直してください。
        </p>
      )}
      {unknownToolIds.length > 0 && (
        <p style={{ color: "var(--danger)", marginTop: 12 }}>
          一部の工具情報を取得できませんでした（IDs: {unknownToolIds.join(", ")}）。
        </p>
      )}

      {err ? <p style={{ color: "var(--danger)", marginTop: 12 }}>error: {err}</p> : null}

      <div style={{ marginTop: 12, fontWeight: 700 }}>選択数: {selectedToolIdList.length}</div>
      {selectedToolIdList.length === 0 ? (
        <p style={{ marginTop: 12 }}>選択された工具がありません。</p>
      ) : (
        <>
          <div className="desktop-table">
            <Table>
              <thead>
                <tr>
                  <Th>工具名</Th>
                  <Th>工具ID</Th>
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
                    <Td>{warehouseNameById.get(tool.warehouseId) ?? tool.warehouseName ?? "不明"}</Td>
                    <Td>
                      <StatusBadge status={tool.status} />
                    </Td>
                    <Td>
                      <DateInputJa
                        min={startDate}
                        max={dueDate}
                        value={dueOverrides[tool.id] || ""}
                        onChange={(value) => setDueOverrides((prev) => ({ ...prev, [tool.id]: value }))}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          <div className="mobile-cards">
            {loanBoxTools.map((tool) => (
              <article key={tool.id} className="card-surface" style={{ padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <strong>{tool.name}</strong>
                  <StatusBadge status={tool.status} />
                </div>
                <div style={{ marginTop: 8, fontSize: 13 }}>工具ID: {tool.assetNo}</div>
                <div style={{ marginTop: 4, fontSize: 13 }}>
                  倉庫: {warehouseNameById.get(tool.warehouseId) ?? tool.warehouseName ?? "不明"}
                </div>
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, marginBottom: 4 }}>期限上書き</div>
                  <DateInputJa
                    min={startDate}
                    max={dueDate}
                    value={dueOverrides[tool.id] || ""}
                    onChange={(value) => setDueOverrides((prev) => ({ ...prev, [tool.id]: value }))}
                  />
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </main>
  );
}