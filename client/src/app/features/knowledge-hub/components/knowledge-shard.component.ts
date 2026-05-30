import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { KnowledgeDoc } from '../../../core/models';

/**
 * Compact "knowledge shard" — a single document card in the Knowledge Vault.
 *
 * Presentational only: it renders a file-type glyph, the title, an ingestion
 * status pill, the chunk/index count when available, optional tags/warnings,
 * and the action affordances (summary / flashcards / delete / retry-on-failed).
 *
 * It NEVER calls services. Every interaction is surfaced as an @Output so the
 * parent (KnowledgeHubComponent) keeps owning the real handlers.
 */
@Component({
  selector: 'asta-knowledge-shard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (doc; as d) {
      <div class="shard" [class.shard-on]="selected" [attr.data-s]="d.status">
        <div class="flex items-start gap-2.5">
          <input
            type="checkbox"
            class="mt-0.5 shrink-0"
            [checked]="selected"
            [disabled]="d.status !== 'ready'"
            (change)="select.emit(d)"
            [attr.aria-label]="'Include ' + d.title + ' in question scope'"
          />

          <span class="glyph shrink-0" [attr.data-kind]="kind()" aria-hidden="true">
            <!-- file glyph: a generic doc; the data-kind tints it -->
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </span>

          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium truncate" [title]="d.title">{{ d.title }}</p>

            <div class="flex items-center flex-wrap gap-2 mt-1">
              <span class="pill status" [attr.data-s]="d.status">
                @if (processing()) { <span class="spin" aria-hidden="true"></span> }
                {{ statusLabel(d) }}
              </span>
              @if (d.status === 'ready' && d.chunkCount > 0) {
                <span class="text-[11px] text-txt-mute">{{ d.chunkCount }} chunks</span>
              }
              @if (kindLabel(); as kl) {
                <span class="text-[10px] uppercase tracking-wide text-txt-mute font-mono">{{ kl }}</span>
              }
            </div>

            @if (d.tags.length) {
              <div class="flex flex-wrap gap-1 mt-1.5">
                @for (t of d.tags.slice(0, 4); track t) { <span class="tag">{{ t }}</span> }
              </div>
            }

            @if (d.status === 'failed') {
              <p class="text-[11px] mt-1.5" style="color:var(--coral-deep)">
                {{ d.error || 'Ingestion failed — this document could not be indexed.' }}
              </p>
            }
            @if (d.warnings.length) {
              <p class="text-[11px] mt-1 text-txt-mute">⚠ {{ d.warnings[0] }}</p>
            }

            <div class="flex flex-wrap gap-2 mt-2">
              @if (d.status === 'ready') {
                <button type="button" class="mini" (click)="summary.emit(d)">Summary</button>
                <button type="button" class="mini" (click)="flashcards.emit(d)">Flashcards</button>
              }
              @if (d.status === 'failed') {
                <button type="button" class="mini retry" (click)="retry.emit(d)">Retry <span class="arr">→</span></button>
              }
              <button type="button" class="mini" style="color:var(--coral-deep)" (click)="delete.emit(d)">Delete</button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .shard { border: 1px solid var(--paper-3); border-radius: 12px; padding: 10px 12px; transition: border-color .15s, background .15s; }
      .shard-on { border-color: var(--green); background: oklch(0.80 0.16 150 / .06); }
      .shard[data-s='failed'] { border-color: color-mix(in oklch, var(--coral) 45%, var(--paper-3)); }

      .glyph { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 8px; background: var(--paper-2); color: var(--text-soft); }
      .glyph[data-kind='pdf'] { color: var(--coral-deep); background: oklch(0.72 0.17 25 / .12); }
      .glyph[data-kind='doc'] { color: var(--peri-deep); background: oklch(0.70 0.13 265 / .12); }
      .glyph[data-kind='md'], .glyph[data-kind='text'] { color: var(--green-deep); background: oklch(0.80 0.16 150 / .12); }
      .glyph[data-kind='data'] { color: var(--text-soft); }

      .pill.status { font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: .04em; padding: 1px 7px; border-radius: 100px; background: var(--paper-2); color: var(--text-soft); display: inline-flex; align-items: center; gap: 5px; }
      .pill.status[data-s='ready'] { background: oklch(0.80 0.16 150 / .18); color: var(--green-deep); }
      .pill.status[data-s='failed'] { background: oklch(0.72 0.17 25 / .16); color: var(--coral-deep); }

      .spin { width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid currentColor; border-top-color: transparent; animation: shardSpin .7s linear infinite; }
      @keyframes shardSpin { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) { .spin { animation: none; } }

      .tag { font-size: 10px; padding: 1px 6px; border-radius: 6px; background: var(--paper-2); color: var(--text-mute); }
      .mini { font-size: 11px; font-weight: 600; color: var(--text-soft); }
      .mini:hover { color: var(--text); }
      .mini.retry { color: var(--coral-deep); }
      .arr { display: inline-block; transition: transform .15s; }
      .mini.retry:hover .arr { transform: translateX(3px); }
    `,
  ],
})
export class KnowledgeShardComponent {
  @Input({ required: true }) doc!: KnowledgeDoc;
  @Input() selected = false;

  /** Toggle this doc in the question scope (parent owns the Set). */
  @Output() select = new EventEmitter<KnowledgeDoc>();
  @Output() summary = new EventEmitter<KnowledgeDoc>();
  @Output() flashcards = new EventEmitter<KnowledgeDoc>();
  @Output() delete = new EventEmitter<KnowledgeDoc>();
  /** Failed ingestion — parent decides how to retry; the shard never calls services. */
  @Output() retry = new EventEmitter<KnowledgeDoc>();

  processing(): boolean {
    const s = this.doc?.status;
    return s === 'pending' || s === 'parsing' || s === 'chunking' || s === 'embedding';
  }

  statusLabel(d: KnowledgeDoc): string {
    if (d.status === 'ready') return 'indexed';
    if (d.status === 'failed') return 'failed';
    if (d.status === 'pending') return 'queued';
    return d.status; // parsing / chunking / embedding
  }

  /** Coarse file kind derived from mimeType/source — purely for the glyph tint. */
  kind(): 'pdf' | 'doc' | 'md' | 'text' | 'data' {
    const m = (this.doc?.mimeType || '').toLowerCase();
    const src = (this.doc?.source || '').toLowerCase();
    if (m.includes('pdf') || src.endsWith('.pdf')) return 'pdf';
    if (m.includes('word') || m.includes('officedocument') || src.endsWith('.docx') || src.endsWith('.doc')) return 'doc';
    if (m.includes('json') || src.endsWith('.json')) return 'data';
    if (src.endsWith('.md') || src.endsWith('.markdown') || m.includes('markdown')) return 'md';
    return 'text';
  }

  kindLabel(): string | null {
    switch (this.kind()) {
      case 'pdf':
        return 'PDF';
      case 'doc':
        return 'DOCX';
      case 'data':
        return 'JSON';
      case 'md':
        return 'MD';
      default:
        return null;
    }
  }
}
