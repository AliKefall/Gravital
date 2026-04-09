package main

import (
	"context"
	"database/sql"
	"errors"
	"log"
	"time"

	"github.com/AliKefall/Gravital/internal/app"
	"github.com/AliKefall/Gravital/internal/auth"
	"github.com/AliKefall/Gravital/internal/cache"
	"github.com/AliKefall/Gravital/internal/db"
	"github.com/AliKefall/Gravital/internal/endpoints"
	"github.com/AliKefall/Gravital/internal/observability"
	"github.com/AliKefall/Gravital/internal/websocket"
)

type serverDependencies struct {
	application *app.App
	handler     *endpoints.Handler
	queries     *db.Queries
	hub         *websocket.Hub
}

func bootstrapServer(config *ServerConfig) (*sql.DB, *serverDependencies) {
	conn := mustOpenDatabase(config)
	queries := db.New(conn)

	hub := newHub(queries)
	application := &app.App{
		DB:              queries,
		Hasher:          auth.NewPasswordHasher(),
		JWT:             auth.NewJWTManager(config.JWTSecret, 15*time.Minute),
		Hub:             hub,
		Metrics:         observability.NewMetrics(),
		FriendListCache: cache.NewFriendListCache(45 * time.Second),
	}

	return conn, &serverDependencies{
		application: application,
		handler:     &endpoints.Handler{App: application},
		queries:     queries,
		hub:         hub,
	}
}

func newHub(queries *db.Queries) *websocket.Hub {
	hub := websocket.NewHub()
	hub.Queries = queries
	go hub.Run()

	hub.UserExists = func(username string) (bool, error) {
		_, err := queries.GetUserByUsername(context.Background(), username)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return false, err
			}
			return false, err
		}
		return true, nil
	}

	hub.AreFriends = func(userID, username string) (bool, error) {
		target, err := queries.GetUserByUsername(context.Background(), username)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return false, nil
			}
			return false, err
		}
		left, right := userID, target.ID
		if right < left {
			left, right = right, left
		}
		count, err := queries.FriendshipExists(context.Background(), db.FriendshipExistsParams{UserID: left, FriendID: right})
		if err != nil {
			return false, err
		}
		return count > 0, nil
	}

	return hub
}

func mustOpenDatabase(config *ServerConfig) *sql.DB {
	dbURL := config.DBUrl + "?authToken=" + config.DBAuthToken

	conn, err := sql.Open("libsql", dbURL)
	if err != nil {
		log.Fatal("database connection error:", err)
	}

	conn.SetMaxOpenConns(10)
	conn.SetMaxIdleConns(5)
	conn.SetConnMaxLifetime(5 * time.Minute)

	if err := conn.Ping(); err != nil {
		log.Fatal("database ping failed:", err)
	}

	return conn
}

