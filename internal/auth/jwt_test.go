package auth

import (
	"testing"
	"time"
)

func TestJWTManager_GenerateAndVerify(t *testing.T) {
	n := NewJWTManager("test-secret", 5*time.Minute)
	token, err := n.Generate("user-id", "osman")
	if err != nil {
		t.Fatalf("JWT generate returned an error: %v", err)
	}
	claims, err := n.Verify(token)
	if err != nil {
		t.Fatalf("Verify returned error: %v", err)
	}
	if claims.Subject != "user-id" {
		t.Fatalf("claims.Subject = %q, want %q", claims.Subject, "user-id")
	}
	if claims.Username != "osman" {
		t.Fatalf("claims.Username = %q, want %q", claims.Username, "osman")
	}
}

func TestJWTManager_VerifyWithWrongSecretFails(t *testing.T) {
	good := NewJWTManager("good-secret", 5*time.Minute)
	bad := NewJWTManager("bad-secret", 5*time.Minute)

	token, err := good.Generate("user-id", "osman")
	if err != nil {
		t.Fatalf("Generate returned error: %v", err)
	}
	if _, err := bad.Verify(token); err == nil {
		t.Fatalf("Verify expected error with wrong secret, got nil")

	}

}

func TestMakeRefreshToken_Length(t *testing.T) {
	token, err := MakeRefreshToken()
	if err != nil {
		t.Fatalf("MakeRefreshToken returned error: %v", err)
	}

	if len(token) != 64 {
		t.Fatalf("refresh token length = %d, want 64", len(token))
	}
}
