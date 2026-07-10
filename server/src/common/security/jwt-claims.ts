/**
 * JWT claim constants (SECURITY_IMPLEMENTATION.md §8 · JWT verification). Tokens are
 * always SIGNED with issuer + audience; VERIFICATION enforces them only when
 * JWT_STRICT_CLAIMS=true — flip it after one refresh-token lifetime (7d) so tokens issued
 * before this change have rotated out and nobody gets logged out by the deploy.
 * Binding iss/aud stops a token minted by (or for) another service that happens to share
 * a secret from being accepted here.
 */
export const JWT_ISSUER = 'asta-api';
export const JWT_AUDIENCE = 'asta-app';
