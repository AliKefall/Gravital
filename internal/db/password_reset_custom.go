package db

import (
	"context"
	"database/sql"
)

type PasswordResetCode struct {
	ID        string
	UserID    string
	Email     string
	CodeHash  string
	ExpiresAt string
	UsedAt    sql.NullString
	CreatedAt string
}

type CreatePasswordResetCodeParams struct {
	ID        string
	UserID    string
	Email     string
	CodeHash  string
	ExpiresAt string
	CreatedAt string
}

func (q *Queries) CreatePasswordResetCode(ctx context.Context, arg CreatePasswordResetCodeParams) (PasswordResetCode, error) {
	const createPasswordResetCode = `
INSERT INTO password_reset_codes(id, user_id, email, code_hash, expires_at, used_at, created_at)
VALUES (?, ?, ?, ?, ?, NULL, ?)
RETURNING id, user_id, email, code_hash, expires_at, used_at, created_at
`
	row := q.db.QueryRowContext(ctx, createPasswordResetCode, arg.ID, arg.UserID, arg.Email, arg.CodeHash, arg.ExpiresAt, arg.CreatedAt)
	var reset PasswordResetCode
	err := row.Scan(&reset.ID, &reset.UserID, &reset.Email, &reset.CodeHash, &reset.ExpiresAt, &reset.UsedAt, &reset.CreatedAt)
	return reset, err
}

func (q *Queries) GetActivePasswordResetCodeByEmail(ctx context.Context, email string) (PasswordResetCode, error) {
	const getActivePasswordResetCodeByEmail = `
SELECT id, user_id, email, code_hash, expires_at, used_at, created_at
FROM password_reset_codes
WHERE email = ? AND used_at IS NULL
ORDER BY created_at DESC
LIMIT 1
`
	row := q.db.QueryRowContext(ctx, getActivePasswordResetCodeByEmail, email)
	var reset PasswordResetCode
	err := row.Scan(&reset.ID, &reset.UserID, &reset.Email, &reset.CodeHash, &reset.ExpiresAt, &reset.UsedAt, &reset.CreatedAt)
	return reset, err
}

func (q *Queries) MarkPasswordResetCodeUsed(ctx context.Context, id string, usedAt string) error {
	const markPasswordResetCodeUsed = `UPDATE password_reset_codes SET used_at = ? WHERE id = ?`
	_, err := q.db.ExecContext(ctx, markPasswordResetCodeUsed, usedAt, id)
	return err
}

func (q *Queries) RevokeActivePasswordResetCodesByEmail(ctx context.Context, email string, usedAt string) error {
	const revokeActivePasswordResetCodesByEmail = `
UPDATE password_reset_codes
SET used_at = ?
WHERE email = ? AND used_at IS NULL
`
	_, err := q.db.ExecContext(ctx, revokeActivePasswordResetCodesByEmail, usedAt, email)
	return err
}

func (q *Queries) UpdateUserPassword(ctx context.Context, id string, password string, updatedAt string) error {
	const updateUserPassword = `UPDATE users SET password = ?, updated_at = ? WHERE id = ?`
	_, err := q.db.ExecContext(ctx, updateUserPassword, password, updatedAt, id)
	return err
}
