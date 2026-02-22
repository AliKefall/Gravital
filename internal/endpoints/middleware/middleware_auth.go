package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/AliKefall/Gravital/internal/app"
)

const UserIDKey contextKey = "user_id"

func JWTMiddleware(app *app.App) func(http.Handler) http.Handler {
	return func(h http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, "Missing authorization header!", http.StatusUnauthorized)
				return
			}

			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || parts[0] != "Bearer" {
				http.Error(w, "invalid authorization format", http.StatusUnauthorized)
				return
			}
			tokenStr := parts[1]

			claims, err := app.JWT.Verify(tokenStr)
			if err != nil {
				http.Error(w, "Invalid or expired token", http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), UserIDKey, claims.Subject)
			h.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
