package api

import (
	"bytes"
	"strings"
	"testing"

	"github.com/xuri/excelize/v2"
)

func TestParseImportRowsCSVHeadersSuccess(t *testing.T) {
	rawRows, err := readImportCSVRows(strings.NewReader("場所名,住所,管理番号,工具名\n第1工場,東京都千代田区,A100,ドリル\n"))
	if err != nil {
		t.Fatalf("readImportCSVRows error = %v", err)
	}

	rows, missingHeaders := parseImportRows(rawRows)
	if len(missingHeaders) > 0 {
		t.Fatalf("missingHeaders = %v, want empty", missingHeaders)
	}
	if len(rows) != 1 {
		t.Fatalf("len(rows) = %d, want 1", len(rows))
	}

	row := rows[0]
	if row.Row != 2 || row.PlaceName != "第1工場" || row.Address != "東京都千代田区" || row.WarehouseNo != "A100" || row.ToolName != "ドリル" {
		t.Fatalf("row = %+v", row)
	}
}

func TestParseImportRowsXLSXHeadersSuccess(t *testing.T) {
	workbook := excelize.NewFile()
	sheetName := workbook.GetSheetName(workbook.GetActiveSheetIndex())
	if err := workbook.SetSheetRow(sheetName, "A1", &[]string{"場所名", "住所", "管理番号", "工具名"}); err != nil {
		t.Fatalf("SetSheetRow header error = %v", err)
	}
	if err := workbook.SetSheetRow(sheetName, "A2", &[]string{"第2工場", "東京都港区", "B200", "レンチ"}); err != nil {
		t.Fatalf("SetSheetRow body error = %v", err)
	}

	var buf bytes.Buffer
	if err := workbook.Write(&buf); err != nil {
		t.Fatalf("workbook.Write error = %v", err)
	}

	rawRows, err := readImportXLSXRows(bytes.NewReader(buf.Bytes()), "")
	if err != nil {
		t.Fatalf("readImportXLSXRows error = %v", err)
	}

	rows, missingHeaders := parseImportRows(rawRows)
	if len(missingHeaders) > 0 {
		t.Fatalf("missingHeaders = %v, want empty", missingHeaders)
	}
	if len(rows) != 1 {
		t.Fatalf("len(rows) = %d, want 1", len(rows))
	}

	row := rows[0]
	if row.Row != 2 || row.PlaceName != "第2工場" || row.Address != "東京都港区" || row.WarehouseNo != "B200" || row.ToolName != "レンチ" {
		t.Fatalf("row = %+v", row)
	}
}
