package middlewares

import (
	"context"
	"net/http"
	"strings"

	"github.com/AliKefall/Gravital/internal/app"
)

// NOTE: Always define a string type before you define any contextKeys this could literally break so many thing.
const UserIDKey contextKey = "user_id"

const UsernameKey contextKey = "username"

func JWTMiddleware(app *app.App) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tokenStr, ok := extractToken(r)
			if !ok {
				w.Header().Set("WWW-Authenticate", "Bearer")
				http.Error(w, "missing authorization token", http.StatusUnauthorized)
				return
			}
			claims, err := app.JWT.Verify(tokenStr)
			if err != nil {
				http.Error(w, "invalid or expired token", http.StatusUnauthorized)
				return
			}
			ctx := r.Context()
			ctx = context.WithValue(ctx, UserIDKey, claims.Subject)
			ctx = context.WithValue(ctx, UsernameKey, claims.Username)
			next.ServeHTTP(w, r.WithContext(ctx))

		})
	}
}

// I think this is a much better design choice rather than hardcoding header trimming everywhere
func extractToken(r *http.Request) (string, bool) {
	authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
	if authHeader != "" {
		if !strings.HasPrefix(authHeader, "Bearer ") {
			return "", false
		}
		token := strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
		if token == "" {
			return "", false
		}
		return token, true
	}
	return "", false
}

func GetUserIDFromContext(ctx context.Context) string {
	if v, ok := ctx.Value(UserIDKey).(string); ok {
		return v
	}
	return ""
}

func SetUsernameInContext(ctx context.Context, username string) context.Context {
	return context.WithValue(ctx, UsernameKey, username)
}

func GetUsernameFromContext(ctx context.Context) string {
	if v, ok := ctx.Value(UsernameKey).(string); ok {
		return v
	}
	return ""
}
