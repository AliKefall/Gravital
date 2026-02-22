package websocket

import (
	"net/http"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

func ServeWS(hub *Hub, w http.ResponseWriter, r *http.Request, userID string, roomID string) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	client := &Client{
		ID:     userID,
		RoomID: roomID,
		Hub:    hub,
		Conn:   conn,
		Send:   make(chan []byte),
	}

	hub.register <- client

	go client.WritePump()
	go client.ReadPump()
}
