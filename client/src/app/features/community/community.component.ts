import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CommunityService } from '../../core/services/community.service';
import { ProjectService } from '../../core/services/project.service';
import { AuthService } from '../../core/services/auth.service';
import { OrgContextService } from '../../core/services/org-context.service';
import { ToastService } from '../../core/services/toast.service';
import { CommunityChannel, CommunityReply, CommunityThread, Project, ThreadKind } from '../../core/models';
import { RevealDirective } from '../../shared/directives/reveal.directive';

/**
 * Community + discussion (B9). Org-scoped channels (General / Help / Showcase), threads
 * (discussion / question / showcase), threaded replies, upvotes, and accepted answers.
 * Question threads can be resolved; showcase threads link a Project Studio project.
 */
@Component({
  selector: 'asta-community',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DatePipe, RouterLink, RevealDirective],
  template: `
    <!-- Command header -->
    <header class="asta-page-command-header">
      <div class="min-w-0">
        <h1 class="text-[26px] leading-tight mb-2 grad-flow">Community</h1>
        <span class="goal-pill"><span class="dot"></span>Ask, discuss & showcase across your org channels</span>
      </div>
    </header>

    <div class="grid gap-5 lg:grid-cols-[minmax(260px,320px)_1fr]">
      <!-- Left: channels + thread list -->
      <div class="space-y-4">
        <div>
          <p class="kicker mb-2">Channels</p>
          <div class="space-y-1.5">
            @for (c of channels(); track c.id) {
              <button class="w-full text-left card" style="padding:10px 13px"
                [style.borderColor]="activeChannel()?.id === c.id ? 'var(--green)' : null" (click)="selectChannel(c)">
                <div class="flex items-center justify-between gap-2">
                  <b class="font-display text-sm">{{ kindIcon(c.kind) }} {{ c.name }}</b>
                  <span class="text-[11px] font-mono text-txt-mute">{{ c.threadCount }}</span>
                </div>
                <p class="text-[11px] text-txt-mute mt-0.5">{{ c.description }}</p>
              </button>
            }
          </div>
        </div>

        @if (activeChannel(); as ch) {
          <div>
            <div class="flex items-center justify-between mb-2">
              <p class="kicker">Threads</p>
              <button class="pill" style="cursor:pointer" (click)="composing.set(!composing())">{{ composing() ? 'Cancel' : '+ New' }}</button>
            </div>

            @if (composing()) {
              <div class="card mb-3" style="padding:13px">
                <input class="input mb-2" placeholder="Title" [(ngModel)]="ntTitle" />
                <textarea class="input mb-2" rows="3" placeholder="Say more…" [(ngModel)]="ntBody"></textarea>
                <div class="flex gap-1.5 mb-2">
                  @for (k of threadKinds; track k) { <button class="chip" [class.chip-on]="ntKind() === k" (click)="ntKind.set(k)">{{ k }}</button> }
                </div>
                @if (ntKind() === 'showcase') {
                  <select class="input mb-2" [(ngModel)]="ntProjectId">
                    <option value="">Link a project (optional)…</option>
                    @for (p of myProjects(); track p.id) { <option [value]="p.id">{{ p.title }}</option> }
                  </select>
                }
                <button class="btn-go" [disabled]="ntTitle.trim().length < 3 || posting()" (click)="postThread()">{{ posting() ? 'Posting…' : 'Post thread' }}</button>
              </div>
            }

            @if (threads().length === 0) { <p class="text-sm text-txt-mute">No threads yet — start one.</p> }
            <div class="space-y-1.5">
              @for (t of threads(); track t.id) {
                <button class="w-full text-left card" style="padding:10px 13px"
                  [style.borderColor]="activeThread()?.id === t.id ? 'var(--green)' : null" (click)="selectThread(t.id)">
                  <div class="flex items-start gap-2">
                    <span class="vote-mini">▲ {{ t.upvotes }}</span>
                    <div class="min-w-0 flex-1">
                      <p class="text-sm font-medium truncate">
                        @if (t.kind === 'question' && t.resolved) { <span style="color:var(--green-deep)">✓</span> }
                        {{ t.title }}
                      </p>
                      <p class="text-[11px] text-txt-mute">{{ t.authorName }} · {{ t.replyCount }} replies</p>
                    </div>
                  </div>
                </button>
              }
            </div>
          </div>
        }
      </div>

      <!-- Right: thread detail -->
      <div>
        @if (!activeThread()) {
          <div class="card grid place-items-center text-center" style="padding:60px 24px;min-height:300px">
            <div>
              <p class="font-display text-xl mb-1">Community</p>
              <p class="text-sm text-txt-soft">Pick a channel and thread, ask a question, or showcase a project.</p>
            </div>
          </div>
        }
        @if (activeThread(); as t) {
          <div class="card" style="padding:22px" [astaReveal]="0">
            <div class="flex items-start gap-4">
              <button class="vote" [class.vote-on]="t.hasUpvoted" (click)="upvoteThread(t.id)">
                <span>▲</span><b>{{ t.upvotes }}</b>
              </button>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="pill">{{ t.kind }}</span>
                  @if (t.kind === 'question' && t.resolved) { <span class="pill" style="color:var(--green-deep)">resolved ✓</span> }
                  @for (tag of t.tags; track tag) { <span class="tag">#{{ tag }}</span> }
                </div>
                <h2 class="font-display text-2xl mt-2">{{ t.title }}</h2>
                <p class="text-[11px] font-mono text-txt-mute mt-1">{{ t.authorName }} · {{ t.createdAt | date: 'medium' }}</p>
                @if (t.body) { <p class="text-sm text-txt-soft mt-3 whitespace-pre-wrap">{{ t.body }}</p> }
                @if (t.projectId) {
                  <a class="btn-soft inline-block mt-3" routerLink="/app/projects" [queryParams]="{ projectId: t.projectId }">🛠 View project: {{ t.projectTitle }} →</a>
                }
                @if (canDelete(t.authorId)) { <button class="text-[11px] text-txt-mute hover:text-[color:var(--danger)] mt-3 block" (click)="deleteThread(t.id)">Delete thread</button> }
              </div>
            </div>
          </div>

          <!-- replies -->
          <div class="mt-4 space-y-3">
            <p class="kicker">{{ replies().length }} {{ replies().length === 1 ? 'reply' : 'replies' }}</p>
            @for (r of replies(); track r.id) {
              <div class="card" style="padding:14px 16px" [style.borderColor]="r.isAnswer ? 'var(--green)' : null">
                <div class="flex items-start gap-3">
                  <button class="vote-sm" [class.vote-on]="r.hasUpvoted" (click)="upvoteReply(r.id)"><span>▲</span><b>{{ r.upvotes }}</b></button>
                  <div class="min-w-0 flex-1">
                    @if (r.isAnswer) { <span class="pill mb-1 inline-block" style="color:var(--green-deep)">✓ Accepted answer</span> }
                    <p class="text-sm text-txt-soft whitespace-pre-wrap">{{ r.body }}</p>
                    <div class="flex items-center gap-3 mt-1.5">
                      <span class="text-[11px] font-mono text-txt-mute">{{ r.authorName }} · {{ r.createdAt | date: 'short' }}</span>
                      @if (activeThread()!.kind === 'question' && !r.isAnswer && canAccept()) {
                        <button class="text-[11px] text-[color:var(--green-deep)] font-semibold" (click)="accept(r.id)">Accept answer</button>
                      }
                      @if (canDelete(r.authorId)) { <button class="text-[11px] text-txt-mute hover:text-[color:var(--danger)]" (click)="deleteReply(r.id)">Delete</button> }
                    </div>
                  </div>
                </div>
              </div>
            }
            <div class="card" style="padding:14px 16px">
              <textarea class="input mb-2" rows="3" placeholder="Write a reply…" [(ngModel)]="replyBody"></textarea>
              <button class="btn-go" [disabled]="!replyBody.trim() || replying()" (click)="sendReply()">{{ replying() ? 'Posting…' : 'Reply' }}</button>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .chip { font-family: var(--mono); font-size: 11px; text-transform: uppercase; padding: 3px 9px; border-radius: 100px; border: 1px solid var(--paper-3); background: var(--paper); color: var(--text-soft); }
      .chip-on { background: var(--ink); color: var(--paper); border-color: var(--ink); }
      .tag { font-size: 11px; padding: 1px 7px; border-radius: 6px; background: var(--paper-2); color: var(--text-mute); }
      .btn-go { display: inline-flex; align-items: center; gap: 6px; border-radius: 100px; padding: 8px 16px; font-size: 13px; font-weight: 600; color: var(--ink); background: var(--green); }
      .btn-go:disabled { opacity: .6; }
      .btn-soft { border-radius: 100px; padding: 7px 14px; font-size: 12px; font-weight: 600; color: var(--text-soft); background: var(--paper-2); border: 1px solid var(--paper-3); }
      .btn-soft:hover { border-color: var(--green); color: var(--green-deep); }
      .vote, .vote-sm { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; border-radius: 10px; border: 1px solid var(--paper-3); background: var(--paper); color: var(--text-soft); flex-shrink: 0; }
      .vote { width: 46px; padding: 8px 0; font-size: 13px; }
      .vote-sm { width: 38px; padding: 5px 0; font-size: 11px; }
      .vote-on { border-color: var(--green); color: var(--green-deep); background: oklch(0.80 0.16 150 / .12); }
      .vote-mini { font-family: var(--mono); font-size: 10px; color: var(--text-mute); flex-shrink: 0; padding-top: 2px; }
    `,
  ],
})
export class CommunityComponent implements OnInit {
  private readonly api = inject(CommunityService);
  private readonly projectApi = inject(ProjectService);
  private readonly auth = inject(AuthService);
  private readonly orgCtx = inject(OrgContextService);
  private readonly toast = inject(ToastService);

  readonly channels = signal<CommunityChannel[]>([]);
  readonly activeChannel = signal<CommunityChannel | null>(null);
  readonly threads = signal<CommunityThread[]>([]);
  readonly activeThread = signal<CommunityThread | null>(null);
  readonly replies = signal<CommunityReply[]>([]);
  readonly myProjects = signal<Project[]>([]);
  readonly composing = signal(false);
  readonly posting = signal(false);
  readonly replying = signal(false);
  readonly ntKind = signal<ThreadKind>('discussion');

  readonly threadKinds: ThreadKind[] = ['discussion', 'question', 'showcase'];
  private readonly meId = computed(() => this.auth.user()?.id ?? '');
  /** Org managers moderate (delete any). */
  readonly canModerate = computed(() => this.orgCtx.has('organization.manage'));

  ntTitle = '';
  ntBody = '';
  ntProjectId = '';
  replyBody = '';

  ngOnInit(): void {
    this.api.channels().subscribe({
      next: (chs) => {
        this.channels.set(chs);
        if (chs.length) this.selectChannel(chs[0]);
      },
    });
    this.projectApi.list().subscribe({ next: (p) => this.myProjects.set(p) });
  }

  selectChannel(c: CommunityChannel): void {
    this.activeChannel.set(c);
    this.activeThread.set(null);
    this.composing.set(false);
    this.ntKind.set(c.kind === 'help' ? 'question' : c.kind === 'showcase' ? 'showcase' : 'discussion');
    this.api.threads(c.id).subscribe({ next: (t) => this.threads.set(t) });
  }

  selectThread(id: string): void {
    this.api.thread(id).subscribe({
      next: (d) => {
        this.activeThread.set(d.thread);
        this.replies.set(d.replies);
      },
    });
  }

  postThread(): void {
    const ch = this.activeChannel();
    if (!ch || this.ntTitle.trim().length < 3) return;
    this.posting.set(true);
    this.api
      .createThread({
        channelId: ch.id,
        title: this.ntTitle.trim(),
        body: this.ntBody.trim() || undefined,
        kind: this.ntKind(),
        projectId: this.ntKind() === 'showcase' && this.ntProjectId ? this.ntProjectId : undefined,
      })
      .subscribe({
        next: (t) => {
          this.posting.set(false);
          this.composing.set(false);
          this.ntTitle = this.ntBody = this.ntProjectId = '';
          this.threads.update((list) => [t, ...list]);
          this.activeChannel.update((c) => (c ? { ...c, threadCount: c.threadCount + 1 } : c));
          this.selectThread(t.id);
          this.toast.success('Thread posted');
        },
        error: (e) => {
          this.posting.set(false);
          this.toast.error(e?.message ?? 'Could not post');
        },
      });
  }

  upvoteThread(id: string): void {
    this.api.upvoteThread(id).subscribe({
      next: (t) => {
        this.activeThread.set(t);
        this.threads.update((list) => list.map((x) => (x.id === id ? t : x)));
      },
    });
  }

  deleteThread(id: string): void {
    this.api.deleteThread(id).subscribe({
      next: () => {
        this.threads.update((list) => list.filter((x) => x.id !== id));
        this.activeThread.set(null);
        this.toast.success('Thread deleted');
      },
      error: (e) => this.toast.error(e?.message ?? 'Could not delete'),
    });
  }

  sendReply(): void {
    const t = this.activeThread();
    if (!t || !this.replyBody.trim()) return;
    this.replying.set(true);
    this.api.reply(t.id, this.replyBody.trim()).subscribe({
      next: (r) => {
        this.replying.set(false);
        this.replyBody = '';
        this.replies.update((list) => [...list, r]);
        this.activeThread.update((cur) => (cur ? { ...cur, replyCount: cur.replyCount + 1 } : cur));
      },
      error: () => this.replying.set(false),
    });
  }

  upvoteReply(id: string): void {
    this.api.upvoteReply(id).subscribe({ next: (r) => this.replies.update((list) => list.map((x) => (x.id === id ? r : x))) });
  }

  accept(id: string): void {
    this.api.acceptAnswer(id).subscribe({
      next: () => {
        this.replies.update((list) => list.map((r) => ({ ...r, isAnswer: r.id === id })));
        this.activeThread.update((cur) => (cur ? { ...cur, resolved: true } : cur));
        this.toast.success('Answer accepted');
      },
      error: (e) => this.toast.error(e?.message ?? 'Could not accept'),
    });
  }

  deleteReply(id: string): void {
    this.api.deleteReply(id).subscribe({
      next: () => {
        this.replies.update((list) => list.filter((x) => x.id !== id));
        this.activeThread.update((cur) => (cur ? { ...cur, replyCount: Math.max(0, cur.replyCount - 1) } : cur));
      },
      error: (e) => this.toast.error(e?.message ?? 'Could not delete'),
    });
  }

  canDelete(authorId: string): boolean {
    return this.canModerate() || authorId === this.meId();
  }

  /** Only the thread author (or a moderator) can accept an answer. */
  canAccept(): boolean {
    const t = this.activeThread();
    return !!t && (this.canModerate() || t.authorId === this.meId());
  }

  kindIcon(kind: string): string {
    return kind === 'help' ? '❓' : kind === 'showcase' ? '🏆' : '💬';
  }
}
