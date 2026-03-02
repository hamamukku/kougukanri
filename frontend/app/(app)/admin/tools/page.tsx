"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "../../../../src/components/ui/Button";
import Input from "../../../../src/components/ui/Input";
import StatusBadge from "../../../../src/components/ui/StatusBadge";
import ActionMenu from "../../../../src/components/ui/ActionMenu";
import { ToolDisplayStatus } from "../../../../src/utils/format";
import { Table, Td, Th } from "../../../../src/components/ui/Table";
import { apiFetchJson, getHttpErrorMessage, isHttpError } from "../../../../src/utils/http";
import { clearAuthSession } from "../../../../src/utils/auth";

type Warehouse = {
  id: string;
  name: string;
};

type BaseStatus = "AVAILABLE" | "BROKEN" | "REPAIR";

type Tool = {
  id: string;
  name: string;
  assetNo: string;
  warehouseId: string;
  warehouseName: string;
  baseStatus: BaseStatus;
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

const baseStatusOptions: BaseStatus[] = ["AVAILABLE", "BROKEN", "REPAIR"];

function createBulkRow(defaultWarehouseId: string): BulkInputRow {
  return {
    key: `${Date.now()}-${Math.random()}`,
    name: "",
    warehouseId: defaultWarehouseId,
    tagId: "",
  };
}

export default function AdminToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [name, setName] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [baseStatus, setBaseStatus] = useState<BaseStatus>("AVAILABLE");

  const [bulkRows, setBulkRows] = useState<BulkInputRow[]>([]);
  const [bulkRowErrors, setBulkRowErrors] = useState<Record<number, string>>({});

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingWarehouseId, setEditingWarehouseId] = useState("");
  const [editingBaseStatus, setEditingBaseStatus] = useState<BaseStatus>("AVAILABLE");

  const [submitting, setSubmitting] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
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
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!warehouseId && warehouses.length > 0) {
      setWarehouseId(warehouses[0].id);
    }
    if (bulkRows.length === 0 && warehouses.length > 0) {
      setBulkRows([createBulkRow(warehouses[0].id)]);
    }
  }, [bulkRows.length, warehouseId, warehouses]);

  const mapWarehouse = useMemo(() => {
    const map = new Map<string, string>();
    for (const warehouse of warehouses) map.set(warehouse.id, warehouse.name);
    return map;
  }, [warehouses]);

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
          baseStatus,
        }),
      });
      setName("");
      setBaseStatus("AVAILABLE");
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
        next[rowError.row] = `${suffix}${rowError.message ?? "エラー"}`;
      }
      return next;
    }

    const row = body.error?.details?.row;
    if (typeof row === "number") {
      next[row] = body.error?.message ?? "登録に失敗しました";
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

  const onStartEdit = (tool: Tool) => {
    setEditingId(tool.id);
    setEditingName(tool.name);
    setEditingWarehouseId(tool.warehouseId);
    setEditingBaseStatus(tool.baseStatus);
  };

  const onCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
    setEditingWarehouseId("");
    setEditingBaseStatus("AVAILABLE");
  };

  const onSave = async (id: string) => {
    const nextName = editingName.trim();
    if (!nextName || !editingWarehouseId) return;
    if (submitting.has(id)) return;

    setSubmitting((prev) => new Set(prev).add(id));
    try {
      await apiFetchJson<{ id: string }>(`/api/admin/tools/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nextName,
          warehouseId: editingWarehouseId,
          baseStatus: editingBaseStatus,
        }),
      });
      onCancelEdit();
      await loadData();
    } catch (e: unknown) {
      const message = handleApiError(e);
      if (message) setErr(message);
    } finally {
      setSubmitting((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const onDelete = async (tool: Tool) => {
    if (deletingId || submitting.size > 0) return;

    const confirmed = window.confirm(`工具「${tool.name} (${tool.assetNo})」を削除します。よろしいですか？`);
    if (!confirmed) return;

    setDeletingId(tool.id);
    try {
      await apiFetchJson<{ ok: boolean }>(`/api/admin/tools/${tool.id}`, {
        method: "DELETE",
      });
      if (editingId === tool.id) {
        onCancelEdit();
      }
      await loadData();
    } catch (e: unknown) {
      const message = handleApiError(e);
      if (message) setErr(message);
    } finally {
      setDeletingId(null);
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
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                style={{ height: 36, borderRadius: 6, border: "1px solid #cbd5e1", width: "100%" }}
              >
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>ベース状態</div>
              <select
                value={baseStatus}
                onChange={(e) => setBaseStatus(e.target.value as BaseStatus)}
                style={{ height: 36, borderRadius: 6, border: "1px solid #cbd5e1", width: "100%" }}
              >
                {baseStatusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
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
                  行追加
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
                        style={{ height: 36, borderRadius: 6, border: "1px solid #cbd5e1", width: "100%" }}
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
                        variant="ghost"
                        disabled={bulkRows.length <= 1}
                        onClick={() => setBulkRows((prev) => prev.filter((item) => item.key !== row.key))}
                        style={{ borderColor: "#ef4444", color: "#b91c1c" }}
                      >
                        行削除
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
                <Th>表示状態</Th>
                <Th>ベース状態</Th>
                <Th>操作</Th>
              </tr>
            </thead>
            <tbody>
              {tools.map((tool) => {
                const isEditing = editingId === tool.id;
                const isBusy = submitting.has(tool.id);
                const disableAction = isBusy || deletingId !== null;
                const warehouseName = mapWarehouse.get(tool.warehouseId) || tool.warehouseName || "不明";
                return (
                  <tr key={tool.id}>
                    <Td>
                      {isEditing ? (
                        <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} disabled={isBusy} />
                      ) : (
                        tool.name
                      )}
                    </Td>
                    <Td>{tool.assetNo}</Td>
                    <Td>
                      {isEditing ? (
                        <select
                          value={editingWarehouseId}
                          onChange={(e) => setEditingWarehouseId(e.target.value)}
                          disabled={isBusy}
                          style={{ height: 36, borderRadius: 6, border: "1px solid #cbd5e1" }}
                        >
                          {warehouses.map((warehouse) => (
                            <option key={warehouse.id} value={warehouse.id}>
                              {warehouse.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        warehouseName
                      )}
                    </Td>
                    <Td>
                      <StatusBadge status={tool.status} />
                    </Td>
                    <Td>
                      {isEditing ? (
                        <select
                          value={editingBaseStatus}
                          onChange={(e) => setEditingBaseStatus(e.target.value as BaseStatus)}
                          disabled={isBusy}
                          style={{ height: 36, borderRadius: 6, border: "1px solid #cbd5e1" }}
                        >
                          {baseStatusOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <StatusBadge status={tool.baseStatus} />
                      )}
                    </Td>
                    <Td>
                      {isEditing ? (
                        <ActionMenu
                          disabled={disableAction}
                          items={[
                            { key: "save", label: "保存", onClick: () => void onSave(tool.id), disabled: disableAction },
                            { key: "cancel", label: "キャンセル", onClick: onCancelEdit, disabled: disableAction },
                          ]}
                        />
                      ) : (
                        <ActionMenu
                          disabled={disableAction}
                          items={[
                            { key: "edit", label: "編集", onClick: () => onStartEdit(tool), disabled: disableAction },
                            {
                              key: "delete",
                              label: deletingId === tool.id ? "削除中..." : "削除",
                              onClick: () => void onDelete(tool),
                              danger: true,
                              disabled: disableAction,
                            },
                          ]}
                        />
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
            const isEditing = editingId === tool.id;
            const isBusy = submitting.has(tool.id);
            const disableAction = isBusy || deletingId !== null;
            const warehouseName = mapWarehouse.get(tool.warehouseId) || tool.warehouseName || "不明";
            return (
              <article key={tool.id} className="card-surface" style={{ padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 }}>
                  <strong>{tool.name}</strong>
                  {isEditing ? (
                    <ActionMenu
                      disabled={disableAction}
                      items={[
                        { key: "save", label: "保存", onClick: () => void onSave(tool.id), disabled: disableAction },
                        { key: "cancel", label: "キャンセル", onClick: onCancelEdit, disabled: disableAction },
                      ]}
                    />
                  ) : (
                    <ActionMenu
                      disabled={disableAction}
                      items={[
                        { key: "edit", label: "編集", onClick: () => onStartEdit(tool), disabled: disableAction },
                        {
                          key: "delete",
                          label: deletingId === tool.id ? "削除中..." : "削除",
                          onClick: () => void onDelete(tool),
                          danger: true,
                          disabled: disableAction,
                        },
                      ]}
                    />
                  )}
                </div>
                <div style={{ marginTop: 8, fontSize: 13 }}>工具ID: {tool.assetNo}</div>
                <div style={{ marginTop: 4, fontSize: 13 }}>
                  倉庫: {isEditing ? mapWarehouse.get(editingWarehouseId) || "不明" : warehouseName}
                </div>
                <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <StatusBadge status={tool.status} />
                  <StatusBadge status={isEditing ? editingBaseStatus : tool.baseStatus} />
                </div>
                {isEditing ? (
                  <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                    <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} disabled={isBusy} />
                    <select
                      value={editingWarehouseId}
                      onChange={(e) => setEditingWarehouseId(e.target.value)}
                      disabled={isBusy}
                      style={{ height: 36, borderRadius: 6, border: "1px solid #cbd5e1" }}
                    >
                      {warehouses.map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>
                          {warehouse.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={editingBaseStatus}
                      onChange={(e) => setEditingBaseStatus(e.target.value as BaseStatus)}
                      disabled={isBusy}
                      style={{ height: 36, borderRadius: 6, border: "1px solid #cbd5e1" }}
                    >
                      {baseStatusOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
