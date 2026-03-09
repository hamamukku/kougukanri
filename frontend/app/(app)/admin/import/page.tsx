"use client";

import { type ChangeEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "../../../../src/components/ui/Button";
import Input from "../../../../src/components/ui/Input";
import { clearAuthSession } from "../../../../src/utils/auth";
import { apiFetchJson, getHttpErrorMessage, isHttpError } from "../../../../src/utils/http";

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
  placeName: "場所名",
  place: "場所名",
  warehouseName: "場所名",
  address: "住所",
  warehouseNo: "管理番号",
  toolName: "工具名",
  assetNo: "工具ID",
  status: "状態",
  baseStatus: "状態",
};

const ERROR_MESSAGE_LABELS: Record<string, string> = {
  "invalid import payload": "インポート内容に不備があります",
  "required headers are missing": "必須ヘッダーが不足しています",
  "file is required": "ファイルが必要です",
  "file must be .csv or .xlsx": "CSV / Excel ファイル（.csv, .xlsx）を選択してください",
  "invalid csv file": "CSV を読み取れませんでした",
  "invalid xlsx file": "XLSX を読み取れませんでした",
  "xlsx has no sheets": "XLSX にシートがありません",
  "sheet is invalid": "指定したシートが見つかりません",
  "no import rows found": "取込対象の行がありません",
  "placeName is required": "場所名は必須です",
  "place is required": "場所名は必須です",
  "warehouseName is required": "場所名は必須です",
  "warehouse name is required": "場所名は必須です",
  "address is required": "住所は必須です",
  "warehouseNo is required": "管理番号は必須です",
  "warehouseNo must contain only digits": "管理番号は数字のみで入力してください",
  "warehouseNo conflicts in the same file": "同じ場所名に異なる管理番号が含まれています",
  "placeName conflicts in the same file": "同じ管理番号に異なる場所名が含まれています",
  "placeName conflicts with existing warehouse": "同じ管理番号を持つ別名の場所が既存データにあります",
  "warehouseNo conflicts with existing warehouse": "既存の場所名に別の管理番号が設定されています",
  "warehouse number conflicts with existing data": "既存の場所名に別の管理番号が設定されています",
  "warehouse_no conflicts with existing value": "既存の場所名に別の管理番号が設定されています",
  "toolName is required": "工具名は必須です",
  "tool name is required": "工具名は必須です",
  "assetNo already exists": "工具IDの自動採番で競合が発生しました",
  "warehouseNo is required for assetNo generation": "管理番号が未設定のため工具IDを自動採番できません",
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
        <h1 style={{ fontSize: 30, margin: "0 0 18px", textAlign: "center" }}>ファイル取込</h1>

        <section className="card-surface" style={{ padding: 16, display: "grid", gap: 14 }}>
          <div>
            <div style={labelStyle}>CSV / Excel ファイル（.csv, .xlsx）</div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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
            <Input value={sheet} onChange={(e) => setSheet(e.target.value)} placeholder="未入力の場合は先頭シートを使用します" style={inputStyle} />
          </div>

          <div style={noteStyle}>
            <div style={{ marginBottom: 4 }}>ヘッダーは 場所名 / 住所 / 管理番号 / 工具名</div>
            <div style={{ marginBottom: 4 }}>工具IDは自動採番です</div>
            <div style={{ marginBottom: 4 }}>管理番号にハイフンは使用不可です</div>
            <div>XLSX の場合のみシート名指定可</div>
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
              <p style={{ marginTop: 10, marginBottom: 0, fontSize: 15, textAlign: "center" }}>不足ヘッダー: {missingHeaders.join(" / ")}</p>
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
