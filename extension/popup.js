document.addEventListener('DOMContentLoaded', () => {
  const serverUrlInput = document.getElementById('serverUrl');
  const roomIdInput = document.getElementById('roomId');
  const usernameInput = document.getElementById('username');
  const saveBtn = document.getElementById('saveBtn');
  const statusMsg = document.getElementById('statusMsg');

  // Mevcut ayarları getir
  chrome.storage.sync.get(['serverUrl', 'roomId', 'username'], (res) => {
    if (res.serverUrl) serverUrlInput.value = res.serverUrl;
    if (res.roomId) roomIdInput.value = res.roomId;
    if (res.username) usernameInput.value = res.username;
  });

  saveBtn.addEventListener('click', () => {
    const serverUrl = serverUrlInput.value.trim() || 'http://localhost:5000';
    const roomId = roomIdInput.value.trim() || 'ask-yuvasi';
    const username = usernameInput.value.trim() || 'Wesley';

    chrome.storage.sync.set({ serverUrl, roomId, username }, () => {
      statusMsg.style.display = 'block';
      setTimeout(() => {
        statusMsg.style.display = 'none';
      }, 2500);
    });
  });
});
