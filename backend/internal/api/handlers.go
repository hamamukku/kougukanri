package api

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

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

	authed := apiGroup.Group("")
	authed.Use(AuthMiddleware(h.jwtManager, h.svc))

	authed.GET("/auth/me", h.me)
	authed.GET("/warehouses", h.listWarehouses)
	authed.GET("/tools", h.listTools)

	authed.POST("/loan-boxes", h.createLoanBox)
	authed.GET("/my/loans", h.listMyLoans)
	authed.POST("/my/loans/:loanItemId/return-request", h.returnRequest)

	admin := apiGroup.Group("/admin")
	admin.Use(AuthMiddleware(h.jwtManager, h.svc), RequireRole(app.RoleAdmin))
	admin.POST("/warehouses", h.createWarehouse)
	admin.GET("/tools", h.listAdminTools)
	admin.POST("/tools", h.createTool)
	admin.PATCH("/tools/:toolId", h.patchTool)
	admin.GET("/returns/requests", h.listReturnRequests)
	admin.POST("/returns/approve-box", h.approveReturnBox)
	admin.POST("/returns/approve-items", h.approveReturnItems)
	admin.POST("/users", h.createUser)
}

type loginRequest struct {
	LoginID  string `json:"loginId"`
	Password string `json:"password"`
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

func (h *Handler) listWarehouses(c *gin.Context) {
	items, err := h.svc.ListWarehouses(c.Request.Context())
	if err != nil {
		WriteError(c, err)
		return
	}

	resp := make([]gin.H, 0, len(items))
	for _, w := range items {
		resp = append(resp, gin.H{
			"id":   w.ID,
			"name": w.Name,
		})
	}
	c.JSON(http.StatusOK, resp)
}

type createWarehouseRequest struct {
	Name string `json:"name"`
}

func (h *Handler) createWarehouse(c *gin.Context) {
	user, _ := CurrentUser(c)
	var req createWarehouseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteError(c, apierr.InvalidRequest("invalid request body", nil))
		return
	}
	item, err := h.svc.CreateWarehouse(c.Request.Context(), user.ID, req.Name)
	if err != nil {
		WriteError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": item.ID, "name": item.Name})
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
			"assetNo":                     t.AssetNo,
			"name":                        t.Name,
			"warehouseId":                 t.WarehouseID,
			"warehouseName":               t.WarehouseName,
			"baseStatus":                  t.BaseStatus,
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
		"assetNo":     tool.AssetNo,
		"name":        tool.Name,
		"warehouseId": tool.WarehouseID,
		"baseStatus":  tool.BaseStatus,
	})
}

type patchToolRequest struct {
	Name        *string `json:"name"`
	WarehouseID *string `json:"warehouseId"`
	BaseStatus  *string `json:"baseStatus"`
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

	tool, err := h.svc.UpdateTool(c.Request.Context(), user.ID, toolID, app.UpdateToolInput{
		Name:        req.Name,
		WarehouseID: warehouseID,
		BaseStatus:  req.BaseStatus,
	})
	if err != nil {
		WriteError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"id":          tool.ID,
		"assetNo":     tool.AssetNo,
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
	Username   string `json:"username"`
	Email      string `json:"email"`
	Password   string `json:"password"`
	Role       string `json:"role"`
}

func (h *Handler) createUser(c *gin.Context) {
	var req createUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteError(c, apierr.InvalidRequest("invalid request body", nil))
		return
	}
	user, err := h.svc.CreateUser(c.Request.Context(), app.CreateUserInput{
		Department: req.Department,
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
		"username":   user.Username,
		"email":      user.Email,
		"role":       user.Role,
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

func nullableString(v string) any {
	if strings.TrimSpace(v) == "" {
		return nil
	}
	return v
}
