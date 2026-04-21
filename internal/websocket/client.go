package websocket

import (
	"log"
	"time"

	"github.com/gorilla/websocket"
)

const (
	maxMessageSize = 128 * 1024 // standarized version of this is 4kb but sdp payload can be much bigger so tweak this in the ascending order not the opposite.
	pongWait       = 75 * time.Second
	pingPeriod     = 25 * time.Second
	writeWait      = 10 * time.Second
)

// I'll add some roles for this struct. it works just fine atm.
type Client struct {
	UserID   string
	Username string
	Conn     *websocket.Conn
	Send     chan []byte
	Hub      *Hub
}

// Standarized read and write pumps. You can find them in the gorilla/websocker documentation
func (c *Client) ReadPump() {
	defer func() {
		c.Hub.Unregister <- c
		c.Conn.Close()
	}()
	c.Conn.SetReadLimit(maxMessageSize)
	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(appData string) error {
		return c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	})

	for {
		var msg Message
		err := c.Conn.ReadJSON(&msg)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				log.Printf("Websocket read error for user= %s: %v", c.Username, err)
			}
			// Break was forgotten. It was creating a ws loop.
			break
		}
		msg.From = c.Username
		c.Hub.HandleMessage(c, msg)
	}

}

func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()
	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				_ = c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}
		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}

	}
}
