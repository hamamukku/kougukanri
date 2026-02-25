import { http, HttpResponse, delay } from "msw";

const statuses = ["available", "loaned", "repairing", "lost"] as const;

let tools = Array.from({ length: 60 }).map((_, i) => {
  const n = i + 1;
  const id = `t${n}`;
  const name = `工具${String(n).padStart(3, "0")}`;
  const warehouseId = n % 2 === 0 ? "w1" : "w2";
  const status = statuses[n % statuses.length];

  return { id, name, warehouseId, status };
});

const warehouses = [
  { id: "w1", name: "第一倉庫" },
  { id: "w2", name: "第二倉庫" },
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
    return HttpResponse.json({ ok: true, tool: tools[idx] });
  }),
];
