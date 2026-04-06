
-- name: CreateFriendship :exec
INSERT INTO friendships(user_id, friend_id, created_at)
VALUES(?, ?, ?);

-- name: FriendshipExists :one
SELECT COUNT(1)
FROM friendships
WHERE user_id = ? AND friend_id = ?;

-- name: ListFriendsByUserID :many
SELECT u.*
FROM friendships AS f
JOIN users AS u ON u.id = CASE
    WHEN f.user_id = ? THEN f.friend_id
    ELSE f.user_id
END
WHERE f.user_id = ? OR f.friend_id = ?
ORDER BY u.username;

-- name: DeleteFriendship :exec
DELETE FROM friendships
WHERE user_id = ? AND friend_id = ?

-- name: CreateFriendRequest :exec
INSERT INTO friend_requests(requester_id, target_id, created_at)
VALUES(?, ?, ?);

-- name: FriendRequestExists :one
SELECT COUNT(1)
FROM friend_requests
WHERE requester_id = ? AND target_id = ?;

-- name: DeleteFriendRequest :exec
DELETE FROM friend_requests
WHERE requester_id = ? AND target_id = ?;

-- name: DeleteFriendRequestsBetween :exec
DELETE FROM friend_requests
WHERE (requester_id = ? AND target_id = ?) OR (requester_id = ? AND target_id = ?);

-- name: ListIncomingFriendRequestsByUserID :many
SELECT u.*
FROM friend_requests AS fr
JOIN users AS u ON u.id = fr.requester_id
WHERE fr.target_id = ?
ORDER BY fr.created_at DESC;

-- name: ListOutgoingFriendRequestsByUserID :many
SELECT u.*
FROM friend_requests AS fr
JOIN users AS u ON u.id = fr.target_id
WHERE fr.requester_id = ?
ORDER BY fr.created_at DESC;
