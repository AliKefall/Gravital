package endpoints

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"time"

	"github.com/AliKefall/Gravital/internal/auth"
	"github.com/AliKefall/Gravital/internal/db"
	"github.com/google/uuid"
)

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

var jwtSecret = ""

func (cfg *Config) LoginHandler(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondWithError(w, http.StatusBadRequest, "Request body cannot be decoded.", err)
		return
	}

	user, err := cfg.DB.GetUserByEmail(r.Context(), req.Email)
	if err != nil {
		RespondWithError(w, http.StatusNotFound, "There is no such user registered.", err)
		return
	}

	isEqual, err := cfg.Hasher.Verify(req.Password, user.Password)
	if err != nil || !isEqual {
		RespondWithError(w, http.StatusConflict, "Email or password is not correct.", err)
		return
	}
	accessToken, err := auth.MakeJWT(
		user.ID,
		jwtSecret,
		15*time.Minute,
	)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Could not create access token", err)
		return
	}

	refreshToken, err := auth.MakeRefreshToken()
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Could not create refresh token", err)
		return
	}

	hash := sha256.Sum256([]byte(refreshToken))
	refreshHash := hex.EncodeToString(hash[:])

	now := time.Now().UTC()
	expiresAt := now.Add(7 * 24 * time.Hour)

	_, err = cfg.DB.CreateRefreshToken(r.Context(), db.CreateRefreshTokenParams{
		ID:        uuid.New().String(),
		UserID:    user.ID,
		TokenHash: refreshHash,
		CreatedAt: now.Format(time.RFC3339),
		ExpiresAt: expiresAt.Format(time.RFC3339),
	})

	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Cound not store refresh token", err)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    refreshToken,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteStrictMode,
		Path:     "/",
		Expires:  expiresAt,
	})

	RespondWithJson(w, http.StatusOK, map[string]string{
		"access_token": accessToken,
	})

}
