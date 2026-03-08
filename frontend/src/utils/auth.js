"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUTH_USERNAME_COOKIE = exports.AUTH_ROLE_COOKIE = exports.AUTH_TOKEN_COOKIE = void 0;
exports.clearCookie = clearCookie;
exports.getCookie = getCookie;
exports.getAuthToken = getAuthToken;
exports.writeAuthSession = writeAuthSession;
exports.clearAuthSession = clearAuthSession;
exports.AUTH_TOKEN_COOKIE = "auth_token";
exports.AUTH_ROLE_COOKIE = "role";
exports.AUTH_USERNAME_COOKIE = "username";
var SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
function setCookie(name, value, maxAge) {
    if (maxAge === void 0) { maxAge = SESSION_MAX_AGE_SECONDS; }
    document.cookie = "".concat(name, "=").concat(encodeURIComponent(value), "; Path=/; Max-Age=").concat(maxAge, "; SameSite=Lax");
}
function clearCookie(name) {
    if (typeof document === "undefined")
        return;
    document.cookie = "".concat(name, "=; Path=/; Max-Age=0; SameSite=Lax");
}
function getCookie(name) {
    if (typeof document === "undefined")
        return null;
    var match = document.cookie.match(new RegExp("(?:^|; )".concat(name, "=([^;]*)")));
    if (!match)
        return null;
    try {
        return decodeURIComponent(match[1]);
    }
    catch (_a) {
        return match[1];
    }
}
function getAuthToken() {
    return getCookie(exports.AUTH_TOKEN_COOKIE);
}
function writeAuthSession(session) {
    setCookie(exports.AUTH_TOKEN_COOKIE, session.token);
    setCookie(exports.AUTH_ROLE_COOKIE, session.role);
    setCookie(exports.AUTH_USERNAME_COOKIE, session.userName);
}
function clearAuthSession() {
    clearCookie(exports.AUTH_TOKEN_COOKIE);
    clearCookie(exports.AUTH_ROLE_COOKIE);
    clearCookie(exports.AUTH_USERNAME_COOKIE);
}
