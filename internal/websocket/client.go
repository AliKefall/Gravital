package websocket

import (
	"log"

	"github.com/gorilla/websocket"
)

type Client struct {
	ID     string
	RoomID string
	Hub    *Hub
	Conn   *websocket.Conn
	Send   chan []byte
}

func (c *Client) ReadPump() {
	defer func() {
		c.Hub.unregister <- c
		c.Conn.Close()
	}()

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			break
		}

		c.Hub.broadcast <- Message{
			RoomID: c.RoomID,
			Data:   message,
		}
	}
}

func (c *Client) WritePump() {
	defer c.Conn.Close()

	for msg := range c.Send {
		err := c.Conn.WriteMessage(websocket.TextMessage, msg)
		if err != nil {
			log.Println("write error: ", err)
			break
		}

	}
}
