package endpoints

import (
	"net/http"
	"strings"
)

// Well rather than trying to spell some magic in order to maintain the necessery connection
// I though I could just steal this idea and use it. Quite happy with it.
// Simply put, thing that we do here is when we are using this on local it does not require a secure connection
// But lets say this project is an https port then we check if we shuld use secure or non secure cookie
// Otherwise this could break the whole response, request system.
func shouldUseSecureCookie(r *http.Request) bool {
	if r.TLS != nil {
		return true
	}

	if strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https") {
		return true
	}
	return false
}
