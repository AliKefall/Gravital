# Gravital Frontend
 
Welcome to project Gravital!
 
Gravital is the client application where users chat in rooms, send direct messages, join voice sessions, and share screen/camera streams in real time.
 
The main idea is simple: Keep communication as simple and as fast as possible with its configurable system. With this application you can send files, create rooms or send direct messages to your friends, you can voice chat, share screen/webcam and chat.
 
---
 
## Core Features
 
- Room-based messaging and direct messaging between friends
- Real-time Communication over WebSocket
- WebRTC-based voice, camera and screen sharing
- File upload and in-message media rendering
 
## Tech Stack
 
| Technology | Purpose |
|-----------|---------|
| **React 19 + TypeScript** | Frontend framework |
| **Vite** | Development and production builds |
| **WebSocket** | Real-time communication |
| **MediaDevices API** | Camera and microphone access |
| **RTCPeerConnection** | WebRTC peer connections |
 
## Quick Start
 
### Run Locally
 
```bash
cd frontend
npm install
npm run dev
```
 
This command starts the Vite development server.
 
## Production Build
 
```bash
cd frontend
npm run build
npm run preview
```
 
## Environment Variables
 
The Frontend reads API, WebSocket and ICE settings from `.env` files:
 
```env
VITE_API_BASE_URL=http://localhost:8080
VITE_WS_BASE_URL=ws://localhost:8080
VITE_STUN_URLS=stun:stun.l.google.com:19302
VITE_TURN_URLS=turn:your-turn-server.com
VITE_TURN_USERNAME=your_username
VITE_TURN_CREDENTIAL=your_credential
```
 
| Variable | Description |
|----------|-------------|
| `VITE_API_BASE_URL` | Backend API endpoint |
| `VITE_WS_BASE_URL` | WebSocket server URL |
| `VITE_STUN_URLS` | STUN server addresses |
| `VITE_TURN_URLS` | TURN server addresses |
| `VITE_TURN_USERNAME` | TURN server username |
| `VITE_TURN_CREDENTIAL` | TURN server credential |
 
## Folder Structure
 
```
src/
├── components/
│   └── chat                  # Workspace UI and media/session control logic
├── api                       # HTTP client functions for backend calls
└── App.tsx                   # Top-level application flow
```
 
---
 
## Note
 
The frontend communicates with the Gravital backend for authentication, room management, messaging, WebSocket events, and file uploads.
