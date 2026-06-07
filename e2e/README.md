# e2e — Playwright smoke tests

Public-page smoke coverage (landing, login, register, pricing, catch-all) that
runs with just the client — no backend or auth required.

## Run

```bash
npm run test:e2e:install   # one-time: download the Chromium browser
npm run test:e2e           # auto-starts the client dev server, then runs the specs
```

Against a live deployment instead of a local dev server:

```bash
E2E_BASE_URL=https://your-app.example.com npm run test:e2e
```

## Layout

- `playwright.config.ts` — config (auto-starts `npm run dev:client` unless `E2E_BASE_URL` is set).
- `specs/*.spec.ts` — test specs. Smoke specs assert only static, render-time
  content so they stay stable without a backend.

## Extending

Add authenticated flows behind a fixture that logs in via the seeded demo user
(`student@asta.dev` / `student12345`) once the API is running, and gate them on
an env flag so the no-backend smoke run stays green.
