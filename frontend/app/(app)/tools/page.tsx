"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "../../../src/components/ui/Button";
import Input from "../../../src/components/ui/Input";
import Select from "../../../src/components/ui/Select";
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
  startDate?: string | null;
  dueDate?: string | null;
};

type Warehouse = {
  id: string;
  name: string;
};

type SearchMode = "partial" | "exact";

type PagedResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

const PAGE_SIZE = 25;

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("partial");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | ToolDisplayStatus>("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const { selectedToolIds, addToSelection, removeFromSelection, hasInSelection } = useLoanBox();
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

  useEffect(() => {
    (async () => {
      try {
        const warehouseData = await apiFetchJson<Warehouse[]>("/api/warehouses");
        setWarehouses(warehouseData);
      } catch (e: unknown) {
        const message = handleApiError(e);
        if (message) setErr(message);
      }
    })();
  }, [handleApiError]);

  const loadTools = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      params.set("mode", searchMode);
      if (warehouseFilter !== "all") params.set("warehouseId", warehouseFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));

      const data = await apiFetchJson<PagedResponse<Tool>>(`/api/tools?${params.toString()}`);
      setTools(data.items ?? []);
      setTotal(data.total ?? 0);
      setErr(null);
    } catch (e: unknown) {
      const message = handleApiError(e);
      if (message) setErr(message);
    } finally {
      setLoading(false);
    }
  }, [handleApiError, page, q, searchMode, statusFilter, warehouseFilter]);

  useEffect(() => {
    loadTools();
  }, [loadTools]);

  useEffect(() => {
    for (const tool of tools) {
      if (selectedToolIds.has(tool.id) && tool.status !== "AVAILABLE") {
        removeFromSelection(tool.id);
      }
    }
  }, [removeFromSelection, selectedToolIds, tools]);

  const statusOptions: ToolDisplayStatus[] = ["AVAILABLE", "LOANED", "RESERVED", "BROKEN", "REPAIR"];
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const warehouseNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const w of warehouses) map.set(w.id, w.name);
    return map;
  }, [warehouses]);

  useEffect(() => {
    setPage(1);
  }, [q, searchMode, warehouseFilter, statusFilter]);

  const onToggle = (toolId: string, checked: boolean) => {
    if (checked) addToSelection(toolId);
    else removeFromSelection(toolId);
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
      <h1>工具一覧</h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr 1fr",
          gap: 12,
          marginTop: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>検索</div>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="工具名 / 資産番号" />
        </div>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>検索モード</div>
          <Select value={searchMode} onChange={(e) => setSearchMode(e.target.value as SearchMode)}>
            <option value="partial">部分一致</option>
            <option value="exact">完全一致</option>
          </Select>
        </div>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>倉庫</div>
          <Select value={warehouseFilter} onChange={(e) => setWarehouseFilter(e.target.value)}>
            <option value="all">すべて</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>状態</div>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | ToolDisplayStatus)}>
            <option value="all">すべて</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 12,
        }}
      >
        <div>表示件数: {tools.length} / 全 {total}</div>
        <div style={{ fontWeight: 700 }}>選択中: {selectedToolIds.size}</div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 8 }}>
        <Button type="button" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          前へ
        </Button>
        <span>
          {page} / {totalPages}
        </span>
        <Button
          type="button"
          variant="ghost"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
        >
          次へ
        </Button>
      </div>

      <div style={{ marginTop: 12 }} />
      <Table>
        <thead>
          <tr>
            <Th>工具名</Th>
            <Th>資産番号</Th>
            <Th>倉庫</Th>
            <Th>状態</Th>
            <Th>選択</Th>
          </tr>
        </thead>
        <tbody>
          {tools.map((tool) => {
            const disabled = tool.status !== "AVAILABLE";
            const checked = hasInSelection(tool.id);
            return (
              <tr key={tool.id}>
                <Td>{tool.name}</Td>
                <Td>{tool.assetNo}</Td>
                <Td>{warehouseNameById.get(tool.warehouseId) ?? tool.warehouseName ?? tool.warehouseId}</Td>
                <Td>{statusLabel(tool.status)}</Td>
                <Td>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={(e) => onToggle(tool.id, e.target.checked)}
                  />
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </main>
  );
}
