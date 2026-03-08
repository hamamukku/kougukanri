import { cookies } from "next/headers";
import LogoutButton from "./logout-button";
import { LoanBoxProvider } from "../../src/state/loanBoxStore";
import SideNav from "./side-nav";
import AuthMeSync from "./auth-me-sync";

const AUTH_ROLE_COOKIE = "role";
const AUTH_USERNAME_COOKIE = "username";

export default async function AppShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const role = cookieStore.get(AUTH_ROLE_COOKIE)?.value ?? "user";
  const rawUsername = cookieStore.get(AUTH_USERNAME_COOKIE)?.value;

  const username = (() => {
    if (!rawUsername) return "user";
    try {
      return decodeURIComponent(rawUsername);
    } catch {
      return rawUsername;
    }
  })();

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)", color: "var(--foreground)" }}>
      <LoanBoxProvider>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
          position: "sticky",
          top: 0,
          zIndex: 60,
        }}
      >
        <strong style={{ letterSpacing: 1 }}>工具貸出管理</strong>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span>{username}</span>
          <LogoutButton />
        </div>
      </header>

        <AuthMeSync />
        <div className="layout-with-nav" style={{ display: "flex", alignItems: "stretch" }}>
          <aside
            className="layout-side-nav"
            style={{
              width: 240,
              minHeight: "calc(100vh - 53px)",
              borderRight: "1px solid var(--border)",
              background: "var(--surface)",
              padding: "12px",
              position: "sticky",
              top: 54,
              alignSelf: "flex-start",
            }}
          >
            <SideNav role={role === "admin" ? "admin" : "user"} />
          </aside>
          <main className="app-main" style={{ flex: 1 }}>
            {children}
          </main>
        </div>
      </LoanBoxProvider>
    </div>
  );
}
