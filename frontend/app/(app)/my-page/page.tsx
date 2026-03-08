// frontend/app/(app)/my-page/page.tsx
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

type Department = {
  id: string;
  name: string;
};

function formatDateTime(value: string | undefined): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("ja-JP");
}

export default function MyPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
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
      const [data, departmentItems] = await Promise.all([
        apiFetchJson<Profile>("/api/my/profile"),
        apiFetchJson<Department[]>("/api/departments"),
      ]);
      setProfile(data);
      setDepartment(data.department);
      setUsername(data.username);
      setEmail(data.email);
      setDepartments(departmentItems);
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

  // ✅ 見た目統一：中央寄せ・大型化
  const labelStyle: React.CSSProperties = {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 6,
    textAlign: "center",
    lineHeight: 1.2,
  };

  const selectStyle: React.CSSProperties = {
    height: 48,
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    padding: "0 12px",
    width: "100%",
    fontSize: 16,
    lineHeight: "48px",
  };

  const inputStyle: React.CSSProperties = {
    fontSize: 16,
    padding: "12px 12px",
  };

  const buttonStyle: React.CSSProperties = {
    width: "100%",
    fontSize: 16,
    padding: "12px 12px",
  };

  if (loading) return <main style={{ padding: 16 }}>loading...</main>;
  if (!profile)
    return (
      <main style={{ padding: 16 }}>
        <p style={{ color: "#b91c1c" }}>error: ユーザー情報を取得できませんでした</p>
      </main>
    );

  return (
    <main
      style={{
        minHeight: "calc(100vh - 80px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 720 }}>
        <h1 style={{ fontSize: 30, margin: "0 0 18px", textAlign: "center" }}>マイページ</h1>

        <div className="card-surface" style={{ padding: 16 }}>
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <div style={labelStyle}>部署</div>
              <select value={department} onChange={(e) => setDepartment(e.target.value)} style={selectStyle}>
                {departments.map((item) => (
                  <option key={item.id} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={labelStyle}>ユーザー名</div>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} style={inputStyle} />
            </div>

            <div>
              <div style={labelStyle}>メール</div>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" style={inputStyle} />
            </div>

            <div>
              <div style={labelStyle}>新しいパスワード</div>
              <Input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                type="password"
                placeholder="変更する場合のみ入力"
                style={inputStyle}
              />
            </div>

            <div
              style={{
                display: "grid",
                gap: 6,
                justifyItems: "center",
                textAlign: "center",
                marginTop: 6,
              }}
            >
              <div style={{ fontSize: 14 }}>種別: {profile.role}</div>
              <div style={{ fontSize: 14 }}>作成日時: {formatDateTime(profile.createdAt)}</div>
            </div>

            <div>
              <Button type="button" onClick={onSave} disabled={saving} style={buttonStyle}>
                {saving ? "更新中..." : "更新する"}
              </Button>
            </div>

            {message ? <p style={{ color: "#166534", margin: 0, textAlign: "center" }}>{message}</p> : null}
            {error ? <p style={{ color: "#b91c1c", margin: 0, textAlign: "center" }}>error: {error}</p> : null}
          </div>
        </div>
      </div>
    </main>
  );
}
