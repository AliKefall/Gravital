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
	r.Get("/webrtc/config", deps.handler.WebRTCConfigHandler)
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
		// Without these three headers websocker and webrtc connection will be down.
		// These are necessery for "Secure" connection.
		headers.Set("Cross-Origin-Resource-Policy", "same-site")
		headers.Set("Cross-Origin-Opener-Policy", "same-origin")
		headers.Set("Cross-Origin-Embedder-Policy", "credentialless")
		//
		headers.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		headers.Set("Cache-Control", "no-store")
		headers.Set("Pragma", "no-cache")

		// This one is mostly for chromium based internet services. ex: Chrome, Opera ...
		headers.Set(
			"Content-Security-Policy",
			"default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' ws: wss:;",
		)
		next.ServeHTTP(w, r)
	})
}

func registerUploadsRoute(r chi.Router) {
	// When you set a filepath be sure the docker container have the necessery permissions
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
		r.Post("/forgot-password", deps.handler.RequestPasswordResetHandler)
		r.Post("/reset-password", deps.handler.VerifyPasswordResetHandler)
		r.Get("/oauth/providers", deps.handler.OAuthOptionsHandler)

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
