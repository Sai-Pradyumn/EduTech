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

// Keep localhost development free of stale service workers and Cache Storage.
// Different local apps often share the same localhost origin, which can leave
// old Angular/Vite sourcemap URLs behind after switching projects.
(function () {
  var localHosts = ['localhost', '127.0.0.1', '::1', '[::1]'];

  function isLocalDevHost() {
    return localHosts.indexOf(window.location.hostname) !== -1 || window.location.hostname.slice(-10) === '.localhost';
  }

  function clearLocalPwaState() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then(function (registrations) {
          return Promise.all(registrations.map(function (registration) {
            return registration.unregister();
          }));
        })
        .catch(function () {});
    }

    if ('caches' in window) {
      window.caches.keys()
        .then(function (keys) {
          return Promise.all(keys.map(function (key) {
            return window.caches.delete(key);
          }));
        })
        .catch(function () {});
    }
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      if (isLocalDevHost()) {
        clearLocalPwaState();
        return;
      }

      if (window.location.protocol === 'https:') {
        navigator.serviceWorker.register('/sw.js').catch(function () {});
      }
    });
  }
})();
