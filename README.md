# Realtime Socket.io & Express App

Proje `client` ve `server` mimarisinde yapılandırılmıştır.

## 📁 Proje Yapısı

```text
├── client/
│   └── index.html         # Test amaçlı Socket.io istemci arayüzü
├── server/
│   ├── .env               # Port ve ortam değişkenleri
│   ├── .env.example
│   ├── index.js           # Express + Socket.io sunucu dosyası
│   ├── package.json
│   └── package-lock.json
└── .gitignore
```

## 🚀 Sunucuyu Başlatma

```bash
cd server
npm start
```
Varsayılan olarak sunucu `http://localhost:5000` adresinde dinlemeye başlar.

## 🌐 İstemciyi Test Etme

`client/index.html` dosyasını tarayıcınızda açarak anlık soket bağlantısını ve mesajlaşmayı test edebilirsiniz.
