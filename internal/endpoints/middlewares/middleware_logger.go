package middlewares

import (
	"bufio"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"time"

	"github.com/AliKefall/Gravital/internal/observability"
)

type responseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}

// if you are using websocket and want to use a middleware and if that middleware
// uses "ResponseWriter" you have to write Hijacker for it.
// I learned this today after 5 hours of pain and agony.
// thank you my dear programmer who saw this 8 years ago at stackoverflow
func (rw *responseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	hijacker, ok := rw.ResponseWriter.(http.Hijacker)
	if !ok {
		return nil, nil, fmt.Errorf("underlying ResponseWriter does not support hijacking")
	}
	return hijacker.Hijack()
}

// NOTE: Log messages can be expanded with you own choice of demand. Just don't log important data in the logger.
// This middleware is unused atm this is only here if you want your own custom logger system.
func LoggerWithMetrics(metrics *observability.Metrics, prom *observability.PrometheusMetrics) func(http.Handler) http.Handler {
	logger := slog.Default()
	return func(h http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			metrics.BeginRequest()
			prom.IncHTTPInFlight()

			rw := &responseWriter{ResponseWriter: w, status: http.StatusOK}
			h.ServeHTTP(rw, r)

			duration := time.Since(start)
			reqID, _ := r.Context().Value(requestIDKey).(string)
			metrics.EndRequest(r.Method, r.URL.Path, rw.status, duration)
			prom.ObserveHTTPRequest(r.Method, r.URL.Path, rw.status, duration)
			prom.DecHTTPInFlight()
			logger.Info("http_request",
				slog.String("request_id", reqID),
				slog.String("method", r.Method),
				slog.String("path", r.URL.Path),
				slog.Int("status", rw.status),
				slog.Int64("duration_ms", duration.Milliseconds()),
			)
		})
	}
}
