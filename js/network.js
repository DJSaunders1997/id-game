// PeerJS networking layer for multi-device play
const Network = (() => {
  let peer = null;
  let connections = new Map(); // peerId -> {conn, name}
  let hostConn = null;
  let roomCode = '';
  let _isHost = false;
  let _myName = '';
  let handlers = {};

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
      peer = new Peer('rankguess-' + roomCode);

      peer.on('open', () => resolve(roomCode));
      peer.on('error', (err) => {
        if (err.type === 'unavailable-id') {
          roomCode = generateCode();
          peer.destroy();
          peer = new Peer('rankguess-' + roomCode);
          peer.on('open', () => resolve(roomCode));
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
    conn.on('open', () => {
      const playerName = conn.metadata?.name || 'Player';

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
      peer = new Peer();

      peer.on('open', () => {
        hostConn = peer.connect('rankguess-' + roomCode, {
          metadata: { name },
          reliable: true,
        });
        hostConn.on('open', () => {
          hostConn.on('data', (data) => emit('message', 'host', data));
          hostConn.on('close', () => emit('disconnected'));
          resolve();
        });
        hostConn.on('error', reject);
        setTimeout(() => reject(new Error('Connection timed out')), 10000);
      });

      peer.on('error', reject);
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
