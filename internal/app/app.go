package app

import (
	"github.com/AliKefall/Gravital/internal/auth"
	"github.com/AliKefall/Gravital/internal/cache"
	"github.com/AliKefall/Gravital/internal/db"
	"github.com/AliKefall/Gravital/internal/observability"
	"github.com/AliKefall/Gravital/internal/websocket"
)

type App struct {
	DB              *db.Queries
	Hasher          *auth.PasswordHasher
	JWT             *auth.JWTManager
	Hub             *websocket.Hub
	FriendListCache *cache.FriendListCache
	Prometheus      *observability.PrometheusMetrics
}

func New(db *db.Queries, hasher *auth.PasswordHasher, jwtManager *auth.JWTManager, hub *websocket.Hub) *App {
	return &App{
		DB:     db,
		Hasher: hasher,
		JWT:    jwtManager,
		Hub:    hub,
	}
}
