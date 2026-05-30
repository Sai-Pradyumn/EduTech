/**
 * Frontend runtime config. For production, replace these values (or wire
 * angular.json `fileReplacements` to an environment.prod.ts).
 * Mirrors client/.env.example (API_BASE_URL, SOCKET_URL).
 */
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:3000/api',
  socketUrl: 'http://localhost:3000',
};
