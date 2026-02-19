package endpoints

import (
	"github.com/AliKefall/Gravital/internal/auth"
	"github.com/AliKefall/Gravital/internal/db"
)

type Config struct {
	DB        *db.Queries
	Hasher    *auth.PasswordHasher
	JWTSecret string
}
