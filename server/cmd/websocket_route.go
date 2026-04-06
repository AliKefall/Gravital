package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/AliKefall/Gravital/internal/db"
	"github.com/AliKefall/Gravital/internal/websocket"
	"github.com/go-chi/chi/v5"
)

func registerWebsocketRoute(r chi.Router, deps *serverDependencies) {
	r.Get("/ws", func(w http.ResponseWriter, r *http.Request) {
		token := extractAccessToken(r)
		if token == "" {
			http.Error(w, "missing token", http.StatusUnauthorized)
			return
		}

		claims, err := deps.application.JWT.Verify(token)
		if err != nil {
			http.Error(w, "invalid token", http.StatusUnauthorized)
			return
		}

		websocket.ServeWS(deps.hub, w, r, claims.Subject, claims.Username, func(client *websocket.Client) {
			rehydrateClientState(context.Background(), deps, client, claims.Subject)
		})
	})
}

func extractAccessToken(r *http.Request) string {
	authHeader := r.Header.Get("Authorization")
	token := strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
	if token == authHeader {
		token = ""
	}
	if token == "" {
		if cookie, err := r.Cookie("access_token"); err == nil {
			token = cookie.Value
		}
	}
	if token == "" {
		token = r.URL.Query().Get("token")
	}
	return token
}

func rehydrateClientState(ctx context.Context, deps *serverDependencies, client *websocket.Client, userID string) {
	rooms, err := deps.queries.ListActiveChatRoomsByUserID(ctx, userID)
	if err != nil {
		return
	}

	roomIDs := make([]string, 0, len(rooms))
	for _, room := range rooms {
		roomIDs = append(roomIDs, room.ID)
		sendRoomSnapshot(ctx, deps, client, room)
	}

	roomsData, _ := json.Marshal(map[string]any{"type": "rooms", "rooms": roomIDs})
	select {
	case client.Send <- roomsData:
	default:
	}
}

func sendRoomSnapshot(ctx context.Context, deps *serverDependencies, client *websocket.Client, room db.ChatRoom) {
	owner, err := deps.queries.GetUsersWithID(ctx, room.OwnerID)
	if err == nil {
		deps.hub.RehydrateJoin(client, room.ID, owner.Username)
	} else {
		deps.hub.RehydrateJoin(client, room.ID, "")
	}

	deps.hub.SendRoomMetaToClient(client, room.ID)
	deps.hub.SendScreenStateToClient(client, room.ID)

	const historyLimit int64 = 30
	recentMessages, err := deps.queries.ListRecentMessagesByRoomID(ctx, db.ListRecentMessagesByRoomIDParams{RoomID: room.ID, Limit: historyLimit})
	if err != nil {
		return
	}

	history := make([]websocket.Message, 0, len(recentMessages))
	for i := len(recentMessages) - 1; i >= 0; i-- {
		item := recentMessages[i]
		kind := strings.TrimSpace(item.Kind)
		if kind == "" {
			kind = "text"
		}
		history = append(history, websocket.Message{
			Type:      websocket.TypeRoomMessage,
			RoomID:    item.RoomID,
			From:      item.SenderUsername,
			Content:   item.Content,
			TimeStamp: item.CreatedAt,
			Kind:      kind,
			MediaURL:  nullableString(item.MediaUrl),
			MimeType:  nullableString(item.MimeType),
			FileName:  nullableString(item.FileName),
			FileSize:  item.FileSize,
		})
	}

	payload, _ := json.Marshal(map[string]any{"type": "history", "room_id": room.ID, "messages": history})
	select {
	case client.Send <- payload:
	default:
	}
}

func nullableString(value sql.NullString) string {
	if !value.Valid {
		return ""
	}
	return value.String
}
