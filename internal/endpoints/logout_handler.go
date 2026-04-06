package endpoints

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"net/http"
	"time"

	"github.com/AliKefall/Gravital/internal/db"
	"github.com/AliKefall/Gravital/internal/endpoints/middlewares"
)

func (h *Handler) HandlerLogout(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	now := time.Now().UTC().Format(time.RFC3339)
	userID := middlewares.GetUserIDFromContext(ctx)

	if userID != "" {
		if err := h.App.DB.DeleteRefreshTokensByUserID(ctx, userID); err != nil {
			RespondWithError(w, http.StatusInternalServerError, "Could not clear refresh tokens", err)
			return
		}
	}

	if cookie, err := r.Cookie("refresh_token"); err == nil && cookie.Value != "" {
		hash := sha256.Sum256([]byte(cookie.Value))
		refreshHash := hex.EncodeToString(hash[:])

		err = h.App.DB.RevokeRefreshToken(ctx, db.RevokeRefreshTokenParams{
			RevokedAt: sql.NullString{Valid: true, String: now},
			TokenHash: refreshHash,
		})
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "Could not revoke refresh token", err)
			return
		}

	}
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

	http.SetCookie(w, &http.Cookie{
		Name:     "access_token",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   secureCookie,
		SameSite: http.SameSiteStrictMode,
		MaxAge:   -1,
	})
	// I will change the payload with any and add much more specified messages. But for now this one does the job.
	RespondWithJson(w, http.StatusOK, map[string]string{
		"message": "logged out",
	})
}
