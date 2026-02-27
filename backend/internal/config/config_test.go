package config

import (
	"os"
	"testing"
)

func strPtr(v string) *string {
	return &v
}

func setEnvOptional(t *testing.T, key string, value *string) {
	t.Helper()

	oldValue, hadValue := os.LookupEnv(key)
	if value == nil {
		_ = os.Unsetenv(key)
	} else {
		_ = os.Setenv(key, *value)
	}

	t.Cleanup(func() {
		if hadValue {
			_ = os.Setenv(key, oldValue)
			return
		}
		_ = os.Unsetenv(key)
	})
}

func TestLoadNotifyEnabledPolicyA(t *testing.T) {
	cases := []struct {
		name              string
		notifyWebhookURL  *string
		notifyEnabledEnv  *string
		expectedEnabled   bool
		expectedWebhook   string
	}{
		{
			name:             "url-empty-always-disabled-even-when-enabled-true",
			notifyWebhookURL: strPtr(""),
			notifyEnabledEnv: strPtr("true"),
			expectedEnabled:  false,
			expectedWebhook:  "",
		},
		{
			name:             "url-present-default-enabled-when-notify-enabled-unset",
			notifyWebhookURL: strPtr("https://example.com/webhook"),
			notifyEnabledEnv: nil,
			expectedEnabled:  true,
			expectedWebhook:  "https://example.com/webhook",
		},
		{
			name:             "url-present-explicit-true",
			notifyWebhookURL: strPtr("https://example.com/webhook"),
			notifyEnabledEnv: strPtr("true"),
			expectedEnabled:  true,
			expectedWebhook:  "https://example.com/webhook",
		},
		{
			name:             "url-present-explicit-false",
			notifyWebhookURL: strPtr("https://example.com/webhook"),
			notifyEnabledEnv: strPtr("false"),
			expectedEnabled:  false,
			expectedWebhook:  "https://example.com/webhook",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			setEnvOptional(t, "DATABASE_URL", strPtr("postgres://postgres:postgres@localhost:5432/kougukanri?sslmode=disable"))
			setEnvOptional(t, "NOTIFY_WEBHOOK_URL", tc.notifyWebhookURL)
			setEnvOptional(t, "NOTIFY_ENABLED", tc.notifyEnabledEnv)

			cfg, err := Load()
			if err != nil {
				t.Fatalf("Load() error = %v", err)
			}

			if cfg.NotifyEnabled != tc.expectedEnabled {
				t.Fatalf("NotifyEnabled = %v, want %v", cfg.NotifyEnabled, tc.expectedEnabled)
			}
			if cfg.NotifyWebhookURL != tc.expectedWebhook {
				t.Fatalf("NotifyWebhookURL = %q, want %q", cfg.NotifyWebhookURL, tc.expectedWebhook)
			}
		})
	}
}
