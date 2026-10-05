# Multi-Device Lobby - Approaches (Easiest to Hardest)

The goal: players join a room from their own phones, see prompts on their own screen, guess independently. No more passing the phone around.

---

## 1. Peer-to-Peer via WebRTC Data Channels

**Effort**: Medium-low  
**Infra cost**: Free (no server needed)  
**How it works**: Host player creates a room. Other players scan a QR code or enter a short code that connects them peer-to-peer using WebRTC data channels. The host's browser acts as the "server" - it holds game state and broadcasts updates to all peers.

**Room join flow**: Use a free signalling service (e.g. PeerJS cloud server, or a simple Firebase Realtime Database on the free tier) just for the initial handshake. Once connected, all communication is direct browser-to-browser.

**Pros**:
- No backend to build, deploy, or pay for
- Low latency (direct connections)
- Works offline after initial connection (local network)
- Keeps the "no server" philosophy

**Cons**:
- WebRTC connection setup can be flaky (NAT traversal issues)
- Host closing their browser kills the game
- Need a signalling service for the initial handshake (free tier of PeerJS or Firebase works)
- Harder to debug connection issues
- Max ~6-8 peers reliably

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

## 4. Lightweight WebSocket Server (Node.js on Fly.io / Railway)

**Effort**: Medium-high  
**Infra cost**: Free tier (Fly.io free, Railway $5/mo credit)  
**How it works**: A small Node.js/Express server with `ws` or Socket.IO. Rooms are in-memory objects. Clients connect via WebSocket. Server manages all game state and broadcasts to room members.

**Pros**:
- Full control over game logic
- Can add features like spectator mode, reconnection, anti-cheat
- Lowest latency of server-based options
- Clean separation of concerns
- Socket.IO handles reconnection automatically

**Cons**:
- Need to write, test, deploy, and maintain a backend
- In-memory rooms = lost on server restart (fine for a party game)
- Need to handle server deployment and uptime
- More code to maintain

**Stack**: Node.js + ws/Socket.IO on Fly.io (free tier: 3 shared VMs, 256MB RAM)

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

**Start with option 2 (Firebase)** if you want reliability and speed of development. You can have a working lobby in an afternoon. The SDK size is the main downside but it's a one-time cost.

**Start with option 1 (WebRTC/PeerJS)** if you want to keep the zero-infrastructure philosophy. PeerJS makes WebRTC manageable. The trade-off is connection reliability - works great on the same WiFi, can be fiddly across networks.

**Avoid options 4-5** unless you plan to scale this beyond a friends party game. The maintenance overhead isn't worth it.

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
