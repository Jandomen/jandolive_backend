let roomCounter = 1;

module.exports = {
  createRoom: (userA, userB) => {
    const roomId = `room-${roomCounter++}`;
    return roomId;
  },

  removeFromWaiting: (waiting, socketId) => {
    const index = waiting.findIndex(u => u.socketId === socketId);
    if (index !== -1) waiting.splice(index, 1);
  },
};
