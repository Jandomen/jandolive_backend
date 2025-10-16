const { createRoom, removeFromWaiting } = require('../utils/matchmaker');

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

    console.log('Matched:', userA.userId, userB.userId, 'Room:', roomId);
  };

  io.on('connection', (socket) => {
    const userId = socket.handshake.query.userId;
    console.log('New client connected:', socket.id, 'UserID:', userId);

    socket.on('ready', () => {
      console.log('Client ready:', socket.id);

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

    socket.on('chat-message', ({ roomId, text }) => {
      io.to(roomId).emit('chat-message', { from: socket.id, text });
    });

    socket.on('leave', ({ roomId }) => {
      socket.leave(roomId);
      socket.to(roomId).emit('peer-left');

      removeFromWaiting(waiting, socket.id);
      waiting.push({ socketId: socket.id, userId, socket });
      socket.emit('waiting');

      matchUsers();
    });

    socket.on('offer', ({ roomId, offer }) => {
      socket.to(roomId).emit('offer', { offer });
    });

    socket.on('answer', ({ roomId, answer }) => {
      socket.to(roomId).emit('answer', { answer });
    });

    socket.on('ice-candidate', ({ roomId, candidate }) => {
      socket.to(roomId).emit('ice-candidate', { candidate });
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      removeFromWaiting(waiting, socket.id);

      for (const room of socket.rooms) {
        if (room !== socket.id) {
          socket.to(room).emit('peer-left');
        }
      }
    });
  });
};
