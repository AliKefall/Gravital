# Gravital API Documentation

This document provides a practical summary of the HTTP and WebSocket API surface on the backend side.

- Base URL (example): `https://api.example.com`
- JSON content type: `Content-Type: application/json`
- Authentication:
  - After login/refresh, `access_token` and `refresh_token` are set as HTTP-only cookies.
  - Protected endpoints can use `Authorization: Bearer <access_token>` or cookies.

---

## 1) Health and Infrastructure Endpoints

### `GET /health`
**What does it do?** Checks if the service is up and running.

**Request:** No body.

**Success response:** `200 OK` + plain text `OK`

---

### `GET /metrics`
**What does it do?** Returns Prometheus metrics.

**Request:** No body.

**Success response:** `200 OK` + Prometheus text format.

---

### `GET /webrtc/config`
**What does it do?** Returns STUN/TURN configuration for the frontend.

**Request:** No body.

**Success response (`200`)**
```json
{
  "stun_urls": ["stun:stun.l.google.com:19302"],
  "turn_urls": ["turn:turn.example.com:3478"],
  "turn_username": "turn-user",
  "turn_credential": "turn-pass"
}
```

---

## 2) Auth Endpoints (`/auth`)

> Note: This route group is protected by rate-limit middleware.

### `POST /auth/register`
**What does it do?** Creates a new user account.

**Request body:**
```json
{
  "email": "user@example.com",
  "username": "ali",
  "password": "Password123"
}
```

**Rules:**
- Email must be in valid format.
- Username must be in valid format.
- Password must be 8-128 characters, containing at least 1 letter + 1 number.

**Success response (`201`)**
```json
{
  "user_id": "uuid",
  "username": "ali",
  "email": "user@example.com"
}
```

---

### `POST /auth/login`
**What does it do?** Authenticates user and generates access + refresh tokens.

**Request body:**
```json
{
  "email": "user@example.com",
  "password": "Password123"
}
```

**Success response (`200`)**
```json
{
  "access_token": "jwt",
  "user": {
    "user_id": "uuid",
    "username": "ali",
    "email": "user@example.com"
  }
}
```

**Side effect:**
- `access_token` and `refresh_token` are set as HTTP-only cookies.

---

### `POST /auth/refresh`
**What does it do?** Performs refresh token rotation to generate a new access token (and new refresh token).

**Request:** Body not required. `refresh_token` cookie is mandatory.

**Success response (`200`)**
```json
{
  "access_token": "new-jwt"
}
```

---

### `POST /auth/logout` *(JWT required)*
**What does it do?** Clears/revokes user's refresh token records and deletes cookies.

**Request:** No body.

**Success response (`200`)**
```json
{
  "message": "logged out"
}
```

---

### `GET /auth/me` *(JWT required)*
**What does it do?** Returns the authenticated user's information.

**Success response (`200`)**
```json
{
  "user_id": "uuid",
  "username": "ali"
}
```

---

### `POST /auth/forgot-password`
**What does it do?** Generates and sends (or logs) a password reset code for the email.

**Request body:**
```json
{
  "email": "user@example.com"
}
```

**Success response (`200`)**
```json
{
  "message": "If the account exists, a reset code has been sent."
}
```

---

### `POST /auth/reset-password`
**What does it do?** Resets password using verification code + new password.

**Request body:**
```json
{
  "email": "user@example.com",
  "code": "123456",
  "new_password": "NewPassword123"
}
```

**Success response (`200`)**
```json
{
  "message": "Password updated successfully."
}
```

---

### `GET /auth/oauth/providers`
**What does it do?** Returns OAuth provider URL information (Google/GitHub).

**Success response (`200`)**
```json
{
  "google": "https://...",
  "github": "https://..."
}
```

---

### `GET /auth/oauth/github/callback`
**What does it do?** Handles GitHub OAuth callback by exchanging `code`, creating/finding a local user, issuing refresh cookie + access token, and optionally redirecting to `GITHUB_OAUTH_REDIRECT_URL`.

**Query params:**
- `code` (required)

**Required backend env vars:**
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`

**Optional backend env vars:**
- `GITHUB_OAUTH_REDIRECT_URL` (if set, callback redirects there on success)

---

## 3) Friendship Endpoints *(JWT required)*

### `GET /auth/friends`
**What does it do?** Returns friend list and their online status.

**Success response (`200`)**
```json
{
  "friends": [
    { "username": "veli", "online": true }
  ]
}
```

---

### `POST /auth/friends`
**What does it do?** Initiates a friend request to the specified username.

**Request body:**
```json
{
  "username": "veli"
}
```

**Responses:**
- `202 Accepted`: request is pending
- `200 OK`: already friends, returns updated friend list
- `409 Conflict`: other party has already sent you a request

---

### `GET /auth/friends/requests`
**What does it do?** Lists incoming and outgoing friendship requests.

**Success response (`200`)**
```json
{
  "incoming": ["veli"],
  "outgoing": ["ayse"]
}
```

---

### `POST /auth/friends/requests/{username}/accept`
**What does it do?** Accepts incoming friend request from specified user and creates friendship.

**Success response (`200`)**
```json
{
  "friends": [
    { "username": "veli", "online": true }
  ]
}
```

---

### `POST /auth/friends/requests/{username}/reject`
**What does it do?** Rejects incoming friend request from specified user.

**Success response (`200`)**
```json
{
  "status": "rejected"
}
```

---

## 4) Attachment Endpoint *(JWT required)*

### `POST /auth/rooms/{roomID}/attachments`
**What does it do?** Uploads a file to a room, creates a message record, and broadcasts to room members via WebSocket.

**Request type:** `multipart/form-data`

**Form field:**
- `file`: required

**Validations:**
- User must be a member of the room.
- Max size: default `100MB` (configurable via env).
- Supported extensions: `jpg, jpeg, png, gif, webp, mp4, m4v, webm, mov, pdf, txt, rar`
- MIME and extension validation is performed.

**Success response (`201`)**
```json
{
  "message": "attachment uploaded",
  "url": "/uploads/<stored-file>",
  "kind": "image"
}
```

---

### `GET /uploads/{filename}`
**What does it do?** Serves the uploaded file.

**Note:** Path traversal protection: only basename is accepted.

---

## 5) WebSocket API

### `GET /ws`
**Authentication:** Access token is obtained from one of the following sources:
1. `Authorization: Bearer <token>`
2. `access_token` cookie
3. `?token=<token>` query parameter

Upon connection, the user's session is rehydrated with:
- active room list,
- room metadata,
- screen share state,
- last message history (limit 30)

### Common Message Schema
```json
{
  "type": "room_message",
  "room_id": "room-1",
  "to": "targetUsername",
  "from": "senderUsername",
  "content": "Hello",
  "timestamp": "2026-04-21T12:00:00Z"
}
```

### Supported `type` values
- `room_message`
- `direct_message`
- `join_room`
- `leave_room`
- `create_room`
- `close_room`
- `add_to_room`
- `voice_join`
- `voice_leave`
- `voice_state`
- `voice_volume`
- `webrtc_offer`
- `webrtc_answer`
- `webrtc_ice_candidate`
- `screen_share_start`
- `screen_share_stop`
- `screen_share_state`
- `stream_metrics`
- `presence`
- `social_event`
- `keepalive`

### WebRTC signaling note
- `webrtc_offer`, `webrtc_answer`, `webrtc_ice_candidate` messages require the `to` field.
- If the target user is not in the room, a system message is returned.

---

## 6) Error Format

API error responses use a common JSON structure:

```json
{
  "error": "human-readable error",
  "details": "optional internal details"
}
```

---

## 7) Security and Operation Summary

- HTTP-only cookies prevent JavaScript access to tokens.
- Refresh tokens are stored hashed in the database.
- Refresh token rotation is implemented.
- Upload endpoint validates both file size and MIME/extension.
- Security header middleware sets basic browser security headers.
- WebSocket origin control is performed via `WS_ALLOWED_ORIGINS`.
