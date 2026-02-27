package api

import (
	"testing"
	"time"
)

func TestParseOptionalTimestamp_DateStartOfDayJST(t *testing.T) {
	got, err := parseOptionalTimestamp("2026-02-26", false)
	if err != nil {
		t.Fatalf("parseOptionalTimestamp error = %v", err)
	}
	if got == nil {
		t.Fatalf("parseOptionalTimestamp returned nil time")
	}

	jst, locErr := time.LoadLocation("Asia/Tokyo")
	if locErr != nil {
		t.Fatalf("LoadLocation error = %v", locErr)
	}
	want := time.Date(2026, 2, 26, 0, 0, 0, 0, jst)
	if !got.Equal(want) {
		t.Fatalf("time = %s, want %s", got.Format(time.RFC3339Nano), want.Format(time.RFC3339Nano))
	}
}

func TestParseOptionalTimestamp_DateEndOfDayJST(t *testing.T) {
	got, err := parseOptionalTimestamp("2026-02-26", true)
	if err != nil {
		t.Fatalf("parseOptionalTimestamp error = %v", err)
	}
	if got == nil {
		t.Fatalf("parseOptionalTimestamp returned nil time")
	}

	jst, locErr := time.LoadLocation("Asia/Tokyo")
	if locErr != nil {
		t.Fatalf("LoadLocation error = %v", locErr)
	}
	want := time.Date(2026, 2, 26, 23, 59, 59, int(time.Second-time.Nanosecond), jst)
	if !got.Equal(want) {
		t.Fatalf("time = %s, want %s", got.Format(time.RFC3339Nano), want.Format(time.RFC3339Nano))
	}
}

func TestParseOptionalTimestamp_RFC3339Preferred(t *testing.T) {
	got, err := parseOptionalTimestamp("2026-02-26T03:04:05Z", false)
	if err != nil {
		t.Fatalf("parseOptionalTimestamp error = %v", err)
	}
	if got == nil {
		t.Fatalf("parseOptionalTimestamp returned nil time")
	}

	want := time.Date(2026, 2, 26, 3, 4, 5, 0, time.UTC)
	if !got.Equal(want) {
		t.Fatalf("time = %s, want %s", got.Format(time.RFC3339Nano), want.Format(time.RFC3339Nano))
	}
}

func TestParseOptionalTimestamp_Invalid(t *testing.T) {
	got, err := parseOptionalTimestamp("invalid", false)
	if err == nil {
		t.Fatalf("expected error for invalid timestamp, got time %v", got)
	}
}
