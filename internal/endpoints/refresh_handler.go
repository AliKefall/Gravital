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

// This function does not deletes the old refresh token right now.
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

	_ = h.App.DB.DeleteStaleRefreshTokensByUserID(ctx, db.DeleteStaleRefreshTokensByUserIDParams{
		UserID:    tokenRecord.UserID,
		ExpiresAt: now.Format(time.RFC3339),
	})

	// Use JWT manager instead of direct MakeJWT
	user, err := h.App.DB.GetUsersWithID(r.Context(), tokenRecord.UserID)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Could not get the user with id function.", err)
		return
	}
	newAccess, err := h.App.JWT.Generate(tokenRecord.UserID, user.Username)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Could not create new access token", err)
		return
	}
	secureCookie := shouldUseSecureCookie(r)

	// These two without any doubt or even you are primeagen must be set as httponly.
	// I have no idea what I was thinking sending these data with headers "RAW".
	// in order for SameSite protocol to work you kinda have to use nginx or similar.
	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    newRefresh,
		HttpOnly: true,
		Secure:   secureCookie,
		SameSite: http.SameSiteStrictMode,
		Path:     "/",
		Expires:  newExpires,
	})

	http.SetCookie(w, &http.Cookie{
		Name:     "access_token",
		Value:    newAccess,
		HttpOnly: true,
		Secure:   secureCookie,
		SameSite: http.SameSiteStrictMode,
		Path:     "/",
		MaxAge:   15 * 60,
	})

	RespondWithJson(w, http.StatusOK, map[string]string{
		"access_token": newAccess,
	})
}
