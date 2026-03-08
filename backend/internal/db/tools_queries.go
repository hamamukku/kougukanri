package db

import (
	"context"
	"database/sql"

	"github.com/google/uuid"
)

type CreateToolParams struct {
	AssetNo     string
	TagID       sql.NullString
	Name        string
	WarehouseID uuid.UUID
	BaseStatus  string
}

const createToolQuery = `
INSERT INTO tools (
    asset_no,
    tag_id,
    name,
    warehouse_id,
    base_status,
    created_at,
    updated_at
) VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    NOW(),
    NOW()
)
RETURNING id, asset_no, tag_id, name, warehouse_id, base_status, retired_at, created_at, updated_at
`

func (q *Queries) CreateTool(ctx context.Context, arg CreateToolParams) (Tool, error) {
	row := q.db.QueryRowContext(ctx, createToolQuery,
		arg.AssetNo,
		arg.TagID,
		arg.Name,
		arg.WarehouseID,
		arg.BaseStatus,
	)
	var i Tool
	err := row.Scan(
		&i.ID,
		&i.AssetNo,
		&i.TagID,
		&i.Name,
		&i.WarehouseID,
		&i.BaseStatus,
		&i.RetiredAt,
		&i.CreatedAt,
		&i.UpdatedAt,
	)
	return i, err
}

const listActiveToolAssetNosByWarehouseQuery = `
SELECT asset_no
FROM tools
WHERE warehouse_id = $1
  AND retired_at IS NULL
ORDER BY asset_no ASC
`

func (q *Queries) ListActiveToolAssetNosByWarehouse(ctx context.Context, warehouseID uuid.UUID) ([]string, error) {
	rows, err := q.db.QueryContext(ctx, listActiveToolAssetNosByWarehouseQuery, warehouseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]string, 0)
	for rows.Next() {
		var assetNo string
		if err := rows.Scan(&assetNo); err != nil {
			return nil, err
		}
		items = append(items, assetNo)
	}
	return items, rows.Err()
}

const getToolByIDQuery = `
SELECT id, asset_no, tag_id, name, warehouse_id, base_status, retired_at, created_at, updated_at
FROM tools
WHERE id = $1
`

func (q *Queries) GetToolByID(ctx context.Context, id uuid.UUID) (Tool, error) {
	row := q.db.QueryRowContext(ctx, getToolByIDQuery, id)
	var i Tool
	err := row.Scan(
		&i.ID,
		&i.AssetNo,
		&i.TagID,
		&i.Name,
		&i.WarehouseID,
		&i.BaseStatus,
		&i.RetiredAt,
		&i.CreatedAt,
		&i.UpdatedAt,
	)
	return i, err
}

const getToolForUpdateQuery = `
SELECT id, asset_no, tag_id, name, warehouse_id, base_status, retired_at, created_at, updated_at
FROM tools
WHERE id = $1
FOR UPDATE
`

func (q *Queries) GetToolForUpdate(ctx context.Context, id uuid.UUID) (Tool, error) {
	row := q.db.QueryRowContext(ctx, getToolForUpdateQuery, id)
	var i Tool
	err := row.Scan(
		&i.ID,
		&i.AssetNo,
		&i.TagID,
		&i.Name,
		&i.WarehouseID,
		&i.BaseStatus,
		&i.RetiredAt,
		&i.CreatedAt,
		&i.UpdatedAt,
	)
	return i, err
}

type UpdateToolParams struct {
	ID          uuid.UUID
	AssetNo     string
	Name        string
	WarehouseID uuid.UUID
	BaseStatus  string
}

const updateToolQuery = `
UPDATE tools
SET asset_no = $2,
    name = $3,
    warehouse_id = $4,
    base_status = $5,
    updated_at = NOW()
WHERE id = $1
RETURNING id, asset_no, tag_id, name, warehouse_id, base_status, retired_at, created_at, updated_at
`

func (q *Queries) UpdateTool(ctx context.Context, arg UpdateToolParams) (Tool, error) {
	row := q.db.QueryRowContext(ctx, updateToolQuery,
		arg.ID,
		arg.AssetNo,
		arg.Name,
		arg.WarehouseID,
		arg.BaseStatus,
	)
	var i Tool
	err := row.Scan(
		&i.ID,
		&i.AssetNo,
		&i.TagID,
		&i.Name,
		&i.WarehouseID,
		&i.BaseStatus,
		&i.RetiredAt,
		&i.CreatedAt,
		&i.UpdatedAt,
	)
	return i, err
}

type UpdateToolTagParams struct {
	ID    uuid.UUID
	TagID sql.NullString
}

const updateToolTagQuery = `
UPDATE tools
SET tag_id = $2,
    updated_at = NOW()
WHERE id = $1
RETURNING id, asset_no, tag_id, name, warehouse_id, base_status, retired_at, created_at, updated_at
`

func (q *Queries) UpdateToolTag(ctx context.Context, arg UpdateToolTagParams) (Tool, error) {
	row := q.db.QueryRowContext(ctx, updateToolTagQuery,
		arg.ID,
		arg.TagID,
	)
	var i Tool
	err := row.Scan(
		&i.ID,
		&i.AssetNo,
		&i.TagID,
		&i.Name,
		&i.WarehouseID,
		&i.BaseStatus,
		&i.RetiredAt,
		&i.CreatedAt,
		&i.UpdatedAt,
	)
	return i, err
}

const getToolByTagQuery = `
SELECT id, asset_no, tag_id, name, warehouse_id, base_status, retired_at, created_at, updated_at
FROM tools
WHERE tag_id = $1
  AND retired_at IS NULL
`

func (q *Queries) GetToolByTag(ctx context.Context, tagID string) (Tool, error) {
	row := q.db.QueryRowContext(ctx, getToolByTagQuery, tagID)
	var i Tool
	err := row.Scan(
		&i.ID,
		&i.AssetNo,
		&i.TagID,
		&i.Name,
		&i.WarehouseID,
		&i.BaseStatus,
		&i.RetiredAt,
		&i.CreatedAt,
		&i.UpdatedAt,
	)
	return i, err
}

const retireToolQuery = `
UPDATE tools
SET retired_at = NOW(),
    updated_at = NOW()
WHERE id = $1
RETURNING id, asset_no, tag_id, name, warehouse_id, base_status, retired_at, created_at, updated_at
`

func (q *Queries) RetireTool(ctx context.Context, id uuid.UUID) (Tool, error) {
	row := q.db.QueryRowContext(ctx, retireToolQuery, id)
	var i Tool
	err := row.Scan(
		&i.ID,
		&i.AssetNo,
		&i.TagID,
		&i.Name,
		&i.WarehouseID,
		&i.BaseStatus,
		&i.RetiredAt,
		&i.CreatedAt,
		&i.UpdatedAt,
	)
	return i, err
}

const countLoanItemsByToolQuery = `
SELECT COUNT(*)::bigint AS count
FROM loan_items
WHERE tool_id = $1
`

func (q *Queries) CountLoanItemsByTool(ctx context.Context, toolID uuid.UUID) (int64, error) {
	row := q.db.QueryRowContext(ctx, countLoanItemsByToolQuery, toolID)
	var count int64
	err := row.Scan(&count)
	return count, err
}

const deleteToolByIDQuery = `
DELETE FROM tools
WHERE id = $1
`

func (q *Queries) DeleteToolByID(ctx context.Context, id uuid.UUID) (int64, error) {
	result, err := q.db.ExecContext(ctx, deleteToolByIDQuery, id)
	if err != nil {
		return 0, err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return 0, err
	}
	return affected, nil
}

type CountToolsWithDisplayParams struct {
	Today       string
	WarehouseID string
	Q           string
	Mode        string
	Status      string
}

const countToolsWithDisplayQuery = `
WITH tool_state AS (
    SELECT
        t.id,
        t.asset_no,
        t.name,
        t.warehouse_id,
        w.name AS warehouse_name,
        t.base_status,
        EXISTS (
            SELECT 1
            FROM loan_items li_history
            WHERE li_history.tool_id = t.id
        ) AS has_loan_history,
        loan.start_date AS loan_start_date,
        loan.due_date AS loan_due_date,
        reserve.start_date AS reserved_start_date,
        reserve.due_date AS reserved_due_date,
        reserve.borrower_id AS reserved_by
    FROM tools t
    JOIN warehouses w ON w.id = t.warehouse_id
    LEFT JOIN LATERAL (
        SELECT li.start_date, li.due_date, li.borrower_id
        FROM loan_items li
        WHERE li.tool_id = t.id
          AND li.return_approved_at IS NULL
          AND li.start_date <= $1::date
        ORDER BY li.start_date DESC
        LIMIT 1
    ) AS loan ON TRUE
    LEFT JOIN LATERAL (
        SELECT li.start_date, li.due_date, li.borrower_id
        FROM loan_items li
        WHERE li.tool_id = t.id
          AND li.return_approved_at IS NULL
          AND li.start_date > $1::date
        ORDER BY li.start_date ASC
        LIMIT 1
    ) AS reserve ON TRUE
    WHERE
        t.retired_at IS NULL
        AND (NULLIF($2::text, '') IS NULL OR t.warehouse_id = NULLIF($2::text, '')::uuid)
        AND (
            $3::text = ''
            OR (
                CASE
                    WHEN $4::text = 'exact' THEN (t.name = $3::text OR t.asset_no = $3::text)
                    ELSE (t.name ILIKE '%' || $3::text || '%' OR t.asset_no ILIKE '%' || $3::text || '%')
                END
            )
        )
)
SELECT COUNT(*)::bigint AS total
FROM tool_state
WHERE
    (
        $5::text = ''
        OR (
            CASE
                WHEN base_status = 'BROKEN' THEN 'BROKEN'
                WHEN base_status = 'REPAIR' THEN 'REPAIR'
                WHEN loan_start_date IS NOT NULL THEN 'LOANED'
                WHEN reserved_start_date IS NOT NULL THEN 'RESERVED'
                ELSE 'AVAILABLE'
            END = $5::text
        )
    )
`

func (q *Queries) CountToolsWithDisplay(ctx context.Context, arg CountToolsWithDisplayParams) (int64, error) {
	row := q.db.QueryRowContext(ctx, countToolsWithDisplayQuery,
		arg.Today,
		arg.WarehouseID,
		arg.Q,
		arg.Mode,
		arg.Status,
	)
	var total int64
	err := row.Scan(&total)
	return total, err
}

type ListToolsWithDisplayParams struct {
	Today       string
	WarehouseID string
	Q           string
	Mode        string
	RequesterID uuid.UUID
	Status      string
	Limit       int32
	Offset      int32
}

const listToolsWithDisplayQuery = `
WITH tool_state AS (
    SELECT
        t.id,
        t.asset_no,
        t.name,
        t.warehouse_id,
        w.name AS warehouse_name,
        t.base_status,
        EXISTS (
            SELECT 1
            FROM loan_items li_history
            WHERE li_history.tool_id = t.id
        ) AS has_loan_history,
        loan.start_date AS loan_start_date,
        loan.due_date AS loan_due_date,
        reserve.start_date AS reserved_start_date,
        reserve.due_date AS reserved_due_date,
        reserve.borrower_id AS reserved_by
    FROM tools t
    JOIN warehouses w ON w.id = t.warehouse_id
    LEFT JOIN LATERAL (
        SELECT li.start_date, li.due_date, li.borrower_id
        FROM loan_items li
        WHERE li.tool_id = t.id
          AND li.return_approved_at IS NULL
          AND li.start_date <= $1::date
        ORDER BY li.start_date DESC
        LIMIT 1
    ) AS loan ON TRUE
    LEFT JOIN LATERAL (
        SELECT li.start_date, li.due_date, li.borrower_id
        FROM loan_items li
        WHERE li.tool_id = t.id
          AND li.return_approved_at IS NULL
          AND li.start_date > $1::date
        ORDER BY li.start_date ASC
        LIMIT 1
    ) AS reserve ON TRUE
    WHERE
        t.retired_at IS NULL
        AND (NULLIF($2::text, '') IS NULL OR t.warehouse_id = NULLIF($2::text, '')::uuid)
        AND (
            $3::text = ''
            OR (
                CASE
                    WHEN $4::text = 'exact' THEN (t.name = $3::text OR t.asset_no = $3::text)
                    ELSE (t.name ILIKE '%' || $3::text || '%' OR t.asset_no ILIKE '%' || $3::text || '%')
                END
            )
        )
)
SELECT
    id,
    asset_no,
    name,
    warehouse_id,
    warehouse_name,
    base_status,
    has_loan_history,
    CASE
        WHEN base_status = 'BROKEN' THEN 'BROKEN'
        WHEN base_status = 'REPAIR' THEN 'REPAIR'
        WHEN loan_start_date IS NOT NULL THEN 'LOANED'
        WHEN reserved_start_date IS NOT NULL THEN 'RESERVED'
        ELSE 'AVAILABLE'
    END AS display_status,
    CASE
        WHEN loan_start_date IS NOT NULL THEN loan_start_date
        ELSE reserved_start_date
    END AS display_start_date,
    CASE
        WHEN loan_due_date IS NOT NULL THEN loan_due_date
        ELSE reserved_due_date
    END AS display_due_date,
    CASE
        WHEN reserved_start_date IS NOT NULL AND reserved_by <> $5::uuid THEN TRUE
        ELSE FALSE
    END AS is_blocked_by_other_reservation,
    CASE
        WHEN reserved_start_date IS NOT NULL AND reserved_by = $5::uuid THEN TRUE
        ELSE FALSE
    END AS is_reserved_by_me
FROM tool_state
WHERE
    (
        $6::text = ''
        OR (
            CASE
                WHEN base_status = 'BROKEN' THEN 'BROKEN'
                WHEN base_status = 'REPAIR' THEN 'REPAIR'
                WHEN loan_start_date IS NOT NULL THEN 'LOANED'
                WHEN reserved_start_date IS NOT NULL THEN 'RESERVED'
                ELSE 'AVAILABLE'
            END = $6::text
        )
    )
ORDER BY
    CASE
        WHEN asset_no ~ '^.+-[0-9]+$' THEN regexp_replace(asset_no, '-[0-9]+$', '')
        ELSE asset_no
    END ASC,
    CASE
        WHEN asset_no ~ '^[0-9]+$' THEN asset_no::numeric
        WHEN asset_no ~ '^.+-[0-9]+$' THEN substring(asset_no FROM '([0-9]+)$')::numeric
        ELSE NULL
    END NULLS LAST,
    asset_no ASC
LIMIT $7 OFFSET $8
`

func (q *Queries) ListToolsWithDisplay(ctx context.Context, arg ListToolsWithDisplayParams) ([]ToolWithDisplay, error) {
	rows, err := q.db.QueryContext(ctx, listToolsWithDisplayQuery,
		arg.Today,
		arg.WarehouseID,
		arg.Q,
		arg.Mode,
		arg.RequesterID,
		arg.Status,
		arg.Limit,
		arg.Offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]ToolWithDisplay, 0)
	for rows.Next() {
		var i ToolWithDisplay
		if err := rows.Scan(
			&i.ID,
			&i.AssetNo,
			&i.Name,
			&i.WarehouseID,
			&i.WarehouseName,
			&i.BaseStatus,
			&i.HasLoanHistory,
			&i.DisplayStatus,
			&i.DisplayStartDate,
			&i.DisplayDueDate,
			&i.IsBlockedByOtherReservation,
			&i.IsReservedByMe,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}
