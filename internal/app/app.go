package app

import (
	"github.com/AliKefall/Gravital/internal/auth"
	"github.com/AliKefall/Gravital/internal/db"
	"github.com/AliKefall/Gravital/internal/websocket"
)

type App struct {
	DB     *db.Queries
	Hasher *auth.PasswordHasher
	JWT    *auth.JWTManager
	Hub    *websocket.Hub
}

func New(db *db.Queries, hasher *auth.PasswordHasher, jwtManager *auth.JWTManager, hub *websocket.Hub) *App {
	return &App{
		DB:     db,
		Hasher: hasher,
		JWT:    jwtManager,
		Hub:    &websocket.Hub{},
	}
}
