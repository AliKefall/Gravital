package observability

import (
	"strconv"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

var (
	prometheusMetricsOnce sync.Once
	prometheusMetricsInst *PrometheusMetrics
)

// PrometheusMetrics keeps all Prometheus collectors in one place so HTTP and WS
// layers can emit metrics without duplicating collector definitions.
type PrometheusMetrics struct {
	httpRequestsTotal    *prometheus.CounterVec
	httpRequestDuration  *prometheus.HistogramVec
	httpRequestsInFlight prometheus.Gauge

	wsConnectionsActive prometheus.Gauge
	wsConnectionsTotal  *prometheus.CounterVec
	wsMessagesTotal     *prometheus.CounterVec
}

// NewPrometheusMetrics creates and registers collectors once (process-wide),
// then returns the same shared instance to all callers.
func NewPrometheusMetrics() *PrometheusMetrics {
	prometheusMetricsOnce.Do(func() {
		m := &PrometheusMetrics{
			httpRequestsTotal: prometheus.NewCounterVec(
				prometheus.CounterOpts{
					Namespace: "gravital",
					Subsystem: "http",
					Name:      "requests_total",
					Help:      "Total number of HTTP requests handled by route and status code.",
				},
				[]string{"method", "path", "status"},
			),
			httpRequestDuration: prometheus.NewHistogramVec(
				prometheus.HistogramOpts{
					Namespace: "gravital",
					Subsystem: "http",
					Name:      "request_duration_seconds",
					Help:      "Duration of HTTP requests in seconds.",
					Buckets:   []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10},
				},
				[]string{"method", "path", "status"},
			),
			httpRequestsInFlight: prometheus.NewGauge(prometheus.GaugeOpts{
				Namespace: "gravital",
				Subsystem: "http",
				Name:      "requests_in_flight",
				Help:      "Current number of HTTP requests being served.",
			}),
			wsConnectionsActive: prometheus.NewGauge(prometheus.GaugeOpts{
				Namespace: "gravital",
				Subsystem: "ws",
				Name:      "connections_active",
				Help:      "Current number of active WebSocket connections.",
			}),
			wsConnectionsTotal: prometheus.NewCounterVec(
				prometheus.CounterOpts{
					Namespace: "gravital",
					Subsystem: "ws",
					Name:      "connections_total",
					Help:      "Total WebSocket connection attempts by result.",
				},
				[]string{"result"},
			),
			wsMessagesTotal: prometheus.NewCounterVec(
				prometheus.CounterOpts{
					Namespace: "gravital",
					Subsystem: "ws",
					Name:      "messages_total",
					Help:      "Total WebSocket messages by direction and type.",
				},
				[]string{"direction", "type"},
			),
		}

		prometheus.MustRegister(
			m.httpRequestsTotal,
			m.httpRequestDuration,
			m.httpRequestsInFlight,
			m.wsConnectionsActive,
			m.wsConnectionsTotal,
			m.wsMessagesTotal,
		)
		prometheusMetricsInst = m
	})

	return prometheusMetricsInst
}

// ObserveHTTPRequest records request counters and latency.
func (m *PrometheusMetrics) ObserveHTTPRequest(method, path string, statusCode int, duration time.Duration) {
	if m == nil {
		return
	}
	status := strconv.Itoa(statusCode)
	m.httpRequestsTotal.WithLabelValues(method, path, status).Inc()
	m.httpRequestDuration.WithLabelValues(method, path, status).Observe(duration.Seconds())
}

// IncHTTPInFlight and DecHTTPInFlight are intentionally separate to avoid
// mismatched +1/-1 operations inside middleware flow.
func (m *PrometheusMetrics) IncHTTPInFlight() {
	if m == nil {
		return
	}
	m.httpRequestsInFlight.Inc()
}

func (m *PrometheusMetrics) DecHTTPInFlight() {
	if m == nil {
		return
	}
	m.httpRequestsInFlight.Dec()
}

// ObserveWSConnectionAttempt tracks handshake/auth outcomes for /ws.
// We use GetMetricWithLabelValues to avoid process crash on unexpected label mismatch.
func (m *PrometheusMetrics) ObserveWSConnectionAttempt(result string) {
	if m == nil {
		return
	}
	metric, err := m.wsConnectionsTotal.GetMetricWithLabelValues(result)
	if err != nil {
		return
	}
	metric.Inc()
}

func (m *PrometheusMetrics) IncWSActiveConnections() {
	if m == nil {
		return
	}
	m.wsConnectionsActive.Inc()
}

func (m *PrometheusMetrics) DecWSActiveConnections() {
	if m == nil {
		return
	}
	m.wsConnectionsActive.Dec()
}

// ObserveWSMessage records message flow and type for ws traffic analysis.
func (m *PrometheusMetrics) ObserveWSMessage(direction, messageType string) {
	if m == nil {
		return
	}
	if messageType == "" {
		messageType = "unknown"
	}
	metric, err := m.wsMessagesTotal.GetMetricWithLabelValues(direction, messageType)
	if err != nil {
		return
	}
	metric.Inc()
}
