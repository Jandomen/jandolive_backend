// utils/matchmaker.js

let roomCounter = 1;
const rooms = {}; // { roomId: { participants: [], private: boolean, creator: string } }

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

module.exports = {
  rooms,

  // 🔀 Sala aleatoria
  createRoom: (userA, userB) => {
    const roomId = `room-${roomCounter++}`;
    rooms[roomId] = { participants: [userA, userB], private: false };
    return roomId;
  },

  // 🗝️ Sala privada por código
  createPrivateRoom: (maxParticipants = 10) => {
    let roomId;
    do {
      roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
    } while (rooms[roomId]); // evita colisiones

    rooms[roomId] = {
      participants: [],
      private: true,
      maxParticipants: Math.min(Math.max(parseInt(maxParticipants) || 2, 2), 20) // Mínimo 2, Máximo 20
    };
    return roomId;
  },

  joinPrivateRoom: (roomId, userId) => {
    const room = rooms[roomId];
    if (!room) return { success: false, error: 'Sala no encontrada' };
    if (!room.private) return { success: false, error: 'Sala no es privada' };
    if (room.participants.includes(userId))
      return { success: false, error: 'Ya estás en la sala' };

    if (room.participants.length >= room.maxParticipants)
      return { success: false, error: `La sala ya está llena (máximo ${room.maxParticipants} personas)` };

    room.participants.push(userId);
    return { success: true, roomId };
  },

  removeFromWaiting: (waiting, socketId) => {
    const index = waiting.findIndex((u) => u.socketId === socketId);
    if (index !== -1) waiting.splice(index, 1);
  },

  leaveRoom: (roomId, userId) => {
    const room = rooms[roomId];
    if (!room) return;
    room.participants = room.participants.filter((id) => id !== userId);
    if (room.participants.length === 0) delete rooms[roomId];
  },
};
