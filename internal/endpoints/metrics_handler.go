package endpoints

import "net/http"

// Legacy JSON metrics endpoint removed.
func (h *Handler) MetricsHandler(w http.ResponseWriter, r *http.Request) {
	http.NotFound(w, r)
}
