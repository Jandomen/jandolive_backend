const {
  createRoom,
  removeFromWaiting,
  createPrivateRoom,
  joinPrivateRoom,
  leaveRoom,
  rooms,
} = require('../utils/matchmaker');

module.exports = (io) => {
  const waiting = [];

  const matchUsers = () => {
    if (waiting.length < 2) return;

    for (let i = waiting.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [waiting[i], waiting[j]] = [waiting[j], waiting[i]];
    }

    const [userA, userB] = waiting.splice(0, 2);
    const roomId = createRoom(userA.userId, userB.userId);

    userA.socket.join(roomId);
    userB.socket.join(roomId);

    // ✅ UserA actúa como anfitrión (host), no inicia ofertas.
    userA.socket.emit('matched', { roomId, others: [], mode: 'random' });
    // ✅ UserB actúa como el que "llega", por tanto él inicia WebRTC.
    userB.socket.emit('matched', { roomId, others: [userA.socketId], mode: 'random' });

    console.log(`🎯 Matched: ${userA.userId} ↔ ${userB.userId} (Room: ${roomId})`);
  };

  io.on('connection', (socket) => {
    const userId = socket.handshake.query.userId || socket.id;
    console.log('🟢 Connected:', socket.id, '| UserID:', userId);

    // 🔀 modo aleatorio
    socket.on('ready', () => {
      console.log('🔁 ready:', socket.id);
      removeFromWaiting(waiting, socket.id);
      for (const room of socket.rooms) {
        if (room !== socket.id) {
          socket.leave(room);
          socket.to(room).emit('peer-left');
        }
      }
      waiting.push({ socketId: socket.id, userId, socket });
      socket.emit('waiting');
      matchUsers();
    });

    // 🗝️ crear sala privada
    socket.on('create-private-room', ({ maxParticipants }) => {
      const roomId = createPrivateRoom(maxParticipants);

      // Asegurarse de ser contado como el primer participante
      rooms[roomId].participants.push(userId);

      socket.join(roomId);
      socket.emit('private-room-created', { roomId });
      console.log(`🔐 Room ${roomId} created by ${userId} (Limit: ${maxParticipants})`);
    });

    // 🗝️ unirse a sala (Privada o Aleatoria)
    socket.on('join-room', ({ roomId }) => {
      const room = rooms[roomId];

      if (!room) {
        return socket.emit('error', 'La sala no existe. Verifica el código o crea una nueva.');
      }

      // Obtener otros sockets
      const otherSockets = Array.from(io.sockets.adapter.rooms.get(roomId) || []);

      socket.rooms.forEach((r) => { if (r !== socket.id) socket.leave(r); });

      if (room.private) {
        const result = joinPrivateRoom(roomId, userId);
        if (!result.success && result.error !== 'Ya estás en la sala') {
          return socket.emit('error', result.error);
        }
      }

      socket.join(roomId);

      // Informamos quiénes ya están, para poder lanzarles oferta
      socket.emit('joined-room', { roomId, others: otherSockets });

      // AVISAR A LOS QUE YA ESTÁN
      socket.to(roomId).emit('user-joined', { socketId: socket.id, userId });

      console.log(`📡 [ROOM:${roomId}] ${userId} joined (Current: ${room.participants.length})`);
    });

    // 💬 mensajes
    socket.on('chat-message', ({ roomId, message }) => {
      socket.to(roomId).emit('chat-message', {
        text: message,
        fromMe: false,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    });

    // Lógica unificada para salir de una sala
    const handleExit = (roomId) => {
      const room = rooms[roomId];
      if (!room) return;

      const participantCount = room.participants.length;
      const isRandom = !room.private;

      if (participantCount <= 2) {
        console.log(`❌ Closing room ${roomId}`);
        socket.to(roomId).emit('call-ended', { mode: isRandom ? 'random' : 'private' });
        leaveRoom(roomId, userId);
      } else {
        console.log(`👋 User left group room ${roomId}`);
        leaveRoom(roomId, userId);
        socket.to(roomId).emit('peer-left', { socketId: socket.id });
      }
    };

    // 🗝️ salir de sala
    socket.on('leave', ({ roomId: rid }) => {
      handleExit(rid);
      socket.leave(rid);
      removeFromWaiting(waiting, socket.id);
    });

    // 🧊 WebRTC Signaling - Protegido por validación de sala
    socket.on('offer', ({ roomId, offer, to }) => {
      if (socket.rooms.has(roomId)) {
        socket.to(to).emit('offer', { offer, from: socket.id });
      }
    });

    socket.on('answer', ({ roomId, answer, to }) => {
      if (socket.rooms.has(roomId)) {
        socket.to(to).emit('answer', { answer, from: socket.id });
      }
    });

    socket.on('ice-candidate', ({ roomId, candidate, to }) => {
      if (socket.rooms.has(roomId)) {
        socket.to(to).emit('ice-candidate', { candidate, from: socket.id });
      }
    });


    socket.on('disconnect', () => {
      console.log('❌ User disconnected:', socket.id);
      removeFromWaiting(waiting, socket.id);
      Object.keys(rooms).forEach(rid => {
        if (rooms[rid].participants.includes(userId)) {
          handleExit(rid);
        }
      });
    });

  });
};
