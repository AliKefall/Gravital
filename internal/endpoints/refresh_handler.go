package endpoints

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"net/http"
	"time"

	"github.com/AliKefall/Gravital/internal/auth"
	"github.com/AliKefall/Gravital/internal/db"
	"github.com/google/uuid"
)

func clearRefreshTokenCookie(w http.ResponseWriter, r *http.Request) {
	secureCookie := shouldUseSecureCookie(r)
	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   secureCookie,
		SameSite: http.SameSiteStrictMode,
		MaxAge:   -1,
	})
}

func (h *Handler) RefreshHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	cookie, err := r.Cookie("refresh_token")
	if err != nil || cookie.Value == "" {
		RespondWithError(w, http.StatusUnauthorized, "Missing refresh token", err)
		return
	}

	hash := sha256.Sum256([]byte(cookie.Value))
	refreshHash := hex.EncodeToString(hash[:])
	now := time.Now().UTC()

	tokenRecord, err := h.App.DB.GetValidRefreshToken(ctx, db.GetValidRefreshTokenParams{
		TokenHash: refreshHash,
		ExpiresAt: now.Format(time.RFC3339),
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			reusedToken, lookupErr := h.App.DB.GetRefreshTokenByHash(ctx, refreshHash)
			if lookupErr == nil && reusedToken.RevokedAt.Valid {
				_ = h.App.DB.DeleteRefreshTokensByUserID(ctx, reusedToken.UserID)
				clearRefreshTokenCookie(w, r)
				RespondWithJson(w, http.StatusUnauthorized, map[string]string{
					"message": "Refresh token reuse detected. All sessions have been invalidated.",
					"code":    "refresh_token_reuse_detected",
				})
				return
			}
		}
		RespondWithError(w, http.StatusUnauthorized, "Invalid refresh token", err)
		return
	}

	err = h.App.DB.RevokeRefreshToken(ctx, db.RevokeRefreshTokenParams{
		RevokedAt: sql.NullString{Valid: true, String: now.Format(time.RFC3339)},
		TokenHash: refreshHash,
	})
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Could not revoke refresh token", err)
		return
	}

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

	user, err := h.App.DB.GetUsersWithID(ctx, tokenRecord.UserID)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Could not get user", err)
		return
	}

	newAccess, err := h.App.JWT.Generate(tokenRecord.UserID, user.Username)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Could not create new access token", err)
		return
	}

	secureCookie := shouldUseSecureCookie(r)
	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    newRefresh,
		HttpOnly: true,
		Secure:   secureCookie,
		SameSite: http.SameSiteStrictMode,
		Path:     "/",
		Expires:  newExpires,
	})

	RespondWithJson(w, http.StatusOK, map[string]string{
		"access_token": newAccess,
	})
}
