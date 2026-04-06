package main

import (
	"os"
	"strings"
)

type ServerConfig struct {
	DBUrl          string
	JWTSecret      string
	Port           string
	DBAuthToken    string
	AllowedOrigins []string
}

// As for local development I opened my frontends port too
// If you are using your own dns just delete 19th line(allowedOrigins := ...). Or don't its up to you.

func NewServer() *ServerConfig {
	allowedOrigins := []string{"http://localhost:5173"}
	if value := os.Getenv("CORS_ALLOWED_ORIGINS"); value != "" {
		parts := strings.Split(value, ",")
		allowedOrigins = make([]string, 0, len(parts))
		for _, origin := range parts {
			trimmed := strings.TrimSpace(origin)
			if trimmed == "" {
				continue
			}
			allowedOrigins = append(allowedOrigins, trimmed)
		}
	}
	return &ServerConfig{
		DBUrl:          os.Getenv("DATABASE_URL"),
		JWTSecret:      os.Getenv("JWT_SECRET"),
		Port:           os.Getenv("PORT"),
		DBAuthToken:    os.Getenv("DB_AUTH_TOKEN"),
		AllowedOrigins: allowedOrigins,
	}
}
