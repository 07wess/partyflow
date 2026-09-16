require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Socket.io Kurulumu (CORS izinleri ile)
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Basit test rotası
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: 'Express + Socket.io sunucusu çalışıyor!',
    timestamp: new Date().toISOString()
  });
});

// Socket.io Bağlantı Olayları
io.on('connection', (socket) => {
  console.log(`[Socket.io] Yeni istemci bağlandı: ${socket.id}`);

  // Test mesajı dinleyici
  socket.on('message', (data) => {
    console.log(`[Socket.io] Gelen mesaj (${socket.id}):`, data);
    // Diğer tüm istemcilere ve gönderene mesajı ilet
    io.emit('message', {
      sender: socket.id,
      text: data,
      time: new Date().toLocaleTimeString()
    });
  });

  // İstemci ayrıldığında
  socket.on('disconnect', () => {
    console.log(`[Socket.io] İstemci ayrıldı: ${socket.id}`);
  });
});

// Port Dinleme
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`🚀 Sunucu Port ${PORT} üzerinde dinlemede!`);
  console.log(`🌐 HTTP: http://localhost:${PORT}`);
  console.log(`⚡ Socket.io hazır.`);
  console.log(`=========================================`);
});
