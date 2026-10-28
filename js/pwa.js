// pwa.js — Registro do service worker.
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(err => console.warn('PWA: não foi possível registrar o service worker', err)));
}
