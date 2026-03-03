package mail

import (
	"context"
	"crypto/tls"
	"fmt"
	"io"
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

	if m.username == "" {
		return m.sendWithAuth(addr, nil, recipients, message)
	}

	plainErr := m.sendWithAuth(addr, m.auth, recipients, message)
	if plainErr == nil {
		return nil
	}
	loginErr := m.sendWithAuth(addr, loginAuth{username: m.username, password: m.password}, recipients, message)
	if loginErr == nil {
		return nil
	}

	return fmt.Errorf("smtp auth failed (plain=%v, login=%w)", plainErr, loginErr)
}

func (m *SMTPMailer) sendWithAuth(addr string, auth smtp.Auth, recipients []string, message string) error {
	client, err := smtp.Dial(addr)
	if err != nil {
		return err
	}
	defer client.Close()

	if ok, _ := client.Extension("STARTTLS"); ok {
		if err := client.StartTLS(&tls.Config{ServerName: m.host}); err != nil {
			return err
		}
	}

	if auth != nil {
		if err := client.Auth(auth); err != nil {
			return err
		}
	}

	if err := client.Mail(m.from); err != nil {
		return err
	}
	for _, rcpt := range recipients {
		if err := client.Rcpt(rcpt); err != nil {
			return err
		}
	}

	w, err := client.Data()
	if err != nil {
		return err
	}
	if _, err := io.WriteString(w, message); err != nil {
		_ = w.Close()
		return err
	}
	if err := w.Close(); err != nil {
		return err
	}
	return client.Quit()
}

type loginAuth struct {
	username string
	password string
}

func (a loginAuth) Start(_ *smtp.ServerInfo) (string, []byte, error) {
	return "LOGIN", nil, nil
}

func (a loginAuth) Next(fromServer []byte, more bool) ([]byte, error) {
	if !more {
		return nil, nil
	}

	challenge := strings.TrimSpace(strings.ToLower(string(fromServer)))
	switch {
	case strings.Contains(challenge, "username"):
		return []byte(a.username), nil
	case strings.Contains(challenge, "password"):
		return []byte(a.password), nil
	default:
		return nil, fmt.Errorf("unexpected smtp LOGIN challenge: %q", string(fromServer))
	}
}
