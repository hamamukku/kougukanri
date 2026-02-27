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
    <div style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: "1px solid #e2e8f0",
          background: "#ffffff",
        }}
      >
        <strong>工具貸出管理</strong>
        <span>{username}</span>
        <LogoutButton />
      </header>

      <LoanBoxProvider>
        <AuthMeSync />
        <div style={{ display: "flex", alignItems: "stretch" }}>
          <aside
            style={{
              width: 240,
              minHeight: "calc(100vh - 53px)",
              borderRight: "1px solid #e2e8f0",
              background: "#ffffff",
              padding: "12px",
            }}
          >
            <SideNav role={role === "admin" ? "admin" : "user"} />
          </aside>
          <main style={{ flex: 1, padding: 16 }}>{children}</main>
        </div>
      </LoanBoxProvider>
    </div>
  );
}
