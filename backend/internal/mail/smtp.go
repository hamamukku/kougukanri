package mail

import (
	"context"
	"fmt"
	"net/smtp"
	"strings"
)

type Mailer interface {
	Send(ctx context.Context, to []string, bcc []string, subject string, body string) error
}

type SMTPMailer struct {
	host     string
	port     int
	username string
	password string
	from     string
	auth     smtp.Auth
}

func NewSMTPMailer(host string, port int, username, password, from string) *SMTPMailer {
	m := &SMTPMailer{
		host:     host,
		port:     port,
		username: username,
		password: password,
		from:     from,
	}
	if username != "" {
		m.auth = smtp.PlainAuth("", username, password, host)
	}
	return m
}

func (m *SMTPMailer) Enabled() bool {
	return m.host != "" && m.from != ""
}

func (m *SMTPMailer) Send(_ context.Context, to []string, bcc []string, subject string, body string) error {
	if !m.Enabled() {
		return fmt.Errorf("smtp is not configured")
	}
	if len(to) == 0 {
		return fmt.Errorf("no recipient")
	}

	addr := fmt.Sprintf("%s:%d", m.host, m.port)
	recipients := append([]string{}, to...)
	recipients = append(recipients, bcc...)

	headers := []string{
		"From: " + m.from,
		"To: " + strings.Join(to, ", "),
		"Subject: " + subject,
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
	}
	message := strings.Join(headers, "\r\n") + "\r\n\r\n" + body

	return smtp.SendMail(addr, m.auth, m.from, recipients, []byte(message))
}
