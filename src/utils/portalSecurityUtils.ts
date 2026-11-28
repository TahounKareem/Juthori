import { DashboardStateMode, LineageSearchResult } from '../types/juthori';
import { normalizeSubscriptionPlanId } from '../config/subscriptionPlans';
import type { PublicMicrositeData, SiteAccessMode } from '../services/priority4Service';

export const SESSION_AUTHORIZED_EMAIL_KEY = 'juthori_microsite_auth_email_v1';
const LEGACY_PASSCODE_SESSION_PREFIX = 'juthori_microsite_passcode_v1:';

/**
 * Pure deterministic SHA-256 (returns 64-char lowercase hex).
 * Works synchronously in all browser contexts and Node.js test environments.
 */
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function utf8Encode(input: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(input);
  }
  const encoded: number[] = [];
  for (let i = 0; i < input.length; i += 1) {
    let codePoint = input.charCodeAt(i);
    if (codePoint < 0x80) {
      encoded.push(codePoint);
    } else if (codePoint < 0x800) {
      encoded.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else if ((codePoint & 0xfc00) === 0xd800 && i + 1 < input.length) {
      i += 1;
      codePoint = 0x10000 + (((codePoint & 0x3ff) << 10) | (input.charCodeAt(i) & 0x3ff));
      encoded.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    } else {
      encoded.push(
        0xe0 | (codePoint >> 12),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    }
  }
  return new Uint8Array(encoded);
}

export function sha256Hex(message: string): string {
  const bytes = utf8Encode(message);
  const bitLen = bytes.length * 8;
  const paddedLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;

  const view = new DataView(padded.buffer);
  const highBits = Math.floor(bitLen / 0x100000000);
  const lowBits = bitLen >>> 0;
  view.setUint32(paddedLen - 8, highBits, false);
  view.setUint32(paddedLen - 4, lowBits, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i += 1) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((val) => val.toString(16).padStart(8, '0'))
    .join('');
}

/**
 * Clears session-scoped portal identity markers and purges any retired legacy keys.
 */
export function clearAllPortalSessionUnlocks(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(SESSION_AUTHORIZED_EMAIL_KEY);
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const key = window.sessionStorage.key(i);
      if (key && key.startsWith(LEGACY_PASSCODE_SESSION_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => window.sessionStorage.removeItem(key));
  } catch {
    // ignore
  }
}

export interface PortalAccessGateInput {
  isPreviewMode: boolean;
  siteData: Partial<
    Pick<
      PublicMicrositeData,
      | 'isPublished'
      | 'siteAccessMode'
      | 'accessGateMode'
      | 'ownerId'
      | 'ownerEmail'
      | 'whitelistedEmails'
      | 'whitelistedUids'
      | 'privacyConfig'
    >
  > | null;
  viewerUid?: string | null;
  viewerEmail?: string | null;
}

export interface PortalAccessGateDecision {
  isRestrictedSite: boolean;
  isOwner: boolean;
  isAuthorizedMember: boolean;
  shouldShowRestrictedGate: boolean;
  reason: 'preview' | 'public_open' | 'owner' | 'circle_member' | 'blocked_private' | 'blocked_unpublished';
}

/**
 * Strict Identity-Based Access Gate evaluator (Zero Passcodes).
 * - PUBLIC / UNLISTED: open to visitors.
 * - PRIVATE_WHITELIST: strictly closed unless viewer is the signed-in owner or an approved circle member.
 */
export function evaluatePublicMicrositeAccessGate(input: PortalAccessGateInput): PortalAccessGateDecision {
  const { isPreviewMode, siteData, viewerUid, viewerEmail } = input;
  if (isPreviewMode) {
    return {
      isRestrictedSite: false,
      isOwner: true,
      isAuthorizedMember: true,
      shouldShowRestrictedGate: false,
      reason: 'preview',
    };
  }

  if (!siteData) {
    return {
      isRestrictedSite: true,
      isOwner: false,
      isAuthorizedMember: false,
      shouldShowRestrictedGate: true,
      reason: 'blocked_private',
    };
  }

  const normalizedViewerUid = (viewerUid || '').trim();
  const normalizedViewerEmail = (viewerEmail || '').trim().toLowerCase();

  const isOwner = Boolean(
    normalizedViewerUid &&
    ((siteData.ownerId && normalizedViewerUid === siteData.ownerId) ||
      (normalizedViewerEmail && siteData.ownerEmail && normalizedViewerEmail === siteData.ownerEmail.trim().toLowerCase())),
  );

  const whitelistedUids = Array.isArray(siteData.whitelistedUids) ? siteData.whitelistedUids : [];
  const whitelistedEmails = Array.isArray(siteData.whitelistedEmails)
    ? siteData.whitelistedEmails.map((e) => e.trim().toLowerCase())
    : [];

  const isAuthorizedMember = Boolean(
    isOwner ||
    (normalizedViewerUid && whitelistedUids.includes(normalizedViewerUid)) ||
    (normalizedViewerUid && normalizedViewerEmail && whitelistedEmails.includes(normalizedViewerEmail)),
  );

  const siteMode: SiteAccessMode = siteData.siteAccessMode || 'PUBLIC';
  const gateMode = siteData.accessGateMode;

  const isRestrictedSite = Boolean(
    siteData.isPublished === false ||
    siteMode === 'PRIVATE_WHITELIST' ||
    gateMode === 'PRIVATE_WHITELIST',
  );

  if (!isRestrictedSite) {
    return {
      isRestrictedSite: false,
      isOwner,
      isAuthorizedMember,
      shouldShowRestrictedGate: false,
      reason: 'public_open',
    };
  }

  if (siteData.isPublished === false) {
    if (isOwner) {
      return {
        isRestrictedSite: true,
        isOwner: true,
        isAuthorizedMember: true,
        shouldShowRestrictedGate: false,
        reason: 'owner',
      };
    }
    return {
      isRestrictedSite: true,
      isOwner: false,
      isAuthorizedMember: false,
      shouldShowRestrictedGate: true,
      reason: 'blocked_unpublished',
    };
  }

  if (isOwner) {
    return {
      isRestrictedSite: true,
      isOwner: true,
      isAuthorizedMember: true,
      shouldShowRestrictedGate: false,
      reason: 'owner',
    };
  }

  if (isAuthorizedMember) {
    return {
      isRestrictedSite: true,
      isOwner: false,
      isAuthorizedMember: true,
      shouldShowRestrictedGate: false,
      reason: 'circle_member',
    };
  }

  return {
    isRestrictedSite: true,
    isOwner: false,
    isAuthorizedMember: false,
    shouldShowRestrictedGate: true,
    reason: 'blocked_private',
  };
}

export interface TierResolutionProfileInput {
  subscriptionTier?: string | null;
  subscriptionStatus?: string | null;
  isRootUnlocked?: boolean | null;
  isLineageVerified?: boolean | null;
  paidRevenueUsd?: number | null;
}

/**
 * Pure tier resolver that NEVER allows a free/invited account to inherit
 * a previous user's AnnualVip or BasicRoot state.
 */
export function resolveCustomerTierStateMode(
  profile: TierResolutionProfileInput | null | undefined,
  matchedLineage?: {
    matched?: boolean;
    status?: string;
    isHistoricalMatch?: boolean;
  } | null,
): DashboardStateMode {
  const status = (profile?.subscriptionStatus || '').toLowerCase();
  const plan = normalizeSubscriptionPlanId(
    profile?.subscriptionTier,
    profile?.paidRevenueUsd,
    profile?.isRootUnlocked,
  );

  if (plan === 'premium' || status === 'active') {
    return DashboardStateMode.AnnualVip;
  }

  if (plan === 'basic') {
    return DashboardStateMode.State1Paid5Basic;
  }

  const hasExactMatch = Boolean(
    matchedLineage &&
    (matchedLineage.matched === true ||
      matchedLineage.status === 'EXACT_MATCH' ||
      matchedLineage.isHistoricalMatch === true),
  );

  return hasExactMatch
    ? DashboardStateMode.State2MatchedUnpaid
    : DashboardStateMode.State3Unmatched;
}

export interface CleanSelfTreeNode {
  id: string;
  firstName: string;
  familyName: string;
  kunya: string;
  honorificTitle: 'بدون';
  gender: 'male';
  generationLevel: number;
  isRecordKeeper: boolean;
  isDirectSpineLineage: boolean;
  relationToTargetLabel: string;
  spouseIds: string[];
  vitalStatus: 'unspecified';
  birthPrecision: 'year_only';
  birthCalendar: 'hijri';
  birthDateValue: string;
  birthPlace: string;
  femalePrivacyMasked: boolean;
  photoUrl?: string;
}

/**
 * Builds a pristine, zero-mock initial tree containing ONLY the newly upgraded
 * user's own personal node (never seeding father/grandfather or inviter data).
 */
export function buildCleanSingleSelfTreeNode(
  result: Pick<LineageSearchResult, 'clientName' | 'familyName' | 'originCountry' | 'originRegion'>,
  userAvatarUrl?: string,
): CleanSelfTreeNode[] {
  const cleanFirstName = (result.clientName || '').trim() || 'المستخدم';
  const cleanFamilyName = (result.familyName || '').trim();
  const cleanBirthPlace = [result.originRegion, result.originCountry]
    .map((v) => (v || '').trim())
    .filter((v, idx, arr) => Boolean(v) && arr.indexOf(v) === idx)
    .join('، ');

  return [
    {
      id: 'node-record-keeper',
      firstName: cleanFirstName,
      familyName: cleanFamilyName,
      kunya: '',
      honorificTitle: 'بدون',
      gender: 'male',
      generationLevel: 1,
      isRecordKeeper: true,
      isDirectSpineLineage: true,
      relationToTargetLabel: 'أمين السجل',
      spouseIds: [],
      vitalStatus: 'unspecified',
      birthPrecision: 'year_only',
      birthCalendar: 'hijri',
      birthDateValue: '',
      birthPlace: cleanBirthPlace,
      femalePrivacyMasked: false,
      photoUrl: userAvatarUrl || undefined,
    },
  ];
}
