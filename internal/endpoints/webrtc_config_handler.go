package endpoints

import (
	"net/http"
	"os"
	"strings"
)

type WebRTCConfigResponse struct {
	StunURLs       []string `json:"stun_urls"`
	TurnURLs       []string `json:"turn_urls"`
	TurnUsername   string   `json:"turn_username,omitempty"`
	TurnCredential string   `json:"turn_credential,omitempty"`
}

func splitCSVEnv(value string) []string {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	parts := strings.Split(value, ",")
	urls := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed == "" {
			continue
		}
		urls = append(urls, trimmed)
	}
	return urls
}

func (h *Handler) WebRTCConfigHandler(w http.ResponseWriter, r *http.Request) {
	response := WebRTCConfigResponse{
		StunURLs:       splitCSVEnv(os.Getenv("VITE_STUN_URLS")),
		TurnURLs:       splitCSVEnv(os.Getenv("VITE_TURN_URLS")),
		TurnUsername:   strings.TrimSpace(os.Getenv("VITE_TURN_USERNAME")),
		TurnCredential: strings.TrimSpace(os.Getenv("VITE_TURN_CREDENTIAL")),
	}
	RespondWithJson(w, http.StatusOK, response)
}
