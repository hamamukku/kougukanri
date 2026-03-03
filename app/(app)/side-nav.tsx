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
    { href: "/tools", label: "\u5de5\u5177\u4e00\u89a7" },
    { href: "/loan-box", label: "\u8cb8\u51fa\u30dc\u30c3\u30af\u30b9", withCount: true },
    { href: "/my-loans", label: "\u8cb8\u51fa\u4e00\u89a7" },
    { href: "/my-page", label: "\u30de\u30a4\u30da\u30fc\u30b8" },
  ];

  const adminMenu: MenuItem[] = [
    { href: "/admin/returns", label: "\u8fd4\u5374\u627f\u8a8d" },
    { href: "/admin/tools", label: "\u5de5\u5177\u7ba1\u7406" },
    { href: "/admin/users", label: "\u30e6\u30fc\u30b6\u30fc\u30fb\u90e8\u7f72\u7ba1\u7406" },
    { href: "/admin/warehouses", label: "\u5009\u5eab\u7ba1\u7406" },
    { href: "/admin/import", label: "Excel\u53d6\u8fbc" },
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
