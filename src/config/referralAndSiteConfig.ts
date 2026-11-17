export const REFERRAL_REWARD_USD = 10;

export const PENDING_REFERRAL_STORAGE_KEY = 'juthori_pending_referral_code_v1';

export type FamilySiteThemeId =
  | 'golden_parchment'
  | 'diriyah_oasis'
  | 'andalusian_emerald'
  | 'sultanic_burgundy'
  | 'classical_marble';

export interface FamilySiteThemeDefinition {
  id: FamilySiteThemeId;
  nameAr: string;
  subtitleAr: string;
  swatchHero: string;
  swatchAccent: string;
  swatchCanvas: string;
  previewSwatches: [string, string, string, string];
  isDarkHeader?: boolean;
}

export const FAMILY_SITE_THEMES: FamilySiteThemeDefinition[] = [
  {
    id: 'golden_parchment',
    nameAr: 'الرقيم الذهبي',
    subtitleAr: 'مخطوطة عاجية دافئة بلمسات نحاسية تراثية',
    swatchHero: '#231F1C',
    swatchAccent: '#9E6B27',
    swatchCanvas: '#FBF7EE',
    previewSwatches: ['#FBF7EE', '#231F1C', '#A67532', '#EFE6D5'],
  },
  {
    id: 'diriyah_oasis',
    nameAr: 'واحة الدرعية',
    subtitleAr: 'طين نجدي أصيل بظلال العرعر والواحات',
    swatchHero: '#2C211B',
    swatchAccent: '#B85D3B',
    swatchCanvas: '#F6EFE4',
    previewSwatches: ['#F6EFE4', '#2A211B', '#B85D3B', '#E8DAC6'],
  },
  {
    id: 'andalusian_emerald',
    nameAr: 'الزمرد الأندلسي',
    subtitleAr: 'بياض الرخام القرطبي مع أخضر السرو الملوكي',
    swatchHero: '#132A22',
    swatchAccent: '#1F5C48',
    swatchCanvas: '#F7F9F6',
    previewSwatches: ['#F7F9F6', '#172822', '#1F5C48', '#E3ECE7'],
  },
  {
    id: 'sultanic_burgundy',
    nameAr: 'الديوان السلطاني العنابي',
    subtitleAr: 'فخامة الدواوين السلطانية بالعنابي والذهب المعتق',
    swatchHero: '#2B1218',
    swatchAccent: '#7A2332',
    swatchCanvas: '#FAF5F3',
    previewSwatches: ['#FAF5F3', '#29151A', '#7A2332', '#EFE2DF'],
  },
  {
    id: 'classical_marble',
    nameAr: 'الرخام الكلاسيكي',
    subtitleAr: 'وقار متحفي ناصع بفواصل حجرية هادئة',
    swatchHero: '#18181B',
    swatchAccent: '#27272A',
    swatchCanvas: '#FAFAFA',
    previewSwatches: ['#FAFAFA', '#18181B', '#52525B', '#EAEAE8'],
  },
];

export const PROTECTED_SYSTEM_PATHS: ReadonlySet<string> = new Set([
  'team',
  'admin',
  'login',
  'signin',
  'signup',
  'register',
  'logout',
  'dashboard',
  'api',
  'wallet',
  'support',
  'help',
  'knowledge',
  'explorer',
  'lineage',
  'tree',
  'vault',
  'mysite',
  'community',
  'tickets',
  'terms',
  'privacy',
  'charter',
  'optout',
  'ref',
  'u',
  'site',
  'sites',
  'assets',
  'src',
  'public',
  'static',
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
  'manifest.json',
  'index.html',
]);

export function buildDeterministicReferralCode(userId: string): string {
  const clean = (userId || 'JTH')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
  let hash = 2166136261;
  for (let i = 0; i < clean.length; i += 1) {
    hash ^= clean.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const suffix = Math.abs(hash >>> 0)
    .toString(36)
    .toUpperCase()
    .padStart(5, '0')
    .slice(0, 5);
  const prefix = clean.slice(0, 4).padEnd(3, 'X');
  return `JTH-${prefix}${suffix}`;
}

export function capturePendingReferralFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const rawRef = (params.get('ref') || '').trim().toUpperCase();
    if (rawRef && /^JTH-[A-Z0-9]{4,16}$/.test(rawRef)) {
      window.localStorage.setItem(PENDING_REFERRAL_STORAGE_KEY, rawRef);
      return rawRef;
    }
  } catch {
    // Ignore storage errors
  }
  return readPendingReferralCode();
}

export const capturePendingReferralCodeFromUrl = capturePendingReferralFromUrl;

export function readPendingReferralCode(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const val = (
      window.localStorage.getItem(PENDING_REFERRAL_STORAGE_KEY) || ''
    )
      .trim()
      .toUpperCase();
    return val || null;
  } catch {
    return null;
  }
}

export function clearPendingReferralCode(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PENDING_REFERRAL_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

export function readOptOutTokenFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const token = (params.get('optout') || '').trim();
    if (token && /^[a-zA-Z0-9_-]{4,120}$/.test(token)) {
      return token;
    }
    return null;
  } catch {
    return null;
  }
}
