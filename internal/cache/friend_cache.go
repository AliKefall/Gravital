package cache

import (
	"sync"
	"time"
)

type friendCacheEntry struct {
	usernames []string
	expiresAt time.Time
}

type FriendListCache struct {
	ttl     time.Duration
	mu      sync.RWMutex
	entries map[string]friendCacheEntry
}

func NewFriendListCache(ttl time.Duration) *FriendListCache {
	return &FriendListCache{
		ttl:     ttl,
		entries: make(map[string]friendCacheEntry),
	}
}

func (c *FriendListCache) Get(userID string) ([]string, bool) {
	if userID == "" {
		return nil, false
	}

	c.mu.RLock()
	entry, ok := c.entries[userID]
	c.mu.RUnlock()
	if !ok {
		return nil, false
	}
	if time.Now().After(entry.expiresAt) {
		c.mu.Lock()
		delete(c.entries, userID)
		c.mu.Unlock()
		return nil, false
	}
	return append([]string(nil), entry.usernames...), true
}

func (c *FriendListCache) Set(userID string, usernames []string) {
	if userID == "" {
		return
	}
	c.mu.Lock()
	c.entries[userID] = friendCacheEntry{
		usernames: append([]string(nil), usernames...),
		expiresAt: time.Now().Add(c.ttl),
	}
	c.mu.Unlock()
}

func (c *FriendListCache) Invalidate(userIDs ...string) {
	c.mu.Lock()
	for _, userID := range userIDs {
		if userID == "" {
			continue
		}
		delete(c.entries, userID)
	}
	c.mu.Unlock()
}
