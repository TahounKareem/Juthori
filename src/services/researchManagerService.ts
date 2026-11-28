import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  auth,
  db,
  staffAuth,
  staffDb,
  mirrorAuth,
  mirrorDb,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  buildVerifiedLineageSnapshot,
  fetchUserFamilyTreeFromFirebase,
  isRuntimeStaffSession,
  ResearchTicketData,
  sendCustomerNotification,
  TeamMemberRecord,
  updateResearchTicketFullInFirebase,
  UserProfileData,
} from './firestoreService';
import { createKashafiItem, KashafiItemRecord } from './kashafiService';
import {
  DashboardStateMode,
  FreeLeadRadarSignal,
  KashafiDiscoveryCategory,
  LineageConnectionDecisionStatus,
  LineageSearchResult,
  MasterLineageCatalogEntry,
  ResearchApprovalDraftRecord,
  StaffRbacRole,
  UpperAncestorNode,
} from '../types/juthori';
import { normalizeSubscriptionPlanId } from '../config/subscriptionPlans';

// =============================================================================
// CONSTANTS & LOCAL FALLBACK KEYS
// =============================================================================

const LOCAL_DRAFTS_KEY = 'juthori_research_approval_drafts_v1';
const LOCAL_MASTER_CATALOG_KEY = 'juthori_master_lineage_catalog_v1';

export const DEFAULT_MASTER_LINEAGE_CATALOG: MasterLineageCatalogEntry[] = [
  {
    id: 'cat_root_tamim',
    entryKind: 'historical_root',
    rootName: 'بنو تميم (العدنانية)',
    motherTribe: 'مضر بن نزار بن معد بن عدنان',
    ancestralChainSummary: 'تميم بن مر بن أد بن طابخة بن إلياس بن مضر بن نزار بن معد بن عدنان',
    regions: ['نجد', 'القصيم', 'الأحساء', 'العراق', 'قطر', 'الكويت'],
    bookTitle: 'جمهرة أنساب العرب',
    authorName: 'ابن حزم الأندلسي (ت 456هـ)',
    centuryOrEra: 'القرن الخامس الهجري',
    volumeOrPagesHint: 'ص 207 – 231',
    scholarlyNotes: 'من أوسع بطون مضر انتشاراً في نجد والعراق والخليج مع تعدد الفروع الموثقة (عمرو، سعد، حنظلة).',
    addedByName: 'هيئة بحوث جذوري',
    createdAt: '2026-01-10T00:00:00.000Z',
    updatedAt: '2026-01-10T00:00:00.000Z',
  },
  {
    id: 'cat_root_tayy',
    entryKind: 'historical_root',
    rootName: 'قبيلة طيء (القحطانية)',
    motherTribe: 'كهلان بن سبأ بن يشجب بن يعرب بن قحطان',
    ancestralChainSummary: 'طيء (جلهمة) بن أدد بن زيد بن يشجب بن عريب بن زيد بن كهلان بن سبأ',
    regions: ['حائل', 'الجبلين', 'الشام', 'العراق', 'مصر'],
    bookTitle: 'نهاية الأرب في معرفة أنساب العرب',
    authorName: 'أبو العباس القلقشندي (ت 821هـ)',
    centuryOrEra: 'القرن التاسع الهجري',
    volumeOrPagesHint: 'ص 326 – 334',
    scholarlyNotes: 'من كبريات قبائل كهلان القحطانية واستقرت فروعها في جبلي أجا وسلمى وامتدت للشام والعراق وصعيد مصر.',
    addedByName: 'هيئة بحوث جذوري',
    createdAt: '2026-01-10T00:00:00.000Z',
    updatedAt: '2026-01-10T00:00:00.000Z',
  },
  {
    id: 'cat_root_hashem',
    entryKind: 'historical_root',
    rootName: 'الأشراف آل البيت (بنو هاشم)',
    motherTribe: 'قريش بن كنانة بن خزيمة بن مدركة بن إلياس بن مضر',
    ancestralChainSummary: 'الحسن والحسين ابنا علي بن أبي طالب بن عبد المطلب بن هاشم بن عبد مناف',
    regions: ['الحجاز', 'مكة المكرمة', 'المدينة المنورة', 'الأردن', 'المغرب', 'مصر', 'العراق', 'اليمن'],
    bookTitle: 'عمدة الطالب في أنساب آل أبي طالب',
    authorName: 'جمال الدين ابن عنبة (ت 828هـ)',
    centuryOrEra: 'القرن التاسع الهجري',
    volumeOrPagesHint: 'الأجزاء 1 – 3',
    scholarlyNotes: 'يُشترط في ربط الفروع الهاشمية وجود مشجر موثق أو وثيقة نقابة أشراف متصلة السند.',
    addedByName: 'هيئة بحوث جذوري',
    createdAt: '2026-01-10T00:00:00.000Z',
    updatedAt: '2026-01-10T00:00:00.000Z',
  },
  {
    id: 'cat_root_qays_anazah',
    entryKind: 'historical_root',
    rootName: 'قبيلة عنزة (الربيعة العدنانية)',
    motherTribe: 'ربيعة بن نزار بن معد بن عدنان',
    ancestralChainSummary: 'عنزة بن أسد بن ربيعة بن نزار بن معد بن عدنان',
    regions: ['الشمال', 'نجد', 'العراق', 'سوريا', 'الأردن', 'الكويت', 'البحرين'],
    bookTitle: 'سبائك الذهب في معرفة قبائل العرب',
    authorName: 'أبو الفوز محمد أمين السويدي (ت 1246هـ)',
    centuryOrEra: 'القرن الثالث عشر الهجري',
    volumeOrPagesHint: 'ص 58 – 64',
    scholarlyNotes: 'تنقسم معاصراً إلى جذمي ضنا مسلم وضنا بشر مع امتدادات واسعة في شمال الجزيرة وبادية الشام.',
    addedByName: 'هيئة بحوث جذوري',
    createdAt: '2026-01-10T00:00:00.000Z',
    updatedAt: '2026-01-10T00:00:00.000Z',
  },
  {
    id: 'cat_book_kahhala',
    entryKind: 'reference_book',
    rootName: 'معجم قبائل العرب القديمة والحديثة',
    motherTribe: 'مرجع شامل لقبائل الجزيرة والشام ومصر والمغرب',
    regions: ['العالم العربي'],
    bookTitle: 'معجم قبائل العرب القديمة والحديثة',
    authorName: 'عمر رضا كحالة',
    centuryOrEra: 'القرن الرابع عشر الهجري (1949م)',
    volumeOrPagesHint: '5 مجلدات مع الاستدراكات',
    scholarlyNotes: 'مرجع فهرسة أبجدية ممتاز لتتبع الفخوذ والعشائر المعاصرة ومقارنتها بالمصادر التراثية.',
    addedByName: 'هيئة بحوث جذوري',
    createdAt: '2026-01-12T00:00:00.000Z',
    updatedAt: '2026-01-12T00:00:00.000Z',
  },
  {
    id: 'cat_book_hamdani',
    entryKind: 'reference_book',
    rootName: 'الإكليل في أنساب اليمن وحمير',
    motherTribe: 'مرجع القبائل القحطانية واليمنية والهجرات العربية',
    regions: ['اليمن', 'عمان', 'جنوب الجزيرة', 'مصر', 'المغرب العربي'],
    bookTitle: 'الإكليل من أخبار اليمن وأنساب حمير',
    authorName: 'أبو محمد الحسن الهمداني (ت 334هـ)',
    centuryOrEra: 'القرن الرابع الهجري',
    volumeOrPagesHint: 'الأجزاء 1، 2، 8، 10',
    scholarlyNotes: 'المصدر الأقدم والأوثق في تفصيل بطون حمير وكهلان ومساكنها التاريخية.',
    addedByName: 'هيئة بحوث جذوري',
    createdAt: '2026-01-12T00:00:00.000Z',
    updatedAt: '2026-01-12T00:00:00.000Z',
  },
];

// =============================================================================
// INTERNAL HELPERS
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

function fastTimeout<T>(promise: Promise<T>, ms = 4000): Promise<T> {
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

function resolveStaffTargetDb(): typeof db {
  if (isRuntimeStaffSession(staffAuth)) return staffDb;
  if (auth.currentUser) return db;
  return staffDb;
}

function readLocalJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLocalJson<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota issues
  }
}

export function normalizeArabicCompare(text?: string): string {
  return (text || '')
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/^ال/u, '')
    .replace(/\s+/g, ' ');
}

export function getLineageDecisionLabelAr(
  status: LineageConnectionDecisionStatus
): string {
  switch (status) {
    case 'verified_connected':
      return 'تم إثبات الربط المرجعي واعتماده ✓';
    case 'partial_investigating':
      return 'تقاطع جزئي — قيد الاستقصاء المعمق';
    case 'needs_client_info':
      return 'مطلوب إيضاح أو وثيقة من العميل';
    case 'insufficient_sources':
      return 'تعذّر الربط الموثق حالياً لعدم كفاية المصادر';
  }
}

export function getKashafiDiscoveryCategoryLabelAr(
  category?: KashafiDiscoveryCategory
): string {
  switch (category) {
    case 'sources':
      return 'المصادر والمراجع التاريخية';
    case 'documents':
      return 'الوثائق والمواد التاريخية';
    case 'stories':
      return 'السير والقصص العائلية التاريخية';
    case 'ongoing':
      return 'الاكتشافات المستمرة';
    default:
      return 'اكتشاف بحثي معتمد';
  }
}

// =============================================================================
// 1. FETCH ALL REGISTERED CUSTOMER PROFILES FOR RESEARCH MANAGER & FREE RADAR
// =============================================================================

export async function fetchAllCustomerProfilesForResearch(): Promise<
  UserProfileData[]
> {
  const targetDb = resolveStaffTargetDb();
  try {
    const snap = await fastTimeout(
      getDocs(collection(targetDb, 'users')),
      4500
    );
    const list = snap.docs
      .map((d) => {
        const data = d.data() as UserProfileData;
        return {
          ...data,
          userId: data.userId || d.id,
        };
      })
      .filter((u) => Boolean(u.userId && u.email));

    return list.sort((a, b) =>
      (b.createdAt || '').localeCompare(a.createdAt || '')
    );
  } catch (err) {
    try {
      handleFirestoreError(err, OperationType.LIST, 'users');
    } catch {
      // Logged cleanly
    }
    return [];
  }
}

export async function fetchCustomerTreePreviewForResearch(
  userId: string,
  familyName?: string,
  email?: string
): Promise<{
  totalMembers: number;
  generationsEstimate: number;
  sampleNames: string[];
  rawMembers: Array<Record<string, unknown>>;
}> {
  try {
    const raw = await fetchUserFamilyTreeFromFirebase(userId, familyName, email);
    if (!Array.isArray(raw) || raw.length === 0) {
      return {
        totalMembers: 0,
        generationsEstimate: 0,
        sampleNames: [],
        rawMembers: [],
      };
    }
    const gens = new Set<number>();
    const names: string[] = [];
    const typedRaw = raw as Array<Record<string, unknown>>;
    for (const p of typedRaw) {
      if (typeof p.generation === 'number') gens.add(p.generation);
      if (typeof p.generationLevel === 'number') gens.add(p.generationLevel);
      const n = String(p.name || p.firstName || '').trim();
      if (n && names.length < 6) names.push(n);
    }
    return {
      totalMembers: typedRaw.length,
      generationsEstimate: Math.max(1, gens.size),
      sampleNames: names,
      rawMembers: typedRaw,
    };
  } catch {
    return {
      totalMembers: 0,
      generationsEstimate: 0,
      sampleNames: [],
      rawMembers: [],
    };
  }
}

// =============================================================================
// 2. RESEARCH APPROVAL DRAFTS (RESEARCHER -> MANAGER APPROVAL INBOX)
// =============================================================================

export async function fetchAllResearchApprovalDrafts(): Promise<
  ResearchApprovalDraftRecord[]
> {
  const targetDb = resolveStaffTargetDb();
  const localDrafts = readLocalJson<ResearchApprovalDraftRecord[]>(
    LOCAL_DRAFTS_KEY,
    []
  );
  try {
    const snap = await fastTimeout(
      getDocs(collection(targetDb, 'research_approval_drafts')),
      4000
    );
    const cloud = snap.docs.map(
      (d) => d.data() as ResearchApprovalDraftRecord
    );
    const merged = new Map<string, ResearchApprovalDraftRecord>();
    for (const d of localDrafts) merged.set(d.id, d);
    for (const d of cloud) merged.set(d.id, d);
    const sorted = Array.from(merged.values()).sort((a, b) =>
      (b.submittedAt || '').localeCompare(a.submittedAt || '')
    );
    writeLocalJson(LOCAL_DRAFTS_KEY, sorted);
    return sorted;
  } catch {
    return localDrafts.sort((a, b) =>
      (b.submittedAt || '').localeCompare(a.submittedAt || '')
    );
  }
}

async function persistDraftRecord(
  draft: ResearchApprovalDraftRecord
): Promise<ResearchApprovalDraftRecord> {
  const clean = cleanUndefined(draft);
  const existingLocal = readLocalJson<ResearchApprovalDraftRecord[]>(
    LOCAL_DRAFTS_KEY,
    []
  );
  const nextLocal = [
    clean,
    ...existingLocal.filter((d) => d.id !== clean.id),
  ];
  writeLocalJson(LOCAL_DRAFTS_KEY, nextLocal);

  const targetDb = resolveStaffTargetDb();
  try {
    await fastTimeout(
      setDoc(
        doc(targetDb, 'research_approval_drafts', clean.id),
        clean as unknown as Record<string, unknown>
      ),
      3500
    );
    if (mirrorAuth.currentUser && isRuntimeStaffSession(mirrorAuth)) {
      setDoc(
        doc(mirrorDb, 'research_approval_drafts', clean.id),
        clean as unknown as Record<string, unknown>
      ).catch(() => {});
    }
  } catch {
    // Local cache preserves draft safely if offline/rule-pending
  }
  return clean;
}

// =============================================================================
// 3. APPLY / SUBMIT 4-STATE LINEAGE CONNECTION DECISION
// =============================================================================

function buildVerifiedAncestorsFromText(
  familyName: string,
  rootBranch: string,
  motherTribe: string,
  chainText?: string
): UpperAncestorNode[] {
  const cleanLines = (chainText || '')
    .split(/[\n←→>،,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const nodes: UpperAncestorNode[] = [];
  let order = 1;

  if (cleanLines.length > 0) {
    cleanLines.forEach((name, idx) => {
      nodes.push({
        id: `verified_node_${order}_${idx}`,
        orderNumber: order++,
        name,
        rankLabel:
          idx === 0
            ? 'حلقة ربط مرجعية موثقة'
            : idx === cleanLines.length - 1
            ? 'الجذر القبلي المعتمد'
            : 'جد مرجعي موثق',
        isCodedStation: idx === 0 || idx === cleanLines.length - 1,
        dataLakeSource: 'adam_tree',
        representation: idx === cleanLines.length - 1 ? 'TRIBE' : 'INDIVIDUAL',
        relation_type: 'DIRECT_DESCENDANT',
        relation_nature: 'DIRECT',
        gender: 'M',
      });
    });
  } else {
    if (rootBranch.trim()) {
      nodes.push({
        id: `verified_root_branch_${Date.now()}`,
        orderNumber: order++,
        name: rootBranch.trim(),
        rankLabel: 'الفرع / البطن الموثق',
        isCodedStation: true,
        dataLakeSource: 'adam_tree',
        representation: 'FAMILY',
        relation_type: 'DIRECT_DESCENDANT',
        relation_nature: 'DIRECT',
        gender: 'M',
      });
    }
    if (motherTribe.trim() && motherTribe.trim() !== rootBranch.trim()) {
      nodes.push({
        id: `verified_mother_tribe_${Date.now()}`,
        orderNumber: order++,
        name: motherTribe.trim(),
        rankLabel: 'القبيلة الأم المعتمدة',
        isCodedStation: true,
        dataLakeSource: 'adam_tree',
        representation: 'TRIBE',
        relation_type: 'DESCENDED_FROM',
        relation_nature: 'DIRECT',
        gender: 'M',
      });
    }
  }

  if (nodes.length === 0) {
    nodes.push({
      id: `verified_family_root_${Date.now()}`,
      orderNumber: 1,
      name: rootBranch.trim() || motherTribe.trim() || familyName,
      rankLabel: 'الجذر المرجعي المعتمد',
      isCodedStation: true,
      dataLakeSource: 'adam_tree',
      representation: 'TRIBE',
      relation_type: 'DIRECT_DESCENDANT',
      relation_nature: 'DIRECT',
      gender: 'M',
    });
  }

  return nodes;
}

export async function applyApprovedLineageDecisionToCustomer(params: {
  targetUser: UserProfileData;
  ticket?: ResearchTicketData | null;
  decision: LineageConnectionDecisionStatus;
  verifiedRootBranch: string;
  verifiedMotherTribe: string;
  intermediateChainText: string;
  verifiedSourcesText: string;
  scholarlyNotes: string;
  clientQuestionText?: string;
  approvedByManagerName: string;
}): Promise<{ ok: boolean; updatedTicket?: ResearchTicketData }> {
  const targetDb = resolveStaffTargetDb();
  const nowIso = new Date().toISOString();
  const familyName =
    params.targetUser.familyName ||
    params.ticket?.familyName ||
    params.targetUser.fullName ||
    'العائلة';

  const statusNote =
    params.decision === 'verified_connected'
      ? `تم إثبات واعتماد ربط عائلة (${familyName}) بـ (${params.verifiedRootBranch || params.verifiedMotherTribe}) بواسطة مدير البحوث (${params.approvedByManagerName}).`
      : params.decision === 'partial_investigating'
      ? params.scholarlyNotes ||
        'توجد مؤشرات مرجعية واعدة وجارٍ استكمال التحقيق المعمق في أمهات الكتب والمخطوطات.'
      : params.decision === 'needs_client_info'
      ? params.clientQuestionText ||
        params.scholarlyNotes ||
        'يرجى تزويد فريق البحوث بإيضاح إضافي حول الموطن أو الجد الخامس أو أي وثيقة عائلية.'
      : params.scholarlyNotes ||
        'تعذّر إثبات الربط المرجعي حالياً لعدم كفاية المصادر الموثقة، وتم حفظ الملف في الرصد المستمر لإشعاركم تلقائياً عند توفر مخطوطات جديدة.';

  // 1. Update User Profile in Firestore (so LineageSpineColumn immediately reflects the approved decision!)
  const userPatch: Record<string, unknown> = {
    lineageResearchStatus: params.decision,
    lineageResearchStatusNote: statusNote.slice(0, 1200),
    updatedAt: nowIso,
  };

  if (params.decision === 'verified_connected') {
    const verifiedNodes = buildVerifiedAncestorsFromText(
      familyName,
      params.verifiedRootBranch,
      params.verifiedMotherTribe,
      params.intermediateChainText
    );
    const verifiedResult: LineageSearchResult = {
      matched: true,
      engineSource: 'neo4j_verified_graph',
      primary_source_of_truth: 'ADAM_MASTER_TREE',
      priorityTierMatched: 'TIER_1_ADAM_MASTER_TREE',
      clientName: params.targetUser.firstName || params.targetUser.fullName,
      fatherName: params.targetUser.fatherName || '',
      grandfatherName: params.targetUser.grandfatherName || '',
      familyName,
      familyCode: params.targetUser.verifiedLineageSnapshot?.familyCode || 'VERIFIED-RM',
      originCountry: params.targetUser.originCountry || 'السعودية',
      originRegion: params.targetUser.originRegion || '',
      rootBranchName:
        params.verifiedRootBranch.trim() || params.verifiedMotherTribe.trim(),
      rootBranchCode: 'RM-VERIFIED',
      rootTribeName:
        params.verifiedMotherTribe.trim() || params.verifiedRootBranch.trim(),
      rootTribeCode: 'RM-TRIBE',
      rootSummaryLabel: `${params.verifiedRootBranch || params.verifiedMotherTribe}${
        params.verifiedMotherTribe &&
        params.verifiedRootBranch &&
        params.verifiedMotherTribe !== params.verifiedRootBranch
          ? ` — ${params.verifiedMotherTribe}`
          : ''
      }`,
      upperAncestors: verifiedNodes,
      adamSpineNodes: verifiedNodes,
      capsules: [],
      requiresBlindDisambiguation: false,
      disambiguationOptions: [],
      verifiedSourceCitation:
        params.verifiedSourcesText.trim() ||
        `معتمد وموثق من هيئة بحوث جذوري (${params.approvedByManagerName})`,
      verified_sources: params.verifiedSourcesText
        .split(/[\n؛;]+/)
        .map((s) => s.trim())
        .filter(Boolean),
      secondarySources: [],
      historicalRegion:
        params.targetUser.originRegion ||
        params.targetUser.originCountry ||
        'العالم العربي',
      conflictingNarrativesNote: params.scholarlyNotes || '',
      confidenceLabel: 'ربط مرجعي معتمد من مدير البحوث ✓',
      recommendedInitialState: DashboardStateMode.State1Paid5Basic,
    };

    const nextSnap = buildVerifiedLineageSnapshot(verifiedResult);
    userPatch.verifiedLineageSnapshot = nextSnap;
    userPatch.lineageSnapshot = nextSnap;
    userPatch.isRootUnlocked = true;
  }

  try {
    await fastTimeout(
      updateDoc(doc(targetDb, 'users', params.targetUser.userId), userPatch),
      4000
    );
  } catch (err) {
    try {
      handleFirestoreError(
        err,
        OperationType.UPDATE,
        `users/${params.targetUser.userId}`
      );
    } catch {
      // Logged cleanly
    }
  }

  // 2. Update related Research Ticket if provided
  let updatedTicket: ResearchTicketData | undefined;
  if (params.ticket) {
    const mappedTicketStatus: ResearchTicketData['status'] =
      params.decision === 'verified_connected'
        ? 'RESOLVED'
        : params.decision === 'partial_investigating'
        ? 'IN_REVIEW'
        : params.decision === 'needs_client_info'
        ? 'NEEDS_INFO'
        : 'no_records_found';

    const mappedStage: ResearchTicketData['lifecycleStage'] =
      params.decision === 'verified_connected'
        ? 'RESOLVED'
        : params.decision === 'partial_investigating'
        ? 'IN_REVIEW'
        : params.decision === 'needs_client_info'
        ? 'NEEDS_INFO'
        : 'CLOSED';

    const nextMessages = [...(params.ticket.messages || [])];
    nextMessages.push({
      id: `msg_rm_${Date.now()}`,
      ticketId: params.ticket.id,
      senderRole: 'researcher',
      senderId: 'research_manager',
      senderName: `${params.approvedByManagerName} (مدير البحوث)`,
      body:
        params.decision === 'needs_client_info'
          ? `استفسار بحثي: ${params.clientQuestionText || statusNote}`
          : statusNote,
      createdAt: nowIso,
    });

    updatedTicket = {
      ...params.ticket,
      status: mappedTicketStatus,
      lifecycleStage: mappedStage,
      researchFindings: statusNote,
      verifiedSources:
        params.verifiedSourcesText || params.ticket.verifiedSources,
      messages: nextMessages,
      resolutionPayload:
        params.decision === 'verified_connected'
          ? {
              decisionTitle: `اعتماد ربط الجذر المرجعي لعائلة ${familyName}`,
              verifiedRootBranch: params.verifiedRootBranch,
              verifiedRootTribe: params.verifiedMotherTribe,
              verifiedCitation: params.verifiedSourcesText,
              certifiedAncestorName:
                params.verifiedRootBranch || params.verifiedMotherTribe,
              certifiedAncestorRank: 'الجذر المرجعي المعتمد',
              summaryNotes: params.scholarlyNotes || statusNote,
            }
          : params.ticket.resolutionPayload,
      clientNotified: true,
      resolvedAt:
        params.decision === 'verified_connected' ||
        params.decision === 'insufficient_sources'
          ? nowIso
          : params.ticket.resolvedAt,
      updatedAt: nowIso,
    };

    await updateResearchTicketFullInFirebase(
      updatedTicket.id,
      updatedTicket
    ).catch(() => {});
  }

  // 3. Send Official Customer Notification
  const notifTitle =
    params.decision === 'verified_connected'
      ? `✦ بشارة نسبية: تم إثبات ربط الجذر المرجعي لعائلة ${familyName}`
      : params.decision === 'partial_investigating'
      ? `تحديث بحثي: تقاطع أولي قيد الاستقصاء المعمق لعائلة ${familyName}`
      : params.decision === 'needs_client_info'
      ? `استفسار من هيئة البحوث لإكمال تدقيق نسب عائلة ${familyName}`
      : `تحديث مرصد البحوث حول طلب عائلة ${familyName} (محفوظ بالرصد المستمر)`;

  await sendCustomerNotification({
    userId: params.targetUser.userId,
    recipientEmail: params.targetUser.email,
    recipientName: params.targetUser.fullName,
    familyName,
    senderName: `${params.approvedByManagerName} · مدير البحوث`,
    title: notifTitle,
    body: statusNote,
    category: 'ticket_update',
    senderRole: 'researcher',
    ticketNumber: params.ticket?.ticketNumber,
  }).catch(() => {});

  return { ok: true, updatedTicket };
}

export async function submitOrApproveLineageDecision(params: {
  actorRole: StaffRbacRole;
  actorId: string;
  actorName: string;
  targetUser: UserProfileData;
  ticket?: ResearchTicketData | null;
  decision: LineageConnectionDecisionStatus;
  verifiedRootBranch: string;
  verifiedMotherTribe: string;
  intermediateChainText: string;
  verifiedSourcesText: string;
  scholarlyNotes: string;
  clientQuestionText?: string;
}): Promise<{
  mode: 'published' | 'submitted_for_approval';
  draft?: ResearchApprovalDraftRecord;
  updatedTicket?: ResearchTicketData;
}> {
  const nowIso = new Date().toISOString();
  const targetPlanTier = normalizeSubscriptionPlanId(
    params.targetUser.subscriptionTier
  );
  const familyName =
    params.targetUser.familyName ||
    params.ticket?.familyName ||
    params.targetUser.fullName;

  if (params.actorRole === 'researcher') {
    // STRICT RBAC: Researchers CANNOT publish directly to customers!
    const draft: ResearchApprovalDraftRecord = {
      id: `draft_lin_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      draftKind: 'lineage_connection',
      status: 'pending_manager_approval',
      targetUserId: params.targetUser.userId,
      targetUserEmail: params.targetUser.email,
      targetClientName: params.targetUser.fullName,
      targetFamilyName: familyName,
      targetPlanTier,
      relatedTicketId: params.ticket?.id,
      submittedByResearcherId: params.actorId,
      submittedByResearcherName: params.actorName,
      submittedAt: nowIso,
      lineageDecision: params.decision,
      verifiedRootBranch: params.verifiedRootBranch,
      verifiedMotherTribe: params.verifiedMotherTribe,
      intermediateChainText: params.intermediateChainText,
      verifiedSourcesText: params.verifiedSourcesText,
      scholarlyNotes: params.scholarlyNotes,
      clientQuestionText: params.clientQuestionText,
    };
    await persistDraftRecord(draft);
    return { mode: 'submitted_for_approval', draft };
  }

  // Manager or Super Admin approves & publishes directly
  const applied = await applyApprovedLineageDecisionToCustomer({
    targetUser: params.targetUser,
    ticket: params.ticket,
    decision: params.decision,
    verifiedRootBranch: params.verifiedRootBranch,
    verifiedMotherTribe: params.verifiedMotherTribe,
    intermediateChainText: params.intermediateChainText,
    verifiedSourcesText: params.verifiedSourcesText,
    scholarlyNotes: params.scholarlyNotes,
    clientQuestionText: params.clientQuestionText,
    approvedByManagerName: params.actorName,
  });

  return { mode: 'published', updatedTicket: applied.updatedTicket };
}

// =============================================================================
// 4. KASHAFI 4-CATEGORY DISCOVERY PUBLISHER (PREMIUM EXCLUSIVE)
// =============================================================================

export async function publishApprovedKashafiDiscovery(params: {
  targetUser: UserProfileData;
  category: KashafiDiscoveryCategory;
  title: string;
  summary: string;
  details: string;
  bookTitle?: string;
  bookAuthor?: string;
  centuryOrYear?: string;
  pageReference?: string;
  excerptQuote?: string;
  documentImageUrl?: string;
  deliverableUrl?: string;
  approvedByManagerName: string;
}): Promise<KashafiItemRecord | null> {
  const familyName = params.targetUser.familyName || params.targetUser.fullName;
  const citationParts = [
    params.bookTitle?.trim(),
    params.bookAuthor?.trim() ? `تأليف: ${params.bookAuthor.trim()}` : '',
    params.centuryOrYear?.trim() ? `(${params.centuryOrYear.trim()})` : '',
    params.pageReference?.trim() ? `ص/ج: ${params.pageReference.trim()}` : '',
  ].filter(Boolean);

  const item = await createKashafiItem({
    targetUserId: params.targetUser.userId,
    targetUserEmail: params.targetUser.email,
    targetFamilyName: familyName,
    type:
      params.category === 'sources' || params.category === 'ongoing'
        ? 'lineage_discovery'
        : params.category === 'documents'
        ? 'service_deliverable'
        : 'researcher_note',
    discoveryCategory: params.category,
    title: params.title,
    summary: params.summary,
    details: params.details,
    sourceCitation: citationParts.join(' · ') || undefined,
    bookAuthor: params.bookAuthor,
    centuryOrYear: params.centuryOrYear,
    pageReference: params.pageReference,
    excerptQuote: params.excerptQuote,
    documentImageUrl: params.documentImageUrl,
    deliverableUrl: params.deliverableUrl,
    authorName: params.approvedByManagerName,
    authorRole: 'مدير البحوث — معتمد',
    approvalStatus: 'approved',
    approvedByName: params.approvedByManagerName,
    approvedAt: new Date().toISOString(),
  });

  // Instant Premium Notification
  await sendCustomerNotification({
    userId: params.targetUser.userId,
    recipientEmail: params.targetUser.email,
    recipientName: params.targetUser.fullName,
    familyName,
    senderName: `${params.approvedByManagerName} · مدير البحوث`,
    title: '✦ اكتشاف تاريخي جديد أُضيف إلى كشّافي الخاص بعائلتك',
    body: `تم اعتماد ونشر مادة جديدة ضمن «${getKashafiDiscoveryCategoryLabelAr(
      params.category
    )}»: ${params.title}`,
    category: 'feature_announcement',
    senderRole: 'researcher',
  }).catch(() => {});

  return item;
}

export async function submitOrPublishKashafiDiscovery(params: {
  actorRole: StaffRbacRole;
  actorId: string;
  actorName: string;
  targetUser: UserProfileData;
  category: KashafiDiscoveryCategory;
  title: string;
  summary: string;
  details: string;
  bookTitle?: string;
  bookAuthor?: string;
  centuryOrYear?: string;
  pageReference?: string;
  excerptQuote?: string;
  documentImageUrl?: string;
  deliverableUrl?: string;
}): Promise<{
  mode: 'published' | 'submitted_for_approval';
  draft?: ResearchApprovalDraftRecord;
  publishedItem?: KashafiItemRecord | null;
}> {
  const nowIso = new Date().toISOString();
  const familyName = params.targetUser.familyName || params.targetUser.fullName;

  if (params.actorRole === 'researcher') {
    const draft: ResearchApprovalDraftRecord = {
      id: `draft_ksh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      draftKind: 'kashafi_discovery',
      status: 'pending_manager_approval',
      targetUserId: params.targetUser.userId,
      targetUserEmail: params.targetUser.email,
      targetClientName: params.targetUser.fullName,
      targetFamilyName: familyName,
      targetPlanTier: normalizeSubscriptionPlanId(
        params.targetUser.subscriptionTier
      ),
      submittedByResearcherId: params.actorId,
      submittedByResearcherName: params.actorName,
      submittedAt: nowIso,
      kashafiCategory: params.category,
      kashafiTitle: params.title,
      kashafiSummary: params.summary,
      kashafiDetails: params.details,
      kashafiBookTitle: params.bookTitle,
      kashafiBookAuthor: params.bookAuthor,
      kashafiCenturyOrYear: params.centuryOrYear,
      kashafiPageReference: params.pageReference,
      kashafiExcerptQuote: params.excerptQuote,
      kashafiDocumentImageUrl: params.documentImageUrl,
      kashafiDeliverableUrl: params.deliverableUrl,
    };
    await persistDraftRecord(draft);
    return { mode: 'submitted_for_approval', draft };
  }

  const publishedItem = await publishApprovedKashafiDiscovery({
    targetUser: params.targetUser,
    category: params.category,
    title: params.title,
    summary: params.summary,
    details: params.details,
    bookTitle: params.bookTitle,
    bookAuthor: params.bookAuthor,
    centuryOrYear: params.centuryOrYear,
    pageReference: params.pageReference,
    excerptQuote: params.excerptQuote,
    documentImageUrl: params.documentImageUrl,
    deliverableUrl: params.deliverableUrl,
    approvedByManagerName: params.actorName,
  });

  return { mode: 'published', publishedItem };
}

// =============================================================================
// 5. MANAGER APPROVAL INBOX ACTIONS (APPROVE / RETURN WITH SCHOLARLY NOTES)
// =============================================================================

export async function approveResearchDraftByManager(params: {
  draft: ResearchApprovalDraftRecord;
  managerId: string;
  managerName: string;
  targetUser: UserProfileData;
  relatedTicket?: ResearchTicketData | null;
}): Promise<ResearchApprovalDraftRecord> {
  const nowIso = new Date().toISOString();

  if (params.draft.draftKind === 'lineage_connection') {
    await applyApprovedLineageDecisionToCustomer({
      targetUser: params.targetUser,
      ticket: params.relatedTicket,
      decision: params.draft.lineageDecision || 'verified_connected',
      verifiedRootBranch: params.draft.verifiedRootBranch || '',
      verifiedMotherTribe: params.draft.verifiedMotherTribe || '',
      intermediateChainText: params.draft.intermediateChainText || '',
      verifiedSourcesText: params.draft.verifiedSourcesText || '',
      scholarlyNotes: params.draft.scholarlyNotes || '',
      clientQuestionText: params.draft.clientQuestionText,
      approvedByManagerName: params.managerName,
    });
  } else {
    await publishApprovedKashafiDiscovery({
      targetUser: params.targetUser,
      category: params.draft.kashafiCategory || 'sources',
      title: params.draft.kashafiTitle || 'اكتشاف تاريخي معتمد',
      summary: params.draft.kashafiSummary || '',
      details: params.draft.kashafiDetails || '',
      bookTitle: params.draft.kashafiBookTitle,
      bookAuthor: params.draft.kashafiBookAuthor,
      centuryOrYear: params.draft.kashafiCenturyOrYear,
      pageReference: params.draft.kashafiPageReference,
      excerptQuote: params.draft.kashafiExcerptQuote,
      documentImageUrl: params.draft.kashafiDocumentImageUrl,
      deliverableUrl: params.draft.kashafiDeliverableUrl,
      approvedByManagerName: params.managerName,
    });
  }

  const updatedDraft: ResearchApprovalDraftRecord = {
    ...params.draft,
    status: 'approved',
    reviewedByManagerId: params.managerId,
    reviewedByManagerName: params.managerName,
    reviewedAt: nowIso,
  };
  return persistDraftRecord(updatedDraft);
}

export async function returnResearchDraftToResearcher(params: {
  draft: ResearchApprovalDraftRecord;
  managerId: string;
  managerName: string;
  managerReviewNotes: string;
}): Promise<ResearchApprovalDraftRecord> {
  const updatedDraft: ResearchApprovalDraftRecord = {
    ...params.draft,
    status: 'returned',
    reviewedByManagerId: params.managerId,
    reviewedByManagerName: params.managerName,
    reviewedAt: new Date().toISOString(),
    managerReviewNotes: params.managerReviewNotes.trim().slice(0, 2000),
  };
  return persistDraftRecord(updatedDraft);
}

// =============================================================================
// 6. FREE LEAD RADAR ACTIVATION (CONVERSION TRIGGER WITHOUT ROOT SPOILERS)
// =============================================================================

export async function toggleFreeLeadRadarSignalForUser(params: {
  targetUser: UserProfileData;
  activate: boolean;
  managerName: string;
  matchStrengthLabel?: string;
  teaserNoteAr?: string;
  matchedRootPreviewInternal?: string;
}): Promise<FreeLeadRadarSignal> {
  const targetDb = resolveStaffTargetDb();
  const nowIso = new Date().toISOString();
  const familyName = params.targetUser.familyName || params.targetUser.fullName;

  const signal: FreeLeadRadarSignal = {
    active: params.activate,
    activatedAt: nowIso,
    activatedByName: params.managerName,
    matchStrengthLabel:
      params.matchStrengthLabel || 'إشارة مرجعية واعدة في فهرس الأنساب',
    teaserNoteAr:
      params.teaserNoteAr ||
      `رصد مرصد جذوري تقاطعاً مرجعياً واعداً يرتبط ببيانات عائلة (${familyName}) — رقِّ إلى الباقة الأساسية (Basic) أو المميزة (Premium) لفتح البحث الموثق عن الجذر التاريخي.`,
    matchedRootPreviewInternal: params.matchedRootPreviewInternal,
    convertedToTier: params.targetUser.freeLeadRadarSignal?.convertedToTier || null,
    convertedAt: params.targetUser.freeLeadRadarSignal?.convertedAt,
  };

  try {
    await fastTimeout(
      updateDoc(doc(targetDb, 'users', params.targetUser.userId), {
        freeLeadRadarSignal: cleanUndefined(signal),
        updatedAt: nowIso,
      }),
      4000
    );
  } catch (err) {
    try {
      handleFirestoreError(
        err,
        OperationType.UPDATE,
        `users/${params.targetUser.userId}`
      );
    } catch {
      // Logged cleanly
    }
  }

  if (params.activate) {
    await sendCustomerNotification({
      userId: params.targetUser.userId,
      recipientEmail: params.targetUser.email,
      recipientName: params.targetUser.fullName,
      familyName,
      senderName: 'رادار جذوري المرجعي',
      title: `✦ إشارة رصد جديدة مرتبطة ببيانات عائلة ${familyName}`,
      body: `رصد رادار جذوري مؤشراً مرجعياً مهماً يرتبط بعائلتكم. يمكنك الآن الترقية إلى باقة Basic أو Premium لفتح التحقيق النسبي واستعراض الجذر التاريخي.`,
      category: 'feature_announcement',
      senderRole: 'system',
    }).catch(() => {});
  }

  return signal;
}

// =============================================================================
// 7. MASTER ROOTS & REFERENCE LIBRARY CRUD
// =============================================================================

export async function fetchMasterLineageCatalog(): Promise<
  MasterLineageCatalogEntry[]
> {
  const targetDb = resolveStaffTargetDb();
  const localItems = readLocalJson<MasterLineageCatalogEntry[]>(
    LOCAL_MASTER_CATALOG_KEY,
    DEFAULT_MASTER_LINEAGE_CATALOG
  );
  try {
    const snap = await fastTimeout(
      getDocs(collection(targetDb, 'master_lineage_catalog')),
      4000
    );
    const cloud = snap.docs.map(
      (d) => d.data() as MasterLineageCatalogEntry
    );
    const merged = new Map<string, MasterLineageCatalogEntry>();
    for (const def of DEFAULT_MASTER_LINEAGE_CATALOG) merged.set(def.id, def);
    for (const loc of localItems) merged.set(loc.id, loc);
    for (const item of cloud) merged.set(item.id, item);
    const sorted = Array.from(merged.values()).sort((a, b) =>
      (b.updatedAt || '').localeCompare(a.updatedAt || '')
    );
    writeLocalJson(LOCAL_MASTER_CATALOG_KEY, sorted);
    return sorted;
  } catch {
    return localItems;
  }
}

export async function saveMasterLineageCatalogEntry(
  entry: Omit<MasterLineageCatalogEntry, 'id' | 'createdAt' | 'updatedAt'> & {
    id?: string;
    createdAt?: string;
  }
): Promise<MasterLineageCatalogEntry> {
  const nowIso = new Date().toISOString();
  const record: MasterLineageCatalogEntry = cleanUndefined({
    ...entry,
    id:
      entry.id ||
      `cat_${entry.entryKind === 'reference_book' ? 'book' : 'root'}_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 5)}`,
    createdAt: entry.createdAt || nowIso,
    updatedAt: nowIso,
  });

  const existing = readLocalJson<MasterLineageCatalogEntry[]>(
    LOCAL_MASTER_CATALOG_KEY,
    DEFAULT_MASTER_LINEAGE_CATALOG
  );
  writeLocalJson(LOCAL_MASTER_CATALOG_KEY, [
    record,
    ...existing.filter((x) => x.id !== record.id),
  ]);

  const targetDb = resolveStaffTargetDb();
  try {
    await fastTimeout(
      setDoc(
        doc(targetDb, 'master_lineage_catalog', record.id),
        record as unknown as Record<string, unknown>
      ),
      3500
    );
  } catch {
    // Kept in local cache safely
  }
  return record;
}

export async function deleteMasterLineageCatalogEntry(
  entryId: string
): Promise<void> {
  const existing = readLocalJson<MasterLineageCatalogEntry[]>(
    LOCAL_MASTER_CATALOG_KEY,
    DEFAULT_MASTER_LINEAGE_CATALOG
  );
  writeLocalJson(
    LOCAL_MASTER_CATALOG_KEY,
    existing.filter((x) => x.id !== entryId)
  );
  const targetDb = resolveStaffTargetDb();
  try {
    await fastTimeout(
      deleteDoc(doc(targetDb, 'master_lineage_catalog', entryId)),
      3500
    );
  } catch {
    // Non-fatal
  }
}

// =============================================================================
// 8. TEAM RESEARCHER SPECIALTY UPDATE
// =============================================================================

export async function updateResearcherSpecialtyInFirebase(
  member: TeamMemberRecord,
  specialtyRegion: string,
  specialtyTribes: string
): Promise<TeamMemberRecord> {
  const updated: TeamMemberRecord = {
    ...member,
    specialtyRegion: specialtyRegion.trim().slice(0, 140),
    specialtyTribes: specialtyTribes.trim().slice(0, 200),
  };
  const targetDb = resolveStaffTargetDb();
  try {
    await fastTimeout(
      updateDoc(doc(targetDb, 'team_members', member.id), {
        specialtyRegion: updated.specialtyRegion,
        specialtyTribes: updated.specialtyTribes,
      }),
      3500
    );
  } catch {
    // Non-fatal fallback
  }
  return updated;
}

export async function assignResearchTicketToSpecialist(params: {
  ticket: ResearchTicketData;
  researcherId: string;
  researcherName: string;
  targetDueDate?: string;
}): Promise<ResearchTicketData> {
  const nowIso = new Date().toISOString();
  const updated: ResearchTicketData = {
    ...params.ticket,
    assignedResearcherId: params.researcherId,
    assignedResearcherName: params.researcherName,
    priorityTag: params.targetDueDate
      ? `SLA:${params.targetDueDate}`
      : params.ticket.priorityTag,
    status:
      params.ticket.status === 'OPEN' ||
      params.ticket.status === 'pending_review'
        ? 'IN_REVIEW'
        : params.ticket.status,
    lifecycleStage: 'IN_REVIEW',
    updatedAt: nowIso,
  };
  await updateResearchTicketFullInFirebase(updated.id, updated).catch(() => {});
  return updated;
}
