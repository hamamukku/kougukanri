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
  warehouseName: "倉庫名",
  warehouseNo: "倉庫番号",
  toolName: "工具名",
};

const ERROR_MESSAGE_LABELS: Record<string, string> = {
  "invalid import payload": "インポート内容に不備があります",
  "excel file is required": "Excelファイルが必要です",
  "sheet not found": "指定したシートが見つかりません",
  "warehouse name is required": "倉庫名は必須です",
  "tool name is required": "工具名は必須です",
  "warehouse number conflicts with existing data": "既存の倉庫番号と一致しません",
  "warehouse_no conflicts with existing value": "既存の倉庫番号と一致しません",
  "warehouseNo is required": "倉庫番号は必須です",
  "warehouseNo must not contain '-'": "倉庫番号に「-」は使用できません",
  "warehouseNo conflicts in the same file": "倉庫番号の割当がファイル内で衝突しています",
  "warehouseNo conflicts with existing warehouse": "倉庫番号が既存データと衝突しています",
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
        router.push("/login");
        return;
      }
      if (isHttpError(e) && e.status === 403) {
        router.push("/tools");
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
      <h1>Excel取込</h1>

      <section className="card-surface" style={{ marginTop: 12, padding: 12, display: "grid", gap: 10, maxWidth: 720 }}>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>Excelファイル（.xlsx）</div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={onFileChange}
            style={{ display: "none" }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Button type="button" variant="ghost" onClick={openFilePicker} disabled={submitting}>
              ファイルを選択
            </Button>
            <span style={{ fontSize: 13, color: file ? "inherit" : "#64748b" }}>
              {file ? file.name : "ファイル未選択"}
            </span>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>シート名（任意）</div>
          <Input value={sheet} onChange={(e) => setSheet(e.target.value)} placeholder="未入力の場合は先頭シートを使用します" />
        </div>

        <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6 }}>
          <div>・倉庫番号は必須です</div>
          <div>・工具IDは 倉庫番号-001 形式で自動採番されます</div>
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
          <div style={{ marginTop: 8 }}>倉庫作成: {result.warehousesCreated}件</div>
          <div>倉庫番号更新: {result.warehousesUpdated}件</div>
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
