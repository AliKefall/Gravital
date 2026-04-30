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
	ttl          time.Duration
	cleanupEvery time.Duration
	lastCleanup  time.Time
	mu           sync.RWMutex
	entries      map[string]friendCacheEntry
}

func NewFriendListCache(ttl time.Duration) *FriendListCache {
	return &FriendListCache{
		ttl:          ttl,
		cleanupEvery: ttl,
		lastCleanup:  time.Now(),
		entries:      make(map[string]friendCacheEntry),
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
	c.cleanupExpiredLocked(time.Now())
	c.entries[userID] = friendCacheEntry{
		usernames: append([]string(nil), usernames...),
		expiresAt: time.Now().Add(c.ttl),
	}
	c.mu.Unlock()
}

func (c *FriendListCache) cleanupExpiredLocked(now time.Time) {
	if now.Sub(c.lastCleanup) < c.cleanupEvery {
		return
	}
	for key, entry := range c.entries {
		if now.After(entry.expiresAt) {
			delete(c.entries, key)
		}
	}
	c.lastCleanup = now
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
