package websocket

import (
	"encoding/json"
	"testing"
	"time"
)

func TestHubJoinRoomAndSendToRoom(t *testing.T) {
	h := NewHub()
	h.Unregister = make(chan *Client, 10)

	c1 := &Client{Username: "alice", Send: make(chan []byte, 4), Hub: h}
	c2 := &Client{Username: "bob", Send: make(chan []byte, 4), Hub: h}

	h.Rooms["room-1"] = map[*Client]bool{
		c1: true,
		c2: true,
	}

	msg := Message{Type: TypeRoomMessage, RoomID: "room-1", Content: "hello"}
	h.sendToRoom(c1, "room-1", msg)

	for _, c := range []*Client{c1, c2} {

		foundRoomMessage := false
		for i := 0; i < 3; i++ {
			select {
			case raw := <-c.Send:
				var got Message
				if err := json.Unmarshal(raw, &got); err != nil {
					t.Fatalf("json.Unmarshal error: %v", err)
				}
				if got.Type == TypeRoomMessage && got.Content == "hello" {
					foundRoomMessage = true
				}
			case <-time.After(200 * time.Millisecond):
			}

			if foundRoomMessage {
				break
			}
		}
		if !foundRoomMessage {
			select {
			case raw := <-c.Send:
				var got Message
				if err := json.Unmarshal(raw, &got); err != nil {
					t.Fatalf("json.Unmarshal error: %v", err)
				}
				t.Fatalf("client %s got unexpected message type=%s content=%q", c.Username, got.Type, got.Content)
			default:
				t.Fatalf("client %s did not receive room message", c.Username)
			}

		}
	}
}

func TestHubSendDirect(t *testing.T) {
	h := NewHub()
	h.Unregister = make(chan *Client, 10)

	c := &Client{Username: "alice", Send: make(chan []byte, 1), Hub: h}
	h.Users[c.Username] = map[*Client]bool{c: true}

	msg := Message{Type: TypeDirect, To: "alice", Content: "dm"}
	h.sendDirect("alice", msg)

	select {
	case raw := <-c.Send:
		var got Message
		if err := json.Unmarshal(raw, &got); err != nil {
			t.Fatalf("json.Unmarshal error: %v", err)
		}
		if got.Content != "dm" {
			t.Fatalf("got content %q, want %q", got.Content, "dm")
		}
	default:
		t.Fatal("direct message not delivered")
	}
}

func TestHubSendToRoom_UnregistersSlowClient(t *testing.T) {
	h := NewHub()
	h.Unregister = make(chan *Client, 10)

	slow := &Client{Username: "slow", Send: make(chan []byte, 2), Hub: h}

	h.Rooms["room-1"] = map[*Client]bool{
		slow: true,
	}
	slow.Send <- []byte("full-1")
	slow.Send <- []byte("full-2")

	msg := Message{Type: TypeRoomMessage, RoomID: "room-1", Content: "hello"}
	h.sendToRoom(slow, "room-1", msg)

	select {
	case got := <-h.Unregister:
		if got != slow {
			t.Fatalf("unregistered client mismatch")
		}
	default:
		t.Fatal("expected slow client to be queued for unregister")
	}
}

func TestHubAddUserToRoom(t *testing.T) {
	h := NewHub()

	owner := &Client{Username: "alice", Send: make(chan []byte, 3), Hub: h}
	bob := &Client{Username: "bob", Send: make(chan []byte, 3), Hub: h}
	h.Users[owner.Username] = map[*Client]bool{owner: true}
	h.Users[bob.Username] = map[*Client]bool{bob: true}

	h.createRoom(owner, "room-1")
	h.addUserToRoom(owner, "room-1", "bob")

	if !h.Rooms["room-1"][bob] {
		t.Fatal("expected bob to be in room after add")
	}
}

func TestHubForwardRealtimeRoomSignal_WebRTCIsTargeted(t *testing.T) {
	h := NewHub()
	h.Unregister = make(chan *Client, 10)

	alice := &Client{Username: "alice", Send: make(chan []byte, 2), Hub: h}
	bob := &Client{Username: "bob", Send: make(chan []byte, 2), Hub: h}
	charlie := &Client{Username: "charlie", Send: make(chan []byte, 2), Hub: h}

	h.Rooms["room-1"] = map[*Client]bool{
		alice:   true,
		bob:     true,
		charlie: true,
	}

	h.forwardRealtimeRoomSignal(alice, Message{
		Type:   TypeWebRTCOffer,
		RoomID: "room-1",
		To:     "bob",
		SDP:    "fake-sdp",
	})

	select {
	case raw := <-bob.Send:
		var got Message
		if err := json.Unmarshal(raw, &got); err != nil {
			t.Fatalf("json.Unmarshal error: %v", err)
		}
		if got.Type != TypeWebRTCOffer || got.SDP != "fake-sdp" || got.From != "alice" {
			t.Fatalf("unexpected forwarded offer: %+v", got)
		}
	default:
		t.Fatal("expected bob to receive targeted webrtc offer")
	}

	select {
	case <-charlie.Send:
		t.Fatal("did not expect charlie to receive targeted webrtc offer")
	default:
	}
}

func TestHubHandleMessage_KeepAliveIsNoop(t *testing.T) {
	h := NewHub()
	client := &Client{Username: "alice", Send: make(chan []byte, 1), Hub: h}
	h.Rooms["room-1"] = map[*Client]bool{client: true}

	h.HandleMessage(client, Message{Type: TypeKeepAlive, RoomID: "room-1"})

	select {
	case <-client.Send:
		t.Fatal("expected keepalive to be ignored")
	default:
	}
}
