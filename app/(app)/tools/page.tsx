"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "../../../src/components/ui/Button";
import Input from "../../../src/components/ui/Input";
import Select from "../../../src/components/ui/Select";
import { Table, Td, Th } from "../../../src/components/ui/Table";
import StatusBadge from "../../../src/components/ui/StatusBadge";
import Toast from "../../../src/components/ui/Toast";
import { apiFetchJson, getHttpErrorMessage, isHttpError } from "../../../src/utils/http";
import { useLoanBox } from "../../../src/state/loanBoxStore";

type ToolStatus = "available" | "loaned" | "repairing" | "lost" | "AVAILABLE" | "LOANED" | "RESERVED" | "BROKEN" | "REPAIR";

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

function normalizeStatus(status: string): string {
  return status.trim().toUpperCase();
}

function isSelectable(status: string): boolean {
  return normalizeStatus(status) === "AVAILABLE";
}

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
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
      return !target || !isSelectable(target.status);
    });
    if (invalidIds.length === 0) return;
    for (const id of invalidIds) {
      removeFromSelection(id);
    }
  }, [loading, tools, selectedToolIds, removeFromSelection]);

  useEffect(() => {
    setPage(1);
  }, [q, searchMode, warehouseFilter, statusFilter]);

  const warehouseNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const w of warehouses) map.set(w.id, w.name);
    return map;
  }, [warehouses]);

  const statusOptions = useMemo(() => {
    const values = new Set<string>();
    for (const tool of tools) {
      values.add(normalizeStatus(tool.status));
    }
    return Array.from(values).sort();
  }, [tools]);

  const filteredTools = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    return tools.filter((tool) => {
      if (keyword) {
        const targetName = tool.name.toLowerCase();
        const targetAsset = tool.assetNo.toLowerCase();
        if (searchMode === "exact" && targetName !== keyword && targetAsset !== keyword) return false;
        if (searchMode === "partial" && !targetName.includes(keyword) && !targetAsset.includes(keyword)) return false;
      }
      if (warehouseFilter !== "all" && tool.warehouseId !== warehouseFilter) return false;
      if (statusFilter !== "all" && normalizeStatus(tool.status) !== statusFilter) return false;
      return true;
    });
  }, [tools, q, searchMode, warehouseFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredTools.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageTools = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredTools.slice(start, start + PAGE_SIZE);
  }, [filteredTools, safePage]);

  const onToggle = (tool: Tool, checked: boolean) => {
    if (checked) {
      addToSelection(tool.id);
      setToastMessage(`${tool.name} を選択しました`);
    } else {
      removeFromSelection(tool.id);
      setToastMessage(`${tool.name} の選択を解除しました`);
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
      <h1>工具一覧</h1>

      <section className="sticky-tools-filter">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>検索</div>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="工具名 / 工具ID" />
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
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <div>表示件数: {filteredTools.length}</div>
          <div style={{ fontWeight: 700 }}>選択中: {selectedToolIds.size}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
        </div>
      </section>

      <div className="desktop-table" style={{ marginTop: 12 }}>
        <Table>
          <thead>
            <tr>
              <Th>工具名</Th>
              <Th>工具ID</Th>
              <Th>倉庫</Th>
              <Th>状態</Th>
              <Th>選択</Th>
            </tr>
          </thead>
          <tbody>
            {pageTools.map((tool) => {
              const disabled = !isSelectable(tool.status);
              const checked = hasInSelection(tool.id);
              return (
                <tr
                  key={tool.id}
                  style={{
                    background: checked ? "#dde6ef" : "transparent",
                    boxShadow: checked ? "inset 4px 0 0 #0c4a6e" : "none",
                    transition: "background-color 120ms ease",
                  }}
                >
                  <Td>{tool.name}</Td>
                  <Td>{tool.assetNo}</Td>
                  <Td>{warehouseNameById.get(tool.warehouseId) ?? "不明"}</Td>
                  <Td>
                    <StatusBadge status={tool.status} />
                  </Td>
                  <Td>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={(e) => onToggle(tool, e.target.checked)}
                    />
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>

      <div className="mobile-cards">
        {pageTools.map((tool) => {
          const disabled = !isSelectable(tool.status);
          const checked = hasInSelection(tool.id);
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
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <strong>{tool.name}</strong>
                <StatusBadge status={tool.status} />
              </div>
              <div style={{ marginTop: 8, fontSize: 13 }}>工具ID: {tool.assetNo}</div>
              <div style={{ marginTop: 4, fontSize: 13 }}>倉庫: {warehouseNameById.get(tool.warehouseId) ?? "不明"}</div>
              <label style={{ marginTop: 8, display: "inline-flex", gap: 6, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={(e) => onToggle(tool, e.target.checked)}
                />
                貸出ボックスに追加
              </label>
            </article>
          );
        })}
      </div>

      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
    </main>
  );
}
