import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Organization, OrgContext, OrgMember, OrgRole, MyOrg } from '../models';

/** Multi-tenant org + membership API (B1). */
@Injectable({ providedIn: 'root' })
export class OrgService {
  private readonly api = inject(ApiService);

  create(name: string, type?: string, description?: string): Observable<Organization> {
    return this.api.post<Organization>('/organizations', { name, type, description });
  }

  mine(): Observable<MyOrg[]> {
    return this.api.get<MyOrg[]>('/organizations/mine');
  }

  context(): Observable<OrgContext> {
    return this.api.get<OrgContext>('/organizations/context');
  }

  get(id: string): Observable<Organization> {
    return this.api.get<Organization>(`/organizations/${id}`);
  }

  update(id: string, patch: { name?: string; description?: string; tagline?: string; primaryColor?: string }): Observable<Organization> {
    return this.api.patch<Organization>(`/organizations/${id}`, patch);
  }

  members(id: string): Observable<OrgMember[]> {
    return this.api.get<OrgMember[]>(`/organizations/${id}/members`);
  }

  addMember(id: string, email: string, orgRole: OrgRole): Observable<OrgMember> {
    return this.api.post<OrgMember>(`/organizations/${id}/members`, { email, orgRole });
  }

  updateMemberRole(id: string, userId: string, orgRole: OrgRole): Observable<{ ok: boolean }> {
    return this.api.patch<{ ok: boolean }>(`/organizations/${id}/members/${userId}`, { orgRole });
  }

  removeMember(id: string, userId: string): Observable<{ ok: boolean }> {
    return this.api.delete<{ ok: boolean }>(`/organizations/${id}/members/${userId}`);
  }

  // Platform operator.
  listAll(): Observable<Organization[]> {
    return this.api.get<Organization[]>('/platform/organizations');
  }

  platformStats(): Observable<{ organizations: number; totalMembers: number; byType: Record<string, number> }> {
    return this.api.get('/platform/stats');
  }
}
