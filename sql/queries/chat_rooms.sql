-- name: CreateChatRoom :exec
INSERT INTO chat_rooms (id, owner_id, created_at, closed_at)
VALUES (?, ?, ?, NULL);

-- name: AddChatRoomMember :exec
INSERT INTO chat_room_members (room_id, user_id, joined_at, left_at)
VALUES (?, ?, ?, NULL)
ON CONFLICT(room_id, user_id) DO UPDATE SET
  left_at = NULL,
  joined_at = excluded.joined_at;

-- name: ListActiveChatRoomsByUserID :many
SELECT
  r.id,
  r.owner_id,
  r.created_at,
  r.closed_at
FROM chat_rooms r
JOIN chat_room_members m ON m.room_id = r.id
WHERE m.user_id = ?
  AND m.left_at IS NULL
  AND r.closed_at IS NULL
ORDER BY r.created_at DESC;

-- name: MarkChatRoomMemberLeft :exec
UPDATE chat_room_members
SET left_at = ?
WHERE room_id = ?
  AND user_id = ?
  AND left_at IS NULL;

-- name: CreateChatMessage :exec
INSERT INTO chat_messages (id, room_id, sender_id, sender_username, content, created_at, kind, media_url, mime_type, file_name, file_size)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);

-- name: ListRecentMessagesByRoomID :many
SELECT
  id,
  room_id,
  sender_id,
  sender_username,
  content,
  created_at,
  kind,
  media_url,
  mime_type,
  file_name,
  file_size
FROM chat_messages
WHERE room_id = ?
ORDER BY created_at DESC
LIMIT ?;

-- name: ListActiveRoomMembersByRoomID :many
SELECT
  m.room_id,
  m.user_id,
  u.username,
  m.joined_at
FROM chat_room_members m
JOIN users u ON u.id = m.user_id
WHERE m.room_id = ?
  AND m.left_at IS NULL
ORDER BY m.joined_at ASC;

-- name: DeleteChatRoomByIDAndOwner :execrows
DELETE FROM chat_rooms
WHERE id = ?
 AND owner_id = ?;

