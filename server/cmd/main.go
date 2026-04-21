package main

import (
	"context"

	"log"
	"net/http"
	"os"
	"os/signal"

	"syscall"
	"time"

	"github.com/joho/godotenv"
	_ "github.com/tursodatabase/libsql-client-go/libsql"
)

// ci-cd test1
func main() {
	godotenv.Load()
	config := NewServer()
	applyConfigDefaults(config)
	validateConfig(config)

	conn, deps := bootstrapServer(config)
	defer conn.Close()

	// Waiting times and header bytes sizes are standarized. I don't prefer you to change
	// any of them here.
	server := &http.Server{
		Addr:              ":" + config.Port,
		Handler:           buildRouter(config, deps),
		ReadTimeout:       10 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       30 * time.Second,
		MaxHeaderBytes:    1 << 20,
	}

	go func() {
		log.Println("Server running on port", config.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Listen error: %v", err)
		}
	}()

	waitForShutdown(server)
}

func applyConfigDefaults(config *ServerConfig) {
	if config.Port == "" {
		config.Port = "8080"
	}
}

// These three must be set in any circumstances. The rest can be tweaked for testing.
// But be careful playing with them.
func validateConfig(config *ServerConfig) {
	if config.DBUrl == "" || config.JWTSecret == "" || config.DBAuthToken == "" {
		log.Fatal("DB_URL, DB_AUTH_TOKEN and JWT_SECRET must be set")
	}
	for _, origin := range config.AllowedOrigins {
		if origin == "*" {
			log.Fatal("CORS_ALLOWED_ORIGINS cannot contain wildcard '*' when credentials are enabled")
		}
	}
}

// Maybe the only function that did not even change a single letter from the start.
// This is simply a graceful shutdown function.
// To avoid mutated data, buffer inconsistency, and to avoid waiting requests or responses to not work as intended.
func waitForShutdown(srv *http.Server) {
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	<-stop
	log.Println("shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("Shutdown error: %v", err)
	}
}
