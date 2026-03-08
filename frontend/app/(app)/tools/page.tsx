// frontend/app/(app)/tools/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "../../../src/components/ui/Button";
import Input from "../../../src/components/ui/Input";
import Select from "../../../src/components/ui/Select";
import { Table, Td, Th } from "../../../src/components/ui/Table";
import StatusBadge from "../../../src/components/ui/StatusBadge";
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
const statusOptions: ToolDisplayStatus[] = ["AVAILABLE", "LOANED", "RESERVED", "BROKEN", "REPAIR"];
const searchLabelStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  marginBottom: 6,
  textAlign: "center",
  lineHeight: 1.2,
};

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const [searchModeInput, setSearchModeInput] = useState<SearchMode>("partial");
  const [searchMode, setSearchMode] = useState<SearchMode>("partial");
  const [warehouseFilterInput, setWarehouseFilterInput] = useState("all");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [statusFilterInput, setStatusFilterInput] = useState<"all" | ToolDisplayStatus>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | ToolDisplayStatus>("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const { selectedToolIds, addToSelection, removeFromSelection, hasInSelection } = useLoanBox();
  const router = useRouter();
  const hasLoadedToolsRef = useRef(false);

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
    const isInitialLoad = !hasLoadedToolsRef.current;
    if (isInitialLoad) setInitialLoading(true);
    else setListLoading(true);
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
      if (isInitialLoad) {
        hasLoadedToolsRef.current = true;
        setInitialLoading(false);
      } else {
        setListLoading(false);
      }
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

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const warehouseNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const w of warehouses) map.set(w.id, w.name);
    return map;
  }, [warehouses]);

  const onToggle = (toolId: string, checked: boolean) => {
    if (checked) addToSelection(toolId);
    else removeFromSelection(toolId);
  };

  const executeSearch = useCallback(() => {
    const hasCriteriaChanges =
      q !== searchInput ||
      searchMode !== searchModeInput ||
      warehouseFilter !== warehouseFilterInput ||
      statusFilter !== statusFilterInput;

    if (page !== 1) setPage(1);
    if (hasCriteriaChanges) {
      setQ(searchInput);
      setSearchMode(searchModeInput);
      setWarehouseFilter(warehouseFilterInput);
      setStatusFilter(statusFilterInput);
      return;
    }
    if (page === 1) {
      void loadTools();
    }
  }, [loadTools, page, q, searchInput, searchMode, searchModeInput, statusFilter, statusFilterInput, warehouseFilter, warehouseFilterInput]);

  // ✅ チェックボックスを大きくする（デスクトップ/モバイル共通）
  const resetSearch = useCallback(() => {
    const hasActiveCriteria =
      q !== "" || searchMode !== "partial" || warehouseFilter !== "all" || statusFilter !== "all";

    setSearchInput("");
    setSearchModeInput("partial");
    setWarehouseFilterInput("all");
    setStatusFilterInput("all");

    if (page !== 1) setPage(1);
    if (hasActiveCriteria) {
      setQ("");
      setSearchMode("partial");
      setWarehouseFilter("all");
      setStatusFilter("all");
      return;
    }
    if (page === 1) {
      void loadTools();
    }
  }, [loadTools, page, q, searchMode, statusFilter, warehouseFilter]);

  const checkboxStyle: React.CSSProperties = {
    width: 22,
    height: 22,
    transform: "scale(1.25)",
    transformOrigin: "center",
    cursor: "pointer",
  };

  if (initialLoading) return <main>loading...</main>;

  return (
    <main>
      <h1 style={{ fontSize: 28, margin: "0 0 12px" }}>工具一覧</h1>

      <section className="sticky-tools-filter">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <div>
            <div style={searchLabelStyle}>検索</div>
            <Input
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
              }}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={(e) => {
                const nextValue = e.currentTarget.value;
                setIsComposing(false);
                setSearchInput(nextValue);
              }}
              onKeyDown={(e) => {
                const nativeEvent = e.nativeEvent as KeyboardEvent & { isComposing?: boolean };
                if (e.key !== "Enter" || isComposing || nativeEvent.isComposing) return;
                e.preventDefault();
                executeSearch();
              }}
              placeholder="工具名 / 工具ID"
            />
          </div>
          <div>
            <div style={searchLabelStyle}>検索モード</div>
            <Select value={searchModeInput} onChange={(e) => setSearchModeInput(e.target.value as SearchMode)}>
              <option value="partial">部分一致</option>
              <option value="exact">完全一致</option>
            </Select>
          </div>
          <div>
            <div style={searchLabelStyle}>場所</div>
            <Select value={warehouseFilterInput} onChange={(e) => setWarehouseFilterInput(e.target.value)}>
              <option value="all">すべて</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <div style={searchLabelStyle}>状態</div>
            <Select
              value={statusFilterInput}
              onChange={(e) => setStatusFilterInput(e.target.value as "all" | ToolDisplayStatus)}
            >
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
            marginTop: 10,
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <div>
            表示件数: {tools.length} / 全 {total}
          </div>
          <div style={{ fontWeight: 700, marginInline: "auto", textAlign: "center" }}>選択中: {selectedToolIds.size}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Button type="button" onClick={executeSearch}>
              検索
            </Button>
            <Button type="button" variant="ghost" onClick={resetSearch}>
              全件表示
            </Button>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Button
                type="button"
                variant="ghost"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
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
          </div>
        </div>
      </section>

      {err ? (
        <div
          style={{
            marginTop: 12,
            padding: "12px 14px",
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#b91c1c",
          }}
        >
          error: {err}
        </div>
      ) : null}

      <section aria-busy={listLoading} style={{ marginTop: 12 }}>
        {listLoading ? <div style={{ marginBottom: 8 }}>loading...</div> : null}

        <div className="desktop-table tools-list-table">
          <Table>
            <thead>
              <tr>
                <Th>選択</Th>
                <Th>工具名</Th>
                <Th>工具ID</Th>
                <Th>場所</Th>
                <Th>状態</Th>
              </tr>
            </thead>
            <tbody>
              {tools.map((tool) => {
                const disabled = tool.status !== "AVAILABLE";
                const checked = hasInSelection(tool.id);
                const warehouseName = warehouseNameById.get(tool.warehouseId) ?? tool.warehouseName ?? "不明";
                return (
                  <tr
                    key={tool.id}
                    style={{
                      background: checked ? "#dde6ef" : "transparent",
                      boxShadow: checked ? "inset 4px 0 0 #0c4a6e" : "none",
                      transition: "background-color 120ms ease",
                    }}
                  >
                    <Td>
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={(e) => onToggle(tool.id, e.target.checked)}
                          style={checkboxStyle}
                        />
                      </div>
                    </Td>
                    <Td>{tool.name}</Td>
                    <Td>{tool.assetNo}</Td>
                    <Td>{warehouseName}</Td>
                    <Td>
                      <StatusBadge status={tool.status} />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>

        <div className="mobile-cards">
          {tools.map((tool) => {
            const disabled = tool.status !== "AVAILABLE";
            const checked = hasInSelection(tool.id);
            const warehouseName = warehouseNameById.get(tool.warehouseId) ?? tool.warehouseName ?? "不明";
            return (
              <article
                key={tool.id}
                className="card-surface"
                style={{
                  padding: 12,
                  background: checked ? "#dde6ef" : undefined,
                  borderColor: checked ? "#9fb3c7" : undefined,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <strong>{tool.name}</strong>
                  <StatusBadge status={tool.status} />
                </div>
                <div style={{ marginTop: 8, fontSize: 13 }}>工具ID: {tool.assetNo}</div>
                <div style={{ marginTop: 4, fontSize: 13 }}>場所: {warehouseName}</div>
                <label
                  style={{
                    marginTop: 10,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    cursor: disabled ? "not-allowed" : "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={(e) => onToggle(tool.id, e.target.checked)}
                    style={checkboxStyle}
                  />
                  貸出ボックスに追加
                </label>
              </article>
            );
          })}
        </div>
      </section>

      <style jsx>{`
        .tools-list-table :global(th),
        .tools-list-table :global(td) {
          text-align: center !important;
          vertical-align: middle;
        }
      `}</style>
    </main>
  );
}
