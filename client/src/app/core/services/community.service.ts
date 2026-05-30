import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { CommunityChannel, CommunityReply, CommunityThread, CreateThreadRequest, ThreadWithReplies } from '../models';

/** Community + discussion API (Phase 4 · B9). */
@Injectable({ providedIn: 'root' })
export class CommunityService {
  private readonly api = inject(ApiService);

  channels(): Observable<CommunityChannel[]> {
    return this.api.get<CommunityChannel[]>('/community/channels');
  }

  createChannel(input: { name: string; description?: string; kind?: string }): Observable<CommunityChannel> {
    return this.api.post<CommunityChannel>('/community/channels', input);
  }

  threads(channelId: string): Observable<CommunityThread[]> {
    return this.api.get<CommunityThread[]>(`/community/channels/${channelId}/threads`);
  }

  createThread(input: CreateThreadRequest): Observable<CommunityThread> {
    return this.api.post<CommunityThread>('/community/threads', input);
  }

  thread(id: string): Observable<ThreadWithReplies> {
    return this.api.get<ThreadWithReplies>(`/community/threads/${id}`);
  }

  upvoteThread(id: string): Observable<CommunityThread> {
    return this.api.post<CommunityThread>(`/community/threads/${id}/upvote`, {});
  }

  deleteThread(id: string): Observable<{ ok: boolean }> {
    return this.api.delete<{ ok: boolean }>(`/community/threads/${id}`);
  }

  reply(threadId: string, body: string): Observable<CommunityReply> {
    return this.api.post<CommunityReply>(`/community/threads/${threadId}/replies`, { body });
  }

  upvoteReply(id: string): Observable<CommunityReply> {
    return this.api.post<CommunityReply>(`/community/replies/${id}/upvote`, {});
  }

  acceptAnswer(id: string): Observable<{ ok: boolean }> {
    return this.api.post<{ ok: boolean }>(`/community/replies/${id}/accept`, {});
  }

  deleteReply(id: string): Observable<{ ok: boolean }> {
    return this.api.delete<{ ok: boolean }>(`/community/replies/${id}`);
  }
}
