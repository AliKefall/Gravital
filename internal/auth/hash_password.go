package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"strings"

	"golang.org/x/crypto/argon2"
)

type PasswordHasher struct {
	memory      uint32
	time        uint32
	parallelism uint8
	keyLen      uint32
	saltLen     uint32
}

func NewPasswordHasher() *PasswordHasher {
	return &PasswordHasher{
		memory:      64 * 1024,
		time:        3,
		parallelism: 2,
		keyLen:      32,
		saltLen:     16,
	}
}

func (p *PasswordHasher) Hash(password string) (string, error) {
	salt := make([]byte, p.saltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}

	hash := argon2.IDKey(
		[]byte(password),
		salt,
		p.time,
		p.memory,
		p.parallelism,
		p.keyLen,
	)

	b64Salt := base64.RawStdEncoding.EncodeToString(salt)
	b64Hash := base64.RawStdEncoding.EncodeToString(hash)

	encoded := strings.Join([]string{
		"argon2id",
		b64Salt,
		b64Hash,
	}, "$")

	return encoded, nil
}

func (p *PasswordHasher) Verify(password, encoded string) (bool, error) {
	parts := strings.Split(encoded, "$")
	if len(parts) != 3 {
		return false, errors.New("Invalid hash format")

	}

	salt, err := base64.RawStdEncoding.DecodeString(parts[1])
	if err != nil {
		return false, err
	}

	expectedHash, err := base64.RawStdEncoding.DecodeString(parts[2])
	if err != nil {
		return false, err
	}

	hash := argon2.IDKey(
		[]byte(password),
		salt,
		p.time,
		p.memory,
		p.parallelism,
		p.keyLen,
	)

	if subtle.ConstantTimeCompare(hash, expectedHash) == 1 {
		return true, nil
	}

	return false, nil
}
