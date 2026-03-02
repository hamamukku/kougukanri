"use client";

import Link from "next/link";
import { useLoanBox } from "../../src/state/loanBoxStore";

type Props = { role: "user" | "admin" };

type MenuItem = { href: string; label: string };

export default function SideNav({ role }: Props) {
  const { selectedToolIds } = useLoanBox();
  const count = selectedToolIds.size;

  const userMenu: MenuItem[] = [
    { href: "/tools", label: "工具一覧" },
    { href: "/my-loans", label: "貸出一覧" },
    { href: "/loan-box", label: `貸出ボックス (${count})` },
    { href: "/my-page", label: "マイページ" },
  ];

  const adminMenu: MenuItem[] = [
    { href: "/admin/returns", label: "返却承認" },
    { href: "/admin/users", label: "ユーザー管理" },
    { href: "/admin/warehouses", label: "倉庫管理" },
    { href: "/admin/tools", label: "工具管理" },
    { href: "/admin/audit-logs", label: "監査ログ" },
  ];

  const menu = role === "admin" ? adminMenu : userMenu;

  return (
    <nav style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {menu.map((item) => (
        <Link key={item.href} href={item.href}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
