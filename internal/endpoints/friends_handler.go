package endpoints

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/AliKefall/Gravital/internal/db"
	"github.com/AliKefall/Gravital/internal/endpoints/middlewares"
)

type AddFriendRequest struct {
	Username string `json:"username"`
}

type FriendResponse struct {
	Username string `json:"username"`
	Online   bool   `json:"online"`
}

type FriendListResponse struct {
	Friends []FriendResponse `json:"friends"`
}

type FriendRequestListResponse struct {
	Incoming []string `json:"incoming"`
	Outgoing []string `json:"outgoing"`
}

func normalizeFriendPair(userID, friendID string) (string, string) {
	if userID < friendID {
		return userID, friendID
	}
	return friendID, userID
}

// This is only here cause I couldn't find a way to tweak with sqlc
// If you want this to dissapear you can simply override it via sqlc.yaml
func listFriendsParam(userID string) db.ListFriendsByUserIDParams {
	return db.ListFriendsByUserIDParams{
		UserID:   userID,
		UserID_2: userID,
		FriendID: userID,
	}
}

func sortFriendResponses(payload []FriendResponse) {
	sort.Slice(payload, func(i, j int) bool {
		left := strings.ToLower(payload[i].Username)
		right := strings.ToLower(payload[j].Username)
		if left == right {
			return payload[i].Username < payload[j].Username
		}
		return left < right
	})
}

func (h *Handler) loadFriendUsername(r *http.Request, userID string) ([]string, error) {
	if h.App.FriendListCache != nil {
		if cached, ok := h.App.FriendListCache.Get(userID); ok {
			return cached, nil
		}

	}
	friends, err := h.App.DB.ListFriendsByUserID(r.Context(), listFriendsParam(userID))
	if err != nil {
		return nil, err

	}
	usernames := make([]string, 0, len(friends))
	for _, friend := range friends {
		usernames = append(usernames, friend.Username)

	}
	if h.App.FriendListCache != nil {
		h.App.FriendListCache.Set(userID, usernames)
	}
	return usernames, nil
}

func (h *Handler) buildFriendResponse(usernames []string) []FriendResponse {
	payload := make([]FriendResponse, 0, len(usernames))
	isOnline := func(friendUsername string) bool {
		if h.App == nil || h.App.Hub == nil {
			return false
		}
		return h.App.Hub.IsUserOnline(friendUsername)
	}
	for _, friendUsername := range usernames {
		payload = append(payload, FriendResponse{Username: friendUsername, Online: isOnline(friendUsername)})
	}
	sortFriendResponses(payload)
	return payload
}

func (h *Handler) ListFriendsHandler(w http.ResponseWriter, r *http.Request) {
	userID := middlewares.GetUserIDFromContext(r.Context())
	if userID == "" {
		RespondWithError(w, http.StatusUnauthorized, "Unauthorized", nil)
		return
	}

	usernames, err := h.loadFriendUsername(r, userID)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Could not fetch friend list", nil)
		return
	}
	RespondWithJson(w, http.StatusOK, FriendListResponse{Friends: h.buildFriendResponse(usernames)})
}

func (h *Handler) AddFriendHandler(w http.ResponseWriter, r *http.Request) {
	userID := middlewares.GetUserIDFromContext(r.Context())
	username := middlewares.GetUsernameFromContext(r.Context())

	if userID == "" || username == "" {
		RespondWithError(w, http.StatusUnauthorized, "Unauthorized", nil)
		return
	}

	var req AddFriendRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondWithError(w, http.StatusBadRequest, "Invalid request payload", nil)
		return
	}

	targetUsername := strings.TrimSpace(req.Username)
	if targetUsername == "" {
		RespondWithError(w, http.StatusBadRequest, "Username is required", nil)
		return
	}

	if strings.EqualFold(targetUsername, username) {
		RespondWithError(w, http.StatusBadRequest, "You can not add yourself", nil)
		return
	}

	targetUser, err := h.App.DB.GetUserByUsername(r.Context(), targetUsername)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			RespondWithError(w, http.StatusNotFound, "User not found", nil)
			return
		}
		RespondWithError(w, http.StatusInternalServerError, "Could not add friend", nil)
		return
	}
	left, right := normalizeFriendPair(userID, targetUser.ID)
	exists, err := h.App.DB.FriendshipExists(r.Context(), db.FriendshipExistsParams{UserID: left, FriendID: right})
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Could not add friend", nil)
		return
	}
	if exists > 0 {
		usernames, listErr := h.loadFriendUsername(r, userID)
		if listErr != nil {
			RespondWithError(w, http.StatusInternalServerError, "Could not fetch updated friend list", nil)
			return
		}
		RespondWithJson(w, http.StatusOK, FriendListResponse{Friends: h.buildFriendResponse(usernames)})
		return
	}

	requestExists, err := h.App.DB.FriendRequestExists(r.Context(), db.FriendRequestExistsParams{
		RequesterID: userID,
		TargetID:    targetUser.ID,
	})
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Could not send friend request", nil)
		return
	}
	if requestExists > 0 {
		RespondWithJson(w, http.StatusAccepted, map[string]string{"status": "pending", "message": "Friend request already sent"})
		return
	}

	reverseExists, err := h.App.DB.FriendRequestExists(r.Context(), db.FriendRequestExistsParams{
		RequesterID: targetUser.ID,
		TargetID:    userID,
	})
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Could not send friend request", nil)
		return
	}
	if reverseExists > 0 {
		RespondWithJson(w, http.StatusConflict, map[string]string{
			"status":  "needs_approval",
			"message": "This user already sent you a friend request. Please accept it from notifications.",
		})
		return
	}

	if err := h.App.DB.CreateFriendRequest(r.Context(), db.CreateFriendRequestParams{
		RequesterID: userID,
		TargetID:    targetUser.ID,
		CreatedAt:   time.Now().UTC().Format(time.RFC3339),
	}); err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Could not send friend request", nil)
		return
	}
	if h.App != nil && h.App.Hub != nil {
		h.App.Hub.PublishSocialEvent([]string{username, targetUser.Username}, "friend_request_updated")
	}

	RespondWithJson(w, http.StatusAccepted, map[string]string{"status": "pending", "message": "Friend request sent"})
}

func (h *Handler) ListFriendRequestsHandler(w http.ResponseWriter, r *http.Request) {
	userID := middlewares.GetUserIDFromContext(r.Context())
	if userID == "" {
		RespondWithError(w, http.StatusUnauthorized, "Unauthorized", nil)
		return
	}

	incoming, err := h.App.DB.ListIncomingFriendRequestsByUserID(r.Context(), userID)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Could not fetch incoming requests", nil)
		return
	}
	outgoing, err := h.App.DB.ListOutgoingFriendRequestsByUserID(r.Context(), userID)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Could not fetch outgoing requests", nil)
		return
	}

	incomingPayload := make([]string, 0, len(incoming))
	for _, item := range incoming {
		incomingPayload = append(incomingPayload, item.Username)
	}
	outgoingPayload := make([]string, 0, len(outgoing))
	for _, item := range outgoing {
		outgoingPayload = append(outgoingPayload, item.Username)
	}

	RespondWithJson(w, http.StatusOK, FriendRequestListResponse{
		Incoming: incomingPayload,
		Outgoing: outgoingPayload,
	})
}

func (h *Handler) AcceptFriendRequestHandler(w http.ResponseWriter, r *http.Request) {
	userID := middlewares.GetUserIDFromContext(r.Context())
	requesterUsername := strings.TrimSpace(r.URL.Query().Get("username"))
	if requesterUsername == "" {
		requesterUsername = strings.TrimSpace(r.PathValue("username"))
	}
	if userID == "" || requesterUsername == "" {
		RespondWithError(w, http.StatusBadRequest, "Invalid request", nil)
		return
	}

	requesterUser, err := h.App.DB.GetUserByUsername(r.Context(), requesterUsername)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			RespondWithError(w, http.StatusNotFound, "User not found", nil)
			return
		}
		RespondWithError(w, http.StatusInternalServerError, "Could not accept friend request", nil)
		return
	}

	requestExists, err := h.App.DB.FriendRequestExists(r.Context(), db.FriendRequestExistsParams{
		RequesterID: requesterUser.ID,
		TargetID:    userID,
	})
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Could not accept friend request", nil)
		return
	}
	if requestExists == 0 {
		RespondWithError(w, http.StatusNotFound, "Friend request not found", nil)
		return
	}

	left, right := normalizeFriendPair(userID, requesterUser.ID)
	if err := h.App.DB.CreateFriendship(r.Context(), db.CreateFriendshipParams{
		UserID:    left,
		FriendID:  right,
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
	}); err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Could not accept friend request", nil)
		return
	}

	_ = h.App.DB.DeleteFriendRequestsBetween(r.Context(), db.DeleteFriendRequestsBetweenParams{
		RequesterID:  userID,
		TargetID:     requesterUser.ID,
		RequesterID2: requesterUser.ID,
		TargetID2:    userID,
	})

	if h.App.FriendListCache != nil {
		h.App.FriendListCache.Invalidate(userID, requesterUser.ID)
	}
	if h.App != nil && h.App.Hub != nil {
		h.App.Hub.PublishSocialEvent([]string{requesterUsername, middlewares.GetUsernameFromContext(r.Context())}, "friend_list_updated")
	}

	usernames, err := h.loadFriendUsername(r, userID)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Could not fetch updated friend list", nil)
		return
	}
	RespondWithJson(w, http.StatusOK, FriendListResponse{Friends: h.buildFriendResponse(usernames)})
}

func (h *Handler) RejectFriendRequestHandler(w http.ResponseWriter, r *http.Request) {
	userID := middlewares.GetUserIDFromContext(r.Context())
	requesterUsername := strings.TrimSpace(r.URL.Query().Get("username"))
	if requesterUsername == "" {
		requesterUsername = strings.TrimSpace(r.PathValue("username"))
	}
	if userID == "" || requesterUsername == "" {
		RespondWithError(w, http.StatusBadRequest, "Invalid request", nil)
		return
	}

	requesterUser, err := h.App.DB.GetUserByUsername(r.Context(), requesterUsername)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			RespondWithError(w, http.StatusNotFound, "User not found", nil)
			return
		}
		RespondWithError(w, http.StatusInternalServerError, "Could not reject friend request", nil)
		return
	}

	if err := h.App.DB.DeleteFriendRequest(r.Context(), db.DeleteFriendRequestParams{
		RequesterID: requesterUser.ID,
		TargetID:    userID,
	}); err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Could not reject friend request", nil)
		return
	}
	if h.App != nil && h.App.Hub != nil {
		h.App.Hub.PublishSocialEvent([]string{requesterUsername, middlewares.GetUsernameFromContext(r.Context())}, "friend_request_updated")
	}
	RespondWithJson(w, http.StatusOK, map[string]string{"status": "rejected"})
}

