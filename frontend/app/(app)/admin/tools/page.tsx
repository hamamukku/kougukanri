// frontend/app/(app)/admin/tools/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "../../../../src/components/ui/Button";
import Input from "../../../../src/components/ui/Input";
import StatusBadge from "../../../../src/components/ui/StatusBadge";
import { ToolDisplayStatus } from "../../../../src/utils/format";
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
  name: string;
  assetNo: string;
  warehouseId: string;
  warehouseName: string;
  baseStatus?: string;
  status: ToolDisplayStatus;
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
  warehouseId: string;
  tagId: string;
};

type ToolPatchPayload = {
  warehouseId?: string;
  baseStatus?: EditableStatus;
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
    warehouseId: defaultWarehouseId,
    tagId: "",
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
            {props.cancelText ?? "戻る"}
          </Button>

          <Button
            type="button"
            variant={props.dangerOk ? "danger" : "primary"}
            onClick={props.onOk}
            disabled={props.busy}
            style={modalBtnStyle}
          >
            {props.busy ? "処理中..." : props.okText ?? "OK"}
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
  const [name, setName] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [status, setStatus] = useState<EditableStatus>("AVAILABLE");

  const [bulkRows, setBulkRows] = useState<BulkInputRow[]>([]);
  const [bulkRowErrors, setBulkRowErrors] = useState<Record<number, string>>({});

  const [statusEditingId, setStatusEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ✅ window.confirm をやめて、画面内モーダルにする
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Tool | null>(null);

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
      const [toolData, warehouseData] = await Promise.all([
        apiFetchJson<PagedResponse<Tool>>("/api/admin/tools?page=1&pageSize=100"),
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
    if (!name.trim() || !warehouseId) return;
    if (submitting.has("add")) return;

    setSubmitting((prev) => new Set(prev).add("add"));
    try {
      await apiFetchJson<{ id: string }>("/api/admin/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          warehouseId,
          baseStatus: status, // Backward-compatible API field name.
        }),
      });
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
    const next: Record<number, string> = {};
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
        next[rowError.row] = `${suffix}${rowError.message ?? "Error"}`;
      }
      return next;
    }

    const row = body.error?.details?.row;
    if (typeof row === "number") {
      next[row] = body.error?.message ?? "一括登録に失敗しました";
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
            name: row.name.trim(),
            warehouseId: row.warehouseId,
            baseStatus: "AVAILABLE",
            tagId: row.tagId.trim() || undefined,
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
    if (submitting.has(tool.id) || deletingId !== null) return;

    setSubmitting((prev) => new Set(prev).add(tool.id));
    setTools((prev) => prev.map((item) => (item.id === tool.id ? { ...item, ...optimistic } : item)));
    setErr(null);

    try {
      await apiFetchJson<{ id: string }>(`/api/admin/tools/${tool.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (e: unknown) {
      setTools((prev) => prev.map((item) => (item.id === tool.id ? tool : item)));
      const message = handleApiError(e);
      if (message) setErr(message);
    } finally {
      setSubmitting((prev) => {
        const next = new Set(prev);
        next.delete(tool.id);
        return next;
      });
    }
  };

  const onChangeWarehouse = (tool: Tool, nextWarehouseId: string) => {
    if (!nextWarehouseId || nextWarehouseId === tool.warehouseId) return;

    const nextWarehouse = warehouses.find((warehouse) => warehouse.id === nextWarehouseId);
    void patchToolInline(
      tool,
      { warehouseId: nextWarehouseId },
      {
        warehouseId: nextWarehouseId,
        warehouseName: nextWarehouse?.name ?? tool.warehouseName,
      },
    );
  };

  const onChangeStatus = (tool: Tool, nextStatus: EditableStatus) => {
    const currentStatus = toEditableStatus(tool.baseStatus ?? tool.status);
    if (nextStatus === currentStatus) return;

    void patchToolInline(tool, { baseStatus: nextStatus }, { baseStatus: nextStatus });
  };

  // ✅ 削除はまずモーダルを出す
  const requestDelete = (tool: Tool) => {
    if (deletingId || submitting.has(tool.id)) return;
    setDeleteTarget(tool);
    setDeleteConfirmOpen(true);
  };

  // ✅ モーダルで「削除する」押下後に実行
  const doDeleteConfirmed = async () => {
    if (!deleteTarget) return;
    const tool = deleteTarget;

    if (deletingId || submitting.has(tool.id)) return;

    setDeletingId(tool.id);
    setErr(null);

    try {
      await apiFetchJson<{ ok: boolean }>(`/api/admin/tools/${tool.id}`, { method: "DELETE" });
      await loadData();
    } catch (e: unknown) {
      const message = handleApiError(e);
      if (message) setErr(message);
    } finally {
      setDeletingId(null);
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
    }
  };

  if (loading) return <main>loading...</main>;
  if (err)
    return (
      <main>
        <p style={{ color: "var(--danger)" }}>error: {err}</p>
      </main>
    );

  const deleteBusy = deletingId !== null;

  return (
    <main>
      <ConfirmModal
        open={deleteConfirmOpen}
        title="削除の確認"
        message={
          deleteTarget
            ? `工具「${deleteTarget.name}（${deleteTarget.assetNo}）」を本当に削除しますか？`
            : "本当に削除しますか？"
        }
        okText="削除する"
        cancelText="戻る"
        dangerOk
        busy={deleteBusy}
        onOk={doDeleteConfirmed}
        onCancel={() => {
          if (deleteBusy) return;
          setDeleteConfirmOpen(false);
          setDeleteTarget(null);
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
              <div style={{ fontSize: 12, marginBottom: 4 }}>工具名</div>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="工具名" />
            </div>
            <div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>倉庫</div>
              <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} style={selectStyle}>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>状態</div>
              <select value={status} onChange={(e) => setStatus(e.target.value as EditableStatus)} style={selectStyle}>
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {statusLabelJa[option]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Button type="button" onClick={onAdd} disabled={submitting.has("add") || !warehouses.length}>
                追加
              </Button>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <strong>一括追加（工具IDは自動採番）</strong>
              <div style={{ display: "flex", gap: 8 }}>
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

            <Table>
              <thead>
                <tr>
                  <Th>#</Th>
                  <Th>工具名</Th>
                  <Th>倉庫</Th>
                  <Th>状態</Th>
                  <Th>tagId(任意)</Th>
                  <Th>操作</Th>
                </tr>
              </thead>
              <tbody>
                {bulkRows.map((row, index) => (
                  <tr key={row.key}>
                    <Td>{index + 1}</Td>
                    <Td>
                      <Input
                        value={row.name}
                        onChange={(e) =>
                          setBulkRows((prev) =>
                            prev.map((item) => (item.key === row.key ? { ...item, name: e.target.value } : item)),
                          )
                        }
                        placeholder="工具名"
                      />
                      {bulkRowErrors[index + 1] ? (
                        <div style={{ marginTop: 4, color: "var(--danger)", fontSize: 12 }}>{bulkRowErrors[index + 1]}</div>
                      ) : null}
                    </Td>
                    <Td>
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
                    </Td>
                    <Td>AVAILABLE</Td>
                    <Td>
                      <Input
                        value={row.tagId}
                        onChange={(e) =>
                          setBulkRows((prev) =>
                            prev.map((item) => (item.key === row.key ? { ...item, tagId: e.target.value } : item)),
                          )
                        }
                        placeholder="任意"
                      />
                    </Td>
                    <Td>
                      <Button
                        type="button"
                        variant="danger"
                        disabled={bulkRows.length <= 1 || deleteBusy}
                        onClick={() => setBulkRows((prev) => prev.filter((item) => item.key !== row.key))}
                      >
                        行を削除
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </section>

      <section style={{ marginTop: 12 }} className="card-surface">
        <div className="desktop-table">
          <Table>
            <thead>
              <tr>
                <Th>工具名</Th>
                <Th>工具ID</Th>
                <Th>倉庫</Th>
                <Th>状態</Th>
                <Th>操作</Th>
              </tr>
            </thead>
            <tbody>
              {tools.map((tool) => {
                const isBusy = submitting.has(tool.id);
                const disableAction = isBusy || deletingId !== null;
                const currentStatus = toEditableStatus(tool.baseStatus ?? tool.status);
                const isStatusEditing = statusEditingId === tool.id;
                return (
                  <tr key={tool.id}>
                    <Td>{tool.name}</Td>
                    <Td>{tool.assetNo}</Td>
                    <Td>
                      <select
                        value={tool.warehouseId}
                        onChange={(e) => onChangeWarehouse(tool, e.target.value)}
                        disabled={disableAction}
                        style={selectStyle}
                      >
                        {warehouses.map((warehouse) => (
                          <option key={warehouse.id} value={warehouse.id}>
                            {warehouse.name}
                          </option>
                        ))}
                      </select>
                    </Td>
                    <Td>
                      {isStatusEditing && !disableAction ? (
                        <select
                          autoFocus
                          value={currentStatus}
                          onBlur={() => setStatusEditingId((prev) => (prev === tool.id ? null : prev))}
                          onChange={(e) => {
                            setStatusEditingId(null);
                            onChangeStatus(tool, e.target.value as EditableStatus);
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
                          onClick={() => setStatusEditingId(tool.id)}
                          disabled={disableAction}
                          style={{ ...badgeButtonStyle, cursor: disableAction ? "not-allowed" : "pointer" }}
                        >
                          <StatusBadge status={currentStatus} />
                        </button>
                      )}
                    </Td>
                    <Td>
                      <Button type="button" variant="danger" onClick={() => requestDelete(tool)} disabled={disableAction}>
                        {deletingId === tool.id ? "削除中..." : "削除"}
                      </Button>
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
            const disableAction = isBusy || deletingId !== null;
            const currentStatus = toEditableStatus(tool.baseStatus ?? tool.status);
            const isStatusEditing = statusEditingId === tool.id;
            return (
              <article key={tool.id} className="card-surface" style={{ padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 }}>
                  <strong>{tool.name}</strong>
                  <Button type="button" variant="danger" onClick={() => requestDelete(tool)} disabled={disableAction}>
                    {deletingId === tool.id ? "削除中..." : "削除"}
                  </Button>
                </div>

                <div style={{ marginTop: 8, fontSize: 13 }}>工具ID: {tool.assetNo}</div>

                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, marginBottom: 4 }}>倉庫</div>
                  <select
                    value={tool.warehouseId}
                    onChange={(e) => onChangeWarehouse(tool, e.target.value)}
                    disabled={disableAction}
                    style={selectStyle}
                  >
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, marginBottom: 4 }}>状態</div>
                  {isStatusEditing && !disableAction ? (
                    <select
                      autoFocus
                      value={currentStatus}
                      onBlur={() => setStatusEditingId((prev) => (prev === tool.id ? null : prev))}
                      onChange={(e) => {
                        setStatusEditingId(null);
                        onChangeStatus(tool, e.target.value as EditableStatus);
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
                      onClick={() => setStatusEditingId(tool.id)}
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
    </main>
  );
}