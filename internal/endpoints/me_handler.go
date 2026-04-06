package endpoints

import (
	"net/http"

	"github.com/AliKefall/Gravital/internal/endpoints/middlewares"
)

type MeResponse struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
}

// Simple endpoint check. Nothing else.
func (h *Handler) MeHandler(w http.ResponseWriter, r *http.Request) {
	userID := middlewares.GetUserIDFromContext(r.Context())
	username := middlewares.GetUsernameFromContext(r.Context())
	if userID == "" || username == "" {
		RespondWithError(w, http.StatusUnauthorized, "Unauthorized", nil)
		return
	}
	RespondWithJson(w, http.StatusOK, MeResponse{
		UserID:   userID,
		Username: username,
	})
}
