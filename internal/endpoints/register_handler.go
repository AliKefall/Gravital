package endpoints

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"

	"time"

	"github.com/AliKefall/Gravital/internal/db"
	"github.com/google/uuid"
)

type RegisterRequest struct {
	Email    string `json:"email"`
	Username string `json:"username"`
	Password string `json:"password"`
}

type RegisterResponse struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
	Email    string `json:"email"`
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

	if req.Email == "" || req.Username == "" || req.Password == "" {
		RespondWithError(w, http.StatusBadRequest, "All fields must be filled.", err)
		return
	}

	hashed, err := cfg.Hasher.Hash(req.Password)

	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Password cannot be hashed", err)
		return
	}

	userID := uuid.New()

	_, err = cfg.DB.CreateUser(r.Context(), db.CreateUserParams{
		ID:        userID.String(),
		Username:  req.Username,
		Email:     req.Email,
		Password:  hashed,
		CreatedAt: time.Now().String(),
		UpdatedAt: time.Now().String(),
	})

	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Error creating the user", err)
		return
	}
	RespondWithJson(w, http.StatusOK, RegisterResponse{
		UserID:   userID.String(),
		Username: req.Username,
		Email:    req.Email,
	})

}
