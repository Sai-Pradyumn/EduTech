# SECURITY_IMPLEMENTATION.md

> **Application:** Asta — AI Skill Mentor (EduTech platform)
> **Scope:** This is a defensive, production-grade security architecture and implementation guide for **this application, which we own and are authorized to secure**. It is prevention-, detection-, response-, and recovery-focused. It contains **no** exploit payloads, malware behavior, stealth/persistence, credential-theft, or privilege-escalation walkthroughs.
> **Stack (ground truth):** NestJS 11 API · Angular 20 SPA · MongoDB (Mongoose 8, Atlas replica set) · Redis + BullMQ · JWT (access + refresh) via Passport · bcryptjs · class-validator + Zod + Joi · AWS S3 · Stripe + Razorpay · Socket.IO · Anthropic/OpenAI/Gemini/Groq/Mistral LLM providers · web-push · nodemailer · Docker · Render (API) · Vercel (web).
> **Last reviewed:** 2026-07-07 · **Owner of this document:** Security lead (rotating) · **Review cadence:** quarterly + after any Sev-1/Sev-2 incident.

## Reference frameworks

This program maps to widely used defensive standards. We use them as checklists, not as compliance theater.

| Framework | Version used | How we use it |
|---|---|---|
| OWASP ASVS | 5.0.0 (May 2025), 3 levels / ~350 reqs / 17 chapters | Verification target. App-wide baseline **L2**; auth, payments, admin, AI → **L3**. |
| OWASP Top 10 | 2025 | Threat-model anchor. Note new **A03 Software Supply-Chain Failures** and **A10 Mishandling of Exceptional Conditions**; SSRF folded into **A01 Broken Access Control**. |
| NIST CSF | 2.0 (2024) | Program structure: **Govern, Identify, Protect, Detect, Respond, Recover.** |
| NIST SSDF | SP 800-218 (+ SP 800-218A for generative AI) | Secure SDLC practices (PO/PS/PW/RV). |
| CIS Critical Security Controls | v8.1 (18 controls) | Infra/ops hardening priorities (IG1 minimum, targeting IG2). |
| SLSA | v1.0 Build track (L1→L3) | Supply-chain build integrity / provenance target. |

---

## Implementation Log — 2026-07-07

This is a living record of controls actually shipped in code (not just planned). Each item is unit-tested; the whole server suite (46 suites / 313 tests) and `nest build` pass with these changes.

Verified with a clean `nest build` and the full server suite: **47 suites / 323 tests pass** (91 of them added by this work).

| Control | What shipped | Files | Tests | Wiring status |
|---|---|---|---|---|
| **AU-03** Admin MFA (TOTP) | RFC 4226/6238 TOTP (base32, HOTP/TOTP, drift-window verify, `otpauth://` QR), **enrollment → login challenge → verify** flow, **single-use recovery codes** (bcrypt-hashed), applies to password *and* Google sign-in | [totp.ts](server/src/common/security/totp.ts), [mfa.service.ts](server/src/modules/auth/mfa.service.ts), endpoints in [auth.controller.ts](server/src/modules/auth/auth.controller.ts) (`/auth/mfa/setup·activate·disable·status·verify-login`), gate in [auth.service.ts](server/src/modules/auth/auth.service.ts), schema/store in [user.schema.ts](server/src/modules/users/schemas/user.schema.ts) / [users.service.ts](server/src/modules/users/users.service.ts) | [totp.spec.ts](server/src/common/security/totp.spec.ts) (RFC vectors) + [mfa.service.spec.ts](server/src/modules/auth/mfa.service.spec.ts) (full lifecycle) | **Fully wired** end-to-end; `verify-login` on the tight rate-limit budget. **Remaining:** make it *mandatory* for admin roles via a guard + client enrollment UI (currently opt-in). |
| **AU-04** Per-account login lockout | Exponential, self-healing time-based lockout after 5 failed logins; resets on success | [login-throttle.ts](server/src/common/security/login-throttle.ts), enforced in [auth.service.ts](server/src/modules/auth/auth.service.ts), fields in [user.schema.ts](server/src/modules/users/schemas/user.schema.ts), persistence in [users.service.ts](server/src/modules/users/users.service.ts) | [login-throttle.spec.ts](server/src/common/security/login-throttle.spec.ts) | **Fully wired** into the credential login path. |
| **DP-04/§15** Log redaction + no-leak errors | Deep cycle-safe redactor (secret keys + bearer/JWT/email/hex scrubbing); wired into the global exception filter so logs/error-feed are scrubbed, and **5xx responses no longer leak the raw error message/stack** to clients (A10/A09) | [redact.ts](server/src/common/security/redact.ts), wired in [all-exceptions.filter.ts](server/src/common/filters/all-exceptions.filter.ts) | [redact.spec.ts](server/src/common/security/redact.spec.ts) | **Wired** into the error sink. **Remaining:** also apply before AI-provider egress. |
| **§4.6/§10** SSRF egress guard | Protocol allowlist, credential-in-URL block, host allowlist, IPv4/IPv6 private/link-local/metadata classification, DNS-resolve-and-verify (anti-rebinding) | [ssrf-guard.ts](server/src/common/security/ssrf-guard.ts) | [ssrf-guard.spec.ts](server/src/common/security/ssrf-guard.spec.ts) | Utility ready. **Remaining:** route existing outbound fetches (RAG-by-URL, webhook callbacks, avatar-by-URL) through `assertPublicUrl()`. |
| **FU-01/§18** Upload content validation | Magic-byte sniffing; rejects executables/scripts/HTML and content-type spoofing (e.g. `.exe` renamed `.pdf`) | [file-signature.ts](server/src/common/security/file-signature.ts) | [file-signature.spec.ts](server/src/common/security/file-signature.spec.ts) | **Wired** into the knowledge upload endpoint ([knowledge.controller.ts](server/src/modules/rag/knowledge.controller.ts)). **Remaining:** AV/malware scan + quarantine state. |
| **FE-01/§9** API security headers | Locked-down `default-src 'none'` **CSP** for JSON responses (Swagger exempt) + `Cross-Origin-Resource-Policy` | [security.middleware.ts](server/src/common/middleware/security.middleware.ts) | [security.middleware.spec.ts](server/src/common/middleware/security.middleware.spec.ts) | **Fully wired** (applied globally in `main.ts`). |

> **Honesty note:** MFA, login lockout, upload validation, API-header CSP, and error-log hardening are fully wired and change runtime behavior now. Two items remain libraries awaiting their last mile: the SSRF guard must be called at each outbound site, and the redactor should also wrap AI-provider egress. MFA is opt-in per account — making it *mandatory for admins* needs an enforcement guard + client UI. All tracked in §25/§26.

### Round 2 — 2026-07-07 (later): enforcement wiring + advanced controls

Verified with a clean `nest build` and the full suite: **52 suites / 364 tests pass**.

| Control | What shipped | Files | Wiring status |
|---|---|---|---|
| **AU-03 (mandatory)** Admin-MFA enforcement | `@RequireMfa()` decorator + global `MfaEnforcementGuard`; applied to the admin + founder controllers; gated by `REQUIRE_ADMIN_MFA=true` so admins can enroll before the flag flips (no lockout on rollout). Zero DB cost on undecorated routes. | [require-mfa.decorator.ts](server/src/common/decorators/require-mfa.decorator.ts), [mfa-enforcement.guard.ts](server/src/common/guards/mfa-enforcement.guard.ts) (+spec), wired in [app.module.ts](server/src/app.module.ts), [admin.controller.ts](server/src/modules/admin/admin.controller.ts), [founder.controller.ts](server/src/modules/founder/founder.controller.ts) | **Wired**, flag-gated. Remaining: client enrollment UI, then set `REQUIRE_ADMIN_MFA=true` in prod. |
| **§4.6 SSRF — last mile** | Guard now called at every user-influenced outbound site: developer webhooks (register/update shape-check + **resolve-and-verify at delivery**, anti-rebinding), integrations Slack/Discord (fixed a **substring-match bypass** — `evil.com/hooks.slack.com/` would have passed; now host-parsed allowlist, re-checked at dispatch), web-push subscribe (public-https-only endpoints) | [developer.service.ts](server/src/modules/developer/developer.service.ts), [integrations.service.ts](server/src/modules/integrations/integrations.service.ts), [push.service.ts](server/src/modules/push/push.service.ts) | **Fully wired.** |
| **DP-03** Field-level encryption | AES-256-GCM (authenticated — tampering fails closed) with **versioned key ring** for rotation (`FIELD_ENCRYPTION_KEYS="1:old,2:new"`), lazy re-encryption helper | [field-encryption.ts](server/src/common/security/field-encryption.ts) (+spec) | Utility ready. Remaining: apply to chosen R fields (e.g. `mfaSecret`) — needs a data migration. |
| **AU-05** Breached-password check | HIBP **k-anonymity** range check (only 5 hex chars of the SHA-1 ever leave the server), 2.5s timeout, **fails open**; enforced in `register()` when `PASSWORD_BREACH_CHECK=true` | [breached-password.ts](server/src/common/security/breached-password.ts) (+spec), wired in [auth.service.ts](server/src/modules/auth/auth.service.ts) | **Wired**, flag-gated. |
| **API-02** Distributed rate limiting | Limiter refactored to pluggable stores: memory (default) or **Redis** (`RATE_LIMIT_REDIS=true`) so per-IP budgets hold across horizontally-scaled instances; fails open to memory with a logged warning; TTL self-healing | [rate-limit.middleware.ts](server/src/common/middleware/rate-limit.middleware.ts) (+spec), wired in [main.ts](server/src/main.ts) | **Wired**, flag-gated. |
| **§15 P2** Tamper-evident audit log | Hash-chained audit entries (`entryHash = SHA-256(prevHash \| canonical(payload) \| timestamp)`) — retroactive edits/deletes break every later link; admin endpoint `GET /admin/audit-logs/verify` re-walks and reports the first broken link. In-process write serialization; multi-instance caveat documented (tamper-**evident**, not tamper-proof — still ship logs to an external sink). | [audit-chain.ts](server/src/common/security/audit-chain.ts) (+spec), wired in [audit.service.ts](server/src/modules/audit/audit.service.ts), [audit-log.schema.ts](server/src/modules/audit/schemas/audit-log.schema.ts), [audit.controller.ts](server/src/modules/audit/audit.controller.ts) | **Fully wired.** |

### Round 3 — 2026-07-07 (later still): end-to-end hardening sweep (27 additional controls)

Verified with a clean `nest build` and the full suite: **58 suites / 407 tests pass**. All wired globally in [main.ts](server/src/main.ts) / [app.module.ts](server/src/app.module.ts) unless noted; flag-gated items are called out.

**Request layer (new [harden.middleware.ts](server/src/common/middleware/harden.middleware.ts) + [sanitize.ts](server/src/common/security/sanitize.ts), all spec-covered):**
1. NoSQL-operator sanitizer — strips `$`-prefixed/dotted keys from body & query globally (covers non-DTO surfaces the whitelist pipe misses).
2. Prototype-pollution guard — `__proto__`/`constructor`/`prototype` keys removed from all parsed input.
3. HTTP Parameter Pollution (HPP) collapse — duplicated query params reduced to the first value.
4. Method filter — TRACE/TRACK rejected (XST).
5. **Origin-check CSRF backstop** — cross-site browser writes 403 unless from the SPA origin or the API host; server-to-server (webhooks/CLI, no Origin header) unaffected. Kill-switch `STRICT_ORIGIN_CHECK=false`.
6. Load shedding — `MAX_INFLIGHT` cap sheds with 503+Retry-After instead of drowning the event loop (0 = off).
7. Slowloris defense — `headersTimeout` 15s / `requestTimeout` 120s / `keepAliveTimeout` 5s on the HTTP server.
8. Upload rate budget — `/api/knowledge/upload` capped at 10/min/IP.
9. CORS tightening — explicit verb allowlist + cached preflights (`maxAge`).

**Headers ([security.middleware.ts](server/src/common/middleware/security.middleware.ts)):**
10. `Cache-Control: no-store` on all API JSON (per-user data never cached at intermediaries/disk).
11. `X-Permitted-Cross-Domain-Policies: none`.
12. `Vary: Origin` (CORS cache-poisoning guard).

**Auth/session lifecycle ([auth.service.ts](server/src/modules/auth/auth.service.ts), [jwt.strategy.ts](server/src/modules/auth/strategies/jwt.strategy.ts)):**
13. **Fixed a real session-revocation bug** — `logout` passed `undefined` to Mongoose, which silently dropped the update: **logout never actually invalidated the refresh token**. Now `$unset`s it properly.
14. JWT `iss`/`aud` claims — always signed; verification enforced via `JWT_STRICT_CLAIMS=true` (flip after one 7-day refresh lifetime).
15. Token-version session generations — `tv` claim checked at refresh; bumping `tokenVersion` revokes every outstanding refresh token.
16. `POST /auth/logout-all` — log out everywhere (uses 15).
17. Login timing equalization — unknown-email logins pay a dummy bcrypt compare so response timing can't enumerate accounts.
18. MFA secrets encrypted at rest — TOTP secrets stored as AES-256-GCM envelopes when `FIELD_ENCRYPTION_KEYS` is set (legacy plaintext still readable → zero-downtime rollout).

**Egress & resilience:**
19. **Secret-leak egress canary** ([secret-leak.interceptor.ts](server/src/common/interceptors/secret-leak.interceptor.ts), global) — strips `passwordHash`/`refreshTokenHash`/`mfaSecret`/`mfaRecoveryHashes`/`codeHash` from any response and logs the offending handler.
20. Circuit breaker ([circuit-breaker.ts](server/src/common/security/circuit-breaker.ts)) — per-provider breakers on Slack/Discord webhook posts; failing dependencies fail fast instead of exhausting sockets.
21. Log-injection defense — CRLF/control chars neutralized in user-controlled strings before logging ([sanitize.ts](server/src/common/security/sanitize.ts), wired into the exception filter).
22. Filename sanitization — upload filenames reduced to safe basenames (traversal segments, control chars, Windows-reserved names) before storage/logs.
23. `safeCompare` — constant-time, length-independent secret comparison utility for API keys/signatures.

**Boot & supply chain:**
24. **Secure-boot gate** ([boot-checks.ts](server/src/common/security/boot-checks.ts)) — production refuses to start with dev-fallback, short, or identical JWT secrets.
25. **Static security-regression gate** ([security-regression.spec.ts](server/src/common/security/security-regression.spec.ts)) — the test suite fails if `eval`/`new Function`/`child_process` appear in server code or unreviewed `bypassSecurityTrust`/`document.write` in client code; new uses must be consciously allowlisted in review.
26. CI security workflow ([.github/workflows/security.yml](.github/workflows/security.yml)) — gitleaks full-history secret scan + `npm audit` (prod deps, high+) + build + full server suite on every PR.
27. Gitleaks config ([.gitleaks.toml](.gitleaks.toml)) — default ruleset, RFC test-vector fixtures allowlisted.

> **Still true:** none of this makes the system "untouchable" — that claim doesn't exist in security. What it does: every request now passes ~9 hardening layers before a handler runs, every response passes an egress canary, sessions are fully revocable, secrets can't boot weak / leave in responses / land in git, and regressions in any of it break the build.

---

## 1. Executive Security Summary

**Security objective.** Protect the confidentiality, integrity, and availability of learner data, mentor/institution data, payment records, admin functions, AI context, source code, secrets, logs, and backups — while keeping the platform usable. We defend a multi-tenant SaaS: a breach of one tenant must not become a breach of all tenants.

**Risk posture.** Balanced-conservative. We accept normal product velocity but require that every **P0** control below is implemented and verified before production traffic. We are a small team, so we favor **managed services, secure defaults, and automation** over bespoke security infrastructure we cannot staff.

**Security assumptions (explicit).**
- The client (Angular SPA) is **untrusted**; every authorization and validation decision is re-made on the server.
- Any secret shipped to the browser is **public**; only publishable keys (Stripe/Razorpay public key, VAPID public key, Google client ID) may live client-side.
- Third-party providers (Atlas, Render, Vercel, Stripe, Razorpay, LLM vendors, S3) are trusted to their contracts but can fail or be breached; we minimize blast radius and data shared.
- LLM output is **untrusted input** and LLM tool-calls are privileged actions.
- Insiders (us) are not malicious but can make mistakes; controls assume human error.

**Assets protected.** User accounts & credentials, PII, learning/assessment records, payment & billing records, admin capabilities, tenant boundaries, AI prompts/outputs/context, secrets & keys, source code & CI/CD, logs, backups, and infrastructure.

**What "no obvious critical gaps" means (and does not).** It means: for every domain in Section 5, there is a *named, implemented, tested, monitored, and owned* control at the priority the risk demands, and every P0 is **Done** with evidence. It does **not** mean "unbreakable." We explicitly track residual risk (Section 4), run continuous gap analysis (Section 25), and treat security as a program, not a milestone. We never claim perfect security.

---

## 2. System Context and Trust Boundaries

```
                          ┌────────────────────────────────────────────────────┐
   Untrusted internet     │                    TRUST BOUNDARY A                 │
 ─────────────────────────┼──────────────── (edge / CDN / WAF) ─────────────────┤
                          │                                                     │
  End users (learner,     │   Vercel (Angular SPA static hosting + headers/CSP) │
  mentor, institution     │        │  HTTPS/TLS, credentials: cookies/bearer     │
  admin, platform admin)  │        ▼                                            │
                          │   ┌───────────────── TRUST BOUNDARY B ───────────┐  │
  Bots / scanners ───────►│   │   Render — NestJS API (global prefix /api)    │  │
                          │   │   • JwtAuthGuard (global, deny-by-default)    │  │
  Stripe / Razorpay ─────►│   │   • PermissionsGuard + TenantService (RBAC)   │  │
   (webhooks, HMAC)       │   │   • ValidationPipe (whitelist)                │  │
                          │   │   • Rate limiting + security headers          │  │
  LLM providers ◄────────►│   │   • Socket.IO gateway (auth on connect)       │  │
   (Anthropic/OpenAI/…)   │   └───┬───────────┬───────────┬──────────┬────────┘  │
                          │       │           │           │          │           │
                          │       ▼           ▼           ▼          ▼           │
                          │   MongoDB     Redis/BullMQ   AWS S3    Mailer/       │
                          │   Atlas       (jobs/queue)  (uploads)  web-push      │
                          │   (private)   (private)     (private)                │
                          └────────────────── TRUST BOUNDARY C (data tier) ──────┘

   CI/CD: GitHub → GitHub Actions → build → deploy hook (Render) / Vercel
   Secrets: Render env (generated JWT secrets) · Vercel env · GitHub Actions secrets
```

**Actors / roles.** Anonymous visitor, learner (student), mentor, institution/org admin (tenant-scoped), platform admin/founder (global), service accounts (CI, webhooks, queue workers).

**Trust boundaries.**
- **A — Browser ↔ Edge:** everything from the browser is untrusted. Enforced by TLS, CORS allowlist (`CLIENT_ORIGIN`), CSP (Vercel), and server-side re-validation.
- **B — Edge ↔ API:** authentication (JWT) and authorization (RBAC + tenancy) enforced here. This is the primary control plane.
- **C — API ↔ Data tier:** Mongo/Redis/S3 are **private**, never internet-exposed; reached only by the API/workers with least-privilege credentials.

**Components in scope.** SPA clients, REST API, Socket.IO realtime, MongoDB, Redis/BullMQ workers, S3 storage, mailer, web-push, payment integrations, LLM providers, admin surfaces, CI/CD, secret stores, logging pipeline, and AI/RAG components.

---

## 3. Asset Inventory and Data Classification

**Sensitivity scale:** **P (Public)** → **I (Internal)** → **C (Confidential)** → **R (Restricted / regulated / secret)**.

### 3.1 Data assets

| Asset | Data type | Sensitivity | Owner | Storage | Access rule | Encryption | Retention | Logging |
|---|---|---|---|---|---|---|---|---|
| Password hashes | bcrypt hash | **R** | Auth | Mongo `users` | Never returned by API; server-only | At rest (Atlas) | Life of account | Access to auth flows only |
| Refresh token hashes | bcrypt hash of JWT | **R** | Auth | Mongo `users.refreshTokenHash` | Server-only; rotated on use | At rest | Until logout/rotation | Rotation events |
| JWT signing secrets | secret | **R** | Platform | Render env (generated) | Runtime only; no code, no logs | N/A (secret) | Until rotation | Access = secret access log |
| User PII (name, email, profile) | PII | **C** | Product | Mongo | Owner + authorized org admins | At rest + in transit | Account life + policy | Access to sensitive reads |
| Learning/assessment records | behavioral | **C** | Product | Mongo | Owner + tenant staff (RBAC) | At rest + in transit | Per retention policy | Reads by staff logged |
| Payment/billing records | financial | **R** | Billing | Mongo + Stripe/Razorpay | Owner + billing role; **no PAN stored** | At rest + in transit | Legal/tax retention | All access logged |
| Uploaded files/media | user content | **C** | Product | S3 (private bucket) | Owner + signed URL; scanned | At rest (SSE) + in transit | Per policy + quarantine | Upload/download logged |
| AI prompts / outputs / RAG context | user-derived | **C** | AI | Mongo/logs (redacted) | Tenant-scoped; redacted at rest | At rest + in transit | Short (see §19) | Redacted audit |
| Audit logs | security events | **C** | Security | Mongo `audit-log` | Admin read-only; append-only intent | At rest | ≥ 1 year | Meta-logged |
| Backups | full data copy | **R** | Platform | Atlas backups / snapshots | Break-glass only | At rest, encrypted | Per policy | Access logged |
| Source code | IP | **I/C** | Eng | GitHub (private) | Team + CI; branch-protected | In transit | Indefinite | Repo audit log |
| Third-party API keys | secret | **R** | Platform | Render/Vercel/GH secrets | Runtime/CI only | N/A | Until rotation | Secret access log |

### 3.2 System/infra assets

| Asset | Sensitivity | Owner | Location | Access rule |
|---|---|---|---|---|
| MongoDB Atlas cluster | **R** | Platform | Atlas (private, IP-allowlisted) | API service account only |
| Redis / BullMQ | **C** | Platform | Private network | API/workers only |
| S3 bucket | **C** | Platform | AWS (private) | IAM role, no public ACL |
| Render service | **C** | Platform | Render | Team SSO + MFA |
| Vercel project | **I** | Platform | Vercel | Team SSO + MFA |
| CI/CD (GitHub Actions) | **C** | Eng | GitHub | Least-privilege tokens |

---

## 4. Threat Model (defensive)

Method: STRIDE-informed, mapped to OWASP Top 10:2025. **Likelihood/Impact:** Low / Med / High. Each threat lists Prevent → Detect → Respond → Recover → Test → Residual risk. Testing is **defensive verification on our own systems only** — no attack instructions.

### 4.1 Account takeover (ATO) — *A07*
- **What can go wrong:** Attacker gains access to a legitimate account via reused passwords, weak reset, or session theft.
- **Impact:** High · **Likelihood:** Med.
- **Prevent:** bcrypt hashing (implemented), MFA/TOTP for admin & opt-in for users (P0/P1), login throttling (implemented: 20/min on auth routes), breached-password check, OTP-verified email, refresh-token rotation with hashed storage (implemented).
- **Detect:** Failed-login spikes, impossible-travel/new-device alerts, refresh-reuse detection.
- **Respond:** Force logout (invalidate refresh hash), lock account, notify user, require reset.
- **Recover:** Verified account recovery, session revocation, audit review.
- **Test:** Unit tests for lockout thresholds; verify reset tokens are single-use & expiring; verify a rotated refresh token is rejected on reuse.
- **Residual risk:** Med-Low — SIM-swap/social engineering on recovery remains; mitigated by recovery friction.

### 4.2 Broken access control / IDOR — *A01*
- **What can go wrong:** A user reads/edits another user's or tenant's object by changing an ID.
- **Impact:** High · **Likelihood:** High (most common class).
- **Prevent:** Deny-by-default global `JwtAuthGuard`; `PermissionsGuard` + `TenantService.resolve()` on every protected route; **object-ownership checks in every service** (query always scoped by `ownerId`/`orgId`, never by client-supplied ID alone); validate ObjectId format.
- **Detect:** Log & alert on authorization failures (403 rate per user), cross-tenant query anomalies.
- **Respond:** Block principal, review audit trail, patch the specific handler.
- **Recover:** Notify affected tenants if data was exposed; rotate anything leaked.
- **Test:** Integration tests that assert user A **cannot** read/modify user B's or tenant B's resources (pass = 403/404, never 200 with data). This is the single highest-value test suite — see §23.
- **Residual risk:** Med — new endpoints can regress; mitigated by required test template per endpoint.

### 4.3 Injection (NoSQL / command / template) — *A05*
- **What can go wrong:** Malicious input alters a Mongo query or shell/eval.
- **Impact:** High · **Likelihood:** Med.
- **Prevent:** Mongoose parameterized queries (no string-built queries); reject query-operator objects in user input (`$`/`.` keys); `ValidationPipe` whitelist strips unknown fields; never pass user input to `child_process`/`eval`.
- **Detect:** Validation-rejection metrics; error-rate anomalies.
- **Respond:** Patch handler, add schema constraint.
- **Test:** Unit tests feeding operator-shaped input (e.g. objects where strings are expected) and asserting rejection/typed error, not query execution.
- **Residual risk:** Low.

### 4.4 XSS — *A05*
- **What can go wrong:** Injected script executes in a victim's browser.
- **Impact:** High · **Likelihood:** Med.
- **Prevent:** Angular's contextual auto-escaping (default); avoid `bypassSecurityTrust*`; strict **CSP** (`script-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'` — implemented on Vercel); sanitize any user-authored HTML server-side; consider Trusted Types.
- **Detect:** CSP violation reports (`report-to`), anomaly in inline-script attempts.
- **Respond:** Patch sink, tighten CSP.
- **Test:** Grep/lint for `innerHTML`/`bypassSecurityTrust`; unit test that untrusted strings render inert.
- **Residual risk:** Low-Med (rich content areas).

### 4.5 CSRF — *A01*
- **What can go wrong:** Authenticated state change triggered from a malicious site.
- **Impact:** Med · **Likelihood:** Low-Med.
- **Prevent:** Prefer **bearer token in `Authorization` header** (not ambient cookies) for state-changing APIs; if cookies are used, set `SameSite=Strict/Lax`, `Secure`, `HttpOnly` and add anti-CSRF tokens; strict CORS allowlist (implemented); `form-action 'self'` (CSP).
- **Detect:** Origin/Referer mismatch logging.
- **Test:** Verify cross-origin state-changing requests are rejected; verify CORS rejects non-allowlisted origins.
- **Residual risk:** Low.

### 4.6 SSRF — *A01 (2025)*
- **What can go wrong:** Server is coaxed into requesting internal/metadata URLs (e.g., via a user-supplied webhook/RAG/image URL).
- **Impact:** High · **Likelihood:** Low-Med.
- **Prevent:** Allowlist outbound hosts for any server-side fetch (RAG ingestion, webhook callbacks, avatar-by-URL); block private/link-local ranges & cloud metadata IPs; resolve-then-pin DNS; no redirects to internal ranges; egress firewall.
- **Detect:** Alert on outbound requests to private ranges.
- **Test:** Unit test URL validator rejects `169.254.169.254`, `localhost`, RFC1918, and `file://`.
- **Residual risk:** Med — new outbound features must reuse the validator.

### 4.7 File-upload abuse — *A05/A08*
- **What can go wrong:** Malicious file, oversized upload, content-type spoofing, path traversal.
- **Impact:** High · **Likelihood:** Med.
- **Prevent:** Size limits, MIME + magic-byte validation, extension allowlist, random storage keys (no user path), **private** S3 bucket, signed URLs, malware scan before "available", `Content-Disposition: attachment` + `nosniff`. See §18.
- **Detect:** Scanner verdicts, upload-rate anomalies.
- **Respond:** Quarantine, delete, notify.
- **Test:** Verify oversized/disallowed types rejected; verify unscanned files are not downloadable.
- **Residual risk:** Med until malware scanning is live (currently a gap — P0).

### 4.8 API abuse / bots / brute force / DoS — *A07/A02*
- **Impact:** Med-High · **Likelihood:** High.
- **Prevent:** Rate limiting (implemented in-memory: 300/min global, 20/min auth, 10/min error-ingest), request size caps, pagination caps, CAPTCHA on abuse signals, WAF/DDoS at edge. **Gap:** in-memory limiter is per-instance → move to **Redis-backed** limiting when horizontally scaled (P1).
- **Detect:** 429 rates, per-IP/per-user spikes.
- **Test:** Verify limiter returns 429 past threshold and sets `Retry-After`.
- **Residual risk:** Med (distributed limiting pending scale-out).

### 4.9 Session hijacking — *A07*
- **Prevent:** Short access-token TTL (15m, implemented), refresh rotation + hashed storage (implemented), server-side session invalidation, TLS + HSTS (implemented).
- **Detect:** Refresh-reuse, concurrent-geo anomalies.
- **Test:** Verify old access token expires; verify logout invalidates refresh.
- **Residual risk:** Low.

### 4.10 Data leakage — *A04/A08*
- **Prevent:** Encryption in transit/at rest, field-level protection for R data, least-privilege reads, response DTOs that never serialize secrets, redaction in logs/AI.
- **Detect:** Sensitive-read audit, DLP patterns in logs.
- **Test:** Assert API responses never include hashes/secrets; assert logs are redacted.
- **Residual risk:** Med.

### 4.11 Insider misuse — *CIS 6*
- **Prevent:** Least privilege, separation of duties, admin approval workflows, break-glass, immutable audit.
- **Detect:** Admin-action audit + anomaly alerts, access reviews.
- **Test:** Verify admin actions are logged with actor + justification; verify quarterly access review evidence.
- **Residual risk:** Med.

### 4.12 Tenant isolation failure — *A01*
- **Prevent:** `orgId` scoping enforced in `TenantService` + every query; org context resolved server-side from membership, not from a client header alone (header only selects among memberships the user actually has).
- **Detect:** Cross-tenant access alerts.
- **Test:** Integration tests that a member of org A cannot read org B (highest priority for SaaS).
- **Residual risk:** Med — enforce via shared repository/query helper.

### 4.13 Supply-chain compromise — *A03 (2025)*
- **Prevent:** Lockfiles (committed), dependency & secret scanning, pinned base images, minimal deps, SBOM, provenance (SLSA), Dependabot/Renovate with review.
- **Detect:** Scanner alerts, unexpected dependency diffs.
- **Test:** CI fails on high-severity advisories or unreviewed lockfile changes.
- **Residual risk:** Med — inherent to the ecosystem.

### 4.14 Cloud misconfiguration — *A02 (2025)*
- **Prevent:** IaC review, private data tier, no public buckets, least-privilege IAM, secure defaults, config validation at boot (Joi, implemented).
- **Detect:** Cloud posture checks, audit logs.
- **Test:** Verify buckets are private; verify DB not internet-reachable.
- **Residual risk:** Med.

### 4.15 CI/CD compromise — *A03/A08*
- **Prevent:** Branch protection, required review, least-privilege CI tokens (OIDC over long-lived keys), deploy approvals, no secrets in logs.
- **Detect:** Workflow change alerts, deploy audit.
- **Test:** Verify a direct push to `main` is blocked; verify CI cannot read prod secrets it doesn't need.
- **Residual risk:** Med.

### 4.16 Secrets exposure — *A04*
- **Prevent:** No secrets in code (scanning), env/secret manager, rotation, generated JWT secrets (implemented via Render `generateValue`).
- **Detect:** Secret scanning (push + historical), anomalous secret access.
- **Respond:** Revoke + rotate immediately (see §12 runbook).
- **Test:** Secret scanner runs in CI and blocks on hit.
- **Residual risk:** Med.

### 4.17 Insecure logging — *A09 (2025)*
- **Prevent:** Redact PII/secrets, structured logs, no full tokens/PAN, privacy-safe fields.
- **Detect:** Periodic log sampling for leakage.
- **Test:** Assert redaction middleware strips known sensitive keys.
- **Residual risk:** Low-Med.

### 4.18 Backup compromise
- **Prevent:** Encrypted, access-controlled, ideally immutable backups; break-glass access.
- **Detect:** Backup job success/failure alerts, restore drills.
- **Test:** Scheduled restore test to isolated env.
- **Residual risk:** Med.

### 4.19 AI prompt injection & data leakage — *A05 / SSDF 800-218A*
- **What can go wrong:** Untrusted content (user text, RAG documents, tool output) instructs the model to exfiltrate data, ignore policy, or misuse tools.
- **Impact:** Med-High · **Likelihood:** Med-High.
- **Prevent:** Treat all model input as untrusted; **tool permission boundaries** (model cannot call privileged actions without server-side authz + user context); retrieval filtered to the caller's tenant/authz; redact sensitive fields before sending to providers; output validation/schema enforcement (already centralized in `AiService`); human approval for high-risk actions; per-user AI rate limit (`AI_USER_RATE_PER_MIN`, implemented).
- **Detect:** AI audit log, anomaly on tool-call volume, refusal/repair rates.
- **Respond:** Disable offending tool/flow, fall back to safe mock behavior.
- **Test:** Verify RAG never returns another tenant's docs; verify a tool-call still passes the same server-side authz as the REST path; verify redaction before egress.
- **Residual risk:** Med — prompt injection is not fully solvable; defense-in-depth reduces impact.

### 4.20 Mishandling of exceptional conditions — *A10 (2025)*
- **What can go wrong:** Errors fail *open*, leak stack traces, or leave partial state.
- **Prevent:** Global exception filter (implemented `all-exceptions.filter.ts`) returns safe typed errors; deny-by-default on error; transactions/idempotency for multi-step ops; no internal details to clients.
- **Detect:** Error-rate/5xx alerts.
- **Test:** Assert error responses never include stack traces or internal messages in production.
- **Residual risk:** Low-Med.

---

## 5. Security Control Matrix

Status legend: **Done** / **In progress** / **Not started**. Priority: **P0** (before production) / **P1** (strongly recommended) / **P2** (advanced hardening).

| ID | Domain | Control | Risk reduced | Required implementation | Recommended tools | Test method | Monitoring signal | Owner | Prio | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| AC-01 | AuthZ | Global deny-by-default auth guard | Broken access control | `JwtAuthGuard` global + `@Public()` opt-out | NestJS guards | Unauth request → 401 | 401/403 rates | Auth | P0 | Done |
| AC-02 | AuthZ | RBAC + tenancy on every route | IDOR, tenant leak | `PermissionsGuard` + `TenantService` | NestJS | Cross-tenant test → 403 | 403 by user/tenant | Auth | P0 | Done |
| AC-03 | AuthZ | Object-ownership checks in services | IDOR | Scope every query by owner/org | Code review + tests | A-can't-read-B tests | Cross-tenant alerts | Backend | P0 | In progress |
| AU-01 | AuthN | bcrypt password hashing | Credential theft | `bcryptjs`, salt rounds ≥ 12 | bcryptjs / argon2 | Hash format assertion | — | Auth | P0 | Done |
| AU-02 | AuthN | JWT access + refresh rotation | Session hijack | Short access TTL, hashed refresh, rotate on use | @nestjs/jwt | Reuse → reject | Refresh-reuse | Auth | P0 | Done |
| AU-03 | AuthN | MFA/TOTP for admin | ATO | TOTP enrollment + login challenge + recovery codes + `MfaEnforcementGuard` on admin routes | vendored RFC 6238 TOTP | Enrolled account challenged at login; admin routes 403 without MFA when flag on (spec-verified) | Admin login anomalies | Auth | P0 | Done (enable `REQUIRE_ADMIN_MFA` after admin enrollment) |
| AU-04 | AuthN | Login throttling / brute-force | Brute force | Per-IP + per-account limits | Redis limiter + `login-throttle.ts` | 429 past threshold; account locks after 5 fails | Failed-login spikes | Auth | P0 | Done |
| AU-05 | AuthN | Breached-password check | Credential stuffing | k-anonymity range check in `register()` (`breached-password.ts`) | HIBP range API | Breached pw rejected; fails open offline (spec-verified) | — | Auth | P1 | Done (enable `PASSWORD_BREACH_CHECK`) |
| AU-06 | AuthN | Passkeys / WebAuthn | Phishing-resistant ATO | Optional passwordless | @simplewebauthn | Enroll+login | — | Auth | P2 | Not started |
| API-01 | API | Request validation (whitelist) | Injection, mass-assign | Global `ValidationPipe` whitelist+forbid | class-validator/Zod | Unknown field stripped | Validation rejects | Backend | P0 | Done |
| API-02 | API | Rate limiting | API abuse/DoS | Global + auth + error budgets; Redis-backed store for multi-instance | `rate-limit.middleware.ts` (memory/Redis) | 429 test; cluster-wide counting (spec-verified) | 429 rate | Backend | P0 | Done (enable `RATE_LIMIT_REDIS` when scaling out) |
| API-03 | API | Request size / pagination caps | DoS, scraping | Body limit + max page size | Nest config | Oversized → 413 | Payload sizes | Backend | P1 | In progress |
| API-04 | API | Safe error handling | Info leak (A10) | Global exception filter, typed errors | Nest filter | No stack in prod | 5xx rate | Backend | P0 | Done |
| API-05 | API | CORS allowlist | CSRF/data theft | Origin = `CLIENT_ORIGIN`, credentials | Nest CORS | Bad origin blocked | CORS rejects | Backend | P0 | Done |
| API-06 | API | Webhook HMAC verification | Forged webhooks | rawBody + provider signature check | Stripe/Razorpay SDK | Bad sig → 400 | Webhook failures | Billing | P0 | Done |
| DP-01 | Data | TLS in transit | Eavesdrop | HTTPS everywhere + HSTS | Platform TLS | HSTS header present | TLS errors | Platform | P0 | Done |
| DP-02 | Data | Encryption at rest | Data theft | Atlas + S3 SSE encryption | Atlas/AWS | Config check | — | Platform | P0 | Done (provider) |
| DP-03 | Data | Field-level encryption (R data) | Data leak | AES-256-GCM envelopes with versioned key ring (`field-encryption.ts`) | node:crypto + KMS-held keys | Tamper fails closed; rotation round-trip (spec-verified) | — | Backend | P1 | In progress (utility shipped; apply to R fields + migration) |
| DP-04 | Data | Log/AI redaction | Data leakage | Strip PII/secrets pre-log/pre-egress | Custom redactor | Redaction test | Log sampling | Backend | P0 | In progress |
| FE-01 | Frontend | Security headers + CSP | XSS, clickjacking | Headers (Nest+Vercel), strict CSP (Vercel edge + JSON-API `default-src 'none'`) | Vercel headers + `security.middleware.ts` | Header scan | CSP reports | Frontend | P0 | Done |
| FE-02 | Frontend | Safe rendering (no bypass) | XSS | Angular escaping, lint bans | ESLint rule | Grep/lint clean | — | Frontend | P0 | In progress |
| FU-01 | Upload | Type/size/scan/private bucket | Malware, abuse | Allowlist + magic bytes (`file-signature.ts`) + scan + signed URL | ClamAV/S3 scan | Bad file rejected (magic-byte test green) | Scan verdicts | Backend | P0 | In progress (magic-byte check shipped; AV scan pending) |
| SM-01 | Secrets | No secrets in code | Secrets exposure | Scanning + env/secret mgr | gitleaks/GH | Scanner clean | Secret scan hits | Platform | P0 | In progress |
| SM-02 | Secrets | Rotation + revocation runbook | Key compromise | Documented rotation, generated JWT secrets | Render/Vault | Drill | Secret access | Platform | P1 | In progress |
| INF-01 | Infra | Private data tier | Exposure | Atlas IP allowlist, no public buckets | Atlas/AWS | Reachability check | Posture scan | Platform | P0 | Done |
| INF-02 | Infra | IAM least privilege | Blast radius | Scoped S3/IAM roles | AWS IAM | Policy review | — | Platform | P1 | In progress |
| CI-01 | CI/CD | Branch protection + review | CI compromise | Protected `main`, required PR review | GitHub | Direct push blocked | Repo audit | Eng | P0 | In progress |
| CI-02 | CI/CD | Dependency + secret + SAST scans | Supply chain | Dependabot + gitleaks + CodeQL in CI | GitHub Advanced Security | CI gate | Scan alerts | Eng | P0 | In progress |
| CI-03 | CI/CD | SBOM + provenance | Supply chain | Generate SBOM, SLSA provenance | Syft/cosign | Artifact present | — | Eng | P2 | Not started |
| LOG-01 | Detect | Security event logging + audit | Undetected breach (A09) | Auth/authz/admin events → `audit-log` | Mongo + log sink | Event present | Alert pipeline | Security | P0 | Done (audit) / In progress (alerts) |
| LOG-02 | Detect | Alerting rules | Slow response | Alerts on 5xx, 401/403 spikes, webhook fail | Log platform | Alert fires | Alert health | Security | P0 | Not started |
| IR-01 | Respond | Incident runbook | Slow/ineffective response | Sev levels + runbook (§21) | Docs | Tabletop drill | — | Security | P0 | In progress |
| BK-01 | Recover | Encrypted backups + restore test | Data loss/ransomware | Atlas backups, tested restore | Atlas/snapshots | Restore drill | Backup status | Platform | P0 | In progress |
| AI-01 | AI | Tool authz + tenant-scoped RAG | AI data leak/injection | Server-side authz on tool-calls; tenant filter | AiService | Cross-tenant RAG test | AI audit | AI | P0 | In progress |
| PRV-01 | Privacy | Export + delete (DSR) | Compliance | `privacy` + `data-governance` modules | In-app | DSR job runs | DSR queue | Product | P1 | Done (modules) |

---

## 6. Authentication Security

**Current state (implemented):** bcrypt password hashing (`SALT_ROUNDS`), email-OTP signup verification (`OtpService` with cooldown), Google OAuth (`google-auth.service.ts`), JWT access (15m) + refresh (7d), **refresh-token rotation with the refresh token stored only as a bcrypt hash** and re-verified on each refresh, tight per-IP throttling on `/auth/*` (20/min).

**Target controls:**
- **Password storage:** Keep bcrypt at **cost ≥ 12** (verify current `SALT_ROUNDS`); consider migrating to **Argon2id** (`memory ≥ 19 MB, iterations ≥ 2, parallelism 1`, per OWASP) with transparent rehash-on-login. Never store plaintext or reversible passwords.
- **Passkeys / WebAuthn (P2):** offer phishing-resistant passwordless login for high-value accounts.
- **MFA / TOTP / email OTP (P0 for admin):** TOTP (RFC 6238) enrollment; **mandatory** for admin/founder roles; optional for users. Email OTP already exists for signup verification — reuse for step-up on sensitive actions. Rate-limit and lock OTP after N failures.
- **Login throttling & brute-force:** per-IP (done) **and per-account** lockout with exponential backoff; generic error ("invalid credentials") to avoid user enumeration.
- **Credential-stuffing defense:** breached-password check at set/reset (HIBP k-anonymity range API — never send the full password/hash), plus device/anomaly signals.
- **Secure password reset:** single-use, short-TTL, high-entropy token; sent to verified email; invalidate all sessions on reset; do not reveal whether an email exists.
- **Email/phone verification:** required before privileged actions; OTP with cooldown (done for email).
- **Refresh-token rotation (done):** on refresh, issue new pair and store new hash; **detect reuse** of a rotated token → treat as theft, revoke the family, force re-auth.
- **Session invalidation & secure logout:** clear the stored refresh hash on logout; provide "log out all devices."
- **Device / session management (P1):** track active sessions (device, IP, last-seen); allow users to revoke.
- **Suspicious-login detection (P1):** new device / impossible travel → email alert + optional step-up.
- **Account-recovery abuse prevention:** rate-limit recovery, require verified channel, add friction/step-up; log all recovery events.

**Pass/fail examples:** rotated refresh token reused → **reject + revoke family** (pass). Reset token reused → **rejected** (pass). Admin login without TOTP → **blocked** (pass).

---

## 7. Authorization Security

**Current state:** Global `JwtAuthGuard` (deny-by-default), `PermissionsGuard` resolving effective permissions via `TenantService.resolve(user, orgId)`, `@Permissions()`/`@Roles()` decorators, org context attached to the request and enforced server-side. Multi-tenant by design.

**Target controls:**
- **RBAC:** roles → capabilities; enforce with `@Permissions(...)`. Keep the permission catalog in `common/enums`.
- **ABAC where needed:** attribute checks (owner, org, plan/entitlement) layered on RBAC for fine-grained rules (e.g., "mentor can grade only assigned cohort").
- **Object-ownership checks (P0):** every service method that reads/writes a document must scope the query by `ownerId`/`orgId` from the *authenticated context*, never trust a client-supplied owner/org id. Provide a shared repository helper so this is the default, not per-developer discipline.
- **Tenant isolation:** the `orgId` header only *selects* among orgs the user is actually a member of; membership and permissions are resolved server-side. Never derive authority from the header value alone.
- **Admin permission boundaries:** platform-admin vs. org-admin capabilities are distinct; org admins are always tenant-scoped.
- **Backend-only enforcement:** the SPA may hide UI, but every decision is re-made server-side.
- **Deny-by-default & least privilege:** no route is public unless `@Public()`; grant the minimum capability set.
- **JIT admin access & break-glass (P1/P2):** elevate to sensitive admin capability for a bounded time with reason; a separate emergency break-glass account with heavy logging + post-use review.
- **Approval workflows (P1):** dangerous actions (bulk delete, data export, refunds, role grants) require a second approver.
- **Tests (P0):** authorization unit + integration tests are mandatory per endpoint (see §23).

---

## 8. API Security

**Current state:** global `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })`, CORS allowlist with credentials, per-IP rate limiting (global/auth/error tiers), safe global exception filter, request-id correlation, webhook HMAC via `rawBody: true`, Swagger gated to non-prod.

**Target controls:**
- **Strict request/schema validation:** DTOs with class-validator; Zod for complex/AI payloads; reject unknown fields (done). Validate all path/query/body params, including ObjectId format.
- **Rate limits (multi-dimensional):** per-IP (done) + **per-user** + per-endpoint; move to **Redis-backed** limiting for horizontal scale (the current limiter is per-instance in-memory — explicit gap).
- **API key security:** for programmatic access, issue hashed keys, scope them, support rotation & revocation, and rate-limit per key.
- **JWT verification:** verify signature, `exp`, issuer/audience; reject `alg: none`; separate access/refresh secrets (done).
- **Replay protection:** for sensitive/idempotent operations use **idempotency keys**; webhooks verify signature + timestamp window.
- **Request size / pagination caps (P1):** body size limit (e.g., 1–2 MB except uploads), max page size, default+max `limit` on list endpoints.
- **GraphQL (if introduced):** depth + complexity limits, disable introspection in prod. (Currently REST — track as future.)
- **CORS/CSRF:** allowlist origin (done); prefer bearer auth over cookies; if cookies, add SameSite + CSRF token.
- **Safe errors:** typed error envelope, no internals in prod (done).
- **API versioning:** version the prefix; never silently break auth semantics across versions.
- **Abuse monitoring:** track 401/403/429 and error rates per principal; alert on spikes.

---

## 9. Frontend Security

**Current state (Vercel `vercel.json`):** strict **CSP** (`default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests`), plus `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, HSTS, `Permissions-Policy`, COOP. Angular 20 provides contextual auto-escaping.

**Target controls:**
- **XSS prevention / safe rendering:** rely on Angular's default escaping; **ban `bypassSecurityTrust*` and raw `innerHTML`** via ESLint; sanitize any user-authored HTML. Consider **Trusted Types** (`require-trusted-types-for 'script'`) to harden DOM sinks (P2).
- **Output encoding:** contextual (HTML/attr/URL/JS) — Angular handles when bindings are used correctly; avoid manual DOM string building.
- **CSP:** keep strict; add `report-to`/`report-uri` to collect violations. Avoid `'unsafe-inline'` for scripts (currently only styles allow inline — acceptable, revisit with nonces/hashes P2).
- **Secure cookie usage:** any cookie must be `Secure`, `HttpOnly`, `SameSite`.
- **Token storage guidance:** avoid `localStorage` for long-lived refresh tokens where feasible; prefer in-memory access token + `HttpOnly` refresh cookie, or accept the documented trade-off. Never store secrets/PII in the browser beyond need.
- **Clickjacking:** `frame-ancestors 'none'` + `X-Frame-Options: DENY` (done).
- **Dependency security:** SCA on the Angular app; keep `sw.js`/`boot.js` reviewed; audit third-party scripts (CSP blocks non-self by default).
- **Secure routing / auth state:** route guards mirror server permissions for UX only; never rely on them for security. Clear auth state fully on logout.
- **Frontend error leakage:** client-error ingestion endpoint is rate-limited (done); don't ship verbose stack traces or internal URLs to users.

---

## 10. Backend Security

**Current state:** NestJS with global validation, guards, exception filter, request-id, security headers/rate-limit middleware, config validated at boot.

**Target controls:**
- **Input validation:** every controller input via DTO/schema; reject Mongo operator-shaped input; validate IDs.
- **Output encoding / DTOs:** response DTOs that never serialize `passwordHash`, `refreshTokenHash`, or secrets (use explicit select/projection or `@Exclude`).
- **Secure error handling:** global filter returns typed, non-leaky errors; fail **closed** on ambiguity (A10).
- **Safe deserialization:** avoid `eval`/`Function`/unsafe YAML; parse JSON with size limits.
- **SSRF protection:** central outbound-URL allowlist/validator for RAG ingestion, webhook callbacks, avatar-by-URL; block private ranges + metadata IPs; no internal redirects. (See §4.6.)
- **Path traversal:** never build filesystem/S3 paths from user input; use random keys; normalize + reject `..`.
- **Command injection:** no user input to `child_process`; if unavoidable, use argument arrays + strict allowlist.
- **Server-side authz:** re-check on every handler (guards) and in service methods (ownership).
- **Background job security (BullMQ):** validate job payloads, authorize the enqueuing principal, cap concurrency/retries, isolate worker credentials, never trust job data as pre-validated.
- **Webhook validation:** HMAC signature (done for payments) + timestamp/replay window + idempotency.
- **Secure file processing:** see §18; sanitize/transcode media in isolation.
- **Third-party integrations:** least-privilege keys, timeouts, circuit-breakers, validate all responses, never log secrets.
- **Server config hardening:** `NODE_ENV=production`, disable stack traces to clients, remove `X-Powered-By` (done), pin runtime versions.

---

## 11. Database Security

**Current state:** MongoDB Atlas (managed, encrypted at rest, private/IP-allowlisted), Mongoose parameterized queries, replica set (transactions/change-streams), config-validated `MONGO_URI`.

**Target controls:**
- **Least-privilege DB users:** the app uses a scoped role (read/write to its DB only) — **not** an Atlas admin. Separate read-only user for analytics/reporting.
- **Row/document-level scoping:** enforce tenant/owner scoping in queries (application-level "RLS"); shared query helper to avoid omissions.
- **Tenant isolation:** every collection with tenant data carries `orgId`; indexes include it; queries always filter by it.
- **Encryption at rest:** Atlas-managed (done); add **field-level encryption (CSFLE)** for R fields (P1).
- **Query parameterization:** Mongoose only; never build queries from concatenated strings; reject `$`/`.`-prefixed keys in user objects.
- **Migration security:** migrations reviewed in PR, run with a migration-scoped credential, reversible where possible, tested on staging first.
- **Backup encryption:** Atlas backups encrypted; access break-glass only (see §22).
- **Audit logs:** DB-level audit (Atlas) for admin ops; app-level `audit-log` for data access.
- **Data masking:** mask/limit PII in non-prod and in support tooling.
- **Secure deletion:** hard-delete on DSR (see §20) plus purge from backups per retention window.
- **PII minimization:** store only what's needed; avoid duplicating PII across collections.
- **Prod/dev separation:** never restore prod data into dev unmasked; separate clusters/credentials.

---

## 12. Secrets and Key Management

**Current state:** JWT secrets **generated** by Render (`generateValue: true`), all secrets in env (Render/Vercel/GitHub), config validated at boot, `.env` files git-ignored, mock fallbacks when keys unset (no hard failure in dev).

**Target controls:**
- **No hardcoded secrets:** enforced by secret scanning (gitleaks/GitHub) on push **and** history; CI blocks on hit.
- **Secret manager:** env vars via platform stores today; graduate to a dedicated manager (Vault / AWS Secrets Manager / Doppler) as the team grows (P1).
- **Environment separation:** distinct secrets per env (dev/staging/prod); prod secrets never on developer laptops.
- **Key rotation:** documented rotation for JWT secrets, DB creds, provider keys, VAPID, webhook secrets. Rotating `JWT_SECRET` invalidates sessions by design — schedule + communicate.
- **KMS/HSM (P2):** back field-level encryption keys with a KMS.
- **Secret access logging:** platform audit for who read/changed secrets.
- **CI/CD secret protection:** least-privilege, masked in logs, prefer short-lived OIDC tokens over long-lived keys.
- **Emergency revocation runbook:** on suspected exposure → (1) revoke at provider, (2) rotate, (3) redeploy, (4) invalidate sessions if JWT/DB, (5) review access logs, (6) file incident. Target < 1 hour for P0 secrets.
- **Developer local secrets:** `.env.local` only, never committed; sample `.env.example` with placeholders.

---

## 13. Infrastructure and Cloud Security

**Current state:** Render (API), Vercel (web), Atlas (DB, private + IP allowlist), Docker prod compose (private Mongo replica set + Redis), TLS at edge, HSTS, config validated at boot.

**Target controls:**
- **Zero-trust principles:** authenticate/authorize every request; no implicit network trust; the data tier is private and only reachable by the API/workers.
- **Private databases (done):** Mongo/Redis never internet-exposed; Atlas IP allowlist / VPC peering.
- **Network segmentation:** separate app tier and data tier; egress controls for outbound (SSRF/DLP).
- **Firewall / security groups:** default-deny inbound except 443; scope by source.
- **TLS everywhere (done at edge):** TLS 1.2+; HSTS; consider TLS to the DB (Atlas enforces).
- **mTLS for internal services (P2):** when internal service-to-service calls exist.
- **WAF + DDoS (P1):** enable edge WAF/DDoS (Cloudflare/Vercel/Render features) for L7 protection and bot rules.
- **Container hardening:** minimal base image (node-alpine), non-root user, no build tools in runtime image, pinned digests, `HEALTHCHECK` (done), read-only FS where possible, drop capabilities.
- **Kubernetes (N/A today):** not used; if adopted → network policies, PSS/`restricted`, no privileged pods, secrets via CSI. Track as future.
- **IAM least privilege:** scoped S3/AWS roles; no wildcard `*` policies; separate keys per purpose.
- **Cloud audit logs:** enable provider audit logs (AWS CloudTrail, Atlas, Render/Vercel) and centralize.
- **Patch management:** track base-image and dependency updates; Dependabot/Renovate; scheduled review.
- **Environment isolation:** separate prod/staging projects, credentials, and data.
- **IaC scanning:** scan `docker-compose*.yml`, `render.yaml`, `vercel.json`, Dockerfiles for misconfig (Checkov/Trivy config).

---

## 14. CI/CD and Supply Chain Security

**Current state:** GitHub repo (private), lockfiles committed, Render deploy via hook (autoDeploy off, GitHub Actions triggers), Vercel build. Maps to **OWASP A03:2025** and **SLSA**.

**Target controls:**
- **Branch protection (P0):** protect `main`; require PR + at least one review; no force-push; no direct commits; require status checks green.
- **Required reviews:** security-sensitive paths (auth, billing, tenancy, AI tool-calls) may require a designated reviewer (CODEOWNERS).
- **Signed commits/tags (P2):** enable commit signing; sign release tags.
- **Dependency scanning (P0):** Dependabot/Renovate + `npm audit`/OSV in CI; block on high/critical without exception.
- **Secret scanning (P0):** gitleaks + GitHub secret scanning + push protection.
- **SAST (P0):** CodeQL (JS/TS) in CI; ESLint security rules.
- **DAST (P1):** authenticated dynamic scan against **staging** (owned env) pre-release; triage findings.
- **Container image scanning (P1):** Trivy/Grype on built images; block on high severity.
- **SBOM generation (P2):** Syft/CycloneDX per build artifact.
- **Artifact signing + provenance (P2):** cosign signatures + SLSA provenance attestation; verify at deploy.
- **Lockfiles (done):** commit `package-lock.json`; CI uses `npm ci` (done in `render.yaml`/`vercel.json`).
- **Build isolation:** ephemeral CI runners; least-privilege `GITHUB_TOKEN`; prefer OIDC to clouds over stored keys.
- **Deployment approvals (P1):** manual approval gate for prod deploys.
- **Rollback plan:** keep last-known-good image/deploy; documented one-command rollback; DB migrations reversible.

---

## 15. Logging, Monitoring, and Detection

**Current state:** `audit` module + `audit-log` schema, request-id correlation on every request, rate-limit + error middleware, global exception filter. Maps to **OWASP A09:2025**.

**Target controls:**
- **Security event logging (P0):** log authentication (login success/fail, OTP, reset), authorization failures (403), admin actions, sensitive-data reads, webhook verification results, secret access.
- **Audit trails:** append-only intent for `audit-log`; record actor, action, target, tenant, timestamp, request-id, source IP.
- **Tamper resistance (P1):** ship logs to an external sink the app can't rewrite; consider hash-chaining for critical audit.
- **Centralized logging:** aggregate API + edge + provider logs into one queryable place (e.g., managed log platform).
- **SIEM-ready format:** structured JSON with stable field names + request-id correlation.
- **Alerting rules (P0):** 5xx spike, 401/403 spike per principal, 429 surge, webhook-verification failures, new-admin-login, backup failure, scanner critical. Route to on-call.
- **Anomaly / suspicious behavior:** impossible travel, refresh-reuse, abnormal export volume, AI tool-call spikes.
- **Privacy-safe logging (P0):** redact PII/secrets/tokens/PAN; never log full request bodies for sensitive routes; log identifiers, not values.
- **Log retention:** security/audit ≥ 1 year (or per policy); operational logs shorter; document and enforce.

---

## 16. Abuse, Fraud, and Bot Protection

**Current state:** tiered per-IP rate limits (auth 20/min, error-ingest 10/min, global 300/min), email-OTP signup (raises signup cost), domain checks (`email-domains.ts`).

**Target controls:**
- **Signup abuse:** email verification (done), disposable-domain blocking, per-IP/per-device signup caps, optional invite/approval for org accounts.
- **Rate limiting:** multi-dimensional (IP + user + endpoint); Redis-backed at scale.
- **Bot detection:** behavioral signals; add a challenge only on abuse signals, not by default.
- **CAPTCHA only when needed:** trigger on failed-login bursts, mass signups — avoid friction for normal users.
- **Device fingerprinting trade-offs:** may aid fraud detection but carries privacy cost; if used, disclose in privacy policy and minimize retention.
- **Email/SMS abuse:** cooldowns on OTP/resend (done for email), per-recipient + per-IP caps, monitor bounce/complaint rates.
- **Spam prevention:** rate-limit user-generated content (community, peer-rooms), content moderation hooks, report/flag flow.
- **Payment abuse (P1):** velocity checks, use Stripe/Razorpay fraud tooling, verify webhooks (done), watch refund/chargeback patterns, idempotency on payment mutations.
- **Suspicious-activity workflows:** auto-flag → review queue → action (limit/suspend) with audit.
- **User reporting mechanisms:** in-app "report" for abusive content/users; SLA for triage.

---

## 17. Admin Panel Security

**Current state:** platform-admin vs org-admin separation via RBAC/tenancy; `admin`, `founder`, `ops` modules gated by permissions.

**Target controls:**
- **Mandatory MFA (P0):** admin/founder roles must have TOTP; no admin action without it.
- **IP allowlisting (P1, where suitable):** restrict admin surfaces to known ranges/VPN if operationally feasible.
- **Separate admin roles:** distinct capabilities (support vs. billing vs. platform); least privilege; no shared "superadmin" for daily use.
- **Dangerous-action confirmation:** explicit typed confirmation for destructive/bulk actions.
- **Approval workflows (P1):** two-person rule for bulk delete, mass export, refunds, role grants.
- **Admin session timeout:** shorter idle timeout for admin sessions than for users; step-up re-auth for sensitive actions.
- **Admin audit logs (P0):** every admin action logged with actor + target + reason; immutable sink.
- **Export restrictions:** limit/queue bulk exports; require approval + justification; watermark/track exports.
- **Data-access justification:** support access to a user's data requires a reason string, logged and reviewable.
- **Break-glass procedure:** emergency elevated account, sealed credentials, heavy logging, mandatory post-use review within 24h.

---

## 18. File Upload and Media Security

**Current state:** `STORAGE_PROVIDER` local|s3; S3 configured for private use; uploads flow through the API.

**Target controls (P0 unless noted):**
- **File size limits:** enforce max per-file and per-request size (reject 413).
- **MIME + magic-byte validation:** validate declared type **and** sniff actual bytes; reject mismatches.
- **Extension allowlist:** allow only expected types (images/docs); deny executables/scripts/HTML.
- **Malware scanning (gap → P0):** scan before a file becomes downloadable (ClamAV service or a cloud AV/DLP); block/quarantine on hit. *This is currently a gap — highest upload priority.*
- **Image/document sanitization:** strip EXIF/active content; transcode images; render documents safely; never execute uploaded content.
- **Private storage buckets (done intent):** no public-read ACLs; block public access at bucket level.
- **Signed URLs:** time-limited, least-privilege signed URLs for download; never expose raw bucket URLs.
- **Path-traversal prevention:** random storage keys; never use user-supplied filenames as paths; normalize + reject `..`.
- **Content-Disposition safety:** serve downloads as `attachment` with `X-Content-Type-Options: nosniff` to prevent sniffing/inline execution.
- **Upload rate limits:** per-user/per-IP upload caps.
- **Quarantine workflow:** unscanned/suspect files → quarantine state, not user-visible; review + release or delete.

---

## 19. AI/LLM Security (applicable)

**Current state:** multi-provider `AiService` (Anthropic/OpenAI/Gemini/Groq/Mistral/OpenRouter/DeepSeek/Ollama) with **auto-select + fallback chain**, centralized **output schema validation/repair**, per-user AI rate limit (`AI_USER_RATE_PER_MIN=20`), request timeout + max-output-token caps, **mock fallback when no keys** (safe degrade). RAG backend configurable (keyword/atlas/qdrant). Maps to **NIST SP 800-218A**.

**Target controls:**
- **Prompt-injection defense:** treat all user text, RAG documents, and tool outputs as **untrusted**; separate system instructions from user/content; do not let retrieved content silently change tool permissions; constrain the model with strict output schemas (done).
- **Tool permission boundaries (P0):** any model tool-call that performs a privileged action must pass the **same server-side authorization** as the REST path, using the caller's real identity/tenant — never the model's assertion. Enumerate allowed tools per role.
- **Retrieval filtering (P0):** RAG queries are filtered to the caller's tenant/authz **before** retrieval; a user can never retrieve another tenant's documents via AI.
- **Sensitive-data redaction:** redact secrets/PII before sending context to external providers; minimize data shared; prefer references over raw sensitive values.
- **Output validation:** schema-enforce and sanitize model output before it is rendered or acted upon (done centrally); never `eval` model output; treat generated HTML as untrusted (escape/sanitize).
- **Human approval for high-risk actions (P0):** destructive/financial/irreversible AI-suggested actions require explicit human confirmation.
- **AI audit logs:** log prompts/outputs/tool-calls (redacted) with tenant + user + request-id for abuse investigation, honoring retention limits.
- **Rate limiting (done):** per-user AI budget; add per-tenant and cost caps.
- **Abuse monitoring:** alert on tool-call spikes, jailbreak patterns, high refusal/repair rates.
- **Model fallback behavior (done):** provider fallback chain + mock fallback so failures degrade safely, never leak errors or hang.
- **Data-retention rules:** short retention for prompts/outputs; document what is stored and for how long; honor deletion (see §20).
- **Tenant isolation for AI context:** memory/RAG/context strictly partitioned by tenant.
- **Guardrails for user-generated content:** moderation on inputs/outputs where content is user-facing.
- **Provider-data terms:** confirm providers do **not** train on our data (or opt out); document per-provider data handling.

---

## 20. Privacy and Compliance Controls

**Current state:** `privacy` and `data-governance` modules (with a `data-job` schema for export/delete jobs) already exist.

**Target controls (GDPR-style, applied broadly):**
- **Data minimization:** collect only what the feature needs; avoid speculative PII collection.
- **Consent:** explicit consent for optional processing (analytics, marketing, non-essential AI); record consent + timestamp + version.
- **User data export (DSR):** self-serve export via `data-governance` job → machine-readable bundle.
- **User data deletion (DSR):** verified delete request → hard-delete + downstream purge (backups within retention window, provider deletion where applicable); confirm to user.
- **Retention policy:** per-data-type retention (see §3); automated purge jobs; document and enforce.
- **Purpose limitation:** use data only for the purpose collected; separate analytics from operational PII.
- **Privacy-safe analytics:** aggregate/pseudonymize; avoid sending PII to third-party analytics; honor Do-Not-Track/consent.
- **Breach-response readiness:** know notification obligations/timelines; pre-drafted user + regulator templates (see §21).
- **Auditability:** DSR actions and consent changes are logged.
- **Sub-processors:** maintain a list (Atlas, Render, Vercel, AWS, Stripe/Razorpay, LLM providers, email) and their data handling; surface in the privacy policy.

---

## 21. Incident Response and Recovery

**Severity levels.**
- **Sev-1 (Critical):** active breach, data exfiltration, auth bypass, ransomware, full outage. Page immediately; all-hands.
- **Sev-2 (High):** confirmed vuln with real exposure, partial outage, single-tenant data exposure. Same-day.
- **Sev-3 (Medium):** limited-impact vuln, degraded feature. Next business day.
- **Sev-4 (Low):** minor issue, no data impact. Backlog.

**Lifecycle.**
1. **Detection:** alert (§15), user report, or scanner. Any engineer can declare an incident.
2. **Triage:** assign Incident Commander (IC); set severity; open incident channel + ticket; start timeline.
3. **Containment:** stop the bleeding — revoke sessions/keys, disable the vulnerable route/feature flag, block a principal, isolate a service. **Preserve evidence before destructive cleanup.**
4. **Eradication:** remove the root cause — patch, rotate secrets, remove malicious changes.
5. **Recovery:** restore service from known-good; verify integrity; monitor closely; re-enable features gradually.
6. **Communication:** internal updates on cadence; user/regulator notification per legal duty and honesty (no over-claiming); status page for outages.
7. **Evidence preservation:** capture logs, audit trail, affected records, timeline; store securely with access control; maintain chain of custody.
8. **Postmortem (blameless):** what happened, timeline, root cause, impact, what worked, what didn't, action items with owners + dates.
9. **Lessons learned & regression tests:** add a **security regression test** that would have caught it; update runbooks and controls.

**Postmortem template:** Summary · Timeline (UTC) · Impact (users/data/tenants) · Root cause · Detection gap · Containment/eradication/recovery steps · Action items (owner, due) · Regression test added.

---

## 22. Backup and Disaster Recovery Security

**Target controls:**
- **Encrypted backups:** Atlas backups + any snapshot encrypted at rest and in transit.
- **Backup access control:** break-glass only; no standing access; every access logged.
- **Restore testing (P0):** scheduled restore drills to an isolated environment; verify integrity + app boots against restored data. A backup you haven't restored is a hope, not a backup.
- **RPO / RTO targets:** define per tier — e.g., **RPO ≤ 24h** (aim continuous/point-in-time on Atlas), **RTO ≤ 4h** for core services. Adjust to business need and document.
- **Immutable backups (P1):** object-lock/immutable snapshots to resist tampering/ransomware; retain copies the app credentials cannot delete.
- **Backup monitoring:** alert on backup job failure/missed schedule.
- **Disaster-recovery runbook:** step-by-step restore (DB, storage, secrets, redeploy), owners, contacts, and provider escalation paths.
- **Ransomware-recovery considerations:** offline/immutable copy, tested clean-restore path, isolate before restore, assume prod may be compromised.

---

## 23. Security Testing Strategy (defensive, owned systems only)

All testing targets **our own** application in dev/staging. No exploit payloads — we describe **what to test, expected safe behavior, and pass/fail criteria.**

- **Security unit tests:** password hashing (bcrypt/Argon2 format, cost), OTP single-use + cooldown, reset-token single-use + expiry, JWT verification (rejects tampered/`alg:none`/expired). **Pass:** invalid inputs rejected with typed errors.
- **Authorization tests (highest value):** for each protected endpoint, assert an unauthorized principal gets 401/403 and an unauthorized-but-authenticated principal (different owner/tenant) gets 403/404 — **never** 200-with-data. **Pass:** no cross-tenant/cross-owner data ever returned.
- **Integration tests for access rules:** RBAC matrix (role × endpoint), tenant isolation, admin boundaries. **Pass:** matrix matches the intended policy exactly.
- **Input-validation tests:** operator-shaped/oversized/wrong-type inputs are rejected by `ValidationPipe`/schema. **Pass:** rejected, not executed.
- **SSRF validator tests:** URL allowlist rejects private/link-local/metadata/`file://`. **Pass:** all rejected.
- **Dependency scanning:** `npm audit`/OSV/Dependabot in CI. **Pass:** no unaddressed high/critical (documented exceptions allowed).
- **Static analysis (SAST):** CodeQL + ESLint security rules. **Pass:** no new high-severity alerts.
- **Dynamic scanning (DAST):** authenticated scan against **staging** pre-release; triage. **Pass:** no high findings unresolved/unaccepted.
- **IaC scanning:** Checkov/Trivy config on compose/render/vercel/Dockerfiles. **Pass:** no critical misconfig (e.g., public bucket, privileged container).
- **Container scanning:** Trivy/Grype on images. **Pass:** no high/critical in final image.
- **Secret scanning:** gitleaks on push + history. **Pass:** zero secrets; push protection on.
- **Fuzz testing (where appropriate):** malformed inputs to parsers/validators/file handlers to confirm they fail safely (reject, no crash/hang). **Pass:** graceful typed rejection.
- **Backup restore tests:** see §22. **Pass:** restored data verified + app boots.
- **Log & alert verification:** trigger a benign auth failure/403 and confirm it is logged and (for alert rules) fires. **Pass:** event present + alert routed.
- **Secure code-review checklist (per PR):** authz on new endpoints? ownership scoping? input validated? output DTO (no secret leakage)? error handling fails closed? secrets not logged? new outbound URL uses SSRF validator? new AI tool re-checks authz? new upload path scanned?
- **Regression tests for past vulnerabilities:** every fixed security bug gets a permanent test (see §21).

---

## 24. Production Readiness Checklist

### Before MVP launch
- [ ] Global deny-by-default auth (JwtAuthGuard) verified · [ ] RBAC + tenancy on all protected routes · [ ] `ValidationPipe` whitelist on · [ ] bcrypt hashing (cost ≥ 12) · [ ] JWT access+refresh rotation · [ ] Rate limiting on auth routes · [ ] Security headers + CSP · [ ] Safe error filter (no stack traces in prod) · [ ] Secrets in env/secret store, none in code · [ ] `.env` git-ignored · [ ] Private DB (no public exposure) · [ ] HTTPS/TLS + HSTS.

### Before public beta
- [ ] Object-ownership tests per endpoint (green) · [ ] Tenant-isolation tests (green) · [ ] Webhook HMAC verified (Stripe/Razorpay) · [ ] Upload validation + private bucket + signed URLs · [ ] Malware scanning live · [ ] Log/AI redaction verified · [ ] Dependency + secret + SAST scans in CI · [ ] Branch protection + required review · [ ] Backup + first restore drill done · [ ] Admin MFA enforced · [ ] Alert rules for 5xx/401-403/429/webhook-fail.

### Before production
- [ ] All **P0** controls Done with evidence · [ ] DAST on staging clean/accepted · [ ] IaC + container scans clean · [ ] IAM least privilege reviewed · [ ] Incident runbook + on-call · [ ] DR runbook + RPO/RTO agreed · [ ] Secrets rotation runbook + rotated · [ ] Privacy: export/delete flows tested · [ ] WAF/DDoS enabled at edge · [ ] Access review completed.

### After production
- [ ] Monitoring/alerts verified in prod · [ ] Backup restore re-tested against prod data (isolated) · [ ] Post-launch security review · [ ] Bug-report/disclosure channel published · [ ] Gap analysis (§25) updated.

### Continuous security operations
- [ ] Weekly: triage scanner alerts, review auth/authz anomalies · [ ] Monthly: dependency updates, restore drill, log sampling for leakage · [ ] Quarterly: access review, secret rotation check, tabletop incident drill, this doc reviewed · [ ] Per PR: security checklist (§23) · [ ] Per incident: postmortem + regression test.

---

## 25. Gap Analysis

| Area | Current assumption | Possible gap | Risk | How to verify | Required fix | Owner | Deadline | Evidence required |
|---|---|---|---|---|---|---|---|---|
| Admin MFA | Guard shipped: admin/founder routes 403 without MFA when `REQUIRE_ADMIN_MFA=true` | Flag still off; no client enrollment UI yet | Med → Low | Enroll admins, flip the flag in staging, confirm 403 without MFA | Build enrollment UI, then set `REQUIRE_ADMIN_MFA=true` in prod | Auth | Before prod | Flag on in prod + guard spec green |
| Object ownership | Guards cover most routes | A handler queries by client-supplied id without owner scope | **High** | A-can't-read-B integration test per endpoint | Shared tenant-scoped repo helper + tests | Backend | Before beta | Passing cross-owner test suite |
| Malware scanning | Uploads validated by type/size | No AV scan before file is downloadable | **High** | Upload benign EICAR test file → must quarantine | Integrate AV/DLP scan + quarantine state | Backend | Before beta | Scan verdict logged; unscanned files not downloadable |
| Rate limiting at scale | Redis-backed store shipped (`RATE_LIMIT_REDIS=true`) | Flag off by default; not yet exercised against a real multi-instance deploy | Low | Deploy 2 instances with the flag on, exceed a budget across both | Enable the flag at scale-out; verify 429 cluster-wide | Backend | At scale-out | 429 enforced cluster-wide |
| Secrets management | Env vars on Render/Vercel/GH | No central manager, rotation manual | **Med** | Review secret storage + rotation log | Secret manager + rotation runbook | Platform | Before prod (runbook) | Rotation runbook + last-rotation dates |
| CI security gates | Repo private, lockfiles committed | Scans not enforced as blocking gates | **High** | Open a PR with a known-vuln dep — does CI block? | Enable Dependabot + gitleaks + CodeQL as required checks | Eng | Before beta | CI blocks on high-severity finding |
| Branch protection | Team commits via PR | Direct pushes to `main` possible | **Med** | Attempt direct push to `main` | Enable branch protection + required review | Eng | Before beta | Push rejected; review required |
| Log redaction | Structured logs, request-id | PII/tokens may appear in some logs | **Med** | Sample logs for known sensitive keys | Central redaction middleware | Backend | Before beta | Redaction test + clean sample |
| Field-level encryption | At-rest via Atlas | R fields not individually encrypted | **Med** | Inspect stored R fields | CSFLE/KMS for select fields | Backend | Before prod (P1) | Ciphertext at rest for R fields |
| AI tool authz | AiService validates output | A tool-call may act without re-checking caller authz | **High** | Test a tool-call as unauthorized user → must 403 | Route tool-calls through same guards/authz | AI | Before beta | Tool-call authz test green |
| DR restore | Atlas backups exist | Restore never actually tested | **High** | Perform restore drill to isolated env | Scheduled restore test + runbook | Platform | Before prod | Successful restore evidence |
| WAF/DDoS | TLS + app rate limits | No edge L7 protection | **Med** | Check edge config | Enable WAF/DDoS at edge | Platform | Before prod (P1) | WAF enabled + rules |
| CSP on API responses | CSP set on Vercel (SPA) | ~~Nest-served responses lack CSP~~ **RESOLVED 2026-07-07** | **Low-Med** | Header scan on API/error pages | ~~Add CSP to security middleware~~ Done in `security.middleware.ts` (`default-src 'none'`) | Backend | ✅ | CSP header present on API responses (spec-verified) |

---

## 26. Prioritized Roadmap

**P0 — Must-have before production**

| Priority | Security system | Risk reduced | Effort | Cost | Suggested tools | Phase | Status |
|---|---|---|---|---|---|---|---|
| P0 | Object-ownership / tenant-scoped queries + tests | IDOR, tenant leak | M | Low | Shared repo helper, Jest | Now | In progress |
| P0 | Admin MFA (TOTP) | ATO | S-M | Low | otplib | Now | Not started |
| P0 | Malware scanning + quarantine for uploads | Malware/abuse | M | Low-Med | ClamAV / cloud AV | Now | In progress |
| P0 | CI security gates (dep + secret + SAST) | Supply chain | S-M | Low | Dependabot, gitleaks, CodeQL | Now | In progress |
| P0 | Branch protection + required review | CI compromise | S | Free | GitHub | Now | In progress |
| P0 | Alerting rules + centralized logs | Slow detection (A09) | M | Low-Med | Log platform | Now | Not started |
| P0 | Backup restore drill + DR runbook | Data loss | M | Low | Atlas backups | Now | In progress |
| P0 | AI tool-call authz + tenant-scoped RAG | AI data leak | M | Low | AiService guards | Now | In progress |
| P0 | Log/AI redaction | Data leakage | S-M | Low | Custom redactor | Now | In progress |

**P1 — Strongly recommended**

| Priority | Security system | Risk reduced | Effort | Cost | Suggested tools | Phase | Status |
|---|---|---|---|---|---|---|---|
| P1 | Redis-backed distributed rate limiting | API abuse at scale | M | Low | ioredis | Pre-scale | Not started |
| P1 | WAF / DDoS at edge | L7 attacks | S | Med | Cloudflare/Vercel | Pre-prod | Not started |
| P1 | Field-level encryption (R data) | Data leak | M | Med | Mongo CSFLE + KMS | Post-MVP | Not started |
| P1 | Secret manager + rotation automation | Secret exposure | M | Med | Vault/AWS SM/Doppler | Post-MVP | Not started |
| P1 | Approval workflows + JIT admin | Insider misuse | M | Low | In-app | Post-MVP | Not started |
| P1 | DAST on staging + container scan | Latent vulns | M | Low | ZAP, Trivy | Pre-prod | Not started |
| P1 | Device/session management + suspicious-login alerts | ATO/session theft | M | Low | In-app | Post-MVP | Not started |
| P1 | Payment fraud/velocity monitoring | Payment abuse | M | Low | Stripe/Razorpay tools | Post-MVP | Not started |

**P2 — Advanced hardening**

| Priority | Security system | Risk reduced | Effort | Cost | Suggested tools | Phase | Status |
|---|---|---|---|---|---|---|---|
| P2 | Passkeys / WebAuthn | Phishing-resistant ATO | M | Low | @simplewebauthn | Later | Not started |
| P2 | SBOM + artifact signing + SLSA provenance | Supply chain | M | Low | Syft, cosign | Later | Not started |
| P2 | Trusted Types + CSP nonces | DOM XSS | M | Low | Angular/CSP | Later | Not started |
| P2 | mTLS internal services | Internal spoofing | M | Med | Service mesh | Later | Not started |
| P2 | Immutable backups (object-lock) | Ransomware | S-M | Med | S3 Object Lock | Later | Not started |
| P2 | Hash-chained tamper-evident audit log | Log tampering | M | Low | `audit-chain.ts` + `GET /admin/audit-logs/verify` | Shipped 2026-07-07 | Done |

---

## 27. Definition of Done for Security

Security is "done for this release" when **all** of the following are true, with evidence linked in the release ticket:

- [ ] **All P0 controls implemented** (Section 5 / Section 26) and marked Done.
- [ ] **All critical/high findings fixed or formally accepted** — accepted risks have a written owner, rationale, expiry, and sign-off.
- [ ] **Security tests passing in CI** — authorization/tenant-isolation suites green; dependency, secret, and SAST gates green (or documented exceptions).
- [ ] **Logging and alerts verified** — a triggered auth failure/403 appears in logs and fires its alert to on-call.
- [ ] **Backups tested** — a restore drill succeeded within RTO and data verified within RPO.
- [ ] **Incident-response runbook created** and at least one tabletop drill completed.
- [ ] **Access reviews completed** — human and service accounts reviewed; least privilege confirmed; stale access removed.
- [ ] **Secrets rotated** — production secrets rotated on schedule; rotation runbook validated; no secrets in code/logs (scanner clean).
- [ ] **Dependency scans clean** or every exception documented with owner + expiry.
- [ ] **Audit evidence collected** — this checklist, test results, scan reports, restore-drill log, and access-review record attached to the release.

> **Reminder:** meeting this Definition of Done means **"no obvious critical gaps at this point in time,"** not "perfectly secure." Re-run gap analysis (§25) each release and after every incident, and keep improving.

---

*End of SECURITY_IMPLEMENTATION.md — defensive security program for an application we own and are authorized to secure. Maintained by the engineering team; reviewed quarterly.*
