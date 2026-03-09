package app

import (
	"context"
	"database/sql"
	stdErrors "errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"

	db "kougukanri/backend/internal/db"
	apierr "kougukanri/backend/internal/errors"
)

type fakeImportStore struct {
	warehouses     map[uuid.UUID]db.Warehouse
	warehouseOrder []uuid.UUID
	tools          []db.Tool
}

func newFakeImportStore(existingWarehouses []db.Warehouse, existingTools []db.Tool) *fakeImportStore {
	store := &fakeImportStore{
		warehouses:     make(map[uuid.UUID]db.Warehouse, len(existingWarehouses)),
		warehouseOrder: make([]uuid.UUID, 0, len(existingWarehouses)),
		tools:          append([]db.Tool(nil), existingTools...),
	}
	for _, warehouse := range existingWarehouses {
		store.warehouses[warehouse.ID] = warehouse
		store.warehouseOrder = append(store.warehouseOrder, warehouse.ID)
	}
	return store
}

func (s *fakeImportStore) ListWarehousesForUpdate(context.Context) ([]db.Warehouse, error) {
	items := make([]db.Warehouse, 0, len(s.warehouseOrder))
	for _, warehouseID := range s.warehouseOrder {
		items = append(items, s.warehouses[warehouseID])
	}
	return items, nil
}

func (s *fakeImportStore) CreateWarehouse(_ context.Context, name string, address, warehouseNo sql.NullString) (db.Warehouse, error) {
	now := time.Now()
	item := db.Warehouse{
		ID:          uuid.New(),
		Name:        name,
		Address:     address,
		WarehouseNo: warehouseNo,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	s.warehouses[item.ID] = item
	s.warehouseOrder = append(s.warehouseOrder, item.ID)
	return item, nil
}

func (s *fakeImportStore) UpdateWarehouse(_ context.Context, arg db.UpdateWarehouseParams) (db.Warehouse, error) {
	item, ok := s.warehouses[arg.ID]
	if !ok {
		return db.Warehouse{}, sql.ErrNoRows
	}
	item.Name = arg.Name
	item.Address = arg.Address
	item.WarehouseNo = arg.WarehouseNo
	item.UpdatedAt = time.Now()
	s.warehouses[arg.ID] = item
	return item, nil
}

func (s *fakeImportStore) GetWarehouseByIDForUpdate(_ context.Context, id uuid.UUID) (db.Warehouse, error) {
	item, ok := s.warehouses[id]
	if !ok {
		return db.Warehouse{}, sql.ErrNoRows
	}
	return item, nil
}

func (s *fakeImportStore) ListActiveToolAssetNosByWarehouse(_ context.Context, warehouseID uuid.UUID) ([]string, error) {
	items := make([]string, 0)
	for _, tool := range s.tools {
		if tool.WarehouseID == warehouseID && !tool.RetiredAt.Valid {
			items = append(items, tool.AssetNo)
		}
	}
	return items, nil
}

func (s *fakeImportStore) CreateTool(_ context.Context, arg db.CreateToolParams) (db.Tool, error) {
	for _, tool := range s.tools {
		if !tool.RetiredAt.Valid && tool.AssetNo == arg.AssetNo {
			return db.Tool{}, &pq.Error{Code: "23505", Constraint: "tools_asset_no_key"}
		}
	}

	now := time.Now()
	item := db.Tool{
		ID:          uuid.New(),
		AssetNo:     arg.AssetNo,
		TagID:       arg.TagID,
		Name:        arg.Name,
		WarehouseID: arg.WarehouseID,
		BaseStatus:  arg.BaseStatus,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	s.tools = append(s.tools, item)
	return item, nil
}

func requireAPIError(t *testing.T, err error) *apierr.APIError {
	t.Helper()
	var apiError *apierr.APIError
	if !stdErrors.As(err, &apiError) {
		t.Fatalf("err = %v, want APIError", err)
	}
	return apiError
}

func requireRowErrors(t *testing.T, err error) []ImportExcelRowError {
	t.Helper()
	apiError := requireAPIError(t, err)
	details, ok := apiError.Details.(map[string]any)
	if !ok {
		t.Fatalf("details type = %T, want map[string]any", apiError.Details)
	}
	rowErrors, ok := details["rowErrors"].([]ImportExcelRowError)
	if !ok {
		t.Fatalf("rowErrors type = %T, want []ImportExcelRowError", details["rowErrors"])
	}
	return rowErrors
}

func TestRunImportWarehousesTools_SamePlaceDifferentWarehouseNoFails(t *testing.T) {
	store := newFakeImportStore(nil, nil)

	_, err := runImportWarehousesTools(context.Background(), store, []ImportExcelRow{
		{Row: 2, PlaceName: "第1工場", WarehouseNo: "100", ToolName: "ドリル"},
		{Row: 3, PlaceName: "第1工場", WarehouseNo: "200", ToolName: "レンチ"},
	})
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	rowErrors := requireRowErrors(t, err)
	if len(rowErrors) != 1 {
		t.Fatalf("len(rowErrors) = %d, want 1", len(rowErrors))
	}
	if rowErrors[0].Row != 3 || rowErrors[0].Field != "warehouseNo" || rowErrors[0].Message != "warehouseNo conflicts in the same file" {
		t.Fatalf("rowErrors[0] = %+v", rowErrors[0])
	}
}

func TestRunImportWarehousesTools_SameWarehouseNoDifferentPlaceFails(t *testing.T) {
	store := newFakeImportStore(nil, nil)

	_, err := runImportWarehousesTools(context.Background(), store, []ImportExcelRow{
		{Row: 2, PlaceName: "第1工場", WarehouseNo: "100", ToolName: "ドリル"},
		{Row: 3, PlaceName: "第2工場", WarehouseNo: "100", ToolName: "レンチ"},
	})
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	rowErrors := requireRowErrors(t, err)
	if len(rowErrors) != 1 {
		t.Fatalf("len(rowErrors) = %d, want 1", len(rowErrors))
	}
	if rowErrors[0].Row != 3 || rowErrors[0].Field != "placeName" || rowErrors[0].Message != "placeName conflicts in the same file" {
		t.Fatalf("rowErrors[0] = %+v", rowErrors[0])
	}
}

func TestRunImportWarehousesTools_FillsWarehouseNoAndGeneratesAssetNos(t *testing.T) {
	existingWarehouseID := uuid.New()
	store := newFakeImportStore([]db.Warehouse{
		{
			ID:          existingWarehouseID,
			Name:        "第1工場",
			Address:     sql.NullString{String: "旧住所", Valid: true},
			WarehouseNo: sql.NullString{},
		},
	}, nil)

	result, err := runImportWarehousesTools(context.Background(), store, []ImportExcelRow{
		{Row: 2, PlaceName: "第1工場", Address: "新住所", WarehouseNo: "100", ToolName: "ドリル"},
		{Row: 3, PlaceName: "第1工場", Address: "", WarehouseNo: "100", ToolName: "レンチ"},
	})
	if err != nil {
		t.Fatalf("runImportWarehousesTools error = %v", err)
	}

	if result.Result.WarehousesCreated != 0 || result.Result.WarehousesUpdated != 1 || result.Result.ToolsCreated != 2 {
		t.Fatalf("result = %+v", result.Result)
	}

	updatedWarehouse := store.warehouses[existingWarehouseID]
	if !updatedWarehouse.WarehouseNo.Valid || updatedWarehouse.WarehouseNo.String != "00100" {
		t.Fatalf("updated warehouseNo = %+v, want 00100", updatedWarehouse.WarehouseNo)
	}
	if !updatedWarehouse.Address.Valid || updatedWarehouse.Address.String != "新住所" {
		t.Fatalf("updated address = %+v, want 新住所", updatedWarehouse.Address)
	}

	if len(store.tools) != 2 {
		t.Fatalf("len(store.tools) = %d, want 2", len(store.tools))
	}
	if store.tools[0].AssetNo != "00100-001" || store.tools[1].AssetNo != "00100-002" {
		t.Fatalf("assetNos = %q, %q; want 00100-001, 00100-002", store.tools[0].AssetNo, store.tools[1].AssetNo)
	}
	if store.tools[0].BaseStatus != BaseStatusAvailable || store.tools[1].BaseStatus != BaseStatusAvailable {
		t.Fatalf("baseStatuses = %q, %q; want AVAILABLE", store.tools[0].BaseStatus, store.tools[1].BaseStatus)
	}
}

func TestRunImportWarehousesTools_WarehouseNoNonNumericFails(t *testing.T) {
	store := newFakeImportStore(nil, nil)

	_, err := runImportWarehousesTools(context.Background(), store, []ImportExcelRow{
		{Row: 2, PlaceName: "第1工場", WarehouseNo: "A100", ToolName: "ドリル"},
	})
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	rowErrors := requireRowErrors(t, err)
	if len(rowErrors) != 1 {
		t.Fatalf("len(rowErrors) = %d, want 1", len(rowErrors))
	}
	if rowErrors[0].Row != 2 || rowErrors[0].Field != "warehouseNo" || rowErrors[0].Message != "warehouseNo must contain only digits" {
		t.Fatalf("rowErrors[0] = %+v", rowErrors[0])
	}
}
