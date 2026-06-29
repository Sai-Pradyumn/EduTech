import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { AgentStreamEvent } from '../models';

/** Single shared Socket.IO connection, authenticated with the access token. */
@Injectable({ providedIn: 'root' })
export class SocketService {
  private readonly auth = inject(AuthService);
  private socket?: Socket;

  private connect(): Socket {
    if (this.socket?.connected) return this.socket;
    if (this.socket) {
      // A stale (disconnected) instance — refresh its token and let it reconnect.
      this.socket.auth = { token: this.auth.accessToken ?? '' };
      this.socket.connect();
      return this.socket;
    }
    const socket = io(environment.socketUrl, {
      transports: ['websocket'],
      auth: { token: this.auth.accessToken ?? '' },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
    });
    // On every (re)connection attempt, send the *current* token — it may have been
    // refreshed since the socket was first created, which would otherwise 401.
    socket.io.on('reconnect_attempt', () => {
      socket.auth = { token: this.auth.accessToken ?? '' };
    });
    this.socket = socket;
    return socket;
  }

  /**
   * Send a message to the Agent OS and stream workflow + token events until the run
   * completes or errors. A dropped connection mid-stream surfaces as a terminal
   * error event so the UI never hangs waiting for a `completed` that won't arrive.
   */
  streamAgent(payload: {
    message: string;
    sessionId?: string;
    mode?: string;
    agentType?: string;
    documentIds?: string[];
  }): Observable<AgentStreamEvent> {
    return new Observable<AgentStreamEvent>((subscriber) => {
      const socket = this.connect();
      let settled = false;
      const finish = (event: AgentStreamEvent) => {
        if (settled) return;
        settled = true;
        subscriber.next(event);
        subscriber.complete();
      };

      const onEvent = (event: AgentStreamEvent) => {
        if (settled) return;
        subscriber.next(event);
        if (event.type === 'completed' || event.type === 'error') {
          settled = true;
          subscriber.complete();
        }
      };
      const onDisconnect = () =>
        finish({ type: 'error', messageId: '', message: 'Connection lost — please try again.' });
      const onConnectError = () =>
        finish({ type: 'error', messageId: '', message: 'Could not reach Asta. Check your connection.' });

      socket.on('agent.event', onEvent);
      socket.once('disconnect', onDisconnect);
      socket.io.once('reconnect_failed', onConnectError);
      if (socket.connected) {
        socket.emit('agent.send', payload);
      } else {
        socket.once('connect', () => socket.emit('agent.send', payload));
      }

      return () => {
        socket.off('agent.event', onEvent);
        socket.off('disconnect', onDisconnect);
        socket.io.off('reconnect_failed', onConnectError);
      };
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = undefined;
  }
}
