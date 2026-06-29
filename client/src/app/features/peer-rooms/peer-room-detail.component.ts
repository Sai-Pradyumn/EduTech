import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { ToastService } from '../../core/services/toast.service';
import { PeerRoom, PeerRoomService } from '../../core/services/peer-room.service';

@Component({
    selector: 'asta-peer-room-detail',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, ButtonComponent, CardComponent, EmptyStateComponent, SkeletonComponent],
    template: `
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[24px] leading-tight mb-2 grad-flow truncate">{{ room()?.title || 'Peer Room' }}</h1>
        <span class="goal-pill"><span class="dot"></span>{{ room() ? room()!.topic + ' · code ' + room()!.code : 'Loading…' }}</span>
      </div>
      <div class="flex gap-2.5 shrink-0 flex-wrap">
        <asta-btn variant="ghost" size="sm" (click)="back()">All rooms</asta-btn>
        <asta-btn variant="ghost" size="sm" (click)="reload()">Refresh</asta-btn>
        @if (room()) { <asta-btn variant="ghost" size="sm" (click)="copyInvite()">Copy invite</asta-btn> }
        @if (room()?.isHost && room()?.status === 'open') { <asta-btn variant="ghost" size="sm" (click)="close()">Close room</asta-btn> }
      </div>
    </header>

    @if (loading()) {
      <asta-card><asta-skeleton h="360px" /></asta-card>
    } @else if (loadError() || !room()) {
      <asta-card><asta-empty-state title="Could not load this room" description=""><asta-btn variant="accent" (click)="reload()">Retry</asta-btn></asta-empty-state></asta-card>
    } @else if (!room()!.isMember) {
      <asta-card class="block"><asta-empty-state [title]="room()!.title" [description]="'Topic: ' + room()!.topic + '. Join to take part in the discussion.'"><asta-btn variant="accent" (click)="join()">Join room</asta-btn></asta-empty-state></asta-card>
    } @else {
      <div class="grid gap-4 lg:grid-cols-[1fr_280px] items-start">
        <div class="min-w-0">
          <asta-card class="block motion-card-reveal motion-row-primary">
            <div class="board">
              @for (m of room()!.messages; track m.id) {
                <div class="msg" [class.mine]="m.mine" [class.system]="m.kind === 'system'" [class.ai]="m.kind === 'ai'">
                  @if (m.kind !== 'system') { <span class="msg-who">{{ m.name }}</span> }
                  <span class="msg-text">{{ m.text }}</span>
                </div>
              }
            </div>
            @if (room()!.status === 'open') {
              <div class="compose mt-3">
                <input class="pr-input" [(ngModel)]="text" (keydown.enter)="send()" placeholder="Message the room…" [disabled]="sending()" aria-label="Message" />
                <asta-btn variant="accent" size="sm" [loading]="sending()" [disabled]="text.trim().length < 1" (click)="send()">Send</asta-btn>
              </div>
            } @else { <p class="text-xs text-txt-mute mt-3">This room is closed.</p> }
          </asta-card>
        </div>

        <div class="space-y-4">
          <asta-card class="block motion-card-reveal motion-row-2">
            <p class="kicker mb-2">Members ({{ room()!.members.length }})</p>
            @for (mem of room()!.members; track mem.name) {
              <div class="mem"><span>{{ mem.name }}</span><span class="role">{{ mem.role }}</span></div>
            }
          </asta-card>

          <asta-card class="block motion-card-reveal motion-row-3">
            <p class="kicker mb-2">Room tools</p>
            <div class="grid gap-2">
              <asta-btn variant="ghost" size="sm" [loading]="busy()==='mod'" (click)="moderate()">🤖 AI moderator nudge</asta-btn>
              <asta-btn variant="ghost" size="sm" [loading]="busy()==='sum'" (click)="summarize()">✦ Summary + actions</asta-btn>
              <asta-btn variant="ghost" size="sm" [loading]="busy()==='flow'" (click)="linkFlow()">🧭 Shared learning flow</asta-btn>
            </div>
          </asta-card>

          @if (room()!.summary) {
            <asta-card class="block motion-card-reveal motion-row-3">
              <p class="kicker mb-1">Summary</p>
              <p class="text-sm text-txt-soft">{{ room()!.summary }}</p>
              @if (room()!.actionItems.length) {
                <p class="kicker mt-3 mb-1">Action items</p>
                <ul class="text-sm text-txt-soft space-y-0.5">@for (a of room()!.actionItems; track a) { <li>• {{ a }}</li> }</ul>
              }
            </asta-card>
          }
        </div>
      </div>
    }
  `,
    styles: [
        `
      :host { display: block; }
      .pr-input { flex: 1; background: var(--ink-2, var(--paper-2)); border: 1px solid var(--paper-3); border-radius: 12px; padding: 9px 12px; color: var(--text); font-size: 14px; }
      .pr-input:focus { outline: none; border-color: var(--green); }
      .board { max-height: 56vh; overflow: auto; display: flex; flex-direction: column; gap: 8px; }
      .msg { padding: 8px 12px; border-radius: 12px; background: var(--paper-2); border: 1px solid var(--paper-3); max-width: 85%; align-self: flex-start; }
      .msg.mine { align-self: flex-end; background: color-mix(in oklab, var(--green) 10%, var(--paper-2)); }
      .msg.system { align-self: center; background: transparent; border: none; color: var(--text-mute); font-size: 12px; }
      .msg.ai { border-color: color-mix(in oklab, var(--peri,#8aa6ff) 40%, var(--paper-3)); }
      .msg-who { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: var(--text-mute); }
      .msg-text { font-size: 14px; }
      .compose { display: flex; gap: 8px; align-items: center; }
      .mem { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; border-bottom: 1px solid var(--paper-3); }
      .role { font-size: 10px; text-transform: uppercase; color: var(--text-mute); }
    `,
    ]
})
export class PeerRoomDetailComponent {
  private readonly api = inject(PeerRoomService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly room = signal<PeerRoom | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly sending = signal(false);
  readonly busy = signal<string | null>(null);
  text = '';

  constructor() { this.reload(); }
  reload(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.loadError.set(true); this.loading.set(false); return; }
    this.loading.set(true); this.loadError.set(false);
    this.api.get(id).subscribe({ next: (r) => { this.room.set(r); this.loading.set(false); }, error: () => { this.loadError.set(true); this.loading.set(false); } });
  }
  private id(): string { return this.room()!.id; }

  join(): void { this.api.join(this.id()).subscribe({ next: (r) => { this.room.set(r); this.toast.success('Joined room'); }, error: (e: Error) => this.toast.error(e.message || 'Could not join') }); }
  send(): void {
    if (this.text.trim().length < 1) return;
    const t = this.text.trim(); this.text = '';
    this.sending.set(true);
    this.api.message(this.id(), t).subscribe({ next: (r) => { this.room.set(r); this.sending.set(false); }, error: (e: Error) => { this.sending.set(false); this.toast.error(e.message || 'Could not send'); } });
  }
  moderate(): void { this.run('mod', this.api.moderate(this.id())); }
  summarize(): void { this.run('sum', this.api.summary(this.id())); }
  linkFlow(): void {
    this.busy.set('flow');
    this.api.linkFlow(this.id()).subscribe({ next: (r) => { this.room.set(r.room); this.busy.set(null); this.toast.success('Shared flow created'); this.router.navigate(['/app/flows', r.flowId]); }, error: (e: Error) => { this.busy.set(null); this.toast.error(e.message || 'Failed'); } });
  }
  close(): void { this.api.close(this.id()).subscribe({ next: (r) => { this.room.set(r); this.toast.success('Room closed'); }, error: (e: Error) => this.toast.error(e.message || 'Could not close') }); }

  copyInvite(): void {
    const r = this.room();
    if (!r) return;
    const link = `${location.origin}/app/peer-rooms/${r.id}`;
    const text = `Join my peer room “${r.title}” on Asta — code ${r.code}\n${link}`;
    navigator.clipboard?.writeText(text).then(
      () => this.toast.success(`Invite copied — code ${r.code}`),
      () => this.toast.error('Copy failed'),
    );
  }

  private run(key: string, obs: import('rxjs').Observable<PeerRoom>): void {
    this.busy.set(key);
    obs.subscribe({ next: (r) => { this.room.set(r); this.busy.set(null); }, error: (e: Error) => { this.busy.set(null); this.toast.error(e.message || 'Failed'); } });
  }
  back(): void { this.router.navigate(['/app/peer-rooms']); }
}
