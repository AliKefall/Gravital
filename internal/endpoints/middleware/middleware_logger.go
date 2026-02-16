package middleware

import (
	"log"
	"net/http"
	"time"
)

type responseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}

func Logger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		rw := &responseWriter{
			ResponseWriter: w,
			status:         http.StatusOK,
		}
		next.ServeHTTP(rw, r)

		duration := time.Since(start)

		reqID, _ := r.Context().Value(requestIDKey).(string)

		log.Printf(
			"request_id=%s method=%s path=%s status=%d duration=%s",
			reqID,
			r.Method,
			r.URL.Path,
			rw.status,
			duration,
		)
	})
}
