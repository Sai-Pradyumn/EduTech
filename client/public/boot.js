// Pre-paint boot script. Loaded synchronously (classic <script src> in <head>)
// so the theme is set before first paint — and as an external file so the
// static host can enforce a CSP without 'unsafe-inline' for scripts.

// Set the theme pre-paint to avoid a flash of the wrong theme. ThemeService
// keeps this in sync at runtime (storage key: asta.theme).
(function () {
  try {
    var t = localStorage.getItem('asta.theme') || 'system';
    var dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  } catch (e) {}
})();

// Register the service worker (PWA shell caching).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}
