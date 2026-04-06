package endpoints

import (
	"regexp"
)

// I hate regex.
var emailRegex = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)

var usernameRegex = regexp.MustCompile(`^[a-zA-Z0-9_]{3,32}$`)

// It is a better idea to check email and username inputs in the frontend too.
// Which I did
func isValidEmail(email string) bool {
	return emailRegex.MatchString(email)
}

func isValidUsername(username string) bool {
	return usernameRegex.MatchString(username)
}

func isValidPassword(password string) bool {
	if len(password) < 8 || len(password) > 128 {
		return false
	}

	hasLetter := false
	hasDigit := false

	for _, r := range password {
		switch {
		case r >= 'a' && r <= 'z':
			hasLetter = true
		case r >= 'A' && r <= 'Z':
			hasLetter = true
		case r >= '0' && r <= '9':
			hasDigit = true
		}

	}
	return hasLetter && hasDigit
}
