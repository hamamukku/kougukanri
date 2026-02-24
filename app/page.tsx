"use client";

import { useEffect, useState } from "react";

export default function Page() {
  const [tools, setTools] = useState<any>(null);
  const [warehouses, setWarehouses] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const tRes = await fetch("/api/tools");
        const wRes = await fetch("/api/warehouses");

        if (!tRes.ok) throw new Error(`/api/tools ${tRes.status}`);
        if (!wRes.ok) throw new Error(`/api/warehouses ${wRes.status}`);

        const t = await tRes.json();
        const w = await wRes.json();

        setTools(t);
        setWarehouses(w);
      } catch (e: any) {
        setErr(String(e?.message ?? e));
      }
    })();
  }, []);

  if (err) {
    return (
      <main style={{ padding: 16 }}>
        <h1>MSW Mock Check</h1>
        <pre>error: {err}</pre>
      </main>
    );
  }

  return (
    <main style={{ padding: 16 }}>
      <h1>MSW Mock Check</h1>

      <h2>/api/tools</h2>
      <pre>{JSON.stringify(tools, null, 2)}</pre>

      <h2>/api/warehouses</h2>
      <pre>{JSON.stringify(warehouses, null, 2)}</pre>
    </main>
  );
}