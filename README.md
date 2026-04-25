# Gravital Backend
 
Gravital backend is the core service layer that handles authentication, room/friend operations, file uploads, and real-time message/signaling traffic.
 
In practice, it combines HTTP endpoints for persistent business actions with a WebSocket channel for live room events and WebRTC signaling.
 
---
 
## Core Responsibilities
 
- Register/login/refresh/logout flows
- Room and friendship management
- Room message distribution
- WebRTC signaling relay between users
- Attachment upload and delivery
 
## Tech Stack
 
| Technology | Purpose |
|-----------|---------|
| **Go (Golang)** | Primary programming language |
| **chi v5** | HTTP router |
| **gorilla/websocket** | WebSocket hub architecture |
| **SQLC** | Generated data access layer (`internal/db`) |
| **JWT** | Authentication and authorization |
 
## How To Deploy From Scratch (Example Path)
 
### 1. Prepare Server
 
- Install `git`, `go`, `node`, `npm`, `nginx`
- Create app directory (example): `/opt/gravital`
 
### 2. Clone and Build
 
```bash
git clone "<repo-url>" /opt/gravital
cd /opt/gravital/frontend/ && npm ci && npm run build
cd /opt/gravital/ && go build -o /usr/local/bin/gravital-server ./server/cmd 
```
 
### 3. Set Backend Environment
 
- Create `/opt/gravital/.env` and define:
  - `PORT`
  - `DATABASE_URL`
  - `DB_AUTH_TOKEN`
  - `JWT_SECRET`
  - `CORS_ALLOWED_ORIGINS`
  - `UPLOAD_DIR`
  
- Ensure `UPLOAD_DIR` exists and service user can write into it.
 
### 4. Run Backend as a Service
 
- Create a systemd unit (`gravital-backend.service`) pointing to `/usr/local/bin/gravital-server`.
- Load and start:
  ```bash
  sudo systemctl daemon-reload
  sudo systemctl enable --now gravital-backend
  ```
 
### 5. Configure Nginx
 
- Serve frontend from `/opt/gravital/frontend/dist`.
- Proxy API and WebSocket (`/ws`) to backend (example: `127.0.0.1:8080`).
- Enable HTTPS and correct hostnames.
 
### 6. Configure Frontend Production Environment
 
- Add `frontend/.env.production` with real API/WS/TURN/STUN values.
- Rebuild frontend after changes.
 
### 7. Verify Deployment
 
- `curl -i https://<api-domain>/health`
- Login from UI, join room, test message + voice + screen share.

### Common Mistakes to Avoid
 
- Missing WebSocket upgrade headers in Nginx.
- Wrong CORS origin list.
- TURN not configured / relay ports blocked.
- Different environment values between build-time frontend and runtime backend.
- This program needs a secure connection to actually send and receive WebRTC info. Which is either localhost or "https" connection.
 
## API Documentation

Detailed API behavior (what each endpoint does, required payloads, and flow details) is documented in:

- [`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md)

## Quick Start
 
### Run (Development)
 
```bash
go run ./server/cmd 
```
 
### Build
 
```bash
go build -o gravital-server ./server/cmd 
```
 
## Required Environment Variables
 
```env
PORT=8080
DATABASE_URL=your_database_url
DB_AUTH_TOKEN=your_auth_token
JWT_SECRET=your_jwt_secret
CORS_ALLOWED_ORIGINS=http://localhost:3000
UPLOAD_DIR=/var/gravital/uploads
```
 
| Variable | Description |
|----------|-------------|
| `PORT` | Port for the server to listen on |
| `DATABASE_URL` | Database connection string |
| `DB_AUTH_TOKEN` | Database authentication token |
| `JWT_SECRET` | JWT signing secret key |
| `CORS_ALLOWED_ORIGINS` | Allowed CORS origins |
| `UPLOAD_DIR` | File upload directory |
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID (for callback endpoint) |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret (for callback endpoint) |
| `GITHUB_OAUTH_REDIRECT_URL` | Optional frontend URL to redirect after successful GitHub OAuth |
| `GITHUB_AUTH_URL` | GitHub authorize URL used by the login button |
 
## Words From the Creator
 
### About the Project
 
So about why I did this project in the first place and why I choose this tech stack or this architecture. For the first question, Discord is banned in Turkey at the moment and in order for my friends to speak or chat from the computer, we needed other solutions. Like using VPN for Discord which is a bad idea, it simply kills your internet, or choose some other Discord-like platforms. The idea of having to rely on other communication sources just simply bugged me. So I built my own chat application, so we all have our photos, videos stored and kept in a place which I have every control over it. After all, we can share our screens/webcams, send files or photos to each other and communicate without having the necessity of tons of popups, "PLEASE BUY MY PREMIUM FOR EXTRA EMOJIS SIR" type of things. After all these conclusions, I created a fast, simple website for it. It has none of those things. You simply add your friend, create a room and there it is, you can do whatever you want.
 
### Technical Choices and Retrospective
 
About the technical choices I did or what I would or would not do about this project. Considering that it reached a lot of users, like 100,000 of them, I would absolutely change my database to **Cassandra** or **ScyllaDB** in order to send and receive data at the speed it needs. 
 
Second, I would not use Golang for this project. Simply, I bow my head to the gods of **Rust** or **C++**. Go's garbage collector would drastically increase latency on that matter. 
 
Third, with every step, I would cover much more edge-cases and add a metric and logger system which covers all the necessary parts.
 
### Final Words
 
One last word over this project: I am quite happy with the outcome. I learned so much about web development and architecture. Even now, I see myself building this all over with much better tools and decisions. 
 
**If you are reading this right now:** If you don't like a system or a program or even a game, **BUILD ONE FOR YOURSELF**. It might be so much worse compared to other alternatives. But at least it will be yours. 
 
Also, I didn't know anything about web development at this scale before. It took me three months to finish this. So if you are seeing yourself struggling with it, **IT IS TOTALLY NORMAL**.
 
## Project Structure (Overview)
 
```
gravital/
├── server/cmd                 # App bootstrap, config, and router wiring
├── internal/
│   ├── endpoints             # HTTP handlers
│   ├── websocket             # Hub, client, and message routing
│   └── db                    # Database layer and SQLC output
└── sql/migrations            # Schema migrations
```
 
---
 
## Note
 
When the backend is up, the frontend uses this service for auth, rooms, messaging, WebSocket events, and file upload flows.
 
