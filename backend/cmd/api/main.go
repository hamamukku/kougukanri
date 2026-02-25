package main

import (
	"context"
	"database/sql"
	"flag"
	"log"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"

	"kougukanri/backend/internal/api"
	"kougukanri/backend/internal/app"
	"kougukanri/backend/internal/auth"
	"kougukanri/backend/internal/config"
	"kougukanri/backend/internal/cronjob"
	"kougukanri/backend/internal/db"
	"kougukanri/backend/internal/mail"
)

func main() {
	runOverdueOnce := flag.Bool("run-overdue-once", false, "run overdue mail job once and exit")
	flag.Parse()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config load failed: %v", err)
	}

	database, err := openDBWithRetry(cfg.DBURL, 45, 2*time.Second)
	if err != nil {
		log.Fatalf("db connection failed: %v", err)
	}
	defer database.Close()

	if err := app.RunMigrations(cfg.DBURL, cfg.MigrationsPath); err != nil {
		log.Fatalf("migration failed: %v", err)
	}

	queries := db.New(database)
	jwtManager := auth.NewJWTManager(cfg.JWTSecret, cfg.JWTExpiresHours)
	var mailer mail.Mailer
	if cfg.SMTPHost != "" && cfg.SMTPFrom != "" {
		mailer = mail.NewSMTPMailer(cfg.SMTPHost, cfg.SMTPPort, cfg.SMTPUsername, cfg.SMTPPassword, cfg.SMTPFrom)
	} else {
		mailer = mail.NewNoopMailer()
	}

	service, err := app.NewService(database, queries, jwtManager, mailer, cfg)
	if err != nil {
		log.Fatalf("service init failed: %v", err)
	}

	if err := service.EnsureSeedAdmin(context.Background()); err != nil {
		log.Fatalf("seed admin failed: %v", err)
	}

	if *runOverdueOnce {
		sent, err := service.RunOverdueNotification(context.Background())
		if err != nil {
			log.Fatalf("overdue notification failed: %v", err)
		}
		log.Printf("overdue notification sent: %d", sent)
		return
	}

	var cronRunner interface{ Stop() context.Context }
	if cfg.CronEnabled {
		c, err := cronjob.Start(service)
		if err != nil {
			log.Fatalf("cron init failed: %v", err)
		}
		cronRunner = c
		log.Printf("cron started (schedule: 06:00 JST)")
	}
	if cronRunner != nil {
		defer cronRunner.Stop()
	}

	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())

	h := api.NewHandler(service, jwtManager)
	h.RegisterRoutes(r)

	addr := ":" + cfg.Port
	log.Printf("api server listening on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}

func openDBWithRetry(databaseURL string, attempts int, wait time.Duration) (*sql.DB, error) {
	var lastErr error
	for i := 0; i < attempts; i++ {
		dbConn, err := sql.Open("postgres", databaseURL)
		if err != nil {
			lastErr = err
			time.Sleep(wait)
			continue
		}

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		pingErr := dbConn.PingContext(ctx)
		cancel()
		if pingErr == nil {
			dbConn.SetMaxOpenConns(20)
			dbConn.SetMaxIdleConns(5)
			dbConn.SetConnMaxLifetime(30 * time.Minute)
			return dbConn, nil
		}

		_ = dbConn.Close()
		lastErr = pingErr
		time.Sleep(wait)
	}
	return nil, lastErr
}
