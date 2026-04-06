package endpoints

import (
	"strings"
	"testing"
)

func TestIsValidEmail(t *testing.T) {
	tests := []struct {
		name  string
		email string
		want  bool
	}{
		{name: "valid basic", email: "user@example.com", want: true},
		{name: "valid subdomain", email: "user@mail.example.com", want: true},
		{name: "missing at", email: "userexample.com", want: false},
		{name: "missing domain", email: "user@", want: false},
		{name: "contains whitespace", email: "user @example.com", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := isValidEmail(tt.email)
			if got != tt.want {
				t.Fatalf("isValidEmail(%q) = %v, want %v", tt.email, got, tt.want)
			}
		})
	}
}

func TestIsValidUsername(t *testing.T) {
	tests := []struct {
		name     string
		username string
		want     bool
	}{
		{name: "valid", username: "user_123", want: true},
		{name: "too short", username: "ab", want: false},
		{name: "too long", username: "abcdefghijklmnopqrstuvwxyz1234567", want: false},
		{name: "invalid chars", username: "user-name", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := isValidUsername(tt.username)
			if got != tt.want {
				t.Fatalf("isValidUsername(%q) = %v, want %v", tt.username, got, tt.want)
			}
		})
	}
}

func TestIsValidPassword(t *testing.T) {
	tests := []struct {
		name     string
		password string
		want     bool
	}{
		{name: "valid", password: "abc12345", want: true},
		{name: "only letters", password: "abcdefgh", want: false},
		{name: "only numbers", password: "12345678", want: false},
		{name: "too short", password: "a1b2c3", want: false},
		{name: "too long", password: "a1" + strings.Repeat("b", 127), want: false},
		{name: "contains uppercase and digit", password: "Password9", want: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := isValidPassword(tt.password)
			if got != tt.want {
				t.Fatalf("isValidPassword(%q) = %v, want %v", tt.password, got, tt.want)
			}
		})
	}
}
