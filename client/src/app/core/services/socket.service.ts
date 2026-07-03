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

  /**
   * The server runs one agent stream per socket to bound cost. Since the whole
   * app shares one socket, a second stream started before the first finishes
   * would otherwise be rejected. We serialize sends through a FIFO queue (the
   * next stream waits its turn instead of erroring) and tag each with a runId so
   * events never cross-talk between runs (SOCKET-BUG-001).
   */
  private streamActive = false;
  private readonly waiters: (() => void)[] = [];

  private acquire(run: () => void): void {
    if (this.streamActive) this.waiters.push(run);
    else {
      this.streamActive = true;
      run();
    }
  }
  private release(): void {
    const next = this.waiters.shift();
    if (next) next();
    else this.streamActive = false;
  }
  private newRunId(): string {
    return typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  }

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
      const runId = this.newRunId();
      let settled = false;
      let acquired = false; // took the active-stream slot
      let socket: Socket | undefined;

      const teardown = () => {
        if (!socket) return;
        socket.off('agent.event', onEvent);
        socket.off('disconnect', onDisconnect);
        socket.io.off('reconnect_failed', onConnectError);
      };
      // Settle this run and hand the slot to the next queued stream.
      const done = () => {
        if (settled) return;
        settled = true;
        teardown();
        subscriber.complete();
        if (acquired) this.release();
      };
      const emit = (event: AgentStreamEvent) => {
        if (settled) return;
        subscriber.next(event);
        if (event.type === 'completed' || event.type === 'error') done();
      };

      const onEvent = (event: AgentStreamEvent & { runId?: string }) => {
        if (settled) return;
        // Ignore events belonging to a different run on the shared socket.
        if (event.runId && event.runId !== runId) return;
        emit(event);
      };
      const onDisconnect = () =>
        emit({ type: 'error', messageId: '', message: 'Connection lost — please try again.' });
      const onConnectError = () =>
        emit({ type: 'error', messageId: '', message: 'Could not reach Asta. Check your connection.' });

      const start = () => {
        acquired = true;
        if (settled) {
          // Unsubscribed while queued — release the slot we were just handed.
          this.release();
          return;
        }
        socket = this.connect();
        socket.on('agent.event', onEvent);
        socket.once('disconnect', onDisconnect);
        socket.io.once('reconnect_failed', onConnectError);
        const send = () => socket!.emit('agent.send', { ...payload, runId });
        if (socket.connected) send();
        else socket.once('connect', send);
      };

      this.acquire(start);

      return () => {
        if (settled) return;
        settled = true;
        teardown();
        if (acquired) this.release();
        else {
          // Still queued — drop ourselves from the waiters.
          const i = this.waiters.indexOf(start);
          if (i >= 0) this.waiters.splice(i, 1);
        }
      };
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = undefined;
    this.streamActive = false;
    this.waiters.length = 0;
  }
}
