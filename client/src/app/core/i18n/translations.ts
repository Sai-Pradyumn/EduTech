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
  | 'nav.outcome'
  | 'nav.ecosystem'
  | 'nav.platform'
  | 'action.askAsta'
  | 'action.markAllRead'
  | 'action.save'
  | 'action.cancel'
  | 'action.delete'
  | 'action.retry'
  | 'action.search'
  | 'action.back'
  | 'action.showMore'
  | 'action.seeAll'
  | 'state.loading'
  | 'state.empty'
  | 'state.error'
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
  'nav.outcome': 'Outcome',
  'nav.ecosystem': 'Ecosystem',
  'nav.platform': 'Platform',
  'action.askAsta': 'Ask Asta',
  'action.markAllRead': 'Mark all read',
  'action.save': 'Save',
  'action.cancel': 'Cancel',
  'action.delete': 'Delete',
  'action.retry': 'Retry',
  'action.search': 'Search',
  'action.back': 'Back',
  'action.showMore': 'Show more',
  'action.seeAll': 'See all',
  'state.loading': 'Loading…',
  'state.empty': 'Nothing here yet.',
  'state.error': 'Something went wrong.',
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
  'nav.outcome': 'परिणाम',
  'nav.ecosystem': 'इकोसिस्टम',
  'nav.platform': 'प्लेटफ़ॉर्म',
  'action.askAsta': 'Asta से पूछें',
  'action.markAllRead': 'सभी पढ़ा हुआ करें',
  'action.save': 'सहेजें',
  'action.cancel': 'रद्द करें',
  'action.delete': 'हटाएँ',
  'action.retry': 'पुनः प्रयास करें',
  'action.search': 'खोजें',
  'action.back': 'वापस',
  'action.showMore': 'और दिखाएँ',
  'action.seeAll': 'सभी देखें',
  'state.loading': 'लोड हो रहा है…',
  'state.empty': 'अभी यहाँ कुछ नहीं है।',
  'state.error': 'कुछ गलत हो गया।',
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
  'nav.outcome': 'ఫలితం',
  'nav.ecosystem': 'ఎకోసిస్టమ్',
  'nav.platform': 'ప్లాట్‌ఫారమ్',
  'action.askAsta': 'Asta ను అడగండి',
  'action.markAllRead': 'అన్నీ చదివినట్లు గుర్తించు',
  'action.save': 'సేవ్ చేయి',
  'action.cancel': 'రద్దు చేయి',
  'action.delete': 'తొలగించు',
  'action.retry': 'మళ్ళీ ప్రయత్నించు',
  'action.search': 'వెతకండి',
  'action.back': 'వెనుకకు',
  'action.showMore': 'మరిన్ని చూపించు',
  'action.seeAll': 'అన్నీ చూడండి',
  'state.loading': 'లోడ్ అవుతోంది…',
  'state.empty': 'ఇక్కడ ఇంకా ఏమీ లేదు.',
  'state.error': 'ఏదో తప్పు జరిగింది.',
  'notifications.title': 'నోటిఫికేషన్లు',
  'notifications.empty': 'మీరు అన్నీ చూశారు.',
  'common.streakSuffix': 'రో',
  'common.language': 'భాష',
  'common.timezone': 'టైమ్ జోన్',
};

export const TRANSLATIONS: Record<Locale, Dict> = { en, hi, te };
