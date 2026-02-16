package endpoints

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
)

type RegisterRequest struct {
	Email    string `json:"email"`
	Username string `json:"username"`
	Password string `json:"password"`
}

func (cfg *Config) RegisterHandler(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Error decoding request body to json.", err)
		return
	}

	_, err := cfg.DB.GetUserByEmail(r.Context(), req.Email)
	if err == nil {
		RespondWithError(w, http.StatusConflict, "There is already a user with this email", nil)
		return
	}

	if !errors.Is(err, sql.ErrNoRows) {

		// gerçek DB hatası
		RespondWithError(w, http.StatusInternalServerError, "database error", err)
		return
	}

}
