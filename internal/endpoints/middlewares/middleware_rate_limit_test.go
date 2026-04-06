package middlewares

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestAuthRateLimit_AllowsThenBlocks(t *testing.T) {
	mw := AuthRateLimit(2, time.Minute)
	h := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	for i := 1; i <= 2; i++ {
		req := httptest.NewRequest(http.MethodPost, "/auth/login", nil)
		req.RemoteAddr = "1.2.3.4:1234"
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, req)
		if rr.Code != http.StatusOK {
			t.Fatalf("Request %d got status %d, want %d", i, rr.Code, http.StatusOK)
		}
	}

	req := httptest.NewRequest(http.MethodPost, "/auth/login", nil)
	req.RemoteAddr = "1.2.3.4:1234"
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusTooManyRequests {
		t.Fatalf("third request got status %d, want %d", rr.Code, http.StatusTooManyRequests)
	}
}

func TestAuthRateLimit_SeperatesByPath(t *testing.T) {
	mw := AuthRateLimit(1, time.Minute)
	h := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	req1 := httptest.NewRequest(http.MethodPost, "/auth/login", nil)
	req1.RemoteAddr = "1.2.3.4:1234"
	rr1 := httptest.NewRecorder()
	h.ServeHTTP(rr1, req1)
	if rr1.Code != http.StatusOK {
		t.Fatalf("First login request got %d, want %d", rr1.Code, http.StatusOK)
	}
	req2 := httptest.NewRequest(http.MethodPost, "/auth/register", nil)
	req2.RemoteAddr = "1.2.3.4:1234"
	rr2 := httptest.NewRecorder()
	h.ServeHTTP(rr2, req2)
	if rr2.Code != http.StatusOK {
		t.Fatalf("Register request got %d, want %d", rr2.Code, http.StatusOK)
	}

}

func TestClientIP_UsesXForwardedForHeader(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/auth/login", nil)
	req.RemoteAddr = "9.9.9.9:9999"
	req.Header.Set("X-Forwarded-For", "8.8.8.8")
	if got, want := clientIP(req), "8.8.8.8"; got != want {
		t.Fatalf("clientIP = %q, want %q", got, want)
	}
}
