import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeToggleComponent } from '../shared/ui/theme-toggle.component';
import { DropdownComponent } from '../shared/ui/dropdown.component';
import { NotificationService } from '../core/services/notification.service';
import { VoiceActivationService } from '../core/services/voice-activation.service';
import { I18nService } from '../core/services/i18n.service';
import { TranslatePipe } from '../shared/pipes/translate.pipe';
import { Locale } from '../core/i18n/translations';

/** Sticky topbar: page title + streak chip + notifications + Ask Asta (DESIGN_SPEC §5). */
@Component({
  selector: 'asta-topbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ThemeToggleComponent, DropdownComponent, TranslatePipe],
  template: `
    <header
      class="sticky top-0 z-30 flex items-center gap-3 px-5 md:px-8"
      style="height:64px;background:var(--paper);border-bottom:1px solid var(--paper-3)"
    >
      <button class="lg:hidden text-txt-soft" (click)="toggleMenu.emit()" aria-label="Open menu">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
          stroke-width="1.8" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
      </button>

      <h1 class="text-[22px] md:text-[26px] font-display font-semibold flex-1 truncate">{{ title }}</h1>

      @if (!isAdmin) {
        <span class="pill" [title]="streak > 0 ? streak + '-day learning streak' : 'No active streak — learn today to start one'">
          <svg viewBox="0 0 24 24" width="14" height="14" [attr.fill]="streak > 0 ? 'var(--coral)' : 'var(--text-mute)'" stroke="none"
            [class.flame]="streak > 0">
            <path d="M12 2c1 4-2 5-2 8a4 4 0 0 0 8 0c0-1-.5-2-1-3 2 1 3 4 3 6a8 8 0 1 1-13-6c2-2 3-5 1-8 2 1 3 3 3 6Z" />
          </svg>
          {{ streak }}d
        </span>
      }

      @if (!isAdmin) {
        <a [routerLink]="['/app/tutor']" class="hidden sm:inline-flex">
          <span class="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-ink"
            style="background:var(--green)">{{ 'action.askAsta' | t }}</span>
        </a>
      }

      <!-- Language switcher (B15 · i18n) -->
      <asta-dropdown align="right">
        <button ddTrigger class="text-txt-soft hover:text-txt inline-flex items-center gap-1 text-sm font-mono uppercase" aria-label="Language">
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg>
          {{ i18n.locale() }}
        </button>
        <div style="min-width:160px">
          @for (l of i18n.locales; track l.code) {
            <button class="dd-item" [style.color]="i18n.locale() === l.code ? 'var(--green-deep)' : null" (click)="setLocale(l.code)">
              {{ l.label }} <span class="text-xs text-txt-mute">· {{ l.english }}</span>
            </button>
          }
        </div>
      </asta-dropdown>

      @if (voice.supported) {
        <button class="text-txt-soft hover:text-txt relative" (click)="voice.activate()"
          title="Talk to Asta (⌘⇧A)" aria-label="Talk to Asta">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
            stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
          @if (voice.wakeEnabled()) {
            <span class="absolute -top-0.5 -right-0.5 rounded-full" style="width:7px;height:7px;background:var(--green);box-shadow:0 0 6px var(--green)"></span>
          }
        </button>
      }

      <asta-theme-toggle />

      <asta-dropdown align="right">
        <button ddTrigger class="relative text-txt-soft hover:text-txt" aria-label="Notifications">
          <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor"
            stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
          </svg>
          @if (notify.unread() > 0) {
            <span class="absolute -top-1.5 -right-1.5 grid place-items-center text-[10px] font-semibold rounded-full text-ink"
              style="min-width:16px;height:16px;padding:0 4px;background:var(--coral)">{{ notify.unread() }}</span>
          }
        </button>
        <div style="min-width:300px;max-width:340px">
          <div class="flex items-center justify-between px-2.5 py-2">
            <span class="font-mono text-[11px] uppercase tracking-wider text-txt-mute">{{ 'notifications.title' | t }}</span>
            @if (notify.unread() > 0) {
              <button class="text-[11px] text-txt-mute hover:text-txt" (click)="notify.markAllRead()">{{ 'action.markAllRead' | t }}</button>
            }
          </div>
          @if (notify.items().length === 0) {
            <div class="px-2.5 py-6 text-center text-sm text-txt-mute">{{ 'notifications.empty' | t }}</div>
          }
          <div style="max-height:340px;overflow:auto">
            @for (n of notify.items(); track n.id) {
              <button class="dd-item" style="align-items:flex-start;flex-direction:column;gap:2px"
                [style.opacity]="n.read ? '0.6' : '1'" (click)="notify.markRead(n.id)">
                <span class="flex items-center gap-2" style="font-weight:500;color:var(--text)">
                  @if (!n.read) { <span class="rounded-full" style="width:6px;height:6px;background:var(--green)"></span> }
                  {{ n.title }}
                </span>
                @if (n.body) { <span class="text-xs text-txt-mute" style="white-space:normal">{{ n.body }}</span> }
              </button>
            }
          </div>
        </div>
      </asta-dropdown>
    </header>
  `,
})
export class TopbarComponent implements OnInit {
  @Input() title = '';
  @Input() streak = 0;
  @Input() isAdmin = false;
  @Output() toggleMenu = new EventEmitter<void>();

  readonly notify = inject(NotificationService);
  readonly voice = inject(VoiceActivationService);
  readonly i18n = inject(I18nService);

  ngOnInit(): void {
    this.notify.load();
  }

  setLocale(locale: Locale): void {
    this.i18n.setLocale(locale);
  }
}
