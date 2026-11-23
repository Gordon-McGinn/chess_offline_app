// sw.js — lets the game work with no internet once it has been opened once.
// It saves the files below on first visit and serves them from that copy afterwards.
// When you change the game, bump CACHE (chess-v2, chess-v3, ...) so phones fetch the new files.

const CACHE = 'chess-v1';
const FILES = [
  './',
  'index.html',
  'chess.js',
  'bot.js',
  'manifest.json',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  // Remove copies saved by older versions.
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request)));
});
