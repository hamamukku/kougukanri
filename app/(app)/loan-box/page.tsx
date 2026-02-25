"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "../../../src/components/ui/Button";
import Input from "../../../src/components/ui/Input";
import { Table, Td, Th } from "../../../src/components/ui/Table";
import { getCookie } from "../../../src/utils/format";
import { useLoanBox } from "../../../src/state/loanBoxStore";

type Tool = {
  id: string;
  name: string;
  warehouseId: string;
  status: string;
};

type Warehouse = {
  id: string;
  name: string;
};

export default function LoanBoxPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [borrower, setBorrower] = useState("");
  const [note, setNote] = useState("");

  const BORROWER_DRAFT_KEY = "loanBoxBorrowerDraft_v1";
  const NOTE_DRAFT_KEY = "loanBoxNoteDraft_v1";

  const { loanBoxIds, removeFromLoanBox, clearLoanBox } = useLoanBox();

  const loadData = useCallback(async () => {
    try {
      const [tRes, wRes] = await Promise.all([fetch("/api/tools"), fetch("/api/warehouses")]);

      if (!tRes.ok) throw new Error(`/api/tools ${tRes.status}`);
      if (!wRes.ok) throw new Error(`/api/warehouses ${wRes.status}`);

      const t = (await tRes.json()) as Tool[];
      const w = (await wRes.json()) as Warehouse[];
      setTools(t);
      setWarehouses(w);
      setErr(null);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    try {
      const b = localStorage.getItem(BORROWER_DRAFT_KEY);
      const n = localStorage.getItem(NOTE_DRAFT_KEY);
      if (b && !borrower.trim()) setBorrower(b);
      if (n && !note.trim()) setNote(n);
    } catch {}
  }, []);

  useEffect(() => {
    if (borrower.trim()) return;
    let draft = "";
    try {
      draft = localStorage.getItem(BORROWER_DRAFT_KEY) || "";
    } catch {}
    if (draft.trim()) return;
    const u = getCookie("username");
    if (u) setBorrower(u);
  }, []);

  useEffect(() => {
    try {
      if (borrower.trim() === "") {
        localStorage.removeItem(BORROWER_DRAFT_KEY);
      } else {
        localStorage.setItem(BORROWER_DRAFT_KEY, borrower);
      }
    } catch {}
  }, [borrower]);

  useEffect(() => {
    try {
      if (note.trim() === "") {
        localStorage.removeItem(NOTE_DRAFT_KEY);
      } else {
        localStorage.setItem(NOTE_DRAFT_KEY, note);
      }
    } catch {}
  }, [note]);

  const warehouseNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of warehouses) m.set(w.id, w.name);
    return m;
  }, [warehouses]);

  const loanBoxTools = useMemo(() => tools.filter((t) => loanBoxIds.has(t.id)), [tools, loanBoxIds]);

  const loanBoxToolIds = useMemo(() => loanBoxTools.map((t) => t.id), [loanBoxTools]);
  const hasNonAvailable = useMemo(() => loanBoxTools.some((t) => t.status !== "available"), [loanBoxTools]);
  const checkoutDisabled =
    loanBoxTools.length === 0 || submitting || hasNonAvailable || borrower.trim().length === 0;

  const onCheckout = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/loans/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: loanBoxToolIds,
          borrower,
          note,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const msg =
          body && typeof body === "object" && "message" in body
            ? String((body as { message?: unknown }).message)
            : `checkout failed ${res.status}`;
        throw new Error(msg);
      }

      try {
        localStorage.removeItem(BORROWER_DRAFT_KEY);
        localStorage.removeItem(NOTE_DRAFT_KEY);
      } catch {}

      clearLoanBox();
      setBorrower("");
      setNote("");
      await loadData();
      setErr(null);
      alert("貸出を登録しました");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <main style={{ padding: 16 }}>loading...</main>;

  return (
    <main style={{ padding: 16 }}>
      <h1>貸出ボックス</h1>

      <div style={{ marginTop: 12, marginBottom: 12, display: "flex", gap: 8 }}>
        <Button type="button" variant="ghost" disabled={checkoutDisabled} onClick={onCheckout}>
          貸出実行
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={loanBoxTools.length === 0 || submitting}
          onClick={clearLoanBox}
        >
          箱を空にする
        </Button>
      </div>

      {hasNonAvailable ? (
        <p style={{ color: "#b91c1c", marginBottom: 12 }}>
          貸出できない状態の工具が含まれています（availableのみ貸出可）
        </p>
      ) : null}

      <div style={{ display: "grid", gap: 8, maxWidth: 480, marginBottom: 12 }}>
        <Input
          value={borrower}
          onChange={(e) => setBorrower(e.target.value)}
          placeholder="例: 田中（A現場）"
        />
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="メモ（任意）"
        />
      </div>

      {err ? <p style={{ color: "#b91c1c", marginBottom: 12 }}>error: {err}</p> : null}

      {loanBoxTools.length === 0 ? (
        <p>貸出ボックスは空です</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>工具名</Th>
              <Th>倉庫</Th>
              <Th>状態</Th>
              <Th>操作</Th>
            </tr>
          </thead>
          <tbody>
            {loanBoxTools.map((t) => (
              <tr key={t.id}>
                <Td>{t.name}</Td>
                <Td>{warehouseNameById.get(t.warehouseId) ?? t.warehouseId}</Td>
                <Td>{t.status}</Td>
                <Td>
                  <Button type="button" onClick={() => removeFromLoanBox(t.id)}>
                    箱から外す
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </main>
  );
}
