package endpoints

import "net/http"

// This is not the prometheuses handler, this one is here for backends metrics
// Not the prometheuses metrics, totaly here for testing.
func (h *Handler) MetricsHandler(w http.ResponseWriter, r *http.Request) {
	if h.App.Metrics == nil {
		RespondWithError(w, http.StatusServiceUnavailable, "Metrics unavailable", nil)
		return
	}
	RespondWithJson(w, http.StatusOK, h.App.Metrics.Snapshot())
}
