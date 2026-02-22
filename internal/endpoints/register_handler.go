package endpoints

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
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

func (h *Handler) RegisterHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondWithError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	// Basic normalization
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Username = strings.TrimSpace(req.Username)

	// Validation
	if req.Email == "" || req.Username == "" || req.Password == "" {
		RespondWithError(w, http.StatusBadRequest, "All fields must be filled", nil)
		return
	}

	// Check existing user
	_, err := h.App.DB.GetUserByEmail(ctx, req.Email)
	if err == nil {
		RespondWithError(w, http.StatusConflict, "There is already a user with this email", nil)
		return
	}

	if !errors.Is(err, sql.ErrNoRows) {
		RespondWithError(w, http.StatusInternalServerError, "Database error", err)
		return
	}

	// Hash password
	hashed, err := h.App.Hasher.Hash(req.Password)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Password cannot be hashed", err)
		return
	}

	now := time.Now().UTC()
	userID := uuid.New().String()

	_, err = h.App.DB.CreateUser(ctx, db.CreateUserParams{
		ID:        userID,
		Username:  req.Username,
		Email:     req.Email,
		Password:  hashed,
		CreatedAt: now.Format(time.RFC3339),
		UpdatedAt: now.Format(time.RFC3339),
	})
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Error creating user", err)
		return
	}

	RespondWithJson(w, http.StatusCreated, RegisterResponse{
		UserID:   userID,
		Username: req.Username,
		Email:    req.Email,
	})
}
