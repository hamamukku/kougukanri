package notify

import (
	"context"
	"strings"

	"kougukanri/backend/internal/config"
)

type Notifier interface {
	Notify(ctx context.Context, kind string, payload any) error
}

type noopNotifier struct{}

func NewNotifier(cfg config.Config) Notifier {
	if !cfg.NotifyEnabled || strings.TrimSpace(cfg.NotifyWebhookURL) == "" {
		return noopNotifier{}
	}
	return NewWebhookNotifier(cfg.NotifyWebhookURL)
}

func (n noopNotifier) Notify(ctx context.Context, kind string, payload any) error {
	return nil
}
