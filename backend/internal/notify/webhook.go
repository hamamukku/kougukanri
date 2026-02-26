package notify

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type WebhookNotifier struct {
	url    string
	client *http.Client
}

type webhookEnvelope struct {
	Kind    string `json:"kind"`
	Payload any    `json:"payload"`
	SentAt  string `json:"sentAt"`
	Service string `json:"service"`
}

func NewWebhookNotifier(url string) *WebhookNotifier {
	return &WebhookNotifier{
		url: strings.TrimSpace(url),
		client: &http.Client{
			Timeout: 3 * time.Second,
		},
	}
}

func (n *WebhookNotifier) Notify(ctx context.Context, kind string, payload any) error {
	body, err := json.Marshal(webhookEnvelope{
		Kind:    kind,
		Payload: payload,
		SentAt:  time.Now().UTC().Format(time.RFC3339),
		Service: "kougukanri",
	})
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, n.url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := n.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= http.StatusOK && resp.StatusCode < http.StatusMultipleChoices {
		return nil
	}

	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
	message := strings.TrimSpace(string(respBody))
	if message == "" {
		return fmt.Errorf("webhook notify failed with status %d", resp.StatusCode)
	}
	return fmt.Errorf("webhook notify failed with status %d: %s", resp.StatusCode, message)
}
