package middlewares

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/AliKefall/Gravital/internal/app"
	"github.com/AliKefall/Gravital/internal/auth"
)

func TestExtractToken_UsesBearerHeader(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/auth/me", nil)
	req.Header.Set("Authorization", "Bearer header-token")

	token, ok := extractToken(req)
	if !ok {
		t.Fatal("expected token to be extracted")
	}
	if token != "header-token" {
		t.Fatalf("token = %q, want %q", token, "header-token")
	}
}

func TestExtractToken_RejectsWhenHeaderMissing(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/auth/me", nil)
	req.AddCookie(&http.Cookie{Name: "access_token", Value: "cookie-token"})

	if token, ok := extractToken(req); ok || token != "" {
		t.Fatalf("expected extraction to fail without bearer header, got token=%q ok=%v", token, ok)
	}
}

func TestExtractionToken_InvalidAuthorizationHeader(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/auth/me", nil)
	req.Header.Set("Authorization", "Token header-token")
	if token, ok := extractToken(req); ok || token != "" {
		t.Fatalf("expected invalid header to fail extraction, got token %q, ok=%v", token, ok)
	}
}

func TestJWTMiddleware_ReturnsUnauthorizedWithoutToken(t *testing.T) {
	jwtManager := auth.NewJWTManager("test-secret", time.Minute)
	middleware := JWTMiddleware(&app.App{JWT: jwtManager})

	protectedCalled := false
	h := middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		protectedCalled = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/auth/me", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", rr.Code, http.StatusUnauthorized)
	}
	if protectedCalled {
		t.Fatal("protected handler should not be called")
	}
}

func TestJWTMiddleware_PassesContextWithValidToken(t *testing.T) {
	jwtManager := auth.NewJWTManager("test-secret", time.Minute)
	token, err := jwtManager.Generate("user-1", "ali")
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}

	middleware := JWTMiddleware(&app.App{JWT: jwtManager})

	h := middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := GetUserIDFromContext(r.Context()); got != "user-1" {
			t.Fatalf("user id from context = %q, want %q", got, "user-1")
		}
		if got := GetUsernameFromContext(r.Context()); got != "ali" {
			t.Fatalf("username from context = %q, want %q", got, "ali")
		}
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/auth/me", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rr.Code, http.StatusOK)
	}
}

func TestJWTMiddleware_ReturnsUnauthorizedOnInvalidToken(t *testing.T) {
	jwtManager := auth.NewJWTManager("test-secret", time.Minute)
	middleware := JWTMiddleware(&app.App{JWT: jwtManager})

	h := middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/auth/me", nil)
	req.Header.Set("Authorization", "Bearer malformed-token")
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", rr.Code, http.StatusUnauthorized)
	}
}

func TestContextHelpers(t *testing.T) {
	base := context.Background()
	if got := GetUserIDFromContext(base); got != "" {
		t.Fatalf("expected empty user id for base context, got %q", got)
	}
	withUser := context.WithValue(base, UserIDKey, "user-99")
	if got := GetUserIDFromContext(withUser); got != "user-99" {
		t.Fatalf("user id = %q, want %q", got, "user-99")
	}

	withUsername := SetUsernameInContext(base, "kefall")
	if got := GetUsernameFromContext(withUsername); got != "kefall" {
		t.Fatalf("username = %q, want %q", got, "kefall")
	}
}
