package endpoints

import "net/http"

func (h *Handler) MetricsHandler(w http.ResponseWriter, r *http.Request) {
	if h.App.Metrics == nil {
		RespondWithError(w, http.StatusServiceUnavailable, "Metrics unavailable", nil)
		return
	}
	RespondWithJson(w, http.StatusOK, h.App.Metrics.Snapshot())
}
