CREATE TABLE IF NOT EXISTS friend_requests (
    requester_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (requester_id, target_id),
    FOREIGN KEY(requester_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(target_id) REFERENCES users(id) ON DELETE CASCADE,
    CHECK (requester_id <> target_id)
);
