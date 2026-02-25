import { http, HttpResponse, delay } from "msw";

const statuses = ["available", "loaned", "repairing", "lost"] as const;

const TOOLS_STORAGE_KEY = "msw_tools_state_v1";
const LOANS_STORAGE_KEY = "msw_loans_state_v1";

type Loan = {
  id: string;
  toolId: string;
  borrower: string;
  note?: string;
  loanedAt: string;
  returnedAt?: string;
  status: "open" | "closed";
};

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

function loadLoans(): Loan[] {
  try {
    const raw = localStorage.getItem(LOANS_STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr as Loan[];
  } catch {
    return [];
  }
}

function saveLoans(next: Loan[]) {
  try {
    localStorage.setItem(LOANS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

let tools = loadTools() ?? createInitialTools();
let loans: Loan[] = loadLoans();

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
  http.get("/api/loans", async ({ request }) => {
    await delay(150);
    const url = new URL(request.url);
    const status = url.searchParams.get("status") || "open";
    const list =
      status === "all"
        ? loans
        : status === "closed"
        ? loans.filter((x) => x.status === "closed")
        : loans.filter((x) => x.status === "open");
    return HttpResponse.json(list);
  }),
  http.post("/api/loans/checkout", async ({ request }) => {
    await delay(150);
    let body: any = null;
    try {
      body = await request.json();
    } catch {}

    const ids = Array.isArray(body?.ids) ? body.ids.filter((x: any) => typeof x === "string") : [];
    const borrower = typeof body?.borrower === "string" ? body.borrower.trim() : "";
    const note = typeof body?.note === "string" ? body.note : "";

    if (!ids.length) return HttpResponse.json({ ok: false, message: "ids required" }, { status: 400 });
    if (!borrower) return HttpResponse.json({ ok: false, message: "borrower required" }, { status: 400 });

    const missing = ids.filter((id: string) => !tools.some((t) => t.id === id));
    if (missing.length) {
      return HttpResponse.json({ ok: false, message: "not found", missing }, { status: 404 });
    }

    const bad = tools.filter((t) => ids.includes(t.id) && t.status !== "available");
    if (bad.length) {
      return HttpResponse.json({ ok: false, message: "non-available included", bad }, { status: 400 });
    }

    const now = new Date().toISOString();
    tools = tools.map((t) => (ids.includes(t.id) ? { ...t, status: "loaned" } : t));

    const newLoans = ids.map((toolId: string) => ({
      id: `l-${Date.now()}-${toolId}`,
      toolId,
      borrower,
      note,
      loanedAt: now,
      status: "open" as const,
    }));

    loans = [...loans, ...newLoans];

    saveTools(tools);
    saveLoans(loans);

    return HttpResponse.json({ ok: true, created: newLoans });
  }),
  http.post("/api/loans/return/:toolId", async ({ params }) => {
    await delay(150);
    const toolId = String(params.toolId);
    const idx = loans.findIndex((l) => l.toolId === toolId && l.status === "open");
    if (idx === -1) {
      return HttpResponse.json({ ok: false, message: "open loan not found" }, { status: 404 });
    }

    const now = new Date().toISOString();
    loans[idx] = { ...loans[idx], status: "closed", returnedAt: now };
    tools = tools.map((t) => (t.id === toolId ? { ...t, status: "available" } : t));

    saveTools(tools);
    saveLoans(loans);

    return HttpResponse.json({ ok: true, loan: loans[idx] });
  }),
  http.post("/api/admin/returns/:toolId/approve", async ({ params }) => {
    await delay(150);
    const toolId = String(params.toolId);
    const idx = loans.findIndex((l) => l.toolId === toolId && l.status === "open");
    if (idx === -1) {
      return HttpResponse.json({ ok: false, message: "open loan not found" }, { status: 404 });
    }
    const now = new Date().toISOString();
    loans[idx] = { ...loans[idx], status: "closed", returnedAt: now };
    tools = tools.map((t) => (t.id === toolId ? { ...t, status: "available" } : t));

    saveTools(tools);
    saveLoans(loans);

    return HttpResponse.json({ ok: true, loan: loans[idx], tool: tools.find((t) => t.id === toolId) });
  }),
];
