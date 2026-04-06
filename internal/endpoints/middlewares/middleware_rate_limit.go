package middlewares

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

type rateEntry struct {
	count   int
	resetAt time.Time
}

type fixedWindowLimiter struct {
	mu      sync.Mutex
	entries map[string]*rateEntry
	max     int
	window  time.Duration
	pruneAt time.Time
}

func newFixedWindowLimiter(max int, window time.Duration) *fixedWindowLimiter {
	return &fixedWindowLimiter{
		entries: make(map[string]*rateEntry),
		max:     max,
		window:  window,
	}
}

func (l *fixedWindowLimiter) allow(key string, now time.Time) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	if l.pruneAt.IsZero() || now.After(l.pruneAt) {
		for entryKey, entry := range l.entries {
			if now.After(entry.resetAt) {
				delete(l.entries, entryKey)
			}
		}
		l.pruneAt = now.Add(l.window)
	}

	entry, ok := l.entries[key]
	if !ok || now.After(entry.resetAt) {
		l.entries[key] = &rateEntry{count: 1, resetAt: now.Add(l.window)}
		return true
	}
	if entry.count >= l.max {
		return false
	}

	entry.count++
	return true

}

func clientIP(r *http.Request) string {
	if forwardedFor := r.Header.Get("X-Forwarded-For"); forwardedFor != "" {
		for _, candidate := range strings.Split(forwardedFor, ",") {
			ip := strings.TrimSpace(candidate)
			if parsed := net.ParseIP(ip); parsed != nil {
				return parsed.String()
			}
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil {
		return host
	}
	return r.RemoteAddr
}

func AuthRateLimit(max int, window time.Duration) func(http.Handler) http.Handler {
	limiter := newFixedWindowLimiter(max, window)
	return func(h http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := clientIP(r) + ":" + r.URL.Path
			if !limiter.allow(key, time.Now()) {
				http.Error(w, "too many requests", http.StatusTooManyRequests)
				return
			}
			h.ServeHTTP(w, r)
		})
	}
}
