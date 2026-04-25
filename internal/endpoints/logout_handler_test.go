package endpoints

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHandlerLogout_WithoutRefreshCookie(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest(http.MethodPost, "/auth/logout", nil)
	rr := httptest.NewRecorder()

	h.HandlerLogout(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, rr.Code)
	}

	cookies := rr.Result().Cookies()
	if len(cookies) == 0 {
		t.Fatalf("expected refresh cookie to be set, got %d", len(cookies))
	}

	var refreshCleared bool
	for _, c := range cookies {
		if c.Name == "refresh_token" && c.MaxAge == -1 {
			refreshCleared = true

		}
	}
	if !refreshCleared {
		t.Fatalf("expected refresh token cookie to be cleared")
	}

	body := rr.Body.String()
	if !strings.Contains(body, "logged out") {
		t.Fatalf("expected response body to contain logout message got: %q", body)
	}
}
