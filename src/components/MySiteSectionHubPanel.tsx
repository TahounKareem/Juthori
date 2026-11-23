import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Award,
  BookOpen,
  Briefcase,
  Calendar,
  FolderOpen,
  GitBranch,
  Heart,
  Image as ImageIcon,
  Layers,
  MapPin,
  MessageSquare,
  Mic,
  Plus,
  Quote,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  FamilyVaultMediaItem,
  VaultFolderRecord,
} from '../services/firestoreService';
import {
  FamilyMicrositeCmsModules,
  FamilyPortalVisualBranding,
  ModuleVisibility,
  PortalSectionKey,
  RawTreePersonForPublicProjection,
} from '../services/priority4Service';
import { PORTAL_SECTION_LABELS } from './FamilySiteHeritageVisuals';
import {
  ModernSwitch,
  OptionalImagePicker,
  VisibilityPillSelector,
} from './MySiteStudioControls';

interface MySiteSectionHubPanelProps {
  familyName: string;
  originCountry?: string;
  userId?: string;
  focusedSectionKey: PortalSectionKey | null;
  onSelectSection: (key: PortalSectionKey | null) => void;
  visualBranding: FamilyPortalVisualBranding;
  setVisualBranding: React.Dispatch<
    React.SetStateAction<FamilyPortalVisualBranding>
  >;
  cmsModules: FamilyMicrositeCmsModules;
  setCmsModules: React.Dispatch<
    React.SetStateAction<FamilyMicrositeCmsModules>
  >;
  isRecommendedSectionOrder: boolean;
  onMoveSectionOrder: (key: PortalSectionKey, dir: 'up' | 'down') => void;
  onResetSectionOrder: () => void;
  // Tree mirror props
  treeVisibility: ModuleVisibility;
  setTreeVisibility: (next: ModuleVisibility) => void;
  startRootPersonId: string;
  setStartRootPersonId: (id: string) => void;
  excludedBranchRootIds: string[];
  setExcludedBranchRootIds: React.Dispatch<React.SetStateAction<string[]>>;
  contemporaryOnlyMembers: RawTreePersonForPublicProjection[];
  onOpenTreeSettings?: () => void;
  // Vault gallery props
  vaultVisibility: ModuleVisibility;
  setVaultVisibility: (next: ModuleVisibility) => void;
  enableDynamicWatermark: boolean;
  setEnableDynamicWatermark: (next: boolean) => void;
  enablePhotoFacePrompt: boolean;
  setEnablePhotoFacePrompt: (next: boolean) => void;
  vaultFolders: VaultFolderRecord[];
  allVaultItems: FamilyVaultMediaItem[];
  vaultImageItems: FamilyVaultMediaItem[];
  selectedFolderIds: string[];
  setSelectedFolderIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectedVaultItemIds: string[];
  setSelectedVaultItemIds: React.Dispatch<React.SetStateAction<string[]>>;
}

const SECTION_ICON_MAP: Record<PortalSectionKey, React.ReactNode> = {
  patriarch_quote: <Quote className="w-4 h-4" />,
  atlas: <MapPin className="w-4 h-4" />,
  tree_mirror: <GitBranch className="w-4 h-4" />,
  notables: <Award className="w-4 h-4" />,
  stories: <BookOpen className="w-4 h-4" />,
  vault_gallery: <ImageIcon className="w-4 h-4" />,
  oral_heritage: <Mic className="w-4 h-4" />,
  professions: <Briefcase className="w-4 h-4" />,
  news: <Sparkles className="w-4 h-4" />,
  events: <Calendar className="w-4 h-4" />,
  memorial: <Heart className="w-4 h-4" />,
  majlis: <MessageSquare className="w-4 h-4" />,
};

const SECTION_DESC_MAP: Record<PortalSectionKey, string> = {
  patriarch_quote:
    'رسالة ترحيبية مأثورة من عميد الأسرة أو كبير العائلة تُبرز روح الديوان.',
  atlas:
    'عرض الحواضر والمدن التي تقطن فيها فروع العائلة مع الإحصاءات التلقائية.',
  tree_mirror:
    'عرض تفاعلي لشجرتك المعاصرة المتزامنة مع «شجرتي» مع التحكم بنقطة البداية والفروع.',
  notables: 'توثيق سِيَر الشخصيات الرائدة والأعلام البارزين في تاريخ الأسرة.',
  stories: 'أرشيف القصص التاريخية والمواقف الخالدة المتوارثة عبر الأجيال.',
  vault_gallery:
    'مختارات الصور والوثائق التراثية من «خزانتي» مع العلامة المائية وحماية الحقوق.',
  oral_heritage:
    'تسجيلات صوتية وشهادات شفهية موثقة لكبار العائلة وحكايات الماضي.',
  professions: 'دليل الكفاءات والمهن والتخصصات لتعزيز التواصل المهني بين الأقارب.',
  news: 'نشرة أخبار الأسرة السعيدة من مواليد وأفراح وتخرّج وتكريمات.',
  events: 'تقويم اللقاءات والمناسبات الدورية للعائلة مع تأكيد الحضور (RSVP).',
  memorial: 'لوحة الوفاء والدعاء للراحلين مع كبسولة الزمن للأجيال القادمة.',
  majlis: 'حوارات أسبوعية وموضوعات تفاعلية وصلة رحم ولوحة حراس الذاكرة.',
};

export const MySiteSectionHubPanel: React.FC<MySiteSectionHubPanelProps> = ({
  familyName,
  originCountry,
  userId,
  focusedSectionKey,
  onSelectSection,
  visualBranding,
  setVisualBranding,
  cmsModules,
  setCmsModules,
  isRecommendedSectionOrder,
  onMoveSectionOrder,
  onResetSectionOrder,
  treeVisibility,
  setTreeVisibility,
  startRootPersonId,
  setStartRootPersonId,
  excludedBranchRootIds,
  setExcludedBranchRootIds,
  contemporaryOnlyMembers,
  onOpenTreeSettings,
  vaultVisibility,
  setVaultVisibility,
  enableDynamicWatermark,
  setEnableDynamicWatermark,
  enablePhotoFacePrompt,
  setEnablePhotoFacePrompt,
  vaultFolders,
  allVaultItems,
  vaultImageItems,
  selectedFolderIds,
  setSelectedFolderIds,
  selectedVaultItemIds,
  setSelectedVaultItemIds,
}) => {
  // Focused add-item form states (local to this hub panel)
  const [newLocCountry, setNewLocCountry] = useState(
    originCountry || 'السعودية'
  );
  const [newLocCity, setNewLocCity] = useState('');
  const [newLocCount, setNewLocCount] = useState<number>(5);

  const [newNotableName, setNewNotableName] = useState('');
  const [newNotableRole, setNewNotableRole] = useState('');
  const [newNotableEra, setNewNotableEra] = useState('');
  const [newNotableBio, setNewNotableBio] = useState('');
  const [newNotableImageUrl, setNewNotableImageUrl] = useState('');

  const [newStoryTitle, setNewStoryTitle] = useState('');
  const [newStoryEra, setNewStoryEra] = useState('');
  const [newStoryBody, setNewStoryBody] = useState('');
  const [newStoryImageUrl, setNewStoryImageUrl] = useState('');

  const [newAudioTitle, setNewAudioTitle] = useState('');
  const [newAudioSpeaker, setNewAudioSpeaker] = useState('');
  const [newAudioYear, setNewAudioYear] = useState('');
  const [newAudioUrl, setNewAudioUrl] = useState('');
  const [newAudioExcerpt, setNewAudioExcerpt] = useState('');

  const [newProfName, setNewProfName] = useState('');
  const [newProfSpecialty, setNewProfSpecialty] = useState('');
  const [newProfCategory, setNewProfCategory] = useState(
    'الطب والرعاية الصحية'
  );
  const [newProfCity, setNewProfCity] = useState('');

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

  const [newElderName, setNewElderName] = useState('');
  const [newElderYear, setNewElderYear] = useState('');
  const [newElderBio, setNewElderBio] = useState('');
  const [newElderCharity, setNewElderCharity] = useState('');

  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newTopicPrompt, setNewTopicPrompt] = useState('');

  // Helpers: section enabled status, setter, visibility, and content summary
  const isSectionEnabled = (key: PortalSectionKey): boolean => {
    switch (key) {
      case 'patriarch_quote':
        return Boolean(visualBranding.patriarchQuote?.enabled);
      case 'atlas':
        return cmsModules.atlasAndStatsModule.enabled;
      case 'tree_mirror':
        return treeVisibility !== 'HIDDEN';
      case 'notables':
        return cmsModules.notablesModule.enabled;
      case 'stories':
        return cmsModules.storiesModule.enabled;
      case 'vault_gallery':
        return vaultVisibility !== 'HIDDEN';
      case 'oral_heritage':
        return cmsModules.oralHeritageModule.enabled;
      case 'professions':
        return cmsModules.professionsModule.enabled;
      case 'news':
        return cmsModules.newsModule.enabled;
      case 'events':
        return cmsModules.eventsModule.enabled;
      case 'memorial':
        return cmsModules.memorialAndCapsuleModule.enabled;
      case 'majlis':
        return cmsModules.majlisAndGuardiansModule.enabled;
    }
  };

  const setSectionEnabled = (key: PortalSectionKey, next: boolean) => {
    switch (key) {
      case 'patriarch_quote':
        setVisualBranding((p) => ({
          ...p,
          patriarchQuote: { ...p.patriarchQuote, enabled: next },
        }));
        break;
      case 'atlas':
        setCmsModules((p) => ({
          ...p,
          atlasAndStatsModule: { ...p.atlasAndStatsModule, enabled: next },
        }));
        break;
      case 'tree_mirror':
        setTreeVisibility(next ? 'PUBLIC' : 'HIDDEN');
        break;
      case 'notables':
        setCmsModules((p) => ({
          ...p,
          notablesModule: { ...p.notablesModule, enabled: next },
        }));
        break;
      case 'stories':
        setCmsModules((p) => ({
          ...p,
          storiesModule: { ...p.storiesModule, enabled: next },
        }));
        break;
      case 'vault_gallery':
        setVaultVisibility(next ? 'PUBLIC' : 'HIDDEN');
        break;
      case 'oral_heritage':
        setCmsModules((p) => ({
          ...p,
          oralHeritageModule: { ...p.oralHeritageModule, enabled: next },
        }));
        break;
      case 'professions':
        setCmsModules((p) => ({
          ...p,
          professionsModule: { ...p.professionsModule, enabled: next },
        }));
        break;
      case 'news':
        setCmsModules((p) => ({
          ...p,
          newsModule: { ...p.newsModule, enabled: next },
        }));
        break;
      case 'events':
        setCmsModules((p) => ({
          ...p,
          eventsModule: { ...p.eventsModule, enabled: next },
        }));
        break;
      case 'memorial':
        setCmsModules((p) => ({
          ...p,
          memorialAndCapsuleModule: {
            ...p.memorialAndCapsuleModule,
            enabled: next,
          },
        }));
        break;
      case 'majlis':
        setCmsModules((p) => ({
          ...p,
          majlisAndGuardiansModule: {
            ...p.majlisAndGuardiansModule,
            enabled: next,
          },
        }));
        break;
    }
  };

  const getSectionVisibility = (
    key: PortalSectionKey
  ): ModuleVisibility | null => {
    switch (key) {
      case 'patriarch_quote':
        return null;
      case 'atlas':
        return cmsModules.atlasAndStatsModule.visibility;
      case 'tree_mirror':
        return treeVisibility;
      case 'notables':
        return cmsModules.notablesModule.visibility;
      case 'stories':
        return cmsModules.storiesModule.visibility;
      case 'vault_gallery':
        return vaultVisibility;
      case 'oral_heritage':
        return cmsModules.oralHeritageModule.visibility;
      case 'professions':
        return cmsModules.professionsModule.visibility;
      case 'news':
        return cmsModules.newsModule.visibility;
      case 'events':
        return cmsModules.eventsModule.visibility;
      case 'memorial':
        return cmsModules.memorialAndCapsuleModule.visibility;
      case 'majlis':
        return cmsModules.majlisAndGuardiansModule.visibility;
    }
  };

  const setSectionVisibility = (
    key: PortalSectionKey,
    next: ModuleVisibility
  ) => {
    switch (key) {
      case 'patriarch_quote':
        break;
      case 'atlas':
        setCmsModules((p) => ({
          ...p,
          atlasAndStatsModule: { ...p.atlasAndStatsModule, visibility: next },
        }));
        break;
      case 'tree_mirror':
        setTreeVisibility(next);
        break;
      case 'notables':
        setCmsModules((p) => ({
          ...p,
          notablesModule: { ...p.notablesModule, visibility: next },
        }));
        break;
      case 'stories':
        setCmsModules((p) => ({
          ...p,
          storiesModule: { ...p.storiesModule, visibility: next },
        }));
        break;
      case 'vault_gallery':
        setVaultVisibility(next);
        break;
      case 'oral_heritage':
        setCmsModules((p) => ({
          ...p,
          oralHeritageModule: { ...p.oralHeritageModule, visibility: next },
        }));
        break;
      case 'professions':
        setCmsModules((p) => ({
          ...p,
          professionsModule: { ...p.professionsModule, visibility: next },
        }));
        break;
      case 'news':
        setCmsModules((p) => ({
          ...p,
          newsModule: { ...p.newsModule, visibility: next },
        }));
        break;
      case 'events':
        setCmsModules((p) => ({
          ...p,
          eventsModule: { ...p.eventsModule, visibility: next },
        }));
        break;
      case 'memorial':
        setCmsModules((p) => ({
          ...p,
          memorialAndCapsuleModule: {
            ...p.memorialAndCapsuleModule,
            visibility: next,
          },
        }));
        break;
      case 'majlis':
        setCmsModules((p) => ({
          ...p,
          majlisAndGuardiansModule: {
            ...p.majlisAndGuardiansModule,
            visibility: next,
          },
        }));
        break;
    }
  };

  const getSectionContentStatus = (
    key: PortalSectionKey
  ): { label: string; filled: boolean } => {
    switch (key) {
      case 'patriarch_quote':
        return visualBranding.patriarchQuote?.text?.trim()
          ? { label: 'مكتملة ✓', filled: true }
          : { label: 'جاهز للإثراء', filled: false };
      case 'atlas': {
        const n = cmsModules.atlasAndStatsModule.locations.length;
        return n > 0
          ? { label: `${n} ديار`, filled: true }
          : { label: 'جاهز للإثراء', filled: false };
      }
      case 'tree_mirror': {
        const n = contemporaryOnlyMembers.length;
        return n > 0
          ? { label: `${n} فرد`, filled: true }
          : { label: 'متصلة بشجرتي', filled: false };
      }
      case 'notables': {
        const n = cmsModules.notablesModule.items.length;
        return n > 0
          ? { label: `${n} علم`, filled: true }
          : { label: 'جاهز للإثراء', filled: false };
      }
      case 'stories': {
        const n = cmsModules.storiesModule.items.length;
        return n > 0
          ? { label: `${n} قصص`, filled: true }
          : { label: 'جاهز للإثراء', filled: false };
      }
      case 'vault_gallery': {
        const n = selectedFolderIds.length + selectedVaultItemIds.length;
        return n > 0
          ? { label: `${n} مختار`, filled: true }
          : { label: 'جاهز للإثراء', filled: false };
      }
      case 'oral_heritage': {
        const n = cmsModules.oralHeritageModule.items.length;
        return n > 0
          ? { label: `${n} صوتية`, filled: true }
          : { label: 'جاهز للإثراء', filled: false };
      }
      case 'professions': {
        const n = cmsModules.professionsModule.items.length;
        return n > 0
          ? { label: `${n} كفاءة`, filled: true }
          : { label: 'جاهز للإثراء', filled: false };
      }
      case 'news': {
        const n = cmsModules.newsModule.items.length;
        return n > 0
          ? { label: `${n} خبر`, filled: true }
          : { label: 'جاهز للإثراء', filled: false };
      }
      case 'events': {
        const n = cmsModules.eventsModule.items.length;
        return n > 0
          ? { label: `${n} مناسبة`, filled: true }
          : { label: 'جاهز للإثراء', filled: false };
      }
      case 'memorial': {
        const n = cmsModules.memorialAndCapsuleModule.elders.length;
        const cap = cmsModules.memorialAndCapsuleModule.timeCapsule.enabled;
        if (n > 0) return { label: `${n} سيرة وفاء`, filled: true };
        if (cap) return { label: 'كبسولة مفعّلة ✓', filled: true };
        return { label: 'جاهز للإثراء', filled: false };
      }
      case 'majlis': {
        const n = cmsModules.majlisAndGuardiansModule.topics.length;
        return n > 0
          ? { label: `${n} حوار`, filled: true }
          : { label: 'جاهز للإثراء', filled: false };
      }
    }
  };

  // =========================================================================
  // MASTER VIEW: 12-SECTION SITE MAP INDEX
  // =========================================================================
  if (!focusedSectionKey) {
    const enabledCount = visualBranding.sectionOrder.filter((k) =>
      isSectionEnabled(k)
    ).length;

    return (
      <div className="space-y-3.5" data-testid="mysite-sections-master-index">
        {/* Top Guidance Bar */}
        <div className="rounded-2xl bg-[#FFFDF9] border border-[#E6DAC3] px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#9E5631] shrink-0" />
              <h3 className="text-[13.5px] font-display font-extrabold text-[#2C1E14]">
                خريطة أقسام الديوان ({visualBranding.sectionOrder.length} قسماً)
              </h3>
              <span className="text-[11px] font-display font-bold text-[#8C5327] tabular-nums">
                · {enabledCount} مفعّل
              </span>
            </div>
            <p className="text-[11.5px] text-[#7A5C43] mt-0.5">
              رتّب أقسام ديوانك، تحكّم في إظهارها، واضغط على أي قسم لإثراء
              محتواه
            </p>
          </div>

          <button
            type="button"
            disabled={isRecommendedSectionOrder}
            onClick={onResetSectionOrder}
            className={`h-8.5 px-3 rounded-xl border text-[11.5px] font-display font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              isRecommendedSectionOrder
                ? 'bg-[#FAF6EE] border-[#EAE0CF] text-[#A2917D] cursor-default'
                : 'bg-[#FAF6EE] hover:bg-[#F2E8D6] border-[#DFC798] text-[#7B401F] cursor-pointer'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>استعادة الترتيب الموصى به</span>
          </button>
        </div>

        {/* 12 Ordered Section Row Cards */}
        <div className="space-y-2" data-testid="section-order-list">
          {visualBranding.sectionOrder.map((secKey, idx) => {
            const enabled = isSectionEnabled(secKey);
            const status = getSectionContentStatus(secKey);

            return (
              <div
                key={secKey}
                onClick={() => onSelectSection(secKey)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectSection(secKey);
                  }
                }}
                className={`group rounded-2xl border px-3 py-2.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 transition-all cursor-pointer ${
                  enabled
                    ? 'bg-[#FFFDF9] border-[#E6DAC3] hover:border-[#C5A059] hover:shadow-[0_6px_20px_-14px_rgba(61,43,31,0.28)]'
                    : 'bg-[#FAF7F2]/80 border-[#ECE3D4] opacity-75 hover:opacity-100 hover:border-[#D4B988]'
                }`}
              >
                {/* Right Side: Reorder arrows + Sequence Badge + Icon + Title + Status */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {/* Reorder arrows */}
                  <div
                    className="flex flex-col gap-0.5 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => onMoveSectionOrder(secKey, 'up')}
                      title="تقديم للأعلى"
                      aria-label={`تقديم ${PORTAL_SECTION_LABELS[secKey]} للأعلى`}
                      className="w-5.5 h-4.5 rounded-md bg-[#FAF6EE] hover:bg-[#EFE4D0] border border-[#E6DAC3] flex items-center justify-center disabled:opacity-25 cursor-pointer transition-colors"
                    >
                      <ArrowUp className="w-3 h-3 text-[#5C4938]" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === visualBranding.sectionOrder.length - 1}
                      onClick={() => onMoveSectionOrder(secKey, 'down')}
                      title="تأخير للأسفل"
                      aria-label={`تأخير ${PORTAL_SECTION_LABELS[secKey]} للأسفل`}
                      className="w-5.5 h-4.5 rounded-md bg-[#FAF6EE] hover:bg-[#EFE4D0] border border-[#E6DAC3] flex items-center justify-center disabled:opacity-25 cursor-pointer transition-colors"
                    >
                      <ArrowDown className="w-3 h-3 text-[#5C4938]" />
                    </button>
                  </div>

                  {/* Sequence Badge */}
                  <span className="w-6.5 h-6.5 rounded-lg bg-[#FBF4E4] border border-[#D4AF6A]/60 text-[11px] font-display font-extrabold text-[#7B401F] flex items-center justify-center tabular-nums shrink-0">
                    {idx + 1}
                  </span>

                  {/* Section Icon */}
                  <div
                    className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 transition-colors ${
                      enabled
                        ? 'bg-[#FAF6EE] border-[#E6DAC3] text-[#9E5631] group-hover:bg-[#9E5631]/10'
                        : 'bg-[#F3ECE0] border-[#E5DAC8] text-[#8E7C69]'
                    }`}
                  >
                    {SECTION_ICON_MAP[secKey]}
                  </div>

                  {/* Title + Live Status */}
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-display font-extrabold text-[#2C1E14] truncate">
                      {PORTAL_SECTION_LABELS[secKey]}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                      <span
                        className={`font-display font-bold tabular-nums ${
                          status.filled
                            ? 'text-emerald-700'
                            : 'text-[#968370]'
                        }`}
                      >
                        {status.label}
                      </span>
                      {!enabled && (
                        <>
                          <span className="text-[#D4C5AE]">·</span>
                          <span className="text-[#968370]">مخفي حالياً</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Left Side: Switch + Edit CTA */}
                <div className="flex items-center gap-2.5 shrink-0 mr-auto sm:mr-0">
                  <ModernSwitch
                    checked={enabled}
                    onChange={(next) => setSectionEnabled(secKey, next)}
                    ariaLabel={`تفعيل قسم ${PORTAL_SECTION_LABELS[secKey]}`}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectSection(secKey);
                    }}
                    className="h-8 px-3 rounded-xl bg-[#FAF6EE] group-hover:bg-[#9E5631] border border-[#E2D5BE] group-hover:border-[#9E5631] text-[11.5px] font-display font-bold text-[#5C4028] group-hover:text-white inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <span>تحرير وإثراء</span>
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // =========================================================================
  // DETAIL VIEW: FOCUSED SINGLE-SECTION EDITOR
  // =========================================================================
  const order = visualBranding.sectionOrder;
  const activeIdx = order.indexOf(focusedSectionKey);
  const prevKey = activeIdx > 0 ? order[activeIdx - 1] : null;
  const nextKey =
    activeIdx >= 0 && activeIdx < order.length - 1 ? order[activeIdx + 1] : null;
  const activeEnabled = isSectionEnabled(focusedSectionKey);
  const activeVisibility = getSectionVisibility(focusedSectionKey);

  return (
    <div
      className="space-y-4"
      data-testid={`mysite-section-detail-${focusedSectionKey}`}
    >
      {/* Sticky Top Section Navigation Bar */}
      <div className="sticky top-2 z-10 rounded-2xl bg-[#FFFDF9]/96 backdrop-blur-md border border-[#DFC798] px-4 py-3 shadow-[0_10px_28px_-20px_rgba(61,43,31,0.3)] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onSelectSection(null)}
            className="h-8.5 px-3 rounded-xl bg-[#FAF6EE] hover:bg-[#EFE5D4] border border-[#E2D5BE] text-xs font-display font-extrabold text-[#5C4028] inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
          >
            <ArrowRight className="w-3.5 h-3.5 text-[#9E5631]" />
            <span>العودة إلى فهرس الأقسام ({order.length})</span>
          </button>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={!prevKey}
              onClick={() => prevKey && onSelectSection(prevKey)}
              className="h-8 px-2.5 rounded-xl bg-white hover:bg-[#FAF6EE] border border-[#E6DAC3] text-[11px] font-display font-bold text-[#5C4938] disabled:opacity-35 inline-flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap"
            >
              <ArrowRight className="w-3 h-3" />
              <span>القسم السابق</span>
            </button>
            <button
              type="button"
              disabled={!nextKey}
              onClick={() => nextKey && onSelectSection(nextKey)}
              className="h-8 px-2.5 rounded-xl bg-white hover:bg-[#FAF6EE] border border-[#E6DAC3] text-[11px] font-display font-bold text-[#5C4938] disabled:opacity-35 inline-flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap"
            >
              <span>القسم التالي</span>
              <ArrowLeft className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-[#F0E8DA]">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-7 h-7 rounded-lg bg-[#FBF4E4] border border-[#D4AF6A]/65 text-xs font-display font-extrabold text-[#7B401F] flex items-center justify-center tabular-nums shrink-0">
              {activeIdx + 1}
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#9E5631]/10 border border-[#9E5631]/25 text-[#9E5631] flex items-center justify-center shrink-0">
              {SECTION_ICON_MAP[focusedSectionKey]}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-display font-extrabold text-[#2C1E14] truncate">
                {PORTAL_SECTION_LABELS[focusedSectionKey]}
              </h3>
              <p className="text-[11px] text-[#7A5C43] truncate">
                {SECTION_DESC_MAP[focusedSectionKey]}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeVisibility !== null && (
              <VisibilityPillSelector
                value={activeVisibility}
                onChange={(v) => setSectionVisibility(focusedSectionKey, v)}
              />
            )}
            <ModernSwitch
              checked={activeEnabled}
              onChange={(next) => setSectionEnabled(focusedSectionKey, next)}
              ariaLabel={`تفعيل قسم ${PORTAL_SECTION_LABELS[focusedSectionKey]}`}
            />
          </div>
        </div>
      </div>

      {/* Focused Editor Body */}
      <div className="rounded-2xl bg-[#FFFDF9] border border-[#E6DAC3] p-5 space-y-4">
        {/* --------------------------------------------------------------- */}
        {/* 1. PATRIARCH QUOTE                                              */}
        {/* --------------------------------------------------------------- */}
        {focusedSectionKey === 'patriarch_quote' && (
          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-display font-bold text-[#5C4938]">
                نص كلمة عميد العائلة
              </label>
              <textarea
                rows={4}
                value={visualBranding.patriarchQuote?.text || ''}
                onChange={(e) =>
                  setVisualBranding((p) => ({
                    ...p,
                    patriarchQuote: {
                      ...p.patriarchQuote,
                      enabled: true,
                      text: e.target.value,
                    },
                  }))
                }
                placeholder={`مثال: «إنما تُحفظ الأنساب ليُصل بها الرحم، وتُروى سِيَر الأجداد لتكون نبراساً لأبنائنا في كل زمان...»`}
                className="w-full rounded-xl bg-[#FAF6EE] border border-[#E2D5BE] px-3.5 py-2.5 text-xs text-[#2C1E14] leading-relaxed focus:outline-none focus:border-[#C5A059] focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-display font-bold text-[#5C4938]">
                  اسم القائل أو عميد العائلة
                </label>
                <input
                  type="text"
                  value={visualBranding.patriarchQuote?.authorName || ''}
                  onChange={(e) =>
                    setVisualBranding((p) => ({
                      ...p,
                      patriarchQuote: {
                        ...p.patriarchQuote,
                        authorName: e.target.value,
                      },
                    }))
                  }
                  placeholder={`مثال: الشيخ عبد الله ${familyName}`}
                  className="w-full h-10 rounded-xl bg-[#FAF6EE] border border-[#E2D5BE] px-3 text-xs text-[#2C1E14] focus:outline-none focus:border-[#C5A059] focus:bg-white"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-display font-bold text-[#5C4938]">
                  الصفة العائلية
                </label>
                <input
                  type="text"
                  value={visualBranding.patriarchQuote?.authorTitle || ''}
                  onChange={(e) =>
                    setVisualBranding((p) => ({
                      ...p,
                      patriarchQuote: {
                        ...p.patriarchQuote,
                        authorTitle: e.target.value,
                      },
                    }))
                  }
                  placeholder={`عميد عائلة ${familyName}`}
                  className="w-full h-10 rounded-xl bg-[#FAF6EE] border border-[#E2D5BE] px-3 text-xs text-[#2C1E14] focus:outline-none focus:border-[#C5A059] focus:bg-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* --------------------------------------------------------------- */}
        {/* 2. ATLAS & DIAR                                                 */}
        {/* --------------------------------------------------------------- */}
        {focusedSectionKey === 'atlas' && (
          <div className="space-y-4">
            <div className="rounded-xl bg-[#FAF6EE] border border-[#EAE0CF] px-3.5 py-2.5 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-display font-bold text-[#2C1E14]">
                  إظهار إحصاءات الدوحة التلقائية
                </div>
                <p className="text-[11px] text-[#7A5C43]">
                  عرض عدد الأفراد والأجيال تلقائياً من «شجرتي» أعلى قسم الأطلس
                </p>
              </div>
              <ModernSwitch
                checked={cmsModules.atlasAndStatsModule.showAutoTreeNumbers}
                onChange={(next) =>
                  setCmsModules((p) => ({
                    ...p,
                    atlasAndStatsModule: {
                      ...p.atlasAndStatsModule,
                      showAutoTreeNumbers: next,
                    },
                  }))
                }
                ariaLabel="إظهار إحصاءات الدوحة التلقائية"
              />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newLocCity.trim()) return;
                setCmsModules((p) => ({
                  ...p,
                  atlasAndStatsModule: {
                    ...p.atlasAndStatsModule,
                    enabled: true,
                    locations: [
                      ...p.atlasAndStatsModule.locations,
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
              }}
              className="rounded-xl bg-[#FAF6EE] border border-[#E6DAC3] p-3.5 space-y-3"
            >
              <div className="text-xs font-display font-extrabold text-[#7B401F]">
                إضافة حاضرة أو ديرة جديدة
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={newLocCountry}
                  onChange={(e) => setNewLocCountry(e.target.value)}
                  placeholder="الدولة (مثال: السعودية)"
                  className="h-9.5 rounded-xl bg-white border border-[#E2D5BE] px-3 text-xs"
                />
                <input
                  type="text"
                  value={newLocCity}
                  onChange={(e) => setNewLocCity(e.target.value)}
                  placeholder="المدينة أو الحاضرة *"
                  className="h-9.5 rounded-xl bg-white border border-[#E2D5BE] px-3 text-xs"
                />
                <input
                  type="number"
                  min={1}
                  value={newLocCount}
                  onChange={(e) => setNewLocCount(Number(e.target.value) || 1)}
                  placeholder="عدد الأسر / الأفراد"
                  className="h-9.5 rounded-xl bg-white border border-[#E2D5BE] px-3 text-xs tabular-nums"
                />
              </div>
              <button
                type="submit"
                className="h-9 px-4 rounded-xl bg-[#9E5631] hover:bg-[#844524] text-white text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة الحاضرة للأطلس</span>
              </button>
            </form>

            {cmsModules.atlasAndStatsModule.locations.length === 0 ? (
              <p className="text-xs text-[#8C7A68] text-center py-4">
                لم تُضف أي حواضر بعد. أضف المدن التي تقطنها فروع عائلة{' '}
                {familyName} أعلاه.
              </p>
            ) : (
              <div className="space-y-2">
                {cmsModules.atlasAndStatsModule.locations.map((loc) => (
                  <div
                    key={loc.id}
                    className="rounded-xl bg-[#FCF9F3] border border-[#EAE0CF] px-3.5 py-2.5 flex items-center justify-between gap-2"
                  >
                    <div className="text-xs font-display font-bold text-[#2C1E14]">
                      {loc.city} — {loc.country}{' '}
                      <span className="text-[#8C5327] font-semibold tabular-nums">
                        ({loc.householdsOrMembersCount} أسرة/فرد)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setCmsModules((p) => ({
                          ...p,
                          atlasAndStatsModule: {
                            ...p.atlasAndStatsModule,
                            locations: p.atlasAndStatsModule.locations.filter(
                              (x) => x.id !== loc.id
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
          </div>
        )}

        {/* --------------------------------------------------------------- */}
        {/* 3. TREE MIRROR (دوحة نسب العائلة التفاعلية)                      */}
        {/* --------------------------------------------------------------- */}
        {focusedSectionKey === 'tree_mirror' && (
          <div className="space-y-4">
            <div className="rounded-xl bg-[#FAF6EE] border border-[#E2D5BE] p-3.5 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-display font-extrabold text-[#2C1E14]">
                  متزامنة تلقائياً مع ثيم وخطوط «شجرتي»
                </div>
                <p className="text-[11px] text-[#7A5C43] mt-0.5">
                  عدد الأفراد الجاهزين للعرض حالياً:{' '}
                  <strong className="tabular-nums text-[#7B401F]">
                    {contemporaryOnlyMembers.length}
                  </strong>{' '}
                  فرداً معاصراً.
                </p>
              </div>
              {onOpenTreeSettings && (
                <button
                  type="button"
                  onClick={onOpenTreeSettings}
                  className="h-9 px-3.5 rounded-xl bg-white hover:bg-[#F5ECE0] border border-[#DFC798] text-xs font-display font-bold text-[#7B401F] inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>فتح إعدادات «شجرتي»</span>
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-display font-bold text-[#5C4938]">
                تحديد الجد الذي تبدأ منه الشجرة المنشورة (اختياري)
              </label>
              <select
                value={startRootPersonId}
                onChange={(e) => setStartRootPersonId(e.target.value)}
                className="w-full h-10 rounded-xl bg-[#FAF6EE] border border-[#E2D5BE] px-3 text-xs font-display font-bold text-[#2C1E14] focus:outline-none focus:border-[#C5A059]"
              >
                <option value="">
                  عرض الشجرة المعاصرة بالكامل (الافتراضي)
                </option>
                {contemporaryOnlyMembers.map((m) => {
                  const memberLabel =
                    (typeof m.firstName === 'string' && m.firstName.trim()) ||
                    (typeof m.name === 'string' && m.name.trim()) ||
                    'عضو في الشجرة';
                  return (
                    <option key={m.id} value={m.id}>
                      البدء من: {memberLabel}
                    </option>
                  );
                })}
              </select>
            </div>

            {contemporaryOnlyMembers.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-display font-bold text-[#5C4938]">
                  استثناء فروع محددة من النشر (انقر لاستثناء الفرع أو إعادته)
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-2.5 rounded-xl bg-[#FAF6EE] border border-[#EAE0CF]">
                  {contemporaryOnlyMembers.map((m) => {
                    const excluded = excludedBranchRootIds.includes(m.id);
                    const memberLabel =
                      (typeof m.firstName === 'string' && m.firstName.trim()) ||
                      (typeof m.name === 'string' && m.name.trim()) ||
                      'عضو في الشجرة';
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() =>
                          setExcludedBranchRootIds((prev) =>
                            prev.includes(m.id)
                              ? prev.filter((id) => id !== m.id)
                              : [...prev, m.id]
                          )
                        }
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-display font-bold border transition-colors cursor-pointer ${
                          excluded
                            ? 'bg-red-50 border-red-300 text-red-800 line-through'
                            : 'bg-white border-[#E2D5BE] text-[#3D2B1F] hover:border-[#C5A059]'
                        }`}
                      >
                        {memberLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* --------------------------------------------------------------- */}
        {/* 4. NOTABLES                                                     */}
        {/* --------------------------------------------------------------- */}
        {focusedSectionKey === 'notables' && (
          <div className="space-y-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newNotableName.trim()) return;
                setCmsModules((p) => ({
                  ...p,
                  notablesModule: {
                    ...p.notablesModule,
                    enabled: true,
                    items: [
                      {
                        id: `not_${Date.now()}`,
                        fullName: newNotableName.trim(),
                        roleOrTitle: newNotableRole.trim() || 'من رواد العائلة',
                        eraLabel: newNotableEra.trim() || 'العصر المعاصر',
                        achievementSummary: newNotableBio.trim(),
                        imageUrl: newNotableImageUrl || undefined,
                      },
                      ...p.notablesModule.items,
                    ],
                  },
                }));
                setNewNotableName('');
                setNewNotableRole('');
                setNewNotableEra('');
                setNewNotableBio('');
                setNewNotableImageUrl('');
              }}
              className="rounded-xl bg-[#FAF6EE] border border-[#E6DAC3] p-3.5 space-y-2.5"
            >
              <div className="text-xs font-display font-extrabold text-[#7B401F]">
                إضافة علم أو رائد من العائلة
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={newNotableName}
                  onChange={(e) => setNewNotableName(e.target.value)}
                  placeholder="الاسم الكامل *"
                  className="h-9.5 rounded-xl bg-white border border-[#E2D5BE] px-3 text-xs"
                />
                <input
                  type="text"
                  value={newNotableRole}
                  onChange={(e) => setNewNotableRole(e.target.value)}
                  placeholder="الصفة أو اللقب (مثال: طبيب، شاعر)"
                  className="h-9.5 rounded-xl bg-white border border-[#E2D5BE] px-3 text-xs"
                />
                <input
                  type="text"
                  value={newNotableEra}
                  onChange={(e) => setNewNotableEra(e.target.value)}
                  placeholder="الحقبة (مثال: 1350 - 1420هـ)"
                  className="h-9.5 rounded-xl bg-white border border-[#E2D5BE] px-3 text-xs"
                />
              </div>
              <textarea
                rows={2}
                value={newNotableBio}
                onChange={(e) => setNewNotableBio(e.target.value)}
                placeholder="نبذة موجزة عن أبرز مآثره وإنجازاته..."
                className="w-full rounded-xl bg-white border border-[#E2D5BE] px-3 py-2 text-xs"
              />
              <OptionalImagePicker
                value={newNotableImageUrl}
                onChange={setNewNotableImageUrl}
                vaultPhotos={vaultImageItems}
                uid={userId}
                label="صورة الشخصية (اختياري)"
              />
              <button
                type="submit"
                className="h-9 px-4 rounded-xl bg-[#9E5631] hover:bg-[#844524] text-white text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة إلى قائمة الأعلام</span>
              </button>
            </form>

            {cmsModules.notablesModule.items.length === 0 ? (
              <p className="text-xs text-[#8C7A68] text-center py-4">
                لا توجد شخصيات مضافة بعد. وثّق أعلام ورواد عائلة {familyName}{' '}
                أعلاه.
              </p>
            ) : (
              <div className="space-y-2">
                {cmsModules.notablesModule.items.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl bg-[#FCF9F3] border border-[#EAE0CF] px-3.5 py-2.5 flex items-center justify-between gap-2.5"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-display font-extrabold text-[#2C1E14] truncate">
                        {item.fullName}
                      </div>
                      <div className="text-[11px] text-[#8C5327] truncate">
                        {item.roleOrTitle} · {item.eraLabel}
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
                              (x) => x.id !== item.id
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
          </div>
        )}

        {/* --------------------------------------------------------------- */}
        {/* 5. STORIES                                                      */}
        {/* --------------------------------------------------------------- */}
        {focusedSectionKey === 'stories' && (
          <div className="space-y-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newStoryTitle.trim() || !newStoryBody.trim()) return;
                setCmsModules((p) => ({
                  ...p,
                  storiesModule: {
                    ...p.storiesModule,
                    enabled: true,
                    items: [
                      {
                        id: `st_${Date.now()}`,
                        title: newStoryTitle.trim(),
                        eraOrYearLabel: newStoryEra.trim() || 'ذاكرة العائلة',
                        body: newStoryBody.trim(),
                        imageUrl: newStoryImageUrl || undefined,
                      },
                      ...p.storiesModule.items,
                    ],
                  },
                }));
                setNewStoryTitle('');
                setNewStoryEra('');
                setNewStoryBody('');
                setNewStoryImageUrl('');
              }}
              className="rounded-xl bg-[#FAF6EE] border border-[#E6DAC3] p-3.5 space-y-2.5"
            >
              <div className="text-xs font-display font-extrabold text-[#7B401F]">
                تدوين قصة أو ذكرى عائلية
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={newStoryTitle}
                  onChange={(e) => setNewStoryTitle(e.target.value)}
                  placeholder="عنوان القصة *"
                  className="sm:col-span-2 h-9.5 rounded-xl bg-white border border-[#E2D5BE] px-3 text-xs"
                />
                <input
                  type="text"
                  value={newStoryEra}
                  onChange={(e) => setNewStoryEra(e.target.value)}
                  placeholder="السنة أو الحقبة"
                  className="h-9.5 rounded-xl bg-white border border-[#E2D5BE] px-3 text-xs"
                />
              </div>
              <textarea
                rows={3}
                value={newStoryBody}
                onChange={(e) => setNewStoryBody(e.target.value)}
                placeholder="اكتب تفاصيل القصة أو الموقف المأثور..."
                className="w-full rounded-xl bg-white border border-[#E2D5BE] px-3 py-2 text-xs"
              />
              <OptionalImagePicker
                value={newStoryImageUrl}
                onChange={setNewStoryImageUrl}
                vaultPhotos={vaultImageItems}
                uid={userId}
              />
              <button
                type="submit"
                className="h-9 px-4 rounded-xl bg-[#9E5631] hover:bg-[#844524] text-white text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>حفظ القصة في الديوان</span>
              </button>
            </form>

            {cmsModules.storiesModule.items.length === 0 ? (
              <p className="text-xs text-[#8C7A68] text-center py-4">
                لا توجد قصص مدونة بعد.
              </p>
            ) : (
              <div className="space-y-2">
                {cmsModules.storiesModule.items.map((st) => (
                  <div
                    key={st.id}
                    className="rounded-xl bg-[#FCF9F3] border border-[#EAE0CF] px-3.5 py-2.5 flex items-center justify-between gap-2.5"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-display font-extrabold text-[#2C1E14] truncate">
                        {st.title}
                      </div>
                      <div className="text-[11px] text-[#8C5327] truncate">
                        {st.eraOrYearLabel}
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
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-700 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --------------------------------------------------------------- */}
        {/* 6. VAULT GALLERY                                                */}
        {/* --------------------------------------------------------------- */}
        {focusedSectionKey === 'vault_gallery' && (
          <div className="space-y-4">
            <div className="divide-y divide-[#F0E8DA] rounded-xl border border-[#EAE0CF] bg-[#FCF9F3]">
              <div className="px-3.5 py-2.5 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-display font-bold text-[#2C1E14]">
                    علامة مائية ديناميكية لحماية الصور والوثائق
                  </div>
                  <p className="text-[11px] text-[#7A5C43]">
                    دمغ المقتنيات تلقائياً برابط الديوان لحفظ الحقوق العائلية
                  </p>
                </div>
                <ModernSwitch
                  checked={enableDynamicWatermark}
                  onChange={setEnableDynamicWatermark}
                  ariaLabel="علامة مائية ديناميكية"
                />
              </div>
              <div className="px-3.5 py-2.5 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-display font-bold text-[#2C1E14]">
                    تمكين طلب التعرف على الوجوه في الصور التراثية
                  </div>
                  <p className="text-[11px] text-[#7A5C43]">
                    يتيح للأقارب مساعدتك في تسمية الشخصيات في الصور القديمة
                  </p>
                </div>
                <ModernSwitch
                  checked={enablePhotoFacePrompt}
                  onChange={setEnablePhotoFacePrompt}
                  ariaLabel="تمكين التعرف على الوجوه"
                />
              </div>
            </div>

            {/* Folders picker */}
            {vaultFolders.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-display font-bold text-[#5C4938]">
                  مجلدات خزانتي المختارة للعرض ({selectedFolderIds.length})
                </div>
                <div className="flex flex-wrap gap-2">
                  {vaultFolders.map((folder) => {
                    const selected = selectedFolderIds.includes(folder.id);
                    return (
                      <button
                        key={folder.id}
                        type="button"
                        onClick={() =>
                          setSelectedFolderIds((prev) =>
                            prev.includes(folder.id)
                              ? prev.filter((id) => id !== folder.id)
                              : [...prev, folder.id]
                          )
                        }
                        className={`px-3 py-1.5 rounded-xl text-xs font-display font-bold border inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                          selected
                            ? 'bg-[#9E5631] border-[#9E5631] text-white'
                            : 'bg-[#FAF6EE] border-[#E2D5BE] text-[#3D2B1F] hover:border-[#C5A059]'
                        }`}
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>{folder.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Individual items picker */}
            <div className="space-y-2">
              <div className="text-xs font-display font-bold text-[#5C4938]">
                اختيار صور ووثائق محددة من خزانتي ({selectedVaultItemIds.length})
              </div>
              {allVaultItems.length === 0 ? (
                <p className="text-xs text-[#8C7A68] bg-[#FAF6EE] border border-[#EAE0CF] rounded-xl p-4 text-center">
                  لا توجد مقتنيات مرفوعة في «خزانتي» بعد. ارفع صورك في تبويب
                  «خزانتي» لتظهر هنا فوراً.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto p-1">
                  {allVaultItems.map((item) => {
                    const selected = selectedVaultItemIds.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() =>
                          setSelectedVaultItemIds((prev) =>
                            prev.includes(item.id)
                              ? prev.filter((id) => id !== item.id)
                              : [...prev, item.id]
                          )
                        }
                        className={`rounded-xl border overflow-hidden text-right transition-all cursor-pointer ${
                          selected
                            ? 'border-[#9E5631] ring-2 ring-[#9E5631]/25 bg-[#FBF5EA]'
                            : 'border-[#E6DAC3] bg-white hover:border-[#C5A059]'
                        }`}
                      >
                        {item.thumbnailDataUrl || item.fileDataUrl ? (
                          <div className="h-20 bg-[#F5EFE4] overflow-hidden">
                            <img
                              src={item.thumbnailDataUrl || item.fileDataUrl}
                              alt={item.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="h-20 bg-[#F5EFE4] flex items-center justify-center text-[#8C5327]">
                            <ImageIcon className="w-5 h-5" />
                          </div>
                        )}
                        <div className="p-2 text-[11px] font-display font-bold text-[#2C1E14] truncate">
                          {item.title}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* --------------------------------------------------------------- */}
        {/* 7. ORAL HERITAGE                                                */}
        {/* --------------------------------------------------------------- */}
        {focusedSectionKey === 'oral_heritage' && (
          <div className="space-y-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newAudioTitle.trim()) return;
                setCmsModules((p) => ({
                  ...p,
                  oralHeritageModule: {
                    ...p.oralHeritageModule,
                    enabled: true,
                    items: [
                      {
                        id: `aud_${Date.now()}`,
                        title: newAudioTitle.trim(),
                        speakerName: newAudioSpeaker.trim() || 'من كبار العائلة',
                        recordedYearLabel: newAudioYear.trim() || 'تسجيل أرشيفي',
                        audioDataOrUrl: newAudioUrl.trim() || undefined,
                        transcriptExcerpt: newAudioExcerpt.trim(),
                      },
                      ...p.oralHeritageModule.items,
                    ],
                  },
                }));
                setNewAudioTitle('');
                setNewAudioSpeaker('');
                setNewAudioYear('');
                setNewAudioUrl('');
                setNewAudioExcerpt('');
              }}
              className="rounded-xl bg-[#FAF6EE] border border-[#E6DAC3] p-3.5 space-y-2.5"
            >
              <div className="text-xs font-display font-extrabold text-[#7B401F]">
                إضافة تسجيل صوتي أو شهادة شفهية
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={newAudioTitle}
                  onChange={(e) => setNewAudioTitle(e.target.value)}
                  placeholder="عنوان التسجيل *"
                  className="h-9.5 rounded-xl bg-white border border-[#E2D5BE] px-3 text-xs"
                />
                <input
                  type="text"
                  value={newAudioSpeaker}
                  onChange={(e) => setNewAudioSpeaker(e.target.value)}
                  placeholder="اسم الراوي"
                  className="h-9.5 rounded-xl bg-white border border-[#E2D5BE] px-3 text-xs"
                />
                <input
                  type="text"
                  value={newAudioYear}
                  onChange={(e) => setNewAudioYear(e.target.value)}
                  placeholder="سنة التسجيل"
                  className="h-9.5 rounded-xl bg-white border border-[#E2D5BE] px-3 text-xs"
                />
              </div>
              <input
                type="url"
                dir="ltr"
                value={newAudioUrl}
                onChange={(e) => setNewAudioUrl(e.target.value)}
                placeholder="https://... (رابط ملف MP3 أو صوتي — اختياري)"
                className="w-full h-9.5 rounded-xl bg-white border border-[#E2D5BE] px-3 text-xs font-mono"
              />
              <textarea
                rows={2}
                value={newAudioExcerpt}
                onChange={(e) => setNewAudioExcerpt(e.target.value)}
                placeholder="مقتطف نصي من الحديث أو الرواية..."
                className="w-full rounded-xl bg-white border border-[#E2D5BE] px-3 py-2 text-xs"
              />
              <button
                type="submit"
                className="h-9 px-4 rounded-xl bg-[#9E5631] hover:bg-[#844524] text-white text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة إلى أرشيف الصوتيات</span>
              </button>
            </form>

            {cmsModules.oralHeritageModule.items.length === 0 ? (
              <p className="text-xs text-[#8C7A68] text-center py-4">
                لا توجد تسجيلات شفهية مضافة بعد.
              </p>
            ) : (
              <div className="space-y-2">
                {cmsModules.oralHeritageModule.items.map((aud) => (
                  <div
                    key={aud.id}
                    className="rounded-xl bg-[#FCF9F3] border border-[#EAE0CF] px-3.5 py-2.5 flex items-center justify-between gap-2.5"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-display font-extrabold text-[#2C1E14] truncate">
                        {aud.title}
                      </div>
                      <div className="text-[11px] text-[#8C5327] truncate">
                        {aud.speakerName} · {aud.recordedYearLabel}
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
                              (x) => x.id !== aud.id
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
          </div>
        )}

        {/* --------------------------------------------------------------- */}
        {/* 8. PROFESSIONS DIRECTORY                                        */}
        {/* --------------------------------------------------------------- */}
        {focusedSectionKey === 'professions' && (
          <div className="space-y-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newProfName.trim() || !newProfSpecialty.trim()) return;
                setCmsModules((p) => ({
                  ...p,
                  professionsModule: {
                    ...p.professionsModule,
                    enabled: true,
                    items: [
                      {
                        id: `pr_${Date.now()}`,
                        memberName: newProfName.trim(),
                        fieldCategory: newProfCategory,
                        specialtyOrProfession: newProfSpecialty.trim(),
                        cityCountryLabel: newProfCity.trim() || undefined,
                      },
                      ...p.professionsModule.items,
                    ],
                  },
                }));
                setNewProfName('');
                setNewProfSpecialty('');
                setNewProfCity('');
              }}
              className="rounded-xl bg-[#FAF6EE] border border-[#E6DAC3] p-3.5 space-y-2.5"
            >
              <div className="text-xs font-display font-extrabold text-[#7B401F]">
                إضافة كفاءة أو متخصص من أبناء العائلة
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newProfName}
                  onChange={(e) => setNewProfName(e.target.value)}
                  placeholder="اسم الفرد *"
                  className="h-9.5 rounded-xl bg-white border border-[#E2D5BE] px-3 text-xs"
                />
                <input
                  type="text"
                  value={newProfSpecialty}
                  onChange={(e) => setNewProfSpecialty(e.target.value)}
                  placeholder="التخصص الدقيق أو المهنة *"
                  className="h-9.5 rounded-xl bg-white border border-[#E2D5BE] px-3 text-xs"
                />
                <select
                  value={newProfCategory}
                  onChange={(e) => setNewProfCategory(e.target.value)}
                  className="h-9.5 rounded-xl bg-white border border-[#E2D5BE] px-3 text-xs"
                >
                  <option value="الطب والرعاية الصحية">
                    الطب والرعاية الصحية
                  </option>
                  <option value="الهندسة والتقنية">الهندسة والتقنية</option>
                  <option value="القانون والاستشارات">
                    القانون والاستشارات
                  </option>
                  <option value="التعليم والأكاديميا">
                    التعليم والأكاديميا
                  </option>
                  <option value="ريادة الأعمال والمالية">
                    ريادة الأعمال والمالية
                  </option>
                  <option value="تخصصات أخرى">تخصصات أخرى</option>
                </select>
                <input
                  type="text"
                  value={newProfCity}
                  onChange={(e) => setNewProfCity(e.target.value)}
                  placeholder="المدينة (اختياري)"
                  className="h-9.5 rounded-xl bg-white border border-[#E2D5BE] px-3 text-xs"
                />
              </div>
              <button
                type="submit"
                className="h-9 px-4 rounded-xl bg-[#9E5631] hover:bg-[#844524] text-white text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة إلى دليل الكفاءات</span>
              </button>
            </form>

            {cmsModules.professionsModule.items.length === 0 ? (
              <p className="text-xs text-[#8C7A68] text-center py-4">
                لم تُضف أي كفاءات مهنية بعد.
              </p>
            ) : (
              <div className="space-y-2">
                {cmsModules.professionsModule.items.map((pr) => (
                  <div
                    key={pr.id}
                    className="rounded-xl bg-[#FCF9F3] border border-[#EAE0CF] px-3.5 py-2.5 flex items-center justify-between gap-2.5"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-display font-extrabold text-[#2C1E14] truncate">
                        {pr.memberName} — {pr.specialtyOrProfession}
                      </div>
                      <div className="text-[11px] text-[#8C5327] truncate">
                        {pr.fieldCategory}
                        {pr.cityCountryLabel ? ` · ${pr.cityCountryLabel}` : ''}
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
                              (x) => x.id !== pr.id
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
          </div>
        )}

        {/* --------------------------------------------------------------- */}
        {/* 9. NEWS & BLESSINGS                                             */}
        {/* --------------------------------------------------------------- */}
        {focusedSectionKey === 'news' && (
          <div className="space-y-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newNewsTitle.trim()) return;
                setCmsModules((p) => ({
                  ...p,
                  newsModule: {
                    ...p.newsModule,
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
                      ...p.newsModule.items,
                    ],
                  },
                }));
                setNewNewsTitle('');
                setNewNewsSummary('');
                setNewNewsImageUrl('');
              }}
              className="rounded-xl bg-[#FAF6EE] border border-[#E6DAC3] p-3.5 space-y-2.5"
            >
              <div className="text-xs font-display font-extrabold text-[#7B401F]">
                نشر خبر أو تهنئة عائلية
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select
                  value={newNewsCategory}
                  onChange={(e) =>
                    setNewNewsCategory(e.target.value as typeof newNewsCategory)
                  }
                  className="h-9.5 rounded-xl bg-white border border-[#E2D5BE] px-3 text-xs"
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
                  placeholder="عنوان الخبر أو التهنئة *"
                  className="sm:col-span-2 h-9.5 rounded-xl bg-white border border-[#E2D5BE] px-3 text-xs"
                />
              </div>
              <textarea
                rows={2}
                value={newNewsSummary}
                onChange={(e) => setNewNewsSummary(e.target.value)}
                placeholder="تفاصيل موجزة للخبر..."
                className="w-full rounded-xl bg-white border border-[#E2D5BE] px-3 py-2 text-xs"
              />
              <OptionalImagePicker
                value={newNewsImageUrl}
                onChange={setNewNewsImageUrl}
                vaultPhotos={vaultImageItems}
                uid={userId}
              />
              <button
                type="submit"
                className="h-9 px-4 rounded-xl bg-[#9E5631] hover:bg-[#844524] text-white text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة الخبر للنشرة</span>
              </button>
            </form>

            {cmsModules.newsModule.items.length === 0 ? (
              <p className="text-xs text-[#8C7A68] text-center py-4">
                لا توجد أخبار أو تهانٍ منشورة بعد.
              </p>
            ) : (
              <div className="space-y-2">
                {cmsModules.newsModule.items.map((n) => (
                  <div
                    key={n.id}
                    className="rounded-xl bg-[#FCF9F3] border border-[#EAE0CF] px-3.5 py-2.5 flex items-center justify-between gap-2.5"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-display font-extrabold text-[#2C1E14] truncate">
                        {n.title}
                      </div>
                      <div className="text-[11px] text-[#8C5327] truncate">
                        {n.category} · {n.dateLabel}
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
                              (x) => x.id !== n.id
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
          </div>
        )}

        {/* --------------------------------------------------------------- */}
        {/* 10. EVENTS & RSVP                                               */}
        {/* --------------------------------------------------------------- */}
        {focusedSectionKey === 'events' && (
          <div className="space-y-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newEventTitle.trim() || !newEventDate) return;
                setCmsModules((p) => ({
                  ...p,
                  eventsModule: {
                    ...p.eventsModule,
                    enabled: true,
                    items: [
                      {
                        id: `ev_${Date.now()}`,
                        title: newEventTitle.trim(),
                        eventDateIso: newEventDate,
                        locationLabel: newEventLocation.trim() || 'مجلس العائلة',
                        rsvps: [],
                      },
                      ...p.eventsModule.items,
                    ],
                  },
                }));
                setNewEventTitle('');
                setNewEventDate('');
                setNewEventLocation('');
              }}
              className="rounded-xl bg-[#FAF6EE] border border-[#E6DAC3] p-3.5 space-y-2.5"
            >
              <div className="text-xs font-display font-extrabold text-[#7B401F]">
                إضافة مناسبة أو لقاء عائلي
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  placeholder="اسم المناسبة *"
                  className="h-9.5 rounded-xl bg-white border border-[#E2D5BE] px-3 text-xs"
                />
                <input
                  type="date"
                  value={newEventDate}
                  onChange={(e) => setNewEventDate(e.target.value)}
                  className="h-9.5 rounded-xl bg-white border border-[#E2D5BE] px-3 text-xs"
                />
                <input
                  type="text"
                  value={newEventLocation}
                  onChange={(e) => setNewEventLocation(e.target.value)}
                  placeholder="الموقع / مجلس العائلة"
                  className="h-9.5 rounded-xl bg-white border border-[#E2D5BE] px-3 text-xs"
                />
              </div>
              <button
                type="submit"
                className="h-9 px-4 rounded-xl bg-[#9E5631] hover:bg-[#844524] text-white text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة المناسبة للتقويم</span>
              </button>
            </form>

            {cmsModules.eventsModule.items.length === 0 ? (
              <p className="text-xs text-[#8C7A68] text-center py-4">
                لا توجد مناسبات مجدولة بعد.
              </p>
            ) : (
              <div className="space-y-2">
                {cmsModules.eventsModule.items.map((ev) => (
                  <div
                    key={ev.id}
                    className="rounded-xl bg-[#FCF9F3] border border-[#EAE0CF] px-3.5 py-2.5 flex items-center justify-between gap-2.5"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-display font-extrabold text-[#2C1E14] truncate">
                        {ev.title}
                      </div>
                      <div className="text-[11px] text-[#8C5327] truncate">
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
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-700 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --------------------------------------------------------------- */}
        {/* 11. MEMORIAL & TIME CAPSULE                                     */}
        {/* --------------------------------------------------------------- */}
        {focusedSectionKey === 'memorial' && (
          <div className="space-y-4">
            {/* Time capsule block */}
            <div className="rounded-xl bg-[#FAF6EE] border border-[#DFC798] p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-display font-extrabold text-[#7B401F]">
                    كبسولة الزمن للأجيال القادمة
                  </div>
                  <p className="text-[11px] text-[#7A5C43]">
                    رسالة أو وصية مختومة تُفتح تلقائياً في تاريخ مستقبلي تختاره
                  </p>
                </div>
                <ModernSwitch
                  checked={cmsModules.memorialAndCapsuleModule.timeCapsule.enabled}
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

              {cmsModules.memorialAndCapsuleModule.timeCapsule.enabled && (
                <div className="space-y-2 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={
                        cmsModules.memorialAndCapsuleModule.timeCapsule.title
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
                      placeholder="عنوان الرسالة المختومة"
                      className="h-9.5 rounded-xl bg-white border border-[#E2D5BE] px-3 text-xs"
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
                      className="h-9.5 rounded-xl bg-white border border-[#E2D5BE] px-3 text-xs"
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
                    placeholder="نص الوصية أو الرسالة المحفوظة للأحفاد..."
                    className="w-full rounded-xl bg-white border border-[#E2D5BE] px-3 py-2 text-xs"
                  />
                </div>
              )}
            </div>

            {/* Add Elder to Memorial */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newElderName.trim()) return;
                setCmsModules((p) => ({
                  ...p,
                  memorialAndCapsuleModule: {
                    ...p.memorialAndCapsuleModule,
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
                      ...p.memorialAndCapsuleModule.elders,
                    ],
                  },
                }));
                setNewElderName('');
                setNewElderYear('');
                setNewElderBio('');
                setNewElderCharity('');
              }}
              className="rounded-xl bg-[#FAF6EE] border border-[#E6DAC3] p-3.5 space-y-2.5"
            >
              <div className="text-xs font-display font-extrabold text-[#7B401F]">
                إضافة سيرة في لوحة الوفاء والدعاء
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newElderName}
                  onChange={(e) => setNewElderName(e.target.value)}
                  placeholder="الاسم الكامل للراحل رحمه الله *"
                  className="h-9.5 rounded-xl bg-white border border-[#E2D5BE] px-3 text-xs"
                />
                <input
                  type="text"
                  value={newElderYear}
                  onChange={(e) => setNewElderYear(e.target.value)}
                  placeholder="سنة الوفاة (مثال: 1438هـ)"
                  className="h-9.5 rounded-xl bg-white border border-[#E2D5BE] px-3 text-xs"
                />
              </div>
              <input
                type="text"
                value={newElderCharity}
                onChange={(e) => setNewElderCharity(e.target.value)}
                placeholder="صدقة جارية أو وقف مقترح (اختياري)"
                className="w-full h-9.5 rounded-xl bg-white border border-[#E2D5BE] px-3 text-xs"
              />
              <textarea
                rows={2}
                value={newElderBio}
                onChange={(e) => setNewElderBio(e.target.value)}
                placeholder="نبذة وفاء ودعاء..."
                className="w-full rounded-xl bg-white border border-[#E2D5BE] px-3 py-2 text-xs"
              />
              <button
                type="submit"
                className="h-9 px-4 rounded-xl bg-[#9E5631] hover:bg-[#844524] text-white text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة إلى لوحة الوفاء</span>
              </button>
            </form>

            {cmsModules.memorialAndCapsuleModule.elders.length > 0 && (
              <div className="space-y-2">
                {cmsModules.memorialAndCapsuleModule.elders.map((el) => (
                  <div
                    key={el.id}
                    className="rounded-xl bg-[#FCF9F3] border border-[#EAE0CF] px-3.5 py-2.5 flex items-center justify-between gap-2.5"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-display font-extrabold text-[#2C1E14] truncate">
                        {el.fullName}
                      </div>
                      <div className="text-[11px] text-[#8C5327] truncate">
                        {el.passingYearLabel}
                        {el.ongoingCharityTitle
                          ? ` · ${el.ongoingCharityTitle}`
                          : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setCmsModules((p) => ({
                          ...p,
                          memorialAndCapsuleModule: {
                            ...p.memorialAndCapsuleModule,
                            elders: p.memorialAndCapsuleModule.elders.filter(
                              (x) => x.id !== el.id
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
          </div>
        )}

        {/* --------------------------------------------------------------- */}
        {/* 12. MAJLIS & GUARDIANS OF MEMORY                                */}
        {/* --------------------------------------------------------------- */}
        {focusedSectionKey === 'majlis' && (
          <div className="space-y-4">
            <div className="rounded-xl bg-[#FAF6EE] border border-[#EAE0CF] px-3.5 py-2.5 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-display font-bold text-[#2C1E14]">
                  إظهار لوحة شرف «حراس الذاكرة»
                </div>
                <p className="text-[11px] text-[#7A5C43]">
                  تكريم أبرز المساهمين من أفراد العائلة في إثراء الشجرة والخزانة
                </p>
              </div>
              <ModernSwitch
                checked={
                  cmsModules.majlisAndGuardiansModule.showGuardiansHonorRoll
                }
                onChange={(next) =>
                  setCmsModules((p) => ({
                    ...p,
                    majlisAndGuardiansModule: {
                      ...p.majlisAndGuardiansModule,
                      showGuardiansHonorRoll: next,
                    },
                  }))
                }
                ariaLabel="إظهار لوحة حراس الذاكرة"
              />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newTopicTitle.trim() || !newTopicPrompt.trim()) return;
                setCmsModules((p) => ({
                  ...p,
                  majlisAndGuardiansModule: {
                    ...p.majlisAndGuardiansModule,
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
                      ...p.majlisAndGuardiansModule.topics,
                    ],
                  },
                }));
                setNewTopicTitle('');
                setNewTopicPrompt('');
              }}
              className="rounded-xl bg-[#FAF6EE] border border-[#E6DAC3] p-3.5 space-y-2.5"
            >
              <div className="text-xs font-display font-extrabold text-[#7B401F]">
                طرح موضوع حواري جديد في مجلس العائلة
              </div>
              <input
                type="text"
                value={newTopicTitle}
                onChange={(e) => setNewTopicTitle(e.target.value)}
                placeholder="عنوان الحوار (مثال: ذكريات العيد في بيت الجد) *"
                className="w-full h-9.5 rounded-xl bg-white border border-[#E2D5BE] px-3 text-xs"
              />
              <textarea
                rows={2}
                value={newTopicPrompt}
                onChange={(e) => setNewTopicPrompt(e.target.value)}
                placeholder="سؤال توجيهي يشجع الأقارب على مشاركة ذكرياتهم..."
                className="w-full rounded-xl bg-white border border-[#E2D5BE] px-3 py-2 text-xs"
              />
              <button
                type="submit"
                className="h-9 px-4 rounded-xl bg-[#9E5631] hover:bg-[#844524] text-white text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>نشر الموضوع في المجلس</span>
              </button>
            </form>

            {cmsModules.majlisAndGuardiansModule.topics.length === 0 ? (
              <p className="text-xs text-[#8C7A68] text-center py-4">
                لا توجد حوارات منشورة في المجلس بعد.
              </p>
            ) : (
              <div className="space-y-2">
                {cmsModules.majlisAndGuardiansModule.topics.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-xl bg-[#FCF9F3] border border-[#EAE0CF] px-3.5 py-2.5 flex items-center justify-between gap-2.5"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-display font-extrabold text-[#2C1E14] truncate">
                        {t.title}
                      </div>
                      <div className="text-[11px] text-[#8C5327] truncate">
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
                            topics: p.majlisAndGuardiansModule.topics.filter(
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
          </div>
        )}
      </div>
    </div>
  );
};
