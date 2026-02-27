"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "selectedToolIds_v1";

type LoanBoxContextValue = {
  selectedToolIds: Set<string>;
  addToSelection: (id: string) => void;
  removeFromSelection: (id: string) => void;
  hasInSelection: (id: string) => boolean;
  clearSelection: () => void;
};

const LoanBoxContext = createContext<LoanBoxContextValue | null>(null);

function readSelection(): Set<string> {
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x) => typeof x === "string" && x.trim()) as string[]);
  } catch {
    return new Set();
  }
}

function writeSelection(ids: Set<string>) {
  try {
    if (typeof sessionStorage === "undefined") return;
    if (ids.size === 0) {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // ignore
  }
}

export function LoanBoxProvider({ children }: { children: React.ReactNode }) {
  const [selectedToolIds, setSelectedToolIds] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedToolIds(readSelection());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeSelection(selectedToolIds);
  }, [selectedToolIds, hydrated]);

  const value = useMemo<LoanBoxContextValue>(() => {
    return {
      selectedToolIds,
      addToSelection: (id: string) => {
        setSelectedToolIds((prev) => {
          if (!id.trim()) return prev;
          if (prev.has(id)) return prev;
          const next = new Set(prev);
          next.add(id);
          return next;
        });
      },
      removeFromSelection: (id: string) => {
        setSelectedToolIds((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      },
      hasInSelection: (id: string) => selectedToolIds.has(id),
      clearSelection: () => {
        setSelectedToolIds(new Set());
      },
    };
  }, [selectedToolIds]);

  return <LoanBoxContext.Provider value={value}>{children}</LoanBoxContext.Provider>;
}

export function useLoanBox() {
  const ctx = useContext(LoanBoxContext);
  if (!ctx) throw new Error("useLoanBox must be used within LoanBoxProvider");
  return ctx;
}
