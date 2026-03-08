import { http, HttpResponse } from "msw";

type Role = "admin" | "user";
type BaseStatus = "AVAILABLE" | "BROKEN" | "REPAIR";
type DisplayStatus = "AVAILABLE" | "LOANED" | "RESERVED" | "BROKEN" | "REPAIR";

type Warehouse = {
  id: string;
  name: string;
  warehouseNo?: string | null;
};

type Tool = {
  id: string;
  assetNo: string;
  name: string;
  warehouseId: string;
  baseStatus: BaseStatus;
};

type User = {
  id: string;
  department: string;
  userCode: string;
  username: string;
  email: string;
  password: string;
  role: Role;
  isActive: boolean;
};

type LoanBox = {
  id: string;
  borrowerId: string;
  boxNo: number;
  displayName: string;
  startDate: string;
  dueDate: string;
};

type LoanItem = {
  id: string;
  boxId: string;
  toolId: string;
  borrowerId: string;
  startDate: string;
  dueDate: string;
  returnRequestedAt?: string;
  returnApprovedAt?: string;
};

type AuditLog = {
  id: string;
  actorId?: string;
  action: string;
  targetType: string;
  targetId?: string;
  payload?: unknown;
  createdAt: string;
};

let nextWarehouseNo = 3;
let nextToolNo = 4;
let nextUserNo = 3;
let nextBoxNoGlobal = 1;
let nextLoanItemNo = 1;
let nextAuditNo = 1;

let warehouses: Warehouse[] = [
  { id: "w1", name: "Main Warehouse", warehouseNo: "WH-001" },
  { id: "w2", name: "Sub Warehouse", warehouseNo: null },
];

let tools: Tool[] = [
  { id: "t1", assetNo: "Main Warehouse-001", name: "Drill", warehouseId: "w1", baseStatus: "AVAILABLE" },
  { id: "t2", assetNo: "Main Warehouse-002", name: "Wrench", warehouseId: "w1", baseStatus: "AVAILABLE" },
  { id: "t3", assetNo: "Sub Warehouse-001", name: "Saw", warehouseId: "w2", baseStatus: "REPAIR" },
];

let users: User[] = [
  {
    id: "u1",
    department: "admin",
    userCode: "ADM-001",
    username: "admin",
    email: "admin@example.com",
    password: "admin123",
    role: "admin",
    isActive: true,
  },
  {
    id: "u2",
    department: "engineering",
    userCode: "USR-001",
    username: "user1",
    email: "user1@example.com",
    password: "user12345",
    role: "user",
    isActive: true,
  },
];

let loanBoxes: LoanBox[] = [];
let loanItems: LoanItem[] = [];
let auditLogs: AuditLog[] = [];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function nowIso() {
  return new Date().toISOString();
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function toToken(userID: string) {
  return `mock-token-${userID}`;
}

function fromToken(token: string) {
  if (!token.startsWith("mock-token-")) return null;
  return token.replace("mock-token-", "");
}

function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return HttpResponse.json(
    {
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
      },
    },
    { status },
  );
}

function readBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) return {};
  return body as Record<string, unknown>;
}

function isActiveUser(user: User) {
  return user.isActive;
}

function findUserByLoginID(loginID: string) {
  const id = loginID.trim().toLowerCase();
  return users.find((user) => isActiveUser(user) && (user.username.toLowerCase() === id || user.email.toLowerCase() === id)) ?? null;
}

function authenticate(request: Request, requiredRole?: Role): { user: User } | { error: Response } {
  const authz = request.headers.get("authorization") ?? "";
  const [scheme, token] = authz.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return { error: errorResponse(401, "UNAUTHORIZED", "missing Authorization header") };
  }

  const userID = fromToken(token.trim());
  if (!userID) {
    return { error: errorResponse(401, "UNAUTHORIZED", "invalid token") };
  }

  const user = users.find((item) => item.id === userID);
  if (!user) {
    return { error: errorResponse(401, "UNAUTHORIZED", "user not found") };
  }
  if (!isActiveUser(user)) {
    return { error: errorResponse(401, "UNAUTHORIZED", "user is inactive") };
  }

  if (requiredRole && user.role !== requiredRole) {
    return { error: errorResponse(403, "FORBIDDEN", "forbidden") };
  }

  return { user };
}

function parsePositiveInt(v: string | null, fallback: number) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) return fallback;
  return n;
}

function listToolRows(currentUserID: string) {
  const today = todayYmd();

  return tools.map((tool) => {
    const relatedItems = loanItems.filter((item) => item.toolId === tool.id && !item.returnApprovedAt);
    const activeItem = relatedItems.find((item) => item.startDate <= today);
    const reservedItems = relatedItems
      .filter((item) => item.startDate > today)
      .slice()
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    const reservedItem = reservedItems[0] ?? null;

    let status: DisplayStatus = "AVAILABLE";
    let startDate: string | null = null;
    let dueDate: string | null = null;

    if (tool.baseStatus === "BROKEN") {
      status = "BROKEN";
    } else if (tool.baseStatus === "REPAIR") {
      status = "REPAIR";
    } else if (activeItem) {
      status = "LOANED";
      startDate = activeItem.startDate;
      dueDate = activeItem.dueDate;
    } else if (reservedItem) {
      status = "RESERVED";
      startDate = reservedItem.startDate;
      dueDate = reservedItem.dueDate;
    }

    return {
      id: tool.id,
      assetNo: tool.assetNo,
      name: tool.name,
      warehouseId: tool.warehouseId,
      warehouseName: warehouses.find((w) => w.id === tool.warehouseId)?.name ?? tool.warehouseId,
      baseStatus: tool.baseStatus,
      status,
      startDate,
      dueDate,
      isBlockedByOtherReservation: Boolean(
        reservedItem && reservedItem.borrowerId !== currentUserID && tool.baseStatus === "AVAILABLE",
      ),
      isReservedByMe: Boolean(reservedItem && reservedItem.borrowerId === currentUserID),
    };
  });
}

function addAuditLog(action: string, targetType: string, targetId: string | undefined, actorId: string | undefined, payload: unknown) {
  auditLogs = [
    {
      id: `a-${nextAuditNo++}`,
      actorId,
      action,
      targetType,
      targetId,
      payload,
      createdAt: nowIso(),
    },
    ...auditLogs,
  ];
}

function parseLoanItemIDs(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const normalized = raw
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
  return Array.from(new Set(normalized));
}

function parseOverrides(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== "string") continue;
    const dueDate = value.trim();
    const toolID = key.trim();
    if (!toolID || !DATE_RE.test(dueDate)) continue;
    next[toolID] = dueDate;
  }
  return next;
}

function extractToolAssetSequence(assetNo: string) {
  const trimmed = assetNo.trim();
  const index = trimmed.lastIndexOf("-");
  if (index < 0 || index === trimmed.length - 1) return null;
  const seq = Number(trimmed.slice(index + 1));
  if (!Number.isInteger(seq) || seq <= 0) return null;
  return seq;
}

function nextToolAssetNo(warehouseID: string, sourceTools: Tool[], excludeToolID?: string) {
  const warehouse = warehouses.find((item) => item.id === warehouseID);
  if (!warehouse) return "";

  const maxSeq = sourceTools.reduce((max, tool) => {
    if (tool.warehouseId !== warehouseID || tool.id === excludeToolID) return max;
    const seq = extractToolAssetSequence(tool.assetNo);
    return seq !== null && seq > max ? seq : max;
  }, 0);

  return `${warehouse.name}-${String(maxSeq + 1).padStart(3, "0")}`;
}

export const handlers = [
  http.post("/api/auth/login", async ({ request }) => {
    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      return errorResponse(400, "INVALID_REQUEST", "invalid request body");
    }

    const obj = readBody(body);
    const loginId = typeof obj.loginId === "string" ? obj.loginId : "";
    const password = typeof obj.password === "string" ? obj.password : "";

    if (!loginId || !password) {
      return errorResponse(400, "INVALID_REQUEST", "loginId and password are required");
    }

    const user = findUserByLoginID(loginId);
    if (!user || user.password !== password) {
      return errorResponse(401, "UNAUTHORIZED", "invalid credentials");
    }

    return HttpResponse.json({
      token: toToken(user.id),
      role: user.role,
      userName: user.username,
    });
  }),

  http.get("/api/auth/me", ({ request }) => {
    const auth = authenticate(request);
    if ("error" in auth) return auth.error;
    return HttpResponse.json({
      role: auth.user.role,
      userName: auth.user.username,
    });
  }),

  http.post("/api/public/signup/request", async ({ request }) => {
    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      return errorResponse(400, "INVALID_REQUEST", "invalid request body");
    }

    const obj = readBody(body);
    const username = typeof obj.username === "string" ? obj.username.trim() : "";
    const email = typeof obj.email === "string" ? obj.email.trim().toLowerCase() : "";
    const password = typeof obj.password === "string" ? obj.password : "";

    if (!username || !email || !password) {
      return errorResponse(400, "INVALID_REQUEST", "username, email, password are required");
    }

    return HttpResponse.json({ ok: true }, { status: 201 });
  }),

  http.get("/api/warehouses", ({ request }) => {
    const auth = authenticate(request);
    if ("error" in auth) return auth.error;
    return HttpResponse.json(warehouses);
  }),

  http.get("/api/tools", ({ request }) => {
    const auth = authenticate(request);
    if ("error" in auth) return auth.error;

    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const mode = (url.searchParams.get("mode") ?? "partial").toLowerCase() === "exact" ? "exact" : "partial";
    const warehouseID = (url.searchParams.get("warehouseId") ?? "").trim();
    const status = (url.searchParams.get("status") ?? "").trim().toUpperCase();
    const page = parsePositiveInt(url.searchParams.get("page"), 1);
    const pageSize = Math.min(parsePositiveInt(url.searchParams.get("pageSize"), 25), 100);

    const rows = listToolRows(auth.user.id).filter((item) => {
      if (q) {
        const toolName = item.name.toLowerCase();
        const assetNo = item.assetNo.toLowerCase();
        if (mode === "exact") {
          if (toolName !== q && assetNo !== q) return false;
        } else if (!toolName.includes(q) && !assetNo.includes(q)) {
          return false;
        }
      }

      if (warehouseID && item.warehouseId !== warehouseID) return false;
      if (status && item.status !== status) return false;

      return true;
    });

    const total = rows.length;
    const offset = (page - 1) * pageSize;

    return HttpResponse.json({
      items: rows.slice(offset, offset + pageSize).map((item) => ({
        ...item,
        toolId: item.assetNo,
      })),
      page,
      pageSize,
      total,
    });
  }),

  http.post("/api/loan-boxes", async ({ request }) => {
    const auth = authenticate(request);
    if ("error" in auth) return auth.error;

    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      return errorResponse(400, "INVALID_REQUEST", "invalid request body");
    }

    const obj = readBody(body);
    const startDate = typeof obj.startDate === "string" ? obj.startDate.trim() : "";
    const dueDate = typeof obj.dueDate === "string" ? obj.dueDate.trim() : "";
    const toolIDs = parseLoanItemIDs(obj.toolIds);
    const itemDueOverrides = parseOverrides(obj.itemDueOverrides);

    if (!DATE_RE.test(startDate) || !DATE_RE.test(dueDate)) {
      return errorResponse(400, "INVALID_REQUEST", "startDate and dueDate must be YYYY-MM-DD");
    }
    if (dueDate < startDate) {
      return errorResponse(409, "INVALID_DATE_RANGE", "due_date must be equal to or after start_date");
    }
    if (toolIDs.length === 0) {
      return errorResponse(400, "INVALID_REQUEST", "toolIds is required");
    }

    for (const toolID of toolIDs) {
      const tool = tools.find((item) => item.id === toolID);
      if (!tool) {
        return errorResponse(404, "NOT_FOUND", "tool not found", { toolId: toolID });
      }
      const row = listToolRows(auth.user.id).find((item) => item.id === toolID);
      if (!row || row.status !== "AVAILABLE") {
        return errorResponse(409, "TOOL_NOT_AVAILABLE", "tool is not available", { toolId: toolID });
      }
    }

    const borrowerBoxNo =
      loanBoxes
        .filter((box) => box.borrowerId === auth.user.id)
        .reduce((max, box) => Math.max(max, box.boxNo), 0) + 1;

    const boxID = `b-${nextBoxNoGlobal++}`;
    const boxDisplayName = `BOX-${String(borrowerBoxNo).padStart(3, "0")}`;

    loanBoxes = [
      {
        id: boxID,
        borrowerId: auth.user.id,
        boxNo: borrowerBoxNo,
        displayName: boxDisplayName,
        startDate,
        dueDate,
      },
      ...loanBoxes,
    ];

    const createdItems = toolIDs.map((toolID) => {
      const loanItemID = `li-${nextLoanItemNo++}`;
      const itemDueDate = itemDueOverrides[toolID] ?? dueDate;

      loanItems = [
        {
          id: loanItemID,
          boxId: boxID,
          toolId: toolID,
          borrowerId: auth.user.id,
          startDate,
          dueDate: itemDueDate,
        },
        ...loanItems,
      ];

      return {
        loanItemId: loanItemID,
        toolId: toolID,
        startDate,
        dueDate: itemDueDate,
      };
    });

    addAuditLog("create_loan_box", "loan_box", boxID, auth.user.id, {
      toolIds: toolIDs,
      startDate,
      dueDate,
    });

    return HttpResponse.json(
      {
        boxId: boxID,
        boxDisplayName,
        createdItems,
      },
      { status: 201 },
    );
  }),

  http.get("/api/my/loans", ({ request }) => {
    const auth = authenticate(request);
    if ("error" in auth) return auth.error;

    const today = todayYmd();

    const rows = loanItems
      .filter((item) => item.borrowerId === auth.user.id && !item.returnApprovedAt)
      .map((item) => {
        const tool = tools.find((value) => value.id === item.toolId);
        const box = loanBoxes.find((value) => value.id === item.boxId);
        if (!tool || !box) return null;

        return {
          loanItemId: item.id,
          boxId: item.boxId,
          boxDisplayName: box.displayName,
          toolId: tool.id,
          assetNo: tool.assetNo,
          toolName: tool.name,
          startDate: item.startDate,
          dueDate: item.dueDate,
          status: item.startDate > today ? "RESERVED" : "LOANED",
          returnRequestedAt: item.returnRequestedAt ?? null,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => b.startDate.localeCompare(a.startDate));

    return HttpResponse.json(rows);
  }),

  http.post("/api/my/loans/:loanItemId/return-request", ({ request, params }) => {
    const auth = authenticate(request);
    if ("error" in auth) return auth.error;

    const loanItemID = String(params.loanItemId ?? "").trim();
    const index = loanItems.findIndex((item) => item.id === loanItemID);
    if (index < 0) {
      return errorResponse(404, "NOT_FOUND", "loan item not found");
    }

    const item = loanItems[index];
    if (item.borrowerId !== auth.user.id) {
      return errorResponse(403, "FORBIDDEN", "only borrower can request return");
    }
    if (item.returnApprovedAt) {
      return errorResponse(409, "ALREADY_APPROVED", "loan item already approved");
    }
    if (item.returnRequestedAt) {
      return errorResponse(409, "ALREADY_REQUESTED", "return already requested");
    }

    loanItems[index] = {
      ...item,
      returnRequestedAt: nowIso(),
    };

    addAuditLog("request_return", "loan_item", item.id, auth.user.id, {});
    return HttpResponse.json({ ok: true });
  }),

  http.get("/api/admin/tools", ({ request }) => {
    const auth = authenticate(request, "admin");
    if ("error" in auth) return auth.error;

    const url = new URL(request.url);
    const page = parsePositiveInt(url.searchParams.get("page"), 1);
    const pageSize = Math.min(parsePositiveInt(url.searchParams.get("pageSize"), 25), 100);

    const rows = listToolRows(auth.user.id).map((item) => ({
      ...item,
      baseStatus: item.baseStatus,
    }));

    const total = rows.length;
    const offset = (page - 1) * pageSize;

    return HttpResponse.json({
      items: rows.slice(offset, offset + pageSize).map((item) => ({
        ...item,
        toolId: item.assetNo,
      })),
      page,
      pageSize,
      total,
    });
  }),

  http.post("/api/admin/tools", async ({ request }) => {
    const auth = authenticate(request, "admin");
    if ("error" in auth) return auth.error;

    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      return errorResponse(400, "INVALID_REQUEST", "invalid request body");
    }

    const obj = readBody(body);
    const name = typeof obj.name === "string" ? obj.name.trim() : "";
    const warehouseID = typeof obj.warehouseId === "string" ? obj.warehouseId.trim() : "";
    const baseStatusRaw = typeof obj.baseStatus === "string" ? obj.baseStatus.trim().toUpperCase() : "";
    const baseStatus: BaseStatus =
      baseStatusRaw === "BROKEN" || baseStatusRaw === "REPAIR" ? (baseStatusRaw as BaseStatus) : "AVAILABLE";

    if (!name || !warehouseID) {
      return errorResponse(400, "INVALID_REQUEST", "name, warehouseId are required");
    }

    if (!warehouses.some((warehouse) => warehouse.id === warehouseID)) {
      return errorResponse(400, "INVALID_REQUEST", "warehouseId is invalid");
    }

    const tool: Tool = {
      id: `t-${nextToolNo++}`,
      assetNo: nextToolAssetNo(warehouseID, tools),
      name,
      warehouseId: warehouseID,
      baseStatus,
    };

    tools = [tool, ...tools];
    addAuditLog("create_tool", "tool", tool.id, auth.user.id, tool);

    return HttpResponse.json(
      {
        id: tool.id,
        toolId: tool.assetNo,
        assetNo: tool.assetNo,
        name: tool.name,
        warehouseId: tool.warehouseId,
        baseStatus: tool.baseStatus,
      },
      { status: 201 },
    );
  }),

  http.post("/api/admin/tools/bulk", async ({ request }) => {
    const auth = authenticate(request, "admin");
    if ("error" in auth) return auth.error;

    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      return errorResponse(400, "INVALID_REQUEST", "invalid request body");
    }

    const obj = readBody(body);
    const rawTools = Array.isArray(obj.tools) ? obj.tools : [];
    if (rawTools.length === 0) {
      return errorResponse(400, "INVALID_REQUEST", "tools is required");
    }

    const rowErrors: Array<{ row: number; field: string; message: string }> = [];
    const nextTools: Tool[] = [];

    for (const [index, rawItem] of rawTools.entries()) {
      const item = readBody(rawItem);
      const row = index + 1;
      const name = typeof item.name === "string" ? item.name.trim() : "";
      const warehouseID = typeof item.warehouseId === "string" ? item.warehouseId.trim() : "";
      const baseStatusRaw = typeof item.baseStatus === "string" ? item.baseStatus.trim().toUpperCase() : "";
      const baseStatus: BaseStatus =
        baseStatusRaw === "BROKEN" || baseStatusRaw === "REPAIR" ? (baseStatusRaw as BaseStatus) : "AVAILABLE";

      if (!name) {
        rowErrors.push({ row, field: "name", message: "name is required" });
      }
      if (!warehouseID || !warehouses.some((warehouse) => warehouse.id === warehouseID)) {
        rowErrors.push({ row, field: "warehouseId", message: "warehouseId is invalid" });
      }

      nextTools.push({
        id: `t-${nextToolNo + index}`,
        assetNo: nextToolAssetNo(warehouseID, [...tools, ...nextTools]),
        name,
        warehouseId: warehouseID,
        baseStatus,
      });
    }

    if (rowErrors.length > 0) {
      return errorResponse(400, "INVALID_REQUEST", "invalid tools payload", { rowErrors });
    }

    nextToolNo += nextTools.length;
    tools = [...nextTools, ...tools];
    addAuditLog("create_tools_bulk", "tool", undefined, auth.user.id, {
      count: nextTools.length,
      toolIds: nextTools.map((tool) => tool.id),
    });

    return HttpResponse.json(
      {
        items: nextTools.map((tool) => ({
          id: tool.id,
          toolId: tool.assetNo,
          assetNo: tool.assetNo,
          name: tool.name,
          warehouseId: tool.warehouseId,
          baseStatus: tool.baseStatus,
        })),
      },
      { status: 201 },
    );
  }),

  http.post("/api/admin/import/excel", async ({ request }) => {
    const auth = authenticate(request, "admin");
    if ("error" in auth) return auth.error;

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return errorResponse(400, "INVALID_REQUEST", "invalid form-data");
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return errorResponse(400, "INVALID_REQUEST", "file is required");
    }
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return errorResponse(400, "INVALID_REQUEST", "file must be .xlsx");
    }

    return HttpResponse.json(
      {
        warehousesCreated: 0,
        warehousesUpdated: 0,
        toolsCreated: 0,
      },
      { status: 201 },
    );
  }),

  http.patch("/api/admin/tools/:toolId", async ({ request, params }) => {
    const auth = authenticate(request, "admin");
    if ("error" in auth) return auth.error;

    const toolID = String(params.toolId ?? "").trim();
    const index = tools.findIndex((tool) => tool.id === toolID);
    if (index < 0) {
      return errorResponse(404, "NOT_FOUND", "tool not found");
    }

    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      return errorResponse(400, "INVALID_REQUEST", "invalid request body");
    }

    const obj = readBody(body);
    const nextToolId = typeof obj.toolId === "string" ? obj.toolId.trim() : undefined;
    const rawAssetNo = typeof obj.assetNo === "string" ? obj.assetNo.trim() : undefined;
    const nextName = typeof obj.name === "string" ? obj.name.trim() : undefined;
    const nextWarehouseID = typeof obj.warehouseId === "string" ? obj.warehouseId.trim() : undefined;
    const nextBaseStatusRaw = typeof obj.baseStatus === "string" ? obj.baseStatus.trim().toUpperCase() : undefined;

    if (rawAssetNo !== undefined && nextToolId !== undefined && rawAssetNo !== nextToolId) {
      return errorResponse(400, "INVALID_REQUEST", "assetNo and toolId do not match");
    }
    if ((rawAssetNo !== undefined && !rawAssetNo) || (nextToolId !== undefined && !nextToolId)) {
      return errorResponse(400, "INVALID_REQUEST", "assetNo is invalid");
    }
    if (
      (rawAssetNo !== undefined && rawAssetNo !== tools[index].assetNo) ||
      (nextToolId !== undefined && nextToolId !== tools[index].assetNo)
    ) {
      return errorResponse(400, "INVALID_REQUEST", "assetNo is managed automatically");
    }
    if (nextName !== undefined && !nextName) {
      return errorResponse(400, "INVALID_REQUEST", "name is invalid");
    }

    if (nextWarehouseID !== undefined && !warehouses.some((warehouse) => warehouse.id === nextWarehouseID)) {
      return errorResponse(400, "INVALID_REQUEST", "warehouseId is invalid");
    }

    if (
      nextBaseStatusRaw !== undefined &&
      nextBaseStatusRaw !== "AVAILABLE" &&
      nextBaseStatusRaw !== "BROKEN" &&
      nextBaseStatusRaw !== "REPAIR"
    ) {
      return errorResponse(400, "INVALID_REQUEST", "baseStatus is invalid");
    }

    const current = tools[index];
    const nextGeneratedAssetNo =
      nextWarehouseID !== undefined && nextWarehouseID !== current.warehouseId
        ? nextToolAssetNo(nextWarehouseID, tools, toolID)
        : current.assetNo;
    const updated: Tool = {
      ...current,
      assetNo: nextGeneratedAssetNo,
      ...(nextName !== undefined ? { name: nextName } : {}),
      ...(nextWarehouseID !== undefined ? { warehouseId: nextWarehouseID } : {}),
      ...(nextBaseStatusRaw !== undefined ? { baseStatus: nextBaseStatusRaw as BaseStatus } : {}),
    };

    tools[index] = updated;

    addAuditLog("update_tool", "tool", toolID, auth.user.id, {
      before: current,
      after: updated,
    });

    return HttpResponse.json({
      id: updated.id,
      toolId: updated.assetNo,
      assetNo: updated.assetNo,
      name: updated.name,
      warehouseId: updated.warehouseId,
      baseStatus: updated.baseStatus,
    });
  }),

  http.post("/api/admin/warehouses", async ({ request }) => {
    const auth = authenticate(request, "admin");
    if ("error" in auth) return auth.error;

    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      return errorResponse(400, "INVALID_REQUEST", "invalid request body");
    }

    const obj = readBody(body);
    const name = typeof obj.name === "string" ? obj.name.trim() : "";
    const warehouseNo = typeof obj.warehouseNo === "string" ? obj.warehouseNo.trim() : "";
    if (!name) {
      return errorResponse(400, "INVALID_REQUEST", "name is required");
    }

    const warehouse = { id: `w-${nextWarehouseNo++}`, name, warehouseNo: warehouseNo || null };
    warehouses = [warehouse, ...warehouses];

    addAuditLog("create_warehouse", "warehouse", warehouse.id, auth.user.id, warehouse);
    return HttpResponse.json(warehouse, { status: 201 });
  }),

  http.get("/api/admin/returns/requests", ({ request }) => {
    const auth = authenticate(request, "admin");
    if ("error" in auth) return auth.error;

    const requested = loanItems.filter((item) => item.returnRequestedAt && !item.returnApprovedAt);

    const grouped = new Map<
      string,
      {
        boxId: string;
        boxDisplayName: string;
        borrowerUsername: string;
        startDate: string;
        dueDate: string;
        items: Array<{
          loanItemId: string;
          toolId: string;
          assetNo: string;
          toolName: string;
          startDate: string;
          dueDate: string;
          returnRequestedAt: string;
        }>;
      }
    >();

    for (const item of requested) {
      const box = loanBoxes.find((value) => value.id === item.boxId);
      const tool = tools.find((value) => value.id === item.toolId);
      const borrower = users.find((value) => value.id === item.borrowerId);
      if (!box || !tool || !borrower || !item.returnRequestedAt) continue;

      const current = grouped.get(box.id);
      const row = {
        loanItemId: item.id,
        toolId: item.toolId,
        assetNo: tool.assetNo,
        toolName: tool.name,
        startDate: item.startDate,
        dueDate: item.dueDate,
        returnRequestedAt: item.returnRequestedAt,
      };

      if (current) {
        current.items.push(row);
      } else {
        grouped.set(box.id, {
          boxId: box.id,
          boxDisplayName: box.displayName,
          borrowerUsername: borrower.username,
          startDate: box.startDate,
          dueDate: box.dueDate,
          items: [row],
        });
      }
    }

    const result = Array.from(grouped.values()).sort((a, b) => {
      const aTs = new Date(a.items[0]?.returnRequestedAt ?? 0).getTime();
      const bTs = new Date(b.items[0]?.returnRequestedAt ?? 0).getTime();
      return bTs - aTs;
    });

    return HttpResponse.json(result);
  }),

  http.post("/api/admin/returns/approve-box", async ({ request }) => {
    const auth = authenticate(request, "admin");
    if ("error" in auth) return auth.error;

    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      return errorResponse(400, "INVALID_REQUEST", "invalid request body");
    }

    const obj = readBody(body);
    const boxID = typeof obj.boxId === "string" ? obj.boxId.trim() : "";
    if (!boxID) {
      return errorResponse(400, "INVALID_REQUEST", "boxId is required");
    }

    const requested = loanItems.filter((item) => item.boxId === boxID && item.returnRequestedAt && !item.returnApprovedAt);
    if (requested.length === 0) {
      return errorResponse(409, "NOTHING_TO_APPROVE", "no requested items to approve");
    }

    const now = nowIso();
    loanItems = loanItems.map((item) => {
      if (item.boxId === boxID && item.returnRequestedAt && !item.returnApprovedAt) {
        return { ...item, returnApprovedAt: now };
      }
      return item;
    });

    addAuditLog("approve_return_box", "loan_box", boxID, auth.user.id, {
      approvedCount: requested.length,
    });

    return HttpResponse.json({ approvedCount: requested.length });
  }),

  http.post("/api/admin/returns/approve-items", async ({ request }) => {
    const auth = authenticate(request, "admin");
    if ("error" in auth) return auth.error;

    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      return errorResponse(400, "INVALID_REQUEST", "invalid request body");
    }

    const obj = readBody(body);
    const boxID = typeof obj.boxId === "string" ? obj.boxId.trim() : "";
    const loanItemIDs = parseLoanItemIDs(obj.loanItemIds);

    if (!boxID) {
      return errorResponse(400, "INVALID_REQUEST", "boxId is required");
    }
    if (loanItemIDs.length === 0) {
      return errorResponse(400, "INVALID_REQUEST", "loanItemIds is required");
    }

    for (const loanItemID of loanItemIDs) {
      const item = loanItems.find((value) => value.id === loanItemID);
      if (!item || item.boxId !== boxID) {
        return errorResponse(409, "ITEM_NOT_IN_BOX", "loan item is not part of the box", { loanItemId: loanItemID });
      }
      if (!item.returnRequestedAt) {
        return errorResponse(409, "ITEM_NOT_REQUESTED", "loan item is not requested", { loanItemId: loanItemID });
      }
      if (item.returnApprovedAt) {
        return errorResponse(409, "ALREADY_APPROVED", "loan item already approved", { loanItemId: loanItemID });
      }
    }

    const selected = new Set(loanItemIDs);
    const now = nowIso();
    let approvedCount = 0;

    loanItems = loanItems.map((item) => {
      if (selected.has(item.id) && item.boxId === boxID && item.returnRequestedAt && !item.returnApprovedAt) {
        approvedCount += 1;
        return { ...item, returnApprovedAt: now };
      }
      return item;
    });

    addAuditLog("approve_return_items", "loan_box", boxID, auth.user.id, {
      approvedCount,
      loanItemIds: loanItemIDs,
    });

    return HttpResponse.json({ approvedCount });
  }),

  http.get("/api/admin/users", ({ request }) => {
    const auth = authenticate(request, "admin");
    if ("error" in auth) return auth.error;

    const url = new URL(request.url);
    const page = parsePositiveInt(url.searchParams.get("page"), 1);
    const pageSize = Math.min(parsePositiveInt(url.searchParams.get("pageSize"), 10), 100);
    const offset = (page - 1) * pageSize;

    const items = users.filter(isActiveUser).map((user) => ({
      id: user.id,
      department: user.department,
      userCode: user.userCode,
      username: user.username,
      email: user.email,
      role: user.role,
    }));

    return HttpResponse.json({
      items: items.slice(offset, offset + pageSize),
      page,
      pageSize,
      total: items.length,
    });
  }),

  http.post("/api/admin/users", async ({ request }) => {
    const auth = authenticate(request, "admin");
    if ("error" in auth) return auth.error;

    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      return errorResponse(400, "INVALID_REQUEST", "invalid request body");
    }

    const obj = readBody(body);
    const department = typeof obj.department === "string" ? obj.department.trim() : "";
    const userCode = typeof obj.userCode === "string" ? obj.userCode.trim() : "";
    const username = typeof obj.username === "string" ? obj.username.trim() : "";
    const email = typeof obj.email === "string" ? obj.email.trim().toLowerCase() : "";
    const password = typeof obj.password === "string" ? obj.password : "";
    const roleRaw = typeof obj.role === "string" ? obj.role.trim().toLowerCase() : "";
    const role: Role = roleRaw === "admin" ? "admin" : "user";

    if (!department || !userCode || !username || !email || !password) {
      return errorResponse(400, "INVALID_REQUEST", "department, userCode, username, email, password, role are required");
    }

    if (users.some((user) => isActiveUser(user) && user.userCode.toLowerCase() === userCode.toLowerCase())) {
      return errorResponse(409, "USER_CODE_DUPLICATE", "userCode already exists");
    }
    if (users.some((user) => isActiveUser(user) && user.username.toLowerCase() === username.toLowerCase())) {
      return errorResponse(409, "USERNAME_DUPLICATE", "username already exists");
    }
    if (users.some((user) => isActiveUser(user) && user.email.toLowerCase() === email.toLowerCase())) {
      return errorResponse(409, "EMAIL_DUPLICATE", "email already exists");
    }

    const created: User = {
      id: `u-${nextUserNo++}`,
      department,
      userCode,
      username,
      email,
      password,
      role,
      isActive: true,
    };

    users = [created, ...users];

    addAuditLog("create_user", "user", created.id, auth.user.id, {
      userCode: created.userCode,
      username: created.username,
      email: created.email,
      role: created.role,
    });

    return HttpResponse.json(
      {
        id: created.id,
        department: created.department,
        userCode: created.userCode,
        username: created.username,
        email: created.email,
        role: created.role,
      },
      { status: 201 },
    );
  }),

  http.patch("/api/admin/users/:userId", async ({ request, params }) => {
    const auth = authenticate(request, "admin");
    if ("error" in auth) return auth.error;

    const userID = String(params.userId ?? "").trim();
    if (!userID) {
      return errorResponse(400, "INVALID_REQUEST", "userId is required");
    }

    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      return errorResponse(400, "INVALID_REQUEST", "invalid request body");
    }

    const obj = readBody(body);
    const targetIndex = users.findIndex((user) => user.id === userID);
    if (targetIndex === -1) {
      return errorResponse(404, "NOT_FOUND", "user not found");
    }

    const nextDepartment = typeof obj.department === "string" ? obj.department.trim() : undefined;
    const nextUserCode = typeof obj.userCode === "string" ? obj.userCode.trim() : undefined;
    const nextUsername = typeof obj.username === "string" ? obj.username.trim() : undefined;
    const nextEmail = typeof obj.email === "string" ? obj.email.trim().toLowerCase() : undefined;
    const nextRoleRaw = typeof obj.role === "string" ? obj.role.trim().toLowerCase() : undefined;
    const nextRole = nextRoleRaw === "admin" || nextRoleRaw === "user" ? nextRoleRaw : undefined;

    if (
      nextDepartment === undefined &&
      nextUserCode === undefined &&
      nextUsername === undefined &&
      nextEmail === undefined &&
      nextRole === undefined
    ) {
      return errorResponse(400, "INVALID_REQUEST", "at least one field is required");
    }
    if (nextDepartment !== undefined && !nextDepartment) {
      return errorResponse(400, "INVALID_REQUEST", "department cannot be empty");
    }
    if (nextUserCode !== undefined && !nextUserCode) {
      return errorResponse(400, "INVALID_REQUEST", "userCode cannot be empty");
    }
    if (nextUsername !== undefined && !nextUsername) {
      return errorResponse(400, "INVALID_REQUEST", "username cannot be empty");
    }
    if (nextEmail !== undefined && !nextEmail) {
      return errorResponse(400, "INVALID_REQUEST", "email cannot be empty");
    }

    if (
      nextUserCode !== undefined &&
      users.some(
        (user, index) => index !== targetIndex && isActiveUser(user) && user.userCode.toLowerCase() === nextUserCode.toLowerCase(),
      )
    ) {
      return errorResponse(409, "USER_CODE_DUPLICATE", "userCode already exists");
    }
    if (
      nextUsername !== undefined &&
      users.some(
        (user, index) => index !== targetIndex && isActiveUser(user) && user.username.toLowerCase() === nextUsername.toLowerCase(),
      )
    ) {
      return errorResponse(409, "USERNAME_DUPLICATE", "username already exists");
    }
    if (
      nextEmail !== undefined &&
      users.some(
        (user, index) => index !== targetIndex && isActiveUser(user) && user.email.toLowerCase() === nextEmail.toLowerCase(),
      )
    ) {
      return errorResponse(409, "EMAIL_DUPLICATE", "email already exists");
    }

    const updated = {
      ...users[targetIndex],
      ...(nextDepartment !== undefined ? { department: nextDepartment } : {}),
      ...(nextUserCode !== undefined ? { userCode: nextUserCode } : {}),
      ...(nextUsername !== undefined ? { username: nextUsername } : {}),
      ...(nextEmail !== undefined ? { email: nextEmail } : {}),
      ...(nextRole !== undefined ? { role: nextRole } : {}),
    };

    users = users.map((user, index) => (index === targetIndex ? updated : user));

    addAuditLog("update_user", "user", updated.id, auth.user.id, {
      department: updated.department,
      userCode: updated.userCode,
      username: updated.username,
      email: updated.email,
      role: updated.role,
    });

    return HttpResponse.json({
      id: updated.id,
      department: updated.department,
      userCode: updated.userCode,
      username: updated.username,
      email: updated.email,
      role: updated.role,
    });
  }),

  http.delete("/api/admin/users/:userId", ({ request, params }) => {
    const auth = authenticate(request, "admin");
    if ("error" in auth) return auth.error;

    const userID = String(params.userId ?? "").trim();
    if (!userID) {
      return errorResponse(400, "INVALID_REQUEST", "userId is required");
    }
    if (auth.user.id === userID) {
      return errorResponse(403, "FORBIDDEN", "cannot delete yourself");
    }

    const target = users.find((user) => user.id === userID);
    if (!target) {
      return errorResponse(404, "NOT_FOUND", "user not found");
    }

    if (target.role === "admin" && isActiveUser(target)) {
      const activeAdminCount = users.filter((user) => isActiveUser(user) && user.role === "admin").length;
      if (activeAdminCount <= 1) {
        return errorResponse(409, "LAST_ADMIN", "cannot delete the last active admin");
      }
    }

    users = users.map((user) => (user.id === userID ? { ...user, isActive: false } : user));

    addAuditLog("delete_user", "user", userID, auth.user.id, {
      username: target.username,
      email: target.email,
      role: target.role,
    });

    return HttpResponse.json({ ok: true });
  }),

  http.get("/api/admin/audit-logs", ({ request }) => {
    const auth = authenticate(request, "admin");
    if ("error" in auth) return auth.error;

    const url = new URL(request.url);
    const page = parsePositiveInt(url.searchParams.get("page"), 1);
    const pageSize = Math.min(parsePositiveInt(url.searchParams.get("pageSize"), 25), 100);

    const total = auditLogs.length;
    const offset = (page - 1) * pageSize;

    return HttpResponse.json({
      items: auditLogs.slice(offset, offset + pageSize),
      page,
      pageSize,
      total,
    });
  }),
];
