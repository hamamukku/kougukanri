package api

import (
	"database/sql"
	stdErrors "errors"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"

	apierr "kougukanri/backend/internal/errors"
)

type errorEnvelope struct {
	Error errorBody `json:"error"`
}

type errorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Details any    `json:"details,omitempty"`
}

func WriteError(c *gin.Context, err error) {
	if err == nil {
		return
	}

	var apiError *apierr.APIError
	if stdErrors.As(err, &apiError) {
		c.JSON(apiError.Status, errorEnvelope{Error: errorBody{Code: apiError.Code, Message: apiError.Message, Details: apiError.Details}})
		return
	}
	if stdErrors.Is(err, sql.ErrNoRows) {
		c.JSON(http.StatusBadRequest, errorEnvelope{Error: errorBody{Code: "INVALID_REQUEST", Message: "resource not found"}})
		return
	}

	log.Printf("internal error: %v", err)
	c.JSON(http.StatusInternalServerError, errorEnvelope{Error: errorBody{Code: "INTERNAL_ERROR", Message: "internal server error"}})
}
