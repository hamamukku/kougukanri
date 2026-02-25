package api

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"kougukanri/backend/internal/app"
	"kougukanri/backend/internal/auth"
	apierr "kougukanri/backend/internal/errors"
)

type AuthUser struct {
	ID       uuid.UUID
	Role     string
	UserName string
}

const authUserContextKey = "auth_user"

func AuthMiddleware(jwtManager *auth.JWTManager, svc *app.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		authz := c.GetHeader("Authorization")
		if authz == "" {
			WriteError(c, apierr.Unauthorized("missing Authorization header"))
			c.Abort()
			return
		}

		parts := strings.SplitN(authz, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") || strings.TrimSpace(parts[1]) == "" {
			WriteError(c, apierr.Unauthorized("invalid Authorization header"))
			c.Abort()
			return
		}

		claims, err := jwtManager.Parse(strings.TrimSpace(parts[1]))
		if err != nil {
			WriteError(c, apierr.Unauthorized("invalid token"))
			c.Abort()
			return
		}

		userID, err := uuid.Parse(claims.Subject)
		if err != nil {
			WriteError(c, apierr.Unauthorized("invalid token subject"))
			c.Abort()
			return
		}

		user, err := svc.GetUser(c.Request.Context(), userID)
		if err != nil {
			WriteError(c, err)
			c.Abort()
			return
		}

		c.Set(authUserContextKey, AuthUser{
			ID:       user.ID,
			Role:     user.Role,
			UserName: user.Username,
		})
		c.Next()
	}
}

func RequireRole(role string) gin.HandlerFunc {
	return func(c *gin.Context) {
		user, ok := CurrentUser(c)
		if !ok {
			WriteError(c, apierr.Unauthorized("unauthorized"))
			c.Abort()
			return
		}
		if user.Role != role {
			WriteError(c, apierr.Forbidden("forbidden"))
			c.Abort()
			return
		}
		c.Next()
	}
}

func CurrentUser(c *gin.Context) (AuthUser, bool) {
	v, ok := c.Get(authUserContextKey)
	if !ok {
		return AuthUser{}, false
	}
	user, ok := v.(AuthUser)
	return user, ok
}

func AbortUnauthorized(c *gin.Context) {
	c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": gin.H{"code": "UNAUTHORIZED", "message": "unauthorized"}})
}
