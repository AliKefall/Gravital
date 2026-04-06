package auth

import (
	"net/http"
	"testing"
)

func TestGetBearer(t *testing.T) {
	tests := []struct {
		name        string
		header      string
		wantToken   string
		expectError bool
	}{
		{
			name:        "valid bearer token",
			header:      "Bearer abc123",
			wantToken:   "abc123",
			expectError: false,
		},
		{
			name:        "valid bearer with extra spaces",
			header:      "Bearer    abc123",
			wantToken:   "abc123",
			expectError: false,
		},
		{
			name:        "lowercase bearer",
			header:      "bearer abc123",
			wantToken:   "abc123",
			expectError: false,
		},
		{
			name:        "uppercase bearer",
			header:      "BEARER abc123",
			wantToken:   "abc123",
			expectError: false,
		},
		{
			name:        "missing header",
			header:      "",
			wantToken:   "",
			expectError: true,
		},
		{
			name:        "wrong scheme",
			header:      "Basic abc123",
			wantToken:   "",
			expectError: true,
		},
		{
			name:        "no token",
			header:      "Bearer ",
			wantToken:   "",
			expectError: true,
		},
		{
			name:        "only bearer word",
			header:      "Bearer",
			wantToken:   "",
			expectError: true,
		},
		{
			name:        "random garbage",
			header:      "asdasdasd",
			wantToken:   "",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			headers := http.Header{}
			if tt.header != "" {
				headers.Set("Authorization", tt.header)
			}

			token, err := GetBearer(headers)

			if tt.expectError {
				if err == nil {
					t.Fatalf("expected error, got nil (token=%s)", token)
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if token != tt.wantToken {
				t.Fatalf("expected token %q, got %q", tt.wantToken, token)
			}
		})
	}
}
