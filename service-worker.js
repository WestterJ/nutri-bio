const CACHE_NAME = 'diario-nutricional-v39-1';
const APP_SHELL = [
  './', './index.html', './manifest.webmanifest', './supabase-config.js', './css/app.css',
  './js/01-utils.js', './js/02-estado.js', './js/03-nuvem.js', './js/04-diario.js', './js/05-ia-refeicao.js',
  './js/06-medidas.js', './js/07-bio.js', './js/08-graficos.js', './js/09-ia-analise.js', './js/10-relatorio.js',
  './js/11-backup.js', './js/12-metas.js', './js/13-sync-supabase.js', './js/14-treinos.js', './js/15-navegacao.js',
  './js/16-auth.js', './js/99-main.js',
  './icons/icon-192.png', './icons/icon-512.png'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('diario-nutricional-') && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(fetch(request).then(response => {
    if (response && response.ok) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
    }
    return response;
  }).catch(() => caches.match(request).then(cached => cached || (request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});
