import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  Unsubscribe,
  where,
} from 'firebase/firestore';
import {
  auth,
  db,
  mirrorDb,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  CanonicalTicketLifecycleStage,
  DEFAULT_STARTER_VAULT_FOLDERS,
  FamilyVaultMediaItem,
  ReferralCodeIndexDoc,
  ResearchTicketAttachmentRef,
  ResearchTicketData,
  ResearchTicketMessageData,
  ResearchTicketResolutionPayload,
  buildVerifiedLineageSnapshot,
  canonicalCustomerEmailUid,
  fetchUserFamilyTreeFromFirebase,
  fetchUserVaultArchive,
  readUserFamilyTreeFromLocal,
  saveUserFamilyTreeToFirebase,
  saveUserVaultArchive,
  sendCustomerNotification,
  updateUserProfile,
} from './firestoreService';
import {
  DashboardAccessCapabilities,
  DashboardStateMode,
  LineageSearchResult,
  UpperAncestorNode,
} from '../types/juthori';
import {
  FAMILY_SITE_THEMES,
  FamilySiteThemeId,
  PROTECTED_SYSTEM_PATHS,
  REFERRAL_REWARD_USD,
  buildDeterministicReferralCode,
} from '../config/referralAndSiteConfig';

// =============================================================================
// COMMERCIAL LINEAGE PAYWALL TEASER (STRICTLY ZERO UPPER SPINE OR BOOK LEAKS)
// =============================================================================
export const COMMERCIAL_LINEAGE_PAYWALL_TEASER_AR =
  'عرض عمود النسب التاريخي الموثق والمصادر المرجعية ميزة حصرية داخل منصة جذوري — انضم الآن واكشف جذورك';

// =============================================================================
// INTERNAL DUAL-DB HELPERS
// =============================================================================
function cleanUndefined<T>(val: T): T {
  if (val === null || val === undefined) return val;
  if (Array.isArray(val)) {
    return val
      .filter((x) => x !== undefined)
      .map((x) => cleanUndefined(x)) as unknown as T;
  }
  if (typeof val === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = cleanUndefined(v);
      }
    }
    return out as T;
  }
  return val;
}

function fastTimeout<T>(promise: Promise<T>, ms = 2800): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('FAST_TIMEOUT')), ms);
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function writeDualDoc(
  segments: [string, ...string[]],
  payload: Record<string, unknown>
): Promise<void> {
  const sanitized = cleanUndefined(payload);
  await Promise.allSettled([
    fastTimeout(setDoc(doc(db, ...segments), sanitized), 3200),
    fastTimeout(setDoc(doc(mirrorDb, ...segments), sanitized), 3200),
  ]);
}

async function readDualDoc<T>(
  segments: [string, ...string[]]
): Promise<T | null> {
  const [mirrorRes, primaryRes] = await Promise.allSettled([
    fastTimeout(getDoc(doc(mirrorDb, ...segments)), 2500),
    fastTimeout(getDoc(doc(db, ...segments)), 2500),
  ]);

  if (primaryRes.status === 'fulfilled' && primaryRes.value.exists()) {
    return primaryRes.value.data() as T;
  }
  if (mirrorRes.status === 'fulfilled' && mirrorRes.value.exists()) {
    return mirrorRes.value.data() as T;
  }
  return null;
}

async function readDualCollection<T>(collectionName: string): Promise<T[]> {
  const [primaryRes, mirrorRes] = await Promise.allSettled([
    fastTimeout(getDocs(collection(db, collectionName)), 3000),
    fastTimeout(getDocs(collection(mirrorDb, collectionName)), 3000),
  ]);

  if (primaryRes.status === 'fulfilled') {
    return primaryRes.value.docs.map((d) => d.data() as T);
  }
  if (mirrorRes.status === 'fulfilled') {
    return mirrorRes.value.docs.map((d) => d.data() as T);
  }
  return [];
}

async function deleteDualDoc(segments: [string, ...string[]]): Promise<void> {
  await Promise.allSettled([
    fastTimeout(deleteDoc(doc(db, ...segments)), 2500),
    fastTimeout(deleteDoc(doc(mirrorDb, ...segments)), 2500),
  ]);
}

// =============================================================================
// 1. END-TO-END RESEARCH TICKETS LIFECYCLE & ATOMIC RESOLUTION ADOPTION
// =============================================================================
export const TICKET_LIFECYCLE_STAGES: Array<{
  stage: CanonicalTicketLifecycleStage;
  shortAr: string;
  detailAr: string;
}> = [
  {
    stage: 'OPEN',
    shortAr: 'مستلمة',
    detailAr: 'تم استلام التذكرة وإدراجها في طابور المرصد',
  },
  {
    stage: 'IN_REVIEW',
    shortAr: 'قيد الفحص المرجعي',
    detailAr: 'يفحص الباحث المخطوطات والمعاجم المعتمدة',
  },
  {
    stage: 'NEEDS_INFO',
    shortAr: 'بانتظار استكمال بيانات',
    detailAr: 'يطلب الباحث توضيحاً أو وثيقة مساندة من العميل',
  },
  {
    stage: 'RESOLVED',
    shortAr: 'معتمدة وموثقة',
    detailAr: 'تم حسم وتوثيق المسار النسبي بالمصادر',
  },
  {
    stage: 'CLOSED',
    shortAr: 'مغلقة',
    detailAr: 'أُغلقت التذكرة وحُفظت في الأرشيف المرجعي',
  },
];

export function resolveTicketLifecycleStage(
  ticket: Pick<ResearchTicketData, 'status' | 'lifecycleStage'>
): CanonicalTicketLifecycleStage {
  if (
    ticket.lifecycleStage &&
    ['OPEN', 'IN_REVIEW', 'NEEDS_INFO', 'RESOLVED', 'CLOSED'].includes(
      ticket.lifecycleStage
    )
  ) {
    return ticket.lifecycleStage;
  }

  switch (ticket.status) {
    case 'OPEN':
    case 'pending_review':
      return 'OPEN';
    case 'IN_REVIEW':
    case 'investigating':
      return 'IN_REVIEW';
    case 'NEEDS_INFO':
      return 'NEEDS_INFO';
    case 'RESOLVED':
    case 'lineage_found':
    case 'completed':
    case 'exported_adam_prime':
      return 'RESOLVED';
    case 'CLOSED':
    case 'CLOSED_AND_ENRICHED':
    case 'no_records_found':
      return 'CLOSED';
    default:
      return 'OPEN';
  }
}

export async function appendMessageToResearchTicket(params: {
  ticketId: string;
  senderRole: 'customer' | 'researcher' | 'system';
  senderId: string;
  senderName: string;
  body: string;
  attachments?: ResearchTicketAttachmentRef[];
  nextLifecycleStage?: CanonicalTicketLifecycleStage;
}): Promise<ResearchTicketMessageData | null> {
  const safeTicketId = params.ticketId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanBody = params.body.trim().slice(0, 2800);
  if (!cleanBody && (!params.attachments || params.attachments.length === 0)) {
    return null;
  }

  const nowIso = new Date().toISOString();
  const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const msg: ResearchTicketMessageData = {
    id: msgId,
    ticketId: safeTicketId,
    senderRole: params.senderRole,
    senderId: (params.senderId || 'usr_customer').replace(/[^a-zA-Z0-9_-]/g, '_'),
    senderName: (params.senderName || 'عميل جذوري').slice(0, 140),
    body: cleanBody || 'تم إرفاق وثائق مساندة للتذكرة.',
    attachments: Array.isArray(params.attachments)
      ? params.attachments.slice(0, 15)
      : undefined,
    createdAt: nowIso,
  };

  try {
    await writeDualDoc(
      ['research_tickets', safeTicketId, 'messages', msgId],
      msg as unknown as Record<string, unknown>
    );

    const existing = await readDualDoc<ResearchTicketData>([
      'research_tickets',
      safeTicketId,
    ]);
    if (existing) {
      const currentStage = resolveTicketLifecycleStage(existing);
      const targetStage: CanonicalTicketLifecycleStage =
        params.nextLifecycleStage ||
        (params.senderRole === 'customer' && currentStage === 'NEEDS_INFO'
          ? 'IN_REVIEW'
          : currentStage);

      const prevMessages = Array.isArray(existing.messages)
        ? existing.messages
        : [];
      const mergedMessages = [...prevMessages, msg].slice(-80);
      const prevAttachments = Array.isArray(existing.attachments)
        ? existing.attachments
        : [];
      const mergedAttachments = [
        ...prevAttachments,
        ...(msg.attachments || []),
      ].slice(-25);

      await writeDualDoc(['research_tickets', safeTicketId], {
        ...existing,
        status: targetStage,
        lifecycleStage: targetStage,
        messages: mergedMessages,
        attachments: mergedAttachments,
        updatedAt: nowIso,
      } as unknown as Record<string, unknown>);
    }

    return msg;
  } catch (err) {
    try {
      handleFirestoreError(
        err,
        OperationType.WRITE,
        `research_tickets/${safeTicketId}/messages/${msgId}`
      );
    } catch {
      // Structured error logged cleanly
    }
    return msg;
  }
}

export async function updateTicketLifecycleAndResolutionByStaff(params: {
  ticketId: string;
  stage: CanonicalTicketLifecycleStage;
  researcherId: string;
  researcherName: string;
  messageBody?: string;
  researchFindings?: string;
  verifiedSources?: string;
  resolutionPayload?: ResearchTicketResolutionPayload;
}): Promise<ResearchTicketData | null> {
  const safeTicketId = params.ticketId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const existing = await readDualDoc<ResearchTicketData>([
    'research_tickets',
    safeTicketId,
  ]);
  if (!existing) return null;

  const nowIso = new Date().toISOString();
  const prevMessages = Array.isArray(existing.messages) ? existing.messages : [];
  let nextMessages = prevMessages;

  if (params.messageBody?.trim()) {
    const staffMsg: ResearchTicketMessageData = {
      id: `msg_${Date.now()}_staff`,
      ticketId: safeTicketId,
      senderRole: 'researcher',
      senderId: params.researcherId.replace(/[^a-zA-Z0-9_-]/g, '_'),
      senderName: params.researcherName.slice(0, 140),
      body: params.messageBody.trim().slice(0, 2800),
      createdAt: nowIso,
    };
    nextMessages = [...prevMessages, staffMsg].slice(-80);
    await writeDualDoc(
      ['research_tickets', safeTicketId, 'messages', staffMsg.id],
      staffMsg as unknown as Record<string, unknown>
    );
  }

  const updatedTicket: ResearchTicketData = {
    ...existing,
    status: params.stage,
    lifecycleStage: params.stage,
    assignedResearcherId: params.researcherId,
    assignedResearcherName: params.researcherName,
    researchFindings:
      params.researchFindings !== undefined
        ? params.researchFindings.slice(0, 4800)
        : existing.researchFindings,
    verifiedSources:
      params.verifiedSources !== undefined
        ? params.verifiedSources.slice(0, 2800)
        : existing.verifiedSources,
    resolutionPayload: params.resolutionPayload || existing.resolutionPayload,
    messages: nextMessages,
    clientNotified: true,
    resolvedAt:
      params.stage === 'RESOLVED' || params.stage === 'CLOSED'
        ? nowIso
        : existing.resolvedAt,
    updatedAt: nowIso,
  };

  await writeDualDoc(
    ['research_tickets', safeTicketId],
    updatedTicket as unknown as Record<string, unknown>
  );

  if (existing.userId) {
    sendCustomerNotification({
      userId: existing.userId,
      title:
        params.stage === 'RESOLVED'
          ? `تم اعتماد وتوثيق تذكرتك #${existing.ticketNumber} ✓`
          : params.stage === 'NEEDS_INFO'
          ? `طلب استكمال بيانات لتذكرتك #${existing.ticketNumber}`
          : `تحديث حالة تذكرتك #${existing.ticketNumber}`,
      body:
        params.messageBody?.trim() ||
        params.researchFindings?.trim() ||
        'تم تحديث مسار التذكرة في مرصد البحوث.',
      category: 'ticket_update',
      senderRole: 'researcher',
    }).catch(() => {});
  }

  return updatedTicket;
}

export async function applyResolvedTicketToCustomerLineage(params: {
  ticket: ResearchTicketData;
  currentResult: LineageSearchResult;
  userId: string;
  userEmail?: string;
}): Promise<{
  alreadyApplied: boolean;
  enrichedResult: LineageSearchResult;
  appliedAt: string;
}> {
  const { ticket, currentResult, userId, userEmail } = params;
  const safeUid = (
    userId ||
    canonicalCustomerEmailUid(userEmail) ||
    ticket.userId
  ).replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeTicketId = ticket.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const nowIso = new Date().toISOString();

  const payload: ResearchTicketResolutionPayload = ticket.resolutionPayload || {
    decisionTitle: `توثيق مرجعي معتمد — تذكرة #${ticket.ticketNumber}`,
    verifiedRootBranch: ticket.familyBranch || currentResult.rootBranchName,
    verifiedRootTribe: ticket.tribeName || currentResult.rootTribeName,
    verifiedCitation:
      ticket.verifiedSources || currentResult.verifiedSourceCitation,
    summaryNotes: ticket.researchFindings || '',
  };

  const nextBranch =
    payload.verifiedRootBranch?.trim() ||
    currentResult.rootBranchName ||
    ticket.familyBranch ||
    'فرع موثق بالمرصد';
  const nextTribe =
    payload.verifiedRootTribe?.trim() ||
    currentResult.rootTribeName ||
    ticket.tribeName ||
    'قبيلة موثقة بالمرصد';
  const nextCitation =
    payload.verifiedCitation?.trim() ||
    ticket.verifiedSources?.trim() ||
    currentResult.verifiedSourceCitation ||
    `قرار توثيق مرصد البحوث رقم #${ticket.ticketNumber}`;

  const baseNodes: UpperAncestorNode[] = Array.isArray(
    currentResult.adamSpineNodes
  )
    ? [...currentResult.adamSpineNodes]
    : [];

  if (baseNodes.length === 0) {
    baseNodes.push({
      id: `res-fe0-${safeTicketId}`,
      orderNumber: 1,
      name: currentResult.familyName || ticket.familyName || 'العائلة',
      code: 'FE0',
      isCodedStation: true,
      rankLabel: 'بيت العائلة المباشر',
      region:
        currentResult.originRegion ||
        ticket.originRegion ||
        currentResult.originCountry,
      eraNote: `بيت أسرة ${currentResult.familyName || ticket.familyName}.`,
    });
  }

  if (
    payload.certifiedAncestorName?.trim() &&
    !baseNodes.some((n) => n.name === payload.certifiedAncestorName!.trim())
  ) {
    baseNodes.splice(Math.min(1, baseNodes.length), 0, {
      id: `res-cert-${safeTicketId}`,
      orderNumber: 2,
      name: payload.certifiedAncestorName.trim(),
      code: 'B2',
      isCodedStation: true,
      rankLabel: payload.certifiedAncestorRank || 'جد مرجعي موثق بالمرصد',
      region: currentResult.originRegion || currentResult.originCountry,
      eraNote: payload.summaryNotes || ticket.researchFindings || '',
    });
  }

  if (!baseNodes.some((n) => n.name.includes(nextBranch))) {
    baseNodes.push({
      id: `res-branch-${safeTicketId}`,
      orderNumber: baseNodes.length + 1,
      name: nextBranch,
      code: 'B1',
      isCodedStation: true,
      rankLabel: 'الفرع الجامع الموثق',
      region: currentResult.originRegion || currentResult.originCountry,
      eraNote: nextCitation,
    });
  }

  if (
    nextTribe !== nextBranch &&
    !baseNodes.some((n) => n.name.includes(nextTribe))
  ) {
    baseNodes.push({
      id: `res-tribe-${safeTicketId}`,
      orderNumber: baseNodes.length + 1,
      name: nextTribe,
      code: 'B0',
      isCodedStation: true,
      rankLabel: 'القبيلة الأم الموثقة',
      region: currentResult.originRegion || currentResult.originCountry,
      eraNote: nextCitation,
    });
  }

  const normalizedNodes = baseNodes.map((n, idx) => ({
    ...n,
    orderNumber: idx + 1,
  }));

  const mergedSources = Array.from(
    new Set(
      [
        nextCitation,
        ...(currentResult.verified_sources || []),
        ...(currentResult.secondarySources || []),
      ].filter(Boolean)
    )
  );

  const enrichedResult: LineageSearchResult = {
    ...currentResult,
    matched: true,
    requiresBlindDisambiguation: false,
    rootBranchName: nextBranch,
    rootTribeName: nextTribe,
    rootSummaryLabel: `${currentResult.familyName} ⬅️ ${nextBranch} ⬅️ ${nextTribe}`,
    verifiedSourceCitation: nextCitation,
    verified_sources: mergedSources,
    secondarySources: mergedSources,
    adamSpineNodes: normalizedNodes,
    upperAncestors: normalizedNodes,
    confidenceLabel: 'توثيق أرشيفي معتمد من مرصد البحوث ✦',
    recommendedInitialState:
      currentResult.recommendedInitialState === DashboardStateMode.State3Unmatched
        ? DashboardStateMode.State2MatchedUnpaid
        : currentResult.recommendedInitialState,
  };

  const verifiedSnapshot = buildVerifiedLineageSnapshot(enrichedResult);
  let alreadyApplied = Boolean(ticket.resolutionPayload?.appliedByCustomerAt);

  const executeTxOnDb = async (targetDb: typeof db) => {
    await runTransaction(targetDb, async (tx) => {
      const ticketRef = doc(targetDb, 'research_tickets', safeTicketId);
      const userRef = doc(targetDb, 'users', safeUid);
      const [tSnap, uSnap] = await Promise.all([
        tx.get(ticketRef),
        tx.get(userRef),
      ]);

      if (tSnap.exists()) {
        const tData = tSnap.data() as ResearchTicketData;
        if (tData.resolutionPayload?.appliedByCustomerAt) {
          alreadyApplied = true;
          return;
        }
        const nextResolution: ResearchTicketResolutionPayload = {
          ...payload,
          ...(tData.resolutionPayload || {}),
          appliedByCustomerAt: nowIso,
        };
        tx.set(
          ticketRef,
          cleanUndefined({
            ...tData,
            resolutionPayload: nextResolution,
            updatedAt: nowIso,
          })
        );
      }

      if (uSnap.exists()) {
        const uData = uSnap.data();
        tx.set(
          userRef,
          cleanUndefined({
            ...uData,
            tribeName: nextTribe,
            familyBranch: nextBranch,
            verifiedLineageSnapshot: verifiedSnapshot,
            lineageSnapshot: verifiedSnapshot,
            updatedAt: nowIso,
          })
        );
      }
    });
  };

  await Promise.allSettled([
    fastTimeout(executeTxOnDb(mirrorDb), 4000),
    fastTimeout(executeTxOnDb(db), 4000),
  ]);

  return {
    alreadyApplied,
    enrichedResult,
    appliedAt: nowIso,
  };
}

// =============================================================================
// 2. LUXURY FAMILY MICRO-CMS & FILTERED MIRROR (`موقعي` -> `public_sites/{siteSlug}`)
// =============================================================================
export type SiteAccessMode = 'PUBLIC' | 'UNLISTED' | 'PRIVATE_WHITELIST';

export type ModuleVisibility = 'PUBLIC' | 'FAMILY_ONLY' | 'HIDDEN';

export type FemaleDisplayPolicy =
  | 'SHOW_ALL'
  | 'SYMBOLIC_TITLE'
  | 'FAMILY_CIRCLE_ONLY'
  | 'HIDE_ALL';

export type EnrichmentRequestType =
  | 'ADD_TREE_MEMBER'
  | 'VAULT_MEDIA'
  | 'CORRECTION_NOTE';

export interface RawTreePersonForPublicProjection {
  id: string;
  firstName?: string;
  name?: string;
  familyName?: string;
  honorific?: string;
  honorificTitle?: string;
  fatherId?: string;
  motherId?: string;
  relationLabel?: string;
  relationToTargetLabel?: string;
  generationLevel?: number;
  generation?: number;
  gender?: 'male' | 'female';
  isDeceased?: boolean;
  isAlive?: boolean;
  vitalStatus?: string;
  birthYear?: string;
  birthDateValue?: string;
  deathYear?: string;
  deathDateValue?: string;
  birthPlace?: string;
  biography?: string;
  bioSnippet?: string;
  contactInfo?: string;
  isCertifiedReference?: boolean;
  [key: string]: unknown;
}

export interface SanitizedPublicTreeMember {
  id: string;
  displayName: string;
  familyCircleDisplayName?: string;
  relationLabel: string;
  generationLevel: number;
  gender: 'male' | 'female';
  isProtectedLiving: boolean;
  isDeceased: boolean;
  birthYear?: string;
  deathYear?: string;
  birthPlace?: string;
  fatherId?: string;
  bioSnippet?: string;
}

export interface ContemporaryTreeMetrics {
  totalContemporaryMembers: number;
  generationsCount: number;
  topCommonNames: Array<{ name: string; count: number }>;
  largestBranches: Array<{ branchLabel: string; count: number }>;
}

export interface VaultPhotoFaceIdNote {
  id: string;
  senderName: string;
  note: string;
  createdAt: string;
}

export interface PublicVaultProjectedItem {
  id: string;
  folderId?: string;
  title: string;
  mediaType: 'photo' | 'document';
  dateOrOccasion: string;
  description?: string;
  previewUrl: string;
  watermarkText?: string;
  faceIdNotes?: VaultPhotoFaceIdNote[];
}

export interface GuardianOfMemoryHonorItem {
  name: string;
  kinshipRelation?: string;
  approvedCount: number;
}

export interface FamilyMicrositeCmsModules {
  newsModule: {
    enabled: boolean;
    visibility: ModuleVisibility;
    items: Array<{
      id: string;
      category:
        | 'مولود جديد'
        | 'عقد قران وزواج'
        | 'تخرج وإنجاز علمي'
        | 'ترقية وتكريم'
        | 'خبر عائلي';
      title: string;
      summary: string;
      dateLabel: string;
      blessings: Array<{
        id: string;
        senderName: string;
        createdAt: string;
      }>;
    }>;
  };
  eventsModule: {
    enabled: boolean;
    visibility: ModuleVisibility;
    items: Array<{
      id: string;
      title: string;
      eventDateIso: string;
      locationLabel: string;
      hostNote?: string;
      rsvps: Array<{
        id: string;
        attendeeName: string;
        status: 'attending' | 'apologizing';
        companionsCount: number;
        createdAt: string;
      }>;
    }>;
  };
  storiesModule: {
    enabled: boolean;
    visibility: ModuleVisibility;
    items: Array<{
      id: string;
      title: string;
      body: string;
      eraOrYearLabel: string;
      authorLabel?: string;
      historicalMonth?: number;
    }>;
  };
  notablesModule: {
    enabled: boolean;
    visibility: ModuleVisibility;
    items: Array<{
      id: string;
      fullName: string;
      roleOrTitle: string;
      eraLabel: string;
      achievementSummary: string;
    }>;
  };
  oralHeritageModule: {
    enabled: boolean;
    visibility: ModuleVisibility;
    items: Array<{
      id: string;
      title: string;
      speakerName: string;
      recordedYearLabel: string;
      audioDataOrUrl?: string;
      transcriptExcerpt: string;
    }>;
  };
  atlasAndStatsModule: {
    enabled: boolean;
    visibility: ModuleVisibility;
    showAutoTreeNumbers: boolean;
    locations: Array<{
      id: string;
      country: string;
      city: string;
      householdsOrMembersCount: number;
    }>;
  };
  professionsModule: {
    enabled: boolean;
    visibility: ModuleVisibility;
    items: Array<{
      id: string;
      memberName: string;
      fieldCategory: string;
      specialtyOrProfession: string;
      cityCountryLabel?: string;
    }>;
  };
  memorialAndCapsuleModule: {
    enabled: boolean;
    visibility: ModuleVisibility;
    elders: Array<{
      id: string;
      fullName: string;
      passingYearLabel: string;
      biographyNote: string;
      ongoingCharityTitle?: string;
      ongoingCharityUrlOrNote?: string;
      prayersCount: number;
    }>;
    timeCapsule: {
      enabled: boolean;
      title: string;
      authorElderName: string;
      unlockDateIso: string;
      sealedMessage: string;
    };
  };
  majlisAndGuardiansModule: {
    enabled: boolean;
    visibility: ModuleVisibility;
    showGuardiansHonorRoll: boolean;
    topics: Array<{
      id: string;
      title: string;
      promptQuestion: string;
      isWeeklyElderPrompt?: boolean;
      isLocked: boolean;
      createdAt: string;
      replies: Array<{
        id: string;
        authorName: string;
        body: string;
        isPinned?: boolean;
        createdAt: string;
      }>;
    }>;
  };
}

export interface PublicSitePrivacyConfig {
  showBio: boolean;
  bioVisibility?: ModuleVisibility;
  showFamilyTree: boolean;
  treeVisibility?: ModuleVisibility;
  vaultVisibility?: ModuleVisibility;
  hideLivingNamesForGuests: boolean;
  hideLivingBirthDates?: boolean;
  femaleDisplayPolicy?: FemaleDisplayPolicy;
  startRootPersonId?: string;
  excludedBranchRootIds?: string[];
  selectedFolderIds?: string[];
  selectedVaultItemIds: string[];
  enableDynamicWatermark?: boolean;
  enablePhotoFacePrompt?: boolean;
}

export interface PublicMicrositeData {
  siteSlug: string;
  ownerId: string;
  ownerUid?: string;
  ownerEmail?: string;
  ownerDisplayName?: string;
  ownerReferralCode?: string;
  isPublished: boolean;
  siteAccessMode: SiteAccessMode;
  privacyMode?: SiteAccessMode;
  whitelistedEmails?: string[];
  themeId: FamilySiteThemeId;
  familyName: string;
  familyEmblemTag?: string;
  originCountry?: string;
  originRegion?: string;
  isRegistrarCertified?: boolean;
  membershipLabel?: string;
  bioTitle?: string;
  bioDescription?: string;
  privacyConfig: PublicSitePrivacyConfig;
  publishedTreeMembers?: SanitizedPublicTreeMember[];
  publishedVaultItems?: PublicVaultProjectedItem[];
  treeMetrics?: ContemporaryTreeMetrics;
  cmsModules?: FamilyMicrositeCmsModules;
  guardiansOfMemory?: GuardianOfMemoryHonorItem[];
  createdAt: string;
  updatedAt: string;
}

export function buildDefaultCmsModules(
  result: LineageSearchResult
): FamilyMicrositeCmsModules {
  const fam = result.familyName || 'العائلة';
  const country = result.originCountry || 'السعودية';
  const city = result.originRegion || 'الحاضرة';
  const nextYearDate = `${new Date().getFullYear() + 1}-06-15`;

  return {
    newsModule: {
      enabled: true,
      visibility: 'PUBLIC',
      items: [],
    },
    eventsModule: {
      enabled: true,
      visibility: 'FAMILY_ONLY',
      items: [],
    },
    storiesModule: {
      enabled: true,
      visibility: 'PUBLIC',
      items: [],
    },
    notablesModule: {
      enabled: true,
      visibility: 'PUBLIC',
      items: [],
    },
    oralHeritageModule: {
      enabled: false,
      visibility: 'FAMILY_ONLY',
      items: [],
    },
    atlasAndStatsModule: {
      enabled: true,
      visibility: 'PUBLIC',
      showAutoTreeNumbers: true,
      locations: city
        ? [
            {
              id: 'loc_default_1',
              country,
              city,
              householdsOrMembersCount: 12,
            },
          ]
        : [],
    },
    professionsModule: {
      enabled: false,
      visibility: 'FAMILY_ONLY',
      items: [],
    },
    memorialAndCapsuleModule: {
      enabled: false,
      visibility: 'FAMILY_ONLY',
      elders: [],
      timeCapsule: {
        enabled: false,
        title: `وصية ورسالة إلى أجيال أسرة ${fam}`,
        authorElderName: `كبار أسرة ${fam}`,
        unlockDateIso: nextYearDate,
        sealedMessage: '',
      },
    },
    majlisAndGuardiansModule: {
      enabled: true,
      visibility: 'FAMILY_ONLY',
      showGuardiansHonorRoll: true,
      topics: [],
    },
  };
}

export function normalizePublicSiteSlug(raw: string): string {
  return (raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function validatePublicSiteSlug(raw: string): {
  valid: boolean;
  normalized: string;
  errorAr?: string;
} {
  const normalized = normalizePublicSiteSlug(raw);
  if (!normalized || normalized.length < 3) {
    return {
      valid: false,
      normalized,
      errorAr:
        'يجب أن يتكون معرّف الرابط (Slug) من 3 أحرف إنجليزية أو أرقام على الأقل (مثال: Alrasheed).',
    };
  }
  if (normalized.length > 60) {
    return {
      valid: false,
      normalized,
      errorAr: 'يجب ألا يتجاوز معرّف الرابط 60 حرفاً.',
    };
  }
  if (PROTECTED_SYSTEM_PATHS.has(normalized)) {
    return {
      valid: false,
      normalized,
      errorAr: `المعرّف «/${normalized}» محجوز لمسارات النظام الأساسية في جذوري ولا يمكن استخدامه.`,
    };
  }
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(normalized)) {
    return {
      valid: false,
      normalized,
      errorAr: 'يُسمح فقط بالأحرف الإنجليزية والأرقام والشرطة الوسطى (-).',
    };
  }
  return { valid: true, normalized };
}

/**
 * Resolves clean root URLs `Juthori.com/{FamilySlug}` (plus legacy `?site=` or `/u/{Slug}`)
 * while strictly protecting `/team`, `/api`, `/admin`, and static assets.
 */
export function resolveMicrositeSlugFromLocation(
  pathname: string,
  search: string
): string | null {
  try {
    const params = new URLSearchParams(search || '');
    const querySite = params.get('site') || params.get('s');
    if (querySite) {
      const v = validatePublicSiteSlug(querySite);
      if (v.valid) return v.normalized;
    }
  } catch {
    // Ignore invalid query string
  }

  const cleanPath = (pathname || '/').trim().replace(/\/+$/, '') || '/';
  if (cleanPath === '/') return null;

  // Support legacy `/u/{slug}`
  const legacyMatch = cleanPath.match(/^\/u\/([a-zA-Z0-9_-]+)$/);
  if (legacyMatch?.[1]) {
    const v = validatePublicSiteSlug(legacyMatch[1]);
    return v.valid ? v.normalized : null;
  }

  // Clean single-segment root path `/{FamilySlug}`
  const segments = cleanPath.split('/').filter(Boolean);
  if (segments.length !== 1) return null;

  const candidateRaw = segments[0];
  if (candidateRaw.includes('.')) return null;

  const lowerCandidate = candidateRaw.toLowerCase();
  if (PROTECTED_SYSTEM_PATHS.has(lowerCandidate)) return null;

  const v = validatePublicSiteSlug(lowerCandidate);
  return v.valid ? v.normalized : null;
}

export async function checkPublicSiteSlugAvailability(
  rawSlug: string,
  currentUserId?: string,
  currentUserEmail?: string
): Promise<{
  available: boolean;
  normalizedSlug: string;
  ownedByCurrentUser: boolean;
  reasonAr: string;
}> {
  const validation = validatePublicSiteSlug(rawSlug);
  if (!validation.valid) {
    return {
      available: false,
      normalizedSlug: validation.normalized,
      ownedByCurrentUser: false,
      reasonAr: validation.errorAr || 'معرّف غير صالح.',
    };
  }

  const slug = validation.normalized;
  const existing = await readDualDoc<PublicMicrositeData>([
    'public_sites',
    slug,
  ]);
  if (!existing) {
    return {
      available: true,
      normalizedSlug: slug,
      ownedByCurrentUser: false,
      reasonAr: `الرابط السيادي النظيف Juthori.com/${slug} متاح للحجز الفوري ✓`,
    };
  }

  const safeUid = (currentUserId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const emailUid = canonicalCustomerEmailUid(currentUserEmail);
  const isMine =
    Boolean(existing.ownerId) &&
    (existing.ownerId === safeUid ||
      (Boolean(emailUid) && existing.ownerId === emailUid) ||
      (Boolean(currentUserEmail) &&
        Boolean(existing.ownerEmail) &&
        existing.ownerEmail!.toLowerCase() ===
          currentUserEmail!.trim().toLowerCase()));

  if (isMine) {
    return {
      available: true,
      normalizedSlug: slug,
      ownedByCurrentUser: true,
      reasonAr: `هذا الرابط (Juthori.com/${slug}) مسجل ومحفوظ باسمك كأمين سجل ✓`,
    };
  }

  return {
    available: false,
    normalizedSlug: slug,
    ownedByCurrentUser: false,
    reasonAr: `المعرّف Juthori.com/${slug} محجوز لعائلة أخرى، يرجى اختيار معرّف مميز آخر.`,
  };
}

export interface TreeSanitizationOptions {
  familyName?: string;
  hideLivingNamesForGuests?: boolean;
  hideLivingBirthDates?: boolean;
  femaleDisplayPolicy?: FemaleDisplayPolicy;
  startRootPersonId?: string;
  excludedBranchRootIds?: string[];
  siteAccessMode?: SiteAccessMode;
}

/**
 * STRICT COMMERCIAL LINEAGE PAYWALL + PRIVACY PROJECTION:
 * 1) Strips 100% of `isCertifiedReference === true` nodes (Adam Spine & certified historical ancestors).
 * 2) Prunes excluded branches (`excludedBranchRootIds`) and scopes to `startRootPersonId` if selected.
 * 3) Enforces the 4 Female Display Policies (`SHOW_ALL`, `SYMBOLIC_TITLE`, `FAMILY_CIRCLE_ONLY`, `HIDE_ALL`)
 *    and living-member protection (`hideLivingNamesForGuests`, `hideLivingBirthDates`).
 */
export function sanitizeTreeMembersForPublicSite(
  rawNodes: RawTreePersonForPublicProjection[],
  hideOrOptions: boolean | TreeSanitizationOptions = false
): SanitizedPublicTreeMember[] {
  if (!Array.isArray(rawNodes)) return [];

  const opts: TreeSanitizationOptions =
    typeof hideOrOptions === 'boolean'
      ? {
          hideLivingNamesForGuests: hideOrOptions,
          hideLivingBirthDates: hideOrOptions,
          femaleDisplayPolicy: 'SHOW_ALL',
        }
      : hideOrOptions || {};

  // Step 1: Hard commercial paywall filter — NEVER allow `isCertifiedReference === true`
  const contemporary = rawNodes.filter(
    (n) => n && n.isCertifiedReference !== true
  );

  const byId = new Map<string, RawTreePersonForPublicProjection>();
  const childrenMap = new Map<string, string[]>();
  contemporary.forEach((n, idx) => {
    const id = String(n.id || `m_${idx}`);
    byId.set(id, n);
  });

  contemporary.forEach((n, idx) => {
    const id = String(n.id || `m_${idx}`);
    const pid = n.fatherId ? String(n.fatherId) : '';
    if (pid && byId.has(pid)) {
      const arr = childrenMap.get(pid) || [];
      arr.push(id);
      childrenMap.set(pid, arr);
    }
  });

  // Collect recursive subtree IDs helper
  const collectSubtreeIds = (rootIds: string[]): Set<string> => {
    const set = new Set<string>();
    const stack = [...rootIds];
    while (stack.length > 0) {
      const curr = stack.pop()!;
      if (set.has(curr)) continue;
      set.add(curr);
      const kids = childrenMap.get(curr) || [];
      for (const k of kids) stack.push(k);
    }
    return set;
  };

  let allowedIds: Set<string> | null = null;
  if (opts.startRootPersonId && byId.has(opts.startRootPersonId)) {
    allowedIds = collectSubtreeIds([opts.startRootPersonId]);
  }

  const excludedIds =
    opts.excludedBranchRootIds && opts.excludedBranchRootIds.length > 0
      ? collectSubtreeIds(opts.excludedBranchRootIds)
      : new Set<string>();

  const femalePolicy: FemaleDisplayPolicy =
    opts.femaleDisplayPolicy || 'SHOW_ALL';
  const defaultFam = (opts.familyName || '').trim();

  const filtered = contemporary.filter((n, idx) => {
    const id = String(n.id || `m_${idx}`);
    if (allowedIds && !allowedIds.has(id)) return false;
    if (excludedIds.has(id)) return false;
    const gender = n.gender === 'female' ? 'female' : 'male';
    if (gender === 'female' && femalePolicy === 'HIDE_ALL') return false;
    return true;
  });

  const validFinalIds = new Set(
    filtered.map((n, idx) => String(n.id || `m_${idx}`))
  );

  return filtered.slice(0, 500).map((n, idx) => {
    const id = String(n.id || `m_${idx}`);
    const firstName = String(n.firstName || n.name || 'فرد من الأسرة').trim();
    const nodeFam = String(n.familyName || defaultFam).trim();
    const honorific = String(n.honorificTitle || n.honorific || '')
      .replace(/^بدون$/, '')
      .trim();
    const fullRealName = [honorific, firstName, nodeFam]
      .filter(Boolean)
      .join(' ')
      .trim();

    const gender: 'male' | 'female' =
      n.gender === 'female' ? 'female' : 'male';
    const vitalStatus = String(n.vitalStatus || '');
    const isDeceased =
      Boolean(n.isDeceased) ||
      vitalStatus === 'deceased' ||
      Boolean(n.deathYear) ||
      Boolean(n.deathDateValue) ||
      n.isAlive === false;
    const isLiving = !isDeceased;

    const rawFatherId = n.fatherId ? String(n.fatherId) : undefined;
    const cleanFatherId =
      rawFatherId && validFinalIds.has(rawFatherId) ? rawFatherId : undefined;

    const fatherNode = rawFatherId ? byId.get(rawFatherId) : undefined;
    const fatherFirst = fatherNode
      ? String(fatherNode.firstName || fatherNode.name || '').trim()
      : '';
    const symbolicFemaleLabel = fatherFirst
      ? ['كريمة', fatherFirst, nodeFam].filter(Boolean).join(' ').trim()
      : nodeFam
      ? `كريمة أسرة ${nodeFam}`
      : 'كريمة الأسرة';

    const relationLabel = String(
      n.relationToTargetLabel || n.relationLabel || 'فرد معاصر من الأسرة'
    ).slice(0, 80);
    const generationLevel =
      typeof n.generationLevel === 'number'
        ? n.generationLevel
        : typeof n.generation === 'number'
        ? n.generation
        : 1;

    const rawBirthYear = n.birthYear
      ? String(n.birthYear).slice(0, 20)
      : n.birthDateValue
      ? String(n.birthDateValue).slice(0, 20)
      : undefined;
    const rawDeathYear = n.deathYear
      ? String(n.deathYear).slice(0, 20)
      : n.deathDateValue
      ? String(n.deathDateValue).slice(0, 20)
      : undefined;

    const hideBirth =
      isLiving &&
      (Boolean(opts.hideLivingBirthDates) ||
        Boolean(opts.hideLivingNamesForGuests));

    // Living member protection for guests
    if (isLiving && opts.hideLivingNamesForGuests) {
      return cleanUndefined({
        id,
        displayName: 'فرد على قيد الحياة (محمي)',
        familyCircleDisplayName:
          gender === 'female' && femalePolicy === 'SYMBOLIC_TITLE'
            ? undefined
            : fullRealName || firstName,
        relationLabel,
        generationLevel,
        gender,
        isProtectedLiving: true,
        isDeceased: false,
        fatherId: cleanFatherId,
      });
    }

    // Female Display Policies (`SYMBOLIC_TITLE` & `FAMILY_CIRCLE_ONLY`)
    if (gender === 'female') {
      if (femalePolicy === 'SYMBOLIC_TITLE') {
        return cleanUndefined({
          id,
          displayName: symbolicFemaleLabel,
          relationLabel,
          generationLevel,
          gender,
          isProtectedLiving: false,
          isDeceased,
          birthYear: hideBirth ? undefined : rawBirthYear,
          deathYear: rawDeathYear,
          birthPlace: n.birthPlace
            ? String(n.birthPlace).slice(0, 80)
            : undefined,
          fatherId: cleanFatherId,
        });
      }

      if (femalePolicy === 'FAMILY_CIRCLE_ONLY') {
        return cleanUndefined({
          id,
          displayName: symbolicFemaleLabel,
          familyCircleDisplayName: fullRealName || firstName,
          relationLabel,
          generationLevel,
          gender,
          isProtectedLiving: false,
          isDeceased,
          birthYear: hideBirth ? undefined : rawBirthYear,
          deathYear: rawDeathYear,
          birthPlace: n.birthPlace
            ? String(n.birthPlace).slice(0, 80)
            : undefined,
          fatherId: cleanFatherId,
        });
      }
    }

    const bioText = n.bioSnippet || n.biography;
    return cleanUndefined({
      id,
      displayName: fullRealName || firstName,
      relationLabel,
      generationLevel,
      gender,
      isProtectedLiving: false,
      isDeceased,
      birthYear: hideBirth ? undefined : rawBirthYear,
      deathYear: rawDeathYear,
      birthPlace: n.birthPlace ? String(n.birthPlace).slice(0, 80) : undefined,
      fatherId: cleanFatherId,
      bioSnippet: bioText ? String(bioText).slice(0, 280) : undefined,
    });
  });
}

export function computeContemporaryTreeMetrics(
  rawNodes: RawTreePersonForPublicProjection[],
  familyName = ''
): ContemporaryTreeMetrics {
  const contemporary = (Array.isArray(rawNodes) ? rawNodes : []).filter(
    (n) => n && n.isCertifiedReference !== true
  );

  const genSet = new Set<number>();
  const nameCounts = new Map<string, number>();
  const childrenCountByParent = new Map<string, number>();
  const byId = new Map<string, RawTreePersonForPublicProjection>();

  contemporary.forEach((n, idx) => {
    const id = String(n.id || `m_${idx}`);
    byId.set(id, n);
    const g =
      typeof n.generationLevel === 'number'
        ? n.generationLevel
        : typeof n.generation === 'number'
        ? n.generation
        : 1;
    genSet.add(g);

    const first = String(n.firstName || n.name || '').trim();
    if (first && n.gender !== 'female') {
      nameCounts.set(first, (nameCounts.get(first) || 0) + 1);
    }

    if (n.fatherId) {
      const pid = String(n.fatherId);
      childrenCountByParent.set(pid, (childrenCountByParent.get(pid) || 0) + 1);
    }
  });

  const topCommonNames = Array.from(nameCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, count]) => ({ name, count }));

  const largestBranches = Array.from(childrenCountByParent.entries())
    .filter(([pid]) => byId.has(pid))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([pid, count]) => {
      const p = byId.get(pid)!;
      const pName = String(p.firstName || p.name || familyName || 'فرع').trim();
      return {
        branchLabel: `ذرية ${pName}`,
        count: count + 1,
      };
    });

  return {
    totalContemporaryMembers: contemporary.length,
    generationsCount: Math.max(genSet.size, contemporary.length > 0 ? 1 : 0),
    topCommonNames,
    largestBranches,
  };
}

export function projectSelectedVaultItemsForPublicSite(
  allItems: FamilyVaultMediaItem[],
  selectedIds: string[],
  options?: {
    selectedFolderIds?: string[];
    enableDynamicWatermark?: boolean;
    siteSlug?: string;
    existingProjectedItems?: PublicVaultProjectedItem[];
  }
): PublicVaultProjectedItem[] {
  if (!Array.isArray(allItems)) return [];
  const selectedSet = new Set(Array.isArray(selectedIds) ? selectedIds : []);
  const folderSet = new Set(
    Array.isArray(options?.selectedFolderIds) ? options!.selectedFolderIds! : []
  );
  const existingNotesMap = new Map<string, VaultPhotoFaceIdNote[]>();
  for (const prev of options?.existingProjectedItems || []) {
    if (prev.faceIdNotes && prev.faceIdNotes.length > 0) {
      existingNotesMap.set(prev.id, prev.faceIdNotes);
    }
  }

  const cleanSlug = normalizePublicSiteSlug(options?.siteSlug || '') || 'family';
  const watermarkText = options?.enableDynamicWatermark
    ? `Juthori.com/${cleanSlug}`
    : undefined;

  return allItems
    .filter(
      (item) =>
        selectedSet.has(item.id) ||
        (Boolean(item.folderId) && folderSet.has(item.folderId))
    )
    .slice(0, 80)
    .map((item) =>
      cleanUndefined({
        id: item.id,
        folderId: item.folderId,
        title: (item.title || 'وثيقة عائلية').slice(0, 160),
        mediaType: item.mediaType,
        dateOrOccasion: (item.dateOrOccasion || '').slice(0, 80),
        description: item.description ? item.description.slice(0, 400) : undefined,
        previewUrl: item.thumbnailDataUrl || item.fileDataUrl || '',
        watermarkText,
        faceIdNotes: existingNotesMap.get(item.id),
      })
    );
}

interface PublicSiteDirectoryHeader {
  siteSlug: string;
  ownerId: string;
  ownerUid: string;
  familyName: string;
  isPublished: boolean;
  siteAccessMode: SiteAccessMode;
  themeId: FamilySiteThemeId;
  updatedAt: string;
}

export async function fetchPublishedMicrositeBySlug(
  rawSlug: string
): Promise<PublicMicrositeData | null> {
  const slug = normalizePublicSiteSlug(rawSlug);
  if (!slug || slug.length < 3 || PROTECTED_SYSTEM_PATHS.has(slug)) return null;
  const site = await readDualDoc<PublicMicrositeData>(['public_sites', slug]);
  if (site) {
    return site.isPublished ? site : null;
  }

  // Zero-Trust Fallback: if `public_sites/{slug}` denied `get` because it is `PRIVATE_WHITELIST`
  // and the visitor is unauthenticated/unauthorized, load the safe zero-PII directory header
  // so the Family Portal Gate & Access Request form render cleanly without leaking private content.
  const header = await readDualDoc<PublicSiteDirectoryHeader>([
    'public_site_directory',
    slug,
  ]);
  if (
    header &&
    header.isPublished &&
    header.siteAccessMode === 'PRIVATE_WHITELIST'
  ) {
    return {
      siteSlug: header.siteSlug,
      ownerId: header.ownerId,
      ownerUid: header.ownerUid,
      isPublished: true,
      siteAccessMode: 'PRIVATE_WHITELIST',
      privacyMode: 'PRIVATE_WHITELIST',
      whitelistedEmails: [],
      themeId: header.themeId || 'golden_parchment',
      familyName: header.familyName || 'العائلة',
      privacyConfig: {
        showBio: false,
        showFamilyTree: false,
        hideLivingNamesForGuests: true,
        selectedVaultItemIds: [],
      },
      publishedTreeMembers: [],
      publishedVaultItems: [],
      createdAt: header.updatedAt,
      updatedAt: header.updatedAt,
    };
  }

  return null;
}

export async function publishOrUpdatePublicMicrositeAtomically(params: {
  siteSlug: string;
  previousSlug?: string;
  ownerId: string;
  ownerDisplayName?: string;
  ownerEmail?: string;
  ownerReferralCode?: string;
  isPublished: boolean;
  canPublishPublicSite: boolean;
  emailVerified: boolean;
  siteAccessMode: SiteAccessMode;
  themeId: FamilySiteThemeId;
  familyEmblemTag?: string;
  result: LineageSearchResult;
  caps: DashboardAccessCapabilities;
  bioTitle: string;
  bioDescription: string;
  privacyConfig: PublicSitePrivacyConfig;
  rawTreeMembers: RawTreePersonForPublicProjection[];
  allVaultItems: FamilyVaultMediaItem[];
  cmsModules: FamilyMicrositeCmsModules;
}): Promise<{
  ok: boolean;
  code:
    | 'PUBLISHED'
    | 'SAVED_DRAFT'
    | 'TIER_REQUIRED'
    | 'EMAIL_UNVERIFIED'
    | 'SLUG_TAKEN';
  normalizedSlug: string;
  messageAr: string;
  doc?: PublicMicrositeData;
}> {
  const safeUid = (
    params.ownerId ||
    canonicalCustomerEmailUid(params.ownerEmail) ||
    'usr_owner'
  ).replace(/[^a-zA-Z0-9_-]/g, '_');

  const availability = await checkPublicSiteSlugAvailability(
    params.siteSlug,
    safeUid,
    params.ownerEmail
  );
  if (!availability.available) {
    return {
      ok: false,
      code: 'SLUG_TAKEN',
      normalizedSlug: availability.normalizedSlug || params.siteSlug,
      messageAr: availability.reasonAr,
    };
  }

  const normalizedSlug = availability.normalizedSlug;

  if (params.isPublished && (!params.canPublishPublicSite || !params.caps.hasRegistrarBadge)) {
    return {
      ok: false,
      code: 'TIER_REQUIRED',
      normalizedSlug,
      messageAr:
        'إنشاء ونشر البوابة العائلية حق حصري لحاملي صفة «أمين سجل العائلة». يرجى توقيع ميثاق أمين السجل أولاً.',
    };
  }

  if (params.isPublished && !params.emailVerified) {
    return {
      ok: false,
      code: 'EMAIL_UNVERIFIED',
      normalizedSlug,
      messageAr: 'يرجى تأكيد بريدك الإلكتروني أولاً قبل النشر العلني لبوابة العائلة.',
    };
  }

  const nowIso = new Date().toISOString();
  const existing = await readDualDoc<PublicMicrositeData>([
    'public_sites',
    normalizedSlug,
  ]);

  const validThemeId: FamilySiteThemeId = FAMILY_SITE_THEMES.some(
    (t) => t.id === params.themeId
  )
    ? params.themeId
    : 'golden_parchment';

  const circle = await fetchKinshipCircleForOwner(safeUid);
  const whitelistedEmails = Array.from(
    new Set(
      [
        ...(existing?.whitelistedEmails || []),
        ...circle.members.map((m) => m.email.trim().toLowerCase()),
        ...(params.ownerEmail ? [params.ownerEmail.trim().toLowerCase()] : []),
      ].filter(Boolean)
    )
  ).slice(0, 450);

  const guardiansOfMemory: GuardianOfMemoryHonorItem[] = [...circle.members]
    .filter((m) => (m.approvedEnrichmentsCount || 0) > 0)
    .sort(
      (a, b) =>
        (b.approvedEnrichmentsCount || 0) - (a.approvedEnrichmentsCount || 0)
    )
    .slice(0, 3)
    .map((m) => ({
      name: m.name,
      kinshipRelation: m.kinshipRelation,
      approvedCount: m.approvedEnrichmentsCount,
    }));

  const publishedTreeMembers =
    params.privacyConfig.showFamilyTree &&
    params.privacyConfig.treeVisibility !== 'HIDDEN'
      ? sanitizeTreeMembersForPublicSite(params.rawTreeMembers, {
          familyName: params.result.familyName,
          hideLivingNamesForGuests:
            params.privacyConfig.hideLivingNamesForGuests,
          hideLivingBirthDates: params.privacyConfig.hideLivingBirthDates,
          femaleDisplayPolicy: params.privacyConfig.femaleDisplayPolicy,
          startRootPersonId: params.privacyConfig.startRootPersonId,
          excludedBranchRootIds: params.privacyConfig.excludedBranchRootIds,
          siteAccessMode: params.siteAccessMode,
        })
      : [];

  const publishedVaultItems =
    params.privacyConfig.vaultVisibility !== 'HIDDEN'
      ? projectSelectedVaultItemsForPublicSite(
          params.allVaultItems,
          params.privacyConfig.selectedVaultItemIds,
          {
            selectedFolderIds: params.privacyConfig.selectedFolderIds,
            enableDynamicWatermark:
              params.privacyConfig.enableDynamicWatermark ?? true,
            siteSlug: normalizedSlug,
            existingProjectedItems: existing?.publishedVaultItems,
          }
        )
      : [];

  const docPayload: PublicMicrositeData = cleanUndefined({
    siteSlug: normalizedSlug,
    ownerId: safeUid,
    ownerUid: safeUid,
    ownerEmail: params.ownerEmail?.trim().toLowerCase(),
    ownerDisplayName:
      params.ownerDisplayName?.slice(0, 120) ||
      `${params.result.clientName} ${params.result.familyName}`.trim(),
    ownerReferralCode:
      params.ownerReferralCode || buildDeterministicReferralCode(safeUid),
    isPublished: params.isPublished,
    siteAccessMode: params.siteAccessMode,
    privacyMode: params.siteAccessMode,
    whitelistedEmails,
    themeId: validThemeId,
    familyName: (params.result.familyName || 'العائلة').slice(0, 90),
    familyEmblemTag: (params.familyEmblemTag || '').slice(0, 140),
    originCountry: params.result.originCountry,
    originRegion: params.result.originRegion,
    isRegistrarCertified: true,
    membershipLabel: 'ديوان عائلي موثق — أمين سجل العائلة ✦',
    bioTitle: (params.bioTitle || '').slice(0, 190),
    bioDescription: (params.bioDescription || '').slice(0, 3800),
    privacyConfig: params.privacyConfig,
    publishedTreeMembers,
    publishedVaultItems,
    treeMetrics: computeContemporaryTreeMetrics(
      params.rawTreeMembers,
      params.result.familyName
    ),
    cmsModules: params.cmsModules,
    guardiansOfMemory,
    createdAt: existing?.createdAt || nowIso,
    updatedAt: nowIso,
  });

  const directoryHeader: PublicSiteDirectoryHeader = {
    siteSlug: normalizedSlug,
    ownerId: safeUid,
    ownerUid: safeUid,
    familyName: docPayload.familyName,
    isPublished: params.isPublished,
    siteAccessMode: params.siteAccessMode,
    themeId: validThemeId,
    updatedAt: nowIso,
  };

  await Promise.allSettled([
    writeDualDoc(
      ['public_sites', normalizedSlug],
      docPayload as unknown as Record<string, unknown>
    ),
    writeDualDoc(
      ['public_site_directory', normalizedSlug],
      directoryHeader as unknown as Record<string, unknown>
    ),
  ]);

  // Unpublish old slug if registrar renamed the site slug
  if (
    params.previousSlug &&
    normalizePublicSiteSlug(params.previousSlug) !== normalizedSlug
  ) {
    const prevClean = normalizePublicSiteSlug(params.previousSlug);
    const oldDoc = await readDualDoc<PublicMicrositeData>([
      'public_sites',
      prevClean,
    ]);
    if (oldDoc && oldDoc.ownerId === safeUid) {
      await Promise.allSettled([
        deleteDualDoc(['public_sites', prevClean]),
        deleteDualDoc(['public_site_directory', prevClean]),
      ]);
    }
  }

  // Keep kinship circle & user profile synced with active slug
  if (circle.siteSlug !== normalizedSlug) {
    await writeDualDoc(['kinship_circles', safeUid], {
      ...circle,
      ownerId: safeUid,
      familyName: params.result.familyName || circle.familyName || 'العائلة',
      siteSlug: normalizedSlug,
      updatedAt: nowIso,
    });
  }

  updateUserProfile(safeUid, {
    publishedSiteSlug: normalizedSlug,
  }).catch(() => {});

  return {
    ok: true,
    code: params.isPublished ? 'PUBLISHED' : 'SAVED_DRAFT',
    normalizedSlug,
    messageAr: params.isPublished
      ? `تم نشر وتحديث البوابة العائلية بنجاح على الرابط النظيف Juthori.com/${normalizedSlug} ✦`
      : 'تم حفظ إعدادات البوابة العائلية كمسودة خاصة بنجاح ✓',
    doc: docPayload,
  };
}

// =============================================================================
// 3. INTERACTIVE MICROSITE MODULES (BLESSINGS, RSVP, PRAYERS, MAJLIS, FACE ID)
// =============================================================================
export async function addBlessingToFamilyNews(params: {
  siteSlug: string;
  newsId: string;
  senderName: string;
}): Promise<PublicMicrositeData | null> {
  const slug = normalizePublicSiteSlug(params.siteSlug);
  const existing = await readDualDoc<PublicMicrositeData>([
    'public_sites',
    slug,
  ]);
  if (!existing || !existing.cmsModules) return null;

  const cleanSender = params.senderName.trim().slice(0, 80);
  if (!cleanSender) return existing;

  const nowIso = new Date().toISOString();
  const nextItems = existing.cmsModules.newsModule.items.map((item) => {
    if (item.id !== params.newsId) return item;
    const blessings = [
      ...(item.blessings || []),
      {
        id: `bls_${Date.now()}`,
        senderName: cleanSender,
        createdAt: nowIso,
      },
    ].slice(-80);
    return { ...item, blessings };
  });

  const updated: PublicMicrositeData = {
    ...existing,
    cmsModules: {
      ...existing.cmsModules,
      newsModule: {
        ...existing.cmsModules.newsModule,
        items: nextItems,
      },
    },
    updatedAt: nowIso,
  };

  await writeDualDoc(
    ['public_sites', slug],
    updated as unknown as Record<string, unknown>
  );
  return updated;
}

export async function submitEventRsvpOnMicrosite(params: {
  siteSlug: string;
  eventId: string;
  attendeeName: string;
  status: 'attending' | 'apologizing';
  companionsCount: number;
}): Promise<PublicMicrositeData | null> {
  const slug = normalizePublicSiteSlug(params.siteSlug);
  const existing = await readDualDoc<PublicMicrositeData>([
    'public_sites',
    slug,
  ]);
  if (!existing || !existing.cmsModules) return null;

  const cleanName = params.attendeeName.trim().slice(0, 90);
  if (!cleanName) return existing;

  const nowIso = new Date().toISOString();
  const nextItems = existing.cmsModules.eventsModule.items.map((ev) => {
    if (ev.id !== params.eventId) return ev;
    const rsvps = [
      ...(ev.rsvps || []),
      {
        id: `rsvp_${Date.now()}`,
        attendeeName: cleanName,
        status: params.status,
        companionsCount: Math.max(0, Math.min(15, Number(params.companionsCount || 0))),
        createdAt: nowIso,
      },
    ].slice(-150);
    return { ...ev, rsvps };
  });

  const updated: PublicMicrositeData = {
    ...existing,
    cmsModules: {
      ...existing.cmsModules,
      eventsModule: {
        ...existing.cmsModules.eventsModule,
        items: nextItems,
      },
    },
    updatedAt: nowIso,
  };

  await writeDualDoc(
    ['public_sites', slug],
    updated as unknown as Record<string, unknown>
  );
  return updated;
}

export async function incrementElderMemorialPrayer(params: {
  siteSlug: string;
  elderId: string;
}): Promise<PublicMicrositeData | null> {
  const slug = normalizePublicSiteSlug(params.siteSlug);
  const existing = await readDualDoc<PublicMicrositeData>([
    'public_sites',
    slug,
  ]);
  if (!existing || !existing.cmsModules) return null;

  const nowIso = new Date().toISOString();
  const nextElders = existing.cmsModules.memorialAndCapsuleModule.elders.map(
    (el) =>
      el.id === params.elderId
        ? { ...el, prayersCount: (el.prayersCount || 0) + 1 }
        : el
  );

  const updated: PublicMicrositeData = {
    ...existing,
    cmsModules: {
      ...existing.cmsModules,
      memorialAndCapsuleModule: {
        ...existing.cmsModules.memorialAndCapsuleModule,
        elders: nextElders,
      },
    },
    updatedAt: nowIso,
  };

  await writeDualDoc(
    ['public_sites', slug],
    updated as unknown as Record<string, unknown>
  );
  return updated;
}

export async function addReplyToGuidedMajlisTopic(params: {
  siteSlug: string;
  topicId: string;
  authorName: string;
  body: string;
}): Promise<PublicMicrositeData | null> {
  const slug = normalizePublicSiteSlug(params.siteSlug);
  const existing = await readDualDoc<PublicMicrositeData>([
    'public_sites',
    slug,
  ]);
  if (!existing || !existing.cmsModules) return null;

  const cleanAuthor = params.authorName.trim().slice(0, 90);
  const cleanBody = params.body.trim().slice(0, 1200);
  if (!cleanAuthor || !cleanBody) return existing;

  const nowIso = new Date().toISOString();
  const nextTopics = existing.cmsModules.majlisAndGuardiansModule.topics.map(
    (topic) => {
      if (topic.id !== params.topicId || topic.isLocked) return topic;
      const replies = [
        ...(topic.replies || []),
        {
          id: `rep_${Date.now()}`,
          authorName: cleanAuthor,
          body: cleanBody,
          isPinned: false,
          createdAt: nowIso,
        },
      ].slice(-120);
      return { ...topic, replies };
    }
  );

  const updated: PublicMicrositeData = {
    ...existing,
    cmsModules: {
      ...existing.cmsModules,
      majlisAndGuardiansModule: {
        ...existing.cmsModules.majlisAndGuardiansModule,
        topics: nextTopics,
      },
    },
    updatedAt: nowIso,
  };

  await writeDualDoc(
    ['public_sites', slug],
    updated as unknown as Record<string, unknown>
  );
  return updated;
}

export async function submitVaultPhotoFaceIdentification(params: {
  siteSlug: string;
  vaultItemId: string;
  senderName: string;
  note: string;
}): Promise<PublicMicrositeData | null> {
  const slug = normalizePublicSiteSlug(params.siteSlug);
  const existing = await readDualDoc<PublicMicrositeData>([
    'public_sites',
    slug,
  ]);
  if (!existing) return null;

  const cleanSender = params.senderName.trim().slice(0, 80);
  const cleanNote = params.note.trim().slice(0, 350);
  if (!cleanSender || !cleanNote) return existing;

  const nowIso = new Date().toISOString();
  const nextVault = (existing.publishedVaultItems || []).map((v) => {
    if (v.id !== params.vaultItemId) return v;
    const faceIdNotes = [
      ...(v.faceIdNotes || []),
      {
        id: `fid_${Date.now()}`,
        senderName: cleanSender,
        note: cleanNote,
        createdAt: nowIso,
      },
    ].slice(-30);
    return { ...v, faceIdNotes };
  });

  const updated: PublicMicrositeData = {
    ...existing,
    publishedVaultItems: nextVault,
    updatedAt: nowIso,
  };

  await writeDualDoc(
    ['public_sites', slug],
    updated as unknown as Record<string, unknown>
  );
  return updated;
}

// =============================================================================
// 4. PRIVATE KINSHIP CIRCLE, SMART OPT-OUT INVITES & ENRICHMENT WORKFLOW («مجتمعي»)
// =============================================================================
export interface KinshipCircleMember {
  id: string;
  name: string;
  email: string;
  kinshipRelation: string;
  inviteToken: string;
  addedAt: string;
  approvedEnrichmentsCount: number;
}

export interface KinshipCircleDoc {
  ownerId: string;
  familyName?: string;
  siteSlug?: string;
  members: KinshipCircleMember[];
  updatedAt: string;
}

export interface SiteAccessRequestDoc {
  id: string;
  siteSlug: string;
  ownerId: string;
  familyName: string;
  visitorName: string;
  visitorEmail: string;
  kinshipNote?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

export interface TreeEnrichmentRequestDoc {
  id: string;
  siteSlug: string;
  ownerId: string;
  targetOwnerUid?: string;
  requesterUid?: string;
  familyName: string;
  requesterName: string;
  requesterEmail?: string;
  kinshipRelation?: string;
  requestType: EnrichmentRequestType;
  targetPersonId?: string;
  targetPersonName?: string;
  proposedFirstName?: string;
  proposedGender?: 'male' | 'female';
  proposedBirthYear?: string;
  proposedBirthPlace?: string;
  proposedNotes?: string;
  mediaTitle?: string;
  mediaDateOrOccasion?: string;
  mediaDataOrUrl?: string;
  mediaType?: 'photo' | 'document';
  status: 'PENDING_REGISTRAR_APPROVAL' | 'APPROVED_AND_MERGED' | 'REJECTED';
  createdAt: string;
  reviewedAt?: string;
}

export async function fetchKinshipCircleForOwner(
  ownerId: string
): Promise<KinshipCircleDoc> {
  const safeUid = (ownerId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!safeUid) {
    return { ownerId: '', members: [], updatedAt: '' };
  }
  const existing = await readDualDoc<KinshipCircleDoc>([
    'kinship_circles',
    safeUid,
  ]);
  if (existing && Array.isArray(existing.members)) {
    return existing;
  }
  return {
    ownerId: safeUid,
    members: [],
    updatedAt: new Date().toISOString(),
  };
}

export async function addRelativeToKinshipCircleAndSendInvite(params: {
  ownerId: string;
  ownerName: string;
  familyName: string;
  siteSlug?: string;
  referralCode: string;
  relativeName: string;
  kinshipRelation: string;
  relativeEmail: string;
}): Promise<{
  ok: boolean;
  circle: KinshipCircleDoc;
  messageAr: string;
}> {
  const safeUid = params.ownerId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanEmail = params.relativeEmail.trim().toLowerCase();
  const cleanName = params.relativeName.trim().slice(0, 120);
  const cleanRel = params.kinshipRelation.trim().slice(0, 80) || 'قريب';
  const nowIso = new Date().toISOString();

  const current = await fetchKinshipCircleForOwner(safeUid);
  const existingIdx = current.members.findIndex(
    (m) => m.email.toLowerCase() === cleanEmail
  );

  const inviteToken =
    existingIdx >= 0
      ? current.members[existingIdx].inviteToken
      : `opt_${safeUid.slice(0, 10)}_${Date.now().toString(36)}_${Math.random()
          .toString(36)
          .slice(2, 7)}`;

  const memberObj: KinshipCircleMember = {
    id:
      existingIdx >= 0
        ? current.members[existingIdx].id
        : `kin_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: cleanName,
    email: cleanEmail,
    kinshipRelation: cleanRel,
    inviteToken,
    addedAt: existingIdx >= 0 ? current.members[existingIdx].addedAt : nowIso,
    approvedEnrichmentsCount:
      existingIdx >= 0
        ? current.members[existingIdx].approvedEnrichmentsCount || 0
        : 0,
  };

  const nextMembers =
    existingIdx >= 0
      ? current.members.map((m, i) => (i === existingIdx ? memberObj : m))
      : [...current.members, memberObj].slice(0, 450);

  const updatedCircle: KinshipCircleDoc = cleanUndefined({
    ownerId: safeUid,
    familyName: (params.familyName || current.familyName || 'العائلة').slice(
      0,
      90
    ),
    siteSlug: params.siteSlug || current.siteSlug,
    members: nextMembers,
    updatedAt: nowIso,
  });

  await writeDualDoc(
    ['kinship_circles', safeUid],
    updatedCircle as unknown as Record<string, unknown>
  );

  // Sync `whitelistedEmails` on published microsite if exists
  const targetSlug = normalizePublicSiteSlug(
    params.siteSlug || current.siteSlug || ''
  );
  if (targetSlug) {
    const siteDoc = await readDualDoc<PublicMicrositeData>([
      'public_sites',
      targetSlug,
    ]);
    if (siteDoc && siteDoc.ownerId === safeUid) {
      const mergedEmails = Array.from(
        new Set([...(siteDoc.whitelistedEmails || []), cleanEmail])
      ).slice(0, 450);
      await writeDualDoc(['public_sites', targetSlug], {
        ...siteDoc,
        whitelistedEmails: mergedEmails,
        updatedAt: nowIso,
      } as unknown as Record<string, unknown>);
    }
  }

  // Trigger smart Arabic invitation email via Express/Resend endpoint
  const origin =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://juthori.com';
  const siteUrl = targetSlug
    ? `${origin}/${targetSlug}?ref=${encodeURIComponent(params.referralCode)}`
    : `${origin}/?ref=${encodeURIComponent(params.referralCode)}`;
  const optOutUrl = `${origin}/?optout=${encodeURIComponent(inviteToken)}`;

  let emailDispatched = false;
  try {
    const resp = await fetch('/api/email/send-family-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        relativeEmail: cleanEmail,
        relativeName: cleanName,
        kinshipRelation: cleanRel,
        ownerName: params.ownerName,
        familyName: params.familyName,
        siteUrl,
        optOutUrl,
      }),
    });
    if (resp.ok) {
      emailDispatched = true;
    }
  } catch {
    // Graceful fallback if local dev lacks Resend key
  }

  return {
    ok: true,
    circle: updatedCircle,
    messageAr: emailDispatched
      ? `تمت إضافة (${cleanName}) إلى دائرة العائلة وإرسال دعوة بريدية ذكية مع خيار الخصوصية (Opt-out) بنجاح ✓`
      : `تمت إضافة (${cleanName}) وتفعيل صلاحيته الفورية في دائرة العائلة بنجاح ✓`,
  };
}

export async function removeRelativeFromKinshipCircle(params: {
  ownerId: string;
  memberEmail: string;
}): Promise<KinshipCircleDoc> {
  const safeUid = params.ownerId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const targetEmail = params.memberEmail.trim().toLowerCase();
  const nowIso = new Date().toISOString();

  const current = await fetchKinshipCircleForOwner(safeUid);
  const nextMembers = current.members.filter(
    (m) => m.email.trim().toLowerCase() !== targetEmail
  );

  const updatedCircle: KinshipCircleDoc = cleanUndefined({
    ...current,
    ownerId: safeUid,
    familyName: current.familyName || 'العائلة',
    members: nextMembers,
    updatedAt: nowIso,
  });

  await writeDualDoc(
    ['kinship_circles', safeUid],
    updatedCircle as unknown as Record<string, unknown>
  );

  if (current.siteSlug) {
    const slug = normalizePublicSiteSlug(current.siteSlug);
    const siteDoc = await readDualDoc<PublicMicrositeData>([
      'public_sites',
      slug,
    ]);
    if (siteDoc && siteDoc.ownerId === safeUid) {
      await writeDualDoc(['public_sites', slug], {
        ...siteDoc,
        whitelistedEmails: (siteDoc.whitelistedEmails || []).filter(
          (e) => e.trim().toLowerCase() !== targetEmail
        ),
        updatedAt: nowIso,
      } as unknown as Record<string, unknown>);
    }
  }

  return updatedCircle;
}

/**
 * 1-Click Privacy Unlink (`?optout={inviteToken}`) from Smart Invitation Email
 */
export async function processKinshipOptOutByToken(
  token: string
): Promise<{ ok: boolean; messageAr: string }> {
  const cleanToken = (token || '').trim();
  if (!cleanToken) {
    return { ok: false, messageAr: 'رمز إلغاء الارتباط غير صالح.' };
  }

  const allCircles = await readDualCollection<KinshipCircleDoc>(
    'kinship_circles'
  );
  for (const circle of allCircles) {
    if (!circle || !Array.isArray(circle.members)) continue;
    const match = circle.members.find((m) => m.inviteToken === cleanToken);
    if (match) {
      await removeRelativeFromKinshipCircle({
        ownerId: circle.ownerId,
        memberEmail: match.email,
      });
      return {
        ok: true,
        messageAr: `تمت إزالة بريدك (${match.email}) وإلغاء ارتباطك بدائرة أسرة ${
          circle.familyName || ''
        } فوراً احتراماً لخصوصيتك ✓`,
      };
    }
  }

  return {
    ok: false,
    messageAr: 'تم إلغاء هذا الارتباط مسبقاً أو أن الرابط منتهي الصلاحية.',
  };
}

export async function fetchAuthorizedFamilyPortalsForEmail(
  email: string
): Promise<
  Array<{
    siteSlug: string;
    familyName: string;
    ownerDisplayName: string;
  }>
> {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) return [];

  const [primarySnap, mirrorSnap] = await Promise.allSettled([
    fastTimeout(
      getDocs(
        query(
          collection(db, 'public_sites'),
          where('isPublished', '==', true),
          where('whitelistedEmails', 'array-contains', cleanEmail)
        )
      ),
      3000
    ),
    fastTimeout(
      getDocs(
        query(
          collection(mirrorDb, 'public_sites'),
          where('isPublished', '==', true),
          where('whitelistedEmails', 'array-contains', cleanEmail)
        )
      ),
      3000
    ),
  ]);

  const map = new Map<string, PublicMicrositeData>();
  if (mirrorSnap.status === 'fulfilled') {
    mirrorSnap.value.docs.forEach((d) => {
      const s = d.data() as PublicMicrositeData;
      if (s && s.siteSlug && s.isPublished) map.set(s.siteSlug, s);
    });
  }
  if (primarySnap.status === 'fulfilled') {
    primarySnap.value.docs.forEach((d) => {
      const s = d.data() as PublicMicrositeData;
      if (s && s.siteSlug && s.isPublished) map.set(s.siteSlug, s);
    });
  }

  return Array.from(map.values()).map((s) => ({
    siteSlug: s.siteSlug,
    familyName: s.familyName,
    ownerDisplayName: s.ownerDisplayName || 'أمين سجل العائلة',
  }));
}

export async function submitSiteAccessRequest(params: {
  siteSlug: string;
  ownerId: string;
  familyName: string;
  visitorName: string;
  visitorEmail: string;
  kinshipNote?: string;
}): Promise<SiteAccessRequestDoc> {
  const slug = normalizePublicSiteSlug(params.siteSlug);
  const id = `acc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const nowIso = new Date().toISOString();

  const docObj: SiteAccessRequestDoc = cleanUndefined({
    id,
    siteSlug: slug,
    ownerId: params.ownerId.replace(/[^a-zA-Z0-9_-]/g, '_'),
    familyName: params.familyName.slice(0, 90),
    visitorName: params.visitorName.trim().slice(0, 120),
    visitorEmail: params.visitorEmail.trim().toLowerCase().slice(0, 120),
    kinshipNote: params.kinshipNote?.trim().slice(0, 240),
    status: 'PENDING',
    createdAt: nowIso,
  });

  await writeDualDoc(
    ['site_access_requests', id],
    docObj as unknown as Record<string, unknown>
  );
  return docObj;
}

export async function fetchPendingSiteAccessRequestsForOwner(
  ownerId: string
): Promise<SiteAccessRequestDoc[]> {
  const safeUid = (ownerId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!safeUid) return [];
  const [primarySnap, mirrorSnap] = await Promise.allSettled([
    fastTimeout(
      getDocs(
        query(
          collection(db, 'site_access_requests'),
          where('ownerId', '==', safeUid)
        )
      ),
      3000
    ),
    fastTimeout(
      getDocs(
        query(
          collection(mirrorDb, 'site_access_requests'),
          where('ownerId', '==', safeUid)
        )
      ),
      3000
    ),
  ]);

  const map = new Map<string, SiteAccessRequestDoc>();
  if (mirrorSnap.status === 'fulfilled') {
    mirrorSnap.value.docs.forEach((d) => {
      const r = d.data() as SiteAccessRequestDoc;
      if (r && r.id && r.ownerId === safeUid && r.status === 'PENDING') {
        map.set(r.id, r);
      }
    });
  }
  if (primarySnap.status === 'fulfilled') {
    primarySnap.value.docs.forEach((d) => {
      const r = d.data() as SiteAccessRequestDoc;
      if (r && r.id && r.ownerId === safeUid && r.status === 'PENDING') {
        map.set(r.id, r);
      }
    });
  }

  return Array.from(map.values()).sort((a, b) =>
    (b.createdAt || '').localeCompare(a.createdAt || '')
  );
}

export async function resolveSiteAccessRequest(params: {
  request: SiteAccessRequestDoc;
  approve: boolean;
  ownerName: string;
}): Promise<void> {
  const { request, approve, ownerName } = params;
  const nextStatus = approve ? 'APPROVED' : 'REJECTED';

  await writeDualDoc(['site_access_requests', request.id], {
    ...request,
    status: nextStatus,
  } as unknown as Record<string, unknown>);

  if (approve) {
    await addRelativeToKinshipCircleAndSendInvite({
      ownerId: request.ownerId,
      ownerName,
      familyName: request.familyName,
      siteSlug: request.siteSlug,
      referralCode: buildDeterministicReferralCode(request.ownerId),
      relativeName: request.visitorName,
      kinshipRelation: request.kinshipNote || 'فرد من الأسرة',
      relativeEmail: request.visitorEmail,
    });
  }
}

export async function submitTreeEnrichmentRequest(params: {
  siteSlug: string;
  ownerId: string;
  familyName: string;
  requesterName: string;
  requesterEmail?: string;
  kinshipRelation?: string;
  requestType: EnrichmentRequestType;
  targetPersonId?: string;
  targetPersonName?: string;
  proposedFirstName?: string;
  proposedGender?: 'male' | 'female';
  proposedBirthYear?: string;
  proposedBirthPlace?: string;
  proposedNotes?: string;
  mediaTitle?: string;
  mediaDateOrOccasion?: string;
  mediaDataOrUrl?: string;
  mediaType?: 'photo' | 'document';
}): Promise<TreeEnrichmentRequestDoc> {
  const slug = normalizePublicSiteSlug(params.siteSlug);
  const id = `enr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const nowIso = new Date().toISOString();
  const safeOwner = params.ownerId.replace(/[^a-zA-Z0-9_-]/g, '_');

  const reqDoc: TreeEnrichmentRequestDoc = cleanUndefined({
    id,
    siteSlug: slug,
    ownerId: safeOwner,
    targetOwnerUid: safeOwner,
    requesterUid: auth.currentUser?.uid
      ? auth.currentUser.uid.replace(/[^a-zA-Z0-9_-]/g, '_')
      : undefined,
    familyName: (params.familyName || 'العائلة').slice(0, 90),
    requesterName: params.requesterName.trim().slice(0, 120),
    requesterEmail: params.requesterEmail?.trim().toLowerCase().slice(0, 120),
    kinshipRelation: params.kinshipRelation?.trim().slice(0, 80),
    requestType: params.requestType,
    targetPersonId: params.targetPersonId?.slice(0, 100),
    targetPersonName: params.targetPersonName?.slice(0, 140),
    proposedFirstName: params.proposedFirstName?.trim().slice(0, 80),
    proposedGender: params.proposedGender,
    proposedBirthYear: params.proposedBirthYear?.trim().slice(0, 20),
    proposedBirthPlace: params.proposedBirthPlace?.trim().slice(0, 80),
    proposedNotes: params.proposedNotes?.trim().slice(0, 1800),
    mediaTitle: params.mediaTitle?.trim().slice(0, 150),
    mediaDateOrOccasion: params.mediaDateOrOccasion?.trim().slice(0, 80),
    mediaDataOrUrl:
      params.mediaDataOrUrl && params.mediaDataOrUrl.length <= 420000
        ? params.mediaDataOrUrl
        : undefined,
    mediaType: params.mediaType,
    status: 'PENDING_REGISTRAR_APPROVAL',
    createdAt: nowIso,
  });

  await Promise.allSettled([
    writeDualDoc(
      ['enrichment_requests', id],
      reqDoc as unknown as Record<string, unknown>
    ),
    writeDualDoc(
      ['tree_enrichment_requests', id],
      reqDoc as unknown as Record<string, unknown>
    ),
  ]);

  sendCustomerNotification({
    userId: safeOwner,
    title: `مقترح إثراء جديد لبوابة أسرة ${params.familyName} ✦`,
    body: `قدّم (${reqDoc.requesterName}) مقترح إثراء جديد عبر بوابة موقعي بانتظار اعتمادك في تبويب «مجتمعي».`,
    category: 'system_notice',
    senderRole: 'system',
  }).catch(() => {});

  return reqDoc;
}

export function subscribeToOwnerEnrichmentRequests(
  ownerId: string,
  onUpdate: (items: TreeEnrichmentRequestDoc[]) => void
): Unsubscribe {
  const safeUid = (ownerId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!safeUid) {
    onUpdate([]);
    return () => {};
  }

  let primaryCache: TreeEnrichmentRequestDoc[] = [];
  let mirrorCache: TreeEnrichmentRequestDoc[] = [];

  const emitMerged = () => {
    const map = new Map<string, TreeEnrichmentRequestDoc>();
    for (const item of [...mirrorCache, ...primaryCache]) {
      if (item && item.id && item.ownerId === safeUid) {
        map.set(item.id, item);
      }
    }
    const sorted = Array.from(map.values()).sort((a, b) =>
      (b.createdAt || '').localeCompare(a.createdAt || '')
    );
    onUpdate(sorted);
  };

  const unsubPrimary = onSnapshot(
    query(
      collection(db, 'enrichment_requests'),
      where('ownerId', '==', safeUid)
    ),
    (snap) => {
      primaryCache = snap.docs.map((d) => d.data() as TreeEnrichmentRequestDoc);
      emitMerged();
    },
    () => {}
  );

  const unsubMirror = onSnapshot(
    query(
      collection(mirrorDb, 'enrichment_requests'),
      where('ownerId', '==', safeUid)
    ),
    (snap) => {
      mirrorCache = snap.docs.map((d) => d.data() as TreeEnrichmentRequestDoc);
      emitMerged();
    },
    () => {}
  );

  return () => {
    unsubPrimary();
    unsubMirror();
  };
}

/**
 * Closed-Loop 1-Click Approval & Merge:
 * Merges the approved enrichment directly into the Registrar's private `شجرتي` or `خزانتي`,
 * increments the contributor's `حماة الذاكرة` counter, and automatically updates `public_sites/{siteSlug}`!
 */
export async function reviewAndMergeEnrichmentRequest(params: {
  request: TreeEnrichmentRequestDoc;
  approve: boolean;
  ownerId: string;
  ownerEmail?: string;
  familyName: string;
}): Promise<{
  ok: boolean;
  messageAr: string;
  updatedRequest: TreeEnrichmentRequestDoc;
}> {
  const { request, approve, ownerId, ownerEmail, familyName } = params;
  const safeUid = ownerId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const nowIso = new Date().toISOString();

  if (!approve) {
    const rejected: TreeEnrichmentRequestDoc = {
      ...request,
      status: 'REJECTED',
      reviewedAt: nowIso,
    };
    await Promise.allSettled([
      writeDualDoc(
        ['enrichment_requests', request.id],
        rejected as unknown as Record<string, unknown>
      ),
      writeDualDoc(
        ['tree_enrichment_requests', request.id],
        rejected as unknown as Record<string, unknown>
      ),
    ]);
    return {
      ok: true,
      messageAr: `تم رفض مقترح (${request.requesterName}) وحفظه في الأرشيف.`,
      updatedRequest: rejected,
    };
  }

  // Load Registrar's private tree & vault
  let currentTree =
    (await fetchUserFamilyTreeFromFirebase<RawTreePersonForPublicProjection>(
      safeUid,
      ownerEmail,
      familyName
    )) ||
    readUserFamilyTreeFromLocal<RawTreePersonForPublicProjection>(
      safeUid,
      familyName,
      ownerEmail
    ) ||
    [];

  const currentVault = await fetchUserVaultArchive(
    safeUid,
    familyName,
    ownerEmail
  );
  let nextVaultItems = [...(currentVault.items || [])];
  let newlyAddedVaultItemId: string | null = null;

  if (request.requestType === 'ADD_TREE_MEMBER' && request.proposedFirstName) {
    const parentNode = currentTree.find((n) => n.id === request.targetPersonId);
    const parentGen =
      typeof parentNode?.generationLevel === 'number'
        ? parentNode.generationLevel
        : 2;
    const newPerson: RawTreePersonForPublicProjection = {
      id: `person_enr_${Date.now()}`,
      firstName: request.proposedFirstName.trim(),
      familyName: familyName,
      fatherId: request.targetPersonId || undefined,
      gender: request.proposedGender || 'male',
      relationLabel:
        request.proposedGender === 'female' ? 'ابنة مضافة بالإثراء' : 'ابن مضاف بالإثراء',
      generationLevel: Math.max(1, parentGen - 1),
      isDeceased: false,
      isAlive: true,
      vitalStatus: 'living',
      birthYear: request.proposedBirthYear || undefined,
      birthPlace: request.proposedBirthPlace || undefined,
      biography: request.proposedNotes || undefined,
      isCertifiedReference: false,
    };
    currentTree = [...currentTree, newPerson];
    await saveUserFamilyTreeToFirebase(
      safeUid,
      familyName,
      currentTree,
      ownerEmail
    );
  } else if (request.requestType === 'CORRECTION_NOTE') {
    if (request.targetPersonId && request.proposedNotes) {
      currentTree = currentTree.map((n) => {
        if (n.id !== request.targetPersonId || n.isCertifiedReference) return n;
        const prevBio = String(n.biography || '').trim();
        const appended = prevBio
          ? `${prevBio}\n• إثراء عائلي (${request.requesterName}): ${request.proposedNotes}`
          : `إثراء عائلي (${request.requesterName}): ${request.proposedNotes}`;
        return { ...n, biography: appended.slice(0, 1200) };
      });
      await saveUserFamilyTreeToFirebase(
        safeUid,
        familyName,
        currentTree,
        ownerEmail
      );
    }
  } else if (request.requestType === 'VAULT_MEDIA') {
    const newItemId = `v_enr_${Date.now()}`;
    newlyAddedVaultItemId = newItemId;
    const newVaultItem: FamilyVaultMediaItem = {
      id: newItemId,
      title:
        request.mediaTitle ||
        `إهداء أرشيفي من ${request.requesterName}`,
      mediaType: request.mediaType || 'photo',
      folderId:
        currentVault.folders[0]?.id ||
        DEFAULT_STARTER_VAULT_FOLDERS[0].id,
      dateOrOccasion: request.mediaDateOrOccasion || 'إهداء عائلي موثق',
      description: request.proposedNotes || undefined,
      fileDataUrl: request.mediaDataOrUrl || '',
      thumbnailDataUrl: request.mediaDataOrUrl || undefined,
      linkedPersonIds: request.targetPersonId ? [request.targetPersonId] : [],
      enhanced: false,
      createdAt: nowIso,
    };
    nextVaultItems = [newVaultItem, ...nextVaultItems];
    await saveUserVaultArchive(
      safeUid,
      familyName,
      {
        folders: currentVault.folders,
        items: nextVaultItems,
      },
      ownerEmail
    );
  }

  // Update contributor's `حماة الذاكرة` score inside `kinship_circles/{ownerId}`
  const circle = await fetchKinshipCircleForOwner(safeUid);
  let contributorMatched = false;
  const updatedMembers = circle.members.map((m) => {
    const emailMatch =
      Boolean(request.requesterEmail) &&
      m.email.toLowerCase() === request.requesterEmail!.toLowerCase();
    const nameMatch = m.name.trim() === request.requesterName.trim();
    if (emailMatch || nameMatch) {
      contributorMatched = true;
      return {
        ...m,
        approvedEnrichmentsCount: (m.approvedEnrichmentsCount || 0) + 1,
      };
    }
    return m;
  });

  if (!contributorMatched && request.requesterEmail) {
    updatedMembers.push({
      id: `kin_${Date.now()}`,
      name: request.requesterName,
      email: request.requesterEmail.toLowerCase(),
      kinshipRelation: request.kinshipRelation || 'مساهم في السجل',
      inviteToken: `opt_${Date.now().toString(36)}`,
      addedAt: nowIso,
      approvedEnrichmentsCount: 1,
    });
  }

  const nextCircle: KinshipCircleDoc = {
    ...circle,
    ownerId: safeUid,
    familyName: familyName || circle.familyName || 'العائلة',
    members: updatedMembers,
    updatedAt: nowIso,
  };
  await writeDualDoc(
    ['kinship_circles', safeUid],
    nextCircle as unknown as Record<string, unknown>
  );

  // Automatically rebuild the Filtered Mirror `public_sites/{siteSlug}`
  const slug = normalizePublicSiteSlug(request.siteSlug);
  const existingSite = await readDualDoc<PublicMicrositeData>([
    'public_sites',
    slug,
  ]);
  if (existingSite && existingSite.ownerId === safeUid) {
    const nextSelectedIds = newlyAddedVaultItemId
      ? Array.from(
          new Set([
            ...(existingSite.privacyConfig.selectedVaultItemIds || []),
            newlyAddedVaultItemId,
          ])
        )
      : existingSite.privacyConfig.selectedVaultItemIds || [];

    const nextPrivacy: PublicSitePrivacyConfig = {
      ...existingSite.privacyConfig,
      selectedVaultItemIds: nextSelectedIds,
    };

    const guardiansOfMemory: GuardianOfMemoryHonorItem[] = [...updatedMembers]
      .filter((m) => (m.approvedEnrichmentsCount || 0) > 0)
      .sort(
        (a, b) =>
          (b.approvedEnrichmentsCount || 0) - (a.approvedEnrichmentsCount || 0)
      )
      .slice(0, 3)
      .map((m) => ({
        name: m.name,
        kinshipRelation: m.kinshipRelation,
        approvedCount: m.approvedEnrichmentsCount,
      }));

    const refreshedSite: PublicMicrositeData = cleanUndefined({
      ...existingSite,
      privacyConfig: nextPrivacy,
      publishedTreeMembers:
        nextPrivacy.showFamilyTree && nextPrivacy.treeVisibility !== 'HIDDEN'
          ? sanitizeTreeMembersForPublicSite(currentTree, {
              familyName: existingSite.familyName,
              hideLivingNamesForGuests: nextPrivacy.hideLivingNamesForGuests,
              hideLivingBirthDates: nextPrivacy.hideLivingBirthDates,
              femaleDisplayPolicy: nextPrivacy.femaleDisplayPolicy,
              startRootPersonId: nextPrivacy.startRootPersonId,
              excludedBranchRootIds: nextPrivacy.excludedBranchRootIds,
              siteAccessMode: existingSite.siteAccessMode,
            })
          : [],
      publishedVaultItems:
        nextPrivacy.vaultVisibility !== 'HIDDEN'
          ? projectSelectedVaultItemsForPublicSite(
              nextVaultItems,
              nextSelectedIds,
              {
                selectedFolderIds: nextPrivacy.selectedFolderIds,
                enableDynamicWatermark:
                  nextPrivacy.enableDynamicWatermark ?? true,
                siteSlug: slug,
                existingProjectedItems: existingSite.publishedVaultItems,
              }
            )
          : [],
      treeMetrics: computeContemporaryTreeMetrics(
        currentTree,
        existingSite.familyName
      ),
      guardiansOfMemory,
      updatedAt: nowIso,
    });

    await writeDualDoc(
      ['public_sites', slug],
      refreshedSite as unknown as Record<string, unknown>
    );
  }

  const approvedDoc: TreeEnrichmentRequestDoc = {
    ...request,
    status: 'APPROVED_AND_MERGED',
    reviewedAt: nowIso,
  };
  await Promise.allSettled([
    writeDualDoc(
      ['enrichment_requests', request.id],
      approvedDoc as unknown as Record<string, unknown>
    ),
    writeDualDoc(
      ['tree_enrichment_requests', request.id],
      approvedDoc as unknown as Record<string, unknown>
    ),
  ]);

  return {
    ok: true,
    messageAr: `تم اعتماد ودمج إثراء (${request.requesterName}) في سجلك الخاص وتحديث مرآة موقعك العائلي تلقائياً ✦`,
    updatedRequest: approvedDoc,
  };
}

// =============================================================================
// 5. $10 ATOMIC REFERRAL DASHBOARD LOADER (`referral_codes/{code}`)
// =============================================================================
export async function fetchUserReferralDashboard(
  userId: string,
  ownerFullName = ''
): Promise<{
  referralCode: string;
  rewardPerAnnualSubUsd: number;
  invitees: Array<{
    userId: string;
    fullName: string;
    status: 'REGISTERED_FREE' | 'REWARDED_10_USD';
    createdAt: string;
    rewardedAt?: string;
  }>;
  registeredCount: number;
  rewardedAnnualCount: number;
  totalEarnedUsd: number;
}> {
  const safeUid = (userId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const referralCode = buildDeterministicReferralCode(safeUid || 'usr_guest');

  if (!safeUid) {
    return {
      referralCode,
      rewardPerAnnualSubUsd: REFERRAL_REWARD_USD,
      invitees: [],
      registeredCount: 0,
      rewardedAnnualCount: 0,
      totalEarnedUsd: 0,
    };
  }

  const existing = await readDualDoc<ReferralCodeIndexDoc>([
    'referral_codes',
    referralCode,
  ]);

  if (!existing) {
    const seedDoc: ReferralCodeIndexDoc = {
      code: referralCode,
      ownerId: safeUid,
      ownerName: ownerFullName.slice(0, 120),
      invitees: [],
      totalEarnedUsd: 0,
      updatedAt: new Date().toISOString(),
    };
    writeDualDoc(
      ['referral_codes', referralCode],
      seedDoc as unknown as Record<string, unknown>
    ).catch(() => {});

    return {
      referralCode,
      rewardPerAnnualSubUsd: REFERRAL_REWARD_USD,
      invitees: [],
      registeredCount: 0,
      rewardedAnnualCount: 0,
      totalEarnedUsd: 0,
    };
  }

  const mappedInvitees = (existing.invitees || []).map((inv) => ({
    userId: inv.userId,
    fullName: inv.fullName || 'عضو مدعو',
    status:
      inv.status === 'SUBSCRIBED_PAID'
        ? ('REWARDED_10_USD' as const)
        : ('REGISTERED_FREE' as const),
    createdAt: inv.createdAt,
    rewardedAt: inv.upgradedAt,
  }));

  const rewardedAnnualCount = mappedInvitees.filter(
    (i) => i.status === 'REWARDED_10_USD'
  ).length;

  return {
    referralCode: existing.code || referralCode,
    rewardPerAnnualSubUsd: REFERRAL_REWARD_USD,
    invitees: mappedInvitees,
    registeredCount: mappedInvitees.length,
    rewardedAnnualCount,
    totalEarnedUsd:
      typeof existing.totalEarnedUsd === 'number'
        ? existing.totalEarnedUsd
        : rewardedAnnualCount * REFERRAL_REWARD_USD,
  };
}
