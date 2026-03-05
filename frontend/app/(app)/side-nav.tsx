// frontend/app/(app)/side-nav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLoanBox } from "../../src/state/loanBoxStore";

type Props = { role: "user" | "admin" };
type MenuItem = { href: string; label: string; withCount?: boolean };

export default function SideNav({ role }: Props) {
  const pathname = usePathname();
  const { selectedToolIds } = useLoanBox();
  const count = selectedToolIds.size;

  const userMenu: MenuItem[] = [
    { href: "/tools", label: "工具一覧" },
    { href: "/loan-box", label: "貸出ボックス", withCount: true },
    { href: "/my-loans", label: "貸出一覧" },
    { href: "/my-page", label: "マイページ" },
  ];

  const adminMenu: MenuItem[] = [
    { href: "/admin/returns", label: "返却承認" },
    { href: "/admin/tools", label: "工具管理" },
    { href: "/admin/users", label: "ユーザー・部署管理" },
    { href: "/admin/warehouses", label: "倉庫管理" },
    { href: "/admin/import", label: "Excel取込" },
  ];

  const menu = role === "admin" ? adminMenu : userMenu;

  return (
    <nav style={{ display: "grid", gap: 12 }}>
      {menu.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,

              // ✅ ボタン自体を拡大
              padding: "14px 16px",
              minHeight: 56,

              borderRadius: 12,
              border: `1px solid ${active ? "#7dd3fc" : "#d8e2ec"}`,
              background: active ? "#e0f2fe" : "#ffffff",
              color: "#0f172a",
              textDecoration: "none",

              // ✅ 文字を拡大
              fontSize: 18,
              fontWeight: active ? 800 : 600,
              lineHeight: 1.2,
            }}
          >
            <span>{item.label}</span>

            {item.withCount ? (
              <span
                style={{
                  display: "inline-flex",
                  minWidth: 28,
                  height: 28,
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 8px",
                  background: "#f97316",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 800,
                }}
              >
                {count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}