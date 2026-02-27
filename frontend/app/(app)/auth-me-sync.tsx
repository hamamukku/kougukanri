"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuthToken, clearAuthSession, writeAuthSession } from "../../src/utils/auth";
import { apiFetchJson, isHttpError } from "../../src/utils/http";

type MeResponse = {
  role: "admin" | "user";
  userName: string;
};

export default function AuthMeSync() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const token = getAuthToken();
      if (!token) return;

      try {
        const me = await apiFetchJson<MeResponse>("/api/auth/me");
        writeAuthSession({
          token,
          role: me.role === "admin" ? "admin" : "user",
          userName: me.userName,
        });
      } catch (e: unknown) {
        if (isHttpError(e) && e.status === 401) {
          clearAuthSession();
          router.push("/login");
          return;
        }
        if (isHttpError(e) && e.status === 403) {
          router.push("/tools");
        }
      }
    })();
  }, [router]);

  return null;
}

