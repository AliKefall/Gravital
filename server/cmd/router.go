package main

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/AliKefall/Gravital/internal/endpoints/middlewares"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

func buildRouter(config *ServerConfig, deps *serverDependencies) chi.Router {
	r := chi.NewRouter()
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   config.AllowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		ExposedHeaders:   []string{"X-Request-Id"},
		AllowCredentials: true,
		MaxAge:           300,
	}))
	r.Use(middlewares.RequestID)
	r.Use(middlewares.LoggerWithMetrics(deps.application.Metrics, deps.application.Prometheus))
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(securityHeadersMiddleware)

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK"))
	})

	registerUploadsRoute(r)
	r.Handle("/metrics", promhttp.Handler())
	registerAuthRoutes(r, deps)
	registerWebsocketRoute(r, deps)

	return r
}

func securityHeadersMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		headers := w.Header()
		headers.Set("X-Content-Type-Options", "nosniff")
		headers.Set("X-Frame-Options", "DENY")
		headers.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		headers.Set("Permissions-Policy", "camera=(), microphone=(self), geolocation=()")
		headers.Set("Cross-Origin-Resource-Policy", "same-site")
		headers.Set("Cross-Origin-Opener-Policy", "same-origin")
		headers.Set("Cross-Origin-Embedder-Policy", "credentialless")
		headers.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		next.ServeHTTP(w, r)
	})
}

func registerUploadsRoute(r chi.Router) {
	uploadDir := strings.TrimSpace(os.Getenv("UPLOAD_DIR"))
	if uploadDir == "" {
		uploadDir = "uploads"
	}

	r.Get("/uploads/{filename}", func(w http.ResponseWriter, r *http.Request) {
		filename := strings.TrimSpace(chi.URLParam(r, "filename"))
		if filename == "" {
			http.NotFound(w, r)
			return
		}

		safeName := filepath.Base(filename)
		if safeName != filename {
			http.NotFound(w, r)
			return
		}

		http.ServeFile(w, r, filepath.Join(uploadDir, safeName))
	})
}

//

func registerAuthRoutes(r chi.Router, deps *serverDependencies) {
	r.Route("/auth", func(r chi.Router) {
		r.Use(middlewares.AuthRateLimit(10, time.Minute))
		r.Post("/register", deps.handler.RegisterHandler)
		r.Post("/login", deps.handler.LoginHandler)
		r.Post("/refresh", deps.handler.RefreshHandler)

		r.Group(func(r chi.Router) {
			r.Use(middlewares.JWTMiddleware(deps.application))
			r.Get("/me", deps.handler.MeHandler)
			r.Get("/friends", deps.handler.ListFriendsHandler)
			r.Post("/friends", deps.handler.AddFriendHandler)
			r.Get("/friends/requests", deps.handler.ListFriendRequestsHandler)
			r.Post("/friends/requests/{username}/accept", deps.handler.AcceptFriendRequestHandler)
			r.Post("/friends/requests/{username}/reject", deps.handler.RejectFriendRequestHandler)
			r.Post("/logout", deps.handler.HandlerLogout)
			r.Post("/rooms/{roomID}/attachments", deps.handler.UploadAttachmentHandler)
		})
	})
}
