-- name: CreateUser :one
INSERT INTO users(id, email, username, password, created_at, updated_at)
VALUES(?, ?, ?, ?, ?, ?)
RETURNING *;

-- name: GetUsersWithID :one
SELECT * FROM users
WHERE id=?;

-- name: DeleteUserFromDatabase :exec
DELETE FROM users
WHERE id=?;

-- name: GetUserByEmail :one
SELECT * FROM users
where email=?;
