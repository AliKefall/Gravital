package middlewares

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

type limiterEntry struct {
	tokens   float64
	lastSeen time.Time
}

type tokenBucketLimiter struct {
	mu      sync.Mutex
	entries map[string]*limiterEntry
	rate    float64
	burst   float64
	ttl     time.Duration
}

func newTokenBucketLimiter(max int, window time.Duration) *tokenBucketLimiter {
	if max <= 0 {
		max = 1
	}
	if window <= 0 {
		window = time.Second
	}
	return &tokenBucketLimiter{entries: make(map[string]*limiterEntry), rate: float64(max) / window.Seconds(), burst: float64(max), ttl: window * 2}
}

func (l *tokenBucketLimiter) allow(key string, now time.Time) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	for k, e := range l.entries {
		if now.Sub(e.lastSeen) > l.ttl {
			delete(l.entries, k)
		}
	}
	entry, ok := l.entries[key]
	if !ok {
		entry = &limiterEntry{tokens: l.burst, lastSeen: now}
		l.entries[key] = entry
	}
	elapsed := now.Sub(entry.lastSeen).Seconds()
	entry.tokens += elapsed * l.rate
	if entry.tokens > l.burst {
		entry.tokens = l.burst
	}
	entry.lastSeen = now
	if entry.tokens < 1 {
		return false
	}
	entry.tokens -= 1
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
	limiter := newTokenBucketLimiter(max, window)
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
