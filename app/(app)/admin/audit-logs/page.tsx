"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Table, Td, Th } from "../../../../src/components/ui/Table";
import { formatDateJa } from "../../../../src/utils/format";
import { apiFetchJson, getHttpErrorMessage, isHttpError } from "../../../../src/utils/http";
import { clearAuthSession } from "../../../../src/utils/auth";

type AuditLogItem = {
  id: string;
  actorId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  payload?: unknown;
  createdAt: string;
};

type PagedResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

export default function AdminAuditLogsPage() {
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  const handleApiError = useCallback(
    (error: unknown): string | null => {
      if (isHttpError(error) && error.status === 401) {
        clearAuthSession();
        router.push("/login");
        return null;
      }

      if (isHttpError(error) && error.status === 403) {
        router.push("/tools");
        return null;
      }

      return getHttpErrorMessage(error);
    },
    [router],
  );

  useEffect(() => {
    (async () => {
      try {
        const response = await apiFetchJson<PagedResponse<AuditLogItem>>(
          "/api/admin/audit-logs?page=1&pageSize=25",
        );
        setItems(response.items ?? []);
        setErr(null);
      } catch (e: unknown) {
        const message = handleApiError(e);
        if (message) setErr(message);
      } finally {
        setLoading(false);
      }
    })();
  }, [handleApiError]);

  if (loading) return <main style={{ padding: 16 }}>loading...</main>;
  if (err) {
    return (
      <main style={{ padding: 16 }}>
        <p style={{ color: "#b91c1c" }}>error: {err}</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 16 }}>
      <h1>監査ログ</h1>
      {items.length === 0 ? (
        <p>ログがありません。</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>日時</Th>
              <Th>Action</Th>
              <Th>Target</Th>
              <Th>Actor</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <Td>{formatDateJa(item.createdAt)}</Td>
                <Td>{item.action}</Td>
                <Td>
                  {item.targetType}
                  {item.targetId ? ` (${item.targetId})` : ""}
                </Td>
                <Td>{item.actorId ?? "-"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </main>
  );
}
