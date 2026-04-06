package websocket

type MessageType string

// We are using websocket as a signeling service too
// This is why this section is so bloated
// Here are the optionals; first you can simply write your own message
// types for sdp(simply WebRTC) signals with another system
// or you can simply write another endpoint for voice chat or screen sharing
// DON'T EVER DO THE SECOND ONE!!
const (
	TypeRoomMessage        MessageType = "room_message"
	TypeDirect             MessageType = "direct_message"
	TypeJoinRoom           MessageType = "join_room"
	TypeLeaveRoom          MessageType = "leave_room"
	TypeCreateRoom         MessageType = "create_room"
	TypeCloseRoom          MessageType = "close_room"
	TypeAddToRoom          MessageType = "add_to_room"
	typeRoomMeta           MessageType = "room_meta"
	TypeSystem             MessageType = "system"
	TypeVoiceJoin          MessageType = "voice_join"
	TypeVoiceLeave         MessageType = "voice_leave"
	TypeVoiceState         MessageType = "voice_state"
	TypeVoiceVolume        MessageType = "voice_volume"
	TypeWebRTCOffer        MessageType = "webrtc_offer"
	TypeWebRTCAnswer       MessageType = "webrtc_answer"
	TypeWebRTCIceCandidate MessageType = "webrtc_ice_candidate"
	TypeScreenStart        MessageType = "screen_share_start"
	TypeScreenStop         MessageType = "screen_share_stop"
	TypeScreenState        MessageType = "screen_share_state"
	TypeStreamMetrics      MessageType = "stream_metrics"
	TypePresence           MessageType = "presence"
	TypeSocialEvent        MessageType = "social_event"
	TypeKeepAlive          MessageType = "keepalive"
)

type Message struct {
	Type          MessageType `json:"type"`
	RoomID        string      `json:"room_id,omitempty"`
	To            string      `json:"to,omitempty"`
	From          string      `json:"from"`
	Content       string      `json:"content,omitempty"`
	TimeStamp     string      `json:"timestamp"`
	Kind          string      `json:"kind,omitempty"`
	MediaURL      string      `json:"media_url,omitempty"`
	MimeType      string      `json:"mime_type,omitempty"`
	FileName      string      `json:"file_name,omitempty"`
	FileSize      int64       `json:"file_size,omitempty"`
	SDP           string      `json:"sdp,omitempty"`
	Candidate     string      `json:"candidate,omitempty"`
	SDPMid        string      `json:"sdp_mid,omitempty"`
	SDPMLineIndex *uint16     `json:"sdp_mline_index,omitempty"`

	MicMuted      bool    `json:"mic_muted,omitempty"`
	OutputMuted   bool    `json:"output_muted,omitempty"`
	FPS           float64 `json:"fps,omitempty"`
	LatencyMS     float64 `json:"latency_ms,omitempty"`
	BitrateKbps   float64 `json:"bitrate_kbps,omitempty"`
	NetworkStatus string  `json:"network_status,omitempty"`
	Online        *bool   `json:"online,omitempty"`
}
