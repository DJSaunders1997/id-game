# Multi-Device Lobby - Approaches (Easiest to Hardest)

The goal: players join a room from their own phones, see prompts on their own screen, guess independently. No more passing the phone around.

---

## 1. Peer-to-Peer via WebRTC Data Channels (Preferred)

**Effort**: Medium-low  
**Infra cost**: Free (no server needed)  
**How it works**: One player is the **host** - their browser acts as the game server. It holds all game state and broadcasts updates to connected peers via WebRTC data channels. Other players connect directly to the host, browser-to-browser.

**Room join flow**: Host clicks "Create Room" -> PeerJS generates a peer ID -> we map that to a short 4-letter room code -> other players enter the code (or scan a QR) -> PeerJS's free cloud signalling server brokers the WebRTC handshake -> once connected, all data flows P2P with no server in the middle.

**How the host works**:
- Host's browser runs the game loop (same logic as current game.js, but sends state updates instead of DOM updates)
- Host sees the same UI as everyone else, plus a "room code" display
- If host is also the ranker, they see the ranker screen. If not, they see the guesser screen.
- All game events (guess submitted, prompt picked, timer tick) go through the host, which validates and broadcasts

**Architecture**:
```
Host browser (game state + UI)
  ├── WebRTC data channel -> Player 2 browser (UI only)
  ├── WebRTC data channel -> Player 3 browser (UI only)
  └── WebRTC data channel -> Player 4 browser (UI only)
```

**Pros**:
- No backend to build, deploy, or pay for
- Low latency (direct connections, typically <50ms on same WiFi)
- Works offline after initial connection (local network play)
- Keeps the "no server" philosophy of the current app
- PeerJS handles all the WebRTC complexity (ICE, STUN, signalling)
- ~50KB library, way lighter than Firebase SDK
- Perfect for a party game where everyone's in the same room

**Cons**:
- Host closing their browser kills the game (acceptable - they're physically present)
- WebRTC can be flaky across different networks/NATs (less of an issue when everyone's on the same WiFi at a party)
- PeerJS's free signalling server could go down (can self-host as fallback)
- Max ~6-8 reliable peer connections (fine for a party game)
- No reconnection if a player drops (would need to rejoin)

**Libraries**: PeerJS (~50KB), or raw WebRTC API

---

## 2. Firebase Realtime Database / Firestore

**Effort**: Medium  
**Infra cost**: Free tier covers this easily (100 simultaneous connections, 1GB storage)  
**How it works**: Host creates a game doc in Firestore. Players join by room code. All state lives in the database. Each client subscribes to real-time updates. No custom backend code needed - just client-side Firebase SDK.

**Room join flow**: Host clicks "Create Room" -> gets a 4-letter code -> others enter code -> Firebase query finds the room -> they're in.

**Pros**:
- Real-time sync built in (onSnapshot)
- No backend to write or deploy
- Extremely reliable - Google handles all the hard parts
- Players can disconnect and rejoin (state persists)
- Works great on mobile
- Free tier is generous for a party game

**Cons**:
- Firebase SDK is ~100KB+ (big for a vanilla JS app)
- Vendor lock-in to Google
- Need a Firebase project and config
- Security rules need to be written carefully
- Slightly higher latency than P2P (round trip through Google servers)

**Firebase free tier limits**: 100 simultaneous connections, 1GB stored, 10GB/month downloaded. Party game will never hit these.

---

## 3. Supabase Realtime

**Effort**: Medium  
**Infra cost**: Free tier (500MB database, unlimited API requests)  
**How it works**: Similar to Firebase but using Supabase's Postgres + Realtime subscriptions. Room state stored in a table, clients subscribe to changes via websockets.

**Pros**:
- Open source, Postgres-based (no vendor lock-in)
- Real-time subscriptions via websockets
- Row-level security for room isolation
- Free tier is generous
- Lighter client SDK than Firebase

**Cons**:
- Less mature real-time features than Firebase
- Need to set up Supabase project
- SQL instead of NoSQL (more setup for a simple game state)
- Slightly more complex auth setup

---

## 4. Lightweight WebSocket Server (Node.js on Azure Container Apps / Fly.io)

**Effort**: Medium-high  
**Infra cost**: Free tier (Azure Container Apps free tier, Fly.io free tier)  
**How it works**: A small Node.js/Express server with `ws` or Socket.IO. Rooms are in-memory objects. Clients connect via WebSocket. Server manages all game state and broadcasts to room members. This is the same pattern GPTeasers uses - static frontend on GitHub Pages, backend on Azure Container Apps.

**Reference**: GPTeasers (../GPTeasers) uses exactly this split - vanilla HTML/JS frontend served statically, Python FastAPI backend on Azure Container Apps with Docker. We'd do the same but with Node.js + WebSockets instead of Python + SSE.

**Pros**:
- Full control over game logic
- Can add features like spectator mode, reconnection, anti-cheat
- Lowest latency of server-based options
- Clean separation of concerns
- Socket.IO handles reconnection automatically
- Proven pattern (GPTeasers uses this architecture)

**Cons**:
- Need to write, test, deploy, and maintain a backend
- In-memory rooms = lost on server restart (fine for a party game)
- Need to handle server deployment and uptime
- More code to maintain
- Docker + container setup adds complexity

**Stack**: Node.js + ws/Socket.IO on Azure Container Apps (free tier: 2M requests/month) or Fly.io (free tier: 3 shared VMs, 256MB RAM)

---

## 5. Serverless WebSockets (AWS API Gateway + Lambda / Cloudflare Durable Objects)

**Effort**: High  
**Infra cost**: Free-to-cheap (pay per message)  
**How it works**: AWS API Gateway WebSocket API routes messages to Lambda functions. Or Cloudflare Durable Objects maintain per-room state at the edge. No always-on server.

**Pros**:
- Scales to zero (no cost when nobody's playing)
- No server to maintain
- Cloudflare Durable Objects are extremely fast (edge computing)

**Cons**:
- Complex infrastructure setup (IAM, API Gateway config, DynamoDB for state)
- Cold start latency on Lambda
- Overkill for a party game
- Harder to develop and debug locally
- More moving parts = more things to break

---

## Recommendation

**Go with option 1 (PeerJS)**. It fits the app's philosophy - no backend, no accounts, no infrastructure. One player hosts, others join. For a party game where everyone's in the same room on the same WiFi, WebRTC reliability is a non-issue. PeerJS is ~50KB vs Firebase's 100KB+ SDK, and you don't need a Google project or security rules.

**Fallback to option 4 (Azure Container Apps)** if WebRTC proves too unreliable across networks. The GPTeasers pattern (static frontend + containerised backend) is proven and the free tier covers a party game easily.

**Avoid options 3 and 5** - Supabase and serverless are overengineered for this use case.

---

## What Changes in the Game Logic

Regardless of approach, the game flow changes from pass-and-play to:

1. **Lobby screen**: Create/join room, see who's connected
2. **Submit prompts**: Everyone submits on their own phone simultaneously (no passing)
3. **Ranker picks**: Only the ranker's phone shows the prompt picker
4. **Rank screen**: Only ranker sees this (or skip in physical mode)
5. **Guess screen**: Each guesser sees options on their own phone, guesses independently
6. **Results**: Everyone sees results simultaneously
7. **Scores**: Synced across all devices

The core scoring/prompt logic stays the same. The main refactor is replacing `showScreen()` (show/hide divs on one device) with `sendToPlayer()` / `broadcastToRoom()` (send state to specific devices).

Estimated refactor: ~40% of game.js needs to change to support message-based state sync instead of direct DOM manipulation.
