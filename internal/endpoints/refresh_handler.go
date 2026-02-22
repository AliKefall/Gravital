package endpoints

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"net/http"
	"time"

	"github.com/AliKefall/Gravital/internal/auth"
	"github.com/AliKefall/Gravital/internal/db"
	"github.com/google/uuid"
)

func (h *Handler) RefreshHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	cookie, err := r.Cookie("refresh_token")
	if err != nil {
		RespondWithError(w, http.StatusUnauthorized, "Missing refresh token", err)
		return
	}

	// Hash incoming refresh token
	hash := sha256.Sum256([]byte(cookie.Value))
	refreshHash := hex.EncodeToString(hash[:])

	now := time.Now().UTC()

	tokenRecord, err := h.App.DB.GetValidRefreshToken(ctx, db.GetValidRefreshTokenParams{
		TokenHash: refreshHash,
		ExpiresAt: now.Format(time.RFC3339),
	})
	if err != nil {
		RespondWithError(w, http.StatusUnauthorized, "Invalid refresh token", err)
		return
	}

	// Revoke old token (rotation)
	err = h.App.DB.RevokeRefreshToken(ctx, db.RevokeRefreshTokenParams{
		RevokedAt: sql.NullString{
			Valid:  true,
			String: now.Format(time.RFC3339),
		},
		TokenHash: refreshHash,
	})
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Could not revoke refresh token", err)
		return
	}

	// Generate new refresh token
	newRefresh, err := auth.MakeRefreshToken()
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Could not create refresh token", err)
		return
	}

	newHashBytes := sha256.Sum256([]byte(newRefresh))
	newHash := hex.EncodeToString(newHashBytes[:])

	newExpires := now.Add(7 * 24 * time.Hour)

	_, err = h.App.DB.CreateRefreshToken(ctx, db.CreateRefreshTokenParams{
		ID:        uuid.New().String(),
		UserID:    tokenRecord.UserID,
		TokenHash: newHash,
		CreatedAt: now.Format(time.RFC3339),
		ExpiresAt: newExpires.Format(time.RFC3339),
	})
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Could not store refresh token", err)
		return
	}

	// Use JWT manager instead of direct MakeJWT
	newAccess, err := h.App.JWT.Generate(tokenRecord.UserID)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Could not create new access token", err)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    newRefresh,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteStrictMode,
		Path:     "/",
		Expires:  newExpires,
	})

	RespondWithJson(w, http.StatusOK, map[string]string{
		"access_token": newAccess,
	})
}
