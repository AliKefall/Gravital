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
	if len(cookies) < 2 {
		t.Fatalf("expected at least two cookies to be set, got %d", len(cookies))
	}

	var refreshCleared, accessCleared bool
	for _, c := range cookies {
		if c.Name == "refresh_token" && c.MaxAge == -1 {
			refreshCleared = true

		}
		if c.Name == "access_token" && c.MaxAge == -1 {
			accessCleared = true
		}

	}
	if !refreshCleared || !accessCleared {
		t.Fatalf("expected both auth cookies to be cleared; refresh = %v, access = %v", refreshCleared, accessCleared)
	}

	body := rr.Body.String()
	if !strings.Contains(body, "logged out") {
		t.Fatalf("expected response body to contain logout message got: %q", body)
	}
}
