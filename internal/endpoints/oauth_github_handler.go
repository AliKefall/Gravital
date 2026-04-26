package endpoints

import (
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/AliKefall/Gravital/internal/auth"
	"github.com/AliKefall/Gravital/internal/db"
	"github.com/google/uuid"
)

const githubAPIBaseURL = "https://api.github.com"

var githubUsernameSanitizer = regexp.MustCompile(`[^a-zA-Z0-9_]`)

func getRequestBaseURL(r *http.Request) string {
	scheme := "http"
	if shouldUseSecureCookie(r) {
		scheme = "https"
	}

	return fmt.Sprintf("%s://%s", scheme, r.Host)
}

func buildGitHubAuthorizeURL(r *http.Request) (string, error) {
	clientID := strings.TrimSpace(os.Getenv("GITHUB_CLIENT_ID"))
	if clientID == "" {
		return "", fmt.Errorf("missing GITHUB_CLIENT_ID")
	}

	callbackURL := strings.TrimSpace(os.Getenv("GITHUB_CALLBACK_URL"))
	if callbackURL == "" {
		callbackURL = getRequestBaseURL(r) + "/auth/oauth/github/callback"
	}

	u, err := url.Parse("https://github.com/login/oauth/authorize")
	if err != nil {
		return "", err
	}

	q := u.Query()
	q.Set("client_id", clientID)
	q.Set("redirect_uri", callbackURL)
	q.Set("scope", "read:user user:email")
	u.RawQuery = q.Encode()
	return u.String(), nil
}

func (h *Handler) GitHubOAuthStartHandler(w http.ResponseWriter, r *http.Request) {
	authorizeURL, err := buildGitHubAuthorizeURL(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "GitHub OAuth is not configured", err)
		return
	}

	http.Redirect(w, r, authorizeURL, http.StatusTemporaryRedirect)
}

type githubTokenResponse struct {
	AccessToken string `json:"access_token"`
}

type githubUserResponse struct {
	ID    int64  `json:"id"`
	Login string `json:"login"`
	Email string `json:"email"`
}

type githubEmailResponse struct {
	Email    string `json:"email"`
	Primary  bool   `json:"primary"`
	Verified bool   `json:"verified"`
}

func (h *Handler) GitHubOAuthCallbackHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	code := strings.TrimSpace(r.URL.Query().Get("code"))
	if code == "" {
		RespondWithError(w, http.StatusBadRequest, "Missing OAuth code", nil)
		return
	}

	githubClientID := strings.TrimSpace(os.Getenv("GITHUB_CLIENT_ID"))
	githubClientSecret := strings.TrimSpace(os.Getenv("GITHUB_CLIENT_SECRET"))
	if githubClientID == "" || githubClientSecret == "" {
		RespondWithError(w, http.StatusInternalServerError, "GitHub OAuth is not configured", nil)
		return
	}

	accessToken, err := exchangeGitHubCode(ctx, code, githubClientID, githubClientSecret)
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, "Could not exchange GitHub code", err)
		return
	}

	githubUser, err := fetchGitHubUser(ctx, accessToken)
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, "Could not load GitHub profile", err)
		return
	}

	email, err := resolveGitHubEmail(ctx, accessToken, githubUser.Email)
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, "Could not resolve GitHub email", err)
		return
	}

	user, err := h.findOrCreateGitHubUser(ctx, email, githubUser)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Could not finish GitHub sign in", err)
		return
	}

	jwtToken, err := h.issueSessionForUser(w, r, user)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Could not create session", err)
		return
	}

	frontendRedirect := strings.TrimSpace(os.Getenv("GITHUB_OAUTH_REDIRECT_URL"))
	if frontendRedirect != "" {
		redirectURL := fmt.Sprintf("%s?oauth=github-success", strings.TrimRight(frontendRedirect, "?&"))
		http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
		return
	}

	RespondWithJson(w, http.StatusOK, map[string]any{
		"access_token": jwtToken,
		"user": map[string]string{
			"user_id":  user.ID,
			"username": user.Username,
			"email":    user.Email,
		},
	})
}

func exchangeGitHubCode(ctx context.Context, code, clientID, clientSecret string) (string, error) {
	payload := map[string]string{
		"client_id":     clientID,
		"client_secret": clientSecret,
		"code":          code,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://github.com/login/oauth/access_token", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "gravital-backend")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()

	if res.StatusCode >= http.StatusBadRequest {
		responseBody, _ := io.ReadAll(res.Body)
		return "", fmt.Errorf("github token endpoint returned %d: %s", res.StatusCode, string(responseBody))
	}

	var tokenRes githubTokenResponse
	if err := json.NewDecoder(res.Body).Decode(&tokenRes); err != nil {
		return "", err
	}
	if tokenRes.AccessToken == "" {
		return "", fmt.Errorf("missing github access token in response")
	}

	return tokenRes.AccessToken, nil
}

func fetchGitHubUser(ctx context.Context, accessToken string) (githubUserResponse, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, githubAPIBaseURL+"/user", nil)
	if err != nil {
		return githubUserResponse{}, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "gravital-backend")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return githubUserResponse{}, err
	}
	defer res.Body.Close()

	if res.StatusCode >= http.StatusBadRequest {
		responseBody, _ := io.ReadAll(res.Body)
		return githubUserResponse{}, fmt.Errorf("github user endpoint returned %d: %s", res.StatusCode, string(responseBody))
	}

	var githubUser githubUserResponse
	if err := json.NewDecoder(res.Body).Decode(&githubUser); err != nil {
		return githubUserResponse{}, err
	}

	return githubUser, nil
}

func resolveGitHubEmail(ctx context.Context, accessToken, profileEmail string) (string, error) {
	email := strings.TrimSpace(strings.ToLower(profileEmail))
	if email != "" {
		return email, nil
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, githubAPIBaseURL+"/user/emails", nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "gravital-backend")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()

	if res.StatusCode >= http.StatusBadRequest {
		responseBody, _ := io.ReadAll(res.Body)
		return "", fmt.Errorf("github email endpoint returned %d: %s", res.StatusCode, string(responseBody))
	}

	var emails []githubEmailResponse
	if err := json.NewDecoder(res.Body).Decode(&emails); err != nil {
		return "", err
	}

	for _, candidate := range emails {
		if candidate.Primary && candidate.Verified {
			return strings.TrimSpace(strings.ToLower(candidate.Email)), nil
		}
	}
	for _, candidate := range emails {
		if candidate.Verified {
			return strings.TrimSpace(strings.ToLower(candidate.Email)), nil
		}
	}

	return "", fmt.Errorf("no verified email found on github account")
}

func (h *Handler) findOrCreateGitHubUser(ctx context.Context, email string, githubUser githubUserResponse) (db.User, error) {
	user, err := h.App.DB.GetUserByEmail(ctx, email)
	if err == nil {
		return user, nil
	}
	if err != sql.ErrNoRows {
		return db.User{}, err
	}

	generatedUsername, err := h.buildUniqueGitHubUsername(ctx, githubUser.Login, githubUser.ID)
	if err != nil {
		return db.User{}, err
	}

	oauthPassword, err := h.App.Hasher.Hash(uuid.NewString() + "A1")
	if err != nil {
		return db.User{}, err
	}

	now := time.Now().UTC().Format(time.RFC3339)
	created, err := h.App.DB.CreateUser(ctx, db.CreateUserParams{
		ID:        uuid.NewString(),
		Username:  generatedUsername,
		Email:     email,
		Password:  oauthPassword,
		CreatedAt: now,
		UpdatedAt: now,
	})
	if err != nil {
		return db.User{}, err
	}

	return created, nil
}

func (h *Handler) buildUniqueGitHubUsername(ctx context.Context, login string, githubUserID int64) (string, error) {
	base := strings.TrimSpace(login)
	base = githubUsernameSanitizer.ReplaceAllString(base, "_")
	base = strings.Trim(base, "_")
	if len(base) < 3 {
		base = fmt.Sprintf("github_%d", githubUserID)
	}
	if len(base) > 24 {
		base = base[:24]
	}

	for i := 0; i < 50; i++ {
		candidate := base
		if i > 0 {
			candidate = fmt.Sprintf("%s_%d", base, i)
		}
		if len(candidate) > 32 {
			candidate = candidate[:32]
		}
		if !isValidUsername(candidate) {
			continue
		}

		_, err := h.App.DB.GetUserByUsername(ctx, candidate)
		if err == sql.ErrNoRows {
			return candidate, nil
		}
		if err != nil {
			return "", err
		}
	}

	return "", fmt.Errorf("could not generate unique username")
}

func resolveGitHubAuthURL(r *http.Request) string {
	githubAuthURL := strings.TrimSpace(os.Getenv("GITHUB_AUTH_URL"))
	if githubAuthURL != "" {
		return githubAuthURL
	}

	if strings.TrimSpace(os.Getenv("GITHUB_CLIENT_ID")) == "" {
		return ""
	}

	githubStartURL := strings.TrimSpace(os.Getenv("GITHUB_OAUTH_START_URL"))
	if githubStartURL != "" {
		return githubStartURL
	}

	return getRequestBaseURL(r) + "/auth/oauth/github/start"
}

func (h *Handler) OAuthOptionsHandler(w http.ResponseWriter, r *http.Request) {
	RespondWithJson(w, http.StatusOK, map[string]string{
		"github": resolveGitHubAuthURL(r),
	})
}
func (h *Handler) issueSessionForUser(w http.ResponseWriter, r *http.Request, user db.User) (string, error) {
	accessToken, err := h.App.JWT.Generate(user.ID, user.Username)
	if err != nil {
		return "", err
	}

	refreshToken, err := auth.MakeRefreshToken()
	if err != nil {
		return "", err
	}

	hash := sha256.Sum256([]byte(refreshToken))
	refreshHash := hex.EncodeToString(hash[:])
	now := time.Now().UTC()
	expiresAt := now.Add(7 * 24 * time.Hour)

	_, err = h.App.DB.CreateRefreshToken(r.Context(), db.CreateRefreshTokenParams{
		ID:        uuid.NewString(),
		UserID:    user.ID,
		TokenHash: refreshHash,
		CreatedAt: now.Format(time.RFC3339),
		ExpiresAt: expiresAt.Format(time.RFC3339),
	})
	if err != nil {
		return "", err
	}

	secureCookie := shouldUseSecureCookie(r)
	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    refreshToken,
		HttpOnly: true,
		Secure:   secureCookie,
		SameSite: http.SameSiteStrictMode,
		Path:     "/",
		Expires:  expiresAt,
	})

	return accessToken, nil
}

