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

    userA.socket.emit('matched', { roomId });
    userB.socket.emit('matched', { roomId });

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
      rooms[roomId] = { participants: [userId], private: true, maxParticipants: maxParticipants || 10 };
      socket.join(roomId);
      socket.emit('private-room-created', { roomId });
      console.log(`🔐 Room ${roomId} created by ${userId} (Limit: ${maxParticipants})`);
    });

    // 🗝️ unirse a sala (Privada o Aleatoria)
    socket.on('join-room', ({ roomId }) => {
      const room = rooms[roomId];

      // 🛡️ NO permitimos que nadie se una a salas que NO han sido registradas
      if (!room) {
        return socket.emit('error', 'La sala no existe o el código es inválido.');
      }

      // Limpieza preventiva: Sacar al usuario de cualquier rastro de sala previa
      socket.rooms.forEach((r) => { if (r !== socket.id) socket.leave(r); });

      // Si la sala es privada, validamos con el matchmaker
      if (room.private) {
        const result = joinPrivateRoom(roomId, userId);
        if (!result.success) {
          // Si ya está en la sala, simplemente lo aceptamos (re-conexión)
          if (result.error !== 'Ya estás en la sala') {
            return socket.emit('error', result.error);
          }
        }
      }

      socket.join(roomId);
      socket.to(roomId).emit('user-joined', { socketId: socket.id, userId });
      console.log(`📡 ${userId} joined room ${roomId}`);
    });



    // 💬 mensajes
    socket.on('chat-message', ({ roomId, text }) => {
      io.to(roomId).emit('chat-message', {
        from: socket.id,
        text,
        timestamp: Date.now(),
      });
    });

    // 🚪 salir
    socket.on('leave', ({ roomId }) => {
      console.log(`🚪 ${socket.id} left ${roomId}`);
      socket.leave(roomId);
      socket.to(roomId).emit('peer-left', { socketId: socket.id });
      leaveRoom(roomId, userId);
      removeFromWaiting(waiting, socket.id);
    });

    // WebRTC señales
    socket.on('offer', ({ roomId, offer }) => socket.to(roomId).emit('offer', { offer, from: socket.id }));
    socket.on('answer', ({ roomId, answer }) => socket.to(roomId).emit('answer', { answer, from: socket.id }));
    socket.on('ice-candidate', ({ roomId, candidate }) => socket.to(roomId).emit('ice-candidate', { candidate, from: socket.id }));

    // 🔴 desconexión
    socket.on('disconnect', () => {
      console.log('🔴 Disconnected:', socket.id);
      removeFromWaiting(waiting, socket.id);
      for (const room of socket.rooms) {
        if (room !== socket.id) {
          socket.to(room).emit('peer-left', { socketId: socket.id });
          leaveRoom(room, userId);
        }
      }
    });

  });
};
