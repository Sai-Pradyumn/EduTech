import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../shared/ui/button.component';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { ToastService } from '../../core/services/toast.service';
import { PeerRoom, PeerRoomService } from '../../core/services/peer-room.service';

@Component({
  selector: 'asta-peer-rooms-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ButtonComponent, CardComponent, EmptyStateComponent, SkeletonComponent],
  template: `
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Peer Rooms</h1>
        <span class="goal-pill"><span class="dot"></span>Learn together · shared rooms with an AI moderator</span>
      </div>
      <div class="flex gap-2.5 shrink-0"><asta-btn variant="ghost" size="sm" (click)="refresh()" [disabled]="loading()">Refresh</asta-btn></div>
    </header>

    <div class="grid gap-4 md:grid-cols-2 mb-5">
      <asta-card class="block motion-card-reveal motion-row-primary">
        <p class="kicker mb-3">Create a room</p>
        <input class="pr-input" [(ngModel)]="title" placeholder="Room title" maxlength="120" aria-label="Room title" />
        <input class="pr-input mt-2" [(ngModel)]="topic" (keydown.enter)="create()" placeholder="Topic (e.g. Dynamic programming)" maxlength="120" aria-label="Topic" />
        <asta-btn variant="accent" size="sm" class="mt-2 inline-block" [loading]="creating()" [disabled]="title.trim().length < 2 || topic.trim().length < 2" (click)="create()">Create room <span class="arr">→</span></asta-btn>
      </asta-card>
      <asta-card class="block motion-card-reveal motion-row-primary">
        <p class="kicker mb-3">Join by code</p>
        <input class="pr-input" [(ngModel)]="code" (keydown.enter)="join()" placeholder="6-char code (e.g. DEMO01)" maxlength="12" aria-label="Join code" style="text-transform:uppercase" />
        <asta-btn variant="ghost" size="sm" class="mt-2 inline-block" [loading]="joining()" [disabled]="code.trim().length < 4" (click)="join()">Join room</asta-btn>
      </asta-card>
    </div>

    @if (loading()) {
      <asta-card><asta-skeleton h="100px" /></asta-card>
    } @else if (loadError()) {
      <asta-card><asta-empty-state title="Could not load rooms" description=""><asta-btn variant="accent" (click)="refresh()">Retry</asta-btn></asta-empty-state></asta-card>
    } @else if (rooms().length === 0) {
      <asta-card class="block motion-card-reveal"><asta-empty-state title="No peer rooms yet" description="Create a room and share its code, or join one with a code. Rooms have a shared board, an AI moderator and an auto-summary."><asta-btn variant="accent" (click)="focusTitle()">Create a room</asta-btn></asta-empty-state></asta-card>
    } @else {
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 motion-row-2">
        @for (r of rooms(); track r.id; let i = $index) {
          <asta-card class="motion-card-reveal hover-lift cursor-pointer block" [interactive]="true" [style.--motion-card-index]="i % 3" (click)="open(r)">
            <div class="flex items-start justify-between gap-2">
              <p class="font-display text-lg leading-snug truncate">{{ r.title }}</p>
              <span class="status st-{{ r.status }}">{{ r.status }}</span>
            </div>
            <p class="text-sm text-txt-mute mt-0.5">{{ r.topic }}</p>
            <div class="flex flex-wrap gap-1.5 mt-3 text-[11px] text-txt-mute">
              <span class="pill">{{ r.members.length }} members</span>
              @if (r.isHost) { <span class="pill">code {{ r.code }}</span> } @else if (r.isMember) { <span class="pill">joined</span> }
            </div>
          </asta-card>
        }
      </div>
    }
  `,
  styles: [
    `
      :host { display: block; }
      .pr-input { width: 100%; background: var(--ink-2, var(--paper-2)); border: 1px solid var(--paper-3); border-radius: 12px; padding: 9px 12px; color: var(--text); font-size: 14px; }
      .pr-input:focus { outline: none; border-color: var(--green); }
      .pill { padding: 2px 8px; border-radius: 999px; border: 1px solid var(--paper-3); background: color-mix(in oklab, var(--paper-2) 70%, transparent); }
      .status { font-size: 10px; text-transform: uppercase; letter-spacing: .05em; padding: 3px 9px; border-radius: 999px; border: 1px solid var(--paper-3); }
      .st-open { color: var(--green-deep); border-color: color-mix(in oklab, var(--green) 45%, var(--paper-3)); }
      .st-closed { color: var(--text-mute); }
    `,
  ],
})
export class PeerRoomsListComponent {
  private readonly api = inject(PeerRoomService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly rooms = signal<PeerRoom[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly creating = signal(false);
  readonly joining = signal(false);
  title = '';
  topic = '';
  code = '';

  constructor() { this.refresh(); }
  refresh(): void {
    this.loading.set(true); this.loadError.set(false);
    this.api.list().subscribe({ next: (l) => { this.rooms.set(l); this.loading.set(false); }, error: () => { this.loadError.set(true); this.loading.set(false); } });
  }
  focusTitle(): void { document.querySelector<HTMLInputElement>('.pr-input')?.focus(); }
  create(): void {
    if (this.title.trim().length < 2 || this.topic.trim().length < 2) return;
    this.creating.set(true);
    this.api.create({ title: this.title.trim(), topic: this.topic.trim() }).subscribe({
      next: (r) => { this.creating.set(false); this.router.navigate(['/app/peer-rooms', r.id]); },
      error: (e: Error) => { this.creating.set(false); this.toast.error(e.message || 'Could not create'); },
    });
  }
  join(): void {
    if (this.code.trim().length < 4) return;
    this.joining.set(true);
    this.api.joinByCode(this.code.trim().toUpperCase()).subscribe({
      next: (r) => { this.joining.set(false); this.router.navigate(['/app/peer-rooms', r.id]); },
      error: (e: Error) => { this.joining.set(false); this.toast.error(e.message || 'Could not join'); },
    });
  }
  open(r: PeerRoom): void { this.router.navigate(['/app/peer-rooms', r.id]); }
}
