package db

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID           uuid.UUID
	Role         string
	Department   string
	Username     string
	Email        string
	PasswordHash string
	IsActive     bool
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type UserSafe struct {
	ID         uuid.UUID
	Role       string
	Department string
	Username   string
	Email      string
	IsActive   bool
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

type Department struct {
	ID        uuid.UUID
	Name      string
	CreatedAt time.Time
	UpdatedAt time.Time
}

type SignupRequest struct {
	ID             uuid.UUID
	Department     string
	Username       string
	Email          string
	PasswordHash   string
	Status         string
	RequestedAt    time.Time
	ReviewedAt     sql.NullTime
	ReviewedBy     uuid.NullUUID
	ApprovedUserID uuid.NullUUID
}

type Warehouse struct {
	ID          uuid.UUID
	Name        string
	WarehouseNo sql.NullString
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type Tool struct {
	ID          uuid.UUID
	AssetNo     string
	TagID       sql.NullString
	Name        string
	WarehouseID uuid.UUID
	BaseStatus  string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type ToolWithDisplay struct {
	ID                          uuid.UUID
	AssetNo                     string
	Name                        string
	WarehouseID                 uuid.UUID
	WarehouseName               string
	BaseStatus                  string
	DisplayStatus               string
	DisplayStartDate            sql.NullTime
	DisplayDueDate              sql.NullTime
	IsBlockedByOtherReservation bool
	IsReservedByMe              bool
}

type LoanBox struct {
	ID          uuid.UUID
	BorrowerID  uuid.UUID
	BoxNo       int32
	DisplayName string
	StartDate   time.Time
	DueDate     time.Time
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type LoanItem struct {
	ID                uuid.UUID
	BoxID             uuid.UUID
	ToolID            uuid.UUID
	BorrowerID        uuid.UUID
	StartDate         time.Time
	DueDate           time.Time
	ReturnRequestedAt sql.NullTime
	ReturnRequestedBy uuid.NullUUID
	ReturnApprovedAt  sql.NullTime
	ReturnApprovedBy  uuid.NullUUID
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

type MyOpenLoanItem struct {
	ID                uuid.UUID
	BoxID             uuid.UUID
	BoxDisplayName    string
	ToolID            uuid.UUID
	AssetNo           string
	ToolName          string
	StartDate         time.Time
	DueDate           time.Time
	ReturnRequestedAt sql.NullTime
	ReturnApprovedAt  sql.NullTime
}

type ReturnRequestRow struct {
	BoxID             uuid.UUID
	BoxDisplayName    string
	BoxStartDate      time.Time
	BoxDueDate        time.Time
	BorrowerUsername  string
	LoanItemID        uuid.UUID
	ToolID            uuid.UUID
	AssetNo           string
	ToolName          string
	StartDate         time.Time
	DueDate           time.Time
	ReturnRequestedAt sql.NullTime
}

type OverdueLoanItem struct {
	LoanItemID       uuid.UUID
	BoxID            uuid.UUID
	BoxDisplayName   string
	ToolID           uuid.UUID
	AssetNo          string
	ToolName         string
	StartDate        time.Time
	DueDate          time.Time
	BorrowerID       uuid.UUID
	BorrowerUsername string
	BorrowerEmail    string
}

type AuditLog struct {
	ID         uuid.UUID
	ActorID    uuid.NullUUID
	Action     string
	TargetType string
	TargetID   uuid.NullUUID
	Payload    []byte
	CreatedAt  time.Time
}

type ExistsResult struct {
	Exists bool
}
