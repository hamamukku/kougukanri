// frontend/app/(app)/admin/import/page.tsx
"use client";

import { type ChangeEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "../../../../src/components/ui/Button";
import Input from "../../../../src/components/ui/Input";
import { apiFetchJson, getHttpErrorMessage, isHttpError } from "../../../../src/utils/http";
import { clearAuthSession } from "../../../../src/utils/auth";

type ImportResult = {
  warehousesCreated: number;
  warehousesUpdated: number;
  toolsCreated: number;
};

type RowError = {
  row: number;
  field: string;
  message: string;
};

const FIELD_LABELS: Record<string, string> = {
  toolName: "工具名",
  assetNo: "工具ID",
  place: "場所",
  status: "状態",
  warehouseName: "場所",
  baseStatus: "状態",
  warehouseNo: "管理番号",
};

const ERROR_MESSAGE_LABELS: Record<string, string> = {
  "invalid import payload": "インポート内容に不備があります",
  "required headers are missing": "必須列が不足しています",
  "excel file is required": "Excelファイルが必要です",
  "sheet not found": "指定したシートが見つかりません",
  "place is required": "場所は必須です",
  "status is required": "状態は必須です",
  "status is invalid": "状態は 貸出可 / 貸出中 / 予約中 / 故障 / 修理中 を指定してください",
  "warehouseName is required": "場所は必須です",
  "warehouse name is required": "場所は必須です",
  "assetNo is required": "工具IDは必須です",
  "assetNo duplicates in the same file": "工具IDがファイル内で重複しています",
  "assetNo already exists": "工具IDが既存データと重複しています",
  "tool name is required": "工具名は必須です",
  "warehouse number conflicts with existing data": "既存の管理番号と一致しません",
  "warehouse_no conflicts with existing value": "既存の管理番号と一致しません",
  "warehouseNo is required": "管理番号は必須です",
  "warehouseNo must not contain '-'": "管理番号に「-」は使用できません",
  "warehouseNo conflicts in the same file": "管理番号の割当がファイル内で衝突しています",
  "warehouseNo conflicts with existing warehouse": "管理番号が既存データと衝突しています",
  "internal server error": "サーバーエラーが発生しました",
};

function toJapaneseFieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

function toJapaneseMessage(message: string): string {
  return ERROR_MESSAGE_LABELS[message] ?? message;
}

function extractRowErrors(error: unknown): RowError[] {
  if (!isHttpError(error) || !error.body || typeof error.body !== "object") {
    return [];
  }

  const body = error.body as {
    error?: {
      details?: {
        rowErrors?: Array<{ row?: number; field?: string; message?: string }>;
      };
    };
  };

  const rowErrors = body.error?.details?.rowErrors;
  if (!Array.isArray(rowErrors)) {
    return [];
  }

  return rowErrors
    .filter((item): item is { row: number; field: string; message: string } => {
      return !!item && typeof item.row === "number" && typeof item.field === "string" && typeof item.message === "string";
    })
    .map((item) => ({
      row: item.row,
      field: toJapaneseFieldLabel(item.field),
      message: toJapaneseMessage(item.message),
    }));
}

function extractMissingHeaders(error: unknown): string[] {
  if (!isHttpError(error) || !error.body || typeof error.body !== "object") {
    return [];
  }

  const body = error.body as {
    error?: {
      details?: {
        headers?: unknown;
      };
    };
  };
  const headers = body.error?.details?.headers;
  if (!Array.isArray(headers)) {
    return [];
  }

  return headers.filter((item): item is string => typeof item === "string").map((item) => toJapaneseFieldLabel(item));
}

export default function AdminImportPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sheet, setSheet] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<RowError[]>([]);
  const [missingHeaders, setMissingHeaders] = useState<string[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const router = useRouter();

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const nextFile = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    setFile(nextFile);
  };

  const onSubmit = async () => {
    if (!file || submitting) return;

    setSubmitting(true);
    setErr(null);
    setRowErrors([]);
    setMissingHeaders([]);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    const url =
      sheet.trim().length > 0 ? `/api/admin/import/excel?sheet=${encodeURIComponent(sheet.trim())}` : "/api/admin/import/excel";

    try {
      const data = await apiFetchJson<ImportResult>(url, {
        method: "POST",
        body: formData,
      });
      setResult(data);
    } catch (e: unknown) {
      if (isHttpError(e) && e.status === 401) {
        clearAuthSession();
        router.push("/login");
        return;
      }
      if (isHttpError(e) && e.status === 403) {
        router.push("/tools");
        return;
      }

      setErr(toJapaneseMessage(getHttpErrorMessage(e)));
      setRowErrors(extractRowErrors(e));
      setMissingHeaders(extractMissingHeaders(e));
    } finally {
      setSubmitting(false);
    }
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 6,
    textAlign: "center",
    lineHeight: 1.2,
  };

  const inputStyle: React.CSSProperties = {
    fontSize: 16,
    padding: "12px 12px",
  };

  const noteStyle: React.CSSProperties = {
    fontSize: 16,
    fontWeight: 600,
    color: "#475569",
    lineHeight: 1.8,
    textAlign: "center",
  };

  // ✅ 取込実行ボタン：黒
  const buttonStyle: React.CSSProperties = {
    minWidth: 160,
    height: 52,
    fontSize: 18,
    fontWeight: 800,
    padding: "0 20px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    background: "#0f172a",
    color: "#ffffff",
    border: "1px solid #0f172a",
  };

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
      <div style={{ width: "100%", maxWidth: 760 }}>
        <h1 style={{ fontSize: 30, margin: "0 0 18px", textAlign: "center" }}>Excel取込</h1>

        <section className="card-surface" style={{ padding: 16, display: "grid", gap: 14 }}>
          <div>
            <div style={labelStyle}>Excelファイル（.xlsx）</div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={onFileChange}
              style={{ display: "none" }}
            />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
              <Button type="button" variant="ghost" onClick={openFilePicker} disabled={submitting} style={{ minWidth: 160, height: 52 }}>
                ファイルを選択
              </Button>
              <span style={{ fontSize: 14, color: file ? "inherit" : "#64748b" }}>{file ? file.name : "ファイル未選択"}</span>
            </div>
          </div>

          <div>
            <div style={labelStyle}>シート名（任意）</div>
            <Input
              value={sheet}
              onChange={(e) => setSheet(e.target.value)}
              placeholder="未入力の場合は先頭シートを使用します"
              style={inputStyle}
            />
          </div>

          <div style={noteStyle}>
            <div style={{ marginBottom: 4 }}>・ヘッダー行を使う場合は「工具名 / 工具ID / 場所 / 状態」で作成してください</div>
            <div style={{ marginBottom: 4 }}>・4列すべて必須です</div>
            <div>・状態は 貸出可 / 貸出中 / 予約中 / 故障 / 修理中 に対応します</div>
          </div>

          <div style={{ display: "flex", justifyContent: "center" }}>
            <Button type="button" onClick={onSubmit} disabled={!file || submitting} style={buttonStyle}>
              {submitting ? "取込中..." : "取込実行"}
            </Button>
          </div>
        </section>

        {result ? (
          <section className="card-surface" style={{ marginTop: 12, padding: 16, textAlign: "center" }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>取込結果</h2>
            <div style={{ marginTop: 10, fontSize: 16 }}>場所作成: {result.warehousesCreated}件</div>
            <div style={{ fontSize: 16 }}>場所更新: {result.warehousesUpdated}件</div>
            <div style={{ fontSize: 16 }}>工具作成: {result.toolsCreated}件</div>
          </section>
        ) : null}

        {err ? (
          <section className="card-surface" style={{ marginTop: 12, padding: 16 }}>
            <p style={{ color: "var(--danger)", margin: 0, fontSize: 16, textAlign: "center" }}>エラー: {err}</p>
            {missingHeaders.length > 0 ? (
              <p style={{ marginTop: 10, marginBottom: 0, fontSize: 15, textAlign: "center" }}>
                不足列: {missingHeaders.join(" / ")}
              </p>
            ) : null}
            {rowErrors.length > 0 ? (
              <ul style={{ marginTop: 10, marginBottom: 0, paddingLeft: 18, fontSize: 15 }}>
                {rowErrors.map((item, idx) => (
                  <li key={`${item.row}-${item.field}-${idx}`}>
                    {item.row}行目 / {item.field}: {item.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}
