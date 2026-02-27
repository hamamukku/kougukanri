package notify

import (
	"testing"

	"kougukanri/backend/internal/config"
)

func TestNewNotifierSelection(t *testing.T) {
	cases := []struct {
		name          string
		cfg           config.Config
		wantWebhook   bool
	}{
		{
			name: "url-empty-always-noop",
			cfg: config.Config{
				NotifyEnabled:    true,
				NotifyWebhookURL: "",
			},
			wantWebhook: false,
		},
		{
			name: "url-present-enabled-false-noop",
			cfg: config.Config{
				NotifyEnabled:    false,
				NotifyWebhookURL: "https://example.com/webhook",
			},
			wantWebhook: false,
		},
		{
			name: "url-present-enabled-true-webhook",
			cfg: config.Config{
				NotifyEnabled:    true,
				NotifyWebhookURL: "https://example.com/webhook",
			},
			wantWebhook: true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			n := NewNotifier(tc.cfg)
			_, isWebhook := n.(*WebhookNotifier)
			if isWebhook != tc.wantWebhook {
				t.Fatalf("isWebhook = %v, want %v", isWebhook, tc.wantWebhook)
			}
		})
	}
}
