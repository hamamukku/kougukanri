"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "../../../../src/components/ui/Button";
import Input from "../../../../src/components/ui/Input";
import StatusBadge from "../../../../src/components/ui/StatusBadge";
import ActionMenu from "../../../../src/components/ui/ActionMenu";
import { Table, Td, Th } from "../../../../src/components/ui/Table";
import { useConfirm } from "../../../../src/components/ui/ConfirmProvider";
import { HttpError, apiFetchJson } from "../../../../src/utils/http";

type Warehouse = {
  id: string;
  name: string;
};

type ToolStatus = "available" | "loaned" | "repairing" | "lost";

type Tool = {
  id: string;
  name: string;
  assetNo: string;
  warehouseId: string;
  status: ToolStatus;
};

export default function AdminToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [assetNo, setAssetNo] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [status, setStatus] = useState<ToolStatus>("available");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingAssetNo, setEditingAssetNo] = useState("");
  const [editingWarehouseId, setEditingWarehouseId] = useState("");
  const [editingStatus, setEditingStatus] = useState<ToolStatus>("available");

  const [submitting, setSubmitting] = useState<Set<string>>(new Set());
  const { confirm } = useConfirm();

  const handleApiError = (error: unknown): string | null => {
    if (!(error instanceof HttpError)) return "通信に失敗しました";

    if (error.status === 401) {
      window.location.href = "/login";
      return null;
    }

    if (error.status === 403) {
      return error.message || "権限がありません";
    }

    return error.message || "通信に失敗しました";
  };

  const loadData = useCallback(async () => {
    try {
      const [toolData, warehouseData] = await Promise.all([
        apiFetchJson<Tool[]>("/api/admin/tools"),
        apiFetchJson<Warehouse[]>("/api/admin/warehouses"),
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

  useEffect(() => {
    if (!warehouseId && warehouses.length > 0) {
      setWarehouseId(warehouses[0].id);
    }
  }, [warehouses, warehouseId]);

  const mapWarehouse = useMemo(() => {
    const map = new Map<string, string>();
    for (const warehouse of warehouses) map.set(warehouse.id, warehouse.name);
    return map;
  }, [warehouses]);

  const onAdd = async () => {
    if (!name.trim() || !assetNo.trim() || !warehouseId) return;
    if (submitting.has("add")) return;
    setSubmitting((prev) => new Set(prev).add("add"));
    try {
      await apiFetchJson<{ ok: true } & Record<string, unknown>>("/api/admin/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          assetNo: assetNo.trim(),
          warehouseId,
          status,
        }),
      });
      setName("");
      setAssetNo("");
      setStatus("available");
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

  const onStartEdit = (tool: Tool) => {
    setEditingId(tool.id);
    setEditingName(tool.name);
    setEditingAssetNo(tool.assetNo);
    setEditingWarehouseId(tool.warehouseId);
    setEditingStatus(tool.status);
  };

  const onCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
    setEditingAssetNo("");
    setEditingWarehouseId("");
    setEditingStatus("available");
  };

  const onSave = async (id: string) => {
    const nextName = editingName.trim();
    const nextAssetNo = editingAssetNo.trim();

    if (!nextName || !nextAssetNo || !editingWarehouseId) return;
    if (submitting.has(id)) return;
    setSubmitting((prev) => new Set(prev).add(id));
    try {
      await apiFetchJson<{ ok: true } & Record<string, unknown>>(`/api/admin/tools/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nextName,
          assetNo: nextAssetNo,
          warehouseId: editingWarehouseId,
          status: editingStatus,
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

  const onDelete = async (id: string) => {
    if (!(await confirm({ message: "このツールを削除しますか？" }))) return;
    if (submitting.has(id)) return;
    setSubmitting((prev) => new Set(prev).add(id));
    try {
      await apiFetchJson<{ ok: true } & Record<string, unknown>>(`/api/admin/tools/${id}`, {
        method: "DELETE",
      });
      if (editingId === id) {
        onCancelEdit();
      }
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, alignItems: "end" }}>
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>工具名</div>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="工具名" />
          </div>
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>工具ID</div>
            <Input value={assetNo} onChange={(e) => setAssetNo(e.target.value)} placeholder="A-0001" />
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
            <div style={{ fontSize: 12, marginBottom: 4 }}>状態</div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ToolStatus)}
              style={{ height: 36, borderRadius: 6, border: "1px solid #cbd5e1", width: "100%" }}
            >
              <option value="available">貸出可</option>
              <option value="loaned">貸出中</option>
              <option value="repairing">修理中</option>
              <option value="lost">紛失</option>
            </select>
          </div>
          <div>
            <Button type="button" onClick={onAdd} disabled={submitting.has("add") || !warehouses.length}>
              追加
            </Button>
          </div>
        </div>
      </section>

      <section className="card-surface" style={{ marginTop: 12 }}>
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
                const isEditing = editingId === tool.id;
                const isBusy = submitting.has(tool.id);
                return (
                  <tr key={tool.id}>
                    <Td>
                      {isEditing ? (
                        <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} disabled={isBusy} />
                      ) : (
                        tool.name
                      )}
                    </Td>
                    <Td>
                      {isEditing ? (
                        <Input value={editingAssetNo} onChange={(e) => setEditingAssetNo(e.target.value)} disabled={isBusy} />
                      ) : (
                        tool.assetNo
                      )}
                    </Td>
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
                        mapWarehouse.get(tool.warehouseId) || "不明"
                      )}
                    </Td>
                    <Td>
                      {isEditing ? (
                        <select
                          value={editingStatus}
                          onChange={(e) => setEditingStatus(e.target.value as ToolStatus)}
                          disabled={isBusy}
                          style={{ height: 36, borderRadius: 6, border: "1px solid #cbd5e1" }}
                        >
                          <option value="available">貸出可</option>
                          <option value="loaned">貸出中</option>
                          <option value="repairing">修理中</option>
                          <option value="lost">紛失</option>
                        </select>
                      ) : (
                        <StatusBadge status={tool.status} />
                      )}
                    </Td>
                    <Td>
                      {isEditing ? (
                        <ActionMenu
                          disabled={isBusy}
                          items={[
                            { key: "save", label: "保存", onClick: () => void onSave(tool.id), disabled: isBusy },
                            { key: "cancel", label: "キャンセル", onClick: onCancelEdit, disabled: isBusy },
                          ]}
                        />
                      ) : (
                        <ActionMenu
                          disabled={isBusy}
                          items={[
                            { key: "edit", label: "編集", onClick: () => onStartEdit(tool), disabled: isBusy },
                            { key: "delete", label: "削除", onClick: () => void onDelete(tool.id), danger: true, disabled: isBusy },
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
      </section>
    </main>
  );
}
