package endpoints

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"math/rand/v2"
	"net/http"
	"net/smtp"
	"os"
	"strings"
	"time"

	"github.com/AliKefall/Gravital/internal/db"
	"github.com/google/uuid"
)

const passwordResetCodeTTL = 10 * time.Minute

type RequestPasswordResetPayload struct {
	Email string `json:"email"`
}

type VerifyPasswordResetPayload struct {
	Email       string `json:"email"`
	Code        string `json:"code"`
	NewPassword string `json:"new_password"`
}

func (h *Handler) RequestPasswordResetHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var req RequestPasswordResetPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondWithError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	email := strings.TrimSpace(strings.ToLower(req.Email))
	if !isValidEmail(email) {
		RespondWithError(w, http.StatusBadRequest, "Invalid email format", nil)
		return
	}

	user, err := h.App.DB.GetUserByEmail(ctx, email)
	if err != nil {
		if err == sql.ErrNoRows {
			RespondWithJson(w, http.StatusOK, map[string]string{"message": "If the account exists, a reset code has been sent."})
			return
		}
		RespondWithError(w, http.StatusInternalServerError, "Database error", err)
		return
	}

	now := time.Now().UTC()
	if err := h.App.DB.RevokeActivePasswordResetCodesByEmail(ctx, email, now.Format(time.RFC3339)); err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Could not create reset request", err)
		return
	}

	code := generateResetCode()
	hash := sha256.Sum256([]byte(code))
	expiresAt := now.Add(passwordResetCodeTTL)

	_, err = h.App.DB.CreatePasswordResetCode(ctx, db.CreatePasswordResetCodeParams{
		ID:        uuid.New().String(),
		UserID:    user.ID,
		Email:     email,
		CodeHash:  hex.EncodeToString(hash[:]),
		ExpiresAt: expiresAt.Format(time.RFC3339),
		CreatedAt: now.Format(time.RFC3339),
	})
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Could not create reset request", err)
		return
	}

	sendPasswordResetEmail(email, code, expiresAt)
	RespondWithJson(w, http.StatusOK, map[string]string{"message": "If the account exists, a reset code has been sent."})
}

func (h *Handler) VerifyPasswordResetHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var req VerifyPasswordResetPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondWithError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	email := strings.TrimSpace(strings.ToLower(req.Email))
	code := strings.TrimSpace(req.Code)
	if !isValidEmail(email) || code == "" {
		RespondWithError(w, http.StatusBadRequest, "Email and code are required", nil)
		return
	}
	if !isValidPassword(req.NewPassword) {
		RespondWithError(w, http.StatusBadRequest, "Password must be 8-128 characters and include at least one letter and one number", nil)
		return
	}

	resetRow, err := h.App.DB.GetActivePasswordResetCodeByEmail(ctx, email)
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, "Reset code is invalid or expired", err)
		return
	}

	expiresAt, err := time.Parse(time.RFC3339, resetRow.ExpiresAt)
	if err != nil || time.Now().UTC().After(expiresAt) {
		RespondWithError(w, http.StatusBadRequest, "Reset code has expired", err)
		return
	}

	hash := sha256.Sum256([]byte(code))
	if hex.EncodeToString(hash[:]) != resetRow.CodeHash {
		RespondWithError(w, http.StatusBadRequest, "Reset code is invalid", nil)
		return
	}

	hashedPassword, err := h.App.Hasher.Hash(req.NewPassword)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Password cannot be hashed", err)
		return
	}

	now := time.Now().UTC().Format(time.RFC3339)
	if err := h.App.DB.UpdateUserPassword(ctx, resetRow.UserID, hashedPassword, now); err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Password update failed", err)
		return
	}
	if err := h.App.DB.MarkPasswordResetCodeUsed(ctx, resetRow.ID, now); err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Reset code update failed", err)
		return
	}

	RespondWithJson(w, http.StatusOK, map[string]string{"message": "Password updated successfully."})
}

func (h *Handler) OAuthOptionsHandler(w http.ResponseWriter, r *http.Request) {
	githubAuthURL := strings.TrimSpace(os.Getenv("GITHUB_AUTH_URL"))
	if githubAuthURL == "" && strings.TrimSpace(os.Getenv("GITHUB_CLIENT_ID")) != "" {
		githubAuthURL = strings.TrimSpace(os.Getenv("GITHUB_OAUTH_START_URL"))
		if githubAuthURL == "" {
			githubAuthURL = getRequestBaseURL(r) + "/auth/oauth/github/start"
		}
	}
	RespondWithJson(w, http.StatusOK, map[string]string{

		"github": githubAuthURL,
	})
}

func generateResetCode() string {
	code := rand.IntN(900000) + 100000
	return fmt.Sprintf("%06d", code)
}

func sendPasswordResetEmail(email, code string, expiresAt time.Time) {
	host := strings.TrimSpace(os.Getenv("SMTP_HOST"))
	port := strings.TrimSpace(os.Getenv("SMTP_PORT"))
	username := strings.TrimSpace(os.Getenv("SMTP_USERNAME"))
	password := strings.TrimSpace(os.Getenv("SMTP_PASSWORD"))
	from := strings.TrimSpace(os.Getenv("SMTP_FROM"))

	message := fmt.Sprintf("Subject: Gravital Password Reset Code\r\n\r\nYour reset code is %s. It will expire at %s UTC.", code, expiresAt.Format(time.RFC1123))

	if host == "" || port == "" || username == "" || password == "" || from == "" {
		log.Printf("password reset code for %s is %s and expires at %s UTC", email, code, expiresAt.Format(time.RFC3339))
		return
	}

	auth := smtp.PlainAuth("", username, password, host)
	if err := smtp.SendMail(host+":"+port, auth, from, []string{email}, []byte(message)); err != nil {
		log.Printf("could not send password reset email to %s: %v", email, err)
	}
}
