package errors

import "net/http"

type APIError struct {
	Status  int
	Code    string
	Message string
	Details any
}

func (e *APIError) Error() string {
	return e.Code + ": " + e.Message
}

func New(status int, code, message string, details any) *APIError {
	return &APIError{Status: status, Code: code, Message: message, Details: details}
}

func InvalidRequest(message string, details any) *APIError {
	return New(http.StatusBadRequest, "INVALID_REQUEST", message, details)
}

func Unauthorized(message string) *APIError {
	return New(http.StatusUnauthorized, "UNAUTHORIZED", message, nil)
}

func Forbidden(message string) *APIError {
	return New(http.StatusForbidden, "FORBIDDEN", message, nil)
}

func Conflict(code, message string, details any) *APIError {
	return New(http.StatusConflict, code, message, details)
}

func NotFound(message string) *APIError {
	return New(http.StatusNotFound, "NOT_FOUND", message, nil)
}

func Internal(message string) *APIError {
	return New(http.StatusInternalServerError, "INTERNAL_ERROR", message, nil)
}
