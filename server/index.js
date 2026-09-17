const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
const { ExpressPeerServer } = require('peer');
const axios = require('axios');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// CORS & Middleware
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

// Client klasörünü doğrudan statik sun (Tek port 5000 üzerinden hem API hem frontend erişimi)
app.use(express.static(path.join(__dirname, '../client')));

// WebRTC Dahili PeerJS Sinyal Sunucusu (/peerjs rotası)
const peerServer = ExpressPeerServer(server, { debug: false, path: '/' });
app.use('/peerjs', peerServer);

// WebSocket Kurulumu
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// ==========================================
// YARDIMCI: DISCORD WEBHOOK BİLDİRİM FONKSİYONU
// ==========================================
async function sendDiscordWebhook(title, description, color = 0x8b5cf6, fields = []) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl || webhookUrl.trim() === '' || webhookUrl.includes('BURAYA')) return;

  try {
    await axios.post(webhookUrl, {
      embeds: [{
        title,
        description,
        color,
        fields,
        footer: { text: 'PartyFlow Cinema • Senkron İzleme Odası' },
        timestamp: new Date().toISOString()
      }]
    });
  } catch (err) {
    console.warn('[Webhook] Discord bildirimi gönderilemedi:', err.message);
  }
}

// Bellek İçi Oda Durumları (State Cache)
const rooms = {};

function getOrCreateRoom(roomId) {
  if (!rooms[roomId]) {
    rooms[roomId] = {
      videoUrl: 'https://www.youtube.com/watch?v=jfKfPfyJRdk', // Başlangıç için tatlı bir lofi müzik/video
      videoType: 'youtube',
      currentTime: 0,
      isPlaying: false,
      lastUpdated: Date.now(),
      snackBreak: false,
      snackInterval: null,
      breakTimer: 0,
      users: {}
    };
  }
  return rooms[roomId];
}

// ==========================================
// 1. DISCORD OAUTH2 ENDPOINTLERI
// ==========================================
app.get('/auth/discord', (req, res) => {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;

  if (!clientId || !redirectUri || clientId.includes('BURAYA')) {
    return res.send(`
      <!DOCTYPE html>
      <html lang="tr">
      <head><meta charset="UTF-8"><title>Discord Yapılandırma Gerekli</title></head>
      <body style="background:#09090b; color:#fafafa; font-family:sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; height:90vh; text-align:center; padding:20px;">
        <h2 style="color:#a855f7;">🎮 Discord Giriş Bilgileri Henüz Girilmemiş</h2>
        <p style="color:#a1a1aa; max-width:500px;">Discord ile giriş yapabilmek için <code>server/.env</code> dosyasına <strong>DISCORD_CLIENT_ID</strong> ve <strong>DISCORD_CLIENT_SECRET</strong> bilgilerinizi eklemeniz gerekir.</p>
        <p style="color:#a1a1aa;">Şimdilik Misafir Girişi ile dilediğiniz kullanıcı adını seçerek odaya hemen katılabilirsiniz!</p>
        <a href="/" style="background:#8b5cf6; color:white; padding:10px 20px; border-radius:8px; text-decoration:none; margin-top:15px; font-weight:bold;">Sinema Odasına Dön</a>
      </body>
      </html>
    `);
  }

  const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify`;
  res.redirect(url);
});

app.get('/auth/discord/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Yetkilendirme kodu bulunamadı.');

  try {
    const tokenResponse = await axios.post(
      'https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code.toString(),
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenResponse.data.access_token}` }
    });

    const user = userResponse.data;
    const avatarUrl = user.avatar 
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` 
      : 'https://cdn.discordapp.com/embed/avatars/0.png';

    res.redirect(`/?user=${encodeURIComponent(user.username)}&avatar=${encodeURIComponent(avatarUrl)}&id=${user.id}`);
  } catch (err) {
    console.error('Discord Auth Hatası:', err.response?.data || err.message);
    res.status(500).send('Discord ile giriş yapılamadı. Lütfen .env ayarlarınızı kontrol edin.');
  }
});

// ==========================================
// 2. SOCKET.IO GERÇEK ZAMANLI ETKİLEŞİMLER
// ==========================================
io.on('connection', (socket) => {
  console.log('[Socket] Yeni bağlantı:', socket.id);

  // Odaya Katılma
  socket.on('room:join', ({ roomId, username, avatar, peerId }) => {
    socket.join(roomId);
    socket.roomId = roomId;
    socket.username = username || 'Misafir';
    socket.avatar = avatar || '';
    socket.peerId = peerId || null;

    const room = getOrCreateRoom(roomId);
    room.users[socket.id] = {
      id: socket.id,
      username: socket.username,
      avatar: socket.avatar,
      peerId: socket.peerId
    };

    // Zaman farkını hesaplayarak güncel saniyeyi ver
    let current = room.currentTime;
    if (room.isPlaying) {
      const elapsed = (Date.now() - room.lastUpdated) / 1000;
      current += elapsed;
    }

    // Odaya yeni katılan kullanıcıya başlangıç durumunu gönder
    socket.emit('room:initial_sync', {
      ...room,
      currentTime: current,
      users: Object.values(room.users)
    });

    // Odadaki diğer kullanıcılara yeni katılanı bildir
    socket.to(roomId).emit('user:joined', {
      userId: socket.id,
      username: socket.username,
      avatar: socket.avatar,
      peerId: socket.peerId,
      users: Object.values(room.users)
    });

    // Sohbet alanına sistem mesajı at
    io.to(roomId).emit('chat:receive', {
      id: Date.now(),
      sender: 'PartyFlow',
      avatar: 'https://cdn-icons-png.flaticon.com/512/3658/3658773.png',
      message: `🎬 ${socket.username} odaya katıldı!`,
      isSystem: true,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    // Discord Webhook Bildirimi (varsa)
    sendDiscordWebhook(
      '🎬 Odaya Biri Katıldı!',
      `**${socket.username}** \`${roomId}\` odasına bağlandı. İyi seyirler! 🍿`,
      0x10b981
    );
  });

  // Peer ID Güncellemesi (Kamera açıldığında sonradan gelebilir)
  socket.on('peer:update', ({ roomId, peerId }) => {
    socket.peerId = peerId;
    const room = rooms[roomId];
    if (room && room.users[socket.id]) {
      room.users[socket.id].peerId = peerId;
      socket.to(roomId).emit('peer:updated', { userId: socket.id, peerId });
    }
  });

  // Canlı Sohbet Mesajı
  socket.on('chat:send', (data) => {
    const { roomId, message, sender, avatar } = data;
    io.to(roomId).emit('chat:receive', {
      id: Date.now(),
      sender: sender || socket.username || 'Anonim',
      avatar: avatar || socket.avatar || '',
      message,
      isSystem: false,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  });

  // Video Kaynağını Değiştirme (YouTube / Doğrudan MP4)
  socket.on('video:change_source', ({ roomId, videoUrl, videoType }) => {
    const room = getOrCreateRoom(roomId);
    room.videoUrl = videoUrl;
    room.videoType = videoType || (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be') ? 'youtube' : 'direct');
    room.currentTime = 0;
    room.isPlaying = false;
    room.lastUpdated = Date.now();

    io.to(roomId).emit('video:source_updated', {
      videoUrl: room.videoUrl,
      videoType: room.videoType
    });

    // Sohbete bilgi düş
    io.to(roomId).emit('chat:receive', {
      id: Date.now(),
      sender: 'PartyFlow',
      avatar: 'https://cdn-icons-png.flaticon.com/512/3658/3658773.png',
      message: `📺 Yeni video yüklendi: ${videoUrl}`,
      isSystem: true,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    // Discord Webhook
    sendDiscordWebhook(
      '📺 Video Değiştirildi!',
      `**${socket.username || 'Partner'}** yeni bir video açtı:\n${videoUrl}`,
      0x8b5cf6
    );
  });

  // Video Senkronu: Play
  socket.on('video:play', ({ roomId, currentTime }) => {
    const room = getOrCreateRoom(roomId);
    room.isPlaying = true;
    room.currentTime = currentTime || 0;
    room.lastUpdated = Date.now();
    socket.to(roomId).emit('video:on_play', { currentTime: room.currentTime, sender: socket.username });
  });

  // Video Senkronu: Pause
  socket.on('video:pause', ({ roomId, currentTime }) => {
    const room = getOrCreateRoom(roomId);
    room.isPlaying = false;
    room.currentTime = currentTime || 0;
    room.lastUpdated = Date.now();
    socket.to(roomId).emit('video:on_pause', { currentTime: room.currentTime, sender: socket.username });
  });

  // Video Senkronu: Seek
  socket.on('video:seek', ({ roomId, currentTime }) => {
    const room = getOrCreateRoom(roomId);
    room.currentTime = currentTime || 0;
    room.lastUpdated = Date.now();
    socket.to(roomId).emit('video:on_seek', { currentTime: room.currentTime, sender: socket.username });
  });

  // Ayarlanabilir Mola Başlatma (Snack Break)
  socket.on('snack:start', ({ roomId, duration = 300 }) => {
    const room = getOrCreateRoom(roomId);
    if (!room.snackBreak) {
      room.snackBreak = true;
      room.isPlaying = false;
      room.breakTimer = duration;

      io.to(roomId).emit('video:on_pause', { currentTime: room.currentTime });
      io.to(roomId).emit('snack:started', { duration, starter: socket.username });

      // Sohbete bilgi ver
      io.to(roomId).emit('chat:receive', {
        id: Date.now(),
        sender: 'PartyFlow',
        avatar: 'https://cdn-icons-png.flaticon.com/512/3658/3658773.png',
        message: `🍿 ${socket.username} ${Math.round(duration / 60)} dakikalık mola başlattı!`,
        isSystem: true,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });

      // Discord Webhook
      sendDiscordWebhook(
        '🍿 Atıştırmalık Molası!',
        `**${socket.username || 'Partner'}** ${Math.round(duration / 60)} dakikalık atıştırmalık molası başlattı. İçecekleri tazeleyin! ☕🍕`,
        0xf59e0b
      );

      clearInterval(room.snackInterval);
      room.snackInterval = setInterval(() => {
        room.breakTimer -= 1;
        io.to(roomId).emit('snack:tick', { remaining: room.breakTimer });

        if (room.breakTimer <= 0) {
          clearInterval(room.snackInterval);
          room.snackBreak = false;
          io.to(roomId).emit('snack:ended');
        }
      }, 1000);
    }
  });

  // Mola Bitirme
  socket.on('snack:stop', ({ roomId }) => {
    const room = rooms[roomId];
    if (room && room.snackBreak) {
      clearInterval(room.snackInterval);
      room.snackBreak = false;
      io.to(roomId).emit('snack:ended');

      io.to(roomId).emit('chat:receive', {
        id: Date.now(),
        sender: 'PartyFlow',
        avatar: 'https://cdn-icons-png.flaticon.com/512/3658/3658773.png',
        message: `🎬 ${socket.username} molayı sonlandırdı, filme devam!`,
        isSystem: true,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    }
  });

  // Anlık Tepki Efektleri (❤️, 😂, 😭, 😡)
  socket.on('reaction:trigger', ({ roomId, type, sender }) => {
    io.to(roomId).emit('reaction:broadcast', {
      id: Math.random().toString(36).substring(2, 9),
      type,
      sender: sender || socket.username
    });
  });

  // Kullanıcı Ayrıldığında
  socket.on('disconnect', () => {
    console.log('[Socket] Kullanıcı ayrıldı:', socket.id);
    if (socket.roomId && rooms[socket.roomId]) {
      const room = rooms[socket.roomId];
      delete room.users[socket.id];
      socket.to(socket.roomId).emit('user:left', {
        userId: socket.id,
        username: socket.username,
        peerId: socket.peerId,
        users: Object.values(room.users)
      });
    }
  });
});

// Sunucuyu Başlat
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log('==================================================');
  console.log(`🎬 PartyFlow Sunucusu Hazır: http://localhost:${PORT}`);
  console.log(`📹 PeerJS WebRTC Sunucusu:  http://localhost:${PORT}/peerjs`);
  console.log('==================================================');
});