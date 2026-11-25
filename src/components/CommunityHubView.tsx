import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Archive,
  ArrowUpLeft,
  Award,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  Eye,
  FileImage,
  GitBranch,
  Globe,
  Inbox,
  Lock,
  Mail,
  Megaphone,
  MessageCircle,
  MessageSquareHeart,
  Plus,
  QrCode,
  ScanFace,
  Share2,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import {
  UnifiedWorkspaceHeader,
  WORKSPACE_ICON_BTN_CLASS,
  WORKSPACE_PRIMARY_ICON_BTN_CLASS,
  WorkspaceIconTooltip,
} from './UnifiedWorkspaceHeader';
import { JUTHORI_SERVICE_ICONS } from '../config/serviceIcons';
import {
  AccountLegalType,
  DashboardAccessCapabilities,
  DashboardStateMode,
  DashboardTab,
  LineageSearchResult,
} from '../types/juthori';
import {
  ACTIVE_PUBLIC_SITE_DISPLAY_HOST,
  buildDeterministicReferralCode,
  REFERRAL_REWARD_USD,
  resolveClientPublicAppBaseUrl,
} from '../config/referralAndSiteConfig';
import {
  canonicalCustomerEmailUid,
  fetchUserFamilyTreeFromFirebase,
  readUserFamilyTreeFromLocal,
} from '../services/firestoreService';
import {
  AuthorizedFamilyPortalSummary,
  FamilyMemoryQuest,
  KinshipCircleDoc,
  KinshipCircleMember,
  KinshipCircleMemberRole,
  MemoryQuestCategory,
  PublicMicrositeData,
  RawTreePersonForPublicProjection,
  ReferralDashboardStats,
  SiteAccessRequestDoc,
  TreeEnrichmentRequestDoc,
  addRelativeToKinshipCircleAndSendInvite,
  createFamilyMemoryQuest,
  fetchAuthorizedFamilyPortalsForEmail,
  fetchKinshipCircleForOwner,
  fetchOwnerMicrositeForCommunity,
  fetchPendingSiteAccessRequestsForOwner,
  fetchUserReferralDashboard,
  removeRelativeFromKinshipCircle,
  resolveSiteAccessRequest,
  reviewAndMergeEnrichmentRequest,
  subscribeToOwnerEnrichmentRequests,
  updateFamilyMemoryQuestStatus,
  updateKinshipCircleMemberMeta,
} from '../services/priority4Service';
import { RoyalQrInvitationModal } from './RoyalQrInvitationModal';
import { CommunityAmbassadorPass } from './CommunityAmbassadorPass';
import { CommunityKinshipEventsView } from './CommunityKinshipEventsView';
import type { UpgradePromptRequest } from './UpgradeToPremiumModal';
import { PublicVisualTreeMirror } from './FamilySiteHeritageVisuals';
import {
  ArabicHonorificTitle,
  InteractiveFamilyTreeBuilder,
  InteractiveTreePerson,
} from './InteractiveFamilyTreeBuilder';
import { mergeStagingTreeProposalIntoAuthoritativeTree } from '../utils/enrichmentStagingUtils';
import {
  TreePrestigeBadgeId,
  normalizeTreeDisplaySettings,
} from '../utils/treeStudioConfig';

const DIFF_NOOP_VOID = () => {};
const DIFF_NOOP_LOG = (_action: string, _detail: string) => {};

const DIFF_PREVIEW_CAPS: DashboardAccessCapabilities = {
  isVip: true,
  isMatched: false,
  isRootUnlocked: false,
  areUpperAncestorsUnlocked: false,
  showFifthBridgeNode: false,
  arePremiumTabsUnlocked: true,
  canAccessTreeDirectly: true,
  requiresCharterUpgradeForTree: false,
  tierHeaderTitle: 'معاينة الفروقات البصرية للشجرة',
  membershipTierKey: 'annual_vip',
  maxTreeMembers: 5000,
  maxVaultDocuments: null,
  canPublishPublicSite: false,
  canInviteFamilyContributors: false,
  hasRegistrarBadge: true,
  hasPriorityResearchObservatory: false,
};

interface CommunityHubViewProps {
  result: LineageSearchResult;
  accountType: AccountLegalType;
  caps: DashboardAccessCapabilities;
  userId?: string;
  userEmail?: string;
  publishedSiteSlug?: string;
  blockedUserIds?: string[];
  onBlockUser?: (targetUid: string, targetName: string) => void;
  onNavigateTab?: (tab: DashboardTab) => void;
  onSignCharterAndEnableTree?: () => void;
  onRequirePremiumAction?: (req: UpgradePromptRequest) => void;
  onLogActivity?: (title: string, details: string) => void;
}

type CommunityTabId = 'circle' | 'enrichment' | 'events' | 'ambassador';

type EnrichmentFilterId =
  | 'ALL'
  | 'ADD_TREE_MEMBER'
  | 'VAULT_MEDIA'
  | 'FACE_ID'
  | 'CORRECTION_NOTE';

const ROLE_OPTIONS: Array<{
  id: KinshipCircleMemberRole;
  labelAr: string;
  shortLabelAr: string;
  descriptionAr: string;
}> = [
  {
    id: 'assistant_registrar',
    labelAr: 'مساعد أمين السجل (محرر مساند)',
    shortLabelAr: 'مساعد أمين السجل',
    descriptionAr: 'أولوية في اقتراح تحديثات الشجرة والوثائق ومساعدة أمين السجل.',
  },
  {
    id: 'memory_contributor',
    labelAr: 'راوي ومُساهم في الذاكرة',
    shortLabelAr: 'راوي ومُساهم',
    descriptionAr: 'إضافة الصور والقصص والمواليد والتعرف على الوجوه في خزانة العائلة.',
  },
  {
    id: 'family_viewer',
    labelAr: 'عضو دائرة العائلة (مُطّلع خاص)',
    shortLabelAr: 'عضو مُطّلع خاص',
    descriptionAr: 'تصفح الأقسام العائلية الخاصة في «موقعي» فقط بسرية تامة.',
  },
];

const KINSHIP_PRESETS = [
  'ابن عم',
  'شقيق',
  'شقيقة',
  'عم',
  'خال',
  'ابن أخت',
  'ابن أخ',
  'جد / كبير العائلة',
];

const MEMORY_QUEST_TEMPLATES: Array<{
  category: MemoryQuestCategory;
  title: string;
  promptText: string;
  badgeAr: string;
}> = [
  {
    category: 'newborns',
    title: 'حصر وتوثيق مواليد العائلة الجدد',
    promptText:
      'أحبتنا أبناء وبنات العائلة، نُحدث حالياً شجرة العائلة الموثقة. يرجى الدخول لبوابة العائلة واقتراح أسماء المواليد الجدد وتواريخ ميلادهم ليُحفظوا في سجل الأجيال.',
    badgeAr: 'تحديث الشجرة',
  },
  {
    category: 'heritage_photos',
    title: 'نداء جمع صور الأجداد والوثائق القديمة',
    promptText:
      'هل تحتفظون بصور قديمة للأجداد أو صكوك وخطابات عائلية نادرة؟ شاركوها معنا عبر بوابة العائلة لنحفظها بجودة أرشيفية عالية ونربطها بأصحابها في الخزانة.',
    badgeAr: 'خزانة الصور',
  },
  {
    category: 'elders_stories',
    title: 'سؤال الذاكرة لكبار العائلة: حدثونا عن ديار ومجالس الأجداد',
    promptText:
      'ندعو كبار عائلتنا الكرام لتدوين ذكرياتهم ومواقفهم حول ديار الأجداد ومجالسهم الأولى، لتبقى سيرة حية تقرؤها الأجيال القادمة في ديوان العائلة.',
    badgeAr: 'تاريخ شفهي',
  },
];

function getArabicInitials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'ع';
  if (parts.length === 1) return parts[0].slice(0, 1);
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`;
}

function resolveRoleLabel(role?: KinshipCircleMemberRole): string {
  const found = ROLE_OPTIONS.find((r) => r.id === role);
  return found ? found.shortLabelAr : 'راوي ومُساهم';
}

export const CommunityHubView: React.FC<CommunityHubViewProps> = ({
  result,
  accountType,
  caps,
  userId,
  userEmail,
  publishedSiteSlug,
  onNavigateTab,
  onSignCharterAndEnableTree,
  onRequirePremiumAction,
  onLogActivity,
}) => {
  const effectiveUserId = useMemo(
    () =>
      (userId || canonicalCustomerEmailUid(userEmail) || 'usr_guest').replace(
        /[^a-zA-Z0-9_-]/g,
        '_'
      ),
    [userId, userEmail]
  );

  const effectiveEmail = useMemo(
    () => (userEmail || '').trim().toLowerCase(),
    [userEmail]
  );

  const ownerDisplayName = useMemo(
    () => `${result.clientName || ''} ${result.familyName || ''}`.trim() || 'أمين السجل',
    [result.clientName, result.familyName]
  );

  const isRegistrar =
    caps.hasRegistrarBadge || accountType === AccountLegalType.RecordKeeper;
  const isOwnRegistrarWorkspace = Boolean(caps.isVip && isRegistrar);

  const requireCommunityPremiumAction = (
    feature: 'community_invite' | 'community_qr' | 'community_quest' | 'community_event',
    onAuthorizedContinue: () => void
  ) => {
    if (isOwnRegistrarWorkspace) {
      onAuthorizedContinue();
      return;
    }
    if (onRequirePremiumAction) {
      onRequirePremiumAction({
        feature,
        onAuthorizedContinue,
      });
    } else {
      onSignCharterAndEnableTree?.();
    }
  };

  // Navigation & UI state — unified 4-tab layout for all users
  const [activeTab, setActiveTab] = useState<CommunityTabId>('circle');
  const [isLoading, setIsLoading] = useState(true);
  const [banner, setBanner] = useState<{
    type: 'success' | 'info' | 'error';
    text: string;
  } | null>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);

  // Core real Firestore data state
  const [circle, setCircle] = useState<KinshipCircleDoc>({
    ownerId: effectiveUserId,
    familyName: result.familyName,
    siteSlug: publishedSiteSlug,
    members: [],
    memoryQuests: [],
    updatedAt: '',
  });
  const [enrichments, setEnrichments] = useState<TreeEnrichmentRequestDoc[]>([]);
  const [accessRequests, setAccessRequests] = useState<SiteAccessRequestDoc[]>([]);
  const [authorizedPortals, setAuthorizedPortals] = useState<
    AuthorizedFamilyPortalSummary[]
  >([]);
  const [activeSharedTreePortal, setActiveSharedTreePortal] =
    useState<AuthorizedFamilyPortalSummary | null>(null);
  const [ownerMicrosite, setOwnerMicrosite] =
    useState<PublicMicrositeData | null>(null);
  const [rawTreeMembers, setRawTreeMembers] = useState<
    RawTreePersonForPublicProjection[]
  >([]);
  const [referralStats, setReferralStats] = useState<ReferralDashboardStats>({
    referralCode: buildDeterministicReferralCode(effectiveUserId),
    registeredCount: 0,
    rewardedAnnualCount: 0,
    totalEarnedUsd: 0,
    invitees: [],
  });

  // Pillar 1: Smart Invite Studio & Majlis Link controls
  const [inviteStudioOpen, setInviteStudioOpen] = useState(false);
  const inviteStudioRef = useRef<HTMLDivElement | null>(null);
  const [relName, setRelName] = useState('');
  const [relKinship, setRelKinship] = useState('ابن عم');
  const [relEmail, setRelEmail] = useState('');
  const [relRole, setRelRole] =
    useState<KinshipCircleMemberRole>('memory_contributor');
  const [relTreePersonId, setRelTreePersonId] = useState('');
  const [invitingRelative, setInvitingRelative] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [removingEmail, setRemovingEmail] = useState<string | null>(null);
  const [resolvingAccessId, setResolvingAccessId] = useState<string | null>(
    null
  );

  // Pillar 2: Memory Quests & Categorized Enrichment Moderation
  const [enrichmentFilter, setEnrichmentFilter] =
    useState<EnrichmentFilterId>('ALL');
  const [showReviewedHistory, setShowReviewedHistory] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [visualDiffReviewRequest, setVisualDiffReviewRequest] =
    useState<TreeEnrichmentRequestDoc | null>(null);
  const [questComposerOpen, setQuestComposerOpen] = useState(false);
  const [questTitle, setQuestTitle] = useState('');
  const [questPrompt, setQuestPrompt] = useState('');
  const [questCategory, setQuestCategory] =
    useState<MemoryQuestCategory>('custom');
  const [savingQuest, setSavingQuest] = useState(false);
  const [copiedQuestId, setCopiedQuestId] = useState<string | null>(null);

  useEffect(() => {
    if (!visualDiffReviewRequest || typeof document === 'undefined') return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setVisualDiffReviewRequest(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [visualDiffReviewRequest]);

  const visualDiffPreviewData = useMemo(() => {
    if (!visualDiffReviewRequest) return null;

    const existingNodes = rawTreeMembers;
    let proposedNodes = visualDiffReviewRequest.proposedNodes || [];
    const parentLinkPatches = visualDiffReviewRequest.parentLinkPatches || [];

    if (
      proposedNodes.length === 0 &&
      visualDiffReviewRequest.proposedFirstName
    ) {
      const targetNode = existingNodes.find(
        (n) => n.id === visualDiffReviewRequest.targetPersonId
      );
      proposedNodes = [
        {
          id: `diff_legacy_${visualDiffReviewRequest.id}`,
          firstName: visualDiffReviewRequest.proposedFirstName,
          familyName: result.familyName,
          gender: visualDiffReviewRequest.proposedGender || 'male',
          generationLevel: targetNode
            ? Math.max(-10, (targetNode.generationLevel || 1) - 1)
            : 0,
          relationToTargetLabel:
            visualDiffReviewRequest.kinshipRelation || 'فرد مقترح',
          fatherId:
            visualDiffReviewRequest.targetPersonId ||
            existingNodes.find((n) => n.isRecordKeeper)?.id,
          spouseIds: [],
          vitalStatus: 'living',
          birthDateValue: visualDiffReviewRequest.proposedBirthYear || '',
          birthPlace: visualDiffReviewRequest.proposedBirthPlace || '',
          biography: visualDiffReviewRequest.proposedNotes,
        },
      ];
    }

    const { mergedTree, insertedIds } =
      mergeStagingTreeProposalIntoAuthoritativeTree(
        existingNodes,
        proposedNodes,
        parentLinkPatches,
        result.familyName
      );

    const asOptStr = (v: unknown): string | undefined =>
      typeof v === 'string' && v.length > 0 ? v : undefined;

    const mappedMembers: InteractiveTreePerson[] = mergedTree.map((m) => ({
      id: m.id,
      firstName: m.firstName || 'قريب',
      familyName: m.familyName || result.familyName,
      epithet: asOptStr(m.epithet),
      kunya: typeof m.kunya === 'string' ? m.kunya : '',
      honorificTitle: (m.honorificTitle as ArabicHonorificTitle) || 'بدون',
      prestigeBadge: m.prestigeBadge as TreePrestigeBadgeId | undefined,
      gender: m.gender === 'female' ? 'female' : 'male',
      generationLevel:
        typeof m.generationLevel === 'number' ? m.generationLevel : 0,
      isRecordKeeper: Boolean(m.isRecordKeeper),
      isDirectSpineLineage: Boolean(m.isDirectSpineLineage),
      relationToTargetLabel: m.relationToTargetLabel || 'فرد من العائلة',
      fatherId: asOptStr(m.fatherId),
      motherId: asOptStr(m.motherId),
      siblingOfId: asOptStr(m.siblingOfId),
      spouseIds: Array.isArray(m.spouseIds)
        ? m.spouseIds.filter((s): s is string => typeof s === 'string')
        : [],
      maidenFamilyLine: asOptStr(m.maidenFamilyLine),
      marriageAllianceNote: asOptStr(m.marriageAllianceNote),
      vitalStatus:
        m.vitalStatus === 'deceased' || m.vitalStatus === 'unspecified'
          ? m.vitalStatus
          : 'living',
      birthPrecision:
        m.birthPrecision === 'full_date' ||
        m.birthPrecision === 'approximate' ||
        m.birthPrecision === 'era'
          ? m.birthPrecision
          : 'year_only',
      birthCalendar: m.birthCalendar === 'gregorian' ? 'gregorian' : 'hijri',
      birthDateValue:
        typeof m.birthDateValue === 'string' ? m.birthDateValue : '',
      birthPlace: typeof m.birthPlace === 'string' ? m.birthPlace : '',
      deathDateValue: asOptStr(m.deathDateValue),
      deathPlace: asOptStr(m.deathPlace),
      femalePrivacyMasked: Boolean(m.femalePrivacyMasked),
      biography: asOptStr(m.biography),
      photoUrl: asOptStr(m.photoUrl),
      photoThumbnailUrl: asOptStr(m.photoThumbnailUrl),
    }));

    return {
      mergedMembers: mappedMembers,
      highlightedNewIds: insertedIds,
      proposedNames: proposedNodes.map((n) => n.firstName).filter(Boolean),
    };
  }, [visualDiffReviewRequest, rawTreeMembers, result.familyName]);

  const diffPreviewLineageResult = useMemo<LineageSearchResult>(
    () => ({
      ...result,
      recommendedInitialState: DashboardStateMode.AnnualVip,
    }),
    [result]
  );

  const showToast = (type: 'success' | 'info' | 'error', text: string) => {
    setBanner({ type, text });
    setTimeout(() => {
      setBanner((prev) => (prev?.text === text ? null : prev));
    }, 5200);
  };

  // Load real Firestore data cleanly on mount/identity change
  useEffect(() => {
    let active = true;
    setIsLoading(true);

    (async () => {
      try {
        const [
          circleDoc,
          pendingAccess,
          refStats,
          portals,
          treeFromCloud,
        ] = await Promise.all([
          fetchKinshipCircleForOwner(effectiveUserId),
          fetchPendingSiteAccessRequestsForOwner(effectiveUserId),
          fetchUserReferralDashboard(effectiveUserId, ownerDisplayName),
          fetchAuthorizedFamilyPortalsForEmail(effectiveEmail, effectiveUserId),
          fetchUserFamilyTreeFromFirebase<RawTreePersonForPublicProjection>(
            effectiveUserId,
            effectiveEmail,
            result.familyName
          ).catch(() => null),
        ]);

        const resolvedSlug =
          publishedSiteSlug || circleDoc.siteSlug || undefined;
        const micrositeDoc = await fetchOwnerMicrositeForCommunity(
          effectiveUserId,
          resolvedSlug
        ).catch(() => null);

        if (!active) return;

        setCircle(circleDoc);
        setAccessRequests(pendingAccess);
        setReferralStats(refStats);
        setAuthorizedPortals(portals);
        setOwnerMicrosite(micrositeDoc);

        const localTree =
          readUserFamilyTreeFromLocal<RawTreePersonForPublicProjection>(
            effectiveUserId,
            effectiveEmail,
            result.familyName
          ) || [];
        const finalTree =
          Array.isArray(treeFromCloud) && treeFromCloud.length > 0
            ? treeFromCloud
            : localTree;
        setRawTreeMembers(finalTree);

        // Auto-open invite studio smoothly if registrar has 0 members yet
        if (isOwnRegistrarWorkspace && (circleDoc.members || []).length === 0) {
          setInviteStudioOpen(true);
        }
      } finally {
        if (active) setIsLoading(false);
      }
    })();

    const unsubEnrichments = subscribeToOwnerEnrichmentRequests(
      effectiveUserId,
      (items) => {
        if (active) setEnrichments(items);
      }
    );

    return () => {
      active = false;
      unsubEnrichments();
    };
  }, [
    effectiveUserId,
    effectiveEmail,
    ownerDisplayName,
    result.familyName,
    publishedSiteSlug,
    isRegistrar,
  ]);

  // Derived real metrics (strictly from Firestore)
  const activeSiteSlug =
    publishedSiteSlug || ownerMicrosite?.siteSlug || circle.siteSlug || '';

  const contemporaryTreeOptions = useMemo(() => {
    return (rawTreeMembers || [])
      .filter((n) => n && n.isCertifiedReference !== true)
      .map((n) => {
        const first = String(n.firstName || n.name || '').trim();
        const fam = String(n.familyName || '').trim();
        const label = [first, fam].filter(Boolean).join(' ').trim() || 'فرد من العائلة';
        return {
          id: String(n.id),
          label,
          relation: String(n.relationLabel || n.relationToTargetLabel || '').trim(),
        };
      })
      .filter((opt) => Boolean(opt.id) && Boolean(opt.label));
  }, [rawTreeMembers]);

  const pendingEnrichments = useMemo(
    () =>
      enrichments.filter((e) => e.status === 'PENDING_REGISTRAR_APPROVAL'),
    [enrichments]
  );

  const reviewedEnrichments = useMemo(
    () =>
      enrichments.filter((e) => e.status !== 'PENDING_REGISTRAR_APPROVAL'),
    [enrichments]
  );

  // Real Face ID notes submitted on «موقعي» vault photos
  const realFaceIdEntries = useMemo(() => {
    const items = ownerMicrosite?.publishedVaultItems || [];
    const entries: Array<{
      id: string;
      vaultItemId: string;
      photoTitle: string;
      previewUrl: string;
      senderName: string;
      note: string;
      createdAt: string;
    }> = [];
    for (const v of items) {
      if (!Array.isArray(v.faceIdNotes)) continue;
      for (const note of v.faceIdNotes) {
        entries.push({
          id: note.id,
          vaultItemId: v.id,
          photoTitle: v.title,
          previewUrl: v.previewUrl,
          senderName: note.senderName,
          note: note.note,
          createdAt: note.createdAt,
        });
      }
    }
    return entries.sort((a, b) =>
      (b.createdAt || '').localeCompare(a.createdAt || '')
    );
  }, [ownerMicrosite]);

  const memoryQuests = useMemo(
    () => (Array.isArray(circle.memoryQuests) ? circle.memoryQuests : []),
    [circle.memoryQuests]
  );

  const activeMemoryQuests = useMemo(
    () => memoryQuests.filter((q) => q.status === 'ACTIVE'),
    [memoryQuests]
  );

  const totalIncomingEnrichmentCount =
    pendingEnrichments.length + realFaceIdEntries.length;

  const realEventsCount = ownerMicrosite?.cmsModules?.eventsModule?.items?.length || 0;

  const activePublicOrigin = resolveClientPublicAppBaseUrl();

  // Clean active public Majlis share URL (centrally configured for staging / live switch)
  const cleanMajlisUrl = useMemo(() => {
    const base = activeSiteSlug
      ? `${activePublicOrigin}/${activeSiteSlug}`
      : activePublicOrigin;
    const params: string[] = [];
    if (circle.majlisInviteToken) {
      params.push(`majlis=${encodeURIComponent(circle.majlisInviteToken)}`);
    }
    if (referralStats.referralCode) {
      params.push(`ref=${encodeURIComponent(referralStats.referralCode)}`);
    }
    return params.length > 0 ? `${base}?${params.join('&')}` : base;
  }, [
    activePublicOrigin,
    activeSiteSlug,
    circle.majlisInviteToken,
    referralStats.referralCode,
  ]);

  const cleanPortalDisplayUrl = activeSiteSlug
    ? `${activePublicOrigin}/${activeSiteSlug}`
    : `${activePublicOrigin}/?ref=${encodeURIComponent(referralStats.referralCode)}`;

  // Filter enrichments for Pillar 2
  const filteredPendingEnrichments = useMemo(() => {
    if (enrichmentFilter === 'FACE_ID') return [];
    if (enrichmentFilter === 'ALL') return pendingEnrichments;
    return pendingEnrichments.filter((e) => e.requestType === enrichmentFilter);
  }, [pendingEnrichments, enrichmentFilter]);

  const showFaceIdInQueue =
    enrichmentFilter === 'ALL' || enrichmentFilter === 'FACE_ID';

  // Handlers
  const handleOpenInviteStudioAction = (bypassGate?: boolean) => {
    if (!bypassGate && !isOwnRegistrarWorkspace) {
      requireCommunityPremiumAction('community_invite', () =>
        handleOpenInviteStudioAction(true)
      );
      return;
    }
    setActiveTab('circle');
    setInviteStudioOpen(true);
    setTimeout(() => {
      inviteStudioRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 80);
  };

  const handleAddRelative = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwnRegistrarWorkspace) {
      requireCommunityPremiumAction('community_invite', () => {
        setInviteStudioOpen(true);
      });
      return;
    }
    const cleanName = relName.trim();
    const cleanEmail = relEmail.trim().toLowerCase();
    if (!cleanName || !cleanEmail.includes('@')) {
      showToast('error', 'يرجى إدخال اسم القريب وبريده الإلكتروني الصحيح أولاً.');
      return;
    }

    const linkedOption = contemporaryTreeOptions.find(
      (opt) => opt.id === relTreePersonId
    );

    setInvitingRelative(true);
    try {
      const res = await addRelativeToKinshipCircleAndSendInvite({
        ownerId: effectiveUserId,
        ownerName: ownerDisplayName,
        familyName: result.familyName,
        originCountry: result.originCountry,
        originRegion: result.originRegion,
        siteSlug: activeSiteSlug || undefined,
        referralCode: referralStats.referralCode,
        relativeName: cleanName,
        kinshipRelation: relKinship.trim() || 'قريب',
        relativeEmail: cleanEmail,
        role: relRole,
        linkedTreePersonId: linkedOption?.id || undefined,
        linkedTreePersonName: linkedOption?.label || undefined,
      });

      setCircle(res.circle);
      setRelName('');
      setRelEmail('');
      setRelTreePersonId('');
      showToast('success', res.messageAr);
      onLogActivity?.(
        'إضافة ودعوة قريب لدائرة العائلة',
        `تمت إضافة ${cleanName} (${relKinship}) بصلاحية «${resolveRoleLabel(relRole)}»`
      );
    } catch {
      showToast('error', 'تعذر حفظ الدعوة حالياً، يرجى المحاولة مجدداً.');
    } finally {
      setInvitingRelative(false);
    }
  };

  const handleUpdateMemberRoleOrTree = async (
    member: KinshipCircleMember,
    updates: {
      role?: KinshipCircleMemberRole;
      linkedTreePersonId?: string | null;
      linkedTreePersonName?: string | null;
    }
  ) => {
    setUpdatingMemberId(member.id);
    try {
      const updated = await updateKinshipCircleMemberMeta({
        ownerId: effectiveUserId,
        memberId: member.id,
        ...updates,
      });
      setCircle(updated);
      showToast(
        'success',
        `تم تحديث صلاحيات وربط (${member.name}) في سجل دائرة العائلة ✓`
      );
    } catch {
      showToast('error', 'تعذر تحديث بيانات العضو حالياً.');
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleRemoveRelative = async (member: KinshipCircleMember) => {
    setRemovingEmail(member.email);
    try {
      const updated = await removeRelativeFromKinshipCircle({
        ownerId: effectiveUserId,
        memberEmail: member.email,
      });
      setCircle(updated);
      showToast(
        'info',
        `تم إلغاء صلاحية (${member.name}) وحذفه من دائرة العائلة الخاصة.`
      );
    } catch {
      showToast('error', 'تعذر حذف العضو حالياً.');
    } finally {
      setRemovingEmail(null);
    }
  };

  const handleResolveAccess = async (
    req: SiteAccessRequestDoc,
    approve: boolean
  ) => {
    setResolvingAccessId(req.id);
    try {
      await resolveSiteAccessRequest({
        request: req,
        approve,
        ownerName: ownerDisplayName,
      });
      setAccessRequests((prev) => prev.filter((item) => item.id !== req.id));
      if (approve) {
        const refreshed = await fetchKinshipCircleForOwner(effectiveUserId);
        setCircle(refreshed);
        showToast(
          'success',
          `تم قبول (${req.visitorName}) وإضافته فوراً إلى دائرة عائلة ${result.familyName} ✓`
        );
      } else {
        showToast('info', `تمت أرشفة طلب (${req.visitorName}).`);
      }
    } catch {
      showToast('error', 'تعذر معالجة طلب الدخول حالياً.');
    } finally {
      setResolvingAccessId(null);
    }
  };

  const handleLaunchMemoryQuest = async (
    payload: {
      title: string;
      promptText: string;
      category: MemoryQuestCategory;
    },
    bypassGate?: boolean
  ) => {
    if (!bypassGate && !isOwnRegistrarWorkspace) {
      requireCommunityPremiumAction('community_quest', () => {
        handleLaunchMemoryQuest(payload, true).catch(() => {});
      });
      return;
    }
    const cleanTitle = payload.title.trim();
    const cleanPrompt = payload.promptText.trim();
    if (!cleanTitle || !cleanPrompt) {
      showToast('error', 'يرجى كتابة عنوان الحملة ونص نداء التوثيق أولاً.');
      return;
    }
    setSavingQuest(true);
    try {
      const updated = await createFamilyMemoryQuest({
        ownerId: effectiveUserId,
        familyName: result.familyName,
        siteSlug: activeSiteSlug || undefined,
        title: cleanTitle,
        promptText: cleanPrompt,
        category: payload.category,
      });
      setCircle(updated);
      setQuestTitle('');
      setQuestPrompt('');
      setQuestCategory('custom');
      setQuestComposerOpen(false);
      showToast(
        'success',
        `تم إطلاق حملة «${cleanTitle}» وحفظها بنجاح — شاركها الآن في مجموعة العائلة ✓`
      );
      onLogActivity?.(
        'إطلاق حملة جمع ذاكرة للعائلة',
        `تم إنشاء حملة توثيق: ${cleanTitle}`
      );
    } catch {
      showToast('error', 'تعذر حفظ الحملة حالياً.');
    } finally {
      setSavingQuest(false);
    }
  };

  const handleQuestStatusAction = async (
    quest: FamilyMemoryQuest,
    action: 'ACTIVE' | 'ARCHIVED' | 'DELETE'
  ) => {
    try {
      const updated = await updateFamilyMemoryQuestStatus({
        ownerId: effectiveUserId,
        questId: quest.id,
        action,
      });
      setCircle(updated);
      if (action === 'ARCHIVED') {
        showToast('info', `تمت أرشفة حملة «${quest.title}».`);
      } else if (action === 'ACTIVE') {
        showToast('success', `تمت إعادة تفعيل حملة «${quest.title}» ✓`);
      } else {
        showToast('info', `تم حذف حملة «${quest.title}».`);
      }
    } catch {
      showToast('error', 'تعذر تحديث حالة الحملة حالياً.');
    }
  };

  const handleCopyQuestCallout = async (quest: FamilyMemoryQuest) => {
    const shareMsg = `✦ نداء توثيق خاص بعائلة ${result.familyName} ✦\n«${quest.title}»\n\n${quest.promptText}\n\nللمشاركة وإرسال الصور أو الأسماء مباشرة عبر بوابة عائلتنا:\n${cleanPortalDisplayUrl}`;
    try {
      await navigator.clipboard.writeText(shareMsg);
      setCopiedQuestId(quest.id);
      setTimeout(() => setCopiedQuestId(null), 2200);
    } catch {
      // Ignore
    }
  };

  const handleReviewEnrichment = async (
    req: TreeEnrichmentRequestDoc,
    approve: boolean
  ) => {
    setReviewingId(req.id);
    try {
      const res = await reviewAndMergeEnrichmentRequest({
        request: req,
        approve,
        ownerId: effectiveUserId,
        ownerEmail: effectiveEmail,
        familyName: result.familyName,
      });
      showToast(approve ? 'success' : 'info', res.messageAr);
      if (approve && Array.isArray(res.mergedTree)) {
        setRawTreeMembers(res.mergedTree);
      }
      if (visualDiffReviewRequest?.id === req.id) {
        setVisualDiffReviewRequest(null);
      }
      if (approve) {
        const [refreshed, refreshedSite] = await Promise.all([
          fetchKinshipCircleForOwner(effectiveUserId),
          fetchOwnerMicrositeForCommunity(effectiveUserId, activeSiteSlug),
        ]);
        setCircle(refreshed);
        if (refreshedSite) {
          setOwnerMicrosite(refreshedSite);
        }
        onLogActivity?.(
          'اعتماد ودمج إثراء عائلي',
          `تم اعتماد مقترح (${req.requesterName}) ودمجه في سجلات العائلة`
        );
      }
    } catch {
      showToast('error', 'تعذر إتمام مراجعة المقترح حالياً.');
    } finally {
      setReviewingId(null);
    }
  };

  // Pre-crafted Arabic WhatsApp invite message for Pillar 1
  const craftedRelativeWhatsappHref = useMemo(() => {
    const recipient = relName.trim() ? `العزيز ${relName.trim()}، ` : '';
    const roleLabel = resolveRoleLabel(relRole);
    const text = `السلام عليكم ${recipient}يسعدني دعوتك للانضمام إلى الدائرة العائلية الخاصة لعائلة ${result.familyName} على منصة «جذوري» بصلاحية (${roleLabel}) لتوثيق شجرة العائلة وحفظ صورنا وذكرياتنا المشتركة ✦\nرابط بوابة عائلتنا:\n${cleanMajlisUrl}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }, [relName, relRole, result.familyName, cleanMajlisUrl]);

  // Shared Flagship Card for Joined Family Circles & Shared Trees (Warm Ivory Brand Palette)
  const renderJoinedFamilyPortalsCard = () => (
    <section
      data-testid="joined-family-portals-card"
      className="rounded-3xl border border-[#D8C7B2] bg-[#FAF7F2] p-5 sm:p-7 text-[#1F1F1C] shadow-xs space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D97757]">
            <ShieldCheck className="w-4 h-4 text-[#D97757]" />
            <span>عضويات الدوائر العائلية الموثّقة</span>
          </div>
          <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#1F1F1C]">
            دوائر وشجرات العائلات المنضمّ إليها
          </h2>
          <p className="text-xs sm:text-sm text-[#1F1F1C]/75">
            تصفح الشجرة العائلية المشتركة، اقترح إضافات للأقارب، وتابع المناسبات
            والذكريات في العائلات التي دُعيت إليها مباشرة من هنا.
          </p>
        </div>
        <div className="px-3 py-1 rounded-xl bg-[#E8DED2] border border-[#D8C7B2] text-xs font-bold text-[#D97757] tabular-nums">
          {authorizedPortals.length} دائرة عائلية نشطة
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-[#D8C7B2] bg-[#F5F1E8] p-6 text-center text-xs text-[#1F1F1C]/75">
          جاري تحميل دوائر العائلات المنضمّ إليها...
        </div>
      ) : authorizedPortals.length === 0 ? (
        <div className="rounded-2xl border border-[#D8C7B2] bg-[#F5F1E8] p-6 text-center space-y-2">
          <JUTHORI_SERVICE_ICONS.tree className="w-8 h-8 text-[#D97757] mx-auto" />
          <div className="text-sm font-bold text-[#1F1F1C]">
            لم تنضم إلى دائرة عائلة منشورة بعد
          </div>
          <p className="text-xs text-[#1F1F1C]/75 max-w-lg mx-auto leading-relaxed">
            فور قبولك دعوة من أمين سجل عائلتك أو إدراج بريدك الإلكتروني في دائرة
            العائلة، ستظهر شجرة العائلة المشتركة وديوانها هنا مباشرة.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {authorizedPortals.map((portal) => {
            const upcomingEvents = (
              portal.siteData.cmsModules?.eventsModule?.items || []
            ).slice(0, 2);
            const hasTree =
              (portal.siteData.publishedTreeMembers || []).length > 0;
            return (
              <div
                key={portal.siteSlug}
                data-testid={`joined-family-card-${portal.siteSlug}`}
                className="rounded-2xl border border-[#D8C7B2] bg-[#F5F1E8] p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="text-xs font-bold text-[#D97757]">
                        {portal.viewerRoleLabelAr}
                        {portal.kinshipRelation
                          ? ` · ${portal.kinshipRelation}`
                          : ''}
                      </div>
                      <h3 className="text-lg font-display font-extrabold text-[#1F1F1C] truncate">
                        ديوان وعائلة {portal.familyName}
                      </h3>
                      <p className="text-xs text-[#1F1F1C]/75">
                        أمين السجل: {portal.ownerDisplayName}
                        {portal.originCountry ? ` · ${portal.originCountry}` : ''}
                      </p>
                    </div>
                    <span className="w-10 h-10 rounded-xl bg-[#E8DED2] border border-[#D8C7B2] flex items-center justify-center shrink-0 text-[#D97757]">
                      <JUTHORI_SERVICE_ICONS.tree className="w-5 h-5" />
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#1F1F1C]/80 tabular-nums">
                    <span>
                      <strong className="text-[#1F1F1C]">
                        {portal.membersCount}
                      </strong>{' '}
                      فرد في الدوحة
                    </span>
                    {portal.generationsCount > 0 && (
                      <span>
                        <strong className="text-[#1F1F1C]">
                          {portal.generationsCount}
                        </strong>{' '}
                        أجيال
                      </span>
                    )}
                    {portal.canProposeEnrichment && (
                      <span className="text-[#D97757] font-bold">
                        يمكنك اقتراح إضافة أقارب في الشجرة
                      </span>
                    )}
                  </div>

                  {upcomingEvents.length > 0 && (
                    <div className="rounded-xl border border-[#D8C7B2] bg-[#FAF7F2] p-3 space-y-1.5">
                      <div className="text-[11px] font-bold text-[#D97757] flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>أحدث مناسبات العائلة</span>
                      </div>
                      {upcomingEvents.map((ev) => (
                        <div
                          key={ev.id}
                          className="text-xs text-[#1F1F1C] flex items-center justify-between gap-2"
                        >
                          <span className="truncate font-semibold">
                            {ev.title}
                          </span>
                          <span className="text-[11px] text-[#1F1F1C]/70 shrink-0">
                            {ev.locationLabel}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={!hasTree}
                    data-testid={`open-shared-tree-btn-${portal.siteSlug}`}
                    onClick={() => setActiveSharedTreePortal(portal)}
                    className="flex-1 h-10 px-4 rounded-xl bg-[#D97757] hover:bg-[#C46546] disabled:opacity-50 text-[#F5F1E8] text-xs font-display font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shadow-xs transition"
                  >
                    <JUTHORI_SERVICE_ICONS.tree className="w-4 h-4 shrink-0" />
                    <span>فتح دوحة العائلة المشتركة</span>
                  </button>

                  <a
                    href={`/${portal.siteSlug}`}
                    data-testid={`visit-joined-portal-link-${portal.siteSlug}`}
                    className="h-10 px-4 rounded-xl border border-[#D8C7B2] bg-[#FAF7F2] hover:bg-[#E8DED2] text-[#1F1F1C] text-xs font-display font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors"
                  >
                    <JUTHORI_SERVICE_ICONS.site className="w-3.5 h-3.5 text-[#D97757] shrink-0" />
                    <span>زيارة موقع ديوان العائلة</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );

  return (
    <div className="w-full space-y-3.5 pb-8">
      {/* =====================================================================
          1. UNIFIED WORKSPACE HEADER (Exact 86px Parity Across All 6 Pages)
      ====================================================================== */}
      <UnifiedWorkspaceHeader
        testId="community-unified-header"
        icon={<JUTHORI_SERVICE_ICONS.community className="w-5 h-5" />}
        title={`مجتمع عائلة ${result.familyName}`}
        actions={
          <>
            <WorkspaceIconTooltip label="بطاقة الدعوة ورمز QR">
              <button
                type="button"
                aria-label="بطاقة الدعوة ورمز QR"
                data-testid="community-qr-card-btn"
                onClick={() =>
                  requireCommunityPremiumAction('community_qr', () =>
                    setQrModalOpen(true)
                  )
                }
                className={WORKSPACE_ICON_BTN_CLASS}
              >
                <QrCode className="w-4 h-4 shrink-0" />
              </button>
            </WorkspaceIconTooltip>

            <WorkspaceIconTooltip label="دعوة قريب للدائرة" align="left">
              <button
                type="button"
                aria-label="دعوة قريب للدائرة"
                data-testid="community-invite-relative-btn"
                onClick={() => handleOpenInviteStudioAction()}
                className={WORKSPACE_PRIMARY_ICON_BTN_CLASS}
              >
                <UserPlus className="w-4 h-4 shrink-0" />
              </button>
            </WorkspaceIconTooltip>
          </>
        }
      />

      {authorizedPortals.length > 0 && renderJoinedFamilyPortalsCard()}

      {/* =====================================================================
          1B. SEPARATED 4-PILLAR NAVIGATION BAR (mt-3.5 below unified header)
      ====================================================================== */}
      <div
        className="p-1.5 rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] shadow-[0_2px_10px_rgba(31,31,28,0.02)] grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-1.5"
        role="tablist"
        aria-label="أركان مجتمعي"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'circle'}
          onClick={() => setActiveTab('circle')}
          className={`px-3.5 py-2.5 rounded-xl text-xs font-display font-bold flex items-center justify-between gap-2 transition-all cursor-pointer ${
            activeTab === 'circle'
              ? 'bg-[#D97757] text-[#F5F1E8] shadow-xs'
              : 'text-[#1F1F1C] hover:text-[#1F1F1C] hover:bg-[#E8DED2]/70'
          }`}
        >
          <span className="inline-flex items-center gap-2 truncate">
            <Users
              className={`w-4 h-4 shrink-0 ${
                activeTab === 'circle' ? 'text-[#F5F1E8]' : 'text-[#D97757]'
              }`}
            />
            <span className="truncate">1. دائرة الأقارب</span>
          </span>
          <span
            className={`px-2 py-0.5 rounded-md text-[11px] tabular-nums shrink-0 ${
              activeTab === 'circle'
                ? 'bg-[#F5F1E8]/20 text-[#F5F1E8]'
                : 'bg-[#E8DED2] text-[#D97757]'
            }`}
          >
            {circle.members.length}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'enrichment'}
          onClick={() => setActiveTab('enrichment')}
          className={`px-3.5 py-2.5 rounded-xl text-xs font-display font-bold flex items-center justify-between gap-2 transition-all cursor-pointer ${
            activeTab === 'enrichment'
              ? 'bg-[#D97757] text-[#F5F1E8] shadow-xs'
              : 'text-[#1F1F1C] hover:text-[#1F1F1C] hover:bg-[#E8DED2]/70'
          }`}
        >
          <span className="inline-flex items-center gap-2 truncate">
            <Inbox
              className={`w-4 h-4 shrink-0 ${
                activeTab === 'enrichment' ? 'text-[#F5F1E8]' : 'text-[#D97757]'
              }`}
            />
            <span className="truncate">2. مركز الإثراء وحملات الذاكرة</span>
          </span>
          <span
            className={`px-2 py-0.5 rounded-md text-[11px] tabular-nums shrink-0 ${
              activeTab === 'enrichment'
                ? 'bg-[#F5F1E8]/20 text-[#F5F1E8]'
                : totalIncomingEnrichmentCount > 0
                ? 'bg-[#D97757] text-[#F5F1E8]'
                : 'bg-[#E8DED2] text-[#D97757]'
            }`}
          >
            {totalIncomingEnrichmentCount}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'events'}
          onClick={() => setActiveTab('events')}
          className={`px-3.5 py-2.5 rounded-xl text-xs font-display font-bold flex items-center justify-between gap-2 transition-all cursor-pointer ${
            activeTab === 'events'
              ? 'bg-[#D97757] text-[#F5F1E8] shadow-xs'
              : 'text-[#1F1F1C] hover:text-[#1F1F1C] hover:bg-[#E8DED2]/70'
          }`}
        >
          <span className="inline-flex items-center gap-2 truncate">
            <Calendar
              className={`w-4 h-4 shrink-0 ${
                activeTab === 'events' ? 'text-[#F5F1E8]' : 'text-[#D97757]'
              }`}
            />
            <span className="truncate">3. صلة الرحم والمناسبات (RSVP)</span>
          </span>
          <span
            className={`px-2 py-0.5 rounded-md text-[11px] tabular-nums shrink-0 ${
              activeTab === 'events'
                ? 'bg-[#F5F1E8]/20 text-[#F5F1E8]'
                : 'bg-[#E8DED2] text-[#D97757]'
            }`}
          >
            {realEventsCount}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'ambassador'}
          onClick={() => setActiveTab('ambassador')}
          className={`px-3.5 py-2.5 rounded-xl text-xs font-display font-bold flex items-center justify-between gap-2 transition-all cursor-pointer ${
            activeTab === 'ambassador'
              ? 'bg-[#D97757] text-[#F5F1E8] shadow-xs'
              : 'text-[#1F1F1C] hover:text-[#1F1F1C] hover:bg-[#E8DED2]/70'
          }`}
        >
          <span className="inline-flex items-center gap-2 truncate">
            <Award
              className={`w-4 h-4 shrink-0 ${
                activeTab === 'ambassador' ? 'text-[#F5F1E8]' : 'text-[#D97757]'
              }`}
            />
            <span className="truncate">4. سفير جذوري ومكافآت</span>
          </span>
          <span
            dir="ltr"
            className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-bold tabular-nums shrink-0 ${
              activeTab === 'ambassador'
                ? 'bg-[#F5F1E8]/20 text-[#F5F1E8]'
                : 'bg-[#E8DED2] text-[#D97757]'
            }`}
          >
            ${REFERRAL_REWARD_USD}
          </span>
        </button>
      </div>

      {/* Transient Feedback Banner */}
      {banner && (
        <div
          className={`rounded-xl px-4 py-3 text-xs font-semibold flex items-center justify-between gap-3 border ${
            banner.type === 'success'
              ? 'bg-[#1F1F1C]/5 border-[#1F1F1C]/25 text-[#1F1F1C]'
              : banner.type === 'error'
              ? 'bg-[#1F1F1C]/5 border-[#1F1F1C]/25 text-[#1F1F1C]'
              : 'bg-[#F5F1E8] border-[#D97757]/40 text-[#1F1F1C]'
          }`}
        >
          <span>{banner.text}</span>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="p-1 rounded-md hover:bg-[#1F1F1C]/5 cursor-pointer"
            aria-label="إغلاق التنبيه"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {isLoading && (
        <div className="rounded-2xl bg-[#F5F1E8] border border-[#D97757]/30 p-8 text-center text-xs text-[#1F1F1C]/65">
          جارٍ مزامنة دائرة عائلة {result.familyName} من السجل السحابي الموثق...
        </div>
      )}

      {/* =====================================================================
          2. PILLAR 1: دائرة الأقارب
      ====================================================================== */}
      {!isLoading && activeTab === 'circle' && (
        <div className="space-y-5">
          {/* Section 1: Sculpted Invitation Atelier */}
          <div
            ref={inviteStudioRef}
            className="rounded-2xl bg-gradient-to-l from-[#FAF6EE] via-[#FDFBF7] to-[#F5EFE4] border border-[#D8C7B2]/80 relative overflow-hidden shadow-[0_2px_14px_rgba(31,31,28,0.03)] transition-all"
          >
            {/* Soft decorative top highlight hairline */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-l from-[#D97757]/55 via-[#D8C7B2]/60 to-transparent" />

            {/* Subtle family branch watermark in right corner */}
            <svg
              aria-hidden="true"
              viewBox="0 0 220 110"
              fill="none"
              className="pointer-events-none absolute -top-2 -right-3 w-48 h-24 text-[#1F1F1C] opacity-[0.05]"
            >
              <path
                d="M210 95 C175 75, 155 58, 130 48 C105 38, 88 22, 68 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="M155 62 C150 42, 162 28, 178 18"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
              <path
                d="M122 45 C106 52, 92 64, 78 78"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
              <path
                d="M96 31 C90 19, 97 10, 108 5"
                stroke="currentColor"
                strokeWidth="1.1"
                strokeLinecap="round"
              />
              <circle cx="178" cy="18" r="3" fill="currentColor" />
              <circle cx="68" cy="12" r="3" fill="currentColor" />
              <circle cx="78" cy="78" r="2.5" fill="currentColor" />
              <circle cx="108" cy="5" r="2.5" fill="currentColor" />
              <circle cx="130" cy="48" r="2.5" fill="currentColor" />
            </svg>

            {/* Collapsed / Header Plaque */}
            <div className="relative z-10 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-full bg-[#E8DED2] border-2 border-white ring-1 ring-[#D8C7B2] text-[#D97757] flex items-center justify-center shrink-0 shadow-[0_2px_8px_rgba(217,119,87,0.12)]">
                  <UserPlus className="w-4.5 h-4.5" />
                </div>
                <h3 className="text-[15px] font-display font-bold text-[#1F1F1C] tracking-tight">
                  دعوة قريب لدائرة العائلة وتحديد الصلاحيات
                </h3>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!inviteStudioOpen && !isOwnRegistrarWorkspace) {
                    requireCommunityPremiumAction('community_invite', () =>
                      setInviteStudioOpen(true)
                    );
                    return;
                  }
                  setInviteStudioOpen((v) => !v);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-display font-bold cursor-pointer transition-all shrink-0 ${
                  inviteStudioOpen
                    ? 'bg-[#E8DED2]/90 hover:bg-[#D8C7B2]/70 border border-[#D8C7B2] text-[#1F1F1C]'
                    : 'bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] shadow-[0_2px_10px_rgba(217,119,87,0.22)]'
                }`}
              >
                {inviteStudioOpen ? 'طي النموذج' : '+ دعوة قريب جديد'}
              </button>
            </div>

            {/* Smooth Unfolding Invitation Form */}
            {inviteStudioOpen && (
              <form
                onSubmit={handleAddRelative}
                className="relative z-10 px-6 pb-6 pt-5 border-t border-[#D8C7B2]/60 bg-[#FDFBF7]/70 space-y-5"
              >
                {/* Basic Relative Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-display font-bold text-[#1F1F1C]">
                      اسم القريب الكامل
                    </label>
                    <input
                      type="text"
                      required
                      value={relName}
                      onChange={(e) => setRelName(e.target.value)}
                      placeholder="مثال: عبد الله بن خالد"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6EE] focus:bg-[#FDFBF7] border border-[#D8C7B2] text-xs text-[#1F1F1C] placeholder:text-[#1F1F1C]/40 focus:outline-none focus:border-[#D97757] focus:ring-2 focus:ring-[#D97757]/15 transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-display font-bold text-[#1F1F1C]">
                      البريد الإلكتروني للقريب
                    </label>
                    <input
                      type="email"
                      required
                      dir="ltr"
                      value={relEmail}
                      onChange={(e) => setRelEmail(e.target.value)}
                      placeholder="relative@example.com"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6EE] focus:bg-[#FDFBF7] border border-[#D8C7B2] text-xs text-[#1F1F1C] placeholder:text-[#1F1F1C]/40 text-left focus:outline-none focus:border-[#D97757] focus:ring-2 focus:ring-[#D97757]/15 transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-display font-bold text-[#1F1F1C]">
                      صلة القرابة
                    </label>
                    <input
                      type="text"
                      required
                      value={relKinship}
                      onChange={(e) => setRelKinship(e.target.value)}
                      placeholder="ابن عم / شقيق / عم"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6EE] focus:bg-[#FDFBF7] border border-[#D8C7B2] text-xs text-[#1F1F1C] placeholder:text-[#1F1F1C]/40 focus:outline-none focus:border-[#D97757] focus:ring-2 focus:ring-[#D97757]/15 transition-all"
                    />
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {KINSHIP_PRESETS.slice(0, 6).map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setRelKinship(preset)}
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border cursor-pointer transition-all ${
                            relKinship === preset
                              ? 'bg-[#D97757] text-[#F5F1E8] border-[#D97757] shadow-2xs'
                              : 'bg-[#F5F1E8] text-[#1F1F1C]/75 border-[#D8C7B2]/80 hover:bg-[#E8DED2]'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Role Selector — 3 Sculpted Medallion Cards */}
                <div className="space-y-2.5">
                  <label className="block text-xs font-display font-bold text-[#1F1F1C]">
                    مستوى الصلاحية داخل دائرة العائلة
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {ROLE_OPTIONS.map((roleOpt) => {
                      const selected = relRole === roleOpt.id;
                      return (
                        <button
                          key={roleOpt.id}
                          type="button"
                          onClick={() => setRelRole(roleOpt.id)}
                          className={`relative overflow-hidden text-right rounded-2xl p-4 border transition-all cursor-pointer ${
                            selected
                              ? 'bg-gradient-to-b from-[#FAF6EE] to-[#F5EFE4] border-[#D97757] ring-1 ring-[#D97757]/30 shadow-[0_4px_14px_rgba(217,119,87,0.09)]'
                              : 'bg-[#FDFBF7] border-[#D8C7B2]/80 hover:border-[#D97757]/55 hover:bg-[#FAF6EE]/70'
                          }`}
                        >
                          {/* Subtle heritage corner motif */}
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none absolute -bottom-3 -left-3 w-12 h-12 rounded-full border transition-opacity ${
                              selected
                                ? 'border-[#D97757]/25 opacity-100'
                                : 'border-[#D8C7B2]/35 opacity-60'
                            }`}
                          />
                          <div className="relative z-10 flex items-center justify-between gap-2">
                            <span className="text-xs font-display font-bold text-[#1F1F1C]">
                              {roleOpt.labelAr}
                            </span>
                            <span
                              className={`w-4.5 h-4.5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                                selected
                                  ? 'bg-[#D97757] border-[#D97757] text-[#F5F1E8]'
                                  : 'bg-[#FAF6EE] border-[#D8C7B2]'
                              }`}
                            >
                              {selected && <Check className="w-2.5 h-2.5" />}
                            </span>
                          </div>
                          <p className="relative z-10 text-[11px] text-[#1F1F1C]/65 mt-1.5 leading-relaxed">
                            {roleOpt.descriptionAr}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Optional Smart Tree Member Binding */}
                <div className="rounded-xl bg-[#F5F1E8]/85 border border-[#D8C7B2]/80 px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="text-xs font-display font-bold text-[#1F1F1C] flex items-center gap-1.5">
                      <JUTHORI_SERVICE_ICONS.tree className="w-4 h-4 text-[#D97757]" />
                      <span>ربط العضو ببطاقته في «شجرتي» (اختياري)</span>
                    </div>
                    <p className="text-[11px] text-[#1F1F1C]/60">
                      {contemporaryTreeOptions.length > 0
                        ? `اختر بطاقة القريب من بين ${contemporaryTreeOptions.length} فرداً مسجلاً في شجرتك المعاصرة.`
                        : 'أضف أفراد عائلتك في «شجرتي» لتتمكن من ربط كل مدعو بموقعه الفعلي في الشجرة.'}
                    </p>
                  </div>
                  <div className="relative sm:w-72 shrink-0">
                    <select
                      value={relTreePersonId}
                      onChange={(e) => setRelTreePersonId(e.target.value)}
                      disabled={contemporaryTreeOptions.length === 0}
                      className="w-full appearance-none pr-3.5 pl-9 py-2 rounded-full bg-[#FDFBF7] border border-[#D8C7B2] text-xs font-semibold text-[#1F1F1C] focus:outline-none focus:border-[#D97757] disabled:opacity-50 cursor-pointer"
                    >
                      <option value="">— بدون ربط مسبق في الشجرة —</option>
                      {contemporaryTreeOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                          {opt.relation ? ` (${opt.relation})` : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-[#D97757] pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* Multi-Channel Submit & WhatsApp Invite Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="text-[11px] text-[#1F1F1C]/60 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#D97757] shrink-0" />
                    <span>
                      يصل القريب بريد دعوة رسمي مع خيار إلغاء الارتباط الفوري احتراماً لخصوصيته.
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <a
                      href={craftedRelativeWhatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2.5 rounded-xl bg-[#FAF6EE] hover:bg-[#E8DED2] border border-[#D8C7B2] text-[#1F1F1C] text-xs font-display font-bold inline-flex items-center gap-2 transition-colors"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-[#D97757]" />
                      <span>مشاركة دعوة مجهزة عبر واتساب</span>
                    </a>

                    <button
                      type="submit"
                      disabled={invitingRelative}
                      className="px-5 py-2.5 rounded-xl bg-[#D97757] hover:bg-[#C46546] disabled:opacity-55 text-[#F5F1E8] text-xs font-display font-bold inline-flex items-center gap-2 transition-colors cursor-pointer shadow-[0_2px_10px_rgba(217,119,87,0.2)]"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>
                        {invitingRelative
                          ? 'جارٍ الحفظ والإرسال...'
                          : 'حفظ وإرسال الدعوة البريدية'}
                      </span>
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>

          {/* Pending Private Site Access Requests (Only when real pending requests exist) */}
          {isRegistrar && accessRequests.length > 0 && (
            <div className="rounded-2xl bg-gradient-to-l from-[#FAF6EE] to-[#FDFBF7] border border-[#D97757]/40 overflow-hidden shadow-[0_2px_12px_rgba(217,119,87,0.06)]">
              <div className="px-6 py-3.5 bg-[#E8DED2]/55 border-b border-[#D8C7B2]/80 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-display font-bold text-[#D97757]">
                  <UserCheck className="w-4 h-4" />
                  <span>طلبات دخول جديدة لبوابة العائلة الخاصة</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-[#D97757] text-[#F5F1E8] text-[11px] font-bold tabular-nums">
                  {accessRequests.length}
                </span>
              </div>
              <div className="divide-y divide-[#D8C7B2]/50">
                {accessRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5">
                      <div className="text-xs font-display font-bold text-[#1F1F1C]">
                        {req.visitorName}
                        <span
                          className="font-normal text-[#1F1F1C]/60 mr-2"
                          dir="ltr"
                        >
                          ({req.visitorEmail})
                        </span>
                      </div>
                      {req.kinshipNote && (
                        <div className="text-[11px] text-[#D97757]">
                          ملاحظة القرابة: {req.kinshipNote}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={resolvingAccessId === req.id}
                        onClick={() => handleResolveAccess(req, true)}
                        className="px-3.5 py-2 rounded-xl bg-[#D97757] hover:bg-[#C46546] disabled:opacity-50 text-[#F5F1E8] text-xs font-display font-bold cursor-pointer transition-colors"
                      >
                        قبول وإضافة للدائرة ✓
                      </button>
                      <button
                        type="button"
                        disabled={resolvingAccessId === req.id}
                        onClick={() => handleResolveAccess(req, false)}
                        className="px-3 py-2 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] disabled:opacity-50 text-[#1F1F1C] text-xs font-semibold cursor-pointer transition-colors"
                      >
                        اعتذار
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 2: Bespoke Relative Membership Passes (Zero Outer Dry Box) */}
          <section className="space-y-3.5">
            {/* Editorial Header with Capsule Count & Gradient Hairline */}
            <div className="flex items-center gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <div className="w-8 h-8 rounded-full bg-[#E8DED2] border border-[#D8C7B2] text-[#D97757] flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <h3 className="text-[15px] font-display font-bold text-[#1F1F1C]">
                  أفراد دائرة عائلة {result.familyName} المعتمدون
                </h3>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#E8DED2]/85 border border-[#D8C7B2] text-[11px] font-display font-bold text-[#1F1F1C]/80 tabular-nums">
                  {circle.members.length === 0
                    ? '0 أقارب معتمدين'
                    : circle.members.length === 1
                    ? '1 قريب معتمد'
                    : circle.members.length === 2
                    ? 'قريبان معتمدان'
                    : `${circle.members.length} أقارب معتمدين`}
                </span>
              </div>
              <div className="hidden sm:block flex-1 h-px bg-gradient-to-l from-[#D8C7B2] via-[#D8C7B2]/45 to-transparent" />
            </div>

            {circle.members.length === 0 ? (
              <div className="rounded-2xl bg-gradient-to-l from-[#FAF6EE] via-[#FDFBF7] to-[#F5EFE4] border border-dashed border-[#D8C7B2] px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4 text-right">
                  <div className="w-12 h-12 rounded-full bg-[#E8DED2] border-2 border-white ring-1 ring-[#D8C7B2] text-[#D97757] flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="text-sm font-display font-bold text-[#1F1F1C]">
                      دائرة عائلتك جاهزة لاستقبال أول أفرادها
                    </h4>
                    <p className="text-xs text-[#1F1F1C]/65 leading-relaxed max-w-xl">
                      ادعُ أول قريب موثوق بصلاحية «مساعد أمين السجل» أو «راوي ومُساهم في الذاكرة» لبدء إثراء الشجرة والخزانة معاً.
                    </p>
                  </div>
                </div>
                {!inviteStudioOpen && (
                  <button
                    type="button"
                    onClick={() => handleOpenInviteStudioAction()}
                    className="px-4 py-2.5 rounded-xl bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] text-xs font-display font-bold inline-flex items-center gap-2 cursor-pointer transition-colors shrink-0 shadow-[0_2px_10px_rgba(217,119,87,0.2)]"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>دعوة أول قريب الآن</span>
                  </button>
                )}
              </div>
            ) : circle.members.length === 1 ? (
              (() => {
                const member = circle.members[0];
                const isActive = member.status === 'ACTIVE';
                const currentRole: KinshipCircleMemberRole =
                  member.role || 'memory_contributor';
                const memberWhatsappHref = `https://wa.me/?text=${encodeURIComponent(
                  `السلام عليكم ${member.name}، يسعدنا تواجدك معنا في دائرة عائلة ${result.familyName} على منصة جذوري ✦\nرابط دخول بوابة العائلة:\n${cleanMajlisUrl}`
                )}`;

                return (
                  <div
                    key={member.id}
                    className="w-full rounded-2xl bg-gradient-to-l from-[#FDFBF7] via-[#FAF6EE] to-[#F5EFE4]/90 border border-[#D8C7B2]/90 hover:border-[#D97757]/55 px-6 py-5 relative overflow-hidden shadow-[0_3px_16px_rgba(31,31,28,0.03)] transition-all"
                  >
                    {/* Subtle terracotta heritage accent hairline at top-right */}
                    <div className="pointer-events-none absolute top-0 right-0 w-28 h-[2px] bg-gradient-to-l from-[#D97757]/75 to-transparent" />

                    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_auto] items-center gap-5">
                      {/* Zone 1 (Right): Relative Identity */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-12 h-12 rounded-full bg-[#E8DED2] border-2 border-white ring-1 ring-[#D8C7B2] text-[#D97757] font-display font-extrabold text-base flex items-center justify-center shrink-0 shadow-[0_2px_8px_rgba(31,31,28,0.05)]">
                          {getArabicInitials(member.name)}
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-[15px] font-display font-extrabold text-[#1F1F1C] truncate">
                              {member.name}
                            </h4>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#E8DED2]/90 border border-[#D8C7B2] text-[11px] font-display font-bold text-[#D97757]">
                              {member.kinshipRelation}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                isActive
                                  ? 'bg-[#F5F1E8] border-[#D8C7B2] text-[#1F1F1C]'
                                  : 'bg-[#FAF6EE] border-[#D97757]/35 text-[#D97757]'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isActive ? 'bg-[#1F1F1C]' : 'bg-[#D97757]'
                                }`}
                              />
                              {isActive ? 'عضو مفعّل' : 'تم إرسال الدعوة'}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-[#1F1F1C]/60">
                            <span dir="ltr" className="font-mono truncate">
                              {member.email}
                            </span>
                            <span aria-hidden="true" className="text-[#D8C7B2]">
                              •
                            </span>
                            <span>
                              أُضيف{' '}
                              {new Date(member.addedAt).toLocaleDateString(
                                'ar-SA'
                              )}
                            </span>
                            {member.approvedEnrichmentsCount > 0 && (
                              <>
                                <span
                                  aria-hidden="true"
                                  className="text-[#D8C7B2]"
                                >
                                  •
                                </span>
                                <span className="text-[#D97757] font-semibold">
                                  {member.approvedEnrichmentsCount} مساهمة معتمدة
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Zone 2 (Center): Sleek Compact Pill Dropdowns */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 xl:px-5 xl:border-x xl:border-[#D8C7B2]/60">
                        <div className="space-y-1">
                          <label className="block text-[10px] font-display font-bold text-[#1F1F1C]/55 pr-1">
                            الصلاحية
                          </label>
                          <div className="relative">
                            <select
                              value={currentRole}
                              disabled={updatingMemberId === member.id}
                              onChange={(e) =>
                                handleUpdateMemberRoleOrTree(member, {
                                  role: e.target
                                    .value as KinshipCircleMemberRole,
                                })
                              }
                              className="w-full appearance-none pr-3.5 pl-8 py-2 rounded-full bg-[#F5F1E8] hover:bg-[#FAF6EE] border border-[#D8C7B2] focus:border-[#D97757] text-xs font-display font-bold text-[#1F1F1C] focus:outline-none disabled:opacity-50 cursor-pointer transition-colors"
                            >
                              {ROLE_OPTIONS.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.shortLabelAr}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 text-[#D97757] pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[10px] font-display font-bold text-[#1F1F1C]/55 pr-1">
                            الربط ببطاقة شجرتي
                          </label>
                          <div className="relative">
                            <select
                              value={member.linkedTreePersonId || ''}
                              disabled={
                                updatingMemberId === member.id ||
                                contemporaryTreeOptions.length === 0
                              }
                              onChange={(e) => {
                                const selectedId = e.target.value;
                                const found = contemporaryTreeOptions.find(
                                  (o) => o.id === selectedId
                                );
                                handleUpdateMemberRoleOrTree(member, {
                                  linkedTreePersonId: selectedId || null,
                                  linkedTreePersonName: found?.label || null,
                                });
                              }}
                              className="w-full appearance-none pr-3.5 pl-8 py-2 rounded-full bg-[#F5F1E8] hover:bg-[#FAF6EE] border border-[#D8C7B2] focus:border-[#D97757] text-xs font-display font-bold text-[#1F1F1C] focus:outline-none disabled:opacity-50 cursor-pointer transition-colors"
                            >
                              <option value="">غير مربوط بعد</option>
                              {contemporaryTreeOptions.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 text-[#D97757] pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" />
                          </div>
                        </div>
                      </div>

                      {/* Zone 3 (Left): Quick Actions */}
                      <div className="flex items-center justify-between xl:justify-end gap-2 shrink-0">
                        <a
                          href={memberWhatsappHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#FAF6EE] hover:bg-[#D97757] border border-[#D97757]/45 hover:border-[#D97757] text-[#D97757] hover:text-[#F5F1E8] text-xs font-display font-bold transition-all shadow-[0_1px_4px_rgba(217,119,87,0.08)] whitespace-nowrap"
                        >
                          <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>إرسال تذكير عبر واتساب</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => handleRemoveRelative(member)}
                          disabled={removingEmail === member.email}
                          title="إلغاء صلاحية القريب"
                          aria-label={`إلغاء صلاحية ${member.name}`}
                          className="w-9 h-9 rounded-full border border-transparent hover:border-[#D97757]/35 text-[#1F1F1C]/40 hover:text-[#D97757] hover:bg-[#D97757]/10 disabled:opacity-40 flex items-center justify-center cursor-pointer transition-all shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {circle.members.map((member) => {
                  const isActive = member.status === 'ACTIVE';
                  const currentRole: KinshipCircleMemberRole =
                    member.role || 'memory_contributor';
                  const memberWhatsappHref = `https://wa.me/?text=${encodeURIComponent(
                    `السلام عليكم ${member.name}، يسعدنا تواجدك معنا في دائرة عائلة ${result.familyName} على منصة جذوري ✦\nرابط دخول بوابة العائلة:\n${cleanMajlisUrl}`
                  )}`;

                  return (
                    <div
                      key={member.id}
                      className="rounded-2xl bg-gradient-to-l from-[#FDFBF7] via-[#FAF6EE] to-[#F5EFE4]/90 border border-[#D8C7B2]/90 hover:border-[#D97757]/55 p-5 relative overflow-hidden shadow-[0_2px_14px_rgba(31,31,28,0.025)] flex flex-col justify-between gap-4 transition-all"
                    >
                      <div className="pointer-events-none absolute top-0 right-0 w-20 h-[2px] bg-gradient-to-l from-[#D97757]/65 to-transparent" />

                      {/* Identity Row */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3.5 min-w-0">
                          <div className="w-12 h-12 rounded-full bg-[#E8DED2] border-2 border-white ring-1 ring-[#D8C7B2] text-[#D97757] font-display font-extrabold text-base flex items-center justify-center shrink-0 shadow-[0_2px_8px_rgba(31,31,28,0.05)]">
                            {getArabicInitials(member.name)}
                          </div>
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <h4 className="text-[15px] font-display font-extrabold text-[#1F1F1C] truncate">
                                {member.name}
                              </h4>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#E8DED2]/90 border border-[#D8C7B2] text-[10px] font-display font-bold text-[#D97757]">
                                {member.kinshipRelation}
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  isActive
                                    ? 'bg-[#F5F1E8] border-[#D8C7B2] text-[#1F1F1C]'
                                    : 'bg-[#FAF6EE] border-[#D97757]/35 text-[#D97757]'
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    isActive ? 'bg-[#1F1F1C]' : 'bg-[#D97757]'
                                  }`}
                                />
                                {isActive ? 'عضو مفعّل' : 'تم إرسال الدعوة'}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#1F1F1C]/60">
                              <span dir="ltr" className="font-mono truncate">
                                {member.email}
                              </span>
                              {member.approvedEnrichmentsCount > 0 && (
                                <>
                                  <span
                                    aria-hidden="true"
                                    className="text-[#D8C7B2]"
                                  >
                                    •
                                  </span>
                                  <span className="text-[#D97757] font-semibold">
                                    {member.approvedEnrichmentsCount} مساهمة معتمدة
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveRelative(member)}
                          disabled={removingEmail === member.email}
                          title="إلغاء صلاحية القريب"
                          aria-label={`إلغاء صلاحية ${member.name}`}
                          className="w-8 h-8 rounded-full border border-transparent hover:border-[#D97757]/35 text-[#1F1F1C]/40 hover:text-[#D97757] hover:bg-[#D97757]/10 disabled:opacity-40 flex items-center justify-center cursor-pointer transition-all shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Compact Pill Dropdowns */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-3 border-t border-[#D8C7B2]/55">
                        <div className="space-y-1">
                          <label className="block text-[10px] font-display font-bold text-[#1F1F1C]/55 pr-1">
                            الصلاحية
                          </label>
                          <div className="relative">
                            <select
                              value={currentRole}
                              disabled={updatingMemberId === member.id}
                              onChange={(e) =>
                                handleUpdateMemberRoleOrTree(member, {
                                  role: e.target
                                    .value as KinshipCircleMemberRole,
                                })
                              }
                              className="w-full appearance-none pr-3.5 pl-8 py-1.5 rounded-full bg-[#F5F1E8] hover:bg-[#FAF6EE] border border-[#D8C7B2] focus:border-[#D97757] text-[11px] font-display font-bold text-[#1F1F1C] focus:outline-none disabled:opacity-50 cursor-pointer transition-colors"
                            >
                              {ROLE_OPTIONS.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.shortLabelAr}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 text-[#D97757] pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[10px] font-display font-bold text-[#1F1F1C]/55 pr-1">
                            الربط ببطاقة شجرتي
                          </label>
                          <div className="relative">
                            <select
                              value={member.linkedTreePersonId || ''}
                              disabled={
                                updatingMemberId === member.id ||
                                contemporaryTreeOptions.length === 0
                              }
                              onChange={(e) => {
                                const selectedId = e.target.value;
                                const found = contemporaryTreeOptions.find(
                                  (o) => o.id === selectedId
                                );
                                handleUpdateMemberRoleOrTree(member, {
                                  linkedTreePersonId: selectedId || null,
                                  linkedTreePersonName: found?.label || null,
                                });
                              }}
                              className="w-full appearance-none pr-3.5 pl-8 py-1.5 rounded-full bg-[#F5F1E8] hover:bg-[#FAF6EE] border border-[#D8C7B2] focus:border-[#D97757] text-[11px] font-display font-bold text-[#1F1F1C] focus:outline-none disabled:opacity-50 cursor-pointer transition-colors"
                            >
                              <option value="">غير مربوط بعد</option>
                              {contemporaryTreeOptions.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 text-[#D97757] pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" />
                          </div>
                        </div>
                      </div>

                      {/* Footer Meta & WhatsApp Pill */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <span className="text-[11px] text-[#1F1F1C]/55">
                          {member.linkedTreePersonName ? (
                            <span className="inline-flex items-center gap-1.5 text-[#1F1F1C] font-semibold">
                              <JUTHORI_SERVICE_ICONS.tree className="w-3.5 h-3.5 text-[#D97757]" />
                              مربوط: {member.linkedTreePersonName}
                            </span>
                          ) : (
                            <span>
                              أُضيف{' '}
                              {new Date(member.addedAt).toLocaleDateString(
                                'ar-SA'
                              )}
                            </span>
                          )}
                        </span>

                        <a
                          href={memberWhatsappHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#FAF6EE] hover:bg-[#D97757] border border-[#D97757]/45 hover:border-[#D97757] text-[#D97757] hover:text-[#F5F1E8] text-[11px] font-display font-bold transition-all whitespace-nowrap"
                        >
                          <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>إرسال تذكير عبر واتساب</span>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Section 3: Authorized Family Portals Gallery */}
          {authorizedPortals.length === 0 ? (
            /* Single Compact Sleek Horizon Banner (Zero Double Boxes) */
            <div className="rounded-2xl bg-gradient-to-l from-[#FAF6EE] via-[#FDFBF7] to-[#F5EFE4] border border-[#D8C7B2]/80 px-6 py-4 relative overflow-hidden shadow-[0_2px_12px_rgba(31,31,28,0.02)]">
              {/* Faint heritage arch watermark */}
              <svg
                aria-hidden="true"
                viewBox="0 0 180 100"
                fill="none"
                className="pointer-events-none absolute -bottom-2 right-6 w-40 h-22 text-[#1F1F1C] opacity-[0.045]"
              >
                <path
                  d="M20 100 V46 C20 22, 52 8, 90 8 C128 8, 160 22, 160 46 V100"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M42 100 V52 C42 34, 63 22, 90 22 C117 22, 138 34, 138 52 V100"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
              </svg>

              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-[#E8DED2] border-2 border-white ring-1 ring-[#D8C7B2] text-[#D97757] flex items-center justify-center shrink-0">
                    <Globe className="w-4.5 h-4.5" />
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <h3 className="text-sm font-display font-bold text-[#1F1F1C]">
                      البوابات العائلية المصرح لي بدخولها
                    </h3>
                    <p className="text-[11px] text-[#1F1F1C]/65 leading-relaxed">
                      عندما يضيفك أحد أقاربك إلى دائرته العائلية، ستظهر بوابة عائلته هنا للدخول المباشر بنقرة واحدة.
                    </p>
                  </div>
                </div>

                <span className="inline-flex items-center self-start sm:self-center px-3 py-1.5 rounded-full bg-[#E8DED2]/75 border border-[#D8C7B2]/80 text-[11px] font-display font-semibold text-[#1F1F1C]/65 whitespace-nowrap shrink-0">
                  لا توجد دعوات خارجية حالياً
                </span>
              </div>
            </div>
          ) : (
            <section className="space-y-3.5">
              {/* Editorial Header */}
              <div className="flex items-center gap-3 pt-1">
                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <div className="w-8 h-8 rounded-full bg-[#E8DED2] border border-[#D8C7B2] text-[#D97757] flex items-center justify-center shrink-0">
                    <Globe className="w-4 h-4" />
                  </div>
                  <h3 className="text-[15px] font-display font-bold text-[#1F1F1C]">
                    البوابات العائلية المصرح لي بدخولها
                  </h3>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#E8DED2]/85 border border-[#D8C7B2] text-[11px] font-display font-bold text-[#1F1F1C]/80 tabular-nums">
                    {authorizedPortals.length === 1
                      ? 'بوابة واحدة'
                      : authorizedPortals.length === 2
                      ? 'بوابتان'
                      : `${authorizedPortals.length} بوابات`}
                  </span>
                </div>
                <div className="hidden sm:block flex-1 h-px bg-gradient-to-l from-[#D8C7B2] via-[#D8C7B2]/45 to-transparent" />
              </div>

              {/* Arch-Accented Family Portal Passes */}
              <div
                className={`grid grid-cols-1 gap-4 ${
                  authorizedPortals.length >= 2 ? 'md:grid-cols-2' : ''
                }`}
              >
                {authorizedPortals.map((portal) => {
                  const hasTree =
                    (portal.siteData.publishedTreeMembers || []).length > 0;
                  return (
                    <div
                      key={portal.siteSlug}
                      className="rounded-2xl bg-gradient-to-l from-[#FDFBF7] via-[#FAF6EE] to-[#F5EFE4] border border-[#D8C7B2]/90 hover:border-[#D97757]/60 p-5 relative overflow-hidden shadow-[0_2px_14px_rgba(31,31,28,0.03)] flex flex-col justify-between gap-4 transition-all"
                    >
                      {/* Heritage arch corner filigree */}
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 120 90"
                        fill="none"
                        className="pointer-events-none absolute -bottom-2 -left-2 w-28 h-20 text-[#D97757] opacity-[0.07]"
                      >
                        <path
                          d="M15 90 V42 C15 20, 35 8, 60 8 C85 8, 105 20, 105 42 V90"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                        <path
                          d="M32 90 V48 C32 32, 45 22, 60 22 C75 22, 88 32, 88 48 V90"
                          stroke="currentColor"
                          strokeWidth="1.4"
                        />
                      </svg>

                      <div className="relative z-10 flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3.5 min-w-0">
                          {/* Host Family Seal / Monogram */}
                          <div className="w-12 h-12 rounded-full bg-[#E8DED2] border-2 border-white ring-1 ring-[#D8C7B2] text-[#D97757] font-display font-extrabold text-base flex items-center justify-center shrink-0 shadow-xs">
                            {getArabicInitials(portal.familyName)}
                          </div>

                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-[15px] font-display font-extrabold text-[#1F1F1C] truncate">
                                ديوان عائلة {portal.familyName}
                              </h4>
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#E8DED2]/90 border border-[#D8C7B2] text-[10px] font-display font-bold text-[#D97757]">
                                {portal.viewerRoleLabelAr}
                                {portal.kinshipRelation
                                  ? ` · ${portal.kinshipRelation}`
                                  : ''}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-[#1F1F1C]/65">
                              <span>بإشراف: {portal.ownerDisplayName}</span>
                              <span
                                aria-hidden="true"
                                className="text-[#D8C7B2]"
                              >
                                •
                              </span>
                              <span
                                dir="ltr"
                                className="font-mono text-[#D97757] truncate"
                              >
                                {ACTIVE_PUBLIC_SITE_DISPLAY_HOST}/
                                {portal.siteSlug}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="relative z-10 flex flex-wrap items-center gap-2.5 pt-1">
                        <button
                          type="button"
                          disabled={!hasTree}
                          onClick={() => setActiveSharedTreePortal(portal)}
                          className="flex-1 min-w-[155px] h-9.5 px-4 rounded-xl bg-[#D97757] hover:bg-[#C46546] disabled:opacity-45 text-[#F5F1E8] text-xs font-display font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-[0_2px_8px_rgba(217,119,87,0.18)]"
                        >
                          <span>🌳 فتح دوحة العائلة</span>
                        </button>

                        <a
                          href={`/${portal.siteSlug}`}
                          className="flex-1 min-w-[155px] h-9.5 px-4 rounded-xl bg-[#FAF6EE] hover:bg-[#E8DED2] border border-[#D8C7B2] text-[#1F1F1C] text-xs font-display font-bold inline-flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <span>🏛️ دخول موقع الديوان</span>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {/* =====================================================================
          3. PILLAR 2: مركز الإثراء وحملات الذاكرة
      ====================================================================== */}
      {!isLoading && activeTab === 'enrichment' && (
        <div className="space-y-6">
          {/* Family Memory & Photo Quests Studio */}
          <div className="rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] overflow-hidden">
            <div className="px-6 py-4 bg-[#FAF7F2] border-b border-[#D8C7B2] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#E8DED2] border border-[#D8C7B2] text-[#D97757] flex items-center justify-center shrink-0">
                  <Megaphone className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-display font-bold text-[#1F1F1C]">
                    حملات استكتاب العائلة وجمع الذاكرة
                  </h3>
                  <p className="text-[11px] text-[#1F1F1C]/65">
                    أطلق نداءً حقيقياً للعائلة لجمع الصور والمواليد وذكريات الأجداد، وشاركه في مجموعة واتساب العائلة
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!questComposerOpen && !isOwnRegistrarWorkspace) {
                    requireCommunityPremiumAction('community_quest', () =>
                      setQuestComposerOpen(true)
                    );
                    return;
                  }
                  setQuestComposerOpen((v) => !v);
                }}
                className="px-4 py-2 rounded-xl bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-[#F5F1E8]" />
                <span>
                  {questComposerOpen ? 'إغلاق المحرر' : 'إطلاق حملة ذاكرة مخصصة'}
                </span>
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Ready Starter Templates to Launch Real Campaigns */}
              <div className="space-y-2.5">
                <div className="text-xs font-display font-bold text-[#1F1F1C]/80 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#D97757]" />
                  <span>قوالب حملات جاهزة للإطلاق الفوري بنقرة واحدة:</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {MEMORY_QUEST_TEMPLATES.map((tpl) => (
                    <div
                      key={tpl.category}
                      className="rounded-xl bg-[#FAF7F2] border border-[#D8C7B2] p-4 flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-1.5">
                        <span className="inline-block text-[10px] font-bold text-[#D97757]">
                          {tpl.badgeAr}
                        </span>
                        <h4 className="text-xs font-display font-bold text-[#1F1F1C] leading-snug">
                          {tpl.title}
                        </h4>
                        <p className="text-[11px] text-[#1F1F1C]/70 leading-relaxed line-clamp-3">
                          {tpl.promptText}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={savingQuest}
                        onClick={() =>
                          handleLaunchMemoryQuest({
                            title: tpl.title,
                            promptText: tpl.promptText,
                            category: tpl.category,
                          })
                        }
                        className="w-full py-2 rounded-lg bg-[#E8DED2] hover:bg-[#D97757] hover:text-[#F5F1E8] border border-[#D8C7B2] text-xs font-display font-bold text-[#1F1F1C] transition-colors cursor-pointer disabled:opacity-50"
                      >
                        إطلاق هذه الحملة للعائلة
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom Quest Composer */}
              {questComposerOpen && (
                <div className="rounded-2xl bg-[#F5F1E8] border border-[#D97757]/40 p-5 space-y-3">
                  <div className="text-xs font-display font-bold text-[#1F1F1C]">
                    صياغة نداء توثيق خاص بعائلة {result.familyName}
                  </div>
                  <input
                    type="text"
                    value={questTitle}
                    onChange={(e) => setQuestTitle(e.target.value)}
                    placeholder="عنوان الحملة (مثال: توثيق صور رحلة المصيف العائلي عام 1415هـ)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F1E8] border border-[#D97757]/40 text-xs text-[#1F1F1C] focus:outline-none focus:border-[#D97757]"
                  />
                  <textarea
                    rows={3}
                    value={questPrompt}
                    onChange={(e) => setQuestPrompt(e.target.value)}
                    placeholder="اكتب السؤال أو النداء الذي سيصل إلى أقاربك لتحفيزهم على رفع الصور أو القصص..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F1E8] border border-[#D97757]/40 text-xs text-[#1F1F1C] focus:outline-none focus:border-[#D97757]"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setQuestComposerOpen(false)}
                      className="px-4 py-2 rounded-xl bg-[#F5F1E8] border border-[#D97757]/35 text-xs font-semibold text-[#1F1F1C] cursor-pointer"
                    >
                      إلغاء
                    </button>
                    <button
                      type="button"
                      disabled={savingQuest}
                      onClick={() =>
                        handleLaunchMemoryQuest({
                          title: questTitle,
                          promptText: questPrompt,
                          category: questCategory,
                        })
                      }
                      className="px-5 py-2 rounded-xl bg-[#D97757] hover:bg-[#D97757]/90 disabled:opacity-50 text-[#F5F1E8] text-xs font-display font-bold cursor-pointer transition-colors"
                    >
                      {savingQuest ? 'جارٍ الإطلاق...' : 'حفظ وإطلاق الحملة ✓'}
                    </button>
                  </div>
                </div>
              )}

              {/* Active & Saved Real Memory Quests List */}
              {memoryQuests.length > 0 ? (
                <div className="space-y-3 pt-2 border-t border-[#D97757]/20">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-display font-bold text-[#1F1F1C]">
                      حملات الذاكرة المحفوظة لعائلة {result.familyName}
                    </span>
                    <span className="text-[#1F1F1C]/60 tabular-nums">
                      {activeMemoryQuests.length} نشطة ·{' '}
                      {memoryQuests.length - activeMemoryQuests.length} مؤرشفة
                    </span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                    {memoryQuests.map((quest) => {
                      const isQuestActive = quest.status === 'ACTIVE';
                      const whatsappQuestText = `✦ نداء توثيق خاص بعائلة ${result.familyName} ✦\n«${quest.title}»\n\n${quest.promptText}\n\nلإرسال مشاركتك (صورة، مولود جديد، أو قصة) مباشرة عبر بوابة عائلتنا:\n${cleanPortalDisplayUrl}`;
                      return (
                        <div
                          key={quest.id}
                          className={`rounded-2xl border p-4.5 flex flex-col justify-between gap-3.5 ${
                            isQuestActive
                              ? 'bg-[#F5F1E8] border-[#D97757]/40 shadow-xs'
                              : 'bg-[#F5F1E8]/70 border-[#D97757]/25 opacity-80'
                          }`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="text-sm font-display font-bold text-[#1F1F1C] leading-snug">
                                {quest.title}
                              </h4>
                              <span
                                className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  isQuestActive
                                    ? 'bg-[#1F1F1C]/12 text-[#1F1F1C]'
                                    : 'bg-[#1F1F1C]/10 text-[#1F1F1C]/60'
                                }`}
                              >
                                {isQuestActive ? 'حملة نشطة' : 'مؤرشفة'}
                              </span>
                            </div>
                            <p className="text-xs text-[#1F1F1C]/70 leading-relaxed">
                              {quest.promptText}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#D97757]/20">
                            <div className="flex flex-wrap items-center gap-2">
                              <a
                                href={`https://wa.me/?text=${encodeURIComponent(
                                  whatsappQuestText
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 rounded-lg bg-[#D97757] hover:bg-[#D97757]/90 text-[#F5F1E8] text-[11px] font-display font-bold inline-flex items-center gap-1.5 transition-colors"
                              >
                                <Share2 className="w-3 h-3" />
                                <span>مشاركة عبر واتساب العائلة</span>
                              </a>
                              <button
                                type="button"
                                onClick={() => handleCopyQuestCallout(quest)}
                                className="px-2.5 py-1.5 rounded-lg bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D97757]/35 text-[11px] font-semibold text-[#1F1F1C] inline-flex items-center gap-1 cursor-pointer"
                              >
                                {copiedQuestId === quest.id ? (
                                  <>
                                    <Check className="w-3 h-3 text-[#D97757]" />
                                    <span>نُسخ</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>نسخ النص</span>
                                  </>
                                )}
                              </button>
                            </div>

                            {isRegistrar && (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleQuestStatusAction(
                                      quest,
                                      isQuestActive ? 'ARCHIVED' : 'ACTIVE'
                                    )
                                  }
                                  className="px-2 py-1 rounded-md text-[11px] text-[#1F1F1C]/65 hover:text-[#1F1F1C] hover:bg-[#1F1F1C]/5 inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Archive className="w-3 h-3" />
                                  <span>{isQuestActive ? 'أرشفة' : 'تفعيل'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleQuestStatusAction(quest, 'DELETE')
                                  }
                                  title="حذف الحملة"
                                  className="p-1.5 rounded-md text-[#1F1F1C]/45 hover:text-[#D97757] hover:bg-[#1F1F1C]/5 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-[#F5F1E8]/80 border border-dashed border-[#D97757]/40 px-5 py-4 text-xs text-[#1F1F1C]/65 text-center">
                  لم تُطلق حملات جمع ذاكرة بعد. اختر أحد القوالب أعلاه أو صُغ سؤالك الخاص لتحفيز أفراد عائلتك على مشاركة صورهم وذكرياتهم.
                </div>
              )}
            </div>
          </div>

          {/* Categorized Family Enrichment Moderation Studio */}
          <div className="rounded-2xl bg-[#F5F1E8] border border-[#D97757]/35 overflow-hidden">
            <div className="px-6 py-4 border-b border-[#D97757]/25 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Inbox className="w-4.5 h-4.5 text-[#D97757]" />
                <div>
                  <h3 className="text-sm font-display font-bold text-[#1F1F1C]">
                    صندوق مراجعة واعتماد إثراءات العائلة
                  </h3>
                  <p className="text-[11px] text-[#1F1F1C]/60">
                    لا يُدمج أي مقترح في «شجرتي» أو «خزانتي» إلا بموافقتك الصريحة كأمين سجل
                  </p>
                </div>
              </div>

              {reviewedEnrichments.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowReviewedHistory((v) => !v)}
                  className="text-xs font-display font-bold text-[#D97757] hover:underline cursor-pointer"
                >
                  {showReviewedHistory
                    ? 'إخفاء الأرشيف المراجع'
                    : `سجل المراجعات السابقة (${reviewedEnrichments.length})`}
                </button>
              )}
            </div>

            {/* Category Filter Strip */}
            <div className="px-6 py-3 bg-[#F5F1E8] border-b border-[#D97757]/20 flex flex-wrap items-center gap-2">
              {(
                [
                  {
                    id: 'ALL' as EnrichmentFilterId,
                    label: 'الكل',
                    count: totalIncomingEnrichmentCount,
                  },
                  {
                    id: 'ADD_TREE_MEMBER' as EnrichmentFilterId,
                    label: 'أفراد ومواليد للشجرة',
                    count: pendingEnrichments.filter(
                      (e) => e.requestType === 'ADD_TREE_MEMBER'
                    ).length,
                  },
                  {
                    id: 'VAULT_MEDIA' as EnrichmentFilterId,
                    label: 'صور ووثائق للخزانة',
                    count: pendingEnrichments.filter(
                      (e) => e.requestType === 'VAULT_MEDIA'
                    ).length,
                  },
                  {
                    id: 'FACE_ID' as EnrichmentFilterId,
                    label: 'التعرف على وجوه الصور',
                    count: realFaceIdEntries.length,
                  },
                  {
                    id: 'CORRECTION_NOTE' as EnrichmentFilterId,
                    label: 'قصص ومشاركات',
                    count: pendingEnrichments.filter(
                      (e) => e.requestType === 'CORRECTION_NOTE'
                    ).length,
                  },
                ]
              ).map((flt) => {
                const active = enrichmentFilter === flt.id;
                return (
                  <button
                    key={flt.id}
                    type="button"
                    onClick={() => setEnrichmentFilter(flt.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-display font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#D97757] text-[#F5F1E8]'
                        : 'bg-[#F5F1E8] border border-[#D8C7B2] text-[#1F1F1C]/80 hover:border-[#D97757]/60'
                    }`}
                  >
                    <span>{flt.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded tabular-nums ${
                        active
                          ? 'bg-[#F5F1E8]/20 text-[#F5F1E8]'
                          : 'bg-[#E8DED2] text-[#D97757]'
                      }`}
                    >
                      {flt.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Queue Items */}
            <div className="p-6 space-y-4">
              {filteredPendingEnrichments.length === 0 &&
              (!showFaceIdInQueue || realFaceIdEntries.length === 0) ? (
                <div className="rounded-2xl bg-[#F5F1E8] border border-dashed border-[#D97757]/45 p-8 text-center space-y-2.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#F5F1E8] border border-[#D97757]/30 mx-auto flex items-center justify-center text-[#D97757]">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-display font-bold text-[#1F1F1C]">
                    صندوق الإثراءات المعلّقة نظيف تماماً
                  </h4>
                  <p className="text-xs text-[#1F1F1C]/65 max-w-md mx-auto leading-relaxed">
                    عندما يقترح أحد أقاربك إضافة مولود جديد أو رفع صورة تاريخية أو التعرف على شخص في صورة عبر «موقعي»، ستصل مساهمته هنا للمراجعة والدمج بضغطة واحدة.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Pending Tree / Vault / Story Enrichment Cards */}
                  {filteredPendingEnrichments.map((req) => {
                    const isTreeProposal =
                      req.requestType === 'ADD_TREE_MEMBER';
                    const proposedNodesList = Array.isArray(req.proposedNodes)
                      ? req.proposedNodes
                      : [];
                    const proposedCount =
                      proposedNodesList.length > 0
                        ? proposedNodesList.length
                        : req.proposedFirstName
                        ? 1
                        : 0;
                    const proposedNamesPreview =
                      proposedNodesList.length > 0
                        ? proposedNodesList
                            .map((n) => n.firstName)
                            .filter(Boolean)
                        : req.proposedFirstName
                        ? [req.proposedFirstName]
                        : [];

                    const typeBadge = isTreeProposal
                      ? {
                          label:
                            proposedCount > 1
                              ? `اقتراح إضافة (${proposedCount}) أفراد للشجرة`
                              : 'اقتراح إضافة فرع أو قريب للشجرة',
                          icon: JUTHORI_SERVICE_ICONS.tree,
                          color: 'bg-[#1F1F1C]/10 text-[#1F1F1C]',
                        }
                      : req.requestType === 'VAULT_MEDIA'
                      ? {
                          label: 'إهداء صورة / وثيقة للخزانة',
                          icon: JUTHORI_SERVICE_ICONS.vault,
                          color: 'bg-[#D97757]/15 text-[#D97757]',
                        }
                      : {
                          label: 'قصة / تصحيح سيرة',
                          icon: MessageSquareHeart,
                          color: 'bg-[#1F1F1C]/10 text-[#D97757]',
                        };
                    const TypeIcon = typeBadge.icon;

                    return (
                      <div
                        key={req.id}
                        data-testid={`enrichment-review-card-${req.id}`}
                        className="rounded-2xl bg-[#F5F1E8] border border-[#D97757]/40 p-5 space-y-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2 text-[11px]">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-display font-bold ${typeBadge.color}`}
                              >
                                <TypeIcon className="w-3.5 h-3.5" />
                                {typeBadge.label}
                              </span>
                              <span className="text-[#D97757] font-bold">
                                {req.requesterRoleLabel || 'قريب مساهم'}
                              </span>
                              <span aria-hidden="true" className="text-[#1F1F1C]/30">
                                ·
                              </span>
                              <span className="text-[#1F1F1C]/60 inline-flex items-center gap-1 tabular-nums">
                                <Clock className="w-3 h-3" />
                                {new Date(req.createdAt).toLocaleDateString(
                                  'ar-SA',
                                  {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                  }
                                )}
                              </span>
                            </div>

                            <div className="text-sm font-display font-bold text-[#1F1F1C] pt-1">
                              مقدّم من: {req.requesterName}
                              {req.kinshipRelation && (
                                <span className="text-xs font-semibold text-[#D97757] mr-2">
                                  ({req.kinshipRelation})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Proposal Details + Optional Media Preview */}
                        <div className="rounded-xl bg-[#F5F1E8] border border-[#D97757]/25 p-4 flex flex-col sm:flex-row gap-4">
                          {req.mediaDataOrUrl && (
                            <div className="w-full sm:w-32 h-32 rounded-xl overflow-hidden bg-[#F5F1E8] border border-[#D97757]/30 shrink-0">
                              <img
                                src={req.mediaDataOrUrl}
                                alt={req.mediaTitle || 'مرفق إثراء عائلي'}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <div className="space-y-2 text-xs text-[#1F1F1C]/85 flex-1 min-w-0">
                            {isTreeProposal && proposedNamesPreview.length > 0 && (
                              <div className="space-y-1">
                                <div className="text-[#1F1F1C]/65 font-semibold">
                                  الإضافات المقترحة ({proposedCount}{' '}
                                  {proposedCount === 1
                                    ? 'فرد جديد'
                                    : 'أفراد جدد'}
                                  ):
                                </div>
                                <div className="font-display font-bold text-[#1F1F1C] leading-relaxed">
                                  {proposedNamesPreview.join(' · ')}
                                </div>
                              </div>
                            )}
                            {req.targetPersonName && (
                              <div>
                                <span className="text-[#1F1F1C]/60">
                                  نقطة الارتباط في الشجرة:{' '}
                                </span>
                                <strong className="font-display text-[#D97757]">
                                  {req.targetPersonName}
                                </strong>
                              </div>
                            )}
                            {req.mediaTitle && (
                              <div>
                                <span className="text-[#1F1F1C]/60">
                                  عنوان الوثيقة / الصورة:{' '}
                                </span>
                                <strong className="font-display text-[#1F1F1C]">
                                  {req.mediaTitle}
                                </strong>
                                {req.mediaDateOrOccasion && (
                                  <span className="text-[#1F1F1C]/60 mr-2">
                                    · {req.mediaDateOrOccasion}
                                  </span>
                                )}
                              </div>
                            )}
                            {req.proposedNotes && (
                              <p className="text-xs text-[#1F1F1C]/75 leading-relaxed pt-1">
                                {req.proposedNotes}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Decisive Registrar Moderation Actions */}
                        {isRegistrar && (
                          <div className="flex flex-wrap items-center justify-between gap-2.5">
                            <div>
                              {isTreeProposal && proposedCount > 0 && (
                                <button
                                  type="button"
                                  data-testid="open-visual-diff-review-btn"
                                  onClick={() =>
                                    setVisualDiffReviewRequest(req)
                                  }
                                  className="px-4 py-2 rounded-xl bg-[#E8DED2] hover:bg-[#D8C7B2] text-[#1F1F1C] border border-[#D8C7B2] text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                                >
                                  <Eye className="w-3.5 h-3.5 text-[#D97757]" />
                                  <span>معاينة الإضافات على الشجرة</span>
                                </button>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                disabled={reviewingId === req.id}
                                onClick={() =>
                                  handleReviewEnrichment(req, false)
                                }
                                className="px-4 py-2 rounded-xl bg-[#FAF7F2] hover:bg-[#E8DED2] border border-[#D8C7B2] text-xs font-semibold text-[#1F1F1C] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                              >
                                <XCircle className="w-3.5 h-3.5 text-[#D97757]" />
                                <span>
                                  {isTreeProposal
                                    ? '✕ رفض المقترح'
                                    : 'أرشفة / اعتذار'}
                                </span>
                              </button>
                              <button
                                type="button"
                                disabled={reviewingId === req.id}
                                onClick={() =>
                                  handleReviewEnrichment(req, true)
                                }
                                className="px-5 py-2 rounded-xl bg-[#D97757] hover:bg-[#C46546] disabled:opacity-50 text-[#F5F1E8] text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                <span>
                                  {reviewingId === req.id
                                    ? 'جارٍ الاعتماد والدمج...'
                                    : isTreeProposal
                                    ? '✓ اعتماد ودمج الإضافات في شجرتي'
                                    : 'اعتماد ودمج فوري في سجلاتي ✓'}
                                </span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Real Face Identification Notes from «موقعي» Vault Photos */}
                  {showFaceIdInQueue &&
                    realFaceIdEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] p-5 flex flex-col sm:flex-row items-start gap-4"
                      >
                        {entry.previewUrl ? (
                          <img
                            src={entry.previewUrl}
                            alt={entry.photoTitle}
                            className="w-24 h-24 rounded-xl object-cover border border-[#D8C7B2] shrink-0"
                          />
                        ) : (
                          <div className="w-24 h-24 rounded-xl bg-[#FAF7F2] border border-[#D8C7B2] flex items-center justify-center text-[#D97757] shrink-0">
                            <Camera className="w-6 h-6" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[#E8DED2] border border-[#D8C7B2] text-[#D97757] text-[10px] font-bold">
                              <ScanFace className="w-3 h-3" />
                              التعرف على وجوه الصور
                            </span>
                            <span className="text-[11px] text-[#1F1F1C]/55">
                              {new Date(entry.createdAt).toLocaleDateString(
                                'ar-SA'
                              )}
                            </span>
                          </div>
                          <div className="text-xs font-display font-bold text-[#1F1F1C]">
                            أفاد «{entry.senderName}» حول صورة: {entry.photoTitle}
                          </div>
                          <p className="text-xs text-[#1F1F1C]/80 bg-[#F5F1E8] rounded-xl px-3.5 py-2.5 border border-[#D97757]/25">
                            “{entry.note}”
                          </p>
                          {onNavigateTab && (
                            <div className="pt-1">
                              <button
                                type="button"
                                onClick={() => onNavigateTab(DashboardTab.MyVault)}
                                className="text-xs font-display font-bold text-[#D97757] hover:underline inline-flex items-center gap-1 cursor-pointer"
                              >
                                <span>توثيق الاسم وربط الصورة في «خزانتي»</span>
                                <ArrowUpLeft className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* Collapsible Reviewed History */}
              {showReviewedHistory && reviewedEnrichments.length > 0 && (
                <div className="pt-4 border-t border-[#D97757]/25 space-y-2.5">
                  <div className="text-xs font-display font-bold text-[#1F1F1C]/75">
                    الأرشيف السابق للإثراءات المراجعة
                  </div>
                  <div className="space-y-2">
                    {reviewedEnrichments.slice(0, 12).map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl bg-[#F5F1E8]/70 border border-[#D97757]/25 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <strong className="font-display text-[#1F1F1C]">
                            {item.requesterName}
                          </strong>
                          <span className="text-[#1F1F1C]/60 mr-2">
                            —{' '}
                            {item.proposedFirstName ||
                              item.mediaTitle ||
                              item.proposedNotes?.slice(0, 50) ||
                              'مشاركة عائلية'}
                          </span>
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                            item.status === 'APPROVED_AND_MERGED'
                              ? 'bg-[#1F1F1C]/12 text-[#1F1F1C]'
                              : 'bg-[#1F1F1C]/10 text-[#1F1F1C]/60'
                          }`}
                        >
                          {item.status === 'APPROVED_AND_MERGED'
                            ? 'معتمد ومدمج ✓'
                            : 'مؤرشف'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          4. PILLAR 3: صلة الرحم والمناسبات (RSVP) & نبض الشجرة
      ====================================================================== */}
      {!isLoading && activeTab === 'events' && (
        <CommunityKinshipEventsView
          familyName={result.familyName}
          activeSiteSlug={activeSiteSlug || undefined}
          ownerMicrosite={ownerMicrosite}
          circle={circle}
          rawTreeMembers={rawTreeMembers}
          isAuthorizedOwner={isOwnRegistrarWorkspace}
          onRequirePremiumAction={onRequirePremiumAction}
          onNavigateTab={onNavigateTab}
        />
      )}

      {/* =====================================================================
          5. PILLAR 4: سفير جذوري ومكافآت ($10) — BLACK & GOLD VIP PASS
      ====================================================================== */}
      {!isLoading && activeTab === 'ambassador' && (
        <CommunityAmbassadorPass
          familyName={result.familyName}
          referralStats={referralStats}
          onLogActivity={onLogActivity}
        />
      )}

      {/* Royal Family Invitation QR Modal */}
      <RoyalQrInvitationModal
        isOpen={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        familyName={result.familyName}
        siteSlug={activeSiteSlug || 'family'}
        registrarName={ownerDisplayName}
        referralCode={referralStats.referralCode}
      />

      {/* Fullscreen Visual Diff Tree Review Modal (معاينة الفروقات البصرية قبل الدمج) */}
      {visualDiffReviewRequest &&
        visualDiffPreviewData &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            dir="rtl"
            role="dialog"
            aria-modal="true"
            data-testid="visual-diff-tree-review-modal"
            aria-label="معاينة الإضافات المقترحة على شجرة العائلة"
            className="fixed inset-0 z-[80] flex flex-col bg-[#E8DED2] text-[#1F1F1C]"
          >
            {/* Visual Diff Top Bar (Warm Ivory Brand Palette) */}
            <header className="shrink-0 bg-[#FAF7F2] text-[#1F1F1C] border-b border-[#D8C7B2] px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#E8DED2] border border-[#D8C7B2] text-[#D97757] flex items-center justify-center shrink-0">
                  <GitBranch className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-[#D97757] tracking-wide">
                    معاينة الفروقات البصرية قبل الاعتماد والدمج
                  </div>
                  <h2 className="text-sm sm:text-base font-display font-bold truncate text-[#1F1F1C]">
                    مقترح من {visualDiffReviewRequest.requesterName} (
                    {visualDiffReviewRequest.requesterRoleLabel || 'قريب مساهم'}
                    ) · {visualDiffPreviewData.highlightedNewIds.length}{' '}
                    {visualDiffPreviewData.highlightedNewIds.length === 1
                      ? 'فرد جديد'
                      : 'أفراد جدد'}
                  </h2>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={reviewingId === visualDiffReviewRequest.id}
                  onClick={() =>
                    handleReviewEnrichment(visualDiffReviewRequest, false)
                  }
                  className="h-9 px-3.5 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] text-[#1F1F1C] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  <XCircle className="w-3.5 h-3.5 text-[#D97757]" />
                  <span>✕ رفض المقترح</span>
                </button>
                <button
                  type="button"
                  disabled={reviewingId === visualDiffReviewRequest.id}
                  data-testid="approve-and-merge-from-diff-modal-btn"
                  onClick={() =>
                    handleReviewEnrichment(visualDiffReviewRequest, true)
                  }
                  className="h-9 px-4 rounded-xl bg-[#D97757] hover:bg-[#C46546] disabled:opacity-50 text-[#F5F1E8] text-xs font-display font-extrabold inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {reviewingId === visualDiffReviewRequest.id
                      ? 'جارٍ الاعتماد والدمج...'
                      : '✓ اعتماد ودمج الإضافات في شجرتي'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setVisualDiffReviewRequest(null)}
                  className="h-9 px-3.5 rounded-xl bg-[#E8DED2] hover:bg-[#D8C7B2] border border-[#D8C7B2] text-[#1F1F1C] text-xs font-display font-extrabold inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                >
                  <span>إغلاق</span>
                  <X className="w-4 h-4" />
                </button>
              </div>
            </header>

            {/* Visual Diff Legend Strip */}
            <div className="shrink-0 bg-[#E8DED2] text-[#1F1F1C] border-b border-[#D8C7B2] px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-semibold text-[#1F1F1C]/80">
                  البطاقات الباهتة: شجرتك الحالية المعتمدة
                </span>
                <span aria-hidden="true" className="opacity-40">
                  ·
                </span>
                <span className="font-bold text-[#D97757]">
                  البطاقات المضيئة (جديد): الإضافات المقترحة التي ستُدمج عند الاعتماد
                </span>
              </div>
              {visualDiffPreviewData.proposedNames.length > 0 && (
                <div className="text-[11px] font-bold text-[#D97757] truncate max-w-md">
                  الجديد: {visualDiffPreviewData.proposedNames.join(' · ')}
                </div>
              )}
            </div>

            {/* Live Visual Diff Tree Canvas */}
            <div className="flex-1 min-h-0 flex flex-col p-2.5 sm:p-4 overflow-hidden">
              <InteractiveFamilyTreeBuilder
                result={diffPreviewLineageResult}
                accountType={AccountLegalType.RecordKeeper}
                caps={DIFF_PREVIEW_CAPS}
                onUpgradeAnnualVip={DIFF_NOOP_VOID}
                onSignCharterAndEnableTree={DIFF_NOOP_VOID}
                onLogActivity={DIFF_NOOP_LOG}
                publicMirrorMode={{
                  members: visualDiffPreviewData.mergedMembers,
                  displaySettings: normalizeTreeDisplaySettings(
                    ownerMicrosite?.treeDisplaySettings
                  ),
                  compactPreview: false,
                  theaterMode: true,
                  visualDiff: {
                    active: true,
                    highlightedNewIds: visualDiffPreviewData.highlightedNewIds,
                    focusOnMount: true,
                  },
                }}
              />
            </div>
          </div>,
          document.body
        )}

      {activeSharedTreePortal && (
        <PublicVisualTreeMirror
          members={activeSharedTreePortal.siteData.publishedTreeMembers || []}
          familyName={activeSharedTreePortal.familyName}
          generationsCount={activeSharedTreePortal.generationsCount}
          treeDisplaySettings={
            activeSharedTreePortal.siteData.treeDisplaySettings
          }
          isAuthorizedFamilyViewer
          canProposeEnrichment={activeSharedTreePortal.canProposeEnrichment}
          siteSlug={activeSharedTreePortal.siteSlug}
          ownerId={activeSharedTreePortal.ownerId}
          viewerDefaultName={ownerDisplayName}
          viewerDefaultEmail={effectiveEmail}
          viewerDefaultKinship={activeSharedTreePortal.kinshipRelation || ''}
          viewerRoleLabel={activeSharedTreePortal.viewerRoleLabelAr}
          externalTheaterOpen={Boolean(activeSharedTreePortal)}
          onExternalTheaterClose={() => setActiveSharedTreePortal(null)}
          hideInlinePreview
        />
      )}
    </div>
  );
};
