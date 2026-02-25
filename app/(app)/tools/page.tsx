"use client";

import { useEffect, useState } from "react";

type Tool = {
  id: string;
  name: string;
  warehouseId: string;
  status: string;
};

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/tools");
        if (!res.ok) {
          throw new Error(`/api/tools ${res.status}`);
        }
        const data = (await res.json()) as Tool[];
        setTools(data);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <main style={{ padding: 16 }}>loading...</main>;
  }

  if (err) {
    return (
      <main style={{ padding: 16 }}>
        <pre>error: {err}</pre>
      </main>
    );
  }

  return (
    <main style={{ padding: 16 }}>
      <h1>工具一覧</h1>
      <ul>
        {tools.map((t) => (
          <li key={t.id}>
            {t.name} / warehouseId:{t.warehouseId} / status:{t.status}
          </li>
        ))}
      </ul>
    </main>
  );
}
