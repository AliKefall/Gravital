package endpoints

import (
	"crypto/tls"
	"net/http/httptest"
	"testing"
)

func TestShouldUseSecureCookie_TLS(t *testing.T) {
	req := httptest.NewRequest("GET", "https://example.com", nil)
	req.TLS = &tls.ConnectionState{}
	if !shouldUseSecureCookie(req) {
		t.Fatal("expected secure cookie for TLS request")
	}
}

func TestShouldUseSecureCookie_ForwardedProtoHTTPS(t *testing.T) {
	req := httptest.NewRequest("GET", "http://example.com", nil)
	req.Header.Set("X-Forwarded-Proto", "https")
	if !shouldUseSecureCookie(req) {
		t.Fatal("expected secure cookie for forwarded https")
	}
}

func TestShouldUseSecureCookie_LocalHTTP(t *testing.T) {
	req := httptest.NewRequest("GET", "http://localhost:8080", nil)
	if shouldUseSecureCookie(req) {
		t.Fatal("expected non-secure cookie for local http")
	}
}
