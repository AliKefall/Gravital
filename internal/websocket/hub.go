package websocket

type Message struct {
	RoomID string
	Data   []byte
}

type Hub struct {
	clients    map[string]*Client
	rooms      map[string]map[string]*Client
	register   chan *Client
	unregister chan *Client
	broadcast  chan Message
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[string]*Client),
		rooms:      make(map[string]map[string]*Client),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan Message, 256),
	}
}

func (h *Hub) Run() {
	for {
		select {

		case client := <-h.register:
			h.clients[client.ID] = client

			if _, ok := h.rooms[client.RoomID]; !ok {
				h.rooms[client.RoomID] = make(map[string]*Client)
			}
			h.rooms[client.RoomID][client.ID] = client

		case client := <-h.unregister:
			if _, ok := h.clients[client.ID]; ok {
				delete(h.clients, client.ID)

				if room, ok := h.rooms[client.RoomID]; ok {
					delete(room, client.ID)
					if len(room) == 0 {
						delete(h.rooms, client.RoomID)
					}
				}

				close(client.Send)
			}

		case message := <-h.broadcast:
			if room, ok := h.rooms[message.RoomID]; ok {
				for _, client := range room {
					select {
					case client.Send <- message.Data:
					default:
						close(client.Send)
						delete(h.clients, client.ID)
						delete(room, client.ID)
					}
				}
			}
		}
	}
}
