package auth

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type Claims struct {
	Role     string `json:"role"`
	UserName string `json:"userName"`
	jwt.RegisteredClaims
}

type JWTManager struct {
	secretKey []byte
	expiresIn time.Duration
}

func NewJWTManager(secret string, expiresHours int) *JWTManager {
	return &JWTManager{
		secretKey: []byte(secret),
		expiresIn: time.Duration(expiresHours) * time.Hour,
	}
}

func (m *JWTManager) Generate(userID uuid.UUID, role, userName string) (string, error) {
	now := time.Now().UTC()
	claims := Claims{
		Role:     role,
		UserName: userName,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(m.expiresIn)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(m.secretKey)
}

func (m *JWTManager) Parse(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (any, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return m.secretKey, nil
	})
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}

	return claims, nil
}
