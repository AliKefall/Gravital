package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/AliKefall/Gravital/internal/app"
	"github.com/AliKefall/Gravital/internal/auth"
	"github.com/AliKefall/Gravital/internal/cache"
	"github.com/AliKefall/Gravital/internal/endpoints"
	"github.com/AliKefall/Gravital/internal/observability"
	"github.com/AliKefall/Gravital/internal/websocket"
)

func buildIntegrationRouter(t *testing.T) http.Handler {
	t.Helper()

	promMetrics := observability.NewPrometheusMetrics()
	application := &app.App{
		JWT:             auth.NewJWTManager("integration-secret", 0),
		Hub:             websocket.NewHub(),
		Prometheus:      promMetrics,
		FriendListCache: cache.NewFriendListCache(0),
	}
	deps := &serverDependencies{
		application: application,
		handler:     &endpoints.Handler{App: application},
		hub:         application.Hub,
	}

	config := &ServerConfig{AllowedOrigins: []string{"http://localhost:5173"}}
	return buildRouter(config, deps)
}

func TestIntegrationHealthRoute(t *testing.T) {
	router := buildIntegrationRouter(t)
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rr := httptest.NewRecorder()

	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status code = %d, want %d", rr.Code, http.StatusOK)
	}
	if strings.TrimSpace(rr.Body.String()) != "OK" {
		t.Fatalf("body = %q, want %q", rr.Body.String(), "OK")
	}
	if got := rr.Header().Get("X-Frame-Options"); got != "DENY" {
		t.Fatalf("X-Frame-Options = %q, want %q", got, "DENY")
	}
}

func TestIntegrationWebRTCConfigRoute(t *testing.T) {
	t.Setenv("VITE_STUN_URLS", "stun:stun1.example.com, stun:stun2.example.com")
	t.Setenv("VITE_TURN_URLS", "turn:turn.example.com")
	t.Setenv("VITE_TURN_USERNAME", "demo-user")
	t.Setenv("VITE_TURN_CREDENTIAL", "demo-pass")

	router := buildIntegrationRouter(t)
	req := httptest.NewRequest(http.MethodGet, "/webrtc/config", nil)
	rr := httptest.NewRecorder()

	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status code = %d, want %d", rr.Code, http.StatusOK)
	}

	var payload endpoints.WebRTCConfigResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if len(payload.StunURLs) != 2 {
		t.Fatalf("stun urls = %v, want 2 entries", payload.StunURLs)
	}
	if payload.TurnUsername != "demo-user" {
		t.Fatalf("turn username = %q, want %q", payload.TurnUsername, "demo-user")
	}
}

func TestIntegrationUploadsPathTraversalBlocked(t *testing.T) {
	t.Setenv("UPLOAD_DIR", t.TempDir())
	router := buildIntegrationRouter(t)
	req := httptest.NewRequest(http.MethodGet, "/uploads/../../secrets.txt", nil)
	rr := httptest.NewRecorder()

	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Fatalf("status code = %d, want %d", rr.Code, http.StatusNotFound)
	}
}

func TestIntegrationUploadsServesFile(t *testing.T) {
	uploadDir := t.TempDir()
	t.Setenv("UPLOAD_DIR", uploadDir)
	filePath := uploadDir + "/hello.txt"
	if err := os.WriteFile(filePath, []byte("hello gravital"), 0o600); err != nil {
		t.Fatalf("write upload fixture: %v", err)
	}

	router := buildIntegrationRouter(t)
	req := httptest.NewRequest(http.MethodGet, "/uploads/hello.txt", nil)
	rr := httptest.NewRecorder()

	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status code = %d, want %d", rr.Code, http.StatusOK)
	}
	if strings.TrimSpace(rr.Body.String()) != "hello gravital" {
		t.Fatalf("body = %q, want %q", rr.Body.String(), "hello gravital")
	}
}
