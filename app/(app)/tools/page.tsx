"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "../../../src/components/ui/Button";
import Input from "../../../src/components/ui/Input";
import Select from "../../../src/components/ui/Select";
import { Table, Td, Th } from "../../../src/components/ui/Table";
import { statusLabel } from "../../../src/utils/format";
import { apiFetchJson, getHttpErrorMessage, isHttpError } from "../../../src/utils/http";
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

type SearchMode = "partial" | "exact";

const PAGE_SIZE = 25;

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("partial");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const { selectedToolIds, addToSelection, removeFromSelection, hasInSelection } = useLoanBox();
  const router = useRouter();

  const handleApiError = (error: unknown): string | null => {
    if (isHttpError(error) && error.status === 401) {
      router.push("/login");
      return null;
    }

    if (isHttpError(error) && error.status === 403) {
      router.push("/tools");
      return null;
    }

    return getHttpErrorMessage(error);
  };

  useEffect(() => {
    (async () => {
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
    })();
  }, []);

  useEffect(() => {
    if (loading || tools.length === 0) return;

    const invalidIds = Array.from(selectedToolIds).filter((toolId) => {
      const target = tools.find((tool) => tool.id === toolId);
      return !target || target.status !== "available";
    });
    if (invalidIds.length === 0) return;
    for (const id of invalidIds) {
      removeFromSelection(id);
    }
  }, [tools, selectedToolIds, removeFromSelection]);

  const warehouseNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const w of warehouses) map.set(w.id, w.name);
    return map;
  }, [warehouses]);

  const statusOptions: ToolStatus[] = ["available", "loaned", "repairing", "lost"];
  const filteredTools = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    return tools.filter((tool) => {
      if (keyword) {
        const targetName = tool.name.toLowerCase();
        const targetAsset = tool.assetNo.toLowerCase();
        if (searchMode === "exact" && targetName !== keyword && targetAsset !== keyword) return false;
        if (searchMode === "partial" && !targetName.includes(keyword) && !targetAsset.includes(keyword))
          return false;
      }
      if (warehouseFilter !== "all" && tool.warehouseId !== warehouseFilter) return false;
      if (statusFilter !== "all" && tool.status !== statusFilter) return false;
      return true;
    });
  }, [tools, q, searchMode, warehouseFilter, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [q, searchMode, warehouseFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredTools.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageTools = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredTools.slice(start, start + PAGE_SIZE);
  }, [filteredTools, safePage]);

  const onToggle = (toolId: string, checked: boolean) => {
    if (checked) addToSelection(toolId);
    else removeFromSelection(toolId);
  };

  if (loading) return <main style={{ padding: 16 }}>loading...</main>;
  if (err) return <main style={{ padding: 16 }}><p style={{ color: "#b91c1c" }}>error: {err}</p></main>;

  return (
    <main style={{ padding: 16 }}>
      <h1>ツール一覧</h1>

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
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ツール名 / 資産番号" />
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
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">すべて</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
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
        <div>表示件数: {filteredTools.length}</div>
        <div style={{ fontWeight: 700 }}>貸出ボックス（選択数）: {selectedToolIds.size}</div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 8 }}>
        <Button type="button" variant="ghost" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          前へ
        </Button>
        <span>
          {safePage} / {totalPages}
        </span>
        <Button
          type="button"
          variant="ghost"
          disabled={safePage >= totalPages}
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
            <Th>操作</Th>
          </tr>
        </thead>
        <tbody>
          {pageTools.map((tool) => {
            const disabled = tool.status !== "available";
            const checked = hasInSelection(tool.id);
            return (
              <tr key={tool.id}>
                <Td>{tool.name}</Td>
                <Td>{tool.assetNo}</Td>
                <Td>{warehouseNameById.get(tool.warehouseId) ?? tool.warehouseId}</Td>
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
