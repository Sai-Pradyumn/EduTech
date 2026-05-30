/** Certificates (B7) — mirrors server contracts. */
export interface CertificateView {
  id: string;
  title: string;
  skill: string;
  score: number;
  issuerName: string;
  verificationId: string;
  revoked: boolean;
  issuedAt: string;
}

export interface VerificationResult {
  valid: boolean;
  holderName?: string;
  title?: string;
  skill?: string;
  score?: number;
  issuerName?: string;
  issuedAt?: string;
  verificationId?: string;
}
