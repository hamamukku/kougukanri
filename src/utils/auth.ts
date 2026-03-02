export const AUTH_TOKEN_COOKIE = "auth_token";
export const AUTH_ROLE_COOKIE = "role";
export const AUTH_USERNAME_COOKIE = "username";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

export type AuthRole = "admin" | "user";

export type AuthSession = {
  token: string;
  role: AuthRole;
  userName: string;
};

function setCookie(name: string, value: string, maxAge = SESSION_MAX_AGE_SECONDS) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

export function clearCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function getAuthToken(): string | null {
  return getCookie(AUTH_TOKEN_COOKIE);
}

export function writeAuthSession(session: AuthSession) {
  setCookie(AUTH_TOKEN_COOKIE, session.token);
  setCookie(AUTH_ROLE_COOKIE, session.role);
  setCookie(AUTH_USERNAME_COOKIE, session.userName);
}

export function clearAuthSession() {
  clearCookie(AUTH_TOKEN_COOKIE);
  clearCookie(AUTH_ROLE_COOKIE);
  clearCookie(AUTH_USERNAME_COOKIE);
}

