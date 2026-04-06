package websocket

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/AliKefall/Gravital/internal/db"
)

// NOTE: For now rooms don't have any limitations about size, this is only for testing you can simply assign it as however you wish.
type Hub struct {
	Clients        map[*Client]bool
	Users          map[string]map[*Client]bool
	Rooms          map[string]map[*Client]bool
	RoomOwners     map[string]string
	RoomScreen     map[string]map[string]bool
	UserExists     func(username string) (bool, error)
	AreFriends     func(userID, username string) (bool, error)
	Queries        *db.Queries
	Register       chan *Client
	Unregister     chan *Client
	PresenceEvents chan PresenceEvent
	mu             sync.RWMutex
}

type PresenceEvent struct {
	Username  string
	IsOnline  bool
	Timestamp string
}

// NOTE: This will change a lot I still need a lot of backlog about the rooms, I just wanted to see if the frontend works as intended.
type RoomMeta struct {
	Type          MessageType `json:"type"`
	RoomID        string      `json:"room_id"`
	OwnerUsername string      `json:"owner_username"`
	ActiveUsers   []string    `json:"active_users"`
}

type ScreenShareState struct {
	Type        MessageType `json:"type"`
	RoomID      string      `json:"room_id"`
	ActiveUsers []string    `json:"active_users"`
}

func NewHub() *Hub {
	return &Hub{
		Clients:        make(map[*Client]bool),
		Users:          make(map[string]map[*Client]bool),
		Rooms:          make(map[string]map[*Client]bool),
		RoomScreen:     make(map[string]map[string]bool),
		RoomOwners:     make(map[string]string),
		Register:       make(chan *Client),
		Unregister:     make(chan *Client),
		PresenceEvents: make(chan PresenceEvent, 256),
	}
}

func debugRealtimeLog(format string, args ...any) {
	if strings.EqualFold(strings.TrimSpace(os.Getenv("WS_DEBUG_LOGS")), "true") {
		log.Printf("[ws-debug] "+format, args...)
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			if client == nil {
				continue
			}
			becameOnline := false
			h.mu.Lock()
			if !h.Clients[client] {
				h.Clients[client] = true
				if h.Users[client.Username] == nil {
					h.Users[client.Username] = make(map[*Client]bool)
				}
				if len(h.Users[client.Username]) == 0 {
					becameOnline = true
				}
				h.Users[client.Username][client] = true
			}
			h.mu.Unlock()
			if becameOnline {
				h.publishPresence(client.Username, true)
			}

		case client := <-h.Unregister:
			if client == nil {
				continue
			}
			becameOffline := false
			h.mu.Lock()
			if !h.Clients[client] {
				h.mu.Unlock()
				continue
			}
			delete(h.Clients, client)
			if userConnections, ok := h.Users[client.Username]; ok {
				delete(userConnections, client)
				if len(userConnections) == 0 {
					delete(h.Users, client.Username)
					becameOffline = true
				}
			}

			affectedRooms := make([]string, 0)
			for roomID, room := range h.Rooms {
				delete(room, client)

				if len(room) == 0 {
					delete(h.Rooms, roomID)
					delete(h.RoomScreen, roomID)
					delete(h.RoomOwners, roomID)
					continue
				}
				if sharers, ok := h.RoomScreen[roomID]; ok {
					delete(sharers, client.Username)
				}
				affectedRooms = append(affectedRooms, roomID)
			}
			close(client.Send)
			h.mu.Unlock()
			if becameOffline {
				h.publishPresence(client.Username, false)
			}
			for _, roomID := range affectedRooms {
				h.broadcastRoomMeta(roomID)
				h.broadcastScreenState(roomID)
			}
		case event := <-h.PresenceEvents:
			h.broadcastPresence(event.Username, event.IsOnline, event.Timestamp)
		}

	}
}

func (h *Hub) publishPresence(username string, isOnline bool) {
	if strings.TrimSpace(username) == "" {
		return
	}
	select {
	case h.PresenceEvents <- PresenceEvent{
		Username:  username,
		IsOnline:  isOnline,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}:
	default:
	}
}

func (h *Hub) HandleMessage(sender *Client, msg Message) {
	switch msg.Type {
	case TypeJoinRoom:
		h.joinRoom(sender, msg.RoomID)

	case TypeRoomMessage:
		h.sendToRoom(sender, msg.RoomID, msg)

	case TypeDirect:
		h.sendDirect(msg.To, msg)

	case TypeLeaveRoom:
		h.leaveRoom(sender, msg.RoomID)

	case TypeCreateRoom:
		h.createRoom(sender, msg.RoomID)

	case TypeCloseRoom:
		h.closeRoom(sender, msg.RoomID)

	case TypeAddToRoom:
		h.addUserToRoom(sender, msg.RoomID, msg.To)
	case TypeVoiceJoin, TypeVoiceLeave, TypeVoiceState, TypeScreenStart, TypeScreenStop, TypeScreenState, TypeStreamMetrics, TypeWebRTCOffer, TypeWebRTCAnswer, TypeWebRTCIceCandidate:
		h.forwardRealtimeRoomSignal(sender, msg)
	case TypeKeepAlive:
		return
	}

}

func (h *Hub) forwardRealtimeRoomSignal(sender *Client, msg Message) {
	if sender == nil || msg.RoomID == "" {
		return
	}
	if !h.isClientInRoom(sender, msg.RoomID) {
		h.sendSystem(sender, msg.RoomID, "you are not in this room")
		return
	}
	if msg.TimeStamp == "" {
		msg.TimeStamp = time.Now().UTC().Format(time.RFC3339)
	}
	msg.From = sender.Username
	debugRealtimeLog("signal type=%s room=%s from=%s to=%s", msg.Type, msg.RoomID, sender.Username, msg.To)
	// WebRTC SDP/ICE message are point-to-point and should only be forawarded
	// to the intended participant in the room.
	switch msg.Type {
	case TypeWebRTCOffer, TypeWebRTCAnswer, TypeWebRTCIceCandidate:
		if msg.To == "" {
			h.sendSystem(sender, msg.RoomID, "target user is required")
			return
		}
		target := h.getRoomUserByUsername(msg.RoomID, msg.To)
		if target == nil {
			h.sendSystem(sender, msg.RoomID, "target user is not in this room")
			return
		}
		data, _ := json.Marshal(msg)
		select {
		case target.Send <- data:

		default:
			h.enqueueUnregister(target)
		}
	default:
		h.sendToRoom(sender, msg.RoomID, msg)
	}
	if msg.Type == TypeScreenStart || msg.Type == TypeScreenStop {
		h.updateScreenShareState(msg.RoomID, sender.Username, msg.Type == TypeScreenStart)
		h.broadcastScreenState(msg.RoomID)
	}

}

func (h *Hub) isClientInRoom(client *Client, roomID string) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	room, ok := h.Rooms[roomID]
	if !ok {
		return false
	}
	return room[client]
}

func (h *Hub) getRoomUserByUsername(roomID, username string) *Client {
	h.mu.RLock()
	defer h.mu.RUnlock()
	room, ok := h.Rooms[roomID]
	if !ok {
		return nil
	}
	for member := range room {
		if member.Username == username {
			return member
		}
	}
	return nil
}

func (h *Hub) IsUserOnline(username string) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	userConnections, ok := h.Users[username]
	return ok && len(userConnections) > 0

}

// NOTE: Never ever use defer r.mu.Unlock() in any of these in here it crashes the whole system I only put this in secure functions.
func (h *Hub) createRoom(owner *Client, roomID string) {
	h.mu.Lock()

	if roomID == "" {
		h.mu.Unlock()
		return
	}

	if _, exists := h.Rooms[roomID]; exists {
		h.mu.Unlock()
		h.sendSystem(owner, roomID, "room already exists")
		return
	}
	h.Rooms[roomID] = make(map[*Client]bool)
	h.RoomOwners[roomID] = owner.Username
	h.Rooms[roomID][owner] = true

	if h.Queries != nil {
		now := time.Now().UTC().Format(time.RFC3339)
		if err := h.Queries.CreateChatRoom(context.Background(), db.CreateChatRoomParams{
			ID:        roomID,
			OwnerID:   owner.UserID,
			CreatedAt: now,
		}); err != nil {

			delete(h.Rooms, roomID)
			delete(h.RoomOwners, roomID)
			h.mu.Unlock()
			h.sendSystem(owner, roomID, "unable to create room")
			return
		}
		if err := h.Queries.AddChatRoomMember(context.Background(), db.AddChatRoomMemberParams{
			RoomID:   roomID,
			UserID:   owner.UserID,
			JoinedAt: now,
		}); err != nil {
			delete(h.Rooms, roomID)
			delete(h.RoomOwners, roomID)
			h.mu.Unlock()
			h.sendSystem(owner, roomID, "unable to add owner to room")
			return
		}
	}
	h.mu.Unlock()
	h.sendSystem(owner, roomID, "room created")
	h.broadcastRoomMeta(roomID)
}

func (h *Hub) joinRoom(client *Client, roomID string) {
	h.mu.Lock()

	if roomID == "" {
		h.mu.Unlock()
		return
	}

	if _, ok := h.Rooms[roomID]; !ok {
		h.Rooms[roomID] = make(map[*Client]bool)
	}
	if h.roomHasUsernameLocked(roomID, client.Username) {
		h.mu.Unlock()
		h.sendSystem(client, roomID, "already in room")
		h.broadcastRoomMeta(roomID)
		return
	}

	h.Rooms[roomID][client] = true
	if h.Queries != nil {
		if err := h.Queries.AddChatRoomMember(context.Background(), db.AddChatRoomMemberParams{
			RoomID:   roomID,
			UserID:   client.UserID,
			JoinedAt: time.Now().UTC().Format(time.RFC3339),
		}); err != nil {

			delete(h.Rooms[roomID], client)
			h.mu.Unlock()
			h.sendSystem(client, roomID, "unable to join room")
			return
		}
	}
	h.mu.Unlock()
	debugRealtimeLog("join room=%s username=%s", roomID, client.Username)
	h.sendSystem(client, roomID, "joined room")
	h.broadcastRoomMeta(roomID)
}

func (h *Hub) addUserToRoom(requester *Client, roomID, username string) {
	h.mu.Lock()

	if roomID == "" || username == "" {
		h.mu.Unlock()
		return
	}

	room, roomExists := h.Rooms[roomID]
	if !roomExists {
		h.mu.Unlock()
		h.sendSystem(requester, roomID, "room does not exist")
		return
	}
	if !room[requester] {
		h.mu.Unlock()
		h.sendSystem(requester, roomID, "You are not in this room")
		return
	}
	if h.UserExists != nil {
		exists, err := h.UserExists(username)
		if err != nil {
			h.mu.Unlock()
			h.sendSystem(requester, roomID, "unable to validate user")
			return
		}
		if !exists {
			h.mu.Unlock()
			h.sendSystem(requester, roomID, "user does not exists")
			return
		}
	}
	if h.AreFriends != nil {
		friend, err := h.AreFriends(requester.UserID, username)
		if err != nil {
			h.mu.Unlock()
			h.sendSystem(requester, roomID, "unable to validate friendship")
			return
		}
		if !friend {

			h.mu.Unlock()
			h.sendSystem(requester, roomID, "you can only add users from your friend list")
			return
		}
	}
	if requester.Username == username {
		h.mu.Unlock()
		h.sendSystem(requester, roomID, "you are already in the room")
		return
	}
	if h.roomHasUsernameLocked(roomID, username) {
		h.mu.Unlock()
		h.sendSystem(requester, roomID, "user already in room")
		return
	}

	userConnections, userConnected := h.Users[username]
	if !userConnected || len(userConnections) == 0 {
		h.mu.Unlock()
		h.sendSystem(requester, roomID, "user is not online")
		return
	}
	var userToAdd *Client
	for candidate := range userConnections {
		userToAdd = candidate
		break
	}
	if userToAdd == nil {
		h.mu.Unlock()
		h.sendSystem(requester, roomID, "user is not online")
		return
	}

	room[userToAdd] = true
	if h.Queries != nil {
		if err := h.Queries.AddChatRoomMember(context.Background(), db.AddChatRoomMemberParams{
			RoomID:   roomID,
			UserID:   userToAdd.UserID,
			JoinedAt: time.Now().UTC().Format(time.RFC3339),
		}); err != nil {
			delete(room, userToAdd)
			h.mu.Unlock()
			h.sendSystem(requester, roomID, "unable to add user to room")
			return
		}
	}
	h.mu.Unlock()
	h.sendSystem(requester, roomID, username+" added to room")
	h.sendSystem(userToAdd, roomID, "you were added to room by "+requester.Username)
	h.PublishSocialEvent([]string{requester.Username, username}, "room_membership_updated")
	h.broadcastRoomMeta(roomID)
}

func (h *Hub) closeRoom(client *Client, roomID string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	owner, ok := h.RoomOwners[roomID]
	if !ok {
		h.sendSystem(client, roomID, "room does not exist")
		return
	}
	if owner != client.Username {
		h.sendSystem(client, roomID, "only owner can close room")
		return
	}

	members := make([]*Client, 0, len(h.Rooms[roomID]))
	for member := range h.Rooms[roomID] {
		members = append(members, member)
	}

	delete(h.Rooms, roomID)
	delete(h.RoomScreen, roomID)
	delete(h.RoomOwners, roomID)

	if h.Queries != nil {
		deletedRows, err := h.Queries.DeleteChatRoomByIDAndOwner(context.Background(), db.DeleteChatRoomByIDAndOwnerParams{
			ID:      roomID,
			OwnerID: client.UserID,
		})
		if err != nil || deletedRows == 0 {
			h.sendSystem(client, roomID, "unable to close room")
			h.Rooms[roomID] = make(map[*Client]bool)
			for _, member := range members {
				h.Rooms[roomID][member] = true
			}
			h.RoomOwners[roomID] = owner
			return

		}

	}
	for _, member := range members {
		h.sendSystem(member, roomID, "room closed")
	}
}

func (h *Hub) leaveRoom(client *Client, roomID string) {
	h.mu.Lock()

	room, ok := h.Rooms[roomID]
	if !ok {
		h.mu.Unlock()
		return
	}
	h.removeUserFromRoomLocked(roomID, client.Username)
	if sharers, ok := h.RoomScreen[roomID]; ok {
		delete(sharers, client.Username)
	}
	if h.Queries != nil {
		_ = h.Queries.MarkChatRoomMemberLeft(context.Background(), db.MarkChatRoomMemberLeftParams{
			LeftAt: sql.NullString{String: time.Now().UTC().Format(time.RFC3339), Valid: true},
			RoomID: roomID,
			UserID: client.UserID,
		})
	}
	if len(room) == 0 {
		delete(h.Rooms, roomID)
		delete(h.RoomScreen, roomID)
		delete(h.RoomOwners, roomID)

	} else {
		h.mu.Unlock()
		h.broadcastRoomMeta(roomID)
		h.broadcastScreenState(roomID)
		h.sendSystem(client, roomID, "left room")
		return
	}
	h.mu.Unlock()
	debugRealtimeLog("leave room=%s username=%s", roomID, client.Username)
	h.sendSystem(client, roomID, "left room")
}

func (h *Hub) sendToRoom(sender *Client, roomID string, msg Message) {
	h.mu.RLock()

	room, ok := h.Rooms[roomID]
	if !ok {
		h.mu.RUnlock()
		return
	}

	recipients := make([]*Client, 0, len(room))
	for client := range room {
		recipients = append(recipients, client)
	}
	h.mu.RUnlock()
	// So about this time formatting it is completely vibe coding.
	// And the reason for this is I couldn't find a solution for a long time and had to give up.
	if h.Queries != nil && msg.Type == TypeRoomMessage && sender != nil {
		messageID := fmt.Sprintf("%s-%s", time.Now().UTC().Format("20060102150405.000000000"), sender.UserID)
		kind := strings.TrimSpace(msg.Kind)
		if kind == "" {
			kind = "text"
		}
		_ = h.Queries.CreateChatMessage(context.Background(), db.CreateChatMessageParams{
			ID:             messageID,
			RoomID:         roomID,
			SenderID:       sender.UserID,
			SenderUsername: sender.Username,
			Content:        msg.Content,
			CreatedAt:      time.Now().UTC().Format(time.RFC3339),
			Kind:           kind,
			// about nullstrings it appears if we set any column in database as nullable. The way this works is;
			// think it as a typescript if there is something to put in here do this otherwise do this.
			MediaUrl: sql.NullString{String: msg.MediaURL, Valid: strings.TrimSpace(msg.MediaURL) != ""},
			MimeType: sql.NullString{String: msg.MimeType, Valid: strings.TrimSpace(msg.MimeType) != ""},
			FileName: sql.NullString{String: msg.FileName, Valid: strings.TrimSpace(msg.FileName) != ""},
			FileSize: msg.FileSize,
		})
	}

	data, _ := json.Marshal(msg)

	for _, client := range recipients {
		select {
		case client.Send <- data:
		default:
			h.enqueueUnregister(client)
		}
	}
}

func (h *Hub) PublishRoomMessage(msg Message) {
	if msg.RoomID == "" {
		return
	}
	if msg.Type == "" {
		msg.Type = TypeRoomMessage
	}
	if msg.TimeStamp == "" {
		msg.TimeStamp = time.Now().UTC().Format(time.RFC3339)
	}
	h.sendToRoom(nil, msg.RoomID, msg)
}

func (h *Hub) RehydrateJoin(client *Client, roomID, ownerUsername string) {
	if client == nil || roomID == "" {
		return
	}
	shouldBroadcast := false
	h.mu.Lock()
	if _, ok := h.Rooms[roomID]; !ok {
		h.Rooms[roomID] = make(map[*Client]bool)
		shouldBroadcast = true
	}
	if !h.Rooms[roomID][client] {
		shouldBroadcast = true
	}
	h.Rooms[roomID][client] = true
	if ownerUsername != "" {
		h.RoomOwners[roomID] = ownerUsername
	}
	h.mu.Unlock()

	if shouldBroadcast {
		h.broadcastRoomMeta(roomID)
	}
}

// This is only here to show who is in the room or who is the owner of the room.
// Completely here for information even without this system will work fine.
func (h *Hub) SendRoomMetaToClient(client *Client, roomID string) {
	if client == nil || roomID == "" {
		return
	}
	meta := h.buildRoomMeta(roomID)
	if meta == nil {
		return
	}
	data, _ := json.Marshal(meta)
	select {
	case client.Send <- data:
	default:
	}
}

func (h *Hub) SendScreenStateToClient(client *Client, roomID string) {
	if client == nil || roomID == "" {
		return
	}
	state := h.buildScreenState(roomID)
	if state == nil {
		return
	}
	data, _ := json.Marshal(state)
	select {
	case client.Send <- data:
	default:
	}
}

func (h *Hub) broadcastRoomMeta(roomID string) {
	meta, recipients := h.buildRoomMetaWithRecipients(roomID)
	if meta == nil {
		return
	}
	data, _ := json.Marshal(meta)
	for _, client := range recipients {
		select {
		case client.Send <- data:
		default:
		}
	}
}

func (h *Hub) broadcastScreenState(roomID string) {
	state, recipients := h.buildScreenStateWithRecipients(roomID)
	if state == nil {
		return
	}
	data, _ := json.Marshal(state)
	for _, client := range recipients {
		select {
		case client.Send <- data:
		default:
		}
	}
}
func (h *Hub) buildScreenState(roomID string) *ScreenShareState {
	state, _ := h.buildScreenStateWithRecipients(roomID)
	return state
}

func (h *Hub) buildRoomMeta(roomID string) *RoomMeta {
	meta, _ := h.buildRoomMetaWithRecipients(roomID)
	return meta
}

func (h *Hub) buildRoomMetaWithRecipients(roomID string) (*RoomMeta, []*Client) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	room, ok := h.Rooms[roomID]
	if !ok || len(room) == 0 {
		return nil, nil
	}
	activeUsers := make([]string, 0, len(room))
	seenUsers := make(map[string]bool, len(room))
	recipients := make([]*Client, 0, len(room))
	for member := range room {
		if !seenUsers[member.Username] {
			activeUsers = append(activeUsers, member.Username)
			seenUsers[member.Username] = true
		}
		recipients = append(recipients, member)
	}
	sort.Strings(activeUsers)
	return &RoomMeta{
		Type:          typeRoomMeta,
		RoomID:        roomID,
		OwnerUsername: h.RoomOwners[roomID],
		ActiveUsers:   activeUsers,
	}, recipients
}

func (h *Hub) roomHasUsernameLocked(roomID, username string) bool {
	room := h.Rooms[roomID]
	for member := range room {
		if member.Username == username {
			return true
		}
	}
	return false
}

func (h *Hub) removeUserFromRoomLocked(roomID, username string) {
	room := h.Rooms[roomID]
	for member := range room {
		if member.Username == username {
			delete(room, member)
		}
	}
}

func (h *Hub) buildScreenStateWithRecipients(roomID string) (*ScreenShareState, []*Client) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	room, ok := h.Rooms[roomID]
	if !ok || len(room) == 0 {
		return nil, nil
	}
	sharers := h.RoomScreen[roomID]
	activeUsers := make([]string, 0, len(sharers))
	recipients := make([]*Client, 0, len(room))
	for member := range room {
		recipients = append(recipients, member)
	}
	for username := range sharers {
		activeUsers = append(activeUsers, username)
	}
	sort.Strings(activeUsers)
	return &ScreenShareState{
		Type:        TypeScreenState,
		RoomID:      roomID,
		ActiveUsers: activeUsers,
	}, recipients
}

func (h *Hub) updateScreenShareState(roomID, username string, isSharing bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if roomID == "" || username == "" {
		return
	}
	if _, ok := h.Rooms[roomID]; !ok {
		return
	}
	if h.RoomScreen[roomID] == nil {
		h.RoomScreen[roomID] = make(map[string]bool)
	}
	if isSharing {
		h.RoomScreen[roomID][username] = true
		return
	}
	delete(h.RoomScreen[roomID], username)
}

// I'll transport this into admin site when I do write one, for now this stays here.
func (h *Hub) sendSystem(client *Client, roomID, content string) {
	if client == nil {
		return
	}

	msg := Message{
		Type:    TypeSystem,
		RoomID:  roomID,
		From:    "system",
		Content: content,
	}
	data, _ := json.Marshal(msg)
	select {
	case client.Send <- data:
	default:
	}
}

func (h *Hub) sendDirect(username string, msg Message) {
	h.mu.RLock()
	connections, ok := h.Users[username]
	recipients := make([]*Client, 0, len(connections))
	for client := range connections {
		recipients = append(recipients, client)
	}
	h.mu.RUnlock()
	if !ok || len(recipients) == 0 {
		return
	}
	data, _ := json.Marshal(msg)
	for _, client := range recipients {
		select {
		case client.Send <- data:
		default:
			h.enqueueUnregister(client)
		}
	}
}

func (h *Hub) PublishSocialEvent(usernames []string, content string) {
	if strings.TrimSpace(content) == "" || len(usernames) == 0 {
		return
	}
	seen := make(map[string]bool, len(usernames))
	for _, username := range usernames {
		trimmed := strings.TrimSpace(username)
		if trimmed == "" || seen[trimmed] {
			continue
		}
		seen[trimmed] = true
		h.sendDirect(trimmed, Message{
			Type:      TypeSocialEvent,
			From:      "system",
			Content:   content,
			TimeStamp: time.Now().UTC().Format(time.RFC3339),
		})
	}
}

func (h *Hub) broadcastPresence(username string, isOnline bool, timestamp string) {
	if strings.TrimSpace(username) == "" {
		return
	}
	if timestamp == "" {
		timestamp = time.Now().UTC().Format(time.RFC3339)
	}
	msg := Message{
		Type:      TypePresence,
		From:      username,
		TimeStamp: timestamp,
		Online:    &isOnline,
	}
	data, _ := json.Marshal(msg)

	h.mu.RLock()
	recipients := make([]*Client, 0, len(h.Clients))
	for client := range h.Clients {
		recipients = append(recipients, client)
	}
	h.mu.RUnlock()

	for _, recipient := range recipients {
		select {
		case recipient.Send <- data:
		default:
			h.enqueueUnregister(recipient)
		}
	}
}

func (h *Hub) enqueueUnregister(client *Client) {
	if client == nil {
		return
	}
	select {
	case h.Unregister <- client:
	default:
	}
}
