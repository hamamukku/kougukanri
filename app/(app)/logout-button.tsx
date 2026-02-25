"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  const removeCookie = (name: string) => {
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
  };

  const onLogout = () => {
    removeCookie("auth");
    removeCookie("role");
    removeCookie("username");
    router.push("/login");
  };

  return (
    <button type="button" onClick={onLogout}>
      ログアウト
    </button>
  );
}
