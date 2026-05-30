import { Injectable, computed, signal } from '@angular/core';
import { Locale, LOCALES, TRANSLATIONS, TranslationKey } from '../i18n/translations';

const LANG_KEY = 'asta.lang';
const TZ_KEY = 'asta.tz';

/**
 * Runtime i18n + locale settings (Phase 4 · B15). Holds the active UI locale and timezone
 * (persisted to localStorage), exposes `t(key)` lookup with en→key fallback, and keeps the
 * document <html lang> in sync. Currency formatting is 🧱 / future.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly locales = LOCALES;
  readonly locale = signal<Locale>(this.readLocale());
  readonly timezone = signal<string>(this.readTimezone());
  readonly localeMeta = computed(() => this.locales.find((l) => l.code === this.locale()) ?? this.locales[0]);

  constructor() {
    this.applyHtmlLang(this.locale());
  }

  /** Translate a key for the active locale; falls back to English, then the raw key. */
  t(key: TranslationKey): string {
    const active = TRANSLATIONS[this.locale()];
    return active?.[key] ?? TRANSLATIONS.en[key] ?? key;
  }

  setLocale(locale: Locale): void {
    this.locale.set(locale);
    try {
      localStorage.setItem(LANG_KEY, locale);
    } catch {
      /* ignore */
    }
    this.applyHtmlLang(locale);
  }

  setTimezone(tz: string): void {
    this.timezone.set(tz);
    try {
      localStorage.setItem(TZ_KEY, tz);
    } catch {
      /* ignore */
    }
  }

  /** Common IANA timezones offered in the settings picker. */
  readonly timezones = [
    'Asia/Kolkata',
    'Asia/Dubai',
    'Asia/Singapore',
    'Europe/London',
    'America/New_York',
    'America/Los_Angeles',
    'UTC',
  ];

  private readLocale(): Locale {
    try {
      const stored = localStorage.getItem(LANG_KEY) as Locale | null;
      if (stored && this.locales.some((l) => l.code === stored)) return stored;
    } catch {
      /* ignore */
    }
    return 'en';
  }

  private readTimezone(): string {
    try {
      return localStorage.getItem(TZ_KEY) || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  }

  private applyHtmlLang(locale: Locale): void {
    try {
      document.documentElement.setAttribute('lang', locale);
    } catch {
      /* ignore */
    }
  }
}
