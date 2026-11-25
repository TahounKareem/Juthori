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
  Clock,
  Copy,
  Eye,
  FileImage,
  GitBranch,
  Globe,
  Inbox,
  Link2,
  Lock,
  Mail,
  Megaphone,
  MessageSquareHeart,
  Plus,
  QrCode,
  RotateCcw,
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
  WORKSPACE_PRIMARY_BTN_CLASS,
  WORKSPACE_SECONDARY_BTN_CLASS,
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
  rotateKinshipMajlisInviteToken,
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
  const [rotatingMajlisLink, setRotatingMajlisLink] = useState(false);
  const [copiedMajlisUrl, setCopiedMajlisUrl] = useState(false);

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

  const handleRotateMajlisLink = async () => {
    if (!isOwnRegistrarWorkspace) {
      requireCommunityPremiumAction('community_invite', () => {
        handleRotateMajlisLink().catch(() => {});
      });
      return;
    }
    setRotatingMajlisLink(true);
    try {
      const updated = await rotateKinshipMajlisInviteToken({
        ownerId: effectiveUserId,
        familyName: result.familyName,
        siteSlug: activeSiteSlug || undefined,
      });
      setCircle(updated);
      showToast(
        'success',
        'تم تدوير رمز رابط المجلس العائلي وإلغاء الرابط السابق بنجاح ✓'
      );
      onLogActivity?.(
        'تدوير رابط المجلس العائلي',
        'تم توليد رمز وصول جديد لدائرة العائلة في مجتمعي'
      );
    } catch {
      showToast('error', 'تعذر تدوير رابط المجلس حالياً.');
    } finally {
      setRotatingMajlisLink(false);
    }
  };

  const handleCopyMajlisUrl = async () => {
    try {
      await navigator.clipboard.writeText(cleanMajlisUrl);
      setCopiedMajlisUrl(true);
      setTimeout(() => setCopiedMajlisUrl(false), 2200);
    } catch {
      // Ignore clipboard restriction
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
        metaItems={[
          'مساحة عائلية مغلقة',
          <span key="members" className="tabular-nums">
            <strong className="font-semibold text-[#1F1F1C]">
              {circle.members.length}
            </strong>{' '}
            أعضاء بالدائرة
          </span>,
          <span key="enrichments" className="tabular-nums">
            <strong className="font-semibold text-[#D97757]">
              {totalIncomingEnrichmentCount}
            </strong>{' '}
            طلبات إثراء واردة
          </span>,
          <span key="rewards" className="inline-flex items-center gap-1">
            <span>رصيد المكافآت:</span>
            <strong
              dir="ltr"
              className="font-mono font-semibold text-[#1F1F1C] tabular-nums"
            >
              ${referralStats.totalEarnedUsd.toFixed(2)}
            </strong>
          </span>,
        ]}
        actions={
          <>
            <button
              type="button"
              data-testid="community-qr-card-btn"
              onClick={() =>
                requireCommunityPremiumAction('community_qr', () =>
                  setQrModalOpen(true)
                )
              }
              className={WORKSPACE_SECONDARY_BTN_CLASS}
            >
              <QrCode className="w-4 h-4 shrink-0" />
              <span>بطاقة الدعوة ورمز QR</span>
            </button>

            <button
              type="button"
              data-testid="community-invite-relative-btn"
              onClick={() => handleOpenInviteStudioAction()}
              className={WORKSPACE_PRIMARY_BTN_CLASS}
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>دعوة قريب للدائرة</span>
            </button>
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
            <span className="truncate">1. دائرة عائلتي والصلاحيات</span>
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
          2. PILLAR 1: دائرة عائلتي والصلاحيات
      ====================================================================== */}
      {!isLoading && activeTab === 'circle' && (
        <div className="space-y-6">
          {/* Smart Relative Invitation Studio (Visible to all; execution gated on action) */}
          <div
            ref={inviteStudioRef}
            className="rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] overflow-hidden"
          >
            <div className="px-6 py-4 bg-[#FAF7F2] border-b border-[#D8C7B2] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#E8DED2] border border-[#D8C7B2] text-[#D97757] flex items-center justify-center shrink-0">
                  <UserPlus className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-display font-bold text-[#1F1F1C]">
                    استوديو دعوة قريب للدائرة وتحديد الصلاحيات
                  </h3>
                  <p className="text-[11px] text-[#1F1F1C]/65">
                    اختر مستوى الصلاحية، اربط القريب ببطاقته في «شجرتي» (اختياري)، وأرسل دعوته بالبريد أو واتساب
                  </p>
                </div>
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
                className="px-3.5 py-1.5 rounded-lg bg-[#E8DED2] hover:bg-[#D8C7B2]/60 border border-[#D8C7B2] text-xs font-display font-bold text-[#1F1F1C] cursor-pointer transition-colors"
              >
                {inviteStudioOpen ? 'طي النموذج' : '+ فتح نموذج الدعوة'}
              </button>
            </div>

              {inviteStudioOpen && (
                <form onSubmit={handleAddRelative} className="p-6 space-y-5">
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
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F1E8] border border-[#D97757]/40 text-xs text-[#1F1F1C] focus:outline-none focus:border-[#D97757]"
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
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F1E8] border border-[#D97757]/40 text-xs text-[#1F1F1C] text-left focus:outline-none focus:border-[#D97757]"
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
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F1E8] border border-[#D97757]/40 text-xs text-[#1F1F1C] focus:outline-none focus:border-[#D97757]"
                      />
                      <div className="flex flex-wrap gap-1 pt-1">
                        {KINSHIP_PRESETS.slice(0, 5).map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setRelKinship(preset)}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold cursor-pointer transition-colors ${
                              relKinship === preset
                                ? 'bg-[#D97757] text-[#F5F1E8]'
                                : 'bg-[#F5F1E8] text-[#1F1F1C]/70 hover:bg-[#E8DED2]'
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Role Selector (3 Tiers Persisted in Firestore) */}
                  <div className="space-y-2">
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
                            className={`text-right rounded-xl p-3.5 border transition-all cursor-pointer ${
                              selected
                                ? 'bg-[#F5F1E8] border-[#D97757] ring-1 ring-[#D97757]/40'
                                : 'bg-[#F5F1E8] border-[#D97757]/35 hover:border-[#D97757]/50'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-display font-bold text-[#1F1F1C]">
                                {roleOpt.labelAr}
                              </span>
                              <span
                                className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                                  selected
                                    ? 'bg-[#D97757] border-[#D97757] text-[#F5F1E8]'
                                    : 'border-[#D97757]'
                                }`}
                              >
                                {selected && <Check className="w-2.5 h-2.5" />}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#1F1F1C]/65 mt-1.5 leading-relaxed">
                              {roleOpt.descriptionAr}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Optional Smart Tree Member Binding */}
                  <div className="rounded-xl bg-[#F5F1E8] border border-[#D97757]/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                    <select
                      value={relTreePersonId}
                      onChange={(e) => setRelTreePersonId(e.target.value)}
                      disabled={contemporaryTreeOptions.length === 0}
                      className="sm:w-72 px-3.5 py-2.5 rounded-xl bg-[#F5F1E8] border border-[#D97757]/40 text-xs text-[#1F1F1C] focus:outline-none focus:border-[#D97757] disabled:opacity-50"
                    >
                      <option value="">— بدون ربط مسبق في الشجرة —</option>
                      {contemporaryTreeOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                          {opt.relation ? ` (${opt.relation})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Multi-Channel Submit & WhatsApp Invite Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="text-[11px] text-[#1F1F1C]/60 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-[#D97757] shrink-0" />
                      <span>
                        يصل القريب بريد دعوة رسمي مع خيار إلغاء الارتباط الفوري (Opt-out) احتراماً لخصوصيته.
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <a
                        href={craftedRelativeWhatsappHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2.5 rounded-xl bg-[#D97757] hover:bg-[#D97757]/90 text-[#F5F1E8] text-xs font-display font-bold inline-flex items-center gap-2 transition-colors"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>مشاركة دعوة مجهزة عبر واتساب</span>
                      </a>

                      <button
                        type="submit"
                        disabled={invitingRelative}
                        className="px-5 py-2.5 rounded-xl bg-[#D97757] hover:bg-[#D97757]/90 disabled:opacity-55 text-[#F5F1E8] text-xs font-display font-bold inline-flex items-center gap-2 transition-colors cursor-pointer"
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

          {/* Smart Majlis Link Controls & Token Rotation */}
          {isRegistrar && (
            <div className="rounded-2xl bg-[#F5F1E8] border border-[#D97757]/35 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 text-xs font-display font-bold text-[#1F1F1C]">
                  <Link2 className="w-4 h-4 text-[#D97757]" />
                  <span>رابط المجلس العائلي الذكي والتحكم الأمني</span>
                  {circle.majlisInviteRotatedAt && (
                    <span className="text-[10px] font-normal text-[#1F1F1C]/55">
                      · آخر تدوير:{' '}
                      {new Date(
                        circle.majlisInviteRotatedAt
                      ).toLocaleDateString('ar-SA')}
                    </span>
                  )}
                </div>
                <div
                  dir="ltr"
                  className="text-xs font-mono font-bold text-[#D97757] truncate select-all"
                >
                  {cleanMajlisUrl}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyMajlisUrl}
                  className="px-3.5 py-2 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D97757]/40 text-xs font-display font-bold text-[#1F1F1C] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  {copiedMajlisUrl ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#D97757]" />
                      <span>تم النسخ ✓</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>نسخ الرابط</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    requireCommunityPremiumAction('community_qr', () =>
                      setQrModalOpen(true)
                    )
                  }
                  className="px-3.5 py-2 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] text-xs font-display font-bold text-[#1F1F1C] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <QrCode className="w-3.5 h-3.5 text-[#D97757]" />
                  <span>رمز QR</span>
                </button>

                <button
                  type="button"
                  onClick={handleRotateMajlisLink}
                  disabled={rotatingMajlisLink}
                  className="px-3.5 py-2 rounded-xl bg-[#E8DED2] hover:bg-[#D8C7B2] border border-[#D8C7B2] disabled:opacity-55 text-[#1F1F1C] text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <RotateCcw
                    className={`w-3.5 h-3.5 text-[#D97757] ${
                      rotatingMajlisLink ? 'animate-spin' : ''
                    }`}
                  />
                  <span>تدوير / إلغاء الرابط السابق</span>
                </button>
              </div>
            </div>
          )}

          {/* Pending Private Site Access Requests (Only when real pending requests exist) */}
          {isRegistrar && accessRequests.length > 0 && (
            <div className="rounded-2xl bg-[#F5F1E8] border border-[#D97757]/45 overflow-hidden">
              <div className="px-6 py-3.5 bg-[#D97757]/10 border-b border-[#D97757]/25 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-display font-bold text-[#D97757]">
                  <UserCheck className="w-4 h-4" />
                  <span>طلبات دخول جديدة لبوابة العائلة الخاصة</span>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-[#D97757] text-[#F5F1E8] text-[11px] font-bold tabular-nums">
                  {accessRequests.length}
                </span>
              </div>
              <div className="divide-y divide-[#D97757]/20">
                {accessRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5">
                      <div className="text-xs font-display font-bold text-[#1F1F1C]">
                        {req.visitorName}
                        <span className="font-normal text-[#1F1F1C]/60 mr-2" dir="ltr">
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
                        className="px-3 py-2 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] disabled:opacity-50 text-[#1F1F1C] text-xs font-semibold cursor-pointer transition-colors"
                      >
                        اعتذار
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Approved Relatives Roster — Luxury Membership Cards (Visible to all members) */}
          <div className="rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#D8C7B2] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="w-4.5 h-4.5 text-[#D97757]" />
                <h3 className="text-sm font-display font-bold text-[#1F1F1C]">
                  أفراد دائرة عائلة {result.familyName} المعتمدون
                </h3>
              </div>
              <span className="text-xs text-[#1F1F1C]/60 tabular-nums">
                {circle.members.length} عضو موثق الصلاحية
              </span>
            </div>

            <div className="p-6">
              {circle.members.length === 0 ? (
                <div className="rounded-2xl bg-[#FAF7F2] border border-dashed border-[#D8C7B2] p-8 sm:p-10 text-center space-y-4">
                  {/* Warm Heritage Crest Container */}
                  <div className="w-16 h-16 rounded-2xl bg-[#E8DED2] border border-[#D8C7B2] text-[#D97757] mx-auto flex items-center justify-center shadow-xs">
                    <Users className="w-8 h-8" />
                  </div>
                  <div className="space-y-1.5 max-w-lg mx-auto">
                    <h4 className="text-base font-display font-bold text-[#1F1F1C]">
                      دائرة عائلتك جاهزة لاستقبال أول أفرادها
                    </h4>
                    <p className="text-xs text-[#1F1F1C]/70 leading-relaxed">
                      توثيق تاريخ العائلة أجمل حين يتشارك فيه الأبناء والأعمام. ادعُ الآن أول قريب موثوق بصلاحية «مساعد أمين السجل» أو «راوي ومُساهم في الذاكرة» لبدء إثراء الشجرة والخزانة معاً.
                    </p>
                  </div>
                  {!inviteStudioOpen && (
                    <button
                      type="button"
                      onClick={() => handleOpenInviteStudioAction()}
                      className="px-5 py-2.5 rounded-xl bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] text-xs font-display font-bold inline-flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>دعوة أول قريب الآن</span>
                    </button>
                  )}
                </div>
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
                        className="rounded-2xl bg-[#FAF7F2] border border-[#D8C7B2] p-5 flex flex-col justify-between gap-4 hover:border-[#D97757]/55 transition-colors"
                      >
                        {/* Top Identity Row */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-xl bg-[#E8DED2] border border-[#D8C7B2] text-[#D97757] font-display font-bold text-sm flex items-center justify-center shrink-0">
                              {getArabicInitials(member.name)}
                            </div>
                              <div className="min-w-0 space-y-0.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="text-sm font-display font-bold text-[#1F1F1C] truncate">
                                    {member.name}
                                  </h4>
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                      isActive
                                        ? 'bg-[#1F1F1C]/12 text-[#1F1F1C]'
                                        : 'bg-[#1F1F1C]/10 text-[#D97757]'
                                    }`}
                                  >
                                    {isActive ? 'عضو نشط ✓' : 'تم إرسال الدعوة'}
                                  </span>
                                </div>
                                <div className="text-xs text-[#D97757] font-semibold">
                                  {member.kinshipRelation}
                                  {member.approvedEnrichmentsCount > 0 && (
                                    <span className="text-[#1F1F1C]/55 font-normal mr-2">
                                      · {member.approvedEnrichmentsCount} مساهمة معتمدة
                                    </span>
                                  )}
                                </div>
                                <div
                                  dir="ltr"
                                  className="text-[11px] font-mono text-[#1F1F1C]/60 truncate text-right"
                                >
                                  {member.email}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveRelative(member)}
                              disabled={removingEmail === member.email}
                              title="إلغاء صلاحية القريب"
                              className="p-2 rounded-lg text-[#1F1F1C]/45 hover:text-[#D97757] hover:bg-[#1F1F1C]/5 disabled:opacity-40 cursor-pointer transition-colors shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Inline Editable Role & Tree-Link Controls */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-[#D97757]/20">
                            <div className="space-y-1">
                              <label className="block text-[10px] font-semibold text-[#1F1F1C]/60">
                                مستوى الصلاحية
                              </label>
                              <select
                                value={currentRole}
                                disabled={updatingMemberId === member.id}
                                onChange={(e) =>
                                  handleUpdateMemberRoleOrTree(member, {
                                    role: e.target
                                      .value as KinshipCircleMemberRole,
                                  })
                                }
                                className="w-full px-2.5 py-2 rounded-lg bg-[#F5F1E8] border border-[#D97757]/35 text-[11px] font-semibold text-[#1F1F1C] focus:outline-none focus:border-[#D97757] disabled:opacity-50"
                              >
                                {ROLE_OPTIONS.map((opt) => (
                                  <option key={opt.id} value={opt.id}>
                                    {opt.shortLabelAr}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[10px] font-semibold text-[#1F1F1C]/60">
                                الربط ببطاقة «شجرتي»
                              </label>
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
                                className="w-full px-2.5 py-2 rounded-lg bg-[#F5F1E8] border border-[#D97757]/35 text-[11px] font-semibold text-[#1F1F1C] focus:outline-none focus:border-[#D97757] disabled:opacity-50"
                              >
                                <option value="">غير مربوط بعد</option>
                                {contemporaryTreeOptions.map((opt) => (
                                  <option key={opt.id} value={opt.id}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Footer Quick Link */}
                          <div className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="text-[#1F1F1C]/55">
                              {member.linkedTreePersonName ? (
                                <span className="inline-flex items-center gap-1 text-[#1F1F1C] font-semibold">
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
                              className="inline-flex items-center gap-1 text-[#D97757] hover:underline font-bold"
                            >
                              <Share2 className="w-3 h-3" />
                              <span>تذكير عبر واتساب</span>
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

          {/* Authorized Family Portals (For ALL Users) */}
          <div className="rounded-2xl bg-[#F5F1E8] border border-[#D97757]/35 overflow-hidden">
            <div className="px-6 py-4 border-b border-[#D97757]/25 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Globe className="w-4.5 h-4.5 text-[#D97757]" />
                <h3 className="text-sm font-display font-bold text-[#1F1F1C]">
                  البوابات العائلية المصرح لي بدخولها
                </h3>
              </div>
              <span className="text-xs text-[#1F1F1C]/60 tabular-nums">
                {authorizedPortals.length} بوابة
              </span>
            </div>

            <div className="p-6">
              {authorizedPortals.length === 0 ? (
                <div className="rounded-xl bg-[#F5F1E8] border border-[#D97757]/25 px-5 py-6 text-center text-xs text-[#1F1F1C]/65">
                  لا توجد بوابات عائلية خاصة أخرى مصرح لبريدك بدخولها حالياً. عندما يضيفك قريبك إلى دائرته العائلية، ستظهر بوابته هنا للدخول المباشر بنقرة واحدة.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {authorizedPortals.map((portal) => (
                    <a
                      key={portal.siteSlug}
                      href={`/${portal.siteSlug}`}
                      className="group rounded-2xl bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D97757]/35 p-4 flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="text-sm font-display font-bold text-[#1F1F1C] truncate">
                          ديوان عائلة {portal.familyName}
                        </div>
                        <div className="text-[11px] text-[#1F1F1C]/60 truncate">
                          بإشراف: {portal.ownerDisplayName}
                        </div>
                        <div
                          dir="ltr"
                          className="text-[11px] font-mono text-[#D97757] truncate text-right"
                        >
                          {ACTIVE_PUBLIC_SITE_DISPLAY_HOST}/{portal.siteSlug}
                        </div>
                      </div>
                      <div className="w-9 h-9 rounded-xl bg-[#E8DED2] border border-[#D8C7B2] flex items-center justify-center text-[#D97757] group-hover:bg-[#D97757] group-hover:text-[#F5F1E8] transition-colors shrink-0">
                        <ArrowUpLeft className="w-4 h-4" />
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
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
