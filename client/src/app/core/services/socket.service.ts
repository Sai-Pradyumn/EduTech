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
    this.socket = io(environment.socketUrl, {
      transports: ['websocket'],
      auth: { token: this.auth.accessToken ?? '' },
      autoConnect: true,
    });
    return this.socket;
  }

  /**
   * Send a message to the Agent OS and stream workflow + token events until
   * the run completes or errors.
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
      const onEvent = (event: AgentStreamEvent) => {
        subscriber.next(event);
        if (event.type === 'completed' || event.type === 'error') {
          subscriber.complete();
        }
      };
      socket.on('agent.event', onEvent);
      socket.emit('agent.send', payload);

      return () => socket.off('agent.event', onEvent);
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = undefined;
  }
}
