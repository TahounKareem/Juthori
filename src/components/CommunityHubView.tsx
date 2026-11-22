import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  FileImage,
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
  TreePine,
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
import {
  AccountLegalType,
  DashboardAccessCapabilities,
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

  // Navigation & UI state
  const [activeTab, setActiveTab] = useState<CommunityTabId>(
    isRegistrar ? 'circle' : 'ambassador'
  );
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
    Array<{ siteSlug: string; familyName: string; ownerDisplayName: string }>
  >([]);
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
  const [questComposerOpen, setQuestComposerOpen] = useState(false);
  const [questTitle, setQuestTitle] = useState('');
  const [questPrompt, setQuestPrompt] = useState('');
  const [questCategory, setQuestCategory] =
    useState<MemoryQuestCategory>('custom');
  const [savingQuest, setSavingQuest] = useState(false);
  const [copiedQuestId, setCopiedQuestId] = useState<string | null>(null);

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
          fetchAuthorizedFamilyPortalsForEmail(effectiveEmail),
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
            result.familyName,
            effectiveEmail
          ) || [];
        const finalTree =
          Array.isArray(treeFromCloud) && treeFromCloud.length > 0
            ? treeFromCloud
            : localTree;
        setRawTreeMembers(finalTree);

        // Auto-open invite studio smoothly if registrar has 0 members yet
        if (isRegistrar && (circleDoc.members || []).length === 0) {
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
  const handleOpenInviteStudioAction = () => {
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
    if (!isRegistrar) {
      onSignCharterAndEnableTree?.();
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
    if (!isRegistrar) {
      onSignCharterAndEnableTree?.();
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

  const handleLaunchMemoryQuest = async (payload: {
    title: string;
    promptText: string;
    category: MemoryQuestCategory;
  }) => {
    if (!isRegistrar) {
      onSignCharterAndEnableTree?.();
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
      if (approve) {
        const refreshed = await fetchKinshipCircleForOwner(effectiveUserId);
        setCircle(refreshed);
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

  return (
    <div className="w-full space-y-3.5 pb-8">
      {/* =====================================================================
          1. UNIFIED WORKSPACE HEADER (Exact 86px Parity Across All 6 Pages)
      ====================================================================== */}
      <UnifiedWorkspaceHeader
        testId="community-unified-header"
        icon={<Users className="w-5 h-5" />}
        title={`مجتمع عائلة ${result.familyName}`}
        metaItems={[
          'مساحة عائلية مغلقة',
          <span key="members" className="tabular-nums">
            <strong className="font-semibold text-[#2C1E14]">
              {circle.members.length}
            </strong>{' '}
            أعضاء بالدائرة
          </span>,
          <span key="enrichments" className="tabular-nums">
            <strong className="font-semibold text-[#9E5631]">
              {totalIncomingEnrichmentCount}
            </strong>{' '}
            طلبات إثراء واردة
          </span>,
          <span key="rewards" className="inline-flex items-center gap-1">
            <span>رصيد المكافآت:</span>
            <strong
              dir="ltr"
              className="font-mono font-semibold text-emerald-800 tabular-nums"
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
              onClick={() => setQrModalOpen(true)}
              className={WORKSPACE_SECONDARY_BTN_CLASS}
            >
              <QrCode className="w-4 h-4 shrink-0" />
              <span>بطاقة الدعوة ورمز QR</span>
            </button>

            <button
              type="button"
              data-testid="community-invite-relative-btn"
              onClick={handleOpenInviteStudioAction}
              className={WORKSPACE_PRIMARY_BTN_CLASS}
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>دعوة قريب للدائرة</span>
            </button>
          </>
        }
      />

      {/* =====================================================================
          1B. SEPARATED 4-PILLAR NAVIGATION BAR (mt-3.5 below unified header)
      ====================================================================== */}
      <div
        className="p-1.5 rounded-2xl bg-[#FDFBF7] border border-[#E6DAC3] shadow-[0_2px_10px_rgba(44,30,20,0.02)] grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-1.5"
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
              ? 'bg-[#9E5631] text-white shadow-xs'
              : 'text-[#4E3C2D] hover:text-[#2C1E14] hover:bg-[#F5ECE0]/70'
          }`}
        >
          <span className="inline-flex items-center gap-2 truncate">
            <Users
              className={`w-4 h-4 shrink-0 ${
                activeTab === 'circle' ? 'text-[#F6DCA2]' : 'text-[#8C5327]'
              }`}
            />
            <span className="truncate">1. دائرة عائلتي والصلاحيات</span>
          </span>
          <span
            className={`px-2 py-0.5 rounded-md text-[11px] tabular-nums shrink-0 ${
              activeTab === 'circle'
                ? 'bg-white/20 text-white'
                : 'bg-[#F5ECE0] text-[#8C5327]'
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
              ? 'bg-[#9E5631] text-white shadow-xs'
              : 'text-[#4E3C2D] hover:text-[#2C1E14] hover:bg-[#F5ECE0]/70'
          }`}
        >
          <span className="inline-flex items-center gap-2 truncate">
            <Inbox
              className={`w-4 h-4 shrink-0 ${
                activeTab === 'enrichment' ? 'text-[#F6DCA2]' : 'text-[#8C5327]'
              }`}
            />
            <span className="truncate">2. مركز الإثراء وحملات الذاكرة</span>
          </span>
          <span
            className={`px-2 py-0.5 rounded-md text-[11px] tabular-nums shrink-0 ${
              activeTab === 'enrichment'
                ? 'bg-white/20 text-white'
                : totalIncomingEnrichmentCount > 0
                ? 'bg-[#9E5631] text-white'
                : 'bg-[#F5ECE0] text-[#7A6855]'
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
              ? 'bg-[#9E5631] text-white shadow-xs'
              : 'text-[#4E3C2D] hover:text-[#2C1E14] hover:bg-[#F5ECE0]/70'
          }`}
        >
          <span className="inline-flex items-center gap-2 truncate">
            <Calendar
              className={`w-4 h-4 shrink-0 ${
                activeTab === 'events' ? 'text-[#F6DCA2]' : 'text-[#8C5327]'
              }`}
            />
            <span className="truncate">3. صلة الرحم والمناسبات (RSVP)</span>
          </span>
          <span
            className={`px-2 py-0.5 rounded-md text-[11px] tabular-nums shrink-0 ${
              activeTab === 'events'
                ? 'bg-white/20 text-white'
                : 'bg-[#F5ECE0] text-[#8C5327]'
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
              ? 'bg-[#9E5631] text-white shadow-xs'
              : 'text-[#4E3C2D] hover:text-[#2C1E14] hover:bg-[#F5ECE0]/70'
          }`}
        >
          <span className="inline-flex items-center gap-2 truncate">
            <Award
              className={`w-4 h-4 shrink-0 ${
                activeTab === 'ambassador' ? 'text-[#F6DCA2]' : 'text-[#8C5327]'
              }`}
            />
            <span className="truncate">4. سفير جذوري ومكافآت</span>
          </span>
          <span
            dir="ltr"
            className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-bold tabular-nums shrink-0 ${
              activeTab === 'ambassador'
                ? 'bg-white/20 text-[#F6DCA2]'
                : 'bg-[#F5ECE0] text-[#8C5327]'
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
              ? 'bg-emerald-950/5 border-emerald-800/25 text-emerald-950'
              : banner.type === 'error'
              ? 'bg-rose-950/5 border-rose-800/25 text-rose-950'
              : 'bg-[#FAF6EE] border-[#B98A78]/40 text-[#252321]'
          }`}
        >
          <span>{banner.text}</span>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="p-1 rounded-md hover:bg-black/5 cursor-pointer"
            aria-label="إغلاق التنبيه"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {isLoading && (
        <div className="rounded-2xl bg-white border border-[#B98A78]/30 p-8 text-center text-xs text-[#252321]/65">
          جارٍ مزامنة دائرة عائلة {result.familyName} من السجل السحابي الموثق...
        </div>
      )}

      {/* =====================================================================
          2. PILLAR 1: دائرة عائلتي والصلاحيات
      ====================================================================== */}
      {!isLoading && activeTab === 'circle' && (
        <div className="space-y-6">
          {/* Registrar Upgrade Notice if user is not yet Record Keeper */}
          {!isRegistrar && (
            <div className="rounded-2xl bg-[#252321] text-[#F7F2E9] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-[#D4AF6A]/35">
              <div className="space-y-1">
                <div className="text-xs font-bold text-[#E5C17A]">
                  صلاحيات إدارة الدائرة العائلية
                </div>
                <h3 className="text-base font-display font-bold">
                  فعّل ميثاق «أمين سجل العائلة» لدعوة أقاربك ومنحهم صلاحيات التوثيق
                </h3>
                <p className="text-xs text-[#F7F2E9]/75 max-w-2xl leading-relaxed">
                  يمكنك الآن تصفح البوابات العائلية المصرح لك بها أدناه أو استخدام رابط «سفير جذوري» لربح <span dir="ltr" className="font-mono font-bold text-[#E5C17A]">$10</span>، وبتفعيل صفة أمين السجل تفتح إدارة دائرة عائلتك بالكامل.
                </p>
              </div>
              {onSignCharterAndEnableTree && (
                <button
                  type="button"
                  onClick={onSignCharterAndEnableTree}
                  className="px-5 py-2.5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-display font-bold shrink-0 cursor-pointer transition-colors"
                >
                  تفعيل صفة أمين السجل الآن
                </button>
              )}
            </div>
          )}

          {/* Smart Relative Invitation Studio (Drawer-style Collapsible Panel) */}
          {isRegistrar && (
            <div
              ref={inviteStudioRef}
              className="rounded-2xl bg-white border border-[#B98A78]/40 overflow-hidden"
            >
              <div className="px-6 py-4 bg-[#FAF6EE] border-b border-[#B98A78]/25 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#252321] text-[#E5C17A] flex items-center justify-center shrink-0">
                    <UserPlus className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-display font-bold text-[#252321]">
                      استوديو دعوة قريب للدائرة وتحديد الصلاحيات
                    </h3>
                    <p className="text-[11px] text-[#252321]/60">
                      اختر مستوى الصلاحية، اربط القريب ببطاقته في «شجرتي» (اختياري)، وأرسل دعوته بالبريد أو واتساب
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setInviteStudioOpen((v) => !v)}
                  className="px-3.5 py-1.5 rounded-lg bg-white border border-[#B98A78]/35 text-xs font-display font-bold text-[#252321] hover:bg-[#F7F2E9] cursor-pointer transition-colors"
                >
                  {inviteStudioOpen ? 'طي النموذج' : '+ فتح نموذج الدعوة'}
                </button>
              </div>

              {inviteStudioOpen && (
                <form onSubmit={handleAddRelative} className="p-6 space-y-5">
                  {/* Basic Relative Details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-display font-bold text-[#252321]">
                        اسم القريب الكامل
                      </label>
                      <input
                        type="text"
                        required
                        value={relName}
                        onChange={(e) => setRelName(e.target.value)}
                        placeholder="مثال: عبد الله بن خالد"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6EE] border border-[#B98A78]/40 text-xs text-[#252321] focus:outline-none focus:border-[#D8755B]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-display font-bold text-[#252321]">
                        البريد الإلكتروني للقريب
                      </label>
                      <input
                        type="email"
                        required
                        dir="ltr"
                        value={relEmail}
                        onChange={(e) => setRelEmail(e.target.value)}
                        placeholder="relative@example.com"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6EE] border border-[#B98A78]/40 text-xs text-[#252321] text-left focus:outline-none focus:border-[#D8755B]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-display font-bold text-[#252321]">
                        صلة القرابة
                      </label>
                      <input
                        type="text"
                        required
                        value={relKinship}
                        onChange={(e) => setRelKinship(e.target.value)}
                        placeholder="ابن عم / شقيق / عم"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6EE] border border-[#B98A78]/40 text-xs text-[#252321] focus:outline-none focus:border-[#D8755B]"
                      />
                      <div className="flex flex-wrap gap-1 pt-1">
                        {KINSHIP_PRESETS.slice(0, 5).map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setRelKinship(preset)}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold cursor-pointer transition-colors ${
                              relKinship === preset
                                ? 'bg-[#8D4925] text-white'
                                : 'bg-[#F7F2E9] text-[#252321]/70 hover:bg-[#EFE6D8]'
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
                    <label className="block text-xs font-display font-bold text-[#252321]">
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
                                ? 'bg-[#FAF6EE] border-[#D8755B] ring-1 ring-[#D8755B]/40'
                                : 'bg-white border-[#B98A78]/35 hover:border-[#8D4925]/50'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-display font-bold text-[#252321]">
                                {roleOpt.labelAr}
                              </span>
                              <span
                                className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                                  selected
                                    ? 'bg-[#D8755B] border-[#D8755B] text-white'
                                    : 'border-[#B98A78]'
                                }`}
                              >
                                {selected && <Check className="w-2.5 h-2.5" />}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#252321]/65 mt-1.5 leading-relaxed">
                              {roleOpt.descriptionAr}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Optional Smart Tree Member Binding */}
                  <div className="rounded-xl bg-[#FAF6EE] border border-[#B98A78]/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="text-xs font-display font-bold text-[#252321] flex items-center gap-1.5">
                        <TreePine className="w-4 h-4 text-[#8D4925]" />
                        <span>ربط العضو ببطاقته في «شجرتي» (اختياري)</span>
                      </div>
                      <p className="text-[11px] text-[#252321]/60">
                        {contemporaryTreeOptions.length > 0
                          ? `اختر بطاقة القريب من بين ${contemporaryTreeOptions.length} فرداً مسجلاً في شجرتك المعاصرة.`
                          : 'أضف أفراد عائلتك في «شجرتي» لتتمكن من ربط كل مدعو بموقعه الفعلي في الشجرة.'}
                      </p>
                    </div>
                    <select
                      value={relTreePersonId}
                      onChange={(e) => setRelTreePersonId(e.target.value)}
                      disabled={contemporaryTreeOptions.length === 0}
                      className="sm:w-72 px-3.5 py-2.5 rounded-xl bg-white border border-[#B98A78]/40 text-xs text-[#252321] focus:outline-none focus:border-[#D8755B] disabled:opacity-50"
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
                    <div className="text-[11px] text-[#252321]/60 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-[#8D4925] shrink-0" />
                      <span>
                        يصل القريب بريد دعوة رسمي مع خيار إلغاء الارتباط الفوري (Opt-out) احتراماً لخصوصيته.
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <a
                        href={craftedRelativeWhatsappHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2.5 rounded-xl bg-[#1F6E43] hover:bg-[#195a36] text-white text-xs font-display font-bold inline-flex items-center gap-2 transition-colors"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>مشاركة دعوة مجهزة عبر واتساب</span>
                      </a>

                      <button
                        type="submit"
                        disabled={invitingRelative}
                        className="px-5 py-2.5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] disabled:opacity-55 text-white text-xs font-display font-bold inline-flex items-center gap-2 transition-colors cursor-pointer"
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
          )}

          {/* Smart Majlis Link Controls & Token Rotation */}
          {isRegistrar && (
            <div className="rounded-2xl bg-[#FAF6EE] border border-[#B98A78]/35 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 text-xs font-display font-bold text-[#252321]">
                  <Link2 className="w-4 h-4 text-[#8D4925]" />
                  <span>رابط المجلس العائلي الذكي والتحكم الأمني</span>
                  {circle.majlisInviteRotatedAt && (
                    <span className="text-[10px] font-normal text-[#252321]/55">
                      · آخر تدوير:{' '}
                      {new Date(
                        circle.majlisInviteRotatedAt
                      ).toLocaleDateString('ar-SA')}
                    </span>
                  )}
                </div>
                <div
                  dir="ltr"
                  className="text-xs font-mono font-bold text-[#8D4925] truncate select-all"
                >
                  {cleanMajlisUrl}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyMajlisUrl}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#F7F2E9] border border-[#B98A78]/40 text-xs font-display font-bold text-[#252321] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  {copiedMajlisUrl ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-700" />
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
                  onClick={() => setQrModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#F7F2E9] border border-[#B98A78]/40 text-xs font-display font-bold text-[#252321] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <QrCode className="w-3.5 h-3.5 text-[#8D4925]" />
                  <span>رمز QR</span>
                </button>

                <button
                  type="button"
                  onClick={handleRotateMajlisLink}
                  disabled={rotatingMajlisLink}
                  className="px-3.5 py-2 rounded-xl bg-[#252321] hover:bg-[#3a3633] disabled:opacity-55 text-[#F7F2E9] text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <RotateCcw
                    className={`w-3.5 h-3.5 text-[#E5C17A] ${
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
            <div className="rounded-2xl bg-white border border-[#D8755B]/45 overflow-hidden">
              <div className="px-6 py-3.5 bg-[#D8755B]/10 border-b border-[#D8755B]/25 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-display font-bold text-[#8D4925]">
                  <UserCheck className="w-4 h-4" />
                  <span>طلبات دخول جديدة لبوابة العائلة الخاصة</span>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-[#D8755B] text-white text-[11px] font-bold tabular-nums">
                  {accessRequests.length}
                </span>
              </div>
              <div className="divide-y divide-[#B98A78]/20">
                {accessRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5">
                      <div className="text-xs font-display font-bold text-[#252321]">
                        {req.visitorName}
                        <span className="font-normal text-[#252321]/60 mr-2" dir="ltr">
                          ({req.visitorEmail})
                        </span>
                      </div>
                      {req.kinshipNote && (
                        <div className="text-[11px] text-[#8D4925]">
                          ملاحظة القرابة: {req.kinshipNote}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={resolvingAccessId === req.id}
                        onClick={() => handleResolveAccess(req, true)}
                        className="px-3.5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white text-xs font-display font-bold cursor-pointer transition-colors"
                      >
                        قبول وإضافة للدائرة ✓
                      </button>
                      <button
                        type="button"
                        disabled={resolvingAccessId === req.id}
                        onClick={() => handleResolveAccess(req, false)}
                        className="px-3 py-2 rounded-xl bg-[#F7F2E9] hover:bg-[#EDE4D5] disabled:opacity-50 text-[#252321] text-xs font-semibold cursor-pointer transition-colors"
                      >
                        اعتذار
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Approved Relatives Roster — Luxury Membership Cards */}
          {isRegistrar && (
            <div className="rounded-2xl bg-white border border-[#B98A78]/35 overflow-hidden">
              <div className="px-6 py-4 border-b border-[#B98A78]/25 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4.5 h-4.5 text-[#8D4925]" />
                  <h3 className="text-sm font-display font-bold text-[#252321]">
                    أفراد دائرة عائلة {result.familyName} المعتمدون
                  </h3>
                </div>
                <span className="text-xs text-[#252321]/60 tabular-nums">
                  {circle.members.length} عضو موثق الصلاحية
                </span>
              </div>

              <div className="p-6">
                {circle.members.length === 0 ? (
                  <div className="rounded-2xl bg-gradient-to-b from-[#FAF6EE] to-white border border-dashed border-[#B98A78]/50 p-8 sm:p-10 text-center space-y-4">
                    {/* Custom Heritage Crest SVG Illustration */}
                    <div className="w-16 h-16 rounded-2xl bg-[#252321] text-[#E5C17A] mx-auto flex items-center justify-center shadow-sm">
                      <Users className="w-8 h-8" />
                    </div>
                    <div className="space-y-1.5 max-w-lg mx-auto">
                      <h4 className="text-base font-display font-bold text-[#252321]">
                        دائرة عائلتك جاهزة لاستقبال أول أفرادها
                      </h4>
                      <p className="text-xs text-[#252321]/65 leading-relaxed">
                        توثيق تاريخ العائلة أجمل حين يتشارك فيه الأبناء والأعمام. ادعُ الآن أول قريب موثوق بصلاحية «مساعد أمين السجل» أو «راوي ومُساهم في الذاكرة» لبدء إثراء الشجرة والخزانة معاً.
                      </p>
                    </div>
                    {!inviteStudioOpen && (
                      <button
                        type="button"
                        onClick={handleOpenInviteStudioAction}
                        className="px-5 py-2.5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-display font-bold inline-flex items-center gap-2 cursor-pointer transition-colors"
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
                          className="rounded-2xl bg-[#FAF6EE] border border-[#B98A78]/35 p-5 flex flex-col justify-between gap-4 hover:border-[#8D4925]/45 transition-colors"
                        >
                          {/* Top Identity Row */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="w-11 h-11 rounded-xl bg-[#252321] text-[#E5C17A] font-display font-bold text-sm flex items-center justify-center shrink-0">
                                {getArabicInitials(member.name)}
                              </div>
                              <div className="min-w-0 space-y-0.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="text-sm font-display font-bold text-[#252321] truncate">
                                    {member.name}
                                  </h4>
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                      isActive
                                        ? 'bg-emerald-900/12 text-emerald-900'
                                        : 'bg-amber-900/10 text-[#8D4925]'
                                    }`}
                                  >
                                    {isActive ? 'عضو نشط ✓' : 'تم إرسال الدعوة'}
                                  </span>
                                </div>
                                <div className="text-xs text-[#8D4925] font-semibold">
                                  {member.kinshipRelation}
                                  {member.approvedEnrichmentsCount > 0 && (
                                    <span className="text-[#252321]/55 font-normal mr-2">
                                      · {member.approvedEnrichmentsCount} مساهمة معتمدة
                                    </span>
                                  )}
                                </div>
                                <div
                                  dir="ltr"
                                  className="text-[11px] font-mono text-[#252321]/60 truncate text-right"
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
                              className="p-2 rounded-lg text-[#252321]/45 hover:text-rose-700 hover:bg-rose-950/5 disabled:opacity-40 cursor-pointer transition-colors shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Inline Editable Role & Tree-Link Controls */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-[#B98A78]/20">
                            <div className="space-y-1">
                              <label className="block text-[10px] font-semibold text-[#252321]/60">
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
                                className="w-full px-2.5 py-2 rounded-lg bg-white border border-[#B98A78]/35 text-[11px] font-semibold text-[#252321] focus:outline-none focus:border-[#D8755B] disabled:opacity-50"
                              >
                                {ROLE_OPTIONS.map((opt) => (
                                  <option key={opt.id} value={opt.id}>
                                    {opt.shortLabelAr}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[10px] font-semibold text-[#252321]/60">
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
                                className="w-full px-2.5 py-2 rounded-lg bg-white border border-[#B98A78]/35 text-[11px] font-semibold text-[#252321] focus:outline-none focus:border-[#D8755B] disabled:opacity-50"
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
                            <span className="text-[#252321]/55">
                              {member.linkedTreePersonName ? (
                                <span className="inline-flex items-center gap-1 text-emerald-900 font-semibold">
                                  <TreePine className="w-3.5 h-3.5" />
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
                              className="inline-flex items-center gap-1 text-[#1F6E43] hover:underline font-bold"
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
          )}

          {/* Authorized Family Portals (For ALL Users) */}
          <div className="rounded-2xl bg-white border border-[#B98A78]/35 overflow-hidden">
            <div className="px-6 py-4 border-b border-[#B98A78]/25 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Globe className="w-4.5 h-4.5 text-[#8D4925]" />
                <h3 className="text-sm font-display font-bold text-[#252321]">
                  البوابات العائلية المصرح لي بدخولها
                </h3>
              </div>
              <span className="text-xs text-[#252321]/60 tabular-nums">
                {authorizedPortals.length} بوابة
              </span>
            </div>

            <div className="p-6">
              {authorizedPortals.length === 0 ? (
                <div className="rounded-xl bg-[#FAF6EE] border border-[#B98A78]/25 px-5 py-6 text-center text-xs text-[#252321]/65">
                  لا توجد بوابات عائلية خاصة أخرى مصرح لبريدك بدخولها حالياً. عندما يضيفك قريبك إلى دائرته العائلية، ستظهر بوابته هنا للدخول المباشر بنقرة واحدة.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {authorizedPortals.map((portal) => (
                    <a
                      key={portal.siteSlug}
                      href={`/${portal.siteSlug}`}
                      className="group rounded-2xl bg-[#FAF6EE] hover:bg-[#F3E9D8] border border-[#B98A78]/35 p-4 flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="text-sm font-display font-bold text-[#252321] truncate">
                          ديوان عائلة {portal.familyName}
                        </div>
                        <div className="text-[11px] text-[#252321]/60 truncate">
                          بإشراف: {portal.ownerDisplayName}
                        </div>
                        <div
                          dir="ltr"
                          className="text-[11px] font-mono text-[#8D4925] truncate text-right"
                        >
                          {ACTIVE_PUBLIC_SITE_DISPLAY_HOST}/{portal.siteSlug}
                        </div>
                      </div>
                      <div className="w-9 h-9 rounded-xl bg-white border border-[#B98A78]/30 flex items-center justify-center text-[#8D4925] group-hover:bg-[#252321] group-hover:text-[#E5C17A] transition-colors shrink-0">
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
          <div className="rounded-2xl bg-white border border-[#B98A78]/35 overflow-hidden">
            <div className="px-6 py-4 bg-[#FAF6EE] border-b border-[#B98A78]/25 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#D8755B]/15 text-[#8D4925] flex items-center justify-center shrink-0">
                  <Megaphone className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-display font-bold text-[#252321]">
                    حملات استكتاب العائلة وجمع الذاكرة
                  </h3>
                  <p className="text-[11px] text-[#252321]/60">
                    أطلق نداءً حقيقياً للعائلة لجمع الصور والمواليد وذكريات الأجداد، وشاركه في مجموعة واتساب العائلة
                  </p>
                </div>
              </div>

              {isRegistrar && (
                <button
                  type="button"
                  onClick={() => setQuestComposerOpen((v) => !v)}
                  className="px-4 py-2 rounded-xl bg-[#252321] hover:bg-[#3a3633] text-[#F7F2E9] text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-[#E5C17A]" />
                  <span>
                    {questComposerOpen ? 'إغلاق المحرر' : 'إطلاق حملة ذاكرة مخصصة'}
                  </span>
                </button>
              )}
            </div>

            <div className="p-6 space-y-5">
              {/* Ready Starter Templates to Launch Real Campaigns */}
              {isRegistrar && (
                <div className="space-y-2.5">
                  <div className="text-xs font-display font-bold text-[#252321]/80 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#D8755B]" />
                    <span>قوالب حملات جاهزة للإطلاق الفوري بنقرة واحدة:</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {MEMORY_QUEST_TEMPLATES.map((tpl) => (
                      <div
                        key={tpl.category}
                        className="rounded-xl bg-[#FAF6EE] border border-[#B98A78]/30 p-4 flex flex-col justify-between gap-3"
                      >
                        <div className="space-y-1.5">
                          <span className="inline-block text-[10px] font-bold text-[#8D4925]">
                            {tpl.badgeAr}
                          </span>
                          <h4 className="text-xs font-display font-bold text-[#252321] leading-snug">
                            {tpl.title}
                          </h4>
                          <p className="text-[11px] text-[#252321]/65 leading-relaxed line-clamp-3">
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
                          className="w-full py-2 rounded-lg bg-white hover:bg-[#252321] hover:text-[#F7F2E9] border border-[#B98A78]/40 text-xs font-display font-bold text-[#252321] transition-colors cursor-pointer disabled:opacity-50"
                        >
                          إطلاق هذه الحملة للعائلة ✦
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom Quest Composer */}
              {isRegistrar && questComposerOpen && (
                <div className="rounded-2xl bg-[#FAF6EE] border border-[#D8755B]/40 p-5 space-y-3">
                  <div className="text-xs font-display font-bold text-[#252321]">
                    صياغة نداء توثيق خاص بعائلة {result.familyName}
                  </div>
                  <input
                    type="text"
                    value={questTitle}
                    onChange={(e) => setQuestTitle(e.target.value)}
                    placeholder="عنوان الحملة (مثال: توثيق صور رحلة المصيف العائلي عام 1415هـ)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#B98A78]/40 text-xs text-[#252321] focus:outline-none focus:border-[#D8755B]"
                  />
                  <textarea
                    rows={3}
                    value={questPrompt}
                    onChange={(e) => setQuestPrompt(e.target.value)}
                    placeholder="اكتب السؤال أو النداء الذي سيصل إلى أقاربك لتحفيزهم على رفع الصور أو القصص..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#B98A78]/40 text-xs text-[#252321] focus:outline-none focus:border-[#D8755B]"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setQuestComposerOpen(false)}
                      className="px-4 py-2 rounded-xl bg-white border border-[#B98A78]/35 text-xs font-semibold text-[#252321] cursor-pointer"
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
                      className="px-5 py-2 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] disabled:opacity-50 text-white text-xs font-display font-bold cursor-pointer transition-colors"
                    >
                      {savingQuest ? 'جارٍ الإطلاق...' : 'حفظ وإطلاق الحملة ✓'}
                    </button>
                  </div>
                </div>
              )}

              {/* Active & Saved Real Memory Quests List */}
              {memoryQuests.length > 0 ? (
                <div className="space-y-3 pt-2 border-t border-[#B98A78]/20">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-display font-bold text-[#252321]">
                      حملات الذاكرة المحفوظة لعائلة {result.familyName}
                    </span>
                    <span className="text-[#252321]/60 tabular-nums">
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
                              ? 'bg-white border-[#D8755B]/40 shadow-xs'
                              : 'bg-[#FAF6EE]/70 border-[#B98A78]/25 opacity-80'
                          }`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="text-sm font-display font-bold text-[#252321] leading-snug">
                                {quest.title}
                              </h4>
                              <span
                                className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  isQuestActive
                                    ? 'bg-emerald-900/12 text-emerald-900'
                                    : 'bg-[#252321]/10 text-[#252321]/60'
                                }`}
                              >
                                {isQuestActive ? 'حملة نشطة' : 'مؤرشفة'}
                              </span>
                            </div>
                            <p className="text-xs text-[#252321]/70 leading-relaxed">
                              {quest.promptText}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#B98A78]/20">
                            <div className="flex flex-wrap items-center gap-2">
                              <a
                                href={`https://wa.me/?text=${encodeURIComponent(
                                  whatsappQuestText
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 rounded-lg bg-[#1F6E43] hover:bg-[#195a36] text-white text-[11px] font-display font-bold inline-flex items-center gap-1.5 transition-colors"
                              >
                                <Share2 className="w-3 h-3" />
                                <span>مشاركة عبر واتساب العائلة</span>
                              </a>
                              <button
                                type="button"
                                onClick={() => handleCopyQuestCallout(quest)}
                                className="px-2.5 py-1.5 rounded-lg bg-[#FAF6EE] hover:bg-[#EFE6D8] border border-[#B98A78]/35 text-[11px] font-semibold text-[#252321] inline-flex items-center gap-1 cursor-pointer"
                              >
                                {copiedQuestId === quest.id ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-700" />
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
                                  className="px-2 py-1 rounded-md text-[11px] text-[#252321]/65 hover:text-[#252321] hover:bg-black/5 inline-flex items-center gap-1 cursor-pointer"
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
                                  className="p-1.5 rounded-md text-[#252321]/45 hover:text-rose-700 hover:bg-rose-950/5 cursor-pointer"
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
                <div className="rounded-xl bg-[#FAF6EE]/80 border border-dashed border-[#B98A78]/40 px-5 py-4 text-xs text-[#252321]/65 text-center">
                  لم تُطلق حملات جمع ذاكرة بعد. اختر أحد القوالب أعلاه أو صُغ سؤالك الخاص لتحفيز أفراد عائلتك على مشاركة صورهم وذكرياتهم.
                </div>
              )}
            </div>
          </div>

          {/* Categorized Family Enrichment Moderation Studio */}
          <div className="rounded-2xl bg-white border border-[#B98A78]/35 overflow-hidden">
            <div className="px-6 py-4 border-b border-[#B98A78]/25 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Inbox className="w-4.5 h-4.5 text-[#D8755B]" />
                <div>
                  <h3 className="text-sm font-display font-bold text-[#252321]">
                    صندوق مراجعة واعتماد إثراءات العائلة
                  </h3>
                  <p className="text-[11px] text-[#252321]/60">
                    لا يُدمج أي مقترح في «شجرتي» أو «خزانتي» إلا بموافقتك الصريحة كأمين سجل
                  </p>
                </div>
              </div>

              {reviewedEnrichments.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowReviewedHistory((v) => !v)}
                  className="text-xs font-display font-bold text-[#8D4925] hover:underline cursor-pointer"
                >
                  {showReviewedHistory
                    ? 'إخفاء الأرشيف المراجع'
                    : `سجل المراجعات السابقة (${reviewedEnrichments.length})`}
                </button>
              )}
            </div>

            {/* Category Filter Strip */}
            <div className="px-6 py-3 bg-[#FAF6EE] border-b border-[#B98A78]/20 flex flex-wrap items-center gap-2">
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
                        ? 'bg-[#252321] text-[#F7F2E9]'
                        : 'bg-white border border-[#B98A78]/35 text-[#252321]/75 hover:border-[#8D4925]/50'
                    }`}
                  >
                    <span>{flt.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded tabular-nums ${
                        active
                          ? 'bg-white/15 text-[#E5C17A]'
                          : 'bg-[#F7F2E9] text-[#8D4925]'
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
                <div className="rounded-2xl bg-[#FAF6EE] border border-dashed border-[#B98A78]/45 p-8 text-center space-y-2.5">
                  <div className="w-12 h-12 rounded-2xl bg-white border border-[#B98A78]/30 mx-auto flex items-center justify-center text-[#8D4925]">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-display font-bold text-[#252321]">
                    صندوق الإثراءات المعلّقة نظيف تماماً
                  </h4>
                  <p className="text-xs text-[#252321]/65 max-w-md mx-auto leading-relaxed">
                    عندما يقترح أحد أقاربك إضافة مولود جديد أو رفع صورة تاريخية أو التعرف على شخص في صورة عبر «موقعي»، ستصل مساهمته هنا للمراجعة والدمج بضغطة واحدة.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Pending Tree / Vault / Story Enrichment Cards */}
                  {filteredPendingEnrichments.map((req) => {
                    const typeBadge =
                      req.requestType === 'ADD_TREE_MEMBER'
                        ? {
                            label: 'اقتراح إضافة فرد للشجرة',
                            icon: TreePine,
                            color: 'bg-emerald-900/10 text-emerald-900',
                          }
                        : req.requestType === 'VAULT_MEDIA'
                        ? {
                            label: 'إهداء صورة / وثيقة للخزانة',
                            icon: FileImage,
                            color: 'bg-[#D8755B]/15 text-[#8D4925]',
                          }
                        : {
                            label: 'قصة / تصحيح سيرة',
                            icon: MessageSquareHeart,
                            color: 'bg-amber-900/10 text-[#8D4925]',
                          };
                    const TypeIcon = typeBadge.icon;

                    return (
                      <div
                        key={req.id}
                        className="rounded-2xl bg-[#FAF6EE] border border-[#B98A78]/40 p-5 space-y-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-display font-bold ${typeBadge.color}`}
                              >
                                <TypeIcon className="w-3.5 h-3.5" />
                                {typeBadge.label}
                              </span>
                              <span className="text-[11px] text-[#252321]/55 inline-flex items-center gap-1">
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

                            <div className="text-sm font-display font-bold text-[#252321] pt-1">
                              مقدّم من: {req.requesterName}
                              {req.kinshipRelation && (
                                <span className="text-xs font-semibold text-[#8D4925] mr-2">
                                  ({req.kinshipRelation})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Proposal Details + Optional Media Preview */}
                        <div className="rounded-xl bg-white border border-[#B98A78]/25 p-4 flex flex-col sm:flex-row gap-4">
                          {req.mediaDataOrUrl && (
                            <div className="w-full sm:w-32 h-32 rounded-xl overflow-hidden bg-[#F7F2E9] border border-[#B98A78]/30 shrink-0">
                              <img
                                src={req.mediaDataOrUrl}
                                alt={req.mediaTitle || 'مرفق إثراء عائلي'}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <div className="space-y-1.5 text-xs text-[#252321]/85 flex-1 min-w-0">
                            {req.proposedFirstName && (
                              <div>
                                <span className="text-[#252321]/60">الاسم المقترح: </span>
                                <strong className="font-display text-[#252321]">
                                  {req.proposedFirstName}
                                </strong>
                                {req.proposedBirthYear && (
                                  <span className="mr-2 text-[#8D4925]">
                                    (مواليد {req.proposedBirthYear})
                                  </span>
                                )}
                              </div>
                            )}
                            {req.targetPersonName && (
                              <div>
                                <span className="text-[#252321]/60">مرتبط بالفرد: </span>
                                <strong className="font-display text-[#8D4925]">
                                  {req.targetPersonName}
                                </strong>
                              </div>
                            )}
                            {req.mediaTitle && (
                              <div>
                                <span className="text-[#252321]/60">عنوان الوثيقة / الصورة: </span>
                                <strong className="font-display text-[#252321]">
                                  {req.mediaTitle}
                                </strong>
                                {req.mediaDateOrOccasion && (
                                  <span className="text-[#252321]/60 mr-2">
                                    · {req.mediaDateOrOccasion}
                                  </span>
                                )}
                              </div>
                            )}
                            {req.proposedNotes && (
                              <p className="text-xs text-[#252321]/75 leading-relaxed pt-1">
                                {req.proposedNotes}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Decisive Registrar Moderation Actions */}
                        {isRegistrar && (
                          <div className="flex flex-wrap items-center justify-end gap-2.5">
                            <button
                              type="button"
                              disabled={reviewingId === req.id}
                              onClick={() => handleReviewEnrichment(req, false)}
                              className="px-4 py-2 rounded-xl bg-white hover:bg-rose-950/5 border border-[#B98A78]/40 text-xs font-semibold text-[#252321] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                            >
                              <XCircle className="w-3.5 h-3.5 text-[#8D4925]" />
                              <span>أرشفة / اعتذار</span>
                            </button>
                            <button
                              type="button"
                              disabled={reviewingId === req.id}
                              onClick={() => handleReviewEnrichment(req, true)}
                              className="px-5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>
                                {reviewingId === req.id
                                  ? 'جارٍ الاعتماد والدمج...'
                                  : 'اعتماد ودمج فوري في سجلاتي ✓'}
                              </span>
                            </button>
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
                        className="rounded-2xl bg-[#FAF6EE] border border-[#B98A78]/35 p-5 flex flex-col sm:flex-row items-start gap-4"
                      >
                        {entry.previewUrl ? (
                          <img
                            src={entry.previewUrl}
                            alt={entry.photoTitle}
                            className="w-24 h-24 rounded-xl object-cover border border-[#B98A78]/30 shrink-0"
                          />
                        ) : (
                          <div className="w-24 h-24 rounded-xl bg-white border border-[#B98A78]/30 flex items-center justify-center text-[#8D4925] shrink-0">
                            <Camera className="w-6 h-6" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[#252321] text-[#E5C17A] text-[10px] font-bold">
                              <ScanFace className="w-3 h-3" />
                              التعرف على وجوه الصور
                            </span>
                            <span className="text-[11px] text-[#252321]/55">
                              {new Date(entry.createdAt).toLocaleDateString(
                                'ar-SA'
                              )}
                            </span>
                          </div>
                          <div className="text-xs font-display font-bold text-[#252321]">
                            أفاد «{entry.senderName}» حول صورة: {entry.photoTitle}
                          </div>
                          <p className="text-xs text-[#252321]/80 bg-white rounded-xl px-3.5 py-2.5 border border-[#B98A78]/25">
                            “{entry.note}”
                          </p>
                          {onNavigateTab && (
                            <div className="pt-1">
                              <button
                                type="button"
                                onClick={() => onNavigateTab(DashboardTab.MyVault)}
                                className="text-xs font-display font-bold text-[#8D4925] hover:underline inline-flex items-center gap-1 cursor-pointer"
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
                <div className="pt-4 border-t border-[#B98A78]/25 space-y-2.5">
                  <div className="text-xs font-display font-bold text-[#252321]/75">
                    الأرشيف السابق للإثراءات المراجعة
                  </div>
                  <div className="space-y-2">
                    {reviewedEnrichments.slice(0, 12).map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl bg-[#FAF6EE]/70 border border-[#B98A78]/25 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <strong className="font-display text-[#252321]">
                            {item.requesterName}
                          </strong>
                          <span className="text-[#252321]/60 mr-2">
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
                              ? 'bg-emerald-900/12 text-emerald-900'
                              : 'bg-[#252321]/10 text-[#252321]/60'
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
    </div>
  );
};
