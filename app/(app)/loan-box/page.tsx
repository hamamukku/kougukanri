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

const BORROWER_DRAFT_KEY = "loanBoxBorrowerDraft_v1";
const NOTE_DRAFT_KEY = "loanBoxNoteDraft_v1";

export default function LoanBoxPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [borrower, setBorrower] = useState("");
  const [note, setNote] = useState("");

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
      const b = localStorage.getItem(BORROWER_DRAFT_KEY) || "";
      const n = localStorage.getItem(NOTE_DRAFT_KEY) || "";

      if (b.trim()) {
        setBorrower(b);
      } else {
        const u = getCookie("username") || "";
        if (u.trim()) {
          setBorrower(u);
        }
      }

      if (n.trim()) {
        setNote(n);
      }
    } catch {
      // no-op
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      await loadData();
      setErr(null);
      alert("\u8cb8\u51fa\u3092\u767b\u9332\u3057\u307e\u3057\u305f");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <main style={{ padding: 16 }}>loading...</main>;

  return (
    <main style={{ padding: 16 }}>
      <h1>{"\u8cb8\u51fa\u30dc\u30c3\u30af\u30b9"}</h1>

      <div style={{ marginTop: 12, marginBottom: 12, display: "flex", gap: 8 }}>
        <Button type="button" variant="ghost" disabled={checkoutDisabled} onClick={onCheckout}>
          {"\u8cb8\u51fa\u5b9f\u884c"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={loanBoxTools.length === 0 || submitting}
          onClick={clearLoanBox}
        >
          {"\u7bb1\u3092\u7a7a\u306b\u3059\u308b"}
        </Button>
      </div>

      {hasNonAvailable ? (
        <p style={{ color: "#b91c1c", marginBottom: 12 }}>
          {"\u8cb8\u51fa\u3067\u304d\u306a\u3044\u72b6\u614b\u306e\u5de5\u5177\u304c\u542b\u307e\u308c\u3066\u3044\u307e\u3059\uff08available\u306e\u307f\u8cb8\u51fa\u53ef\uff09"}
        </p>
      ) : null}

      <div style={{ display: "grid", gap: 8, maxWidth: 480, marginBottom: 12 }}>
        <Input value={borrower} onChange={(e) => { const v = e.target.value; setBorrower(v); try { localStorage.setItem(BORROWER_DRAFT_KEY, v); } catch {} }} placeholder="例: 田中（A現場）" />
        <Input value={note} onChange={(e) => { const v = e.target.value; setNote(v); try { localStorage.setItem(NOTE_DRAFT_KEY, v); } catch {} }} placeholder="備考（任意）" />
      </div>

      {err ? <p style={{ color: "#b91c1c", marginBottom: 12 }}>error: {err}</p> : null}

      {loanBoxTools.length === 0 ? (
        <p>{"\u8cb8\u51fa\u30dc\u30c3\u30af\u30b9\u306f\u7a7a\u3067\u3059"}</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{"\u5de5\u5177\u540d"}</Th>
              <Th>{"\u5009\u5eab"}</Th>
              <Th>{"\u72b6\u614b"}</Th>
              <Th>{"\u64cd\u4f5c"}</Th>
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
                    {"\u7bb1\u304b\u3089\u5916\u3059"}
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
