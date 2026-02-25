import { http, HttpResponse, delay } from "msw";

const statuses = ["available", "loaned", "repairing", "lost"] as const;

const TOOLS_STORAGE_KEY = "msw_tools_state_v1";

function loadTools(): any[] | null {
  try {
    const raw = localStorage.getItem(TOOLS_STORAGE_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? (arr as any[]) : null;
  } catch {
    return null;
  }
}

function saveTools(next: any[]) {
  try {
    localStorage.setItem(TOOLS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function createInitialTools() {
  return Array.from({ length: 60 }).map((_, i) => {
    const n = i + 1;
    const id = `t${n}`;
    const name = `工具${String(n).padStart(3, "0")}`;
    const warehouseId = n % 2 === 0 ? "w1" : "w2";
    const status = statuses[n % statuses.length];
    return { id, name, warehouseId, status };
  });
}

let tools = loadTools() ?? createInitialTools();

const warehouses = [
  { id: "w1", name: "\u7b2c\u4e00\u5009\u5eab" },
  { id: "w2", name: "\u7b2c\u4e8c\u5009\u5eab" },
];

export const handlers = [
  http.get("/api/tools", async () => {
    await delay(150);
    return HttpResponse.json(tools);
  }),
  http.get("/api/warehouses", async () => {
    await delay(150);
    return HttpResponse.json(warehouses);
  }),
  http.post("/api/admin/returns/:toolId/approve", async ({ params }) => {
    await delay(150);
    const toolId = String(params.toolId);
    const idx = tools.findIndex((t) => t.id === toolId);
    if (idx === -1) return new HttpResponse(null, { status: 404 });
    if (tools[idx].status !== "loaned") {
      return HttpResponse.json({ ok: false, message: "tool is not loaned" }, { status: 400 });
    }
    tools[idx] = { ...tools[idx], status: "available" };
    saveTools(tools);
    return HttpResponse.json({ ok: true, tool: tools[idx] });
  }),
  http.post("/api/loans/checkout", async ({ request }) => {
    await delay(150);
    let body: any = null;
    try {
      body = await request.json();
    } catch {}

    const ids = Array.isArray(body?.ids) ? body.ids.filter((x: any) => typeof x === "string") : [];
    if (ids.length === 0) {
      return HttpResponse.json({ ok: false, message: "ids required" }, { status: 400 });
    }

    const missing = ids.filter((id: string) => !tools.some((t) => t.id === id));
    if (missing.length) {
      return HttpResponse.json({ ok: false, message: "not found", missing }, { status: 404 });
    }

    const bad = tools.filter((t) => ids.includes(t.id) && t.status !== "available");
    if (bad.length) {
      return HttpResponse.json(
        { ok: false, message: "non-available included", bad },
        { status: 400 }
      );
    }

    tools = tools.map((t) => (ids.includes(t.id) ? { ...t, status: "loaned" } : t));
    saveTools(tools);
    const updated = tools.filter((t) => ids.includes(t.id));

    return HttpResponse.json({ ok: true, updated });
  }),
];
