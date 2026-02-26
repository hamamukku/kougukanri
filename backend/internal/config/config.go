package config

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	Port            string
	DBURL           string
	JWTSecret       string
	JWTExpiresHours int
	MigrationsPath  string

	SMTPHost     string
	SMTPPort     int
	SMTPUsername string
	SMTPPassword string
	SMTPFrom     string

	CronEnabled bool

	EnableSeedAdmin     bool
	SeedAdminUsername   string
	SeedAdminEmail      string
	SeedAdminPassword   string
	SeedAdminDepartment string
}

func Load() (Config, error) {
	cfg := Config{
		Port:                getEnv("PORT", "3000"),
		DBURL:               os.Getenv("DATABASE_URL"),
		JWTSecret:           getEnv("JWT_SECRET", "change-me"),
		JWTExpiresHours:     getEnvInt("JWT_EXPIRES_HOURS", 24),
		MigrationsPath:      getEnv("MIGRATIONS_PATH", "file://./db/migrations"),
		SMTPHost:            os.Getenv("SMTP_HOST"),
		SMTPPort:            getEnvInt("SMTP_PORT", 587),
		SMTPUsername:        os.Getenv("SMTP_USERNAME"),
		SMTPPassword:        os.Getenv("SMTP_PASSWORD"),
		SMTPFrom:            os.Getenv("SMTP_FROM"),
		CronEnabled:         getEnvBool("CRON_ENABLED", true),
		EnableSeedAdmin:     getEnvBool("ENABLE_SEED_ADMIN", false),
		SeedAdminUsername:   os.Getenv("SEED_ADMIN_USERNAME"),
		SeedAdminEmail:      os.Getenv("SEED_ADMIN_EMAIL"),
		SeedAdminPassword:   os.Getenv("SEED_ADMIN_PASSWORD"),
		SeedAdminDepartment: getEnv("SEED_ADMIN_DEPARTMENT", "system"),
	}

	if cfg.DBURL == "" {
		return cfg, fmt.Errorf("DATABASE_URL is required")
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}

func getEnvBool(key string, fallback bool) bool {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return fallback
	}
	return b
}
