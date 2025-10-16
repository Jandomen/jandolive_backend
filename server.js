require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const socketHandlers = require('./sockets');

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT ;
const FRONTEND_URL = process.env.FRONTEND_URL;

const io = new Server(httpServer, {
  cors: {
    origin: FRONTEND_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.get('/', (req, res) => res.send('Jandolive server running'));

socketHandlers(io);

httpServer.listen(PORT, () => console.log(`Server listening on port ${PORT}`));