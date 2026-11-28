import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Compass,
  Crown,
  Edit3,
  Eye,
  FileText,
  Filter,
  GitBranch,
  History,
  Image as ImageIcon,
  Layers,
  Lock,
  MapPin,
  Plus,
  Radar,
  RefreshCw,
  RotateCcw,
  Save,
  ScrollText,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  ResearchTicketData,
  resolveStaffRbacRole,
  TeamMemberRecord,
  TeamRoleType,
  UserProfileData,
} from '../services/firestoreService';
import {
  fetchCustomerKashafiItems,
  KashafiItemRecord,
} from '../services/kashafiService';
import {
  approveResearchDraftByManager,
  assignResearchTicketToSpecialist,
  DEFAULT_MASTER_LINEAGE_CATALOG,
  deleteMasterLineageCatalogEntry,
  fetchAllCustomerProfilesForResearch,
  fetchAllResearchApprovalDrafts,
  fetchCustomerTreePreviewForResearch,
  fetchMasterLineageCatalog,
  getKashafiDiscoveryCategoryLabelAr,
  getLineageDecisionLabelAr,
  normalizeArabicCompare,
  returnResearchDraftToResearcher,
  saveMasterLineageCatalogEntry,
  submitOrApproveLineageDecision,
  submitOrPublishKashafiDiscovery,
  toggleFreeLeadRadarSignalForUser,
  updateResearcherSpecialtyInFirebase,
} from '../services/researchManagerService';
import {
  KashafiDiscoveryCategory,
  LineageConnectionDecisionStatus,
  MasterLineageCatalogEntry,
  ResearchApprovalDraftRecord,
} from '../types/juthori';
import {
  normalizeSubscriptionPlanId,
  SubscriptionPlanId,
} from '../config/subscriptionPlans';
import {
  UnifiedWorkspaceHeader,
  WORKSPACE_PRIMARY_BTN_CLASS,
  WORKSPACE_SECONDARY_BTN_CLASS,
} from './UnifiedWorkspaceHeader';
import {
  ADAM_STAGING_SYNC_EVENT,
  AdamStagingProposalRecord,
  AutoCompassMatchCandidate,
  ScholarlyMacroId,
  computeResearcherKpiMetrics,
  computeTicketSlaStatus,
  extractHistoricalVerticalLinks,
  fetchAdamStagingProposals,
  generateSmartScholarlyMacro,
  runZeroClickTicketAutoCompass,
  stageAdamTreeProposal,
} from '../services/adamSovereignFirewallService';

export interface ResearchManagerDashboardProps {
  activeMember: TeamMemberRecord;
  effectiveRole: TeamRoleType;
  staffList: TeamMemberRecord[];
  researchTickets: ResearchTicketData[];
  onRefreshStaffData?: () => void;
  onUpdateResearchTicket?: (ticket: ResearchTicketData) => void;
  onUpdateStaffMember?: (member: TeamMemberRecord) => void;
  onOpenAdamTree?: () => void;
  onOpenCompass?: () => void;
}

type ResearchSubTab =
  | 'lineage_queue'
  | 'kashafi_studio'
  | 'free_radar'
  | 'approval_inbox'
  | 'master_library';

interface QueueItemView {
  key: string;
  user: UserProfileData;
  ticket?: ResearchTicketData;
  planTier: SubscriptionPlanId;
  priorityRank: number;
  familyDisplay: string;
  locationDisplay: string;
  assignedToId?: string;
  assignedToName?: string;
  slaLabel?: string;
}

const KASHAFI_CATEGORIES: Array<{
  id: KashafiDiscoveryCategory;
  label: string;
  shortLabel: string;
  hint: string;
}> = [
  {
    id: 'sources',
    label: 'المصادر والمراجع التاريخية',
    shortLabel: 'المصادر والمراجع',
    hint: 'اسم الكتاب، المؤلف، القرن، الصفحة/المجلد، والمقتبس النصي الموثق.',
  },
  {
    id: 'documents',
    label: 'الوثائق والمواد التاريخية',
    shortLabel: 'الوثائق والمواد',
    hint: 'صورة أو رابط مخطوطة، صك، حجة شرعية، أو وثيقة تاريخية مع التعليق.',
  },
  {
    id: 'stories',
    label: 'السير والقصص العائلية التاريخية',
    shortLabel: 'السير والقصص',
    hint: 'سيرة تاريخية موثقة لأعلام العائلة أو محطة تاريخية بارزة.',
  },
  {
    id: 'ongoing',
    label: 'الاكتشافات المستمرة',
    shortLabel: 'الاكتشافات المستمرة',
    hint: 'تحديثات بحثية دورية وإشارات مستجدة في الفهارس والمصادر.',
  },
];

const DECISION_OPTIONS: Array<{
  id: LineageConnectionDecisionStatus;
  title: string;
  desc: string;
  accent: string;
}> = [
  {
    id: 'verified_connected',
    title: 'تم إثبات الربط المرجعي واعتماده ✓',
    desc: 'تحديث عمود النسب لدى العميل فوراً ببيانات الجذر والقبيلة الأم والمصادر المعتمدة.',
    accent: 'border-[#4D7C5B] bg-[#4D7C5B]/10 text-[#2E5239]',
  },
  {
    id: 'partial_investigating',
    title: 'تقاطع جزئي — قيد الاستقصاء المعمق',
    desc: 'إبلاغ العميل بوجود مؤشرات أولية واعدة مع استمرار التدقيق في المخطوطات.',
    accent: 'border-[#B6813A] bg-[#B6813A]/10 text-[#7A531E]',
  },
  {
    id: 'needs_client_info',
    title: 'مطلوب إيضاح أو وثيقة من العميل',
    desc: 'إرسال استفسار علمي مباشر للعميل لطلب اسم جد إضافي أو ديرة أو وثيقة.',
    accent: 'border-[#D97757] bg-[#D97757]/10 text-[#9B492E]',
  },
  {
    id: 'insufficient_sources',
    title: 'تعذّر الربط الموثق حالياً لعدم كفاية المصادر',
    desc: 'إغلاق علمي أمين وإبقاء الملف في الرصد المستمر لإشعار العميل مستقبلاً.',
    accent: 'border-[#D8C7B2] bg-[#E8DED2]/70 text-[#1F1F1C]',
  },
];

function formatDateAr(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getPlanBadgeClasses(tier: SubscriptionPlanId): string {
  if (tier === 'premium') {
    return 'bg-[#D97757] text-[#F5F1E8] border border-[#D97757]';
  }
  if (tier === 'basic') {
    return 'bg-[#E8DED2] text-[#1F1F1C] border border-[#D8C7B2]';
  }
  return 'bg-[#FAF7F2] text-[#1F1F1C]/75 border border-[#D8C7B2]';
}

function getPlanLabelAr(tier: SubscriptionPlanId): string {
  if (tier === 'premium') return 'Premium · أولوية قصوى';
  if (tier === 'basic') return 'Basic · باقة أساسية';
  return 'Free · مجاني';
}

export const ResearchManagerDashboard: React.FC<ResearchManagerDashboardProps> = ({
  activeMember,
  effectiveRole,
  staffList,
  researchTickets,
  onRefreshStaffData,
  onUpdateResearchTicket,
  onUpdateStaffMember,
  onOpenAdamTree,
  onOpenCompass,
}) => {
  const rbacRole = resolveStaffRbacRole(effectiveRole);
  const isManagerOrSuper =
    rbacRole === 'super_admin' || rbacRole === 'research_manager';
  const isResearcherOnly = rbacRole === 'researcher';

  const [activeSubTab, setActiveSubTab] =
    useState<ResearchSubTab>('lineage_queue');

  // Core data state
  const [allUsers, setAllUsers] = useState<UserProfileData[]>([]);
  const [drafts, setDrafts] = useState<ResearchApprovalDraftRecord[]>([]);
  const [catalog, setCatalog] = useState<MasterLineageCatalogEntry[]>(
    DEFAULT_MASTER_LINEAGE_CATALOG
  );
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<{
    kind: 'success' | 'info' | 'warning';
    text: string;
  } | null>(null);

  // Tab 1: Queue state
  const [queueSearch, setQueueSearch] = useState('');
  const [queuePlanFilter, setQueuePlanFilter] = useState<
    'all' | 'premium' | 'basic'
  >('all');
  const [selectedQueueKey, setSelectedQueueKey] = useState<string>('');
  const [treePreview, setTreePreview] = useState<{
    loading: boolean;
    totalMembers: number;
    generationsEstimate: number;
    sampleNames: string[];
    rawMembers: Array<Record<string, unknown>>;
  }>({
    loading: false,
    totalMembers: 0,
    generationsEstimate: 0,
    sampleNames: [],
    rawMembers: [],
  });
  const [adamStagingProposals, setAdamStagingProposals] = useState<
    AdamStagingProposalRecord[]
  >([]);
  const [selectedVerticalLinkIds, setSelectedVerticalLinkIds] = useState<
    string[]
  >([]);
  const [selectedCompassParentId, setSelectedCompassParentId] =
    useState<string>('');
  const [dualKashafiEnabled, setDualKashafiEnabled] = useState(false);
  const [dualKashafiTitle, setDualKashafiTitle] = useState('');
  const [dualKashafiCategory, setDualKashafiCategory] =
    useState<KashafiDiscoveryCategory>('sources');
  const [stagingVerticalLinkBusy, setStagingVerticalLinkBusy] = useState(false);
  const [assignResearcherId, setAssignResearcherId] = useState('');
  const [assignSlaDate, setAssignSlaDate] = useState('');
  const [decisionStatus, setDecisionStatus] =
    useState<LineageConnectionDecisionStatus>('verified_connected');
  const [verifiedRootBranch, setVerifiedRootBranch] = useState('');
  const [verifiedMotherTribe, setVerifiedMotherTribe] = useState('');
  const [intermediateChainText, setIntermediateChainText] = useState('');
  const [verifiedSourcesText, setVerifiedSourcesText] = useState('');
  const [scholarlyNotes, setScholarlyNotes] = useState('');
  const [clientQuestionText, setClientQuestionText] = useState('');
  const [isSavingDecision, setIsSavingDecision] = useState(false);

  // Tab 2: Kashafi Studio state
  const [selectedKashafiUserId, setSelectedKashafiUserId] = useState('');
  const [kashafiCategory, setKashafiCategory] =
    useState<KashafiDiscoveryCategory>('sources');
  const [kashafiTitle, setKashafiTitle] = useState('');
  const [kashafiSummary, setKashafiSummary] = useState('');
  const [kashafiDetails, setKashafiDetails] = useState('');
  const [kashafiBookTitle, setKashafiBookTitle] = useState('');
  const [kashafiBookAuthor, setKashafiBookAuthor] = useState('');
  const [kashafiCenturyOrYear, setKashafiCenturyOrYear] = useState('');
  const [kashafiPageRef, setKashafiPageRef] = useState('');
  const [kashafiExcerptQuote, setKashafiExcerptQuote] = useState('');
  const [kashafiDocumentImageUrl, setKashafiDocumentImageUrl] = useState('');
  const [kashafiDeliverableUrl, setKashafiDeliverableUrl] = useState('');
  const [existingKashafiItems, setExistingKashafiItems] = useState<
    KashafiItemRecord[]
  >([]);
  const [loadingKashafiItems, setLoadingKashafiItems] = useState(false);
  const [isPublishingKashafi, setIsPublishingKashafi] = useState(false);

  // Tab 3: Free Lead Radar state
  const [radarSearch, setRadarSearch] = useState('');
  const [radarFilter, setRadarFilter] = useState<
    'all' | 'matched_only' | 'active_only'
  >('all');
  const [radarBusyUserId, setRadarBusyUserId] = useState<string | null>(null);
  const [radarCustomTeaserByUser, setRadarCustomTeaserByUser] = useState<
    Record<string, string>
  >({});

  // Tab 4: Approval Inbox & Team Performance state
  const [selectedDraftId, setSelectedDraftId] = useState<string>('');
  const [draftStatusFilter, setDraftStatusFilter] = useState<
    'pending_manager_approval' | 'returned' | 'approved' | 'all'
  >('pending_manager_approval');
  const [managerReturnNotes, setManagerReturnNotes] = useState('');
  const [isProcessingDraft, setIsProcessingDraft] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editSpecialtyRegion, setEditSpecialtyRegion] = useState('');
  const [editSpecialtyTribes, setEditSpecialtyTribes] = useState('');

  // Tab 5: Master Library state
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogKindFilter, setCatalogKindFilter] = useState<
    'all' | 'historical_root' | 'reference_book'
  >('all');
  const [editingCatalogId, setEditingCatalogId] = useState<string | null>(null);
  const [showCatalogForm, setShowCatalogForm] = useState(false);
  const [catEntryKind, setCatEntryKind] = useState<
    'historical_root' | 'reference_book'
  >('historical_root');
  const [catRootName, setCatRootName] = useState('');
  const [catMotherTribe, setCatMotherTribe] = useState('');
  const [catChainSummary, setCatChainSummary] = useState('');
  const [catRegionsText, setCatRegionsText] = useState('');
  const [catBookTitle, setCatBookTitle] = useState('');
  const [catAuthorName, setCatAuthorName] = useState('');
  const [catCenturyEra, setCatCenturyEra] = useState('');
  const [catPagesHint, setCatPagesHint] = useState('');
  const [catNotes, setCatNotes] = useState('');
  const [isSavingCatalog, setIsSavingCatalog] = useState(false);

  const showToast = (
    text: string,
    kind: 'success' | 'info' | 'warning' = 'success'
  ) => {
    setToastMessage({ kind, text });
  };

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 5000);
    return () => clearTimeout(t);
  }, [toastMessage]);

  const loadWorkspaceData = async () => {
    setIsLoadingData(true);
    try {
      const [usersData, draftsData, catalogData, stagingData] =
        await Promise.all([
          fetchAllCustomerProfilesForResearch(),
          fetchAllResearchApprovalDrafts(),
          fetchMasterLineageCatalog(),
          fetchAdamStagingProposals(),
        ]);
      setAllUsers(usersData);
      setDrafts(draftsData);
      setCatalog(catalogData);
      setAdamStagingProposals(stagingData);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    loadWorkspaceData();
    const onStagingSync = () => {
      fetchAdamStagingProposals().then(setAdamStagingProposals).catch(() => {});
    };
    window.addEventListener(ADAM_STAGING_SYNC_EVENT, onStagingSync);
    return () =>
      window.removeEventListener(ADAM_STAGING_SYNC_EVENT, onStagingSync);
  }, []);

  // Research-eligible staff list for assignment
  const researchTeamMembers = useMemo(() => {
    return staffList.filter((m) => {
      const r = resolveStaffRbacRole(m.role);
      return r === 'researcher' || r === 'research_manager' || r === 'super_admin';
    });
  }, [staffList]);

  // Build Tab 1 Queue items (Basic & Premium priority-sorted)
  const queueItems = useMemo<QueueItemView[]>(() => {
    const userById = new Map<string, UserProfileData>();
    const userByEmail = new Map<string, UserProfileData>();
    for (const u of allUsers) {
      if (u.userId) userById.set(u.userId, u);
      if (u.email) userByEmail.set(u.email.toLowerCase(), u);
    }

    const items: QueueItemView[] = [];
    const matchedUserIds = new Set<string>();

    // First, tickets mapped to users
    for (const ticket of researchTickets) {
      const matchedUser =
        (ticket.userId ? userById.get(ticket.userId) : undefined) ||
        (ticket.userEmail
          ? userByEmail.get(ticket.userEmail.toLowerCase())
          : undefined);

      const fallbackUser: UserProfileData = matchedUser || {
        userId: ticket.userId || `ticket_user_${ticket.id}`,
        email: ticket.userEmail || '',
        fullName: ticket.userFullName || ticket.familyName || 'عميل',
        firstName:
          ticket.userFullName?.split(' ')[0] || ticket.familyName || 'عميل',
        fatherName: '',
        grandfatherName: '',
        familyName: ticket.familyName || '',
        originCountry: ticket.originCountry || 'السعودية',
        originRegion: ticket.originRegion || '',
        tribeName: ticket.tribeName || '',
        familyBranch: ticket.familyBranch || '',
        accountType: 'individual',
        subscriptionTier: 'basic_verified',
        walletBalance: 0,
        isRootUnlocked: false,
        unlockedCapsules: [],
        createdAt: ticket.createdAt || ticket.openedAt,
      };

      const planTier = normalizeSubscriptionPlanId(
        fallbackUser.subscriptionTier
      );

      // Queue focuses on Basic & Premium (plus any active research ticket explicitly opened)
      if (planTier === 'free' && !ticket.id) continue;

      if (matchedUser?.userId) matchedUserIds.add(matchedUser.userId);

      items.push({
        key: `ticket_${ticket.id}`,
        user: fallbackUser,
        ticket,
        planTier: planTier === 'free' ? 'basic' : planTier,
        priorityRank: planTier === 'premium' ? 0 : 1,
        familyDisplay: fallbackUser.familyName || ticket.familyName || 'عائلة',
        locationDisplay:
          [fallbackUser.originCountry, fallbackUser.originRegion]
            .filter(Boolean)
            .join(' · ') || 'غير محدد',
        assignedToId: ticket.assignedResearcherId,
        assignedToName: ticket.assignedResearcherName,
        slaLabel: ticket.priorityTag?.startsWith('SLA:')
          ? ticket.priorityTag.replace('SLA:', '')
          : undefined,
      });
    }

    // Second, paid Basic / Premium users who don't yet have a ticket
    for (const u of allUsers) {
      if (matchedUserIds.has(u.userId)) continue;
      const planTier = normalizeSubscriptionPlanId(u.subscriptionTier);
      if (planTier !== 'basic' && planTier !== 'premium') continue;

      items.push({
        key: `user_${u.userId}`,
        user: u,
        planTier,
        priorityRank: planTier === 'premium' ? 0 : 1,
        familyDisplay: u.familyName || u.fullName || 'عائلة',
        locationDisplay:
          [u.originCountry, u.originRegion].filter(Boolean).join(' · ') ||
          'غير محدد',
      });
    }

    // Sort: Premium first, then Basic, then newest
    items.sort((a, b) => {
      if (a.priorityRank !== b.priorityRank) {
        return a.priorityRank - b.priorityRank;
      }
      const dateA = a.ticket?.updatedAt || a.user.createdAt || '';
      const dateB = b.ticket?.updatedAt || b.user.createdAt || '';
      return dateB.localeCompare(dateA);
    });

    // Strict RBAC Isolation for Specialist Researcher: only see assigned files!
    if (isResearcherOnly) {
      return items.filter(
        (it) =>
          it.assignedToId === activeMember.id ||
          (it.assignedToName &&
            normalizeArabicCompare(it.assignedToName) ===
              normalizeArabicCompare(activeMember.name))
      );
    }

    return items;
  }, [allUsers, researchTickets, isResearcherOnly, activeMember]);

  const filteredQueueItems = useMemo(() => {
    const q = normalizeArabicCompare(queueSearch);
    return queueItems.filter((item) => {
      if (queuePlanFilter !== 'all' && item.planTier !== queuePlanFilter) {
        return false;
      }
      if (!q) return true;
      const hay = normalizeArabicCompare(
        `${item.familyDisplay} ${item.user.fullName} ${item.user.tribeName || ''} ${
          item.user.familyBranch || ''
        } ${item.locationDisplay} ${item.assignedToName || ''} ${
          item.ticket?.ticketNumber || ''
        }`
      );
      return hay.includes(q);
    });
  }, [queueItems, queueSearch, queuePlanFilter]);

  const selectedQueueItem = useMemo(
    () =>
      filteredQueueItems.find((i) => i.key === selectedQueueKey) ||
      filteredQueueItems[0] ||
      null,
    [filteredQueueItems, selectedQueueKey]
  );

  // Sync decision editor & tree preview when selected queue item changes
  useEffect(() => {
    if (!selectedQueueItem) return;
    const u = selectedQueueItem.user;
    const t = selectedQueueItem.ticket;
    setAssignResearcherId(selectedQueueItem.assignedToId || '');
    setAssignSlaDate(selectedQueueItem.slaLabel || '');
    setDecisionStatus(u.lineageResearchStatus || 'verified_connected');
    setVerifiedRootBranch(
      t?.resolutionPayload?.verifiedRootBranch ||
        u.verifiedLineageSnapshot?.rootBranchName ||
        u.familyBranch ||
        ''
    );
    setVerifiedMotherTribe(
      t?.resolutionPayload?.verifiedRootTribe ||
        u.verifiedLineageSnapshot?.rootTribeName ||
        u.tribeName ||
        ''
    );
    setIntermediateChainText(
      u.verifiedLineageSnapshot?.adamSpineNodes
        ?.map((a) => a.name)
        .join(' ← ') || ''
    );
    setVerifiedSourcesText(
      t?.verifiedSources ||
        u.verifiedLineageSnapshot?.verifiedSourceCitation ||
        ''
    );
    setScholarlyNotes(u.lineageResearchStatusNote || t?.researchFindings || '');
    setClientQuestionText('');
    setSelectedVerticalLinkIds([]);
    setSelectedCompassParentId('');
    setDualKashafiEnabled(false);
    setDualKashafiTitle(
      `توثيق مرجعي تاريخي لنسب عائلة ${selectedQueueItem.familyDisplay}`
    );
    setDualKashafiCategory('sources');

    let cancelled = false;
    setTreePreview((prev) => ({ ...prev, loading: true }));
    fetchCustomerTreePreviewForResearch(u.userId, u.familyName, u.email).then(
      (res) => {
        if (!cancelled) {
          setTreePreview({
            loading: false,
            ...res,
          });
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, [selectedQueueItem?.key]);

  // Zero-Click Auto-Compass matches computed immediately for the active ticket
  const autoCompassMatches = useMemo<AutoCompassMatchCandidate[]>(() => {
    if (!selectedQueueItem) return [];
    return runZeroClickTicketAutoCompass({
      familyName: selectedQueueItem.familyDisplay,
      tribeName: selectedQueueItem.user.tribeName,
      familyBranch: selectedQueueItem.user.familyBranch,
      originCountry: selectedQueueItem.user.originCountry,
      originRegion: selectedQueueItem.user.originRegion,
      grandfatherName: selectedQueueItem.user.grandfatherName,
      catalogEntries: catalog,
    });
  }, [selectedQueueItem, catalog]);

  // Strict Living-Persons Firewall partition on the active client's tree
  const firewallPartition = useMemo(() => {
    if (!selectedQueueItem) {
      return {
        eligibleHistoricalLinks: [],
        isolatedContemporaryCount: 0,
        isolatedLivingCount: 0,
        isolatedContemporarySamples: [],
      };
    }
    return extractHistoricalVerticalLinks(treePreview.rawMembers, {
      grandfatherName: selectedQueueItem.user.grandfatherName,
      familyName: selectedQueueItem.familyDisplay,
      rootBranchName: verifiedRootBranch || selectedQueueItem.user.familyBranch,
    });
  }, [selectedQueueItem, treePreview.rawMembers, verifiedRootBranch]);

  const handleApplyAutoCompassCandidate = (cand: AutoCompassMatchCandidate) => {
    setSelectedCompassParentId(cand.parentNodeId);
    setVerifiedRootBranch(cand.subRootName);
    setVerifiedMotherTribe(cand.motherTribe);
    setIntermediateChainText(cand.adamChainPreview);
    setVerifiedSourcesText(cand.matchedSources.join('؛ '));
    setDecisionStatus('verified_connected');
    showToast(
      `✦ تم اختيار العقدة الأم (${cand.parentNodeName}) بنسبة تطابق ${cand.confidencePercent}% وتعبئة الحقول المرجعية بنقرة واحدة.`
    );
  };

  const handleApplyScholarlyMacro = (macroId: ScholarlyMacroId) => {
    if (!selectedQueueItem) return;
    const generated = generateSmartScholarlyMacro(macroId, {
      familyName: selectedQueueItem.familyDisplay,
      branchName: verifiedRootBranch,
      motherTribe: verifiedMotherTribe,
      region: selectedQueueItem.locationDisplay,
      sourcesText: verifiedSourcesText,
    });
    setDecisionStatus(generated.decisionStatus);
    setScholarlyNotes(generated.scholarlyNotes);
    if (generated.clientQuestionText) {
      setClientQuestionText(generated.clientQuestionText);
    }
    showToast('✦ تم توليد الصياغة العلمية الموثقة في قمرة القرار بنقرة واحدة.', 'info');
  };

  const handleStageSelectedVerticalLinksToAdamSandbox = async () => {
    if (!selectedQueueItem) return;
    const picked = firewallPartition.eligibleHistoricalLinks.filter((l) =>
      selectedVerticalLinkIds.includes(l.id)
    );
    if (picked.length === 0) {
      showToast(
        'اختر حلقة جد تاريخي متوفى واحدة على الأقل لاقتراح تطعيمها في شجرة آدم.',
        'warning'
      );
      return;
    }

    setStagingVerticalLinkBusy(true);
    try {
      const parentName =
        verifiedRootBranch.trim() ||
        verifiedMotherTribe.trim() ||
        autoCompassMatches[0]?.parentNodeName ||
        'شجرة آدم المرجعية';
      const parentId =
        selectedCompassParentId ||
        autoCompassMatches[0]?.parentNodeId ||
        'ADAM_ROOT_LINK';
      const chainPreview =
        intermediateChainText.trim() ||
        autoCompassMatches[0]?.adamChainPreview ||
        `${parentName} ← ${verifiedMotherTribe || 'شجرة آدم'}`;

      let stagedCount = 0;
      for (const link of picked) {
        const res = await stageAdamTreeProposal({
          actionType: 'add_vertical_link',
          targetNodeId: `ADAM-HIST-${Date.now().toString(36).slice(-5)}-${link.id.slice(-4)}`,
          targetNodeName: link.name,
          parentNodeId: parentId,
          parentNodeName: parentName,
          ancestralChainPreview: chainPreview,
          sourceReferenceText:
            verifiedSourcesText.trim() ||
            'توثيق هيئة بحوث جذوري (مستخلص الحلقات العمودية التاريخية)',
          proposedNodePayload: {
            node_id: `ADAM-HIST-${Date.now().toString(36).slice(-5)}`,
            name: link.name,
            parent_id: parentId,
            parent_name: parentName,
            arc_code: 'FE0',
            representation: 'HISTORICAL_ANCESTOR',
            relation_nature: 'DIRECT_DESCENDANT',
            geo_footprint: [selectedQueueItem.locationDisplay].filter(Boolean),
            enriched_sources: verifiedSourcesText
              .split(/[؛\n]/)
              .map((s) => s.trim())
              .filter(Boolean),
          },
          submittedByResearcherId: activeMember.id,
          submittedByResearcherName: activeMember.name,
          approvedByManagerId: isManagerOrSuper ? activeMember.id : undefined,
          approvedByManagerName: isManagerOrSuper
            ? activeMember.name
            : undefined,
          sourceTicketId: selectedQueueItem.ticket?.id,
          sourceFamilyName: selectedQueueItem.familyDisplay,
          firewallCheckInput: {
            id: link.id,
            name: link.name,
            isAlive: false,
            vitalStatus: 'deceased',
            generationLevel: Math.max(2, link.generationLevel),
            relationLabel: link.relationLabel,
            isHistoricalAncestor: true,
          },
        });
        if (res.ok) stagedCount += 1;
      }

      if (stagedCount > 0) {
        const refreshed = await fetchAdamStagingProposals();
        setAdamStagingProposals(refreshed);
        setSelectedVerticalLinkIds([]);
        showToast(
          `⏳ تم إرسال ${stagedCount} ${
            stagedCount === 1 ? 'حلقة تاريخية' : 'حلقات تاريخية'
          } إلى طبقة Sandbox شجرة آدم — بانتظار التصديق النهائي للمايسترو (مع عزل كافة الأحياء آلياً).`,
          'info'
        );
      }
    } finally {
      setStagingVerticalLinkBusy(false);
    }
  };

  // Premium clients list for Tab 2 (Kashafi Studio)
  const premiumClients = useMemo(() => {
    const allPremium = allUsers.filter(
      (u) => normalizeSubscriptionPlanId(u.subscriptionTier) === 'premium'
    );
    if (!isResearcherOnly) return allPremium;
    const assignedUserIds = new Set(
      queueItems.map((q) => q.user.userId).filter(Boolean)
    );
    return allPremium.filter((u) => assignedUserIds.has(u.userId));
  }, [allUsers, isResearcherOnly, queueItems]);

  const selectedKashafiUser = useMemo(
    () =>
      premiumClients.find((u) => u.userId === selectedKashafiUserId) ||
      premiumClients[0] ||
      null,
    [premiumClients, selectedKashafiUserId]
  );

  useEffect(() => {
    if (!selectedKashafiUser) {
      setExistingKashafiItems([]);
      return;
    }
    let cancelled = false;
    setLoadingKashafiItems(true);
    fetchCustomerKashafiItems(
      selectedKashafiUser.userId,
      selectedKashafiUser.email
    )
      .then((items) => {
        if (!cancelled) setExistingKashafiItems(items);
      })
      .finally(() => {
        if (!cancelled) setLoadingKashafiItems(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedKashafiUser?.userId]);

  // Free Lead Radar computation (Tab 3)
  const freeRadarRows = useMemo(() => {
    const freeUsers = allUsers.filter(
      (u) => normalizeSubscriptionPlanId(u.subscriptionTier) === 'free'
    );
    return freeUsers.map((u) => {
      const famNorm = normalizeArabicCompare(u.familyName);
      const tribeNorm = normalizeArabicCompare(u.tribeName);
      const branchNorm = normalizeArabicCompare(u.familyBranch);
      const regionNorm = normalizeArabicCompare(
        `${u.originCountry || ''} ${u.originRegion || ''}`
      );

      let matchedEntry: MasterLineageCatalogEntry | undefined;
      for (const entry of catalog) {
        const entryText = normalizeArabicCompare(
          `${entry.rootName} ${entry.motherTribe} ${entry.ancestralChainSummary || ''} ${entry.regions.join(' ')}`
        );
        if (
          (tribeNorm.length >= 3 && entryText.includes(tribeNorm)) ||
          (branchNorm.length >= 3 && entryText.includes(branchNorm)) ||
          (famNorm.length >= 3 && entryText.includes(famNorm))
        ) {
          matchedEntry = entry;
          break;
        }
      }

      const regionMatched =
        !matchedEntry &&
        regionNorm.length >= 3 &&
        catalog.some((e) =>
          e.regions.some((r) => regionNorm.includes(normalizeArabicCompare(r)))
        );

      return {
        user: u,
        matchedEntry,
        hasAutoMatch: Boolean(matchedEntry || u.verifiedLineageSnapshot?.matched),
        matchStrengthLabel: matchedEntry
          ? `تقاطع قوي محتمل مع (${matchedEntry.rootName})`
          : u.verifiedLineageSnapshot?.matched
          ? 'مطابقة أولية مكتشفة في شجرة آدم'
          : regionMatched
          ? 'تقاطع جغرافي أولي يستدعي المراجعة'
          : 'رصد عام — متاح للتفعيل التحفيزي',
      };
    });
  }, [allUsers, catalog]);

  const filteredFreeRadarRows = useMemo(() => {
    const q = normalizeArabicCompare(radarSearch);
    return freeRadarRows.filter((row) => {
      if (radarFilter === 'matched_only' && !row.hasAutoMatch) return false;
      if (radarFilter === 'active_only' && !row.user.freeLeadRadarSignal?.active)
        return false;
      if (!q) return true;
      const hay = normalizeArabicCompare(
        `${row.user.familyName} ${row.user.fullName} ${row.user.tribeName || ''} ${
          row.user.originCountry || ''
        } ${row.user.originRegion || ''}`
      );
      return hay.includes(q);
    });
  }, [freeRadarRows, radarSearch, radarFilter]);

  const radarMetrics = useMemo(() => {
    const totalFree = freeRadarRows.length;
    const activeSignals = freeRadarRows.filter(
      (r) => r.user.freeLeadRadarSignal?.active
    ).length;
    const convertedFromRadar = allUsers.filter((u) => {
      const tier = normalizeSubscriptionPlanId(u.subscriptionTier);
      return (
        (tier === 'basic' || tier === 'premium') &&
        Boolean(u.freeLeadRadarSignal?.activatedAt)
      );
    }).length;
    const totalSignalsEver = activeSignals + convertedFromRadar;
    const conversionPct =
      totalSignalsEver > 0
        ? Math.round((convertedFromRadar / totalSignalsEver) * 100)
        : 0;
    return {
      totalFree,
      activeSignals,
      convertedFromRadar,
      conversionPct,
    };
  }, [freeRadarRows, allUsers]);

  // Tab 4 Approval Drafts filtered by RBAC
  const visibleDrafts = useMemo(() => {
    const scoped = isResearcherOnly
      ? drafts.filter(
          (d) =>
            d.submittedByResearcherId === activeMember.id ||
            normalizeArabicCompare(d.submittedByResearcherName) ===
              normalizeArabicCompare(activeMember.name)
        )
      : drafts;

    if (draftStatusFilter === 'all') return scoped;
    return scoped.filter((d) => d.status === draftStatusFilter);
  }, [drafts, isResearcherOnly, activeMember, draftStatusFilter]);

  const selectedDraft = useMemo(
    () =>
      visibleDrafts.find((d) => d.id === selectedDraftId) ||
      visibleDrafts[0] ||
      null,
    [visibleDrafts, selectedDraftId]
  );

  // KPI metrics
  const kpiStats = useMemo(() => {
    const unassignedCount = queueItems.filter((q) => !q.assignedToId).length;
    const pendingDraftsCount = drafts.filter((d) =>
      isResearcherOnly
        ? d.submittedByResearcherId === activeMember.id &&
          d.status === 'pending_manager_approval'
        : d.status === 'pending_manager_approval'
    ).length;
    const premiumPriorityCount = queueItems.filter(
      (q) => q.planTier === 'premium'
    ).length;
    const readyRadarCount = freeRadarRows.filter(
      (r) => r.hasAutoMatch && !r.user.freeLeadRadarSignal?.active
    ).length;

    return {
      unassignedCount,
      pendingDraftsCount,
      premiumPriorityCount,
      readyRadarCount,
    };
  }, [queueItems, drafts, isResearcherOnly, activeMember.id, freeRadarRows]);

  // Filtered Master Catalog (Tab 5)
  const filteredCatalog = useMemo(() => {
    const q = normalizeArabicCompare(catalogSearch);
    return catalog.filter((entry) => {
      if (catalogKindFilter !== 'all' && entry.entryKind !== catalogKindFilter)
        return false;
      if (!q) return true;
      const hay = normalizeArabicCompare(
        `${entry.rootName} ${entry.motherTribe} ${entry.bookTitle} ${
          entry.authorName
        } ${entry.regions.join(' ')} ${entry.scholarlyNotes || ''}`
      );
      return hay.includes(q);
    });
  }, [catalog, catalogSearch, catalogKindFilter]);

  // ===========================================================================
  // HANDLERS
  // ===========================================================================

  const handleAssignResearcher = async () => {
    if (!isManagerOrSuper || !selectedQueueItem?.ticket) {
      showToast(
        'يمكن إسناد التذاكر المفتوحة فقط للباحثين المختصين.',
        'warning'
      );
      return;
    }
    const chosen = researchTeamMembers.find((m) => m.id === assignResearcherId);
    if (!chosen) {
      showToast('يرجى اختيار باحث مختص أولاً قبل حفظ الإسناد.', 'warning');
      return;
    }
    const updated = await assignResearchTicketToSpecialist({
      ticket: selectedQueueItem.ticket,
      researcherId: chosen.id,
      researcherName: chosen.name,
      targetDueDate: assignSlaDate || undefined,
    });
    onUpdateResearchTicket?.(updated);
    showToast(
      `تم إسناد ملف عائلة (${selectedQueueItem.familyDisplay}) إلى ${chosen.name} بنجاح.`
    );
  };

  const handleSubmitLineageDecision = async () => {
    if (!selectedQueueItem) return;
    if (
      decisionStatus === 'verified_connected' &&
      !verifiedRootBranch.trim() &&
      !verifiedMotherTribe.trim()
    ) {
      showToast(
        'يرجى إدخال اسم الفرع/البطن أو القبيلة الأم المعتمدة لإثبات الربط.',
        'warning'
      );
      return;
    }
    if (decisionStatus === 'needs_client_info' && !clientQuestionText.trim()) {
      showToast('يرجى كتابة نص الاستفسار الموجّه للعميل أولاً.', 'warning');
      return;
    }

    setIsSavingDecision(true);
    try {
      const result = await submitOrApproveLineageDecision({
        actorRole: rbacRole,
        actorId: activeMember.id,
        actorName: activeMember.name,
        targetUser: selectedQueueItem.user,
        ticket: selectedQueueItem.ticket,
        decision: decisionStatus,
        verifiedRootBranch,
        verifiedMotherTribe,
        intermediateChainText,
        verifiedSourcesText,
        scholarlyNotes,
        clientQuestionText,
      });

      if (result.mode === 'submitted_for_approval' && result.draft) {
        setDrafts((prev) => [result.draft!, ...prev]);
        showToast(
          'تم رفع مسودة الربط المرجعي بنجاح إلى صندوق اعتماد مدير البحوث (لا تظهر للعميل قبل الاعتماد).',
          'info'
        );
      } else {
        if (result.updatedTicket) {
          onUpdateResearchTicket?.(result.updatedTicket);
        }
        setAllUsers((prev) =>
          prev.map((u) =>
            u.userId === selectedQueueItem.user.userId
              ? {
                  ...u,
                  lineageResearchStatus: decisionStatus,
                  lineageResearchStatusNote: scholarlyNotes || statusFallbackNote(decisionStatus),
                  isRootUnlocked:
                    decisionStatus === 'verified_connected'
                      ? true
                      : u.isRootUnlocked,
                }
              : u
          )
        );
        showToast(
          `✓ تم اعتماد قرار (${getLineageDecisionLabelAr(
            decisionStatus
          )}) ونشره فوراً في حساب عائلة ${selectedQueueItem.familyDisplay}.`
        );
      }

      // Dual Kashafi Injector: for Premium clients, also publish/stage a Kashafi discovery in the exact same click!
      if (
        dualKashafiEnabled &&
        selectedQueueItem.planTier === 'premium' &&
        (dualKashafiTitle.trim() || verifiedSourcesText.trim())
      ) {
        const kRes = await submitOrPublishKashafiDiscovery({
          actorRole: rbacRole,
          actorId: activeMember.id,
          actorName: activeMember.name,
          targetUser: selectedQueueItem.user,
          category: dualKashafiCategory,
          title:
            dualKashafiTitle.trim() ||
            `مرجع تاريخي موثق لعائلة ${selectedQueueItem.familyDisplay}`,
          summary:
            scholarlyNotes.trim() ||
            `توثيق مرجعي مرتبط بفرع ${verifiedRootBranch || selectedQueueItem.familyDisplay}`,
          details: [scholarlyNotes.trim(), verifiedSourcesText.trim()]
            .filter(Boolean)
            .join('\n\nالمراجع المعتمدة: '),
          bookTitle: verifiedSourcesText.split(/[؛\n]/)[0]?.trim() || undefined,
        });
        if (kRes.mode === 'submitted_for_approval' && kRes.draft) {
          setDrafts((prev) => [kRes.draft!, ...prev]);
        }
        setDualKashafiEnabled(false);
        showToast(
          isResearcherOnly
            ? '✦ تم رفع قرار النسب + بطاقة الإثراء المزدوج لـ «كشّافي *» إلى صندوق اعتماد مدير البحوث معاً.'
            : `✦ تم تحديث عمود النسب وإرسال بطاقة الإثراء المزدوج إلى «كشّافي *» لحساب عائلة ${selectedQueueItem.familyDisplay} فوراً!`
        );
      }

      // If Research Manager / Researcher also ticked historical vertical links, send ONLY historical links to Adam Sandbox (never direct write!)
      if (selectedVerticalLinkIds.length > 0) {
        await handleStageSelectedVerticalLinksToAdamSandbox();
      }
    } finally {
      setIsSavingDecision(false);
    }
  };

  function statusFallbackNote(st: LineageConnectionDecisionStatus): string {
    return getLineageDecisionLabelAr(st);
  }

  const handlePublishKashafi = async () => {
    if (!selectedKashafiUser) {
      showToast('يرجى اختيار عميل من باقة Premium أولاً.', 'warning');
      return;
    }
    if (!kashafiTitle.trim() || !kashafiSummary.trim()) {
      showToast(
        'يرجى إدخال عنوان المادة والملخص التعريفي قبل الحفظ.',
        'warning'
      );
      return;
    }
    setIsPublishingKashafi(true);
    try {
      const res = await submitOrPublishKashafiDiscovery({
        actorRole: rbacRole,
        actorId: activeMember.id,
        actorName: activeMember.name,
        targetUser: selectedKashafiUser,
        category: kashafiCategory,
        title: kashafiTitle.trim(),
        summary: kashafiSummary.trim(),
        details: kashafiDetails.trim() || kashafiSummary.trim(),
        bookTitle: kashafiBookTitle.trim() || undefined,
        bookAuthor: kashafiBookAuthor.trim() || undefined,
        centuryOrYear: kashafiCenturyOrYear.trim() || undefined,
        pageReference: kashafiPageRef.trim() || undefined,
        excerptQuote: kashafiExcerptQuote.trim() || undefined,
        documentImageUrl: kashafiDocumentImageUrl.trim() || undefined,
        deliverableUrl: kashafiDeliverableUrl.trim() || undefined,
      });

      if (res.mode === 'submitted_for_approval' && res.draft) {
        setDrafts((prev) => [res.draft!, ...prev]);
        showToast(
          'تم رفع مادة كشّافي إلى صندوق اعتماد مدير البحوث — لن تظهر للعميل حتى يتم تدقيقها واعتمادها.',
          'info'
        );
      } else {
        if (res.publishedItem) {
          setExistingKashafiItems((prev) => [res.publishedItem!, ...prev]);
        }
        showToast(
          `✦ تم نشر الاكتشاف التاريخي في «كشّافي» وإرسال إشعار فوري لعائلة ${
            selectedKashafiUser.familyName || selectedKashafiUser.fullName
          }.`
        );
      }

      // Reset form fields cleanly
      setKashafiTitle('');
      setKashafiSummary('');
      setKashafiDetails('');
      setKashafiExcerptQuote('');
      setKashafiPageRef('');
      setKashafiDocumentImageUrl('');
      setKashafiDeliverableUrl('');
    } finally {
      setIsPublishingKashafi(false);
    }
  };

  const handleDocumentImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.8 * 1024 * 1024) {
      showToast(
        'حجم صورة الوثيقة كبير (الحد الأقصى 1.8 ميجابايت) — يرجى استخدام نسخة مضغوطة أو رابط مباشر.',
        'warning'
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setKashafiDocumentImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleToggleFreeRadar = async (
    user: UserProfileData,
    activate: boolean,
    matchStrengthLabel: string,
    internalRootPreview?: string
  ) => {
    if (!isManagerOrSuper) return;
    setRadarBusyUserId(user.userId);
    try {
      const customTeaser = radarCustomTeaserByUser[user.userId]?.trim();
      const updatedSignal = await toggleFreeLeadRadarSignalForUser({
        targetUser: user,
        activate,
        managerName: activeMember.name,
        matchStrengthLabel,
        teaserNoteAr: customTeaser || undefined,
        matchedRootPreviewInternal: internalRootPreview,
      });
      setAllUsers((prev) =>
        prev.map((u) =>
          u.userId === user.userId
            ? { ...u, freeLeadRadarSignal: updatedSignal }
            : u
        )
      );
      showToast(
        activate
          ? `✦ تم تفعيل إشارة الرصد التحفيزية لحساب عائلة (${
              user.familyName || user.fullName
            }) دون كشف اسم الجذر.`
          : `تم إيقاف إشارة الرصد لحساب عائلة (${
              user.familyName || user.fullName
            }).`,
        activate ? 'success' : 'info'
      );
    } finally {
      setRadarBusyUserId(null);
    }
  };

  const handleApproveDraft = async (draft: ResearchApprovalDraftRecord) => {
    if (!isManagerOrSuper) return;
    const targetUser: UserProfileData = allUsers.find(
      (u) =>
        u.userId === draft.targetUserId ||
        (draft.targetUserEmail &&
          u.email.toLowerCase() === draft.targetUserEmail.toLowerCase())
    ) || {
      userId: draft.targetUserId,
      email: draft.targetUserEmail || '',
      fullName: draft.targetClientName,
      firstName: draft.targetClientName.split(' ')[0] || draft.targetClientName,
      fatherName: '',
      grandfatherName: '',
      familyName: draft.targetFamilyName,
      originCountry: 'السعودية',
      accountType: 'individual',
      subscriptionTier:
        draft.targetPlanTier === 'premium'
          ? 'premium_annual'
          : draft.targetPlanTier === 'basic'
          ? 'basic_verified'
          : 'free',
      walletBalance: 0,
      isRootUnlocked: true,
      unlockedCapsules: [],
      createdAt: draft.submittedAt,
    };

    const relatedTicket = draft.relatedTicketId
      ? researchTickets.find((t) => t.id === draft.relatedTicketId)
      : undefined;

    setIsProcessingDraft(true);
    try {
      const approved = await approveResearchDraftByManager({
        draft,
        managerId: activeMember.id,
        managerName: activeMember.name,
        targetUser,
        relatedTicket,
      });
      setDrafts((prev) =>
        prev.map((d) => (d.id === approved.id ? approved : d))
      );

      // When Research Manager approves a verified lineage connection draft, the customer's page updates immediately,
      // while the corresponding historical Adam Tree enrichment is safely queued in the Maestro Sovereign Sandbox!
      if (
        draft.draftKind === 'lineage_connection' &&
        draft.lineageDecision === 'verified_connected' &&
        (draft.verifiedRootBranch || draft.verifiedMotherTribe)
      ) {
        await stageAdamTreeProposal({
          actionType: 'add_vertical_link',
          targetNodeId: `ADAM-DRF-${draft.id.slice(-6)}`,
          targetNodeName: `آل ${draft.targetFamilyName}`,
          parentNodeId: 'ADAM_VERIFIED_PARENT',
          parentNodeName:
            draft.verifiedRootBranch || draft.verifiedMotherTribe || 'شجرة آدم',
          ancestralChainPreview:
            draft.intermediateChainText?.trim() ||
            `${draft.verifiedRootBranch || ''} ← ${draft.verifiedMotherTribe || ''}`.trim(),
          sourceReferenceText:
            draft.verifiedSourcesText?.trim() ||
            'توثيق معتمد من مدير البحوث',
          submittedByResearcherId: draft.submittedByResearcherId,
          submittedByResearcherName: draft.submittedByResearcherName,
          approvedByManagerId: activeMember.id,
          approvedByManagerName: activeMember.name,
          sourceTicketId: draft.relatedTicketId,
          sourceFamilyName: draft.targetFamilyName,
          firewallCheckInput: {
            name: `آل ${draft.targetFamilyName}`,
            isAlive: false,
            vitalStatus: 'deceased',
            generationLevel: 4,
            relationLabel: 'جد تاريخي جامع للعائلة',
            isHistoricalAncestor: true,
          },
        });
        const refreshedStaging = await fetchAdamStagingProposals();
        setAdamStagingProposals(refreshedStaging);
        showToast(
          `✓ تم اعتماد النتيجة ونشرها للعميل (${draft.targetFamilyName}) فوراً، كما أُرسل إثراء شجرة آدم إلى غرفة التصديق السيادي للمايسترو ⏳.`
        );
      } else {
        showToast(
          `✓ تم تدقيق واعتماد المسودة ونشرها مباشرةً في حساب عائلة ${draft.targetFamilyName}.`
        );
      }
    } finally {
      setIsProcessingDraft(false);
    }
  };

  const handleReturnDraft = async (draft: ResearchApprovalDraftRecord) => {
    if (!isManagerOrSuper) return;
    if (!managerReturnNotes.trim()) {
      showToast(
        'يرجى كتابة ملاحظات التصويب العلمية قبل إعادة المسودة للباحث.',
        'warning'
      );
      return;
    }
    setIsProcessingDraft(true);
    try {
      const returned = await returnResearchDraftToResearcher({
        draft,
        managerId: activeMember.id,
        managerName: activeMember.name,
        managerReviewNotes: managerReturnNotes,
      });
      setDrafts((prev) =>
        prev.map((d) => (d.id === returned.id ? returned : d))
      );
      setManagerReturnNotes('');
      showToast(
        `↺ تمت إعادة المسودة إلى الباحث (${draft.submittedByResearcherName}) مع ملاحظات التصويب.`,
        'info'
      );
    } finally {
      setIsProcessingDraft(false);
    }
  };

  const handleSaveResearcherSpecialty = async (member: TeamMemberRecord) => {
    const updated = await updateResearcherSpecialtyInFirebase(
      member,
      editSpecialtyRegion,
      editSpecialtyTribes
    );
    onUpdateStaffMember?.(updated);
    setEditingMemberId(null);
    showToast(`تم تحديث التخصص الجغرافي والقبلي للباحث (${member.name}).`);
  };

  const handleApplyCatalogToQueue = (entry: MasterLineageCatalogEntry) => {
    setVerifiedRootBranch(entry.rootName);
    setVerifiedMotherTribe(entry.motherTribe || '');
    if (entry.ancestralChainSummary) {
      setIntermediateChainText(entry.ancestralChainSummary);
    }
    const citation = [
      entry.bookTitle,
      entry.authorName,
      entry.centuryOrEra,
      entry.volumeOrPagesHint,
    ]
      .filter(Boolean)
      .join(' — ');
    setVerifiedSourcesText((prev) =>
      prev.trim() ? `${prev.trim()}\n${citation}` : citation
    );
    setActiveSubTab('lineage_queue');
    showToast(
      `تم سحب بيانات «${entry.rootName}» والمرجع الموثق مباشرةً إلى محرر الربط.`
    );
  };

  const handleApplyCatalogToKashafi = (entry: MasterLineageCatalogEntry) => {
    setKashafiCategory('sources');
    setKashafiBookTitle(entry.bookTitle || '');
    setKashafiBookAuthor(entry.authorName || '');
    setKashafiCenturyOrYear(entry.centuryOrEra || '');
    setKashafiPageRef(entry.volumeOrPagesHint || '');
    if (!kashafiTitle.trim()) {
      setKashafiTitle(`مرجع موثق حول ${entry.rootName}`);
    }
    if (entry.scholarlyNotes && !kashafiDetails.trim()) {
      setKashafiDetails(entry.scholarlyNotes);
    }
    setActiveSubTab('kashafi_studio');
    showToast(`تم استيراد المرجع «${entry.bookTitle || entry.rootName}» إلى استوديو كشّافي.`);
  };

  const handleSaveCatalogEntry = async () => {
    if (!catRootName.trim() || !catBookTitle.trim()) {
      showToast(
        'يرجى إدخال اسم الجذر/المرجع وعنوان الكتاب المصدري على الأقل.',
        'warning'
      );
      return;
    }
    setIsSavingCatalog(true);
    try {
      const saved = await saveMasterLineageCatalogEntry({
        id: editingCatalogId || undefined,
        entryKind: catEntryKind,
        rootName: catRootName.trim(),
        motherTribe: catMotherTribe.trim() || catRootName.trim(),
        ancestralChainSummary: catChainSummary.trim() || undefined,
        regions: catRegionsText
          .split(/[،,]+/)
          .map((s) => s.trim())
          .filter(Boolean),
        bookTitle: catBookTitle.trim(),
        authorName: catAuthorName.trim() || 'مرجع تراثي معتمد',
        centuryOrEra: catCenturyEra.trim() || undefined,
        volumeOrPagesHint: catPagesHint.trim() || undefined,
        scholarlyNotes: catNotes.trim() || undefined,
        addedByName: activeMember.name,
      });
      setCatalog((prev) => [saved, ...prev.filter((x) => x.id !== saved.id)]);
      setShowCatalogForm(false);
      setEditingCatalogId(null);
      setCatRootName('');
      setCatMotherTribe('');
      setCatChainSummary('');
      setCatRegionsText('');
      setCatBookTitle('');
      setCatAuthorName('');
      setCatCenturyEra('');
      setCatPagesHint('');
      setCatNotes('');
      showToast(`تم حفظ «${saved.rootName}» في جمهرة الجذور والمصادر المرجعية.`);
    } finally {
      setIsSavingCatalog(false);
    }
  };

  const handleDeleteCatalogEntry = async (entry: MasterLineageCatalogEntry) => {
    if (!isManagerOrSuper) return;
    await deleteMasterLineageCatalogEntry(entry.id);
    setCatalog((prev) => prev.filter((x) => x.id !== entry.id));
    showToast(`تم حذف «${entry.rootName}» من الجمهرة.`, 'info');
  };

  const openEditCatalogEntry = (entry: MasterLineageCatalogEntry) => {
    setEditingCatalogId(entry.id);
    setCatEntryKind(entry.entryKind);
    setCatRootName(entry.rootName);
    setCatMotherTribe(entry.motherTribe || '');
    setCatChainSummary(entry.ancestralChainSummary || '');
    setCatRegionsText(entry.regions.join('، '));
    setCatBookTitle(entry.bookTitle || '');
    setCatAuthorName(entry.authorName || '');
    setCatCenturyEra(entry.centuryOrEra || '');
    setCatPagesHint(entry.volumeOrPagesHint || '');
    setCatNotes(entry.scholarlyNotes || '');
    setShowCatalogForm(true);
  };

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <div
      dir="rtl"
      className="w-full space-y-6 text-[#1F1F1C]"
    >
      {/* 1. Unified Heritage Workspace Header */}
      <UnifiedWorkspaceHeader
        icon={<ScrollText className="w-5 h-5" />}
        title={
          isResearcherOnly
            ? 'مكتب الباحث المختص — التحقيق النسبي وكشّافي'
            : 'لوحة قيادة مدير البحوث وهيئة الأنساب'
        }
        metaItems={[
          <span key="role" className="font-semibold text-[#D97757]">
            {effectiveRole}
          </span>,
          <span key="name">{activeMember.name}</span>,
          <span key="rbac">
            {isResearcherOnly
              ? 'صلاحية مسودات فقط — تُرفع لاعتماد مدير البحوث'
              : 'صلاحية الإسناد والاعتماد العلمي والنشر المباشر'}
          </span>,
        ]}
        actions={
          <>
            {onOpenCompass && (
              <button
                type="button"
                onClick={onOpenCompass}
                className={WORKSPACE_SECONDARY_BTN_CLASS}
              >
                <Compass className="w-4 h-4 text-[#D97757]" />
                <span>فحص البوصلة الفوري</span>
              </button>
            )}
            {onOpenAdamTree && isManagerOrSuper && (
              <button
                type="button"
                onClick={onOpenAdamTree}
                className={WORKSPACE_SECONDARY_BTN_CLASS}
              >
                <GitBranch className="w-4 h-4 text-[#D97757]" />
                <span>شجرة آدم المرجعية</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                loadWorkspaceData();
                onRefreshStaffData?.();
              }}
              className={WORKSPACE_PRIMARY_BTN_CLASS}
              disabled={isLoadingData}
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoadingData ? 'animate-spin' : ''}`}
              />
              <span>تحديث البيانات الحية</span>
            </button>
          </>
        }
      />

      {/* Toast feedback strip */}
      {toastMessage && (
        <div
          role="status"
          className={`rounded-2xl px-4 py-3 border flex items-center justify-between gap-3 text-sm font-medium transition-all ${
            toastMessage.kind === 'success'
              ? 'bg-[#4D7C5B]/10 border-[#4D7C5B]/40 text-[#2E5239]'
              : toastMessage.kind === 'warning'
              ? 'bg-[#D97757]/12 border-[#D97757]/45 text-[#9B492E]'
              : 'bg-[#E8DED2] border-[#D8C7B2] text-[#1F1F1C]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {toastMessage.kind === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-xs underline underline-offset-2 opacity-75 hover:opacity-100 cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* 2. Top 4 Operational KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#FAF7F2] border border-[#D8C7B2] rounded-2xl p-4 shadow-2xs flex items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#1F1F1C]/65">
              {isResearcherOnly
                ? 'ملفاتي المسندة حالياً'
                : 'طلبات بانتظار الإسناد'}
            </p>
            <p className="text-2xl font-display font-bold tabular-nums text-[#1F1F1C]">
              {isResearcherOnly ? queueItems.length : kpiStats.unassignedCount}
            </p>
            <p className="text-[11px] text-[#1F1F1C]/55">
              {isResearcherOnly
                ? 'ملفات مخصّصة لك فقط'
                : `من إجمالي ${queueItems.length} ملف مدفوع`}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#E8DED2] border border-[#D8C7B2] flex items-center justify-center text-[#D97757] shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#FAF7F2] border border-[#D8C7B2] rounded-2xl p-4 shadow-2xs flex items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#1F1F1C]/65">
              {isResearcherOnly
                ? 'مسوداتي بانتظار الاعتماد'
                : 'مسودات بانتظار اعتمادي'}
            </p>
            <p className="text-2xl font-display font-bold tabular-nums text-[#D97757]">
              {kpiStats.pendingDraftsCount}
            </p>
            <p className="text-[11px] text-[#1F1F1C]/55">
              بوابة ضمان الجودة العلمية
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#D97757]/12 border border-[#D97757]/30 flex items-center justify-center text-[#D97757] shrink-0">
            <ClipboardCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#FAF7F2] border border-[#D8C7B2] rounded-2xl p-4 shadow-2xs flex items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#1F1F1C]/65">
              ملفات Premium ذات أولوية
            </p>
            <p className="text-2xl font-display font-bold tabular-nums text-[#1F1F1C]">
              {kpiStats.premiumPriorityCount}
            </p>
            <p className="text-[11px] text-[#1F1F1C]/55">
              ربط جذور + استوديو كشّافي
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#E8DED2] border border-[#D8C7B2] flex items-center justify-center text-[#D97757] shrink-0">
            <Crown className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#FAF7F2] border border-[#D8C7B2] rounded-2xl p-4 shadow-2xs flex items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#1F1F1C]/65">
              {isResearcherOnly
                ? 'مواد جمهرة الجذور المتاحة'
                : 'إشارات رادار المجاني الجاهزة'}
            </p>
            <p className="text-2xl font-display font-bold tabular-nums text-[#1F1F1C]">
              {isResearcherOnly ? catalog.length : kpiStats.readyRadarCount}
            </p>
            <p className="text-[11px] text-[#1F1F1C]/55">
              {isResearcherOnly
                ? 'جذور وأمهات كتب قابلة للسحب'
                : `مفعّل حالياً: ${radarMetrics.activeSignals} · تحويل: ${radarMetrics.conversionPct}%`}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#E8DED2] border border-[#D8C7B2] flex items-center justify-center text-[#D97757] shrink-0">
            {isResearcherOnly ? (
              <BookOpen className="w-5 h-5" />
            ) : (
              <Radar className="w-5 h-5" />
            )}
          </div>
        </div>
      </section>

      {/* 3. Five Operational Sub-Tabs Bar */}
      <nav
        aria-label="أقسام لوحة مدير البحوث"
        className="bg-[#E8DED2]/70 border border-[#D8C7B2] rounded-2xl p-1.5 flex flex-wrap items-center gap-1.5"
      >
        {(
          [
            {
              id: 'lineage_queue' as ResearchSubTab,
              label: '1. طابور طلبات ربط الجذور',
              badge: queueItems.length,
              icon: GitBranch,
            },
            {
              id: 'kashafi_studio' as ResearchSubTab,
              label: '2. استوديو إثراء كشّافي',
              badge: premiumClients.length,
              icon: Sparkles,
            },
            {
              id: 'free_radar' as ResearchSubTab,
              label: '3. رادار التحويل للمجاني',
              badge: isManagerOrSuper ? radarMetrics.totalFree : undefined,
              icon: Radar,
              managerOnly: true,
            },
            {
              id: 'approval_inbox' as ResearchSubTab,
              label: isResearcherOnly
                ? '4. مسوداتي وملاحظات المدير'
                : '4. صندوق الاعتماد وفريق الباحثين',
              badge: kpiStats.pendingDraftsCount,
              icon: ClipboardCheck,
            },
            {
              id: 'master_library' as ResearchSubTab,
              label: '5. جمهرة الجذور والمصادر',
              badge: catalog.length,
              icon: BookOpen,
            },
          ] as Array<{
            id: ResearchSubTab;
            label: string;
            badge?: number;
            icon: React.FC<{ className?: string }>;
            managerOnly?: boolean;
          }>
        ).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex-1 min-w-[165px] h-11 px-3.5 rounded-xl text-[13px] font-display font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#FAF7F2] text-[#D97757] border border-[#D97757]/50 shadow-xs'
                  : 'text-[#1F1F1C]/80 hover:bg-[#FAF7F2]/60 border border-transparent'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{tab.label}</span>
              {tab.managerOnly && isResearcherOnly ? (
                <Lock className="w-3.5 h-3.5 opacity-60 shrink-0" />
              ) : typeof tab.badge === 'number' ? (
                <span
                  className={`px-2 py-0.5 rounded-md text-[11px] tabular-nums font-bold ${
                    isActive
                      ? 'bg-[#D97757] text-[#F5F1E8]'
                      : 'bg-[#F5F1E8] text-[#1F1F1C]/75 border border-[#D8C7B2]'
                  }`}
                >
                  {tab.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* ===================================================================== */}
      {/* TAB 1: LINEAGE CONNECTION QUEUE (BASIC & PREMIUM)                     */}
      {/* ===================================================================== */}
      {activeSubTab === 'lineage_queue' && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Right List Column (5 cols) */}
          <div className="lg:col-span-5 bg-[#FAF7F2] border border-[#D8C7B2] rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-display font-bold text-[#1F1F1C]">
                طابور ربط الجذور (Basic & Premium)
              </h2>
              <span className="text-xs text-[#1F1F1C]/60 tabular-nums">
                {filteredQueueItems.length} ملف
              </span>
            </div>

            {isResearcherOnly && (
              <div className="rounded-xl bg-[#E8DED2]/70 border border-[#D8C7B2] p-3 text-xs text-[#1F1F1C]/80 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-[#D97757] shrink-0 mt-0.5" />
                <span>
                  عزل الصلاحيات مفعّل: تظهر لك هنا الملفات المُسندة إليك فقط من
                  مدير البحوث، وتُرفع نتائجك للمراجعة قبل النشر للعميل.
                </span>
              </div>
            )}

            {/* Search & Plan Filter */}
            <div className="space-y-2.5">
              <div className="relative">
                <Search className="w-4 h-4 text-[#1F1F1C]/45 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={queueSearch}
                  onChange={(e) => setQueueSearch(e.target.value)}
                  placeholder="ابحث باسم العائلة، القبيلة، الديرة، أو الباحث..."
                  className="w-full h-10 pr-9 pl-3 rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] text-sm focus:outline-none focus:border-[#D97757]"
                />
              </div>

              <div className="flex items-center gap-1.5">
                {(
                  [
                    { id: 'all', label: 'الكل' },
                    { id: 'premium', label: 'Premium فقط' },
                    { id: 'basic', label: 'Basic فقط' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setQueuePlanFilter(f.id)}
                    className={`flex-1 h-8 rounded-lg text-xs font-display font-semibold border transition-all cursor-pointer ${
                      queuePlanFilter === f.id
                        ? 'bg-[#D97757] text-[#F5F1E8] border-[#D97757]'
                        : 'bg-[#F5F1E8] text-[#1F1F1C]/75 border-[#D8C7B2] hover:bg-[#E8DED2]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Queue List */}
            <div className="space-y-2.5 max-h-[620px] overflow-y-auto pl-1">
              {filteredQueueItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#D8C7B2] bg-[#F5F1E8]/70 p-6 text-center space-y-2">
                  <GitBranch className="w-7 h-7 text-[#D97757]/60 mx-auto" />
                  <p className="text-sm font-semibold text-[#1F1F1C]">
                    {isResearcherOnly
                      ? 'لا توجد ملفات مسندة إليك حالياً'
                      : 'لا توجد طلبات مطابقة للفلتر الحالي'}
                  </p>
                  <p className="text-xs text-[#1F1F1C]/60">
                    {isResearcherOnly
                      ? 'عندما يسند مدير البحوث إليك ملف ربط جذور سيظهر هنا فوراً.'
                      : 'جرّب تغيير الفلتر أو اضغط تحديث البيانات الحية.'}
                  </p>
                </div>
              ) : (
                filteredQueueItems.map((item) => {
                  const isSelected = selectedQueueItem?.key === item.key;
                  const statusBadge = item.user.lineageResearchStatus
                    ? getLineageDecisionLabelAr(item.user.lineageResearchStatus)
                    : item.user.verifiedLineageSnapshot?.matched
                    ? 'مطابقة أولية'
                    : 'قيد التحقيق';
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setSelectedQueueKey(item.key)}
                      className={`w-full text-right rounded-xl p-3.5 border transition-all cursor-pointer space-y-2 ${
                        isSelected
                          ? 'bg-[#FDFBF7] border-[#D97757] shadow-sm'
                          : 'bg-[#F5F1E8]/80 border-[#D8C7B2] hover:bg-[#FDFBF7]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-display font-bold text-[#1F1F1C] truncate">
                            عائلة {item.familyDisplay}
                          </p>
                          <p className="text-xs text-[#1F1F1C]/65 truncate">
                            {item.user.fullName}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold shrink-0 ${getPlanBadgeClasses(
                            item.planTier
                          )}`}
                        >
                          {item.planTier === 'premium' ? 'Premium' : 'Basic'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#1F1F1C]/65">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[#D97757]" />
                          {item.locationDisplay}
                        </span>
                        {item.assignedToName ? (
                          <span className="inline-flex items-center gap-1 text-[#2E5239] font-medium">
                            <UserCheck className="w-3 h-3" />
                            {item.assignedToName}
                          </span>
                        ) : (
                          <span className="text-[#9B492E] font-medium">
                            غير مسند بعد
                          </span>
                        )}
                      </div>

                      {(() => {
                        const sla = computeTicketSlaStatus(
                          item.ticket?.openedAt || item.user.createdAt,
                          item.planTier === 'premium',
                          item.user.lineageResearchStatus === 'verified_connected'
                        );
                        return (
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-[#D8C7B2]/60 text-[11px]">
                            <span className="text-[#1F1F1C]/70 truncate">
                              {statusBadge}
                            </span>
                            <span className="inline-flex items-center gap-1.5 shrink-0 tabular-nums">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  sla.tier === 'red'
                                    ? 'bg-[#9E2A2B]'
                                    : sla.tier === 'amber'
                                    ? 'bg-[#C8844A]'
                                    : 'bg-[#2E5239]'
                                }`}
                              />
                              <span className={sla.badgeClassName}>
                                {sla.labelAr}
                              </span>
                            </span>
                          </div>
                        );
                      })()}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Left Workspace Detail & 4-State Decision Editor (7 cols) */}
          <div className="lg:col-span-7 bg-[#FAF7F2] border border-[#D8C7B2] rounded-2xl p-5 space-y-5">
            {!selectedQueueItem ? (
              <div className="py-16 text-center space-y-2 text-[#1F1F1C]/60">
                <Layers className="w-9 h-9 mx-auto text-[#D97757]/50" />
                <p className="text-sm font-semibold">
                  اختر ملفاً من الطابور لاستعراض بيانات العميل وبدء التحقيق
                </p>
              </div>
            ) : (
              <>
                {/* Selected Client Dossier Summary */}
                <div className="rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-display font-bold text-[#1F1F1C]">
                          ملف ربط جذور عائلة {selectedQueueItem.familyDisplay}
                        </h3>
                        <span
                          className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${getPlanBadgeClasses(
                            selectedQueueItem.planTier
                          )}`}
                        >
                          {getPlanLabelAr(selectedQueueItem.planTier)}
                        </span>
                      </div>
                      <p className="text-xs text-[#1F1F1C]/70 mt-1">
                        العميل: {selectedQueueItem.user.fullName} ·{' '}
                        {selectedQueueItem.user.email}
                      </p>
                    </div>
                    {selectedQueueItem.ticket?.ticketNumber && (
                      <span className="px-2.5 py-1 rounded-lg bg-[#FDFBF7] border border-[#D8C7B2] text-xs font-mono font-semibold text-[#1F1F1C]">
                        #{selectedQueueItem.ticket.ticketNumber}
                      </span>
                    )}
                  </div>

                  {/* Client Lineage Inputs Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                    <div className="bg-[#FDFBF7] border border-[#D8C7B2]/80 rounded-xl p-2.5">
                      <span className="block text-[10.5px] text-[#1F1F1C]/55">
                        عمود الاسم المدخل
                      </span>
                      <span className="font-semibold text-[#1F1F1C]">
                        {[
                          selectedQueueItem.user.firstName,
                          selectedQueueItem.user.fatherName,
                          selectedQueueItem.user.grandfatherName,
                        ]
                          .filter(Boolean)
                          .join(' بن ') || selectedQueueItem.user.fullName}
                      </span>
                    </div>
                    <div className="bg-[#FDFBF7] border border-[#D8C7B2]/80 rounded-xl p-2.5">
                      <span className="block text-[10.5px] text-[#1F1F1C]/55">
                        القبيلة / الفرع المصرح به
                      </span>
                      <span className="font-semibold text-[#1F1F1C]">
                        {[
                          selectedQueueItem.user.tribeName,
                          selectedQueueItem.user.familyBranch,
                        ]
                          .filter(Boolean)
                          .join(' · ') || 'غير مصرح به'}
                      </span>
                    </div>
                    <div className="bg-[#FDFBF7] border border-[#D8C7B2]/80 rounded-xl p-2.5">
                      <span className="block text-[10.5px] text-[#1F1F1C]/55">
                        الموطن والديرة
                      </span>
                      <span className="font-semibold text-[#1F1F1C]">
                        {selectedQueueItem.locationDisplay}
                      </span>
                    </div>
                    <div className="bg-[#FDFBF7] border border-[#D8C7B2]/80 rounded-xl p-2.5">
                      <span className="block text-[10.5px] text-[#1F1F1C]/55">
                        الشجرة المعاصرة للعميل
                      </span>
                      <span className="font-semibold text-[#D97757] tabular-nums">
                        {treePreview.loading
                          ? 'جارٍ القراءة...'
                          : `${treePreview.totalMembers} فرد · ${treePreview.generationsEstimate} أجيال`}
                      </span>
                    </div>
                  </div>

                  {treePreview.sampleNames.length > 0 && (
                    <p className="text-[11.5px] text-[#1F1F1C]/70">
                      <span className="font-semibold text-[#1F1F1C]">
                        أبرز الأسماء في شجرة العميل:{' '}
                      </span>
                      {treePreview.sampleNames.join(' · ')}
                    </p>
                  )}
                </div>

                {/* ZERO-CLICK AUTO-COMPASS INSIDE TICKET */}
                <div className="rounded-2xl bg-[#FDFBF7] border border-[#D8C7B2] p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Compass className="w-4 h-4 text-[#D97757]" />
                      <h4 className="text-xs sm:text-[13px] font-display font-extrabold text-[#1F1F1C]">
                        الفحص التلقائي المدمج لبوصلة الجذور (شجرة آدم)
                      </h4>
                    </div>
                    <span className="text-[11px] text-[#1F1F1C]/60">
                      أعلى المسارات المرشحة — اختر العقدة الأم بنقرة واحدة
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5">
                    {autoCompassMatches.map((cand) => {
                      const isPicked = selectedCompassParentId === cand.parentNodeId;
                      return (
                        <div
                          key={cand.id}
                          className={`rounded-xl p-3 border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            isPicked
                              ? 'bg-[#FAF6EE] border-[#D97757] ring-1 ring-[#D97757]/30'
                              : 'bg-[#F5F1E8]/65 border-[#D8C7B2]/80 hover:border-[#D97757]/55'
                          }`}
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 text-xs font-display font-bold">
                              <span className="text-[#1F1F1C]">
                                {cand.parentNodeName}
                              </span>
                              <span aria-hidden="true" className="text-[#D8C7B2]">
                                ·
                              </span>
                              <span className="text-[#2E5239] tabular-nums">
                                تطابق {cand.confidencePercent}%
                              </span>
                            </div>
                            <p className="text-[11px] text-[#D97757] leading-relaxed">
                              {cand.adamChainPreview}
                            </p>
                            <p className="text-[11px] text-[#1F1F1C]/65">
                              {cand.matchReasonAr} · المرجع: {cand.matchedSources[0]}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleApplyAutoCompassCandidate(cand)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-display font-bold shrink-0 cursor-pointer transition-colors ${
                              isPicked
                                ? 'bg-[#2E5239] text-[#F5F1E8]'
                                : 'bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8]'
                            }`}
                          >
                            {isPicked ? '✓ تم اختيار العقدة' : 'اختيار وتعبئة المسار'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* STRICT LIVING-PERSONS FIREWALL & VERTICAL HISTORICAL LINK EXTRACTOR */}
                <div className="rounded-2xl bg-[#FAF6EE] border border-[#D8C7B2] p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <h4 className="text-xs sm:text-[13px] font-display font-extrabold text-[#1F1F1C] inline-flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-[#2E5239]" />
                        <span>
                          مستخلص الحلقات العمودية التاريخية المفقودة (جدار حماية الأحياء مفعّل)
                        </span>
                      </h4>
                      <p className="text-[11px] text-[#1F1F1C]/65">
                        يُمنع برمجياً نقل الأحياء والأبناء والأحفاد إلى شجرة آدم — تُعزل البيانات المعاصرة تلقائياً في بحيرة القرابة (Contemporary Kinship Lake).
                      </p>
                    </div>
                    <span className="text-[11px] font-display font-bold text-[#2E5239] shrink-0">
                      معزول بأمان: {firewallPartition.isolatedContemporaryCount} معاصر
                    </span>
                  </div>

                  <div className="space-y-2">
                    {firewallPartition.eligibleHistoricalLinks.map((link) => {
                      const checked = selectedVerticalLinkIds.includes(link.id);
                      return (
                        <label
                          key={link.id}
                          className={`flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 border cursor-pointer transition-colors ${
                            checked
                              ? 'bg-[#FDFBF7] border-[#D97757]'
                              : 'bg-[#FDFBF7]/70 border-[#D8C7B2]/80 hover:bg-[#FDFBF7]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setSelectedVerticalLinkIds((prev) =>
                                  prev.includes(link.id)
                                    ? prev.filter((id) => id !== link.id)
                                    : [...prev, link.id]
                                )
                              }
                              className="w-4 h-4 accent-[#D97757] rounded cursor-pointer"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-display font-bold text-[#1F1F1C] truncate">
                                {link.name}
                              </p>
                              <p className="text-[10.5px] text-[#1F1F1C]/60 truncate">
                                {link.relationLabel}
                                {link.birthOrEraHint ? ` · ${link.birthOrEraHint}` : ''}
                              </p>
                            </div>
                          </div>
                          <span className="text-[10.5px] font-display font-bold text-[#2E5239] shrink-0">
                            جد تاريخي مؤهل ✓
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] text-[#1F1F1C]/65">
                      تُرسل الحلقات المختارة إلى طبقة Sandbox شجرة آدم (قيد التصديق النهائي للمايسترو ⏳)
                    </span>
                    <button
                      type="button"
                      disabled={
                        stagingVerticalLinkBusy ||
                        selectedVerticalLinkIds.length === 0
                      }
                      onClick={handleStageSelectedVerticalLinksToAdamSandbox}
                      className="px-3.5 py-1.5 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] disabled:opacity-45 border border-[#D8C7B2] text-xs font-display font-bold text-[#1F1F1C] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <GitBranch className="w-3.5 h-3.5 text-[#D97757]" />
                      <span>
                        {stagingVerticalLinkBusy
                          ? 'جارٍ الرفع للـ Sandbox...'
                          : `اقتراح تطعيم (${selectedVerticalLinkIds.length}) في Sandbox شجرة آدم`}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Manager-Only Assignment & SLA Bar */}
                {isManagerOrSuper && selectedQueueItem.ticket && (
                  <div className="rounded-2xl bg-[#E8DED2]/55 border border-[#D8C7B2] p-3.5 flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[180px] space-y-1">
                      <label className="text-xs font-semibold text-[#1F1F1C]">
                        إسناد الملف إلى باحث مختص
                      </label>
                      <select
                        value={assignResearcherId}
                        onChange={(e) => setAssignResearcherId(e.target.value)}
                        className="w-full h-9 px-3 rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] text-xs font-medium focus:outline-none focus:border-[#D97757]"
                      >
                        <option value="">— اختر باحثاً من الفريق —</option>
                        {researchTeamMembers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.role})
                            {m.specialtyRegion ? ` · ${m.specialtyRegion}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-44 space-y-1">
                      <label className="text-xs font-semibold text-[#1F1F1C]">
                        تاريخ الاستحقاق المستهدف
                      </label>
                      <input
                        type="date"
                        value={assignSlaDate}
                        onChange={(e) => setAssignSlaDate(e.target.value)}
                        className="w-full h-9 px-2.5 rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] text-xs focus:outline-none focus:border-[#D97757]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAssignResearcher}
                      className="h-9 px-4 rounded-xl bg-[#F5F1E8] hover:bg-[#FDFBF7] text-[#1F1F1C] border border-[#D8C7B2] text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-[#D97757]" />
                      <span>حفظ الإسناد</span>
                    </button>
                  </div>
                )}

                {/* Quick Pull from Master Library */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <h4 className="text-sm font-display font-bold text-[#1F1F1C]">
                    القرار العلمي المعتمد ذو الحالات الأربع
                  </h4>
                  <div className="flex items-center gap-2">
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        const found = catalog.find(
                          (c) => c.id === e.target.value
                        );
                        if (found) handleApplyCatalogToQueue(found);
                        e.target.value = '';
                      }}
                      className="h-8 px-2.5 rounded-lg bg-[#F5F1E8] border border-[#D8C7B2] text-xs font-medium text-[#1F1F1C] cursor-pointer"
                    >
                      <option value="">
                        ✦ سحب جذر ومرجع من الجمهرة بنقرة واحدة...
                      </option>
                      {catalog.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.rootName} — {c.bookTitle}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 4-State Decision Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {DECISION_OPTIONS.map((opt) => {
                    const active = decisionStatus === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setDecisionStatus(opt.id)}
                        className={`text-right rounded-xl p-3 border transition-all cursor-pointer space-y-1 ${
                          active
                            ? `${opt.accent} shadow-xs ring-1 ring-[#D97757]/40`
                            : 'bg-[#FDFBF7] border-[#D8C7B2] hover:bg-[#F5F1E8]'
                        }`}
                      >
                        <p className="text-xs font-display font-bold">
                          {opt.title}
                        </p>
                        <p className="text-[11px] opacity-80 leading-relaxed">
                          {opt.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Dynamic Decision Form Fields */}
                <div className="space-y-3.5 pt-1">
                  {decisionStatus === 'needs_client_info' ? (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[#1F1F1C]">
                        نص الاستفسار أو الوثيقة المطلوبة من العميل
                      </label>
                      <textarea
                        rows={4}
                        value={clientQuestionText}
                        onChange={(e) => setClientQuestionText(e.target.value)}
                        placeholder="مثال: لتأكيد التقاطع بين فرعكم والبطن المرجعي، نرجو تزويدنا باسم الجد الخامس أو البلدة التاريخية التي انتقل منها الجد الأكبر..."
                        className="w-full p-3 rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] text-sm focus:outline-none focus:border-[#D97757]"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-[#1F1F1C]">
                            الفرع / البطن الموثق
                          </label>
                          <input
                            type="text"
                            value={verifiedRootBranch}
                            onChange={(e) =>
                              setVerifiedRootBranch(e.target.value)
                            }
                            placeholder="مثال: بنو عمرو بن تميم"
                            className="w-full h-10 px-3 rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] text-sm focus:outline-none focus:border-[#D97757]"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-[#1F1F1C]">
                            القبيلة الأم المعتمدة
                          </label>
                          <input
                            type="text"
                            value={verifiedMotherTribe}
                            onChange={(e) =>
                              setVerifiedMotherTribe(e.target.value)
                            }
                            placeholder="مثال: قبيلة تميم (مضر العدنانية)"
                            className="w-full h-10 px-3 rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] text-sm focus:outline-none focus:border-[#D97757]"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-[#1F1F1C]">
                          سلسلة الحلقات المرجعية الوسيطة (افصل بينها بفاصلة أو ←)
                        </label>
                        <input
                          type="text"
                          value={intermediateChainText}
                          onChange={(e) =>
                            setIntermediateChainText(e.target.value)
                          }
                          placeholder="مثال: بنو العنبر ← عمرو ← تميم ← مر ← أد ← طابخة ← إلياس ← مضر"
                          className="w-full h-10 px-3 rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] text-sm focus:outline-none focus:border-[#D97757]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-[#1F1F1C]">
                          المصادر والمراجع المعتمدة (الكتاب، المؤلف، الجزء/الصفحة)
                        </label>
                        <textarea
                          rows={2}
                          value={verifiedSourcesText}
                          onChange={(e) =>
                            setVerifiedSourcesText(e.target.value)
                          }
                          placeholder="مثال: جمهرة أنساب العرب لابن حزم (ص 207)؛ معجم قبائل العرب لعمر رضا كحالة (ج 1 ص 128)"
                          className="w-full p-3 rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] text-sm focus:outline-none focus:border-[#D97757]"
                        />
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-xs font-semibold text-[#1F1F1C]">
                        الملاحظة العلمية والبيان المعروض للعميل
                      </label>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(
                          [
                            { id: 'verified_lineage_macro', label: 'قالب ربط موثق' },
                            { id: 'partial_overlap_macro', label: 'قالب تقاطع جزئي' },
                            { id: 'request_document_macro', label: 'قالب طلب وثيقة' },
                            { id: 'insufficient_sources_macro', label: 'قالب عدم كفاية المصادر' },
                          ] as const
                        ).map((macro) => (
                          <button
                            key={macro.id}
                            type="button"
                            onClick={() => handleApplyScholarlyMacro(macro.id)}
                            className="px-2.5 py-1 rounded-lg bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] text-[11px] font-display font-bold text-[#1F1F1C] cursor-pointer transition-colors"
                          >
                            ✦ {macro.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea
                      rows={3}
                      value={scholarlyNotes}
                      onChange={(e) => setScholarlyNotes(e.target.value)}
                      placeholder="خلاصة التحقيق العلمي أو أسباب الحالة المختارة بصياغة علمية رصينة وواضحة..."
                      className="w-full p-3 rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] text-sm focus:outline-none focus:border-[#D97757]"
                    />
                  </div>

                  {/* Dual Kashafi Injector — One-Click Premium Enrichment inside the Ticket */}
                  {selectedQueueItem.planTier === 'premium' && (
                    <div className="rounded-xl bg-[#FAF6EE] border border-[#D97757]/45 p-3.5 space-y-2.5">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={dualKashafiEnabled}
                          onChange={(e) => setDualKashafiEnabled(e.target.checked)}
                          className="w-4 h-4 accent-[#D97757] rounded cursor-pointer"
                        />
                        <span className="text-xs font-display font-bold text-[#1F1F1C] inline-flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-[#D97757]" />
                          <span>
                            الإثراء المزدوج الفوري: إرسال المرجع/الوثيقة المكتشفة مباشرةً كبطاقة جديدة في تبويب «كشّافي *» للعميل عند الحفظ
                          </span>
                        </span>
                      </label>
                      {dualKashafiEnabled && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                          <input
                            type="text"
                            value={dualKashafiTitle}
                            onChange={(e) => setDualKashafiTitle(e.target.value)}
                            placeholder="عنوان بطاقة كشّافي..."
                            className="sm:col-span-2 h-9 px-3 rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] text-xs focus:outline-none focus:border-[#D97757]"
                          />
                          <select
                            value={dualKashafiCategory}
                            onChange={(e) =>
                              setDualKashafiCategory(
                                e.target.value as KashafiDiscoveryCategory
                              )
                            }
                            className="h-9 px-2.5 rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] text-xs font-semibold cursor-pointer"
                          >
                            {KASHAFI_CATEGORIES.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Submit CTA */}
                <div className="pt-2 border-t border-[#D8C7B2] flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-[#1F1F1C]/65">
                    {isResearcherOnly
                      ? 'سيتم حفظ عملك كمسودة بانتظار تدقيق واعتماد مدير البحوث.'
                      : 'سيُحدَّث عمود النسب لدى العميل فوراً مع إشعار رسمي معتمد.'}
                  </p>
                  <button
                    type="button"
                    onClick={handleSubmitLineageDecision}
                    disabled={isSavingDecision}
                    className={WORKSPACE_PRIMARY_BTN_CLASS}
                  >
                    {isResearcherOnly ? (
                      <>
                        <Send className="w-4 h-4" />
                        <span>
                          {isSavingDecision
                            ? 'جارٍ الرفع...'
                            : 'رفع المسودة لاعتماد مدير البحوث'}
                        </span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          {isSavingDecision
                            ? 'جارٍ الاعتماد...'
                            : '✓ اعتماد ونشر النتيجة مباشرةً للعميل'}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: KASHAFI DISCOVERY PUBLISHER (PREMIUM EXCLUSIVE)                */}
      {/* ===================================================================== */}
      {activeSubTab === 'kashafi_studio' && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Right Panel: Premium Clients Selector (4 cols) */}
          <div className="lg:col-span-4 bg-[#FAF7F2] border border-[#D8C7B2] rounded-2xl p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-display font-bold text-[#1F1F1C]">
                عملاء الباقة المميزة (Premium)
              </h2>
              <span className="px-2 py-0.5 rounded-md bg-[#D97757] text-[#F5F1E8] text-xs font-bold tabular-nums">
                {premiumClients.length}
              </span>
            </div>
            <p className="text-xs text-[#1F1F1C]/65 leading-relaxed">
              تظهر مواد «كشّافي *» حصرياً لمشتركي باقة Premium. اختر عائلة
              لإضافة المصادر أو الوثائق أو السير أو الاكتشافات المستمرة.
            </p>

            <div className="space-y-2 max-h-[540px] overflow-y-auto pl-1">
              {premiumClients.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#D8C7B2] bg-[#F5F1E8] p-5 text-center text-xs text-[#1F1F1C]/65">
                  لا يوجد عملاء Premium متاحون في نطاقك حالياً.
                </div>
              ) : (
                premiumClients.map((u) => {
                  const active = selectedKashafiUser?.userId === u.userId;
                  return (
                    <button
                      key={u.userId}
                      type="button"
                      onClick={() => setSelectedKashafiUserId(u.userId)}
                      className={`w-full text-right rounded-xl p-3 border transition-all cursor-pointer ${
                        active
                          ? 'bg-[#FDFBF7] border-[#D97757] shadow-xs'
                          : 'bg-[#F5F1E8]/80 border-[#D8C7B2] hover:bg-[#FDFBF7]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-display font-bold text-[#1F1F1C] truncate">
                          عائلة {u.familyName || u.fullName}
                        </span>
                        <Crown className="w-3.5 h-3.5 text-[#D97757] shrink-0" />
                      </div>
                      <p className="text-[11.5px] text-[#1F1F1C]/65 truncate mt-0.5">
                        {u.fullName} · {u.originCountry}
                        {u.originRegion ? ` (${u.originRegion})` : ''}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Left Panel: 4-Category Authoring Studio + Published Items (8 cols) */}
          <div className="lg:col-span-8 space-y-5">
            <div className="bg-[#FAF7F2] border border-[#D8C7B2] rounded-2xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-display font-bold text-[#1F1F1C]">
                    استوديو إعداد ونشر مواد «كشّافي *»
                  </h3>
                  {selectedKashafiUser && (
                    <p className="text-xs text-[#D97757] font-semibold mt-0.5">
                      العميل المستهدف: عائلة{' '}
                      {selectedKashafiUser.familyName ||
                        selectedKashafiUser.fullName}{' '}
                      ({selectedKashafiUser.email})
                    </p>
                  )}
                </div>

                <select
                  defaultValue=""
                  onChange={(e) => {
                    const found = catalog.find((c) => c.id === e.target.value);
                    if (found) handleApplyCatalogToKashafi(found);
                    e.target.value = '';
                  }}
                  className="h-9 px-3 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] text-xs font-medium text-[#1F1F1C] cursor-pointer"
                >
                  <option value="">✦ استيراد مرجع من الجمهرة...</option>
                  {catalog.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.bookTitle} ({c.authorName})
                    </option>
                  ))}
                </select>
              </div>

              {/* 4 Category Selector */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {KASHAFI_CATEGORIES.map((cat) => {
                  const active = kashafiCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setKashafiCategory(cat.id)}
                      className={`rounded-xl p-2.5 text-right border transition-all cursor-pointer ${
                        active
                          ? 'bg-[#D97757] text-[#F5F1E8] border-[#D97757] shadow-xs'
                          : 'bg-[#F5F1E8] text-[#1F1F1C] border-[#D8C7B2] hover:bg-[#E8DED2]'
                      }`}
                    >
                      <p className="text-xs font-display font-bold">
                        {cat.shortLabel}
                      </p>
                      <p
                        className={`text-[10.5px] mt-0.5 line-clamp-2 ${
                          active ? 'text-[#F5F1E8]/85' : 'text-[#1F1F1C]/60'
                        }`}
                      >
                        {cat.hint}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Core Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-[#1F1F1C]">
                    عنوان الاكتشاف أو المادة التاريخية
                  </label>
                  <input
                    type="text"
                    value={kashafiTitle}
                    onChange={(e) => setKashafiTitle(e.target.value)}
                    placeholder="مثال: ذكر فرع العائلة في جمهرة أنساب العرب — موطن نجد القرن الخامس الهجري"
                    className="w-full h-10 px-3 rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] text-sm focus:outline-none focus:border-[#D97757]"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-[#1F1F1C]">
                    الملخص التنفيذي للبطاقة
                  </label>
                  <input
                    type="text"
                    value={kashafiSummary}
                    onChange={(e) => setKashafiSummary(e.target.value)}
                    placeholder="سطر موجز يبرز قيمة هذا الاكتشاف التاريخي للعميل..."
                    className="w-full h-10 px-3 rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] text-sm focus:outline-none focus:border-[#D97757]"
                  />
                </div>

                {/* Scholarly Reference Fields (especially for Sources / Ongoing / Stories) */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#1F1F1C]">
                    اسم الكتاب / المصدر المرجعي
                  </label>
                  <input
                    type="text"
                    value={kashafiBookTitle}
                    onChange={(e) => setKashafiBookTitle(e.target.value)}
                    placeholder="مثال: نهاية الأرب في معرفة أنساب العرب"
                    className="w-full h-10 px-3 rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] text-sm focus:outline-none focus:border-[#D97757]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#1F1F1C]">
                    المؤلف / الجهة المحققة
                  </label>
                  <input
                    type="text"
                    value={kashafiBookAuthor}
                    onChange={(e) => setKashafiBookAuthor(e.target.value)}
                    placeholder="مثال: أبو العباس القلقشندي"
                    className="w-full h-10 px-3 rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] text-sm focus:outline-none focus:border-[#D97757]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#1F1F1C]">
                    القرن / الحقبة التاريخية
                  </label>
                  <input
                    type="text"
                    value={kashafiCenturyOrYear}
                    onChange={(e) => setKashafiCenturyOrYear(e.target.value)}
                    placeholder="مثال: القرن التاسع الهجري"
                    className="w-full h-10 px-3 rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] text-sm focus:outline-none focus:border-[#D97757]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#1F1F1C]">
                    المجلد / رقم الصفحة
                  </label>
                  <input
                    type="text"
                    value={kashafiPageRef}
                    onChange={(e) => setKashafiPageRef(e.target.value)}
                    placeholder="مثال: ج 2 · ص 328"
                    className="w-full h-10 px-3 rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] text-sm focus:outline-none focus:border-[#D97757]"
                  />
                </div>
              </div>

              {/* Document Upload / URL for Documents category (also available as optional attachment) */}
              {kashafiCategory === 'documents' && (
                <div className="rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] p-3.5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#1F1F1C] inline-flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-[#D97757]" />
                      إرفاق صورة الوثيقة أو المخطوطة التاريخية
                    </span>
                    <label className="h-8 px-3 rounded-lg bg-[#FDFBF7] hover:bg-[#E8DED2] border border-[#D8C7B2] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer">
                      <Upload className="w-3.5 h-3.5 text-[#D97757]" />
                      <span>رفع صورة من الجهاز</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleDocumentImageUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <input
                    type="url"
                    value={
                      kashafiDocumentImageUrl.startsWith('data:')
                        ? ''
                        : kashafiDocumentImageUrl
                    }
                    onChange={(e) => setKashafiDocumentImageUrl(e.target.value)}
                    placeholder="أو الصق رابطاً مباشراً لصورة المخطوطة / الوثيقة..."
                    className="w-full h-9 px-3 rounded-lg bg-[#FDFBF7] border border-[#D8C7B2] text-xs focus:outline-none focus:border-[#D97757]"
                  />
                  {kashafiDocumentImageUrl && (
                    <div className="flex items-center gap-3 pt-1">
                      <img
                        src={kashafiDocumentImageUrl}
                        alt="معاينة الوثيقة"
                        className="w-20 h-20 rounded-lg object-cover border border-[#D8C7B2]"
                      />
                      <button
                        type="button"
                        onClick={() => setKashafiDocumentImageUrl('')}
                        className="text-xs text-[#9B492E] underline cursor-pointer"
                      >
                        إزالة الصورة المرفقة
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#1F1F1C]">
                  المقتبس النصي الحرفي من المصدر (اختياري)
                </label>
                <textarea
                  rows={2}
                  value={kashafiExcerptQuote}
                  onChange={(e) => setKashafiExcerptQuote(e.target.value)}
                  placeholder="«...»"
                  className="w-full p-3 rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] text-sm focus:outline-none focus:border-[#D97757]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#1F1F1C]">
                  التفاصيل والشرح التاريخي الكامل
                </label>
                <textarea
                  rows={3}
                  value={kashafiDetails}
                  onChange={(e) => setKashafiDetails(e.target.value)}
                  placeholder="اكتب الشرح البحثي أو السيرة التاريخية الكاملة التي ستُعرض في تبويب كشّافي للعميل..."
                  className="w-full p-3 rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] text-sm focus:outline-none focus:border-[#D97757]"
                />
              </div>

              <div className="pt-2 border-t border-[#D8C7B2] flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-[#1F1F1C]/65">
                  {isResearcherOnly
                    ? 'ستُرسل المادة كمسودة لصندوق اعتماد مدير البحوث قبل إشعار العميل.'
                    : 'فور النشر يُرسل إشعار تلقائي للعميل: ✦ اكتشاف تاريخي جديد أُضيف إلى كشّافي.'}
                </span>
                <button
                  type="button"
                  onClick={handlePublishKashafi}
                  disabled={isPublishingKashafi || !selectedKashafiUser}
                  className={WORKSPACE_PRIMARY_BTN_CLASS}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {isPublishingKashafi
                      ? 'جارٍ المعالجة...'
                      : isResearcherOnly
                      ? 'رفع مسودة كشّافي لاعتماد المدير'
                      : '✦ اعتماد ونشر في كشّافي وإشعار العميل فوراً'}
                  </span>
                </button>
              </div>
            </div>

            {/* Published Kashafi History for Selected Client */}
            <div className="bg-[#FAF7F2] border border-[#D8C7B2] rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-display font-bold text-[#1F1F1C]">
                  المواد المنشورة حالياً في «كشّافي» لهذا العميل
                </h4>
                <span className="text-xs text-[#1F1F1C]/60 tabular-nums">
                  {existingKashafiItems.length} مادة معتمدة
                </span>
              </div>
              {loadingKashafiItems ? (
                <p className="text-xs text-[#1F1F1C]/60 py-4 text-center">
                  جارٍ تحميل سجل كشّافي...
                </p>
              ) : existingKashafiItems.length === 0 ? (
                <p className="text-xs text-[#1F1F1C]/60 py-4 text-center bg-[#F5F1E8] rounded-xl border border-dashed border-[#D8C7B2]">
                  لم تُنشر مواد في كشّافي لهذه العائلة بعد.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {existingKashafiItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] p-3.5 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-[#E8DED2] text-[#1F1F1C] text-[10.5px] font-bold">
                          {getKashafiDiscoveryCategoryLabelAr(
                            item.discoveryCategory
                          )}
                        </span>
                        <span className="text-[10.5px] text-[#1F1F1C]/55">
                          {formatDateAr(item.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm font-display font-bold text-[#1F1F1C]">
                        {item.title}
                      </p>
                      <p className="text-xs text-[#1F1F1C]/70 line-clamp-2">
                        {item.summary}
                      </p>
                      {item.sourceCitation && (
                        <p className="text-[11px] text-[#D97757] font-medium truncate">
                          {item.sourceCitation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: FREE LEAD RADAR (MANAGER & SUPER ADMIN ONLY)                   */}
      {/* ===================================================================== */}
      {activeSubTab === 'free_radar' && (
        <section className="space-y-5">
          {!isManagerOrSuper ? (
            <div className="bg-[#FAF7F2] border border-[#D8C7B2] rounded-2xl p-10 text-center space-y-3">
              <Lock className="w-10 h-10 text-[#D97757] mx-auto" />
              <h3 className="text-lg font-display font-bold text-[#1F1F1C]">
                قسم مخصّص لمدير البحوث والإدارة العليا فقط
              </h3>
              <p className="text-sm text-[#1F1F1C]/70 max-w-md mx-auto">
                تفعيل إشارات رادار التحويل للحسابات المجانية وإدارة معدلات
                التحويل من صلاحيات مدير البحوث حصرياً.
              </p>
            </div>
          ) : (
            <>
              {/* Radar Conversion KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="bg-[#FAF7F2] border border-[#D8C7B2] rounded-2xl p-4">
                  <p className="text-xs text-[#1F1F1C]/65">
                    إجمالي حسابات Free
                  </p>
                  <p className="text-2xl font-display font-bold tabular-nums mt-1">
                    {radarMetrics.totalFree}
                  </p>
                </div>
                <div className="bg-[#FAF7F2] border border-[#D8C7B2] rounded-2xl p-4">
                  <p className="text-xs text-[#1F1F1C]/65">
                    إشارات رصد مفعّلة حالياً
                  </p>
                  <p className="text-2xl font-display font-bold tabular-nums text-[#D97757] mt-1">
                    {radarMetrics.activeSignals}
                  </p>
                </div>
                <div className="bg-[#FAF7F2] border border-[#D8C7B2] rounded-2xl p-4">
                  <p className="text-xs text-[#1F1F1C]/65">
                    تحوّلوا إلى Basic / Premium
                  </p>
                  <p className="text-2xl font-display font-bold tabular-nums text-[#2E5239] mt-1">
                    {radarMetrics.convertedFromRadar}
                  </p>
                </div>
                <div className="bg-[#FAF7F2] border border-[#D8C7B2] rounded-2xl p-4">
                  <p className="text-xs text-[#1F1F1C]/65">
                    معدل تحويل الرادار
                  </p>
                  <p className="text-2xl font-display font-bold tabular-nums mt-1">
                    {radarMetrics.conversionPct}%
                  </p>
                </div>
              </div>

              {/* Filter Bar */}
              <div className="bg-[#FAF7F2] border border-[#D8C7B2] rounded-2xl p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-display font-bold text-[#1F1F1C]">
                      رادار التحويل للحسابات المجانية (Free Lead Radar)
                    </h2>
                    <p className="text-xs text-[#1F1F1C]/65 mt-0.5">
                      تُرسل الإشارة التحفيزية للعميل المجاني دون كشف اسم الجذر
                      أو المصادر لدعوته إلى الترقية نحو Basic أو Premium.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="w-4 h-4 text-[#1F1F1C]/45 absolute right-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={radarSearch}
                        onChange={(e) => setRadarSearch(e.target.value)}
                        placeholder="بحث بالعائلة أو المنطقة..."
                        className="h-9 pr-9 pl-3 rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] text-xs focus:outline-none focus:border-[#D97757]"
                      />
                    </div>
                    {(
                      [
                        { id: 'all', label: 'الكل' },
                        { id: 'matched_only', label: 'ذات تقاطع مرجعي' },
                        { id: 'active_only', label: 'مفعّلة الإشارة' },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setRadarFilter(f.id)}
                        className={`h-9 px-3 rounded-xl text-xs font-display font-semibold border cursor-pointer ${
                          radarFilter === f.id
                            ? 'bg-[#D97757] text-[#F5F1E8] border-[#D97757]'
                            : 'bg-[#F5F1E8] text-[#1F1F1C]/75 border-[#D8C7B2]'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Free Leads Table/Cards */}
                <div className="space-y-3">
                  {filteredFreeRadarRows.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[#D8C7B2] bg-[#F5F1E8] p-8 text-center text-sm text-[#1F1F1C]/65">
                      لا توجد حسابات مجانية مطابقة لخيارات الفلترة الحالية.
                    </div>
                  ) : (
                    filteredFreeRadarRows.map((row) => {
                      const isActiveSignal = Boolean(
                        row.user.freeLeadRadarSignal?.active
                      );
                      const busy = radarBusyUserId === row.user.userId;
                      return (
                        <div
                          key={row.user.userId}
                          className="rounded-2xl bg-[#FDFBF7] border border-[#D8C7B2] p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                        >
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-display font-bold text-[#1F1F1C]">
                                عائلة {row.user.familyName || row.user.fullName}
                              </span>
                              <span className="text-xs text-[#1F1F1C]/60">
                                ({row.user.fullName})
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold ${
                                  row.hasAutoMatch
                                    ? 'bg-[#4D7C5B]/15 text-[#2E5239] border border-[#4D7C5B]/30'
                                    : 'bg-[#E8DED2] text-[#1F1F1C]/75 border border-[#D8C7B2]'
                                }`}
                              >
                                {row.matchStrengthLabel}
                              </span>
                              {isActiveSignal && (
                                <span className="px-2 py-0.5 rounded-md bg-[#D97757]/15 text-[#D97757] border border-[#D97757]/35 text-[10.5px] font-bold">
                                  ✦ إشارة نشطة لدى العميل
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-[#1F1F1C]/65">
                              القبيلة/الفرع:{' '}
                              {[row.user.tribeName, row.user.familyBranch]
                                .filter(Boolean)
                                .join(' · ') || 'غير محدد'}{' '}
                              · الموطن:{' '}
                              {[row.user.originCountry, row.user.originRegion]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>

                            <input
                              type="text"
                              value={
                                radarCustomTeaserByUser[row.user.userId] ??
                                row.user.freeLeadRadarSignal?.teaserNoteAr ??
                                ''
                              }
                              onChange={(e) =>
                                setRadarCustomTeaserByUser((prev) => ({
                                  ...prev,
                                  [row.user.userId]: e.target.value,
                                }))
                              }
                              placeholder="رسالة تحفيزية مخصصة اختيارية (تُعرض للعميل دون كشف اسم الجذر أو المصادر)..."
                              className="w-full h-9 px-3 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] text-xs focus:outline-none focus:border-[#D97757]"
                            />
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isActiveSignal ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  handleToggleFreeRadar(
                                    row.user,
                                    false,
                                    row.matchStrengthLabel,
                                    row.matchedEntry?.rootName
                                  )
                                }
                                className={WORKSPACE_SECONDARY_BTN_CLASS}
                              >
                                <span>إيقاف الإشارة</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  handleToggleFreeRadar(
                                    row.user,
                                    true,
                                    row.matchStrengthLabel,
                                    row.matchedEntry?.rootName
                                  )
                                }
                                className={WORKSPACE_PRIMARY_BTN_CLASS}
                              >
                                <Sparkles className="w-4 h-4" />
                                <span>
                                  {busy
                                    ? 'جارٍ التفعيل...'
                                    : '✦ تفعيل إشارة رصد تحفيزية للعميل'}
                                </span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: APPROVAL INBOX & RESEARCHERS QUALITY PERFORMANCE               */}
      {/* ===================================================================== */}
      {activeSubTab === 'approval_inbox' && (
        <section className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Drafts List (5 cols) */}
            <div className="lg:col-span-5 bg-[#FAF7F2] border border-[#D8C7B2] rounded-2xl p-4 space-y-3.5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-display font-bold text-[#1F1F1C]">
                  {isResearcherOnly
                    ? 'مسوداتي المرفوعة وملاحظات المدير'
                    : 'صندوق الاعتماد العلمي'}
                </h2>
                <span className="text-xs text-[#1F1F1C]/60 tabular-nums">
                  {visibleDrafts.length} مسودة
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    {
                      id: 'pending_manager_approval',
                      label: 'بانتظار الاعتماد',
                    },
                    { id: 'returned', label: 'معادة للتصويب' },
                    { id: 'approved', label: 'معتمدة ومنشورة' },
                    { id: 'all', label: 'الكل' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setDraftStatusFilter(f.id)}
                    className={`px-2.5 h-8 rounded-lg text-[11.5px] font-display font-semibold border cursor-pointer ${
                      draftStatusFilter === f.id
                        ? 'bg-[#D97757] text-[#F5F1E8] border-[#D97757]'
                        : 'bg-[#F5F1E8] text-[#1F1F1C]/75 border-[#D8C7B2]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="space-y-2.5 max-h-[540px] overflow-y-auto pl-1">
                {visibleDrafts.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#D8C7B2] bg-[#F5F1E8] p-6 text-center text-xs text-[#1F1F1C]/65">
                    لا توجد مسودات ضمن هذه الحالة حالياً.
                  </div>
                ) : (
                  visibleDrafts.map((d) => {
                    const active = selectedDraft?.id === d.id;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setSelectedDraftId(d.id)}
                        className={`w-full text-right rounded-xl p-3.5 border transition-all cursor-pointer space-y-1.5 ${
                          active
                            ? 'bg-[#FDFBF7] border-[#D97757] shadow-xs'
                            : 'bg-[#F5F1E8]/80 border-[#D8C7B2] hover:bg-[#FDFBF7]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-[#E8DED2] text-[#1F1F1C] text-[10.5px] font-bold">
                            {d.draftKind === 'lineage_connection'
                              ? 'ربط جذور'
                              : 'مادة كشّافي'}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold ${
                              d.status === 'approved'
                                ? 'bg-[#4D7C5B]/15 text-[#2E5239]'
                                : d.status === 'returned'
                                ? 'bg-[#D97757]/15 text-[#9B492E]'
                                : 'bg-[#B6813A]/15 text-[#7A531E]'
                            }`}
                          >
                            {d.status === 'approved'
                              ? 'معتمد ✓'
                              : d.status === 'returned'
                              ? 'مُعاد للتصويب ↺'
                              : 'بانتظار الاعتماد'}
                          </span>
                        </div>
                        <p className="text-sm font-display font-bold text-[#1F1F1C]">
                          عائلة {d.targetFamilyName}
                        </p>
                        <p className="text-xs text-[#1F1F1C]/65 truncate">
                          {d.draftKind === 'lineage_connection'
                            ? d.verifiedRootBranch ||
                              d.verifiedMotherTribe ||
                              getLineageDecisionLabelAr(
                                d.lineageDecision || 'partial_investigating'
                              )
                            : d.kashafiTitle}
                        </p>
                        <p className="text-[11px] text-[#1F1F1C]/55">
                          الباحث: {d.submittedByResearcherName} ·{' '}
                          {formatDateAr(d.submittedAt)}
                        </p>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Live Client Visual Preview & Manager Approval Panel (7 cols) */}
            <div className="lg:col-span-7 bg-[#FAF7F2] border border-[#D8C7B2] rounded-2xl p-5 space-y-4">
              {!selectedDraft ? (
                <div className="py-16 text-center space-y-2 text-[#1F1F1C]/60">
                  <Eye className="w-8 h-8 mx-auto text-[#D97757]/50" />
                  <p className="text-sm font-semibold">
                    اختر مسودة لاستعراض المعاينة الحية كما ستظهر للعميل
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-display font-bold text-[#1F1F1C] inline-flex items-center gap-2">
                      <Eye className="w-4 h-4 text-[#D97757]" />
                      <span>
                        معاينة بصرية حية كما ستظهر لعائلة{' '}
                        {selectedDraft.targetFamilyName}
                      </span>
                    </h3>
                    <span className="text-xs text-[#1F1F1C]/65">
                      أعدّها: {selectedDraft.submittedByResearcherName}
                    </span>
                  </div>

                  {/* Simulated Client Card in Warm Heritage Ivory */}
                  <div className="rounded-2xl bg-[#F5F1E8] border-2 border-[#D8C7B2] p-5 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-[#D97757]/12 text-[#D97757] text-xs font-bold">
                        {selectedDraft.draftKind === 'lineage_connection'
                          ? getLineageDecisionLabelAr(
                              selectedDraft.lineageDecision ||
                                'verified_connected'
                            )
                          : getKashafiDiscoveryCategoryLabelAr(
                              selectedDraft.kashafiCategory
                            )}
                      </span>
                      <span className="text-xs text-[#1F1F1C]/60">
                        معاينة واجهة العميل
                      </span>
                    </div>

                    {selectedDraft.draftKind === 'lineage_connection' ? (
                      <div className="space-y-2.5">
                        <h4 className="text-lg font-display font-bold text-[#1F1F1C]">
                          {selectedDraft.verifiedRootBranch ||
                            selectedDraft.verifiedMotherTribe ||
                            `ملف عائلة ${selectedDraft.targetFamilyName}`}
                        </h4>
                        {selectedDraft.verifiedMotherTribe && (
                          <p className="text-sm font-semibold text-[#D97757]">
                            القبيلة الأم: {selectedDraft.verifiedMotherTribe}
                          </p>
                        )}
                        {selectedDraft.intermediateChainText && (
                          <p className="text-xs bg-[#FDFBF7] border border-[#D8C7B2] rounded-xl p-3 leading-relaxed">
                            {selectedDraft.intermediateChainText}
                          </p>
                        )}
                        {selectedDraft.verifiedSourcesText && (
                          <p className="text-xs text-[#1F1F1C]/80">
                            <span className="font-bold">المصادر المعتمدة: </span>
                            {selectedDraft.verifiedSourcesText}
                          </p>
                        )}
                        {(selectedDraft.scholarlyNotes ||
                          selectedDraft.clientQuestionText) && (
                          <p className="text-xs text-[#1F1F1C]/75 leading-relaxed">
                            {selectedDraft.clientQuestionText ||
                              selectedDraft.scholarlyNotes}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        <h4 className="text-lg font-display font-bold text-[#1F1F1C]">
                          {selectedDraft.kashafiTitle}
                        </h4>
                        <p className="text-sm text-[#1F1F1C]/80">
                          {selectedDraft.kashafiSummary}
                        </p>
                        {selectedDraft.kashafiExcerptQuote && (
                          <blockquote className="rounded-xl bg-[#FDFBF7] border-r-4 border-[#D97757] p-3 text-xs italic text-[#1F1F1C]/85">
                            «{selectedDraft.kashafiExcerptQuote}»
                          </blockquote>
                        )}
                        {selectedDraft.kashafiDocumentImageUrl && (
                          <img
                            src={selectedDraft.kashafiDocumentImageUrl}
                            alt="معاينة الوثيقة"
                            className="max-h-48 rounded-xl border border-[#D8C7B2] object-contain bg-[#FDFBF7]"
                          />
                        )}
                        <p className="text-xs text-[#1F1F1C]/75 leading-relaxed">
                          {selectedDraft.kashafiDetails}
                        </p>
                        {selectedDraft.kashafiBookTitle && (
                          <p className="text-[11.5px] font-semibold text-[#D97757]">
                            المرجع: {selectedDraft.kashafiBookTitle}
                            {selectedDraft.kashafiBookAuthor
                              ? ` · ${selectedDraft.kashafiBookAuthor}`
                              : ''}
                            {selectedDraft.kashafiPageReference
                              ? ` · ${selectedDraft.kashafiPageReference}`
                              : ''}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Manager Review Feedback (if returned) */}
                  {selectedDraft.managerReviewNotes && (
                    <div className="rounded-xl bg-[#D97757]/10 border border-[#D97757]/35 p-3.5 space-y-1">
                      <p className="text-xs font-bold text-[#9B492E]">
                        ملاحظات التصويب من مدير البحوث (
                        {selectedDraft.reviewedByManagerName}):
                      </p>
                      <p className="text-xs text-[#1F1F1C] leading-relaxed">
                        {selectedDraft.managerReviewNotes}
                      </p>
                    </div>
                  )}

                  {/* Manager Action Controls */}
                  {isManagerOrSuper &&
                    selectedDraft.status === 'pending_manager_approval' && (
                      <div className="space-y-3 pt-2 border-t border-[#D8C7B2]">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-[#1F1F1C]">
                            ملاحظات التصويب (مطلوبة فقط في حال الإعادة للباحث)
                          </label>
                          <textarea
                            rows={2}
                            value={managerReturnNotes}
                            onChange={(e) =>
                              setManagerReturnNotes(e.target.value)
                            }
                            placeholder="مثال: يرجى توثيق رقم الصفحة في طبعة دار المعارف قبل الاعتماد..."
                            className="w-full p-2.5 rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] text-xs focus:outline-none focus:border-[#D97757]"
                          />
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2.5">
                          <button
                            type="button"
                            disabled={isProcessingDraft}
                            onClick={() => handleReturnDraft(selectedDraft)}
                            className={WORKSPACE_SECONDARY_BTN_CLASS}
                          >
                            <RotateCcw className="w-4 h-4 text-[#D97757]" />
                            <span>↺ إعادة للباحث مع ملاحظات التصويب</span>
                          </button>
                          <button
                            type="button"
                            disabled={isProcessingDraft}
                            onClick={() => handleApproveDraft(selectedDraft)}
                            className={WORKSPACE_PRIMARY_BTN_CLASS}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>✓ تدقيق واعتماد النشر للعميل</span>
                          </button>
                        </div>
                      </div>
                    )}
                </>
              )}
            </div>
          </div>

          {/* Researcher Team Performance & Geographic/Tribal Specializations */}
          <div className="bg-[#FAF7F2] border border-[#D8C7B2] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-display font-bold text-[#1F1F1C] inline-flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#D97757]" />
                  <span>أداء فريق الباحثين والتخصصات الجغرافية والقبلية</span>
                </h3>
                <p className="text-xs text-[#1F1F1C]/65 mt-0.5">
                  توزيع الأحمال البحثية ونسبة قبول المسودات من أول مراجعة.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {researchTeamMembers.map((member) => {
                const kpi = computeResearcherKpiMetrics(
                  member,
                  researchTickets,
                  drafts,
                  adamStagingProposals
                );
                const isEditing = editingMemberId === member.id;

                return (
                  <div
                    key={member.id}
                    className="rounded-2xl bg-[#FDFBF7] border border-[#D8C7B2] p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-display font-bold text-[#1F1F1C]">
                          {member.name}
                        </p>
                        <p className="text-xs text-[#D97757] font-semibold">
                          {member.role}
                        </p>
                      </div>
                      {isManagerOrSuper && !isEditing && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMemberId(member.id);
                            setEditSpecialtyRegion(member.specialtyRegion || '');
                            setEditSpecialtyTribes(member.specialtyTribes || '');
                          }}
                          className="h-8 px-2.5 rounded-lg bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] text-xs inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-[#D97757]" />
                          <span>التخصص</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="rounded-xl bg-[#F5F1E8] border border-[#D8C7B2]/70 p-2">
                        <span className="block text-[10px] text-[#1F1F1C]/60">
                          متوسط زمن الإغلاق
                        </span>
                        <span className="text-sm font-bold tabular-nums text-[#1F1F1C]">
                          {kpi.avgClosureHoursDisplay}
                        </span>
                      </div>
                      <div className="rounded-xl bg-[#F5F1E8] border border-[#D8C7B2]/70 p-2">
                        <span className="block text-[10px] text-[#1F1F1C]/60">
                          التذاكر المنجزة
                        </span>
                        <span className="text-sm font-bold tabular-nums text-[#1F1F1C]">
                          {kpi.completedTicketsCount}
                        </span>
                      </div>
                      <div className="rounded-xl bg-[#F5F1E8] border border-[#D8C7B2]/70 p-2">
                        <span className="block text-[10px] text-[#1F1F1C]/60">
                          دقة الاعتماد من أول مرة
                        </span>
                        <span className="text-sm font-bold tabular-nums text-[#2E5239]">
                          {kpi.firstPassApprovalRate}%
                        </span>
                      </div>
                      <div className="rounded-xl bg-[#F5F1E8] border border-[#D8C7B2]/70 p-2">
                        <span className="block text-[10px] text-[#1F1F1C]/60">
                          حلقات مقترحة لشجرة آدم
                        </span>
                        <span className="text-sm font-bold tabular-nums text-[#D97757]">
                          {kpi.proposedAdamLinksCount}
                        </span>
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="space-y-2 pt-1">
                        <input
                          type="text"
                          value={editSpecialtyRegion}
                          onChange={(e) =>
                            setEditSpecialtyRegion(e.target.value)
                          }
                          placeholder="الإقليم (مثال: نجد والحجاز والشام)"
                          className="w-full h-8 px-2.5 rounded-lg bg-[#F5F1E8] border border-[#D8C7B2] text-xs"
                        />
                        <input
                          type="text"
                          value={editSpecialtyTribes}
                          onChange={(e) =>
                            setEditSpecialtyTribes(e.target.value)
                          }
                          placeholder="التخصص القبلي (مثال: تميم، طيء، عنزة)"
                          className="w-full h-8 px-2.5 rounded-lg bg-[#F5F1E8] border border-[#D8C7B2] text-xs"
                        />
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingMemberId(null)}
                            className="h-7 px-2.5 rounded-lg bg-[#E8DED2] text-xs cursor-pointer"
                          >
                            إلغاء
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveResearcherSpecialty(member)}
                            className="h-7 px-3 rounded-lg bg-[#D97757] text-[#F5F1E8] text-xs font-bold cursor-pointer"
                          >
                            حفظ
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-[#1F1F1C]/70 space-y-1">
                        <p>
                          <span className="font-semibold text-[#1F1F1C]">
                            النطاق الجغرافي:{' '}
                          </span>
                          {member.specialtyRegion || 'عموم العالم العربي'}
                        </p>
                        <p>
                          <span className="font-semibold text-[#1F1F1C]">
                            التخصص القبلي:{' '}
                          </span>
                          {member.specialtyTribes || 'تحقيق الأنساب العام'}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ===================================================================== */}
      {/* TAB 5: MASTER ROOTS & REFERENCE LIBRARY                               */}
      {/* ===================================================================== */}
      {activeSubTab === 'master_library' && (
        <section className="space-y-5">
          <div className="bg-[#FAF7F2] border border-[#D8C7B2] rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-display font-bold text-[#1F1F1C]">
                  جمهرة الجذور والمصادر المرجعية المعتمدة
                </h2>
                <p className="text-xs text-[#1F1F1C]/65 mt-0.5">
                  فهرس علمي موحّد لأمهات كتب الأنساب وسلاسل الجذور — يسحب منه
                  الباحثون التوثيق بنقرة واحدة لضمان اتساق النتائج.
                </p>
              </div>
              {isManagerOrSuper && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingCatalogId(null);
                    setShowCatalogForm((v) => !v);
                  }}
                  className={WORKSPACE_PRIMARY_BTN_CLASS}
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    {showCatalogForm ? 'إغلاق النموذج' : 'إضافة جذر أو مرجع جديد'}
                  </span>
                </button>
              )}
            </div>

            {/* Add/Edit Catalog Form (Manager & Super Admin only) */}
            {showCatalogForm && isManagerOrSuper && (
              <div className="rounded-2xl bg-[#F5F1E8] border border-[#D97757]/45 p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">نوع السجل</label>
                    <select
                      value={catEntryKind}
                      onChange={(e) =>
                        setCatEntryKind(
                          e.target.value as 'historical_root' | 'reference_book'
                        )
                      }
                      className="w-full h-9 px-3 rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] text-xs"
                    >
                      <option value="historical_root">
                        جذر قبلي / تاريخي موثق
                      </option>
                      <option value="reference_book">
                        كتاب مرجعي / مخطوطة أم
                      </option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">
                      اسم الجذر أو عنوان الفهرس
                    </label>
                    <input
                      type="text"
                      value={catRootName}
                      onChange={(e) => setCatRootName(e.target.value)}
                      placeholder="مثال: قبيلة قحطان (مذحج)"
                      className="w-full h-9 px-3 rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">
                      القبيلة الأم / النطاق
                    </label>
                    <input
                      type="text"
                      value={catMotherTribe}
                      onChange={(e) => setCatMotherTribe(e.target.value)}
                      placeholder="مثال: كهلان بن سبأ"
                      className="w-full h-9 px-3 rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">
                      عنوان الكتاب المصدري
                    </label>
                    <input
                      type="text"
                      value={catBookTitle}
                      onChange={(e) => setCatBookTitle(e.target.value)}
                      placeholder="مثال: جمهرة أنساب العرب"
                      className="w-full h-9 px-3 rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">المؤلف</label>
                    <input
                      type="text"
                      value={catAuthorName}
                      onChange={(e) => setCatAuthorName(e.target.value)}
                      placeholder="مثال: ابن حزم الأندلسي"
                      className="w-full h-9 px-3 rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">
                      القرن / الجزء والصفحات
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={catCenturyEra}
                        onChange={(e) => setCatCenturyEra(e.target.value)}
                        placeholder="القرن"
                        className="w-1/2 h-9 px-2.5 rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] text-xs"
                      />
                      <input
                        type="text"
                        value={catPagesHint}
                        onChange={(e) => setCatPagesHint(e.target.value)}
                        placeholder="ص 207-231"
                        className="w-1/2 h-9 px-2.5 rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] text-xs"
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-semibold">
                      سلسلة الأجداد المعتمدة (اختياري)
                    </label>
                    <input
                      type="text"
                      value={catChainSummary}
                      onChange={(e) => setCatChainSummary(e.target.value)}
                      placeholder="سلسلة النسب المعتمدة..."
                      className="w-full h-9 px-3 rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">
                      الأقاليم والديار (مفصولة بفاصلة)
                    </label>
                    <input
                      type="text"
                      value={catRegionsText}
                      onChange={(e) => setCatRegionsText(e.target.value)}
                      placeholder="نجد، الحجاز، العراق، الشام"
                      className="w-full h-9 px-3 rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] text-xs"
                    />
                  </div>
                  <div className="sm:col-span-3 space-y-1">
                    <label className="text-xs font-semibold">
                      ملاحظات علمية للباحثين
                    </label>
                    <textarea
                      rows={2}
                      value={catNotes}
                      onChange={(e) => setCatNotes(e.target.value)}
                      placeholder="تنبيهات تحقيقية أو ضوابط ربط هذا الجذر..."
                      className="w-full p-2.5 rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] text-xs"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCatalogForm(false)}
                    className={WORKSPACE_SECONDARY_BTN_CLASS}
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    disabled={isSavingCatalog}
                    onClick={handleSaveCatalogEntry}
                    className={WORKSPACE_PRIMARY_BTN_CLASS}
                  >
                    <Save className="w-4 h-4" />
                    <span>
                      {isSavingCatalog
                        ? 'جارٍ الحفظ...'
                        : 'حفظ في جمهرة المصادر'}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Search & Kind Filters */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-[#1F1F1C]/45 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="ابحث باسم الجذر، الكتاب، المؤلف، أو الإقليم..."
                  className="w-full h-10 pr-9 pl-3 rounded-xl bg-[#FDFBF7] border border-[#D8C7B2] text-sm focus:outline-none focus:border-[#D97757]"
                />
              </div>
              {(
                [
                  { id: 'all', label: 'الكل' },
                  { id: 'historical_root', label: 'الجذور والقبائل' },
                  { id: 'reference_book', label: 'أمهات الكتب والمراجع' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setCatalogKindFilter(f.id)}
                  className={`h-10 px-3.5 rounded-xl text-xs font-display font-semibold border cursor-pointer ${
                    catalogKindFilter === f.id
                      ? 'bg-[#D97757] text-[#F5F1E8] border-[#D97757]'
                      : 'bg-[#F5F1E8] text-[#1F1F1C]/75 border-[#D8C7B2]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Catalog Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCatalog.map((entry) => (
                <article
                  key={entry.id}
                  className="rounded-2xl bg-[#FDFBF7] border border-[#D8C7B2] p-4 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="inline-block px-2 py-0.5 rounded-md bg-[#E8DED2] text-[#1F1F1C] text-[10.5px] font-bold mb-1">
                          {entry.entryKind === 'reference_book'
                            ? 'مرجع أم معتمد'
                            : 'جذر تاريخي موثق'}
                        </span>
                        <h3 className="text-base font-display font-bold text-[#1F1F1C]">
                          {entry.rootName}
                        </h3>
                        <p className="text-xs text-[#D97757] font-semibold">
                          {entry.motherTribe}
                        </p>
                      </div>
                      {isManagerOrSuper && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => openEditCatalogEntry(entry)}
                            className="w-8 h-8 rounded-lg bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] inline-flex items-center justify-center text-[#1F1F1C] cursor-pointer"
                            title="تعديل"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCatalogEntry(entry)}
                            className="w-8 h-8 rounded-lg bg-[#F5F1E8] hover:bg-[#D97757]/15 border border-[#D8C7B2] inline-flex items-center justify-center text-[#9B492E] cursor-pointer"
                            title="حذف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {entry.ancestralChainSummary && (
                      <p className="text-xs bg-[#F5F1E8] border border-[#D8C7B2]/70 rounded-xl p-2.5 text-[#1F1F1C]/85 leading-relaxed">
                        {entry.ancestralChainSummary}
                      </p>
                    )}

                    <div className="text-xs text-[#1F1F1C]/80 space-y-0.5">
                      <p className="font-semibold">
                        <BookOpen className="w-3.5 h-3.5 inline ml-1 text-[#D97757]" />
                        {entry.bookTitle} — {entry.authorName}
                      </p>
                      {(entry.centuryOrEra || entry.volumeOrPagesHint) && (
                        <p className="text-[11px] text-[#1F1F1C]/60">
                          {[entry.centuryOrEra, entry.volumeOrPagesHint]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      )}
                    </div>

                    {entry.regions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {entry.regions.map((r) => (
                          <span
                            key={r}
                            className="px-2 py-0.5 rounded-md bg-[#F5F1E8] border border-[#D8C7B2] text-[10.5px] text-[#1F1F1C]/75"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    )}

                    {entry.scholarlyNotes && (
                      <p className="text-xs text-[#1F1F1C]/70 leading-relaxed">
                        {entry.scholarlyNotes}
                      </p>
                    )}
                  </div>

                  <div className="pt-2.5 border-t border-[#D8C7B2]/70 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleApplyCatalogToQueue(entry)}
                      className="flex-1 h-9 px-3 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] text-xs font-display font-semibold text-[#1F1F1C] inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <GitBranch className="w-3.5 h-3.5 text-[#D97757]" />
                      <span>سحب لطابور الربط</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyCatalogToKashafi(entry)}
                      className="flex-1 h-9 px-3 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] text-xs font-display font-semibold text-[#1F1F1C] inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#D97757]" />
                      <span>استخدام في كشّافي</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
