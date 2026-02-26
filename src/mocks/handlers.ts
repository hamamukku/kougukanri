import { http, HttpResponse, delay } from "msw";

type ToolStatus = "available" | "loaned" | "repairing" | "lost";
type BoxStatus = "open" | "closed";
type ReturnRequestStatus = "none" | "requested" | "approved";

const toolStatuses = ["available", "loaned", "repairing", "lost"] as const;
const WAREHOUSE_NAMES: Record<string, string> = {
  w1: "\u7b2c\u4e00\u5009\u5eab",
  w2: "\u7b2c\u4e8c\u5009\u5eab",
};

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

type Box = {
  id: string;
  ownerUsername: string;
  boxNo: number;
  startDate: string;
  dueDate: string;
  status: BoxStatus;
  createdAt: string;
};

type BoxItem = {
  boxId: string;
  toolId: string;
  dueOverride?: string;
};

type ReturnRequest = {
  boxId: string;
  toolId: string;
  status: ReturnRequestStatus;
  requestedAt?: string;
  approvedAt?: string;
};

type AdminUser = {
  id: string;
  username: string;
  role: "user" | "admin";
};

type AdminReturnGroup = {
  boxId: string;
  ownerUsername: string;
  boxNo: number;
  startDate: string;
  dueDate: string;
  items: Array<{
    toolId: string;
    toolName: string;
    assetNo: string;
    warehouseId: string;
    dueOverride?: string;
    dueEffective: string;
    requestedAt: string;
  }>;
};

type MyBoxPayload = {
  box: Box;
  items: Array<{
    boxId: string;
    toolId: string;
    toolName: string;
    assetNo: string;
    warehouseId: string;
    dueOverride?: string;
    dueEffective: string;
    status: ToolStatus;
    returnStatus?: ReturnRequestStatus;
    requestedAt?: string;
  }>;
  toolsById?: Record<
    string,
    {
      id: string;
      name: string;
      assetNo: string;
      warehouseId: string;
    }
  >;
};

const TOOLS_STORAGE_KEY = "msw_tools_state_v2";
const WAREHOUSES_STORAGE_KEY = "msw_warehouses_state_v2";
const BOXES_STORAGE_KEY = "msw_boxes_state_v1";
const BOX_ITEMS_STORAGE_KEY = "msw_box_items_state_v1";
const RETURN_REQUESTS_STORAGE_KEY = "msw_return_requests_state_v1";
const USERS_STORAGE_KEY = "msw_admin_users_state_v1";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_USERNAME = "ユーザー";
const ADMIN_USERS_FALLBACK: AdminUser[] = [
  { id: "u1", username: "管理者", role: "admin" },
  { id: "u2", username: DEFAULT_USERNAME, role: "user" },
];

function loadArray<T>(key: string): T[] | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
}

function saveArray<T>(key: string, next: T[]) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function getCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function getOwnerUsername(request: Request): string {
  return getCookieValue(request.headers.get("cookie"), "username") || DEFAULT_USERNAME;
}

function isToolStatus(value: unknown): value is ToolStatus {
  return typeof value === "string" && (toolStatuses as readonly string[]).includes(value);
}

function isDateString(value: unknown): value is string {
  return typeof value === "string" && DATE_RE.test(value);
}

function createInitialTools(): Tool[] {
  return Array.from({ length: 40 }).map((_, index) => {
    const n = index + 1;
    return {
      id: `t${n}`,
      name: `工具${String(n).padStart(3, "0")}`,
      assetNo: `A-${String(n).padStart(4, "0")}`,
      warehouseId: n % 2 === 0 ? "w1" : "w2",
      status: toolStatuses[(n - 1) % toolStatuses.length],
    };
  });
}

function createInitialWarehouses(): Warehouse[] {
  return [
    { id: "w1", name: WAREHOUSE_NAMES.w1 },
    { id: "w2", name: WAREHOUSE_NAMES.w2 },
  ];
}

function normalizeTools(items: unknown[] | null): Tool[] {
  if (!Array.isArray(items) || items.length === 0) return createInitialTools();
  const normalized = items.map((item, index) => {
    const obj = item as Record<string, unknown>;
    const n = index + 1;
    return {
      id: typeof obj.id === "string" && obj.id.trim() ? obj.id : `t${n}`,
      name:
        typeof obj.name === "string" && obj.name.trim()
          ? obj.name
          : `工具${String(n).padStart(3, "0")}`,
      assetNo:
        typeof obj.assetNo === "string" && obj.assetNo.trim()
          ? obj.assetNo
          : `A-${String(n).padStart(4, "0")}`,
      warehouseId:
        typeof obj.warehouseId === "string" && obj.warehouseId.trim()
          ? obj.warehouseId
          : n % 2 === 0
            ? "w1"
            : "w2",
      status: isToolStatus(obj.status) ? obj.status : "available",
    };
  });
  return normalized.length ? normalized : createInitialTools();
}

function normalizeWarehouses(items: unknown[] | null): Warehouse[] {
  if (!Array.isArray(items) || items.length === 0) return createInitialWarehouses();
  const byId = new Map<string, Warehouse>();
  for (const item of items) {
    const obj = item as Record<string, unknown>;
    const id =
      typeof obj.id === "string" && obj.id.trim() ? obj.id : `w-${Math.random().toString(36).slice(2)}`;
    const isFixed = Object.prototype.hasOwnProperty.call(WAREHOUSE_NAMES, id);
    const name =
      isFixed
        ? WAREHOUSE_NAMES[id]
        : typeof obj.name === "string" && obj.name.trim()
          ? obj.name
          : "未設定";
    byId.set(id, { id, name });
  }
  const values = Array.from(byId.values());
  return values.length ? values : createInitialWarehouses();
}

function normalizeUsers(items: unknown[] | null): AdminUser[] {
  if (!Array.isArray(items) || items.length === 0) return ADMIN_USERS_FALLBACK;
  const list = items
    .map((item, index) => {
      const obj = item as Record<string, unknown>;
      const role: "user" | "admin" = obj.role === "admin" ? "admin" : "user";
      return {
        id: typeof obj.id === "string" && obj.id.trim() ? obj.id : `u-${index + 1}`,
        username:
          typeof obj.username === "string" && obj.username.trim() ? obj.username : `ユーザー${index + 1}`,
        role,
      };
    })
    .filter((x) => x.username.trim().length > 0);
  return list.length ? list : ADMIN_USERS_FALLBACK;
}

function normalizeBoxes(items: unknown[] | null): Box[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  return items.map((item, index) => {
    const obj = item as Record<string, unknown>;
    const boxNo = typeof obj.boxNo === "number" && Number.isFinite(obj.boxNo) ? Math.max(1, Math.floor(obj.boxNo)) : 1;
    const today = new Date().toISOString().slice(0, 10);
    return {
      id: typeof obj.id === "string" && obj.id.trim() ? obj.id : `b-${Date.now()}-${index}`,
      ownerUsername:
        typeof obj.ownerUsername === "string" && obj.ownerUsername.trim() ? obj.ownerUsername : DEFAULT_USERNAME,
      boxNo,
      startDate: isDateString(obj.startDate) ? obj.startDate : today,
      dueDate: isDateString(obj.dueDate) ? obj.dueDate : today,
      status: obj.status === "closed" ? "closed" : "open",
      createdAt:
        typeof obj.createdAt === "string" && obj.createdAt.trim() ? obj.createdAt : new Date().toISOString(),
    };
  });
}

function normalizeBoxItems(items: unknown[] | null): BoxItem[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  return items
    .map((item) => {
      const obj = item as Record<string, unknown>;
      const boxId = typeof obj.boxId === "string" && obj.boxId.trim() ? obj.boxId : "";
      const toolId = typeof obj.toolId === "string" && obj.toolId.trim() ? obj.toolId : "";
      if (!boxId || !toolId) return null;
      const dueOverride = isDateString(obj.dueOverride) ? obj.dueOverride : undefined;
      return { boxId, toolId, ...(dueOverride ? { dueOverride } : {}) } as BoxItem;
    })
    .filter((x): x is BoxItem => x !== null);
}

function normalizeReturnRequests(items: unknown[] | null): ReturnRequest[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  return items
    .map((item): ReturnRequest | null => {
      const obj = item as Record<string, unknown>;
      const boxId = typeof obj.boxId === "string" && obj.boxId.trim() ? obj.boxId : "";
      const toolId = typeof obj.toolId === "string" && obj.toolId.trim() ? obj.toolId : "";
      if (!boxId || !toolId) return null;
      const status: ReturnRequest["status"] =
        obj.status === "requested" || obj.status === "approved" || obj.status === "none"
          ? obj.status
          : "none";
      return {
        boxId,
        toolId,
        status,
        requestedAt: typeof obj.requestedAt === "string" ? obj.requestedAt : undefined,
        approvedAt: typeof obj.approvedAt === "string" ? obj.approvedAt : undefined,
      };
    })
    .filter((x): x is ReturnRequest => x !== null);
}

function saveState() {
  saveArray(TOOLS_STORAGE_KEY, tools);
  saveArray(WAREHOUSES_STORAGE_KEY, warehouses);
  saveArray(BOXES_STORAGE_KEY, boxes);
  saveArray(BOX_ITEMS_STORAGE_KEY, boxItems);
  saveArray(RETURN_REQUESTS_STORAGE_KEY, returnRequests);
  saveArray(USERS_STORAGE_KEY, users);
}

function resetStateToInitial() {
  tools = createInitialTools();
  warehouses = createInitialWarehouses();
  boxes = [];
  boxItems = [];
  returnRequests = [];
  users = [...ADMIN_USERS_FALLBACK];
  saveState();
}

function nextBoxNo(ownerUsername: string, list: Box[]): number {
  const mine = list.filter((box) => box.ownerUsername === ownerUsername);
  const maxNo = mine.reduce((acc, box) => Math.max(acc, box.boxNo), 0);
  return maxNo + 1;
}

function parseToolIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(new Set(raw.filter((x) => typeof x === "string").map((x) => x.trim()).filter(Boolean)));
}

function parseDueOverrides(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const v = typeof value === "string" ? value.trim() : "";
    if (!key.trim() || !v) continue;
    if (!isDateString(v)) continue;
    next[key.trim()] = v;
  }
  return next;
}

function buildMyBoxPayload(box: Box): MyBoxPayload {
  const toolMap = new Map(tools.map((tool) => [tool.id, tool]));
  const requestMap = new Map(returnRequests.map((request) => [`${request.boxId}:${request.toolId}`, request]));
  const items = boxItems
    .filter((item) => item.boxId === box.id)
    .map((item) => {
      const tool = toolMap.get(item.toolId);
      if (!tool) return null;
      const request = requestMap.get(`${box.id}:${item.toolId}`);
      return {
        boxId: box.id,
        toolId: item.toolId,
        toolName: tool.name,
        assetNo: tool.assetNo,
        warehouseId: tool.warehouseId,
        dueOverride: item.dueOverride,
        dueEffective: item.dueOverride || box.dueDate,
        status: tool.status,
        returnStatus: request?.status,
        requestedAt: request?.requestedAt,
      };
    })
    .filter(
      (
        x,
      ): x is {
        boxId: string;
        toolId: string;
        toolName: string;
        assetNo: string;
        warehouseId: string;
        dueOverride: string | undefined;
        dueEffective: string;
        status: ToolStatus;
        returnStatus: ReturnRequestStatus | undefined;
        requestedAt: string | undefined;
      } => x !== null,
    );
  const toolsById: Record<
    string,
    {
      id: string;
      name: string;
      assetNo: string;
      warehouseId: string;
    }
  > = {};
  for (const item of items) {
    toolsById[item.toolId] = {
      id: item.toolId,
      name: item.toolName,
      assetNo: item.assetNo,
      warehouseId: item.warehouseId,
    };
  }
  return { box, items, toolsById };
}

let tools = normalizeTools(loadArray<Tool>(TOOLS_STORAGE_KEY));
let warehouses = normalizeWarehouses(loadArray<Warehouse>(WAREHOUSES_STORAGE_KEY));
let boxes = normalizeBoxes(loadArray<Box>(BOXES_STORAGE_KEY));
let boxItems = normalizeBoxItems(loadArray<BoxItem>(BOX_ITEMS_STORAGE_KEY));
let returnRequests = normalizeReturnRequests(loadArray<ReturnRequest>(RETURN_REQUESTS_STORAGE_KEY));
let users = normalizeUsers(loadArray<AdminUser>(USERS_STORAGE_KEY));

if (warehouses.length === 0) {
  warehouses = createInitialWarehouses();
}
if (users.length === 0) {
  users = [...ADMIN_USERS_FALLBACK];
}
if (tools.length === 0) {
  tools = createInitialTools();
}

saveState();

export const handlers = [
  http.get("/api/tools", async () => {
    await delay(5);
    return HttpResponse.json(tools);
  }),
  http.get("/api/warehouses", async () => {
    await delay(5);
    return HttpResponse.json(warehouses);
  }),
  http.post("/api/boxes/confirm", async ({ request }) => {
    await delay(5);
    let body: unknown = null;
    try {
      body = await request.json();
    } catch {}

    const obj = (body as Record<string, unknown>) || {};
    const ownerUsername = getOwnerUsername(request);
    const startDate = typeof obj.startDate === "string" ? obj.startDate.trim() : "";
    const dueDate = typeof obj.dueDate === "string" ? obj.dueDate.trim() : "";
    const toolIds = parseToolIds(obj.toolIds);
    const dueOverrides = parseDueOverrides(obj.dueOverrides);
    const overrideEntries = Object.entries(dueOverrides);

    if (!startDate || !dueDate) {
      return HttpResponse.json({ ok: false, message: "startDate and dueDate required" }, { status: 422 });
    }
    if (!isDateString(startDate) || !isDateString(dueDate) || dueDate < startDate) {
      return HttpResponse.json({ ok: false, message: "invalid period" }, { status: 422 });
    }
    if (!toolIds.length) {
      return HttpResponse.json({ ok: false, message: "toolIds required" }, { status: 422 });
    }

    const missing = toolIds.filter((id) => !tools.some((t) => t.id === id));
    if (missing.length) {
      return HttpResponse.json({ ok: false, message: "tool not found", missing }, { status: 404 });
    }

    const nonAvailable = tools.filter((t) => toolIds.includes(t.id) && t.status !== "available");
    if (nonAvailable.length) {
      return HttpResponse.json({ ok: false, message: "non-available included" }, { status: 409 });
    }

    for (const [toolId, date] of overrideEntries) {
      if (!toolIds.includes(toolId)) {
        return HttpResponse.json(
          { ok: false, message: "dueOverride includes not selected tool" },
          { status: 400 },
        );
      }
      if (date < startDate || date > dueDate) {
        return HttpResponse.json(
          { ok: false, message: "dueOverride must be within startDate and dueDate" },
          { status: 422 },
        );
      }
    }

    const boxId = `b-${Date.now()}`;
    const box: Box = {
      id: boxId,
      ownerUsername,
      boxNo: nextBoxNo(ownerUsername, boxes),
      startDate,
      dueDate,
      status: "open",
      createdAt: new Date().toISOString(),
    };

    const selected = new Set(toolIds);
    const createItems: BoxItem[] = toolIds.map((toolId) => ({
      boxId,
      toolId,
      ...(dueOverrides[toolId] ? { dueOverride: dueOverrides[toolId] } : {}),
    }));
    const requests: ReturnRequest[] = toolIds.map((toolId) => ({ boxId, toolId, status: "none" }));

    boxes = [box, ...boxes];
    boxItems = [...boxItems, ...createItems];
    returnRequests = [...returnRequests, ...requests];
    tools = tools.map((t) => (selected.has(t.id) ? { ...t, status: "loaned" } : t));

    saveState();
    return HttpResponse.json({ ok: true, boxId });
  }),
  http.get("/api/my/boxes", async ({ request }) => {
    await delay(5);
    const ownerUsername = getOwnerUsername(request);
    const rawStatus = new URL(request.url).searchParams.get("status");
    const status = rawStatus === "all" ? "all" : "open";

    const byOwner = boxes.filter((box) => {
      if (box.ownerUsername !== ownerUsername) return false;
      if (status === "all") return true;
      return box.status === "open";
    });

    const result = byOwner
      .map((box) => buildMyBoxPayload(box))
      .filter((entry) => entry.items.length > 0)
      .sort((a, b) => new Date(b.box.createdAt).getTime() - new Date(a.box.createdAt).getTime());

    return HttpResponse.json(result);
  }),
  http.post("/api/my/returns/request", async ({ request }) => {
    await delay(5);
    let body: unknown = null;
    try {
      body = await request.json();
    } catch {}
    const obj = (body as Record<string, unknown>) || {};
    const ownerUsername = getOwnerUsername(request);
    const boxId = typeof obj.boxId === "string" ? obj.boxId.trim() : "";
    const toolId = typeof obj.toolId === "string" ? obj.toolId.trim() : "";

    if (!boxId || !toolId) {
      return HttpResponse.json({ ok: false, message: "boxId and toolId required" }, { status: 422 });
    }

    const box = boxes.find((b) => b.id === boxId);
    if (!box) {
      return HttpResponse.json({ ok: false, message: "box not found" }, { status: 404 });
    }
    if (box.ownerUsername !== ownerUsername) {
      return HttpResponse.json({ ok: false, message: "forbidden" }, { status: 403 });
    }
    if (!boxItems.some((item) => item.boxId === boxId && item.toolId === toolId)) {
      return HttpResponse.json({ ok: false, message: "tool not in box" }, { status: 404 });
    }
    if (box.status !== "open") {
      return HttpResponse.json({ ok: false, message: "box is not open" }, { status: 400 });
    }

    const targetIdx = returnRequests.findIndex((r) => r.boxId === boxId && r.toolId === toolId);
    if (targetIdx === -1) {
      return HttpResponse.json({ ok: false, message: "return request target not found" }, { status: 404 });
    }
    if (returnRequests[targetIdx].status === "requested" || returnRequests[targetIdx].status === "approved") {
      return HttpResponse.json({ ok: false, message: "already requested" }, { status: 409 });
    }

    returnRequests[targetIdx] = {
      ...returnRequests[targetIdx],
      status: "requested",
      requestedAt: new Date().toISOString(),
    };

    saveArray(RETURN_REQUESTS_STORAGE_KEY, returnRequests);
    return HttpResponse.json({ ok: true });
  }),
  http.get("/api/admin/returns", async () => {
    await delay(5);
    const toolMap = new Map(tools.map((tool) => [tool.id, tool]));
    const grouped = new Map<string, AdminReturnGroup>();

    for (const req of returnRequests) {
      if (req.status !== "requested") continue;
      const box = boxes.find((b) => b.id === req.boxId);
      if (!box) continue;
      const item = boxItems.find((x) => x.boxId === req.boxId && x.toolId === req.toolId);
      const tool = toolMap.get(req.toolId);
      if (!tool) continue;

      const row = {
        toolId: req.toolId,
        toolName: tool.name,
        assetNo: tool.assetNo,
        warehouseId: tool.warehouseId,
        dueOverride: item?.dueOverride,
        dueEffective: item?.dueOverride || box.dueDate,
        requestedAt: req.requestedAt || "",
      };

      const current = grouped.get(box.id);
      if (current) {
        current.items.push(row);
      } else {
        grouped.set(box.id, {
          boxId: box.id,
          ownerUsername: box.ownerUsername,
          boxNo: box.boxNo,
          startDate: box.startDate,
          dueDate: box.dueDate,
          items: [row],
        });
      }
    }

    const result = Array.from(grouped.values()).sort((a, b) => {
      const aTs = new Date(a.items[0]?.requestedAt || 0).getTime();
      const bTs = new Date(b.items[0]?.requestedAt || 0).getTime();
      return bTs - aTs;
    });

    return HttpResponse.json(result);
  }),
  http.post("/api/admin/returns/approve", async ({ request }) => {
    await delay(5);
    let body: unknown = null;
    try {
      body = await request.json();
    } catch {}

    const obj = (body as Record<string, unknown>) || {};
    const boxId = typeof obj.boxId === "string" ? obj.boxId.trim() : "";
    const rawToolIds = parseToolIds(obj.toolIds);

    if (!boxId) {
      return HttpResponse.json({ ok: false, message: "boxId required" }, { status: 422 });
    }

    const target = boxes.find((b) => b.id === boxId);
    if (!target) {
      return HttpResponse.json({ ok: false, message: "box not found" }, { status: 404 });
    }
    if (target.status === "closed") {
      return HttpResponse.json({ ok: false, message: "box is closed" }, { status: 400 });
    }

    const requested = returnRequests.filter((r) => r.boxId === boxId && r.status === "requested");
    const selected = rawToolIds.length ? requested.filter((r) => rawToolIds.includes(r.toolId)) : requested;

    if (!selected.length) {
      return HttpResponse.json({ ok: false, message: "requested return not found" }, { status: 404 });
    }
    if (rawToolIds.length && selected.length !== rawToolIds.length) {
      return HttpResponse.json(
        { ok: false, message: "toolIds include not requested item" },
        { status: 409 },
      );
    }

    const approvedIds = new Set(selected.map((r) => r.toolId));
    const now = new Date().toISOString();
    returnRequests = returnRequests.map((r) =>
      r.boxId === boxId && approvedIds.has(r.toolId) && r.status === "requested"
        ? { ...r, status: "approved", approvedAt: now }
        : r,
    );
    tools = tools.map((t) => (approvedIds.has(t.id) ? { ...t, status: "available" } : t));

    const remainRequested = returnRequests.some((r) => r.boxId === boxId && r.status === "requested");
    if (!remainRequested) {
      boxes = boxes.map((box) => (box.id === boxId ? { ...box, status: "closed" } : box));
    }

    saveState();
    return HttpResponse.json({ ok: true, boxId, toolIds: Array.from(approvedIds) });
  }),
  http.get("/api/admin/users", async () => {
    await delay(5);
    return HttpResponse.json(users);
  }),
  http.post("/api/admin/users", async ({ request }) => {
    await delay(5);
    let body: unknown = null;
    try {
      body = await request.json();
    } catch {}
    const obj = (body as Record<string, unknown>) || {};
    const username = typeof obj.username === "string" ? obj.username.trim() : "";
    const role = obj.role === "admin" ? "admin" : "user";
    if (!username) {
      return HttpResponse.json({ ok: false, message: "username required" }, { status: 400 });
    }

    const user: AdminUser = {
      id: `u-${Date.now()}`,
      username,
      role,
    };
    users = [user, ...users];
    saveArray(USERS_STORAGE_KEY, users);
    return HttpResponse.json({ ok: true, user });
  }),
  http.get("/api/admin/warehouses", async () => {
    await delay(5);
    return HttpResponse.json(warehouses);
  }),
  http.post("/api/admin/warehouses", async ({ request }) => {
    await delay(5);
    let body: unknown = null;
    try {
      body = await request.json();
    } catch {}
    const obj = (body as Record<string, unknown>) || {};
    const name = typeof obj.name === "string" ? obj.name.trim() : "";
    if (!name) {
      return HttpResponse.json({ ok: false, message: "name required" }, { status: 400 });
    }
    const warehouse: Warehouse = {
      id: `w-${Date.now()}`,
      name,
    };
    warehouses = [warehouse, ...warehouses];
    saveArray(WAREHOUSES_STORAGE_KEY, warehouses);
    return HttpResponse.json({ ok: true, warehouse });
  }),
  http.patch("/api/admin/warehouses/:id", async ({ params, request }) => {
    await delay(5);
    const id = typeof params.id === "string" ? params.id : "";
    let body: unknown = null;
    try {
      body = await request.json();
    } catch {}
    const obj = (body as Record<string, unknown>) || {};
    const nextName = typeof obj.name === "string" ? obj.name.trim() : "";
    const found = warehouses.findIndex((w) => w.id === id);

    if (found === -1) {
      return HttpResponse.json({ ok: false, message: "warehouse not found" }, { status: 404 });
    }
    if (!nextName) {
      return HttpResponse.json({ ok: false, message: "name required" }, { status: 422 });
    }

    const nextWarehouses = warehouses.map((warehouse) => {
      if (warehouse.id !== id) return warehouse;
      return { ...warehouse, name: nextName };
    });
    warehouses = nextWarehouses;
    const updatedWarehouse = nextWarehouses.find((warehouse) => warehouse.id === id) || null;

    saveArray(WAREHOUSES_STORAGE_KEY, warehouses);
    return HttpResponse.json({ ok: true, warehouse: updatedWarehouse });
  }),
  http.delete("/api/admin/warehouses/:id", async ({ params }) => {
    await delay(5);
    const id = typeof params.id === "string" ? params.id : "";
    const found = warehouses.find((warehouse) => warehouse.id === id);
    if (!found) {
      return HttpResponse.json({ ok: false, message: "warehouse not found" }, { status: 404 });
    }
    warehouses = warehouses.filter((warehouse) => warehouse.id !== id);
    saveArray(WAREHOUSES_STORAGE_KEY, warehouses);
    return HttpResponse.json({ ok: true });
  }),
  http.patch("/api/admin/users/:id", async ({ params, request }) => {
    await delay(5);
    const id = typeof params.id === "string" ? params.id : "";
    let body: unknown = null;
    try {
      body = await request.json();
    } catch {}
    const obj = (body as Record<string, unknown>) || {};
    const found = users.findIndex((user) => user.id === id);
    const nextUsername = typeof obj.username === "string" ? obj.username.trim() : undefined;
    const nextRole: "admin" | "user" | undefined =
      obj.role === "admin" || obj.role === "user" ? obj.role : undefined;
    if (found === -1) {
      return HttpResponse.json({ ok: false, message: "user not found" }, { status: 404 });
    }
    if (nextUsername === undefined && nextRole === undefined) {
      return HttpResponse.json({ ok: false, message: "username or role required" }, { status: 422 });
    }
    if (nextUsername !== undefined && !nextUsername) {
      return HttpResponse.json({ ok: false, message: "username required" }, { status: 422 });
    }

    const nextUsers = users.map((user, index) => {
      if (index !== found) return user;
      return {
        ...user,
        ...(nextUsername !== undefined ? { username: nextUsername } : {}),
        ...(nextRole !== undefined ? { role: nextRole } : {}),
      };
    });
    users = nextUsers;
    const updatedUser = nextUsers.find((user) => user.id === id) || null;

    saveArray(USERS_STORAGE_KEY, users);
    return HttpResponse.json({ ok: true, user: updatedUser });
  }),
  http.delete("/api/admin/users/:id", async ({ params }) => {
    await delay(5);
    const id = typeof params.id === "string" ? params.id : "";
    const found = users.find((user) => user.id === id);
    if (!found) {
      return HttpResponse.json({ ok: false, message: "user not found" }, { status: 404 });
    }
    users = users.filter((user) => user.id !== id);
    saveArray(USERS_STORAGE_KEY, users);
    return HttpResponse.json({ ok: true });
  }),
  http.get("/api/admin/tools", async () => {
    await delay(5);
    return HttpResponse.json(tools);
  }),
  http.post("/api/admin/tools", async ({ request }) => {
    await delay(5);
    let body: unknown = null;
    try {
      body = await request.json();
    } catch {}
    const obj = (body as Record<string, unknown>) || {};

    const name = typeof obj.name === "string" ? obj.name.trim() : "";
    const warehouseId = typeof obj.warehouseId === "string" ? obj.warehouseId.trim() : "";
    const assetNo =
      typeof obj.assetNo === "string" && obj.assetNo.trim() ? obj.assetNo.trim() : `A-${String(tools.length + 1).padStart(4, "0")}`;
    const status = isToolStatus(obj.status) ? obj.status : "available";

    if (!name) {
      return HttpResponse.json({ ok: false, message: "name required" }, { status: 400 });
    }
    if (!warehouseId) {
      return HttpResponse.json({ ok: false, message: "warehouseId required" }, { status: 400 });
    }
    if (!warehouses.some((w) => w.id === warehouseId)) {
      return HttpResponse.json({ ok: false, message: "warehouse not found" }, { status: 404 });
    }

    const tool: Tool = {
      id: `t-${Date.now()}`,
      name,
      assetNo,
      warehouseId,
      status,
    };
    tools = [tool, ...tools];
    saveArray(TOOLS_STORAGE_KEY, tools);
    return HttpResponse.json({ ok: true, tool });
  }),
  http.patch("/api/admin/tools/:id", async ({ params, request }) => {
    await delay(5);
    const id = typeof params.id === "string" ? params.id : "";
    let body: unknown = null;
    try {
      body = await request.json();
    } catch {}
    const obj = (body as Record<string, unknown>) || {};
    const found = tools.findIndex((tool) => tool.id === id);
    if (found === -1) {
      return HttpResponse.json({ ok: false, message: "tool not found" }, { status: 404 });
    }

    const nextName = typeof obj.name === "string" ? obj.name.trim() : undefined;
    const nextAssetNo = typeof obj.assetNo === "string" ? obj.assetNo.trim() : undefined;
    const nextWarehouseId = typeof obj.warehouseId === "string" ? obj.warehouseId.trim() : undefined;
    const nextStatus = isToolStatus(obj.status) ? obj.status : undefined;

    if (
      nextName === undefined &&
      nextAssetNo === undefined &&
      nextWarehouseId === undefined &&
      nextStatus === undefined
    ) {
      return HttpResponse.json({ ok: false, message: "no field provided" }, { status: 422 });
    }

    if (nextName !== undefined && !nextName) {
      return HttpResponse.json({ ok: false, message: "name required" }, { status: 422 });
    }
    if (nextAssetNo !== undefined && !nextAssetNo) {
      return HttpResponse.json({ ok: false, message: "assetNo required" }, { status: 422 });
    }
    if (nextWarehouseId !== undefined && !warehouses.some((w) => w.id === nextWarehouseId)) {
      return HttpResponse.json({ ok: false, message: "warehouse not found" }, { status: 404 });
    }

    const nextTools = tools.map((tool, index) => {
      if (index !== found) return tool;
      return {
        ...tool,
        ...(nextName !== undefined ? { name: nextName } : {}),
        ...(nextAssetNo !== undefined ? { assetNo: nextAssetNo } : {}),
        ...(nextWarehouseId !== undefined ? { warehouseId: nextWarehouseId } : {}),
        ...(nextStatus !== undefined ? { status: nextStatus } : {}),
      };
    });
    tools = nextTools;
    const updatedTool = nextTools.find((tool) => tool.id === id) || null;

    saveArray(TOOLS_STORAGE_KEY, tools);
    return HttpResponse.json({ ok: true, tool: updatedTool });
  }),
  http.delete("/api/admin/tools/:id", async ({ params }) => {
    await delay(5);
    const id = typeof params.id === "string" ? params.id : "";
    const found = tools.find((tool) => tool.id === id);
    if (!found) {
      return HttpResponse.json({ ok: false, message: "tool not found" }, { status: 404 });
    }
    tools = tools.filter((tool) => tool.id !== id);
    saveArray(TOOLS_STORAGE_KEY, tools);
    return HttpResponse.json({ ok: true });
  }),
  http.post("/api/admin/dev/reset", async () => {
    await delay(5);
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(TOOLS_STORAGE_KEY);
      localStorage.removeItem(WAREHOUSES_STORAGE_KEY);
      localStorage.removeItem(BOXES_STORAGE_KEY);
      localStorage.removeItem(BOX_ITEMS_STORAGE_KEY);
      localStorage.removeItem(RETURN_REQUESTS_STORAGE_KEY);
      localStorage.removeItem(USERS_STORAGE_KEY);
    }
    resetStateToInitial();
    return HttpResponse.json({ ok: true });
  }),
];
