/**
 * Production runtime config. Swapped in by angular.json `fileReplacements` for the
 * production build. URLs are same-origin and relative: the nginx image proxies
 * `/api/` and `/socket.io/` to the API service, so the browser never needs to know
 * the API's host. (`socketUrl: ''` makes socket.io connect to the page origin.)
 */
export const environment = {
  production: true,
  apiBaseUrl: '/api',
  socketUrl: '',
};
