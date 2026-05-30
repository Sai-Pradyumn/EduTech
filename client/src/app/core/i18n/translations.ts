/**
 * i18n foundation (Phase 4 · B15). Lightweight runtime translation dictionaries — en / hi / te.
 * Hinglish is 🧱 (future). Keys are dotted; missing keys fall back to en, then to the key.
 * This is a scaffold: a representative set of shared UI strings is translated, and the rest
 * of the app keeps its literals until incrementally migrated to the `| t` pipe.
 */
export type Locale = 'en' | 'hi' | 'te';

export interface LocaleMeta {
  code: Locale;
  label: string; // native name
  english: string;
}

export const LOCALES: LocaleMeta[] = [
  { code: 'en', label: 'English', english: 'English' },
  { code: 'hi', label: 'हिन्दी', english: 'Hindi' },
  { code: 'te', label: 'తెలుగు', english: 'Telugu' },
];

export type TranslationKey =
  | 'nav.learn'
  | 'nav.account'
  | 'nav.workspace'
  | 'nav.manage'
  | 'action.askAsta'
  | 'action.markAllRead'
  | 'notifications.title'
  | 'notifications.empty'
  | 'common.streakSuffix'
  | 'common.language'
  | 'common.timezone';

type Dict = Record<TranslationKey, string>;

const en: Dict = {
  'nav.learn': 'Learn',
  'nav.account': 'Account',
  'nav.workspace': 'Workspace',
  'nav.manage': 'Manage',
  'action.askAsta': 'Ask Asta',
  'action.markAllRead': 'Mark all read',
  'notifications.title': 'Notifications',
  'notifications.empty': "You're all caught up.",
  'common.streakSuffix': 'd',
  'common.language': 'Language',
  'common.timezone': 'Timezone',
};

const hi: Dict = {
  'nav.learn': 'सीखें',
  'nav.account': 'खाता',
  'nav.workspace': 'कार्यक्षेत्र',
  'nav.manage': 'प्रबंधन',
  'action.askAsta': 'Asta से पूछें',
  'action.markAllRead': 'सभी पढ़ा हुआ करें',
  'notifications.title': 'सूचनाएँ',
  'notifications.empty': 'आप पूरी तरह अपडेट हैं।',
  'common.streakSuffix': 'दिन',
  'common.language': 'भाषा',
  'common.timezone': 'समय क्षेत्र',
};

const te: Dict = {
  'nav.learn': 'నేర్చుకోండి',
  'nav.account': 'ఖాతా',
  'nav.workspace': 'వర్క్‌స్పేస్',
  'nav.manage': 'నిర్వహణ',
  'action.askAsta': 'Asta ను అడగండి',
  'action.markAllRead': 'అన్నీ చదివినట్లు గుర్తించు',
  'notifications.title': 'నోటిఫికేషన్లు',
  'notifications.empty': 'మీరు అన్నీ చూశారు.',
  'common.streakSuffix': 'రో',
  'common.language': 'భాష',
  'common.timezone': 'టైమ్ జోన్',
};

export const TRANSLATIONS: Record<Locale, Dict> = { en, hi, te };
