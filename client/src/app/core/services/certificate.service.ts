import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { CertificateView, VerificationResult } from '../models';

/** Certificates API (B7). */
@Injectable({ providedIn: 'root' })
export class CertificateService {
  private readonly api = inject(ApiService);

  mine(): Observable<CertificateView[]> {
    return this.api.get<CertificateView[]>('/certificates/mine');
  }
  verify(vid: string): Observable<VerificationResult> {
    return this.api.get<VerificationResult>(`/certificates/verify/${vid}`);
  }
  issue(input: { userId: string; title: string; skill?: string; score?: number; projectId?: string }): Observable<CertificateView> {
    return this.api.post<CertificateView>('/certificates/issue', input);
  }
  revoke(id: string): Observable<{ ok: boolean }> {
    return this.api.post<{ ok: boolean }>(`/certificates/${id}/revoke`, {});
  }
}
