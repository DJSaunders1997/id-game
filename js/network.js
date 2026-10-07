// PeerJS networking layer for multi-device play
const Network = (() => {
  let peer = null;
  let connections = new Map(); // peerId -> {conn, name}
  let hostConn = null;
  let roomCode = '';
  let _isHost = false;
  let _myName = '';
  let handlers = {};

  // WebRTC needs STUN to discover public IPs and TURN to relay traffic when
  // direct connections fail (e.g. phones on mobile data, strict NAT/firewalls).
  // Without TURN, connections between devices on different networks silently fail.
  const peerConfig = {
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
      ],
    },
    debug: 1,
  };

  function log(...args) { console.log('[Network]', ...args); }

  function generateCode() {
    const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    return Array.from({length: 4}, () => c[Math.floor(Math.random() * c.length)]).join('');
  }

  function on(event, fn) { handlers[event] = fn; }
  function emit(event, ...args) { if (handlers[event]) handlers[event](...args); }

  function createRoom(name) {
    return new Promise((resolve, reject) => {
      _myName = name;
      roomCode = generateCode();
      _isHost = true;
      log('Creating room', roomCode);
      peer = new Peer('rankguess-' + roomCode, peerConfig);

      peer.on('open', (id) => { log('Host registered as', id); resolve(roomCode); });
      peer.on('error', (err) => {
        log('Host error:', err.type, err.message);
        if (err.type === 'unavailable-id') {
          roomCode = generateCode();
          peer.destroy();
          log('Retrying with code', roomCode);
          peer = new Peer('rankguess-' + roomCode, peerConfig);
          peer.on('open', (id) => { log('Host registered as', id); resolve(roomCode); });
          peer.on('error', reject);
          peer.on('connection', handleIncoming);
        } else {
          reject(err);
        }
      });

      peer.on('connection', handleIncoming);
    });
  }

  function handleIncoming(conn) {
    log('Incoming connection from', conn.peer);
    conn.on('open', () => {
      const playerName = conn.metadata?.name || 'Player';
      log('Connection open:', playerName);

      // Check for duplicate names
      const taken = playerName === _myName ||
        Array.from(connections.values()).some(c => c.name === playerName);
      if (taken) {
        conn.send({ type: 'error', message: 'Name already taken - pick a different one' });
        setTimeout(() => conn.close(), 100);
        return;
      }

      connections.set(conn.peer, { conn, name: playerName });
      conn.on('data', (data) => emit('message', conn.peer, data));
      conn.on('close', () => {
        connections.delete(conn.peer);
        emit('player-leave', conn.peer);
      });
      emit('player-join', conn.peer, playerName);
    });
  }

  function joinRoom(code, name) {
    return new Promise((resolve, reject) => {
      _myName = name;
      roomCode = code.toUpperCase();
      _isHost = false;
      log('Joining room', roomCode, 'as', name);
      peer = new Peer(undefined, peerConfig);

      peer.on('open', (myId) => {
        log('Client registered as', myId, '- connecting to host');
        hostConn = peer.connect('rankguess-' + roomCode, {
          metadata: { name },
          reliable: true,
        });
        hostConn.on('open', () => {
          log('Connected to host!');
          hostConn.on('data', (data) => emit('message', 'host', data));
          hostConn.on('close', () => { log('Host connection closed'); emit('disconnected'); });
          resolve();
        });
        hostConn.on('error', (err) => { log('Connection error:', err); reject(err); });
        setTimeout(() => reject(new Error('Connection timed out')), 10000);
      });

      peer.on('error', (err) => { log('Peer error:', err.type, err.message); reject(err); });
    });
  }

  function broadcast(data) {
    connections.forEach(({ conn }) => { if (conn.open) conn.send(data); });
  }

  function sendTo(peerId, data) {
    const entry = connections.get(peerId);
    if (entry?.conn.open) entry.conn.send(data);
  }

  function sendToHost(data) {
    if (hostConn?.open) hostConn.send(data);
  }

  function getPlayerList() {
    const list = [{ name: _myName, peerId: 'host' }];
    connections.forEach(({ name }, peerId) => list.push({ name, peerId }));
    return list;
  }

  function getPeerIdByName(name) {
    if (name === _myName && _isHost) return 'host';
    for (const [peerId, entry] of connections) {
      if (entry.name === name) return peerId;
    }
    return null;
  }

  function destroy() {
    if (peer) peer.destroy();
    peer = null;
    connections.clear();
    hostConn = null;
    roomCode = '';
    _isHost = false;
    _myName = '';
  }

  return {
    get isHost() { return _isHost; },
    get isClient() { return !_isHost && hostConn !== null; },
    get isNetworked() { return peer !== null; },
    get roomCode() { return roomCode; },
    get myName() { return _myName; },
    get playerCount() { return connections.size + (_isHost ? 1 : 0); },
    createRoom,
    joinRoom,
    broadcast,
    sendTo,
    sendToHost,
    getPlayerList,
    getPeerIdByName,
    on,
    destroy,
  };
})();
