package endpoints

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRespondWithJSON_Success(t *testing.T) {
	rr := httptest.NewRecorder()

	RespondWithJson(rr, http.StatusCreated, map[string]string{"status": "ok"})

	if rr.Code != http.StatusCreated {
		t.Fatalf("status code = %d, want %d", rr.Code, http.StatusCreated)
	}
	if got := rr.Header().Get("Content-Type"); got != "application/json" {
		t.Fatalf("content-type = %q, want %q", got, "application/json")
	}

	var body map[string]string
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("response body is not valid json: %v", err)
	}
	if body["status"] != "ok" {
		t.Fatalf("status body value = %q, want %q", body["status"], "ok")
	}
}

func TestRespondWithJSON_MarshalError(t *testing.T) {
	rr := httptest.NewRecorder()

	RespondWithJson(rr, http.StatusOK, map[string]any{"ch": make(chan int)})

	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("status code = %d, want %d", rr.Code, http.StatusInternalServerError)
	}
	if rr.Body.Len() != 0 {
		t.Fatalf("expected empty body on marshal failure, got %q", rr.Body.String())
	}
}

func TestRespondWithError(t *testing.T) {
	rr := httptest.NewRecorder()

	RespondWithError(rr, http.StatusBadRequest, "bad input", errors.New("validation failed"))

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("status code = %d, want %d", rr.Code, http.StatusBadRequest)
	}
	if got := rr.Header().Get("Content-Type"); got != "application/json" {
		t.Fatalf("content-type = %q, want %q", got, "application/json")
	}
	if !strings.Contains(rr.Body.String(), "bad input") {
		t.Fatalf("response body = %q, expected to contain error message", rr.Body.String())
	}
}
