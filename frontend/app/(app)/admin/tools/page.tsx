// frontend/app/(app)/admin/tools/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "../../../../src/components/ui/Button";
import Input from "../../../../src/components/ui/Input";
import StatusBadge from "../../../../src/components/ui/StatusBadge";
import { ToolDisplayStatus, statusLabel } from "../../../../src/utils/format";
import { Table, Td, Th } from "../../../../src/components/ui/Table";
import { apiFetchJson, getHttpErrorMessage, isHttpError } from "../../../../src/utils/http";
import { clearAuthSession } from "../../../../src/utils/auth";

type Warehouse = {
  id: string;
  name: string;
};

type EditableStatus = "AVAILABLE" | "BROKEN" | "REPAIR";

type Tool = {
  id: string;
  toolId: string;
  name: string;
  assetNo: string;
  warehouseId: string;
  warehouseName: string;
  baseStatus?: string;
  hasLoanHistory?: boolean;
  status: ToolDisplayStatus;
};

type ToolResponse = Omit<Tool, "toolId" | "assetNo"> & {
  assetNo?: string;
  toolId?: string;
};

type PagedResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

type BulkInputRow = {
  key: string;
  name: string;
  assetNo: string;
  warehouseId: string;
  baseStatus: EditableStatus;
};

type ToolPatchPayload = {
  toolId?: string;
  assetNo?: string;
  name?: string;
  warehouseId?: string;
  baseStatus?: EditableStatus;
  retired?: boolean;
};

const statusOptions: EditableStatus[] = ["AVAILABLE", "BROKEN", "REPAIR"];
const statusLabelJa: Record<EditableStatus, string> = {
  AVAILABLE: "貸出可",
  BROKEN: "故障",
  REPAIR: "修理中",
};

const selectStyle: React.CSSProperties = {
  height: 36,
  borderRadius: 6,
  border: "1px solid #cbd5e1",
  width: "100%",
};

const addFormLabelStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  marginBottom: 6,
  textAlign: "center",
  lineHeight: 1.2,
};

const bulkTableFieldWrapStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 240,
  margin: "0 auto",
};

const badgeButtonStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  padding: 0,
  cursor: "pointer",
};

function createBulkRow(defaultWarehouseId: string): BulkInputRow {
  return {
    key: `${Date.now()}-${Math.random()}`,
    name: "",
    assetNo: "",
    warehouseId: defaultWarehouseId,
    baseStatus: "AVAILABLE",
  };
}

function toEditableStatus(status: string): EditableStatus {
  switch (status) {
    case "AVAILABLE":
    case "BROKEN":
    case "REPAIR":
      return status;
    default:
      return "AVAILABLE";
  }
}

function bulkRowErrorKey(row: number, field: string) {
  return `${row}:${field}`;
}

function getBulkRowError(errors: Record<string, string>, row: number, field: string) {
  return errors[bulkRowErrorKey(row, field)] ?? errors[bulkRowErrorKey(row, "_row")] ?? null;
}

function getNormalizedToolId(tool: Pick<ToolResponse, "toolId" | "assetNo">) {
  return tool.toolId?.trim() || tool.assetNo?.trim() || "";
}

function normalizeTool(tool: ToolResponse): Tool {
  const toolId = getNormalizedToolId(tool);
  return {
    ...tool,
    toolId,
    assetNo: toolId,
  };
}

function ConfirmModal(props: {
  open: boolean;
  title?: string;
  message: string;
  okText?: string;
  cancelText?: string;
  busy?: boolean;
  dangerOk?: boolean;
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

        <div style={{ display: "flex", justifyContent: "center", gap: 14, marginTop: 18 }}>
          <Button type="button" variant="ghost" onClick={props.onCancel} disabled={props.busy} style={modalBtnStyle}>
            {props.cancelText ?? "キャンセル"}
          </Button>

          <Button
            type="button"
            variant={props.dangerOk ? "danger" : "primary"}
            onClick={props.onOk}
            disabled={props.busy}
            style={modalBtnStyle}
          >
            {props.busy ? "実行中..." : props.okText ?? "OK"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [assetNo, setAssetNo] = useState("");
  const [name, setName] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [status, setStatus] = useState<EditableStatus>("AVAILABLE");

  const [bulkRows, setBulkRows] = useState<BulkInputRow[]>([]);
  const [bulkRowErrors, setBulkRowErrors] = useState<Record<string, string>>({});

  const [editingToolId, setEditingToolId] = useState<string | null>(null);
  const [editingToolAssetNo, setEditingToolAssetNo] = useState("");
  const [editingToolName, setEditingToolName] = useState("");
  const [editingToolWarehouseId, setEditingToolWarehouseId] = useState("");
  const [editingToolStatus, setEditingToolStatus] = useState<EditableStatus>("AVAILABLE");
  const [submitting, setSubmitting] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ✅ window.confirm をやめて、画面内モーダルにする
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Tool | null>(null);
  const [retireConfirmOpen, setRetireConfirmOpen] = useState(false);
  const [retireTarget, setRetireTarget] = useState<Tool | null>(null);
  const [retireSuggestionTool, setRetireSuggestionTool] = useState<Tool | null>(null);
  const [retiringId, setRetiringId] = useState<string | null>(null);

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

  const hasLoanHistoryConflict = (error: unknown): boolean =>
    isHttpError(error) && (error.body as { error?: { code?: string } })?.error?.code === "TOOL_HAS_LOAN_HISTORY";

  const translateDeleteToolError = useCallback(
    (error: unknown): string | null => {
      if (hasLoanHistoryConflict(error)) {
        return "貸出履歴があるため削除できません。除籍してください。";
      }
      return handleApiError(error);
    },
    [handleApiError],
  );

  const loadData = useCallback(async () => {
    try {
      const [toolData, warehouseData] = await Promise.all([
        apiFetchJson<PagedResponse<ToolResponse>>("/api/admin/tools?page=1&pageSize=100"),
        apiFetchJson<Warehouse[]>("/api/warehouses"),
      ]);
      setTools((toolData.items ?? []).map(normalizeTool));
      setWarehouses(warehouseData);
      setRetireSuggestionTool(null);
      setErr(null);
    } catch (e: unknown) {
      const message = handleApiError(e);
      if (message) setErr(message);
    } finally {
      setLoading(false);
    }
  }, [handleApiError]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!warehouseId && warehouses.length > 0) {
      setWarehouseId(warehouses[0].id);
    }
    if (bulkRows.length === 0 && warehouses.length > 0) {
      setBulkRows([createBulkRow(warehouses[0].id)]);
    }
  }, [bulkRows.length, warehouseId, warehouses]);

  const onAdd = async () => {
    if (!assetNo.trim() || !name.trim() || !warehouseId) return;
    if (submitting.has("add")) return;

    setSubmitting((prev) => new Set(prev).add("add"));
    try {
      await apiFetchJson<{ id: string }>("/api/admin/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetNo: assetNo.trim(),
          name: name.trim(),
          warehouseId,
          baseStatus: status, // Backward-compatible API field name.
        }),
      });
      setAssetNo("");
      setName("");
      setStatus("AVAILABLE");
      await loadData();
    } catch (e: unknown) {
      const message = handleApiError(e);
      if (message) setErr(message);
    } finally {
      setSubmitting((prev) => {
        const next = new Set(prev);
        next.delete("add");
        return next;
      });
    }
  };

  const extractBulkRowErrors = (error: unknown) => {
    const next: Record<string, string> = {};
    if (!isHttpError(error) || !error.body || typeof error.body !== "object") {
      return next;
    }

    const body = error.body as {
      error?: {
        message?: string;
        details?: {
          rowErrors?: Array<{ row?: number; field?: string; message?: string }>;
          row?: number;
        };
      };
    };

    const rowErrors = body.error?.details?.rowErrors;
    if (Array.isArray(rowErrors)) {
      for (const rowError of rowErrors) {
        if (!rowError || typeof rowError.row !== "number") continue;
        const suffix = rowError.field ? `${rowError.field}: ` : "";
        next[bulkRowErrorKey(rowError.row, rowError.field ?? "_row")] = `${suffix}${rowError.message ?? "Error"}`;
      }
      return next;
    }

    const row = body.error?.details?.row;
    if (typeof row === "number") {
      next[bulkRowErrorKey(row, "_row")] = body.error?.message ?? "一括登録に失敗しました";
    }
    return next;
  };

  const onBulkSubmit = async () => {
    if (submitting.has("bulk")) return;
    if (bulkRows.length === 0) return;

    setSubmitting((prev) => new Set(prev).add("bulk"));
    setBulkRowErrors({});
    setErr(null);

    try {
      await apiFetchJson<{ items: Tool[] }>("/api/admin/tools/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tools: bulkRows.map((row) => ({
            assetNo: row.assetNo.trim(),
            name: row.name.trim(),
            warehouseId: row.warehouseId,
            baseStatus: row.baseStatus,
          })),
        }),
      });
      const firstWarehouseId = warehouses[0]?.id ?? "";
      setBulkRows([createBulkRow(firstWarehouseId)]);
      await loadData();
    } catch (e: unknown) {
      const rowErrors = extractBulkRowErrors(e);
      setBulkRowErrors(rowErrors);
      const message = handleApiError(e);
      if (message) setErr(message);
    } finally {
      setSubmitting((prev) => {
        const next = new Set(prev);
        next.delete("bulk");
        return next;
      });
    }
  };

  const patchToolInline = async (tool: Tool, payload: ToolPatchPayload, optimistic: Partial<Tool>) => {
    if (submitting.has(tool.id) || deletingId !== null) return false;

    setSubmitting((prev) => new Set(prev).add(tool.id));
    setTools((prev) => prev.map((item) => (item.id === tool.id ? { ...item, ...optimistic } : item)));
    setErr(null);

    try {
      const updated = await apiFetchJson<{
        id: string;
        assetNo?: string;
        toolId?: string;
        name: string;
        warehouseId: string;
        baseStatus: EditableStatus;
      }>(`/api/admin/tools/${tool.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const nextToolId = getNormalizedToolId(updated) || optimistic.toolId || optimistic.assetNo || tool.toolId;
      setTools((prev) =>
        prev.map((item) =>
          item.id === tool.id
            ? {
                ...item,
                ...optimistic,
                toolId: nextToolId,
                assetNo: nextToolId,
                name: updated.name,
                warehouseId: updated.warehouseId,
                warehouseName:
                  warehouses.find((warehouse) => warehouse.id === updated.warehouseId)?.name ?? item.warehouseName,
                baseStatus: updated.baseStatus,
              }
            : item,
        ),
      );
      return true;
    } catch (e: unknown) {
      setTools((prev) => prev.map((item) => (item.id === tool.id ? tool : item)));
      const message = handleApiError(e);
      if (message) setErr(message);
      return false;
    } finally {
      setSubmitting((prev) => {
        const next = new Set(prev);
        next.delete(tool.id);
        return next;
      });
    }
    return false;
  };

  const startEditingTool = (tool: Tool) => {
    if (deletingId !== null || submitting.has(tool.id)) return;

    setEditingToolId(tool.id);
    setEditingToolAssetNo(tool.toolId);
    setEditingToolName(tool.name);
    setEditingToolWarehouseId(tool.warehouseId);
    setEditingToolStatus(toEditableStatus(tool.baseStatus ?? tool.status));
  };

  const cancelEditingTool = () => {
    setEditingToolId(null);
    setEditingToolAssetNo("");
    setEditingToolName("");
    setEditingToolWarehouseId("");
    setEditingToolStatus("AVAILABLE");
  };

  const onSaveTool = async (tool: Tool) => {
    if (editingToolId !== tool.id || deletingId !== null || submitting.has(tool.id)) return;

    const nextAssetNo = editingToolAssetNo.trim();
    const nextName = editingToolName.trim();
    if (!nextAssetNo || !nextName || !editingToolWarehouseId) return;

    const nextStatus = toEditableStatus(editingToolStatus);
    const nextWarehouse = warehouses.find((item) => item.id === editingToolWarehouseId);
    const ok = await patchToolInline(
      tool,
      {
        toolId: nextAssetNo,
        assetNo: nextAssetNo,
        name: nextName,
        warehouseId: editingToolWarehouseId,
        baseStatus: nextStatus,
      },
      {
        toolId: nextAssetNo,
        assetNo: nextAssetNo,
        name: nextName,
        warehouseId: editingToolWarehouseId,
        warehouseName: nextWarehouse?.name ?? tool.warehouseName,
        baseStatus: nextStatus,
      },
    );

    if (ok) {
      cancelEditingTool();
      await loadData();
    }
  };

  // ✅ 削除はまずモーダルを出す
  const requestDelete = (tool: Tool) => {
    if (deletingId || retiringId || submitting.has(tool.id)) return;
    setRetireSuggestionTool(null);
    setDeleteTarget(tool);
    setDeleteConfirmOpen(true);
  };

  const requestRetire = (tool: Tool) => {
    if (deletingId || retiringId || submitting.has(tool.id)) return;
    setRetireSuggestionTool(null);
    setRetireTarget({ ...tool, hasLoanHistory: true });
    setRetireConfirmOpen(true);
  };

  const requestRemove = (tool: Tool) => {
    if (tool.hasLoanHistory) {
      requestRetire(tool);
      return;
    }
    requestDelete(tool);
  };

  // ✅ モーダルで「削除する」押下後に実行
  const getRemoveLabel = (tool: Tool) => (tool.hasLoanHistory ? "除籍" : "削除");

  const getRemoveBusyLabel = (tool: Tool) => (tool.hasLoanHistory ? "除籍中..." : "削除中...");

  const getActionLabel = (tool: Tool) => (tool.hasLoanHistory ? "除籍" : "削除");

  const getActionBusyLabel = (tool: Tool) => (tool.hasLoanHistory ? "除籍中..." : "削除中...");

  void getRemoveLabel;
  void getRemoveBusyLabel;

  const doDeleteConfirmed = async () => {
    if (!deleteTarget) return;
    const tool = deleteTarget;

    if (deletingId || retiringId || submitting.has(tool.id)) return;

    setDeletingId(tool.id);
    setErr(null);

    try {
      await apiFetchJson<{ ok: boolean }>(`/api/admin/tools/${tool.id}`, { method: "DELETE" });
      setRetireSuggestionTool(null);
      await loadData();
    } catch (e: unknown) {
      if (hasLoanHistoryConflict(e)) {
        const retireTarget = { ...tool, hasLoanHistory: true };
        setTools((prev) => prev.map((item) => (item.id === tool.id ? { ...item, hasLoanHistory: true } : item)));
        setRetireSuggestionTool(retireTarget);
      }
      const message = translateDeleteToolError(e);
      if (message) setErr(message);
    } finally {
      setDeletingId(null);
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
    }
  };

  const doRetireConfirmed = async () => {
    if (!retireTarget) return;
    const tool = retireTarget;

    if (retiringId || deletingId || submitting.has(tool.id)) return;

    setRetiringId(tool.id);
    setErr(null);

    try {
      await apiFetchJson<{ id: string }>(`/api/admin/tools/${tool.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retired: true }),
      });
      setErr(null);
      setRetireSuggestionTool(null);
      setRetireConfirmOpen(false);
      setRetireTarget(null);
      await loadData();
    } catch (e: unknown) {
      const message = handleApiError(e);
      if (message) setErr(message);
    } finally {
      setRetiringId(null);
    }
  };

  if (loading) return <main>loading...</main>;

  const deleteBusy = deletingId !== null;
  const retireBusy = retiringId !== null;
  const actionBusy = deleteBusy || retireBusy;
  const deleteConfirmTitle = "削除の確認";
  const deleteConfirmMessage = "この工具を削除します。よろしいですか？";

  return (
    <main className="admin-tools-page">
      {err ? (
        <div
          className="card-surface"
          style={{
            marginBottom: 12,
            padding: "12px 14px",
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#b91c1c",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <span>エラー: {err}</span>
            {retireSuggestionTool ? (
              <Button
                type="button"
                variant="danger"
                onClick={() => requestRetire(retireSuggestionTool)}
                disabled={actionBusy}
              >
                除籍
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      <ConfirmModal
        open={deleteConfirmOpen}
        title={deleteConfirmTitle}
        message={deleteConfirmMessage}
        okText="削除する"
        cancelText="キャンセル"
        dangerOk
        busy={deleteBusy}
        onOk={doDeleteConfirmed}
        onCancel={() => {
          if (deleteBusy) return;
          setDeleteConfirmOpen(false);
          setDeleteTarget(null);
        }}
      />
      <ConfirmModal
        open={retireConfirmOpen}
        title="除籍の確認"
        message="この工具を除籍します。よろしいですか？"
        okText="除籍する"
        cancelText="キャンセル"
        dangerOk
        busy={retireBusy}
        onOk={doRetireConfirmed}
        onCancel={() => {
          if (retireBusy) return;
          setRetireConfirmOpen(false);
          setRetireTarget(null);
        }}
      />

      <h1>工具管理</h1>

      <section className="card-surface" style={{ marginTop: 12, padding: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button type="button" variant={mode === "single" ? "primary" : "ghost"} onClick={() => setMode("single")}>
            単体追加
          </Button>
          <Button type="button" variant={mode === "bulk" ? "primary" : "ghost"} onClick={() => setMode("bulk")}>
            一括追加モード
          </Button>
        </div>

        {mode === "single" ? (
          <div
            style={{
              marginTop: 12,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
              gap: 8,
              alignItems: "end",
            }}
          >
            <div>
              <div style={addFormLabelStyle}>工具名</div>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="" />
            </div>
            <div>
              <div style={addFormLabelStyle}>工具ID</div>
              <Input value={assetNo} onChange={(e) => setAssetNo(e.target.value)} placeholder="" />
            </div>
            <div>
              <div style={addFormLabelStyle}>場所</div>
              <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} style={selectStyle}>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div style={addFormLabelStyle}>状態</div>
              <select value={status} onChange={(e) => setStatus(e.target.value as EditableStatus)} style={selectStyle}>
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {statusLabelJa[option]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Button
                type="button"
                onClick={onAdd}
                disabled={submitting.has("add") || !assetNo.trim() || !name.trim() || !warehouses.length}
              >
                追加
              </Button>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            <div style={{ marginBottom: 8 }}>
              <strong>一括追加</strong>
            </div>

            <div className="admin-tools-bulk-table">
              <Table>
                <thead>
                  <tr>
                    <Th>#</Th>
                    <Th>工具名</Th>
                    <Th>工具ID</Th>
                    <Th>場所</Th>
                    <Th>状態</Th>
                    <Th>操作</Th>
                  </tr>
                </thead>
                <tbody>
                  {bulkRows.map((row, index) => (
                    <tr key={row.key}>
                      <Td>{index + 1}</Td>
                      <Td>
                        <div style={bulkTableFieldWrapStyle}>
                          <Input
                            value={row.name}
                            onChange={(e) =>
                              setBulkRows((prev) =>
                                prev.map((item) => (item.key === row.key ? { ...item, name: e.target.value } : item)),
                              )
                            }
                            placeholder="工具名"
                          />
                        </div>
                        {getBulkRowError(bulkRowErrors, index + 1, "name") ? (
                          <div style={{ marginTop: 4, color: "var(--danger)", fontSize: 12 }}>
                            {getBulkRowError(bulkRowErrors, index + 1, "name")}
                          </div>
                        ) : null}
                      </Td>
                      <Td>
                        <div style={bulkTableFieldWrapStyle}>
                          <Input
                            value={row.assetNo}
                            onChange={(e) =>
                              setBulkRows((prev) =>
                                prev.map((item) => (item.key === row.key ? { ...item, assetNo: e.target.value } : item)),
                              )
                            }
                            placeholder="工具ID"
                          />
                        </div>
                        {getBulkRowError(bulkRowErrors, index + 1, "assetNo") ? (
                          <div style={{ marginTop: 4, color: "var(--danger)", fontSize: 12 }}>
                            {getBulkRowError(bulkRowErrors, index + 1, "assetNo")}
                          </div>
                        ) : null}
                      </Td>
                      <Td>
                        <div style={bulkTableFieldWrapStyle}>
                          <select
                            value={row.warehouseId}
                            onChange={(e) =>
                              setBulkRows((prev) =>
                                prev.map((item) => (item.key === row.key ? { ...item, warehouseId: e.target.value } : item)),
                              )
                            }
                            style={selectStyle}
                          >
                            {warehouses.map((warehouse) => (
                              <option key={warehouse.id} value={warehouse.id}>
                                {warehouse.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        {getBulkRowError(bulkRowErrors, index + 1, "warehouseId") ? (
                          <div style={{ marginTop: 4, color: "var(--danger)", fontSize: 12 }}>
                            {getBulkRowError(bulkRowErrors, index + 1, "warehouseId")}
                          </div>
                        ) : null}
                      </Td>
                      <Td>
                        <div style={bulkTableFieldWrapStyle}>
                          <select
                            value={row.baseStatus}
                            onChange={(e) =>
                              setBulkRows((prev) =>
                                prev.map((item) =>
                                  item.key === row.key ? { ...item, baseStatus: e.target.value as EditableStatus } : item,
                                ),
                              )
                            }
                            style={selectStyle}
                          >
                            {statusOptions.map((option) => (
                              <option key={option} value={option}>
                                {statusLabel(option)}
                              </option>
                            ))}
                          </select>
                        </div>
                        {getBulkRowError(bulkRowErrors, index + 1, "baseStatus") ? (
                          <div style={{ marginTop: 4, color: "var(--danger)", fontSize: 12 }}>
                            {getBulkRowError(bulkRowErrors, index + 1, "baseStatus")}
                          </div>
                        ) : null}
                      </Td>
                      <Td>
                        <div style={{ display: "flex", justifyContent: "center" }}>
                          <Button
                            type="button"
                            variant="danger"
                            disabled={bulkRows.length <= 1 || deleteBusy}
                            onClick={() => setBulkRows((prev) => prev.filter((item) => item.key !== row.key))}
                          >
                            行を削除
                          </Button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setBulkRows((prev) => [...prev, createBulkRow(warehouses[0]?.id ?? "")])}
              >
                行を追加
              </Button>
              <Button type="button" onClick={onBulkSubmit} disabled={submitting.has("bulk")}>
                {submitting.has("bulk") ? "登録中..." : "一括登録"}
              </Button>
            </div>
          </div>
        )}
      </section>

      <section style={{ marginTop: 12 }} className="card-surface">
        <div className="desktop-table admin-tools-table">
          <Table>
            <thead>
              <tr>
                <Th>工具名</Th>
                <Th>工具ID</Th>
                <Th>場所</Th>
                <Th>状態</Th>
                <Th>操作</Th>
              </tr>
            </thead>
            <tbody>
              {tools.map((tool) => {
                const isBusy = submitting.has(tool.id);
                const disableAction = isBusy || actionBusy;
                const currentStatus = tool.status;
                const isEditing = editingToolId === tool.id;
                const isSaveDisabled = !editingToolAssetNo.trim() || !editingToolName.trim() || !editingToolWarehouseId;
                return (
                  <tr key={tool.id}>
                    <Td>
                      {isEditing ? (
                        <Input
                          value={editingToolName}
                          onChange={(e) => setEditingToolName(e.target.value)}
                          disabled={disableAction}
                          autoFocus
                        />
                      ) : (
                        tool.name
                      )}
                    </Td>
                    <Td>
                      {isEditing ? (
                        <Input value={editingToolAssetNo} onChange={(e) => setEditingToolAssetNo(e.target.value)} disabled={disableAction} />
                      ) : (
                        tool.toolId
                      )}
                    </Td>
                    <Td>
                      {isEditing ? (
                        <select
                          value={editingToolWarehouseId}
                          onChange={(e) => setEditingToolWarehouseId(e.target.value)}
                          disabled={disableAction}
                          style={selectStyle}
                        >
                          {warehouses.map((warehouse) => (
                            <option key={warehouse.id} value={warehouse.id}>
                              {warehouse.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        tool.warehouseName
                      )}
                    </Td>
                    <Td>
                      {isEditing ? (
                        <select
                          autoFocus
                          value={editingToolStatus}
                          onChange={(e) => {
                            if (!disableAction) {
                              setEditingToolStatus(e.target.value as EditableStatus);
                            }
                          }}
                          disabled={disableAction}
                          style={selectStyle}
                        >
                          {statusOptions.map((option) => (
                            <option key={option} value={option}>
                              {statusLabelJa[option]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div style={{ display: "flex", justifyContent: "center" }}>
                          <button
                            type="button"
                            disabled={disableAction}
                            style={{ ...badgeButtonStyle, cursor: disableAction ? "not-allowed" : "pointer" }}
                          >
                            <StatusBadge status={currentStatus} />
                          </button>
                        </div>
                      )}
                    </Td>
                    <Td>
                      {isEditing ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
                          <Button type="button" onClick={() => onSaveTool(tool)} disabled={isBusy || isSaveDisabled}>
                            {isBusy ? "保存中..." : "保存"}
                          </Button>
                          <Button type="button" variant="ghost" onClick={cancelEditingTool} disabled={isBusy}>
                            キャンセル
                          </Button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
                          <Button type="button" onClick={() => startEditingTool(tool)} disabled={disableAction}>
                            編集
                          </Button>
                          <Button type="button" variant="danger" onClick={() => requestRemove(tool)} disabled={disableAction}>
                            {deletingId === tool.id || retiringId === tool.id ? getActionBusyLabel(tool) : getActionLabel(tool)}
                          </Button>
                        </div>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>

        <div className="mobile-cards" style={{ padding: 12 }}>
          {tools.map((tool) => {
            const isBusy = submitting.has(tool.id);
            const disableAction = isBusy || actionBusy;
            const currentStatus = tool.status;
            const isEditing = editingToolId === tool.id;
            const isSaveDisabled = !editingToolAssetNo.trim() || !editingToolName.trim() || !editingToolWarehouseId;
            return (
              <article key={tool.id} className="card-surface" style={{ padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 }}>
                  {isEditing ? (
                    <Input
                      value={editingToolName}
                      onChange={(e) => setEditingToolName(e.target.value)}
                      disabled={disableAction}
                    />
                  ) : (
                    <strong>{tool.name}</strong>
                  )}
                  <div style={{ display: "flex", gap: 8 }}>
                    {isEditing ? (
                      <>
                        <Button type="button" onClick={() => onSaveTool(tool)} disabled={isBusy || isSaveDisabled}>
                          {isBusy ? "保存中..." : "保存"}
                        </Button>
                        <Button type="button" variant="ghost" onClick={cancelEditingTool} disabled={isBusy}>
                          キャンセル
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button type="button" onClick={() => startEditingTool(tool)} disabled={disableAction}>
                          編集
                        </Button>
                        <Button type="button" variant="danger" onClick={() => requestRemove(tool)} disabled={disableAction}>
                          {deletingId === tool.id || retiringId === tool.id ? getActionBusyLabel(tool) : getActionLabel(tool)}
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, marginBottom: 4 }}>工具ID</div>
                  {isEditing ? (
                    <Input value={editingToolAssetNo} onChange={(e) => setEditingToolAssetNo(e.target.value)} disabled={disableAction} />
                  ) : (
                    <div style={{ fontSize: 13 }}>{tool.toolId}</div>
                  )}
                </div>

                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, marginBottom: 4 }}>場所</div>
                  {isEditing ? (
                    <select
                      value={editingToolWarehouseId}
                      onChange={(e) => setEditingToolWarehouseId(e.target.value)}
                      disabled={disableAction}
                      style={selectStyle}
                    >
                      {warehouses.map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>
                          {warehouse.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    tool.warehouseName
                  )}
                </div>

                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, marginBottom: 4 }}>状態</div>
                  {isEditing ? (
                    <select
                      autoFocus
                      value={editingToolStatus}
                      onChange={(e) => {
                        if (!disableAction) {
                          setEditingToolStatus(e.target.value as EditableStatus);
                        }
                      }}
                      disabled={disableAction}
                      style={selectStyle}
                    >
                      {statusOptions.map((option) => (
                        <option key={option} value={option}>
                          {statusLabelJa[option]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <button
                      type="button"
                      disabled={disableAction}
                      style={{ ...badgeButtonStyle, cursor: disableAction ? "not-allowed" : "pointer" }}
                    >
                      <StatusBadge status={currentStatus} />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
      <style jsx>{`
        .admin-tools-page > h1 {
          font-size: 28px;
          line-height: 1.2;
          margin: 0 0 12px;
        }

        .admin-tools-table :global(th),
        .admin-tools-table :global(td) {
          text-align: center !important;
          vertical-align: middle;
        }

        .admin-tools-bulk-table :global(th),
        .admin-tools-bulk-table :global(td) {
          text-align: center !important;
          vertical-align: middle;
        }
      `}</style>
    </main>
  );
}
