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
        footer: { text: 'PartyFlow Cinema • Çok Odalı Sosyal İzleme' },
        timestamp: new Date().toISOString()
      }]
    });
  } catch (err) {
    console.warn('[Webhook] Discord bildirimi gönderilemedi:', err.message);
  }
}

// Video Tipi Algılayıcı
function detectVideoType(url) {
  if (!url) return 'youtube';
  const trimmed = url.trim();
  if (trimmed.includes('youtube.com') || trimmed.includes('youtu.be') || /^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return 'youtube';
  if (trimmed.includes('twitch.tv')) return 'twitch';
  return 'direct';
}

// ==========================================
// ÇOK ODALI BELLEK İÇİ ODA YÖNETİMİ (ROOMS STATE)
// ==========================================
const rooms = {
  'sinema-salonu': {
    id: 'sinema-salonu',
    name: '🍿 Gece Sineması Kulübü',
    hostId: null,
    hostName: 'Sistem',
    password: null,
    isPrivate: false,
    controlMode: 'all',
    category: 'movie',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    videoType: 'direct',
    currentTime: 0,
    isPlaying: true,
    lastUpdated: Date.now(),
    snackBreak: false,
    snackInterval: null,
    breakTimer: 0,
    hypeScore: 40,
    isFeverActive: false,
    playlist: [
      { id: 'p1', title: 'Big Buck Bunny (Film Testi)', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', videoType: 'direct', addedBy: 'Sistem' },
      { id: 'p2', title: 'Lofi Chill Hip Hop', url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk', videoType: 'youtube', addedBy: 'Sistem' }
    ],
    currentPlaylistIndex: 0,
    users: {}
  },
  'lofi-cafe': {
    id: 'lofi-cafe',
    name: '☕ Lofi & Sohbet Lounge',
    hostId: null,
    hostName: 'Sistem',
    password: null,
    isPrivate: false,
    controlMode: 'all',
    category: 'music',
    videoUrl: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
    videoType: 'youtube',
    currentTime: 0,
    isPlaying: true,
    lastUpdated: Date.now(),
    snackBreak: false,
    snackInterval: null,
    breakTimer: 0,
    hypeScore: 65,
    isFeverActive: false,
    playlist: [
      { id: 'p3', title: 'Lofi Hip Hop Radio 24/7', url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk', videoType: 'youtube', addedBy: 'Sistem' },
      { id: 'p4', title: 'Cyberpunk Synthwave Ambience', url: 'https://www.youtube.com/watch?v=pmaEwSj1o9E', videoType: 'youtube', addedBy: 'Sistem' }
    ],
    currentPlaylistIndex: 0,
    users: {}
  },
  'anime-salonu': {
    id: 'anime-salonu',
    name: '⛩️ Anime & Dizi Salonu',
    hostId: null,
    hostName: 'Sistem',
    password: null,
    isPrivate: false,
    controlMode: 'all',
    category: 'anime',
    videoUrl: 'https://www.youtube.com/watch?v=pmaEwSj1o9E',
    videoType: 'youtube',
    currentTime: 0,
    isPlaying: true,
    lastUpdated: Date.now(),
    snackBreak: false,
    snackInterval: null,
    breakTimer: 0,
    hypeScore: 50,
    isFeverActive: false,
    playlist: [
      { id: 'p5', title: 'Cyberpunk Night City 4K Ambience', url: 'https://www.youtube.com/watch?v=pmaEwSj1o9E', videoType: 'youtube', addedBy: 'Sistem' },
      { id: 'p6', title: 'Lofi Hip Hop Chill', url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk', videoType: 'youtube', addedBy: 'Sistem' }
    ],
    currentPlaylistIndex: 0,
    users: {}
  },
  'espor-arenasi': {
    id: 'espor-arenasi',
    name: '🎮 Oyun & Espor Arenası',
    hostId: null,
    hostName: 'Sistem',
    password: null,
    isPrivate: false,
    controlMode: 'all',
    category: 'gaming',
    videoUrl: 'https://www.twitch.tv/elraenn',
    videoType: 'twitch',
    currentTime: 0,
    isPlaying: true,
    lastUpdated: Date.now(),
    snackBreak: false,
    snackInterval: null,
    breakTimer: 0,
    hypeScore: 75,
    isFeverActive: false,
    playlist: [
      { id: 'p7', title: 'Twitch Canlı Yayını', url: 'https://www.twitch.tv/elraenn', videoType: 'twitch', addedBy: 'Sistem' }
    ],
    currentPlaylistIndex: 0,
    users: {}
  },
  'scifi-4k': {
    id: 'scifi-4k',
    name: '🚀 Bilim Kurgu & 4K Sinema',
    hostId: null,
    hostName: 'Sistem',
    password: null,
    isPrivate: false,
    controlMode: 'all',
    category: 'movie',
    videoUrl: 'https://www.youtube.com/watch?v=m3zvVGJrJA8',
    videoType: 'youtube',
    currentTime: 0,
    isPlaying: true,
    lastUpdated: Date.now(),
    snackBreak: false,
    snackInterval: null,
    breakTimer: 0,
    hypeScore: 55,
    isFeverActive: false,
    playlist: [
      { id: 'p8', title: 'Interstellar - No Time For Caution', url: 'https://www.youtube.com/watch?v=m3zvVGJrJA8', videoType: 'youtube', addedBy: 'Sistem' },
      { id: 'p9', title: 'Tears of Steel (4K Sci-Fi)', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4', videoType: 'direct', addedBy: 'Sistem' }
    ],
    currentPlaylistIndex: 0,
    users: {}
  },
  'komedi-kulubu': {
    id: 'komedi-kulubu',
    name: '🎬 Popüler Trendler & Komedi',
    hostId: null,
    hostName: 'Sistem',
    password: null,
    isPrivate: false,
    controlMode: 'all',
    category: 'general',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    videoType: 'direct',
    currentTime: 0,
    isPlaying: true,
    lastUpdated: Date.now(),
    snackBreak: false,
    snackInterval: null,
    breakTimer: 0,
    hypeScore: 35,
    isFeverActive: false,
    playlist: [
      { id: 'p10', title: 'Tears of Steel Demo', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4', videoType: 'direct', addedBy: 'Sistem' }
    ],
    currentPlaylistIndex: 0,
    users: {}
  }
};

function getPublicRooms() {
  return Object.values(rooms)
    .filter(r => !r.isPrivate)
    .map(r => ({
      id: r.id,
      name: r.name,
      category: r.category,
      hasPassword: !!r.password,
      userCount: Object.keys(r.users).length,
      videoUrl: r.videoUrl,
      videoType: r.videoType,
      hostName: r.hostName,
      isPlaying: r.isPlaying,
      controlMode: r.controlMode
    }));
}

function broadcastLobbyUpdate() {
  io.emit('lobby:rooms_updated', getPublicRooms());
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

  // Lobi Açık Odaları İsteği
  socket.on('lobby:get_rooms', () => {
    socket.emit('lobby:rooms_updated', getPublicRooms());
  });

  // Yeni Salon Başlatma / Oluşturma
  socket.on('room:create', (data, callback) => {
    try {
      const roomName = (data && data.roomName && typeof data.roomName === 'string' && data.roomName.trim()) 
        ? data.roomName.trim() 
        : 'Yeni Sinema Salonu 🍿';

      // Türkçe karakter dönüşümü ile temiz ve geçerli salon ID üretimi
      const turkishMap = { 'ç':'c', 'ğ':'g', 'ı':'i', 'i':'i', 'ö':'o', 'ş':'s', 'ü':'u', 'Ç':'c', 'Ğ':'g', 'İ':'i', 'Ö':'o', 'Ş':'s', 'Ü':'u' };
      const normalized = roomName.replace(/[çğlıiöşüÇĞİÖŞÜ]/g, m => turkishMap[m] || m);
      const rawId = normalized
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 24) || 'salon';
      const roomId = `${rawId}-${Math.random().toString(36).substring(2, 6)}`;

      const initialVideo = (data && data.initialVideo && typeof data.initialVideo === 'string' && data.initialVideo.trim()) 
        ? data.initialVideo.trim() 
        : 'https://www.youtube.com/watch?v=jfKfPfyJRdk';

      rooms[roomId] = {
        id: roomId,
        name: roomName,
        hostId: socket.id,
        hostName: (data && data.username) || 'Host',
        password: (data && data.password && typeof data.password === 'string' && data.password.trim()) ? data.password.trim() : null,
        isPrivate: !!(data && data.isPrivate),
        controlMode: (data && data.controlMode) || 'all',
        category: (data && data.category) || 'movie',
        videoUrl: initialVideo,
        videoType: detectVideoType(initialVideo),
        currentTime: 0,
        isPlaying: true, // Salon başlatıldığında video otomatik başlar!
        lastUpdated: Date.now(),
        snackBreak: false,
        snackInterval: null,
        breakTimer: 0,
        hypeScore: 30,
        isFeverActive: false,
        playlist: [
          {
            id: 'item-1',
            title: 'Başlangıç Videosu',
            url: initialVideo,
            videoType: detectVideoType(initialVideo),
            addedBy: (data && data.username) || 'Host'
          }
        ],
        currentPlaylistIndex: 0,
        users: {}
      };

      broadcastLobbyUpdate();

      sendDiscordWebhook(
        '🎬 Yeni Sinema Odası Açıldı!',
        `**${(data && data.username) || 'Biri'}** yeni bir salon başlattı: **${rooms[roomId].name}** (Oda: \`${roomId}\`)`,
        0x10b981
      );

      if (callback && typeof callback === 'function') {
        callback({ success: true, roomId, room: rooms[roomId] });
      }
    } catch (err) {
      console.error('[Room Create Hatası]:', err);
      if (callback && typeof callback === 'function') {
        callback({ success: false, error: 'Salon oluşturulamadı: ' + err.message });
      }
    }
  });

  // Odaya Katılma (Şifre Korumalı & Çok Odalı)
  socket.on('room:join', ({ roomId, username, avatar, peerId, password }, callback) => {
    let room = rooms[roomId];

    // Eğer oda yoksa otomatik oluştur (Doğrudan linkle girenler için)
    if (!room) {
      room = {
        id: roomId,
        name: roomId,
        hostId: socket.id,
        hostName: username || 'Host',
        password: null,
        isPrivate: false,
        controlMode: 'all',
        category: 'general',
        videoUrl: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
        videoType: 'youtube',
        currentTime: 0,
        isPlaying: false,
        lastUpdated: Date.now(),
        snackBreak: false,
        snackInterval: null,
        breakTimer: 0,
        hypeScore: 20,
        isFeverActive: false,
        playlist: [],
        currentPlaylistIndex: 0,
        users: {}
      };
      rooms[roomId] = room;
    }

    // Şifre Kontrolü
    if (room.password && room.password !== password) {
      if (callback) return callback({ success: false, error: 'Hatalı oda şifresi! Lütfen tekrar deneyin.' });
      return socket.emit('room:join_error', { message: 'Hatalı oda şifresi!' });
    }

    // Kullanıcıyı odaya ekle
    socket.join(roomId);
    socket.roomId = roomId;
    socket.username = username || 'Misafir';
    socket.avatar = avatar || '';
    socket.peerId = peerId || null;

    // Eğer odanın host'u yoksa yeni gelen host olsun
    if (!room.hostId) {
      room.hostId = socket.id;
      room.hostName = socket.username;
    }

    room.users[socket.id] = {
      id: socket.id,
      username: socket.username,
      avatar: socket.avatar,
      peerId: socket.peerId,
      isHost: room.hostId === socket.id
    };

    // Güncel video zamanını hesapla
    let current = room.currentTime;
    if (room.isPlaying) {
      const elapsed = (Date.now() - room.lastUpdated) / 1000;
      current += elapsed;
    }

    const roomState = {
      ...room,
      currentTime: current,
      users: Object.values(room.users),
      isHost: room.hostId === socket.id
    };

    // Katılan kullanıcıya tam oda durumunu gönder
    socket.emit('room:initial_sync', roomState);
    if (callback) callback({ success: true, room: roomState });

    // Odadaki diğer kişilere bildir
    socket.to(roomId).emit('user:joined', {
      userId: socket.id,
      username: socket.username,
      avatar: socket.avatar,
      peerId: socket.peerId,
      isHost: room.hostId === socket.id,
      users: Object.values(room.users)
    });

    // Sohbete bilgi düş
    io.to(roomId).emit('chat:receive', {
      id: Date.now(),
      sender: 'PartyFlow',
      avatar: 'https://cdn-icons-png.flaticon.com/512/3658/3658773.png',
      message: `🎬 ${socket.username} odaya katıldı!`,
      isSystem: true,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    broadcastLobbyUpdate();
  });

  // Peer ID Güncellemesi (Kamera sonradan açılınca)
  socket.on('peer:update', ({ roomId, peerId }) => {
    socket.peerId = peerId;
    const room = rooms[roomId];
    if (room && room.users[socket.id]) {
      room.users[socket.id].peerId = peerId;
      socket.to(roomId).emit('peer:updated', { userId: socket.id, peerId });
    }
  });

  // Oda Ayarlarını Güncelleme (Yalnızca Host Yapabilir)
  socket.on('room:update_settings', ({ roomId, controlMode, name, password }) => {
    const room = rooms[roomId];
    if (!room || room.hostId !== socket.id) return;

    if (controlMode) room.controlMode = controlMode;
    if (name) room.name = name;
    if (password !== undefined) room.password = password ? password.trim() : null;

    io.to(roomId).emit('room:settings_updated', {
      controlMode: room.controlMode,
      name: room.name,
      hasPassword: !!room.password
    });

    io.to(roomId).emit('chat:receive', {
      id: Date.now(),
      sender: 'PartyFlow',
      avatar: 'https://cdn-icons-png.flaticon.com/512/3658/3658773.png',
      message: `⚙️ Oda ayarları güncellendi (Kontrol Yetkisi: ${room.controlMode === 'host' ? 'Sadece Host' : 'Herkes'}).`,
      isSystem: true,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    broadcastLobbyUpdate();
  });

  // Kullanıcıyı Odadan Atma (Kick - Sadece Host)
  socket.on('room:kick_user', ({ roomId, targetUserId }) => {
    const room = rooms[roomId];
    if (!room || room.hostId !== socket.id) return;

    const targetSocket = io.sockets.sockets.get(targetUserId);
    if (targetSocket) {
      targetSocket.leave(roomId);
      targetSocket.emit('room:kicked', { message: 'Oda sahibi tarafından odadan çıkarıldınız.' });
      delete room.users[targetUserId];

      io.to(roomId).emit('user:left', {
        userId: targetUserId,
        users: Object.values(room.users)
      });

      io.to(roomId).emit('chat:receive', {
        id: Date.now(),
        sender: 'PartyFlow',
        avatar: 'https://cdn-icons-png.flaticon.com/512/3658/3658773.png',
        message: `🚫 ${targetSocket.username || 'Bir kullanıcı'} odadan çıkarıldı.`,
        isSystem: true,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
      broadcastLobbyUpdate();
    }
  });

  // Canlı Sohbet Mesajı
  socket.on('chat:send', (data) => {
    const targetRoom = (data && data.roomId) || socket.roomId;
    if (!targetRoom) {
      console.warn('[Chat] Mesaj iletilemedi, oda bulunamadı. Socket ID:', socket.id);
      return;
    }

    if (!socket.rooms.has(targetRoom)) {
      socket.join(targetRoom);
      socket.roomId = targetRoom;
    }

    const messageContent = (data && typeof data.message === 'string') ? data.message.trim() : '';
    if (!messageContent) return;

    const payload = {
      id: Date.now(),
      sender: (data && data.sender) || socket.username || 'Misafir',
      avatar: (data && data.avatar) || socket.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png',
      message: messageContent,
      isSystem: false,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    io.to(targetRoom).emit('chat:receive', payload);
  });

  // Video Değiştirme
  socket.on('video:change_source', ({ roomId, videoUrl, videoType }) => {
    const room = rooms[roomId];
    if (!room) return;

    // Yetki kontrolü: Eğer controlMode 'host' ise ve istek host'tan gelmiyorsa engelle
    if (room.controlMode === 'host' && socket.id !== room.hostId) {
      return socket.emit('chat:receive', {
        id: Date.now(),
        sender: 'Sistem',
        avatar: 'https://cdn-icons-png.flaticon.com/512/3658/3658773.png',
        message: '⚠️ Bu odada video kontrolleri sadece Oda Sahibi (Host) tarafından yönetilmektedir.',
        isSystem: true,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    }

    room.videoUrl = videoUrl;
    room.videoType = videoType || detectVideoType(videoUrl);
    room.currentTime = 0;
    room.isPlaying = false;
    room.lastUpdated = Date.now();

    io.to(roomId).emit('video:source_updated', {
      videoUrl: room.videoUrl,
      videoType: room.videoType
    });

    io.to(roomId).emit('chat:receive', {
      id: Date.now(),
      sender: 'PartyFlow',
      avatar: 'https://cdn-icons-png.flaticon.com/512/3658/3658773.png',
      message: `📺 Yeni video yüklendi: ${videoUrl}`,
      isSystem: true,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    broadcastLobbyUpdate();
  });

  // Video Senkronu: Play
  socket.on('video:play', ({ roomId, currentTime }) => {
    const room = rooms[roomId];
    if (!room) return;
    if (room.controlMode === 'host' && socket.id !== room.hostId) return;

    room.isPlaying = true;
    room.currentTime = currentTime || 0;
    room.lastUpdated = Date.now();
    socket.to(roomId).emit('video:on_play', { currentTime: room.currentTime, sender: socket.username });
  });

  // Video Senkronu: Pause
  socket.on('video:pause', ({ roomId, currentTime }) => {
    const room = rooms[roomId];
    if (!room) return;
    if (room.controlMode === 'host' && socket.id !== room.hostId) return;

    room.isPlaying = false;
    room.currentTime = currentTime || 0;
    room.lastUpdated = Date.now();
    socket.to(roomId).emit('video:on_pause', { currentTime: room.currentTime, sender: socket.username });
  });

  // Video Senkronu: Seek
  socket.on('video:seek', ({ roomId, currentTime }) => {
    const room = rooms[roomId];
    if (!room) return;
    if (room.controlMode === 'host' && socket.id !== room.hostId) return;

    room.currentTime = currentTime || 0;
    room.lastUpdated = Date.now();
    socket.to(roomId).emit('video:on_seek', { currentTime: room.currentTime, sender: socket.username });
  });

  // ==========================================
  // OYNATMA LİSTESİ (PLAYLIST / QUEUE) OLAYLARI
  // ==========================================
  socket.on('playlist:add', ({ roomId, item }) => {
    const room = rooms[roomId];
    if (!room) return;

    const playlistItem = {
      id: 'pl-' + Math.random().toString(36).substring(2, 9),
      title: item.title || 'Video',
      url: item.url,
      videoType: detectVideoType(item.url),
      addedBy: socket.username
    };

    room.playlist.push(playlistItem);
    io.to(roomId).emit('playlist:updated', { playlist: room.playlist, currentIndex: room.currentPlaylistIndex });

    io.to(roomId).emit('chat:receive', {
      id: Date.now(),
      sender: 'PartyFlow',
      avatar: 'https://cdn-icons-png.flaticon.com/512/3658/3658773.png',
      message: `📜 ${socket.username} sıraya yeni video ekledi: "${playlistItem.title}"`,
      isSystem: true,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  });

  socket.on('playlist:remove', ({ roomId, itemId }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.playlist = room.playlist.filter(i => i.id !== itemId);
    io.to(roomId).emit('playlist:updated', { playlist: room.playlist, currentIndex: room.currentPlaylistIndex });
  });

  socket.on('playlist:play_index', ({ roomId, index }) => {
    const room = rooms[roomId];
    if (!room || !room.playlist[index]) return;
    if (room.controlMode === 'host' && socket.id !== room.hostId) return;

    room.currentPlaylistIndex = index;
    const item = room.playlist[index];
    room.videoUrl = item.url;
    room.videoType = item.videoType || detectVideoType(item.url);
    room.currentTime = 0;
    room.isPlaying = true;
    room.lastUpdated = Date.now();

    io.to(roomId).emit('video:source_updated', {
      videoUrl: room.videoUrl,
      videoType: room.videoType
    });
    io.to(roomId).emit('playlist:updated', { playlist: room.playlist, currentIndex: room.currentPlaylistIndex });
  });

  // ==========================================
  // SES EFEKTLERİ (SOUNDBOARD SFX)
  // ==========================================
  socket.on('sfx:trigger', ({ roomId, sound }) => {
    io.to(roomId).emit('sfx:play', { sound, sender: socket.username });
  });

  // Ayarlanabilir Mola (Snack Break)
  socket.on('snack:start', ({ roomId, duration = 300 }) => {
    const room = rooms[roomId];
    if (room && !room.snackBreak) {
      room.snackBreak = true;
      room.isPlaying = false;
      room.breakTimer = duration;

      io.to(roomId).emit('video:on_pause', { currentTime: room.currentTime });
      io.to(roomId).emit('snack:started', { duration, starter: socket.username });

      io.to(roomId).emit('chat:receive', {
        id: Date.now(),
        sender: 'PartyFlow',
        avatar: 'https://cdn-icons-png.flaticon.com/512/3658/3658773.png',
        message: `🍿 ${socket.username} ${Math.round(duration / 60)} dakikalık mola başlattı!`,
        isSystem: true,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });

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

  // Ekran Paylaşımı (Netflix / Dizi / WebRTC Screen Share)
  socket.on('screenshare:start', ({ roomId }) => {
    socket.to(roomId).emit('screenshare:started', {
      sender: socket.username,
      peerId: socket.peerId
    });

    io.to(roomId).emit('chat:receive', {
      id: Date.now(),
      sender: 'PartyFlow',
      avatar: 'https://cdn-icons-png.flaticon.com/512/3658/3658773.png',
      message: `🖥️ ${socket.username} ekranını yayına verdi (Netflix / Film / Dizi).`,
      isSystem: true,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  });

  socket.on('screenshare:stop', ({ roomId }) => {
    socket.to(roomId).emit('screenshare:stopped', { sender: socket.username });

    io.to(roomId).emit('chat:receive', {
      id: Date.now(),
      sender: 'PartyFlow',
      avatar: 'https://cdn-icons-png.flaticon.com/512/3658/3658773.png',
      message: `🖥️ ${socket.username} ekran paylaşımını sonlandırdı.`,
      isSystem: true,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  });

  // Hype Artış Mantığı (Ortak Yardımcı Fonksiyon)
  function applyHypeBoost(roomId, boostAmount, senderName) {
    const room = rooms[roomId];
    if (!room) return;
    if (typeof room.hypeScore !== 'number') room.hypeScore = 20;

    // Eğer Party Fever zaten aktifse skoru 100'de tut
    if (room.isFeverActive) {
      io.to(roomId).emit('hype:updated', { hypeScore: 100, isFever: true });
      return;
    }

    room.hypeScore = Math.min(100, room.hypeScore + boostAmount);

    if (room.hypeScore >= 100) {
      room.isFeverActive = true;
      room.hypeScore = 100;
      io.to(roomId).emit('hype:updated', { hypeScore: 100, isFever: true });
      io.to(roomId).emit('hype:fever', { triggerBy: senderName || 'Salon' });

      // 6 saniye boyunca %100 Party Fever kutlaması sürsün, sonra %20'ye dönsün
      setTimeout(() => {
        if (rooms[roomId]) {
          rooms[roomId].isFeverActive = false;
          rooms[roomId].hypeScore = 20;
          io.to(roomId).emit('hype:updated', { hypeScore: 20, isFever: false });
        }
      }, 6000);
    } else {
      io.to(roomId).emit('hype:updated', { hypeScore: room.hypeScore, isFever: false });
    }
  }

  // Anlık Tepki Efektleri (❤️, 😂, 😭, 😡, 🍿, 🔥, 🎉) & Hype Arttırma
  socket.on('reaction:trigger', ({ roomId, type, sender }) => {
    io.to(roomId).emit('reaction:broadcast', {
      id: Math.random().toString(36).substring(2, 9),
      type,
      sender: sender || socket.username
    });
    applyHypeBoost(roomId, 6, sender || socket.username);
  });

  // Hype Meter Doğrudan Arttırma Butonu (+Hype)
  socket.on('hype:boost', ({ roomId, amount, hype }) => {
    const boost = typeof amount === 'number' ? amount : (typeof hype === 'number' ? hype : 12);
    applyHypeBoost(roomId, boost, socket.username || 'Salon');
  });

  // Gerçek Zamanlı Ping / Latency Kontrolü
  socket.on('ping:check', (data, callback) => {
    if (callback) callback({ serverTime: Date.now() });
  });

  // Canlı Oda Anketi (Live Room Poll)
  socket.on('poll:start', ({ roomId, question, options }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.activePoll = {
      id: Date.now(),
      question,
      options: (options || []).map(opt => ({ text: opt, votes: 0 })),
      votesByUser: {},
      creator: socket.username || 'Üye',
      createdAt: Date.now()
    };
    io.to(roomId).emit('poll:started', room.activePoll);
    io.to(roomId).emit('chat:receive', {
      id: Date.now(),
      sender: 'PartyFlow AI',
      avatar: 'https://cdn-icons-png.flaticon.com/512/3658/3658773.png',
      message: `📊 Canlı Oylama Başlatıldı: "${question}"`,
      isSystem: true,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  });

  socket.on('poll:vote', ({ roomId, optionIndex }) => {
    const room = rooms[roomId];
    if (!room || !room.activePoll) return;
    const poll = room.activePoll;
    const prevVote = poll.votesByUser[socket.id];
    if (prevVote !== undefined && poll.options[prevVote]) {
      poll.options[prevVote].votes = Math.max(0, poll.options[prevVote].votes - 1);
    }
    poll.votesByUser[socket.id] = optionIndex;
    if (poll.options[optionIndex]) {
      poll.options[optionIndex].votes += 1;
    }
    const totalVotes = Object.keys(poll.votesByUser).length;
    io.to(roomId).emit('poll:updated', {
      options: poll.options,
      totalVotes,
      voterId: socket.id
    });
  });

  socket.on('poll:end', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || !room.activePoll) return;
    io.to(roomId).emit('poll:ended');
    room.activePoll = null;
  });

  // Odadan Lobiye Ayrılma
  socket.on('room:leave', () => {
    if (socket.roomId && rooms[socket.roomId]) {
      const room = rooms[socket.roomId];
      delete room.users[socket.id];

      if (room.hostId === socket.id) {
        const remainingUserIds = Object.keys(room.users);
        if (remainingUserIds.length > 0) {
          const nextHostId = remainingUserIds[0];
          room.hostId = nextHostId;
          room.hostName = room.users[nextHostId].username;
          room.users[nextHostId].isHost = true;

          io.to(socket.roomId).emit('host:changed', {
            hostId: room.hostId,
            hostName: room.hostName
          });

          io.to(socket.roomId).emit('chat:receive', {
            id: Date.now(),
            sender: 'PartyFlow',
            avatar: 'https://cdn-icons-png.flaticon.com/512/3658/3658773.png',
            message: `👑 Yeni oda sahibi: ${room.hostName}`,
            isSystem: true,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          });
        }
      }

      socket.to(socket.roomId).emit('user:left', {
        userId: socket.id,
        username: socket.username,
        peerId: socket.peerId,
        users: Object.values(room.users)
      });

      socket.leave(socket.roomId);
      socket.roomId = null;
      broadcastLobbyUpdate();
    }
  });

  // Kullanıcı Ayrıldığında
  socket.on('disconnect', () => {
    console.log('[Socket] Kullanıcı ayrıldı:', socket.id);
    if (socket.roomId && rooms[socket.roomId]) {
      const room = rooms[socket.roomId];
      delete room.users[socket.id];

      // Eğer ayrılan kişi host ise, odadaki bir başkasına hostluğu devret
      if (room.hostId === socket.id) {
        const remainingUserIds = Object.keys(room.users);
        if (remainingUserIds.length > 0) {
          const nextHostId = remainingUserIds[0];
          room.hostId = nextHostId;
          room.hostName = room.users[nextHostId].username;
          room.users[nextHostId].isHost = true;

          io.to(socket.roomId).emit('host:changed', {
            hostId: room.hostId,
            hostName: room.hostName
          });

          io.to(socket.roomId).emit('chat:receive', {
            id: Date.now(),
            sender: 'PartyFlow',
            avatar: 'https://cdn-icons-png.flaticon.com/512/3658/3658773.png',
            message: `👑 Yeni oda sahibi: ${room.hostName}`,
            isSystem: true,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          });
        }
      }

      socket.to(socket.roomId).emit('user:left', {
        userId: socket.id,
        username: socket.username,
        peerId: socket.peerId,
        users: Object.values(room.users)
      });

      broadcastLobbyUpdate();
    }
  });
});

// ==========================================
// 8. SUNUCU PERİYODİK VİDEO SENKRONİZASYON KALP ATIŞI (HEARTBEAT)
// ==========================================
setInterval(() => {
  const now = Date.now();
  for (const roomId in rooms) {
    const room = rooms[roomId];
    if (!room) continue;
    const userCount = Object.keys(room.users || {}).length;
    if (userCount === 0) continue;

    if (room.isPlaying && !room.snackBreak) {
      const elapsed = (now - room.lastUpdated) / 1000;
      const calculatedCurrentTime = room.currentTime + elapsed;
      io.to(roomId).emit('video:heartbeat', {
        currentTime: calculatedCurrentTime,
        isPlaying: true,
        lastUpdated: now
      });
    }
  }
}, 2500);

// Sunucuyu Başlat
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log('==================================================');
  console.log(`🎬 PartyFlow 2.0 Çok Odalı Platform Hazır: http://localhost:${PORT}`);
  console.log(`📹 PeerJS WebRTC Sunucusu:  http://localhost:${PORT}/peerjs`);
  console.log('==================================================');
});