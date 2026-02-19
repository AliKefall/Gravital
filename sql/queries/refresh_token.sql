
-- name: CreateRefreshToken :one
INSERT INTO refresh_tokens (
    id,
    user_id,
    token_hash,
    created_at,
    expires_at
)
VALUES (?, ?, ?, ?, ?)
RETURNING *;

-- name: RevokeRefreshToken :exec
UPDATE refresh_tokens
SET revoked_at = ?
WHERE token_hash = ?;

-- name: GetValidRefreshToken :one
SELECT *
FROM refresh_tokens
WHERE token_hash = ?
  AND revoked_at IS NULL
  AND expires_at > ?
LIMIT 1;

