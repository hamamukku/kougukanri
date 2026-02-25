package mail

import "context"

type NoopMailer struct{}

func NewNoopMailer() *NoopMailer {
	return &NoopMailer{}
}

func (m *NoopMailer) Send(_ context.Context, _ []string, _ []string, _ string, _ string) error {
	return nil
}
