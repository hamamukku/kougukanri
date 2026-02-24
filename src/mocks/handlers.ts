import { http, HttpResponse, delay } from "msw";

const tools = [
  { id: "t1", name: "インパクトドライバー", warehouseId: "w1", status: "available" },
  { id: "t2", name: "丸ノコ", warehouseId: "w1", status: "loaned" },
];

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
];