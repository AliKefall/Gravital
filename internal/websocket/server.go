package websocket

import (
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/gorilla/websocket"
)

// Except the buffer sizes don't tweak with anything in here for now.
// When youre seting up WS_ALLOWED_ORIGINS be sure it is also in the CORS.
// If it is not you will get upgreader error.
var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		if origin == "" {
			return false
		}
		allowedOrigins := strings.Split(os.Getenv("WS_ALLOWED_ORIGINS"), ",")
		for _, allowed := range allowedOrigins {
			if strings.TrimSpace(allowed) == origin {
				return true
			}
		}
		return false
	},
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
}

func ServeWS(hub *Hub, w http.ResponseWriter, r *http.Request, userID string, username string, onConnected func(*Client)) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Error while serving websocket: ", err)
		return
	}
	client := &Client{
		UserID:   userID,
		Username: username,
		Conn:     conn,
		Send:     make(chan []byte, 256),
		Hub:      hub,
	}
	hub.Register <- client
	if onConnected != nil {
		onConnected(client)
	}

	go client.WritePump()
	go client.ReadPump()
}
