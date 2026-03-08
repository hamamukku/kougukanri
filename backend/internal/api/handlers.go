package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"

	"kougukanri/backend/internal/app"
	"kougukanri/backend/internal/auth"
	apierr "kougukanri/backend/internal/errors"
)

type Handler struct {
	svc        *app.Service
	jwtManager *auth.JWTManager
}

func NewHandler(svc *app.Service, jwtManager *auth.JWTManager) *Handler {
	return &Handler{svc: svc, jwtManager: jwtManager}
}

func (h *Handler) RegisterRoutes(r *gin.Engine) {
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	apiGroup := r.Group("/api")
	apiGroup.POST("/auth/login", h.login)
	apiGroup.POST("/public/signup/request", h.createSignupRequest)

	authed := apiGroup.Group("")
	authed.Use(AuthMiddleware(h.jwtManager, h.svc))

	authed.GET("/auth/me", h.me)
	authed.GET("/warehouses", h.listWarehouses)
	authed.GET("/departments", h.listDepartments)
	authed.GET("/tools", h.listTools)
	authed.GET("/tools/by-tag/:tagId", h.getToolByTag)

	authed.POST("/loan-boxes", h.createLoanBox)
	authed.GET("/my/loans", h.listMyLoans)
	authed.POST("/my/loans/:loanItemId/return-request", h.returnRequest)
	authed.GET("/my/profile", h.getMyProfile)
	authed.PATCH("/my/profile", h.patchMyProfile)

	admin := apiGroup.Group("/admin")
	admin.Use(AuthMiddleware(h.jwtManager, h.svc), RequireRole(app.RoleAdmin))
	admin.POST("/warehouses", h.createWarehouse)
	admin.DELETE("/warehouses/:warehouseId", h.deleteWarehouse)
	admin.PATCH("/warehouses/:warehouseId", h.patchWarehouse)
	admin.GET("/tools", h.listAdminTools)
	admin.GET("/audit-logs", h.listAuditLogs)
	admin.POST("/tools", h.createTool)
	admin.POST("/tools/bulk", h.createToolsBulk)
	admin.POST("/import/excel", h.importWarehousesToolsExcel)
	admin.DELETE("/tools/:toolId", h.deleteTool)
	admin.POST("/tools/:toolId/retire", h.retireTool)
	admin.PATCH("/tools/:toolId", h.patchTool)
	admin.POST("/departments", h.createDepartment)
	admin.PATCH("/departments/:departmentId", h.patchDepartment)
	admin.DELETE("/departments/:departmentId", h.deleteDepartment)
	admin.GET("/returns/requests", h.listReturnRequests)
	admin.POST("/returns/approve-box", h.approveReturnBox)
	admin.POST("/returns/approve-items", h.approveReturnItems)
	admin.GET("/users", h.listUsers)
	admin.POST("/users", h.createUser)
	admin.DELETE("/users/:userId", h.deleteUser)
	admin.PATCH("/users/:userId", h.patchUser)
	admin.GET("/user-requests", h.listSignupRequests)
	admin.POST("/user-requests/:requestId/approve", h.approveSignupRequest)
}

type loginRequest struct {
	LoginID  string `json:"loginId"`
	Password string `json:"password"`
}

type createSignupRequestRequest struct {
	Department string `json:"department"`
	Username   string `json:"username"`
	Email      string `json:"email"`
	Password   string `json:"password"`
}

func (h *Handler) login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteError(c, apierr.InvalidRequest("invalid request body", nil))
		return
	}

	res, err := h.svc.Login(c.Request.Context(), req.LoginID, req.Password)
	if err != nil {
		WriteError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token":    res.Token,
		"role":     res.Role,
		"userName": res.UserName,
	})
}

func (h *Handler) createSignupRequest(c *gin.Context) {
	var req createSignupRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteError(c, apierr.InvalidRequest("invalid request body", nil))
		return
	}

	item, err := h.svc.CreateSignupRequest(c.Request.Context(), app.SignupRequestInput{
		Department: req.Department,
		Username:   req.Username,
		Email:      req.Email,
		Password:   req.Password,
	})
	if err != nil {
		WriteError(c, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"ok": true,
		"request": gin.H{
			"department":  item.Department,
			"id":          item.ID,
			"username":    item.Username,
			"email":       item.Email,
			"status":      item.Status,
			"requestedAt": item.RequestedAt,
		},
	})
}

func (h *Handler) me(c *gin.Context) {
	user, ok := CurrentUser(c)
	if !ok {
		WriteError(c, apierr.Unauthorized("unauthorized"))
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"role":     user.Role,
		"userName": user.UserName,
	})
}

func (h *Handler) getMyProfile(c *gin.Context) {
	user, _ := CurrentUser(c)
	profile, err := h.svc.GetMyProfile(c.Request.Context(), user.ID)
	if err != nil {
		WriteError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":         profile.ID,
		"department": profile.Department,
		"userCode":   profile.UserCode,
		"username":   profile.Username,
		"email":      profile.Email,
		"role":       profile.Role,
		"createdAt":  profile.CreatedAt,
	})
}

type patchMyProfileRequest struct {
	Department *string `json:"department"`
	Username   *string `json:"username"`
	Email      *string `json:"email"`
	Password   *string `json:"password"`
}

func (h *Handler) patchMyProfile(c *gin.Context) {
	user, _ := CurrentUser(c)
	var req patchMyProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteError(c, apierr.InvalidRequest("invalid request body", nil))
		return
	}

	profile, err := h.svc.UpdateMyProfile(c.Request.Context(), user.ID, app.UpdateMyProfileInput{
		Department: req.Department,
		Username:   req.Username,
		Email:      req.Email,
		Password:   req.Password,
	})
	if err != nil {
		WriteError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":         profile.ID,
		"department": profile.Department,
		"userCode":   profile.UserCode,
		"username":   profile.Username,
		"email":      profile.Email,
		"role":       profile.Role,
		"createdAt":  profile.CreatedAt,
	})
}

func (h *Handler) listWarehouses(c *gin.Context) {
	items, err := h.svc.ListWarehouses(c.Request.Context())
	if err != nil {
		WriteError(c, err)
		return
	}

	resp := make([]gin.H, 0, len(items))
	for _, w := range items {
		resp = append(resp, gin.H{
			"id":          w.ID,
			"name":        w.Name,
			"warehouseNo": nullableNullString(w.WarehouseNo),
		})
	}
	c.JSON(http.StatusOK, resp)
}

func (h *Handler) listDepartments(c *gin.Context) {
	items, err := h.svc.ListDepartments(c.Request.Context())
	if err != nil {
		WriteError(c, err)
		return
	}

	resp := make([]gin.H, 0, len(items))
	for _, department := range items {
		resp = append(resp, gin.H{
			"id":   department.ID,
			"name": department.Name,
		})
	}
	c.JSON(http.StatusOK, resp)
}

type createWarehouseRequest struct {
	Name        string  `json:"name"`
	WarehouseNo *string `json:"warehouseNo"`
}

func (h *Handler) createWarehouse(c *gin.Context) {
	user, _ := CurrentUser(c)
	var req createWarehouseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteError(c, apierr.InvalidRequest("invalid request body", nil))
		return
	}
	item, err := h.svc.CreateWarehouse(c.Request.Context(), user.ID, req.Name, req.WarehouseNo)
	if err != nil {
		WriteError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{
		"id":          item.ID,
		"name":        item.Name,
		"warehouseNo": nullableNullString(item.WarehouseNo),
	})
}

type patchWarehouseRequest struct {
	Name       *string `json:"name"`
	WarehouseNo *string `json:"warehouseNo"`
}

func (h *Handler) patchWarehouse(c *gin.Context) {
	admin, _ := CurrentUser(c)
	warehouseID, err := uuid.Parse(strings.TrimSpace(c.Param("warehouseId")))
	if err != nil {
		WriteError(c, apierr.InvalidRequest("warehouseId is invalid", nil))
		return
	}

	var req patchWarehouseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteError(c, apierr.InvalidRequest("invalid request body", nil))
		return
	}

	warehouse, err := h.svc.UpdateWarehouse(c.Request.Context(), admin.ID, warehouseID, app.UpdateWarehouseInput{
		Name:       req.Name,
		WarehouseNo: req.WarehouseNo,
	})
	if err != nil {
		WriteError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":          warehouse.ID,
		"name":        warehouse.Name,
		"warehouseNo": nullableNullString(warehouse.WarehouseNo),
	})
}

func (h *Handler) deleteWarehouse(c *gin.Context) {
	user, _ := CurrentUser(c)
	warehouseID, err := uuid.Parse(strings.TrimSpace(c.Param("warehouseId")))
	if err != nil {
		WriteError(c, apierr.InvalidRequest("warehouseId is invalid", nil))
		return
	}
	if err := h.svc.DeleteWarehouse(c.Request.Context(), user.ID, warehouseID); err != nil {
		WriteError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

type createDepartmentRequest struct {
	Name string `json:"name"`
}

func (h *Handler) createDepartment(c *gin.Context) {
	user, _ := CurrentUser(c)
	var req createDepartmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteError(c, apierr.InvalidRequest("invalid request body", nil))
		return
	}

	department, err := h.svc.CreateDepartment(c.Request.Context(), user.ID, req.Name)
	if err != nil {
		WriteError(c, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":   department.ID,
		"name": department.Name,
	})
}

type patchDepartmentRequest struct {
	Name *string `json:"name"`
}

func (h *Handler) patchDepartment(c *gin.Context) {
	user, _ := CurrentUser(c)
	departmentID, err := uuid.Parse(strings.TrimSpace(c.Param("departmentId")))
	if err != nil {
		WriteError(c, apierr.InvalidRequest("departmentId is invalid", nil))
		return
	}

	var req patchDepartmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteError(c, apierr.InvalidRequest("invalid request body", nil))
		return
	}

	department, err := h.svc.UpdateDepartment(c.Request.Context(), user.ID, departmentID, app.UpdateDepartmentInput{
		Name: req.Name,
	})
	if err != nil {
		WriteError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":   department.ID,
		"name": department.Name,
	})
}

func (h *Handler) deleteDepartment(c *gin.Context) {
	user, _ := CurrentUser(c)
	departmentID, err := uuid.Parse(strings.TrimSpace(c.Param("departmentId")))
	if err != nil {
		WriteError(c, apierr.InvalidRequest("departmentId is invalid", nil))
		return
	}
	if err := h.svc.DeleteDepartment(c.Request.Context(), user.ID, departmentID); err != nil {
		WriteError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handler) listTools(c *gin.Context) {
	user, _ := CurrentUser(c)
	warehouseID, err := parseOptionalWarehouseID(c.Query("warehouseId"))
	if err != nil {
		WriteError(c, apierr.InvalidRequest("warehouseId is invalid", map[string]any{"warehouseId": c.Query("warehouseId")}))
		return
	}
	filter := app.ToolListFilter{
		Q:           c.Query("q"),
		Mode:        c.DefaultQuery("mode", "partial"),
		WarehouseID: warehouseID,
		Status:      c.Query("status"),
		Page:        parsePositiveInt(c.Query("page"), 1),
		PageSize:    parsePositiveInt(c.DefaultQuery("pageSize", "25"), 25),
	}
	if filter.PageSize > 100 {
		filter.PageSize = 100
	}
	result, err := h.svc.ListTools(c.Request.Context(), user.ID, filter)
	if err != nil {
		WriteError(c, err)
		return
	}

	resp := make([]gin.H, 0, len(result.Items))
	for _, t := range result.Items {
		resp = append(resp, gin.H{
			"id":                          t.ID,
			"toolId":                      t.AssetNo,
			"assetNo":                     t.AssetNo,
			"name":                        t.Name,
			"warehouseId":                 t.WarehouseID,
			"warehouseName":               t.WarehouseName,
			"status":                      t.DisplayStatus,
			"startDate":                   nullableString(t.DisplayStartDate),
			"dueDate":                     nullableString(t.DisplayDueDate),
			"isBlockedByOtherReservation": t.IsBlockedByOtherReservation,
			"isReservedByMe":              t.IsReservedByMe,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"items":    resp,
		"page":     filter.Page,
		"pageSize": filter.PageSize,
		"total":    result.Total,
	})
}

func (h *Handler) listAdminTools(c *gin.Context) {
	user, _ := CurrentUser(c)
	warehouseID, err := parseOptionalWarehouseID(c.Query("warehouseId"))
	if err != nil {
		WriteError(c, apierr.InvalidRequest("warehouseId is invalid", map[string]any{"warehouseId": c.Query("warehouseId")}))
		return
	}
	filter := app.ToolListFilter{
		Q:           c.Query("q"),
		Mode:        c.DefaultQuery("mode", "partial"),
		WarehouseID: warehouseID,
		Status:      c.Query("status"),
		Page:        parsePositiveInt(c.Query("page"), 1),
		PageSize:    parsePositiveInt(c.DefaultQuery("pageSize", "25"), 25),
	}
	if filter.PageSize > 100 {
		filter.PageSize = 100
	}
	result, err := h.svc.ListAdminTools(c.Request.Context(), user.ID, filter)
	if err != nil {
		WriteError(c, err)
		return
	}

	resp := make([]gin.H, 0, len(result.Items))
	for _, t := range result.Items {
		resp = append(resp, gin.H{
			"id":                          t.ID,
			"toolId":                      t.AssetNo,
			"assetNo":                     t.AssetNo,
			"name":                        t.Name,
			"warehouseId":                 t.WarehouseID,
			"warehouseName":               t.WarehouseName,
			"baseStatus":                  t.BaseStatus,
			"hasLoanHistory":              t.HasLoanHistory,
			"status":                      t.DisplayStatus,
			"startDate":                   nullableString(t.DisplayStartDate),
			"dueDate":                     nullableString(t.DisplayDueDate),
			"isBlockedByOtherReservation": t.IsBlockedByOtherReservation,
			"isReservedByMe":              t.IsReservedByMe,
		})
	}
	c.JSON(http.StatusOK, gin.H{
		"items":    resp,
		"page":     filter.Page,
		"pageSize": filter.PageSize,
		"total":    result.Total,
	})
}

func (h *Handler) listAuditLogs(c *gin.Context) {
	actorID, err := parseOptionalUUID(c.Query("actorId"))
	if err != nil {
		WriteError(c, apierr.InvalidRequest("actorId is invalid", map[string]any{"actorId": c.Query("actorId")}))
		return
	}
	targetID, err := parseOptionalUUID(c.Query("targetId"))
	if err != nil {
		WriteError(c, apierr.InvalidRequest("targetId is invalid", map[string]any{"targetId": c.Query("targetId")}))
		return
	}
	from, err := parseOptionalTimestamp(c.Query("from"), false)
	if err != nil {
		WriteError(c, apierr.InvalidRequest("from is invalid", map[string]any{"from": c.Query("from")}))
		return
	}
	to, err := parseOptionalTimestamp(c.Query("to"), true)
	if err != nil {
		WriteError(c, apierr.InvalidRequest("to is invalid", map[string]any{"to": c.Query("to")}))
		return
	}

	filter := app.AuditLogListFilter{
		ActorID:    actorID,
		TargetType: strings.TrimSpace(c.Query("targetType")),
		TargetID:   targetID,
		Action:     strings.TrimSpace(c.Query("action")),
		From:       from,
		To:         to,
		Page:       parsePositiveInt(c.Query("page"), 1),
		PageSize:   parsePositiveInt(c.DefaultQuery("pageSize", "25"), 25),
	}
	if filter.PageSize > 100 {
		filter.PageSize = 100
	}

	result, err := h.svc.ListAuditLogs(c.Request.Context(), filter)
	if err != nil {
		WriteError(c, err)
		return
	}

	resp := make([]gin.H, 0, len(result.Items))
	for _, item := range result.Items {
		resp = append(resp, gin.H{
			"id":         item.ID,
			"actorId":    item.ActorID,
			"action":     item.Action,
			"targetType": item.TargetType,
			"targetId":   item.TargetID,
			"payload":    item.Payload,
			"createdAt":  item.CreatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"items":    resp,
		"page":     filter.Page,
		"pageSize": filter.PageSize,
		"total":    result.Total,
	})
}

type createToolRequest struct {
	AssetNo     string `json:"assetNo"`
	Name        string `json:"name"`
	WarehouseID string `json:"warehouseId"`
	BaseStatus  string `json:"baseStatus"`
}

func (h *Handler) createTool(c *gin.Context) {
	user, _ := CurrentUser(c)
	var req createToolRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteError(c, apierr.InvalidRequest("invalid request body", nil))
		return
	}
	warehouseID, err := uuid.Parse(strings.TrimSpace(req.WarehouseID))
	if err != nil {
		WriteError(c, apierr.InvalidRequest("warehouseId is invalid", nil))
		return
	}

	tool, err := h.svc.CreateTool(c.Request.Context(), user.ID, req.AssetNo, req.Name, warehouseID, req.BaseStatus)
	if err != nil {
		WriteError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{
		"id":          tool.ID,
		"toolId":      tool.AssetNo,
		"assetNo":     tool.AssetNo,
		"tagId":       nullableNullString(tool.TagID),
		"name":        tool.Name,
		"warehouseId": tool.WarehouseID,
		"baseStatus":  tool.BaseStatus,
	})
}

type createToolBulkItemRequest struct {
	AssetNo     string  `json:"assetNo"`
	Name        string  `json:"name"`
	WarehouseID string  `json:"warehouseId"`
	BaseStatus  string  `json:"baseStatus"`
	TagID       *string `json:"tagId"`
}

type createToolsBulkRequest struct {
	Tools []createToolBulkItemRequest `json:"tools"`
}

func (h *Handler) createToolsBulk(c *gin.Context) {
	user, _ := CurrentUser(c)
	var req createToolsBulkRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteError(c, apierr.InvalidRequest("invalid request body", nil))
		return
	}

	if len(req.Tools) == 0 {
		WriteError(c, apierr.InvalidRequest("tools is required", nil))
		return
	}

	rowErrors := make([]app.BulkToolRowError, 0)
	inputs := make([]app.CreateToolBulkInput, len(req.Tools))
	for i, item := range req.Tools {
		inputs[i] = app.CreateToolBulkInput{
			AssetNo:    item.AssetNo,
			Name:       item.Name,
			BaseStatus: item.BaseStatus,
			TagID:      item.TagID,
		}
		parsedWarehouseID, err := uuid.Parse(strings.TrimSpace(item.WarehouseID))
		if err != nil {
			rowErrors = append(rowErrors, app.BulkToolRowError{
				Row:     i + 1,
				Field:   "warehouseId",
				Message: "warehouseId is invalid",
			})
			continue
		}
		inputs[i].WarehouseID = parsedWarehouseID
	}
	if len(rowErrors) > 0 {
		WriteError(c, apierr.InvalidRequest("invalid tools payload", map[string]any{
			"rowErrors": rowErrors,
		}))
		return
	}

	result, err := h.svc.CreateToolsBulk(c.Request.Context(), user.ID, inputs)
	if err != nil {
		WriteError(c, err)
		return
	}

	respItems := make([]gin.H, 0, len(result.Tools))
	for _, tool := range result.Tools {
		respItems = append(respItems, gin.H{
			"id":          tool.ID,
			"toolId":      tool.AssetNo,
			"assetNo":     tool.AssetNo,
			"tagId":       nullableNullString(tool.TagID),
			"name":        tool.Name,
			"warehouseId": tool.WarehouseID,
			"baseStatus":  tool.BaseStatus,
		})
	}

	c.JSON(http.StatusCreated, gin.H{
		"items": respItems,
	})
}

func normalizeImportExcelHeader(v string) string {
	replacer := strings.NewReplacer(" ", "", "　", "", "_", "", "-", "")
	return strings.ToLower(replacer.Replace(strings.TrimSpace(v)))
}

func getExcelCellValue(row []string, index int) string {
	if index < 0 || index >= len(row) {
		return ""
	}
	return strings.TrimSpace(row[index])
}

type importExcelColumnIndexes struct {
	WarehouseName int
	WarehouseNo   int
	AssetNo       int
	ToolName      int
	HasHeader     bool
}

func detectImportExcelColumnIndexes(firstRow []string) importExcelColumnIndexes {
	indexes := importExcelColumnIndexes{
		WarehouseName: -1,
		WarehouseNo:   -1,
		AssetNo:       -1,
		ToolName:      -1,
		HasHeader:     false,
	}

	for i, cell := range firstRow {
		normalized := normalizeImportExcelHeader(cell)
		switch normalized {
		case "場所名", "倉庫名", "warehousename":
			indexes.WarehouseName = i
			indexes.HasHeader = true
		case "管理番号", "倉庫番号", "warehouseno":
			indexes.WarehouseNo = i
			indexes.HasHeader = true
		case "工具id", "toolid", "assetno":
			indexes.AssetNo = i
			indexes.HasHeader = true
		case "工具名", "toolname":
			indexes.ToolName = i
			indexes.HasHeader = true
		}
	}

	if !indexes.HasHeader {
		indexes.WarehouseName = 0
		indexes.WarehouseNo = 1
		indexes.AssetNo = 2
		indexes.ToolName = 3
	}

	return indexes
}

func missingImportExcelRequiredHeaders(indexes importExcelColumnIndexes) []string {
	missing := make([]string, 0, 4)
	if indexes.WarehouseName < 0 {
		missing = append(missing, "場所名")
	}
	if indexes.WarehouseNo < 0 {
		missing = append(missing, "管理番号")
	}
	if indexes.AssetNo < 0 {
		missing = append(missing, "工具ID")
	}
	if indexes.ToolName < 0 {
		missing = append(missing, "工具名")
	}
	return missing
}

func parseImportExcelRows(rows [][]string) ([]app.ImportExcelRow, []string) {
	if len(rows) == 0 {
		return []app.ImportExcelRow{}, nil
	}

	indexes := detectImportExcelColumnIndexes(rows[0])
	if indexes.HasHeader {
		missingHeaders := missingImportExcelRequiredHeaders(indexes)
		if len(missingHeaders) > 0 {
			return nil, missingHeaders
		}
	}
	startIndex := 0
	if indexes.HasHeader {
		startIndex = 1
	}

	result := make([]app.ImportExcelRow, 0, len(rows))
	for i := startIndex; i < len(rows); i++ {
		row := rows[i]
		warehouseName := getExcelCellValue(row, indexes.WarehouseName)
		warehouseNo := getExcelCellValue(row, indexes.WarehouseNo)
		assetNo := getExcelCellValue(row, indexes.AssetNo)
		toolName := getExcelCellValue(row, indexes.ToolName)

		if warehouseName == "" && warehouseNo == "" && assetNo == "" && toolName == "" {
			continue
		}

		result = append(result, app.ImportExcelRow{
			Row:           i + 1,
			WarehouseName: warehouseName,
			WarehouseNo:   warehouseNo,
			AssetNo:       assetNo,
			ToolName:      toolName,
		})
	}

	return result, nil
}

func (h *Handler) importWarehousesToolsExcel(c *gin.Context) {
	user, _ := CurrentUser(c)
	fileHeader, err := c.FormFile("file")
	if err != nil {
		WriteError(c, apierr.InvalidRequest("file is required", nil))
		return
	}
	if !strings.HasSuffix(strings.ToLower(strings.TrimSpace(fileHeader.Filename)), ".xlsx") {
		WriteError(c, apierr.InvalidRequest("file must be .xlsx", nil))
		return
	}

	file, err := fileHeader.Open()
	if err != nil {
		WriteError(c, apierr.InvalidRequest("failed to open uploaded file", nil))
		return
	}
	defer file.Close()

	workbook, err := excelize.OpenReader(file)
	if err != nil {
		WriteError(c, apierr.InvalidRequest("invalid xlsx file", nil))
		return
	}
	defer workbook.Close()

	sheetName := strings.TrimSpace(c.Query("sheet"))
	if sheetName == "" {
		sheets := workbook.GetSheetList()
		if len(sheets) == 0 {
			WriteError(c, apierr.InvalidRequest("xlsx has no sheets", nil))
			return
		}
		sheetName = sheets[0]
	}

	rawRows, err := workbook.GetRows(sheetName)
	if err != nil {
		WriteError(c, apierr.InvalidRequest("sheet is invalid", map[string]any{"sheet": sheetName}))
		return
	}
	rows, missingHeaders := parseImportExcelRows(rawRows)
	if len(missingHeaders) > 0 {
		WriteError(c, apierr.InvalidRequest("required headers are missing", map[string]any{
			"headers": missingHeaders,
		}))
		return
	}
	if len(rows) == 0 {
		WriteError(c, apierr.InvalidRequest("no import rows found", nil))
		return
	}

	result, err := h.svc.ImportWarehousesToolsFromExcel(c.Request.Context(), user.ID, rows)
	if err != nil {
		WriteError(c, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"warehousesCreated": result.WarehousesCreated,
		"warehousesUpdated": result.WarehousesUpdated,
		"toolsCreated":      result.ToolsCreated,
	})
}

func (h *Handler) deleteTool(c *gin.Context) {
	user, _ := CurrentUser(c)
	toolID, err := uuid.Parse(strings.TrimSpace(c.Param("toolId")))
	if err != nil {
		WriteError(c, apierr.InvalidRequest("toolId is invalid", nil))
		return
	}
	if err := h.svc.DeleteTool(c.Request.Context(), user.ID, toolID); err != nil {
		WriteError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handler) retireTool(c *gin.Context) {
	user, _ := CurrentUser(c)
	toolID, err := uuid.Parse(strings.TrimSpace(c.Param("toolId")))
	if err != nil {
		WriteError(c, apierr.InvalidRequest("toolId is invalid", nil))
		return
	}
	if err := h.svc.RetireTool(c.Request.Context(), user.ID, toolID); err != nil {
		WriteError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

type optionalString struct {
	Set   bool
	Value *string
}

func (o *optionalString) UnmarshalJSON(data []byte) error {
	o.Set = true
	if string(data) == "null" {
		o.Value = nil
		return nil
	}

	var v string
	if err := json.Unmarshal(data, &v); err != nil {
		return err
	}
	o.Value = &v
	return nil
}

type patchToolRequest struct {
	ToolID      *string        `json:"toolId"`
	AssetNo     *string        `json:"assetNo"`
	Name        *string        `json:"name"`
	WarehouseID *string        `json:"warehouseId"`
	BaseStatus  *string        `json:"baseStatus"`
	Retired     *bool          `json:"retired"`
	TagID       optionalString `json:"tagId"`
}

func (h *Handler) patchTool(c *gin.Context) {
	user, _ := CurrentUser(c)
	toolID, err := uuid.Parse(c.Param("toolId"))
	if err != nil {
		WriteError(c, apierr.InvalidRequest("toolId is invalid", nil))
		return
	}
	var req patchToolRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteError(c, apierr.InvalidRequest("invalid request body", nil))
		return
	}

	var warehouseID *uuid.UUID
	if req.WarehouseID != nil {
		parsed, parseErr := uuid.Parse(strings.TrimSpace(*req.WarehouseID))
		if parseErr != nil {
			WriteError(c, apierr.InvalidRequest("warehouseId is invalid", nil))
			return
		}
		warehouseID = &parsed
	}

	if req.Retired != nil && *req.Retired {
		if err := h.svc.RetireTool(c.Request.Context(), user.ID, toolID); err != nil {
			WriteError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"id":      toolID,
			"retired": true,
		})
		return
	}

	assetNo := req.AssetNo
		if req.ToolID != nil {
			if assetNo == nil {
				assetNo = req.ToolID
			} else if strings.TrimSpace(*assetNo) != strings.TrimSpace(*req.ToolID) {
				WriteError(c, apierr.InvalidRequest("assetNo and toolId do not match", nil))
				return
			}
		}

	tool, err := h.svc.UpdateTool(c.Request.Context(), user.ID, toolID, app.UpdateToolInput{
		AssetNo:     assetNo,
		Name:        req.Name,
		WarehouseID: warehouseID,
		BaseStatus:  req.BaseStatus,
		TagID:       req.TagID.Value,
		TagIDSet:    req.TagID.Set,
	})
	if err != nil {
		WriteError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"id":          tool.ID,
		"toolId":      tool.AssetNo,
		"assetNo":     tool.AssetNo,
		"tagId":       nullableNullString(tool.TagID),
		"name":        tool.Name,
		"warehouseId": tool.WarehouseID,
		"baseStatus":  tool.BaseStatus,
	})
}

func (h *Handler) getToolByTag(c *gin.Context) {
	tagID := strings.TrimSpace(c.Param("tagId"))
	if tagID == "" {
		WriteError(c, apierr.InvalidRequest("tagId is required", nil))
		return
	}

	tool, err := h.svc.GetToolByTag(c.Request.Context(), tagID)
	if err != nil {
		WriteError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":          tool.ID,
		"assetNo":     tool.AssetNo,
		"tagId":       nullableNullString(tool.TagID),
		"name":        tool.Name,
		"warehouseId": tool.WarehouseID,
		"baseStatus":  tool.BaseStatus,
	})
}

type createLoanBoxRequest struct {
	StartDate        string            `json:"startDate"`
	DueDate          string            `json:"dueDate"`
	ToolIDs          []string          `json:"toolIds"`
	ItemDueOverrides map[string]string `json:"itemDueOverrides"`
}

func (h *Handler) createLoanBox(c *gin.Context) {
	user, _ := CurrentUser(c)
	var req createLoanBoxRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteError(c, apierr.InvalidRequest("invalid request body", nil))
		return
	}
	startDate, err := h.svc.ParseDateJST(req.StartDate)
	if err != nil {
		WriteError(c, apierr.InvalidRequest("startDate must be YYYY-MM-DD", nil))
		return
	}
	dueDate, err := h.svc.ParseDateJST(req.DueDate)
	if err != nil {
		WriteError(c, apierr.InvalidRequest("dueDate must be YYYY-MM-DD", nil))
		return
	}

	toolIDs := make([]uuid.UUID, 0, len(req.ToolIDs))
	for _, raw := range req.ToolIDs {
		id, parseErr := uuid.Parse(strings.TrimSpace(raw))
		if parseErr != nil {
			WriteError(c, apierr.InvalidRequest("toolIds contains invalid uuid", map[string]any{"toolId": raw}))
			return
		}
		toolIDs = append(toolIDs, id)
	}

	overrides := make(map[uuid.UUID]time.Time)
	for toolIDRaw, dueRaw := range req.ItemDueOverrides {
		toolID, parseErr := uuid.Parse(strings.TrimSpace(toolIDRaw))
		if parseErr != nil {
			WriteError(c, apierr.InvalidRequest("itemDueOverrides contains invalid toolId", map[string]any{"toolId": toolIDRaw}))
			return
		}
		due, parseDateErr := h.svc.ParseDateJST(dueRaw)
		if parseDateErr != nil {
			WriteError(c, apierr.InvalidRequest("itemDueOverrides due date must be YYYY-MM-DD", map[string]any{"toolId": toolIDRaw}))
			return
		}
		overrides[toolID] = due
	}

	result, err := h.svc.CreateLoanBox(c.Request.Context(), user.ID, app.CreateLoanBoxInput{
		StartDate:        startDate,
		DueDate:          dueDate,
		ToolIDs:          toolIDs,
		ItemDueOverrides: overrides,
	})
	if err != nil {
		WriteError(c, err)
		return
	}

	createdItems := make([]gin.H, 0, len(result.CreatedItems))
	for _, item := range result.CreatedItems {
		createdItems = append(createdItems, gin.H{
			"loanItemId": item.LoanItemID,
			"toolId":     item.ToolID,
			"startDate":  h.svc.DateString(item.StartDate),
			"dueDate":    h.svc.DateString(item.DueDate),
		})
	}

	c.JSON(http.StatusCreated, gin.H{
		"boxId":          result.BoxID,
		"boxDisplayName": result.BoxDisplayName,
		"createdItems":   createdItems,
	})
}

func (h *Handler) listMyLoans(c *gin.Context) {
	user, _ := CurrentUser(c)
	items, err := h.svc.ListMyOpenLoans(c.Request.Context(), user.ID)
	if err != nil {
		WriteError(c, err)
		return
	}

	resp := make([]gin.H, 0, len(items))
	for _, item := range items {
		resp = append(resp, gin.H{
			"loanItemId":        item.LoanItemID,
			"boxId":             item.BoxID,
			"boxDisplayName":    item.BoxDisplayName,
			"toolId":            item.ToolID,
			"assetNo":           item.AssetNo,
			"toolName":          item.ToolName,
			"startDate":         item.StartDate,
			"dueDate":           item.DueDate,
			"status":            item.LoanStatus,
			"returnRequestedAt": nullableString(item.ReturnRequestedAt),
		})
	}
	c.JSON(http.StatusOK, resp)
}

func (h *Handler) returnRequest(c *gin.Context) {
	user, _ := CurrentUser(c)
	loanItemID, err := uuid.Parse(c.Param("loanItemId"))
	if err != nil {
		WriteError(c, apierr.InvalidRequest("loanItemId is invalid", nil))
		return
	}
	if err := h.svc.RequestReturn(c.Request.Context(), user.ID, loanItemID); err != nil {
		WriteError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handler) listReturnRequests(c *gin.Context) {
	boxes, err := h.svc.ListReturnRequests(c.Request.Context())
	if err != nil {
		WriteError(c, err)
		return
	}

	resp := make([]gin.H, 0, len(boxes))
	for _, box := range boxes {
		items := make([]gin.H, 0, len(box.Items))
		for _, item := range box.Items {
			items = append(items, gin.H{
				"loanItemId":        item.LoanItemID,
				"toolId":            item.ToolID,
				"assetNo":           item.AssetNo,
				"toolName":          item.ToolName,
				"startDate":         item.StartDate,
				"dueDate":           item.DueDate,
				"returnRequestedAt": item.ReturnRequestedAt,
			})
		}
		resp = append(resp, gin.H{
			"boxId":            box.BoxID,
			"boxDisplayName":   box.BoxDisplayName,
			"borrowerUsername": box.BorrowerUsername,
			"startDate":        box.StartDate,
			"dueDate":          box.DueDate,
			"items":            items,
		})
	}

	c.JSON(http.StatusOK, resp)
}

type approveBoxRequest struct {
	BoxID string `json:"boxId"`
}

func (h *Handler) approveReturnBox(c *gin.Context) {
	user, _ := CurrentUser(c)
	var req approveBoxRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteError(c, apierr.InvalidRequest("invalid request body", nil))
		return
	}
	boxID, err := uuid.Parse(strings.TrimSpace(req.BoxID))
	if err != nil {
		WriteError(c, apierr.InvalidRequest("boxId is invalid", nil))
		return
	}
	count, err := h.svc.ApproveReturnBox(c.Request.Context(), user.ID, boxID)
	if err != nil {
		WriteError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"approvedCount": count})
}

type approveItemsRequest struct {
	BoxID       string   `json:"boxId"`
	LoanItemIDs []string `json:"loanItemIds"`
}

func (h *Handler) approveReturnItems(c *gin.Context) {
	user, _ := CurrentUser(c)
	var req approveItemsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteError(c, apierr.InvalidRequest("invalid request body", nil))
		return
	}
	boxID, err := uuid.Parse(strings.TrimSpace(req.BoxID))
	if err != nil {
		WriteError(c, apierr.InvalidRequest("boxId is invalid", nil))
		return
	}
	itemIDs := make([]uuid.UUID, 0, len(req.LoanItemIDs))
	for _, raw := range req.LoanItemIDs {
		id, parseErr := uuid.Parse(strings.TrimSpace(raw))
		if parseErr != nil {
			WriteError(c, apierr.InvalidRequest("loanItemIds contains invalid id", map[string]any{"loanItemId": raw}))
			return
		}
		itemIDs = append(itemIDs, id)
	}
	count, err := h.svc.ApproveReturnItems(c.Request.Context(), user.ID, boxID, itemIDs)
	if err != nil {
		WriteError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"approvedCount": count})
}

type createUserRequest struct {
	Department string `json:"department"`
	UserCode   string `json:"userCode"`
	Username   string `json:"username"`
	Email      string `json:"email"`
	Password   string `json:"password"`
	Role       string `json:"role"`
}

type patchUserRequest struct {
	Department *string `json:"department"`
	UserCode   *string `json:"userCode"`
	Username   *string `json:"username"`
	Email      *string `json:"email"`
	Role       *string `json:"role"`
}

func (h *Handler) listUsers(c *gin.Context) {
	filter := app.UserListFilter{
		Page:     parsePositiveInt(c.Query("page"), 1),
		PageSize: parsePositiveInt(c.DefaultQuery("pageSize", "10"), 10),
	}
	if filter.PageSize > 100 {
		filter.PageSize = 100
	}

	result, err := h.svc.ListUsers(c.Request.Context(), filter)
	if err != nil {
		WriteError(c, err)
		return
	}

	resp := make([]gin.H, 0, len(result.Items))
	for _, user := range result.Items {
		resp = append(resp, gin.H{
			"id":         user.ID,
			"department": user.Department,
			"userCode":   user.UserCode,
			"username":   user.Username,
			"email":      user.Email,
			"role":       user.Role,
			"createdAt":  user.CreatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"items":    resp,
		"page":     result.Page,
		"pageSize": result.PageSize,
		"total":    result.Total,
	})
}

func (h *Handler) createUser(c *gin.Context) {
	var req createUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteError(c, apierr.InvalidRequest("invalid request body", nil))
		return
	}
	user, err := h.svc.CreateUser(c.Request.Context(), app.CreateUserInput{
		Department: req.Department,
		UserCode:   req.UserCode,
		Username:   req.Username,
		Email:      req.Email,
		Password:   req.Password,
		Role:       req.Role,
	})
	if err != nil {
		WriteError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{
		"id":         user.ID,
		"department": user.Department,
		"userCode":   user.UserCode,
		"username":   user.Username,
		"email":      user.Email,
		"role":       user.Role,
	})
}

func (h *Handler) deleteUser(c *gin.Context) {
	admin, _ := CurrentUser(c)
	userID, err := uuid.Parse(strings.TrimSpace(c.Param("userId")))
	if err != nil {
		WriteError(c, apierr.InvalidRequest("userId is invalid", nil))
		return
	}

	if err := h.svc.DeleteUser(c.Request.Context(), admin.ID, userID); err != nil {
		WriteError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handler) patchUser(c *gin.Context) {
	admin, _ := CurrentUser(c)
	userID, err := uuid.Parse(strings.TrimSpace(c.Param("userId")))
	if err != nil {
		WriteError(c, apierr.InvalidRequest("userId is invalid", nil))
		return
	}
	var req patchUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteError(c, apierr.InvalidRequest("invalid request body", nil))
		return
	}

	updated, err := h.svc.UpdateUser(c.Request.Context(), admin.ID, userID, app.UpdateUserInput{
		Department: req.Department,
		UserCode:   req.UserCode,
		Username:   req.Username,
		Email:      req.Email,
		Role:       req.Role,
	})
	if err != nil {
		WriteError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":         updated.ID,
		"department": updated.Department,
		"userCode":   updated.UserCode,
		"username":   updated.Username,
		"email":      updated.Email,
		"role":       updated.Role,
	})
}

func (h *Handler) listSignupRequests(c *gin.Context) {
	items, err := h.svc.ListPendingSignupRequests(c.Request.Context())
	if err != nil {
		WriteError(c, err)
		return
	}

	resp := make([]gin.H, 0, len(items))
	for _, item := range items {
		resp = append(resp, gin.H{
			"department":  item.Department,
			"id":          item.ID,
			"username":    item.Username,
			"email":       item.Email,
			"status":      item.Status,
			"requestedAt": item.RequestedAt,
		})
	}
	c.JSON(http.StatusOK, resp)
}

func (h *Handler) approveSignupRequest(c *gin.Context) {
	admin, _ := CurrentUser(c)
	requestID, err := uuid.Parse(strings.TrimSpace(c.Param("requestId")))
	if err != nil {
		WriteError(c, apierr.InvalidRequest("requestId is invalid", nil))
		return
	}

	user, err := h.svc.ApproveSignupRequest(c.Request.Context(), admin.ID, requestID)
	if err != nil {
		WriteError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"ok": true,
		"user": gin.H{
			"id":         user.ID,
			"department": user.Department,
			"userCode":   user.UserCode,
			"username":   user.Username,
			"email":      user.Email,
			"role":       user.Role,
		},
	})
}

func parsePositiveInt(v string, fallback int) int {
	if strings.TrimSpace(v) == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil || n <= 0 {
		return fallback
	}
	return n
}

func parseOptionalWarehouseID(raw string) (string, error) {
	v := strings.TrimSpace(raw)
	if v == "" {
		return "", nil
	}
	id, err := uuid.Parse(v)
	if err != nil {
		return "", err
	}
	return id.String(), nil
}

func parseOptionalUUID(raw string) (*uuid.UUID, error) {
	v := strings.TrimSpace(raw)
	if v == "" {
		return nil, nil
	}
	id, err := uuid.Parse(v)
	if err != nil {
		return nil, err
	}
	return &id, nil
}

func parseOptionalTimestamp(raw string, endOfDay bool) (*time.Time, error) {
	v := strings.TrimSpace(raw)
	if v == "" {
		return nil, nil
	}
	if parsed, err := time.Parse(time.RFC3339, v); err == nil {
		return &parsed, nil
	}
	jst, err := time.LoadLocation("Asia/Tokyo")
	if err != nil {
		return nil, err
	}
	parsedDate, err := time.ParseInLocation("2006-01-02", v, jst)
	if err != nil {
		return nil, err
	}
	if endOfDay {
		parsedDate = parsedDate.Add(24*time.Hour - time.Nanosecond)
	}
	return &parsedDate, nil
}

func nullableString(v string) any {
	if strings.TrimSpace(v) == "" {
		return nil
	}
	return v
}

func nullableNullString(v sql.NullString) any {
	if !v.Valid || strings.TrimSpace(v.String) == "" {
		return nil
	}
	return v.String
}
