import { cookies } from "next/headers";
import Link from "next/link";
import LogoutButton from "./logout-button";

type MenuItem = {
  href: string;
  label: string;
};

const userMenu: MenuItem[] = [
  { href: "/tools", label: "工具一覧" },
  { href: "/my-loans", label: "借用一覧" },
  { href: "/loan-box", label: "貸出ボックス（0）" },
];

const adminMenu: MenuItem[] = [
  { href: "/admin/returns", label: "返却承認" },
  { href: "/admin/users", label: "ユーザー管理" },
  { href: "/admin/warehouses", label: "倉庫管理" },
  { href: "/admin/tools", label: "工具マスタ" },
];

export default async function AppShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const role = cookieStore.get("role")?.value ?? "user";
  const rawUsername = cookieStore.get("username")?.value;
  const username = (() => {
    if (!rawUsername) return "ユーザー";
    try {
      return decodeURIComponent(rawUsername);
    } catch {
      return rawUsername;
    }
  })();

  const menu = role === "admin" ? adminMenu : userMenu;

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
          <nav style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {menu.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main style={{ flex: 1, padding: 16 }}>{children}</main>
      </div>
    </div>
  );
}
