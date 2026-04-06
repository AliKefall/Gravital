CREATE TABLE IF NOT EXISTS chat_rooms(
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    closed_at TEXT,
    FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE
);



CREATE TABLE IF NOT EXISTS chat_room_members(
    room_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    joined_at TEXT NOT NULL,
    left_at TEXT,
    PRIMARY KEY (room_id, user_id),
    FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_messages(
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    sender_username TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT TEXT,
    media_url TEXT,
    mime_type TEXT,
    file_name TEXT,
    file_size INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chat_members_user_active
ON chat_room_members(user_id, left_at);

CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created
ON chat_messages(room_id, created_at);

