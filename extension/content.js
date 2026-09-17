// PartyFlow Netflix / Streaming Content Script
console.log('[PartyFlow] Eklenti sayfaya enjekte edildi!');

let socket = null;
let currentVideo = null;
let isSyncing = false;
let config = {
  serverUrl: 'http://localhost:5000',
  roomId: 'ask-yuvasi',
  username: 'Wesley'
};

// Ayarları yükle
chrome.storage.sync.get(['serverUrl', 'roomId', 'username'], (res) => {
  if (res.serverUrl) config.serverUrl = res.serverUrl;
  if (res.roomId) config.roomId = res.roomId;
  if (res.username) config.username = res.username;
  initPartyFlowSocket();
});

// Ayar değişirse güncelle
chrome.storage.onChanged.addListener((changes) => {
  if (changes.serverUrl) config.serverUrl = changes.serverUrl.newValue;
  if (changes.roomId) config.roomId = changes.roomId.newValue;
  if (changes.username) config.username = changes.username.newValue;
  if (socket) socket.disconnect();
  initPartyFlowSocket();
});

function initPartyFlowSocket() {
  try {
    socket = io(config.serverUrl);

    socket.on('connect', () => {
      console.log('[PartyFlow] Sunucuya bağlandı:', config.serverUrl);
      updateBadgeStatus(true);
      socket.emit('room:join', {
        roomId: config.roomId,
        username: config.username,
        avatar: '',
        peerId: null
      });
    });

    socket.on('disconnect', () => {
      console.log('[PartyFlow] Sunucu bağlantısı koptu.');
      updateBadgeStatus(false);
    });

    // Senkronizasyon Olayları
    socket.on('video:on_play', ({ currentTime }) => {
      if (!currentVideo) return;
      isSyncing = true;
      if (Math.abs(currentVideo.currentTime - currentTime) > 1.5) {
        currentVideo.currentTime = currentTime;
      }
      currentVideo.play().catch(() => {});
      setTimeout(() => isSyncing = false, 600);
    });

    socket.on('video:on_pause', ({ currentTime }) => {
      if (!currentVideo) return;
      isSyncing = true;
      if (Math.abs(currentVideo.currentTime - currentTime) > 1.5) {
        currentVideo.currentTime = currentTime;
      }
      currentVideo.pause();
      setTimeout(() => isSyncing = false, 600);
    });

    socket.on('video:on_seek', ({ currentTime }) => {
      if (!currentVideo) return;
      isSyncing = true;
      currentVideo.currentTime = currentTime;
      setTimeout(() => isSyncing = false, 600);
    });

    socket.on('snack:started', () => {
      if (currentVideo) {
        currentVideo.pause();
      }
      showToast('🍿 Partneriniz mola başlattı! Video duraklatıldı.');
    });

  } catch (err) {
    console.error('[PartyFlow] Soket hatası:', err);
  }
}

// Video Elementini Bul ve Dinle
function setupVideoHooks() {
  const video = document.querySelector('video');
  if (video && video !== currentVideo) {
    currentVideo = video;
    console.log('[PartyFlow] Video elementi bulundu ve bağlandı!');

    video.addEventListener('play', () => {
      if (isSyncing || !socket) return;
      socket.emit('video:play', { roomId: config.roomId, currentTime: video.currentTime });
    });

    video.addEventListener('pause', () => {
      if (isSyncing || !socket || video.seeking) return;
      socket.emit('video:pause', { roomId: config.roomId, currentTime: video.currentTime });
    });

    video.addEventListener('seeked', () => {
      if (isSyncing || !socket) return;
      socket.emit('video:seek', { roomId: config.roomId, currentTime: video.currentTime });
    });
  }
}

// Netflix gibi SPA sitelerde video sonradan yüklendiği için sürekli kontrol et
setInterval(setupVideoHooks, 1000);

// Ekran Rozeti (Floating Badge)
function createBadge() {
  if (document.getElementById('partyflow-badge')) return;
  const badge = document.createElement('div');
  badge.id = 'partyflow-badge';
  badge.style.cssText = `
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 9999999;
    background: rgba(15, 23, 42, 0.9);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(139, 92, 246, 0.4);
    color: #f8fafc;
    padding: 8px 14px;
    border-radius: 9999px;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 12px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    user-select: none;
    pointer-events: auto;
  `;
  badge.innerHTML = `
    <span style="font-size: 14px;">🍿</span>
    <span>PartyFlow: <strong style="color:#c084fc;">${config.roomId}</strong></span>
    <span id="partyflow-status-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #ef4444; display: inline-block;"></span>
  `;
  document.body.appendChild(badge);
}

function updateBadgeStatus(connected) {
  createBadge();
  const dot = document.getElementById('partyflow-status-dot');
  if (dot) {
    dot.style.background = connected ? '#10b981' : '#ef4444';
  }
}

function showToast(msg) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 70px;
    right: 16px;
    z-index: 9999999;
    background: #8b5cf6;
    color: white;
    padding: 10px 16px;
    border-radius: 8px;
    font-family: system-ui, sans-serif;
    font-size: 13px;
    font-weight: bold;
    box-shadow: 0 10px 25px rgba(0,0,0,0.4);
    animation: fadeIn 0.3s ease;
  `;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

setTimeout(createBadge, 1500);
