"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.HttpError = void 0;
exports.isHttpError = isHttpError;
exports.getHttpErrorMessage = getHttpErrorMessage;
exports.apiFetchJson = apiFetchJson;
var auth_1 = require("./auth");
var HttpError = /** @class */ (function (_super) {
    __extends(HttpError, _super);
    function HttpError(status, message, body) {
        if (body === void 0) { body = null; }
        var _this = _super.call(this, message) || this;
        _this.name = "HttpError";
        _this.status = status;
        _this.body = body;
        return _this;
    }
    return HttpError;
}(Error));
exports.HttpError = HttpError;
function isHttpError(error) {
    return error instanceof HttpError;
}
function getHttpErrorMessage(error) {
    if (!isHttpError(error) || typeof error.message !== "string" || error.message.trim().length === 0) {
        return "通信に失敗しました";
    }
    return error.message;
}
function parseBody(response) {
    return response
        .text()
        .then(function (text) {
        if (!text)
            return null;
        try {
            return JSON.parse(text);
        }
        catch (_a) {
            return text;
        }
    })
        .catch(function () { return null; });
}
function getErrorMessage(body, status) {
    if (!body || typeof body !== "object") {
        return "Request failed (".concat(status, ")");
    }
    var envelope = body;
    if (envelope.error && typeof envelope.error.message === "string" && envelope.error.message.trim().length > 0) {
        return envelope.error.message;
    }
    if (typeof envelope.message === "string" && envelope.message.trim().length > 0) {
        return envelope.message;
    }
    return "Request failed (".concat(status, ")");
}
function buildHeaders(headers) {
    var next = new Headers(headers);
    var token = (0, auth_1.getAuthToken)();
    if (token && !next.has("Authorization")) {
        next.set("Authorization", "Bearer ".concat(token));
    }
    return next;
}
function apiFetchJson(url_1) {
    return __awaiter(this, arguments, void 0, function (url, options) {
        var response, error_1, body;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, fetch(url, __assign(__assign({}, options), { headers: buildHeaders(options.headers) }))];
                case 1:
                    response = _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    error_1 = _a.sent();
                    throw new HttpError(0, "通信に失敗しました", error_1);
                case 3: return [4 /*yield*/, parseBody(response)];
                case 4:
                    body = _a.sent();
                    if (!response.ok) {
                        throw new HttpError(response.status, getErrorMessage(body, response.status), body);
                    }
                    return [2 /*return*/, body];
            }
        });
    });
}
