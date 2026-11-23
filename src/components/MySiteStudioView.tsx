import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Award,
  BookOpen,
  Briefcase,
  Calendar,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  FolderOpen,
  GitBranch,
  Globe,
  Heart,
  Image as ImageIcon,
  Layers,
  Loader2,
  Lock,
  MapPin,
  MessageSquare,
  Mic,
  Monitor,
  Palette,
  Plus,
  QrCode,
  Quote,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Trash2,
  Type,
  Upload,
  X,
} from 'lucide-react';
import {
  UnifiedWorkspaceHeader,
  WORKSPACE_PRIMARY_BTN_CLASS,
  WORKSPACE_SECONDARY_ACTIVE_BTN_CLASS,
  WORKSPACE_SECONDARY_BTN_CLASS,
} from './UnifiedWorkspaceHeader';
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
import {
  FAMILY_SITE_THEMES,
  FamilySiteThemeId,
  resolveClientPublicAppBaseUrl,
} from '../config/referralAndSiteConfig';
import {
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
import {
  CREST_STYLE_OPTIONS,
  FamilyCrestEmblem,
  HERO_COVER_PRESET_OPTIONS,
  HERO_LAYOUT_OPTIONS,
  PORTAL_SECTION_LABELS,
  TYPOGRAPHY_PAIR_OPTIONS,
} from './FamilySiteHeritageVisuals';

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
  onOpenTreeSettings?: () => void;
  onLogActivity: (action: string, detail: string) => void;
}

type StudioSectionTab =
  | 'identity_theme'
  | 'mirror_privacy'
  | 'editorial_modules'
  | 'heritage_community_modules';

type IdentityInspectorSectionId =
  | 'url_access'
  | 'theme_typography'
  | 'family_crest'
  | 'hero_cover'
  | 'editorial_identity';

const OFFICIAL_BRAND_HOST = 'juthori.com';

/**
 * Sleek Ivory-Glass Collapsible Inspector Card for Tab 1 («الهوية والمظهر»)
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
          ? 'bg-[#FFFDF9] border-[#D4AF37]/55 shadow-[0_10px_28px_-20px_rgba(61,43,31,0.28)]'
          : 'bg-[#FFFDF9]/92 border-[#E6DAC3] hover:border-[#D4B988] shadow-2xs'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-right cursor-pointer rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]/45"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 transition-colors duration-200 ${
              isOpen
                ? 'bg-[#9E5631]/10 border-[#9E5631]/25 text-[#9E5631]'
                : 'bg-[#F8F3EA] border-[#E6DAC3] text-[#8C5327]'
            }`}
          >
            {icon}
          </div>
          <h3 className="text-[13px] font-display font-extrabold text-[#2C1E14] truncate">
            {title}
          </h3>
        </div>

        <div className="flex items-center gap-2 shrink-0 min-w-0">
          {!isOpen && summary && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FAF6EE] border border-[#E6DAC3] text-[11px] font-display font-bold text-[#5C4938] max-w-[200px] sm:max-w-[250px] overflow-hidden">
              {summary}
            </div>
          )}
          <span
            className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all duration-200 shrink-0 ${
              isOpen
                ? 'bg-[#FAF6EE] text-[#9E5631]'
                : 'text-[#8C5327]/70 hover:bg-[#FAF6EE]'
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
          <div className="px-4 pb-4 pt-3.5 border-t border-[#F0E8DA] space-y-4">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

function ModernSwitch({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
        checked ? 'bg-[#D8755B]' : 'bg-[#D8CEBE]'
      }`}
    >
      <span
        className={`inline-block h-4.5 w-4.5 rounded-full bg-white shadow-xs transition-transform ${
          checked ? '-translate-x-5.5' : '-translate-x-1'
        }`}
      />
    </button>
  );
}

function VisibilityPillSelector({
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
      className="h-8 px-2.5 rounded-xl bg-[#FAF6F0] border border-[#E5DAC8] text-[11px] font-display font-bold text-[#252321] focus:outline-none focus:border-[#C5A059] cursor-pointer"
    >
      <option value="PUBLIC">للعامة</option>
      <option value="FAMILY_ONLY">لدائرة العائلة</option>
      <option value="HIDDEN">مخفي</option>
    </select>
  );
}

/**
 * Collapsible Luxury Studio Module Card (replaces raw stacked forms in Tabs 3 & 4)
 */
function CollapsibleStudioModuleCard({
  icon,
  title,
  subtitle,
  enabled,
  onToggleEnabled,
  visibility,
  onChangeVisibility,
  itemsCount,
  isExpanded,
  onToggleExpand,
  isAdding,
  onToggleAdd,
  addForm,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  enabled: boolean;
  onToggleEnabled: (next: boolean) => void;
  visibility: ModuleVisibility;
  onChangeVisibility: (next: ModuleVisibility) => void;
  itemsCount: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isAdding?: boolean;
  onToggleAdd?: () => void;
  addForm?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl bg-[#FFFDF9] border transition-all overflow-hidden ${
        enabled
          ? 'border-[#E5DAC8] shadow-2xs'
          : 'border-[#EDE6DA] opacity-75'
      }`}
    >
      {/* Card Header */}
      <div className="px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div
          onClick={onToggleExpand}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onToggleExpand();
            }
          }}
          className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-[#FAF6F0] border border-[#E5DAC8] text-[#8D4925] flex items-center justify-center shrink-0">
            {icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-display font-extrabold text-[#252321] truncate">
                {title}
              </h4>
              <span className="px-2 py-0.5 rounded-full bg-[#FAF6F0] border border-[#E5DAC8] text-[10px] font-display font-extrabold text-[#8D4925] tabular-nums shrink-0">
                {itemsCount}
              </span>
            </div>
            <p className="text-[11px] text-[#252321]/60 truncate">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <VisibilityPillSelector
            value={visibility}
            onChange={onChangeVisibility}
          />
          <ModernSwitch
            checked={enabled}
            onChange={onToggleEnabled}
            ariaLabel={`تفعيل قسم ${title}`}
          />
          {onToggleAdd && (
            <button
              type="button"
              onClick={() => {
                if (!isExpanded) onToggleExpand();
                onToggleAdd();
              }}
              className="h-8 px-3 rounded-xl bg-[#D8755B]/12 hover:bg-[#D8755B] text-[#8D4925] hover:text-white border border-[#D8755B]/35 text-[11px] font-display font-extrabold inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAdding ? 'إغلاق' : 'إضافة'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onToggleExpand}
            aria-label={isExpanded ? 'طي القسم' : 'توسيع القسم'}
            className="w-8 h-8 rounded-xl bg-[#FAF6F0] hover:bg-[#EDE6DA] text-[#8D4925] flex items-center justify-center cursor-pointer"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Collapsible Body */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-[#F0E9DD] space-y-3.5 bg-[#FAF6F0]/35">
          {isAdding && addForm && (
            <div className="rounded-2xl bg-[#FFFDF9] border border-[#C5A059]/60 p-4 shadow-2xs space-y-3">
              {addForm}
            </div>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Compact Image Picker supporting Direct Upload OR Picking from Family Vault (`خزانتي`)
 */
function OptionalImagePicker({
  value,
  onChange,
  vaultPhotos,
  label = 'صورة مرفقة (اختياري)',
  uid,
}: {
  value: string;
  onChange: (nextUrl: string) => void;
  vaultPhotos: FamilyVaultMediaItem[];
  label?: string;
  uid?: string;
}) {
  const [showVaultPicker, setShowVaultPicker] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const processed = await processMediaFileForUpload(file, 'vault_photo');
      const uploaded = await uploadMediaToCloudWithFallback({
        uid,
        category: 'vault',
        itemId: `site_media_${Date.now()}`,
        mainDataUrl: processed.mainDataUrl,
        thumbnailDataUrl: processed.thumbnailDataUrl,
        mimeType: processed.mimeType || 'image/jpeg',
      });
      onChange(uploaded.url || processed.mainDataUrl);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-[#8D4925]">{label}</span>
        <div className="flex items-center gap-1.5">
          <label className="px-2.5 py-1 rounded-lg bg-[#FAF6F0] hover:bg-[#EDE6DA] border border-[#E5DAC8] text-[11px] font-bold text-[#252321] inline-flex items-center gap-1 cursor-pointer">
            <Upload className="w-3 h-3 text-[#D8755B]" />
            <span>{uploading ? 'جاري الرفع...' : 'رفع صورة'}</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFile}
            />
          </label>
          {vaultPhotos.length > 0 && (
            <button
              type="button"
              onClick={() => setShowVaultPicker((v) => !v)}
              className="px-2.5 py-1 rounded-lg bg-[#FAF6F0] hover:bg-[#EDE6DA] border border-[#E5DAC8] text-[11px] font-bold text-[#8D4925] inline-flex items-center gap-1 cursor-pointer"
            >
              <FolderOpen className="w-3 h-3" />
              <span>اختيار من خزانتي</span>
            </button>
          )}
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="px-2 py-1 rounded-lg bg-red-50 text-red-700 text-[11px] font-bold cursor-pointer"
            >
              إزالة
            </button>
          )}
        </div>
      </div>

      {value && (
        <div className="w-24 h-16 rounded-xl overflow-hidden border border-[#C5A059]/60 bg-white">
          <img
            src={value}
            alt="معاينة الصورة المرفقة"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {showVaultPicker && vaultPhotos.length > 0 && (
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 p-2.5 rounded-xl bg-[#FAF6F0] border border-[#E5DAC8] max-h-36 overflow-y-auto">
          {vaultPhotos.map((vp) => (
            <button
              key={vp.id}
              type="button"
              onClick={() => {
                onChange(vp.thumbnailDataUrl || vp.fileDataUrl);
                setShowVaultPicker(false);
              }}
              className="aspect-square rounded-lg overflow-hidden border border-[#E5DAC8] hover:border-[#C5A059] cursor-pointer"
              title={vp.title}
            >
              <img
                src={vp.thumbnailDataUrl || vp.fileDataUrl}
                alt={vp.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
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

  const [studioTab, setStudioTab] =
    useState<StudioSectionTab>('identity_theme');
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

  // Studio UI States
  const [activeIdentitySection, setActiveIdentitySection] =
    useState<IdentityInspectorSectionId | null>('theme_typography');
  const [showSectionOrderDrawer, setShowSectionOrderDrawer] =
    useState<boolean>(false);
  const [workspaceMode, setWorkspaceMode] = useState<
    'split_studio' | 'fullscreen_preview'
  >('split_studio');
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'mobile'>(
    'desktop'
  );
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [uploadingCrest, setUploadingCrest] = useState(false);
  const [uploadingHeroCover, setUploadingHeroCover] = useState(false);
  const [expandedModules, setExpandedModules] = useState<
    Record<string, boolean>
  >({
    news: true,
    notables: true,
    atlas: true,
  });
  const [addingModules, setAddingModules] = useState<Record<string, boolean>>(
    {}
  );

  // Quick Add Draft Inputs
  const [newNewsCategory, setNewNewsCategory] = useState<
    | 'مولود جديد'
    | 'عقد قران وزواج'
    | 'تخرج وإنجاز علمي'
    | 'ترقية وتكريم'
    | 'خبر عائلي'
  >('مولود جديد');
  const [newNewsTitle, setNewNewsTitle] = useState('');
  const [newNewsSummary, setNewNewsSummary] = useState('');
  const [newNewsImageUrl, setNewNewsImageUrl] = useState('');

  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventLocation, setNewEventLocation] = useState('');

  const [newStoryTitle, setNewStoryTitle] = useState('');
  const [newStoryEra, setNewStoryEra] = useState('');
  const [newStoryBody, setNewStoryBody] = useState('');
  const [newStoryImageUrl, setNewStoryImageUrl] = useState('');

  const [newNotableName, setNewNotableName] = useState('');
  const [newNotableRole, setNewNotableRole] = useState('');
  const [newNotableEra, setNewNotableEra] = useState('');
  const [newNotableBio, setNewNotableBio] = useState('');
  const [newNotableImageUrl, setNewNotableImageUrl] = useState('');

  const [newAudioTitle, setNewAudioTitle] = useState('');
  const [newAudioSpeaker, setNewAudioSpeaker] = useState('');
  const [newAudioYear, setNewAudioYear] = useState('');
  const [newAudioUrl, setNewAudioUrl] = useState('');
  const [newAudioExcerpt, setNewAudioExcerpt] = useState('');

  const [newLocCountry, setNewLocCountry] = useState(
    result.originCountry || 'السعودية'
  );
  const [newLocCity, setNewLocCity] = useState('');
  const [newLocCount, setNewLocCount] = useState<number>(5);

  const [newProfName, setNewProfName] = useState('');
  const [newProfSpecialty, setNewProfSpecialty] = useState('');
  const [newProfCategory, setNewProfCategory] = useState(
    'الطب والرعاية الصحية'
  );
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
  const [showRoyalQrModal, setShowRoyalQrModal] = useState(false);

  const crestFileRef = useRef<HTMLInputElement | null>(null);
  const heroCoverFileRef = useRef<HTMLInputElement | null>(null);

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
        const remoteTreeSettings =
          await fetchUserTreeDisplaySettingsFromFirebase(userId);
        if (mounted && remoteTreeSettings) {
          setLiveTreeDisplaySettings(
            normalizeTreeDisplaySettings(remoteTreeSettings)
          );
        }
      }

      const existingSite = await fetchPublishedMicrositeBySlug(defaultSlug);
      if (mounted && existingSite && existingSite.ownerId === userId) {
        setIsPublished(Boolean(existingSite.isPublished));
        setPreviousPublishedSlug(existingSite.siteSlug);
        setSiteAccessMode(existingSite.siteAccessMode || 'PUBLIC');
        if (existingSite.themeId) setThemeId(existingSite.themeId);
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

  // =========================================================================
  // CMS MUTATION HELPERS
  // =========================================================================
  const handleAddNews = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNewsTitle.trim()) return;
    setCmsModules((prev) => ({
      ...prev,
      newsModule: {
        ...prev.newsModule,
        enabled: true,
        items: [
          {
            id: `news_${Date.now()}`,
            category: newNewsCategory,
            title: newNewsTitle.trim(),
            summary: newNewsSummary.trim(),
            dateLabel: new Date().toLocaleDateString('ar-SA'),
            imageUrl: newNewsImageUrl || undefined,
            blessings: [],
          },
          ...prev.newsModule.items,
        ],
      },
    }));
    setNewNewsTitle('');
    setNewNewsSummary('');
    setNewNewsImageUrl('');
    setAddingModules((p) => ({ ...p, news: false }));
  };

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim() || !newEventDate) return;
    setCmsModules((prev) => ({
      ...prev,
      eventsModule: {
        ...prev.eventsModule,
        enabled: true,
        items: [
          {
            id: `ev_${Date.now()}`,
            title: newEventTitle.trim(),
            eventDateIso: newEventDate,
            locationLabel: newEventLocation.trim() || 'مجلس العائلة',
            rsvps: [],
          },
          ...prev.eventsModule.items,
        ],
      },
    }));
    setNewEventTitle('');
    setNewEventDate('');
    setNewEventLocation('');
    setAddingModules((p) => ({ ...p, events: false }));
  };

  const handleAddStory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoryTitle.trim() || !newStoryBody.trim()) return;
    setCmsModules((prev) => ({
      ...prev,
      storiesModule: {
        ...prev.storiesModule,
        enabled: true,
        items: [
          {
            id: `st_${Date.now()}`,
            title: newStoryTitle.trim(),
            eraOrYearLabel: newStoryEra.trim() || 'ذاكرة العائلة',
            body: newStoryBody.trim(),
            imageUrl: newStoryImageUrl || undefined,
          },
          ...prev.storiesModule.items,
        ],
      },
    }));
    setNewStoryTitle('');
    setNewStoryEra('');
    setNewStoryBody('');
    setNewStoryImageUrl('');
    setAddingModules((p) => ({ ...p, stories: false }));
  };

  const handleAddNotable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNotableName.trim()) return;
    setCmsModules((prev) => ({
      ...prev,
      notablesModule: {
        ...prev.notablesModule,
        enabled: true,
        items: [
          {
            id: `not_${Date.now()}`,
            fullName: newNotableName.trim(),
            roleOrTitle: newNotableRole.trim() || 'علم من أعلام العائلة',
            eraLabel: newNotableEra.trim(),
            achievementSummary: newNotableBio.trim(),
            imageUrl: newNotableImageUrl || undefined,
          },
          ...prev.notablesModule.items,
        ],
      },
    }));
    setNewNotableName('');
    setNewNotableRole('');
    setNewNotableEra('');
    setNewNotableBio('');
    setNewNotableImageUrl('');
    setAddingModules((p) => ({ ...p, notables: false }));
  };

  const handleAddLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocCity.trim()) return;
    setCmsModules((prev) => ({
      ...prev,
      atlasAndStatsModule: {
        ...prev.atlasAndStatsModule,
        enabled: true,
        locations: [
          ...prev.atlasAndStatsModule.locations,
          {
            id: `loc_${Date.now()}`,
            country: newLocCountry.trim() || 'السعودية',
            city: newLocCity.trim(),
            householdsOrMembersCount: Math.max(1, newLocCount || 1),
          },
        ],
      },
    }));
    setNewLocCity('');
    setNewLocCount(5);
    setAddingModules((p) => ({ ...p, atlas: false }));
  };

  const handleAddAudio = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAudioTitle.trim()) return;
    setCmsModules((prev) => ({
      ...prev,
      oralHeritageModule: {
        ...prev.oralHeritageModule,
        enabled: true,
        items: [
          {
            id: `aud_${Date.now()}`,
            title: newAudioTitle.trim(),
            speakerName: newAudioSpeaker.trim() || 'أحد كبار العائلة',
            recordedYearLabel: newAudioYear.trim() || 'أرشيف صوتي',
            audioDataOrUrl: newAudioUrl.trim() || undefined,
            transcriptExcerpt: newAudioExcerpt.trim(),
          },
          ...prev.oralHeritageModule.items,
        ],
      },
    }));
    setNewAudioTitle('');
    setNewAudioSpeaker('');
    setNewAudioYear('');
    setNewAudioUrl('');
    setNewAudioExcerpt('');
    setAddingModules((p) => ({ ...p, oral: false }));
  };

  const handleAddProfession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfName.trim() || !newProfSpecialty.trim()) return;
    setCmsModules((prev) => ({
      ...prev,
      professionsModule: {
        ...prev.professionsModule,
        enabled: true,
        items: [
          {
            id: `prof_${Date.now()}`,
            memberName: newProfName.trim(),
            fieldCategory: newProfCategory,
            specialtyOrProfession: newProfSpecialty.trim(),
            cityCountryLabel: newProfCity.trim() || undefined,
          },
          ...prev.professionsModule.items,
        ],
      },
    }));
    setNewProfName('');
    setNewProfSpecialty('');
    setNewProfCity('');
    setAddingModules((p) => ({ ...p, professions: false }));
  };

  const handleAddElder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newElderName.trim()) return;
    setCmsModules((prev) => ({
      ...prev,
      memorialAndCapsuleModule: {
        ...prev.memorialAndCapsuleModule,
        enabled: true,
        elders: [
          {
            id: `eld_${Date.now()}`,
            fullName: newElderName.trim(),
            passingYearLabel: newElderYear.trim() || 'رحمه الله',
            biographyNote: newElderBio.trim(),
            ongoingCharityTitle: newElderCharity.trim() || undefined,
            prayersCount: 0,
          },
          ...prev.memorialAndCapsuleModule.elders,
        ],
      },
    }));
    setNewElderName('');
    setNewElderYear('');
    setNewElderBio('');
    setNewElderCharity('');
    setAddingModules((p) => ({ ...p, memorial: false }));
  };

  const handleAddTopic = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicTitle.trim()) return;
    setCmsModules((prev) => ({
      ...prev,
      majlisAndGuardiansModule: {
        ...prev.majlisAndGuardiansModule,
        enabled: true,
        topics: [
          {
            id: `top_${Date.now()}`,
            title: newTopicTitle.trim(),
            promptQuestion: newTopicPrompt.trim(),
            isWeeklyElderPrompt: true,
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
    setAddingModules((p) => ({ ...p, majlis: false }));
  };

  const toggleExpanded = (key: string) =>
    setExpandedModules((prev) => ({ ...prev, [key]: !prev[key] }));
  const toggleAdding = (key: string) =>
    setAddingModules((prev) => ({ ...prev, [key]: !prev[key] }));

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
  const accessModeShortLabel =
    siteAccessMode === 'PUBLIC'
      ? 'عامة'
      : siteAccessMode === 'UNLISTED'
        ? 'غير مفهرس'
        : 'دائرة العائلة';

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

      {/* =================================================================== */}
      {/* UNIFIED WORKSPACE HEADER (Portal Title + Status/Copy URL + 40px CTAs)*/}
      {/* =================================================================== */}
      <UnifiedWorkspaceHeader
        testId="mysite-unified-header"
        icon={<Globe className="w-5 h-5" />}
        title={`موقع عائلة ${result.familyName}`}
        metaItems={[
          <span
            key="status"
            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-display font-bold border whitespace-nowrap ${
              isPublished
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-[#F5ECE0] border-[#D4AF37]/35 text-[#8C5327]'
            }`}
          >
            {isPublished ? 'منشور' : 'مسودة خاصة'}
          </span>,
          <button
            key="url"
            type="button"
            onClick={handleCopyPortalUrl}
            title="نسخ رابط البوابة بنقرة واحدة"
            className="inline-flex items-center gap-1.5 font-mono text-[12px] font-semibold text-[#5C4938] hover:text-[#9E5631] transition-colors cursor-pointer max-w-[260px]"
          >
            <span dir="ltr" className="truncate">
              {OFFICIAL_BRAND_HOST}/{cleanSlugDisplay}
            </span>
            {copiedUrl ? (
              <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-[#8C5327]/75 shrink-0" />
            )}
          </button>,
        ]}
        actions={
          <>
            <button
              type="button"
              onClick={() => setShowRoyalQrModal(true)}
              className={WORKSPACE_SECONDARY_BTN_CLASS}
            >
              <QrCode className="w-4 h-4 shrink-0" />
              <span>بطاقة الدعوة وQR</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setWorkspaceMode((m) =>
                  m === 'fullscreen_preview'
                    ? 'split_studio'
                    : 'fullscreen_preview'
                )
              }
              className={
                workspaceMode === 'fullscreen_preview'
                  ? WORKSPACE_SECONDARY_ACTIVE_BTN_CLASS
                  : WORKSPACE_SECONDARY_BTN_CLASS
              }
            >
              {workspaceMode === 'fullscreen_preview' ? (
                <>
                  <Palette className="w-4 h-4 shrink-0" />
                  <span>العودة للاستوديو</span>
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 shrink-0" />
                  <span>معاينة كاملة</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => handlePersistAndPublish(false)}
              className={WORKSPACE_SECONDARY_BTN_CLASS}
            >
              <Save className="w-4 h-4 shrink-0" />
              <span>حفظ مسودة</span>
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => handlePersistAndPublish(true)}
              className={WORKSPACE_PRIMARY_BTN_CLASS}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <Sparkles className="w-4 h-4 shrink-0" />
              )}
              <span>
                {isPublished ? 'تحديث ونشر الموقع' : 'نشر وتفعيل الموقع'}
              </span>
            </button>
          </>
        }
      />

      {/* Feedback & Eligibility Banner */}
      {feedbackBanner && (
        <div
          className={`rounded-2xl px-4 py-3 border text-xs font-bold flex flex-wrap items-center justify-between gap-2 ${
            feedbackBanner.tone === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : feedbackBanner.tone === 'warning'
                ? 'bg-amber-50 border-amber-300 text-amber-950'
                : 'bg-red-50 border-red-300 text-red-900'
          }`}
        >
          <span>{feedbackBanner.text}</span>
          <div className="flex items-center gap-2">
            {!caps.hasRegistrarBadge && onSignCharterAndEnableTree && (
              <button
                type="button"
                onClick={onSignCharterAndEnableTree}
                className="px-3 py-1 rounded-lg bg-[#252321] text-[#F3D299] text-[11px] font-bold cursor-pointer"
              >
                توقيع ميثاق أمين السجل
              </button>
            )}
            {!emailVerified && onOpenEmailVerification && (
              <button
                type="button"
                onClick={onOpenEmailVerification}
                className="px-3 py-1 rounded-lg bg-[#D8755B] text-white text-[11px] font-bold cursor-pointer"
              >
                تأكيد البريد الآن
              </button>
            )}
            {!caps.canPublishPublicSite && (
              <button
                type="button"
                onClick={onUpgradeAnnualVip}
                className="px-3 py-1 rounded-lg bg-[#8D4925] text-white text-[11px] font-bold cursor-pointer"
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
          <div className="rounded-2xl bg-[#FDFBF7] border border-[#E6DAC3] text-[#2C1E14] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-display font-bold text-[#8C5327]">
              <Eye className="w-4 h-4 text-[#9E5631]" />
              <span>معاينة حية لموقع عائلة {result.familyName}</span>
            </div>

            <div className="inline-flex rounded-xl bg-[#F5ECE0] border border-[#E2D5BE] p-1">
              <button
                type="button"
                onClick={() => setPreviewViewport('desktop')}
                className={`px-3 py-1 rounded-lg text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                  previewViewport === 'desktop'
                    ? 'bg-[#9E5631] text-white shadow-2xs'
                    : 'text-[#5C4938] hover:text-[#2C1E14]'
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
                    ? 'bg-[#9E5631] text-white shadow-2xs'
                    : 'text-[#5C4938] hover:text-[#2C1E14]'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>جوال</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setWorkspaceMode('split_studio')}
              className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-[#FAF5EC] border border-[#E2D5BE] text-[#3D2B1F] text-xs font-display font-bold cursor-pointer transition-colors"
            >
              العودة لاستوديو التخصيص
            </button>
          </div>

          <div
            className={
              previewViewport === 'mobile'
                ? 'max-w-[400px] mx-auto rounded-[2.2rem] border-[8px] border-[#252321] shadow-2xl overflow-hidden bg-white max-h-[82vh] overflow-y-auto'
                : 'rounded-3xl border border-[#C5A059]/45 shadow-xl overflow-hidden bg-white'
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
        /* MODE B: SPLIT STUDIO WORKSPACE + LIVE INTERACTIVE MINI-BROWSER    */
        /* ================================================================= */
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          {/* RIGHT: 4-TAB BESPOKE STUDIO CONTROLS */}
          <div className="xl:col-span-7 space-y-4">
            {/* Sleek 4-Tab Studio Bar (Warm Bronze & Gold Heritage Palette) */}
            <nav
              aria-label="أقسام استوديو موقعي"
              className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1.5 rounded-2xl bg-[#FDFBF7] border border-[#E6DAC3]"
            >
              {(
                [
                  {
                    id: 'identity_theme',
                    label: 'الهوية والمظهر',
                    icon: <Palette className="w-4 h-4" />,
                  },
                  {
                    id: 'mirror_privacy',
                    label: 'المرآة والخصوصية',
                    icon: <ShieldCheck className="w-4 h-4" />,
                  },
                  {
                    id: 'editorial_modules',
                    label: 'المحتوى التحريري',
                    icon: <BookOpen className="w-4 h-4" />,
                  },
                  {
                    id: 'heritage_community_modules',
                    label: 'الإرث والمجتمع',
                    icon: <Sparkles className="w-4 h-4" />,
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStudioTab(tab.id)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-display font-bold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                    studioTab === tab.id
                      ? 'bg-[#9E5631] text-white shadow-xs'
                      : 'text-[#5C4938] hover:bg-[#F5ECE0]/70 hover:text-[#2C1E14]'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>

            {/* ------------------------------------------------------------- */}
            {/* TAB 1: CALM LUXURY COLLAPSIBLE INSPECTOR (5 SLEEK SECTIONS)   */}
            {/* ------------------------------------------------------------- */}
            {studioTab === 'identity_theme' && (
              <div className="space-y-3">
                {/* 1. عنوان الرابط المباشر ونطاق الوصول */}
                <CalmInspectorAccordion
                  id="url_access"
                  icon={<Globe className="w-4 h-4" />}
                  title="عنوان الرابط المباشر ونطاق الوصول"
                  isOpen={activeIdentitySection === 'url_access'}
                  onToggle={() => toggleIdentitySection('url_access')}
                  summary={
                    <>
                      <span
                        dir="ltr"
                        className="font-mono text-[10.5px] text-[#5C4938] truncate"
                      >
                        {OFFICIAL_BRAND_HOST}/{cleanSlugDisplay}
                      </span>
                      <span className="text-[#C5A059] shrink-0">·</span>
                      <span className="text-[10.5px] text-[#8C5327] shrink-0">
                        {accessModeShortLabel}
                      </span>
                    </>
                  }
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-display font-bold text-[#7A5C43]">
                        الرابط الرسمي لبوابة العائلة
                      </span>
                      {slugStatus.message && (
                        <span
                          className={`text-[11px] font-bold ${
                            slugStatus.available
                              ? 'text-emerald-700'
                              : 'text-red-700'
                          }`}
                        >
                          {slugStatus.message}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div
                        dir="ltr"
                        className="flex-1 flex items-center rounded-xl bg-[#FCF9F3] border border-[#E6DAC3] overflow-hidden focus-within:bg-white focus-within:border-[#C5A059] transition-colors"
                      >
                        <span className="px-3 py-2 text-xs font-mono font-bold text-[#8C5327] bg-[#F5EFE4] border-r border-[#E6DAC3] select-none shrink-0">
                          {OFFICIAL_BRAND_HOST}/
                        </span>
                        <input
                          type="text"
                          value={siteSlug}
                          onChange={(e) => setSiteSlug(e.target.value)}
                          className="flex-1 min-w-0 px-3 py-2 bg-transparent text-xs font-mono font-bold text-[#2C1E14] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleCopyPortalUrl}
                          title="نسخ الرابط"
                          className="px-2.5 py-2 text-[#8C5327] hover:text-[#9E5631] transition-colors cursor-pointer shrink-0"
                        >
                          {copiedUrl ? (
                            <Check className="w-3.5 h-3.5 text-emerald-700" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={handleCheckSlug}
                        disabled={slugStatus.checking}
                        className="px-4 py-2 rounded-xl bg-[#9E5631] hover:bg-[#844524] text-white text-xs font-display font-bold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
                      >
                        {slugStatus.checking ? 'جاري الفحص...' : 'فحص التوفر'}
                      </button>
                    </div>
                  </div>

                  {/* Access Scope Compact Selector */}
                  <div className="pt-3 border-t border-[#F0E8DA] space-y-2">
                    <span className="text-[11px] font-display font-bold text-[#7A5C43] block">
                      نطاق الوصول والظهور
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {(
                        [
                          {
                            id: 'PUBLIC',
                            label: 'بوابة عامة',
                            desc: 'متاحة للزوار والرابط المباشر',
                          },
                          {
                            id: 'UNLISTED',
                            label: 'رابط غير مفهرس',
                            desc: 'لمن يملك الرابط أو البطاقة فقط',
                          },
                          {
                            id: 'PRIVATE_WHITELIST',
                            label: 'دائرة العائلة فقط',
                            desc: 'للأقارب المدعوين حصراً',
                          },
                        ] as const
                      ).map((opt) => {
                        const active = siteAccessMode === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setSiteAccessMode(opt.id)}
                            className={`rounded-xl border px-3 py-2.5 text-right transition-all cursor-pointer ${
                              active
                                ? 'bg-[#FDF9F0] border-[#C5A059] ring-1 ring-[#C5A059]/25'
                                : 'bg-white hover:bg-[#FAF6EE] border-[#E6DAC3]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="text-xs font-display font-extrabold text-[#2C1E14]">
                                {opt.label}
                              </span>
                              {active && (
                                <Check className="w-3.5 h-3.5 text-[#9E5631] shrink-0" />
                              )}
                            </div>
                            <div className="text-[10.5px] text-[#6B5A49] mt-0.5 leading-snug">
                              {opt.desc}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </CalmInspectorAccordion>

                {/* 2. الهوية اللونية والخط التراثي */}
                <CalmInspectorAccordion
                  id="theme_typography"
                  icon={<Palette className="w-4 h-4" />}
                  title="الهوية اللونية والخط التراثي"
                  isOpen={activeIdentitySection === 'theme_typography'}
                  onToggle={() => toggleIdentitySection('theme_typography')}
                  summary={
                    <>
                      <span
                        className="inline-flex items-center -space-x-1 space-x-reverse shrink-0"
                        aria-hidden="true"
                      >
                        <span
                          className="w-3 h-3 rounded-full ring-1 ring-white"
                          style={{ backgroundColor: activeThemeDef.swatchHero }}
                        />
                        <span
                          className="w-3 h-3 rounded-full ring-1 ring-white"
                          style={{
                            backgroundColor: activeThemeDef.swatchAccent,
                          }}
                        />
                        <span
                          className="w-3 h-3 rounded-full ring-1 ring-white border border-black/10"
                          style={{
                            backgroundColor: activeThemeDef.swatchCanvas,
                          }}
                        />
                      </span>
                      <span className="truncate">{activeThemeDef.nameAr}</span>
                      <span className="hidden sm:inline text-[#C5A059] shrink-0">
                        ·
                      </span>
                      <span className="hidden sm:inline text-[10.5px] text-[#8C5327] truncate">
                        {activeTypographyOption.label}
                      </span>
                    </>
                  }
                >
                  {/* 5 Calm Ivory Horizontal Theme Swatch Cards */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-display font-bold text-[#7A5C43]">
                        القالب اللوني للموقع
                      </span>
                      <span className="text-[10.5px] text-[#8C7A68]">
                        ينعكس فوراً في المعاينة الحية
                      </span>
                    </div>

                    <div className="space-y-2">
                      {FAMILY_SITE_THEMES.map((theme) => {
                        const selected = themeId === theme.id;
                        return (
                          <button
                            key={theme.id}
                            type="button"
                            onClick={() => setThemeId(theme.id)}
                            className={`w-full rounded-xl border px-3.5 py-2.5 flex items-center justify-between gap-3 text-right transition-all duration-150 cursor-pointer ${
                              selected
                                ? 'bg-[#FDF9F0] border-[#C5A059] ring-1 ring-[#C5A059]/30 shadow-2xs'
                                : 'bg-white hover:bg-[#FAF6EE] border-[#E6DAC3] hover:border-[#D4B988]'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {/* Overlapping Color Palette Trio Dots */}
                              <div
                                className="flex items-center -space-x-1.5 space-x-reverse shrink-0"
                                aria-hidden="true"
                              >
                                <span
                                  className="w-5 h-5 rounded-full ring-2 ring-white shadow-2xs"
                                  style={{ backgroundColor: theme.swatchHero }}
                                />
                                <span
                                  className="w-5 h-5 rounded-full ring-2 ring-white shadow-2xs"
                                  style={{
                                    backgroundColor: theme.swatchAccent,
                                  }}
                                />
                                <span
                                  className="w-5 h-5 rounded-full ring-2 ring-white border border-black/10 shadow-2xs"
                                  style={{
                                    backgroundColor: theme.swatchCanvas,
                                  }}
                                />
                              </div>

                              <div className="min-w-0">
                                <div className="text-xs font-display font-extrabold text-[#2C1E14] truncate">
                                  {theme.nameAr}
                                </div>
                                <div className="text-[11px] text-[#6B5A49] truncate mt-0.5">
                                  {theme.subtitleAr}
                                </div>
                              </div>
                            </div>

                            <span
                              className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                                selected
                                  ? 'bg-[#C5A059]/18 border border-[#C5A059] text-[#8C5327]'
                                  : 'border border-[#E2D6C2] text-transparent'
                              }`}
                            >
                              <Check className="w-3 h-3" />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Integrated Arabic Typography Selector (3 Live-Font Pills) */}
                  <div className="pt-3.5 border-t border-[#F0E8DA] space-y-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-display font-bold text-[#7A5C43]">
                      <Type className="w-3.5 h-3.5 text-[#9E5631]" />
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
                              setVisualBranding((p) => ({
                                ...p,
                                typographyId: tp.id,
                              }))
                            }
                            className={`rounded-xl border px-3 py-2.5 text-right transition-all cursor-pointer ${
                              active
                                ? 'bg-[#FDF9F0] border-[#C5A059] ring-1 ring-[#C5A059]/25'
                                : 'bg-white hover:bg-[#FAF6EE] border-[#E6DAC3] hover:border-[#D4B988]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <span
                                className="text-[15px] font-bold text-[#2C1E14] leading-snug truncate"
                                style={{ fontFamily: tp.fontCss }}
                              >
                                {tp.label}
                              </span>
                              {active && (
                                <Check className="w-3.5 h-3.5 text-[#9E5631] shrink-0" />
                              )}
                            </div>
                            <p className="text-[10.5px] text-[#6B5A49] truncate mt-1">
                              {tp.subtitle}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </CalmInspectorAccordion>

                {/* 3. ختم وشعار العائلة */}
                <CalmInspectorAccordion
                  id="family_crest"
                  icon={<ShieldCheck className="w-4 h-4" />}
                  title="ختم وشعار العائلة"
                  isOpen={activeIdentitySection === 'family_crest'}
                  onToggle={() => toggleIdentitySection('family_crest')}
                  summary={
                    <>
                      <span
                        className="w-2 h-2 rounded-full bg-[#C5A059] shrink-0"
                        aria-hidden="true"
                      />
                      <span className="truncate">
                        {visualBranding.crestMode === 'custom_image'
                          ? 'شعار خاص مرفوع'
                          : activeCrestOption.label}
                      </span>
                    </>
                  }
                >
                  {/* Clean Segmented Pill Mode Switch */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="inline-flex rounded-xl bg-[#F5EFE4] p-1 border border-[#E6DAC3]">
                      <button
                        type="button"
                        onClick={() =>
                          setVisualBranding((p) => ({
                            ...p,
                            crestMode: 'auto_gilded',
                          }))
                        }
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-display font-bold transition-all cursor-pointer whitespace-nowrap ${
                          visualBranding.crestMode === 'auto_gilded'
                            ? 'bg-white text-[#8C5327] border border-[#D4AF37]/45 shadow-2xs'
                            : 'text-[#6B5A49] hover:text-[#2C1E14] border border-transparent'
                        }`}
                      >
                        توليد ختم مذهّب تلقائي
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setVisualBranding((p) => ({
                            ...p,
                            crestMode: 'custom_image',
                          }))
                        }
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-display font-bold transition-all cursor-pointer whitespace-nowrap ${
                          visualBranding.crestMode === 'custom_image'
                            ? 'bg-white text-[#8C5327] border border-[#D4AF37]/45 shadow-2xs'
                            : 'text-[#6B5A49] hover:text-[#2C1E14] border border-transparent'
                        }`}
                      >
                        رفع شعار خاص
                      </button>
                    </div>
                  </div>

                  {visualBranding.crestMode === 'auto_gilded' ? (
                    /* Single Balanced Row of 4 Ivory Medallions */
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {CREST_STYLE_OPTIONS.map((opt) => {
                        const active = visualBranding.crestStyle === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() =>
                              setVisualBranding((p) => ({
                                ...p,
                                crestStyle: opt.id,
                              }))
                            }
                            className={`relative rounded-2xl border p-3 flex flex-col items-center text-center gap-2 transition-all cursor-pointer ${
                              active
                                ? 'bg-[#FDF9F0] border-[#C5A059] ring-1 ring-[#C5A059]/30 shadow-2xs'
                                : 'bg-white hover:bg-[#FAF6EE] border-[#E6DAC3] hover:border-[#D4B988]'
                            }`}
                          >
                            {active && (
                              <span className="absolute top-2 left-2 w-4 h-4 rounded-full bg-[#C5A059]/20 border border-[#C5A059] text-[#8C5327] flex items-center justify-center">
                                <Check className="w-2.5 h-2.5" />
                              </span>
                            )}
                            <FamilyCrestEmblem
                              familyName={result.familyName}
                              crestMode="auto_gilded"
                              crestStyle={opt.id}
                              size="sm"
                              tone="ivory"
                            />
                            <span className="text-[11px] font-display font-bold text-[#2C1E14] leading-snug">
                              {opt.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl bg-[#FAF6EE] border border-dashed border-[#D4B988] p-3.5 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <FamilyCrestEmblem
                          familyName={result.familyName}
                          crestMode={visualBranding.crestMode}
                          crestStyle={visualBranding.crestStyle}
                          customCrestUrl={visualBranding.customCrestUrl}
                          size="md"
                          tone="ivory"
                        />
                        <div className="space-y-0.5">
                          <div className="text-xs font-display font-extrabold text-[#2C1E14]">
                            شعار العائلة المخصص
                          </div>
                          <p className="text-[11px] text-[#6B5A49]">
                            يفضل صورة مربعة عالية الدقة بخلفية صافية أو شفافة.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={uploadingCrest}
                        onClick={() => crestFileRef.current?.click()}
                        className="px-3.5 py-2 rounded-xl bg-[#9E5631] hover:bg-[#844524] text-white text-xs font-display font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>
                          {uploadingCrest
                            ? 'جاري الرفع...'
                            : 'اختيار صورة الشعار'}
                        </span>
                      </button>
                    </div>
                  )}
                </CalmInspectorAccordion>

                {/* 4. غلاف وتخطيط واجهة الترحيب */}
                <CalmInspectorAccordion
                  id="hero_cover"
                  icon={<ImageIcon className="w-4 h-4" />}
                  title="غلاف وتخطيط واجهة الترحيب"
                  isOpen={activeIdentitySection === 'hero_cover'}
                  onToggle={() => toggleIdentitySection('hero_cover')}
                  summary={
                    <>
                      {visualBranding.heroCoverMode === 'custom_image' &&
                      visualBranding.customHeroCoverUrl ? (
                        <img
                          src={visualBranding.customHeroCoverUrl}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="w-3.5 h-3.5 rounded object-cover border border-black/15 shrink-0"
                        />
                      ) : (
                        <span
                          className="w-3.5 h-3.5 rounded border border-black/15 shrink-0"
                          style={{ background: activeHeroPreset.previewGradient }}
                          aria-hidden="true"
                        />
                      )}
                      <span className="truncate">
                        {visualBranding.heroCoverMode === 'custom_image'
                          ? 'غلاف خاص'
                          : activeHeroPreset.label}
                      </span>
                    </>
                  }
                >
                  {/* 6 Compact Rounded Swatches (54px height, 1 balanced row) */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-display font-bold text-[#7A5C43]">
                        خلفيات معمارية وتراثية
                      </span>
                      <button
                        type="button"
                        disabled={uploadingHeroCover}
                        onClick={() => heroCoverFileRef.current?.click()}
                        className="h-8 px-3 rounded-xl bg-white hover:bg-[#FAF6EE] border border-[#DCCEB5] text-[11px] font-display font-bold text-[#8C5327] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#9E5631]" />
                        <span>
                          {uploadingHeroCover
                            ? 'جاري الرفع...'
                            : 'رفع صورة غلاف'}
                        </span>
                      </button>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                      {HERO_COVER_PRESET_OPTIONS.map((preset) => {
                        const active =
                          visualBranding.heroCoverMode === 'preset' &&
                          visualBranding.heroCoverPreset === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            title={`${preset.label} — ${preset.subtitle}`}
                            onClick={() =>
                              setVisualBranding((p) => ({
                                ...p,
                                heroCoverMode: 'preset',
                                heroCoverPreset: preset.id,
                              }))
                            }
                            className="group flex flex-col items-center gap-1.5 text-center cursor-pointer focus-visible:outline-none"
                          >
                            <div
                              className={`h-[54px] w-full rounded-xl relative overflow-hidden transition-all duration-150 ${
                                active
                                  ? 'ring-2 ring-[#C5A059] ring-offset-2 ring-offset-[#FFFDF9] shadow-sm'
                                  : 'border border-black/10 group-hover:ring-1 group-hover:ring-[#C5A059]/70'
                              }`}
                              style={{ background: preset.previewGradient }}
                            >
                              {active && (
                                <span className="absolute top-1.5 left-1.5 w-4 h-4 rounded-full bg-[#FFFDF9]/95 text-[#8C5327] shadow-xs flex items-center justify-center">
                                  <Check className="w-2.5 h-2.5" />
                                </span>
                              )}
                            </div>
                            <span
                              className={`text-[10px] font-display truncate w-full leading-tight ${
                                active
                                  ? 'font-extrabold text-[#8C5327]'
                                  : 'font-semibold text-[#5C4938]'
                              }`}
                            >
                              {preset.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {visualBranding.heroCoverMode === 'custom_image' &&
                      visualBranding.customHeroCoverUrl && (
                        <div className="rounded-xl bg-[#FAF6EE] border border-[#D4AF37]/45 px-3 py-2 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={visualBranding.customHeroCoverUrl}
                              alt="غلاف الواجهة المخصص"
                              referrerPolicy="no-referrer"
                              className="w-12 h-8 rounded-lg object-cover border border-[#E6DAC3] shrink-0"
                            />
                            <span className="text-[11px] font-display font-bold text-[#2C1E14] truncate">
                              تم تفعيل صورة الغلاف المخصصة
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setVisualBranding((p) => ({
                                ...p,
                                heroCoverMode: 'preset',
                              }))
                            }
                            className="text-[11px] font-display font-bold text-[#9E5631] hover:underline cursor-pointer shrink-0"
                          >
                            استعادة الجاهزة
                          </button>
                        </div>
                      )}
                  </div>

                  {/* Hero Layout & Overlay Opacity */}
                  <div className="pt-3.5 border-t border-[#F0E8DA] space-y-3">
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-display font-bold text-[#7A5C43] block">
                        تخطيط واجهة الترحيب
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {HERO_LAYOUT_OPTIONS.map((lay) => {
                          const active = visualBranding.heroLayout === lay.id;
                          return (
                            <button
                              key={lay.id}
                              type="button"
                              onClick={() =>
                                setVisualBranding((p) => ({
                                  ...p,
                                  heroLayout: lay.id,
                                }))
                              }
                              className={`rounded-xl border px-3 py-2.5 text-right transition-all cursor-pointer ${
                                active
                                  ? 'bg-[#FDF9F0] border-[#C5A059] ring-1 ring-[#C5A059]/25'
                                  : 'bg-white hover:bg-[#FAF6EE] border-[#E6DAC3] hover:border-[#D4B988]'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1.5">
                                <span className="text-xs font-display font-extrabold text-[#2C1E14]">
                                  {lay.label}
                                </span>
                                {active && (
                                  <Check className="w-3.5 h-3.5 text-[#9E5631] shrink-0" />
                                )}
                              </div>
                              <div className="text-[10.5px] text-[#6B5A49] mt-0.5 leading-snug">
                                {lay.subtitle}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Sleek Overlay Scrim Slider */}
                    <div className="rounded-xl bg-[#FAF6EE] border border-[#EAE0CE] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3">
                      <span className="text-[11px] font-display font-bold text-[#4A3A2B]">
                        درجة تعتيم الغلاف لوضوح العنوان
                      </span>
                      <div className="flex items-center gap-3 flex-1 min-w-[150px] max-w-xs">
                        <input
                          type="range"
                          min={10}
                          max={85}
                          value={visualBranding.heroOverlayIntensity}
                          onChange={(e) =>
                            setVisualBranding((p) => ({
                              ...p,
                              heroOverlayIntensity: Number(e.target.value),
                            }))
                          }
                          className="flex-1 accent-[#9E5631] cursor-pointer"
                        />
                        <span className="text-xs font-display font-extrabold text-[#8C5327] tabular-nums w-9 text-left">
                          {visualBranding.heroOverlayIntensity}%
                        </span>
                      </div>
                    </div>
                  </div>
                </CalmInspectorAccordion>

                {/* 5. البيانات التعريفية وكلمة عميد العائلة */}
                <CalmInspectorAccordion
                  id="editorial_identity"
                  icon={<Quote className="w-4 h-4" />}
                  title="البيانات التعريفية وكلمة عميد العائلة"
                  isOpen={activeIdentitySection === 'editorial_identity'}
                  onToggle={() => toggleIdentitySection('editorial_identity')}
                  summary={
                    <>
                      <span className="truncate">
                        {bioTitle || `موقع عائلة ${result.familyName}`}
                      </span>
                      {visualBranding.patriarchQuote.enabled && (
                        <>
                          <span className="text-[#C5A059] shrink-0">·</span>
                          <span className="text-[10.5px] text-[#8C5327] shrink-0">
                            كلمة العميد
                          </span>
                        </>
                      )}
                    </>
                  }
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-display font-bold text-[#7A5C43]">
                        العنوان الرئيسي للبوابة
                      </label>
                      <input
                        type="text"
                        value={bioTitle}
                        onChange={(e) => setBioTitle(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-[#FCF9F3] focus:bg-white border border-[#E6DAC3] focus:border-[#C5A059] text-xs font-bold text-[#2C1E14] focus:outline-none transition-colors"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-display font-bold text-[#7A5C43]">
                        الشعار الترحيبي أعلى العنوان
                      </label>
                      <input
                        type="text"
                        value={emblemTag}
                        onChange={(e) => setEmblemTag(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-[#FCF9F3] focus:bg-white border border-[#E6DAC3] focus:border-[#C5A059] text-xs font-bold text-[#2C1E14] focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-display font-bold text-[#7A5C43]">
                      النبذة التعريفية للعائلة
                    </label>
                    <textarea
                      rows={3}
                      value={bioDescription}
                      onChange={(e) => setBioDescription(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#FCF9F3] focus:bg-white border border-[#E6DAC3] focus:border-[#C5A059] text-xs text-[#2C1E14] leading-relaxed focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Patriarch Welcome Quote Block */}
                  <div className="rounded-xl bg-[#FAF6EE]/85 border border-[#E6DAC3] p-3.5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Quote className="w-4 h-4 text-[#C5A059] shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-display font-extrabold text-[#2C1E14]">
                            كلمة ترحيبية أو وصية عميد العائلة
                          </div>
                          <div className="text-[10.5px] text-[#6B5A49]">
                            تظهر في قسم اقتباس مذهّب مباشرة أسفل واجهة الترحيب.
                          </div>
                        </div>
                      </div>
                      <ModernSwitch
                        checked={visualBranding.patriarchQuote.enabled}
                        onChange={(next) =>
                          setVisualBranding((p) => ({
                            ...p,
                            patriarchQuote: {
                              ...p.patriarchQuote,
                              enabled: next,
                            },
                          }))
                        }
                        ariaLabel="تفعيل كلمة عميد العائلة"
                      />
                    </div>

                    {visualBranding.patriarchQuote.enabled && (
                      <div className="space-y-2.5 pt-1">
                        <textarea
                          rows={2}
                          value={visualBranding.patriarchQuote.text}
                          onChange={(e) =>
                            setVisualBranding((p) => ({
                              ...p,
                              patriarchQuote: {
                                ...p.patriarchQuote,
                                text: e.target.value,
                              },
                            }))
                          }
                          placeholder="اكتب كلمة ترحيبية أو وصية تجمع أبناء العائلة على البرّ وصلة الرحم..."
                          className="w-full px-3 py-2 rounded-xl bg-white border border-[#E6DAC3] focus:border-[#C5A059] text-xs text-[#2C1E14] focus:outline-none"
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={visualBranding.patriarchQuote.authorName}
                            onChange={(e) =>
                              setVisualBranding((p) => ({
                                ...p,
                                patriarchQuote: {
                                  ...p.patriarchQuote,
                                  authorName: e.target.value,
                                },
                              }))
                            }
                            placeholder="اسم قائل الكلمة"
                            className="px-3 py-2 rounded-xl bg-white border border-[#E6DAC3] focus:border-[#C5A059] text-xs font-bold text-[#2C1E14] focus:outline-none"
                          />
                          <input
                            type="text"
                            value={visualBranding.patriarchQuote.authorTitle}
                            onChange={(e) =>
                              setVisualBranding((p) => ({
                                ...p,
                                patriarchQuote: {
                                  ...p.patriarchQuote,
                                  authorTitle: e.target.value,
                                },
                              }))
                            }
                            placeholder="الصفة (مثال: عميد العائلة)"
                            className="px-3 py-2 rounded-xl bg-white border border-[#E6DAC3] focus:border-[#C5A059] text-xs text-[#2C1E14] focus:outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Preserved Section Display Order Sub-Drawer */}
                  <div className="pt-3 border-t border-[#F0E8DA] space-y-2.5">
                    <button
                      type="button"
                      onClick={() => setShowSectionOrderDrawer((v) => !v)}
                      className="w-full flex items-center justify-between gap-2 text-right px-3 py-2 rounded-xl bg-[#FAF6EE]/70 hover:bg-[#FAF6EE] border border-[#E6DAC3] transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2 text-xs font-display font-bold text-[#4A3A2B]">
                        <Layers className="w-3.5 h-3.5 text-[#9E5631]" />
                        <span>ترتيب ظهور أقسام الموقع</span>
                      </span>
                      <span className="flex items-center gap-1.5 text-[11px] font-display font-bold text-[#8C5327]">
                        <span className="tabular-nums">
                          {visualBranding.sectionOrder.length} قسماً
                        </span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform duration-200 ${
                            showSectionOrderDrawer ? 'rotate-180' : ''
                          }`}
                        />
                      </span>
                    </button>

                    {showSectionOrderDrawer && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {visualBranding.sectionOrder.map((secKey, idx) => (
                          <div
                            key={secKey}
                            className="rounded-xl bg-white border border-[#E6DAC3] px-3 py-2 flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-5 h-5 rounded-md bg-[#FAF6EE] border border-[#E6DAC3] text-[10px] font-bold text-[#8C5327] flex items-center justify-center tabular-nums shrink-0">
                                {idx + 1}
                              </span>
                              <span className="font-display font-bold text-[#2C1E14] truncate">
                                {PORTAL_SECTION_LABELS[secKey]}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() =>
                                  handleMoveSectionOrder(secKey, 'up')
                                }
                                title="تقديم للأعلى"
                                className="w-6 h-6 rounded-md bg-[#FAF6EE] hover:bg-[#EFE6D7] border border-[#E6DAC3] flex items-center justify-center disabled:opacity-35 cursor-pointer"
                              >
                                <ArrowUp className="w-3 h-3 text-[#5C4938]" />
                              </button>
                              <button
                                type="button"
                                disabled={
                                  idx === visualBranding.sectionOrder.length - 1
                                }
                                onClick={() =>
                                  handleMoveSectionOrder(secKey, 'down')
                                }
                                title="تأخير للأسفل"
                                className="w-6 h-6 rounded-md bg-[#FAF6EE] hover:bg-[#EFE6D7] border border-[#E6DAC3] flex items-center justify-center disabled:opacity-35 cursor-pointer"
                              >
                                <ArrowDown className="w-3 h-3 text-[#5C4938]" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CalmInspectorAccordion>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* TAB 2: MIRROR, PRIVACY MATRIX & VAULT CURATION                */}
            {/* ------------------------------------------------------------- */}
            {studioTab === 'mirror_privacy' && (
              <div className="space-y-4">
                {/* 2A. Portal Access Mode */}
                <section className="rounded-2xl bg-[#FFFDF9] border border-[#E5DAC8] p-4 sm:p-5 space-y-3">
                  <h3 className="text-sm font-display font-extrabold text-[#252321] flex items-center gap-2">
                    <Lock className="w-4 h-4 text-[#D8755B]" />
                    <span>نطاق الدخول والخصوصية العام للبوابة</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {(
                      [
                        {
                          id: 'PUBLIC',
                          label: 'بوابة عامة',
                          desc: 'متاحة للزوار والباحثين والرابط المباشر',
                        },
                        {
                          id: 'UNLISTED',
                          label: 'رابط خاص غير مفهرس',
                          desc: 'يفتح فقط لمن يملك الرابط المباشر أو QR',
                        },
                        {
                          id: 'PRIVATE_WHITELIST',
                          label: 'دائرة العائلة فقط',
                          desc: 'محمية بقائمة بريد الأقارب المدعوين',
                        },
                      ] as const
                    ).map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setSiteAccessMode(mode.id)}
                        className={`rounded-xl border-2 p-3 text-right cursor-pointer transition-all ${
                          siteAccessMode === mode.id
                            ? 'border-[#C5A059] bg-[#FBF3E0]/55'
                            : 'border-[#E5DAC8] bg-[#FAF6F0]/45 hover:border-[#C5A059]/60'
                        }`}
                      >
                        <div className="text-xs font-display font-extrabold text-[#252321]">
                          {mode.label}
                        </div>
                        <div className="text-[10.5px] text-[#252321]/65 mt-0.5">
                          {mode.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </section>

                {/* 2B. Tree Mirror & Female / Living Privacy Controls */}
                <section className="rounded-2xl bg-[#FFFDF9] border border-[#E5DAC8] p-4 sm:p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-display font-extrabold text-[#252321] flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-[#D8755B]" />
                      <span>إعدادات مرآة شجرة العائلة والخصوصية</span>
                    </h3>
                    <VisibilityPillSelector
                      value={treeVisibility}
                      onChange={setTreeVisibility}
                    />
                  </div>

                  {/* Single Source of Truth Banner → Direct Shortcut to «إعدادات شجرتي» */}
                  <div className="rounded-xl border border-[#DFCCA8] bg-gradient-to-l from-[#FBF4E4]/90 to-[#FFFDF9] px-3.5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-[#F5E6C8] border border-[#D4AF6A]/60 text-[#8D4925] flex items-center justify-center shrink-0 mt-0.5">
                        <SlidersHorizontal className="w-4 h-4" />
                      </div>
                      <p className="text-xs leading-relaxed text-[#4A3B2C] font-medium">
                        يتم عرض الشجرة بنفس التصميم والخطوط والألوان والحقول
                        المعتمدة في{' '}
                        <span className="font-display font-extrabold text-[#7B401F]">
                          إعدادات شجرتي
                        </span>
                      </p>
                    </div>
                    {onOpenTreeSettings && (
                      <button
                        type="button"
                        onClick={onOpenTreeSettings}
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#8D4925] hover:bg-[#733A1C] text-white text-xs font-display font-bold shadow-xs transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                      >
                        <span>فتح إعدادات شجرتي</span>
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* 4 Female Display Policies */}
                  <div className="space-y-2">
                    <div className="text-xs font-display font-bold text-[#8D4925]">
                      سياسة عرض أسماء الإناث في الشجرة العامة:
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(
                        [
                          {
                            id: 'SHOW_ALL',
                            label: 'إظهار الأسماء كاملة',
                            desc: 'عرض أسماء بنات وأمهات العائلة بوضوح',
                          },
                          {
                            id: 'SYMBOLIC_TITLE',
                            label: 'إظهار بلقب رمزي وقور',
                            desc: 'مثل «كريمة فلان» حفاظاً على الخصوصية',
                          },
                          {
                            id: 'FAMILY_CIRCLE_ONLY',
                            label: 'لأفراد دائرة العائلة فقط',
                            desc: 'تظهر للعائلة وتُحجب عن الزوار العامين',
                          },
                          {
                            id: 'HIDE_ALL',
                            label: 'إخفاء تام من المرآة العامة',
                            desc: 'تبقى محفوظة في شجرتك الخاصة فقط',
                          },
                        ] as const
                      ).map((pol) => (
                        <button
                          key={pol.id}
                          type="button"
                          onClick={() => setFemaleDisplayPolicy(pol.id)}
                          className={`rounded-xl border p-2.5 text-right cursor-pointer transition-all ${
                            femaleDisplayPolicy === pol.id
                              ? 'border-[#C5A059] bg-[#FBF3E0]/55'
                              : 'border-[#E5DAC8] bg-[#FAF6F0]/45'
                          }`}
                        >
                          <div className="text-xs font-display font-bold text-[#252321]">
                            {pol.label}
                          </div>
                          <div className="text-[10.5px] text-[#252321]/60">
                            {pol.desc}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Living Privacy Switches */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#F0E9DD]">
                    <div className="rounded-xl bg-[#FAF6F0] border border-[#E5DAC8] px-3.5 py-2.5 flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#252321]">
                        حجب أسماء الأحياء عن الزوار
                      </span>
                      <ModernSwitch
                        checked={hideLivingNamesForGuests}
                        onChange={setHideLivingNamesForGuests}
                        ariaLabel="حجب أسماء الأحياء عن الزوار"
                      />
                    </div>
                    <div className="rounded-xl bg-[#FAF6F0] border border-[#E5DAC8] px-3.5 py-2.5 flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#252321]">
                        إخفاء سنوات ميلاد الأحياء
                      </span>
                      <ModernSwitch
                        checked={hideLivingBirthDates}
                        onChange={setHideLivingBirthDates}
                        ariaLabel="إخفاء سنوات ميلاد الأحياء"
                      />
                    </div>
                  </div>

                  {/* Start Root Person & Excluded Branches */}
                  {contemporaryOnlyMembers.length > 0 && (
                    <div className="space-y-3 pt-2 border-t border-[#F0E9DD]">
                      <div className="space-y-1">
                        <label className="text-xs font-display font-bold text-[#8D4925]">
                          نقطة البداية في المرآة العامة (الجد المؤسس الظاهر):
                        </label>
                        <select
                          value={startRootPersonId}
                          onChange={(e) => setStartRootPersonId(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E5DAC8] text-xs font-bold text-[#252321]"
                        >
                          <option value="">
                            عرض كافة الأجيال المعاصرة تلقائياً
                          </option>
                          {contemporaryOnlyMembers.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.firstName} ({m.relationLabel})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <div className="text-xs font-display font-bold text-[#8D4925]">
                          استثناء فروع محددة من العرض العام (اختياري):
                        </div>
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                          {contemporaryOnlyMembers.slice(0, 30).map((m) => {
                            const excluded = excludedBranchRootIds.includes(
                              m.id
                            );
                            return (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() =>
                                  setExcludedBranchRootIds((prev) =>
                                    excluded
                                      ? prev.filter((id) => id !== m.id)
                                      : [...prev, m.id]
                                  )
                                }
                                className={`px-2.5 py-1 rounded-full text-[11px] font-bold border cursor-pointer ${
                                  excluded
                                    ? 'bg-red-50 border-red-300 text-red-800'
                                    : 'bg-[#FAF6F0] border-[#E5DAC8] text-[#252321]'
                                }`}
                              >
                                {excluded ? '✕ مستثنى: ' : ''}
                                {m.firstName}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Strict Lineage Isolation Reassurance */}
                  <div className="rounded-xl bg-[#FBF3E0]/70 border border-[#C5A059]/45 px-3.5 py-2.5 text-[11px] font-semibold text-[#8D4925] flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>
                      حماية محكمة: عمود النسب التاريخي والمصادر المحققة معزولة تماماً ولا تُعرض أبداً في البوابة العامة.
                    </span>
                  </div>
                </section>

                {/* 2C. Vault Gallery Selection & Watermark */}
                <section className="rounded-2xl bg-[#FFFDF9] border border-[#E5DAC8] p-4 sm:p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-display font-extrabold text-[#252321] flex items-center gap-2">
                      <Camera className="w-4 h-4 text-[#D8755B]" />
                      <span>انتقاء صور ووثائق «خزانتي» للعرض</span>
                    </h3>
                    <VisibilityPillSelector
                      value={vaultVisibility}
                      onChange={setVaultVisibility}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-xl bg-[#FAF6F0] border border-[#E5DAC8] px-3.5 py-2.5 flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#252321]">
                        العلامة المائية التلقائية للصور
                      </span>
                      <ModernSwitch
                        checked={enableDynamicWatermark}
                        onChange={setEnableDynamicWatermark}
                        ariaLabel="تفعيل العلامة المائية التلقائية"
                      />
                    </div>
                    <div className="rounded-xl bg-[#FAF6F0] border border-[#E5DAC8] px-3.5 py-2.5 flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#252321]">
                        سؤال «هل تعرف هذا الشخص؟»
                      </span>
                      <ModernSwitch
                        checked={enablePhotoFacePrompt}
                        onChange={setEnablePhotoFacePrompt}
                        ariaLabel="تفعيل سؤال التعرف على الوجوه"
                      />
                    </div>
                  </div>

                  {vaultFolders.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-xs font-bold text-[#8D4925]">
                        مجلدات الخزانة المصرح بعرضها:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {vaultFolders.map((f) => {
                          const picked = selectedFolderIds.includes(f.id);
                          return (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() =>
                                setSelectedFolderIds((prev) =>
                                  picked
                                    ? prev.filter((id) => id !== f.id)
                                    : [...prev, f.id]
                                )
                              }
                              className={`px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer ${
                                picked
                                  ? 'bg-[#252321] text-[#F3D299] border-[#252321]'
                                  : 'bg-[#FAF6F0] text-[#252321] border-[#E5DAC8]'
                              }`}
                            >
                              {f.icon} {f.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {allVaultItems.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-xs font-bold text-[#8D4925]">
                        أو اختر مقتنيات محددة ({selectedVaultItemIds.length} مختارة):
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 max-h-44 overflow-y-auto">
                        {allVaultItems.map((it) => {
                          const picked = selectedVaultItemIds.includes(it.id);
                          return (
                            <button
                              key={it.id}
                              type="button"
                              onClick={() =>
                                setSelectedVaultItemIds((prev) =>
                                  picked
                                    ? prev.filter((id) => id !== it.id)
                                    : [...prev, it.id]
                                )
                              }
                              className={`relative aspect-[4/3] rounded-xl overflow-hidden border-2 cursor-pointer ${
                                picked
                                  ? 'border-[#C5A059] ring-2 ring-[#C5A059]/40'
                                  : 'border-[#E5DAC8] opacity-75 hover:opacity-100'
                              }`}
                              title={it.title}
                            >
                              <img
                                src={it.thumbnailDataUrl || it.fileDataUrl}
                                alt={it.title}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                              {picked && (
                                <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#252321] text-[#F3D299] flex items-center justify-center">
                                  <Check className="w-3 h-3" />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* TAB 3: EDITORIAL MODULES (SLEEK COLLAPSIBLE CARDS)            */}
            {/* ------------------------------------------------------------- */}
            {studioTab === 'editorial_modules' && (
              <div className="space-y-3">
                {/* 3A. Family News */}
                <CollapsibleStudioModuleCard
                  icon={<Sparkles className="w-4 h-4" />}
                  title="أخبار وتباشير العائلة"
                  subtitle="مواليد، أفراح، تخرج وإنجازات مع تهنئة الأقارب"
                  enabled={cmsModules.newsModule.enabled}
                  onToggleEnabled={(next) =>
                    setCmsModules((p) => ({
                      ...p,
                      newsModule: { ...p.newsModule, enabled: next },
                    }))
                  }
                  visibility={cmsModules.newsModule.visibility}
                  onChangeVisibility={(vis) =>
                    setCmsModules((p) => ({
                      ...p,
                      newsModule: { ...p.newsModule, visibility: vis },
                    }))
                  }
                  itemsCount={cmsModules.newsModule.items.length}
                  isExpanded={Boolean(expandedModules.news)}
                  onToggleExpand={() => toggleExpanded('news')}
                  isAdding={Boolean(addingModules.news)}
                  onToggleAdd={() => toggleAdding('news')}
                  addForm={
                    <form onSubmit={handleAddNews} className="space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <select
                          value={newNewsCategory}
                          onChange={(e) =>
                            setNewNewsCategory(
                              e.target.value as typeof newNewsCategory
                            )
                          }
                          className="px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E5DAC8] text-xs font-bold"
                        >
                          <option value="مولود جديد">مولود جديد</option>
                          <option value="عقد قران وزواج">عقد قران وزواج</option>
                          <option value="تخرج وإنجاز علمي">
                            تخرج وإنجاز علمي
                          </option>
                          <option value="ترقية وتكريم">ترقية وتكريم</option>
                          <option value="خبر عائلي">خبر عائلي</option>
                        </select>
                        <input
                          type="text"
                          required
                          value={newNewsTitle}
                          onChange={(e) => setNewNewsTitle(e.target.value)}
                          placeholder="عنوان الخبر أو البشارة *"
                          className="sm:col-span-2 px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E5DAC8] text-xs font-bold"
                        />
                      </div>
                      <textarea
                        rows={2}
                        value={newNewsSummary}
                        onChange={(e) => setNewNewsSummary(e.target.value)}
                        placeholder="تفاصيل مختصرة للخبر..."
                        className="w-full px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E5DAC8] text-xs"
                      />
                      <OptionalImagePicker
                        value={newNewsImageUrl}
                        onChange={setNewNewsImageUrl}
                        vaultPhotos={vaultImageItems}
                        uid={userId}
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl bg-[#252321] text-[#F3D299] text-xs font-display font-extrabold cursor-pointer"
                      >
                        + اعتماد وإضافة الخبر
                      </button>
                    </form>
                  }
                >
                  {cmsModules.newsModule.items.length === 0 ? (
                    <p className="text-xs text-[#252321]/55">
                      لا توجد أخبار مضافة بعد — اضغط «+ إضافة» لنشر أول بشارة عائلية.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {cmsModules.newsModule.items.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl bg-white border border-[#E5DAC8] p-3 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {item.imageUrl && (
                              <img
                                src={item.imageUrl}
                                alt={item.title}
                                referrerPolicy="no-referrer"
                                className="w-11 h-11 rounded-lg object-cover shrink-0 border border-[#E5DAC8]"
                              />
                            )}
                            <div className="min-w-0">
                              <div className="text-xs font-display font-extrabold text-[#252321] truncate">
                                {item.title}
                              </div>
                              <div className="text-[11px] text-[#8D4925]">
                                {item.category} · {item.dateLabel}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setCmsModules((p) => ({
                                ...p,
                                newsModule: {
                                  ...p.newsModule,
                                  items: p.newsModule.items.filter(
                                    (n) => n.id !== item.id
                                  ),
                                },
                              }))
                            }
                            aria-label="حذف الخبر"
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-700 cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </CollapsibleStudioModuleCard>

                {/* 3B. Upcoming Events */}
                <CollapsibleStudioModuleCard
                  icon={<Calendar className="w-4 h-4" />}
                  title="المناسبات والملتقيات القادمة"
                  subtitle="اجتماعات العيد والزواجات مع عداد تنازلي وتأكيد الحضور"
                  enabled={cmsModules.eventsModule.enabled}
                  onToggleEnabled={(next) =>
                    setCmsModules((p) => ({
                      ...p,
                      eventsModule: { ...p.eventsModule, enabled: next },
                    }))
                  }
                  visibility={cmsModules.eventsModule.visibility}
                  onChangeVisibility={(vis) =>
                    setCmsModules((p) => ({
                      ...p,
                      eventsModule: { ...p.eventsModule, visibility: vis },
                    }))
                  }
                  itemsCount={cmsModules.eventsModule.items.length}
                  isExpanded={Boolean(expandedModules.events)}
                  onToggleExpand={() => toggleExpanded('events')}
                  isAdding={Boolean(addingModules.events)}
                  onToggleAdd={() => toggleAdding('events')}
                  addForm={
                    <form onSubmit={handleAddEvent} className="space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          required
                          value={newEventTitle}
                          onChange={(e) => setNewEventTitle(e.target.value)}
                          placeholder="عنوان المناسبة *"
                          className="px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E5DAC8] text-xs font-bold"
                        />
                        <input
                          type="date"
                          required
                          value={newEventDate}
                          onChange={(e) => setNewEventDate(e.target.value)}
                          className="px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E5DAC8] text-xs font-bold"
                        />
                        <input
                          type="text"
                          value={newEventLocation}
                          onChange={(e) => setNewEventLocation(e.target.value)}
                          placeholder="المكان / المدينة"
                          className="px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E5DAC8] text-xs"
                        />
                      </div>
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl bg-[#252321] text-[#F3D299] text-xs font-display font-extrabold cursor-pointer"
                      >
                        + إضافة المناسبة
                      </button>
                    </form>
                  }
                >
                  {cmsModules.eventsModule.items.length === 0 ? (
                    <p className="text-xs text-[#252321]/55">
                      لا توجد مناسبات مجدولة بعد.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {cmsModules.eventsModule.items.map((ev) => (
                        <div
                          key={ev.id}
                          className="rounded-xl bg-white border border-[#E5DAC8] p-3 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-display font-extrabold text-[#252321] truncate">
                              {ev.title}
                            </div>
                            <div className="text-[11px] text-[#8D4925]">
                              {ev.eventDateIso} · {ev.locationLabel}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setCmsModules((p) => ({
                                ...p,
                                eventsModule: {
                                  ...p.eventsModule,
                                  items: p.eventsModule.items.filter(
                                    (x) => x.id !== ev.id
                                  ),
                                },
                              }))
                            }
                            aria-label="حذف المناسبة"
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-700 cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </CollapsibleStudioModuleCard>

                {/* 3C. Ancestor Stories */}
                <CollapsibleStudioModuleCard
                  icon={<BookOpen className="w-4 h-4" />}
                  title="قصص الأجداد والذكريات التاريخية"
                  subtitle="توثيق المواقف التراثية وسِير الآباء والأجداد بالصور"
                  enabled={cmsModules.storiesModule.enabled}
                  onToggleEnabled={(next) =>
                    setCmsModules((p) => ({
                      ...p,
                      storiesModule: { ...p.storiesModule, enabled: next },
                    }))
                  }
                  visibility={cmsModules.storiesModule.visibility}
                  onChangeVisibility={(vis) =>
                    setCmsModules((p) => ({
                      ...p,
                      storiesModule: { ...p.storiesModule, visibility: vis },
                    }))
                  }
                  itemsCount={cmsModules.storiesModule.items.length}
                  isExpanded={Boolean(expandedModules.stories)}
                  onToggleExpand={() => toggleExpanded('stories')}
                  isAdding={Boolean(addingModules.stories)}
                  onToggleAdd={() => toggleAdding('stories')}
                  addForm={
                    <form onSubmit={handleAddStory} className="space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          required
                          value={newStoryTitle}
                          onChange={(e) => setNewStoryTitle(e.target.value)}
                          placeholder="عنوان القصة *"
                          className="sm:col-span-2 px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E5DAC8] text-xs font-bold"
                        />
                        <input
                          type="text"
                          value={newStoryEra}
                          onChange={(e) => setNewStoryEra(e.target.value)}
                          placeholder="الحقبة / السنة"
                          className="px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E5DAC8] text-xs"
                        />
                      </div>
                      <textarea
                        rows={3}
                        required
                        value={newStoryBody}
                        onChange={(e) => setNewStoryBody(e.target.value)}
                        placeholder="نص القصة أو الموقف التاريخي..."
                        className="w-full px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E5DAC8] text-xs"
                      />
                      <OptionalImagePicker
                        value={newStoryImageUrl}
                        onChange={setNewStoryImageUrl}
                        vaultPhotos={vaultImageItems}
                        uid={userId}
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl bg-[#252321] text-[#F3D299] text-xs font-display font-extrabold cursor-pointer"
                      >
                        + حفظ القصة
                      </button>
                    </form>
                  }
                >
                  {cmsModules.storiesModule.items.length === 0 ? (
                    <p className="text-xs text-[#252321]/55">
                      لم تُضف قصص بعد.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {cmsModules.storiesModule.items.map((st) => (
                        <div
                          key={st.id}
                          className="rounded-xl bg-white border border-[#E5DAC8] p-3 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {st.imageUrl && (
                              <img
                                src={st.imageUrl}
                                alt={st.title}
                                referrerPolicy="no-referrer"
                                className="w-11 h-11 rounded-lg object-cover shrink-0 border border-[#E5DAC8]"
                              />
                            )}
                            <div className="min-w-0">
                              <div className="text-xs font-display font-extrabold text-[#252321] truncate">
                                {st.title}
                              </div>
                              <div className="text-[11px] text-[#8D4925]">
                                {st.eraOrYearLabel}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setCmsModules((p) => ({
                                ...p,
                                storiesModule: {
                                  ...p.storiesModule,
                                  items: p.storiesModule.items.filter(
                                    (x) => x.id !== st.id
                                  ),
                                },
                              }))
                            }
                            aria-label="حذف القصة"
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-700 cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </CollapsibleStudioModuleCard>

                {/* 3D. Notables / Hall of Fame */}
                <CollapsibleStudioModuleCard
                  icon={<Award className="w-4 h-4" />}
                  title="لوحة الشرف وأعلام العائلة"
                  subtitle="تخليد رموز العائلة وروادها بصورهم وإنجازاتهم"
                  enabled={cmsModules.notablesModule.enabled}
                  onToggleEnabled={(next) =>
                    setCmsModules((p) => ({
                      ...p,
                      notablesModule: { ...p.notablesModule, enabled: next },
                    }))
                  }
                  visibility={cmsModules.notablesModule.visibility}
                  onChangeVisibility={(vis) =>
                    setCmsModules((p) => ({
                      ...p,
                      notablesModule: { ...p.notablesModule, visibility: vis },
                    }))
                  }
                  itemsCount={cmsModules.notablesModule.items.length}
                  isExpanded={Boolean(expandedModules.notables)}
                  onToggleExpand={() => toggleExpanded('notables')}
                  isAdding={Boolean(addingModules.notables)}
                  onToggleAdd={() => toggleAdding('notables')}
                  addForm={
                    <form onSubmit={handleAddNotable} className="space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          required
                          value={newNotableName}
                          onChange={(e) => setNewNotableName(e.target.value)}
                          placeholder="اسم العَلَم *"
                          className="px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E5DAC8] text-xs font-bold"
                        />
                        <input
                          type="text"
                          value={newNotableRole}
                          onChange={(e) => setNewNotableRole(e.target.value)}
                          placeholder="الصفة / المنصب"
                          className="px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E5DAC8] text-xs"
                        />
                        <input
                          type="text"
                          value={newNotableEra}
                          onChange={(e) => setNewNotableEra(e.target.value)}
                          placeholder="الحقبة الزمنية"
                          className="px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E5DAC8] text-xs"
                        />
                      </div>
                      <textarea
                        rows={2}
                        value={newNotableBio}
                        onChange={(e) => setNewNotableBio(e.target.value)}
                        placeholder="نبذة عن الإنجاز والأثر..."
                        className="w-full px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E5DAC8] text-xs"
                      />
                      <OptionalImagePicker
                        label="صورة شخصية للعَلَم (اختياري)"
                        value={newNotableImageUrl}
                        onChange={setNewNotableImageUrl}
                        vaultPhotos={vaultImageItems}
                        uid={userId}
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl bg-[#252321] text-[#F3D299] text-xs font-display font-extrabold cursor-pointer"
                      >
                        + إضافة إلى لوحة الشرف
                      </button>
                    </form>
                  }
                >
                  {cmsModules.notablesModule.items.length === 0 ? (
                    <p className="text-xs text-[#252321]/55">
                      لم يُضف أعلام بعد.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {cmsModules.notablesModule.items.map((n) => (
                        <div
                          key={n.id}
                          className="rounded-xl bg-white border border-[#E5DAC8] p-3 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {n.imageUrl && (
                              <img
                                src={n.imageUrl}
                                alt={n.fullName}
                                referrerPolicy="no-referrer"
                                className="w-10 h-10 rounded-xl object-cover shrink-0 border border-[#C5A059]/60"
                              />
                            )}
                            <div className="min-w-0">
                              <div className="text-xs font-display font-extrabold text-[#252321] truncate">
                                {n.fullName}
                              </div>
                              <div className="text-[11px] text-[#8D4925] truncate">
                                {n.roleOrTitle}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setCmsModules((p) => ({
                                ...p,
                                notablesModule: {
                                  ...p.notablesModule,
                                  items: p.notablesModule.items.filter(
                                    (x) => x.id !== n.id
                                  ),
                                },
                              }))
                            }
                            aria-label="حذف العَلَم"
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-700 cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </CollapsibleStudioModuleCard>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* TAB 4: HERITAGE & COMMUNITY MODULES (COLLAPSIBLE CARDS)       */}
            {/* ------------------------------------------------------------- */}
            {studioTab === 'heritage_community_modules' && (
              <div className="space-y-3">
                {/* 4A. Atlas of Homelands */}
                <CollapsibleStudioModuleCard
                  icon={<MapPin className="w-4 h-4" />}
                  title="أطلس الديار والانتشار الجغرافي"
                  subtitle="المدن والدول التي يقطنها أبناء العائلة"
                  enabled={cmsModules.atlasAndStatsModule.enabled}
                  onToggleEnabled={(next) =>
                    setCmsModules((p) => ({
                      ...p,
                      atlasAndStatsModule: {
                        ...p.atlasAndStatsModule,
                        enabled: next,
                      },
                    }))
                  }
                  visibility={cmsModules.atlasAndStatsModule.visibility}
                  onChangeVisibility={(vis) =>
                    setCmsModules((p) => ({
                      ...p,
                      atlasAndStatsModule: {
                        ...p.atlasAndStatsModule,
                        visibility: vis,
                      },
                    }))
                  }
                  itemsCount={cmsModules.atlasAndStatsModule.locations.length}
                  isExpanded={Boolean(expandedModules.atlas)}
                  onToggleExpand={() => toggleExpanded('atlas')}
                  isAdding={Boolean(addingModules.atlas)}
                  onToggleAdd={() => toggleAdding('atlas')}
                  addForm={
                    <form onSubmit={handleAddLocation} className="space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          required
                          value={newLocCountry}
                          onChange={(e) => setNewLocCountry(e.target.value)}
                          placeholder="الدولة *"
                          className="px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E5DAC8] text-xs font-bold"
                        />
                        <input
                          type="text"
                          required
                          value={newLocCity}
                          onChange={(e) => setNewLocCity(e.target.value)}
                          placeholder="المدينة / الحاضرة *"
                          className="px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E5DAC8] text-xs font-bold"
                        />
                        <input
                          type="number"
                          min={1}
                          value={newLocCount}
                          onChange={(e) =>
                            setNewLocCount(Number(e.target.value) || 1)
                          }
                          placeholder="عدد الأسر/الأفراد"
                          className="px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E5DAC8] text-xs font-bold"
                        />
                      </div>
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl bg-[#252321] text-[#F3D299] text-xs font-display font-extrabold cursor-pointer"
                      >
                        + إضافة مدينة للأطلس
                      </button>
                    </form>
                  }
                >
                  <div className="flex flex-wrap gap-2">
                    {cmsModules.atlasAndStatsModule.locations.map((loc) => (
                      <div
                        key={loc.id}
                        className="rounded-xl bg-white border border-[#E5DAC8] px-3 py-2 text-xs font-bold flex items-center gap-2"
                      >
                        <span>
                          {loc.city} ({loc.country}) ·{' '}
                          {loc.householdsOrMembersCount}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setCmsModules((p) => ({
                              ...p,
                              atlasAndStatsModule: {
                                ...p.atlasAndStatsModule,
                                locations:
                                  p.atlasAndStatsModule.locations.filter(
                                    (x) => x.id !== loc.id
                                  ),
                              },
                            }))
                          }
                          className="text-red-700 hover:bg-red-50 rounded p-0.5 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </CollapsibleStudioModuleCard>

                {/* 4B. Oral Heritage Audio */}
                <CollapsibleStudioModuleCard
                  icon={<Mic className="w-4 h-4" />}
                  title="الموروث الصوتي والشعري"
                  subtitle="تسجيلات صوتية وقصائد ومرويات كبار السن"
                  enabled={cmsModules.oralHeritageModule.enabled}
                  onToggleEnabled={(next) =>
                    setCmsModules((p) => ({
                      ...p,
                      oralHeritageModule: {
                        ...p.oralHeritageModule,
                        enabled: next,
                      },
                    }))
                  }
                  visibility={cmsModules.oralHeritageModule.visibility}
                  onChangeVisibility={(vis) =>
                    setCmsModules((p) => ({
                      ...p,
                      oralHeritageModule: {
                        ...p.oralHeritageModule,
                        visibility: vis,
                      },
                    }))
                  }
                  itemsCount={cmsModules.oralHeritageModule.items.length}
                  isExpanded={Boolean(expandedModules.oral)}
                  onToggleExpand={() => toggleExpanded('oral')}
                  isAdding={Boolean(addingModules.oral)}
                  onToggleAdd={() => toggleAdding('oral')}
                  addForm={
                    <form onSubmit={handleAddAudio} className="space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          required
                          value={newAudioTitle}
                          onChange={(e) => setNewAudioTitle(e.target.value)}
                          placeholder="عنوان التسجيل *"
                          className="px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E5DAC8] text-xs font-bold"
                        />
                        <input
                          type="text"
                          value={newAudioSpeaker}
                          onChange={(e) => setNewAudioSpeaker(e.target.value)}
                          placeholder="المتحدث / الراوي"
                          className="px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E5DAC8] text-xs"
                        />
                        <input
                          type="text"
                          value={newAudioYear}
                          onChange={(e) => setNewAudioYear(e.target.value)}
                          placeholder="السنة"
                          className="px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E5DAC8] text-xs"
                        />
                      </div>
                      <input
                        type="url"
                        dir="ltr"
                        value={newAudioUrl}
                        onChange={(e) => setNewAudioUrl(e.target.value)}
                        placeholder="رابط ملف صوتي (MP3/M4A - اختياري)"
                        className="w-full px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E5DAC8] text-xs"
                      />
                      <textarea
                        rows={2}
                        value={newAudioExcerpt}
                        onChange={(e) => setNewAudioExcerpt(e.target.value)}
                        placeholder="مقتطف مكتوب من المروية أو القصيدة..."
                        className="w-full px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E5DAC8] text-xs"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl bg-[#252321] text-[#F3D299] text-xs font-display font-extrabold cursor-pointer"
                      >
                        + حفظ التسجيل الصوتي
                      </button>
                    </form>
                  }
                >
                  {cmsModules.oralHeritageModule.items.length === 0 ? (
                    <p className="text-xs text-[#252321]/55">
                      لا توجد تسجيلات صوتية مضافة بعد.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {cmsModules.oralHeritageModule.items.map((clip) => (
                        <div
                          key={clip.id}
                          className="rounded-xl bg-white border border-[#E5DAC8] p-3 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[#252321] truncate">
                              {clip.title}
                            </div>
                            <div className="text-[11px] text-[#8D4925]">
                              {clip.speakerName} · {clip.recordedYearLabel}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setCmsModules((p) => ({
                                ...p,
                                oralHeritageModule: {
                                  ...p.oralHeritageModule,
                                  items: p.oralHeritageModule.items.filter(
                                    (x) => x.id !== clip.id
                                  ),
                                },
                              }))
                            }
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-700 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </CollapsibleStudioModuleCard>

                {/* 4C. Professions Directory */}
                <CollapsibleStudioModuleCard
                  icon={<Briefcase className="w-4 h-4" />}
                  title="دليل الكفاءات والتخصصات"
                  subtitle="شبكة تكافل مهني بين أبناء العائلة في مختلف المجالات"
                  enabled={cmsModules.professionsModule.enabled}
                  onToggleEnabled={(next) =>
                    setCmsModules((p) => ({
                      ...p,
                      professionsModule: {
                        ...p.professionsModule,
                        enabled: next,
                      },
                    }))
                  }
                  visibility={cmsModules.professionsModule.visibility}
                  onChangeVisibility={(vis) =>
                    setCmsModules((p) => ({
                      ...p,
                      professionsModule: {
                        ...p.professionsModule,
                        visibility: vis,
                      },
                    }))
                  }
                  itemsCount={cmsModules.professionsModule.items.length}
                  isExpanded={Boolean(expandedModules.professions)}
                  onToggleExpand={() => toggleExpanded('professions')}
                  isAdding={Boolean(addingModules.professions)}
                  onToggleAdd={() => toggleAdding('professions')}
                  addForm={
                    <form
                      onSubmit={handleAddProfession}
                      className="space-y-2.5"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          required
                          value={newProfName}
                          onChange={(e) => setNewProfName(e.target.value)}
                          placeholder="اسم العضو *"
                          className="px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E5DAC8] text-xs font-bold"
                        />
                        <input
                          type="text"
                          required
                          value={newProfSpecialty}
                          onChange={(e) => setNewProfSpecialty(e.target.value)}
                          placeholder="التخصص الدقيق *"
                          className="px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E5DAC8] text-xs"
                        />
                        <input
                          type="text"
                          value={newProfCategory}
                          onChange={(e) => setNewProfCategory(e.target.value)}
                          placeholder="المجال (طب، هندسة، قانون...)"
                          className="px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E5DAC8] text-xs"
                        />
                        <input
                          type="text"
                          value={newProfCity}
                          onChange={(e) => setNewProfCity(e.target.value)}
                          placeholder="المدينة"
                          className="px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E5DAC8] text-xs"
                        />
                      </div>
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl bg-[#252321] text-[#F3D299] text-xs font-display font-extrabold cursor-pointer"
                      >
                        + إضافة إلى دليل الكفاءات
                      </button>
                    </form>
                  }
                >
                  {cmsModules.professionsModule.items.length === 0 ? (
                    <p className="text-xs text-[#252321]/55">
                      لم تُضف كفاءات بعد.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {cmsModules.professionsModule.items.map((prof) => (
                        <div
                          key={prof.id}
                          className="rounded-xl bg-white border border-[#E5DAC8] p-3 flex items-center justify-between gap-2"
                        >
                          <div>
                            <div className="text-xs font-bold text-[#252321]">
                              {prof.memberName}
                            </div>
                            <div className="text-[11px] text-[#8D4925]">
                              {prof.fieldCategory} ·{' '}
                              {prof.specialtyOrProfession}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setCmsModules((p) => ({
                                ...p,
                                professionsModule: {
                                  ...p.professionsModule,
                                  items: p.professionsModule.items.filter(
                                    (x) => x.id !== prof.id
                                  ),
                                },
                              }))
                            }
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-700 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </CollapsibleStudioModuleCard>

                {/* 4D. Memorial & Time Capsule */}
                <CollapsibleStudioModuleCard
                  icon={<Heart className="w-4 h-4" />}
                  title="ركن الوفاء والدعاء وكبسولة الزمن"
                  subtitle="سجل الراحلين والصدقات الجارية ورسائل المستقبل"
                  enabled={cmsModules.memorialAndCapsuleModule.enabled}
                  onToggleEnabled={(next) =>
                    setCmsModules((p) => ({
                      ...p,
                      memorialAndCapsuleModule: {
                        ...p.memorialAndCapsuleModule,
                        enabled: next,
                      },
                    }))
                  }
                  visibility={cmsModules.memorialAndCapsuleModule.visibility}
                  onChangeVisibility={(vis) =>
                    setCmsModules((p) => ({
                      ...p,
                      memorialAndCapsuleModule: {
                        ...p.memorialAndCapsuleModule,
                        visibility: vis,
                      },
                    }))
                  }
                  itemsCount={
                    cmsModules.memorialAndCapsuleModule.elders.length +
                    (cmsModules.memorialAndCapsuleModule.timeCapsule.enabled
                      ? 1
                      : 0)
                  }
                  isExpanded={Boolean(expandedModules.memorial)}
                  onToggleExpand={() => toggleExpanded('memorial')}
                  isAdding={Boolean(addingModules.memorial)}
                  onToggleAdd={() => toggleAdding('memorial')}
                  addForm={
                    <form onSubmit={handleAddElder} className="space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          required
                          value={newElderName}
                          onChange={(e) => setNewElderName(e.target.value)}
                          placeholder="اسم الفقيد (رحمه الله) *"
                          className="px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E5DAC8] text-xs font-bold"
                        />
                        <input
                          type="text"
                          value={newElderYear}
                          onChange={(e) => setNewElderYear(e.target.value)}
                          placeholder="سنة الوفاة"
                          className="px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E5DAC8] text-xs"
                        />
                      </div>
                      <textarea
                        rows={2}
                        value={newElderBio}
                        onChange={(e) => setNewElderBio(e.target.value)}
                        placeholder="سيرة عطرة وذكرى طيبة..."
                        className="w-full px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E5DAC8] text-xs"
                      />
                      <input
                        type="text"
                        value={newElderCharity}
                        onChange={(e) => setNewElderCharity(e.target.value)}
                        placeholder="مشروع صدقة جارية (اختياري)"
                        className="w-full px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E5DAC8] text-xs"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl bg-[#252321] text-[#F3D299] text-xs font-display font-extrabold cursor-pointer"
                      >
                        + إضافة لركن الوفاء
                      </button>
                    </form>
                  }
                >
                  <div className="space-y-3">
                    {cmsModules.memorialAndCapsuleModule.elders.map((el) => (
                      <div
                        key={el.id}
                        className="rounded-xl bg-white border border-[#E5DAC8] p-3 flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="text-xs font-bold text-[#252321]">
                            {el.fullName}
                          </div>
                          <div className="text-[11px] text-[#8D4925]">
                            {el.passingYearLabel}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setCmsModules((p) => ({
                              ...p,
                              memorialAndCapsuleModule: {
                                ...p.memorialAndCapsuleModule,
                                elders:
                                  p.memorialAndCapsuleModule.elders.filter(
                                    (x) => x.id !== el.id
                                  ),
                              },
                            }))
                          }
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-700 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    {/* Time Capsule Toggle & Inputs */}
                    <div className="rounded-xl bg-white border border-[#C5A059]/45 p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-display font-extrabold text-[#252321]">
                          كبسولة الزمن العائلية (تُفتح في تاريخ مستقبلي)
                        </span>
                        <ModernSwitch
                          checked={
                            cmsModules.memorialAndCapsuleModule.timeCapsule
                              .enabled
                          }
                          onChange={(next) =>
                            setCmsModules((p) => ({
                              ...p,
                              memorialAndCapsuleModule: {
                                ...p.memorialAndCapsuleModule,
                                timeCapsule: {
                                  ...p.memorialAndCapsuleModule.timeCapsule,
                                  enabled: next,
                                },
                              },
                            }))
                          }
                          ariaLabel="تفعيل كبسولة الزمن"
                        />
                      </div>
                      {cmsModules.memorialAndCapsuleModule.timeCapsule
                        .enabled && (
                        <div className="space-y-2 pt-1">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={
                                cmsModules.memorialAndCapsuleModule.timeCapsule
                                  .title
                              }
                              onChange={(e) =>
                                setCmsModules((p) => ({
                                  ...p,
                                  memorialAndCapsuleModule: {
                                    ...p.memorialAndCapsuleModule,
                                    timeCapsule: {
                                      ...p.memorialAndCapsuleModule.timeCapsule,
                                      title: e.target.value,
                                    },
                                  },
                                }))
                              }
                              placeholder="عنوان الرسالة"
                              className="px-3 py-1.5 rounded-lg bg-[#FAF6F0] border border-[#E5DAC8] text-xs font-bold"
                            />
                            <input
                              type="date"
                              value={
                                cmsModules.memorialAndCapsuleModule.timeCapsule
                                  .unlockDateIso
                              }
                              onChange={(e) =>
                                setCmsModules((p) => ({
                                  ...p,
                                  memorialAndCapsuleModule: {
                                    ...p.memorialAndCapsuleModule,
                                    timeCapsule: {
                                      ...p.memorialAndCapsuleModule.timeCapsule,
                                      unlockDateIso: e.target.value,
                                    },
                                  },
                                }))
                              }
                              className="px-3 py-1.5 rounded-lg bg-[#FAF6F0] border border-[#E5DAC8] text-xs font-bold"
                            />
                          </div>
                          <textarea
                            rows={2}
                            value={
                              cmsModules.memorialAndCapsuleModule.timeCapsule
                                .sealedMessage
                            }
                            onChange={(e) =>
                              setCmsModules((p) => ({
                                ...p,
                                memorialAndCapsuleModule: {
                                  ...p.memorialAndCapsuleModule,
                                  timeCapsule: {
                                    ...p.memorialAndCapsuleModule.timeCapsule,
                                    sealedMessage: e.target.value,
                                  },
                                },
                              }))
                            }
                            placeholder="نص الرسالة المختومة للأجيال القادمة..."
                            className="w-full px-3 py-1.5 rounded-lg bg-[#FAF6F0] border border-[#E5DAC8] text-xs"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </CollapsibleStudioModuleCard>

                {/* 4E. Guided Majlis & Guardians */}
                <CollapsibleStudioModuleCard
                  icon={<MessageSquare className="w-4 h-4" />}
                  title="مجلس العائلة وحرّاس الذاكرة"
                  subtitle="محاور حوار موجهة وتكريم أكثر الأقارب إثراءً"
                  enabled={cmsModules.majlisAndGuardiansModule.enabled}
                  onToggleEnabled={(next) =>
                    setCmsModules((p) => ({
                      ...p,
                      majlisAndGuardiansModule: {
                        ...p.majlisAndGuardiansModule,
                        enabled: next,
                      },
                    }))
                  }
                  visibility={cmsModules.majlisAndGuardiansModule.visibility}
                  onChangeVisibility={(vis) =>
                    setCmsModules((p) => ({
                      ...p,
                      majlisAndGuardiansModule: {
                        ...p.majlisAndGuardiansModule,
                        visibility: vis,
                      },
                    }))
                  }
                  itemsCount={cmsModules.majlisAndGuardiansModule.topics.length}
                  isExpanded={Boolean(expandedModules.majlis)}
                  onToggleExpand={() => toggleExpanded('majlis')}
                  isAdding={Boolean(addingModules.majlis)}
                  onToggleAdd={() => toggleAdding('majlis')}
                  addForm={
                    <form onSubmit={handleAddTopic} className="space-y-2.5">
                      <input
                        type="text"
                        required
                        value={newTopicTitle}
                        onChange={(e) => setNewTopicTitle(e.target.value)}
                        placeholder="عنوان محور الحوار *"
                        className="w-full px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E5DAC8] text-xs font-bold"
                      />
                      <textarea
                        rows={2}
                        value={newTopicPrompt}
                        onChange={(e) => setNewTopicPrompt(e.target.value)}
                        placeholder="السؤال الترحيبي لأبناء العائلة..."
                        className="w-full px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#E5DAC8] text-xs"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl bg-[#252321] text-[#F3D299] text-xs font-display font-extrabold cursor-pointer"
                      >
                        + طرح المحور في المجلس
                      </button>
                    </form>
                  }
                >
                  {cmsModules.majlisAndGuardiansModule.topics.length === 0 ? (
                    <p className="text-xs text-[#252321]/55">
                      لا توجد محاور مطروحة في المجلس بعد.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {cmsModules.majlisAndGuardiansModule.topics.map((t) => (
                        <div
                          key={t.id}
                          className="rounded-xl bg-white border border-[#E5DAC8] p-3 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[#252321] truncate">
                              {t.title}
                            </div>
                            <div className="text-[11px] text-[#8D4925] truncate">
                              {t.promptQuestion}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setCmsModules((p) => ({
                                ...p,
                                majlisAndGuardiansModule: {
                                  ...p.majlisAndGuardiansModule,
                                  topics:
                                    p.majlisAndGuardiansModule.topics.filter(
                                      (x) => x.id !== t.id
                                    ),
                                },
                              }))
                            }
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-700 cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </CollapsibleStudioModuleCard>
              </div>
            )}
          </div>

          {/* LEFT (Desktop xl): STICKY LIVE INTERACTIVE MINI-BROWSER */}
          <aside className="hidden xl:block xl:col-span-5 xl:sticky xl:top-24 self-start">
            <div className="rounded-3xl border border-[#D4AF37]/45 bg-[#252321] shadow-[0_20px_50px_-24px_rgba(37,35,33,0.45)] overflow-hidden flex flex-col">
              {/* Sleek Browser Chrome Bar */}
              <div className="px-4 py-2.5 bg-[#1D1B19] border-b border-white/10 flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400/75" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-300/75" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/75" />
                </div>
                <div
                  dir="ltr"
                  className="flex-1 mx-2 px-3 py-1 rounded-lg bg-white/8 border border-white/8 text-[11px] font-mono text-[#FAF6F0]/90 inline-flex items-center justify-center gap-1.5 truncate"
                >
                  <Lock className="w-3 h-3 text-[#D4AF6A] shrink-0" />
                  <span className="truncate">
                    {OFFICIAL_BRAND_HOST}/{cleanSlugDisplay}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setWorkspaceMode('fullscreen_preview')}
                  title="توسيع لملء الشاشة"
                  className="text-[10.5px] font-display font-bold text-[#F3D299] hover:underline cursor-pointer whitespace-nowrap shrink-0"
                >
                  تكبير ↗
                </button>
              </div>

              {/* Live Synchronized Scrollable Mini-Portal */}
              <div className="h-[calc(100vh-12.5rem)] min-h-[540px] max-h-[780px] overflow-y-auto bg-white">
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
