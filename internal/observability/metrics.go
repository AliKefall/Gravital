package observability

import (
	"fmt"
	"sort"
	"sync"
	"sync/atomic"
	"time"
)

type Metrics struct {
	startedAt    time.Time
	totalReq     atomic.Uint64
	totalErr     atomic.Uint64
	activeReq    atomic.Int64
	responseTime atomic.Uint64

	mu           sync.RWMutex
	statusCounts map[int]uint64
	pathCounts   map[string]uint64
}

type Snapshot struct {
	StartedAt                 time.Time         `json:"started_at"`
	TotalRequests             uint64            `json:"total_requests"`
	TotalErrors               uint64            `json:"total_errors"`
	ActiveRequests            int64             `json:"active_requests"`
	AverageResponseTimeMillis float64           `json:"avg_response_time_ms"`
	StatusCodes               map[string]uint64 `json:"status_codes"`
	TopPaths                  map[string]uint64 `json:"top_paths"`
}

func NewMetrics() *Metrics {
	return &Metrics{
		startedAt:    time.Now().UTC(),
		statusCounts: make(map[int]uint64),
		pathCounts:   make(map[string]uint64),
	}
}

func (m *Metrics) BeginRequest() {
	m.activeReq.Add(1)
}

func (m *Metrics) EndRequest(method, path string, statusCode int, elapsed time.Duration) {
	m.activeReq.Add(-1)
	m.totalReq.Add(1)
	if statusCode >= 400 {
		m.totalErr.Add(1)
	}
	m.responseTime.Add(uint64(elapsed.Milliseconds()))
	routeKey := fmt.Sprintf("%s %s", method, path)
	m.mu.Lock()
	m.statusCounts[statusCode]++
	m.pathCounts[routeKey]++
	m.mu.Unlock()
}

func (m *Metrics) Snapshot() Snapshot {
	totalReq := m.totalReq.Load()
	avgMs := 0.0
	if totalReq > 0 {
		avgMs = float64(m.responseTime.Load()) / float64(totalReq)
	}
	m.mu.RLock()
	statusCopy := make(map[string]uint64, len(m.statusCounts))
	for code, count := range m.statusCounts {
		statusCopy[fmt.Sprintf("%d", code)] = count
	}
	for code, count := range m.statusCounts {
		statusCopy[fmt.Sprintf("%d", code)] = count
	}
	paths := make([]struct {
		key   string
		count uint64
	}, 0, len(m.pathCounts))
	for key, count := range m.pathCounts {
		paths = append(paths, struct {
			key   string
			count uint64
		}{
			key: key, count: count,
		})
	}
	m.mu.RUnlock()

	sort.Slice(paths, func(i, j int) bool {
		if paths[i].count == paths[j].count {
			return paths[i].key < paths[j].key
		}
		return paths[i].count > paths[j].count
	})
	topPaths := make(map[string]uint64)
	for idx, item := range paths {
		if idx >= 10 {
			break
		}
		topPaths[item.key] = item.count
	}

	return Snapshot{
		StartedAt:                 m.startedAt,
		TotalRequests:             totalReq,
		TotalErrors:               m.totalErr.Load(),
		ActiveRequests:            m.activeReq.Load(),
		AverageResponseTimeMillis: avgMs,
		StatusCodes:               statusCopy,
		TopPaths:                  topPaths,
	}
}
