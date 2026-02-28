package app

import (
	"context"
	"database/sql"
	"encoding/json"
	stdErrors "errors"
	"fmt"
	"log"
	"sort"
	"strings"
	"time"

	"kougukanri/backend/internal/auth"
	"kougukanri/backend/internal/config"
	"kougukanri/backend/internal/db"
	apierr "kougukanri/backend/internal/errors"
	"kougukanri/backend/internal/mail"
	"kougukanri/backend/internal/notify"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

const (
	RoleAdmin = "admin"
	RoleUser  = "user"

	BaseStatusAvailable = "AVAILABLE"
	BaseStatusBroken    = "BROKEN"
	BaseStatusRepair    = "REPAIR"

	DisplayStatusAvailable = "AVAILABLE"
	DisplayStatusReserved  = "RESERVED"
	DisplayStatusLoaned    = "LOANED"
	DisplayStatusBroken    = "BROKEN"
	DisplayStatusRepair    = "REPAIR"
)

type Service struct {
	db         *sql.DB
	queries    *db.Queries
	jwtManager *auth.JWTManager
	mailer     mail.Mailer
	notifier   notify.Notifier
	cfg        config.Config
	jst        *time.Location
}

func NewService(database *sql.DB, queries *db.Queries, jwtManager *auth.JWTManager, mailer mail.Mailer, notifier notify.Notifier, cfg config.Config) (*Service, error) {
	jst, err := time.LoadLocation("Asia/Tokyo")
	if err != nil {
		return nil, err
	}
	if notifier == nil {
		notifier = notify.NewNotifier(cfg)
	}
	return &Service{
		db:         database,
		queries:    queries,
		jwtManager: jwtManager,
		mailer:     mailer,
		notifier:   notifier,
		cfg:        cfg,
		jst:        jst,
	}, nil
}

func (s *Service) TodayJST() time.Time {
	now := time.Now().In(s.jst)
	v, _ := time.Parse("2006-01-02", now.Format("2006-01-02"))
	return v
}

func (s *Service) ParseDateJST(v string) (time.Time, error) {
	return time.Parse("2006-01-02", v)
}

func (s *Service) DateString(v time.Time) string {
	if v.IsZero() {
		return ""
	}
	return v.In(s.jst).Format("2006-01-02")
}

func (s *Service) auditTx(ctx context.Context, qtx *db.Queries, actorID *uuid.UUID, action, targetType string, targetID uuid.UUID, payload any) error {
	encodedPayload, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	var actor uuid.NullUUID
	if actorID != nil && *actorID != uuid.Nil {
		actor = uuid.NullUUID{UUID: *actorID, Valid: true}
	}

	var target uuid.NullUUID
	if targetID != uuid.Nil {
		target = uuid.NullUUID{UUID: targetID, Valid: true}
	}

	_, err = qtx.CreateAuditLog(ctx, db.CreateAuditLogParams{
		ActorID:    actor,
		Action:     action,
		TargetType: targetType,
		TargetID:   target,
		Payload:    encodedPayload,
	})
	return err
}

func (s *Service) notifyBestEffort(ctx context.Context, kind string, payload any) {
	if s.notifier == nil {
		return
	}
	if err := s.notifier.Notify(ctx, kind, payload); err != nil {
		log.Printf("notify failed: kind=%s err=%v", kind, err)
	}
}

type LoginResult struct {
	Token    string
	Role     string
	UserName string
	UserID   uuid.UUID
}

func (s *Service) Login(ctx context.Context, loginID, password string) (LoginResult, error) {
	loginID = strings.TrimSpace(loginID)
	if loginID == "" || password == "" {
		return LoginResult{}, apierr.InvalidRequest("loginId and password are required", nil)
	}

	user, err := s.queries.GetUserByLoginID(ctx, loginID)
	if err != nil {
		if stdErrors.Is(err, sql.ErrNoRows) {
			return LoginResult{}, apierr.Unauthorized("invalid credentials")
		}
		return LoginResult{}, err
	}
	if !user.IsActive {
		return LoginResult{}, apierr.Unauthorized("user is inactive")
	}
	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)) != nil {
		return LoginResult{}, apierr.Unauthorized("invalid credentials")
	}

	token, err := s.jwtManager.Generate(user.ID, user.Role, user.Username)
	if err != nil {
		return LoginResult{}, err
	}
	return LoginResult{Token: token, Role: user.Role, UserName: user.Username, UserID: user.ID}, nil
}

func (s *Service) GetUser(ctx context.Context, userID uuid.UUID) (db.UserSafe, error) {
	user, err := s.queries.GetUserByID(ctx, userID)
	if err != nil {
		if stdErrors.Is(err, sql.ErrNoRows) {
			return db.UserSafe{}, apierr.Unauthorized("user not found")
		}
		return db.UserSafe{}, err
	}
	if !user.IsActive {
		return db.UserSafe{}, apierr.Unauthorized("user is inactive")
	}
	return user, nil
}

func ValidateRole(role string) bool {
	return role == RoleAdmin || role == RoleUser
}

func ValidateBaseStatus(status string) bool {
	switch status {
	case BaseStatusAvailable, BaseStatusBroken, BaseStatusRepair:
		return true
	default:
		return false
	}
}

func ValidateDisplayStatus(status string) bool {
	switch status {
	case DisplayStatusAvailable, DisplayStatusReserved, DisplayStatusLoaned, DisplayStatusBroken, DisplayStatusRepair:
		return true
	default:
		return false
	}
}

func normalizeMode(mode string) string {
	if strings.EqualFold(mode, "exact") {
		return "exact"
	}
	return "partial"
}

type ToolListFilter struct {
	Q           string
	Mode        string
	WarehouseID string
	Status      string
	Page        int
	PageSize    int
}

type ToolListItem struct {
	ID                          uuid.UUID
	AssetNo                     string
	Name                        string
	WarehouseID                 uuid.UUID
	WarehouseName               string
	BaseStatus                  string
	DisplayStatus               string
	DisplayStartDate            string
	DisplayDueDate              string
	IsBlockedByOtherReservation bool
	IsReservedByMe              bool
}

type ToolListResult struct {
	Items []ToolListItem
	Total int64
}

type AuditLogListFilter struct {
	ActorID    *uuid.UUID
	TargetType string
	TargetID   *uuid.UUID
	Action     string
	From       *time.Time
	To         *time.Time
	Page       int
	PageSize   int
}

type AuditLogListItem struct {
	ID         uuid.UUID
	ActorID    *uuid.UUID
	Action     string
	TargetType string
	TargetID   *uuid.UUID
	Payload    any
	CreatedAt  string
}

type AuditLogListResult struct {
	Items []AuditLogListItem
	Total int64
}

func (s *Service) ListTools(ctx context.Context, currentUserID uuid.UUID, filter ToolListFilter) (ToolListResult, error) {
	return s.listTools(ctx, currentUserID, filter)
}

func (s *Service) ListAdminTools(ctx context.Context, currentUserID uuid.UUID, filter ToolListFilter) (ToolListResult, error) {
	return s.listTools(ctx, currentUserID, filter)
}

func (s *Service) listTools(ctx context.Context, currentUserID uuid.UUID, filter ToolListFilter) (ToolListResult, error) {
	page := filter.Page
	if page <= 0 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize <= 0 {
		pageSize = 25
	}
	if pageSize > 100 {
		pageSize = 100
	}

	status := strings.ToUpper(strings.TrimSpace(filter.Status))
	if status != "" && !ValidateDisplayStatus(status) {
		return ToolListResult{}, apierr.InvalidRequest("invalid status", map[string]any{"status": filter.Status})
	}

	q := strings.TrimSpace(filter.Q)
	warehouseID := strings.TrimSpace(filter.WarehouseID)
	mode := normalizeMode(filter.Mode)
	total, err := s.queries.CountToolsWithDisplay(ctx, db.CountToolsWithDisplayParams{
		Today:       s.DateString(s.TodayJST()),
		WarehouseID: warehouseID,
		Q:           q,
		Mode:        mode,
		Status:      status,
	})
	if err != nil {
		return ToolListResult{}, err
	}

	rows, err := s.queries.ListToolsWithDisplay(ctx, db.ListToolsWithDisplayParams{
		Today:       s.DateString(s.TodayJST()),
		WarehouseID: warehouseID,
		Q:           q,
		Mode:        mode,
		RequesterID: currentUserID,
		Status:      status,
		Limit:       int32(pageSize),
		Offset:      int32((page - 1) * pageSize),
	})
	if err != nil {
		return ToolListResult{}, err
	}

	items := make([]ToolListItem, 0, len(rows))
	for _, r := range rows {
		item := ToolListItem{
			ID:                          r.ID,
			AssetNo:                     r.AssetNo,
			Name:                        r.Name,
			WarehouseID:                 r.WarehouseID,
			WarehouseName:               r.WarehouseName,
			BaseStatus:                  r.BaseStatus,
			DisplayStatus:               r.DisplayStatus,
			IsBlockedByOtherReservation: r.IsBlockedByOtherReservation,
			IsReservedByMe:              r.IsReservedByMe,
		}
		if r.DisplayStartDate.Valid {
			item.DisplayStartDate = s.DateString(r.DisplayStartDate.Time)
		}
		if r.DisplayDueDate.Valid {
			item.DisplayDueDate = s.DateString(r.DisplayDueDate.Time)
		}
		items = append(items, item)
	}
	return ToolListResult{Items: items, Total: total}, nil
}

func (s *Service) ListAuditLogs(ctx context.Context, filter AuditLogListFilter) (AuditLogListResult, error) {
	page := filter.Page
	if page <= 0 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize <= 0 {
		pageSize = 25
	}
	if pageSize > 100 {
		pageSize = 100
	}

	if filter.From != nil && filter.To != nil && filter.From.After(*filter.To) {
		return AuditLogListResult{}, apierr.InvalidRequest("from must be before or equal to to", nil)
	}

	actorID := uuid.NullUUID{}
	if filter.ActorID != nil && *filter.ActorID != uuid.Nil {
		actorID = uuid.NullUUID{UUID: *filter.ActorID, Valid: true}
	}
	targetID := uuid.NullUUID{}
	if filter.TargetID != nil && *filter.TargetID != uuid.Nil {
		targetID = uuid.NullUUID{UUID: *filter.TargetID, Valid: true}
	}
	createdFrom := sql.NullTime{}
	if filter.From != nil {
		createdFrom = sql.NullTime{Time: filter.From.UTC(), Valid: true}
	}
	createdTo := sql.NullTime{}
	if filter.To != nil {
		createdTo = sql.NullTime{Time: filter.To.UTC(), Valid: true}
	}

	targetType := strings.TrimSpace(filter.TargetType)
	action := strings.TrimSpace(filter.Action)

	total, err := s.queries.CountAuditLogs(ctx, db.CountAuditLogsParams{
		ActorID:     actorID,
		TargetType:  targetType,
		TargetID:    targetID,
		Action:      action,
		CreatedFrom: createdFrom,
		CreatedTo:   createdTo,
	})
	if err != nil {
		return AuditLogListResult{}, err
	}

	rows, err := s.queries.ListAuditLogs(ctx, db.ListAuditLogsParams{
		ActorID:     actorID,
		TargetType:  targetType,
		TargetID:    targetID,
		Action:      action,
		CreatedFrom: createdFrom,
		CreatedTo:   createdTo,
		Limit:       int32(pageSize),
		Offset:      int32((page - 1) * pageSize),
	})
	if err != nil {
		return AuditLogListResult{}, err
	}

	items := make([]AuditLogListItem, 0, len(rows))
	for _, row := range rows {
		item := AuditLogListItem{
			ID:         row.ID,
			Action:     row.Action,
			TargetType: row.TargetType,
			CreatedAt:  row.CreatedAt.In(s.jst).Format(time.RFC3339),
		}
		if row.ActorID.Valid {
			actor := row.ActorID.UUID
			item.ActorID = &actor
		}
		if row.TargetID.Valid {
			target := row.TargetID.UUID
			item.TargetID = &target
		}
		if len(row.Payload) > 0 {
			var payload any
			if err := json.Unmarshal(row.Payload, &payload); err == nil {
				item.Payload = payload
			} else {
				item.Payload = string(row.Payload)
			}
		}
		items = append(items, item)
	}

	return AuditLogListResult{
		Items: items,
		Total: total,
	}, nil
}

func (s *Service) ListWarehouses(ctx context.Context) ([]db.Warehouse, error) {
	return s.queries.ListWarehouses(ctx)
}

func (s *Service) CreateWarehouse(ctx context.Context, actorID uuid.UUID, name string) (db.Warehouse, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return db.Warehouse{}, apierr.InvalidRequest("name is required", nil)
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return db.Warehouse{}, err
	}
	defer tx.Rollback()
	qtx := s.queries.WithTx(tx)

	warehouse, err := qtx.CreateWarehouse(ctx, name)
	if err != nil {
		if mapped := mapPQError(err); mapped != nil {
			return db.Warehouse{}, mapped
		}
		return db.Warehouse{}, err
	}

	if err := s.auditTx(ctx, qtx, &actorID, "create_warehouse", "warehouse", warehouse.ID, map[string]any{
		"name": warehouse.Name,
	}); err != nil {
		return db.Warehouse{}, err
	}

	if err := tx.Commit(); err != nil {
		return db.Warehouse{}, err
	}

	return warehouse, nil
}

func (s *Service) DeleteWarehouse(ctx context.Context, actorID, warehouseID uuid.UUID) error {
	if warehouseID == uuid.Nil {
		return apierr.InvalidRequest("warehouseId is required", nil)
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	qtx := s.queries.WithTx(tx)

	warehouse, err := qtx.GetWarehouseByID(ctx, warehouseID)
	if err != nil {
		if stdErrors.Is(err, sql.ErrNoRows) {
			return apierr.NotFound("warehouse not found")
		}
		return err
	}

	toolCount, err := qtx.CountToolsByWarehouse(ctx, warehouseID)
	if err != nil {
		return err
	}
	if toolCount > 0 {
		return apierr.Conflict("WAREHOUSE_NOT_EMPTY", "cannot delete warehouse that has tools", map[string]any{
			"warehouseId": warehouseID,
			"toolCount":   toolCount,
		})
	}

	affected, err := qtx.DeleteWarehouseByID(ctx, warehouseID)
	if err != nil {
		return err
	}
	if affected == 0 {
		return apierr.NotFound("warehouse not found")
	}

	if err := s.auditTx(ctx, qtx, &actorID, "delete_warehouse", "warehouse", warehouseID, map[string]any{
		"name": warehouse.Name,
	}); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}
	return nil
}

func (s *Service) CreateTool(ctx context.Context, actorID uuid.UUID, assetNo, name string, warehouseID uuid.UUID, baseStatus string) (db.Tool, error) {
	assetNo = strings.TrimSpace(assetNo)
	name = strings.TrimSpace(name)
	baseStatus = strings.ToUpper(strings.TrimSpace(baseStatus))
	if assetNo == "" || name == "" {
		return db.Tool{}, apierr.InvalidRequest("assetNo and name are required", nil)
	}
	if warehouseID == uuid.Nil {
		return db.Tool{}, apierr.InvalidRequest("warehouseId is required", nil)
	}
	if !ValidateBaseStatus(baseStatus) {
		return db.Tool{}, apierr.InvalidRequest("invalid baseStatus", map[string]any{"baseStatus": baseStatus})
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return db.Tool{}, err
	}
	defer tx.Rollback()
	qtx := s.queries.WithTx(tx)

	tool, err := qtx.CreateTool(ctx, db.CreateToolParams{
		AssetNo:     assetNo,
		Name:        name,
		WarehouseID: warehouseID,
		BaseStatus:  baseStatus,
	})
	if err != nil {
		if mapped := mapPQError(err); mapped != nil {
			return db.Tool{}, mapped
		}
		return db.Tool{}, err
	}

	if err := s.auditTx(ctx, qtx, &actorID, "create_tool", "tool", tool.ID, map[string]any{
		"assetNo":     tool.AssetNo,
		"name":        tool.Name,
		"warehouseId": tool.WarehouseID,
		"baseStatus":  tool.BaseStatus,
	}); err != nil {
		return db.Tool{}, err
	}

	if err := tx.Commit(); err != nil {
		if mapped := mapPQError(err); mapped != nil {
			return db.Tool{}, mapped
		}
		return db.Tool{}, err
	}

	return tool, nil
}

type UpdateToolInput struct {
	Name        *string
	WarehouseID *uuid.UUID
	BaseStatus  *string
	TagID       *string
	TagIDSet    bool
}

func (s *Service) UpdateTool(ctx context.Context, actorID uuid.UUID, toolID uuid.UUID, in UpdateToolInput) (db.Tool, error) {
	if toolID == uuid.Nil {
		return db.Tool{}, apierr.InvalidRequest("toolId is required", nil)
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return db.Tool{}, err
	}
	defer tx.Rollback()
	qtx := s.queries.WithTx(tx)

	current, err := qtx.GetToolForUpdate(ctx, toolID)
	if err != nil {
		if stdErrors.Is(err, sql.ErrNoRows) {
			return db.Tool{}, apierr.NotFound("tool not found")
		}
		return db.Tool{}, err
	}

	name := current.Name
	warehouseID := current.WarehouseID
	baseStatus := current.BaseStatus
	tagID := current.TagID
	changedFields := make(map[string]any)

	if in.Name != nil {
		trimmed := strings.TrimSpace(*in.Name)
		if trimmed == "" {
			return db.Tool{}, apierr.InvalidRequest("name cannot be empty", nil)
		}
		name = trimmed
		if trimmed != current.Name {
			changedFields["name"] = trimmed
		}
	}
	if in.WarehouseID != nil {
		if *in.WarehouseID == uuid.Nil {
			return db.Tool{}, apierr.InvalidRequest("warehouseId is invalid", nil)
		}
		warehouseID = *in.WarehouseID
		if *in.WarehouseID != current.WarehouseID {
			changedFields["warehouseId"] = in.WarehouseID.String()
		}
	}
	if in.BaseStatus != nil {
		v := strings.ToUpper(strings.TrimSpace(*in.BaseStatus))
		if !ValidateBaseStatus(v) {
			return db.Tool{}, apierr.InvalidRequest("invalid baseStatus", nil)
		}
		baseStatus = v
		if v != current.BaseStatus {
			changedFields["baseStatus"] = v
		}
	}
	if in.TagIDSet {
		if in.TagID == nil {
			tagID = sql.NullString{}
			if current.TagID.Valid {
				changedFields["tagId"] = nil
			}
		} else {
			trimmed := strings.TrimSpace(*in.TagID)
			if trimmed == "" {
				tagID = sql.NullString{}
				if current.TagID.Valid {
					changedFields["tagId"] = nil
				}
			} else {
				tagID = sql.NullString{String: trimmed, Valid: true}
				if !current.TagID.Valid || current.TagID.String != trimmed {
					changedFields["tagId"] = trimmed
				}
			}
		}
	}

	updated, err := qtx.UpdateTool(ctx, db.UpdateToolParams{
		ID:          toolID,
		Name:        name,
		WarehouseID: warehouseID,
		BaseStatus:  baseStatus,
	})
	if err != nil {
		if mapped := mapPQError(err); mapped != nil {
			return db.Tool{}, mapped
		}
		return db.Tool{}, err
	}
	if in.TagIDSet {
		updated, err = qtx.UpdateToolTag(ctx, db.UpdateToolTagParams{
			ID:    toolID,
			TagID: tagID,
		})
		if err != nil {
			if mapped := mapPQError(err); mapped != nil {
				return db.Tool{}, mapped
			}
			return db.Tool{}, err
		}
	}

	if err := s.auditTx(ctx, qtx, &actorID, "update_tool", "tool", toolID, map[string]any{
		"changedFields": changedFields,
	}); err != nil {
		return db.Tool{}, err
	}

	if err := tx.Commit(); err != nil {
		if mapped := mapPQError(err); mapped != nil {
			return db.Tool{}, mapped
		}
		return db.Tool{}, err
	}

	return updated, nil
}

func (s *Service) DeleteTool(ctx context.Context, actorID, toolID uuid.UUID) error {
	if toolID == uuid.Nil {
		return apierr.InvalidRequest("toolId is required", nil)
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	qtx := s.queries.WithTx(tx)

	tool, err := qtx.GetToolForUpdate(ctx, toolID)
	if err != nil {
		if stdErrors.Is(err, sql.ErrNoRows) {
			return apierr.NotFound("tool not found")
		}
		return err
	}

	loanItemCount, err := qtx.CountLoanItemsByTool(ctx, toolID)
	if err != nil {
		return err
	}
	if loanItemCount > 0 {
		return apierr.Conflict("TOOL_HAS_LOAN_HISTORY", "cannot delete tool with loan history", map[string]any{
			"toolId":        toolID,
			"loanItemCount": loanItemCount,
		})
	}

	affected, err := qtx.DeleteToolByID(ctx, toolID)
	if err != nil {
		return err
	}
	if affected == 0 {
		return apierr.NotFound("tool not found")
	}

	if err := s.auditTx(ctx, qtx, &actorID, "delete_tool", "tool", toolID, map[string]any{
		"assetNo": tool.AssetNo,
		"name":    tool.Name,
	}); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}
	return nil
}

func (s *Service) GetToolByTag(ctx context.Context, tagID string) (db.Tool, error) {
	tagID = strings.TrimSpace(tagID)
	if tagID == "" {
		return db.Tool{}, apierr.InvalidRequest("tagId is required", nil)
	}

	tool, err := s.queries.GetToolByTag(ctx, tagID)
	if err != nil {
		if stdErrors.Is(err, sql.ErrNoRows) {
			return db.Tool{}, apierr.NotFound("tool not found")
		}
		return db.Tool{}, err
	}
	return tool, nil
}

type CreateUserInput struct {
	Department string
	Username   string
	Email      string
	Password   string
	Role       string
}

type SignupRequestInput struct {
	Department string
	Username   string
	Email      string
	Password   string
}

type SignupRequestItem struct {
	ID          uuid.UUID
	Department  string
	Username    string
	Email       string
	Status      string
	RequestedAt string
}

type UpdateMyProfileInput struct {
	Department *string
	Username   *string
	Email      *string
	Password   *string
}

type UserListFilter struct {
	Page     int
	PageSize int
}

type UserListResult struct {
	Items    []db.UserSafe
	Total    int64
	Page     int
	PageSize int
}

func (s *Service) CreateUser(ctx context.Context, in CreateUserInput) (db.UserSafe, error) {
	in.Department = strings.TrimSpace(in.Department)
	in.Username = strings.TrimSpace(in.Username)
	in.Email = strings.TrimSpace(strings.ToLower(in.Email))
	in.Role = strings.TrimSpace(strings.ToLower(in.Role))

	if in.Department == "" || in.Username == "" || in.Email == "" || in.Password == "" || in.Role == "" {
		return db.UserSafe{}, apierr.InvalidRequest("department, username, email, password, role are required", nil)
	}
	if !ValidateRole(in.Role) {
		return db.UserSafe{}, apierr.InvalidRequest("invalid role", map[string]any{"role": in.Role})
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
	if err != nil {
		return db.UserSafe{}, err
	}

	user, err := s.queries.CreateUser(ctx, db.CreateUserParams{
		Role:         in.Role,
		Department:   in.Department,
		Username:     in.Username,
		Email:        in.Email,
		PasswordHash: string(hash),
	})
	if err != nil {
		if mapped := mapPQError(err); mapped != nil {
			return db.UserSafe{}, mapped
		}
		return db.UserSafe{}, err
	}
	return user, nil
}

func (s *Service) ListUsers(ctx context.Context, filter UserListFilter) (UserListResult, error) {
	page := filter.Page
	if page <= 0 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize <= 0 {
		pageSize = 10
	}
	if pageSize > 100 {
		pageSize = 100
	}

	total, err := s.queries.CountActiveUsers(ctx)
	if err != nil {
		return UserListResult{}, err
	}

	rows, err := s.queries.ListActiveUsersPage(ctx, db.ListActiveUsersPageParams{
		Limit:  int32(pageSize),
		Offset: int32((page - 1) * pageSize),
	})
	if err != nil {
		return UserListResult{}, err
	}

	return UserListResult{
		Items:    rows,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

func (s *Service) DeleteUser(ctx context.Context, adminID, userID uuid.UUID) error {
	if userID == uuid.Nil {
		return apierr.InvalidRequest("userId is required", nil)
	}
	if adminID == userID {
		return apierr.Forbidden("cannot delete yourself")
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	qtx := s.queries.WithTx(tx)

	target, err := qtx.GetUserByID(ctx, userID)
	if err != nil {
		if stdErrors.Is(err, sql.ErrNoRows) {
			return apierr.NotFound("user not found")
		}
		return err
	}
	if !target.IsActive {
		return apierr.NotFound("user not found")
	}

	if target.Role == RoleAdmin {
		activeAdmins, err := qtx.CountActiveAdmins(ctx)
		if err != nil {
			return err
		}
		if activeAdmins <= 1 {
			return apierr.Conflict("LAST_ADMIN", "cannot delete the last active admin", nil)
		}
	}

	affected, err := qtx.DeactivateUserByID(ctx, userID)
	if err != nil {
		return err
	}
	if affected == 0 {
		return apierr.NotFound("user not found")
	}

	if err := s.auditTx(ctx, qtx, &adminID, "delete_user", "user", userID, map[string]any{
		"username": target.Username,
		"email":    target.Email,
		"role":     target.Role,
	}); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}
	return nil
}

func (s *Service) GetMyProfile(ctx context.Context, userID uuid.UUID) (db.UserSafe, error) {
	return s.GetUser(ctx, userID)
}

func (s *Service) UpdateMyProfile(ctx context.Context, userID uuid.UUID, in UpdateMyProfileInput) (db.UserSafe, error) {
	if userID == uuid.Nil {
		return db.UserSafe{}, apierr.InvalidRequest("userId is required", nil)
	}
	if in.Department == nil && in.Username == nil && in.Email == nil && in.Password == nil {
		return db.UserSafe{}, apierr.InvalidRequest("at least one field is required", nil)
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return db.UserSafe{}, err
	}
	defer tx.Rollback()
	qtx := s.queries.WithTx(tx)

	current, err := qtx.GetUserByIDForUpdate(ctx, userID)
	if err != nil {
		if stdErrors.Is(err, sql.ErrNoRows) {
			return db.UserSafe{}, apierr.NotFound("user not found")
		}
		return db.UserSafe{}, err
	}
	if !current.IsActive {
		return db.UserSafe{}, apierr.NotFound("user not found")
	}

	department := current.Department
	if in.Department != nil {
		trimmed := strings.TrimSpace(*in.Department)
		if trimmed == "" {
			return db.UserSafe{}, apierr.InvalidRequest("department cannot be empty", nil)
		}
		department = trimmed
	}

	username := current.Username
	if in.Username != nil {
		trimmed := strings.TrimSpace(*in.Username)
		if trimmed == "" {
			return db.UserSafe{}, apierr.InvalidRequest("username cannot be empty", nil)
		}
		username = trimmed
	}

	email := current.Email
	if in.Email != nil {
		trimmed := strings.TrimSpace(strings.ToLower(*in.Email))
		if trimmed == "" {
			return db.UserSafe{}, apierr.InvalidRequest("email cannot be empty", nil)
		}
		email = trimmed
	}

	passwordHash := current.PasswordHash
	if in.Password != nil {
		password := strings.TrimSpace(*in.Password)
		if password == "" {
			return db.UserSafe{}, apierr.InvalidRequest("password cannot be empty", nil)
		}
		nextHash, hashErr := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if hashErr != nil {
			return db.UserSafe{}, hashErr
		}
		passwordHash = string(nextHash)
	}

	updated, err := qtx.UpdateUserProfile(ctx, db.UpdateUserProfileParams{
		ID:           userID,
		Department:   department,
		Username:     username,
		Email:        email,
		PasswordHash: passwordHash,
	})
	if err != nil {
		if mapped := mapPQError(err); mapped != nil {
			return db.UserSafe{}, mapped
		}
		return db.UserSafe{}, err
	}

	if err := s.auditTx(ctx, qtx, &userID, "update_my_profile", "user", userID, map[string]any{
		"department": updated.Department,
		"username":   updated.Username,
		"email":      updated.Email,
	}); err != nil {
		return db.UserSafe{}, err
	}

	if err := tx.Commit(); err != nil {
		if mapped := mapPQError(err); mapped != nil {
			return db.UserSafe{}, mapped
		}
		return db.UserSafe{}, err
	}
	return updated, nil
}

func (s *Service) CreateSignupRequest(ctx context.Context, in SignupRequestInput) (SignupRequestItem, error) {
	in.Department = strings.TrimSpace(in.Department)
	in.Username = strings.TrimSpace(in.Username)
	in.Email = strings.TrimSpace(strings.ToLower(in.Email))
	in.Password = strings.TrimSpace(in.Password)

	if in.Department == "" || in.Username == "" || in.Email == "" || in.Password == "" {
		return SignupRequestItem{}, apierr.InvalidRequest("department, username, email, password are required", nil)
	}

	if _, err := s.queries.GetUserByLoginID(ctx, in.Username); err == nil {
		return SignupRequestItem{}, apierr.Conflict("USERNAME_DUPLICATE", "username already exists", nil)
	} else if !stdErrors.Is(err, sql.ErrNoRows) {
		return SignupRequestItem{}, err
	}
	if _, err := s.queries.GetUserByLoginID(ctx, in.Email); err == nil {
		return SignupRequestItem{}, apierr.Conflict("EMAIL_DUPLICATE", "email already exists", nil)
	} else if !stdErrors.Is(err, sql.ErrNoRows) {
		return SignupRequestItem{}, err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
	if err != nil {
		return SignupRequestItem{}, err
	}

	req, err := s.queries.CreateSignupRequest(ctx, db.CreateSignupRequestParams{
		Department:   in.Department,
		Username:     in.Username,
		Email:        in.Email,
		PasswordHash: string(hash),
	})
	if err != nil {
		if mapped := mapPQError(err); mapped != nil {
			return SignupRequestItem{}, mapped
		}
		return SignupRequestItem{}, err
	}

	return SignupRequestItem{
		ID:          req.ID,
		Department:  req.Department,
		Username:    req.Username,
		Email:       req.Email,
		Status:      req.Status,
		RequestedAt: req.RequestedAt.In(s.jst).Format(time.RFC3339),
	}, nil
}

func (s *Service) ListPendingSignupRequests(ctx context.Context) ([]SignupRequestItem, error) {
	rows, err := s.queries.ListPendingSignupRequests(ctx)
	if err != nil {
		return nil, err
	}

	items := make([]SignupRequestItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, SignupRequestItem{
			ID:          row.ID,
			Department:  row.Department,
			Username:    row.Username,
			Email:       row.Email,
			Status:      row.Status,
			RequestedAt: row.RequestedAt.In(s.jst).Format(time.RFC3339),
		})
	}
	return items, nil
}

func (s *Service) ApproveSignupRequest(ctx context.Context, adminID, requestID uuid.UUID) (db.UserSafe, error) {
	if requestID == uuid.Nil {
		return db.UserSafe{}, apierr.InvalidRequest("requestId is required", nil)
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return db.UserSafe{}, err
	}
	defer tx.Rollback()
	qtx := s.queries.WithTx(tx)

	req, err := qtx.GetPendingSignupRequestForUpdate(ctx, requestID)
	if err != nil {
		if stdErrors.Is(err, sql.ErrNoRows) {
			return db.UserSafe{}, apierr.NotFound("signup request not found")
		}
		return db.UserSafe{}, err
	}

	user, err := qtx.CreateUser(ctx, db.CreateUserParams{
		Role:         RoleUser,
		Department:   req.Department,
		Username:     req.Username,
		Email:        req.Email,
		PasswordHash: req.PasswordHash,
	})
	if err != nil {
		if mapped := mapPQError(err); mapped != nil {
			return db.UserSafe{}, mapped
		}
		return db.UserSafe{}, err
	}

	if err := qtx.MarkSignupRequestApproved(ctx, db.MarkSignupRequestApprovedParams{
		ID:             requestID,
		ReviewedBy:     adminID,
		ApprovedUserID: user.ID,
	}); err != nil {
		return db.UserSafe{}, err
	}

	if err := s.auditTx(ctx, qtx, &adminID, "approve_signup_request", "signup_request", requestID, map[string]any{
		"approvedUserId": user.ID,
		"department":     user.Department,
		"username":       user.Username,
		"email":          user.Email,
	}); err != nil {
		return db.UserSafe{}, err
	}

	if err := tx.Commit(); err != nil {
		if mapped := mapPQError(err); mapped != nil {
			return db.UserSafe{}, mapped
		}
		return db.UserSafe{}, err
	}
	return user, nil
}

type CreateLoanBoxInput struct {
	StartDate        time.Time
	DueDate          time.Time
	ToolIDs          []uuid.UUID
	ItemDueOverrides map[uuid.UUID]time.Time
}

type CreatedLoanItem struct {
	LoanItemID uuid.UUID
	ToolID     uuid.UUID
	StartDate  time.Time
	DueDate    time.Time
}

type CreateLoanBoxResult struct {
	BoxID          uuid.UUID
	BoxDisplayName string
	CreatedItems   []CreatedLoanItem
}

func (s *Service) CreateLoanBox(ctx context.Context, borrowerID uuid.UUID, in CreateLoanBoxInput) (CreateLoanBoxResult, error) {
	if len(in.ToolIDs) == 0 {
		return CreateLoanBoxResult{}, apierr.InvalidRequest("toolIds is required", nil)
	}
	if in.DueDate.Before(in.StartDate) {
		return CreateLoanBoxResult{}, apierr.Conflict("INVALID_DATE_RANGE", "due_date must be equal to or after start_date", nil)
	}
	today := s.TodayJST()
	if in.StartDate.Before(today) {
		return CreateLoanBoxResult{}, apierr.Conflict("START_DATE_IN_PAST", "start_date before today is not allowed", map[string]any{"today": s.DateString(today)})
	}

	toolMap := make(map[string]struct{}, len(in.ToolIDs))
	ordered := make([]uuid.UUID, 0, len(in.ToolIDs))
	for _, id := range in.ToolIDs {
		if id == uuid.Nil {
			return CreateLoanBoxResult{}, apierr.InvalidRequest("toolIds contains invalid id", nil)
		}
		key := id.String()
		if _, ok := toolMap[key]; ok {
			return CreateLoanBoxResult{}, apierr.InvalidRequest("toolIds contains duplicate id", map[string]any{"toolId": key})
		}
		toolMap[key] = struct{}{}
		ordered = append(ordered, id)
	}
	sort.Slice(ordered, func(i, j int) bool {
		return strings.Compare(ordered[i].String(), ordered[j].String()) < 0
	})

	for toolID, due := range in.ItemDueOverrides {
		if _, ok := toolMap[toolID.String()]; !ok {
			return CreateLoanBoxResult{}, apierr.InvalidRequest("itemDueOverrides contains unknown toolId", map[string]any{"toolId": toolID.String()})
		}
		if due.Before(in.StartDate) {
			return CreateLoanBoxResult{}, apierr.Conflict("INVALID_DATE_RANGE", "item due_date must be equal to or after start_date", map[string]any{"toolId": toolID.String()})
		}
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return CreateLoanBoxResult{}, err
	}
	defer tx.Rollback()
	qtx := s.queries.WithTx(tx)

	if _, err := qtx.LockUserForUpdate(ctx, borrowerID); err != nil {
		if stdErrors.Is(err, sql.ErrNoRows) {
			return CreateLoanBoxResult{}, apierr.InvalidRequest("borrower not found", nil)
		}
		return CreateLoanBoxResult{}, err
	}

	maxBoxNo, err := qtx.GetMaxBorrowerBoxNo(ctx, borrowerID)
	if err != nil {
		return CreateLoanBoxResult{}, err
	}
	boxNo := maxBoxNo + 1
	boxDisplayName := fmt.Sprintf("BOX-%03d", boxNo)
	box, err := qtx.CreateLoanBox(ctx, db.CreateLoanBoxParams{
		BorrowerID:  borrowerID,
		BoxNo:       boxNo,
		DisplayName: boxDisplayName,
		StartDate:   in.StartDate,
		DueDate:     in.DueDate,
	})
	if err != nil {
		if mapped := mapPQError(err); mapped != nil {
			return CreateLoanBoxResult{}, mapped
		}
		return CreateLoanBoxResult{}, err
	}

	created := make([]CreatedLoanItem, 0, len(ordered))
	for _, toolID := range ordered {
		tool, err := qtx.GetToolForUpdate(ctx, toolID)
		if err != nil {
			if stdErrors.Is(err, sql.ErrNoRows) {
				return CreateLoanBoxResult{}, apierr.InvalidRequest("tool not found", map[string]any{"toolId": toolID.String()})
			}
			return CreateLoanBoxResult{}, err
		}
		if tool.BaseStatus != BaseStatusAvailable {
			return CreateLoanBoxResult{}, apierr.Conflict("TOOL_NOT_AVAILABLE", "tool base_status must be AVAILABLE", map[string]any{"toolId": toolID.String(), "baseStatus": tool.BaseStatus})
		}

		itemDue := in.DueDate
		if due, ok := in.ItemDueOverrides[toolID]; ok {
			itemDue = due
		}

		if !in.StartDate.After(today) {
			blocked, err := qtx.HasFutureReservationByOther(ctx, db.HasFutureReservationByOtherParams{
				ToolID:     toolID,
				Today:      today,
				BorrowerID: borrowerID,
			})
			if err != nil {
				return CreateLoanBoxResult{}, err
			}
			if blocked {
				return CreateLoanBoxResult{}, apierr.Conflict("TOOL_RESERVED_BY_OTHER", "tool is reserved by other user", map[string]any{"toolId": toolID.String()})
			}
		}

		overlap, err := qtx.HasOverlappingLoanItem(ctx, db.HasOverlappingLoanItemParams{
			ToolID:    toolID,
			StartDate: in.StartDate,
			DueDate:   itemDue,
		})
		if err != nil {
			return CreateLoanBoxResult{}, err
		}
		if overlap {
			return CreateLoanBoxResult{}, apierr.Conflict("RESERVATION_CONFLICT", "tool reservation period overlaps", map[string]any{"toolId": toolID.String()})
		}

		item, err := qtx.CreateLoanItem(ctx, db.CreateLoanItemParams{
			BoxID:      box.ID,
			ToolID:     toolID,
			BorrowerID: borrowerID,
			StartDate:  in.StartDate,
			DueDate:    itemDue,
		})
		if err != nil {
			if mapped := mapPQError(err); mapped != nil {
				return CreateLoanBoxResult{}, mapped
			}
			return CreateLoanBoxResult{}, err
		}
		created = append(created, CreatedLoanItem{
			LoanItemID: item.ID,
			ToolID:     item.ToolID,
			StartDate:  item.StartDate,
			DueDate:    item.DueDate,
		})
	}

	overridePayload := make(map[string]string, len(in.ItemDueOverrides))
	for toolID, dueDate := range in.ItemDueOverrides {
		overridePayload[toolID.String()] = s.DateString(dueDate)
	}
	actorID := borrowerID
	if err := s.auditTx(ctx, qtx, &actorID, "create_loan_box", "loan_box", box.ID, map[string]any{
		"startDate":        s.DateString(in.StartDate),
		"dueDate":          s.DateString(in.DueDate),
		"toolIds":          ordered,
		"itemDueOverrides": overridePayload,
	}); err != nil {
		return CreateLoanBoxResult{}, err
	}

	if err := tx.Commit(); err != nil {
		if mapped := mapPQError(err); mapped != nil {
			return CreateLoanBoxResult{}, mapped
		}
		return CreateLoanBoxResult{}, err
	}

	s.notifyBestEffort(ctx, "loan_box_created", map[string]any{
		"boxId":            box.ID,
		"boxDisplayName":   box.DisplayName,
		"borrowerId":       borrowerID,
		"startDate":        s.DateString(in.StartDate),
		"dueDate":          s.DateString(in.DueDate),
		"toolIds":          ordered,
		"itemDueOverrides": overridePayload,
	})

	result := CreateLoanBoxResult{
		BoxID:          box.ID,
		BoxDisplayName: box.DisplayName,
		CreatedItems:   created,
	}
	return result, nil
}

type MyLoanItem struct {
	LoanItemID        uuid.UUID
	BoxID             uuid.UUID
	BoxDisplayName    string
	ToolID            uuid.UUID
	AssetNo           string
	ToolName          string
	StartDate         string
	DueDate           string
	LoanStatus        string
	ReturnRequestedAt string
}

func (s *Service) ListMyOpenLoans(ctx context.Context, userID uuid.UUID) ([]MyLoanItem, error) {
	rows, err := s.queries.ListMyOpenLoanItems(ctx, userID)
	if err != nil {
		return nil, err
	}
	today := s.TodayJST()
	items := make([]MyLoanItem, 0, len(rows))
	for _, r := range rows {
		status := DisplayStatusLoaned
		if r.StartDate.After(today) {
			status = DisplayStatusReserved
		}
		item := MyLoanItem{
			LoanItemID:     r.ID,
			BoxID:          r.BoxID,
			BoxDisplayName: r.BoxDisplayName,
			ToolID:         r.ToolID,
			AssetNo:        r.AssetNo,
			ToolName:       r.ToolName,
			StartDate:      s.DateString(r.StartDate),
			DueDate:        s.DateString(r.DueDate),
			LoanStatus:     status,
		}
		if r.ReturnRequestedAt.Valid {
			item.ReturnRequestedAt = r.ReturnRequestedAt.Time.In(s.jst).Format(time.RFC3339)
		}
		items = append(items, item)
	}
	return items, nil
}

func (s *Service) RequestReturn(ctx context.Context, userID uuid.UUID, loanItemID uuid.UUID) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	qtx := s.queries.WithTx(tx)

	item, err := qtx.GetLoanItemForUpdate(ctx, loanItemID)
	if err != nil {
		if stdErrors.Is(err, sql.ErrNoRows) {
			return apierr.NotFound("loan item not found")
		}
		return err
	}
	if item.BorrowerID != userID {
		return apierr.Forbidden("only borrower can request return")
	}
	if item.ReturnApprovedAt.Valid {
		return apierr.Conflict("ALREADY_APPROVED", "loan item already approved", nil)
	}
	if item.ReturnRequestedAt.Valid {
		return apierr.Conflict("ALREADY_REQUESTED", "return already requested", nil)
	}

	now := time.Now().UTC()
	if err := qtx.MarkLoanItemReturnRequested(ctx, db.MarkLoanItemReturnRequestedParams{
		ID:                loanItemID,
		ReturnRequestedAt: now,
		ReturnRequestedBy: userID,
	}); err != nil {
		return err
	}

	actorID := userID
	if err := s.auditTx(ctx, qtx, &actorID, "request_return", "loan_item", loanItemID, map[string]any{}); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	s.notifyBestEffort(ctx, "return_requested", map[string]any{
		"loanItemId": loanItemID,
		"borrowerId": userID,
	})
	return nil
}

type ReturnRequestItem struct {
	LoanItemID        uuid.UUID
	ToolID            uuid.UUID
	AssetNo           string
	ToolName          string
	StartDate         string
	DueDate           string
	ReturnRequestedAt string
}

type ReturnRequestBox struct {
	BoxID            uuid.UUID
	BoxDisplayName   string
	BorrowerUsername string
	StartDate        string
	DueDate          string
	Items            []ReturnRequestItem
}

func (s *Service) ListReturnRequests(ctx context.Context) ([]ReturnRequestBox, error) {
	rows, err := s.queries.ListReturnRequestRows(ctx)
	if err != nil {
		return nil, err
	}
	grouped := make(map[uuid.UUID]*ReturnRequestBox)
	order := make([]uuid.UUID, 0)

	for _, r := range rows {
		box, ok := grouped[r.BoxID]
		if !ok {
			box = &ReturnRequestBox{
				BoxID:            r.BoxID,
				BoxDisplayName:   r.BoxDisplayName,
				BorrowerUsername: r.BorrowerUsername,
				StartDate:        s.DateString(r.BoxStartDate),
				DueDate:          s.DateString(r.BoxDueDate),
				Items:            make([]ReturnRequestItem, 0),
			}
			grouped[r.BoxID] = box
			order = append(order, r.BoxID)
		}
		item := ReturnRequestItem{
			LoanItemID: r.LoanItemID,
			ToolID:     r.ToolID,
			AssetNo:    r.AssetNo,
			ToolName:   r.ToolName,
			StartDate:  s.DateString(r.StartDate),
			DueDate:    s.DateString(r.DueDate),
		}
		if r.ReturnRequestedAt.Valid {
			item.ReturnRequestedAt = r.ReturnRequestedAt.Time.In(s.jst).Format(time.RFC3339)
		}
		box.Items = append(box.Items, item)
	}

	result := make([]ReturnRequestBox, 0, len(order))
	for _, id := range order {
		result = append(result, *grouped[id])
	}
	return result, nil
}

func (s *Service) ApproveReturnBox(ctx context.Context, adminID uuid.UUID, boxID uuid.UUID) (int, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()
	qtx := s.queries.WithTx(tx)

	items, err := qtx.ListPendingRequestedItemsInBoxForUpdate(ctx, boxID)
	if err != nil {
		return 0, err
	}
	if len(items) == 0 {
		return 0, apierr.Conflict("NOTHING_TO_APPROVE", "no requested items to approve", nil)
	}

	now := time.Now().UTC()
	for _, item := range items {
		if err := qtx.ApproveLoanItemReturn(ctx, db.ApproveLoanItemReturnParams{
			ID:               item.ID,
			ReturnApprovedAt: now,
			ReturnApprovedBy: adminID,
		}); err != nil {
			return 0, err
		}
	}

	actorID := adminID
	if err := s.auditTx(ctx, qtx, &actorID, "approve_return_box", "loan_box", boxID, map[string]any{}); err != nil {
		return 0, err
	}

	if err := tx.Commit(); err != nil {
		return 0, err
	}

	s.notifyBestEffort(ctx, "return_approved_box", map[string]any{
		"boxId":         boxID,
		"approvedCount": len(items),
	})
	return len(items), nil
}

func (s *Service) ApproveReturnItems(ctx context.Context, adminID uuid.UUID, boxID uuid.UUID, loanItemIDs []uuid.UUID) (int, error) {
	if len(loanItemIDs) == 0 {
		return 0, apierr.InvalidRequest("loanItemIds is required", nil)
	}
	seen := make(map[string]struct{}, len(loanItemIDs))
	uniqueIDs := make([]uuid.UUID, 0, len(loanItemIDs))
	for _, id := range loanItemIDs {
		if id == uuid.Nil {
			return 0, apierr.InvalidRequest("loanItemIds contains invalid id", nil)
		}
		key := id.String()
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		uniqueIDs = append(uniqueIDs, id)
	}
	sort.Slice(uniqueIDs, func(i, j int) bool {
		return strings.Compare(uniqueIDs[i].String(), uniqueIDs[j].String()) < 0
	})
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()
	qtx := s.queries.WithTx(tx)

	now := time.Now().UTC()
	approved := 0
	for _, loanItemID := range uniqueIDs {
		item, err := qtx.GetLoanItemInBoxForUpdate(ctx, loanItemID)
		if err != nil {
			if stdErrors.Is(err, sql.ErrNoRows) {
				return 0, apierr.Conflict("ITEM_NOT_IN_BOX", "loan item not found", map[string]any{"loanItemId": loanItemID.String()})
			}
			return 0, err
		}
		if item.BoxID != boxID {
			return 0, apierr.Conflict("ITEM_NOT_IN_BOX", "loan item is not part of the box", map[string]any{"loanItemId": loanItemID.String()})
		}
		if item.ReturnApprovedAt.Valid {
			return 0, apierr.Conflict("ALREADY_APPROVED", "loan item already approved", map[string]any{"loanItemId": loanItemID.String()})
		}
		if !item.ReturnRequestedAt.Valid {
			return 0, apierr.Conflict("ITEM_NOT_REQUESTED", "loan item is not requested", map[string]any{"loanItemId": loanItemID.String()})
		}

		if err := qtx.ApproveLoanItemReturn(ctx, db.ApproveLoanItemReturnParams{
			ID:               loanItemID,
			ReturnApprovedAt: now,
			ReturnApprovedBy: adminID,
		}); err != nil {
			return 0, err
		}
		approved++
	}

	if approved == 0 {
		return 0, apierr.Conflict("NOTHING_TO_APPROVE", "no requested items to approve", nil)
	}

	actorID := adminID
	if err := s.auditTx(ctx, qtx, &actorID, "approve_return_items", "loan_box", boxID, map[string]any{
		"loanItemIds": uniqueIDs,
	}); err != nil {
		return 0, err
	}

	if err := tx.Commit(); err != nil {
		return 0, err
	}

	s.notifyBestEffort(ctx, "return_approved_items", map[string]any{
		"boxId":         boxID,
		"approvedCount": approved,
		"loanItemIds":   uniqueIDs,
	})
	return approved, nil
}

func (s *Service) EnsureSeedAdmin(ctx context.Context) error {
	if !s.cfg.EnableSeedAdmin {
		return nil
	}

	if s.cfg.SeedAdminUsername == "" || s.cfg.SeedAdminEmail == "" || s.cfg.SeedAdminPassword == "" {
		return nil
	}

	count, err := s.queries.CountUsers(ctx)
	if err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	_, err = s.CreateUser(ctx, CreateUserInput{
		Department: s.cfg.SeedAdminDepartment,
		Username:   s.cfg.SeedAdminUsername,
		Email:      s.cfg.SeedAdminEmail,
		Password:   s.cfg.SeedAdminPassword,
		Role:       RoleAdmin,
	})
	return err
}

func (s *Service) RunOverdueNotification(ctx context.Context) (int, error) {
	today := s.TodayJST()
	overdueItems, err := s.queries.ListOverdueLoanItems(ctx, db.ListOverdueLoanItemsParams{Today: today})
	if err != nil {
		return 0, err
	}
	if len(overdueItems) == 0 {
		s.notifyBestEffort(ctx, "overdue_mail_sent", map[string]any{"sentCount": 0})
		return 0, nil
	}

	adminEmails, err := s.queries.ListAdminEmails(ctx)
	if err != nil {
		return 0, err
	}

	type groupedItem struct {
		BorrowerEmail    string
		BorrowerUsername string
		Items            []db.OverdueLoanItem
	}
	grouped := make(map[uuid.UUID]*groupedItem)
	for _, item := range overdueItems {
		g, ok := grouped[item.BorrowerID]
		if !ok {
			g = &groupedItem{
				BorrowerEmail:    item.BorrowerEmail,
				BorrowerUsername: item.BorrowerUsername,
				Items:            make([]db.OverdueLoanItem, 0),
			}
			grouped[item.BorrowerID] = g
		}
		g.Items = append(g.Items, item)
	}

	sent := 0
	for _, group := range grouped {
		bodyLines := []string{
			fmt.Sprintf("Hello %s,", group.BorrowerUsername),
			"",
			"There are loan items past due date.",
			"",
			"Items:",
		}
		for _, item := range group.Items {
			bodyLines = append(bodyLines,
				fmt.Sprintf("- %s (%s) / due: %s / start: %s / box: %s",
					item.ToolName,
					item.AssetNo,
					s.DateString(item.DueDate),
					s.DateString(item.StartDate),
					item.BoxDisplayName,
				),
			)
		}
		bodyLines = append(bodyLines, "", "Please submit a return request.")

		bcc := uniqueStrings(adminEmails)
		filteredBCC := make([]string, 0, len(bcc))
		for _, addr := range bcc {
			if !strings.EqualFold(addr, group.BorrowerEmail) {
				filteredBCC = append(filteredBCC, addr)
			}
		}
		subject := "[Tool Management] Overdue Return Notice"
		if err := s.mailer.Send(ctx, []string{group.BorrowerEmail}, filteredBCC, subject, strings.Join(bodyLines, "\n")); err != nil {
			return sent, err
		}
		sent++
	}

	s.notifyBestEffort(ctx, "overdue_mail_sent", map[string]any{"sentCount": sent})
	return sent, nil
}

func uniqueStrings(vs []string) []string {
	seen := make(map[string]struct{}, len(vs))
	out := make([]string, 0, len(vs))
	for _, v := range vs {
		if v == "" {
			continue
		}
		if _, ok := seen[v]; ok {
			continue
		}
		seen[v] = struct{}{}
		out = append(out, v)
	}
	return out
}

func mapPQError(err error) error {
	var pqErr *pq.Error
	if !stdErrors.As(err, &pqErr) {
		return nil
	}

	switch string(pqErr.Code) {
	case "23P01":
		return apierr.Conflict("RESERVATION_CONFLICT", "reservation overlaps existing loan/reservation", nil)
	case "23505":
		switch pqErr.Constraint {
		case "warehouses_name_key":
			return apierr.Conflict("WAREHOUSE_NAME_DUPLICATE", "warehouse name already exists", nil)
		case "tools_asset_no_key":
			return apierr.Conflict("TOOL_ASSET_NO_DUPLICATE", "assetNo already exists", nil)
		case "idx_tools_tag_id_unique":
			return apierr.Conflict("TOOL_TAG_DUPLICATE", "tagId already exists", nil)
		case "users_username_key":
			return apierr.Conflict("USERNAME_DUPLICATE", "username already exists", nil)
		case "users_email_key":
			return apierr.Conflict("EMAIL_DUPLICATE", "email already exists", nil)
		case "idx_user_signup_requests_username_pending":
			return apierr.Conflict("SIGNUP_REQUEST_USERNAME_DUPLICATE", "pending signup request for username already exists", nil)
		case "idx_user_signup_requests_email_pending":
			return apierr.Conflict("SIGNUP_REQUEST_EMAIL_DUPLICATE", "pending signup request for email already exists", nil)
		case "loan_boxes_borrower_id_box_no_key":
			return apierr.Conflict("INVALID_REQUEST", "box number conflict", nil)
		default:
			return apierr.Conflict("INVALID_REQUEST", "duplicate key", nil)
		}
	case "23503":
		return apierr.InvalidRequest("foreign key constraint violation", map[string]any{"constraint": pqErr.Constraint})
	case "23514":
		if pqErr.Constraint == "loan_boxes_due_date_check" || pqErr.Constraint == "loan_items_due_date_check" {
			return apierr.Conflict("INVALID_DATE_RANGE", "due_date must be equal to or after start_date", nil)
		}
		return apierr.InvalidRequest("check constraint violation", map[string]any{"constraint": pqErr.Constraint})
	default:
		return nil
	}
}
