const CACHE_NAME = 'planejador-estudos-v10-7-arquivos-separados';
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './supabase-config.js', './css/estilos.css', './js/00-config.js', './js/01-base.js', './js/02-sugestoes.js', './js/03-utilitarios.js', './js/04-inicio.js', './js/05-registro.js', './js/06-edital.js', './js/07-concursos.js', './js/08-importacao-ia.js', './js/09-sincronizacao.js', './js/10-dados-backup.js', './js/11-datas-anotacoes.js', './js/12-iniciar.js', './js/auth.js', './js/pwa.js', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('planejador-estudos-') && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never cache OAuth callback URLs, which can temporarily contain an authorization code.
  const isAuthReturn = url.searchParams.has('code') || url.searchParams.has('error') || url.searchParams.has('type') || url.searchParams.has('access_token');
  if (isAuthReturn) {
    event.respondWith(fetch(request));
    return;
  }
  event.respondWith(fetch(request).then(response => {
    if (response && response.ok && !url.search) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
    }
    return response;
  }).catch(() => caches.match(request).then(cached => cached || (request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});
