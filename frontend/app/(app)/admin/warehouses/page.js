// frontend/app/(app)/admin/warehouses/page.tsx
"use client";
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AdminWarehousesPage;
var react_1 = require("react");
var navigation_1 = require("next/navigation");
var Button_1 = require("../../../../src/components/ui/Button");
var Input_1 = require("../../../../src/components/ui/Input");
var ActionMenu_1 = require("../../../../src/components/ui/ActionMenu");
var http_1 = require("../../../../src/utils/http");
var auth_1 = require("../../../../src/utils/auth");
function ConfirmModal(props) {
    var _a, _b;
    if (!props.open)
        return null;
    var buttonStyle = {
        minWidth: 140,
        height: 52,
        fontSize: 18,
        fontWeight: 800,
        padding: "0 20px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
    };
    return (<div role="dialog" aria-modal="true" style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 9999,
        }} onMouseDown={function (e) {
            if (e.target === e.currentTarget && !props.busy)
                props.onCancel();
        }}>
      <div style={{
            width: "100%",
            maxWidth: 560,
            background: "#fff",
            borderRadius: 14,
            border: "1px solid #e2e8f0",
            boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
            padding: 18,
        }} onMouseDown={function (e) { return e.stopPropagation(); }}>
        <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 10 }}>{props.title}</div>

        <div style={{ fontSize: 16, lineHeight: 1.7, color: "#0f172a" }}>{props.message}</div>

        <div style={{ display: "flex", justifyContent: "center", gap: 14, marginTop: 18 }}>
          <Button_1.default type="button" variant="ghost" onClick={props.onCancel} disabled={props.busy} style={buttonStyle}>
            {(_a = props.cancelText) !== null && _a !== void 0 ? _a : "キャンセル"}
          </Button_1.default>

          <Button_1.default type="button" variant="danger" onClick={props.onOk} disabled={props.busy} style={buttonStyle}>
            {props.busy ? "削除中..." : (_b = props.okText) !== null && _b !== void 0 ? _b : "削除する"}
          </Button_1.default>
        </div>
      </div>
    </div>);
}
function AdminWarehousesPage() {
    var _this = this;
    var _a = (0, react_1.useState)([]), warehouses = _a[0], setWarehouses = _a[1];
    var _b = (0, react_1.useState)(true), loading = _b[0], setLoading = _b[1];
    var _c = (0, react_1.useState)(""), name = _c[0], setName = _c[1];
    var _d = (0, react_1.useState)(""), warehouseNo = _d[0], setWarehouseNo = _d[1];
    var _e = (0, react_1.useState)(null), err = _e[0], setErr = _e[1];
    var _f = (0, react_1.useState)(false), submitting = _f[0], setSubmitting = _f[1];
    var _g = (0, react_1.useState)(null), deletingId = _g[0], setDeletingId = _g[1];
    var _h = (0, react_1.useState)(false), confirmOpen = _h[0], setConfirmOpen = _h[1];
    var _j = (0, react_1.useState)(null), confirmTarget = _j[0], setConfirmTarget = _j[1];
    var _k = (0, react_1.useState)(false), confirmBusy = _k[0], setConfirmBusy = _k[1];
    var router = (0, navigation_1.useRouter)();
    var handleApiError = (0, react_1.useCallback)(function (error) {
        if ((0, http_1.isHttpError)(error) && error.status === 401) {
            (0, auth_1.clearAuthSession)();
            router.push("/login");
            return null;
        }
        if ((0, http_1.isHttpError)(error) && error.status === 403) {
            router.push("/tools");
            return null;
        }
        return (0, http_1.getHttpErrorMessage)(error);
    }, [router]);
    var loadData = (0, react_1.useCallback)(function () { return __awaiter(_this, void 0, void 0, function () {
        var data, e_1, message;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, 3, 4]);
                    return [4 /*yield*/, (0, http_1.apiFetchJson)("/api/warehouses")];
                case 1:
                    data = _a.sent();
                    setWarehouses(data);
                    setErr(null);
                    return [3 /*break*/, 4];
                case 2:
                    e_1 = _a.sent();
                    message = handleApiError(e_1);
                    if (message)
                        setErr(message);
                    return [3 /*break*/, 4];
                case 3:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 4: return [2 /*return*/];
            }
        });
    }); }, [handleApiError]);
    (0, react_1.useEffect)(function () {
        void loadData();
    }, [loadData]);
    var onAdd = function () { return __awaiter(_this, void 0, void 0, function () {
        var e_2, message;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!name.trim() || submitting)
                        return [2 /*return*/];
                    setSubmitting(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, 5, 6]);
                    return [4 /*yield*/, (0, http_1.apiFetchJson)("/api/admin/warehouses", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                name: name.trim(),
                                warehouseNo: warehouseNo.trim() || undefined,
                            }),
                        })];
                case 2:
                    _a.sent();
                    setName("");
                    setWarehouseNo("");
                    return [4 /*yield*/, loadData()];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 6];
                case 4:
                    e_2 = _a.sent();
                    message = handleApiError(e_2);
                    if (message)
                        setErr(message);
                    return [3 /*break*/, 6];
                case 5:
                    setSubmitting(false);
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    var onDelete = function (warehouse) { return __awaiter(_this, void 0, void 0, function () {
        var e_3, message;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (deletingId || submitting)
                        return [2 /*return*/];
                    setDeletingId(warehouse.id);
                    setErr(null);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, 5, 6]);
                    return [4 /*yield*/, (0, http_1.apiFetchJson)("/api/admin/warehouses/".concat(warehouse.id), {
                            method: "DELETE",
                        })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, loadData()];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 6];
                case 4:
                    e_3 = _a.sent();
                    message = handleApiError(e_3);
                    if (message)
                        setErr(message);
                    return [3 /*break*/, 6];
                case 5:
                    setDeletingId(null);
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    var openDeleteConfirm = function (warehouse) {
        setConfirmTarget(warehouse);
        setConfirmOpen(true);
    };
    var closeDeleteConfirm = function () {
        if (confirmBusy)
            return;
        setConfirmOpen(false);
        setConfirmTarget(null);
    };
    var onConfirmDelete = function () { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!confirmTarget)
                        return [2 /*return*/];
                    setConfirmBusy(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, , 3, 4]);
                    return [4 /*yield*/, onDelete(confirmTarget)];
                case 2:
                    _a.sent();
                    setConfirmOpen(false);
                    setConfirmTarget(null);
                    return [3 /*break*/, 4];
                case 3:
                    setConfirmBusy(false);
                    return [7 /*endfinally*/];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    // ラベル大きく + 中央寄せ（入力欄の中央に合わせる）
    var labelStyle = {
        fontSize: 16,
        fontWeight: 700,
        marginBottom: 6,
        textAlign: "center",
        lineHeight: 1.2,
    };
    // 入力欄も他ページと揃える（高さ・文字サイズ）
    var inputStyle = {
        fontSize: 16,
        padding: "12px 12px",
    };
    // ✅ ボタンは「大きいけど横に伸びない」
    var buttonStyle = {
        width: "auto",
        minWidth: 140,
        height: 52,
        fontSize: 18,
        fontWeight: 800,
        padding: "0 22px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
    };
    if (loading)
        return <main>loading...</main>;
    if (err)
        return (<main>
        <p style={{ color: "var(--danger)" }}>error: {err}</p>
      </main>);
    return (<main>
      <h1>場所管理</h1>

      <div className="card-surface" style={{
            marginTop: 12,
            display: "grid",
            gap: 12,
            alignItems: "end",
            marginBottom: 12,
            padding: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}>
        <div>
          <div style={labelStyle}>場所名</div>
          <Input_1.default value={name} onChange={function (e) { return setName(e.target.value); }} placeholder="場所名" style={inputStyle}/>
        </div>

        <div>
          <div style={labelStyle}>管理番号（任意）</div>
          <Input_1.default value={warehouseNo} onChange={function (e) { return setWarehouseNo(e.target.value); }} placeholder="例: 00001" style={inputStyle}/>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <Button_1.default type="button" onClick={onAdd} disabled={submitting} style={buttonStyle}>
            {submitting ? "登録中..." : "登録"}
          </Button_1.default>
        </div>
      </div>

      <table className="card-surface" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0 8px 12px" }}>場所名</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>管理番号</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "8px 0" }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {warehouses.map(function (warehouse) { return (<tr key={warehouse.id}>
              <td style={{ padding: "8px 0 8px 12px" }}>{warehouse.name}</td>
              <td style={{ padding: "8px 0" }}>
                {warehouse.warehouseNo && warehouse.warehouseNo.trim() ? warehouse.warehouseNo : "未設定"}
              </td>
              <td style={{ padding: "8px 0" }}>
                <ActionMenu_1.default disabled={deletingId !== null} items={[
                {
                    key: "delete",
                    label: deletingId === warehouse.id ? "削除中..." : "削除",
                    onClick: function () { return openDeleteConfirm(warehouse); },
                    danger: true,
                    disabled: deletingId !== null,
                },
            ]}/>
              </td>
            </tr>); })}
        </tbody>
      </table>

      <ConfirmModal open={confirmOpen} title="削除の確認" message={confirmTarget ? "\u5834\u6240\u300C".concat(confirmTarget.name, "\u300D\u3092\u524A\u9664\u3057\u307E\u3059\u3002\u3088\u308D\u3057\u3044\u3067\u3059\u304B\uFF1F") : ""} okText="削除する" cancelText="キャンセル" busy={confirmBusy} onCancel={closeDeleteConfirm} onOk={function () { return void onConfirmDelete(); }}/>
    </main>);
}
