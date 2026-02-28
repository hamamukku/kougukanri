"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "../../../src/components/ui/Button";
import Input from "../../../src/components/ui/Input";
import { apiFetchJson, getHttpErrorMessage, isHttpError } from "../../../src/utils/http";
import { clearAuthSession } from "../../../src/utils/auth";

type Profile = {
  id: string;
  department: string;
  username: string;
  email: string;
  role: "admin" | "user";
  createdAt?: string;
};

function formatDateTime(value: string | undefined): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("ja-JP");
}

export default function MyPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [department, setDepartment] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleApiError = useCallback(
    (err: unknown): string | null => {
      if (isHttpError(err) && err.status === 401) {
        clearAuthSession();
        router.push("/login");
        return null;
      }
      return getHttpErrorMessage(err);
    },
    [router],
  );

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetchJson<Profile>("/api/my/profile");
      setProfile(data);
      setDepartment(data.department);
      setUsername(data.username);
      setEmail(data.email);
      setError(null);
    } catch (err: unknown) {
      const msg = handleApiError(err);
      if (msg) setError(msg);
    } finally {
      setLoading(false);
    }
  }, [handleApiError]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const onSave = async () => {
    if (!profile || saving) return;
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const payload: Record<string, string> = {};
      if (department.trim() !== profile.department) payload.department = department.trim();
      if (username.trim() !== profile.username) payload.username = username.trim();
      if (email.trim() !== profile.email) payload.email = email.trim();
      if (newPassword.trim()) payload.password = newPassword;

      if (Object.keys(payload).length === 0) {
        setMessage("変更はありません。");
        return;
      }

      const updated = await apiFetchJson<Profile>("/api/my/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setProfile(updated);
      setDepartment(updated.department);
      setUsername(updated.username);
      setEmail(updated.email);
      setNewPassword("");
      setMessage("更新しました。");
    } catch (err: unknown) {
      const msg = handleApiError(err);
      if (msg) setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <main style={{ padding: 16 }}>loading...</main>;
  if (!profile)
    return (
      <main style={{ padding: 16 }}>
        <p style={{ color: "#b91c1c" }}>error: ユーザー情報を取得できませんでした</p>
      </main>
    );

  return (
    <main style={{ padding: 16, maxWidth: 720 }}>
      <h1>マイページ</h1>

      <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>部署</div>
          <Input value={department} onChange={(e) => setDepartment(e.target.value)} />
        </div>

        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>ユーザー名</div>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>

        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>メール</div>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
        </div>

        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>新しいパスワード</div>
          <Input
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            type="password"
            placeholder="変更する場合のみ入力"
          />
        </div>

        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 12 }}>ロール: {profile.role}</div>
          <div style={{ fontSize: 12 }}>作成日時: {formatDateTime(profile.createdAt)}</div>
        </div>

        <div>
          <Button type="button" onClick={onSave} disabled={saving}>
            {saving ? "更新中..." : "更新する"}
          </Button>
        </div>
      </div>

      {message ? <p style={{ color: "#166534", marginTop: 12 }}>{message}</p> : null}
      {error ? <p style={{ color: "#b91c1c", marginTop: 12 }}>error: {error}</p> : null}
    </main>
  );
}
