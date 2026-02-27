"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "../../../../src/components/ui/Button";
import Input from "../../../../src/components/ui/Input";
import { statusLabel, ToolDisplayStatus } from "../../../../src/utils/format";
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

const baseStatusOptions: BaseStatus[] = ["AVAILABLE", "BROKEN", "REPAIR"];

export default function AdminToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [assetNo, setAssetNo] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [baseStatus, setBaseStatus] = useState<BaseStatus>("AVAILABLE");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingWarehouseId, setEditingWarehouseId] = useState("");
  const [editingBaseStatus, setEditingBaseStatus] = useState<BaseStatus>("AVAILABLE");

  const [submitting, setSubmitting] = useState<Set<string>>(new Set());
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
      await apiFetchJson<{ id: string }>("/api/admin/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          assetNo: assetNo.trim(),
          warehouseId,
          baseStatus,
        }),
      });
      setName("");
      setAssetNo("");
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

  if (loading) return <main style={{ padding: 16 }}>loading...</main>;
  if (err)
    return (
      <main style={{ padding: 16 }}>
        <p style={{ color: "#b91c1c" }}>error: {err}</p>
      </main>
    );

  return (
    <main style={{ padding: 16 }}>
      <h1>工具管理</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>工具名</div>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="工具名" />
        </div>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>資産番号</div>
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
          <div style={{ fontSize: 12, marginBottom: 4 }}>ベース状態</div>
          <select
            value={baseStatus}
            onChange={(e) => setBaseStatus(e.target.value as BaseStatus)}
            style={{ height: 36, borderRadius: 6, border: "1px solid #cbd5e1", width: "100%" }}
          >
            {baseStatusOptions.map((option) => (
              <option key={option} value={option}>
                {statusLabel(option)}
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

      <div style={{ marginTop: 12 }} />
      <Table>
        <thead>
          <tr>
            <Th>ツール名</Th>
            <Th>資産番号</Th>
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
                    mapWarehouse.get(tool.warehouseId) || tool.warehouseName || tool.warehouseId
                  )}
                </Td>
                <Td>{statusLabel(tool.status)}</Td>
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
                          {statusLabel(option)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    statusLabel(tool.baseStatus)
                  )}
                </Td>
                <Td>
                  {isEditing ? (
                    <>
                      <Button type="button" onClick={() => onSave(tool.id)} disabled={isBusy}>
                        保存
                      </Button>
                      <Button type="button" variant="ghost" onClick={onCancelEdit} disabled={isBusy}>
                        キャンセル
                      </Button>
                    </>
                  ) : (
                    <Button type="button" onClick={() => onStartEdit(tool)} disabled={isBusy}>
                      編集
                    </Button>
                  )}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </main>
  );
}
