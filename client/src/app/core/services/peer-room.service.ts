import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface PeerMember { name: string; role: 'host' | 'member' | 'mentor'; }
export interface PeerMessage { id: string; name: string; kind: 'chat' | 'system' | 'ai'; text: string; at: string; mine: boolean; }
export interface PeerRoom {
  id: string;
  title: string;
  topic: string;
  code: string;
  isHost: boolean;
  isMember: boolean;
  members: PeerMember[];
  messages: PeerMessage[];
  status: 'open' | 'closed';
  linkedFlowId: string | null;
  summary: string;
  actionItems: string[];
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class PeerRoomService {
  private readonly api = inject(ApiService);

  list(): Observable<PeerRoom[]> { return this.api.get<PeerRoom[]>('/peer-rooms'); }
  get(id: string): Observable<PeerRoom> { return this.api.get<PeerRoom>(`/peer-rooms/${id}`); }
  create(body: { title: string; topic: string }): Observable<PeerRoom> { return this.api.post<PeerRoom>('/peer-rooms', body); }
  joinByCode(code: string): Observable<PeerRoom> { return this.api.post<PeerRoom>('/peer-rooms/join', { code }); }
  join(id: string): Observable<PeerRoom> { return this.api.post<PeerRoom>(`/peer-rooms/${id}/join`, {}); }
  message(id: string, text: string): Observable<PeerRoom> { return this.api.post<PeerRoom>(`/peer-rooms/${id}/messages`, { text }); }
  moderate(id: string): Observable<PeerRoom> { return this.api.post<PeerRoom>(`/peer-rooms/${id}/moderate`, {}); }
  summary(id: string): Observable<PeerRoom> { return this.api.post<PeerRoom>(`/peer-rooms/${id}/summary`, {}); }
  linkFlow(id: string): Observable<{ room: PeerRoom; flowId: string }> { return this.api.post(`/peer-rooms/${id}/link-flow`, {}); }
  close(id: string): Observable<PeerRoom> { return this.api.post<PeerRoom>(`/peer-rooms/${id}/close`, {}); }
  remove(id: string): Observable<{ ok: true }> { return this.api.delete<{ ok: true }>(`/peer-rooms/${id}`); }
}
