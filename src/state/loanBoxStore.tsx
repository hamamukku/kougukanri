"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "loanBoxToolIds";

type LoanBoxContextValue = {
  loanBoxIds: Set<string>;
  addToLoanBox: (id: string) => void;
  removeFromLoanBox: (id: string) => void;
  hasInLoanBox: (id: string) => boolean;
  clearLoanBox: () => void;
};

const LoanBoxContext = createContext<LoanBoxContextValue | null>(null);

export function LoanBoxProvider({ children }: { children: React.ReactNode }) {
  const [loanBoxIds, setLoanBoxIds] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  // 初期復元
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as unknown;
        if (Array.isArray(arr)) {
          const onlyStrings = arr.filter((x) => typeof x === "string") as string[];
          setLoanBoxIds(new Set(onlyStrings));
        }
      }
    } catch {
      // ignore
    } finally {
      setHydrated(true);
    }
  }, []);

  // 永続化
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(loanBoxIds)));
    } catch {
      // ignore
    }
  }, [loanBoxIds, hydrated]);

  const value = useMemo<LoanBoxContextValue>(() => {
    return {
      loanBoxIds,
      addToLoanBox: (id: string) =>
        setLoanBoxIds((prev) => {
          const next = new Set(prev);
          next.add(id);
          return next;
        }),
      removeFromLoanBox: (id: string) =>
        setLoanBoxIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        }),
      hasInLoanBox: (id: string) => loanBoxIds.has(id),
      clearLoanBox: () => setLoanBoxIds(new Set()),
    };
  }, [loanBoxIds]);

  return <LoanBoxContext.Provider value={value}>{children}</LoanBoxContext.Provider>;
}

export function useLoanBox() {
  const ctx = useContext(LoanBoxContext);
  if (!ctx) throw new Error("useLoanBox must be used within LoanBoxProvider");
  return ctx;
}
