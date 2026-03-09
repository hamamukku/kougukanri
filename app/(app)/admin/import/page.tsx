"use client";

import { type ChangeEvent, useRef, useState } from "react";
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
  "warehouseNo is required": "管理番号は必須です",
  "warehouseNo must not contain '-'": "管理番号に「-」は使用できません",
  "warehouseNo conflicts in the same file": "同じ場所名に異なる管理番号が含まれています",
  "placeName conflicts in the same file": "同じ管理番号に異なる場所名が含まれています",
  "placeName conflicts with existing warehouse": "同じ管理番号を持つ別名の場所が既存データにあります",
  "warehouseNo conflicts with existing warehouse": "既存の場所名に別の管理番号が設定されています",
  "toolName is required": "工具名は必須です",
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
    .map((item) => ({ row: item.row, field: toJapaneseFieldLabel(item.field), message: toJapaneseMessage(item.message) }));
}

export default function AdminImportPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sheet, setSheet] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<RowError[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);

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
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    const url = sheet.trim().length > 0 ? `/api/admin/import/excel?sheet=${encodeURIComponent(sheet.trim())}` : "/api/admin/import/excel";

    try {
      const data = await apiFetchJson<ImportResult>(url, {
        method: "POST",
        body: formData,
      });
      setResult(data);
    } catch (e: unknown) {
      if (isHttpError(e) && e.status === 401) {
        clearAuthSession();
        window.location.href = "/login";
        return;
      }
      if (isHttpError(e) && e.status === 403) {
        window.location.href = "/tools";
        return;
      }

      setErr(toJapaneseMessage(getHttpErrorMessage(e)));
      setRowErrors(extractRowErrors(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main>
      <h1>ファイル取込</h1>

      <section className="card-surface" style={{ marginTop: 12, padding: 12, display: "grid", gap: 10, maxWidth: 720 }}>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>CSV / Excel ファイル（.csv, .xlsx）</div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={onFileChange}
            style={{ display: "none" }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Button type="button" variant="ghost" onClick={openFilePicker} disabled={submitting}>
              ファイルを選択
            </Button>
            <span style={{ fontSize: 13, color: file ? "inherit" : "#64748b" }}>{file ? file.name : "ファイル未選択"}</span>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>シート名（任意）</div>
          <Input value={sheet} onChange={(e) => setSheet(e.target.value)} placeholder="未入力の場合は先頭シートを使用します" />
        </div>

        <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6 }}>
          <div>・ヘッダーは 場所名 / 住所 / 管理番号 / 工具名</div>
          <div>・工具IDは自動採番です</div>
          <div>・管理番号にハイフンは使用不可です</div>
          <div>・XLSX の場合のみシート名指定可</div>
        </div>

        <div>
          <Button type="button" onClick={onSubmit} disabled={!file || submitting}>
            {submitting ? "取込中..." : "取込実行"}
          </Button>
        </div>
      </section>

      {result ? (
        <section className="card-surface" style={{ marginTop: 12, padding: 12, maxWidth: 720 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>取込結果</h2>
          <div style={{ marginTop: 8 }}>場所作成: {result.warehousesCreated}件</div>
          <div>場所更新: {result.warehousesUpdated}件</div>
          <div>工具作成: {result.toolsCreated}件</div>
        </section>
      ) : null}

      {err ? (
        <section className="card-surface" style={{ marginTop: 12, padding: 12, maxWidth: 720 }}>
          <p style={{ color: "var(--danger)", margin: 0 }}>エラー: {err}</p>
          {rowErrors.length > 0 ? (
            <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 18 }}>
              {rowErrors.map((item, idx) => (
                <li key={`${item.row}-${item.field}-${idx}`}>
                  {item.row}行目 / {item.field}: {item.message}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
