package auth

import (
	"errors"
	"net/http"
	"strings"
)

// Simple header trimming nothing more.
func GetBearer(headers http.Header) (string, error) {
	authHeader := strings.TrimSpace(headers.Get("Authorization"))
	if authHeader == "" {
		return "", errors.New("authorization header not found")
	}

	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 {
		return "", errors.New("invalid authorization format")
	}

	if strings.ToLower(parts[0]) != "bearer" {
		return "", errors.New("invalid authorization scheme")
	}

	token := strings.TrimSpace(parts[1])
	if token == "" {
		return "", errors.New("bearer token not found")
	}

	return token, nil
}
