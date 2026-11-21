import React, { useState } from 'react';
import {
  BookOpen,
  Camera,
  Check,
  Clock,
  Crosshair,
  EyeOff,
  FileText,
  Heart,
  Link2,
  Loader2,
  MapPin,
  Paperclip,
  RotateCcw,
  Upload,
  User,
  X,
} from 'lucide-react';
import { HeritageNodeAvatar, TreeAvatarStyle } from './HeritageNodeAvatar';
import type {
  FamilyVaultMediaItem,
  VaultFolderRecord,
} from '../services/firestoreService';
import {
  TreeCardThemeDefinition,
  TreePrestigeBadgeId,
  getPrestigeBadgeOptionsForGender,
} from '../utils/treeStudioConfig';

export type MaleHonorificTitle =
  | 'بدون'
  | 'الشيخ'
  | 'الشريف'
  | 'الأمير'
  | 'الحاج'
  | 'الدكتور'
  | 'المهندس'
  | 'العميد'
  | 'النسّابة';

export type FemaleHonorificTitle =
  | 'بدون'
  | 'الشريفة'
  | 'الشيخة'
  | 'الأميرة'
  | 'الحاجة'
  | 'الدكتورة'
  | 'المهندسة'
  | 'الأستاذة'
  | 'السيدة'
  | 'الكريمة';

export type ArabicHonorificTitle = MaleHonorificTitle | FemaleHonorificTitle;

export const MALE_HONORIFIC_TITLES: MaleHonorificTitle[] = [
  'بدون',
  'الشيخ',
  'الشريف',
  'الأمير',
  'الحاج',
  'الدكتور',
  'المهندس',
  'العميد',
  'النسّابة',
];

export const FEMALE_HONORIFIC_TITLES: FemaleHonorificTitle[] = [
  'بدون',
  'الشريفة',
  'الشيخة',
  'الأميرة',
  'الحاجة',
  'الدكتورة',
  'المهندسة',
  'الأستاذة',
  'السيدة',
  'الكريمة',
];

export type BirthPrecisionMode =
  | 'year_only'
  | 'full_date'
  | 'approximate'
  | 'era';

export const NEW_MOTHER_SENTINEL = '__NEW_MOTHER__';

export interface StudioMotherOption {
  id: string;
  firstName: string;
  kunya?: string;
  maidenFamilyLine?: string;
  photoUrl?: string;
  photoThumbnailUrl?: string;
}

export interface SmartAddMotherContext {
  childName: string;
  fatherId?: string;
  fatherName?: string;
  existingFatherWives: StudioMotherOption[];
  choiceMode: 'select_existing' | 'create_new';
  onChangeChoiceMode: (mode: 'select_existing' | 'create_new') => void;
  selectedExistingMotherId: string;
  onChangeSelectedExistingMotherId: (id: string) => void;
}

export interface TreePersonStudioModalProps {
  mode: 'add' | 'edit';
  bindingHeadline: string;
  familyName: string;
  isVerticalOnlyModal: boolean;
  isHorizontalBridgeAboveFamily?: boolean;
  isSpouseRole: boolean;
  isDaughterRole: boolean;
  showMotherSelector: boolean;
  motherSelectorFatherName?: string;
  motherOptions: StudioMotherOption[];
  inlineNewMotherName: string;
  onChangeInlineNewMotherName: (val: string) => void;
  inlineNewMotherMaidenLine: string;
  onChangeInlineNewMotherMaidenLine: (val: string) => void;
  smartAddMotherContext?: SmartAddMotherContext | null;
  activeTreeTheme: TreeCardThemeDefinition;
  avatarStyle: TreeAvatarStyle;
  preferRealPhotos: boolean;
  calendarDisplayMode: 'hijri' | 'gregorian' | 'dual';
  showHonorific: boolean;
  showKunya: boolean;
  showDates: boolean;
  showPrestigeBadges: boolean;
  showDeceasedDignityFrame: boolean;
  isRecordKeeperTarget?: boolean;

  // Form values
  formGender: 'male' | 'female';
  formFirstName: string;
  onChangeFirstName: (val: string) => void;
  formKunya: string;
  onChangeKunya: (val: string) => void;
  formHonorific: ArabicHonorificTitle;
  onChangeHonorific: (val: ArabicHonorificTitle) => void;
  formPrestigeBadge: TreePrestigeBadgeId;
  onChangePrestigeBadge: (val: TreePrestigeBadgeId) => void;
  formMotherId: string;
  onChangeMotherId: (val: string) => void;
  formMaidenFamilyLine: string;
  onChangeMaidenFamilyLine: (val: string) => void;
  formMarriageAllianceNote: string;
  onChangeMarriageAllianceNote: (val: string) => void;
  formVitalStatus: 'unspecified' | 'living' | 'deceased';
  onChangeVitalStatus: (val: 'unspecified' | 'living' | 'deceased') => void;
  formBirthPrecision: BirthPrecisionMode;
  onChangeBirthPrecision: (val: BirthPrecisionMode) => void;
  formBirthCalendar: 'hijri' | 'gregorian';
  onChangeBirthCalendar: (val: 'hijri' | 'gregorian') => void;
  formBirthDate: string;
  onChangeBirthDate: (val: string) => void;
  formBirthPlace: string;
  onChangeBirthPlace: (val: string) => void;
  formDeathDate: string;
  onChangeDeathDate: (val: string) => void;
  formDeathPlace: string;
  onChangeDeathPlace: (val: string) => void;
  formFemalePrivacyMasked: boolean;
  onChangeFemalePrivacyMasked: (val: boolean) => void;
  formContactInfo: string;
  onChangeContactInfo: (val: string) => void;
  formBiography: string;
  onChangeBiography: (val: string) => void;
  formAttachedDocName: string;
  onChangeAttachedDocName: (val: string) => void;
  formPhotoUrl: string;
  onClearPhotoUrl: () => void;
  onUploadPortraitFile: (file: File) => Promise<void>;
  isUploadingPortrait: boolean;
  formError: string;

  // Vault integration
  linkedMediaForPerson: FamilyVaultMediaItem[];
  unlinkedMediaInVault: FamilyVaultMediaItem[];
  vaultFolders: VaultFolderRecord[];
  treeVaultUploadTitle: string;
  onChangeTreeVaultUploadTitle: (val: string) => void;
  treeVaultUploadFolderId: string;
  onChangeTreeVaultUploadFolderId: (val: string) => void;
  isUploadingToVault: boolean;
  onUploadFileToVault: (files: FileList | null) => void;
  onToggleVaultItemLink: (mediaId: string) => void;

  // Sub-tree focus (edit mode)
  canFocusSubtree: boolean;
  onFocusSubtree?: () => void;

  // Submit & Close
  modalScrollContainerRef: React.RefObject<HTMLDivElement | null>;
  nameInputRef: React.RefObject<HTMLInputElement | null>;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

type StudioTabId = 'identity' | 'life' | 'legacy';

const BIO_INSPIRATION_PROMPTS: Array<{ label: string; snippet: string }> = [
  {
    label: '+ النشأة والتعليم',
    snippet: 'النشأة والتعليم: نشأ في كنف أسرته وتلقى تعليمه في...',
  },
  {
    label: '+ المناصب والأعمال',
    snippet: 'المناصب والأعمال: تولّى عدداً من المهام والأعمال الجليلة أبرزها...',
  },
  {
    label: '+ المآثر والوصايا',
    snippet: 'المآثر والوصايا: عُرف بحسن الخلق وصلة الرحم، ومن أبرز مآثره...',
  },
];

const FEMALE_BIO_INSPIRATION_PROMPTS: Array<{ label: string; snippet: string }> = [
  {
    label: '+ النشأة والتعليم',
    snippet: 'النشأة والتعليم: نشأت في كنف أسرتها وتلقت تعليمها في...',
  },
  {
    label: '+ المناصب والأعمال',
    snippet: 'المناصب والأعمال: أسهمت بجهودٍ مباركة في مجال...',
  },
  {
    label: '+ المآثر والوصايا',
    snippet: 'المآثر والوصايا: عُرفت بالحكمة وصلة الرحم، ومن أبرز مآثرها...',
  },
];

export const TreePersonStudioModal: React.FC<TreePersonStudioModalProps> = ({
  mode,
  bindingHeadline,
  familyName,
  isVerticalOnlyModal,
  isHorizontalBridgeAboveFamily = false,
  isSpouseRole,
  isDaughterRole,
  showMotherSelector,
  motherSelectorFatherName,
  motherOptions,
  inlineNewMotherName,
  onChangeInlineNewMotherName,
  inlineNewMotherMaidenLine,
  onChangeInlineNewMotherMaidenLine,
  smartAddMotherContext = null,
  activeTreeTheme,
  avatarStyle,
  preferRealPhotos,
  calendarDisplayMode,
  showHonorific,
  showKunya,
  showDates,
  showPrestigeBadges,
  showDeceasedDignityFrame,
  isRecordKeeperTarget = false,
  formGender,
  formFirstName,
  onChangeFirstName,
  formKunya,
  onChangeKunya,
  formHonorific,
  onChangeHonorific,
  formPrestigeBadge,
  onChangePrestigeBadge,
  formMotherId,
  onChangeMotherId,
  formMaidenFamilyLine,
  onChangeMaidenFamilyLine,
  formMarriageAllianceNote,
  onChangeMarriageAllianceNote,
  formVitalStatus,
  onChangeVitalStatus,
  formBirthPrecision,
  onChangeBirthPrecision,
  formBirthCalendar,
  onChangeBirthCalendar,
  formBirthDate,
  onChangeBirthDate,
  formBirthPlace,
  onChangeBirthPlace,
  formDeathDate,
  onChangeDeathDate,
  formDeathPlace,
  onChangeDeathPlace,
  formFemalePrivacyMasked,
  onChangeFemalePrivacyMasked,
  formContactInfo,
  onChangeContactInfo,
  formBiography,
  onChangeBiography,
  formAttachedDocName,
  onChangeAttachedDocName,
  formPhotoUrl,
  onClearPhotoUrl,
  onUploadPortraitFile,
  isUploadingPortrait,
  formError,
  linkedMediaForPerson,
  unlinkedMediaInVault,
  vaultFolders,
  treeVaultUploadTitle,
  onChangeTreeVaultUploadTitle,
  treeVaultUploadFolderId,
  onChangeTreeVaultUploadFolderId,
  isUploadingToVault,
  onUploadFileToVault,
  onToggleVaultItemLink,
  canFocusSubtree,
  onFocusSubtree,
  modalScrollContainerRef,
  nameInputRef,
  onSubmit,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<StudioTabId>('identity');

  const isFemale = formGender === 'female';
  const honorificChoices: ArabicHonorificTitle[] = isFemale
    ? FEMALE_HONORIFIC_TITLES
    : MALE_HONORIFIC_TITLES;
  const prestigeChoices = getPrestigeBadgeOptionsForGender(formGender);
  const bioPrompts = isFemale
    ? FEMALE_BIO_INSPIRATION_PROMPTS
    : BIO_INSPIRATION_PROMPTS;

  const isSelectingExistingMother = Boolean(
    smartAddMotherContext &&
      smartAddMotherContext.existingFatherWives.length > 0 &&
      smartAddMotherContext.choiceMode === 'select_existing'
  );
  const chosenExistingWifeForMotherFlow = isSelectingExistingMother
    ? smartAddMotherContext?.existingFatherWives.find(
        (w) => w.id === smartAddMotherContext.selectedExistingMotherId
      ) || null
    : null;

  const isCreatingInlineMother = formMotherId === NEW_MOTHER_SENTINEL;
  const cleanPreviewFirst = formFirstName.trim();

  const handleAppendBioPrompt = (snippet: string) => {
    const trimmed = formBiography.trim();
    const next = trimmed ? `${trimmed}\n${snippet}` : snippet;
    onChangeBiography(next);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#1C1917]/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={bindingHeadline}
      data-testid="royal-person-studio-modal"
    >
      <div
        ref={modalScrollContainerRef}
        dir="rtl"
        className="bg-[#FBF9F5] border border-[#C5A059]/60 rounded-3xl max-w-2xl w-full shadow-[0_24px_70px_-15px_rgba(28,25,23,0.45)] my-4 max-h-[93vh] overflow-y-auto text-right flex flex-col"
      >
        {/* ================================================================= */}
        {/* 1. COMPACT SINGLE-LINE TOP BAR (DIRECTLY INTO 3 TABS)             */}
        {/* ================================================================= */}
        <div className="px-5 py-3 bg-[#F7F2E8]/80 border-b border-[#C5A059]/25 flex items-center justify-between gap-3 shrink-0">
          <h3 className="text-sm font-display font-extrabold text-[#1C1917] truncate">
            {bindingHeadline}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق النافذة"
            className="w-8 h-8 rounded-xl bg-white hover:bg-[#F5E6DC] border border-[#C5A059]/35 text-[#1C1917] flex items-center justify-center cursor-pointer shrink-0 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ================================================================= */}
        {/* 2. SMART ADD-MOTHER PANEL (When adding mother for a child with a father) */}
        {/* ================================================================= */}
        {smartAddMotherContext && smartAddMotherContext.fatherName && (
          <div
            data-testid="smart-add-mother-panel"
            className="mx-5 mt-4 rounded-2xl bg-[#FEF9EC] border border-[#C5A059]/60 p-4 space-y-3 shrink-0"
          >
            {smartAddMotherContext.existingFatherWives.length > 0 ? (
              <>
                <div className="space-y-0.5">
                  <div className="text-xs font-display font-extrabold text-[#78350F] flex items-center gap-1.5">
                    <Heart className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                    <span>
                      اختيار الأم من زوجات الأب ({smartAddMotherContext.fatherName}) المسجلات أو إضافة زوجة جديدة
                    </span>
                  </div>
                  <p className="text-[11px] text-[#1C1917]/65">
                    اختر إحدى زوجات {smartAddMotherContext.fatherName} لربط «{smartAddMotherContext.childName}» بها فوراً دون تكرار، أو أضف أماً جديدة.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {smartAddMotherContext.existingFatherWives.map((wife) => {
                    const active =
                      smartAddMotherContext.choiceMode === 'select_existing' &&
                      smartAddMotherContext.selectedExistingMotherId === wife.id;
                    return (
                      <button
                        key={wife.id}
                        type="button"
                        data-testid={`smart-mother-wife-option-${wife.id}`}
                        onClick={() => {
                          smartAddMotherContext.onChangeChoiceMode(
                            'select_existing'
                          );
                          smartAddMotherContext.onChangeSelectedExistingMotherId(
                            wife.id
                          );
                        }}
                        className={`px-3.5 py-2 rounded-xl text-xs font-display font-extrabold border transition-all cursor-pointer inline-flex items-center gap-2 ${
                          active
                            ? 'bg-[#1C1917] text-[#F7E7CE] border-[#1C1917] shadow-xs'
                            : 'bg-white text-[#1C1917] border-[#C5A059]/45 hover:border-[#8D4925]'
                        }`}
                      >
                        <span aria-hidden="true">💍</span>
                        <span>
                          {wife.firstName}
                          {wife.kunya ? ` (${wife.kunya})` : ''}
                        </span>
                        {active && (
                          <Check className="w-3.5 h-3.5 text-[#D4AF37]" />
                        )}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    data-testid="smart-mother-create-new-btn"
                    onClick={() =>
                      smartAddMotherContext.onChangeChoiceMode('create_new')
                    }
                    className={`px-3.5 py-2 rounded-xl text-xs font-display font-extrabold border transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                      smartAddMotherContext.choiceMode === 'create_new'
                        ? 'bg-[#8D4925] text-white border-[#8D4925] shadow-xs'
                        : 'bg-white text-[#8D4925] border-dashed border-[#C5A059] hover:bg-[#F7F2E8]'
                    }`}
                  >
                    <span>
                      + إضافة أم جديدة (تُسجّل تلقائياً كزوجة لـ{' '}
                      {smartAddMotherContext.fatherName})
                    </span>
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-start gap-2 text-xs text-[#78350F] leading-relaxed">
                <Heart className="w-4 h-4 text-[#C5A059] shrink-0 mt-0.5" />
                <span>
                  سيتم ربطها تلقائياً كزوجة للأب (
                  <strong>{smartAddMotherContext.fatherName}</strong>) وأمٍ لـ (
                  <strong>{smartAddMotherContext.childName}</strong>) في خطوة واحدة.
                </span>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* 2B. THREE SLEEK STUDIO TABS (Hidden when only linking existing wife) */}
        {/* ================================================================= */}
        {!isSelectingExistingMother && (
          <div className="px-5 pt-4 bg-[#FBF9F5] shrink-0">
            <div
              role="tablist"
              aria-label="أقسام استوديو بطاقة الفرد"
              className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-[#EFE9DD] border border-[#C5A059]/25"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'identity'}
                data-testid="studio-tab-identity"
                onClick={() => setActiveTab('identity')}
                className={`px-2.5 py-2.5 rounded-xl text-xs font-display font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'identity'
                    ? 'bg-[#1C1917] text-[#F7E7CE] shadow-xs'
                    : 'text-[#1C1917]/70 hover:text-[#1C1917] hover:bg-white/60'
                }`}
              >
                <User className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">✦ الهوية والمكانة</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'life'}
                data-testid="studio-tab-life"
                onClick={() => setActiveTab('life')}
                className={`px-2.5 py-2.5 rounded-xl text-xs font-display font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'life'
                    ? 'bg-[#1C1917] text-[#F7E7CE] shadow-xs'
                    : 'text-[#1C1917]/70 hover:text-[#1C1917] hover:bg-white/60'
                }`}
              >
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">⏳ السجل والديار</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'legacy'}
                data-testid="studio-tab-legacy"
                onClick={() => setActiveTab('legacy')}
                className={`px-2.5 py-2.5 rounded-xl text-xs font-display font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'legacy'
                    ? 'bg-[#1C1917] text-[#F7E7CE] shadow-xs'
                    : 'text-[#1C1917]/70 hover:text-[#1C1917] hover:bg-white/60'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  📜 المآثر والوثائق
                  {linkedMediaForPerson.length > 0
                    ? ` (${linkedMediaForPerson.length})`
                    : ''}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* 3. FORM BODY                                                      */}
        {/* ================================================================= */}
        <form
          onSubmit={onSubmit}
          noValidate
          className="px-5 py-5 space-y-5 flex-1"
        >
          {isSelectingExistingMother && smartAddMotherContext ? (
            <div className="rounded-2xl bg-white border border-[#C5A059]/40 p-4 space-y-2 text-xs text-[#1C1917]/80 leading-relaxed">
              {chosenExistingWifeForMotherFlow ? (
                <>
                  <div className="font-display font-extrabold text-[#1C1917] text-sm">
                    تأكيد ربط الأم: «{chosenExistingWifeForMotherFlow.firstName}»
                  </div>
                  <p>
                    سيتم تعيين <strong>{chosenExistingWifeForMotherFlow.firstName}</strong> كأمٍ لـ{' '}
                    <strong>{smartAddMotherContext.childName}</strong> مباشرةً دون إنشاء بطاقة مكررة، وسيتحول مسار نسبه بصرياً ليخرج من عقدة اقتران{' '}
                    <strong>{smartAddMotherContext.fatherName}</strong> و<strong>{chosenExistingWifeForMotherFlow.firstName}</strong> (💍).
                  </p>
                </>
              ) : (
                <p className="text-[#8D4925] font-semibold">
                  يرجى اختيار إحدى الزوجات المسجلات أعلاه، أو النقر على «+ إضافة أم جديدة».
                </p>
              )}
            </div>
          ) : (
          <>
          {isVerticalOnlyModal && (
            <div className="rounded-2xl bg-[#F7F2E8] border border-[#C5A059]/50 p-3.5 text-xs text-[#1C1917]/85 leading-relaxed">
              {isHorizontalBridgeAboveFamily ? (
                <>
                  <strong className="text-[#8D4925]">
                    إضافة فرع أفقي فوق العائلة وحتى الجذر:
                  </strong>{' '}
                  يُسجَّل هذا الفرع بشكل أفقي مجاور في نطاق الوصل الواقع بين العائلة ونقطة الجذر الموثقة.
                </>
              ) : (
                <>
                  <strong className="text-[#8D4925]">
                    حلقة ربط عمودية نحو الجذر (ما فوق الجد الخامس):
                  </strong>{' '}
                  تُسجَّل كعقدة عمودية منفردة لربط عمود أسرتك بنقطة الجذر الموثقة.
                </>
              )}
            </div>
          )}

          {/* --------------------------------------------------------------- */}
          {/* TAB 1: الهوية والمكانة                                          */}
          {/* --------------------------------------------------------------- */}
          {activeTab === 'identity' && (
            <div className="space-y-5">
              {/* Interactive Portrait Ring + Primary Name & Kunya */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 pb-4 border-b border-[#C5A059]/20">
                {/* Interactive Portrait Ring */}
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <div className="relative p-1 rounded-full bg-gradient-to-br from-[#D4AF37] via-[#F3D299] to-[#8D4925] shadow-sm">
                    <div className="rounded-full bg-[#FBF9F5] p-0.5">
                      <HeritageNodeAvatar
                        personRole={
                          isRecordKeeperTarget
                            ? 'client'
                            : isDaughterRole
                            ? 'daughter'
                            : 'child'
                        }
                        gender={formGender}
                        avatarStyle={avatarStyle}
                        customImageUrl={formPhotoUrl || undefined}
                        preferRealPhoto={
                          preferRealPhotos || Boolean(formPhotoUrl)
                        }
                        displayName={cleanPreviewFirst || (isFemale ? 'ك' : 'ف')}
                        frameAccentHex={activeTreeTheme.primaryHex}
                        size="lg"
                      />
                    </div>
                    <label
                      title="رفع صورة شخصية مباشرة"
                      className="absolute -bottom-1 -left-1 w-8 h-8 rounded-full bg-[#1C1917] hover:bg-[#8D4925] text-[#F7E7CE] border-2 border-[#FBF9F5] flex items-center justify-center cursor-pointer shadow-sm transition-colors"
                    >
                      {isUploadingPortrait ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Camera className="w-3.5 h-3.5" />
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={isUploadingPortrait}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            void onUploadPortraitFile(file);
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <label className="text-[11px] font-display font-bold text-[#8D4925] hover:text-[#1C1917] cursor-pointer underline underline-offset-4">
                      {isUploadingPortrait ? 'جاري الرفع...' : 'رفع صورة'}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={isUploadingPortrait}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            void onUploadPortraitFile(file);
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>
                    {formPhotoUrl && (
                      <>
                        <span className="text-[#1C1917]/30">·</span>
                        <button
                          type="button"
                          onClick={onClearPhotoUrl}
                          className="text-[11px] font-display font-semibold text-[#1C1917]/60 hover:text-[#1C1917] inline-flex items-center gap-0.5 cursor-pointer"
                        >
                          <RotateCcw className="w-2.5 h-2.5" />
                          <span>صورة رمزية</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Primary Name + Kunya Inputs */}
                <div className="w-full flex-1 space-y-3">
                  <div>
                    <label className="block text-xs font-display font-extrabold text-[#1C1917] mb-1.5">
                      الاسم الكريم <span className="text-[#9A3412]">*</span>
                    </label>
                    <input
                      ref={nameInputRef}
                      type="text"
                      autoFocus
                      data-testid="studio-person-name-input"
                      value={formFirstName}
                      onChange={(e) => onChangeFirstName(e.target.value)}
                      placeholder={
                        isFemale
                          ? 'مثال: نورة / فاطمة / تغريد'
                          : 'مثال: محمد / عبدالله / شريف'
                      }
                      className="w-full rounded-xl bg-white border border-[#C5A059]/45 px-3.5 py-2.5 text-sm font-bold text-[#1C1917] placeholder:text-[#1C1917]/35 focus:outline-none focus:border-[#8D4925] focus:ring-2 focus:ring-[#C5A059]/25 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-display font-bold text-[#1C1917]/80 mb-1.5">
                      الكنية{' '}
                      <span className="text-[11px] font-normal text-[#1C1917]/45">
                        {isDaughterRole
                          ? '(اختياري — يُترك فارغاً عند عدم الحاجة)'
                          : '(اختياري)'}
                      </span>
                    </label>
                    <input
                      type="text"
                      data-testid="studio-person-kunya-input"
                      value={formKunya}
                      onChange={(e) => onChangeKunya(e.target.value)}
                      placeholder={
                        isFemale ? 'مثال: أم عبدالله' : 'مثال: أبو محمد'
                      }
                      className="w-full rounded-xl bg-white border border-[#C5A059]/40 px-3.5 py-2 text-sm text-[#1C1917] placeholder:text-[#1C1917]/35 focus:outline-none focus:border-[#8D4925] transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Contextual Alliance Field: Wife Maiden Family Line OR Daughter Marriage Note */}
              {isSpouseRole && (
                <div
                  data-testid="studio-wife-maiden-family-field"
                  className="space-y-1.5"
                >
                  <label className="block text-xs font-display font-extrabold text-[#8D4925]">
                    أسرتها الكريمة / نسب المصاهرة{' '}
                    <span className="text-[11px] font-normal text-[#1C1917]/50">
                      (اختياري)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={formMaidenFamilyLine}
                    onChange={(e) => onChangeMaidenFamilyLine(e.target.value)}
                    placeholder="مثال: كريمة الشيخ... / من أسرة آل..."
                    className="w-full rounded-xl bg-white border border-[#C5A059]/45 px-3.5 py-2.5 text-sm text-[#1C1917] placeholder:text-[#1C1917]/35 focus:outline-none focus:border-[#8D4925]"
                  />
                  <p className="text-[11px] text-[#1C1917]/55">
                    يُعرض بأناقة ووقار كسطر فرعي رفيع في بطاقتها وملفها التوثيقي.
                  </p>
                </div>
              )}

              {isDaughterRole && !isSpouseRole && (
                <div
                  data-testid="studio-daughter-alliance-field"
                  className="space-y-1.5"
                >
                  <label className="block text-xs font-display font-extrabold text-[#8D4925]">
                    بيان المصاهرة / قرينة{' '}
                    <span className="text-[11px] font-normal text-[#1C1917]/50">
                      (اختياري)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={formMarriageAllianceNote}
                    onChange={(e) =>
                      onChangeMarriageAllianceNote(e.target.value)
                    }
                    placeholder="مثال: قرينة الأستاذ... من أسرة آل..."
                    className="w-full rounded-xl bg-white border border-[#C5A059]/45 px-3.5 py-2.5 text-sm text-[#1C1917] placeholder:text-[#1C1917]/35 focus:outline-none focus:border-[#8D4925]"
                  />
                  <p className="text-[11px] text-[#1C1917]/55">
                    نص توثيقي أنيق لحفظ صلة المصاهرة دون إرباك عمود النسب.
                  </p>
                </div>
              )}

              {/* Compact Smart Mother Selector (Single Quiet Control Row + Optional Inline New Mother) */}
              {showMotherSelector && !isSpouseRole && (
                <div
                  data-testid="studio-mother-selector"
                  className="rounded-xl bg-[#FAF7F2] border border-[#C5A059]/35 px-3 py-2.5 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="studio-mother-select"
                      className="text-[11.5px] font-display font-extrabold text-[#1C1917] flex items-center gap-1.5"
                    >
                      <Heart className="w-3 h-3 text-[#C5A059] shrink-0" />
                      <span>
                        تحديد الأم
                        {motherSelectorFatherName
                          ? ` (من زوجات ${motherSelectorFatherName})`
                          : ''}
                      </span>
                    </label>
                    {motherSelectorFatherName && (
                      <button
                        type="button"
                        data-testid="studio-mother-option-create-new"
                        onClick={() =>
                          onChangeMotherId(
                            isCreatingInlineMother ? '' : NEW_MOTHER_SENTINEL
                          )
                        }
                        className={`px-2 py-0.5 rounded-lg text-[10.5px] font-display font-bold border transition-colors cursor-pointer ${
                          isCreatingInlineMother
                            ? 'bg-[#1C1917] text-[#F7E7CE] border-[#1C1917]'
                            : 'bg-white text-[#8D4925] border-[#C5A059]/50 hover:bg-[#FEF9EC]'
                        }`}
                      >
                        {isCreatingInlineMother ? 'إلغاء الإضافة' : '+ أم جديدة'}
                      </button>
                    )}
                  </div>

                  {!isCreatingInlineMother ? (
                    <select
                      id="studio-mother-select"
                      data-testid="studio-mother-select"
                      value={formMotherId}
                      onChange={(e) => onChangeMotherId(e.target.value)}
                      className="w-full rounded-lg bg-white border border-[#C5A059]/40 px-3 py-1.5 text-xs font-bold text-[#1C1917] focus:outline-none focus:border-[#8D4925] cursor-pointer"
                    >
                      <option value="">غير محدد (يرتبط بالأب مباشرة)</option>
                      {motherOptions.map((mom) => (
                        <option key={mom.id} value={mom.id}>
                          💍 {mom.firstName}
                          {mom.kunya ? ` (${mom.kunya})` : ''}
                        </option>
                      ))}
                      {motherSelectorFatherName && (
                        <option value={NEW_MOTHER_SENTINEL}>
                          + أم جديدة (تُضاف كزوجة لـ {motherSelectorFatherName})
                        </option>
                      )}
                    </select>
                  ) : (
                    <div
                      data-testid="studio-inline-new-mother-box"
                      className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5"
                    >
                      <div>
                        <label className="block text-[10.5px] font-display font-bold text-[#78350F] mb-1">
                          اسم الأم الكريمة <span className="text-[#9A3412]">*</span>
                        </label>
                        <input
                          type="text"
                          data-testid="studio-inline-new-mother-name"
                          value={inlineNewMotherName}
                          onChange={(e) =>
                            onChangeInlineNewMotherName(e.target.value)
                          }
                          placeholder="مثال: أمينة / فاطمة"
                          className="w-full rounded-lg bg-white border border-[#C5A059]/50 px-2.5 py-1.5 text-xs font-bold text-[#1C1917] focus:outline-none focus:border-[#8D4925]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10.5px] font-display font-bold text-[#1C1917]/75 mb-1">
                          أسرتها الكريمة / المصاهرة (اختياري)
                        </label>
                        <input
                          type="text"
                          value={inlineNewMotherMaidenLine}
                          onChange={(e) =>
                            onChangeInlineNewMotherMaidenLine(e.target.value)
                          }
                          placeholder="مثال: من أسرة آل..."
                          className="w-full rounded-lg bg-white border border-[#C5A059]/40 px-2.5 py-1.5 text-xs text-[#1C1917] focus:outline-none focus:border-[#8D4925]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Compact 2-Column Row: Honorific Title + Prestige Badge (Calm, Zero Chip Clutter) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="studio-honorific-select"
                    className="block text-[11.5px] font-display font-bold text-[#1C1917]/85 mb-1"
                  >
                    اللقب {isFemale ? 'الكريم' : 'التشريفي'}{' '}
                    <span className="text-[10.5px] font-normal text-[#1C1917]/45">
                      (اختياري)
                    </span>
                  </label>
                  <select
                    id="studio-honorific-select"
                    data-testid="studio-honorific-chips"
                    value={formHonorific}
                    onChange={(e) =>
                      onChangeHonorific(e.target.value as ArabicHonorificTitle)
                    }
                    className="w-full rounded-xl bg-white border border-[#C5A059]/40 px-3 py-2 text-xs font-bold text-[#1C1917] focus:outline-none focus:border-[#8D4925] cursor-pointer"
                  >
                    {honorificChoices.map((title) => (
                      <option key={title} value={title}>
                        {title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="studio-prestige-select"
                    className="block text-[11.5px] font-display font-bold text-[#1C1917]/85 mb-1"
                  >
                    وسام البطاقة التقديري{' '}
                    <span className="text-[10.5px] font-normal text-[#1C1917]/45">
                      (اختياري)
                    </span>
                  </label>
                  <select
                    id="studio-prestige-select"
                    data-testid="studio-prestige-badge-chips"
                    value={formPrestigeBadge}
                    onChange={(e) =>
                      onChangePrestigeBadge(
                        e.target.value as TreePrestigeBadgeId
                      )
                    }
                    className="w-full rounded-xl bg-white border border-[#C5A059]/40 px-3 py-2 text-xs font-bold text-[#1C1917] focus:outline-none focus:border-[#8D4925] cursor-pointer"
                  >
                    {prestigeChoices.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Female Privacy Switch (for female nodes) + Subtree Focus (edit mode) */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#C5A059]/20">
                {isFemale && !isVerticalOnlyModal && (
                  <button
                    type="button"
                    onClick={() =>
                      onChangeFemalePrivacyMasked(!formFemalePrivacyMasked)
                    }
                    className={`px-3.5 py-2 rounded-xl text-xs font-display font-bold border transition-all cursor-pointer inline-flex items-center gap-2 ${
                      formFemalePrivacyMasked
                        ? 'bg-[#F7F2E8] text-[#8D4925] border-[#C5A059]/60'
                        : 'bg-white text-[#1C1917]/65 border-[#C5A059]/30'
                    }`}
                  >
                    <EyeOff className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {formFemalePrivacyMasked
                        ? 'حماية الخصوصية في العرض العام مفعّلة'
                        : 'تفعيل ستر الاسم في العرض العام'}
                    </span>
                  </button>
                )}

                {canFocusSubtree && onFocusSubtree && (
                  <button
                    type="button"
                    data-testid="focus-subtree-person-btn"
                    onClick={onFocusSubtree}
                    className="px-3.5 py-2 rounded-xl bg-[#FEF9EC] hover:bg-[#F5E6DC] border border-[#C5A059]/55 text-xs font-display font-extrabold text-[#8D4925] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Crosshair className="w-3.5 h-3.5 text-[#9A3412] shrink-0" />
                    <span>تركيز العرض على هذا الفرع فقط</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* --------------------------------------------------------------- */}
          {/* TAB 2: السجل الحياتي والديار                                    */}
          {/* --------------------------------------------------------------- */}
          {activeTab === 'life' && (
            <div className="space-y-5">
              {/* Vital Status Gender-Aware Segmented Toggle */}
              <div className="space-y-2">
                <label className="block text-xs font-display font-extrabold text-[#1C1917]">
                  الحالة الحياتية وصيغة الدعاء
                </label>
                <div
                  data-testid="studio-vital-status-toggle"
                  className="grid grid-cols-1 sm:grid-cols-3 gap-2"
                >
                  {(
                    [
                      { id: 'unspecified', label: 'غير محدد' },
                      {
                        id: 'living',
                        label: isFemale
                          ? 'على قيد الحياة — حفظها الله'
                          : 'على قيد الحياة — حفظه الله',
                      },
                      {
                        id: 'deceased',
                        label: isFemale
                          ? 'متوفاة — رحمها الله'
                          : 'متوفى — رحمه الله',
                      },
                    ] as const
                  ).map((opt) => {
                    const active = formVitalStatus === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onChangeVitalStatus(opt.id)}
                        className={`px-3 py-2.5 rounded-xl text-xs font-display font-extrabold border transition-all cursor-pointer ${
                          active
                            ? opt.id === 'deceased'
                              ? 'bg-[#1C1917] text-[#F7E7CE] border-[#1C1917]'
                              : opt.id === 'living'
                              ? 'bg-[#14532D] text-white border-[#14532D]'
                              : 'bg-[#8D4925] text-white border-[#8D4925]'
                            : 'bg-white text-[#1C1917]/75 border-[#C5A059]/35 hover:border-[#8D4925]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Calendar & Precision Luxury Toggles (ZERO native <select>) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-xs font-display font-bold text-[#1C1917]/80">
                    التقويم المعتمد
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#EFE9DD] border border-[#C5A059]/25">
                    <button
                      type="button"
                      onClick={() => onChangeBirthCalendar('hijri')}
                      className={`py-2 rounded-lg text-xs font-display font-extrabold transition-all cursor-pointer ${
                        formBirthCalendar === 'hijri'
                          ? 'bg-white text-[#1C1917] shadow-2xs'
                          : 'text-[#1C1917]/65 hover:text-[#1C1917]'
                      }`}
                    >
                      هجري (هـ)
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeBirthCalendar('gregorian')}
                      className={`py-2 rounded-lg text-xs font-display font-extrabold transition-all cursor-pointer ${
                        formBirthCalendar === 'gregorian'
                          ? 'bg-white text-[#1C1917] shadow-2xs'
                          : 'text-[#1C1917]/65 hover:text-[#1C1917]'
                      }`}
                    >
                      ميلادي (م)
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-display font-bold text-[#1C1917]/80">
                    دقة التاريخ
                  </label>
                  <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#EFE9DD] border border-[#C5A059]/25">
                    {(
                      [
                        { id: 'year_only', label: 'سنة مؤكدة' },
                        { id: 'approximate', label: 'تقريبي' },
                        { id: 'era', label: 'حقبة' },
                      ] as const
                    ).map((prec) => {
                      const active =
                        formBirthPrecision === prec.id ||
                        (prec.id === 'year_only' &&
                          formBirthPrecision === 'full_date');
                      return (
                        <button
                          key={prec.id}
                          type="button"
                          onClick={() => onChangeBirthPrecision(prec.id)}
                          className={`py-2 rounded-lg text-[11px] font-display font-extrabold transition-all cursor-pointer ${
                            active
                              ? 'bg-white text-[#1C1917] shadow-2xs'
                              : 'text-[#1C1917]/65 hover:text-[#1C1917]'
                          }`}
                        >
                          {prec.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Birth Date & Birth Place */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-display font-bold text-[#1C1917]/80 mb-1.5">
                    {formBirthPrecision === 'era'
                      ? 'الحقبة الزمنية للميلاد'
                      : 'سنة أو تاريخ الميلاد'}
                  </label>
                  <input
                    type="text"
                    value={formBirthDate}
                    onChange={(e) => onChangeBirthDate(e.target.value)}
                    placeholder={
                      formBirthPrecision === 'era'
                        ? 'مثال: مطلع القرن الرابع عشر'
                        : formBirthCalendar === 'hijri'
                        ? 'مثال: 1395'
                        : 'مثال: 1975'
                    }
                    className="w-full rounded-xl bg-white border border-[#C5A059]/40 px-3.5 py-2.5 text-sm text-[#1C1917] tabular-nums focus:outline-none focus:border-[#8D4925]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-display font-bold text-[#1C1917]/80 mb-1.5 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#C5A059]" />
                    <span>مكان الميلاد / الديرة</span>
                  </label>
                  <input
                    type="text"
                    value={formBirthPlace}
                    onChange={(e) => onChangeBirthPlace(e.target.value)}
                    placeholder="مثال: بغداد / الرياض / دمشق / الحجاز"
                    className="w-full rounded-xl bg-white border border-[#C5A059]/40 px-3.5 py-2.5 text-sm text-[#1C1917] focus:outline-none focus:border-[#8D4925]"
                  />
                </div>
              </div>

              {/* Conditional Death Fields — Appear smoothly ONLY when Deceased */}
              {formVitalStatus === 'deceased' && (
                <div
                  data-testid="studio-deceased-fields"
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#C5A059]/25"
                >
                  <div>
                    <label className="block text-xs font-display font-bold text-[#1C1917]/80 mb-1.5">
                      سنة / تاريخ الوفاة
                    </label>
                    <input
                      type="text"
                      value={formDeathDate}
                      onChange={(e) => onChangeDeathDate(e.target.value)}
                      placeholder={
                        formBirthCalendar === 'hijri'
                          ? 'مثال: 1435 هـ'
                          : 'مثال: 2014 م'
                      }
                      className="w-full rounded-xl bg-white border border-[#C5A059]/40 px-3.5 py-2.5 text-sm text-[#1C1917] tabular-nums focus:outline-none focus:border-[#8D4925]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-display font-bold text-[#1C1917]/80 mb-1.5">
                      مكان الوفاة أو المدفن
                    </label>
                    <input
                      type="text"
                      value={formDeathPlace}
                      onChange={(e) => onChangeDeathPlace(e.target.value)}
                      placeholder="مثال: مقبرة العود / البقيع / النجف"
                      className="w-full rounded-xl bg-white border border-[#C5A059]/40 px-3.5 py-2.5 text-sm text-[#1C1917] focus:outline-none focus:border-[#8D4925]"
                    />
                  </div>
                </div>
              )}

              {/* Conditional Contact Field — Appears cleanly ONLY when Living */}
              {formVitalStatus === 'living' && (
                <div className="pt-4 border-t border-[#C5A059]/25">
                  <label className="block text-xs font-display font-bold text-[#1C1917]/80 mb-1.5">
                    البريد الإلكتروني / رقم الجوال للتواصل العائلي{' '}
                    <span className="text-[11px] font-normal text-[#1C1917]/45">
                      (اختياري)
                    </span>
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={formContactInfo}
                    onChange={(e) => onChangeContactInfo(e.target.value)}
                    placeholder="relative@family.com / +966500000000"
                    className="w-full rounded-xl bg-white border border-[#C5A059]/40 px-3.5 py-2.5 text-sm text-[#1C1917] text-right focus:outline-none focus:border-[#8D4925]"
                  />
                </div>
              )}
            </div>
          )}

          {/* --------------------------------------------------------------- */}
          {/* TAB 3: المآثر وخزانة الوثائق                                    */}
          {/* --------------------------------------------------------------- */}
          {activeTab === 'legacy' && (
            <div className="space-y-5">
              {/* Biography + Quick Inspiration Prompts */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-display font-extrabold text-[#1C1917]">
                    السيرة الذاتية والمآثر التوثيقية
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {bioPrompts.map((prompt) => (
                      <button
                        key={prompt.label}
                        type="button"
                        onClick={() => handleAppendBioPrompt(prompt.snippet)}
                        className="px-2.5 py-1 rounded-lg bg-[#F7F2E8] hover:bg-[#1C1917] text-[#8D4925] hover:text-[#F7E7CE] border border-[#C5A059]/40 text-[11px] font-display font-bold transition-colors cursor-pointer"
                      >
                        {prompt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  rows={4}
                  value={formBiography}
                  onChange={(e) => onChangeBiography(e.target.value)}
                  placeholder={
                    isFemale
                      ? 'دوّن نبذةً وافيةً عن سيرتها الكريمة ومآثرها...'
                      : 'دوّن نبذةً وافيةً عن سيرته ومآثره وأعماله...'
                  }
                  className="w-full rounded-2xl bg-white border border-[#C5A059]/40 p-3.5 text-sm text-[#1C1917] leading-relaxed focus:outline-none focus:border-[#8D4925]"
                />
              </div>

              {/* Historical Document Reference Note */}
              <div>
                <label className="block text-xs font-display font-bold text-[#1C1917]/80 mb-1.5">
                  إشارة إلى صك أو وثيقة تاريخية{' '}
                  <span className="text-[11px] font-normal text-[#1C1917]/45">
                    (اختياري)
                  </span>
                </label>
                <input
                  type="text"
                  value={formAttachedDocName}
                  onChange={(e) => onChangeAttachedDocName(e.target.value)}
                  placeholder="مثال: وثيقة حصر إرث مؤرخة عام 1372 هـ"
                  className="w-full rounded-xl bg-white border border-[#C5A059]/40 px-3.5 py-2.5 text-sm text-[#1C1917] focus:outline-none focus:border-[#8D4925]"
                />
              </div>

              {/* Visual Media Vault Gallery (`خزانتي`) */}
              <div
                data-testid="person-modal-vault-media-section"
                className="pt-4 border-t border-[#C5A059]/25 space-y-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-display font-extrabold text-[#1C1917]">
                    <Paperclip className="w-4 h-4 text-[#8D4925]" />
                    <span>
                      وثائق وصور هذا الفرد في «خزانتي» ({linkedMediaForPerson.length})
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-[#8D4925]">
                    مزامنة ثنائية فورية
                  </span>
                </div>

                {linkedMediaForPerson.length === 0 ? (
                  <div className="rounded-2xl bg-[#F7F2E8]/80 border border-dashed border-[#C5A059]/50 p-4 text-xs text-[#1C1917]/65 text-center">
                    لا توجد صور أو وثائق مربوطة بهذا الفرد بعد. ارفع ملفاً جديداً أدناه أو اربطه من خزانتك مباشرة.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {linkedMediaForPerson.map((media) => {
                      const previewSrc =
                        media.thumbnailDataUrl || media.fileDataUrl;
                      const isImage =
                        media.mediaType === 'photo' ||
                        previewSrc.startsWith('data:image') ||
                        previewSrc.startsWith('http');
                      return (
                        <div
                          key={media.id}
                          className="rounded-2xl bg-white border border-[#C5A059]/45 overflow-hidden flex flex-col shadow-2xs"
                        >
                          <div className="h-24 bg-[#F7F2E8] relative flex items-center justify-center overflow-hidden">
                            {isImage ? (
                              <img
                                src={previewSrc}
                                alt={media.title}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <FileText className="w-7 h-7 text-[#8D4925]/70" />
                            )}
                            <button
                              type="button"
                              onClick={() => onToggleVaultItemLink(media.id)}
                              title="فك الربط"
                              className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-lg bg-[#1C1917]/80 hover:bg-red-700 text-white text-[10px] font-bold cursor-pointer transition-colors"
                            >
                              فك
                            </button>
                          </div>
                          <div className="p-2">
                            <div className="text-[11px] font-display font-extrabold text-[#1C1917] truncate">
                              {media.title}
                            </div>
                            <div className="text-[10px] text-[#8D4925] truncate">
                              {media.mediaType === 'photo' ? 'صورة' : 'وثيقة'} ·{' '}
                              {media.dateOrOccasion}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Direct 1-Click Upload into Vault (Folder Chips + Title + Upload) */}
                <div className="rounded-2xl bg-[#F7F2E8] border border-[#C5A059]/35 p-3.5 space-y-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-display font-bold text-[#1C1917]/70 ml-1">
                      المجلد:
                    </span>
                    {vaultFolders.map((vf) => {
                      const active = treeVaultUploadFolderId === vf.id;
                      return (
                        <button
                          key={vf.id}
                          type="button"
                          onClick={() => onChangeTreeVaultUploadFolderId(vf.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-display font-bold border transition-all cursor-pointer ${
                            active
                              ? 'bg-[#1C1917] text-[#F7E7CE] border-[#1C1917]'
                              : 'bg-white text-[#1C1917]/75 border-[#C5A059]/35 hover:border-[#8D4925]'
                          }`}
                        >
                          {vf.icon} {vf.name}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={treeVaultUploadTitle}
                      onChange={(e) =>
                        onChangeTreeVaultUploadTitle(e.target.value)
                      }
                      placeholder="عنوان الصورة أو الوثيقة (اختياري)..."
                      className="flex-1 rounded-xl bg-white border border-[#C5A059]/40 px-3 py-2 text-xs text-[#1C1917]"
                    />
                    <label className="px-4 py-2 rounded-xl bg-[#1C1917] hover:bg-[#8D4925] text-[#F7E7CE] text-xs font-display font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors shrink-0">
                      <Upload className="w-3.5 h-3.5" />
                      <span>
                        {isUploadingToVault
                          ? 'جاري الحفظ...'
                          : 'رفع صورة أو وثيقة'}
                      </span>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        disabled={isUploadingToVault}
                        className="hidden"
                        onChange={(e) => {
                          onUploadFileToVault(e.target.files);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                </div>

                {/* Unlinked Vault Items — Visual Mini-Thumbnails for 1-Click Linking */}
                {unlinkedMediaInVault.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[11px] font-display font-bold text-[#1C1917]/80 flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-[#8D4925]" />
                      <span>ربط مقتنيات موجودة في «خزانتي» بنقرة واحدة:</span>
                    </div>
                    <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto py-0.5">
                      {unlinkedMediaInVault.map((uv) => {
                        const thumb = uv.thumbnailDataUrl || uv.fileDataUrl;
                        const isImg =
                          uv.mediaType === 'photo' ||
                          thumb.startsWith('data:image') ||
                          thumb.startsWith('http');
                        return (
                          <button
                            key={uv.id}
                            type="button"
                            onClick={() => onToggleVaultItemLink(uv.id)}
                            className="pl-2.5 pr-1.5 py-1 rounded-xl bg-white hover:bg-[#1C1917] text-[#1C1917] hover:text-[#F7E7CE] border border-[#C5A059]/40 text-[11px] font-bold inline-flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <span className="w-6 h-6 rounded-lg bg-[#F7F2E8] overflow-hidden shrink-0 flex items-center justify-center">
                              {isImg ? (
                                <img
                                  src={thumb}
                                  alt={uv.title}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <FileText className="w-3.5 h-3.5 text-[#8D4925]" />
                              )}
                            </span>
                            <span className="max-w-[140px] truncate">
                              + {uv.title}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          </>
          )}

          {formError && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-bold text-red-700">
              {formError}
            </div>
          )}

          {/* Footer Action Bar */}
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-[#C5A059]/30">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-[#EFE9DD] hover:bg-[#E4DCCB] text-xs font-display font-bold text-[#1C1917] cursor-pointer transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isUploadingToVault || isUploadingPortrait}
              data-testid="studio-save-person-btn"
              className="px-7 py-2.5 rounded-xl bg-[#1C1917] hover:bg-[#8D4925] disabled:opacity-60 text-[#F7E7CE] text-xs sm:text-sm font-display font-extrabold cursor-pointer shadow-sm transition-colors"
            >
              {isUploadingToVault || isUploadingPortrait
                ? 'جاري حفظ الملف المرفوع...'
                : isSelectingExistingMother
                ? 'اعتماد وربط الأم ✓'
                : mode === 'edit'
                ? 'حفظ تعديلات البطاقة ✓'
                : 'اعتماد وإضافة للشجرة ✓'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
