/**
 * Email-domain allowlist. The list is configurable via the EMAIL_ALLOWED_DOMAINS env var
 * (comma-separated). When unset, a sane default of common real-mail providers is used.
 */
const DEFAULT_ALLOWED_DOMAINS = [
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'microsoft.com',
  'yahoo.com',
  'icloud.com',
  'proton.me',
  'protonmail.com',
];

/** Parse the allowlist from env (or fall back to the defaults). Always lowercased. */
export function getAllowedEmailDomains(raw?: string): string[] {
  const list = (raw ?? '')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  return list.length ? list : DEFAULT_ALLOWED_DOMAINS;
}

/** True if the email's domain is in the allowlist. */
export function isAllowedEmailDomain(
  email: string,
  allowed: string[],
): boolean {
  const at = email.lastIndexOf('@');
  if (at === -1) return false;
  const domain = email
    .slice(at + 1)
    .trim()
    .toLowerCase();
  return allowed.includes(domain);
}
