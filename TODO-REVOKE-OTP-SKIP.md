# TODO: Revoke OTP-skip (TEMPORARY)

**Date disabled:** 2026-06-03
**Reason:** Temporarily skipping the email-OTP verification step that fires after a
correct password during login, to ease development/testing for a few days.

## What was changed

`server/src/modules/auth/auth.service.ts` — in `login()`, the block that detects an
unverified account (`emailVerified === false`), re-issues an OTP, and returns
`{ pendingVerification: true, email }` has been **commented out**. As a result, any
account with a correct password now logs in directly and gets a session, regardless of
email-verification status.

## How to revert

Re-enable the commented block in `login()`:

```ts
// Unverified email signup → re-send a code and tell the client to show the OTP step.
if (user.emailVerified === false) {
  await this.otp.issue(user.email).catch(() => undefined);
  return { pendingVerification: true, email: user.email };
}
```

…and delete the `TEMP (see TODO-REVOKE-OTP-SKIP.md)` comment line, then delete this file.

> NOTE: The signup-time OTP flow (`register` → `verifyOtp`) is untouched — only the
> login-time re-verification gate was disabled.
