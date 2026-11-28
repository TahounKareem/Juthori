import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Check,
  ChevronDown,
  Copy,
  Eye,
  FileText,
  Globe,
  Heart,
  Image as ImageIcon,
  Layers,
  Loader2,
  Lock,
  Monitor,
  Palette,
  QrCode,
  RotateCcw,
  Save,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Type,
  Upload,
  UploadCloud,
} from 'lucide-react';
import {
  UnifiedWorkspaceHeader,
  WORKSPACE_ICON_ACTIVE_BTN_CLASS,
  WORKSPACE_ICON_BTN_CLASS,
  WORKSPACE_PRIMARY_ICON_BTN_CLASS,
  WorkspaceIconTooltip,
} from './UnifiedWorkspaceHeader';
import { JUTHORI_SERVICE_ICONS } from '../config/serviceIcons';
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
  fetchUserTreeDisplaySettingsFromFirebase,
  fetchUserVaultArchive,
  readUserFamilyTreeFromLocal,
  readVaultArchiveFromLocal,
} from '../services/firestoreService';
import {
  JUTHORI_SHARED_VISUAL_SYNC_EVENT,
  SharedVisualSyncEventDetail,
  TreeDisplaySettings,
  normalizeTreeDisplaySettings,
  readSharedTreeDisplaySettingsFromLocal,
} from '../utils/treeStudioConfig';
import { FAMILY_TREE_SYNC_EVENT } from '../utils/enrichmentStagingUtils';
import {
  FAMILY_SITE_THEMES,
  FamilySiteThemeId,
  normalizeFamilySiteThemeId,
  resolveClientPublicAppBaseUrl,
} from '../config/referralAndSiteConfig';
import {
  DEFAULT_PORTAL_SECTION_ORDER,
  FamilyMicrositeCmsModules,
  FamilyPortalVisualBranding,
  FemaleDisplayPolicy,
  ModuleVisibility,
  PortalSectionKey,
  PublicMicrositeData,
  PublicSitePrivacyConfig,
  RawTreePersonForPublicProjection,
  SiteAccessMode,
  buildDefaultCmsModules,
  buildDefaultVisualBranding,
  checkPublicSiteSlugAvailability,
  computeContemporaryTreeMetrics,
  fetchOwnerMicrositeForCommunity,
  fetchPublishedMicrositeBySlug,
  normalizePublicSiteSlug,
  normalizeVisualBranding,
  projectSelectedVaultItemsForPublicSite,
  publishOrUpdatePublicMicrositeAtomically,
  sanitizeTreeMembersForPublicSite,
} from '../services/priority4Service';
import {
  processMediaFileForUpload,
  uploadMediaToCloudWithFallback,
} from '../utils/mediaPipeline';
import { PublicFamilyMicrositePage } from './PublicFamilyMicrositePage';
import { RoyalQrInvitationModal } from './RoyalQrInvitationModal';
import type { UpgradePromptRequest } from './UpgradeToPremiumModal';
import {
  CREST_STYLE_OPTIONS,
  FamilyCrestEmblem,
  HERO_COVER_PRESET_OPTIONS,
  HERO_LAYOUT_OPTIONS,
  TYPOGRAPHY_PAIR_OPTIONS,
} from './FamilySiteHeritageVisuals';
import {
  EMOTIONAL_INTERLUDE_POSITION_OPTIONS,
  EMOTIONAL_INTERLUDE_PRESETS,
  EMOTIONAL_INTERLUDE_QUOTE_SUGGESTIONS,
} from './FamilySiteEditorialPrimitives';
import { MySiteSectionHubPanel } from './MySiteSectionHubPanel';
import { MySiteLinkPrivacyPanel } from './MySiteLinkPrivacyPanel';
import { ModernSwitch } from './MySiteStudioControls';

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
  onRequirePremiumAction?: (req: UpgradePromptRequest) => void;
  onOpenEmailVerification?: () => void;
  onOpenTreeSettings?: () => void;
  onLogActivity: (action: string, detail: string) => void;
}

type StudioSectionTab =
  | 'diwan_identity'
  | 'sections_content'
  | 'link_privacy';

type IdentityInspectorSectionId =
  | 'hero_cover'
  | 'diwan_title_bio'
  | 'family_crest'
  | 'theme_typography'
  | 'emotional_interlude';

const OFFICIAL_BRAND_HOST = 'juthori.com';

/**
 * Calm Collapsible Inspector Card for Pillar 1 («واجهة الديوان والهوية»)
 */
function CalmInspectorAccordion({
  id,
  icon,
  title,
  summary,
  isOpen,
  onToggle,
  children,
}: {
  id: IdentityInspectorSectionId;
  icon: React.ReactNode;
  title: string;
  summary: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section
      data-testid={`mysite-inspector-${id}`}
      className={`rounded-2xl backdrop-blur-sm border transition-all duration-200 ${
        isOpen
          ? 'bg-[#F5F1E8] border-[#D8C7B2]/55 shadow-[0_10px_28px_-20px_rgba(31,31,28,0.28)]'
          : 'bg-[#F5F1E8]/92 border-[#D8C7B2] hover:border-[#D8C7B2] shadow-2xs'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-right cursor-pointer rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97757]/45"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 transition-colors duration-200 ${
              isOpen
                ? 'bg-[#D97757]/10 border-[#D97757]/25 text-[#D97757]'
                : 'bg-[#F5F1E8] border-[#D8C7B2] text-[#D97757]'
            }`}
          >
            {icon}
          </div>
          <h3 className="text-[13px] font-display font-extrabold text-[#1F1F1C] truncate">
            {title}
          </h3>
        </div>

        <div className="flex items-center gap-2 shrink-0 min-w-0">
          {!isOpen && summary && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F5F1E8] border border-[#D8C7B2] text-[11px] font-display font-bold text-[#D97757] max-w-[200px] sm:max-w-[240px] overflow-hidden">
              {summary}
            </div>
          )}
          <span
            className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all duration-200 shrink-0 ${
              isOpen
                ? 'bg-[#F5F1E8] text-[#D97757]'
                : 'text-[#D97757]/70 hover:bg-[#F5F1E8]'
            }`}
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-300 ease-out ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </span>
        </div>
      </button>

      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
          isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-3.5 border-t border-[#D8C7B2] space-y-4">
            {children}
          </div>
        </div>
      </div>
    </section>
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
  onRequirePremiumAction,
  onOpenEmailVerification,
  onOpenTreeSettings,
  onLogActivity,
}) => {
  const defaultSlug = useMemo(() => {
    const saved = initialSiteSettings?.siteSubdomain;
    if (saved) return normalizePublicSiteSlug(saved);
    const codeBased = normalizePublicSiteSlug(
      result.familyCode || `al-${result.familyName}`
    );
    return codeBased.length >= 3 ? codeBased : 'family-diwan';
  }, [
    initialSiteSettings?.siteSubdomain,
    result.familyCode,
    result.familyName,
  ]);

  // 3-Pillar Navigation & Focused Section State
  const [studioTab, setStudioTab] =
    useState<StudioSectionTab>('diwan_identity');
  const [activeIdentitySection, setActiveIdentitySection] =
    useState<IdentityInspectorSectionId | null>('hero_cover');
  const [focusedSectionKey, setFocusedSectionKey] =
    useState<PortalSectionKey | null>(null);

  // Core Site Identity & Access State
  const [siteSlug, setSiteSlug] = useState<string>(defaultSlug);
  const [previousPublishedSlug, setPreviousPublishedSlug] =
    useState<string>(defaultSlug);
  const [isPublished, setIsPublished] = useState<boolean>(
    Boolean(initialSiteSettings?.isPublished)
  );
  const [siteAccessMode, setSiteAccessMode] = useState<SiteAccessMode>(
    initialSiteSettings?.siteAccessMode || 'PUBLIC'
  );
  const [familyAccessCode, setFamilyAccessCode] = useState<string>(
    initialSiteSettings?.familyPinCode || ''
  );
  const [allowCircleMembersEnrichment, setAllowCircleMembersEnrichment] =
    useState<boolean>(true);
  const [allowVisitorEnrichment, setAllowVisitorEnrichment] =
    useState<boolean>(false);
  const [themeId, setThemeId] = useState<FamilySiteThemeId>(
    normalizeFamilySiteThemeId(initialSiteSettings?.themeId)
  );
  const [emblemTag, setEmblemTag] = useState<string>(
    initialSiteSettings?.emblemTag ||
      `ديوان وسجل عائلة ${result.familyName} المعاصر`
  );
  const [bioTitle, setBioTitle] = useState<string>(
    initialSiteSettings?.bioTitle || `ديوان وسجل عائلة ${result.familyName}`
  );
  const [bioDescription, setBioDescription] = useState<string>(() => {
    if (initialSiteSettings?.bioDescription) {
      return initialSiteSettings.bioDescription;
    }
    const invalidTokens = new Set([
      'غير محدد',
      'غير محددة',
      'غير معروف',
      'غير معروفة',
      '—',
      '-',
      'none',
      'n/a',
      'unknown',
    ]);
    const cleanRegion = (result.originRegion || '').trim();
    const cleanCountry = (result.originCountry || '').trim();
    const validRegion =
      cleanRegion && !invalidTokens.has(cleanRegion.toLowerCase())
        ? cleanRegion
        : '';
    const validCountry =
      cleanCountry && !invalidTokens.has(cleanCountry.toLowerCase())
        ? cleanCountry
        : '';
    const locationPhrase =
      validRegion && validCountry && validRegion !== validCountry
        ? `${validRegion} (${validCountry})`
        : validRegion || validCountry;
    return `بوابة رقمية موثقة تجمع فروع عائلة ${result.familyName} المعاصرة${
      locationPhrase ? ` في ${locationPhrase}` : ''
    } لحفظ الذاكرة العائلية وصلة الرحم وتوثيق المناسبات والصور التراثية.`;
  });

  // Rich Visual Branding State
  const [visualBranding, setVisualBranding] =
    useState<FamilyPortalVisualBranding>(() => {
      if (initialSiteSettings?.visualBrandingJson) {
        try {
          return normalizeVisualBranding(
            JSON.parse(initialSiteSettings.visualBrandingJson),
            result.familyName
          );
        } catch {
          // fallback
        }
      }
      return buildDefaultVisualBranding(result.familyName);
    });

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
  const [allVaultItems, setAllVaultItems] = useState<FamilyVaultMediaItem[]>(
    []
  );
  const [liveTreeDisplaySettings, setLiveTreeDisplaySettings] =
    useState<TreeDisplaySettings>(() =>
      normalizeTreeDisplaySettings(
        readSharedTreeDisplaySettingsFromLocal(userId || '', result.familyName)
      )
    );

  // Workspace & Modal States
  const [workspaceMode, setWorkspaceMode] = useState<
    'split_studio' | 'fullscreen_preview'
  >('split_studio');
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'mobile'>(
    'desktop'
  );
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [uploadingCrest, setUploadingCrest] = useState(false);
  const [uploadingHeroCover, setUploadingHeroCover] = useState(false);
  const [uploadingInterlude, setUploadingInterlude] = useState(false);
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
  const [showRoyalQrModal, setShowRoyalQrModal] = useState(false);

  const crestFileRef = useRef<HTMLInputElement | null>(null);
  const heroCoverFileRef = useRef<HTMLInputElement | null>(null);
  const interludeFileRef = useRef<HTMLInputElement | null>(null);

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

      const localTree =
        readUserFamilyTreeFromLocal<RawTreePersonForPublicProjection>(
          userId || '',
          userEmail,
          result.familyName
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
        const remoteTreeSettings =
          await fetchUserTreeDisplaySettingsFromFirebase(userId);
        if (mounted && remoteTreeSettings) {
          setLiveTreeDisplaySettings(
            normalizeTreeDisplaySettings(remoteTreeSettings)
          );
        }
      }

      const existingSite =
        (userId
          ? await fetchOwnerMicrositeForCommunity(userId, defaultSlug)
          : null) || (await fetchPublishedMicrositeBySlug(defaultSlug));
      if (mounted && existingSite && (!userId || existingSite.ownerId === userId)) {
        setIsPublished(Boolean(existingSite.isPublished));
        if (existingSite.siteSlug) {
          setSiteSlug(existingSite.siteSlug);
          setPreviousPublishedSlug(existingSite.siteSlug);
        }
        setSiteAccessMode(existingSite.siteAccessMode || 'PUBLIC');
        if (existingSite.themeId) {
          setThemeId(normalizeFamilySiteThemeId(existingSite.themeId));
        }
        if (existingSite.treeDisplaySettings) {
          setLiveTreeDisplaySettings((prev) =>
            normalizeTreeDisplaySettings({
              ...existingSite.treeDisplaySettings,
              ...prev,
            })
          );
        }
        if (existingSite.familyEmblemTag)
          setEmblemTag(existingSite.familyEmblemTag);
        if (existingSite.bioTitle) setBioTitle(existingSite.bioTitle);
        if (existingSite.bioDescription)
          setBioDescription(existingSite.bioDescription);
        if (existingSite.visualBranding) {
          setVisualBranding(
            normalizeVisualBranding(
              existingSite.visualBranding,
              result.familyName
            )
          );
        }
        if (existingSite.privacyConfig) {
          setBioVisibility(
            existingSite.privacyConfig.bioVisibility || 'PUBLIC'
          );
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
          if (typeof existingSite.privacyConfig.familyAccessCode === 'string') {
            setFamilyAccessCode(existingSite.privacyConfig.familyAccessCode);
          }
          if (
            typeof existingSite.privacyConfig.allowCircleMembersEnrichment ===
            'boolean'
          ) {
            setAllowCircleMembersEnrichment(
              existingSite.privacyConfig.allowCircleMembersEnrichment
            );
          }
          if (
            typeof existingSite.privacyConfig.allowVisitorEnrichment ===
            'boolean'
          ) {
            setAllowVisitorEnrichment(
              existingSite.privacyConfig.allowVisitorEnrichment
            );
          }
        }
        if (existingSite.cmsModules) {
          setCmsModules(existingSite.cmsModules);
        }
      }
    };

    loadSources();
    const handleTreeMergedSync = (ev: Event) => {
      const detail = (
        ev as CustomEvent<{
          ownerId?: string;
          mergedTree?: RawTreePersonForPublicProjection[];
        }>
      ).detail;
      if (
        mounted &&
        detail &&
        Array.isArray(detail.mergedTree) &&
        detail.mergedTree.length > 0 &&
        (!detail.ownerId || !userId || detail.ownerId === userId)
      ) {
        setRawTreeMembers(detail.mergedTree);
      }
    };
    window.addEventListener(FAMILY_TREE_SYNC_EVENT, handleTreeMergedSync);
    return () => {
      window.removeEventListener(FAMILY_TREE_SYNC_EVENT, handleTreeMergedSync);
      mounted = false;
    };
  }, [userId, userEmail, result.familyName, defaultSlug]);

  const contemporaryOnlyMembers = useMemo(
    () => rawTreeMembers.filter((m) => m && !m.isCertifiedReference),
    [rawTreeMembers]
  );

  const vaultImageItems = useMemo(
    () =>
      allVaultItems.filter(
        (it) =>
          it.mediaType === 'photo' ||
          (it.fileMimeType || '').startsWith('image/')
      ),
    [allVaultItems]
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

  const handleCopyPortalUrl = () => {
    const clean = normalizePublicSiteSlug(siteSlug) || 'family-diwan';
    const fullUrl = `${resolveClientPublicAppBaseUrl()}/${clean}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(fullUrl).catch(() => {});
    }
    setCopiedUrl(true);
    window.setTimeout(() => setCopiedUrl(false), 2200);
  };

  const handleUploadCrestImage = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCrest(true);
    try {
      const processed = await processMediaFileForUpload(file, 'avatar');
      const uploaded = await uploadMediaToCloudWithFallback({
        uid: userId,
        category: 'profile_avatars',
        itemId: `crest_${Date.now()}`,
        mainDataUrl: processed.mainDataUrl,
        thumbnailDataUrl: processed.thumbnailDataUrl,
        mimeType: processed.mimeType || 'image/jpeg',
      });
      setVisualBranding((prev) => ({
        ...prev,
        crestMode: 'custom_image',
        customCrestUrl: uploaded.url || processed.mainDataUrl,
      }));
    } finally {
      setUploadingCrest(false);
    }
  };

  const handleUploadHeroCover = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingHeroCover(true);
    try {
      const processed = await processMediaFileForUpload(file, 'vault_photo');
      const uploaded = await uploadMediaToCloudWithFallback({
        uid: userId,
        category: 'vault',
        itemId: `hero_cover_${Date.now()}`,
        mainDataUrl: processed.mainDataUrl,
        thumbnailDataUrl: processed.thumbnailDataUrl,
        mimeType: processed.mimeType || 'image/jpeg',
      });
      setVisualBranding((prev) => ({
        ...prev,
        heroCoverMode: 'custom_image',
        customHeroCoverUrl: uploaded.url || processed.mainDataUrl,
      }));
    } finally {
      setUploadingHeroCover(false);
    }
  };

  const handleUploadInterludePhoto = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingInterlude(true);
    try {
      const processed = await processMediaFileForUpload(file, 'vault_photo');
      const uploaded = await uploadMediaToCloudWithFallback({
        uid: userId,
        category: 'vault',
        itemId: `interlude_${Date.now()}`,
        mainDataUrl: processed.mainDataUrl,
        thumbnailDataUrl: processed.thumbnailDataUrl,
        mimeType: processed.mimeType || 'image/jpeg',
      });
      const finalUrl = uploaded.url || processed.mainDataUrl;
      setVisualBranding((prev) => ({
        ...prev,
        showHumanWarmthInterludes: true,
        customInterludeImageUrl: finalUrl,
        emotionalInterlude: {
          ...prev.emotionalInterlude,
          enabled: true,
          customImageUrl: finalUrl,
        },
      }));
    } finally {
      setUploadingInterlude(false);
    }
  };

  const handleMoveSectionOrder = (
    sectionKey: PortalSectionKey,
    direction: 'up' | 'down'
  ) => {
    setVisualBranding((prev) => {
      const order = [...prev.sectionOrder];
      const idx = order.indexOf(sectionKey);
      if (idx < 0) return prev;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= order.length) return prev;
      [order[idx], order[targetIdx]] = [order[targetIdx], order[idx]];
      return { ...prev, sectionOrder: order };
    });
  };

  const isRecommendedSectionOrder = useMemo(() => {
    if (
      visualBranding.sectionOrder.length !== DEFAULT_PORTAL_SECTION_ORDER.length
    ) {
      return false;
    }
    return DEFAULT_PORTAL_SECTION_ORDER.every(
      (key, idx) => visualBranding.sectionOrder[idx] === key
    );
  }, [visualBranding.sectionOrder]);

  const handleResetSectionOrderToRecommended = () => {
    setVisualBranding((prev) => ({
      ...prev,
      sectionOrder: [...DEFAULT_PORTAL_SECTION_ORDER],
    }));
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
      familyAccessCode: familyAccessCode.trim() || undefined,
      allowCircleMembersEnrichment,
      allowVisitorEnrichment,
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
      familyAccessCode,
      allowCircleMembersEnrichment,
      allowVisitorEnrichment,
    ]
  );

  const handlePersistAndPublish = async (
    nextPublishState: boolean,
    bypassGate?: boolean
  ) => {
    if (
      nextPublishState &&
      !bypassGate &&
      (!caps.isVip || !caps.hasRegistrarBadge)
    ) {
      if (onRequirePremiumAction) {
        onRequirePremiumAction({
          feature: 'site_publish',
          onAuthorizedContinue: () => {
            handlePersistAndPublish(true, true).catch(() => {});
          },
        });
      } else {
        onUpgradeAnnualVip();
      }
      return;
    }

    if (siteAccessMode === 'PRIVATE_WHITELIST' && !familyAccessCode.trim()) {
      setStudioTab('link_privacy');
      setFeedbackBanner({
        tone: 'warning',
        text: 'يرجى كتابة «رمز الدخول السري للعائلة» أولاً عند اختيار نطاق «محمي لدائرة العائلة برمز دخول»، ثم إعادة الضغط على الحفظ أو النشر.',
      });
      return;
    }

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
      familyPinCode: familyAccessCode.trim() || undefined,
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
      visualBrandingJson: JSON.stringify(visualBranding),
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
      treeDisplaySettings: liveTreeDisplaySettings,
      cmsModules,
      visualBranding,
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
        if (nextPublishState) {
          setIsPublished(false);
        }
        setFeedbackBanner({ tone: 'error', text: outcome.messageAr });
      }
    }
  };

  // Live Preview Payload (updates instantaneously on every edit)
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
      treeDisplaySettings: liveTreeDisplaySettings,
      cmsModules,
      visualBranding,
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
    liveTreeDisplaySettings,
    cmsModules,
    visualBranding,
  ]);

  // Listen for live visual/display updates from «شجرتي» or «عمود نسبي»
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleSharedVisualSync = (ev: Event) => {
      const detail = (ev as CustomEvent<SharedVisualSyncEventDetail>).detail;
      if (!detail) return;
      if (detail.displaySettings) {
        setLiveTreeDisplaySettings(
          normalizeTreeDisplaySettings(detail.displaySettings)
        );
        return;
      }
      if (detail.appearance) {
        setLiveTreeDisplaySettings((prev) =>
          normalizeTreeDisplaySettings({
            ...prev,
            cardTheme: detail.appearance.cardTheme,
            fontFamily: detail.appearance.fontFamily,
            canvasBackground: detail.appearance.canvasBackground,
            avatarStyle: detail.appearance.avatarStyle || prev.avatarStyle,
          })
        );
      }
    };
    window.addEventListener(
      JUTHORI_SHARED_VISUAL_SYNC_EVENT,
      handleSharedVisualSync as EventListener
    );
    return () => {
      window.removeEventListener(
        JUTHORI_SHARED_VISUAL_SYNC_EVENT,
        handleSharedVisualSync as EventListener
      );
    };
  }, []);

  const cleanSlugDisplay = normalizePublicSiteSlug(siteSlug) || 'family-diwan';

  const activeThemeDef =
    FAMILY_SITE_THEMES.find((t) => t.id === themeId) || FAMILY_SITE_THEMES[0];
  const activeTypographyOption =
    TYPOGRAPHY_PAIR_OPTIONS.find(
      (tp) => tp.id === visualBranding.typographyId
    ) || TYPOGRAPHY_PAIR_OPTIONS[0];
  const activeCrestOption =
    CREST_STYLE_OPTIONS.find((opt) => opt.id === visualBranding.crestStyle) ||
    CREST_STYLE_OPTIONS[0];
  const activeHeroPreset =
    HERO_COVER_PRESET_OPTIONS.find(
      (p) => p.id === visualBranding.heroCoverPreset
    ) || HERO_COVER_PRESET_OPTIONS[0];
  const hasCustomHeroCover =
    visualBranding.heroCoverMode === 'custom_image' &&
    Boolean(visualBranding.customHeroCoverUrl);

  const toggleIdentitySection = (sectionId: IdentityInspectorSectionId) => {
    setActiveIdentitySection((prev) => (prev === sectionId ? null : sectionId));
  };

  return (
    <div dir="rtl" className="w-full space-y-3.5 text-right">
      {/* Hidden File Inputs for Crest & Hero Cover */}
      <input
        ref={crestFileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUploadCrestImage}
      />
      <input
        ref={heroCoverFileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUploadHeroCover}
      />
      <input
        ref={interludeFileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUploadInterludePhoto}
      />

      {/* =================================================================== */}
      {/* UNIFIED WORKSPACE HEADER (Portal Title + Status/Copy URL + 40px CTAs)*/}
      {/* =================================================================== */}
      <UnifiedWorkspaceHeader
        testId="mysite-unified-header"
        icon={<JUTHORI_SERVICE_ICONS.site className="w-5 h-5" />}
        title={`موقع عائلة ${result.familyName}`}
        metaItems={[
          <span
            key="status"
            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-display font-bold border whitespace-nowrap ${
              isPublished
                ? 'bg-[#F5F1E8] border-[#D8C7B2] text-[#1F1F1C]'
                : 'bg-[#E8DED2] border-[#D8C7B2]/35 text-[#D97757]'
            }`}
          >
            {isPublished ? 'منشور' : 'مسودة خاصة'}
          </span>,
          <button
            key="url"
            type="button"
            onClick={handleCopyPortalUrl}
            title="نسخ رابط البوابة بنقرة واحدة"
            className="inline-flex items-center gap-1.5 font-mono text-[12px] font-semibold text-[#D97757] hover:text-[#D97757] transition-colors cursor-pointer max-w-[260px]"
          >
            <span dir="ltr" className="truncate">
              {OFFICIAL_BRAND_HOST}/{cleanSlugDisplay}
            </span>
            {copiedUrl ? (
              <Check className="w-3.5 h-3.5 text-[#D97757] shrink-0" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-[#D97757]/75 shrink-0" />
            )}
          </button>,
        ]}
        actions={
          <>
            <WorkspaceIconTooltip label="بطاقة الدعوة وQR">
              <button
                type="button"
                aria-label="بطاقة الدعوة وQR"
                onClick={() => {
                  if (!caps.isVip || !caps.hasRegistrarBadge) {
                    if (onRequirePremiumAction) {
                      onRequirePremiumAction({
                        feature: 'site_qr',
                        onAuthorizedContinue: () => setShowRoyalQrModal(true),
                      });
                    } else {
                      onUpgradeAnnualVip();
                    }
                    return;
                  }
                  setShowRoyalQrModal(true);
                }}
                className={WORKSPACE_ICON_BTN_CLASS}
              >
                <QrCode className="w-4 h-4 shrink-0" />
              </button>
            </WorkspaceIconTooltip>

            <WorkspaceIconTooltip
              label={
                workspaceMode === 'fullscreen_preview'
                  ? 'العودة للاستوديو'
                  : 'معاينة كاملة'
              }
            >
              <button
                type="button"
                aria-label={
                  workspaceMode === 'fullscreen_preview'
                    ? 'العودة للاستوديو'
                    : 'معاينة كاملة'
                }
                onClick={() =>
                  setWorkspaceMode((m) =>
                    m === 'fullscreen_preview'
                      ? 'split_studio'
                      : 'fullscreen_preview'
                  )
                }
                className={
                  workspaceMode === 'fullscreen_preview'
                    ? WORKSPACE_ICON_ACTIVE_BTN_CLASS
                    : WORKSPACE_ICON_BTN_CLASS
                }
              >
                {workspaceMode === 'fullscreen_preview' ? (
                  <Palette className="w-4 h-4 shrink-0" />
                ) : (
                  <Eye className="w-4 h-4 shrink-0" />
                )}
              </button>
            </WorkspaceIconTooltip>

            <WorkspaceIconTooltip label="حفظ كمسودة">
              <button
                type="button"
                aria-label="حفظ كمسودة"
                disabled={saving}
                onClick={() => handlePersistAndPublish(false)}
                className={WORKSPACE_ICON_BTN_CLASS}
              >
                <Save className="w-4 h-4 shrink-0" />
              </button>
            </WorkspaceIconTooltip>

            <WorkspaceIconTooltip
              label={isPublished ? 'تحديث ونشر الموقع' : 'نشر وتفعيل الموقع'}
              align="left"
            >
              <button
                type="button"
                aria-label={
                  isPublished ? 'تحديث ونشر الموقع' : 'نشر وتفعيل الموقع'
                }
                disabled={saving}
                onClick={() => handlePersistAndPublish(true)}
                className={WORKSPACE_PRIMARY_ICON_BTN_CLASS}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                ) : (
                  <UploadCloud className="w-4 h-4 shrink-0" />
                )}
              </button>
            </WorkspaceIconTooltip>
          </>
        }
      />

      {/* Feedback & Eligibility Banner */}
      {feedbackBanner && (
        <div
          className={`rounded-2xl px-4 py-3 border text-xs font-bold flex flex-wrap items-center justify-between gap-2 ${
            feedbackBanner.tone === 'success'
              ? 'bg-[#F5F1E8] border-[#D8C7B2] text-[#1F1F1C]'
              : feedbackBanner.tone === 'warning'
                ? 'bg-[#F5F1E8] border-[#D8C7B2] text-[#1F1F1C]'
                : 'bg-[#F5F1E8] border-[#D8C7B2] text-[#1F1F1C]'
          }`}
        >
          <span>{feedbackBanner.text}</span>
          <div className="flex items-center gap-2">
            {!caps.hasRegistrarBadge && onSignCharterAndEnableTree && (
              <button
                type="button"
                onClick={onSignCharterAndEnableTree}
                className="px-3 py-1 rounded-lg bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] text-[11px] font-bold cursor-pointer"
              >
                توقيع ميثاق أمين السجل
              </button>
            )}
            {!emailVerified && onOpenEmailVerification && (
              <button
                type="button"
                onClick={onOpenEmailVerification}
                className="px-3 py-1 rounded-lg bg-[#D97757] text-[#F5F1E8] text-[11px] font-bold cursor-pointer"
              >
                تأكيد البريد الآن
              </button>
            )}
            {!caps.canPublishPublicSite && (
              <button
                type="button"
                onClick={onUpgradeAnnualVip}
                className="px-3 py-1 rounded-lg bg-[#D97757] text-[#F5F1E8] text-[11px] font-bold cursor-pointer"
              >
                ترقية الباقة
              </button>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODE A: FULL-SCREEN INTERACTIVE PREVIEW (DESKTOP / MOBILE)          */}
      {/* =================================================================== */}
      {workspaceMode === 'fullscreen_preview' ? (
        <div className="space-y-3.5">
          <div className="rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] text-[#1F1F1C] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-display font-bold text-[#D97757]">
              <Eye className="w-4 h-4 text-[#D97757]" />
              <span>معاينة حية لموقع عائلة {result.familyName}</span>
            </div>

            <div className="inline-flex rounded-xl bg-[#E8DED2] border border-[#D8C7B2] p-1">
              <button
                type="button"
                onClick={() => setPreviewViewport('desktop')}
                className={`px-3 py-1 rounded-lg text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                  previewViewport === 'desktop'
                    ? 'bg-[#D97757] text-[#F5F1E8] shadow-2xs'
                    : 'text-[#D97757] hover:text-[#1F1F1C]'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>كمبيوتر</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewViewport('mobile')}
                className={`px-3 py-1 rounded-lg text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                  previewViewport === 'mobile'
                    ? 'bg-[#D97757] text-[#F5F1E8] shadow-2xs'
                    : 'text-[#D97757] hover:text-[#1F1F1C]'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>جوال</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setWorkspaceMode('split_studio')}
              className="px-3.5 py-1.5 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] text-[#1F1F1C] text-xs font-display font-bold cursor-pointer transition-colors"
            >
              العودة لاستوديو التخصيص
            </button>
          </div>

          <div
            className={
              previewViewport === 'mobile'
                ? 'max-w-[400px] mx-auto rounded-[2.2rem] border-[8px] border-[#1F1F1C] shadow-2xl overflow-hidden bg-[#F5F1E8] max-h-[82vh] overflow-y-auto'
                : 'rounded-3xl border border-[#D97757]/45 shadow-xl overflow-hidden bg-[#F5F1E8]'
            }
          >
            <PublicFamilyMicrositePage
              siteSlug={cleanSlugDisplay}
              previewData={livePreviewPayload}
              isOwnerPreview
              onExitToMainApp={() => setWorkspaceMode('split_studio')}
            />
          </div>
        </div>
      ) : (
        /* ================================================================= */
        /* MODE B: 3-PILLAR SPLIT STUDIO + STICKY LIVE INTERACTIVE PREVIEW   */
        /* ================================================================= */
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          {/* RIGHT: 3-PILLAR INTUITIVE STUDIO CONTROLS */}
          <div className="xl:col-span-7 space-y-4">
            {/* Sleek 3-Pillar Studio Bar */}
            <nav
              aria-label="محطات استوديو موقعي"
              data-testid="mysite-3pillar-tabs"
              className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 p-1.5 rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2]"
            >
              {(
                [
                  {
                    id: 'diwan_identity',
                    label: 'واجهة الديوان والهوية',
                    icon: <Palette className="w-4 h-4 shrink-0" />,
                  },
                  {
                    id: 'sections_content',
                    label: 'أقسام ومحتوى الموقع',
                    icon: <Layers className="w-4 h-4 shrink-0" />,
                    count: visualBranding.sectionOrder.length,
                  },
                  {
                    id: 'link_privacy',
                    label: 'الرابط والخصوصية',
                    icon: <ShieldCheck className="w-4 h-4 shrink-0" />,
                  },
                ] as const
              ).map((tab) => {
                const isActive = studioTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setStudioTab(tab.id);
                      if (tab.id !== 'sections_content') {
                        setFocusedSectionKey(null);
                      }
                    }}
                    className={`py-2.5 px-3 rounded-xl text-xs font-display font-extrabold inline-flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-[#D97757] text-[#F5F1E8] shadow-xs'
                        : 'text-[#D97757] hover:bg-[#E8DED2]/75 hover:text-[#1F1F1C]'
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                    {'count' in tab && (
                      <span
                        className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums ${
                          isActive
                            ? 'bg-[#F5F1E8]/20 text-[#F5F1E8]'
                            : 'bg-[#E8DED2] text-[#D97757]'
                        }`}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* ============================================================= */}
            {/* PILLAR 1: واجهة الديوان والهوية (4 ORDERED INSPECTOR CARDS)   */}
            {/* ============================================================= */}
            {studioTab === 'diwan_identity' && (
              <div
                className="space-y-3"
                data-testid="mysite-pillar-diwan-identity"
              >
                {/* #1: غلاف واجهة الترحيب (الهيرو) — OPEN BY DEFAULT */}
                <CalmInspectorAccordion
                  id="hero_cover"
                  icon={<ImageIcon className="w-4 h-4" />}
                  title="غلاف واجهة الترحيب (الهيرو)"
                  isOpen={activeIdentitySection === 'hero_cover'}
                  onToggle={() => toggleIdentitySection('hero_cover')}
                  summary={
                    <span className="truncate">
                      {hasCustomHeroCover
                        ? 'صورة غلاف خاصة'
                        : activeHeroPreset.label}
                    </span>
                  }
                >
                  {/* Featured Full-Width Hero Cover Banner Dropzone (120px) */}
                  <div
                    className="relative h-[120px] w-full rounded-2xl overflow-hidden border border-[#D8C7B2]/80 shadow-xs"
                    style={
                      hasCustomHeroCover
                        ? {
                            backgroundImage: `url(${visualBranding.customHeroCoverUrl})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                          }
                        : { background: activeHeroPreset.previewGradient }
                    }
                  >
                    <div
                      className="absolute inset-0 transition-opacity"
                      style={{
                        background: `linear-gradient(180deg, rgba(20,14,10,${
                          Math.max(
                            0.28,
                            (visualBranding.heroOverlayIntensity ?? 55) / 100
                          ) * 0.85
                        }) 0%, rgba(20,14,10,${Math.min(
                          0.82,
                          Math.max(
                            0.42,
                            (visualBranding.heroOverlayIntensity ?? 55) / 100
                          )
                        )}) 100%)`,
                      }}
                    />

                    <div className="relative z-10 h-full px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                      <div className="min-w-0 text-[#F5F1E8]">
                        <div className="text-[10.5px] font-display font-bold text-[#D97757]">
                          {hasCustomHeroCover
                            ? 'صورة غلاف مخصصة مفعّلة'
                            : `خلفية تراثية: ${activeHeroPreset.label}`}
                        </div>
                        <div className="text-xs sm:text-[13px] font-display font-extrabold text-[#F5F1E8] truncate mt-0.5">
                          أضف صورة مجلس العائلة أو الديرة لواجهة الديوان
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={uploadingHeroCover}
                          onClick={() => heroCoverFileRef.current?.click()}
                          className="h-9 px-3.5 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] text-[#1F1F1C] text-xs font-display font-extrabold inline-flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors whitespace-nowrap"
                        >
                          {uploadingHeroCover ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D97757]" />
                          ) : (
                            <Camera className="w-3.5 h-3.5 text-[#D97757]" />
                          )}
                          <span>
                            {uploadingHeroCover
                              ? 'جاري رفع الغلاف...'
                              : 'رفع صورة غلاف خاصة'}
                          </span>
                        </button>

                        {hasCustomHeroCover && (
                          <button
                            type="button"
                            onClick={() =>
                              setVisualBranding((prev) => ({
                                ...prev,
                                heroCoverMode: 'preset',
                              }))
                            }
                            className="h-9 px-3 rounded-xl bg-[#1F1F1C]/45 hover:bg-[#1F1F1C]/65 border border-[#F5F1E8]/25 text-[#F5F1E8] text-[11px] font-display font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>استعادة الخلفية الافتراضية</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Compact Strip of 6 Architectural / Heritage Presets */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11.5px] font-display font-extrabold text-[#D97757]">
                        خلفيات معمارية وتراثية جاهزة
                      </span>
                      <span className="text-[10.5px] text-[#D97757]">
                        تُطبق فوراً على المعاينة
                      </span>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {HERO_COVER_PRESET_OPTIONS.map((preset) => {
                        const selected =
                          visualBranding.heroCoverMode !== 'custom_image' &&
                          visualBranding.heroCoverPreset === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() =>
                              setVisualBranding((prev) => ({
                                ...prev,
                                heroCoverMode: 'preset',
                                heroCoverPreset: preset.id,
                              }))
                            }
                            title={preset.label}
                            className={`group rounded-xl overflow-hidden border text-right transition-all cursor-pointer ${
                              selected
                                ? 'border-[#D97757] ring-2 ring-[#D97757]/45'
                                : 'border-[#D8C7B2] hover:border-[#D97757]'
                            }`}
                          >
                            <div
                              className="h-10 w-full relative"
                              style={{ background: preset.previewGradient }}
                            />
                            <div
                              className={`px-1.5 py-1 bg-[#F5F1E8] text-[10px] font-display font-bold truncate text-center ${
                                selected ? 'text-[#D97757]' : 'text-[#1F1F1C]'
                              }`}
                            >
                              {preset.label.split(' ').slice(0, 2).join(' ')}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3-Option Hero Layout Selector */}
                  <div className="space-y-2">
                    <span className="text-[11.5px] font-display font-extrabold text-[#D97757]">
                      تخطيط واجهة الترحيب
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {HERO_LAYOUT_OPTIONS.map((layout) => {
                        const active = visualBranding.heroLayout === layout.id;
                        return (
                          <button
                            key={layout.id}
                            type="button"
                            onClick={() =>
                              setVisualBranding((prev) => ({
                                ...prev,
                                heroLayout: layout.id,
                              }))
                            }
                            className={`rounded-xl px-3 py-2.5 border text-right transition-all cursor-pointer ${
                              active
                                ? 'bg-[#F5F1E8] border-[#D97757] text-[#D97757] ring-1 ring-[#D97757]/30 shadow-2xs'
                                : 'bg-[#F5F1E8]/60 border-[#D8C7B2] text-[#1F1F1C]/85 hover:bg-[#F5F1E8] hover:border-[#D97757]/50'
                            }`}
                          >
                            <span className="text-xs font-display font-extrabold block truncate">
                              {layout.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Overlay Intensity Slider */}
                  <div className="rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] px-3.5 py-2.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-display font-bold text-[#D97757]">
                        شدة التظليل فوق الغلاف لإبراز النص
                      </span>
                      <span className="font-mono text-[11px] font-bold text-[#D97757] tabular-nums">
                        {visualBranding.heroOverlayIntensity ?? 55}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={20}
                      max={85}
                      step={1}
                      value={visualBranding.heroOverlayIntensity ?? 55}
                      onChange={(e) =>
                        setVisualBranding((prev) => ({
                          ...prev,
                          heroOverlayIntensity: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-[#D97757] cursor-pointer"
                    />
                  </div>
                </CalmInspectorAccordion>

                {/* #2: عنوان الديوان والنبذة التعريفية (Strictly Title, Tag, Bio) */}
                <CalmInspectorAccordion
                  id="diwan_title_bio"
                  icon={<FileText className="w-4 h-4" />}
                  title="عنوان الديوان والنبذة التعريفية"
                  isOpen={activeIdentitySection === 'diwan_title_bio'}
                  onToggle={() => toggleIdentitySection('diwan_title_bio')}
                  summary={<span className="truncate">{bioTitle}</span>}
                >
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-display font-bold text-[#D97757]">
                        العنوان الرئيسي للبوابة
                      </label>
                      <input
                        type="text"
                        value={bioTitle}
                        onChange={(e) => setBioTitle(e.target.value)}
                        placeholder={`ديوان وسجل عائلة ${result.familyName}`}
                        className="w-full h-10 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] px-3.5 text-xs font-display font-bold text-[#1F1F1C] focus:outline-none focus:border-[#D97757] focus:bg-[#F5F1E8]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-display font-bold text-[#D97757]">
                        الشعار الترحيبي أعلى العنوان
                      </label>
                      <input
                        type="text"
                        value={emblemTag}
                        onChange={(e) => setEmblemTag(e.target.value)}
                        placeholder={`ديوان وسجل عائلة ${result.familyName} المعاصر`}
                        className="w-full h-10 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] px-3.5 text-xs text-[#1F1F1C] focus:outline-none focus:border-[#D97757] focus:bg-[#F5F1E8]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-display font-bold text-[#D97757]">
                        النبذة التعريفية للعائلة
                      </label>
                      <textarea
                        rows={3}
                        value={bioDescription}
                        onChange={(e) => setBioDescription(e.target.value)}
                        placeholder="نبذة موجزة تعرّف الزوار بعائلتكم ورسالة هذا الديوان..."
                        className="w-full rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] px-3.5 py-2.5 text-xs text-[#1F1F1C] leading-relaxed focus:outline-none focus:border-[#D97757] focus:bg-[#F5F1E8]"
                      />
                    </div>
                  </div>
                </CalmInspectorAccordion>

                {/* #3: ختم وشعار العائلة */}
                <CalmInspectorAccordion
                  id="family_crest"
                  icon={<Sparkles className="w-4 h-4" />}
                  title="ختم وشعار العائلة"
                  isOpen={activeIdentitySection === 'family_crest'}
                  onToggle={() => toggleIdentitySection('family_crest')}
                  summary={
                    <span className="truncate">
                      {visualBranding.crestMode === 'custom_image'
                        ? 'شعار مرفوع مخصص'
                        : activeCrestOption.label}
                    </span>
                  }
                >
                  {/* Segmented Switch: Auto Gilded vs Custom Upload */}
                  <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#E8DED2] border border-[#D8C7B2]">
                    <button
                      type="button"
                      onClick={() =>
                        setVisualBranding((prev) => ({
                          ...prev,
                          crestMode: 'auto_gilded',
                        }))
                      }
                      className={`py-2 px-3 rounded-lg text-xs font-display font-extrabold cursor-pointer transition-colors ${
                        visualBranding.crestMode !== 'custom_image'
                          ? 'bg-[#F5F1E8] text-[#1F1F1C] shadow-2xs'
                          : 'text-[#D97757] hover:text-[#1F1F1C]'
                      }`}
                    >
                      ختم تراثي مذهّب تلقائي
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setVisualBranding((prev) => ({
                          ...prev,
                          crestMode: 'custom_image',
                        }))
                      }
                      className={`py-2 px-3 rounded-lg text-xs font-display font-extrabold cursor-pointer transition-colors ${
                        visualBranding.crestMode === 'custom_image'
                          ? 'bg-[#F5F1E8] text-[#1F1F1C] shadow-2xs'
                          : 'text-[#D97757] hover:text-[#1F1F1C]'
                      }`}
                    >
                      رفع شعار خاص بالعائلة
                    </button>
                  </div>

                  {visualBranding.crestMode === 'custom_image' ? (
                    <div className="rounded-xl bg-[#F5F1E8] border border-dashed border-[#D97757] p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-16 rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] flex items-center justify-center overflow-hidden shrink-0">
                          {visualBranding.customCrestUrl ? (
                            <img
                              src={visualBranding.customCrestUrl}
                              alt="شعار العائلة"
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-contain p-1"
                            />
                          ) : (
                            <Sparkles className="w-6 h-6 text-[#D97757]" />
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-display font-extrabold text-[#1F1F1C]">
                            {visualBranding.customCrestUrl
                              ? 'تم اعتماد شعار عائلتك المخصص'
                              : 'ارفع شعار العائلة (PNG أو JPG)'}
                          </div>
                          <p className="text-[11px] text-[#D97757] mt-0.5">
                            يفضّل خلفية شفافة وبأبعاد مربعة ليظهر بأبهى صورة في
                            الهيرو والبطاقات
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={uploadingCrest}
                        onClick={() => crestFileRef.current?.click()}
                        className="h-9.5 px-4 rounded-xl bg-[#D97757] hover:bg-[#D97757]/90 text-[#F5F1E8] text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0"
                      >
                        {uploadingCrest ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Upload className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {uploadingCrest
                            ? 'جاري الرفع...'
                            : visualBranding.customCrestUrl
                              ? 'تغيير الشعار'
                              : 'رفع شعار العائلة'}
                        </span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {CREST_STYLE_OPTIONS.map((opt) => {
                        const selected = visualBranding.crestStyle === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() =>
                              setVisualBranding((prev) => ({
                                ...prev,
                                crestMode: 'auto_gilded',
                                crestStyle: opt.id,
                              }))
                            }
                            className={`rounded-xl p-3 border flex flex-col items-center gap-2 transition-all cursor-pointer ${
                              selected
                                ? 'bg-[#F5F1E8] border-[#D97757] ring-1 ring-[#D97757]/35'
                                : 'bg-[#F5F1E8] border-[#D8C7B2] hover:border-[#D8C7B2]'
                            }`}
                          >
                            <div className="w-12 h-12 rounded-xl bg-[#E8DED2] border border-[#D8C7B2] flex items-center justify-center p-1.5">
                              <FamilyCrestEmblem
                                familyName={result.familyName}
                                crestMode="auto_gilded"
                                crestStyle={opt.id}
                                size="sm"
                              />
                            </div>
                            <span className="text-[11px] font-display font-extrabold text-[#1F1F1C] text-center leading-snug">
                              {opt.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </CalmInspectorAccordion>

                {/* #4: القالب اللوني والخط العربي (Compact 2-Column Themes + 3 Fonts) */}
                <CalmInspectorAccordion
                  id="theme_typography"
                  icon={<Palette className="w-4 h-4" />}
                  title="القالب اللوني والخط العربي"
                  isOpen={activeIdentitySection === 'theme_typography'}
                  onToggle={() => toggleIdentitySection('theme_typography')}
                  summary={
                    <>
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-[#1F1F1C]/15 shrink-0"
                        style={{ backgroundColor: activeThemeDef.swatchAccent }}
                      />
                      <span className="truncate">{activeThemeDef.nameAr}</span>
                      <span className="text-[#D97757] shrink-0">·</span>
                      <span className="truncate">
                        {activeTypographyOption.label}
                      </span>
                    </>
                  }
                >
                  {/* 10 Unified Museum Color Themes (Exact Parity with «شجرتي» & Border-Only Selection) */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11.5px] font-display font-extrabold text-[#D97757]">
                        ثيمات الألوان المتحفية ({FAMILY_SITE_THEMES.length} ثيمات)
                      </span>
                      <span className="text-[10.5px] text-[#D97757]">
                        ينعكس فوراً في المعاينة الحية
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {FAMILY_SITE_THEMES.map((theme) => {
                        const active = themeId === theme.id;
                        return (
                          <button
                            key={theme.id}
                            type="button"
                            data-testid={`site-theme-${theme.id}`}
                            onClick={() => setThemeId(theme.id)}
                            title={theme.subtitleAr}
                            className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer flex items-center gap-2.5 ${
                              active
                                ? 'bg-[#F5F1E8] border-[#D97757] text-[#D97757] ring-1 ring-[#D97757]/30 shadow-2xs'
                                : 'bg-[#F5F1E8]/60 border-[#D8C7B2] text-[#1F1F1C]/85 hover:bg-[#F5F1E8] hover:border-[#D97757]/50'
                            }`}
                          >
                            {/* Dual Overlapping Museum Color Swatches (Unified with «شجرتي») */}
                            <span className="inline-flex items-center shrink-0">
                              <span
                                className="w-4 h-4 rounded-full border border-[#F5F1E8] shadow-2xs"
                                style={{ backgroundColor: theme.swatchHero }}
                              />
                              <span
                                className="w-4 h-4 rounded-full border border-[#F5F1E8] shadow-2xs -mr-1.5"
                                style={{ backgroundColor: theme.swatchAccent }}
                              />
                            </span>
                            <span className="text-[11.5px] font-display font-bold truncate">
                              {theme.nameAr}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3 Clean Arabic Typography Options */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center gap-1.5 text-[11.5px] font-display font-extrabold text-[#D97757]">
                      <Type className="w-3.5 h-3.5 text-[#D97757]" />
                      <span>الخط العربي للموقع</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {TYPOGRAPHY_PAIR_OPTIONS.map((tp) => {
                        const active = visualBranding.typographyId === tp.id;
                        return (
                          <button
                            key={tp.id}
                            type="button"
                            onClick={() =>
                              setVisualBranding((prev) => ({
                                ...prev,
                                typographyId: tp.id,
                              }))
                            }
                            className={`rounded-xl px-3 py-2.5 border text-right transition-all cursor-pointer ${
                              active
                                ? 'bg-[#F5F1E8] border-[#D97757] text-[#D97757] ring-1 ring-[#D97757]/30 shadow-2xs'
                                : 'bg-[#F5F1E8]/60 border-[#D8C7B2] text-[#1F1F1C]/85 hover:bg-[#F5F1E8] hover:border-[#D97757]/50'
                            }`}
                          >
                            <span
                              className="text-sm font-bold block truncate"
                              style={{ fontFamily: tp.fontCss }}
                            >
                              {tp.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </CalmInspectorAccordion>

                {/* #5: الوقفة الوجدانية واللمسة الإنسانية (Single Curated Emotional Interlude Control) */}
                <CalmInspectorAccordion
                  id="emotional_interlude"
                  icon={<Heart className="w-4 h-4" />}
                  title="الوقفة الوجدانية واللمسة الإنسانية"
                  isOpen={activeIdentitySection === 'emotional_interlude'}
                  onToggle={() => toggleIdentitySection('emotional_interlude')}
                  summary={
                    <span className="truncate">
                      {visualBranding.emotionalInterlude.enabled
                        ? EMOTIONAL_INTERLUDE_POSITION_OPTIONS.find(
                            (p) =>
                              p.id ===
                              visualBranding.emotionalInterlude.position
                          )?.label || 'مفعّلة'
                        : 'مخفية'}
                    </span>
                  }
                >
                  <div className="space-y-4">
                    {/* 1. Master Toggle */}
                    <div className="rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] p-3.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-display font-extrabold text-[#1F1F1C]">
                          تفعيل الوقفة الوجدانية في الموقع
                        </div>
                        <p className="text-[11px] text-[#D97757] mt-0.5 leading-relaxed">
                          لوحة إنسانية دافئة واحدة فقط تجمع صورة عائلية مؤطرة
                          بالذهب وعبارة شاعرية مؤثرة دون أي تكرار
                        </p>
                      </div>
                      <ModernSwitch
                        checked={visualBranding.emotionalInterlude.enabled}
                        onChange={(next) =>
                          setVisualBranding((prev) => ({
                            ...prev,
                            showHumanWarmthInterludes: next,
                            emotionalInterlude: {
                              ...prev.emotionalInterlude,
                              enabled: next,
                            },
                          }))
                        }
                        ariaLabel="تفعيل الوقفة الوجدانية في الموقع"
                      />
                    </div>

                    {visualBranding.emotionalInterlude.enabled && (
                      <>
                        {/* 2. Position Selector */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-display font-extrabold text-[#D97757]">
                            موضع ظهور الوقفة الوجدانية في الموقع
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {EMOTIONAL_INTERLUDE_POSITION_OPTIONS.map((pos) => {
                              const active =
                                visualBranding.emotionalInterlude.position ===
                                pos.id;
                              return (
                                <button
                                  key={pos.id}
                                  type="button"
                                  onClick={() =>
                                    setVisualBranding((prev) => ({
                                      ...prev,
                                      emotionalInterlude: {
                                        ...prev.emotionalInterlude,
                                        position: pos.id,
                                      },
                                    }))
                                  }
                                  className={`rounded-xl px-3 py-2.5 border text-right transition-all cursor-pointer ${
                                    active
                                      ? 'bg-[#F5F1E8] border-[#D97757] text-[#D97757] ring-1 ring-[#D97757]/30 shadow-2xs'
                                      : 'bg-[#F5F1E8]/60 border-[#D8C7B2] text-[#1F1F1C]/85 hover:bg-[#F5F1E8] hover:border-[#D97757]/50'
                                  }`}
                                >
                                  <span className="text-xs font-display font-extrabold block">
                                    {pos.label}
                                  </span>
                                  <p className="text-[10.5px] text-[#1F1F1C]/65 mt-0.5 leading-snug">
                                    {pos.description}
                                  </p>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* 3. Scene Picker (4 Curated Warm Scenes + Custom Upload) */}
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-display font-extrabold text-[#D97757]">
                              اختر مشهداً إنسانياً دافئاً أو ارفع صورتكم الخاصة
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={uploadingInterlude}
                                onClick={() =>
                                  interludeFileRef.current?.click()
                                }
                                className="h-8 px-3 rounded-lg bg-[#D97757] hover:bg-[#D97757]/90 text-[#F5F1E8] text-[11px] font-display font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                              >
                                {uploadingInterlude ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Camera className="w-3.5 h-3.5" />
                                )}
                                <span>
                                  {uploadingInterlude
                                    ? 'جاري الرفع...'
                                    : 'رفع صورة عائلية خاصة'}
                                </span>
                              </button>
                              {visualBranding.emotionalInterlude
                                .customImageUrl && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setVisualBranding((prev) => ({
                                      ...prev,
                                      customInterludeImageUrl: undefined,
                                      emotionalInterlude: {
                                        ...prev.emotionalInterlude,
                                        customImageUrl: undefined,
                                      },
                                    }))
                                  }
                                  className="h-8 px-2.5 rounded-lg bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] text-[11px] font-bold text-[#D97757] cursor-pointer whitespace-nowrap"
                                >
                                  إلغاء الخاصة
                                </button>
                              )}
                            </div>
                          </div>

                          {visualBranding.emotionalInterlude.customImageUrl && (
                            <div className="rounded-xl bg-[#F5F1E8] border border-[#D97757] p-2.5 flex items-center gap-3">
                              <img
                                src={
                                  visualBranding.emotionalInterlude
                                    .customImageUrl
                                }
                                alt="صورة الوقفة الوجدانية الخاصة"
                                referrerPolicy="no-referrer"
                                className="w-16 h-12 rounded-lg object-cover border border-[#D8C7B2] shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-display font-extrabold text-[#1F1F1C]">
                                  صورتكم العائلية الخاصة مفعّلة حالياً
                                </div>
                                <div className="text-[11px] text-[#D97757]">
                                  يمكنك التبديل في أي وقت لأحد المشاهد التراثية
                                  أدناه
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {EMOTIONAL_INTERLUDE_PRESETS.map((scene) => {
                              const isSelected =
                                !visualBranding.emotionalInterlude
                                  .customImageUrl &&
                                visualBranding.emotionalInterlude
                                  .imagePresetId === scene.id;
                              return (
                                <button
                                  key={scene.id}
                                  type="button"
                                  onClick={() =>
                                    setVisualBranding((prev) => ({
                                      ...prev,
                                      customInterludeImageUrl: undefined,
                                      emotionalInterlude: {
                                        ...prev.emotionalInterlude,
                                        imagePresetId: scene.id,
                                        customImageUrl: undefined,
                                      },
                                    }))
                                  }
                                  className={`group rounded-xl overflow-hidden border text-right transition-all cursor-pointer ${
                                    isSelected
                                      ? 'border-[#D97757] ring-2 ring-[#D97757]/40 bg-[#F5F1E8]'
                                      : 'border-[#D8C7B2] hover:border-[#D8C7B2] bg-[#F5F1E8]'
                                  }`}
                                >
                                  <div className="aspect-[4/3] w-full overflow-hidden relative bg-[#E8DED2]">
                                    <img
                                      src={scene.imageUrl}
                                      alt={scene.label}
                                      referrerPolicy="no-referrer"
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                    {isSelected && (
                                      <span className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-[#D97757] text-[#F5F1E8] flex items-center justify-center shadow-sm">
                                        <Check className="w-3 h-3" />
                                      </span>
                                    )}
                                  </div>
                                  <div className="p-2">
                                    <div className="text-[11px] font-display font-extrabold text-[#1F1F1C] truncate">
                                      {scene.label}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* 4. Editable Kicker & Poetic Quote + 4 One-Click Suggestions */}
                        <div className="space-y-3 pt-1">
                          <div className="space-y-1.5">
                            <label className="text-xs font-display font-bold text-[#D97757]">
                              العنوان الفرعي للوقفة
                            </label>
                            <input
                              type="text"
                              value={visualBranding.emotionalInterlude.kicker}
                              onChange={(e) =>
                                setVisualBranding((prev) => ({
                                  ...prev,
                                  emotionalInterlude: {
                                    ...prev.emotionalInterlude,
                                    kicker: e.target.value,
                                  },
                                }))
                              }
                              placeholder="مثال: صلة الأجيال وامتداد الدوحة"
                              className="w-full h-9.5 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] px-3.5 text-xs font-display font-bold text-[#1F1F1C] focus:outline-none focus:border-[#D97757] focus:bg-[#F5F1E8]"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-display font-bold text-[#D97757]">
                              العبارة الوجدانية المؤثرة
                            </label>
                            <textarea
                              rows={2}
                              value={visualBranding.emotionalInterlude.quote}
                              onChange={(e) =>
                                setVisualBranding((prev) => ({
                                  ...prev,
                                  emotionalInterlude: {
                                    ...prev.emotionalInterlude,
                                    quote: e.target.value,
                                  },
                                }))
                              }
                              placeholder="اكتب عبارة دافئة تعبّر عن روح عائلتكم..."
                              className="w-full rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] px-3.5 py-2 text-xs text-[#1F1F1C] leading-relaxed focus:outline-none focus:border-[#D97757] focus:bg-[#F5F1E8]"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <div className="text-[11px] font-display font-bold text-[#D97757]">
                              اقتراحات جاهزة (تُطبق بنقرة واحدة):
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {EMOTIONAL_INTERLUDE_QUOTE_SUGGESTIONS.map(
                                (sug) => {
                                  const active =
                                    visualBranding.emotionalInterlude.quote.trim() ===
                                    sug.quote.trim();
                                  return (
                                    <button
                                      key={sug.id}
                                      type="button"
                                      onClick={() =>
                                        setVisualBranding((prev) => ({
                                          ...prev,
                                          emotionalInterlude: {
                                            ...prev.emotionalInterlude,
                                            kicker: sug.kicker,
                                            quote: sug.quote,
                                          },
                                        }))
                                      }
                                      className={`rounded-xl px-3 py-2 border text-right text-[11px] leading-relaxed transition-colors cursor-pointer ${
                                        active
                                          ? 'bg-[#F5F1E8] border-[#D97757] text-[#1F1F1C] font-bold'
                                          : 'bg-[#F5F1E8] border-[#D8C7B2] hover:border-[#D8C7B2] text-[#D97757]'
                                      }`}
                                    >
                                      <span className="text-[#D97757] ml-1">
                                        ✦
                                      </span>
                                      {sug.quote}
                                    </button>
                                  );
                                }
                              )}
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </CalmInspectorAccordion>
              </div>
            )}

            {/* ============================================================= */}
            {/* PILLAR 2: أقسام ومحتوى الموقع (UNIFIED MASTER-DETAIL HUB)     */}
            {/* ============================================================= */}
            {studioTab === 'sections_content' && (
              <MySiteSectionHubPanel
                familyName={result.familyName}
                originCountry={result.originCountry}
                userId={userId}
                focusedSectionKey={focusedSectionKey}
                onSelectSection={setFocusedSectionKey}
                visualBranding={visualBranding}
                setVisualBranding={setVisualBranding}
                cmsModules={cmsModules}
                setCmsModules={setCmsModules}
                isRecommendedSectionOrder={isRecommendedSectionOrder}
                onMoveSectionOrder={handleMoveSectionOrder}
                onResetSectionOrder={handleResetSectionOrderToRecommended}
                treeVisibility={treeVisibility}
                setTreeVisibility={setTreeVisibility}
                startRootPersonId={startRootPersonId}
                setStartRootPersonId={setStartRootPersonId}
                excludedBranchRootIds={excludedBranchRootIds}
                setExcludedBranchRootIds={setExcludedBranchRootIds}
                contemporaryOnlyMembers={contemporaryOnlyMembers}
                onOpenTreeSettings={onOpenTreeSettings}
                vaultVisibility={vaultVisibility}
                setVaultVisibility={setVaultVisibility}
                enableDynamicWatermark={enableDynamicWatermark}
                setEnableDynamicWatermark={setEnableDynamicWatermark}
                enablePhotoFacePrompt={enablePhotoFacePrompt}
                setEnablePhotoFacePrompt={setEnablePhotoFacePrompt}
                vaultFolders={vaultFolders}
                allVaultItems={allVaultItems}
                vaultImageItems={vaultImageItems}
                selectedFolderIds={selectedFolderIds}
                setSelectedFolderIds={setSelectedFolderIds}
                selectedVaultItemIds={selectedVaultItemIds}
                setSelectedVaultItemIds={setSelectedVaultItemIds}
              />
            )}

            {/* ============================================================= */}
            {/* PILLAR 3: الرابط والخصوصية                                     */}
            {/* ============================================================= */}
            {studioTab === 'link_privacy' && (
              <MySiteLinkPrivacyPanel
                officialBrandHost={OFFICIAL_BRAND_HOST}
                siteSlug={siteSlug}
                cleanSlugDisplay={cleanSlugDisplay}
                onChangeSiteSlug={setSiteSlug}
                slugStatus={slugStatus}
                onCheckSlug={handleCheckSlug}
                copiedUrl={copiedUrl}
                onCopyPortalUrl={handleCopyPortalUrl}
                onOpenQrModal={() => setShowRoyalQrModal(true)}
                siteAccessMode={siteAccessMode}
                onChangeSiteAccessMode={setSiteAccessMode}
                familyAccessCode={familyAccessCode}
                onChangeFamilyAccessCode={setFamilyAccessCode}
                femaleDisplayPolicy={femaleDisplayPolicy}
                onChangeFemaleDisplayPolicy={setFemaleDisplayPolicy}
                hideLivingNamesForGuests={hideLivingNamesForGuests}
                onChangeHideLivingNamesForGuests={setHideLivingNamesForGuests}
                hideLivingBirthDates={hideLivingBirthDates}
                onChangeHideLivingBirthDates={setHideLivingBirthDates}
                allowCircleMembersEnrichment={allowCircleMembersEnrichment}
                onChangeAllowCircleMembersEnrichment={
                  setAllowCircleMembersEnrichment
                }
                allowVisitorEnrichment={allowVisitorEnrichment}
                onChangeAllowVisitorEnrichment={setAllowVisitorEnrichment}
                majlisEnabled={cmsModules.majlisAndGuardiansModule.enabled}
                onChangeMajlisEnabled={(next) =>
                  setCmsModules((prev) => ({
                    ...prev,
                    majlisAndGuardiansModule: {
                      ...prev.majlisAndGuardiansModule,
                      enabled: next,
                    },
                  }))
                }
              />
            )}
          </div>

          {/* LEFT (Desktop xl): STICKY LIVE INTERACTIVE MINI-BROWSER */}
          <aside className="hidden xl:block xl:col-span-5 xl:sticky xl:top-24 self-start">
            <div className="rounded-3xl border border-[#D8C7B2] bg-[#FAF7F2] shadow-[0_20px_50px_-24px_rgba(31,31,28,0.18)] overflow-hidden flex flex-col">
              {/* Sleek Warm Ivory Browser Chrome Bar */}
              <div className="px-4 py-2.5 bg-[#E8DED2] border-b border-[#D8C7B2] flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#D97757]/70" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#D8C7B2]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#D8C7B2]" />
                </div>
                <div
                  dir="ltr"
                  className="flex-1 mx-2 px-3 py-1 rounded-lg bg-[#FAF7F2] border border-[#D8C7B2] text-[11px] font-mono text-[#1F1F1C] inline-flex items-center justify-center gap-1.5 truncate"
                >
                  <Lock className="w-3 h-3 text-[#D97757] shrink-0" />
                  <span className="truncate">
                    {OFFICIAL_BRAND_HOST}/{cleanSlugDisplay}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setWorkspaceMode('fullscreen_preview')}
                  title="توسيع لملء الشاشة"
                  className="text-[10.5px] font-display font-bold text-[#D97757] hover:underline cursor-pointer whitespace-nowrap shrink-0"
                >
                  تكبير ↗
                </button>
              </div>

              {/* Live Synchronized Scrollable Mini-Portal */}
              <div className="h-[calc(100vh-12.5rem)] min-h-[540px] max-h-[780px] overflow-y-auto bg-[#F5F1E8]">
                <PublicFamilyMicrositePage
                  siteSlug={cleanSlugDisplay}
                  previewData={livePreviewPayload}
                  isOwnerPreview
                  compactPreview
                  onExitToMainApp={() => {}}
                />
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Royal QR Invitation Modal */}
      {showRoyalQrModal && (
        <RoyalQrInvitationModal
          isOpen={showRoyalQrModal}
          onClose={() => setShowRoyalQrModal(false)}
          familyName={result.familyName}
          siteSlug={cleanSlugDisplay}
          emblemTag={emblemTag}
          registrarName={`${result.clientName} ${result.familyName}`.trim()}
          referralCode={buildDeterministicReferralCode(userId || 'usr_guest')}
        />
      )}
    </div>
  );
};
