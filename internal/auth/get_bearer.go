package auth

import (
	"errors"
	"net/http"
	"strings"
)

func GetBearer(headers http.Header) (string, error) {
	authHeader := headers.Get("Authorization")
	if authHeader == "" {
		return "", errors.New("Authorization header not found")
	}
	const prefix = "Bearer "
	if !strings.HasPrefix(authHeader, prefix) {
		return "", errors.New("Invalid authorization format")

	}
	return strings.TrimPrefix(authHeader, prefix), nil
}
