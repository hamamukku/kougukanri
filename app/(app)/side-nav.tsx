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
  ];

  const menu = role === "admin" ? adminMenu : userMenu;

  return (
    <nav style={{ display: "grid", gap: 8 }}>
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
              gap: 8,
              padding: "9px 11px",
              borderRadius: 10,
              border: `1px solid ${active ? "#7dd3fc" : "#d8e2ec"}`,
              background: active ? "#e0f2fe" : "#ffffff",
              color: "#0f172a",
              textDecoration: "none",
              fontWeight: active ? 700 : 500,
            }}
          >
            <span>{item.label}</span>
            {item.withCount ? (
              <span
                style={{
                  display: "inline-flex",
                  minWidth: 22,
                  height: 22,
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 6px",
                  background: "#f97316",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
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
