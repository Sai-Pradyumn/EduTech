import {
  DEFAULT_CURRENCY_CODE,
  LOCALE_ID,
  Provider,
} from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeHi from '@angular/common/locales/hi';
import localeTe from '@angular/common/locales/te';
import { Locale } from './translations';

// Register the non-default locales' CLDR data so Angular's date/number/currency
// pipes can format for them. English is Angular's built-in default.
registerLocaleData(localeHi);
registerLocaleData(localeTe);

/** BCP-47 tag + default currency per app locale (Indian locales → INR). */
const LOCALE_META: Record<Locale, { tag: string; currency: string }> = {
  en: { tag: 'en-US', currency: 'USD' },
  hi: { tag: 'hi-IN', currency: 'INR' },
  te: { tag: 'te-IN', currency: 'INR' },
};

function storedLocale(): Locale {
  try {
    const v = localStorage.getItem('asta.lang') as Locale | null;
    if (v && v in LOCALE_META) return v;
  } catch {
    /* no localStorage → default */
  }
  return 'en';
}

/**
 * Binds Angular's `LOCALE_ID` and `DEFAULT_CURRENCY_CODE` to the learner's saved
 * language (Locale-formatting backlog · P3·M), so `| date`, `| number`, `| percent`
 * and `| currency` render in their locale — dd/MM vs MM/dd, digit grouping, ₹ vs $.
 * Set at bootstrap; a language switch takes effect on the next load (the UI strings
 * themselves switch live via the impure `| t` pipe).
 */
export function provideActiveLocale(): Provider[] {
  const meta = LOCALE_META[storedLocale()];
  return [
    { provide: LOCALE_ID, useValue: meta.tag },
    { provide: DEFAULT_CURRENCY_CODE, useValue: meta.currency },
  ];
}
