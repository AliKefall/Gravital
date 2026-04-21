package main

import (
	"os"
	"strconv"
	"strings"
	"time"
)

// I was planning to implement a redis cache system for my system.
// It is simply not active at all feel free to delete them as you wish.
// Or you can expand this part. All up to you.
type ServerConfig struct {
	DBUrl               string
	JWTSecret           string
	Port                string
	DBAuthToken         string
	AllowedOrigins      []string
	RedisURL            string
	FriendCacheTTL      time.Duration
	FriendCacheFallback bool
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

	cacheTTL := 45 * time.Second
	if raw := strings.TrimSpace(os.Getenv("FRIEND_CACHE_TTL_SECONDS")); raw != "" {
		if seconds, err := strconv.Atoi(raw); err == nil && seconds > 0 {
			cacheTTL = time.Duration(seconds) * time.Second
		}
	}

	fallbackToMemory := true
	if raw := strings.TrimSpace(os.Getenv("FRIEND_CACHE_FALLBACK_TO_MEMORY")); raw != "" {
		if parsed, err := strconv.ParseBool(raw); err == nil {
			fallbackToMemory = parsed
		}
	}

	return &ServerConfig{
		DBUrl:               os.Getenv("DATABASE_URL"),
		JWTSecret:           os.Getenv("JWT_SECRET"),
		Port:                os.Getenv("PORT"),
		DBAuthToken:         os.Getenv("DB_AUTH_TOKEN"),
		AllowedOrigins:      allowedOrigins,
		RedisURL:            strings.TrimSpace(os.Getenv("REDIS_URL")),
		FriendCacheTTL:      cacheTTL,
		FriendCacheFallback: fallbackToMemory,
	}
}
