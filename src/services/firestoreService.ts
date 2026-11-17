import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  runTransaction,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  deleteUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
} from 'firebase/auth';
import {
  db,
  mirrorDb,
  auth,
  mirrorAuth,
  provisionerAuth,
  mirrorProvisionerAuth,
  storage,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  DashboardStateMode,
  LineageSearchResult,
  StructuredWalletTxType,
  WalletTransactionStatus,
} from '../types/juthori';
import {
  processMediaFileForUpload,
  uploadMediaToCloudWithFallback,
} from '../utils/mediaPipeline';
import {
  REFERRAL_REWARD_USD,
  FamilySiteThemeId,
  buildDeterministicReferralCode,
  clearPendingReferralCode,
  readPendingReferralCode,
} from '../config/referralAndSiteConfig';

export { buildDeterministicReferralCode };

// Recursively remove undefined fields before passing objects to Firestore setDoc()
function sanitizeFirestoreData<T>(input: T): T {
  if (input === null || input === undefined) {
    return input;
  }
  if (Array.isArray(input)) {
    return input
      .filter((item) => item !== undefined)
      .map((item) => sanitizeFirestoreData(item)) as unknown as T;
  }
  if (typeof input === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (v !== undefined) {
        cleaned[k] = sanitizeFirestoreData(v);
      }
    }
    return cleaned as T;
  }
  return input;
}

// Fast timeout wrapper so locked primary Firestore rules or slow network handshakes never delay UI
function withFastTimeout<T>(promise: Promise<T>, timeoutMs = 2500): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('FAST_TIMEOUT')), timeoutMs);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// Provision a user in Firebase Authentication (juthori-com + mirror) using dedicated secondary Auth instances
// so the currently logged-in Maestro/Admin is NEVER signed out.
export async function provisionUserInFirebaseAuth(
  email: string,
  password: string,
  displayName: string
): Promise<{ registeredInAuth: boolean; uid?: string }> {
  const cleanEmail = email.trim();
  const rawPass = password.trim() || 'Juthori@2026';
  // Firebase Authentication requires passwords to be at least 6 characters
  const authPassword = rawPass.length >= 6 ? rawPass : rawPass.padEnd(6, '0');
  let registeredInAuth = false;
  let resolvedUid: string | undefined;

  const registerOnAuthInstance = async (targetAuth: typeof provisionerAuth) => {
    try {
      const cred = await withFastTimeout(
        createUserWithEmailAndPassword(targetAuth, cleanEmail, authPassword),
        3500
      );
      if (displayName) {
        await updateProfile(cred.user, { displayName }).catch(() => {});
      }
      registeredInAuth = true;
      resolvedUid = resolvedUid || cred.user.uid;
      await signOut(targetAuth).catch(() => {});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('email-already-in-use')) {
        registeredInAuth = true;
        try {
          const signCred = await withFastTimeout(
            signInWithEmailAndPassword(targetAuth, cleanEmail, authPassword),
            2500
          );
          resolvedUid = resolvedUid || signCred.user.uid;
          if (displayName && signCred.user.displayName !== displayName) {
            await updateProfile(signCred.user, { displayName }).catch(() => {});
          }
          await signOut(targetAuth).catch(() => {});
        } catch {
          // User already exists in Firebase Auth with a previous password
        }
      }
    }
  };

  await Promise.allSettled([
    registerOnAuthInstance(provisionerAuth),
    registerOnAuthInstance(mirrorProvisionerAuth),
  ]);

  return { registeredInAuth, uid: resolvedUid };
}

// Dual-database helpers: run primary (juthori-com) and mirrorDb in PARALLEL with automatic undefined sanitization and Auth retry
async function dualSetDoc(
  pathSegments: [string, ...string[]],
  data: Record<string, unknown>,
  timeoutMs: number = 4500
): Promise<{
  primaryWritten: boolean;
  mirrorWritten: boolean;
  primaryError?: string;
  mirrorError?: string;
}> {
  const cleanData = sanitizeFirestoreData(data);
  let primaryWritten = false;
  let mirrorWritten = false;
  let primaryError: string | undefined;
  let mirrorError: string | undefined;

  const primaryTask = (async () => {
    try {
      await withFastTimeout(
        setDoc(doc(db, ...pathSegments), cleanData),
        timeoutMs
      );
      primaryWritten = true;
    } catch (err) {
      primaryError = err instanceof Error ? err.message : String(err);
    }
  })();

  const mirrorTask = withFastTimeout(
    setDoc(doc(mirrorDb, ...pathSegments), cleanData),
    timeoutMs
  )
    .then(() => {
      mirrorWritten = true;
    })
    .catch((err) => {
      mirrorError = err instanceof Error ? err.message : String(err);
    });

  await Promise.allSettled([primaryTask, mirrorTask]);

  return { primaryWritten, mirrorWritten, primaryError, mirrorError };
}

async function dualGetDoc<T = Record<string, unknown>>(
  pathSegments: [string, ...string[]]
): Promise<T | null> {
  const [mirrorRes, primaryRes] = await Promise.allSettled([
    getDoc(doc(mirrorDb, ...pathSegments)),
    withFastTimeout(getDoc(doc(db, ...pathSegments)), 2500),
  ]);

  // Primary database (juthori-com `db`) is the strict single source of truth:
  if (primaryRes.status === 'fulfilled') {
    if (primaryRes.value.exists()) {
      const primaryData = primaryRes.value.data() as T;
      if (mirrorRes.status === 'fulfilled' && !mirrorRes.value.exists()) {
        setDoc(
          doc(mirrorDb, ...pathSegments),
          sanitizeFirestoreData(primaryData as Record<string, unknown>)
        ).catch(() => {});
      }
      return primaryData;
    } else {
      // Document does NOT exist in juthori-com (e.g. deleted by admin in Firebase Console).
      // Never resurrect it from mirrorDb — delete stale mirror copy instead!
      if (mirrorRes.status === 'fulfilled' && mirrorRes.value.exists()) {
        deleteDoc(doc(mirrorDb, ...pathSegments)).catch(() => {});
      }
      return null;
    }
  }

  // Only fall back to mirrorDb if primaryRes failed due to network timeout/offline
  if (mirrorRes.status === 'fulfilled' && mirrorRes.value.exists()) {
    return mirrorRes.value.data() as T;
  }

  return null;
}

async function dualDeleteDoc(pathSegments: [string, ...string[]]): Promise<void> {
  await Promise.allSettled([
    withFastTimeout(deleteDoc(doc(db, ...pathSegments)), 2500),
    deleteDoc(doc(mirrorDb, ...pathSegments)),
  ]);
}

async function dualGetCollection<T extends { id?: string }>(
  collectionName: string,
  timeoutMs: number = 3000
): Promise<T[]> {
  const mergedMap = new Map<string, T>();
  const primaryIds = new Set<string>();
  const mirrorIds = new Set<string>();

  const [mirrorRes, primaryRes] = await Promise.allSettled([
    withFastTimeout(getDocs(collection(mirrorDb, collectionName)), timeoutMs),
    withFastTimeout(getDocs(collection(db, collectionName)), timeoutMs),
  ]);

  // Primary database (juthori-com `db`) is the strict source of truth when reachable
  if (primaryRes.status === 'fulfilled') {
    primaryRes.value.docs.forEach((d) => {
      const item = d.data() as T;
      const docKey = item.id || d.id;
      primaryIds.add(docKey);
      mergedMap.set(docKey, item);
    });

    if (mirrorRes.status === 'fulfilled') {
      mirrorRes.value.docs.forEach((d) => {
        const item = d.data() as T;
        const docKey = item.id || d.id;
        mirrorIds.add(docKey);
        // Any doc in mirrorDb that is NOT in primary db was deleted from juthori-com -> purge from mirrorDb
        if (!primaryIds.has(docKey)) {
          deleteDoc(doc(mirrorDb, collectionName, d.id)).catch(() => {});
        }
      });
    }

    for (const [docKey, item] of mergedMap.entries()) {
      if (!mirrorIds.has(docKey)) {
        const cleanPayload = sanitizeFirestoreData(item as unknown as Record<string, unknown>);
        setDoc(doc(mirrorDb, collectionName, docKey), cleanPayload).catch(() => {});
      }
    }

    return Array.from(mergedMap.values());
  }

  // Fallback to mirrorDb only if primary db request rejected/timed out
  if (mirrorRes.status === 'fulfilled') {
    mirrorRes.value.docs.forEach((d) => {
      const item = d.data() as T;
      const docKey = item.id || d.id;
      mergedMap.set(docKey, item);
    });
  }

  return Array.from(mergedMap.values());
}

export type TeamRoleType =
  | 'المايسترو'
  | 'مدير عام'
  | 'مدير البحوث'
  | 'مدير إدارة الطلبات وخدمة العملاء'
  | 'مدير تحرير المركز المعرفي';

export interface UserProfileData {
  userId: string;
  fullName: string;
  firstName?: string;
  fatherName?: string;
  grandfatherName?: string;
  familyName?: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  accountType: 'individual' | 'record_keeper';
  defaultCountry?: string;
  originCountry?: string;
  originRegion?: string;
  tribeName?: string;
  familyBranch?: string;
  subscriptionTier: 'free' | 'basic_verified' | 'premium_annual';
  walletBalance: number;
  paidRevenueUsd?: number;
  unlockedCapsules?: string[];
  bridgedAncestors?: string[];
  unlockedAddonSourceIds?: string[];
  isRootUnlocked?: boolean;
  emailNotificationsEnabled?: boolean;
  emailNotificationsTicket?: boolean;
  emailNotificationsTree?: boolean;
  agreedToTermsAndPrivacy?: boolean;
  termsAndPrivacyAgreedAt?: string;
  termsAndPrivacyVersion?: string;
  termsIpAddress?: string;
  recordKeeperCharterSigned?: boolean;
  recordKeeperCharterSignedAt?: string;
  recordKeeperCharterCode?: string;
  recordKeeperContractVersion?: string;
  disambiguationChoiceId?: string;
  verifiedLineageSnapshot?: VerifiedLineageSnapshotData;
  lineageSnapshot?: VerifiedLineageSnapshotData;
  emailVerified?: boolean;
  emailVerifiedAt?: string;
  publishedSiteSlug?: string;
  ownedSiteSlugs?: string[];
  referralCode?: string;
  referredByUserId?: string;
  referredByCode?: string;
  referralRewardClaimed?: boolean;
  lastWalletTransactionId?: string;
  blockedUserIds?: string[];
  blockedUsersMeta?: Array<{
    userId: string;
    name: string;
    blockedAt: string;
  }>;
  createdAt: string;
  updatedAt?: string;
}

export interface ReferralInviteeSummary {
  userId: string;
  fullName: string;
  status: 'REGISTERED_FREE' | 'SUBSCRIBED_PAID';
  rewardUsd?: number;
  createdAt: string;
  upgradedAt?: string;
}

export interface ReferralCodeIndexDoc {
  code: string;
  ownerId: string;
  ownerName?: string;
  familyName?: string;
  invitees: ReferralInviteeSummary[];
  totalEarnedUsd: number;
  updatedAt: string;
}

/**
 * Compact, native Firestore map representation of the customer's verified lineage result
 * (excludes heavy researcher-only raw lakes so `users/{userId}` stays lightweight and fast).
 */
export interface VerifiedLineageSnapshotData {
  matched: boolean;
  engineSource: LineageSearchResult['engineSource'];
  primary_source_of_truth?: LineageSearchResult['primary_source_of_truth'];
  priorityTierMatched?: LineageSearchResult['priorityTierMatched'];
  clientName: string;
  fatherName: string;
  grandfatherName: string;
  familyName: string;
  familyCode?: string;
  adamNodeId?: string;
  originCountry: string;
  originRegion: string;
  resolvedGeoOntologyLabel?: string;
  matched_location?: string;
  enrichedLocations?: string[];
  sibling_branches_in_record?: string[];
  notables_in_record?: string[];
  rootBranchName: string;
  rootBranchCode: string;
  rootTribeName: string;
  rootTribeCode: string;
  rootSummaryLabel: string;
  adamSpineNodes?: LineageSearchResult['adamSpineNodes'];
  capsules: LineageSearchResult['capsules'];
  requiresBlindDisambiguation?: boolean;
  disambiguation_stage?: LineageSearchResult['disambiguation_stage'];
  disambiguationOptions?: LineageSearchResult['disambiguationOptions'];
  disambiguationChoiceId?: string;
  isAlphaOnlyBeforeMerge?: boolean;
  isAlphaMergedIntoAdam?: boolean;
  isAdamNodeEnrichedWithAlpha?: boolean;
  alphaParallelSource?: LineageSearchResult['alphaParallelSource'];
  alphaBackgroundTicketCode?: string;
  verifiedSourceCitation: string;
  verified_sources?: LineageSearchResult['verified_sources'];
  secondarySources?: string[];
  verifiedAddonSources?: LineageSearchResult['verifiedAddonSources'];
  historicalRegion: string;
  conflictingNarrativesNote: string;
  confidenceLabel: string;
  recommendedInitialState: DashboardStateMode;
  syncedAt: string;
}

export function buildVerifiedLineageSnapshot(
  result: LineageSearchResult,
  disambiguationChoiceId?: string
): VerifiedLineageSnapshotData {
  const compactOptions = Array.isArray(result.disambiguationOptions)
    ? result.disambiguationOptions.slice(0, 8).map((opt) => ({
        id: opt.id,
        choice_id: opt.choice_id,
        badge: opt.badge,
        title: opt.title,
        originTribeLabel: opt.originTribeLabel,
        geographicScope: opt.geographicScope || '',
        nearBranchHint: opt.nearBranchHint || '',
        isConsensusWinner: opt.isConsensusWinner,
        consensusBadge: opt.consensusBadge,
        sourcesCount: opt.sourcesCount,
      }))
    : undefined;

  const rawSnapshot: VerifiedLineageSnapshotData = {
    matched: Boolean(result.matched),
    engineSource: result.engineSource || 'neo4j_verified_graph',
    primary_source_of_truth: result.primary_source_of_truth,
    priorityTierMatched: result.priorityTierMatched,
    clientName: result.clientName || '',
    fatherName: result.fatherName || '',
    grandfatherName: result.grandfatherName || '',
    familyName: result.familyName || '',
    familyCode: result.familyCode,
    adamNodeId: result.adamNodeId,
    originCountry: result.originCountry || 'السعودية',
    originRegion: result.originRegion || '',
    resolvedGeoOntologyLabel: result.resolvedGeoOntologyLabel,
    matched_location: result.matched_location,
    enrichedLocations: Array.isArray(result.enrichedLocations)
      ? result.enrichedLocations.slice(0, 25)
      : undefined,
    sibling_branches_in_record: Array.isArray(result.sibling_branches_in_record)
      ? result.sibling_branches_in_record.slice(0, 25)
      : undefined,
    notables_in_record: Array.isArray(result.notables_in_record)
      ? result.notables_in_record.slice(0, 25)
      : undefined,
    rootBranchName: result.rootBranchName || '',
    rootBranchCode: result.rootBranchCode || '',
    rootTribeName: result.rootTribeName || '',
    rootTribeCode: result.rootTribeCode || '',
    rootSummaryLabel: result.rootSummaryLabel || '',
    adamSpineNodes: Array.isArray(result.adamSpineNodes)
      ? result.adamSpineNodes.slice(0, 45)
      : undefined,
    capsules: Array.isArray(result.capsules) ? result.capsules.slice(0, 35) : [],
    requiresBlindDisambiguation: Boolean(result.requiresBlindDisambiguation),
    disambiguation_stage: result.disambiguation_stage,
    disambiguationOptions: compactOptions,
    disambiguationChoiceId: disambiguationChoiceId || undefined,
    isAlphaOnlyBeforeMerge: result.isAlphaOnlyBeforeMerge,
    isAlphaMergedIntoAdam: result.isAlphaMergedIntoAdam,
    isAdamNodeEnrichedWithAlpha: result.isAdamNodeEnrichedWithAlpha,
    alphaParallelSource: result.alphaParallelSource,
    alphaBackgroundTicketCode: result.alphaBackgroundTicketCode,
    verifiedSourceCitation: result.verifiedSourceCitation || '',
    verified_sources: Array.isArray(result.verified_sources)
      ? result.verified_sources.slice(0, 20)
      : undefined,
    secondarySources: Array.isArray(result.secondarySources)
      ? result.secondarySources.slice(0, 20)
      : undefined,
    verifiedAddonSources: Array.isArray(result.verifiedAddonSources)
      ? result.verifiedAddonSources.slice(0, 20)
      : undefined,
    historicalRegion: result.historicalRegion || '',
    conflictingNarrativesNote: result.conflictingNarrativesNote || '',
    confidenceLabel: result.confidenceLabel || '',
    recommendedInitialState:
      result.recommendedInitialState ||
      (result.matched
        ? DashboardStateMode.State2MatchedUnpaid
        : DashboardStateMode.State3Unmatched),
    syncedAt: new Date().toISOString(),
  };

  return sanitizeFirestoreData(rawSnapshot);
}

export function hydrateLineageResultFromSnapshot(
  snapshot?: VerifiedLineageSnapshotData | null,
  profileOverrides?: Partial<
    Pick<
      UserProfileData,
      | 'firstName'
      | 'fatherName'
      | 'grandfatherName'
      | 'familyName'
      | 'originCountry'
      | 'originRegion'
    >
  >
): LineageSearchResult | null {
  if (!snapshot || typeof snapshot !== 'object' || !snapshot.familyName) {
    return null;
  }

  const spineNodes = Array.isArray(snapshot.adamSpineNodes)
    ? snapshot.adamSpineNodes
    : [];

  return {
    matched: Boolean(snapshot.matched),
    engineSource: snapshot.engineSource || 'neo4j_verified_graph',
    primary_source_of_truth: snapshot.primary_source_of_truth,
    priorityTierMatched: snapshot.priorityTierMatched,
    clientName:
      profileOverrides?.firstName || snapshot.clientName || '',
    fatherName:
      profileOverrides?.fatherName || snapshot.fatherName || '',
    grandfatherName:
      profileOverrides?.grandfatherName || snapshot.grandfatherName || '',
    familyName:
      profileOverrides?.familyName || snapshot.familyName || '',
    familyCode: snapshot.familyCode || '',
    adamNodeId: snapshot.adamNodeId,
    originCountry:
      profileOverrides?.originCountry || snapshot.originCountry || 'السعودية',
    originRegion:
      profileOverrides?.originRegion ?? snapshot.originRegion ?? '',
    resolvedGeoOntologyLabel: snapshot.resolvedGeoOntologyLabel,
    matched_location: snapshot.matched_location,
    enrichedLocations: snapshot.enrichedLocations,
    sibling_branches_in_record: snapshot.sibling_branches_in_record,
    notables_in_record: snapshot.notables_in_record,
    rootBranchName: snapshot.rootBranchName || '',
    rootBranchCode: snapshot.rootBranchCode || '',
    rootTribeName: snapshot.rootTribeName || '',
    rootTribeCode: snapshot.rootTribeCode || '',
    rootSummaryLabel: snapshot.rootSummaryLabel || '',
    upperAncestors: spineNodes,
    adamSpineNodes: spineNodes,
    capsules: Array.isArray(snapshot.capsules) ? snapshot.capsules : [],
    requiresBlindDisambiguation: Boolean(snapshot.requiresBlindDisambiguation),
    disambiguation_stage: snapshot.disambiguation_stage,
    disambiguationOptions: Array.isArray(snapshot.disambiguationOptions)
      ? snapshot.disambiguationOptions
      : [],
    isAlphaOnlyBeforeMerge: snapshot.isAlphaOnlyBeforeMerge,
    isAlphaMergedIntoAdam: snapshot.isAlphaMergedIntoAdam,
    isAdamNodeEnrichedWithAlpha: snapshot.isAdamNodeEnrichedWithAlpha,
    alphaParallelSource: snapshot.alphaParallelSource,
    alphaBackgroundTicketCode: snapshot.alphaBackgroundTicketCode,
    verifiedSourceCitation: snapshot.verifiedSourceCitation || '',
    verified_sources: snapshot.verified_sources,
    secondarySources: Array.isArray(snapshot.secondarySources)
      ? snapshot.secondarySources
      : [],
    verifiedAddonSources: snapshot.verifiedAddonSources,
    historicalRegion: snapshot.historicalRegion || '',
    conflictingNarrativesNote: snapshot.conflictingNarrativesNote || '',
    confidenceLabel: snapshot.confidenceLabel || '',
    recommendedInitialState:
      snapshot.recommendedInitialState ||
      (snapshot.matched
        ? DashboardStateMode.State2MatchedUnpaid
        : DashboardStateMode.State3Unmatched),
  };
}

export type LegalAuditEventType =
  | 'TERMS_AND_PRIVACY_CONSENT'
  | 'RECORD_KEEPER_CONTRACT_SIGNATURE'
  | 'ACCOUNT_REGISTRATION_CONSENT';

export interface LegalAuditTrailEntry {
  id: string;
  userId: string;
  userFullName: string;
  familyName?: string;
  userEmail: string;
  eventType: LegalAuditEventType;
  documentTitle: string;
  documentVersion: string;
  certificateCode: string;
  orderReference?: string;
  consentStatement: string;
  ipAddress: string;
  ipCountry?: string;
  ipCity?: string;
  userAgent: string;
  signedAtIso: string;
  signedAtFormatted: string;
  verificationMethod: string;
  status: 'COMPLETED_AND_SEALED';
}

export interface ResearchTicketAttachmentRef {
  id: string;
  title: string;
  mediaType: 'photo' | 'document';
  sourceType: 'vault_ref' | 'direct_upload';
  vaultItemId?: string;
  thumbnailUrl?: string;
  fileUrl?: string;
  dateOrOccasion?: string;
}

export interface ResearchTicketMessageData {
  id: string;
  ticketId: string;
  senderRole: 'customer' | 'researcher' | 'system';
  senderId: string;
  senderName: string;
  body: string;
  attachments?: ResearchTicketAttachmentRef[];
  createdAt: string;
}

export interface ResearchTicketResolutionPayload {
  decisionTitle: string;
  verifiedRootBranch?: string;
  verifiedRootTribe?: string;
  verifiedCitation?: string;
  certifiedAncestorName?: string;
  certifiedAncestorRank?: string;
  summaryNotes?: string;
  appliedByCustomerAt?: string;
}

export type CanonicalTicketLifecycleStage =
  | 'OPEN'
  | 'IN_REVIEW'
  | 'NEEDS_INFO'
  | 'RESOLVED'
  | 'CLOSED';

export interface ResearchTicketData {
  id: string;
  ticketNumber: string;
  userId: string;
  userFullName: string;
  userEmail: string;
  userPhone?: string;
  familyName?: string;
  targetAncestor: string;
  tribeName?: string;
  familyBranch?: string;
  originCountry?: string;
  originRegion?: string;
  additionalNotes?: string;
  verificationChoiceLabel?: string;
  ticketCategory?:
    | 'ADAM_NODE_ENRICHMENT'
    | 'ALPHA_TO_ADAM_LINK'
    | 'P1_CUSTOMER_SEARCH'
    | 'P3_PROACTIVE_MINING'
    | 'ASSIGNED_RESEARCH';
  adamNodeId?: string;
  alphaId?: string;
  status:
    | CanonicalTicketLifecycleStage
    | 'pending_review'
    | 'investigating'
    | 'lineage_found'
    | 'completed'
    | 'no_records_found'
    | 'CLOSED_AND_ENRICHED'
    | 'exported_adam_prime';
  lifecycleStage?: CanonicalTicketLifecycleStage;
  assignedResearcherId?: string;
  assignedResearcherName?: string;
  researchFindings?: string;
  verifiedSources?: string;
  studioPayloadJson?: string;
  attachments?: ResearchTicketAttachmentRef[];
  messages?: ResearchTicketMessageData[];
  resolutionPayload?: ResearchTicketResolutionPayload;
  clientNotified?: boolean;
  priorityTag?: 'PRIORITY_REGISTRAR' | string;
  openedAt: string;
  createdAt?: string;
  resolvedAt?: string;
  updatedAt?: string;
}

export interface WalletTransactionData {
  id: string;
  transactionId?: string;
  userId: string;
  userEmail?: string;
  type: StructuredWalletTxType | 'credit' | 'debit';
  direction?: 'credit' | 'debit';
  amount: number;
  balanceBefore?: number;
  balanceAfter: number;
  status?: WalletTransactionStatus;
  descriptionAr?: string;
  reason: string;
  paymentMethod?: 'wallet' | 'external';
  bonusCreditUsd?: number;
  referenceId?: string;
  referredInviteeUid?: string;
  createdAt: string;
}

export interface CustomerNotificationData {
  id: string;
  userId: string;
  title: string;
  body: string;
  category: 'ticket_update' | 'feature_announcement' | 'wallet_bonus' | 'system_notice';
  actionUrl?: string;
  actionLabel?: string;
  isRead: boolean;
  senderRole?: 'system' | 'support' | 'researcher';
  createdAt: string;
}

export interface TeamMemberRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: TeamRoleType;
  status: 'نشط' | 'موقوف';
  assignedTickets: number;
  completedTickets: number;
  avgCompletionTime: string;
  permissions: string[];
  createdAt: string;
}

export interface CustomerOrderRecord {
  id: string;
  userId?: string;
  fullName: string;
  firstName: string;
  fatherName: string;
  grandfatherName: string;
  familyName: string;
  originCountry: string;
  originRegion: string;
  email: string;
  phone: string;
  legalRole: 'individual' | 'record_keeper';
  accountStatus: 'free' | 'paid_5_root' | 'annual_vip';
  walletBalanceUsd: number;
  paidRevenueUsd: number;
  matchStatus:
    | 'auto_adam_full'
    | 'staged_3_nodes'
    | 'pending_geo_clarification'
    | 'open_research_ticket'
    | 'enriched_delivered';
  ticketId: string;
  ticketType: 'طلب عميل P1' | 'إثراء شجرة آدم P2' | 'آلي مكتمل';
  assignedResearcher: string;
  slaStatus:
    | 'جديدة'
    | 'قيد العمل'
    | 'محولة لآدم برايم'
    | 'مكتملة وتمت تغذية شجرة آدم';
  nodesCountLabel: string;
  createdAt: string;
}

export type KnowledgeContentType = 'مقال' | 'فيديو';

export interface KnowledgeArticleRecord {
  id: string;
  title: string;
  section: string;
  filter: string;
  type: KnowledgeContentType;
  description: string;
  category: string;
  summary: string;
  content: string;
  author?: string;
  editor?: string;
  authorName: string;
  publishDate?: string;
  imageCaption?: string;
  imageCopyright?: string;
  coverTextOverlay?: string;
  coverImageUrl?: string;
  videoUrl?: string;
  duration?: string;
  status: 'published' | 'draft';
  createdAt: string;
  updatedAt?: string;
}

export interface CharterRequestRecord {
  id: string;
  userId?: string;
  clientName: string;
  familyName: string;
  email: string;
  country: string;
  submittedAt: string;
  charterCode: string;
  contractVersion?: string;
  ipAddress?: string;
  auditTrailId?: string;
  status: 'بانتظار الاعتماد' | 'معتمد (شجرتي مفعّلة)';
}

export interface SupportTicketRecord {
  id: string;
  clientName: string;
  email: string;
  category: 'استفسار نسبي' | 'مشكلة دفع' | 'رمز التحقق OTP';
  subject: string;
  message?: string;
  status: 'مفتوح' | 'تم الحل';
  timestamp: string;
}

export const FOUNDING_MAESTRO_MEMBER: TeamMemberRecord = {
  id: 'team_maestro_kareem',
  name: 'كريم طاحون',
  email: 'Kareem.Tahoun@adamresearchcenter.net',
  passwordHash: 'ks6kae',
  role: 'المايسترو',
  status: 'نشط',
  assignedTickets: 0,
  completedTickets: 0,
  avgCompletionTime: 'فوري',
  permissions: [
    'المايسترو — كامل الصلاحيات الإدارية والبحثية',
    'لوحة إدارة المستخدمين وإرسال الدعوات عبر Resend',
    'لوحة تحكم الباحثين (Researcher Studio)',
    'لوحة إدارة الطلبات وخدمة العملاء',
    'لوحة تحرير المركز المعرفي',
    'لوحة التقارير والإدارة العليا',
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
};

export const DEFAULT_GENERAL_MANAGER_MEMBER: TeamMemberRecord = {
  id: 'team_usr_hassan_alamri_adamresearchcenter_net',
  name: 'حسن العامري',
  email: 'hassan.alamri@adamresearchcenter.net',
  passwordHash: '123456',
  role: 'مدير عام',
  status: 'نشط',
  assignedTickets: 0,
  completedTickets: 0,
  avgCompletionTime: 'فوري',
  permissions: [
    'فتح كافة لوحات التحكم الخمس',
    'إضافة ودعوة أعضاء الفريق عبر Resend',
    'اعتماد إثراء ودمج شجرة آدم',
    'إدارة الطلبات والمركز المعرفي والتقارير',
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
};

export function getPermissionsForTeamRole(role: TeamRoleType): string[] {
  switch (role) {
    case 'المايسترو':
    case 'مدير عام':
      return [
        'فتح كافة لوحات التحكم الخمس',
        'إضافة ودعوة أعضاء الفريق عبر Resend',
        'اعتماد إثراء ودمج شجرة آدم',
        'إدارة الطلبات والمركز المعرفي والتقارير',
      ];
    case 'مدير البحوث':
      return [
        'لوحة تحكم إدارة البحوث (Researcher Studio)',
        'لوحة إدارة شجرة آدم (ADAM ANCESTRAL TREE™)',
        'لوحة البحث والفحص (تحقيق المخطوطات ومشاريع ألفا)',
        'ربط وإثراء وتكويد عُقد شجرة آدم',
      ];
    case 'مدير إدارة الطلبات وخدمة العملاء':
      return [
        'لوحة تحكم إدارة الطلبات وخدمة العملاء حصراً',
        'متابعة طلبات العملاء وتوثيق مواثيق أمناء السجل',
        'الرد على تذاكر الدعم الفني',
      ];
    case 'مدير تحرير المركز المعرفي':
      return [
        'لوحة تحكم مدير تحرير المركز المعرفي حصراً',
        'إضافة وتعديل ونشر مقالات ودراسات الأنساب',
      ];
  }
}

export function isCorporateStaffEmail(email?: string | null): boolean {
  const em = (email || '').trim().toLowerCase();
  if (!em) return false;
  if (
    em.endsWith('@adamresearchcenter.net') ||
    em === FOUNDING_MAESTRO_MEMBER.email.toLowerCase() ||
    em === DEFAULT_GENERAL_MANAGER_MEMBER.email.toLowerCase() ||
    em === 'hassan.almuqit@juthori.com' ||
    em === 'client@juthori.com'
  ) {
    return true;
  }
  return false;
}

export function canonicalCustomerEmailUid(email?: string | null): string {
  const em = (email || '').trim().toLowerCase();
  if (!em || !em.includes('@') || isCorporateStaffEmail(em)) return '';
  return `usr_email_${em.replace(/[^a-z0-9]/g, '_').slice(0, 96)}`;
}

export async function findTeamMemberByEmail(
  email?: string | null
): Promise<TeamMemberRecord | null> {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) return null;
  if (cleanEmail === FOUNDING_MAESTRO_MEMBER.email.toLowerCase()) {
    return FOUNDING_MAESTRO_MEMBER;
  }
  if (cleanEmail === DEFAULT_GENERAL_MANAGER_MEMBER.email.toLowerCase()) {
    return DEFAULT_GENERAL_MANAGER_MEMBER;
  }
  try {
    const canonicalDocId = getTeamMemberDocIdByEmail(cleanEmail);
    const directDoc = await dualGetDoc<TeamMemberRecord>([
      'team_members',
      canonicalDocId,
    ]);
    if (
      directDoc &&
      (directDoc.email || '').trim().toLowerCase() === cleanEmail &&
      !LEGACY_DUMMY_TEAM_IDS.has(directDoc.id)
    ) {
      return directDoc;
    }
    const allMembers = await dualGetCollection<TeamMemberRecord>('team_members');
    const matched = allMembers.find(
      (m) =>
        m &&
        m.email &&
        !LEGACY_DUMMY_TEAM_IDS.has(m.id) &&
        m.email.trim().toLowerCase() === cleanEmail
    );
    return matched || null;
  } catch {
    return null;
  }
}

function isTeamAccountDocInUsers(
  docId?: string,
  email?: string,
  fullName?: string
): boolean {
  const id = (docId || '').trim();
  const em = (email || '').trim().toLowerCase();
  const fn = (fullName || '').trim();
  if (
    id.startsWith('team_usr_') ||
    id.startsWith('team_maestro_') ||
    id === 'usr_maestro_kareem'
  ) {
    return true;
  }
  if (isCorporateStaffEmail(em)) {
    return true;
  }
  if (
    fn.includes('(المايسترو)') ||
    fn.includes('(مدير البحوث)') ||
    fn.includes('(مدير عام)') ||
    fn.includes('(مدير إدارة الطلبات وخدمة العملاء)') ||
    fn.includes('(مدير تحرير المركز المعرفي)')
  ) {
    return true;
  }
  return false;
}

export function isEmailPrefixOrAsciiPlaceholder(
  val?: string | null,
  email?: string | null
): boolean {
  const trimmed = (val || '').trim();
  if (
    !trimmed ||
    trimmed === '—' ||
    trimmed === '-' ||
    trimmed === 'مستخدم' ||
    trimmed === 'مستخدم جذوري' ||
    trimmed === 'عميل' ||
    trimmed === 'العائلة'
  ) {
    return true;
  }
  const emailPrefix = ((email || '').split('@')[0] || '').trim().toLowerCase();
  if (emailPrefix && trimmed.toLowerCase().includes(emailPrefix)) {
    return true;
  }
  // Any name without Arabic characters is an English/email prefix placeholder
  if (!/[\u0600-\u06FF]/.test(trimmed)) {
    return true;
  }
  return false;
}

function autoHealCorruptedProfileIfNeeded(
  profile: UserProfileData | null
): UserProfileData | null {
  if (!profile) return null;
  const cleanEmail = (profile.email || '').trim().toLowerCase();
  const emailPrefix = (cleanEmail.split('@')[0] || '').toLowerCase();
  if (
    (cleanEmail === 'snosi@gmail.com' || emailPrefix === 'snosi') &&
    (isEmailPrefixOrAsciiPlaceholder(profile.familyName, cleanEmail) ||
      isEmailPrefixOrAsciiPlaceholder(profile.firstName, cleanEmail))
  ) {
    const healed: UserProfileData = {
      ...profile,
      fullName: 'كريم شريف خيري السنوسي',
      firstName: 'كريم',
      fatherName: 'شريف',
      grandfatherName: 'خيري',
      familyName: 'السنوسي',
      originCountry:
        profile.originCountry &&
        profile.originCountry !== 'السعودية' &&
        !isEmailPrefixOrAsciiPlaceholder(profile.originCountry, cleanEmail)
          ? profile.originCountry
          : 'مصر',
      originRegion: profile.originRegion || 'مغاغة',
    };
    if (healed.userId) {
      dualSetDoc(
        ['users', healed.userId.replace(/[^a-zA-Z0-9_-]/g, '_')],
        healed as unknown as Record<string, unknown>
      ).catch(() => {});
    }
    return healed;
  }
  return profile;
}

// =============================================================================
// 1. USER PROFILE & AVATAR MANAGEMENT (Firebase Firestore + Storage)
// =============================================================================
export async function fetchUserProfile(userId: string): Promise<UserProfileData | null> {
  if (!userId) return null;
  const safeUid = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  if (isTeamAccountDocInUsers(safeUid)) return null;
  const docData = await dualGetDoc<UserProfileData>(['users', safeUid]);
  if (!docData) return null;
  if (
    isTeamAccountDocInUsers(
      docData.userId || safeUid,
      docData.email,
      docData.fullName
    )
  ) {
    dualDeleteDoc(['users', safeUid]).catch(() => {});
    return null;
  }
  if (docData.email) {
    const teamMatch = await findTeamMemberByEmail(docData.email);
    if (teamMatch) {
      dualDeleteDoc(['users', safeUid]).catch(() => {});
      return null;
    }
  }
  return autoHealCorruptedProfileIfNeeded(docData);
}

export async function fetchUserProfileByEmail(
  email: string
): Promise<UserProfileData | null> {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || isCorporateStaffEmail(cleanEmail)) return null;

  const teamMatch = await findTeamMemberByEmail(cleanEmail);
  if (teamMatch) {
    return null;
  }

  // Fast O(1) owner self-lookup compatible with Zero-Trust rules (`isOwner(userId)`)
  if (
    auth.currentUser?.uid &&
    (auth.currentUser.email || '').trim().toLowerCase() === cleanEmail
  ) {
    const directSelf = await fetchUserProfile(auth.currentUser.uid);
    if (directSelf) {
      return directSelf;
    }
  }

  const canonicalUid = canonicalCustomerEmailUid(cleanEmail);
  if (canonicalUid) {
    const byCanonical = await fetchUserProfile(canonicalUid);
    if (byCanonical) {
      return byCanonical;
    }
  }

  try {
    const [allUsers, allOrders, allTickets] = await Promise.all([
      dualGetCollection<UserProfileData & { id?: string }>('users'),
      dualGetCollection<CustomerOrderRecord>('customer_orders'),
      dualGetCollection<ResearchTicketData>('research_tickets'),
    ]);

    const matchingUsers = allUsers.filter(
      (u) =>
        !isTeamAccountDocInUsers(
          u.id || u.userId,
          u.email,
          u.fullName
        ) && (u.email || '').trim().toLowerCase() === cleanEmail
    );
    // Prefer a user record that has a real Arabic familyName
    const bestUser =
      matchingUsers.find(
        (u) =>
          u.familyName &&
          !isEmailPrefixOrAsciiPlaceholder(u.familyName, cleanEmail)
      ) ||
      matchingUsers.find((u) => u.familyName && u.familyName.trim().length > 0) ||
      matchingUsers[0] ||
      null;

    const matchingOrders = allOrders.filter(
      (o) =>
        !isTeamAccountDocInUsers(o.userId, o.email, o.fullName) &&
        (o.email || '').trim().toLowerCase() === cleanEmail
    );
    const bestOrder =
      matchingOrders.find(
        (o) =>
          o.familyName &&
          !isEmailPrefixOrAsciiPlaceholder(o.familyName, cleanEmail)
      ) ||
      matchingOrders.find((o) => o.familyName && o.familyName.trim().length > 0) ||
      matchingOrders[0] ||
      null;

    const matchingTickets = allTickets.filter(
      (t) =>
        !isTeamAccountDocInUsers(t.userId, t.userEmail, t.userFullName) &&
        (t.userEmail || '').trim().toLowerCase() === cleanEmail
    );
    const bestTicket =
      matchingTickets.find(
        (t) =>
          t.familyName &&
          !isEmailPrefixOrAsciiPlaceholder(t.familyName, cleanEmail)
      ) ||
      matchingTickets.find((t) => t.familyName && t.familyName.trim().length > 0) ||
      matchingTickets[0] ||
      null;

    if (!bestUser && !bestOrder && !bestTicket) {
      return null;
    }

    const nameParts = (
      bestUser?.fullName ||
      bestOrder?.fullName ||
      bestTicket?.userFullName ||
      ''
    )
      .split(' ')
      .filter(Boolean);

    const resolvedFirstName =
      bestUser?.firstName ||
      bestOrder?.firstName ||
      nameParts[0] ||
      '';
    const resolvedFatherName =
      bestUser?.fatherName ||
      bestOrder?.fatherName ||
      (nameParts.length > 2 ? nameParts[1] : '') ||
      '';
    const resolvedGrandfatherName =
      bestUser?.grandfatherName ||
      bestOrder?.grandfatherName ||
      (nameParts.length > 3 ? nameParts[2] : '') ||
      '';
    const resolvedFamilyName =
      bestUser?.familyName ||
      bestOrder?.familyName ||
      bestTicket?.familyName ||
      (nameParts.length > 3
        ? nameParts.slice(3).join(' ')
        : nameParts.length > 1
        ? nameParts.slice(1).join(' ')
        : '') ||
      '';

    const resolvedTier: UserProfileData['subscriptionTier'] =
      bestUser?.subscriptionTier === 'premium_annual' ||
      bestOrder?.accountStatus === 'annual_vip'
        ? 'premium_annual'
        : bestUser?.subscriptionTier === 'basic_verified' ||
          bestOrder?.accountStatus === 'paid_5_root'
        ? 'basic_verified'
        : 'free';

    const resolvedAccountType: UserProfileData['accountType'] =
      bestUser?.accountType === 'record_keeper' ||
      bestOrder?.legalRole === 'record_keeper'
        ? 'record_keeper'
        : 'individual';

    return autoHealCorruptedProfileIfNeeded({
      userId: bestUser?.userId || bestOrder?.userId || bestTicket?.userId || `usr_${Date.now()}`,
      fullName:
        bestUser?.fullName ||
        bestOrder?.fullName ||
        bestTicket?.userFullName ||
        [resolvedFirstName, resolvedFatherName, resolvedGrandfatherName, resolvedFamilyName]
          .filter(Boolean)
          .join(' '),
      firstName: resolvedFirstName,
      fatherName: resolvedFatherName,
      grandfatherName: resolvedGrandfatherName,
      familyName: resolvedFamilyName,
      email: bestUser?.email || bestOrder?.email || bestTicket?.userEmail || email.trim(),
      phone: bestUser?.phone || bestOrder?.phone || bestTicket?.userPhone || '',
      avatarUrl: bestUser?.avatarUrl || '',
      accountType: resolvedAccountType,
      defaultCountry:
        bestUser?.defaultCountry ||
        bestUser?.originCountry ||
        bestOrder?.originCountry ||
        bestTicket?.originCountry ||
        'السعودية',
      originCountry:
        bestUser?.originCountry ||
        bestOrder?.originCountry ||
        bestTicket?.originCountry ||
        'السعودية',
      originRegion:
        bestUser?.originRegion ||
        bestOrder?.originRegion ||
        bestTicket?.originRegion ||
        '',
      tribeName: bestUser?.tribeName || bestTicket?.tribeName || '',
      familyBranch: bestUser?.familyBranch || bestTicket?.familyBranch || '',
      subscriptionTier: resolvedTier,
      walletBalance:
        bestUser?.walletBalance ?? bestOrder?.walletBalanceUsd ?? 0,
      paidRevenueUsd:
        bestUser?.paidRevenueUsd ?? bestOrder?.paidRevenueUsd ?? undefined,
      unlockedCapsules: bestUser?.unlockedCapsules,
      bridgedAncestors: bestUser?.bridgedAncestors,
      unlockedAddonSourceIds: bestUser?.unlockedAddonSourceIds,
      isRootUnlocked:
        Boolean(bestUser?.isRootUnlocked) ||
        resolvedTier === 'basic_verified' ||
        resolvedTier === 'premium_annual',
      emailNotificationsEnabled: bestUser?.emailNotificationsEnabled ?? true,
      emailNotificationsTicket: bestUser?.emailNotificationsTicket ?? true,
      emailNotificationsTree: bestUser?.emailNotificationsTree ?? true,
      agreedToTermsAndPrivacy: bestUser?.agreedToTermsAndPrivacy,
      termsAndPrivacyAgreedAt: bestUser?.termsAndPrivacyAgreedAt,
      termsAndPrivacyVersion: bestUser?.termsAndPrivacyVersion,
      termsIpAddress: bestUser?.termsIpAddress,
      recordKeeperCharterSigned: bestUser?.recordKeeperCharterSigned,
      recordKeeperCharterSignedAt: bestUser?.recordKeeperCharterSignedAt,
      recordKeeperCharterCode: bestUser?.recordKeeperCharterCode,
      recordKeeperContractVersion: bestUser?.recordKeeperContractVersion,
      disambiguationChoiceId: bestUser?.disambiguationChoiceId,
      verifiedLineageSnapshot:
        bestUser?.verifiedLineageSnapshot || bestUser?.lineageSnapshot,
      lineageSnapshot:
        bestUser?.lineageSnapshot || bestUser?.verifiedLineageSnapshot,
      emailVerified: bestUser?.emailVerified,
      emailVerifiedAt: bestUser?.emailVerifiedAt,
      createdAt:
        bestUser?.createdAt ||
        bestOrder?.createdAt ||
        bestTicket?.openedAt ||
        new Date().toISOString(),
      updatedAt: bestUser?.updatedAt,
    });
  } catch (err) {
    console.warn('[fetchUserProfileByEmail] warning:', err);
    return null;
  }
}

export async function createUserProfileIfMissing(
  user: { uid: string; email?: string | null; displayName?: string | null },
  additional: Partial<UserProfileData> = {}
): Promise<UserProfileData> {
  const safeUid = (user.uid || `usr_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanEmail = (additional.email || user.email || 'user@juthori.com').trim();

  // Strict RBAC Isolation: NEVER allow corporate or /team staff accounts in `users`
  if (
    isTeamAccountDocInUsers(safeUid, cleanEmail, additional.fullName || user.displayName || '') ||
    (await findTeamMemberByEmail(cleanEmail))
  ) {
    await dualDeleteDoc(['users', safeUid]).catch(() => {});
    throw new Error(
      'TEAM_ACCOUNT_ISOLATED: هذا البريد مسجل كحساب إداري في منظومة فريق العمل ولا يُسمح بتسجيله في بوابة العملاء.'
    );
  }

  const deterministicRefCode =
    additional.referralCode || buildDeterministicReferralCode(safeUid);

  const initialProfile = autoHealCorruptedProfileIfNeeded({
    userId: safeUid,
    fullName: additional.fullName || user.displayName || 'مستخدم جذوري',
    firstName: additional.firstName || '',
    fatherName: additional.fatherName || '',
    grandfatherName: additional.grandfatherName || '',
    familyName: additional.familyName || '',
    email: cleanEmail,
    phone: additional.phone || '',
    avatarUrl: additional.avatarUrl || '',
    accountType: additional.accountType || 'individual',
    defaultCountry: additional.defaultCountry || additional.originCountry || 'السعودية',
    originCountry: additional.originCountry || 'السعودية',
    originRegion: additional.originRegion || '',
    tribeName: additional.tribeName || '',
    familyBranch: additional.familyBranch || '',
    subscriptionTier: additional.subscriptionTier || 'free',
    walletBalance: additional.walletBalance ?? 0,
    unlockedCapsules: additional.unlockedCapsules,
    bridgedAncestors: additional.bridgedAncestors,
    unlockedAddonSourceIds: additional.unlockedAddonSourceIds,
    isRootUnlocked: additional.isRootUnlocked ?? false,
    emailNotificationsEnabled: additional.emailNotificationsEnabled ?? true,
    emailNotificationsTicket: additional.emailNotificationsTicket ?? true,
    emailNotificationsTree: additional.emailNotificationsTree ?? true,
    agreedToTermsAndPrivacy: additional.agreedToTermsAndPrivacy ?? true,
    termsAndPrivacyAgreedAt:
      additional.termsAndPrivacyAgreedAt || new Date().toISOString(),
    termsAndPrivacyVersion:
      additional.termsAndPrivacyVersion || 'V1_10 Nov_2026',
    termsIpAddress: additional.termsIpAddress || '',
    recordKeeperCharterSigned:
      additional.recordKeeperCharterSigned ??
      additional.accountType === 'record_keeper',
    recordKeeperCharterSignedAt: additional.recordKeeperCharterSignedAt,
    recordKeeperCharterCode: additional.recordKeeperCharterCode,
    recordKeeperContractVersion: additional.recordKeeperContractVersion,
    disambiguationChoiceId: additional.disambiguationChoiceId,
    verifiedLineageSnapshot:
      additional.verifiedLineageSnapshot || additional.lineageSnapshot,
    lineageSnapshot:
      additional.lineageSnapshot || additional.verifiedLineageSnapshot,
    emailVerified: additional.emailVerified ?? false,
    emailVerifiedAt: additional.emailVerifiedAt,
    referralCode: deterministicRefCode,
    referralRewardClaimed: false,
    createdAt: new Date().toISOString(),
  })!;

  try {
    const existing = await fetchUserProfile(safeUid);
    if (existing) {
      const ensuredRefCode =
        existing.referralCode || buildDeterministicReferralCode(safeUid);
      // NEVER overwrite real Arabic profile fields with an ASCII email prefix!
      const incomingHasArabicFamily =
        Boolean(additional.familyName) &&
        !isEmailPrefixOrAsciiPlaceholder(additional.familyName, cleanEmail);
      const incomingHasArabicFirst =
        Boolean(additional.firstName) &&
        !isEmailPrefixOrAsciiPlaceholder(additional.firstName, cleanEmail);
      const incomingSnapshot =
        additional.verifiedLineageSnapshot || additional.lineageSnapshot;
      const shouldPromoteEmailVerified =
        additional.emailVerified === true && !existing.emailVerified;

      if (
        incomingHasArabicFamily ||
        incomingHasArabicFirst ||
        additional.originRegion ||
        incomingSnapshot ||
        shouldPromoteEmailVerified ||
        !existing.referralCode
      ) {
        const updatedProfile: UserProfileData = {
          ...existing,
          referralCode: ensuredRefCode,
          fullName:
            incomingHasArabicFirst || incomingHasArabicFamily
              ? additional.fullName || existing.fullName
              : existing.fullName,
          firstName: incomingHasArabicFirst
            ? additional.firstName!
            : existing.firstName,
          fatherName:
            additional.fatherName &&
            !isEmailPrefixOrAsciiPlaceholder(additional.fatherName, cleanEmail)
              ? additional.fatherName
              : existing.fatherName,
          grandfatherName:
            additional.grandfatherName &&
            !isEmailPrefixOrAsciiPlaceholder(additional.grandfatherName, cleanEmail)
              ? additional.grandfatherName
              : existing.grandfatherName,
          familyName: incomingHasArabicFamily
            ? additional.familyName!
            : existing.familyName,
          originCountry:
            incomingHasArabicFamily && additional.originCountry
              ? additional.originCountry
              : existing.originCountry,
          originRegion: additional.originRegion || existing.originRegion,
          tribeName: additional.tribeName || existing.tribeName,
          familyBranch: additional.familyBranch || existing.familyBranch,
          accountType: additional.accountType || existing.accountType,
          disambiguationChoiceId:
            additional.disambiguationChoiceId || existing.disambiguationChoiceId,
          verifiedLineageSnapshot:
            existing.verifiedLineageSnapshot ||
            existing.lineageSnapshot ||
            incomingSnapshot,
          lineageSnapshot:
            existing.lineageSnapshot ||
            existing.verifiedLineageSnapshot ||
            incomingSnapshot,
          emailVerified:
            additional.emailVerified === true ? true : existing.emailVerified,
          emailVerifiedAt:
            additional.emailVerified === true
              ? additional.emailVerifiedAt || existing.emailVerifiedAt || new Date().toISOString()
              : existing.emailVerifiedAt,
          updatedAt: new Date().toISOString(),
        };
        await dualSetDoc(
          ['users', safeUid],
          updatedProfile as unknown as Record<string, unknown>
        );
        return updatedProfile;
      }
      return existing;
    }

    // New customer account: bind `?ref={code}` if present (zero $ reward on free signup)
    const pendingRefCode = (
      additional.referredByCode ||
      readPendingReferralCode() ||
      ''
    )
      .trim()
      .toUpperCase();

    if (pendingRefCode && pendingRefCode !== deterministicRefCode) {
      try {
        const referrerIndex = await dualGetDoc<ReferralCodeIndexDoc>([
          'referral_codes',
          pendingRefCode,
        ]);
        if (referrerIndex && referrerIndex.ownerId && referrerIndex.ownerId !== safeUid) {
          initialProfile.referredByUserId = referrerIndex.ownerId;
          initialProfile.referredByCode = pendingRefCode;
          initialProfile.referralRewardClaimed = false;

          const prevInvitees: ReferralInviteeSummary[] = Array.isArray(
            referrerIndex.invitees
          )
            ? referrerIndex.invitees
            : [];
          if (!prevInvitees.some((inv) => inv.userId === safeUid)) {
            const addedEntry: ReferralInviteeSummary = {
              userId: safeUid,
              fullName: initialProfile.fullName || 'عضو مدعو',
              status: 'REGISTERED_FREE' as const,
              createdAt: initialProfile.createdAt,
            };
            const nextInvitees = [...prevInvitees, addedEntry].slice(-300);
            await dualSetDoc(['referral_codes', pendingRefCode], {
              ...referrerIndex,
              invitees: nextInvitees,
              updatedAt: new Date().toISOString(),
            });
          }
          clearPendingReferralCode();
        }
      } catch {
        // Non-blocking referral binding
      }
    }

    // Ensure the new customer's own deterministic referral code index exists in Firestore
    dualGetDoc<ReferralCodeIndexDoc>(['referral_codes', deterministicRefCode])
      .then((existingIdx) => {
        if (!existingIdx) {
          const idxDoc: ReferralCodeIndexDoc = {
            code: deterministicRefCode,
            ownerId: safeUid,
            ownerName: initialProfile.fullName,
            familyName: initialProfile.familyName || '',
            invitees: [],
            totalEarnedUsd: 0,
            updatedAt: new Date().toISOString(),
          };
          return dualSetDoc(
            ['referral_codes', deterministicRefCode],
            idxDoc as unknown as Record<string, unknown>
          );
        }
        return undefined;
      })
      .catch(() => {});

    await dualSetDoc(
      ['users', safeUid],
      initialProfile as unknown as Record<string, unknown>
    );
    return initialProfile;
  } catch (error) {
    console.warn('[createUserProfileIfMissing] Firestore notice:', error);
    return initialProfile;
  }
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<UserProfileData>
): Promise<void> {
  if (!userId) return;
  const safeUid = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const candidateEmail = (updates.email || auth.currentUser?.email || '').trim();
  if (
    isTeamAccountDocInUsers(safeUid, candidateEmail, updates.fullName) ||
    (candidateEmail && (await findTeamMemberByEmail(candidateEmail)))
  ) {
    await dualDeleteDoc(['users', safeUid]).catch(() => {});
    return;
  }
  const path = `users/${safeUid}`;
  try {
    const existingData = await dualGetDoc<UserProfileData>(['users', safeUid]);
    if (!existingData) {
      await createUserProfileIfMissing(
        {
          uid: safeUid,
          email: candidateEmail || 'user@juthori.com',
          displayName: updates.fullName || 'مستخدم جذوري',
        },
        updates
      );
      return;
    }
    if (
      existingData.email &&
      (isCorporateStaffEmail(existingData.email) ||
        (await findTeamMemberByEmail(existingData.email)))
    ) {
      await dualDeleteDoc(['users', safeUid]).catch(() => {});
      return;
    }
    const merged: UserProfileData = {
      ...existingData,
      ...updates,
      userId: existingData.userId || safeUid,
      createdAt: existingData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await dualSetDoc(['users', safeUid], merged as unknown as Record<string, unknown>);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function uploadUserAvatarToFirebase(
  userId: string,
  file: File
): Promise<string> {
  const safeUid = (userId || `usr_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_');

  let finalAvatarUrl = '';
  try {
    const processed = await processMediaFileForUpload(file, 'avatar');
    const uploaded = await uploadMediaToCloudWithFallback({
      uid: safeUid,
      category: 'profile_avatars',
      itemId: `avatar_${Date.now()}`,
      mainDataUrl: processed.mainDataUrl,
      thumbnailDataUrl: processed.thumbnailDataUrl,
      mimeType: processed.mimeType,
    });
    finalAvatarUrl = uploaded.url;
  } catch {
    const storageRef = ref(storage, `users/${safeUid}/profile_avatars/avatar_${Date.now()}`);
    await uploadBytes(storageRef, file);
    finalAvatarUrl = await getDownloadURL(storageRef);
  }

  await updateUserProfile(safeUid, { avatarUrl: finalAvatarUrl });
  return finalAvatarUrl;
}

export async function uploadTreeNodeAvatarWithFallback(
  userId: string | undefined,
  personId: string,
  file: File
): Promise<{
  url: string;
  thumbnailUrl?: string;
  storagePath?: string;
  provider: 'firebase_storage' | 'firestore_chunked';
}> {
  const processed = await processMediaFileForUpload(file, 'avatar');
  return uploadMediaToCloudWithFallback({
    uid: userId,
    category: 'tree_avatars',
    itemId: `${personId}_${Date.now()}`,
    mainDataUrl: processed.mainDataUrl,
    thumbnailDataUrl: processed.thumbnailDataUrl,
    mimeType: processed.mimeType,
  });
}

export async function deleteUserAccountFromFirebase(userId: string): Promise<void> {
  const safeUid = (userId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  if (safeUid) {
    try {
      await dualDeleteDoc(['users', safeUid]);
    } catch (err) {
      console.warn('[deleteUserAccountFromFirebase] Firestore delete warning:', err);
    }
  }
  if (auth.currentUser) {
    try {
      await deleteUser(auth.currentUser);
    } catch (err) {
      console.warn('[deleteUserAccountFromFirebase] Auth delete warning:', err);
    }
  }
}

// =============================================================================
// 2. INTERACTIVE FAMILY TREE PERSISTENCE (شجرتي in Firebase + Local Cache)
// =============================================================================
const CHUNKED_AVATAR_PREFIX = '__CHUNKED_TREE_AVATAR__:';

function getFullFamilyTreeLocalKeys(
  userId?: string,
  userEmail?: string,
  familyName?: string
): string[] {
  const keys: string[] = [];
  const safeUid = (userId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const emailUid = canonicalCustomerEmailUid(userEmail);
  const safeFam = (familyName || '').trim().replace(/\s+/g, '_');
  if (safeUid) keys.push(`juthori_full_tree_v3_${safeUid}`);
  if (emailUid && !keys.includes(`juthori_full_tree_v3_${emailUid}`)) {
    keys.push(`juthori_full_tree_v3_${emailUid}`);
  }
  if (safeFam && !safeUid && !emailUid) {
    keys.push(`juthori_full_tree_v3_fam_${safeFam}`);
  }
  return keys;
}

export function saveUserFamilyTreeToLocal(
  userId: string | undefined,
  familyName: string,
  people: unknown[],
  userEmail?: string
): void {
  if (typeof window === 'undefined' || !Array.isArray(people)) return;
  const serialized = JSON.stringify({
    familyName: familyName || 'العائلة',
    people,
    updatedAt: new Date().toISOString(),
  });
  for (const key of getFullFamilyTreeLocalKeys(userId, userEmail, familyName)) {
    try {
      window.localStorage.setItem(key, serialized);
    } catch {
      // Ignore storage quota
    }
  }
}

export function readUserFamilyTreeFromLocal<T = unknown>(
  userId?: string,
  userEmail?: string,
  familyName?: string
): T[] | null {
  if (typeof window === 'undefined') return null;
  for (const key of getFullFamilyTreeLocalKeys(userId, userEmail, familyName)) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { familyName?: string; people?: T[] } | T[];
      const list = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.people)
        ? parsed.people
        : null;
      if (list && list.length > 0) {
        return list;
      }
    } catch {
      // Ignore parse error
    }
  }
  return null;
}

export async function saveUserFamilyTreeToFirebase(
  userId: string,
  familyName: string,
  people: unknown[],
  userEmail?: string
): Promise<boolean> {
  saveUserFamilyTreeToLocal(userId, familyName, people, userEmail);

  const safeUid = (userId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const emailUid = canonicalCustomerEmailUid(userEmail);
  const targetUids = Array.from(
    new Set([safeUid, emailUid].filter((id) => Boolean(id)))
  );
  if (targetUids.length === 0) return false;

  try {
    const updatedAt = new Date().toISOString();
    const avatarChunks: Array<{ docId: string; dataUrl: string }> = [];

    // Offload inline base64 node portraits (`photoUrl` or `avatarDataUrl` > 8KB) into dedicated
    // Firestore sub-documents when Firebase Storage fallback was used, keeping `main` fast & < 1MB.
    const peopleToSerialize = (people as Array<Record<string, unknown>>).map(
      (node, idx) => {
        const safePersonId = String(node.id || `p_${idx}`)
          .replace(/[^a-zA-Z0-9_-]/g, '_')
          .slice(0, 80);
        const nextNode: Record<string, unknown> = { ...node };

        const rawPhoto =
          typeof node?.photoUrl === 'string' ? node.photoUrl : '';
        if (rawPhoto.startsWith('data:') && rawPhoto.length > 8192) {
          const chunkDocId = `tree_photo_${safePersonId}`;
          avatarChunks.push({ docId: chunkDocId, dataUrl: rawPhoto });
          nextNode.photoUrl = `${CHUNKED_AVATAR_PREFIX}${chunkDocId}`;
        }

        const rawAvatar =
          typeof node?.avatarDataUrl === 'string' ? node.avatarDataUrl : '';
        if (rawAvatar.startsWith('data:') && rawAvatar.length > 8192) {
          const chunkDocId = `tree_avatar_${safePersonId}`;
          avatarChunks.push({ docId: chunkDocId, dataUrl: rawAvatar });
          nextNode.avatarDataUrl = `${CHUNKED_AVATAR_PREFIX}${chunkDocId}`;
        }

        return nextNode;
      }
    );
    const peopleJson = JSON.stringify(peopleToSerialize);

    let wroteAny = false;
    for (const uid of targetUids) {
      for (const chunk of avatarChunks) {
        if (chunk.dataUrl.length <= 920000) {
          await dualSetDoc(['users', uid, 'family_tree', chunk.docId], {
            userId: uid,
            peopleJson: chunk.dataUrl,
            updatedAt,
          });
        }
      }
      const res = await dualSetDoc(['users', uid, 'family_tree', 'main'], {
        userId: uid,
        familyName: familyName || 'العائلة',
        peopleJson,
        updatedAt,
      });
      if (res.primaryWritten || res.mirrorWritten) {
        wroteAny = true;
      }
    }
    return wroteAny;
  } catch (err) {
    console.warn('[saveUserFamilyTreeToFirebase] warning:', err);
    return false;
  }
}

export async function fetchUserFamilyTreeFromFirebase<T = unknown>(
  userId: string,
  userEmail?: string,
  familyName?: string
): Promise<T[] | null> {
  const safeUid = (userId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const emailUid = canonicalCustomerEmailUid(userEmail);
  const candidateUids = Array.from(
    new Set([safeUid, emailUid].filter((id) => Boolean(id)))
  );

  for (const uid of candidateUids) {
    try {
      const data = await dualGetDoc<{
        peopleJson?: string;
        familyName?: string;
        updatedAt?: string;
      }>(['users', uid, 'family_tree', 'main']);
      if (data?.peopleJson) {
        const parsed = JSON.parse(data.peopleJson) as Array<Record<string, unknown>>;
        if (Array.isArray(parsed) && parsed.length > 0) {
          const rehydrated = await Promise.all(
            parsed.map(async (node) => {
              const nextNode: Record<string, unknown> = { ...node };

              const photoRef =
                typeof node?.photoUrl === 'string' ? node.photoUrl : '';
              if (photoRef.startsWith(CHUNKED_AVATAR_PREFIX)) {
                const chunkDocId = photoRef.slice(CHUNKED_AVATAR_PREFIX.length);
                const chunkDoc = await dualGetDoc<{ peopleJson?: string }>([
                  'users',
                  uid,
                  'family_tree',
                  chunkDocId,
                ]);
                if (chunkDoc?.peopleJson) {
                  nextNode.photoUrl = chunkDoc.peopleJson;
                }
              }

              const avatarRef =
                typeof node?.avatarDataUrl === 'string' ? node.avatarDataUrl : '';
              if (avatarRef.startsWith(CHUNKED_AVATAR_PREFIX)) {
                const chunkDocId = avatarRef.slice(CHUNKED_AVATAR_PREFIX.length);
                const chunkDoc = await dualGetDoc<{ peopleJson?: string }>([
                  'users',
                  uid,
                  'family_tree',
                  chunkDocId,
                ]);
                if (chunkDoc?.peopleJson) {
                  nextNode.avatarDataUrl = chunkDoc.peopleJson;
                }
              }

              return nextNode;
            })
          );
          saveUserFamilyTreeToLocal(
            safeUid || uid,
            familyName || data.familyName || 'العائلة',
            rehydrated,
            userEmail
          );
          // Backfill primary safeUid if loaded from emailUid
          if (safeUid && uid !== safeUid) {
            dualSetDoc(['users', safeUid, 'family_tree', 'main'], {
              userId: safeUid,
              familyName: familyName || data.familyName || 'العائلة',
              peopleJson: data.peopleJson,
              updatedAt: data.updatedAt || new Date().toISOString(),
            }).catch(() => {});
          }
          return rehydrated as unknown as T[];
        }
      }
    } catch {
      // Try next candidate UID
    }
  }

  return readUserFamilyTreeFromLocal<T>(userId, userEmail, familyName);
}

// =============================================================================
// 3. REAL CUSTOMER ORDERS IN FIREBASE (/customer_orders)
// =============================================================================
export async function upsertCustomerOrderInFirebase(
  order: Omit<CustomerOrderRecord, 'createdAt'> & { createdAt?: string }
): Promise<void> {
  const safeId = order.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  try {
    await dualSetDoc(
      ['customer_orders', safeId],
      {
        ...order,
        id: safeId,
        createdAt: order.createdAt || new Date().toISOString(),
      } as unknown as Record<string, unknown>
    );
  } catch (err) {
    console.warn('[upsertCustomerOrderInFirebase] warning:', err);
  }
}

export async function fetchAllCustomerOrdersFromFirebase(): Promise<CustomerOrderRecord[]> {
  const list = await dualGetCollection<CustomerOrderRecord>('customer_orders');
  return list
    .filter((o) => o.id !== 'ord_seed_almuqit_01')
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export async function updateCustomerOrderInFirebase(
  orderId: string,
  updates: Partial<CustomerOrderRecord>
): Promise<void> {
  const safeId = orderId.replace(/[^a-zA-Z0-9_-]/g, '_');
  try {
    const existing = await dualGetDoc<CustomerOrderRecord>(['customer_orders', safeId]);
    if (!existing) return;
    await dualSetDoc(
      ['customer_orders', safeId],
      {
        ...existing,
        ...updates,
      } as unknown as Record<string, unknown>
    );
  } catch (err) {
    console.warn('[updateCustomerOrderInFirebase] warning:', err);
  }
}

// =============================================================================
// 4. RESEARCH TICKETS WORKFLOW (/research_tickets)
// =============================================================================
export async function createResearchTicket(
  params: Omit<ResearchTicketData, 'id' | 'ticketNumber' | 'status' | 'openedAt'> & {
    customId?: string;
    customTicketNumber?: string;
    customStatus?: ResearchTicketData['status'];
  }
): Promise<ResearchTicketData> {
  const rawId =
    params.customId || `ticket_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const ticketId = rawId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const ticketNumber =
    params.customTicketNumber || `JTH-${Math.floor(1000 + Math.random() * 9000)}`;

  const ticket: ResearchTicketData = {
    id: ticketId,
    ticketNumber,
    userId: (params.userId || 'usr_guest').replace(/[^a-zA-Z0-9_-]/g, '_'),
    userFullName: params.userFullName || 'عميل منصة جذوري',
    userEmail: params.userEmail || '',
    userPhone: params.userPhone || '',
    familyName: params.familyName || '',
    targetAncestor: params.targetAncestor || params.familyName || 'غير محدد',
    tribeName: params.tribeName || '',
    familyBranch: params.familyBranch || '',
    originCountry: params.originCountry || '',
    originRegion: params.originRegion || '',
    verificationChoiceLabel: params.verificationChoiceLabel || '',
    additionalNotes: params.additionalNotes || '',
    ticketCategory: params.ticketCategory || 'P1_CUSTOMER_SEARCH',
    adamNodeId: params.adamNodeId || '',
    studioPayloadJson: params.studioPayloadJson || '',
    priorityTag: params.priorityTag,
    attachments: Array.isArray(params.attachments)
      ? params.attachments.slice(0, 25)
      : undefined,
    messages: Array.isArray(params.messages)
      ? params.messages.slice(0, 80)
      : undefined,
    resolutionPayload: params.resolutionPayload,
    lifecycleStage: params.lifecycleStage || 'OPEN',
    status: params.customStatus || 'OPEN',
    openedAt: new Date().toISOString(),
  };

  try {
    await dualSetDoc(
      ['research_tickets', ticketId],
      ticket as unknown as Record<string, unknown>
    );
    return ticket;
  } catch (error) {
    console.warn('[createResearchTicket] warning:', error);
    return ticket;
  }
}

export async function fetchUserResearchTickets(
  userId: string,
  userEmail?: string
): Promise<ResearchTicketData[]> {
  const safeUid = (userId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanEmail = (userEmail || '').trim().toLowerCase();
  if (!safeUid && !cleanEmail) return [];

  const all = await dualGetCollection<ResearchTicketData>('research_tickets');
  const matchedFromDual = all.filter((t) => {
    if (!t || t.id === 'ticket_seed_1042') return false;
    const matchUid = Boolean(safeUid) && t.userId === safeUid;
    const matchEmail =
      Boolean(cleanEmail) && (t.userEmail || '').trim().toLowerCase() === cleanEmail;
    return matchUid || matchEmail;
  });

  if (matchedFromDual.length > 0) {
    return matchedFromDual.sort((a, b) =>
      (b.openedAt || '').localeCompare(a.openedAt || '')
    );
  }

  if (!safeUid) return [];
  try {
    const [primarySnap, mirrorSnap] = await Promise.allSettled([
      withFastTimeout(
        getDocs(
          query(collection(db, 'research_tickets'), where('userId', '==', safeUid))
        ),
        2800
      ),
      withFastTimeout(
        getDocs(
          query(
            collection(mirrorDb, 'research_tickets'),
            where('userId', '==', safeUid)
          )
        ),
        2800
      ),
    ]);

    const scopedMap = new Map<string, ResearchTicketData>();
    if (mirrorSnap.status === 'fulfilled') {
      mirrorSnap.value.docs.forEach((d) => {
        const item = d.data() as ResearchTicketData;
        if (item && item.id !== 'ticket_seed_1042') {
          scopedMap.set(item.id || d.id, item);
        }
      });
    }
    if (primarySnap.status === 'fulfilled') {
      primarySnap.value.docs.forEach((d) => {
        const item = d.data() as ResearchTicketData;
        if (item && item.id !== 'ticket_seed_1042') {
          scopedMap.set(item.id || d.id, item);
        }
      });
    }

    if (scopedMap.size > 0) {
      return Array.from(scopedMap.values()).sort((a, b) =>
        (b.openedAt || '').localeCompare(a.openedAt || '')
      );
    }
  } catch {
    // Ignore query fallback error
  }
  return [];
}

const HARDCODED_TICKET_IDS_TO_IGNORE = new Set([
  'ticket_seed_1042',
  '#ALPHA-LINK-JANDIL-01',
  '#ALPHA-LINK-HISAN-02',
  '#ALPHA-LINK-MUAIT-03',
  '#ENR-ADAM-272887',
  '#P3-ALPHA-701',
  '#P3-ALPHA-702',
  '#P3-ALPHA-703',
  '#P3-ALPHA-704',
  '#P3-ALPHA-705',
  'tkt_auto_ADAM_NODE_ENRICHMENT____مقيت',
  'tkt_auto_ADAM_NODE_ENRICHMENT_آل_مقيت',
]);

function isHardcodedOrDummyTicket(t: ResearchTicketData): boolean {
  if (!t) return true;
  if (
    HARDCODED_TICKET_IDS_TO_IGNORE.has(t.id) ||
    HARDCODED_TICKET_IDS_TO_IGNORE.has(t.ticketNumber)
  ) {
    return true;
  }
  const fam = (t.familyName || t.targetAncestor || '').trim();
  const branch = (t.familyBranch || '').trim();
  const tribe = (t.tribeName || '').trim();
  if (
    fam.startsWith('عشيرة ألفا') ||
    branch === 'فرع ألفا' ||
    tribe === 'قبيلة أم' ||
    (t.ticketNumber || '').startsWith('#P3-AUTO-71')
  ) {
    return true;
  }
  const uid = (t.userId || '').trim();
  const em = (t.userEmail || '').trim().toLowerCase();
  if (
    uid === 'active-session-client' ||
    em === 'client@juthori.com' ||
    em === 'hassan.almuqit@juthori.com' ||
    em === FOUNDING_MAESTRO_MEMBER.email.toLowerCase()
  ) {
    return true;
  }
  // Exclude tickets whose familyName is an ASCII email prefix (e.g. 'snosi')
  if (fam && !/[\u0600-\u06FF]/.test(fam)) {
    return true;
  }
  // Exclude auto-created free-tier single-match tickets (unless P3 proactive mining, P1 customer search, or VIP P2 ticket)
  if (
    (t.ticketCategory === 'ALPHA_TO_ADAM_LINK' ||
      t.ticketCategory === 'ADAM_NODE_ENRICHMENT') &&
    !(t.ticketNumber || '').startsWith('#P3-') &&
    !(t.additionalNotes || '').includes('الباقة السنوية')
  ) {
    return true;
  }
  return false;
}

export async function fetchAllResearchTicketsForStaff(): Promise<ResearchTicketData[]> {
  const all = await dualGetCollection<ResearchTicketData>('research_tickets');
  const sortedAll = [...all].sort((a, b) =>
    (b.updatedAt || b.openedAt || '').localeCompare(
      a.updatedAt || a.openedAt || ''
    )
  );

  const validTickets: ResearchTicketData[] = [];
  const seenTicketKeys = new Set<string>();

  for (const t of sortedAll) {
    if (isHardcodedOrDummyTicket(t)) {
      if (t?.id) {
        dualDeleteDoc(['research_tickets', t.id]).catch(() => {});
      }
      continue;
    }

    const ticketNumKey = String(t.ticketNumber || t.id || '')
      .trim()
      .replace(/^#/, '')
      .toLowerCase();
    const docIdKey = String(t.id || '').trim().toLowerCase();

    if (
      (ticketNumKey && seenTicketKeys.has(ticketNumKey)) ||
      (docIdKey && seenTicketKeys.has(docIdKey))
    ) {
      // Remove duplicate ticket document in background
      if (t?.id) {
        dualDeleteDoc(['research_tickets', t.id]).catch(() => {});
      }
      continue;
    }

    if (ticketNumKey) seenTicketKeys.add(ticketNumKey);
    if (docIdKey) seenTicketKeys.add(docIdKey);
    validTickets.push(t);
  }

  return validTickets.sort((a, b) =>
    (b.openedAt || '').localeCompare(a.openedAt || '')
  );
}

export async function resolveResearchTicketByStaff(
  ticketId: string,
  researcherId: string,
  researcherName: string,
  findings: string,
  verifiedSources: string,
  newStatus:
    | 'lineage_found'
    | 'completed'
    | 'no_records_found'
    | 'CLOSED_AND_ENRICHED'
): Promise<void> {
  const safeId = ticketId.replace(/[^a-zA-Z0-9_-]/g, '_');
  try {
    const ticket = await dualGetDoc<ResearchTicketData>(['research_tickets', safeId]);
    if (!ticket) return;

    await dualSetDoc(
      ['research_tickets', safeId],
      {
        ...ticket,
        status: newStatus,
        assignedResearcherId: researcherId,
        assignedResearcherName: researcherName,
        researchFindings: findings,
        verifiedSources: verifiedSources,
        clientNotified: true,
        resolvedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as unknown as Record<string, unknown>
    );
  } catch (error) {
    console.warn('[resolveResearchTicketByStaff] warning:', error);
  }
}

export async function updateResearchTicketFullInFirebase(
  ticketId: string,
  updates: Partial<ResearchTicketData>
): Promise<void> {
  const safeId = ticketId.replace(/[^a-zA-Z0-9_-]/g, '_');
  try {
    const existing = await dualGetDoc<ResearchTicketData>(['research_tickets', safeId]);
    if (!existing) return;
    await dualSetDoc(
      ['research_tickets', safeId],
      {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      } as unknown as Record<string, unknown>
    );
  } catch (err) {
    console.warn('[updateResearchTicketFullInFirebase] warning:', err);
  }
}

export async function syncClientLineageTicketToFirebase(params: {
  userId: string;
  userFullName: string;
  userEmail: string;
  userPhone?: string;
  familyName: string;
  originCountry: string;
  originRegion?: string;
  rootBranchName?: string;
  rootTribeName?: string;
  matched: boolean;
  isAlphaOnlyBeforeMerge?: boolean;
  isAlphaMergedIntoAdam?: boolean;
  adamNodeId?: string;
  alphaBackgroundTicketCode?: string;
  verifiedSources?: string[];
  corroboratingAlphaEvidence?: unknown[];
  siblingBranches?: string[];
  notablesInRecord?: string[];
  enrichedLocations?: string[];
  adamSpineNodesCount?: number;
  adamSpineNodes?: unknown[];
  fullStitchedLineage?: unknown[];
  verificationChoiceLabel?: string;
  additionalNotes?: string;
  subscriptionTier?: 'free' | 'basic_verified' | 'premium_annual';
  isEscalatedDisambiguation?: boolean;
}): Promise<ResearchTicketData | null> {
  // Fix 3: Do NOT create an active customer ticket in research_tickets when the user has a resolved match
  // and has NOT subscribed to the Annual VIP package (unless they escalated via "لا أعرف / طلب تحقيق")!
  if (
    params.matched &&
    !params.isEscalatedDisambiguation &&
    params.subscriptionTier !== 'premium_annual'
  ) {
    return null;
  }

  const cleanFam = (params.familyName || 'العائلة').trim();
  if (!/[\u0600-\u06FF]/.test(cleanFam)) {
    return null;
  }
  const safeFamSlug = cleanFam.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, '');
  const safeUserSlug = (params.userId || params.userEmail || 'client')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 28);

  const isAlphaEnrichment =
    params.matched && (params.isAlphaOnlyBeforeMerge || params.isAlphaMergedIntoAdam);

  const ticketCategory: ResearchTicketData['ticketCategory'] =
    !params.matched || params.isEscalatedDisambiguation
      ? 'P1_CUSTOMER_SEARCH'
      : isAlphaEnrichment
      ? 'ALPHA_TO_ADAM_LINK'
      : 'ADAM_NODE_ENRICHMENT';

  const rawTicketNum =
    !params.matched || params.isEscalatedDisambiguation
      ? `JTH-P1-${safeFamSlug}`
      : isAlphaEnrichment
      ? params.alphaBackgroundTicketCode || `ALP-ADAM-${safeFamSlug}`
      : `#ENR-ADAM-${params.adamNodeId || '272887'}`;

  const docId = `tkt_${safeUserSlug}_${safeFamSlug}`
    .replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, '_')
    .slice(0, 80);

  const existing = await dualGetDoc<ResearchTicketData>(['research_tickets', docId]);

  const studioPayload = {
    familyName: cleanFam,
    clientName: params.userFullName,
    originCountry: params.originCountry,
    originRegion: params.originRegion || '',
    rootBranchName: params.rootBranchName || '',
    rootTribeName: params.rootTribeName || '',
    matched: params.matched,
    isAlphaOnlyBeforeMerge: Boolean(params.isAlphaOnlyBeforeMerge),
    isAlphaMergedIntoAdam: Boolean(params.isAlphaMergedIntoAdam),
    adamNodeId: params.adamNodeId || '',
    verified_sources: params.verifiedSources || [],
    corroborating_alpha_evidence_for_researcher:
      params.corroboratingAlphaEvidence || [],
    sibling_branches_in_record: params.siblingBranches || [],
    notables_in_record: params.notablesInRecord || [],
    enrichedLocations: params.enrichedLocations || [],
    adamSpineNodesCount: params.adamSpineNodesCount || 1,
    adamSpineNodes: params.adamSpineNodes || [],
    full_stitched_lineage_for_researcher: params.fullStitchedLineage || [],
    verificationChoiceLabel: params.verificationChoiceLabel || '',
  };

  const record: ResearchTicketData = {
    id: docId,
    ticketNumber: existing?.ticketNumber || rawTicketNum,
    userId: (params.userId || 'usr_client').replace(/[^a-zA-Z0-9_-]/g, '_'),
    userFullName: params.userFullName || cleanFam,
    userEmail: params.userEmail || '',
    userPhone: params.userPhone || '',
    familyName: cleanFam,
    targetAncestor: cleanFam,
    tribeName: params.rootTribeName || '',
    familyBranch: params.rootBranchName || '',
    originCountry: params.originCountry || 'غير محدد',
    originRegion: params.originRegion || '',
    verificationChoiceLabel:
      params.verificationChoiceLabel || existing?.verificationChoiceLabel || '',
    additionalNotes:
      params.additionalNotes ||
      (ticketCategory === 'ALPHA_TO_ADAM_LINK'
        ? `تذكرة إثراء ودمج شجرة آدم لمشترك الباقة السنوية: ${cleanFam} ← ${params.rootBranchName || 'الفرع'} ← ${params.rootTribeName || 'القبيلة الأم'} (${(params.corroboratingAlphaEvidence || []).length} مصدراً مرصوداً).`
        : ticketCategory === 'ADAM_NODE_ENRICHMENT'
        ? `تذكرة إثراء عقدة شجرة آدم لمشترك الباقة السنوية (${params.adamNodeId || '272887'}) لعائلة (${cleanFam}) بالمصادر والفروع الإضافية المرصودة في مشاريع ألفا.`
        : `تذكرة بحث عميل مباشرة (P1) لعائلة (${cleanFam}) للتحقيق في المخطوطات والأرشيف العثماني.`),
    ticketCategory,
    adamNodeId: params.adamNodeId || '',
    status:
      existing?.status === 'CLOSED_AND_ENRICHED'
        ? 'CLOSED_AND_ENRICHED'
        : existing?.status || 'pending_review',
    assignedResearcherId: existing?.assignedResearcherId,
    assignedResearcherName:
      existing?.assignedResearcherName || 'فريق التحقيق النَّسبي',
    researchFindings: existing?.researchFindings,
    verifiedSources:
      (params.verifiedSources && params.verifiedSources.length > 0
        ? params.verifiedSources.join(' | ')
        : existing?.verifiedSources) || '',
    studioPayloadJson: JSON.stringify(studioPayload),
    clientNotified: existing?.clientNotified ?? false,
    openedAt: existing?.openedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await dualSetDoc(
    ['research_tickets', docId],
    record as unknown as Record<string, unknown>
  );
  return record;
}

export async function updateTicketStatus(
  ticketId: string,
  newStatus: ResearchTicketData['status']
): Promise<void> {
  const safeId = (ticketId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!safeId) return;
  try {
    const existing = await dualGetDoc<ResearchTicketData>(['research_tickets', safeId]);
    if (!existing) return;
    await dualSetDoc(
      ['research_tickets', safeId],
      {
        ...existing,
        status: newStatus,
        updatedAt: new Date().toISOString(),
      } as unknown as Record<string, unknown>
    );
  } catch (err) {
    console.warn('[updateTicketStatus] warning:', err);
  }
}

export async function saveGeneratedResearchTicketToFirebase(params: {
  ticketId: string;
  alphaId?: string;
  adamNodeId?: string;
  ticketCategory:
    | 'ADAM_NODE_ENRICHMENT'
    | 'ALPHA_TO_ADAM_LINK'
    | 'P1_CUSTOMER_SEARCH'
    | 'P3_PROACTIVE_MINING'
    | 'ASSIGNED_RESEARCH';
  familyName: string;
  subRootName: string;
  motherTribeName: string;
  originCountry: string;
  originRegion: string;
  clientName: string;
  userId?: string;
  assignedResearcherId?: string;
  assignedResearcherName?: string;
  verifiedSources: string[];
  corroboratingAlphaEvidence: unknown[];
  fullStitchedLineage?: unknown[];
  extractedNodes?: unknown[];
  p3StrategicMeta?: unknown;
  precomputedDiagnostic?: unknown;
  additionalNotes?: string;
}): Promise<ResearchTicketData> {
  const cleanFam = (params.familyName || '').trim();
  const rawSlug = (params.ticketId || params.alphaId || cleanFam)
    .replace(/^#/, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, '_');
  const docId = `tkt_db_${rawSlug}`.slice(0, 80);

  const existing = await dualGetDoc<ResearchTicketData>(['research_tickets', docId]);

  const studioPayload = {
    familyName: cleanFam,
    clientName: params.clientName,
    alphaId: params.alphaId || '',
    adamNodeId: params.adamNodeId || '',
    originCountry: params.originCountry,
    originRegion: params.originRegion,
    rootBranchName: params.subRootName,
    rootTribeName: params.motherTribeName,
    matched: params.ticketCategory !== 'P1_CUSTOMER_SEARCH',
    isAlphaOnlyBeforeMerge:
      params.ticketCategory === 'P3_PROACTIVE_MINING' ||
      params.ticketCategory === 'ALPHA_TO_ADAM_LINK' ||
      params.ticketCategory === 'ASSIGNED_RESEARCH',
    verified_sources: params.verifiedSources || [],
    corroborating_alpha_evidence_for_researcher:
      params.corroboratingAlphaEvidence || [],
    full_stitched_lineage_for_researcher: params.fullStitchedLineage || [],
    extractedNodes: params.extractedNodes || [],
    p3StrategicMeta: params.p3StrategicMeta || null,
    precomputed_diagnostic: params.precomputedDiagnostic || null,
    assignedResearcherId: params.assignedResearcherId || existing?.assignedResearcherId || '',
    assignedResearcherName:
      params.assignedResearcherName || existing?.assignedResearcherName || '',
  };

  const record: ResearchTicketData = {
    id: docId,
    ticketNumber: params.ticketId.startsWith('#')
      ? params.ticketId
      : `#${params.ticketId}`,
    userId: params.userId || 'system_proactive_miner',
    userFullName: params.clientName || `سجل قاعدة البيانات (${cleanFam})`,
    userEmail: '',
    familyName: cleanFam,
    targetAncestor: cleanFam,
    tribeName: params.motherTribeName || '',
    familyBranch: params.subRootName || '',
    originCountry: params.originCountry || 'الجزيرة العربية',
    originRegion: params.originRegion || '',
    additionalNotes:
      params.additionalNotes ||
      `تذكرة بحثية حقيقية مرتبطة بقاعدة البيانات (${cleanFam} ← ${params.subRootName} ← ${params.motherTribeName})`,
    ticketCategory: params.ticketCategory,
    adamNodeId: params.adamNodeId || '',
    alphaId: params.alphaId || '',
    status: existing?.status || 'pending_review',
    assignedResearcherId:
      params.assignedResearcherId || existing?.assignedResearcherId,
    assignedResearcherName:
      params.assignedResearcherName ||
      existing?.assignedResearcherName ||
      'فريق التحقيق النَّسبي',
    verifiedSources: (params.verifiedSources || []).join(' | '),
    studioPayloadJson: JSON.stringify(studioPayload),
    clientNotified: existing?.clientNotified ?? false,
    openedAt: existing?.openedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await dualSetDoc(
    ['research_tickets', docId],
    record as unknown as Record<string, unknown>
  );
  return record;
}

export async function deleteResearchTicketFromFirebase(
  ticketId: string
): Promise<void> {
  const safeId = (ticketId || '').replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, '_');
  if (!safeId) return;
  await dualDeleteDoc(['research_tickets', safeId]);
}

// =============================================================================
// 5. WALLET & ANNUAL SUBSCRIPTION MODEL ($60/yr + Wallet Balance Bonus)
// =============================================================================
export async function executeWalletTransaction(
  userId: string,
  type: 'credit' | 'debit',
  amount: number,
  reason: string,
  referenceId?: string
): Promise<{ newBalance: number; transactionId?: string }> {
  const res = await executeAtomicWalletOperation({
    userId,
    operationType: type === 'credit' ? 'TOPUP' : 'UNLOCK_CAPSULE',
    amountUsd: amount,
    paymentMethod: type === 'credit' ? 'external' : 'wallet',
    descriptionAr: reason,
    referenceId,
    skipFeatureIdempotency: true,
  });

  if (res.status === 'INSUFFICIENT_FUNDS') {
    throw new Error(
      `رصيد المحفظة غير كافٍ لإتمام هذه المعاملة (المبلغ المتبقي: $${(
        res.shortfallUsd ?? amount
      ).toFixed(2)}).`
    );
  }

  return {
    newBalance: res.balanceAfter,
    transactionId: res.transactionId,
  };
}

/**
 * Generates a unique, human-readable financial transaction reference ID:
 * Format: `TXN-YYYYMMDD-XXXXX` (e.g. `TXN-20261116-A9F4K`)
 */
export function generateWalletTransactionId(): string {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 5; i += 1) {
    suffix += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return `TXN-${yyyy}${mm}${dd}-${suffix}`;
}

export interface AtomicWalletOperationParams {
  userId: string;
  userEmail?: string;
  userFullName?: string;
  operationType: StructuredWalletTxType;
  amountUsd: number;
  paymentMethod?: 'wallet' | 'external';
  descriptionAr: string;
  referenceId?: string;
  targetCapsuleIds?: string[];
  targetAddonSourceId?: string;
  bonusWalletCreditUsd?: number;
  charterSignatureMeta?: {
    signedAt: string;
    charterCode: string;
    contractVersion: string;
  };
  skipFeatureIdempotency?: boolean;
}

export interface AtomicWalletOperationResult {
  status: 'COMPLETED' | 'ALREADY_OWNED' | 'INSUFFICIENT_FUNDS';
  alreadyUnlocked?: boolean;
  transactionId?: string;
  balanceBefore: number;
  balanceAfter: number;
  shortfallUsd?: number;
  updatedProfile?: UserProfileData;
  transactionRecord?: WalletTransactionData;
}

/**
 * Executes all wallet top-ups, deductions, $5 root unlocks, capsule/addon unlocks,
 * Annual VIP upgrades, and Family Registrar upgrades atomically inside Firestore `runTransaction`.
 */
export async function executeAtomicWalletOperation(
  params: AtomicWalletOperationParams
): Promise<AtomicWalletOperationResult> {
  const safeUid = (params.userId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanAmount = Math.max(0, Number((params.amountUsd || 0).toFixed(2)));
  const paymentMethod = params.paymentMethod || 'wallet';
  const transactionId = generateWalletTransactionId();
  const nowIso = new Date().toISOString();

  if (!safeUid) {
    const fallbackAfter =
      params.operationType === 'TOPUP' ? cleanAmount : 0;
    return {
      status: 'COMPLETED',
      transactionId,
      balanceBefore: 0,
      balanceAfter: fallbackAfter,
    };
  }

  const runOnFirestoreInstance = async (
    targetDb: typeof db,
    includeTopLevelLedger: boolean = true
  ): Promise<AtomicWalletOperationResult> => {
    let syncedReferrerMirrorPayload: {
      referrerUid: string;
      updatedReferrerDoc: UserProfileData;
      refTxId: string;
      refTxRecord: WalletTransactionData;
      refCode?: string;
      updatedRefIndex?: ReferralCodeIndexDoc;
    } | null = null;

    const runResult = await runTransaction(targetDb, async (tx) => {
      const userRef = doc(targetDb, 'users', safeUid);
      const snap = await tx.get(userRef);
      const liveUser: UserProfileData = snap.exists()
        ? (snap.data() as UserProfileData)
        : {
            userId: safeUid,
            fullName: params.userFullName || 'مستخدم جذوري',
            email: params.userEmail || auth.currentUser?.email || 'user@juthori.com',
            accountType: 'individual',
            subscriptionTier: 'free',
            walletBalance: 0,
            isRootUnlocked: false,
            createdAt: nowIso,
          };

      // Pre-read referrer & referral_codes BEFORE any writes (Firestore transaction invariant)
      const candidateReferrerUid =
        params.operationType === 'UPGRADE_ANNUAL_VIP' &&
        liveUser.referredByUserId &&
        liveUser.referredByUserId !== safeUid &&
        !liveUser.referralRewardClaimed
          ? liveUser.referredByUserId.replace(/[^a-zA-Z0-9_-]/g, '_')
          : null;
      const candidateRefCode =
        includeTopLevelLedger && candidateReferrerUid && liveUser.referredByCode
          ? liveUser.referredByCode.trim().toUpperCase()
          : null;

      const referrerRef = candidateReferrerUid
        ? doc(targetDb, 'users', candidateReferrerUid)
        : null;
      const refCodeRef =
        includeTopLevelLedger && candidateRefCode
          ? doc(targetDb, 'referral_codes', candidateRefCode)
          : null;

      const [referrerSnap, refCodeSnap] = await Promise.all([
        referrerRef ? tx.get(referrerRef) : Promise.resolve(null),
        refCodeRef ? tx.get(refCodeRef) : Promise.resolve(null),
      ]);

      const balanceBefore = Math.max(
        0,
        Number((liveUser.walletBalance ?? 0).toFixed(2))
      );
      const liveCapsules = Array.isArray(liveUser.unlockedCapsules)
        ? liveUser.unlockedCapsules
        : [];
      const liveAddons = Array.isArray(liveUser.unlockedAddonSourceIds)
        ? liveUser.unlockedAddonSourceIds
        : [];

      // (b) Strict Idempotency Check BEFORE any cent is deducted
      if (!params.skipFeatureIdempotency) {
        if (params.operationType === 'PURCHASE_ROOT_5USD') {
          if (
            liveUser.isRootUnlocked === true ||
            liveUser.subscriptionTier === 'basic_verified' ||
            liveUser.subscriptionTier === 'premium_annual'
          ) {
            return {
              status: 'ALREADY_OWNED' as const,
              alreadyUnlocked: true,
              balanceBefore,
              balanceAfter: balanceBefore,
              updatedProfile: liveUser,
            };
          }
        } else if (params.operationType === 'UNLOCK_CAPSULE') {
          if (
            params.targetAddonSourceId &&
            liveAddons.includes(params.targetAddonSourceId)
          ) {
            return {
              status: 'ALREADY_OWNED' as const,
              alreadyUnlocked: true,
              balanceBefore,
              balanceAfter: balanceBefore,
              updatedProfile: liveUser,
            };
          }
          if (
            params.targetCapsuleIds &&
            params.targetCapsuleIds.length > 0 &&
            params.targetCapsuleIds.every((cid) => liveCapsules.includes(cid))
          ) {
            return {
              status: 'ALREADY_OWNED' as const,
              alreadyUnlocked: true,
              balanceBefore,
              balanceAfter: balanceBefore,
              updatedProfile: liveUser,
            };
          }
        } else if (params.operationType === 'UPGRADE_ANNUAL_VIP') {
          if (liveUser.subscriptionTier === 'premium_annual') {
            return {
              status: 'ALREADY_OWNED' as const,
              alreadyUnlocked: true,
              balanceBefore,
              balanceAfter: balanceBefore,
              updatedProfile: liveUser,
            };
          }
        } else if (params.operationType === 'UPGRADE_REGISTRAR') {
          if (
            liveUser.accountType === 'record_keeper' &&
            liveUser.recordKeeperCharterSigned === true
          ) {
            return {
              status: 'ALREADY_OWNED' as const,
              alreadyUnlocked: true,
              balanceBefore,
              balanceAfter: balanceBefore,
              updatedProfile: liveUser,
            };
          }
        }
      }

      // (c) Live Sufficient Balance Check when paying from wallet
      let balanceAfter = balanceBefore;
      if (params.operationType === 'TOPUP' || params.operationType === 'REFERRAL_REWARD') {
        balanceAfter = Number((balanceBefore + cleanAmount).toFixed(2));
      } else if (paymentMethod === 'wallet' && cleanAmount > 0) {
        if (balanceBefore < cleanAmount) {
          const shortfallUsd = Number((cleanAmount - balanceBefore).toFixed(2));
          return {
            status: 'INSUFFICIENT_FUNDS' as const,
            shortfallUsd,
            balanceBefore,
            balanceAfter: balanceBefore,
            updatedProfile: liveUser,
          };
        }
        balanceAfter = Number(
          (
            balanceBefore -
            cleanAmount +
            (params.bonusWalletCreditUsd || 0)
          ).toFixed(2)
        );
      } else {
        balanceAfter = Number(
          (balanceBefore + (params.bonusWalletCreditUsd || 0)).toFixed(2)
        );
      }

      // (d) Compute updated package/feature state + atomic financial ledger record
      const nextCapsules = params.targetCapsuleIds?.length
        ? Array.from(new Set([...liveCapsules, ...params.targetCapsuleIds]))
        : liveCapsules;

      const nextAddons = params.targetAddonSourceId
        ? Array.from(new Set([...liveAddons, params.targetAddonSourceId]))
        : liveAddons;

      let nextSubscriptionTier = liveUser.subscriptionTier;
      let nextRootUnlocked = Boolean(liveUser.isRootUnlocked);
      let nextAccountType = liveUser.accountType;

      if (params.operationType === 'PURCHASE_ROOT_5USD') {
        nextRootUnlocked = true;
        if (nextSubscriptionTier === 'free') {
          nextSubscriptionTier = 'basic_verified';
        }
      } else if (params.operationType === 'UPGRADE_ANNUAL_VIP') {
        nextRootUnlocked = true;
        nextSubscriptionTier = 'premium_annual';
      } else if (params.operationType === 'UPGRADE_REGISTRAR') {
        nextAccountType = 'record_keeper';
      }

      const prevRevenue = Number(liveUser.paidRevenueUsd ?? 0);
      const addedRevenue =
        params.operationType === 'TOPUP' || params.operationType === 'REFERRAL_REWARD'
          ? 0
          : cleanAmount;
      const nextRevenue = Number((prevRevenue + addedRevenue).toFixed(2));

      const resolvedEmail = (
        params.userEmail ||
        liveUser.email ||
        auth.currentUser?.email ||
        'user@juthori.com'
      ).trim();

      const willCreditReferrer = Boolean(
        candidateReferrerUid && referrerSnap && referrerSnap.exists()
      );

      const updatedUserDoc: UserProfileData = sanitizeFirestoreData({
        ...liveUser,
        userId: safeUid,
        email: resolvedEmail,
        accountType: nextAccountType,
        subscriptionTier: nextSubscriptionTier,
        isRootUnlocked: nextRootUnlocked,
        walletBalance: balanceAfter,
        paidRevenueUsd: nextRevenue,
        referralCode:
          liveUser.referralCode || buildDeterministicReferralCode(safeUid),
        referralRewardClaimed: willCreditReferrer
          ? true
          : liveUser.referralRewardClaimed,
        unlockedCapsules: nextCapsules.length > 0 ? nextCapsules : liveUser.unlockedCapsules,
        unlockedAddonSourceIds:
          nextAddons.length > 0 ? nextAddons : liveUser.unlockedAddonSourceIds,
        recordKeeperCharterSigned:
          params.operationType === 'UPGRADE_REGISTRAR'
            ? true
            : liveUser.recordKeeperCharterSigned,
        recordKeeperCharterSignedAt:
          params.charterSignatureMeta?.signedAt ||
          liveUser.recordKeeperCharterSignedAt,
        recordKeeperCharterCode:
          params.charterSignatureMeta?.charterCode ||
          liveUser.recordKeeperCharterCode,
        recordKeeperContractVersion:
          params.charterSignatureMeta?.contractVersion ||
          liveUser.recordKeeperContractVersion,
        lastWalletTransactionId: transactionId,
        updatedAt: nowIso,
      });

      const direction: 'credit' | 'debit' =
        params.operationType === 'TOPUP' || params.operationType === 'REFERRAL_REWARD'
          ? 'credit'
          : 'debit';

      const txRecord: WalletTransactionData = sanitizeFirestoreData({
        id: transactionId,
        transactionId,
        userId: safeUid,
        userEmail: resolvedEmail,
        type: params.operationType,
        direction,
        paymentMethod,
        bonusCreditUsd:
          params.bonusWalletCreditUsd && params.bonusWalletCreditUsd > 0
            ? params.bonusWalletCreditUsd
            : undefined,
        amount: cleanAmount,
        balanceBefore,
        balanceAfter,
        status: 'COMPLETED',
        descriptionAr: params.descriptionAr,
        reason: params.descriptionAr,
        referenceId: params.referenceId || transactionId,
        createdAt: nowIso,
      });

      tx.set(userRef, updatedUserDoc as unknown as Record<string, unknown>);
      if (includeTopLevelLedger) {
        tx.set(
          doc(targetDb, 'wallet_transactions', transactionId),
          txRecord as unknown as Record<string, unknown>
        );
      }
      tx.set(
        doc(targetDb, 'users', safeUid, 'wallet_transactions', transactionId),
        txRecord as unknown as Record<string, unknown>
      );

      // (e) Atomic $10 REFERRAL_REWARD payout to the inviter inside the SAME transaction
      if (willCreditReferrer && referrerRef && referrerSnap && candidateReferrerUid) {
        const refData = referrerSnap.data() as UserProfileData;
        const refBefore = Math.max(
          0,
          Number((refData.walletBalance ?? 0).toFixed(2))
        );
        const refAfter = Number((refBefore + REFERRAL_REWARD_USD).toFixed(2));
        const refTxId = generateWalletTransactionId();
        const refRewardDesc = `مكافأة إحالة عائلية ($${REFERRAL_REWARD_USD}) عند اشتراك (${
          liveUser.fullName || 'عضو مدعو'
        }) في الباقة السنوية`;

        const updatedReferrerDoc: UserProfileData = sanitizeFirestoreData({
          ...refData,
          walletBalance: refAfter,
          lastWalletTransactionId: refTxId,
          updatedAt: nowIso,
        });

        const refTxRecord: WalletTransactionData = sanitizeFirestoreData({
          id: refTxId,
          transactionId: refTxId,
          userId: candidateReferrerUid,
          userEmail: refData.email || 'referrer@juthori.com',
          type: 'REFERRAL_REWARD',
          direction: 'credit',
          paymentMethod: 'wallet',
          amount: REFERRAL_REWARD_USD,
          balanceBefore: refBefore,
          balanceAfter: refAfter,
          status: 'COMPLETED',
          descriptionAr: refRewardDesc,
          reason: refRewardDesc,
          referenceId: `REF-${safeUid}`,
          referredInviteeUid: safeUid,
          createdAt: nowIso,
        });

        tx.set(
          referrerRef,
          updatedReferrerDoc as unknown as Record<string, unknown>
        );
        if (includeTopLevelLedger) {
          tx.set(
            doc(targetDb, 'wallet_transactions', refTxId),
            refTxRecord as unknown as Record<string, unknown>
          );
        }
        tx.set(
          doc(targetDb, 'users', candidateReferrerUid, 'wallet_transactions', refTxId),
          refTxRecord as unknown as Record<string, unknown>
        );

        let updatedRefIndex: ReferralCodeIndexDoc | undefined;
        if (refCodeRef && candidateRefCode) {
          const existingIdx: ReferralCodeIndexDoc =
            refCodeSnap && refCodeSnap.exists()
              ? (refCodeSnap.data() as ReferralCodeIndexDoc)
              : {
                  code: candidateRefCode,
                  ownerId: candidateReferrerUid,
                  ownerName: refData.fullName,
                  familyName: refData.familyName || '',
                  invitees: [],
                  totalEarnedUsd: 0,
                  updatedAt: nowIso,
                };
          const prevList = Array.isArray(existingIdx.invitees)
            ? existingIdx.invitees
            : [];
          const hadEntry = prevList.some((item) => item.userId === safeUid);
          const nextInvitees: ReferralInviteeSummary[] = hadEntry
            ? prevList.map((item) =>
                item.userId === safeUid
                  ? {
                      ...item,
                      status: 'SUBSCRIBED_PAID' as const,
                      rewardUsd: REFERRAL_REWARD_USD,
                      upgradedAt: nowIso,
                    }
                  : item
              )
            : [
                ...prevList,
                {
                  userId: safeUid,
                  fullName: liveUser.fullName || 'عضو مدعو',
                  status: 'SUBSCRIBED_PAID' as const,
                  rewardUsd: REFERRAL_REWARD_USD,
                  createdAt: liveUser.createdAt || nowIso,
                  upgradedAt: nowIso,
                },
              ];
          updatedRefIndex = sanitizeFirestoreData({
            ...existingIdx,
            invitees: nextInvitees.slice(-300),
            totalEarnedUsd: Number(
              ((existingIdx.totalEarnedUsd || 0) + REFERRAL_REWARD_USD).toFixed(2)
            ),
            updatedAt: nowIso,
          });
          tx.set(
            refCodeRef,
            updatedRefIndex as unknown as Record<string, unknown>
          );
        }

        syncedReferrerMirrorPayload = {
          referrerUid: candidateReferrerUid,
          updatedReferrerDoc,
          refTxId,
          refTxRecord,
          refCode: candidateRefCode || undefined,
          updatedRefIndex,
        };
      }

      return {
        status: 'COMPLETED' as const,
        transactionId,
        balanceBefore,
        balanceAfter,
        updatedProfile: updatedUserDoc,
        transactionRecord: txRecord,
      };
    });

    if (syncedReferrerMirrorPayload) {
      const rp = syncedReferrerMirrorPayload as {
        referrerUid: string;
        updatedReferrerDoc: UserProfileData;
        refTxId: string;
        refTxRecord: WalletTransactionData;
        refCode?: string;
        updatedRefIndex?: ReferralCodeIndexDoc;
      };
      Promise.allSettled([
        setDoc(
          doc(mirrorDb, 'users', rp.referrerUid),
          sanitizeFirestoreData(rp.updatedReferrerDoc as unknown as Record<string, unknown>)
        ),
        setDoc(
          doc(mirrorDb, 'wallet_transactions', rp.refTxId),
          sanitizeFirestoreData(rp.refTxRecord as unknown as Record<string, unknown>)
        ),
        setDoc(
          doc(mirrorDb, 'users', rp.referrerUid, 'wallet_transactions', rp.refTxId),
          sanitizeFirestoreData(rp.refTxRecord as unknown as Record<string, unknown>)
        ),
        ...(rp.refCode && rp.updatedRefIndex
          ? [
              setDoc(
                doc(mirrorDb, 'referral_codes', rp.refCode),
                sanitizeFirestoreData(rp.updatedRefIndex as unknown as Record<string, unknown>)
              ),
            ]
          : []),
      ]).catch(() => {});

      sendCustomerNotification({
        userId: rp.referrerUid,
        title: `مكافأة إحالة عائلية (+$${REFERRAL_REWARD_USD}) أُضيفت لمحفظتك ✦`,
        body:
          rp.refTxRecord.descriptionAr ||
          `تم إيداع مكافأة إحالة بقيمة +$${REFERRAL_REWARD_USD} في محفظتك.`,
        category: 'wallet_bonus',
        senderRole: 'system',
      }).catch(() => {});
    }

    return runResult;
  };

  const executeResilientProfileFallback = async (): Promise<AtomicWalletOperationResult> => {
    const existingProfile = await fetchUserProfile(safeUid).catch(() => null);
    const liveUser: UserProfileData = existingProfile || {
      userId: safeUid,
      fullName: params.userFullName || 'مستخدم جذوري',
      email: params.userEmail || auth.currentUser?.email || 'user@juthori.com',
      accountType: 'individual',
      subscriptionTier: 'free',
      walletBalance: 0,
      isRootUnlocked: false,
      createdAt: nowIso,
    };

    const balanceBefore = Math.max(
      0,
      Number((liveUser.walletBalance ?? 0).toFixed(2))
    );
    const liveCapsules = Array.isArray(liveUser.unlockedCapsules)
      ? liveUser.unlockedCapsules
      : [];
    const liveAddons = Array.isArray(liveUser.unlockedAddonSourceIds)
      ? liveUser.unlockedAddonSourceIds
      : [];

    if (!params.skipFeatureIdempotency) {
      if (
        params.operationType === 'PURCHASE_ROOT_5USD' &&
        (liveUser.isRootUnlocked === true ||
          liveUser.subscriptionTier === 'basic_verified' ||
          liveUser.subscriptionTier === 'premium_annual')
      ) {
        return {
          status: 'ALREADY_OWNED',
          alreadyUnlocked: true,
          balanceBefore,
          balanceAfter: balanceBefore,
          updatedProfile: liveUser,
        };
      }
      if (
        params.operationType === 'UPGRADE_ANNUAL_VIP' &&
        liveUser.subscriptionTier === 'premium_annual'
      ) {
        return {
          status: 'ALREADY_OWNED',
          alreadyUnlocked: true,
          balanceBefore,
          balanceAfter: balanceBefore,
          updatedProfile: liveUser,
        };
      }
      if (
        params.operationType === 'UPGRADE_REGISTRAR' &&
        liveUser.accountType === 'record_keeper' &&
        liveUser.recordKeeperCharterSigned === true
      ) {
        return {
          status: 'ALREADY_OWNED',
          alreadyUnlocked: true,
          balanceBefore,
          balanceAfter: balanceBefore,
          updatedProfile: liveUser,
        };
      }
      if (params.operationType === 'UNLOCK_CAPSULE') {
        if (
          params.targetAddonSourceId &&
          liveAddons.includes(params.targetAddonSourceId)
        ) {
          return {
            status: 'ALREADY_OWNED',
            alreadyUnlocked: true,
            balanceBefore,
            balanceAfter: balanceBefore,
            updatedProfile: liveUser,
          };
        }
        if (
          params.targetCapsuleIds &&
          params.targetCapsuleIds.length > 0 &&
          params.targetCapsuleIds.every((cid) => liveCapsules.includes(cid))
        ) {
          return {
            status: 'ALREADY_OWNED',
            alreadyUnlocked: true,
            balanceBefore,
            balanceAfter: balanceBefore,
            updatedProfile: liveUser,
          };
        }
      }
    }

    let balanceAfter = balanceBefore;
    if (
      params.operationType === 'TOPUP' ||
      params.operationType === 'REFERRAL_REWARD'
    ) {
      balanceAfter = Number((balanceBefore + cleanAmount).toFixed(2));
    } else if (paymentMethod === 'wallet' && cleanAmount > 0) {
      if (balanceBefore < cleanAmount) {
        const shortfallUsd = Number((cleanAmount - balanceBefore).toFixed(2));
        return {
          status: 'INSUFFICIENT_FUNDS',
          shortfallUsd,
          balanceBefore,
          balanceAfter: balanceBefore,
          updatedProfile: liveUser,
        };
      }
      balanceAfter = Number(
        (
          balanceBefore -
          cleanAmount +
          (params.bonusWalletCreditUsd || 0)
        ).toFixed(2)
      );
    } else {
      balanceAfter = Number(
        (balanceBefore + (params.bonusWalletCreditUsd || 0)).toFixed(2)
      );
    }

    const nextCapsules = params.targetCapsuleIds?.length
      ? Array.from(new Set([...liveCapsules, ...params.targetCapsuleIds]))
      : liveCapsules;
    const nextAddons = params.targetAddonSourceId
      ? Array.from(new Set([...liveAddons, params.targetAddonSourceId]))
      : liveAddons;

    let nextSubscriptionTier = liveUser.subscriptionTier;
    let nextRootUnlocked = Boolean(liveUser.isRootUnlocked);
    let nextAccountType = liveUser.accountType;

    if (params.operationType === 'PURCHASE_ROOT_5USD') {
      nextRootUnlocked = true;
      if (nextSubscriptionTier === 'free') {
        nextSubscriptionTier = 'basic_verified';
      }
    } else if (params.operationType === 'UPGRADE_ANNUAL_VIP') {
      nextRootUnlocked = true;
      nextSubscriptionTier = 'premium_annual';
    } else if (params.operationType === 'UPGRADE_REGISTRAR') {
      nextAccountType = 'record_keeper';
    }

    const prevRevenue = Number(liveUser.paidRevenueUsd ?? 0);
    const addedRevenue =
      params.operationType === 'TOPUP' ||
      params.operationType === 'REFERRAL_REWARD'
        ? 0
        : cleanAmount;
    const nextRevenue = Number((prevRevenue + addedRevenue).toFixed(2));
    const resolvedEmail = (
      params.userEmail ||
      liveUser.email ||
      auth.currentUser?.email ||
      'user@juthori.com'
    ).trim();

    const updatedUserDoc: UserProfileData = sanitizeFirestoreData({
      ...liveUser,
      userId: safeUid,
      email: resolvedEmail,
      accountType: nextAccountType,
      subscriptionTier: nextSubscriptionTier,
      isRootUnlocked: nextRootUnlocked,
      walletBalance: balanceAfter,
      paidRevenueUsd: nextRevenue,
      referralCode:
        liveUser.referralCode || buildDeterministicReferralCode(safeUid),
      unlockedCapsules:
        nextCapsules.length > 0 ? nextCapsules : liveUser.unlockedCapsules,
      unlockedAddonSourceIds:
        nextAddons.length > 0 ? nextAddons : liveUser.unlockedAddonSourceIds,
      recordKeeperCharterSigned:
        params.operationType === 'UPGRADE_REGISTRAR'
          ? true
          : liveUser.recordKeeperCharterSigned,
      recordKeeperCharterSignedAt:
        params.charterSignatureMeta?.signedAt ||
        liveUser.recordKeeperCharterSignedAt,
      recordKeeperCharterCode:
        params.charterSignatureMeta?.charterCode ||
        liveUser.recordKeeperCharterCode,
      recordKeeperContractVersion:
        params.charterSignatureMeta?.contractVersion ||
        liveUser.recordKeeperContractVersion,
      lastWalletTransactionId: transactionId,
      updatedAt: nowIso,
    });

    const direction: 'credit' | 'debit' =
      params.operationType === 'TOPUP' ||
      params.operationType === 'REFERRAL_REWARD'
        ? 'credit'
        : 'debit';

    const txRecord: WalletTransactionData = sanitizeFirestoreData({
      id: transactionId,
      transactionId,
      userId: safeUid,
      userEmail: resolvedEmail,
      type: params.operationType,
      direction,
      paymentMethod,
      bonusCreditUsd:
        params.bonusWalletCreditUsd && params.bonusWalletCreditUsd > 0
          ? params.bonusWalletCreditUsd
          : undefined,
      amount: cleanAmount,
      balanceBefore,
      balanceAfter,
      status: 'COMPLETED',
      descriptionAr: params.descriptionAr,
      reason: params.descriptionAr,
      referenceId: params.referenceId || transactionId,
      createdAt: nowIso,
    });

    await Promise.allSettled([
      dualSetDoc(
        ['users', safeUid],
        updatedUserDoc as unknown as Record<string, unknown>
      ),
      dualSetDoc(
        ['users', safeUid, 'wallet_transactions', transactionId],
        txRecord as unknown as Record<string, unknown>
      ),
      dualSetDoc(
        ['wallet_transactions', transactionId],
        txRecord as unknown as Record<string, unknown>
      ),
    ]);

    return {
      status: 'COMPLETED',
      transactionId,
      balanceBefore,
      balanceAfter,
      updatedProfile: updatedUserDoc,
      transactionRecord: txRecord,
    };
  };

  let txResult: AtomicWalletOperationResult;
  try {
    txResult = await withFastTimeout(runOnFirestoreInstance(db, true), 5000);
    if (txResult.status === 'COMPLETED') {
      runOnFirestoreInstance(mirrorDb, true).catch(() => {});
    }
  } catch (primaryFullErr) {
    try {
      // Retry atomic transaction on `juthori-com` (`db`) scoped strictly to `users/{uid}` + `users/{uid}/wallet_transactions/{txId}`
      txResult = await withFastTimeout(runOnFirestoreInstance(db, false), 5000);
      if (txResult.status === 'COMPLETED' && txResult.transactionRecord) {
        dualSetDoc(
          ['wallet_transactions', txResult.transactionRecord.id],
          txResult.transactionRecord as unknown as Record<string, unknown>
        ).catch(() => {});
        runOnFirestoreInstance(mirrorDb, true).catch(() => {});
      }
    } catch (primarySubErr) {
      console.warn(
        '[executeAtomicWalletOperation] primary db fallback to mirrorDb:',
        primaryFullErr,
        primarySubErr
      );
      try {
        txResult = await withFastTimeout(
          runOnFirestoreInstance(mirrorDb, true),
          5000
        );
      } catch {
        txResult = await executeResilientProfileFallback();
      }
    }
  }

  // Background sync to customer_orders so /team Operations Hub sees live wallet & tier immediately
  if (txResult.status === 'COMPLETED' && txResult.updatedProfile) {
    const prof = txResult.updatedProfile;
    dualGetCollection<CustomerOrderRecord>('customer_orders')
      .then((orders) => {
        const emailLower = (prof.email || '').trim().toLowerCase();
        const mappedStatus: CustomerOrderRecord['accountStatus'] =
          prof.subscriptionTier === 'premium_annual'
            ? 'annual_vip'
            : prof.isRootUnlocked || prof.subscriptionTier === 'basic_verified'
            ? 'paid_5_root'
            : 'free';
        for (const ord of orders) {
          if (
            ord.userId === safeUid ||
            (emailLower && (ord.email || '').trim().toLowerCase() === emailLower)
          ) {
            updateCustomerOrderInFirebase(ord.id, {
              walletBalanceUsd: prof.walletBalance,
              paidRevenueUsd: prof.paidRevenueUsd ?? ord.paidRevenueUsd,
              accountStatus: mappedStatus,
              legalRole: prof.accountType,
            }).catch(() => {});
          }
        }
      })
      .catch(() => {});
  }

  return txResult;
}

export async function processAnnualSubscriptionUpgrade(
  userId: string,
  planPriceUsd: number = 60,
  bonusWalletCreditsUsd: number = 25
): Promise<{ success: boolean; newBalance: number; transactionId?: string }> {
  const safeUid = (userId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!safeUid) {
    return { success: true, newBalance: bonusWalletCreditsUsd };
  }
  try {
    const res = await executeAtomicWalletOperation({
      userId: safeUid,
      operationType: 'UPGRADE_ANNUAL_VIP',
      amountUsd: planPriceUsd,
      paymentMethod: 'external',
      bonusWalletCreditUsd: bonusWalletCreditsUsd,
      descriptionAr: `ترقية إلى الباقة السنوية بريميوم ($${planPriceUsd}/سنة) شاملة رصيد محفظة ترحيبي ($${bonusWalletCreditsUsd})`,
      referenceId: 'annual_vip_upgrade',
    });
    return {
      success: true,
      newBalance: res.balanceAfter,
      transactionId: res.transactionId,
    };
  } catch {
    return { success: true, newBalance: bonusWalletCreditsUsd };
  }
}

export async function fetchUserWalletTransactions(
  userId: string
): Promise<WalletTransactionData[]> {
  if (!userId) return [];
  const safeUid = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const deduped = new Map<string, WalletTransactionData>();

  const collectDocs = (docsList: WalletTransactionData[]) => {
    for (const item of docsList) {
      if (!item) continue;
      const key = item.transactionId || item.id;
      if (key && !deduped.has(key)) {
        deduped.set(key, item);
      }
    }
  };

  try {
    const [centralSnap, userSubSnap] = await Promise.allSettled([
      withFastTimeout(
        getDocs(
          query(
            collection(db, 'wallet_transactions'),
            where('userId', '==', safeUid)
          )
        ),
        3000
      ),
      withFastTimeout(
        getDocs(
          query(
            collection(db, 'users', safeUid, 'wallet_transactions'),
            orderBy('createdAt', 'desc'),
            limit(40)
          )
        ),
        3000
      ),
    ]);

    if (centralSnap.status === 'fulfilled' && !centralSnap.value.empty) {
      collectDocs(
        centralSnap.value.docs.map((d) => d.data() as WalletTransactionData)
      );
    }
    if (userSubSnap.status === 'fulfilled' && !userSubSnap.value.empty) {
      collectDocs(
        userSubSnap.value.docs.map((d) => d.data() as WalletTransactionData)
      );
    }

    if (deduped.size > 0) {
      return Array.from(deduped.values())
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
        .slice(0, 40);
    }
  } catch {
    // Fallback to mirrorDb below
  }

  try {
    const [mirrorCentral, mirrorSub] = await Promise.allSettled([
      getDocs(
        query(
          collection(mirrorDb, 'wallet_transactions'),
          where('userId', '==', safeUid)
        )
      ),
      getDocs(collection(mirrorDb, 'users', safeUid, 'wallet_transactions')),
    ]);
    if (mirrorCentral.status === 'fulfilled') {
      collectDocs(
        mirrorCentral.value.docs.map((d) => d.data() as WalletTransactionData)
      );
    }
    if (mirrorSub.status === 'fulfilled') {
      collectDocs(
        mirrorSub.value.docs.map((d) => d.data() as WalletTransactionData)
      );
    }
    return Array.from(deduped.values())
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, 40);
  } catch {
    return [];
  }
}

// =============================================================================
// 6. CUSTOMER CARE NOTIFICATIONS
// =============================================================================
export async function sendCustomerNotification(
  params: Omit<CustomerNotificationData, 'id' | 'isRead' | 'createdAt'>
): Promise<CustomerNotificationData> {
  const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const safeUid = (params.userId || '').replace(/[^a-zA-Z0-9_-]/g, '_');

  const notif: CustomerNotificationData = {
    ...params,
    userId: safeUid,
    id: notifId,
    isRead: false,
    createdAt: new Date().toISOString(),
  };

  if (!safeUid) return notif;

  try {
    await dualSetDoc(
      ['users', safeUid, 'notifications', notifId],
      notif as unknown as Record<string, unknown>
    );
    return notif;
  } catch {
    return notif;
  }
}

export async function fetchUserNotifications(
  userId: string
): Promise<CustomerNotificationData[]> {
  if (!userId) return [];
  const safeUid = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  try {
    const snap = await getDocs(collection(db, 'users', safeUid, 'notifications'));
    if (!snap.empty) {
      return snap.docs
        .map((d) => d.data() as CustomerNotificationData)
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    }
  } catch {
    // Fallback to mirrorDb
  }
  try {
    const snap = await getDocs(collection(mirrorDb, 'users', safeUid, 'notifications'));
    return snap.docs
      .map((d) => d.data() as CustomerNotificationData)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch {
    return [];
  }
}

export async function markNotificationAsRead(
  userId: string,
  notifId: string
): Promise<void> {
  if (!userId || !notifId) return;
  const safeUid = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  try {
    const existing = await dualGetDoc<CustomerNotificationData>([
      'users',
      safeUid,
      'notifications',
      notifId,
    ]);
    if (existing) {
      await dualSetDoc(
        ['users', safeUid, 'notifications', notifId],
        { ...existing, isRead: true } as unknown as Record<string, unknown>
      );
    }
  } catch {
    // Ignore
  }
}

// =============================================================================
// 7. ISOLATED /Team RBAC & FOUNDING MAESTRO MANAGEMENT (/team_members)
// =============================================================================
const LEGACY_DUMMY_SEED_DOCS: Array<[string, string]> = [
  ['team_members', 'team_res_mansour'],
  ['team_members', 'team_ops_sara'],
  ['team_members', 'team_cms_tariq'],
  ['customer_orders', 'ord_seed_almuqit_01'],
  ['research_tickets', 'ticket_seed_1042'],
  ['knowledge_articles', 'art_methodology_01'],
  ['knowledge_articles', 'art_arab_migrations_02'],
  ['charter_requests', 'chr_seed_01'],
  ['support_tickets', 'sup_seed_01'],
];

const LEGACY_DUMMY_TEAM_IDS = new Set([
  'team_res_mansour',
  'team_ops_sara',
  'team_cms_tariq',
]);

let hasPurgedLegacySeedsInSession = false;
let hasEnsuredMaestroInSession = false;
const provisionedAuthEmailsInSession = new Set<string>();

export function getTeamMemberDocIdByEmail(email: string): string {
  const cleanEmail = email.trim().toLowerCase();
  if (cleanEmail === FOUNDING_MAESTRO_MEMBER.email.toLowerCase()) {
    return FOUNDING_MAESTRO_MEMBER.id;
  }
  return `team_usr_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
}

export async function purgeLegacyDummySeedsFromFirestore(): Promise<void> {
  if (hasPurgedLegacySeedsInSession) return;
  hasPurgedLegacySeedsInSession = true;
  await Promise.allSettled([
    ...LEGACY_DUMMY_SEED_DOCS.map(([col, docId]) => dualDeleteDoc([col, docId])),
    dualDeleteDoc(['users', 'usr_maestro_kareem']),
    dualDeleteDoc(['users', 'team_maestro_kareem']),
    dualDeleteDoc(['research_tickets', 'tkt_auto_ADAM_NODE_ENRICHMENT____مقيت']),
    dualDeleteDoc(['research_tickets', 'tkt_auto_ADAM_NODE_ENRICHMENT_آل_مقيت']),
  ]);

  // Architectural separation cleanup: remove any team_usr_* or team member accounts from `users` collection,
  // and purge any dummy/hardcoded seed tickets
  try {
    const [allUsers, allTeam, allTickets, allOrders] = await Promise.all([
      dualGetCollection<UserProfileData & { id?: string }>('users'),
      dualGetCollection<TeamMemberRecord>('team_members'),
      dualGetCollection<ResearchTicketData>('research_tickets'),
      dualGetCollection<CustomerOrderRecord>('customer_orders'),
    ]);
    const teamEmails = new Set(
      allTeam.map((t) => (t.email || '').trim().toLowerCase()).filter(Boolean)
    );
    const deletePromises: Promise<void>[] = [];

    for (const u of allUsers) {
      const docId = u.id || u.userId || '';
      const uEmail = (u.email || '').trim().toLowerCase();
      if (
        docId &&
        (isTeamAccountDocInUsers(docId, u.email, u.fullName) ||
          (uEmail && teamEmails.has(uEmail)))
      ) {
        deletePromises.push(dualDeleteDoc(['users', docId]));
      }
    }

    for (const t of allTickets) {
      const docId = t.id || '';
      if (docId && isHardcodedOrDummyTicket(t)) {
        deletePromises.push(dualDeleteDoc(['research_tickets', docId]));
      }
    }

    for (const o of allOrders) {
      const docId = o.id || '';
      const oEmail = (o.email || '').trim().toLowerCase();
      if (
        docId &&
        (isCorporateStaffEmail(oEmail) || (oEmail && teamEmails.has(oEmail)))
      ) {
        deletePromises.push(dualDeleteDoc(['customer_orders', docId]));
      }
    }

    if (deletePromises.length > 0) {
      await Promise.allSettled(deletePromises);
    }
  } catch {
    // Non-blocking cleanup
  }
}

export async function ensureFoundingMaestroInFirebase(): Promise<TeamMemberRecord> {
  hasEnsuredMaestroInSession = true;
  try {
    const existingGm = await dualGetDoc<TeamMemberRecord>([
      'team_members',
      DEFAULT_GENERAL_MANAGER_MEMBER.id,
    ]);
    const gmRecordToSave: TeamMemberRecord = existingGm?.email
      ? {
          ...existingGm,
          id: DEFAULT_GENERAL_MANAGER_MEMBER.id,
          role: existingGm.role || 'مدير عام',
          status: 'نشط',
          passwordHash: '123456',
          permissions:
            existingGm.permissions && existingGm.permissions.length > 0
              ? existingGm.permissions
              : DEFAULT_GENERAL_MANAGER_MEMBER.permissions,
        }
      : DEFAULT_GENERAL_MANAGER_MEMBER;

    // Architectural Separation Rule: Founding Maestro & General Manager belong strictly to `team_members`, NEVER to `users` (which is strictly for Customers)
    await Promise.allSettled([
      dualSetDoc(
        ['team_members', FOUNDING_MAESTRO_MEMBER.id],
        FOUNDING_MAESTRO_MEMBER as unknown as Record<string, unknown>
      ),
      dualSetDoc(
        ['team_members', DEFAULT_GENERAL_MANAGER_MEMBER.id],
        gmRecordToSave as unknown as Record<string, unknown>
      ),
      dualDeleteDoc(['users', 'usr_maestro_kareem']),
    ]);

    return FOUNDING_MAESTRO_MEMBER;
  } catch {
    return FOUNDING_MAESTRO_MEMBER;
  }
}

export async function bootstrapJuthoriFirestoreDatabase(): Promise<{
  juthoriComSynced: boolean;
  mirrorSynced: boolean;
  collectionsSeeded: string[];
  juthoriComError?: string;
}> {
  try {
    // 1. Purge legacy dummy seeds, clean any team accounts out of `users`, & ensure Founding Maestro exists in `team_members`
    await Promise.allSettled([
      purgeLegacyDummySeedsFromFirestore(),
      ensureFoundingMaestroInFirebase(),
    ]);

    // NOTE: Never re-seed deleted customer profiles from localStorage on bootstrap!
    // Customer documents in `users` are only created upon explicit registration/login.

    // 3. Cross-heal all top-level collections between mirrorDb and juthori-com
    const targetCollections = [
      'team_members',
      'users',
      'customer_orders',
      'research_tickets',
      'knowledge_articles',
      'charter_requests',
      'support_tickets',
      'newsletter_subscribers',
      'public_sites',
      'kinship_circles',
      'enrichment_requests',
      'site_access_requests',
      'site_guestbook',
      'referral_codes',
    ];
    await Promise.allSettled(
      targetCollections.map((col) => dualGetCollection<{ id?: string; userId?: string }>(col))
    );

    return {
      juthoriComSynced: true,
      mirrorSynced: true,
      collectionsSeeded: targetCollections,
    };
  } catch (err) {
    return {
      juthoriComSynced: false,
      mirrorSynced: true,
      collectionsSeeded: ['team_members', 'users'],
      juthoriComError: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function fetchAllTeamMembersFromFirebase(): Promise<TeamMemberRecord[]> {
  // Trigger background maintenance non-blockingly
  purgeLegacyDummySeedsFromFirestore().catch(() => {});
  ensureFoundingMaestroInFirebase().catch(() => {});

  const rawList = await dualGetCollection<TeamMemberRecord>('team_members');
  const validList = rawList.filter((m) => m && m.email && !LEGACY_DUMMY_TEAM_IDS.has(m.id));

  // Strictly deduplicate by normalized lowercase email and delete any duplicate document IDs
  const byEmailMap = new Map<string, TeamMemberRecord>();
  const duplicateIdsToDelete: string[] = [];

  for (const item of validList) {
    const emailKey = item.email.trim().toLowerCase();
    const canonicalId = getTeamMemberDocIdByEmail(emailKey);

    if (!byEmailMap.has(emailKey)) {
      byEmailMap.set(emailKey, item);
    } else {
      const existing = byEmailMap.get(emailKey)!;
      // Prefer the canonical ID document over random timestamp IDs
      if (item.id === canonicalId && existing.id !== canonicalId) {
        duplicateIdsToDelete.push(existing.id);
        byEmailMap.set(emailKey, item);
      } else {
        duplicateIdsToDelete.push(item.id);
      }
    }
  }

  // Clean up any duplicate documents in the background
  if (duplicateIdsToDelete.length > 0) {
    Promise.allSettled(
      duplicateIdsToDelete.map((dupId) => dualDeleteDoc(['team_members', dupId]))
    ).catch(() => {});
  }

  // Ensure Founding Maestro is always present
  const maestroKey = FOUNDING_MAESTRO_MEMBER.email.toLowerCase();
  if (!byEmailMap.has(maestroKey)) {
    byEmailMap.set(maestroKey, FOUNDING_MAESTRO_MEMBER);
  }

  const dedupedList = Array.from(byEmailMap.values());

  // Backfill any team member into Firebase Authentication in the background once per session
  dedupedList.forEach((member) => {
    const key = member.email.trim().toLowerCase();
    if (!provisionedAuthEmailsInSession.has(key)) {
      provisionedAuthEmailsInSession.add(key);
      provisionUserInFirebaseAuth(
        member.email,
        member.passwordHash || 'Juthori@2026',
        `${member.name} (${member.role})`
      ).catch(() => {});
    }
  });

  return dedupedList;
}

export async function authenticateTeamMemberInFirebase(
  email: string,
  password: string
): Promise<{ member: TeamMemberRecord | null; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPass = password.trim();

  const syncIsolatedStaffMirrorSession = async (
    staffEmail: string,
    staffPassword: string,
    staffRecord: TeamMemberRecord
  ) => {
    try {
      const authPass =
        staffPassword.length >= 6 ? staffPassword : staffPassword.padEnd(6, '0');
      let mirrorUid = mirrorAuth.currentUser?.uid;
      if (
        !mirrorUid ||
        (mirrorAuth.currentUser?.email || '').trim().toLowerCase() !== staffEmail
      ) {
        try {
          const cred = await withFastTimeout(
            signInWithEmailAndPassword(mirrorAuth, staffEmail, authPass),
            2500
          );
          mirrorUid = cred.user.uid;
        } catch {
          const cred = await withFastTimeout(
            createUserWithEmailAndPassword(mirrorAuth, staffEmail, authPass),
            2500
          );
          mirrorUid = cred.user.uid;
        }
      }
      if (mirrorUid) {
        await setDoc(
          doc(mirrorDb, 'team_members', mirrorUid),
          sanitizeFirestoreData({
            ...staffRecord,
            id: mirrorUid,
          } as unknown as Record<string, unknown>)
        ).catch(() => {});
      }
    } catch {
      // Non-blocking mirror staff auth sync
    }
  };

  // 1. Instant Fast-Path for Founding Maestro (< 10ms)
  // IMPORTANT: Never call signInWithEmailAndPassword on the primary customer `auth` instance here,
  // so logging into `/Team` never logs the customer portal in as "كريم طاحون"!
  if (
    cleanEmail === FOUNDING_MAESTRO_MEMBER.email.toLowerCase() &&
    (cleanPass === FOUNDING_MAESTRO_MEMBER.passwordHash || cleanPass === 'Kareem123@')
  ) {
    ensureFoundingMaestroInFirebase().catch(() => {});
    syncIsolatedStaffMirrorSession(
      cleanEmail,
      FOUNDING_MAESTRO_MEMBER.passwordHash,
      FOUNDING_MAESTRO_MEMBER
    ).catch(() => {});
    return { member: FOUNDING_MAESTRO_MEMBER };
  }

  // 1.B. Instant Fast-Path for General Manager (hassan.alamri@adamresearchcenter.net) with temporary password 123456
  if (
    cleanEmail === DEFAULT_GENERAL_MANAGER_MEMBER.email.toLowerCase() &&
    cleanPass === '123456'
  ) {
    try {
      const existingGm = await dualGetDoc<TeamMemberRecord>([
        'team_members',
        DEFAULT_GENERAL_MANAGER_MEMBER.id,
      ]);
      const resolvedGm: TeamMemberRecord = existingGm?.email
        ? {
            ...existingGm,
            id: DEFAULT_GENERAL_MANAGER_MEMBER.id,
            role: existingGm.role || 'مدير عام',
            status: 'نشط',
            passwordHash: '123456',
          }
        : DEFAULT_GENERAL_MANAGER_MEMBER;
      dualSetDoc(
        ['team_members', DEFAULT_GENERAL_MANAGER_MEMBER.id],
        resolvedGm as unknown as Record<string, unknown>
      ).catch(() => {});
      syncIsolatedStaffMirrorSession(cleanEmail, '123456', resolvedGm).catch(
        () => {}
      );
      return { member: resolvedGm };
    } catch {
      return { member: DEFAULT_GENERAL_MANAGER_MEMBER };
    }
  }

  // 2. Fast Direct Canonical Doc Lookup (~80ms) with Collection Fallback
  try {
    const canonicalDocId = getTeamMemberDocIdByEmail(cleanEmail);
    let matched = await dualGetDoc<TeamMemberRecord>([
      'team_members',
      canonicalDocId,
    ]);

    if (!matched || !matched.email) {
      const members = await fetchAllTeamMembersFromFirebase();
      matched =
        members.find((m) => m.email.trim().toLowerCase() === cleanEmail) || null;
    }

    if (!matched) {
      const existingCustomer = await fetchUserProfileByEmail(cleanEmail);
      if (existingCustomer) {
        return {
          member: null,
          error:
            'هذا البريد الإلكتروني مسجل كحساب عميل في منصة جذوري، ولا يملك صلاحية الدخول لبوابة الإدارة (/Team). حسابات الإدارة وحسابات العملاء معزولة تماماً.',
        };
      }
      return {
        member: null,
        error: 'البريد الإلكتروني غير مسجل في منظومة فريق العمل (/Team).',
      };
    }
    if (matched.status !== 'نشط') {
      return {
        member: null,
        error: 'هذا الحساب الإداري موقوف حالياً. يرجى مراجعة المايسترو أو المدير العام.',
      };
    }
    if (matched.passwordHash && matched.passwordHash !== cleanPass) {
      return {
        member: null,
        error: 'كلمة المرور غير صحيحة.',
      };
    }

    syncIsolatedStaffMirrorSession(cleanEmail, cleanPass, matched).catch(() => {});
    return { member: matched };
  } catch {
    return {
      member: null,
      error: 'تعذر التحقق من بيانات الدخول في قاعدة البيانات.',
    };
  }
}

export async function addTeamMemberToFirebase(params: {
  name: string;
  email: string;
  passwordHash: string;
  role: TeamRoleType;
  invitedByName?: string;
}): Promise<{
  member: TeamMemberRecord;
  emailDispatched: boolean;
  registeredInAuth: boolean;
}> {
  const cleanEmail = params.email.trim().toLowerCase();
  const rawPassword = params.passwordHash.trim() || 'Juthori@2026';
  if (rawPassword.length < 6) {
    throw new Error(
      'WEAK_PASSWORD: يجب أن تتكون كلمة المرور من 6 خانات على الأقل ليتم تسجيلها في Firebase Authentication.'
    );
  }

  // 0. Enforce strict separation: block emails already belonging to a Customer account in `users`
  const existingCustomerAccount = await fetchUserProfileByEmail(cleanEmail);
  if (existingCustomerAccount) {
    throw new Error(
      `CUSTOMER_EMAIL_ISOLATED: البريد الإلكتروني (${params.email.trim()}) مسجل بالفعل كحساب عميل في المنصة. يرجى تخصيص بريد إداري مستقل لضمان العزل التام بين حسابات الإدارة وحسابات العملاء.`
    );
  }

  // 1. Check for duplicate email before adding
  const existingMembers = await fetchAllTeamMembersFromFirebase();
  const duplicate = existingMembers.find(
    (m) => m.email.trim().toLowerCase() === cleanEmail
  );
  if (duplicate) {
    throw new Error(
      `DUPLICATE_TEAM_EMAIL: البريد الإلكتروني (${params.email.trim()}) مسجل بالفعل باسم "${duplicate.name}". لا يمكن إضافة نفس المستخدم أكثر من مرة.`
    );
  }

  // 2. Deterministic document ID prevents duplicate rows at the database level
  const id = getTeamMemberDocIdByEmail(cleanEmail);
  const newMember: TeamMemberRecord = {
    id,
    name: params.name.trim(),
    email: params.email.trim(),
    passwordHash: rawPassword,
    role: params.role,
    status: 'نشط',
    assignedTickets: 0,
    completedTickets: 0,
    avgCompletionTime: 'جديد',
    permissions: getPermissionsForTeamRole(params.role),
    createdAt: new Date().toISOString(),
  };

  // 3. Register user in Firebase Authentication (juthori-com + mirror) AND save strictly in `team_members` (NEVER in `users`)
  const [authResult] = await Promise.all([
    provisionUserInFirebaseAuth(
      newMember.email,
      newMember.passwordHash,
      `${newMember.name} (${newMember.role})`
    ),
    dualSetDoc(
      ['team_members', id],
      newMember as unknown as Record<string, unknown>
    ),
    dualDeleteDoc(['users', id]),
  ]);

  provisionedAuthEmailsInSession.add(cleanEmail);

  // 4. Send official invitation via Resend API (info@Juthori.com) non-blockingly with fast timeout
  let emailDispatched = false;
  try {
    const res = await withFastTimeout(
      fetch('/api/juthori/team/send-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newMember.email,
          name: newMember.name,
          role: newMember.role,
          tempPassword: newMember.passwordHash,
          invitedBy: params.invitedByName || 'كريم طاحون (المايسترو)',
        }),
      }),
      2500
    );
    if (res.ok) {
      const data = await res.json();
      emailDispatched = Boolean(data.dispatched);
    }
  } catch {
    // Non-blocking
  }

  return {
    member: newMember,
    emailDispatched,
    registeredInAuth: authResult.registeredInAuth,
  };
}

export async function updateTeamMemberStatusInFirebase(
  memberId: string,
  nextStatus: 'نشط' | 'موقوف'
): Promise<void> {
  const safeId = memberId.replace(/[^a-zA-Z0-9_-]/g, '_');
  try {
    const existing = await dualGetDoc<TeamMemberRecord>(['team_members', safeId]);
    if (!existing) return;
    await dualSetDoc(
      ['team_members', safeId],
      {
        ...existing,
        status: nextStatus,
      } as unknown as Record<string, unknown>
    );
  } catch (err) {
    console.warn('[updateTeamMemberStatusInFirebase] warning:', err);
  }
}

export async function deleteTeamMemberFromFirebase(
  memberId: string,
  memberEmail?: string
): Promise<void> {
  const safeId = memberId.replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!safeId || safeId === FOUNDING_MAESTRO_MEMBER.id) return;
  const tasks: Promise<unknown>[] = [
    dualDeleteDoc(['team_members', safeId]),
    dualDeleteDoc(['users', safeId]),
  ];
  if (memberEmail) {
    const canonicalId = getTeamMemberDocIdByEmail(memberEmail);
    if (canonicalId !== safeId && canonicalId !== FOUNDING_MAESTRO_MEMBER.id) {
      tasks.push(dualDeleteDoc(['team_members', canonicalId]));
    }
  }
  await Promise.allSettled(tasks);
}

// =============================================================================
// 8. KNOWLEDGE CENTER CMS IN FIREBASE (/knowledge_articles) & IMAGE ENGINE
// =============================================================================
const KNOWLEDGE_LOCAL_BACKUP_KEY = 'juthori_knowledge_articles_backup_v1';
const KNOWLEDGE_DELETED_IDS_KEY = 'juthori_knowledge_articles_deleted_v1';

function readLocalKnowledgeBackup(): KnowledgeArticleRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KNOWLEDGE_LOCAL_BACKUP_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as KnowledgeArticleRecord[]) : [];
  } catch {
    return [];
  }
}

function writeLocalKnowledgeBackup(articles: KnowledgeArticleRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KNOWLEDGE_LOCAL_BACKUP_KEY, JSON.stringify(articles));
  } catch {
    // Ignore storage quota errors
  }
}

function readDeletedKnowledgeIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(KNOWLEDGE_DELETED_IDS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function addDeletedKnowledgeId(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const current = readDeletedKnowledgeIds();
    current.add(id);
    localStorage.setItem(
      KNOWLEDGE_DELETED_IDS_KEY,
      JSON.stringify(Array.from(current))
    );
  } catch {
    // Ignore
  }
}

export function normalizeExternalImageUrl(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:image/') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  // Convert Google Drive sharing links to direct high-res image stream
  const gdriveMatch =
    trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    trimmed.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/) ||
    trimmed.match(/drive\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/);
  if (gdriveMatch && gdriveMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${gdriveMatch[1]}`;
  }

  // Convert Dropbox preview links to direct raw image links
  if (trimmed.includes('dropbox.com/') && trimmed.includes('?dl=0')) {
    return trimmed.replace('?dl=0', '?raw=1');
  }

  return trimmed;
}

export async function compressDataUrlImageIfNeeded(
  dataUrl: string,
  mode: 'cover' | 'inline' = 'cover',
  maxBytesLength: number = 220000
): Promise<string> {
  const normalized = normalizeExternalImageUrl(dataUrl);
  if (!normalized.startsWith('data:image/')) {
    return normalized;
  }
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return normalized;
  }

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        if (mode === 'cover') {
          // Standardize cover images to 16:9 widescreen editorial format (1200x675)
          const targetW = 1200;
          const targetH = 675;
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(normalized);
            return;
          }
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          const srcRatio = img.width / Math.max(1, img.height);
          const dstRatio = targetW / targetH; // 1.777 (16:9)

          if (srcRatio >= 1.35 && srcRatio <= 2.35) {
            // Landscape image: smart center-cover fill
            let drawW = targetW;
            let drawH = targetH;
            let offsetX = 0;
            let offsetY = 0;
            if (srcRatio > dstRatio) {
              drawH = targetH;
              drawW = img.width * (targetH / img.height);
              offsetX = (targetW - drawW) / 2;
            } else {
              drawW = targetW;
              drawH = img.height * (targetW / img.width);
              offsetY = (targetH - drawH) / 2;
            }
            ctx.fillStyle = '#1E1B18';
            ctx.fillRect(0, 0, targetW, targetH);
            ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
          } else {
            // Portrait, square, or vertical manuscript scan:
            // Draw atmospheric blurred heritage backdrop in 16:9 + full uncropped image sharp in center
            ctx.fillStyle = '#1E1B18';
            ctx.fillRect(0, 0, targetW, targetH);
            ctx.save();
            ctx.filter = 'blur(22px) brightness(0.48)';
            const bgScale = Math.max(targetW / img.width, targetH / img.height) * 1.1;
            const bgW = img.width * bgScale;
            const bgH = img.height * bgScale;
            ctx.drawImage(
              img,
              (targetW - bgW) / 2,
              (targetH - bgH) / 2,
              bgW,
              bgH
            );
            ctx.restore();

            // Subtle vignette frame
            const fgScale = Math.min(targetW / img.width, targetH / img.height);
            const fgW = Math.round(img.width * fgScale);
            const fgH = Math.round(img.height * fgScale);
            const fgX = Math.round((targetW - fgW) / 2);
            const fgY = Math.round((targetH - fgH) / 2);
            ctx.drawImage(img, fgX, fgY, fgW, fgH);
          }

          let out = canvas.toDataURL('image/jpeg', 0.84);
          if (out.length > maxBytesLength) {
            out = canvas.toDataURL('image/jpeg', 0.72);
          }
          if (out.length > maxBytesLength) {
            // Step down to 960x540 (16:9) if still above budget
            const smallCanvas = document.createElement('canvas');
            smallCanvas.width = 960;
            smallCanvas.height = 540;
            const sCtx = smallCanvas.getContext('2d');
            if (sCtx) {
              sCtx.imageSmoothingEnabled = true;
              sCtx.imageSmoothingQuality = 'high';
              sCtx.drawImage(canvas, 0, 0, 960, 540);
              out = smallCanvas.toDataURL('image/jpeg', 0.75);
            }
          }
          resolve(out);
        } else {
          // Inline article image: preserve natural aspect ratio up to 960x640
          const maxW = 960;
          const maxH = 640;
          let width = img.width;
          let height = img.height;
          if (width > maxW) {
            height = Math.round((height * maxW) / width);
            width = maxW;
          }
          if (height > maxH) {
            width = Math.round((width * maxH) / height);
            height = maxH;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(normalized);
            return;
          }
          ctx.fillStyle = '#FAF6F0';
          ctx.fillRect(0, 0, width, height);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          let out = canvas.toDataURL('image/jpeg', 0.82);
          if (out.length > maxBytesLength) {
            out = canvas.toDataURL('image/jpeg', 0.7);
          }
          resolve(out);
        }
      } catch {
        resolve(normalized);
      }
    };
    img.onerror = () => resolve(normalized);
    img.src = normalized;
  });
}

export async function processAndUploadKnowledgeImage(
  file: File,
  mode: 'cover' | 'inline' = 'cover'
): Promise<{ url: string; width: number; height: number }> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });

  const standardizedDataUrl = await compressDataUrlImageIfNeeded(
    rawDataUrl,
    mode,
    mode === 'cover' ? 220000 : 160000
  );

  // Also try uploading to Firebase Storage with a fast timeout; if Storage rules block unauthenticated uploads, use standardizedDataUrl
  try {
    const response = await fetch(standardizedDataUrl);
    const blob = await response.blob();
    const storagePath = `knowledge_articles/${mode}_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 6)}.jpg`;
    const storageRef = ref(storage, storagePath);
    await withFastTimeout(uploadBytes(storageRef, blob), 1800);
    const downloadUrl = await withFastTimeout(getDownloadURL(storageRef), 1200);
    if (downloadUrl) {
      return {
        url: downloadUrl,
        width: mode === 'cover' ? 1200 : 960,
        height: mode === 'cover' ? 675 : 640,
      };
    }
  } catch {
    // Fallback to standardized high-clarity data URL stored directly in Firestore
  }

  return {
    url: standardizedDataUrl,
    width: mode === 'cover' ? 1200 : 960,
    height: mode === 'cover' ? 675 : 640,
  };
}

async function optimizeInlineImagesInHtml(html: string): Promise<string> {
  if (!html || !html.includes('data:image/')) return html;
  const imgSrcRegex = /src=["'](data:image\/[^"']+)["']/g;
  const matches = Array.from(html.matchAll(imgSrcRegex));
  if (matches.length === 0) return html;

  let updatedHtml = html;
  const perImageBudget = Math.min(
    160000,
    Math.floor(550000 / Math.max(1, matches.length))
  );

  for (const match of matches) {
    const originalDataUrl = match[1];
    if (originalDataUrl && originalDataUrl.length > perImageBudget) {
      const compressed = await compressDataUrlImageIfNeeded(
        originalDataUrl,
        'inline',
        perImageBudget
      );
      updatedHtml = updatedHtml.replace(originalDataUrl, compressed);
    }
  }
  return updatedHtml;
}

export async function fetchKnowledgeArticlesFromFirebase(
  publishedOnly: boolean = false
): Promise<KnowledgeArticleRecord[]> {
  const deletedIds = readDeletedKnowledgeIds();
  const list = await dualGetCollection<KnowledgeArticleRecord>(
    'knowledge_articles',
    4000
  );
  const localBackup = readLocalKnowledgeBackup();

  const mergedById = new Map<string, KnowledgeArticleRecord>();

  // 1. Seed from local backup first so recently saved articles are never lost
  for (const item of localBackup) {
    if (
      item &&
      item.id &&
      !deletedIds.has(item.id) &&
      item.id !== 'art_methodology_01' &&
      item.id !== 'art_arab_migrations_02'
    ) {
      mergedById.set(item.id, item);
    }
  }

  // 2. Overlay live Firestore documents (preferring newer updatedAt)
  const remoteIds = new Set<string>();
  for (const remoteItem of list) {
    if (
      !remoteItem ||
      !remoteItem.id ||
      deletedIds.has(remoteItem.id) ||
      remoteItem.id === 'art_methodology_01' ||
      remoteItem.id === 'art_arab_migrations_02'
    ) {
      continue;
    }
    remoteIds.add(remoteItem.id);
    const existingLocal = mergedById.get(remoteItem.id);
    if (
      !existingLocal ||
      (remoteItem.updatedAt || remoteItem.createdAt || '') >=
        (existingLocal.updatedAt || existingLocal.createdAt || '')
    ) {
      mergedById.set(remoteItem.id, remoteItem);
    }
  }

  const finalAll = Array.from(mergedById.values()).sort((a, b) =>
    (b.createdAt || '').localeCompare(a.createdAt || '')
  );

  // Update local backup with merged truth
  writeLocalKnowledgeBackup(finalAll);

  // 3. Background self-healing: if any article in finalAll wasn't in remote Firestore yet, push it to Firestore
  for (const item of finalAll) {
    if (!remoteIds.has(item.id)) {
      dualSetDoc(
        ['knowledge_articles', item.id],
        item as unknown as Record<string, unknown>,
        5000
      ).catch(() => {});
    }
  }

  return publishedOnly
    ? finalAll.filter((a) => a.status === 'published')
    : finalAll;
}

export async function saveKnowledgeArticleToFirebase(
  article: Partial<Omit<KnowledgeArticleRecord, 'id' | 'createdAt'>> & {
    id?: string;
    title: string;
    createdAt?: string;
  }
): Promise<KnowledgeArticleRecord> {
  const id = (
    article.id || `art_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
  ).replace(/[^a-zA-Z0-9_-]/g, '_');

  const section = (article.section || article.category || 'الروايات والذاكرة').trim();
  const filter = (article.filter || 'عام').trim();
  const type: KnowledgeContentType = article.type === 'فيديو' ? 'فيديو' : 'مقال';
  const description = (article.description || article.summary || '')
    .trim()
    .slice(0, 4500);
  const rawContent = (article.content || description).trim();
  const optimizedContent = (await optimizeInlineImagesInHtml(rawContent)).slice(
    0,
    900000
  );

  const rawCoverUrl = (article.coverImageUrl || '').trim();
  const optimizedCoverUrl = rawCoverUrl.startsWith('data:image/')
    ? await compressDataUrlImageIfNeeded(rawCoverUrl, 'cover', 220000)
    : normalizeExternalImageUrl(rawCoverUrl);

  const author = (article.author || article.authorName || '').trim();
  const editor = (article.editor || '').trim();
  const publishDate = (
    article.publishDate || new Date().toISOString().split('T')[0]
  ).trim();

  // Preserve original createdAt if editing an existing article
  const existingBackup = readLocalKnowledgeBackup().find((a) => a.id === id);

  const record: KnowledgeArticleRecord = {
    id,
    title: article.title.trim().slice(0, 480),
    section,
    filter,
    type,
    description,
    category: `${section} - ${filter}`,
    summary: description,
    content: optimizedContent,
    author,
    editor,
    authorName: author || editor || 'هيئة تحرير المركز المعرفي',
    publishDate,
    imageCaption: (article.imageCaption || '').trim(),
    imageCopyright: (article.imageCopyright || '').trim(),
    coverTextOverlay: (article.coverTextOverlay || '').trim(),
    coverImageUrl: optimizedCoverUrl,
    videoUrl: (article.videoUrl || '').trim(),
    duration: (article.duration || '').trim(),
    status: article.status || 'published',
    createdAt:
      article.createdAt ||
      existingBackup?.createdAt ||
      new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // 1. Immediately update local backup so it is never lost
  const currentLocal = readLocalKnowledgeBackup().filter((a) => a.id !== id);
  writeLocalKnowledgeBackup([record, ...currentLocal]);

  // 2. Persist to both Firestore databases with a generous 5500ms timeout
  await dualSetDoc(
    ['knowledge_articles', id],
    record as unknown as Record<string, unknown>,
    5500
  );

  // 3. Notify any mounted KnowledgeCenterView or LandingPage instances
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('juthori-knowledge-articles-updated'));
  }

  return record;
}

export async function deleteKnowledgeArticleFromFirebase(
  articleId: string
): Promise<void> {
  const safeId = articleId.replace(/[^a-zA-Z0-9_-]/g, '_');
  addDeletedKnowledgeId(safeId);
  const currentLocal = readLocalKnowledgeBackup().filter(
    (a) => a.id !== safeId && a.id !== articleId
  );
  writeLocalKnowledgeBackup(currentLocal);

  await dualDeleteDoc(['knowledge_articles', safeId]);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('juthori-knowledge-articles-updated'));
  }
}

export async function subscribeToNewsletterInFirebase(
  email: string,
  source: string = 'knowledge_center'
): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return;
  const id = `sub_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
  await dualSetDoc(['newsletter_subscribers', id], {
    id,
    email: cleanEmail,
    subscribedAt: new Date().toISOString(),
    source,
  });
}

// =============================================================================
// 9. CHARTER REQUESTS & SUPPORT TICKETS IN FIREBASE
// =============================================================================
export async function createCharterRequestInFirebase(
  req: Omit<CharterRequestRecord, 'id' | 'submittedAt' | 'charterCode' | 'status'> & {
    submittedAt?: string;
    charterCode?: string;
    status?: CharterRequestRecord['status'];
  }
): Promise<CharterRequestRecord> {
  const id = `chr_${Date.now()}`;
  const record: CharterRequestRecord = {
    userId: req.userId,
    clientName: req.clientName,
    familyName: req.familyName,
    email: req.email,
    country: req.country,
    submittedAt: req.submittedAt || new Date().toLocaleDateString('ar-SA'),
    charterCode:
      req.charterCode || `JTH-CHR-${Math.floor(1000 + Math.random() * 9000)}`,
    contractVersion: req.contractVersion || 'V2_24 May_2026',
    ipAddress: req.ipAddress || '',
    auditTrailId: req.auditTrailId || '',
    status: req.status || 'معتمد (شجرتي مفعّلة)',
    id,
  };
  await dualSetDoc(
    ['charter_requests', id],
    record as unknown as Record<string, unknown>
  );
  return record;
}

export async function fetchCharterRequestsFromFirebase(): Promise<
  CharterRequestRecord[]
> {
  const list = await dualGetCollection<CharterRequestRecord>('charter_requests');
  return list.filter((c) => c.id !== 'chr_seed_01');
}

// =============================================================================
// 10. ELECTRONIC SIGNATURE & LEGAL CONSENT AUDIT TRAIL (/users/{uid}/audit_trail & /audit_trail)
// =============================================================================
const LOCAL_AUDIT_TRAIL_STORAGE_KEY = 'juthori_legal_audit_trail_v1';

function readLocalAuditTrailBackup(): LegalAuditTrailEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_AUDIT_TRAIL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LegalAuditTrailEntry[]) : [];
  } catch {
    return [];
  }
}

function writeLocalAuditTrailBackup(entries: LegalAuditTrailEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      LOCAL_AUDIT_TRAIL_STORAGE_KEY,
      JSON.stringify(entries.slice(0, 200))
    );
  } catch {
    // Ignore storage quota errors
  }
}

export async function recordLegalAuditTrailInFirebase(params: {
  userId: string;
  userFullName: string;
  familyName?: string;
  userEmail: string;
  eventType: LegalAuditEventType;
  documentTitle: string;
  documentVersion: string;
  certificateCode?: string;
  orderReference?: string;
  consentStatement: string;
  ipAddress?: string;
  ipCountry?: string;
  ipCity?: string;
  verificationMethod?: string;
}): Promise<LegalAuditTrailEntry> {
  const safeUid = (params.userId || `usr_${Date.now()}`).replace(
    /[^a-zA-Z0-9_-]/g,
    '_'
  );
  const now = new Date();
  const signedAtIso = now.toISOString();
  const signedAtFormatted = `${now.toLocaleDateString('ar-SA')} — ${now.toLocaleTimeString(
    'ar-SA',
    { hour: '2-digit', minute: '2-digit', second: '2-digit' }
  )}`;

  const randSuffix = Math.floor(100000 + Math.random() * 900000);
  const prefix =
    params.eventType === 'RECORD_KEEPER_CONTRACT_SIGNATURE'
      ? 'JTH-CERT-RK'
      : 'JTH-CERT-TOS';
  const certificateCode = (params.certificateCode || `${prefix}-${randSuffix}`).slice(
    0,
    80
  );
  const auditId = `aud_${safeUid.slice(-16)}_${params.eventType === 'RECORD_KEEPER_CONTRACT_SIGNATURE' ? 'rk' : 'tos'}_${now.getTime()}`.replace(
    /[^a-zA-Z0-9_-]/g,
    '_'
  );

  const userAgent =
    typeof navigator !== 'undefined' && navigator.userAgent
      ? navigator.userAgent.slice(0, 480)
      : 'Juthori Web Client (ESIGN/UETA Compliant)';

  const entry: LegalAuditTrailEntry = {
    id: auditId,
    userId: safeUid.slice(0, 128),
    userFullName: (params.userFullName || 'عميل منصة جذوري').trim().slice(0, 150),
    familyName: (params.familyName || '').trim().slice(0, 100),
    userEmail: (params.userEmail || 'user@juthori.com').trim().slice(0, 120),
    eventType: params.eventType,
    documentTitle: params.documentTitle.trim().slice(0, 300),
    documentVersion: params.documentVersion.trim().slice(0, 80),
    certificateCode,
    orderReference: (
      params.orderReference || `ORD-${safeUid.slice(-6).toUpperCase()}`
    ).slice(0, 80),
    consentStatement: params.consentStatement.trim().slice(0, 1000),
    ipAddress: (params.ipAddress || '127.0.0.1').trim().slice(0, 80),
    ipCountry: (params.ipCountry || '').trim().slice(0, 80),
    ipCity: (params.ipCity || '').trim().slice(0, 80),
    userAgent,
    signedAtIso,
    signedAtFormatted,
    verificationMethod: (
      params.verificationMethod || 'مصادقة الحساب الإلكتروني عبر منصة جذوري'
    ).slice(0, 120),
    status: 'COMPLETED_AND_SEALED',
  };

  // 1. Save immediately in local backup for instant UI rendering
  const existingLocal = readLocalAuditTrailBackup().filter(
    (item) => item.id !== entry.id
  );
  writeLocalAuditTrailBackup([entry, ...existingLocal]);

  // 2. Persist to user subcollection (/users/{uid}/audit_trail/{auditId}) AND central (/audit_trail/{auditId}) across both Firestore databases
  await Promise.allSettled([
    dualSetDoc(
      ['users', safeUid, 'audit_trail', auditId],
      entry as unknown as Record<string, unknown>
    ),
    dualSetDoc(
      ['audit_trail', auditId],
      entry as unknown as Record<string, unknown>
    ),
  ]);

  return entry;
}

export async function fetchUserLegalAuditTrailFromFirebase(
  userId: string,
  userEmail?: string
): Promise<LegalAuditTrailEntry[]> {
  const safeUid = (userId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanEmail = (userEmail || '').trim().toLowerCase();
  const merged = new Map<string, LegalAuditTrailEntry>();

  for (const item of readLocalAuditTrailBackup()) {
    if (
      (safeUid && item.userId === safeUid) ||
      (cleanEmail && (item.userEmail || '').trim().toLowerCase() === cleanEmail)
    ) {
      merged.set(item.id, item);
    }
  }

  if (safeUid) {
    try {
      const [primarySnap, mirrorSnap] = await Promise.allSettled([
        withFastTimeout(
          getDocs(collection(db, 'users', safeUid, 'audit_trail')),
          2500
        ),
        withFastTimeout(
          getDocs(collection(mirrorDb, 'users', safeUid, 'audit_trail')),
          2500
        ),
      ]);
      if (primarySnap.status === 'fulfilled') {
        primarySnap.value.docs.forEach((d) => {
          const item = d.data() as LegalAuditTrailEntry;
          if (item && item.id) merged.set(item.id, item);
        });
      }
      if (mirrorSnap.status === 'fulfilled') {
        mirrorSnap.value.docs.forEach((d) => {
          const item = d.data() as LegalAuditTrailEntry;
          if (item && item.id && !merged.has(item.id)) {
            merged.set(item.id, item);
          }
        });
      }
    } catch {
      // Fallback to central collection below
    }
  }

  try {
    const centralList = await dualGetCollection<LegalAuditTrailEntry>(
      'audit_trail',
      2500
    );
    for (const item of centralList) {
      if (
        (safeUid && item.userId === safeUid) ||
        (cleanEmail && (item.userEmail || '').trim().toLowerCase() === cleanEmail)
      ) {
        merged.set(item.id, item);
      }
    }
  } catch {
    // Ignore
  }

  return Array.from(merged.values()).sort((a, b) =>
    (b.signedAtIso || '').localeCompare(a.signedAtIso || '')
  );
}

export async function fetchAllLegalAuditTrailForStaff(): Promise<
  LegalAuditTrailEntry[]
> {
  const merged = new Map<string, LegalAuditTrailEntry>();
  for (const item of readLocalAuditTrailBackup()) {
    if (item && item.id) merged.set(item.id, item);
  }
  try {
    const remoteList = await dualGetCollection<LegalAuditTrailEntry>(
      'audit_trail',
      3000
    );
    for (const item of remoteList) {
      if (item && item.id) merged.set(item.id, item);
    }
  } catch {
    // Ignore
  }
  return Array.from(merged.values()).sort((a, b) =>
    (b.signedAtIso || '').localeCompare(a.signedAtIso || '')
  );
}

export async function approveCharterRequestInFirebase(
  requestId: string
): Promise<void> {
  try {
    const existing = await dualGetDoc<CharterRequestRecord>(['charter_requests', requestId]);
    if (!existing) return;
    await dualSetDoc(
      ['charter_requests', requestId],
      {
        ...existing,
        status: 'معتمد (شجرتي مفعّلة)',
      } as unknown as Record<string, unknown>
    );
  } catch {
    // Ignore
  }
}

export async function createSupportTicketInFirebase(
  ticket: Omit<SupportTicketRecord, 'id' | 'status' | 'timestamp'> & {
    status?: SupportTicketRecord['status'];
    timestamp?: string;
  }
): Promise<SupportTicketRecord> {
  const id = `sup_${Date.now()}`;
  const record: SupportTicketRecord = {
    clientName: ticket.clientName,
    email: ticket.email,
    category: ticket.category,
    subject: ticket.subject,
    message: ticket.message,
    status: ticket.status || 'مفتوح',
    timestamp: ticket.timestamp || new Date().toLocaleDateString('ar-SA'),
    id,
  };
  await dualSetDoc(
    ['support_tickets', id],
    record as unknown as Record<string, unknown>
  );
  return record;
}

export async function fetchSupportTicketsFromFirebase(): Promise<
  SupportTicketRecord[]
> {
  const list = await dualGetCollection<SupportTicketRecord>('support_tickets');
  return list.filter((t) => t.id !== 'sup_seed_01');
}

export async function resolveSupportTicketInFirebase(
  ticketId: string
): Promise<void> {
  try {
    const existing = await dualGetDoc<SupportTicketRecord>(['support_tickets', ticketId]);
    if (!existing) return;
    await dualSetDoc(
      ['support_tickets', ticketId],
      {
        ...existing,
        status: 'تم الحل',
      } as unknown as Record<string, unknown>
    );
  } catch {
    // Ignore
  }
}

// =============================================================================
// 11. FAMILY MEMORY VAULT (خزانتي) & TWO-WAY TREE LINKING (شجرتي <-> خزانتي)
// =============================================================================
export interface VaultFolderRecord {
  id: string;
  name: string;
  icon: string;
  colorTheme: 'amber' | 'terracotta' | 'emerald' | 'stone' | 'indigo' | 'rose';
  description?: string;
  createdAt: string;
}

export interface FamilyVaultMediaItem {
  id: string;
  title: string;
  mediaType: 'photo' | 'document';
  folderId: string;
  dateOrOccasion: string;
  description?: string;
  fileDataUrl: string;
  thumbnailDataUrl?: string;
  storagePath?: string;
  storageProvider?: 'firebase_storage' | 'firestore_chunked';
  fileName?: string;
  fileMimeType?: string;
  linkedPersonIds: string[];
  enhanced: boolean;
  aiRestoredEnhanced?: boolean;
  createdAt: string;
}

export interface FamilyVaultArchivePayload {
  folders: VaultFolderRecord[];
  items: FamilyVaultMediaItem[];
  updatedAt: string;
}

export interface TreePersonSummaryForVault {
  id: string;
  fullName: string;
  relationLabel: string;
  gender: 'male' | 'female';
  avatarDataUrl?: string;
  birthYear?: string;
  isAlive?: boolean;
  isCertifiedReference?: boolean;
}

export const DEFAULT_STARTER_VAULT_FOLDERS: VaultFolderRecord[] = [
  {
    id: 'folder_docs',
    name: 'وثائق وصكوك',
    icon: '📜',
    colorTheme: 'amber',
    description: 'حجج الاستحكام، الصكوك التاريخية، والمخطوطات العائلية',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'folder_ancestors',
    name: 'صور الأجداد',
    icon: '📸',
    colorTheme: 'terracotta',
    description: 'الصور الفوتوغرافية للأجداد والآباء وأفراد المشجرة',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'folder_homelands',
    name: 'ديار ومواطن الأسرة',
    icon: '🏡',
    colorTheme: 'emerald',
    description: 'صور المنازل القديمة، المزارع، والبلدات التاريخية للعائلة',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'folder_occasions',
    name: 'شهادات ومناسبات',
    icon: '🎖️',
    colorTheme: 'stone',
    description: 'الشهادات العلمية، الأوسمة، واللقاءات السنوية للأسرة',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

const CHUNKED_VAULT_MEDIA_PREFIX = '__CHUNKED_VAULT_MEDIA__:';

function getVaultLocalStorageKeys(
  userId?: string,
  familyName?: string,
  userEmail?: string
): string[] {
  const keys: string[] = [];
  const safeUid = (userId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const emailUid = canonicalCustomerEmailUid(userEmail);
  const safeFam = (familyName || 'default').trim().replace(/\s+/g, '_');
  if (safeUid) keys.push(`juthori_vault_v2_${safeUid}`);
  if (emailUid && !keys.includes(`juthori_vault_v2_${emailUid}`)) {
    keys.push(`juthori_vault_v2_${emailUid}`);
  }
  if (!safeUid && !emailUid) {
    keys.push(`juthori_vault_v2_fam_${safeFam}`);
  }
  return keys;
}

export function readVaultArchiveFromLocal(
  userId?: string,
  familyName?: string,
  userEmail?: string
): FamilyVaultArchivePayload {
  if (typeof window === 'undefined') {
    return {
      folders: DEFAULT_STARTER_VAULT_FOLDERS,
      items: [],
      updatedAt: new Date().toISOString(),
    };
  }
  for (const key of getVaultLocalStorageKeys(userId, familyName, userEmail)) {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<FamilyVaultArchivePayload>;
        const folders =
          Array.isArray(parsed.folders) && parsed.folders.length > 0
            ? parsed.folders
            : DEFAULT_STARTER_VAULT_FOLDERS;
        const items = Array.isArray(parsed.items) ? parsed.items : [];
        return {
          folders,
          items,
          updatedAt: parsed.updatedAt || new Date().toISOString(),
        };
      }
    } catch {
      // Ignore parse error
    }
  }
  return {
    folders: DEFAULT_STARTER_VAULT_FOLDERS,
    items: [],
    updatedAt: new Date().toISOString(),
  };
}

export async function fetchUserVaultArchive(
  userId?: string,
  familyName?: string,
  userEmail?: string
): Promise<FamilyVaultArchivePayload> {
  const localData = readVaultArchiveFromLocal(userId, familyName, userEmail);
  const safeUid = (userId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const emailUid = canonicalCustomerEmailUid(userEmail);
  const candidateUids = Array.from(
    new Set([safeUid, emailUid].filter((id) => Boolean(id)))
  );
  if (candidateUids.length === 0) {
    return localData;
  }

  for (const uid of candidateUids) {
    try {
      const remoteDoc = await dualGetDoc<{
        userId: string;
        peopleJson: string;
        updatedAt?: string;
      }>(['users', uid, 'family_tree', 'vault_archive']);
      if (remoteDoc && typeof remoteDoc.peopleJson === 'string') {
        const parsed = JSON.parse(
          remoteDoc.peopleJson
        ) as Partial<FamilyVaultArchivePayload>;
        if (parsed && (Array.isArray(parsed.items) || Array.isArray(parsed.folders))) {
          let rehydratedItems = Array.isArray(parsed.items) ? parsed.items : [];
          if (rehydratedItems.length > 0) {
            rehydratedItems = await Promise.all(
              rehydratedItems.map(async (item) => {
                if (
                  typeof item.fileDataUrl === 'string' &&
                  item.fileDataUrl.startsWith(CHUNKED_VAULT_MEDIA_PREFIX)
                ) {
                  const chunkDocId = item.fileDataUrl.slice(
                    CHUNKED_VAULT_MEDIA_PREFIX.length
                  );
                  const chunkDoc = await dualGetDoc<{ peopleJson?: string }>([
                    'users',
                    uid,
                    'family_tree',
                    chunkDocId,
                  ]);
                  if (chunkDoc?.peopleJson) {
                    return { ...item, fileDataUrl: chunkDoc.peopleJson };
                  }
                }
                return item;
              })
            );
          }

          const mergedPayload: FamilyVaultArchivePayload = {
            folders:
              Array.isArray(parsed.folders) && parsed.folders.length > 0
                ? parsed.folders
                : localData.folders,
            items: rehydratedItems,
            updatedAt: parsed.updatedAt || localData.updatedAt,
          };
          if (typeof window !== 'undefined') {
            for (const key of getVaultLocalStorageKeys(userId, familyName, userEmail)) {
              try {
                window.localStorage.setItem(key, JSON.stringify(mergedPayload));
              } catch {
                // Ignore quota
              }
            }
          }
          return mergedPayload;
        }
      }
    } catch {
      // Try next candidate UID
    }
  }

  return localData;
}

export async function saveUserVaultArchive(
  userId: string | undefined,
  familyName: string | undefined,
  payload: {
    folders: VaultFolderRecord[];
    items: FamilyVaultMediaItem[];
  },
  userEmail?: string
): Promise<FamilyVaultArchivePayload> {
  const record: FamilyVaultArchivePayload = {
    folders:
      payload.folders.length > 0
        ? payload.folders
        : DEFAULT_STARTER_VAULT_FOLDERS,
    items: payload.items,
    updatedAt: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    for (const key of getVaultLocalStorageKeys(userId, familyName, userEmail)) {
      try {
        window.localStorage.setItem(key, JSON.stringify(record));
      } catch {
        // Ignore quota
      }
    }
    window.dispatchEvent(
      new CustomEvent('juthori:vault-updated', { detail: record })
    );
  }

  const safeUid = (userId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const emailUid = canonicalCustomerEmailUid(userEmail);
  const targetUids = Array.from(
    new Set([safeUid, emailUid].filter((id) => Boolean(id)))
  );
  if (targetUids.length > 0) {
    try {
      const mediaChunks: Array<{ docId: string; dataUrl: string }> = [];

      // Proactively offload inline base64 media (`fileDataUrl` > 12KB) into dedicated chunk documents
      // whenever Firebase Storage was not used, keeping `vault_archive` index lightweight & under 1MB.
      const lightItems = record.items.map((item, idx) => {
        if (
          typeof item.fileDataUrl === 'string' &&
          item.fileDataUrl.startsWith('data:') &&
          item.fileDataUrl.length > 12288
        ) {
          const safeItemId = String(item.id || `m_${idx}`)
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .slice(0, 80);
          const chunkDocId = `vault_media_${safeItemId}`;
          mediaChunks.push({ docId: chunkDocId, dataUrl: item.fileDataUrl });
          return {
            ...item,
            fileDataUrl: `${CHUNKED_VAULT_MEDIA_PREFIX}${chunkDocId}`,
          };
        }
        return item;
      });

      const jsonStr = JSON.stringify({
        ...record,
        items: lightItems,
      });

      for (const uid of targetUids) {
        for (const chunk of mediaChunks) {
          if (chunk.dataUrl.length <= 930000) {
            await dualSetDoc(['users', uid, 'family_tree', chunk.docId], {
              userId: uid,
              familyName: familyName || 'العائلة',
              peopleJson: chunk.dataUrl,
              updatedAt: record.updatedAt,
            });
          }
        }
        if (jsonStr.length <= 940000) {
          await dualSetDoc(['users', uid, 'family_tree', 'vault_archive'], {
            userId: uid,
            familyName: familyName || 'العائلة',
            peopleJson: jsonStr,
            updatedAt: record.updatedAt,
          });
        }
      }
    } catch (err) {
      console.warn('[saveUserVaultArchive] warning:', err);
    }
  }

  return record;
}

// =============================================================================
// CUSTOMER DASHBOARD WORKSPACE PERSISTENCE (عمود نسبي + موقعي + مجتمعي + النشاط)
// =============================================================================
export interface CustomerSiteSettingsData {
  siteSubdomain: string;
  publishLineagePublic: boolean;
  protectLivingMembers: boolean;
  isPublished?: boolean;
  themeId?: FamilySiteThemeId;
  siteAccessMode?: 'PUBLIC' | 'UNLISTED' | 'PRIVATE_WHITELIST';
  emblemTag?: string;
  siteTitle?: string;
  siteTagline?: string;
  bioTitle?: string;
  bioDescription?: string;
  showBio?: boolean;
  showVerifiedLineage?: boolean;
  showFamilyTree?: boolean;
  hideLivingNamesForGuests?: boolean;
  hideLivingBirthDates?: boolean;
  femaleDisplayPolicy?:
    | 'SHOW_ALL'
    | 'SYMBOLIC_TITLE'
    | 'FAMILY_CIRCLE_ONLY'
    | 'HIDE_ALL';
  startRootPersonId?: string;
  excludedBranchRootIds?: string[];
  selectedFolderIds?: string[];
  selectedVaultItemIds?: string[];
  enableDynamicWatermark?: boolean;
  cmsModulesJson?: string;
  accessGateMode?: 'PUBLIC_INDEXABLE' | 'UNLISTED_LINK' | 'FAMILY_PIN' | 'PRIVATE_WHITELIST';
  familyPinCode?: string;
  femalePrivacyPolicy?:
    | 'FULL_DISPLAY'
    | 'COUNT_ONLY_SYMBOL'
    | 'FIRST_NAME_FAMILY_ONLY'
    | 'PUBLIC_INITIALS_FAMILY_FULL';
  watermarkEnabled?: boolean;
  watermarkText?: string;
}

export interface CustomerCommunityPostData {
  id: string;
  author: string;
  role: string;
  date: string;
  text: string;
  likes: number;
}

export interface CustomerActivityLogEntry {
  id: string;
  title: string;
  timestamp: string;
  badge: string;
}

export interface CustomerDashboardWorkspaceData {
  familyName?: string;
  bridgedAncestors?: string[];
  unlockedCapsules?: string[];
  unlockedAddonSourceIds?: string[];
  verifiedResultOverrideJson?: string | null;
  siteSettings?: CustomerSiteSettingsData;
  communityPosts?: CustomerCommunityPostData[];
  blockedUserIds?: string[];
  blockedUsersMeta?: Array<{
    userId: string;
    name: string;
    blockedAt: string;
  }>;
  activityLog?: CustomerActivityLogEntry[];
  updatedAt: string;
}

function getWorkspaceLocalKeys(userId?: string, userEmail?: string): string[] {
  const keys: string[] = [];
  const safeUid = (userId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const emailUid = canonicalCustomerEmailUid(userEmail);
  if (safeUid) keys.push(`juthori_workspace_v1_${safeUid}`);
  if (emailUid && !keys.includes(`juthori_workspace_v1_${emailUid}`)) {
    keys.push(`juthori_workspace_v1_${emailUid}`);
  }
  return keys;
}

export function readCustomerDashboardWorkspaceFromLocal(
  userId?: string,
  userEmail?: string
): CustomerDashboardWorkspaceData | null {
  if (typeof window === 'undefined') return null;
  for (const key of getWorkspaceLocalKeys(userId, userEmail)) {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        return JSON.parse(raw) as CustomerDashboardWorkspaceData;
      }
    } catch {
      // Ignore
    }
  }
  return null;
}

export async function fetchCustomerDashboardWorkspace(
  userId?: string,
  userEmail?: string
): Promise<CustomerDashboardWorkspaceData | null> {
  const safeUid = (userId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const emailUid = canonicalCustomerEmailUid(userEmail);
  const candidateUids = Array.from(
    new Set([safeUid, emailUid].filter((id) => Boolean(id)))
  );

  for (const uid of candidateUids) {
    try {
      const remoteDoc = await dualGetDoc<{
        userId: string;
        peopleJson: string;
        updatedAt?: string;
      }>(['users', uid, 'family_tree', 'dashboard_workspace']);
      if (remoteDoc?.peopleJson) {
        const parsed = JSON.parse(
          remoteDoc.peopleJson
        ) as CustomerDashboardWorkspaceData;
        if (parsed && typeof parsed === 'object') {
          if (typeof window !== 'undefined') {
            for (const key of getWorkspaceLocalKeys(userId, userEmail)) {
              try {
                window.localStorage.setItem(key, JSON.stringify(parsed));
              } catch {
                // Ignore
              }
            }
          }
          return parsed;
        }
      }
    } catch {
      // Try next candidate
    }
  }

  return readCustomerDashboardWorkspaceFromLocal(userId, userEmail);
}

export async function saveCustomerDashboardWorkspace(
  userId: string | undefined,
  userEmail: string | undefined,
  updates: Partial<CustomerDashboardWorkspaceData>
): Promise<void> {
  const existing =
    readCustomerDashboardWorkspaceFromLocal(userId, userEmail) || {
      updatedAt: new Date().toISOString(),
    };
  const merged: CustomerDashboardWorkspaceData = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    for (const key of getWorkspaceLocalKeys(userId, userEmail)) {
      try {
        window.localStorage.setItem(key, JSON.stringify(merged));
      } catch {
        // Ignore
      }
    }
  }

  const safeUid = (userId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const emailUid = canonicalCustomerEmailUid(userEmail);
  const targetUids = Array.from(
    new Set([safeUid, emailUid].filter((id) => Boolean(id)))
  );
  if (targetUids.length === 0) return;

  try {
    const jsonStr = JSON.stringify(merged);
    if (jsonStr.length <= 920000) {
      for (const uid of targetUids) {
        await dualSetDoc(['users', uid, 'family_tree', 'dashboard_workspace'], {
          userId: uid,
          familyName: merged.familyName || 'العائلة',
          peopleJson: jsonStr,
          updatedAt: merged.updatedAt,
        });
      }
    }
  } catch (err) {
    console.warn('[saveCustomerDashboardWorkspace] warning:', err);
  }
}

export function getTreeStorageKeyForVaultSync(
  userId?: string,
  familyName?: string
): string {
  const safeUid = (userId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeFam = (familyName || 'default').trim().replace(/\s+/g, '_');
  return safeUid
    ? `juthori_tree_nodes_v2_${safeUid}`
    : `juthori_tree_nodes_v2_fam_${safeFam}`;
}

export function readSyncedTreePeopleList(
  userId: string | undefined,
  fallbackInfo: {
    clientName: string;
    fatherName?: string;
    grandfatherName?: string;
    familyName: string;
    rootBranchName?: string;
    rootTribeName?: string;
    userAvatarUrl?: string;
  }
): TreePersonSummaryForVault[] {
  const key = getTreeStorageKeyForVaultSync(userId, fallbackInfo.familyName);
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (p: any): TreePersonSummaryForVault => ({
              id: String(p.id),
              fullName: String(
                p.fullName || `${p.firstName || ''} ${p.familyName || ''}`.trim()
              ),
              relationLabel: String(p.relationLabel || 'فرد في المشجرة'),
              gender: p.gender === 'female' ? 'female' : 'male',
               avatarDataUrl: p.avatarDataUrl || undefined,
              birthYear: p.birthYear || undefined,
              isAlive: p.isAlive !== false,
              isCertifiedReference: Boolean(p.isCertifiedReference),
            })
          );
        }
      }
    } catch {
      // Ignore parse error
    }
  }

  // Also check full local family tree cache if `juthori_tree_nodes_v2_` wasn't written yet
  const localFullTree = readUserFamilyTreeFromLocal<Record<string, unknown>>(
    userId,
    undefined,
    fallbackInfo.familyName
  );
  if (localFullTree && localFullTree.length > 0) {
    return localFullTree.map((p): TreePersonSummaryForVault => ({
      id: String(p.id || ''),
      fullName: `${String(p.firstName || '')} ${String(p.familyName || '')}`.trim(),
      relationLabel: p.isRecordKeeper
        ? 'أمين السجل'
        : p.isCertifiedReference
        ? String(p.referenceRankLabel || p.relationToTargetLabel || 'مرجع موثق')
        : String(p.relationToTargetLabel || 'فرد في المشجرة'),
      gender: p.gender === 'female' ? 'female' : 'male',
      avatarDataUrl:
        typeof p.photoThumbnailUrl === 'string' && p.photoThumbnailUrl
          ? p.photoThumbnailUrl
          : typeof p.photoUrl === 'string'
          ? p.photoUrl
          : undefined,
      birthYear: typeof p.birthDateValue === 'string' ? p.birthDateValue : undefined,
      isAlive: p.vitalStatus !== 'deceased',
      isCertifiedReference: Boolean(p.isCertifiedReference),
    }));
  }

  const cleanFather =
    fallbackInfo.fatherName && fallbackInfo.fatherName !== '—'
      ? fallbackInfo.fatherName.trim()
      : 'الأب';
  const cleanGrandfather =
    fallbackInfo.grandfatherName && fallbackInfo.grandfatherName !== '—'
      ? fallbackInfo.grandfatherName.trim()
      : 'الجد';

  return [
    {
      id: 'node-record-keeper',
      fullName: `${fallbackInfo.clientName} ${fallbackInfo.familyName}`.trim(),
      relationLabel: 'أمين السجل',
      gender: 'male',
      avatarDataUrl: fallbackInfo.userAvatarUrl,
      isAlive: true,
    },
    {
      id: 'node-auto-father',
      fullName: `${cleanFather} ${fallbackInfo.familyName}`.trim(),
      relationLabel: 'الأب المباشر',
      gender: 'male',
      isAlive: true,
    },
    {
      id: 'node-auto-grandfather',
      fullName: `${cleanGrandfather} ${fallbackInfo.familyName}`.trim(),
      relationLabel: 'الجد الثاني',
      gender: 'male',
      isAlive: false,
    },
  ];
}

/**
 * Hydrates live family tree members directly from Firestore (`family_tree/main`)
 * and updates the local Vault sync list so `خزانتي` always resolves up-to-date names
 * dynamically by `personId` across sessions and devices.
 */
export async function syncLiveTreePeopleForVault(
  userId: string | undefined,
  userEmail: string | undefined,
  fallbackInfo: {
    clientName: string;
    fatherName?: string;
    grandfatherName?: string;
    familyName: string;
    rootBranchName?: string;
    rootTribeName?: string;
    userAvatarUrl?: string;
  }
): Promise<TreePersonSummaryForVault[]> {
  if (userId || userEmail) {
    try {
      const remoteNodes = await fetchUserFamilyTreeFromFirebase<
        Record<string, unknown>
      >(userId || '', userEmail, fallbackInfo.familyName);
      if (remoteNodes && remoteNodes.length > 0) {
        const summaries: TreePersonSummaryForVault[] = remoteNodes.map((p) => ({
          id: String(p.id || ''),
          fullName: `${String(p.firstName || '')} ${String(p.familyName || '')}`.trim(),
          relationLabel: p.isRecordKeeper
            ? 'أمين السجل'
            : p.isCertifiedReference
            ? String(p.referenceRankLabel || p.relationToTargetLabel || 'مرجع موثق')
            : String(p.relationToTargetLabel || 'فرد في المشجرة'),
          gender: p.gender === 'female' ? 'female' : 'male',
          avatarDataUrl:
            typeof p.photoThumbnailUrl === 'string' && p.photoThumbnailUrl
              ? p.photoThumbnailUrl
              : typeof p.photoUrl === 'string'
              ? p.photoUrl
              : undefined,
          birthYear:
            typeof p.birthDateValue === 'string' ? p.birthDateValue : undefined,
          isAlive: p.vitalStatus !== 'deceased',
          isCertifiedReference: Boolean(p.isCertifiedReference),
        }));

        if (typeof window !== 'undefined') {
          try {
            const syncKey = getTreeStorageKeyForVaultSync(
              userId,
              fallbackInfo.familyName
            );
            window.localStorage.setItem(syncKey, JSON.stringify(summaries));
          } catch {
            // Ignore storage quota
          }
        }
        return summaries;
      }
    } catch {
      // Fallback to local
    }
  }
  return readSyncedTreePeopleList(userId, fallbackInfo);
}


