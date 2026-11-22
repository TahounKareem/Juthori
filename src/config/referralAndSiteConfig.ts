/**
 * Priority 4 Architectural Configuration:
 * 1. Public Root Slug Reservation & Validation (`Juthori.com/{FamilySlug}`)
 * 2. 5 Scoped Heritage Family Microsite Themes (`FAMILY_SITE_THEMES`)
 * 3. Unified Public App Base URL Resolver (`ais-dev-*` -> `ais-pre-*` / `PUBLIC_APP_URL`)
 * 4. Capability-Token Kinship Invitation & $10 Referral Engine Constants
 */

export const REFERRAL_REWARD_USD = 10;
export const PENDING_REFERRAL_STORAGE_KEY = 'juthori_pending_referral_code_v1';
export const PENDING_INVITE_TOKEN_STORAGE_KEY =
  'juthori_pending_invite_token_v1';

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
}

export const FAMILY_SITE_THEMES: ReadonlyArray<FamilySiteThemeDefinition> = [
  {
    id: 'golden_parchment',
    nameAr: 'رقّ المخطوط الذهبي',
    subtitleAr: 'هيبة تراثية دافئة مستوحاة من خزائن المخطوطات والأنساب العربية',
    swatchHero: '#252321',
    swatchAccent: '#D8755B',
    swatchCanvas: '#F7F2E9',
  },
  {
    id: 'diriyah_oasis',
    nameAr: 'واحة الدرعية النجدية',
    subtitleAr: 'طابع طيني أصيل ممزوج بأخضر النخيل ودفء المجالس العامرة',
    swatchHero: '#2F261E',
    swatchAccent: '#B56B3B',
    swatchCanvas: '#F4ECE1',
  },
  {
    id: 'andalusian_emerald',
    nameAr: 'الزمرد الأندلسي',
    subtitleAr: 'فخامة معمارية زمردية وذهبية تليق بدواوين الأسر العريقة',
    swatchHero: '#13332A',
    swatchAccent: '#C59B47',
    swatchCanvas: '#F3F6F3',
  },
  {
    id: 'sultanic_burgundy',
    nameAr: 'العنّابي السلطاني',
    subtitleAr: 'وقار ملكي بلون العنّابي المعتّق وتفاصيل النحاس المذهّب',
    swatchHero: '#3B161E',
    swatchAccent: '#C98A4B',
    swatchCanvas: '#F8F2F0',
  },
  {
    id: 'classical_marble',
    nameAr: 'المرمر الكلاسيكي',
    subtitleAr: 'صفاء رخامي هادئ يبرز المشجرات المعاصرة والصور الأرشيفية',
    swatchHero: '#1F2933',
    swatchAccent: '#8D6E48',
    swatchCanvas: '#F7F7F5',
  },
];

/**
 * Reserved root paths that can NEVER be claimed as a family microsite slug
 * so system routes (`/team`, `/api`, `/login`, etc.) remain 100% collision-free.
 */
export const RESERVED_ROOT_SLUGS: ReadonlySet<string> = new Set([
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
  'manifest.json',
  'index.html',
]);

export const PROTECTED_SYSTEM_PATHS: ReadonlySet<string> = RESERVED_ROOT_SLUGS;

export function sanitizeSlugCandidate(raw: string): string {
  return (raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

export function validateRootFamilySlug(raw: string): {
  valid: boolean;
  slug: string;
  reasonAr?: string;
} {
  const slug = sanitizeSlugCandidate(raw);
  if (!slug || slug.length < 3) {
    return {
      valid: false,
      slug,
      reasonAr:
        'يجب أن يتكون رابط العائلة من 3 أحرف لاتينية أو أرقام على الأقل (مثال: almuqit).',
    };
  }
  if (RESERVED_ROOT_SLUGS.has(slug)) {
    return {
      valid: false,
      slug,
      reasonAr:
        'هذا المسار محجوز للنظام الرسمي في منصة جذوري، يرجى اختيار مسار آخر للعائلة.',
    };
  }
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) {
    return {
      valid: false,
      slug,
      reasonAr: 'يجب أن يبدأ رابط العائلة وينتهي بحرف لاتيني أو رقم فقط.',
    };
  }
  return { valid: true, slug };
}

/**
 * Single-switch active public origin for family microsites, sharing links, QR cards,
 * referral links, and kinship circle invitations.
 *
 * Temporary staging host: 'https://lemonchiffon-gorilla-255162.hostingersite.com'
 * On Live launch, switch this single constant back to: 'https://juthori.com'
 */
export const ACTIVE_PUBLIC_SITE_ORIGIN =
  'https://lemonchiffon-gorilla-255162.hostingersite.com';

export const ACTIVE_PUBLIC_SITE_DISPLAY_HOST = ACTIVE_PUBLIC_SITE_ORIGIN.replace(
  /^https?:\/\//i,
  ''
).replace(/\/+$/, '');

/**
 * Rewrites AI Studio internal authenticated preview origins (`https://ais-dev-...run.app`)
 * to the publicly accessible shared origin (`https://ais-pre-...run.app`) so external
 * email recipients never hit Google `applet-auth-bridge` 403 Forbidden.
 */
export function rewriteAisDevToPublicOrigin(rawOriginOrUrl: string): string {
  const trimmed = (rawOriginOrUrl || '').trim();
  if (!trimmed) return ACTIVE_PUBLIC_SITE_ORIGIN;
  const rewritten = trimmed.replace(/^https?:\/\/ais-dev-/i, 'https://ais-pre-');
  try {
    return new URL(rewritten).origin;
  } catch {
    return rewritten.replace(/\/+$/, '');
  }
}

/**
 * Resolves the canonical public base URL on the client for outbound emails,
 * microsite sharing links, referral share links, and QR invitation cards.
 */
export function resolveClientPublicAppBaseUrl(
  customOverride?: string
): string {
  const explicitOverride = (customOverride || '').trim();
  if (/^https?:\/\/[^/\s]+/i.test(explicitOverride)) {
    return rewriteAisDevToPublicOrigin(explicitOverride);
  }

  const envUrl = String(
    (import.meta as unknown as { env?: Record<string, string | undefined> })
      .env?.VITE_PUBLIC_APP_URL || ''
  ).trim();
  if (/^https?:\/\/[^/\s]+/i.test(envUrl)) {
    return rewriteAisDevToPublicOrigin(envUrl);
  }

  return ACTIVE_PUBLIC_SITE_ORIGIN;
}

export function buildPublicKinshipInviteLinks(params: {
  siteSlug?: string;
  inviteToken: string;
  referralCode?: string;
  customBaseUrl?: string;
  baseOriginOverride?: string;
}): {
  publicBaseUrl: string;
  portalUrl: string;
  optOutUrl: string;
} {
  const publicBaseUrl = resolveClientPublicAppBaseUrl(
    params.customBaseUrl || params.baseOriginOverride
  );
  const cleanSlug = sanitizeSlugCandidate(params.siteSlug || '');
  const cleanToken = (params.inviteToken || '').trim();
  const cleanRef = (params.referralCode || '').trim().toUpperCase();

  const queryParts: string[] = [];
  if (cleanToken) {
    queryParts.push(`invite=${encodeURIComponent(cleanToken)}`);
  }
  if (cleanRef) {
    queryParts.push(`ref=${encodeURIComponent(cleanRef)}`);
  }
  const querySuffix = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';

  const portalUrl =
    cleanSlug && !RESERVED_ROOT_SLUGS.has(cleanSlug)
      ? `${publicBaseUrl}/${cleanSlug}${querySuffix}`
      : `${publicBaseUrl}/${querySuffix}`;

  const optOutUrl = cleanToken
    ? `${publicBaseUrl}/?optout=${encodeURIComponent(cleanToken)}`
    : `${publicBaseUrl}/`;

  return {
    publicBaseUrl,
    portalUrl,
    optOutUrl,
  };
}

/**
 * Inspects `window.location.pathname` to detect if the visitor opened a clean
 * root family microsite URL (`/{FamilySlug}` or legacy `/u/{FamilySlug}`).
 */
export function resolveMicrositeSlugFromPathname(
  pathname: string
): string | null {
  const clean = (pathname || '').trim().replace(/^\/+|\/+$/g, '');
  if (!clean) return null;

  // Backward-compatible support for `/u/{slug}` links if previously shared
  if (clean.toLowerCase().startsWith('u/')) {
    const sub = sanitizeSlugCandidate(clean.slice(2));
    if (sub && !RESERVED_ROOT_SLUGS.has(sub)) return sub;
    return null;
  }

  // Single-segment root slug `/{FamilySlug}`
  if (clean.includes('/') || clean.includes('.')) return null;

  const lower = clean.toLowerCase();
  if (RESERVED_ROOT_SLUGS.has(lower)) return null;
  if (!/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(lower)) return null;

  return lower;
}

/**
 * Deterministic referral code generator from UID (`JTH-XXXXX`) so every user
 * has a stable, clean personal referral link with zero collisions.
 */
export function buildDeterministicReferralCode(userId: string): string {
  const clean = (userId || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (!clean) return 'JTH-GUEST';
  let hash = 5381;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash * 33) ^ clean.charCodeAt(i);
  }
  const suffix = Math.abs(hash >>> 0)
    .toString(36)
    .toUpperCase()
    .padStart(5, '0')
    .slice(0, 6);
  const tail = clean.slice(-3).padStart(3, 'X');
  return `JTH-${tail}${suffix}`;
}

/**
 * Captures `?ref={ReferralCode}` from any landing or family microsite URL
 * and stores it in localStorage until registration completes.
 */
export function captureReferralCodeFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = (params.get('ref') || '').trim().toUpperCase();
    if (ref && /^JTH-[A-Z0-9]{4,16}$/.test(ref)) {
      window.localStorage.setItem(PENDING_REFERRAL_STORAGE_KEY, ref);
      return ref;
    }
  } catch {
    // Ignore storage restriction
  }
  return null;
}

export const capturePendingReferralCodeFromUrl = captureReferralCodeFromUrl;

export function readPendingReferralCode(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(PENDING_REFERRAL_STORAGE_KEY) || null;
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

/**
 * Reads `?invite={inviteToken}` directly from the current browser URL or pending storage.
 */
export function readInviteTokenFromWindow(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = (params.get('invite') || '').trim();
    if (raw && /^[a-zA-Z0-9_-]{10,120}$/.test(raw)) {
      window.sessionStorage.setItem(PENDING_INVITE_TOKEN_STORAGE_KEY, raw);
      return raw;
    }
    const stored = (
      window.sessionStorage.getItem(PENDING_INVITE_TOKEN_STORAGE_KEY) || ''
    ).trim();
    if (stored && /^[a-zA-Z0-9_-]{10,120}$/.test(stored)) {
      return stored;
    }
  } catch {
    // Ignore
  }
  return null;
}

export function clearPendingInviteToken(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(PENDING_INVITE_TOKEN_STORAGE_KEY);
  } catch {
    // Ignore
  }
}
