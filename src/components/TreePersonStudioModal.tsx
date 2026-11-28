import React, { useEffect, useState } from 'react';
import {
  Award,
  BookOpen,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Crosshair,
  EyeOff,
  FileText,
  Heart,
  Link2,
  Loader2,
  MapPin,
  Paperclip,
  Plus,
  RotateCcw,
  ScrollText,
  Sparkles,
  Upload,
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
  formatCardSingleCalendarVitalDates,
  getPrestigeBadgeOptionsForGender,
  resolvePrestigeBadgeMeta,
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
  isAnySpouseRole?: boolean;
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
  showEpithet: boolean;
  showKunya: boolean;
  showDates: boolean;
  showPrestigeBadges: boolean;
  showDeceasedDignityFrame: boolean;
  isRecordKeeperTarget?: boolean;

  // Form values
  formGender: 'male' | 'female';
  formFirstName: string;
  onChangeFirstName: (val: string) => void;
  formEpithet: string;
  onChangeEpithet: (val: string) => void;
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

  // Rapid multi-entry support
  canSaveAndAddAnother?: boolean;
  onSaveAndAddAnother?: () => void;
  quickAddSuccessNotice?: string;

  // Submit & Close
  modalScrollContainerRef: React.RefObject<HTMLDivElement | null>;
  nameInputRef: React.RefObject<HTMLInputElement | null>;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

type StudioDetailPanelId = 'identity' | 'life' | 'legacy';

const BIO_INSPIRATION_PROMPTS: Array<{ label: string; snippet: string }> = [
  {
    label: '+ النشأة والتعليم',
    snippet: 'النشأة والتعليم: نشأ في كنف عائلته وتلقى تعليمه في...',
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
    snippet: 'النشأة والتعليم: نشأت في كنف عائلتها وتلقت تعليمها في...',
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
  isVerticalOnlyModal,
  isHorizontalBridgeAboveFamily = false,
  isSpouseRole,
  isAnySpouseRole = false,
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
  showEpithet,
  showKunya,
  showDates,
  showPrestigeBadges,
  showDeceasedDignityFrame,
  isRecordKeeperTarget = false,
  formGender,
  formFirstName,
  onChangeFirstName,
  formEpithet,
  onChangeEpithet,
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
  canSaveAndAddAnother = false,
  onSaveAndAddAnother,
  quickAddSuccessNotice = '',
  modalScrollContainerRef,
  nameInputRef,
  onSubmit,
  onClose,
}) => {
  // Collapsed by default in quick-entry add mode; toggles smoothly when user wants extra details
  const [activeDetailPanel, setActiveDetailPanel] =
    useState<StudioDetailPanelId | null>(null);

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

  // Dynamic contextual label for the first expandable detail pill
  const identityPanelLabel =
    showMotherSelector && !isSpouseRole
      ? 'المكانة والأم'
      : isSpouseRole || isAnySpouseRole || isDaughterRole
      ? 'المكانة والمصاهرة'
      : 'المكانة والألقاب';

  // Only keep the top selector when the father already has recorded wives to pick from;
  // otherwise move the quiet auto-link confirmation line down right above Save / Cancel.
  const hasExistingFatherWivesSelector = Boolean(
    smartAddMotherContext &&
      smartAddMotherContext.fatherName &&
      smartAddMotherContext.existingFatherWives.length > 0
  );
  const showAutoLinkMotherFooterNote = Boolean(
    smartAddMotherContext &&
      smartAddMotherContext.fatherName &&
      smartAddMotherContext.existingFatherWives.length === 0
  );

  // If validation asks for inline new mother name, gently reveal the identity panel
  useEffect(() => {
    if (formError && isCreatingInlineMother && !inlineNewMotherName.trim()) {
      setActiveDetailPanel('identity');
    }
  }, [formError, isCreatingInlineMother, inlineNewMotherName]);

  // Subtle filled-content indicators on quiet detail pills
  const hasIdentityDetails = Boolean(
    formEpithet.trim() ||
      formKunya.trim() ||
      (formHonorific && formHonorific !== 'بدون') ||
      (formPrestigeBadge && formPrestigeBadge !== 'none') ||
      formMotherId ||
      formMaidenFamilyLine.trim() ||
      formMarriageAllianceNote.trim()
  );
  const hasLifeDetails = Boolean(
    formVitalStatus !== 'unspecified' ||
      formBirthDate.trim() ||
      formBirthPlace.trim() ||
      formDeathDate.trim() ||
      formDeathPlace.trim() ||
      formContactInfo.trim()
  );
  const hasLegacyDetails = Boolean(
    formBiography.trim() ||
      formAttachedDocName.trim() ||
      linkedMediaForPerson.length > 0
  );

  // Live 3-Zone Luxury Plaque preview data (matches InteractiveFamilyTreeBuilder 1:1)
  const previewPrestigeMeta = showPrestigeBadges
    ? resolvePrestigeBadgeMeta(formPrestigeBadge, formGender)
    : null;
  const previewCrownLabel = [
    isRecordKeeperTarget ? 'أمين السجل' : '',
    previewPrestigeMeta?.label || '',
  ]
    .filter(Boolean)
    .join(' · ');
  const previewHonorific =
    showHonorific && formHonorific && formHonorific !== 'بدون'
      ? formHonorific
      : '';
  const previewSecondaryItems: Array<{
    text: string;
    kind: 'epithet' | 'kunya' | 'alliance' | 'mercy';
  }> = [];
  if (showEpithet && formEpithet.trim()) {
    previewSecondaryItems.push({ text: formEpithet.trim(), kind: 'epithet' });
  }
  if (showKunya && formKunya.trim()) {
    previewSecondaryItems.push({ text: formKunya.trim(), kind: 'kunya' });
  }
  const previewAlliance = (
    formMaidenFamilyLine ||
    formMarriageAllianceNote ||
    ''
  ).trim();
  if (previewAlliance) {
    previewSecondaryItems.push({ text: previewAlliance, kind: 'alliance' });
  }
  if (formVitalStatus === 'deceased' && showDeceasedDignityFrame) {
    previewSecondaryItems.push({
      text: isFemale ? 'رحمها الله' : 'رحمه الله',
      kind: 'mercy',
    });
  }
  const previewPersonalLine = previewSecondaryItems
    .map((item) => item.text)
    .join(' · ');
  const previewHasCombinedEpithetAndMore =
    Boolean(showEpithet && formEpithet.trim()) &&
    previewSecondaryItems.length > 1;
  const previewPedestalDate = showDates
    ? formatCardSingleCalendarVitalDates(
        formBirthDate,
        formDeathDate,
        formBirthCalendar,
        calendarDisplayMode,
        formBirthPrecision
      )
    : null;
  const previewPedestalPlace = formBirthPlace.trim();
  const previewHasBio = Boolean(formBiography.trim());
  const previewMediaCount = linkedMediaForPerson.length;
  const previewHasPedestal = Boolean(
    previewPedestalDate ||
      previewPedestalPlace ||
      previewMediaCount > 0 ||
      previewHasBio
  );
  const showLivePlaquePreview =
    mode === 'edit' ||
    activeDetailPanel !== null ||
    hasIdentityDetails ||
    hasLifeDetails ||
    hasLegacyDetails;

  const handleTogglePanel = (panel: StudioDetailPanelId) => {
    setActiveDetailPanel((prev) => (prev === panel ? null : panel));
  };

  const handleAppendBioPrompt = (snippet: string) => {
    const trimmed = formBiography.trim();
    const next = trimmed ? `${trimmed}\n${snippet}` : snippet;
    onChangeBiography(next);
  };

  return (
    <div
      className="fixed inset-0 z-[90] bg-[#1F1F1C]/45 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={bindingHeadline}
      data-testid="royal-person-studio-modal"
    >
      <div
        ref={modalScrollContainerRef}
        dir="rtl"
        className="bg-[#F5F1E8] border border-[#D8C7B2]/45 rounded-3xl max-w-xl w-full shadow-[0_24px_70px_-18px_rgba(31,31,28,0.34)] my-4 max-h-[92vh] overflow-y-auto text-right flex flex-col animate-[treePopoverIn_180ms_cubic-bezier(0.16,1,0.3,1)_both]"
      >
        {/* ================================================================= */}
        {/* 1. COMPACT SINGLE-LINE TOP BAR                                    */}
        {/* ================================================================= */}
        <div className="px-5 py-3.5 bg-gradient-to-l from-[#F5F1E8] via-[#E8DED2] to-[#E8DED2] border-b border-[#D8C7B2]/25 flex items-center justify-between gap-3 shrink-0">
          <h3 className="text-sm font-display font-extrabold text-[#1F1F1C] truncate">
            {bindingHeadline}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق النافذة"
            className="w-8 h-8 rounded-full bg-[#F5F1E8]/90 hover:bg-[#E8DED2] border border-[#D8C7B2]/30 text-[#D97757] flex items-center justify-center cursor-pointer shrink-0 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ================================================================= */}
        {/* 2. EXISTING WIVES PICKER (ONLY when father already has wives)     */}
        {/* ================================================================= */}
        {hasExistingFatherWivesSelector && smartAddMotherContext && (
          <div
            data-testid="smart-add-mother-panel"
            className="mx-5 mt-4 rounded-2xl bg-[#F5F1E8] border border-[#D97757]/50 p-3.5 space-y-2.5 shrink-0"
          >
            <div className="space-y-0.5">
              <div className="text-xs font-display font-extrabold text-[#D97757] flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-[#D97757] shrink-0" />
                <span>
                  اختيار الأم من زوجات ({smartAddMotherContext.fatherName}) أو إضافة زوجة جديدة
                </span>
              </div>
              <p className="text-[11px] text-[#D97757]">
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
                        ? 'bg-gradient-to-b from-[#D97757] to-[#D97757] text-[#F5F1E8] border-[#D97757] shadow-xs'
                        : 'bg-[#F5F1E8] text-[#1F1F1C] border-[#D8C7B2]/40 hover:border-[#D97757]'
                    }`}
                  >
                    <span aria-hidden="true">💍</span>
                    <span>
                      {wife.firstName}
                      {wife.kunya ? ` (${wife.kunya})` : ''}
                    </span>
                    {active && (
                      <Check className="w-3.5 h-3.5 text-[#F5F1E8]" />
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
                    ? 'bg-[#E8DED2] text-[#D97757] border-[#D97757] shadow-2xs'
                    : 'bg-[#F5F1E8] text-[#D97757] border-dashed border-[#D97757] hover:bg-[#F5F1E8]'
                }`}
              >
                <span>
                  + إضافة أم جديدة (تُسجّل كزوجة لـ{' '}
                  {smartAddMotherContext.fatherName})
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* 3. ZERO-FRICTION QUICK ENTRY FORM BODY                            */}
        {/* ================================================================= */}
        <form
          onSubmit={onSubmit}
          noValidate
          className="px-5 py-5 space-y-4 flex-1"
        >
          {/* Rapid-Add Feedback Toast (when using حفظ وإضافة آخر +) */}
          {quickAddSuccessNotice && (
            <div className="rounded-xl bg-[#F5F1E8]/90 border border-[#D8C7B2] px-3.5 py-2 text-xs font-display font-bold text-[#1F1F1C] flex items-center gap-2 animate-[studioPanelReveal_180ms_ease-out_both]">
              <CheckCircle2 className="w-4 h-4 text-[#D97757] shrink-0" />
              <span>{quickAddSuccessNotice}</span>
            </div>
          )}

          {isSelectingExistingMother && smartAddMotherContext ? (
            <div className="rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2]/35 p-4 space-y-2 text-xs text-[#1F1F1C] leading-relaxed">
              {chosenExistingWifeForMotherFlow ? (
                <>
                  <div className="font-display font-extrabold text-[#1F1F1C] text-sm">
                    تأكيد ربط الأم: «{chosenExistingWifeForMotherFlow.firstName}»
                  </div>
                  <p>
                    سيتم تعيين <strong>{chosenExistingWifeForMotherFlow.firstName}</strong> كأمٍ لـ{' '}
                    <strong>{smartAddMotherContext.childName}</strong> مباشرةً دون إنشاء بطاقة مكررة، وسيتحول مسار نسبه بصرياً ليخرج من عقدة اقتران{' '}
                    <strong>{smartAddMotherContext.fatherName}</strong> و<strong>{chosenExistingWifeForMotherFlow.firstName}</strong> (💍).
                  </p>
                </>
              ) : (
                <p className="text-[#D97757] font-semibold">
                  يرجى اختيار إحدى الزوجات المسجلات أعلاه، أو النقر على «+ إضافة أم جديدة».
                </p>
              )}
            </div>
          ) : (
            <>
              {/* =========================================================== */}
              {/* PRIMARY INSTANT ENTRY ROW: Clickable Avatar + Name Input *  */}
              {/* Always sits first directly beneath the modal header         */}
              {/* =========================================================== */}
              <div className="flex items-center gap-4">
                {/* Clickable Portrait Ring for Instant Upload */}
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <label
                    title="رفع صورة شخصية"
                    className="group relative block p-[3px] rounded-full bg-gradient-to-br from-[#D97757] via-[#D97757] to-[#D97757] shadow-sm cursor-pointer transition-transform duration-200 hover:scale-[1.03]"
                  >
                    <div className="rounded-full bg-[#F5F1E8] p-0.5">
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
                        nodeOrigin="client_entered"
                        customImageUrl={formPhotoUrl || undefined}
                        preferRealPhoto={
                          preferRealPhotos || Boolean(formPhotoUrl)
                        }
                        displayName={cleanPreviewFirst || (isFemale ? 'ك' : 'ف')}
                        frameAccentHex={activeTreeTheme.primaryHex}
                        size="lg"
                      />
                    </div>
                    <span className="absolute -bottom-0.5 -left-0.5 w-7 h-7 rounded-full bg-gradient-to-b from-[#D97757] to-[#D97757] group-hover:from-[#D97757] group-hover:to-[#D97757] text-[#F5F1E8] border-2 border-[#F5F1E8] flex items-center justify-center shadow-xs transition-colors">
                      {isUploadingPortrait ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Camera className="w-3.5 h-3.5" />
                      )}
                    </span>
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
                    <button
                      type="button"
                      onClick={onClearPhotoUrl}
                      className="text-[10.5px] font-display font-semibold text-[#D97757] hover:text-[#D97757] inline-flex items-center gap-0.5 cursor-pointer"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      <span>رمزية</span>
                    </button>
                  )}
                </div>

                {/* Single Hero Name Input — Auto-Focused & Enter-to-Save */}
                <div className="flex-1 min-w-0">
                  <label
                    htmlFor="studio-person-name-input"
                    className="block text-xs font-display font-extrabold text-[#1F1F1C] mb-1.5"
                  >
                    الاسم <span className="text-[#D97757]">*</span>
                  </label>
                  <input
                    id="studio-person-name-input"
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
                    className="w-full rounded-xl bg-[#F5F1E8] border border-[#D8C7B2]/45 px-4 py-3 text-[15px] font-display font-bold text-[#1F1F1C] placeholder:text-[#1F1F1C]/35 focus:outline-none focus:border-[#D97757] focus:ring-3 focus:ring-[#D8C7B2]/20 shadow-2xs transition-all"
                  />
                </div>
              </div>

              {/* =========================================================== */}
              {/* QUIET EXPANDABLE DETAIL PILLS (Zero Black, Collapsed First) */}
              {/* =========================================================== */}
              <div className="pt-1 space-y-2.5">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="text-[11px] font-display font-bold text-[#D97757] ml-0.5">
                    تفاصيل إضافية:
                  </span>

                  {/* Pill 1: Dynamic contextual label (المكانة والأم / المكانة والمصاهرة / المكانة والألقاب) */}
                  <button
                    type="button"
                    aria-expanded={activeDetailPanel === 'identity'}
                    data-testid="studio-tab-identity"
                    onClick={() => handleTogglePanel('identity')}
                    className={`px-3 py-1.5 rounded-full text-[11.5px] font-display font-bold border transition-all duration-200 cursor-pointer inline-flex items-center gap-1.5 ${
                      activeDetailPanel === 'identity'
                        ? 'bg-gradient-to-b from-[#E8DED2] to-[#E8DED2] text-[#D97757] border-[#D97757]/70 shadow-2xs'
                        : 'bg-[#F5F1E8]/80 hover:bg-[#E8DED2] text-[#D97757] border-[#D8C7B2]/70 hover:border-[#D97757]/50'
                    }`}
                  >
                    <Sparkles className="w-3 h-3 text-[#D97757] shrink-0" />
                    <span>{identityPanelLabel}</span>
                    {hasIdentityDetails && activeDetailPanel !== 'identity' && (
                      <span
                        aria-hidden="true"
                        className="w-1.5 h-1.5 rounded-full bg-[#D97757]"
                      />
                    )}
                    <ChevronDown
                      className={`w-3 h-3 opacity-60 transition-transform duration-200 ${
                        activeDetailPanel === 'identity' ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* Pill 2: الميلاد والديار */}
                  <button
                    type="button"
                    aria-expanded={activeDetailPanel === 'life'}
                    data-testid="studio-tab-life"
                    onClick={() => handleTogglePanel('life')}
                    className={`px-3 py-1.5 rounded-full text-[11.5px] font-display font-bold border transition-all duration-200 cursor-pointer inline-flex items-center gap-1.5 ${
                      activeDetailPanel === 'life'
                        ? 'bg-gradient-to-b from-[#E8DED2] to-[#E8DED2] text-[#D97757] border-[#D97757]/70 shadow-2xs'
                        : 'bg-[#F5F1E8]/80 hover:bg-[#E8DED2] text-[#D97757] border-[#D8C7B2]/70 hover:border-[#D97757]/50'
                    }`}
                  >
                    <Clock className="w-3 h-3 text-[#D97757] shrink-0" />
                    <span>الميلاد والديار</span>
                    {hasLifeDetails && activeDetailPanel !== 'life' && (
                      <span
                        aria-hidden="true"
                        className="w-1.5 h-1.5 rounded-full bg-[#D97757]"
                      />
                    )}
                    <ChevronDown
                      className={`w-3 h-3 opacity-60 transition-transform duration-200 ${
                        activeDetailPanel === 'life' ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* Pill 3: السيرة والوثائق */}
                  <button
                    type="button"
                    aria-expanded={activeDetailPanel === 'legacy'}
                    data-testid="studio-tab-legacy"
                    onClick={() => handleTogglePanel('legacy')}
                    className={`px-3 py-1.5 rounded-full text-[11.5px] font-display font-bold border transition-all duration-200 cursor-pointer inline-flex items-center gap-1.5 ${
                      activeDetailPanel === 'legacy'
                        ? 'bg-gradient-to-b from-[#E8DED2] to-[#E8DED2] text-[#D97757] border-[#D97757]/70 shadow-2xs'
                        : 'bg-[#F5F1E8]/80 hover:bg-[#E8DED2] text-[#D97757] border-[#D8C7B2]/70 hover:border-[#D97757]/50'
                    }`}
                  >
                    <BookOpen className="w-3 h-3 text-[#D97757] shrink-0" />
                    <span>
                      السيرة والوثائق
                      {linkedMediaForPerson.length > 0
                        ? ` (${linkedMediaForPerson.length})`
                        : ''}
                    </span>
                    {hasLegacyDetails && activeDetailPanel !== 'legacy' && (
                      <span
                        aria-hidden="true"
                        className="w-1.5 h-1.5 rounded-full bg-[#D97757]"
                      />
                    )}
                    <ChevronDown
                      className={`w-3 h-3 opacity-60 transition-transform duration-200 ${
                        activeDetailPanel === 'legacy' ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                </div>

                {/* Live 3-Zone Luxury Plaque Preview (Appears smoothly in Edit mode or when details are expanded) */}
                {showLivePlaquePreview && (
                  <div
                    data-testid="studio-live-plaque-preview"
                    className="rounded-2xl bg-[#F5F1E8]/70 border border-[#D8C7B2]/25 px-4 py-3 flex flex-col items-center gap-2 animate-[studioPanelReveal_180ms_ease-out_both]"
                  >
                    <span className="text-[10px] font-display font-bold text-[#D97757]">
                      معاينة البطاقة في الشجرة
                    </span>
                    <div
                      className={`relative overflow-visible min-w-[184px] ${
                        previewHasCombinedEpithetAndMore
                          ? 'max-w-[248px]'
                          : 'max-w-[232px]'
                      } w-full rounded-2xl border-[1.5px] flex flex-col text-right shadow-xs ${
                        previewCrownLabel ? 'mt-2' : ''
                      } ${
                        activeTreeTheme.isDarkSurface
                          ? 'bg-[#1F1F1C] border-[#D8C7B2]/75'
                          : 'bg-gradient-to-l from-[#F5F1E8] via-[#F5F1E8] to-[#F5F1E8] border-[#D97757]/80'
                      }`}
                    >
                      {previewCrownLabel && (
                        <div
                          className={`absolute -top-2.5 left-1/2 -translate-x-1/2 z-20 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[9.5px] font-display font-bold leading-none whitespace-nowrap max-w-[184px] shadow-2xs ${
                            activeTreeTheme.isDarkSurface
                              ? 'bg-[#1F1F1C] border-[#D8C7B2]/75 text-[#D97757]'
                              : 'bg-gradient-to-b from-[#F5F1E8] to-[#E8DED2] border-[#D97757]/65 text-[#D97757]'
                          }`}
                        >
                          {previewPrestigeMeta && (
                            <Award className="w-2.5 h-2.5 shrink-0 text-[#D97757]" />
                          )}
                          <span className="truncate">{previewCrownLabel}</span>
                        </div>
                      )}

                      <div className="w-full flex items-center gap-3 px-3.5 py-2.5">
                        <div
                          className="w-11 h-11 rounded-full shrink-0 overflow-hidden flex items-center justify-center"
                          style={{
                            boxShadow: `0 0 0 1.5px ${activeTreeTheme.primaryHex}99`,
                          }}
                        >
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
                            nodeOrigin="client_entered"
                            customImageUrl={formPhotoUrl || undefined}
                            preferRealPhoto={
                              preferRealPhotos || Boolean(formPhotoUrl)
                            }
                            displayName={
                              cleanPreviewFirst || (isFemale ? 'ك' : 'ف')
                            }
                            frameAccentHex={activeTreeTheme.primaryHex}
                            size="md"
                            className="!w-full !h-full !border-0"
                          />
                        </div>

                        <div className="min-w-0 flex-1 flex flex-col justify-center gap-0.5">
                          <div className="min-w-0 leading-tight truncate whitespace-nowrap">
                            {previewHonorific && (
                              <span
                                className={`text-[12px] font-display font-medium opacity-85 ml-1 ${
                                  activeTreeTheme.isDarkSurface
                                    ? 'text-[#D97757]'
                                    : 'text-[#D97757]'
                                }`}
                              >
                                {previewHonorific}
                              </span>
                            )}
                            <span
                              className={`text-[16px] font-display font-bold leading-tight ${activeTreeTheme.nameText}`}
                            >
                              {cleanPreviewFirst || 'الاسم'}
                            </span>
                          </div>
                          {previewSecondaryItems.length > 0 && (
                            <div
                              title={previewPersonalLine}
                              className={`text-[11px] font-medium leading-tight truncate whitespace-nowrap ${activeTreeTheme.metaText}`}
                            >
                              {previewSecondaryItems.map((item, idx) => (
                                <React.Fragment key={`${item.kind}-${idx}`}>
                                  {idx > 0 && (
                                    <span
                                      aria-hidden="true"
                                      className="mx-1 text-[#D97757]/80 font-bold"
                                    >
                                      ·
                                    </span>
                                  )}
                                  <span
                                    className={
                                      item.kind === 'epithet'
                                        ? activeTreeTheme.isDarkSurface
                                          ? 'font-semibold text-[#D97757]'
                                          : 'font-semibold text-[#D97757]'
                                        : undefined
                                    }
                                  >
                                    {item.text}
                                  </span>
                                </React.Fragment>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {previewHasPedestal && (
                        <div
                          className={`w-full px-3 py-1.5 rounded-b-[inherit] border-t flex items-center justify-between gap-2 text-[10.5px] leading-none whitespace-nowrap ${
                            activeTreeTheme.isDarkSurface
                              ? 'bg-[#1F1F1C]/80 border-[#D8C7B2]/25 text-[#D97757]'
                              : 'bg-[#E8DED2]/65 border-[#D8C7B2]/20 text-[#D97757]'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            {previewPedestalDate && (
                              <span
                                title={previewPedestalDate.alternateTooltip}
                                className="inline-flex items-center gap-1 font-medium tabular-nums shrink-0"
                              >
                                <Calendar className="w-2.5 h-2.5 opacity-75 shrink-0" />
                                <span>{previewPedestalDate.primaryText}</span>
                              </span>
                            )}
                            {previewPedestalDate && previewPedestalPlace && (
                              <span className="text-[#D97757]/80 font-bold shrink-0">
                                ·
                              </span>
                            )}
                            {previewPedestalPlace && (
                              <span
                                title={previewPedestalPlace}
                                className="inline-flex items-center gap-0.5 min-w-0 font-medium"
                              >
                                <MapPin className="w-2.5 h-2.5 opacity-75 shrink-0" />
                                <span className="max-w-[78px] truncate">
                                  {previewPedestalPlace}
                                </span>
                              </span>
                            )}
                          </div>
                          {(previewMediaCount > 0 || previewHasBio) && (
                            <div className="flex items-center gap-1 shrink-0">
                              {previewMediaCount > 0 && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-[1px] rounded-md text-[9.5px] font-display font-bold bg-[#F5F1E8] border border-[#D8C7B2]/50 text-[#D97757] tabular-nums">
                                  📎 {previewMediaCount}
                                </span>
                              )}
                              {previewHasBio && (
                                <span className="inline-flex items-center justify-center w-[19px] h-[17px] rounded-md border bg-[#F5F1E8] border-[#D8C7B2]/45 text-[#D97757]">
                                  <ScrollText className="w-2.5 h-2.5" />
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* --------------------------------------------------------- */}
                {/* EXPANDABLE PANEL 1: ✦ المكانة والأم                        */}
                {/* --------------------------------------------------------- */}
                {activeDetailPanel === 'identity' && (
                  <div className="rounded-2xl bg-[#F5F1E8]/90 border border-[#D8C7B2]/30 p-4 space-y-3.5 animate-[studioPanelReveal_200ms_ease-out_both]">
                    {/* Balanced 2x2 Identity Grid: Row 1 (الصفة + اللقب) | Row 2 (الكنية + الوسام) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="studio-honorific-select"
                          className="block text-[11.5px] font-display font-bold text-[#1F1F1C] mb-1"
                        >
                          الصفة
                        </label>
                        <select
                          id="studio-honorific-select"
                          data-testid="studio-honorific-chips"
                          value={formHonorific}
                          onChange={(e) =>
                            onChangeHonorific(
                              e.target.value as ArabicHonorificTitle
                            )
                          }
                          className="w-full rounded-xl bg-[#F5F1E8] border border-[#D8C7B2]/35 px-3 py-2 text-xs font-bold text-[#1F1F1C] focus:outline-none focus:border-[#D97757] cursor-pointer"
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
                          htmlFor="studio-person-epithet-input"
                          className="block text-[11.5px] font-display font-bold text-[#1F1F1C] mb-1"
                        >
                          اللقب
                        </label>
                        <input
                          id="studio-person-epithet-input"
                          type="text"
                          data-testid="studio-person-epithet-input"
                          value={formEpithet}
                          onChange={(e) => onChangeEpithet(e.target.value)}
                          placeholder={
                            isFemale
                              ? 'مثال: الفاضلة / الصابرة / أم الخير'
                              : 'مثال: الأمين / الفاروق / شمس الدين'
                          }
                          className="w-full rounded-xl bg-[#F5F1E8] border border-[#D8C7B2]/35 px-3 py-2 text-xs font-semibold text-[#1F1F1C] placeholder:text-[#1F1F1C]/35 focus:outline-none focus:border-[#D97757]"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="studio-person-kunya-input"
                          className="block text-[11.5px] font-display font-bold text-[#1F1F1C] mb-1"
                        >
                          الكنية
                        </label>
                        <input
                          id="studio-person-kunya-input"
                          type="text"
                          data-testid="studio-person-kunya-input"
                          value={formKunya}
                          onChange={(e) => onChangeKunya(e.target.value)}
                          placeholder={
                            isFemale ? 'مثال: أم عبدالله' : 'مثال: أبو محمد'
                          }
                          className="w-full rounded-xl bg-[#F5F1E8] border border-[#D8C7B2]/35 px-3 py-2 text-xs font-semibold text-[#1F1F1C] placeholder:text-[#1F1F1C]/35 focus:outline-none focus:border-[#D97757]"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="studio-prestige-select"
                          className="block text-[11.5px] font-display font-bold text-[#1F1F1C] mb-1"
                        >
                          الوسام
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
                          className="w-full rounded-xl bg-[#F5F1E8] border border-[#D8C7B2]/35 px-3 py-2 text-xs font-bold text-[#1F1F1C] focus:outline-none focus:border-[#D97757] cursor-pointer"
                        >
                          {prestigeChoices.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Compact Mother Selector (Non-intrusive, Full Binding Preserved) */}
                    {showMotherSelector && !isSpouseRole && (
                      <div
                        data-testid="studio-mother-selector"
                        className="pt-2.5 border-t border-[#D8C7B2]/20 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <label
                            htmlFor="studio-mother-select"
                            className="text-[11.5px] font-display font-bold text-[#1F1F1C] flex items-center gap-1.5"
                          >
                            <Heart className="w-3 h-3 text-[#D97757] shrink-0" />
                            <span>الأم</span>
                            {motherSelectorFatherName && (
                              <span className="text-[10.5px] font-normal text-[#D97757]">
                                — زوجات {motherSelectorFatherName}
                              </span>
                            )}
                          </label>
                          {motherSelectorFatherName && (
                            <button
                              type="button"
                              data-testid="studio-mother-option-create-new"
                              onClick={() =>
                                onChangeMotherId(
                                  isCreatingInlineMother
                                    ? ''
                                    : NEW_MOTHER_SENTINEL
                                )
                              }
                              className={`px-2 py-0.5 rounded-lg text-[10.5px] font-display font-bold border transition-colors cursor-pointer ${
                                isCreatingInlineMother
                                  ? 'bg-[#E8DED2] text-[#D97757] border-[#D97757]'
                                  : 'bg-[#F5F1E8] text-[#D97757] border-[#D8C7B2]/45 hover:bg-[#F5F1E8]'
                              }`}
                            >
                              {isCreatingInlineMother
                                ? 'إلغاء الإضافة'
                                : '+ أم جديدة'}
                            </button>
                          )}
                        </div>

                        {!isCreatingInlineMother ? (
                          <select
                            id="studio-mother-select"
                            data-testid="studio-mother-select"
                            value={formMotherId}
                            onChange={(e) => onChangeMotherId(e.target.value)}
                            className="w-full rounded-xl bg-[#F5F1E8] border border-[#D8C7B2]/35 px-3 py-2 text-xs font-bold text-[#1F1F1C] focus:outline-none focus:border-[#D97757] cursor-pointer"
                          >
                            <option value="">غير محدد</option>
                            {motherOptions.map((mom) => (
                              <option key={mom.id} value={mom.id}>
                                💍 {mom.firstName}
                                {mom.kunya ? ` (${mom.kunya})` : ''}
                              </option>
                            ))}
                            {motherSelectorFatherName && (
                              <option value={NEW_MOTHER_SENTINEL}>
                                + أم جديدة (زوجة لـ {motherSelectorFatherName})
                              </option>
                            )}
                          </select>
                        ) : (
                          <div
                            data-testid="studio-inline-new-mother-box"
                            className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                          >
                            <div>
                              <label className="block text-[10.5px] font-display font-bold text-[#D97757] mb-1">
                                اسم الأم <span className="text-[#D97757]">*</span>
                              </label>
                              <input
                                type="text"
                                data-testid="studio-inline-new-mother-name"
                                value={inlineNewMotherName}
                                onChange={(e) =>
                                  onChangeInlineNewMotherName(e.target.value)
                                }
                                placeholder="مثال: أمينة / فاطمة"
                                className="w-full rounded-xl bg-[#F5F1E8] border border-[#D97757]/55 px-2.5 py-1.5 text-xs font-bold text-[#1F1F1C] focus:outline-none focus:border-[#D97757]"
                              />
                            </div>
                            <div>
                              <label className="block text-[10.5px] font-display font-bold text-[#D97757] mb-1">
                                عائلتها / نسب المصاهرة
                              </label>
                              <input
                                type="text"
                                value={inlineNewMotherMaidenLine}
                                onChange={(e) =>
                                  onChangeInlineNewMotherMaidenLine(
                                    e.target.value
                                  )
                                }
                                placeholder="مثال: من عائلة آل..."
                                className="w-full rounded-xl bg-[#F5F1E8] border border-[#D8C7B2]/35 px-2.5 py-1.5 text-xs text-[#1F1F1C] focus:outline-none focus:border-[#D97757]"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Wife Maiden Family Line */}
                    {isSpouseRole && (
                      <div
                        data-testid="studio-wife-maiden-family-field"
                        className="pt-2.5 border-t border-[#D8C7B2]/20 space-y-1"
                      >
                        <label className="block text-[11.5px] font-display font-bold text-[#D97757]">
                          عائلتها / نسب المصاهرة
                        </label>
                        <input
                          type="text"
                          value={formMaidenFamilyLine}
                          onChange={(e) =>
                            onChangeMaidenFamilyLine(e.target.value)
                          }
                          placeholder="مثال: كريمة الشيخ... / من عائلة آل..."
                          className="w-full rounded-xl bg-[#F5F1E8] border border-[#D8C7B2]/35 px-3 py-2 text-xs text-[#1F1F1C] placeholder:text-[#1F1F1C]/35 focus:outline-none focus:border-[#D97757]"
                        />
                      </div>
                    )}

                    {/* Daughter Marriage Note */}
                    {isDaughterRole && !isSpouseRole && (
                      <div
                        data-testid="studio-daughter-alliance-field"
                        className="pt-2.5 border-t border-[#D8C7B2]/20 space-y-1"
                      >
                        <label className="block text-[11.5px] font-display font-bold text-[#D97757]">
                          بيان المصاهرة / قرينة
                        </label>
                        <input
                          type="text"
                          value={formMarriageAllianceNote}
                          onChange={(e) =>
                            onChangeMarriageAllianceNote(e.target.value)
                          }
                          placeholder="مثال: قرينة الأستاذ... من عائلة آل..."
                          className="w-full rounded-xl bg-[#F5F1E8] border border-[#D8C7B2]/35 px-3 py-2 text-xs text-[#1F1F1C] placeholder:text-[#1F1F1C]/35 focus:outline-none focus:border-[#D97757]"
                        />
                      </div>
                    )}

                    {/* Female Privacy Toggle & Subtree Focus */}
                    {((isFemale && !isVerticalOnlyModal) ||
                      (canFocusSubtree && onFocusSubtree)) && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-[#D8C7B2]/20">
                        {isFemale && !isVerticalOnlyModal && (
                          <button
                            type="button"
                            onClick={() =>
                              onChangeFemalePrivacyMasked(
                                !formFemalePrivacyMasked
                              )
                            }
                            className={`px-3 py-1.5 rounded-xl text-[11.5px] font-display font-bold border transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                              formFemalePrivacyMasked
                                ? 'bg-[#E8DED2] text-[#D97757] border-[#D97757]/60'
                                : 'bg-[#F5F1E8] text-[#D97757] border-[#D8C7B2]/30'
                            }`}
                          >
                            <EyeOff className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              {formFemalePrivacyMasked
                                ? 'ستر الاسم في العرض العام مفعّل'
                                : 'تفعيل ستر الاسم في العرض العام'}
                            </span>
                          </button>
                        )}

                        {canFocusSubtree && onFocusSubtree && (
                          <button
                            type="button"
                            data-testid="focus-subtree-person-btn"
                            onClick={onFocusSubtree}
                            className="px-3 py-1.5 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D97757]/55 text-[11.5px] font-display font-extrabold text-[#D97757] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <Crosshair className="w-3.5 h-3.5 text-[#D97757] shrink-0" />
                            <span>تركيز العرض على هذا الفرع</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* --------------------------------------------------------- */}
                {/* EXPANDABLE PANEL 2: ⏳ الميلاد والديار                     */}
                {/* --------------------------------------------------------- */}
                {activeDetailPanel === 'life' && (
                  <div className="rounded-2xl bg-[#F5F1E8]/90 border border-[#D8C7B2]/30 p-4 space-y-4 animate-[studioPanelReveal_200ms_ease-out_both]">
                    {/* Vital Status Toggle (Warm Heritage Palette — Zero Black) */}
                    <div className="space-y-1.5">
                      <label className="block text-[11.5px] font-display font-bold text-[#1F1F1C]">
                        الحالة الحياتية
                      </label>
                      <div
                        data-testid="studio-vital-status-toggle"
                        className="grid grid-cols-3 gap-1.5"
                      >
                        {(
                          [
                            { id: 'unspecified', label: 'غير محدد' },
                            { id: 'living', label: 'على قيد الحياة' },
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
                              className={`px-2.5 py-2 rounded-xl text-[11.5px] font-display font-extrabold border transition-all cursor-pointer ${
                                active
                                  ? opt.id === 'deceased'
                                    ? 'bg-[#D97757] text-[#F5F1E8] border-[#D97757] shadow-2xs'
                                    : opt.id === 'living'
                                    ? 'bg-[#D97757] text-[#F5F1E8] border-[#D8C7B2] shadow-2xs'
                                    : 'bg-[#E8DED2] text-[#D97757] border-[#D97757]'
                                  : 'bg-[#F5F1E8] text-[#D97757] border-[#D8C7B2]/30 hover:border-[#D97757]/60'
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Calendar & Precision Toggles */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="block text-[11.5px] font-display font-bold text-[#1F1F1C]">
                          التقويم
                        </label>
                        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#E8DED2] border border-[#D8C7B2]/25">
                          <button
                            type="button"
                            onClick={() => onChangeBirthCalendar('hijri')}
                            className={`py-1.5 rounded-lg text-[11.5px] font-display font-extrabold transition-all cursor-pointer ${
                              formBirthCalendar === 'hijri'
                                ? 'bg-[#F5F1E8] text-[#D97757] shadow-2xs'
                                : 'text-[#D97757] hover:text-[#1F1F1C]'
                            }`}
                          >
                            هجري (هـ)
                          </button>
                          <button
                            type="button"
                            onClick={() => onChangeBirthCalendar('gregorian')}
                            className={`py-1.5 rounded-lg text-[11.5px] font-display font-extrabold transition-all cursor-pointer ${
                              formBirthCalendar === 'gregorian'
                                ? 'bg-[#F5F1E8] text-[#D97757] shadow-2xs'
                                : 'text-[#D97757] hover:text-[#1F1F1C]'
                            }`}
                          >
                            ميلادي (م)
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-[11.5px] font-display font-bold text-[#1F1F1C]">
                          دقة التاريخ
                        </label>
                        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#E8DED2] border border-[#D8C7B2]/25">
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
                                className={`py-1.5 rounded-lg text-[11px] font-display font-extrabold transition-all cursor-pointer ${
                                  active
                                    ? 'bg-[#F5F1E8] text-[#D97757] shadow-2xs'
                                    : 'text-[#D97757] hover:text-[#1F1F1C]'
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11.5px] font-display font-bold text-[#1F1F1C] mb-1">
                          {formBirthPrecision === 'era'
                            ? 'الحقبة الزمنية'
                            : 'تاريخ الميلاد'}
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
                          className="w-full rounded-xl bg-[#F5F1E8] border border-[#D8C7B2]/35 px-3 py-2 text-xs font-semibold text-[#1F1F1C] tabular-nums focus:outline-none focus:border-[#D97757]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11.5px] font-display font-bold text-[#1F1F1C] mb-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[#D97757]" />
                          <span>مكان الميلاد</span>
                        </label>
                        <input
                          type="text"
                          value={formBirthPlace}
                          onChange={(e) => onChangeBirthPlace(e.target.value)}
                          placeholder="مثال: بغداد / الرياض / دمشق"
                          className="w-full rounded-xl bg-[#F5F1E8] border border-[#D8C7B2]/35 px-3 py-2 text-xs font-semibold text-[#1F1F1C] focus:outline-none focus:border-[#D97757]"
                        />
                      </div>
                    </div>

                    {/* Conditional Death Fields */}
                    {formVitalStatus === 'deceased' && (
                      <div
                        data-testid="studio-deceased-fields"
                        className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-[#D8C7B2]/20"
                      >
                        <div>
                          <label className="block text-[11.5px] font-display font-bold text-[#1F1F1C] mb-1">
                            تاريخ الوفاة
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
                            className="w-full rounded-xl bg-[#F5F1E8] border border-[#D8C7B2]/35 px-3 py-2 text-xs font-semibold text-[#1F1F1C] tabular-nums focus:outline-none focus:border-[#D97757]"
                          />
                        </div>

                        <div>
                          <label className="block text-[11.5px] font-display font-bold text-[#1F1F1C] mb-1">
                            مكان الوفاة أو المدفن
                          </label>
                          <input
                            type="text"
                            value={formDeathPlace}
                            onChange={(e) => onChangeDeathPlace(e.target.value)}
                            placeholder="مثال: مقبرة العود / البقيع / النجف"
                            className="w-full rounded-xl bg-[#F5F1E8] border border-[#D8C7B2]/35 px-3 py-2 text-xs font-semibold text-[#1F1F1C] focus:outline-none focus:border-[#D97757]"
                          />
                        </div>
                      </div>
                    )}

                    {/* Conditional Contact Field */}
                    {formVitalStatus === 'living' && (
                      <div className="pt-3 border-t border-[#D8C7B2]/20">
                        <label className="block text-[11.5px] font-display font-bold text-[#1F1F1C] mb-1">
                          التواصل العائلي
                        </label>
                        <input
                          type="text"
                          dir="ltr"
                          value={formContactInfo}
                          onChange={(e) => onChangeContactInfo(e.target.value)}
                          placeholder="relative@family.com / +966500000000"
                          className="w-full rounded-xl bg-[#F5F1E8] border border-[#D8C7B2]/35 px-3 py-2 text-xs text-[#1F1F1C] text-right focus:outline-none focus:border-[#D97757]"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* --------------------------------------------------------- */}
                {/* EXPANDABLE PANEL 3: 📜 السيرة والوثائق                     */}
                {/* --------------------------------------------------------- */}
                {activeDetailPanel === 'legacy' && (
                  <div className="rounded-2xl bg-[#F5F1E8]/90 border border-[#D8C7B2]/30 p-4 space-y-4 animate-[studioPanelReveal_200ms_ease-out_both]">
                    {/* Biography + Quick Inspiration Prompts */}
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="text-[11.5px] font-display font-bold text-[#1F1F1C]">
                          السيرة
                        </label>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {bioPrompts.map((prompt) => (
                            <button
                              key={prompt.label}
                              type="button"
                              onClick={() => handleAppendBioPrompt(prompt.snippet)}
                              className="px-2 py-0.5 rounded-lg bg-[#F5F1E8] hover:bg-[#E8DED2] text-[#D97757] border border-[#D8C7B2]/35 text-[10.5px] font-display font-bold transition-colors cursor-pointer"
                            >
                              {prompt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <textarea
                        rows={3}
                        value={formBiography}
                        onChange={(e) => onChangeBiography(e.target.value)}
                        placeholder={
                          isFemale
                            ? 'دوّن نبذةً عن سيرتها الكريمة ومآثرها...'
                            : 'دوّن نبذةً عن سيرته ومآثره وأعماله...'
                        }
                        className="w-full rounded-xl bg-[#F5F1E8] border border-[#D8C7B2]/35 p-3 text-xs sm:text-sm text-[#1F1F1C] leading-relaxed focus:outline-none focus:border-[#D97757]"
                      />
                    </div>

                    {/* Historical Document Reference Note */}
                    <div>
                      <label className="block text-[11.5px] font-display font-bold text-[#1F1F1C] mb-1">
                        صك أو وثيقة تاريخية
                      </label>
                      <input
                        type="text"
                        value={formAttachedDocName}
                        onChange={(e) => onChangeAttachedDocName(e.target.value)}
                        placeholder="مثال: وثيقة حصر إرث مؤرخة عام 1372 هـ"
                        className="w-full rounded-xl bg-[#F5F1E8] border border-[#D8C7B2]/35 px-3 py-2 text-xs text-[#1F1F1C] focus:outline-none focus:border-[#D97757]"
                      />
                    </div>

                    {/* Visual Media Vault Gallery (`خزانتي`) */}
                    <div
                      data-testid="person-modal-vault-media-section"
                      className="pt-3 border-t border-[#D8C7B2]/20 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-[11.5px] font-display font-extrabold text-[#1F1F1C]">
                          <Paperclip className="w-3.5 h-3.5 text-[#D97757]" />
                          <span>
                            ملفات «خزانتي» ({linkedMediaForPerson.length})
                          </span>
                        </div>
                        <span className="text-[10.5px] font-semibold text-[#D97757]">
                          مزامنة فورية
                        </span>
                      </div>

                      {linkedMediaForPerson.length === 0 ? (
                        <div className="rounded-xl bg-[#F5F1E8]/70 border border-dashed border-[#D8C7B2]/45 p-3 text-[11.5px] text-[#D97757] text-center">
                          لا توجد صور أو وثائق مربوطة بعد. ارفع ملفاً أدناه أو اربطه من خزانتك.
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                                className="rounded-xl bg-[#F5F1E8] border border-[#D8C7B2]/35 overflow-hidden flex flex-col shadow-2xs"
                              >
                                <div className="h-20 bg-[#F5F1E8] relative flex items-center justify-center overflow-hidden">
                                  {isImage ? (
                                    <img
                                      src={previewSrc}
                                      alt={media.title}
                                      referrerPolicy="no-referrer"
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <FileText className="w-6 h-6 text-[#D97757]/70" />
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => onToggleVaultItemLink(media.id)}
                                    title="فك الربط"
                                    className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-[#D97757]/90 hover:bg-[#D97757] text-[#F5F1E8] text-[10px] font-bold cursor-pointer transition-colors"
                                  >
                                    فك
                                  </button>
                                </div>
                                <div className="p-1.5">
                                  <div className="text-[11px] font-display font-bold text-[#1F1F1C] truncate">
                                    {media.title}
                                  </div>
                                  <div className="text-[10px] text-[#D97757] truncate">
                                    {media.mediaType === 'photo' ? 'صورة' : 'وثيقة'} ·{' '}
                                    {media.dateOrOccasion}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Direct 1-Click Upload into Vault */}
                      <div className="rounded-xl bg-[#F5F1E8]/80 border border-[#D8C7B2]/30 p-3 space-y-2.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-display font-bold text-[#D97757] ml-0.5">
                            المجلد:
                          </span>
                          {vaultFolders.map((vf) => {
                            const active = treeVaultUploadFolderId === vf.id;
                            return (
                              <button
                                key={vf.id}
                                type="button"
                                onClick={() =>
                                  onChangeTreeVaultUploadFolderId(vf.id)
                                }
                                className={`px-2 py-1 rounded-lg text-[10.5px] font-display font-bold border transition-all cursor-pointer ${
                                  active
                                    ? 'bg-[#E8DED2] text-[#D97757] border-[#D97757]'
                                    : 'bg-[#F5F1E8] text-[#D97757] border-[#D8C7B2]/30 hover:border-[#D97757]'
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
                            placeholder="عنوان الصورة أو الوثيقة..."
                            className="flex-1 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2]/35 px-3 py-1.5 text-xs text-[#1F1F1C] focus:outline-none focus:border-[#D97757]"
                          />
                          <label className="px-3.5 py-1.5 rounded-xl bg-gradient-to-b from-[#D97757] to-[#D97757] hover:from-[#D97757] hover:to-[#D97757] text-[#F5F1E8] text-xs font-display font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors shrink-0">
                            <Upload className="w-3.5 h-3.5" />
                            <span>
                              {isUploadingToVault ? 'جاري الحفظ...' : 'رفع ملف'}
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

                      {/* Unlinked Vault Items — 1-Click Linking */}
                      {unlinkedMediaInVault.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="text-[11px] font-display font-bold text-[#D97757] flex items-center gap-1.5">
                            <Link2 className="w-3.5 h-3.5 text-[#D97757]" />
                            <span>ربط مقتنيات موجودة في «خزانتي»:</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto py-0.5">
                            {unlinkedMediaInVault.map((uv) => {
                              const thumb =
                                uv.thumbnailDataUrl || uv.fileDataUrl;
                              const isImg =
                                uv.mediaType === 'photo' ||
                                thumb.startsWith('data:image') ||
                                thumb.startsWith('http');
                              return (
                                <button
                                  key={uv.id}
                                  type="button"
                                  onClick={() => onToggleVaultItemLink(uv.id)}
                                  className="pl-2.5 pr-1.5 py-1 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] text-[#1F1F1C] hover:text-[#D97757] border border-[#D8C7B2]/35 text-[11px] font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                                >
                                  <span className="w-5 h-5 rounded-md bg-[#F5F1E8] overflow-hidden shrink-0 flex items-center justify-center">
                                    {isImg ? (
                                      <img
                                        src={thumb}
                                        alt={uv.title}
                                        referrerPolicy="no-referrer"
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <FileText className="w-3 h-3 text-[#D97757]" />
                                    )}
                                  </span>
                                  <span className="max-w-[130px] truncate">
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
              </div>
            </>
          )}

          {formError && (
            <div className="rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] px-3.5 py-2.5 text-xs font-bold text-[#D97757]">
              {formError}
            </div>
          )}

          {/* Quiet Contextual Info Strip (Positioned cleanly above Save / Cancel) */}
          {!isSelectingExistingMother &&
            showAutoLinkMotherFooterNote &&
            smartAddMotherContext?.fatherName && (
              <div
                data-testid="smart-add-mother-panel"
                className="rounded-xl bg-[#F5F1E8]/85 border border-[#D8C7B2]/30 px-3.5 py-2 flex items-center gap-2 text-[11.5px] text-[#D97757] leading-relaxed"
              >
                <Heart className="w-3.5 h-3.5 text-[#D97757] shrink-0" />
                <span>
                  سيتم ربطها تلقائياً كزوجة للأب (
                  <strong>{smartAddMotherContext.fatherName}</strong>) وأمٍ لـ (
                  <strong>{smartAddMotherContext.childName}</strong>) في خطوة واحدة.
                </span>
              </div>
            )}

          {!isSelectingExistingMother && isVerticalOnlyModal && (
            <div className="rounded-xl bg-[#F5F1E8]/85 border border-[#D8C7B2]/30 px-3.5 py-2 text-[11.5px] text-[#D97757] leading-relaxed">
              {isHorizontalBridgeAboveFamily ? (
                <>
                  <strong className="text-[#D97757]">
                    فرع أفقي فوق العائلة وحتى الجذر:
                  </strong>{' '}
                  يُسجَّل هذا الفرع بشكل أفقي مجاور في نطاق الوصل الواقع بين العائلة ونقطة الجذر الموثقة.
                </>
              ) : (
                <>
                  <strong className="text-[#D97757]">
                    حلقة ربط عمودية نحو الجذر:
                  </strong>{' '}
                  تُسجَّل كعقدة عمودية منفردة لربط عمود عائلتك بنقطة الجذر الموثقة.
                </>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* FOOTER ACTION BAR — WARM HERITAGE BRONZE & GOLD (ZERO BLACK)      */}
          {/* ================================================================= */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3.5 border-t border-[#D8C7B2]/25">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-[#E8DED2] hover:bg-[#D8C7B2]/60 text-xs font-display font-bold text-[#D97757] cursor-pointer transition-colors"
            >
              إلغاء
            </button>

            <div className="flex items-center gap-2">
              {mode === 'add' &&
                !isSelectingExistingMother &&
                canSaveAndAddAnother &&
                onSaveAndAddAnother && (
                  <button
                    type="button"
                    disabled={isUploadingToVault || isUploadingPortrait}
                    data-testid="studio-save-and-add-another-btn"
                    onClick={onSaveAndAddAnother}
                    className="px-4 py-2.5 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] disabled:opacity-60 border border-[#D97757]/50 text-[#D97757] text-xs font-display font-extrabold inline-flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <span>حفظ وإضافة آخر</span>
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}

              <button
                type="submit"
                disabled={isUploadingToVault || isUploadingPortrait}
                data-testid="studio-save-person-btn"
                className="px-6 py-2.5 rounded-xl bg-gradient-to-b from-[#D97757] to-[#D97757] hover:from-[#D97757] hover:to-[#D97757] disabled:opacity-60 text-[#F5F1E8] border border-[#D8C7B2]/35 text-xs sm:text-sm font-display font-extrabold cursor-pointer shadow-[0_6px_18px_-6px_rgba(217,119,87,0.52)] transition-all"
              >
                {isUploadingToVault || isUploadingPortrait
                  ? 'جاري الحفظ...'
                  : isSelectingExistingMother
                  ? 'اعتماد وربط الأم ✓'
                  : 'حفظ'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
