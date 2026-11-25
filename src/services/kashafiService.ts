import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  auth,
  staffAuth,
  db,
  staffDb,
  mirrorDb,
  mirrorAuth,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  canonicalCustomerEmailUid,
  isRuntimeStaffSession,
  sendCustomerNotification,
} from './firestoreService';
import { DashboardTab } from '../types/juthori';

// =============================================================================
// TYPES — REAL FIRESTORE MODELS FOR KASHAFI (ZERO CLIENT MOCKUPS)
// =============================================================================

export type KashafiItemType =
  | 'ticket_update'
  | 'lineage_discovery'
  | 'service_deliverable'
  | 'researcher_note';

export interface KashafiItemRecord {
  id: string;
  targetUserId: string;
  targetUserEmail?: string;
  targetFamilyName: string;
  type: KashafiItemType;
  title: string;
  summary: string;
  details?: string;
  sourceCitation?: string;
  deliverableUrl?: string;
  relatedTicketId?: string;
  relatedOrderId?: string;
  authorName: string;
  authorRole?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export type KashafiCampaignCategory =
  | 'research_service'
  | 'digital_feature'
  | 'platform_announcement';

export type KashafiTargetSegment =
  | 'all'
  | 'specific_family'
  | 'vault_owners'
  | 'active_trees'
  | 'premium_members';

export type KashafiExecutionMode = 'instant_tech' | 'research_execution';

export interface KashafiCampaignRecord {
  id: string;
  blueprintId?: string;
  title: string;
  description: string;
  category: KashafiCampaignCategory;
  priceUsd: number;
  freeForPremium: boolean;
  targetSegment: KashafiTargetSegment;
  targetFamilyName?: string;
  executionMode: KashafiExecutionMode;
  targetTab?: DashboardTab | 'wallet';
  ctaLabel?: string;
  assignedRole: 'research_manager';
  assignedResearcherId?: string;
  assignedResearcherName?: string;
  status: 'active' | 'paused';
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export type KashafiServiceOrderStatus =
  | 'NEW'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export interface KashafiServiceOrderRecord {
  id: string;
  orderNumber: string;
  campaignId: string;
  campaignTitle: string;
  campaignCategory: KashafiCampaignCategory;
  userId: string;
  userEmail?: string;
  userFullName: string;
  familyName: string;
  originCountry?: string;
  originRegion?: string;
  pricePaidUsd: number;
  includedInPremium?: boolean;
  walletTransactionId?: string;
  customerNotes?: string;
  status: KashafiServiceOrderStatus;
  assignedRole: 'research_manager';
  assignedResearcherId?: string;
  assignedResearcherName?: string;
  researcherReport?: string;
  deliverableUrl?: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// ADMIN-ONLY BLUEPRINT CATALOG (STRICTLY FOR /team ADMIN STUDIO ONLY!)
// NEVER IMPORT THIS ARRAY IN CLIENT HOME OR KASHAFI COMPONENTS.
// =============================================================================
export interface KashafiAdminBlueprint {
  id: string;
  title: string;
  description: string;
  category: KashafiCampaignCategory;
  defaultPriceUsd: number;
  defaultFreeForPremium: boolean;
  defaultSegment: KashafiTargetSegment;
  executionMode: KashafiExecutionMode;
  defaultTargetTab?: DashboardTab | 'wallet';
  defaultCtaLabel: string;
  eligibilityHintAr: string;
}

export const KASHAFI_ADMIN_BLUEPRINTS: KashafiAdminBlueprint[] = [
  {
    id: 'bp_ottoman_sharia_doc',
    title: 'تفريغ وتحقيق وثيقة تاريخية / عثمانية أو صك شرعي',
    description:
      'قراءة علمية وتفريغ نصي موثق للمخطوطات العثمانية والصكوك الشرعية المرفوعة في خزانتكم مع استخراج أسماء الأجداد والأختام والشهادات.',
    category: 'research_service',
    defaultPriceUsd: 35,
    defaultFreeForPremium: false,
    defaultSegment: 'vault_owners',
    executionMode: 'research_execution',
    defaultCtaLabel: 'طلب تحقيق الوثيقة الآن',
    eligibilityHintAr: 'العائلات التي رفعت وثائق أو صور مخطوطات في خزانتها',
  },
  {
    id: 'bp_missing_intermediate_ancestors',
    title: 'البحث عن الأجداد الوسيطين المفقودين وتكملة عمود النسب',
    description:
      'بعثة بحث أرشيفي مخصصة لتقصي الحلقات المفقودة بين الجد المعاصر والجد المرجعي في كتب الأنساب والوثائق الإقليمية المعتمدة.',
    category: 'research_service',
    defaultPriceUsd: 45,
    defaultFreeForPremium: false,
    defaultSegment: 'all',
    executionMode: 'research_execution',
    defaultCtaLabel: 'توجيه بعثة التحقيق',
    eligibilityHintAr: 'جميع الأعضاء الراغبين في استكمال حلقات عمود النسب',
  },
  {
    id: 'bp_stamped_wall_poster_deed',
    title: 'تصميم وإصدار وثيقة مشجرة جدارية فاخرة مختومة بختم جذوري',
    description:
      'إعداد ملف طباعة جداري عالي الدقة (A1/A0) لمشجرة عائلتكم بعد المراجعة اللغوية والتنسيق الخطي والختم التوثيقي الرسمي.',
    category: 'research_service',
    defaultPriceUsd: 29,
    defaultFreeForPremium: false,
    defaultSegment: 'active_trees',
    executionMode: 'research_execution',
    defaultCtaLabel: 'طلب إصدار المشجرة الجدارية',
    eligibilityHintAr: 'المشجرات النشطة التي تضم أفراداً مسجلين فعلياً',
  },
  {
    id: 'bp_waqf_manuscripts_study',
    title: 'تحقيق أوقاف وأملاك ومخطوطات تاريخية للعائلة',
    description:
      'مسح أرشيفي معمّق لسجلات الأوقاف والمحاكم الشرعية والدفاتر التاريخية لرصد ذكر عائلة العميل وممتلكاتها الموروثة.',
    category: 'research_service',
    defaultPriceUsd: 55,
    defaultFreeForPremium: false,
    defaultSegment: 'vault_owners',
    executionMode: 'research_execution',
    defaultCtaLabel: 'طلب بعثة تحقيق الأوقاف',
    eligibilityHintAr: 'أصحاب الخزائن الوثائقية والباحثون عن إرث الأوقاف',
  },
  {
    id: 'bp_interactive_migration_atlas',
    title: 'إعداد أطلس هجرات وانتشار فروع العائلة التفاعلي',
    description:
      'توثيق تاريخي وجغرافي لمسارات تنقل الأجداد ومواطن الاستقرار التاريخية لفروع العائلة وإخراجها في تقرير أطلسي موثق.',
    category: 'research_service',
    defaultPriceUsd: 39,
    defaultFreeForPremium: false,
    defaultSegment: 'active_trees',
    executionMode: 'research_execution',
    defaultCtaLabel: 'طلب إعداد أطلس الهجرات',
    eligibilityHintAr: 'العائلات ذات المشجرات النشطة والمتفرعة جغرافياً',
  },
  {
    id: 'bp_family_notables_lexicon',
    title: 'إعداد معجم أعلام وشخصيات العائلة التاريخية',
    description:
      'حصر وتحرير تراجم موجزة وموثقة للعلماء والوجهاء والأعلام المنسوبين للعائلة في كتب التراجم والصحف والوثائق.',
    category: 'research_service',
    defaultPriceUsd: 49,
    defaultFreeForPremium: false,
    defaultSegment: 'all',
    executionMode: 'research_execution',
    defaultCtaLabel: 'طلب إعداد معجم الأعلام',
    eligibilityHintAr: 'كافة الأسر والقبائل المسجلة في المنصة',
  },
  {
    id: 'bp_chronological_tree_audit',
    title: 'تدقيق وتصحيح التسلسل الزمني والمنطقي لمشجرة العائلة',
    description:
      'مراجعة شاملة لتواريخ الميلاد والوفاة والربط الأجيالي داخل مشجرتكم من قبل مختص جينيالوجي لضمان خلوها من التضارب الزمني.',
    category: 'research_service',
    defaultPriceUsd: 25,
    defaultFreeForPremium: true,
    defaultSegment: 'active_trees',
    executionMode: 'research_execution',
    defaultCtaLabel: 'طلب تدقيق المشجرة',
    eligibilityHintAr: 'المشجرات النشطة (مشمول مجاناً للباقة السنوية)',
  },
  {
    id: 'bp_dynasty_yearbook',
    title: 'إنتاج كتاب الحولية العائلية السنوية الفاخر',
    description:
      'إخراج تحريري فاخر يجمع عمود النسب، مشجرة الفروع، مختارات الخزانة الوثائقية، وأخبار العائلة في نسخة جاهزة للطباعة والاهداء.',
    category: 'research_service',
    defaultPriceUsd: 79,
    defaultFreeForPremium: false,
    defaultSegment: 'premium_members',
    executionMode: 'research_execution',
    defaultCtaLabel: 'طلب إعداد الحولية العائلية',
    eligibilityHintAr: 'مشتركو الباقة السنوية وأمناء السجل',
  },
  {
    id: 'bp_surname_etymology_study',
    title: 'دراسة تأصيل اللقب والدلالة التاريخية لاسم العائلة',
    description:
      'بحث لغوي وتاريخي محكّم يوضح أصل التسمية أو الكنية أو اللقب العائلي وتطوره في المعاجم والمصادر البلدانية.',
    category: 'research_service',
    defaultPriceUsd: 30,
    defaultFreeForPremium: false,
    defaultSegment: 'all',
    executionMode: 'research_execution',
    defaultCtaLabel: 'طلب دراسة تأصيل اللقب',
    eligibilityHintAr: 'جميع العملاء والأسر العربية في المنصة',
  },
  {
    id: 'bp_cloud_capacity_royal_presets',
    title: 'ترقية السعة السحابية ومظاهر الطباعة الملكية لشجرتي',
    description:
      'افتح سعة إضافية لتسجيل مئات الأفراد في مشجرة العائلة واستمتع بقوالب التصدير الملكية والخطوط العربية الفاخرة.',
    category: 'digital_feature',
    defaultPriceUsd: 0,
    defaultFreeForPremium: true,
    defaultSegment: 'active_trees',
    executionMode: 'instant_tech',
    defaultTargetTab: DashboardTab.MyTree,
    defaultCtaLabel: 'فتح استوديو شجرتي',
    eligibilityHintAr: 'أصحاب المشجرات النشطة',
  },
  {
    id: 'bp_mysite_qr_activation',
    title: 'تفعيل موقع العائلة السيادي وبطاقات الدعوة بالـ QR',
    description:
      'احجز رابطاً سيادياً خاصاً بعائلتكم وشارك أقاربكم بوابة عائلية مصفاة بضوابط خصوصية دقيقة ودعوات ذكية.',
    category: 'digital_feature',
    defaultPriceUsd: 0,
    defaultFreeForPremium: true,
    defaultSegment: 'all',
    executionMode: 'instant_tech',
    defaultTargetTab: DashboardTab.MySite,
    defaultCtaLabel: 'الانتقال إلى إعدادات موقعي',
    eligibilityHintAr: 'جميع الأعضاء المؤهلين لتفعيل بوابة العائلة',
  },
  {
    id: 'bp_knowledge_seasonal_announcement',
    title: 'إصدار جديد من المركز المعرفي وحملة توثيق موسمية',
    description:
      'اطّلع على أحدث الدراسات المنهجية والمقالات التوثيقية التي أعدّها فريق التحرير لمساعدة الأسر في حفظ تاريخها.',
    category: 'platform_announcement',
    defaultPriceUsd: 0,
    defaultFreeForPremium: true,
    defaultSegment: 'all',
    executionMode: 'instant_tech',
    defaultTargetTab: DashboardTab.Lineage,
    defaultCtaLabel: 'استعراض التفاصيل',
    eligibilityHintAr: 'إعلان عام لجميع أعضاء المنصة',
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

function fastTimeout<T>(promise: Promise<T>, ms = 3500): Promise<T> {
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

function isStaffPortalPath(): boolean {
  if (typeof window === 'undefined') return false;
  const p = (window.location.pathname || '').toLowerCase();
  return p === '/team' || p.startsWith('/team/');
}

function resolveActiveDb(preferStaff = false): typeof db {
  const staffActive = isRuntimeStaffSession(staffAuth);
  if ((preferStaff || isStaffPortalPath()) && staffActive) {
    return staffDb;
  }
  if (auth.currentUser) {
    return db;
  }
  if (staffActive) {
    return staffDb;
  }
  return db;
}

function normalizeFamilyCompare(value?: string): string {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/^آل\s+/u, '')
    .replace(/^ال/u, '')
    .replace(/\s+/g, ' ');
}

export function doesCampaignMatchClient(
  campaign: KashafiCampaignRecord,
  clientCtx: {
    familyName?: string;
    isVip?: boolean;
    vaultItemsCount?: number;
    treeMembersCount?: number;
  }
): boolean {
  if (campaign.status !== 'active') return false;
  switch (campaign.targetSegment) {
    case 'all':
      return true;
    case 'premium_members':
      return Boolean(clientCtx.isVip);
    case 'vault_owners':
      return (clientCtx.vaultItemsCount || 0) > 0;
    case 'active_trees':
      return (clientCtx.treeMembersCount || 0) > 0;
    case 'specific_family': {
      const target = normalizeFamilyCompare(campaign.targetFamilyName);
      const mine = normalizeFamilyCompare(clientCtx.familyName);
      if (!target || !mine) return false;
      return mine.includes(target) || target.includes(mine);
    }
    default:
      return true;
  }
}

export function getKashafiCategoryLabelAr(cat: KashafiCampaignCategory): string {
  switch (cat) {
    case 'research_service':
      return 'خدمة تحقيق بحثي';
    case 'digital_feature':
      return 'ميزة رقمية';
    case 'platform_announcement':
      return 'إعلان منصة';
  }
}

export function getKashafiSegmentLabelAr(
  seg: KashafiTargetSegment,
  specificFamily?: string
): string {
  switch (seg) {
    case 'all':
      return 'جميع الأعضاء';
    case 'specific_family':
      return specificFamily ? `عائلة محددة (${specificFamily})` : 'عائلة محددة';
    case 'vault_owners':
      return 'أصحاب الخزائن الوثائقية';
    case 'active_trees':
      return 'أصحاب المشجرات النشطة';
    case 'premium_members':
      return 'مشتركو الباقة السنوية (بريميوم)';
  }
}

export function getKashafiOrderStatusLabelAr(
  status: KashafiServiceOrderStatus
): string {
  switch (status) {
    case 'NEW':
      return 'مسند لمدير البحوث · بانتظار البدء';
    case 'IN_PROGRESS':
      return 'قيد التنفيذ لدى مدير البحوث';
    case 'COMPLETED':
      return 'مكتمل وتم التسليم في كشّافي ✓';
    case 'CANCELLED':
      return 'ملغى';
  }
}

// =============================================================================
// 1. KASHAFI ITEMS (REAL CLIENT DISCOVERIES & AUTO RESEARCHER UPDATES)
// =============================================================================

export async function createKashafiItem(params: {
  targetUserId: string;
  targetUserEmail?: string;
  targetFamilyName: string;
  type: KashafiItemType;
  title: string;
  summary: string;
  details?: string;
  sourceCitation?: string;
  deliverableUrl?: string;
  relatedTicketId?: string;
  relatedOrderId?: string;
  authorName: string;
  authorRole?: string;
}): Promise<KashafiItemRecord | null> {
  const cleanUserId = (
    params.targetUserId ||
    canonicalCustomerEmailUid(params.targetUserEmail) ||
    ''
  ).trim();
  if (!cleanUserId || cleanUserId === 'system_proactive_miner') return null;

  const nowIso = new Date().toISOString();
  const id = `ksh_item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const record: KashafiItemRecord = {
    id,
    targetUserId: cleanUserId,
    targetUserEmail: params.targetUserEmail?.trim().toLowerCase() || undefined,
    targetFamilyName: (params.targetFamilyName || 'العائلة').slice(0, 100),
    type: params.type,
    title: params.title.trim().slice(0, 240),
    summary: params.summary.trim().slice(0, 2000),
    details: params.details?.trim().slice(0, 6000) || undefined,
    sourceCitation: params.sourceCitation?.trim().slice(0, 1000) || undefined,
    deliverableUrl: params.deliverableUrl?.trim().slice(0, 1500) || undefined,
    relatedTicketId: params.relatedTicketId?.slice(0, 128) || undefined,
    relatedOrderId: params.relatedOrderId?.slice(0, 128) || undefined,
    authorName: (params.authorName || 'مرصد بحوث جذوري').slice(0, 140),
    authorRole: (params.authorRole || 'مدير البحوث').slice(0, 80),
    isRead: false,
    createdAt: nowIso,
  };

  const payload = cleanUndefined(record) as unknown as Record<string, unknown>;
  const targetDb = resolveActiveDb(true);
  const tasks: Promise<unknown>[] = [
    fastTimeout(setDoc(doc(targetDb, 'kashafi_items', id), payload), 3500),
  ];
  if (mirrorAuth.currentUser && isRuntimeStaffSession(mirrorAuth)) {
    tasks.push(
      fastTimeout(setDoc(doc(mirrorDb, 'kashafi_items', id), payload), 3000)
    );
  }
  const results = await Promise.allSettled(tasks);
  if (results[0].status === 'rejected') {
    try {
      handleFirestoreError(
        results[0].reason,
        OperationType.CREATE,
        `kashafi_items/${id}`
      );
    } catch {
      // Logged cleanly
    }
    return null;
  }
  return record;
}

export async function fetchCustomerKashafiItems(
  userId?: string,
  userEmail?: string
): Promise<KashafiItemRecord[]> {
  const targetDb = resolveActiveDb(false);
  const effectiveUid = userId || auth.currentUser?.uid || '';
  const cleanEmail = (userEmail || auth.currentUser?.email || '')
    .trim()
    .toLowerCase();
  if (!effectiveUid && !cleanEmail) return [];

  const queries: Promise<KashafiItemRecord[]>[] = [];
  if (effectiveUid) {
    queries.push(
      fastTimeout(
        getDocs(
          query(
            collection(targetDb, 'kashafi_items'),
            where('targetUserId', '==', effectiveUid)
          )
        ),
        3500
      ).then((snap) => snap.docs.map((d) => d.data() as KashafiItemRecord))
    );
  }
  if (cleanEmail) {
    queries.push(
      fastTimeout(
        getDocs(
          query(
            collection(targetDb, 'kashafi_items'),
            where('targetUserEmail', '==', cleanEmail)
          )
        ),
        3500
      ).then((snap) => snap.docs.map((d) => d.data() as KashafiItemRecord))
    );
  }

  const settled = await Promise.allSettled(queries);
  const byId = new Map<string, KashafiItemRecord>();
  for (const res of settled) {
    if (res.status === 'fulfilled') {
      for (const item of res.value) {
        if (item?.id) byId.set(item.id, item);
      }
    }
  }
  return Array.from(byId.values()).sort((a, b) =>
    (b.createdAt || '').localeCompare(a.createdAt || '')
  );
}

export async function markKashafiItemRead(itemId: string): Promise<void> {
  if (!itemId) return;
  const targetDb = resolveActiveDb(false);
  const nowIso = new Date().toISOString();
  try {
    await fastTimeout(
      updateDoc(doc(targetDb, 'kashafi_items', itemId), {
        isRead: true,
        readAt: nowIso,
      }),
      3000
    );
  } catch {
    // Non-fatal
  }
}

// =============================================================================
// 2. KASHAFI CAMPAIGNS (ADMIN-PUBLISHED SERVICES & ANNOUNCEMENTS)
// =============================================================================

export async function saveKashafiCampaign(
  campaign: Omit<KashafiCampaignRecord, 'id' | 'createdAt' | 'updatedAt'> & {
    id?: string;
    createdAt?: string;
  }
): Promise<KashafiCampaignRecord> {
  const nowIso = new Date().toISOString();
  const id =
    campaign.id ||
    `ksh_cmp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const record: KashafiCampaignRecord = {
    ...campaign,
    id,
    title: campaign.title.trim().slice(0, 220),
    description: campaign.description.trim().slice(0, 2000),
    priceUsd: Math.max(0, Number(campaign.priceUsd) || 0),
    freeForPremium: Boolean(campaign.freeForPremium),
    assignedRole: 'research_manager',
    createdAt: campaign.createdAt || nowIso,
    updatedAt: nowIso,
  };
  const payload = cleanUndefined(record) as unknown as Record<string, unknown>;
  const targetDb = resolveActiveDb(true);
  await fastTimeout(
    setDoc(doc(targetDb, 'kashafi_campaigns', id), payload),
    4000
  );
  if (mirrorAuth.currentUser && isRuntimeStaffSession(mirrorAuth)) {
    setDoc(doc(mirrorDb, 'kashafi_campaigns', id), payload).catch(() => {});
  }
  return record;
}

export async function fetchAllKashafiCampaignsForAdmin(): Promise<
  KashafiCampaignRecord[]
> {
  const targetDb = resolveActiveDb(true);
  try {
    const snap = await fastTimeout(
      getDocs(collection(targetDb, 'kashafi_campaigns')),
      4000
    );
    return snap.docs
      .map((d) => d.data() as KashafiCampaignRecord)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch {
    return [];
  }
}

export async function fetchActiveKashafiCampaignsForClient(): Promise<
  KashafiCampaignRecord[]
> {
  const targetDb = resolveActiveDb(false);
  if (!auth.currentUser && !isRuntimeStaffSession(staffAuth)) return [];
  try {
    const snap = await fastTimeout(
      getDocs(
        query(
          collection(targetDb, 'kashafi_campaigns'),
          where('status', '==', 'active')
        )
      ),
      3500
    );
    return snap.docs
      .map((d) => d.data() as KashafiCampaignRecord)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch {
    return [];
  }
}

export async function toggleKashafiCampaignStatus(
  campaignId: string,
  nextStatus: 'active' | 'paused'
): Promise<void> {
  const targetDb = resolveActiveDb(true);
  const nowIso = new Date().toISOString();
  await fastTimeout(
    updateDoc(doc(targetDb, 'kashafi_campaigns', campaignId), {
      status: nextStatus,
      updatedAt: nowIso,
    }),
    3500
  );
}

export async function deleteKashafiCampaign(campaignId: string): Promise<void> {
  const targetDb = resolveActiveDb(true);
  await fastTimeout(
    deleteDoc(doc(targetDb, 'kashafi_campaigns', campaignId)),
    3500
  );
}

// =============================================================================
// 3. KASHAFI SERVICE ORDERS (CUSTOMER -> AUTO-ASSIGNED TO RESEARCH MANAGER)
// =============================================================================

export async function createKashafiServiceOrder(params: {
  campaign: KashafiCampaignRecord;
  userId: string;
  userEmail?: string;
  userFullName: string;
  familyName: string;
  originCountry?: string;
  originRegion?: string;
  pricePaidUsd: number;
  includedInPremium?: boolean;
  walletTransactionId?: string;
  customerNotes?: string;
}): Promise<KashafiServiceOrderRecord> {
  const nowIso = new Date().toISOString();
  const shortSeq = String(Date.now()).slice(-6);
  const id = `ksh_ord_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const orderNumber = `KSH-${shortSeq}`;
  const safeUid = params.userId || auth.currentUser?.uid || '';

  const record: KashafiServiceOrderRecord = {
    id,
    orderNumber,
    campaignId: params.campaign.id,
    campaignTitle: params.campaign.title.slice(0, 220),
    campaignCategory: params.campaign.category,
    userId: safeUid,
    userEmail: params.userEmail?.trim().toLowerCase() || undefined,
    userFullName: (params.userFullName || params.familyName || 'عضو جذوري').slice(
      0,
      150
    ),
    familyName: (params.familyName || 'العائلة').slice(0, 100),
    originCountry: params.originCountry?.slice(0, 60) || undefined,
    originRegion: params.originRegion?.slice(0, 100) || undefined,
    pricePaidUsd: Math.max(0, Number(params.pricePaidUsd) || 0),
    includedInPremium: Boolean(params.includedInPremium),
    walletTransactionId: params.walletTransactionId?.slice(0, 80) || undefined,
    customerNotes: params.customerNotes?.trim().slice(0, 2000) || undefined,
    status: 'NEW',
    assignedRole: 'research_manager',
    assignedResearcherId: params.campaign.assignedResearcherId || undefined,
    assignedResearcherName:
      params.campaign.assignedResearcherName || 'مدير البحوث',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const payload = cleanUndefined(record) as unknown as Record<string, unknown>;
  const targetDb = resolveActiveDb(false);
  await fastTimeout(
    setDoc(doc(targetDb, 'kashafi_service_orders', id), payload),
    4000
  );
  return record;
}

export async function fetchCustomerKashafiOrders(
  userId?: string,
  userEmail?: string
): Promise<KashafiServiceOrderRecord[]> {
  const targetDb = resolveActiveDb(false);
  const effectiveUid = userId || auth.currentUser?.uid || '';
  const cleanEmail = (userEmail || auth.currentUser?.email || '')
    .trim()
    .toLowerCase();
  if (!effectiveUid && !cleanEmail) return [];

  const queries: Promise<KashafiServiceOrderRecord[]>[] = [];
  if (effectiveUid) {
    queries.push(
      fastTimeout(
        getDocs(
          query(
            collection(targetDb, 'kashafi_service_orders'),
            where('userId', '==', effectiveUid)
          )
        ),
        3500
      ).then((snap) => snap.docs.map((d) => d.data() as KashafiServiceOrderRecord))
    );
  }
  if (cleanEmail) {
    queries.push(
      fastTimeout(
        getDocs(
          query(
            collection(targetDb, 'kashafi_service_orders'),
            where('userEmail', '==', cleanEmail)
          )
        ),
        3500
      ).then((snap) => snap.docs.map((d) => d.data() as KashafiServiceOrderRecord))
    );
  }

  const settled = await Promise.allSettled(queries);
  const byId = new Map<string, KashafiServiceOrderRecord>();
  for (const res of settled) {
    if (res.status === 'fulfilled') {
      for (const ord of res.value) {
        if (ord?.id) byId.set(ord.id, ord);
      }
    }
  }
  return Array.from(byId.values()).sort((a, b) =>
    (b.createdAt || '').localeCompare(a.createdAt || '')
  );
}

export async function fetchAllKashafiOrdersForStaff(): Promise<
  KashafiServiceOrderRecord[]
> {
  const targetDb = resolveActiveDb(true);
  try {
    const snap = await fastTimeout(
      getDocs(collection(targetDb, 'kashafi_service_orders')),
      4000
    );
    return snap.docs
      .map((d) => d.data() as KashafiServiceOrderRecord)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch {
    return [];
  }
}

export async function updateKashafiServiceOrderByResearcher(params: {
  order: KashafiServiceOrderRecord;
  nextStatus: KashafiServiceOrderStatus;
  researcherId: string;
  researcherName: string;
  researcherReport?: string;
  deliverableUrl?: string;
  sourceCitation?: string;
}): Promise<KashafiServiceOrderRecord> {
  const nowIso = new Date().toISOString();
  const isCompleting = params.nextStatus === 'COMPLETED';
  const updated: KashafiServiceOrderRecord = {
    ...params.order,
    status: params.nextStatus,
    assignedResearcherId: params.researcherId,
    assignedResearcherName: params.researcherName,
    researcherReport:
      params.researcherReport !== undefined
        ? params.researcherReport.trim().slice(0, 6000)
        : params.order.researcherReport,
    deliverableUrl:
      params.deliverableUrl !== undefined
        ? params.deliverableUrl.trim().slice(0, 1500) || undefined
        : params.order.deliverableUrl,
    deliveredAt: isCompleting ? nowIso : params.order.deliveredAt,
    updatedAt: nowIso,
  };

  const payload = cleanUndefined(updated) as unknown as Record<string, unknown>;
  const targetDb = resolveActiveDb(true);
  await fastTimeout(
    setDoc(doc(targetDb, 'kashafi_service_orders', params.order.id), payload),
    4000
  );

  // Event-Driven Auto-Delivery into Client's Kashafi Radar on Completion
  if (isCompleting) {
    await createKashafiItem({
      targetUserId: params.order.userId,
      targetUserEmail: params.order.userEmail,
      targetFamilyName: params.order.familyName,
      type: 'service_deliverable',
      title: `تم إنجاز وتسليم: ${params.order.campaignTitle}`,
      summary:
        updated.researcherReport?.slice(0, 400) ||
        `أنجز مدير البحوث طلبكم رقم #${params.order.orderNumber} وأودع نتيجته في رادار كشّافي الخاص بعائلتكم.`,
      details: updated.researcherReport,
      sourceCitation: params.sourceCitation?.trim() || undefined,
      deliverableUrl: updated.deliverableUrl,
      relatedOrderId: params.order.id,
      authorName: params.researcherName,
      authorRole: 'مدير البحوث',
    });

    sendCustomerNotification({
      userId: params.order.userId,
      recipientEmail: params.order.userEmail,
      recipientName: params.order.userFullName,
      familyName: params.order.familyName,
      senderName: params.researcherName,
      title: `اكتملت بعثة كشّافي #${params.order.orderNumber} ✓`,
      body: `تم اعتماد وتسليم نتيجة «${params.order.campaignTitle}» في تبويب كشّافي بحسابك.`,
      category: 'ticket_update',
      senderRole: 'researcher',
    }).catch(() => {});
  }

  return updated;
}
