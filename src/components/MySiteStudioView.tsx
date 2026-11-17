import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  Briefcase,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  Eye,
  FileSignature,
  FolderOpen,
  GitBranch,
  Globe,
  Heart,
  Loader2,
  Lock,
  MessageSquare,
  Mic,
  Palette,
  Pin,
  Plus,
  QrCode,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import {
  AccountLegalType,
  DashboardAccessCapabilities,
  LineageSearchResult,
} from '../types/juthori';
import {
  CustomerSiteSettingsData,
  FamilyVaultMediaItem,
  VaultFolderRecord,
  buildDeterministicReferralCode,
  fetchUserFamilyTreeFromFirebase,
  fetchUserVaultArchive,
  readUserFamilyTreeFromLocal,
  readVaultArchiveFromLocal,
} from '../services/firestoreService';
import {
  FAMILY_SITE_THEMES,
  FamilySiteThemeId,
} from '../config/referralAndSiteConfig';
import {
  COMMERCIAL_LINEAGE_PAYWALL_TEASER_AR,
  FamilyMicrositeCmsModules,
  FemaleDisplayPolicy,
  ModuleVisibility,
  PublicMicrositeData,
  PublicSitePrivacyConfig,
  RawTreePersonForPublicProjection,
  SiteAccessMode,
  buildDefaultCmsModules,
  checkPublicSiteSlugAvailability,
  computeContemporaryTreeMetrics,
  fetchPublishedMicrositeBySlug,
  normalizePublicSiteSlug,
  projectSelectedVaultItemsForPublicSite,
  publishOrUpdatePublicMicrositeAtomically,
  sanitizeTreeMembersForPublicSite,
} from '../services/priority4Service';
import { PublicFamilyMicrositePage } from './PublicFamilyMicrositePage';
import { RoyalQrInvitationModal } from './RoyalQrInvitationModal';

interface MySiteStudioViewProps {
  result: LineageSearchResult;
  accountType?: AccountLegalType;
  caps: DashboardAccessCapabilities;
  unlockedCapsules?: string[];
  userId?: string;
  userEmail?: string;
  emailVerified?: boolean;
  initialSiteSettings?: CustomerSiteSettingsData;
  onSaveSiteSettings?: (settings: CustomerSiteSettingsData) => void;
  onUpgradeAnnualVip: () => void;
  onSignCharterAndEnableTree?: () => void;
  onOpenEmailVerification?: () => void;
  onLogActivity: (action: string, detail: string) => void;
}

type StudioSectionTab =
  | 'identity_theme'
  | 'mirror_privacy'
  | 'editorial_modules'
  | 'heritage_community_modules';

function VisibilitySelector({
  value,
  onChange,
}: {
  value: ModuleVisibility;
  onChange: (next: ModuleVisibility) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as ModuleVisibility)}
      className="px-2.5 py-1.5 rounded-lg bg-[#F7F2E9] border border-[#B98A78]/50 text-xs font-semibold text-[#252321]"
    >
      <option value="PUBLIC">متاح للعامة</option>
      <option value="FAMILY_ONLY">لدائرة العائلة فقط</option>
      <option value="HIDDEN">مخفي</option>
    </select>
  );
}

export const MySiteStudioView: React.FC<MySiteStudioViewProps> = ({
  result,
  caps,
  userId,
  userEmail,
  emailVerified = true,
  initialSiteSettings,
  onSaveSiteSettings,
  onUpgradeAnnualVip,
  onSignCharterAndEnableTree,
  onOpenEmailVerification,
  onLogActivity,
}) => {
  const defaultSlug = useMemo(() => {
    const saved = initialSiteSettings?.siteSubdomain;
    if (saved) return normalizePublicSiteSlug(saved);
    const codeBased = normalizePublicSiteSlug(
      result.familyCode || `al-${result.familyName}`
    );
    return codeBased.length >= 3 ? codeBased : 'family-diwan';
  }, [initialSiteSettings?.siteSubdomain, result.familyCode, result.familyName]);

  const [studioTab, setStudioTab] = useState<StudioSectionTab>('identity_theme');
  const [siteSlug, setSiteSlug] = useState<string>(defaultSlug);
  const [previousPublishedSlug, setPreviousPublishedSlug] =
    useState<string>(defaultSlug);
  const [isPublished, setIsPublished] = useState<boolean>(
    Boolean(initialSiteSettings?.isPublished)
  );
  const [siteAccessMode, setSiteAccessMode] = useState<SiteAccessMode>(
    initialSiteSettings?.siteAccessMode || 'PUBLIC'
  );
  const [themeId, setThemeId] = useState<FamilySiteThemeId>(
    initialSiteSettings?.themeId || 'golden_parchment'
  );
  const [emblemTag, setEmblemTag] = useState<string>(
    initialSiteSettings?.emblemTag ||
      `ديوان وسجل أسرة ${result.familyName} المعاصر`
  );
  const [bioTitle, setBioTitle] = useState<string>(
    initialSiteSettings?.bioTitle || `ديوان وسجل أسرة ${result.familyName}`
  );
  const [bioDescription, setBioDescription] = useState<string>(
    initialSiteSettings?.bioDescription ||
      `بوابة رقمية موثقة تجمع فروع أسرة ${result.familyName} المعاصرة في ${
        result.originRegion
          ? `${result.originRegion} (${result.originCountry})`
          : result.originCountry
      } لحفظ الذاكرة العائلية وصلة الرحم وتوثيق المناسبات والصور التراثية.`
  );

  // Mirror & Dual Privacy Matrix States
  const [bioVisibility, setBioVisibility] = useState<ModuleVisibility>(
    initialSiteSettings?.showBio === false ? 'HIDDEN' : 'PUBLIC'
  );
  const [treeVisibility, setTreeVisibility] = useState<ModuleVisibility>(
    initialSiteSettings?.showFamilyTree === false ? 'HIDDEN' : 'PUBLIC'
  );
  const [vaultVisibility, setVaultVisibility] =
    useState<ModuleVisibility>('PUBLIC');

  const [femaleDisplayPolicy, setFemaleDisplayPolicy] =
    useState<FemaleDisplayPolicy>(
      initialSiteSettings?.femaleDisplayPolicy || 'SHOW_ALL'
    );
  const [hideLivingNamesForGuests, setHideLivingNamesForGuests] =
    useState<boolean>(
      initialSiteSettings?.hideLivingNamesForGuests ??
        initialSiteSettings?.protectLivingMembers ??
        false
    );
  const [hideLivingBirthDates, setHideLivingBirthDates] = useState<boolean>(
    initialSiteSettings?.hideLivingBirthDates ?? true
  );
  const [startRootPersonId, setStartRootPersonId] = useState<string>(
    initialSiteSettings?.startRootPersonId || ''
  );
  const [excludedBranchRootIds, setExcludedBranchRootIds] = useState<string[]>(
    initialSiteSettings?.excludedBranchRootIds || []
  );

  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>(
    initialSiteSettings?.selectedFolderIds || []
  );
  const [selectedVaultItemIds, setSelectedVaultItemIds] = useState<string[]>(
    initialSiteSettings?.selectedVaultItemIds || []
  );
  const [enableDynamicWatermark, setEnableDynamicWatermark] = useState<boolean>(
    initialSiteSettings?.enableDynamicWatermark ?? true
  );
  const [enablePhotoFacePrompt, setEnablePhotoFacePrompt] =
    useState<boolean>(true);

  // Agile CMS Modules State
  const [cmsModules, setCmsModules] = useState<FamilyMicrositeCmsModules>(() => {
    if (initialSiteSettings?.cmsModulesJson) {
      try {
        return JSON.parse(
          initialSiteSettings.cmsModulesJson
        ) as FamilyMicrositeCmsModules;
      } catch {
        // Fallback
      }
    }
    return buildDefaultCmsModules(result);
  });

  // Private Workspace Sources (`شجرتي` & `خزانتي`)
  const [rawTreeMembers, setRawTreeMembers] = useState<
    RawTreePersonForPublicProjection[]
  >([]);
  const [vaultFolders, setVaultFolders] = useState<VaultFolderRecord[]>([]);
  const [allVaultItems, setAllVaultItems] = useState<FamilyVaultMediaItem[]>([]);

  // Quick Add Draft Inputs for Modules
  const [newNewsCategory, setNewNewsCategory] = useState<
    'مولود جديد' | 'عقد قران وزواج' | 'تخرج وإنجاز علمي' | 'ترقية وتكريم' | 'خبر عائلي'
  >('مولود جديد');
  const [newNewsTitle, setNewNewsTitle] = useState('');
  const [newNewsSummary, setNewNewsSummary] = useState('');

  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventLocation, setNewEventLocation] = useState('');

  const [newStoryTitle, setNewStoryTitle] = useState('');
  const [newStoryEra, setNewStoryEra] = useState('');
  const [newStoryMonth, setNewStoryMonth] = useState<number>(
    new Date().getMonth() + 1
  );
  const [newStoryBody, setNewStoryBody] = useState('');

  const [newNotableName, setNewNotableName] = useState('');
  const [newNotableRole, setNewNotableRole] = useState('');
  const [newNotableBio, setNewNotableBio] = useState('');

  const [newAudioTitle, setNewAudioTitle] = useState('');
  const [newAudioSpeaker, setNewAudioSpeaker] = useState('');
  const [newAudioYear, setNewAudioYear] = useState('');
  const [newAudioUrl, setNewAudioUrl] = useState('');
  const [newAudioExcerpt, setNewAudioExcerpt] = useState('');

  const [newLocCountry, setNewLocCountry] = useState(result.originCountry || 'السعودية');
  const [newLocCity, setNewLocCity] = useState('');
  const [newLocCount, setNewLocCount] = useState<number>(5);

  const [newProfName, setNewProfName] = useState('');
  const [newProfSpecialty, setNewProfSpecialty] = useState('');
  const [newProfCategory, setNewProfCategory] = useState('الطب والرعاية الصحية');
  const [newProfCity, setNewProfCity] = useState('');

  const [newElderName, setNewElderName] = useState('');
  const [newElderYear, setNewElderYear] = useState('');
  const [newElderBio, setNewElderBio] = useState('');
  const [newElderCharity, setNewElderCharity] = useState('');

  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newTopicPrompt, setNewTopicPrompt] = useState('');

  // Slug Check, Save Status & Modals
  const [slugStatus, setSlugStatus] = useState<{
    checking: boolean;
    available?: boolean;
    message?: string;
  }>({ checking: false });
  const [saving, setSaving] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    tone: 'success' | 'warning' | 'error';
    text: string;
  } | null>(null);
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [showRoyalQrModal, setShowRoyalQrModal] = useState(false);

  // Load private `شجرتي` & `خزانتي` + remote published microsite if exists
  useEffect(() => {
    let mounted = true;
    const loadSources = async () => {
      const localVault = readVaultArchiveFromLocal(
        userId,
        result.familyName,
        userEmail
      );
      if (mounted) {
        setVaultFolders(localVault.folders || []);
        setAllVaultItems(localVault.items || []);
      }

      const remoteVault = await fetchUserVaultArchive(
        userId,
        result.familyName,
        userEmail
      );
      if (mounted) {
        setVaultFolders(remoteVault.folders || []);
        setAllVaultItems(remoteVault.items || []);
      }

      const localTree = readUserFamilyTreeFromLocal<RawTreePersonForPublicProjection>(
        userId || '',
        result.familyName,
        userEmail
      );
      if (mounted && Array.isArray(localTree)) {
        setRawTreeMembers(localTree);
      }
      if (userId) {
        const remoteTree =
          await fetchUserFamilyTreeFromFirebase<RawTreePersonForPublicProjection>(
            userId,
            userEmail,
            result.familyName
          );
        if (mounted && Array.isArray(remoteTree) && remoteTree.length > 0) {
          setRawTreeMembers(remoteTree);
        }
      }

      const existingSite = await fetchPublishedMicrositeBySlug(defaultSlug);
      if (mounted && existingSite && existingSite.ownerId === userId) {
        setIsPublished(true);
        setPreviousPublishedSlug(existingSite.siteSlug);
        setSiteAccessMode(existingSite.siteAccessMode || 'PUBLIC');
        if (existingSite.themeId) setThemeId(existingSite.themeId);
        if (existingSite.familyEmblemTag)
          setEmblemTag(existingSite.familyEmblemTag);
        if (existingSite.bioTitle) setBioTitle(existingSite.bioTitle);
        if (existingSite.bioDescription)
          setBioDescription(existingSite.bioDescription);
        if (existingSite.privacyConfig) {
          setBioVisibility(existingSite.privacyConfig.bioVisibility || 'PUBLIC');
          setTreeVisibility(
            existingSite.privacyConfig.treeVisibility || 'PUBLIC'
          );
          setVaultVisibility(
            existingSite.privacyConfig.vaultVisibility || 'PUBLIC'
          );
          setFemaleDisplayPolicy(
            existingSite.privacyConfig.femaleDisplayPolicy || 'SHOW_ALL'
          );
          setHideLivingNamesForGuests(
            Boolean(existingSite.privacyConfig.hideLivingNamesForGuests)
          );
          setHideLivingBirthDates(
            Boolean(existingSite.privacyConfig.hideLivingBirthDates)
          );
          setStartRootPersonId(
            existingSite.privacyConfig.startRootPersonId || ''
          );
          setExcludedBranchRootIds(
            existingSite.privacyConfig.excludedBranchRootIds || []
          );
          setSelectedFolderIds(
            existingSite.privacyConfig.selectedFolderIds || []
          );
          setSelectedVaultItemIds(
            existingSite.privacyConfig.selectedVaultItemIds || []
          );
          setEnableDynamicWatermark(
            existingSite.privacyConfig.enableDynamicWatermark ?? true
          );
          setEnablePhotoFacePrompt(
            existingSite.privacyConfig.enablePhotoFacePrompt ?? true
          );
        }
        if (existingSite.cmsModules) {
          setCmsModules(existingSite.cmsModules);
        }
      }
    };

    loadSources();
    return () => {
      mounted = false;
    };
  }, [userId, userEmail, result.familyName, defaultSlug]);

  const contemporaryOnlyMembers = useMemo(
    () => rawTreeMembers.filter((m) => m && !m.isCertifiedReference),
    [rawTreeMembers]
  );

  const handleCheckSlug = async () => {
    setSlugStatus({ checking: true });
    const res = await checkPublicSiteSlugAvailability(siteSlug, userId || '');
    setSiteSlug(res.normalizedSlug || siteSlug);
    setSlugStatus({
      checking: false,
      available: res.available,
      message: res.reasonAr,
    });
  };

  const privacyConfigObject: PublicSitePrivacyConfig = useMemo(
    () => ({
      showBio: bioVisibility !== 'HIDDEN',
      bioVisibility,
      showFamilyTree: treeVisibility !== 'HIDDEN',
      treeVisibility,
      vaultVisibility,
      hideLivingNamesForGuests,
      hideLivingBirthDates,
      femaleDisplayPolicy,
      startRootPersonId: startRootPersonId || undefined,
      excludedBranchRootIds,
      selectedFolderIds,
      selectedVaultItemIds,
      enableDynamicWatermark,
      enablePhotoFacePrompt,
    }),
    [
      bioVisibility,
      treeVisibility,
      vaultVisibility,
      hideLivingNamesForGuests,
      hideLivingBirthDates,
      femaleDisplayPolicy,
      startRootPersonId,
      excludedBranchRootIds,
      selectedFolderIds,
      selectedVaultItemIds,
      enableDynamicWatermark,
      enablePhotoFacePrompt,
    ]
  );

  const handlePersistAndPublish = async (nextPublishState: boolean) => {
    setSaving(true);
    setFeedbackBanner(null);

    const normalizedSlug = normalizePublicSiteSlug(siteSlug);

    onSaveSiteSettings?.({
      siteSubdomain: normalizedSlug,
      publishLineagePublic: false,
      protectLivingMembers: hideLivingNamesForGuests,
      isPublished: nextPublishState,
      themeId,
      siteAccessMode,
      emblemTag,
      bioTitle,
      bioDescription,
      showBio: bioVisibility !== 'HIDDEN',
      showVerifiedLineage: false,
      showFamilyTree: treeVisibility !== 'HIDDEN',
      hideLivingNamesForGuests,
      hideLivingBirthDates,
      femaleDisplayPolicy,
      startRootPersonId: startRootPersonId || undefined,
      excludedBranchRootIds,
      selectedFolderIds,
      selectedVaultItemIds,
      enableDynamicWatermark,
      cmsModulesJson: JSON.stringify(cmsModules),
    });

    const outcome = await publishOrUpdatePublicMicrositeAtomically({
      siteSlug: normalizedSlug,
      previousSlug: previousPublishedSlug,
      ownerId: userId || 'usr_guest',
      ownerDisplayName: `${result.clientName} ${result.familyName}`.trim(),
      ownerEmail: userEmail,
      ownerReferralCode: buildDeterministicReferralCode(userId || 'usr_guest'),
      isPublished: nextPublishState,
      canPublishPublicSite: caps.canPublishPublicSite,
      emailVerified,
      siteAccessMode,
      themeId,
      familyEmblemTag: emblemTag,
      result,
      caps,
      bioTitle,
      bioDescription,
      privacyConfig: privacyConfigObject,
      rawTreeMembers,
      allVaultItems,
      cmsModules,
    });

    setSaving(false);

    if (outcome.ok) {
      setSiteSlug(outcome.normalizedSlug);
      if (outcome.code === 'PUBLISHED') {
        setIsPublished(true);
        setPreviousPublishedSlug(outcome.normalizedSlug);
      } else {
        setIsPublished(false);
      }
      setFeedbackBanner({ tone: 'success', text: outcome.messageAr });
      onLogActivity(
        outcome.code === 'PUBLISHED'
          ? 'نشر البوابة العائلية (موقعي)'
          : 'حفظ إعدادات بوابة موقعي',
        outcome.messageAr
      );
    } else {
      if (
        outcome.code === 'TIER_REQUIRED' ||
        outcome.code === 'EMAIL_UNVERIFIED'
      ) {
        setIsPublished(false);
        setFeedbackBanner({ tone: 'warning', text: outcome.messageAr });
      } else {
        setFeedbackBanner({ tone: 'error', text: outcome.messageAr });
      }
    }
  };

  // Live Preview Payload
  const livePreviewPayload: PublicMicrositeData = useMemo(() => {
    const cleanSlug = normalizePublicSiteSlug(siteSlug) || 'family-diwan';
    return {
      siteSlug: cleanSlug,
      ownerId: userId || 'preview_owner',
      ownerDisplayName: `${result.clientName} ${result.familyName}`.trim(),
      ownerReferralCode: buildDeterministicReferralCode(userId || 'preview'),
      isPublished: true,
      siteAccessMode,
      themeId,
      familyName: result.familyName,
      familyEmblemTag: emblemTag,
      originCountry: result.originCountry,
      originRegion: result.originRegion,
      isRegistrarCertified: caps.hasRegistrarBadge,
      membershipLabel: 'ديوان عائلي موثق — أمين سجل العائلة ✦',
      bioTitle: bioVisibility !== 'HIDDEN' ? bioTitle : undefined,
      bioDescription: bioVisibility !== 'HIDDEN' ? bioDescription : undefined,
      privacyConfig: privacyConfigObject,
      publishedTreeMembers:
        treeVisibility !== 'HIDDEN'
          ? sanitizeTreeMembersForPublicSite(rawTreeMembers, {
              familyName: result.familyName,
              hideLivingNamesForGuests,
              hideLivingBirthDates,
              femaleDisplayPolicy,
              startRootPersonId,
              excludedBranchRootIds,
              siteAccessMode,
            })
          : [],
      publishedVaultItems:
        vaultVisibility !== 'HIDDEN'
          ? projectSelectedVaultItemsForPublicSite(
              allVaultItems,
              selectedVaultItemIds,
              {
                selectedFolderIds,
                enableDynamicWatermark,
                siteSlug: cleanSlug,
              }
            )
          : [],
      treeMetrics: computeContemporaryTreeMetrics(
        rawTreeMembers,
        result.familyName
      ),
      cmsModules,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }, [
    siteSlug,
    userId,
    result,
    siteAccessMode,
    themeId,
    emblemTag,
    caps.hasRegistrarBadge,
    bioVisibility,
    bioTitle,
    bioDescription,
    privacyConfigObject,
    treeVisibility,
    rawTreeMembers,
    hideLivingNamesForGuests,
    hideLivingBirthDates,
    femaleDisplayPolicy,
    startRootPersonId,
    excludedBranchRootIds,
    vaultVisibility,
    allVaultItems,
    selectedVaultItemIds,
    selectedFolderIds,
    enableDynamicWatermark,
    cmsModules,
  ]);

  // =========================================================================
  // GATE 1: Non-VIP User -> Upgrade to Annual VIP first
  // =========================================================================
  if (!caps.isVip && !caps.hasRegistrarBadge) {
    return (
      <div className="rounded-2xl bg-white border border-[#B98A78]/45 p-6 sm:p-10 space-y-5">
        <div className="w-12 h-12 rounded-2xl bg-[#F7F2E9] border border-[#B98A78]/40 flex items-center justify-center">
          <Globe className="w-6 h-6 text-[#8D4925]" />
        </div>
        <div className="space-y-2 max-w-2xl">
          <div className="text-xs font-bold text-[#D8755B]">
            موقعي · نظام إدارة البوابات العائلية الفاخرة (Micro-CMS)
          </div>
          <h2 className="text-2xl font-display font-bold text-[#252321]">
            أنشئ بوابة رقمية رسمية لعائلة {result.familyName} برابط نظيف مستقل
          </h2>
          <p className="text-sm text-[#252321]/75 leading-relaxed">
            يتيح نظام «موقعي» لأمناء السجل بناء موقع عائلي تراثي فاخر بـ 5 قوالب ملكية معزولة، مرآة مفلترة لشجرة الأسرة المعاصرة، بطاقة دعوة بـ QR، و12 وحدة تفاعلية لصلة الرحم. للبدء، رقِّ حسابك إلى العضوية السنوية ثم وقّع ميثاق أمين السجل مجاناً.
          </p>
        </div>
        <button
          type="button"
          onClick={onUpgradeAnnualVip}
          className="px-6 py-3 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-sm font-display font-bold cursor-pointer transition-colors"
        >
          الترقية إلى الباقة السنوية (Premium) للبدء ←
        </button>
      </div>
    );
  }

  // =========================================================================
  // GATE 2: Annual VIP (`annual_vip`) not yet `registrar` -> Charter Signature
  // =========================================================================
  if (!caps.hasRegistrarBadge) {
    return (
      <div className="rounded-2xl bg-white border border-[#B98A78]/45 p-6 sm:p-10 space-y-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#252321] text-[#F7F2E9] flex items-center justify-center shrink-0">
            <FileSignature className="w-6 h-6 text-[#D8755B]" />
          </div>
          <div className="space-y-2 max-w-3xl">
            <div className="text-xs font-bold text-[#8D4925]">
              حوكمة السيادة العائلية · ميثاق أمين السجل الإلكتروني
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-[#252321]">
              إنشاء وإدارة ونشر «موقعي» حق سيادي حصري لحساب «أمين السجل»
            </h2>
            <p className="text-sm text-[#252321]/80 leading-relaxed">
              كونك مشتركاً في الباقة السنوية (Premium)، يمكنك الآن توقيع <strong>ميثاق أمين السجل الإلكتروني</strong> مجاناً دون أي رسوم إضافية لتفعيل صلاحية بناء المشجرة العائلية المفتوحة وامتلاك بوابة عائلية مستقلة بمعرّف رابط فريد خاص بك (<span dir="ltr" className="font-mono">Juthori.com/{defaultSlug}</span>)، حتى لو وُجدت بوابات أخرى تحمل نفس لقب العائلة.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl bg-[#F7F2E9] border border-[#B98A78]/35 p-4 space-y-1">
            <div className="text-xs font-display font-bold text-[#252321]">
              1. استقلال كامل بمعرّف فريد
            </div>
            <p className="text-xs text-[#252321]/70">
              لكل أمين سجل رابط نظيف مستقل ومرآة مفلترة خاضعة لإدارته الحصرية.
            </p>
          </div>
          <div className="rounded-xl bg-[#F7F2E9] border border-[#B98A78]/35 p-4 space-y-1">
            <div className="text-xs font-display font-bold text-[#252321]">
              2. عزل تام للسجلات الخاصة
            </div>
            <p className="text-xs text-[#252321]/70">
              يبقى عمود نسبك وشجرتك وخزانتك خاصة بك 100%، ولا يظهر في موقعك إلا ما تختاره.
            </p>
          </div>
          <div className="rounded-xl bg-[#F7F2E9] border border-[#B98A78]/35 p-4 space-y-1">
            <div className="text-xs font-display font-bold text-[#252321]">
              3. اعتماد طلبات الإثراء
            </div>
            <p className="text-xs text-[#252321]/70">
              استقبل مقترحات المواليد والصور من أقاربك وادمجها بضغطة زر واحدة.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={onSignCharterAndEnableTree}
            className="px-6 py-3 rounded-xl bg-[#252321] hover:bg-[#383430] text-[#F7F2E9] text-sm font-display font-bold inline-flex items-center gap-2 cursor-pointer transition-colors"
          >
            <FileSignature className="w-4 h-4 text-[#D8755B]" />
            <span>توقيع ميثاق أمين السجل وتفعيل استوديو «موقعي» الآن ✦</span>
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // FULL SOVEREIGN LUXURY FAMILY MICRO-CMS STUDIO (`registrar`)
  // =========================================================================
  return (
    <div className="space-y-6">
      {/* Studio Command Header */}
      <div className="rounded-2xl bg-white border border-[#B98A78]/40 p-6 sm:p-7 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#B98A78]/25 pb-5">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-[#D8755B] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>استوديو أمين السجل · إدارة البوابة العائلية والمرآة المفلترة</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-[#252321]">
              بوابة أسرة {result.familyName} الرقمية{' '}
              <span
                dir="ltr"
                className="text-sm font-mono text-[#8D4925] font-normal"
              >
                (Juthori.com/{siteSlug})
              </span>
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowRoyalQrModal(true)}
              className="px-4 py-2.5 rounded-xl bg-[#F7F2E9] hover:bg-[#EDE6DA] border border-[#B98A78]/50 text-[#252321] text-xs font-display font-bold inline-flex items-center gap-2 cursor-pointer transition-colors"
            >
              <QrCode className="w-4 h-4 text-[#8D4925]" />
              <span>بطاقة الدعوة ورمز QR الرسمي</span>
            </button>

            <button
              type="button"
              onClick={() => setShowLivePreview(true)}
              className="px-4 py-2.5 rounded-xl bg-[#F7F2E9] hover:bg-[#EDE6DA] border border-[#B98A78]/50 text-[#252321] text-xs font-display font-bold inline-flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Eye className="w-4 h-4 text-[#8D4925]" />
              <span>معاينة حية للبوابة</span>
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => handlePersistAndPublish(true)}
              className="px-5 py-2.5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-display font-bold inline-flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>
                {isPublished ? 'حفظ وتحديث البوابة المنشورة' : 'نشر البوابة رسمياً'}
              </span>
            </button>

            {isPublished && (
              <button
                type="button"
                disabled={saving}
                onClick={() => handlePersistAndPublish(false)}
                className="px-3.5 py-2.5 rounded-xl border border-[#B98A78]/50 text-xs font-semibold text-[#252321]/75 hover:bg-[#F7F2E9] cursor-pointer"
              >
                إيقاف النشر
              </button>
            )}
          </div>
        </div>

        {!emailVerified && (
          <div className="rounded-xl bg-amber-950/5 border border-amber-700/35 p-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[#252321]">
              يلزم توثيق بريدك الإلكتروني لتفعيل النشر الخارجي على الرابط النظيف <span dir="ltr" className="font-mono">Juthori.com/{siteSlug}</span>.
            </p>
            {onOpenEmailVerification && (
              <button
                type="button"
                onClick={onOpenEmailVerification}
                className="px-3.5 py-1.5 rounded-lg bg-[#8D4925] text-white text-xs font-bold cursor-pointer"
              >
                توثيق البريد الآن
              </button>
            )}
          </div>
        )}

        {feedbackBanner && (
          <div
            className={`rounded-xl p-3.5 text-xs font-semibold flex items-center gap-2 border ${
              feedbackBanner.tone === 'success'
                ? 'bg-emerald-950/5 border-emerald-700/35 text-emerald-900'
                : feedbackBanner.tone === 'warning'
                ? 'bg-amber-950/5 border-amber-700/35 text-amber-900'
                : 'bg-red-950/5 border-red-700/35 text-red-900'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedbackBanner.text}</span>
          </div>
        )}

        {/* Studio Sub-navigation */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {[
            {
              id: 'identity_theme' as StudioSectionTab,
              label: '1. الرابط والقوالب والهوية',
              icon: Palette,
            },
            {
              id: 'mirror_privacy' as StudioSectionTab,
              label: '2. مرآة الشجرة والخزانة والخصوصية',
              icon: GitBranch,
            },
            {
              id: 'editorial_modules' as StudioSectionTab,
              label: '3. الأخبار والمناسبات والقصص والأعلام',
              icon: Sparkles,
            },
            {
              id: 'heritage_community_modules' as StudioSectionTab,
              label: '4. الصوتيات والأطلس والوفاء والمجلس',
              icon: MessageSquare,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = studioTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStudioTab(tab.id)}
                className={`p-3 rounded-xl border text-right text-xs font-display font-bold flex items-center gap-2 transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#252321] text-[#F7F2E9] border-[#252321]'
                    : 'bg-[#F7F2E9]/70 text-[#252321] border-[#B98A78]/35 hover:bg-[#EDE6DA]'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    active ? 'text-[#D8755B]' : 'text-[#8D4925]'
                  }`}
                />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* =====================================================================
          TAB 1: CLEAN URL, SITE ACCESS MODE, 5 SCOPED THEMES & FAMILY BIO
         ===================================================================== */}
      {studioTab === 'identity_theme' && (
        <div className="space-y-6">
          {/* Clean Root URL & Site-Wide Access Mode */}
          <div className="rounded-2xl bg-white border border-[#B98A78]/40 p-6 space-y-5">
            <h3 className="text-base font-display font-bold text-[#252321]">
              الرابط النظيف وحالة الوصول العام للبوابة
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#252321]">
                  معرّف الرابط الرسمي النظيف (لا يتأثر بحالة الأحرف الكبيرة/الصغيرة):
                </label>
                <div className="flex items-center gap-2">
                  <div
                    dir="ltr"
                    className="flex-1 flex items-center rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 px-3 py-2 text-xs font-mono"
                  >
                    <span className="text-[#252321]/55">Juthori.com/</span>
                    <input
                      type="text"
                      value={siteSlug}
                      onChange={(e) => setSiteSlug(e.target.value)}
                      className="flex-1 bg-transparent text-[#252321] font-bold focus:outline-none"
                      placeholder="alrasheed"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleCheckSlug}
                    disabled={slugStatus.checking}
                    className="px-4 py-2 rounded-xl bg-[#252321] text-[#F7F2E9] text-xs font-display font-bold cursor-pointer shrink-0"
                  >
                    {slugStatus.checking ? 'فحص...' : 'تحقق من التوفر'}
                  </button>
                </div>
                {slugStatus.message && (
                  <p
                    className={`text-xs font-semibold ${
                      slugStatus.available ? 'text-emerald-800' : 'text-red-800'
                    }`}
                  >
                    {slugStatus.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#252321]">
                  نطاق فتح البوابة (مصفوفة الخصوصية العليا):
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSiteAccessMode('PUBLIC')}
                    className={`p-3 rounded-xl border text-right space-y-1 cursor-pointer ${
                      siteAccessMode === 'PUBLIC'
                        ? 'bg-[#252321] text-[#F7F2E9] border-[#252321]'
                        : 'bg-[#F7F2E9] text-[#252321] border-[#B98A78]/40'
                    }`}
                  >
                    <div className="text-xs font-display font-bold flex items-center gap-1.5">
                      <Unlock className="w-3.5 h-3.5 text-[#D8755B]" />
                      <span>عام (Public)</span>
                    </div>
                    <p className="text-[11px] opacity-80">
                      متاح للزوار مع بقاء الأقسام العائلية محصورة بدائرة «مجتمعي».
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSiteAccessMode('PRIVATE_WHITELIST')}
                    className={`p-3 rounded-xl border text-right space-y-1 cursor-pointer ${
                      siteAccessMode === 'PRIVATE_WHITELIST'
                        ? 'bg-[#252321] text-[#F7F2E9] border-[#252321]'
                        : 'bg-[#F7F2E9] text-[#252321] border-[#B98A78]/40'
                    }`}
                  >
                    <div className="text-xs font-display font-bold flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-[#D8755B]" />
                      <span>خاص ومغلق (Whitelist)</span>
                    </div>
                    <p className="text-[11px] opacity-80">
                      مقصور على دائرة «مجتمعي» مع شاشة استئذان أنيقة للزوار.
                    </p>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 5 Scoped Heritage Themes */}
          <div className="rounded-2xl bg-white border border-[#B98A78]/40 p-6 space-y-4">
            <div>
              <h3 className="text-base font-display font-bold text-[#252321]">
                القوالب اللونية التراثية الفاخرة (تُطبّق حصراً داخل موقع عائلتك)
              </h3>
              <p className="text-xs text-[#252321]/70">
                اختر الهوية اللونية لبوابة عائلتك من القوالب الخمسة المعتمدة (معزولة عبر Scoped CSS Variables دون أي أثر على لوحة التحكم)
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {FAMILY_SITE_THEMES.map((theme) => {
                const selected = themeId === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setThemeId(theme.id)}
                    className={`rounded-xl p-4 border text-right space-y-2.5 transition-all cursor-pointer ${
                      selected
                        ? 'border-[#D8755B] ring-2 ring-[#D8755B]/30 bg-[#F7F2E9]'
                        : 'border-[#B98A78]/35 bg-white hover:bg-[#F7F2E9]/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-5 h-5 rounded-full border border-black/15"
                          style={{ backgroundColor: theme.swatchHero }}
                        />
                        <span
                          className="w-5 h-5 rounded-full border border-black/15"
                          style={{ backgroundColor: theme.swatchAccent }}
                        />
                        <span
                          className="w-5 h-5 rounded-full border border-black/15"
                          style={{ backgroundColor: theme.swatchCanvas }}
                        />
                      </div>
                      {selected && (
                        <Check className="w-4 h-4 text-[#D8755B]" />
                      )}
                    </div>
                    <div className="text-xs font-display font-bold text-[#252321]">
                      {theme.nameAr}
                    </div>
                    <p className="text-[11px] text-[#252321]/70 leading-relaxed">
                      {theme.subtitleAr}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hero Emblem & Family Bio */}
          <div className="rounded-2xl bg-white border border-[#B98A78]/40 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-display font-bold text-[#252321]">
                واجهة الديوان، الوسم العائلي، والنبذة التعريفية
              </h3>
              <VisibilitySelector
                value={bioVisibility}
                onChange={setBioVisibility}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#252321] mb-1">
                  وسم / شعار الديوان العلوي:
                </label>
                <input
                  type="text"
                  value={emblemTag}
                  onChange={(e) => setEmblemTag(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#252321] mb-1">
                  عنوان البوابة الرئيسي:
                </label>
                <input
                  type="text"
                  value={bioTitle}
                  onChange={(e) => setBioTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#252321] mb-1">
                النبذة التعريفية للأسرة (معبأة مبدئياً من بياناتك وقابلة للتخصيص):
              </label>
              <textarea
                rows={4}
                value={bioDescription}
                onChange={(e) => setBioDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 text-xs leading-relaxed"
              />
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: FILTERED TREE MIRROR & VAULT MIRROR PRIVACY CONTROLS
         ===================================================================== */}
      {studioTab === 'mirror_privacy' && (
        <div className="space-y-6">
          {/* Commercial Paywall Protection Notice */}
          <div className="rounded-2xl bg-[#252321] text-[#F7F2E9] p-5 flex items-start gap-3.5">
            <ShieldCheck className="w-5 h-5 text-[#D8755B] shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs leading-relaxed">
              <div className="font-display font-bold text-sm">
                حماية مرجعية وتجارية تلقائية لعمود النسب والمصادر
              </div>
              <p className="text-[#F7F2E9]/80">
                يمنع النظام برمجياً تصدير أو إظهار طبقات عمود النسب الأعلى أو العقد المرجعية الموثقة أو أسماء الكتب في «موقعي»، ويعرض أعلى شجرتك المعاصرة تشويقاً رسمياً لزوارك: «{COMMERCIAL_LINEAGE_PAYWALL_TEASER_AR}».
              </p>
            </div>
          </div>

          {/* Contemporary Tree Mirror Customization */}
          <div className="rounded-2xl bg-white border border-[#B98A78]/40 p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#B98A78]/25 pb-4">
              <div>
                <h3 className="text-base font-display font-bold text-[#252321]">
                  تخصيص مرآة «شجرتي» المعاصرة ({contemporaryOnlyMembers.length} فرداً معاصراً متاحاً)
                </h3>
                <p className="text-xs text-[#252321]/70">
                  تُحذف تلقائياً أرقام التواصل والملاحظات البحثية الخاصة قبل أي عرض
                </p>
              </div>
              <VisibilitySelector
                value={treeVisibility}
                onChange={setTreeVisibility}
              />
            </div>

            {/* 4 Female Privacy Policies */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#252321]">
                سياسة عرض أسماء الإناث في مرآة الشجرة (4 خيارات):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {[
                  {
                    id: 'SHOW_ALL' as FemaleDisplayPolicy,
                    title: '1. إظهار كامل',
                    desc: 'عرض الأسماء بشكل اعتيادي في المرآة',
                  },
                  {
                    id: 'FAMILY_CIRCLE_ONLY' as FemaleDisplayPolicy,
                    title: '2. لدائرة العائلة فقط',
                    desc: 'الاسم للدائرة العائلية، و«كريمة فلان» للزوار',
                  },
                  {
                    id: 'SYMBOLIC_TITLE' as FemaleDisplayPolicy,
                    title: '3. لقب رمزي كريم',
                    desc: 'تُعرض بصيغة «كريمة فلان» لجميع الزوار',
                  },
                  {
                    id: 'HIDE_ALL' as FemaleDisplayPolicy,
                    title: '4. إخفاء تام',
                    desc: 'عدم تضمين بطاقات الإناث في المرآة المنشورة',
                  },
                ].map((pol) => (
                  <button
                    key={pol.id}
                    type="button"
                    onClick={() => setFemaleDisplayPolicy(pol.id)}
                    className={`p-3 rounded-xl border text-right space-y-1 cursor-pointer ${
                      femaleDisplayPolicy === pol.id
                        ? 'bg-[#252321] text-[#F7F2E9] border-[#252321]'
                        : 'bg-[#F7F2E9] text-[#252321] border-[#B98A78]/40'
                    }`}
                  >
                    <div className="text-xs font-display font-bold">
                      {pol.title}
                    </div>
                    <div className="text-[11px] opacity-80">{pol.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Living Privacy Switches */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center gap-3 p-3.5 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/35 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hideLivingNamesForGuests}
                  onChange={(e) =>
                    setHideLivingNamesForGuests(e.target.checked)
                  }
                  className="w-4 h-4 accent-[#8D4925]"
                />
                <div className="text-xs">
                  <div className="font-bold text-[#252321]">
                    إخفاء أسماء الأحياء عن الزوار غير المسجلين
                  </div>
                  <div className="text-[#252321]/65">
                    يُستبدل اسم الحي بوسم «فرد على قيد الحياة (محمي)»
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3.5 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/35 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hideLivingBirthDates}
                  onChange={(e) => setHideLivingBirthDates(e.target.checked)}
                  className="w-4 h-4 accent-[#8D4925]"
                />
                <div className="text-xs">
                  <div className="font-bold text-[#252321]">
                    إخفاء تواريخ ميلاد الأحياء
                  </div>
                  <div className="text-[#252321]/65">
                    حجب سنة وتاريخ الميلاد للأفراد الأحياء في المرآة
                  </div>
                </div>
              </label>
            </div>

            {/* Start Root Node & Excluded Branches */}
            {contemporaryOnlyMembers.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2 border-t border-[#B98A78]/25">
                <div>
                  <label className="block text-xs font-bold text-[#252321] mb-1.5">
                    نقطة بداية عرض الشجرة في الموقع (اختياري):
                  </label>
                  <select
                    value={startRootPersonId}
                    onChange={(e) => setStartRootPersonId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 text-xs"
                  >
                    <option value="">
                      عرض جميع الفروع المعاصرة في شجرتي بالكامل
                    </option>
                    {contemporaryOnlyMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        بدء العرض من: {m.firstName} {m.familyName || result.familyName} وذريته فقط
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#252321] mb-1.5">
                    استثناء فروع محددة وذريتها من الظهور ({excludedBranchRootIds.length} مستثنى):
                  </label>
                  <div className="max-h-32 overflow-y-auto rounded-xl bg-[#F7F2E9] border border-[#B98A78]/40 p-2.5 space-y-1.5">
                    {contemporaryOnlyMembers.map((m) => {
                      const checked = excludedBranchRootIds.includes(m.id);
                      return (
                        <label
                          key={m.id}
                          className="flex items-center gap-2 text-xs cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setExcludedBranchRootIds((prev) =>
                                checked
                                  ? prev.filter((id) => id !== m.id)
                                  : [...prev, m.id]
                              )
                            }
                            className="accent-[#8D4925]"
                          />
                          <span>
                            {m.firstName} {m.familyName || result.familyName} (الجيل{' '}
                            {m.generationLevel ?? 1})
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Vault Mirror Customization */}
          <div className="rounded-2xl bg-white border border-[#B98A78]/40 p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#B98A78]/25 pb-4">
              <div>
                <h3 className="text-base font-display font-bold text-[#252321] flex items-center gap-2">
                  <Camera className="w-4 h-4 text-[#8D4925]" />
                  <span>تخصيص مرآة «خزانتي» والعلامة المائية التلقائية</span>
                </h3>
                <p className="text-xs text-[#252321]/70">
                  اختر مجلدات كاملة أو مقتنيات مفردة لعرضها في معرض بوابة الأسرة
                </p>
              </div>
              <VisibilitySelector
                value={vaultVisibility}
                onChange={setVaultVisibility}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center gap-3 p-3.5 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/35 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableDynamicWatermark}
                  onChange={(e) => setEnableDynamicWatermark(e.target.checked)}
                  className="w-4 h-4 accent-[#8D4925]"
                />
                <div className="text-xs">
                  <div className="font-bold text-[#252321]">
                    تفعيل العلامة المائية التلقائية (Juthori.com/{siteSlug})
                  </div>
                  <div className="text-[#252321]/65">
                    ختم أنيق يحفظ حقوق الصور العائلية التراثية عند العرض
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3.5 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/35 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enablePhotoFacePrompt}
                  onChange={(e) => setEnablePhotoFacePrompt(e.target.checked)}
                  className="w-4 h-4 accent-[#8D4925]"
                />
                <div className="text-xs">
                  <div className="font-bold text-[#252321]">
                    تفعيل تفاعل «أتعرف من في الصورة؟»
                  </div>
                  <div className="text-[#252321]/65">
                    يتيح للأقارب المساهمة بالتعريف بأصحاب الصور القديمة
                  </div>
                </div>
              </label>
            </div>

            {/* Select Whole Folders */}
            {vaultFolders.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-bold text-[#252321] flex items-center gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5 text-[#8D4925]" />
                  <span>نشر مجلدات كاملة من خزانتي:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {vaultFolders.map((folder) => {
                    const checked = selectedFolderIds.includes(folder.id);
                    return (
                      <button
                        key={folder.id}
                        type="button"
                        onClick={() =>
                          setSelectedFolderIds((prev) =>
                            checked
                              ? prev.filter((f) => f !== folder.id)
                              : [...prev, folder.id]
                          )
                        }
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer ${
                          checked
                            ? 'bg-[#252321] text-[#F7F2E9] border-[#252321]'
                            : 'bg-[#F7F2E9] text-[#252321] border-[#B98A78]/40'
                        }`}
                      >
                        {checked ? '✓ ' : '+ '}
                        {folder.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Select Individual Vault Items */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-[#252321]">
                أو اختيار صور ووثائق مفردة ({selectedVaultItemIds.length} مختارة):
              </div>
              {allVaultItems.length === 0 ? (
                <p className="text-xs text-[#252321]/60 bg-[#F7F2E9] rounded-xl p-4">
                  لا توجد مقتنيات مضافة بعد في تبويب «خزانتي». أي صورة ترفعها هناك ستظهر هنا لتختار ما ترغب بعرضه.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {allVaultItems.map((item) => {
                    const selected = selectedVaultItemIds.includes(item.id);
                    return (
                      <label
                        key={item.id}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs cursor-pointer ${
                          selected
                            ? 'bg-[#F7F2E9] border-[#D8755B]'
                            : 'bg-white border-[#B98A78]/35'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() =>
                            setSelectedVaultItemIds((prev) =>
                              selected
                                ? prev.filter((x) => x !== item.id)
                                : [...prev, item.id]
                            )
                          }
                          className="accent-[#8D4925]"
                        />
                        <span className="truncate font-semibold text-[#252321]">
                          {item.title}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: EDITORIAL MODULES (NEWS, EVENTS, STORIES, NOTABLES)
         ===================================================================== */}
      {studioTab === 'editorial_modules' && (
        <div className="space-y-6">
          {/* Module: Family News & Blessings */}
          <div className="rounded-2xl bg-white border border-[#B98A78]/40 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#B98A78]/25 pb-3">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cmsModules.newsModule.enabled}
                  onChange={(e) =>
                    setCmsModules((prev) => ({
                      ...prev,
                      newsModule: {
                        ...prev.newsModule,
                        enabled: e.target.checked,
                      },
                    }))
                  }
                  className="w-4 h-4 accent-[#8D4925]"
                />
                <span className="text-base font-display font-bold text-[#252321]">
                  ديوان أخبار الأسرة وسجل التبريكات التفاعلي («بارك له»)
                </span>
              </label>
              <VisibilitySelector
                value={cmsModules.newsModule.visibility}
                onChange={(vis) =>
                  setCmsModules((prev) => ({
                    ...prev,
                    newsModule: { ...prev.newsModule, visibility: vis },
                  }))
                }
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <select
                value={newNewsCategory}
                onChange={(e) =>
                  setNewNewsCategory(
                    e.target.value as typeof newNewsCategory
                  )
                }
                className="px-3 py-2 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 text-xs"
              >
                <option value="مولود جديد">مولود جديد</option>
                <option value="عقد قران وزواج">عقد قران وزواج</option>
                <option value="تخرج وإنجاز علمي">تخرج وإنجاز علمي</option>
                <option value="ترقية وتكريم">ترقية وتكريم</option>
                <option value="خبر عائلي">خبر عائلي</option>
              </select>
              <input
                type="text"
                value={newNewsTitle}
                onChange={(e) => setNewNewsTitle(e.target.value)}
                placeholder="عنوان الخبر أو البشارة..."
                className="px-3 py-2 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 text-xs"
              />
              <input
                type="text"
                value={newNewsSummary}
                onChange={(e) => setNewNewsSummary(e.target.value)}
                placeholder="تفاصيل مختصرة..."
                className="px-3 py-2 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newNewsTitle.trim()) return;
                  setCmsModules((prev) => ({
                    ...prev,
                    newsModule: {
                      ...prev.newsModule,
                      items: [
                        {
                          id: `news_${Date.now()}`,
                          category: newNewsCategory,
                          title: newNewsTitle.trim(),
                          summary: newNewsSummary.trim(),
                          dateLabel: new Date().toLocaleDateString('ar-SA'),
                          blessings: [],
                        },
                        ...prev.newsModule.items,
                      ],
                    },
                  }));
                  setNewNewsTitle('');
                  setNewNewsSummary('');
                }}
                className="px-4 py-2 rounded-xl bg-[#252321] text-white text-xs font-display font-bold inline-flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة خبر</span>
              </button>
            </div>

            <div className="space-y-2">
              {cmsModules.newsModule.items.map((n) => (
                <div
                  key={n.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-[#F7F2E9] text-xs"
                >
                  <div>
                    <strong className="text-[#8D4925]">{n.category}: </strong>
                    <span className="font-bold">{n.title}</span> — {n.summary} (
                    {(n.blessings || []).length} تهنئة)
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setCmsModules((prev) => ({
                        ...prev,
                        newsModule: {
                          ...prev.newsModule,
                          items: prev.newsModule.items.filter(
                            (x) => x.id !== n.id
                          ),
                        },
                      }))
                    }
                    className="text-red-700 hover:text-red-900 p-1 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Module: Upcoming Events + RSVP */}
          <div className="rounded-2xl bg-white border border-[#B98A78]/40 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#B98A78]/25 pb-3">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cmsModules.eventsModule.enabled}
                  onChange={(e) =>
                    setCmsModules((prev) => ({
                      ...prev,
                      eventsModule: {
                        ...prev.eventsModule,
                        enabled: e.target.checked,
                      },
                    }))
                  }
                  className="w-4 h-4 accent-[#8D4925]"
                />
                <span className="text-base font-display font-bold text-[#252321] flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#8D4925]" />
                  <span>المناسبات القادمة مع العداد التنازلي وتأكيد الحضور (RSVP)</span>
                </span>
              </label>
              <VisibilitySelector
                value={cmsModules.eventsModule.visibility}
                onChange={(vis) =>
                  setCmsModules((prev) => ({
                    ...prev,
                    eventsModule: { ...prev.eventsModule, visibility: vis },
                  }))
                }
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <input
                type="text"
                value={newEventTitle}
                onChange={(e) => setNewEventTitle(e.target.value)}
                placeholder="اسم المناسبة / الملتقى السنوي..."
                className="px-3 py-2 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 text-xs"
              />
              <input
                type="date"
                value={newEventDate}
                onChange={(e) => setNewEventDate(e.target.value)}
                className="px-3 py-2 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 text-xs"
              />
              <input
                type="text"
                value={newEventLocation}
                onChange={(e) => setNewEventLocation(e.target.value)}
                placeholder="المدينة / القاعة..."
                className="px-3 py-2 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newEventTitle.trim() || !newEventDate) return;
                  setCmsModules((prev) => ({
                    ...prev,
                    eventsModule: {
                      ...prev.eventsModule,
                      items: [
                        ...prev.eventsModule.items,
                        {
                          id: `ev_${Date.now()}`,
                          title: newEventTitle.trim(),
                          eventDateIso: newEventDate,
                          locationLabel: newEventLocation.trim() || 'ديوان الأسرة',
                          rsvps: [],
                        },
                      ],
                    },
                  }));
                  setNewEventTitle('');
                  setNewEventDate('');
                  setNewEventLocation('');
                }}
                className="px-4 py-2 rounded-xl bg-[#252321] text-white text-xs font-display font-bold inline-flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة مناسبة</span>
              </button>
            </div>

            <div className="space-y-2">
              {cmsModules.eventsModule.items.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-[#F7F2E9] text-xs"
                >
                  <div>
                    <strong>{ev.title}</strong> · {ev.eventDateIso} ·{' '}
                    {ev.locationLabel} ({(ev.rsvps || []).length} رد حضور)
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setCmsModules((prev) => ({
                        ...prev,
                        eventsModule: {
                          ...prev.eventsModule,
                          items: prev.eventsModule.items.filter(
                            (x) => x.id !== ev.id
                          ),
                        },
                      }))
                    }
                    className="text-red-700 p-1 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Module: Stories & «حدث في مثل هذا الشهر» */}
          <div className="rounded-2xl bg-white border border-[#B98A78]/40 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#B98A78]/25 pb-3">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cmsModules.storiesModule.enabled}
                  onChange={(e) =>
                    setCmsModules((prev) => ({
                      ...prev,
                      storiesModule: {
                        ...prev.storiesModule,
                        enabled: e.target.checked,
                      },
                    }))
                  }
                  className="w-4 h-4 accent-[#8D4925]"
                />
                <span className="text-base font-display font-bold text-[#252321] flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-[#8D4925]" />
                  <span>قصص الأجداد + شريط «حدث في مثل هذا الشهر» التلقائي</span>
                </span>
              </label>
              <VisibilitySelector
                value={cmsModules.storiesModule.visibility}
                onChange={(vis) =>
                  setCmsModules((prev) => ({
                    ...prev,
                    storiesModule: { ...prev.storiesModule, visibility: vis },
                  }))
                }
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="text"
                value={newStoryTitle}
                onChange={(e) => setNewStoryTitle(e.target.value)}
                placeholder="عنوان القصة أو الحدث التاريخي..."
                className="px-3 py-2 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 text-xs"
              />
              <input
                type="text"
                value={newStoryEra}
                onChange={(e) => setNewStoryEra(e.target.value)}
                placeholder="الحقبة / العام (مثال: 1380هـ)"
                className="px-3 py-2 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 text-xs"
              />
              <select
                value={newStoryMonth}
                onChange={(e) => setNewStoryMonth(Number(e.target.value))}
                className="px-3 py-2 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 text-xs"
              >
                {Array.from({ length: 12 }, (_, idx) => idx + 1).map((m) => (
                  <option key={m} value={m}>
                    شهر الحدث لـ «حدث في مثل هذا الشهر»: شهر {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <textarea
                rows={2}
                value={newStoryBody}
                onChange={(e) => setNewStoryBody(e.target.value)}
                placeholder="نص القصة أو الموقف المأثور..."
                className="flex-1 px-3 py-2 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newStoryTitle.trim() || !newStoryBody.trim()) return;
                  setCmsModules((prev) => ({
                    ...prev,
                    storiesModule: {
                      ...prev.storiesModule,
                      items: [
                        {
                          id: `st_${Date.now()}`,
                          title: newStoryTitle.trim(),
                          body: newStoryBody.trim(),
                          eraOrYearLabel: newStoryEra.trim() || 'من ذاكرة الأسرة',
                          historicalMonth: newStoryMonth,
                        },
                        ...prev.storiesModule.items,
                      ],
                    },
                  }));
                  setNewStoryTitle('');
                  setNewStoryEra('');
                  setNewStoryBody('');
                }}
                className="px-4 py-2 rounded-xl bg-[#252321] text-white text-xs font-display font-bold cursor-pointer shrink-0"
              >
                إضافة قصة
              </button>
            </div>

            <div className="space-y-2">
              {cmsModules.storiesModule.items.map((st) => (
                <div
                  key={st.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-[#F7F2E9] text-xs"
                >
                  <div>
                    <strong>{st.title}</strong> ({st.eraOrYearLabel} · شهر{' '}
                    {st.historicalMonth || '-'})
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setCmsModules((prev) => ({
                        ...prev,
                        storiesModule: {
                          ...prev.storiesModule,
                          items: prev.storiesModule.items.filter(
                            (x) => x.id !== st.id
                          ),
                        },
                      }))
                    }
                    className="text-red-700 p-1 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Module: Honor Roll & Family Notables */}
          <div className="rounded-2xl bg-white border border-[#B98A78]/40 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#B98A78]/25 pb-3">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cmsModules.notablesModule.enabled}
                  onChange={(e) =>
                    setCmsModules((prev) => ({
                      ...prev,
                      notablesModule: {
                        ...prev.notablesModule,
                        enabled: e.target.checked,
                      },
                    }))
                  }
                  className="w-4 h-4 accent-[#8D4925]"
                />
                <span className="text-base font-display font-bold text-[#252321] flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-[#8D4925]" />
                  <span>لوحة الشرف وأعلام ورموز الأسرة</span>
                </span>
              </label>
              <VisibilitySelector
                value={cmsModules.notablesModule.visibility}
                onChange={(vis) =>
                  setCmsModules((prev) => ({
                    ...prev,
                    notablesModule: { ...prev.notablesModule, visibility: vis },
                  }))
                }
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <input
                type="text"
                value={newNotableName}
                onChange={(e) => setNewNotableName(e.target.value)}
                placeholder="اسم العلم / الشخصية..."
                className="px-3 py-2 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 text-xs"
              />
              <input
                type="text"
                value={newNotableRole}
                onChange={(e) => setNewNotableRole(e.target.value)}
                placeholder="المكانة أو الإنجاز..."
                className="px-3 py-2 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 text-xs"
              />
              <input
                type="text"
                value={newNotableBio}
                onChange={(e) => setNewNotableBio(e.target.value)}
                placeholder="نبذة مختصرة..."
                className="px-3 py-2 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newNotableName.trim()) return;
                  setCmsModules((prev) => ({
                    ...prev,
                    notablesModule: {
                      ...prev.notablesModule,
                      items: [
                        ...prev.notablesModule.items,
                        {
                          id: `not_${Date.now()}`,
                          fullName: newNotableName.trim(),
                          roleOrTitle: newNotableRole.trim() || 'من رموز الأسرة',
                          eraLabel: 'سجل الشرف',
                          achievementSummary: newNotableBio.trim(),
                        },
                      ],
                    },
                  }));
                  setNewNotableName('');
                  setNewNotableRole('');
                  setNewNotableBio('');
                }}
                className="px-4 py-2 rounded-xl bg-[#252321] text-white text-xs font-display font-bold cursor-pointer"
              >
                إضافة للوحة الشرف
              </button>
            </div>

            <div className="space-y-2">
              {cmsModules.notablesModule.items.map((notable) => (
                <div
                  key={notable.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-[#F7F2E9] text-xs"
                >
                  <div>
                    <strong>{notable.fullName}</strong> ({notable.roleOrTitle}) —{' '}
                    {notable.achievementSummary}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setCmsModules((prev) => ({
                        ...prev,
                        notablesModule: {
                          ...prev.notablesModule,
                          items: prev.notablesModule.items.filter(
                            (x) => x.id !== notable.id
                          ),
                        },
                      }))
                    }
                    className="text-red-700 p-1 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 4: ORAL HERITAGE, ATLAS & STATS, PROFESSIONS, MEMORIAL/CAPSULE, MAJLIS
         ===================================================================== */}
      {studioTab === 'heritage_community_modules' && (
        <div className="space-y-6">
          {/* 8. Oral Heritage («أصوات خالدة») */}
          <div className="rounded-2xl bg-white border border-[#B98A78]/40 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#B98A78]/25 pb-3">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cmsModules.oralHeritageModule.enabled}
                  onChange={(e) =>
                    setCmsModules((prev) => ({
                      ...prev,
                      oralHeritageModule: {
                        ...prev.oralHeritageModule,
                        enabled: e.target.checked,
                      },
                    }))
                  }
                  className="w-4 h-4 accent-[#8D4925]"
                />
                <span className="text-base font-display font-bold text-[#252321] flex items-center gap-1.5">
                  <Mic className="w-4 h-4 text-[#8D4925]" />
                  <span>ركن الموروث الشفهي («أصوات خالدة»)</span>
                </span>
              </label>
              <VisibilitySelector
                value={cmsModules.oralHeritageModule.visibility}
                onChange={(vis) =>
                  setCmsModules((prev) => ({
                    ...prev,
                    oralHeritageModule: {
                      ...prev.oralHeritageModule,
                      visibility: vis,
                    },
                  }))
                }
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <input
                type="text"
                value={newAudioTitle}
                onChange={(e) => setNewAudioTitle(e.target.value)}
                placeholder="عنوان التسجيل..."
                className="px-3 py-2 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 text-xs"
              />
              <input
                type="text"
                value={newAudioSpeaker}
                onChange={(e) => setNewAudioSpeaker(e.target.value)}
                placeholder="اسم المتحدث من كبار الأسرة..."
                className="px-3 py-2 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 text-xs"
              />
              <input
                type="text"
                value={newAudioYear}
                onChange={(e) => setNewAudioYear(e.target.value)}
                placeholder="عام التسجيل (مثال: 1418هـ)"
                className="px-3 py-2 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 text-xs"
              />
              <input
                type="url"
                dir="ltr"
                value={newAudioUrl}
                onChange={(e) => setNewAudioUrl(e.target.value)}
                placeholder="رابط ملف صوتي MP3 (اختياري)"
                className="px-3 py-2 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 text-xs"
              />
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newAudioExcerpt}
                onChange={(e) => setNewAudioExcerpt(e.target.value)}
                placeholder="مقتطف نصي من الحديث أو القصيدة..."
                className="flex-1 px-3 py-2 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newAudioTitle.trim() || !newAudioSpeaker.trim()) return;
                  setCmsModules((prev) => ({
                    ...prev,
                    oralHeritageModule: {
                      ...prev.oralHeritageModule,
                      items: [
                        ...prev.oralHeritageModule.items,
                        {
                          id: `aud_${Date.now()}`,
                          title: newAudioTitle.trim(),
                          speakerName: newAudioSpeaker.trim(),
                          recordedYearLabel: newAudioYear.trim() || 'أرشيف الأسرة',
                          audioDataOrUrl: newAudioUrl.trim() || undefined,
                          transcriptExcerpt:
                            newAudioExcerpt.trim() || newAudioTitle.trim(),
                        },
                      ],
                    },
                  }));
                  setNewAudioTitle('');
                  setNewAudioSpeaker('');
                  setNewAudioYear('');
                  setNewAudioUrl('');
                  setNewAudioExcerpt('');
                }}
                className="px-4 py-2 rounded-xl bg-[#252321] text-white text-xs font-display font-bold cursor-pointer"
              >
                إضافة مقطع
              </button>
            </div>

            {cmsModules.oralHeritageModule.items.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between p-3 rounded-xl bg-[#F7F2E9] text-xs"
              >
                <span>
                  <strong>{c.title}</strong> — بصوت: {c.speakerName}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setCmsModules((prev) => ({
                      ...prev,
                      oralHeritageModule: {
                        ...prev.oralHeritageModule,
                        items: prev.oralHeritageModule.items.filter(
                          (x) => x.id !== c.id
                        ),
                      },
                    }))
                  }
                  className="text-red-700 p-1 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* 9. Geographic Atlas («ديارنا حول العالم») + «أرقام من شجرتنا» */}
          <div className="rounded-2xl bg-white border border-[#B98A78]/40 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#B98A78]/25 pb-3">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cmsModules.atlasAndStatsModule.enabled}
                  onChange={(e) =>
                    setCmsModules((prev) => ({
                      ...prev,
                      atlasAndStatsModule: {
                        ...prev.atlasAndStatsModule,
                        enabled: e.target.checked,
                      },
                    }))
                  }
                  className="w-4 h-4 accent-[#8D4925]"
                />
                <span className="text-base font-display font-bold text-[#252321]">
                  أطلس الانتشار («ديارنا حول العالم») + إحصاءات «أرقام من شجرتنا»
                </span>
              </label>
              <VisibilitySelector
                value={cmsModules.atlasAndStatsModule.visibility}
                onChange={(vis) =>
                  setCmsModules((prev) => ({
                    ...prev,
                    atlasAndStatsModule: {
                      ...prev.atlasAndStatsModule,
                      visibility: vis,
                    },
                  }))
                }
              />
            </div>

            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={cmsModules.atlasAndStatsModule.showAutoTreeNumbers}
                onChange={(e) =>
                  setCmsModules((prev) => ({
                    ...prev,
                    atlasAndStatsModule: {
                      ...prev.atlasAndStatsModule,
                      showAutoTreeNumbers: e.target.checked,
                    },
                  }))
                }
                className="accent-[#8D4925]"
              />
              <span>
                إظهار بطاقة «أرقام من شجرتنا» المحسوبة تلقائياً من الفروع المعاصرة (عدد الأجيال، أكثر الأسماء تكراراً، أكبر الفروع)
              </span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <input
                type="text"
                value={newLocCountry}
                onChange={(e) => setNewLocCountry(e.target.value)}
                placeholder="الدولة..."
                className="px-3 py-2 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 text-xs"
              />
              <input
                type="text"
                value={newLocCity}
                onChange={(e) => setNewLocCity(e.target.value)}
                placeholder="المدينة فقط (دون عناوين تفصيلية)..."
                className="px-3 py-2 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 text-xs"
              />
              <input
                type="number"
                min={1}
                value={newLocCount}
                onChange={(e) => setNewLocCount(Number(e.target.value || 1))}
                placeholder="العداد التقريبي"
                className="px-3 py-2 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newLocCity.trim()) return;
                  setCmsModules((prev) => ({
                    ...prev,
                    atlasAndStatsModule: {
                      ...prev.atlasAndStatsModule,
                      locations: [
                        ...prev.atlasAndStatsModule.locations,
                        {
                          id: `loc_${Date.now()}`,
                          country: newLocCountry.trim(),
                          city: newLocCity.trim(),
                          householdsOrMembersCount: Math.max(1, newLocCount),
                        },
                      ],
                    },
                  }));
                  setNewLocCity('');
                }}
                className="px-4 py-2 rounded-xl bg-[#252321] text-white text-xs font-display font-bold cursor-pointer"
              >
                إضافة مدينة
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {cmsModules.atlasAndStatsModule.locations.map((loc) => (
                <span
                  key={loc.id}
                  className="px-3 py-1.5 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/35 text-xs inline-flex items-center gap-2"
                >
                  <span>
                    {loc.city}، {loc.country} ({loc.householdsOrMembersCount})
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setCmsModules((prev) => ({
                        ...prev,
                        atlasAndStatsModule: {
                          ...prev.atlasAndStatsModule,
                          locations:
                            prev.atlasAndStatsModule.locations.filter(
                              (x) => x.id !== loc.id
                            ),
                        },
                      }))
                    }
                    className="text-red-700 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* 10. Professions Directory («شبكة أبناء العمومة») */}
          <div className="rounded-2xl bg-white border border-[#B98A78]/40 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#B98A78]/25 pb-3">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cmsModules.professionsModule.enabled}
                  onChange={(e) =>
                    setCmsModules((prev) => ({
                      ...prev,
                      professionsModule: {
                        ...prev.professionsModule,
                        enabled: e.target.checked,
                      },
                    }))
                  }
                  className="w-4 h-4 accent-[#8D4925]"
                />
                <span className="text-base font-display font-bold text-[#252321] flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-[#8D4925]" />
                  <span>دليل مهن وكفاءات الأسرة («شبكة أبناء العمومة»)</span>
                </span>
              </label>
              <VisibilitySelector
                value={cmsModules.professionsModule.visibility}
                onChange={(vis) =>
                  setCmsModules((prev) => ({
                    ...prev,
                    professionsModule: {
                      ...prev.professionsModule,
                      visibility: vis,
                    },
                  }))
                }
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
              <input
                type="text"
                value={newProfName}
                onChange={(e) => setNewProfName(e.target.value)}
                placeholder="الاسم الكريم..."
                className="px-3 py-2 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 text-xs"
              />
              <input
                type="text"
                value={newProfCategory}
                onChange={(e) => setNewProfCategory(e.target.value)}
                placeholder="المجال (طب، هندسة، قانون...)"
                className="px-3 py-2 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 text-xs"
              />
              <input
                type="text"
                value={newProfSpecialty}
                onChange={(e) => setNewProfSpecialty(e.target.value)}
                placeholder="التخصص الدقيق / المهنة..."
                className="px-3 py-2 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 text-xs"
              />
              <input
                type="text"
                value={newProfCity}
                onChange={(e) => setNewProfCity(e.target.value)}
                placeholder="المدينة..."
                className="px-3 py-2 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newProfName.trim() || !newProfSpecialty.trim()) return;
                  setCmsModules((prev) => ({
                    ...prev,
                    professionsModule: {
                      ...prev.professionsModule,
                      items: [
                        ...prev.professionsModule.items,
                        {
                          id: `prof_${Date.now()}`,
                          memberName: newProfName.trim(),
                          fieldCategory: newProfCategory.trim(),
                          specialtyOrProfession: newProfSpecialty.trim(),
                          cityCountryLabel: newProfCity.trim(),
                        },
                      ],
                    },
                  }));
                  setNewProfName('');
                  setNewProfSpecialty('');
                  setNewProfCity('');
                }}
                className="px-4 py-2 rounded-xl bg-[#252321] text-white text-xs font-display font-bold cursor-pointer"
              >
                إضافة كفاءة
              </button>
            </div>

            {cmsModules.professionsModule.items.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-3 rounded-xl bg-[#F7F2E9] text-xs"
              >
                <span>
                  <strong>{p.memberName}</strong> — {p.specialtyOrProfession} (
                  {p.fieldCategory})
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setCmsModules((prev) => ({
                      ...prev,
                      professionsModule: {
                        ...prev.professionsModule,
                        items: prev.professionsModule.items.filter(
                          (x) => x.id !== p.id
                        ),
                      },
                    }))
                  }
                  className="text-red-700 p-1 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* 11. Memorial Shrine & Time Capsule */}
          <div className="rounded-2xl bg-white border border-[#B98A78]/40 p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#B98A78]/25 pb-3">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cmsModules.memorialAndCapsuleModule.enabled}
                  onChange={(e) =>
                    setCmsModules((prev) => ({
                      ...prev,
                      memorialAndCapsuleModule: {
                        ...prev.memorialAndCapsuleModule,
                        enabled: e.target.checked,
                      },
                    }))
                  }
                  className="w-4 h-4 accent-[#8D4925]"
                />
                <span className="text-base font-display font-bold text-[#252321] flex items-center gap-1.5">
                  <Heart className="w-4 h-4 text-[#8D4925]" />
                  <span>ركن الوفاء («راحلون في القلب») + كبسولة الزمن العائلية</span>
                </span>
              </label>
              <VisibilitySelector
                value={cmsModules.memorialAndCapsuleModule.visibility}
                onChange={(vis) =>
                  setCmsModules((prev) => ({
                    ...prev,
                    memorialAndCapsuleModule: {
                      ...prev.memorialAndCapsuleModule,
                      visibility: vis,
                    },
                  }))
                }
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <input
                type="text"
                value={newElderName}
                onChange={(e) => setNewElderName(e.target.value)}
                placeholder="اسم الفقيد الكبير..."
                className="px-3 py-2 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 text-xs"
              />
              <input
                type="text"
                value={newElderYear}
                onChange={(e) => setNewElderYear(e.target.value)}
                placeholder="عام الوفاة..."
                className="px-3 py-2 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 text-xs"
              />
              <input
                type="text"
                value={newElderBio}
                onChange={(e) => setNewElderBio(e.target.value)}
                placeholder="مآثره وسيرته العطرة..."
                className="px-3 py-2 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 text-xs"
              />
              <input
                type="text"
                value={newElderCharity}
                onChange={(e) => setNewElderCharity(e.target.value)}
                placeholder="وقف أو صدقة جارية عنه (اختياري)"
                className="px-3 py-2 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 text-xs"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                if (!newElderName.trim()) return;
                setCmsModules((prev) => ({
                  ...prev,
                  memorialAndCapsuleModule: {
                    ...prev.memorialAndCapsuleModule,
                    elders: [
                      ...prev.memorialAndCapsuleModule.elders,
                      {
                        id: `eld_${Date.now()}`,
                        fullName: newElderName.trim(),
                        passingYearLabel: newElderYear.trim(),
                        biographyNote: newElderBio.trim(),
                        ongoingCharityTitle: newElderCharity.trim() || undefined,
                        prayersCount: 0,
                      },
                    ],
                  },
                }));
                setNewElderName('');
                setNewElderYear('');
                setNewElderBio('');
                setNewElderCharity('');
              }}
              className="px-4 py-2 rounded-xl bg-[#252321] text-white text-xs font-display font-bold cursor-pointer"
            >
              إضافة لركن الوفاء
            </button>

            {cmsModules.memorialAndCapsuleModule.elders.map((el) => (
              <div
                key={el.id}
                className="flex items-center justify-between p-3 rounded-xl bg-[#F7F2E9] text-xs"
              >
                <span>
                  <strong>{el.fullName}</strong> — رحمه الله ({el.prayersCount}{' '}
                  دعوة)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setCmsModules((prev) => ({
                      ...prev,
                      memorialAndCapsuleModule: {
                        ...prev.memorialAndCapsuleModule,
                        elders:
                          prev.memorialAndCapsuleModule.elders.filter(
                            (x) => x.id !== el.id
                          ),
                      },
                    }))
                  }
                  className="text-red-700 p-1 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            {/* Time Capsule Sub-box */}
            <div className="rounded-xl bg-[#F7F2E9] border border-[#B98A78]/40 p-4 space-y-3">
              <label className="flex items-center gap-2 text-xs font-display font-bold text-[#252321] cursor-pointer">
                <input
                  type="checkbox"
                  checked={
                    cmsModules.memorialAndCapsuleModule.timeCapsule.enabled
                  }
                  onChange={(e) =>
                    setCmsModules((prev) => ({
                      ...prev,
                      memorialAndCapsuleModule: {
                        ...prev.memorialAndCapsuleModule,
                        timeCapsule: {
                          ...prev.memorialAndCapsuleModule.timeCapsule,
                          enabled: e.target.checked,
                        },
                      },
                    }))
                  }
                  className="accent-[#8D4925]"
                />
                <span>تفعيل «كبسولة الزمن العائلية» الموصدة بختم وتاريخ فتح مستقبلي</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="text"
                  value={cmsModules.memorialAndCapsuleModule.timeCapsule.title}
                  onChange={(e) =>
                    setCmsModules((prev) => ({
                      ...prev,
                      memorialAndCapsuleModule: {
                        ...prev.memorialAndCapsuleModule,
                        timeCapsule: {
                          ...prev.memorialAndCapsuleModule.timeCapsule,
                          title: e.target.value,
                        },
                      },
                    }))
                  }
                  placeholder="عنوان كبسولة الزمن..."
                  className="px-3 py-2 rounded-xl bg-white border border-[#B98A78]/50 text-xs"
                />
                <input
                  type="text"
                  value={
                    cmsModules.memorialAndCapsuleModule.timeCapsule
                      .authorElderName
                  }
                  onChange={(e) =>
                    setCmsModules((prev) => ({
                      ...prev,
                      memorialAndCapsuleModule: {
                        ...prev.memorialAndCapsuleModule,
                        timeCapsule: {
                          ...prev.memorialAndCapsuleModule.timeCapsule,
                          authorElderName: e.target.value,
                        },
                      },
                    }))
                  }
                  placeholder="اسم كاتب الوصية..."
                  className="px-3 py-2 rounded-xl bg-white border border-[#B98A78]/50 text-xs"
                />
                <input
                  type="date"
                  value={
                    cmsModules.memorialAndCapsuleModule.timeCapsule
                      .unlockDateIso
                  }
                  onChange={(e) =>
                    setCmsModules((prev) => ({
                      ...prev,
                      memorialAndCapsuleModule: {
                        ...prev.memorialAndCapsuleModule,
                        timeCapsule: {
                          ...prev.memorialAndCapsuleModule.timeCapsule,
                          unlockDateIso: e.target.value,
                        },
                      },
                    }))
                  }
                  className="px-3 py-2 rounded-xl bg-white border border-[#B98A78]/50 text-xs"
                />
              </div>
              <textarea
                rows={2}
                value={
                  cmsModules.memorialAndCapsuleModule.timeCapsule.sealedMessage
                }
                onChange={(e) =>
                  setCmsModules((prev) => ({
                    ...prev,
                    memorialAndCapsuleModule: {
                      ...prev.memorialAndCapsuleModule,
                      timeCapsule: {
                        ...prev.memorialAndCapsuleModule.timeCapsule,
                        sealedMessage: e.target.value,
                      },
                    },
                  }))
                }
                placeholder="نص الرسالة الموصدة التي لن تظهر إلا عند حلول تاريخ الفتح..."
                className="w-full px-3 py-2 rounded-xl bg-white border border-[#B98A78]/50 text-xs"
              />
            </div>
          </div>

          {/* 12. Guided Dialogue Majlis + Guardians of Memory */}
          <div className="rounded-2xl bg-white border border-[#B98A78]/40 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#B98A78]/25 pb-3">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cmsModules.majlisAndGuardiansModule.enabled}
                  onChange={(e) =>
                    setCmsModules((prev) => ({
                      ...prev,
                      majlisAndGuardiansModule: {
                        ...prev.majlisAndGuardiansModule,
                        enabled: e.target.checked,
                      },
                    }))
                  }
                  className="w-4 h-4 accent-[#8D4925]"
                />
                <span className="text-base font-display font-bold text-[#252321] flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-[#8D4925]" />
                  <span>مجلس الحوار العائلي الموجه + لوحة شرف «حماة الذاكرة»</span>
                </span>
              </label>
              <VisibilitySelector
                value={cmsModules.majlisAndGuardiansModule.visibility}
                onChange={(vis) =>
                  setCmsModules((prev) => ({
                    ...prev,
                    majlisAndGuardiansModule: {
                      ...prev.majlisAndGuardiansModule,
                      visibility: vis,
                    },
                  }))
                }
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={
                    cmsModules.majlisAndGuardiansModule.showGuardiansHonorRoll
                  }
                  onChange={(e) =>
                    setCmsModules((prev) => ({
                      ...prev,
                      majlisAndGuardiansModule: {
                        ...prev.majlisAndGuardiansModule,
                        showGuardiansHonorRoll: e.target.checked,
                      },
                    }))
                  }
                  className="accent-[#8D4925]"
                />
                <span>إظهار لوحة شرف أكثر 3 أقارب إثراءً للسجل («حماة الذاكرة»)</span>
              </label>

              <button
                type="button"
                onClick={() => {
                  setNewTopicTitle('سؤال الأسبوع لكبار العائلة');
                  setNewTopicPrompt(
                    `ما هي أجمل عادة رمضانية أو اجتماعية كانت تجمع بيوت أسرة ${result.familyName} قديماً؟`
                  );
                }}
                className="text-xs font-bold text-[#8D4925] hover:text-[#D8755B] cursor-pointer"
              >
                + تعبئة قالب «سؤال الأسبوع لكبار العائلة»
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="text"
                value={newTopicTitle}
                onChange={(e) => setNewTopicTitle(e.target.value)}
                placeholder="عنوان المحور الحواري..."
                className="px-3 py-2 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 text-xs"
              />
              <input
                type="text"
                value={newTopicPrompt}
                onChange={(e) => setNewTopicPrompt(e.target.value)}
                placeholder="سؤال الحوار الموجه لأفراد الأسرة..."
                className="px-3 py-2 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newTopicPrompt.trim()) return;
                  setCmsModules((prev) => ({
                    ...prev,
                    majlisAndGuardiansModule: {
                      ...prev.majlisAndGuardiansModule,
                      topics: [
                        {
                          id: `top_${Date.now()}`,
                          title: newTopicTitle.trim() || 'حوار عائلي موجه',
                          promptQuestion: newTopicPrompt.trim(),
                          isWeeklyElderPrompt:
                            newTopicTitle.includes('سؤال الأسبوع'),
                          isLocked: false,
                          createdAt: new Date().toISOString(),
                          replies: [],
                        },
                        ...prev.majlisAndGuardiansModule.topics,
                      ],
                    },
                  }));
                  setNewTopicTitle('');
                  setNewTopicPrompt('');
                }}
                className="px-4 py-2 rounded-xl bg-[#252321] text-white text-xs font-display font-bold cursor-pointer"
              >
                طرح موضوع للحوار
              </button>
            </div>

            {/* Topic Moderation (Lock / Pin / Delete Reply) */}
            <div className="space-y-3">
              {cmsModules.majlisAndGuardiansModule.topics.map((topic) => (
                <div
                  key={topic.id}
                  className="rounded-xl bg-[#F7F2E9] border border-[#B98A78]/35 p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-bold text-[#252321]">
                      {topic.title}: {topic.promptQuestion}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setCmsModules((prev) => ({
                            ...prev,
                            majlisAndGuardiansModule: {
                              ...prev.majlisAndGuardiansModule,
                              topics:
                                prev.majlisAndGuardiansModule.topics.map((t) =>
                                  t.id === topic.id
                                    ? { ...t, isLocked: !t.isLocked }
                                    : t
                                ),
                            },
                          }))
                        }
                        className="px-2.5 py-1 rounded-lg bg-white border border-[#B98A78]/40 text-[11px] font-bold cursor-pointer"
                      >
                        {topic.isLocked ? 'فتح النقاش' : 'إغلاق النقاش'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setCmsModules((prev) => ({
                            ...prev,
                            majlisAndGuardiansModule: {
                              ...prev.majlisAndGuardiansModule,
                              topics:
                                prev.majlisAndGuardiansModule.topics.filter(
                                  (t) => t.id !== topic.id
                                ),
                            },
                          }))
                        }
                        className="text-red-700 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {(topic.replies || []).length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-[#B98A78]/25">
                      {topic.replies.map((rep) => (
                        <div
                          key={rep.id}
                          className="flex items-center justify-between bg-white rounded-lg px-3 py-2 text-xs"
                        >
                          <span>
                            <strong>{rep.authorName}:</strong> {rep.body}
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                setCmsModules((prev) => ({
                                  ...prev,
                                  majlisAndGuardiansModule: {
                                    ...prev.majlisAndGuardiansModule,
                                    topics:
                                      prev.majlisAndGuardiansModule.topics.map(
                                        (t) =>
                                          t.id === topic.id
                                            ? {
                                                ...t,
                                                replies: t.replies.map((r) =>
                                                  r.id === rep.id
                                                    ? {
                                                        ...r,
                                                        isPinned: !r.isPinned,
                                                      }
                                                    : r
                                                ),
                                              }
                                            : t
                                      ),
                                  },
                                }))
                              }
                              className={`p-1 cursor-pointer ${
                                rep.isPinned
                                  ? 'text-[#D8755B]'
                                  : 'text-[#252321]/50'
                              }`}
                              title="تثبيت المشاركة"
                            >
                              <Pin className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setCmsModules((prev) => ({
                                  ...prev,
                                  majlisAndGuardiansModule: {
                                    ...prev.majlisAndGuardiansModule,
                                    topics:
                                      prev.majlisAndGuardiansModule.topics.map(
                                        (t) =>
                                          t.id === topic.id
                                            ? {
                                                ...t,
                                                replies: t.replies.filter(
                                                  (r) => r.id !== rep.id
                                                ),
                                              }
                                            : t
                                      ),
                                  },
                                }))
                              }
                              className="text-red-700 p-1 cursor-pointer"
                              title="حذف المشاركة"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Royal QR Modal */}
      <RoyalQrInvitationModal
        isOpen={showRoyalQrModal}
        onClose={() => setShowRoyalQrModal(false)}
        familyName={result.familyName}
        siteSlug={normalizePublicSiteSlug(siteSlug) || 'family-diwan'}
        emblemTag={emblemTag}
        registrarName={`${result.clientName} ${result.familyName}`.trim()}
        referralCode={buildDeterministicReferralCode(userId || 'usr')}
      />

      {/* Fullscreen Scoped Theme Live Preview Modal */}
      {showLivePreview && (
        <div className="fixed inset-0 z-50 bg-[#252321]/85 overflow-y-auto">
          <div className="sticky top-0 z-40 bg-[#252321] text-[#F7F2E9] px-6 py-3 flex items-center justify-between border-b border-white/15">
            <div className="text-xs font-display font-bold flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#D8755B]" />
              <span>
                معاينة حية لبوابة أسرة {result.familyName} بالقالب المختار (معزول تماماً عن لوحة التحكم)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowLivePreview(false)}
              className="px-3.5 py-1.5 rounded-lg bg-[#D8755B] text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>إغلاق المعاينة والعودة للاستوديو</span>
            </button>
          </div>
          <PublicFamilyMicrositePage
            siteSlug={livePreviewPayload.siteSlug}
            previewData={livePreviewPayload}
            isOwnerPreview={true}
            viewerEmail={userEmail}
            onExitToMainApp={() => setShowLivePreview(false)}
          />
        </div>
      )}
    </div>
  );
};
