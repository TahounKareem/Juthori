import type { CSSProperties } from 'react';
import type { TreeAvatarStyle } from '../components/HeritageNodeAvatar';

export type TreeCardThemeId =
  | 'heritage'
  | 'emerald_gold'
  | 'andalusian_navy'
  | 'olive_sand'
  | 'royal_burgundy'
  | 'royal_kiswah'
  | 'pearl_bronze'
  | 'papyrus_lapis'
  | 'diriyah_oasis'
  | 'manuscript_ink';

export type TreeLayoutOrientation =
  | 'vertical'
  | 'sideways'
  | 'fan_180'
  | 'radial_360';

export type TreeNodeShape = 'card' | 'circle' | 'leaf';
export type TreeCardDensity = 'detailed' | 'balanced' | 'compact';
export type TreeConnectorStyle = 'curved' | 'orthogonal' | 'heritage_branch';
export type TreeCanvasBackground = 'dots' | 'parchment' | 'marble';
export type TreeVitalFilter = 'all' | 'living' | 'deceased';
export type TreeSpouseDisplayMode = 'always' | 'on_select' | 'hidden';
export type TreeCalendarDisplayMode = 'hijri' | 'gregorian' | 'dual';

export type PosterPaperSize = 'A4' | 'A3' | 'A2_A1' | 'panorama';
export type PosterBorderStyle = 'islamic_gold' | 'classic_double' | 'modern_soft';
export type PosterHeaderStyle = 'basmala_verse' | 'basmala_only' | 'none';

export type TreeSettingsTabId = 'layout' | 'filters' | 'identity' | 'poster';
export type TreeQuickPresetId = 'quick_edit' | 'luxury_family' | 'wall_poster';

export type TreeArabicFontId =
  | 'amiri'
  | 'noto_naskh'
  | 'cairo_modern'
  | 'ruqaa_festive';

export type TreeSiblingSortOrder = 'added' | 'birth_oldest';

export type TreePrestigeBadgeId =
  | 'none'
  | 'family_dean'
  | 'historical_figure'
  | 'heritage_keeper'
  | 'noble_lady'
  | 'memory_narrator';

export interface TreeArabicFontDefinition {
  id: TreeArabicFontId;
  label: string;
  shortLabel: string;
  subtitle: string;
  cssFamily: string;
  canvasFontName: string;
  sampleText: string;
}

export const TREE_ARABIC_FONT_OPTIONS: TreeArabicFontDefinition[] = [
  {
    id: 'amiri',
    label: 'النسخ التراثي الأصيل — Amiri',
    shortLabel: 'النسخ (Amiri)',
    subtitle: 'خط عربي طباعي عريق يليق بالمخطوطات والأنساب',
    cssFamily: "'Amiri', 'Noto Naskh Arabic', serif",
    canvasFontName: 'Amiri',
    sampleText: 'شجرة النسب الأصيل',
  },
  {
    id: 'noto_naskh',
    label: 'الكلاسيكي الوقور — Noto Naskh',
    shortLabel: 'كلاسيكي وقور',
    subtitle: 'وضوح متزن وفخامة هادئة للأسماء والتواريخ',
    cssFamily: "'Noto Naskh Arabic', 'Scheherazade New', 'Amiri', serif",
    canvasFontName: 'Noto Naskh Arabic',
    sampleText: 'شجرة النسب الأصيل',
  },
  {
    id: 'cairo_modern',
    label: 'الهندسي الحديث الفاخر — Cairo',
    shortLabel: 'حديث (Cairo)',
    subtitle: 'خط عصري حاد ومقروء للشاشات واللوحات التفاعلية',
    cssFamily: "'Cairo', 'Readex Pro', 'IBM Plex Sans Arabic', sans-serif",
    canvasFontName: 'Cairo',
    sampleText: 'شجرة النسب الأصيل',
  },
  {
    id: 'ruqaa_festive',
    label: 'الرقعة الاحتفالي للعناوين — Aref Ruqaa',
    shortLabel: 'رقعة احتفالي',
    subtitle: 'طابع خطي احتفالي فاخر للمجالس والبوسترات الجدارية',
    cssFamily: "'Aref Ruqaa', 'Amiri', serif",
    canvasFontName: 'Aref Ruqaa',
    sampleText: 'شجرة النسب الأصيل',
  },
];

export function getTreeArabicFontDefinition(
  fontId: TreeArabicFontId | undefined
): TreeArabicFontDefinition {
  return (
    TREE_ARABIC_FONT_OPTIONS.find((f) => f.id === fontId) ||
    TREE_ARABIC_FONT_OPTIONS[2]
  );
}

export interface TreePrestigeBadgeOption {
  id: TreePrestigeBadgeId;
  label: string;
  shortLabel: string;
  description: string;
}

export const TREE_PRESTIGE_BADGE_OPTIONS: TreePrestigeBadgeOption[] = [
  {
    id: 'none',
    label: 'بدون وسام',
    shortLabel: 'بدون',
    description: 'بطاقة نظيفة بالاسم فقط',
  },
  {
    id: 'family_dean',
    label: 'عميد الأسرة',
    shortLabel: 'عميد الأسرة',
    description: 'وسام تقديري لكبير العائلة ومرجعها',
  },
  {
    id: 'historical_figure',
    label: 'شخصية تاريخية موثقة',
    shortLabel: 'شخصية تاريخية',
    description: 'وسام للأعلام والشخصيات التاريخية الموثقة',
  },
  {
    id: 'heritage_keeper',
    label: 'حافظ للإرث',
    shortLabel: 'حافظ للإرث',
    description: 'وسام لمن أسهم في جمع وتوثيق إرث الأسرة',
  },
];

export const FEMALE_TREE_PRESTIGE_BADGE_OPTIONS: TreePrestigeBadgeOption[] = [
  {
    id: 'none',
    label: 'بدون وسام',
    shortLabel: 'بدون',
    description: 'بطاقة نظيفة بالاسم فقط',
  },
  {
    id: 'noble_lady',
    label: 'كريمة الأسرة',
    shortLabel: 'كريمة الأسرة',
    description: 'وسام تقديري لكريمات الأسرة ومكانتهن',
  },
  {
    id: 'family_dean',
    label: 'عميدة فاضلة',
    shortLabel: 'عميدة فاضلة',
    description: 'وسام تقديري لكبيرة الأسرة وعميدتها',
  },
  {
    id: 'heritage_keeper',
    label: 'حافظة للإرث',
    shortLabel: 'حافظة للإرث',
    description: 'وسام لمن أسهمت في حفظ وتوثيق إرث الأسرة',
  },
  {
    id: 'historical_figure',
    label: 'شخصية بارزة',
    shortLabel: 'شخصية بارزة',
    description: 'وسام للأعلام النسائية والشخصيات البارزة',
  },
  {
    id: 'memory_narrator',
    label: 'راوية للذاكرة',
    shortLabel: 'راوية للذاكرة',
    description: 'وسام لراويات تاريخ الأسرة وذكرياتها الشفهية',
  },
];

export function getPrestigeBadgeOptionsForGender(
  gender: 'male' | 'female'
): TreePrestigeBadgeOption[] {
  return gender === 'female'
    ? FEMALE_TREE_PRESTIGE_BADGE_OPTIONS
    : TREE_PRESTIGE_BADGE_OPTIONS;
}

export function resolvePrestigeBadgeMeta(
  badgeId: TreePrestigeBadgeId | undefined,
  gender: 'male' | 'female'
): TreePrestigeBadgeOption | null {
  if (!badgeId || badgeId === 'none') return null;
  const list = getPrestigeBadgeOptionsForGender(gender);
  return (
    list.find((b) => b.id === badgeId) ||
    TREE_PRESTIGE_BADGE_OPTIONS.find((b) => b.id === badgeId) ||
    FEMALE_TREE_PRESTIGE_BADGE_OPTIONS.find((b) => b.id === badgeId) ||
    null
  );
}

export interface TreePosterSettings {
  paperSize: PosterPaperSize;
  borderStyle: PosterBorderStyle;
  headerStyle: PosterHeaderStyle;
  customTitle: string;
  showLegend: boolean;
  showQrCode: boolean;
  showStampAndDates: boolean;
  inkSaverMode: boolean;
}

export const TREE_DISPLAY_SETTINGS_SCHEMA_VERSION = 3;

export interface TreeDisplaySettings {
  defaultsSchemaVersion?: number;
  cardTheme: TreeCardThemeId;
  avatarStyle: TreeAvatarStyle;
  fontFamily: TreeArabicFontId;
  preferRealPhotos: boolean;
  femalePrivacyMode: 'full_name' | 'kunya_only' | 'hide_females';
  showHonorific: boolean;
  showKunya: boolean;
  showDates: boolean;
  showKinshipArrows: boolean;
  layoutOrientation: TreeLayoutOrientation;
  nodeShape: TreeNodeShape;
  cardDensity: TreeCardDensity;
  connectorStyle: TreeConnectorStyle;
  canvasBackground: TreeCanvasBackground;
  showGenerationBar: boolean;
  highlightDirectCompass: boolean;
  vitalStatusFilter: TreeVitalFilter;
  showDeceasedDignityFrame: boolean;
  spouseDisplayMode: TreeSpouseDisplayMode;
  calendarDisplayMode: TreeCalendarDisplayMode;
  siblingSortOrder: TreeSiblingSortOrder;
  showPrestigeBadges: boolean;
  poster: TreePosterSettings;
}

export interface TreeCardThemeDefinition {
  id: TreeCardThemeId;
  label: string;
  subtitle: string;
  isDarkSurface: boolean;
  canvasBg: string;
  canvasDot: string;
  canvasBorder: string;
  primaryHex: string;
  secondaryHex: string;
  goldAccentHex: string;
  cardFillHex: string;
  cardStrokeHex: string;
  textPrimaryHex: string;
  textMutedHex: string;
  recordKeeperCard: string;
  verticalCard: string;
  femaleCard: string;
  elderCard: string;
  defaultCard: string;
  nameText: string;
  accentText: string;
  metaText: string;
  actionBtn: string;
  plusBtn: string;
  connectorStrong: string;
  connectorSoft: string;
  connectorBorderDashed: string;
  connectorArrowStrong: string;
  connectorArrowSoft: string;
  kinshipBadge: string;
  leafFillStart: string;
  leafFillEnd: string;
  leafStroke: string;
  leafVein: string;
  leafKeepFillStart: string;
  leafKeepFillEnd: string;
  leafKeepStroke: string;
  leafFemaleFillStart: string;
  leafFemaleFillEnd: string;
  leafFemaleStroke: string;
  swatches: [string, string, string];
}

export const TREE_CARD_THEMES: Record<TreeCardThemeId, TreeCardThemeDefinition> = {
  heritage: {
    id: 'heritage',
    label: 'تراثي أصيل',
    subtitle: 'عاجي وطيني دافئ',
    isDarkSurface: false,
    canvasBg: '#FAF6F0',
    canvasDot: '#B98A78',
    canvasBorder: 'border-[#B98A78]/45',
    primaryHex: '#8D4925',
    secondaryHex: '#D8755B',
    goldAccentHex: '#C59B5F',
    cardFillHex: '#FFFDF9',
    cardStrokeHex: '#B98A78',
    textPrimaryHex: '#252321',
    textMutedHex: '#6F584B',
    recordKeeperCard:
      'bg-gradient-to-br from-[#FFFDF9] via-white to-[#FAF3E8] border-2 border-[#252321] ring-3 ring-[#D8755B]/20 shadow-md',
    verticalCard:
      'bg-gradient-to-br from-[#FFFDF9] to-[#F5EFE4] border-2 border-dashed border-[#8D4925]/70',
    femaleCard:
      'bg-gradient-to-br from-[#FFFDFB] to-[#FAF3EE] border-2 border-[#B98A78]/70',
    elderCard:
      'bg-gradient-to-br from-[#FAF6F0] to-[#EFE6D5] border-2 border-[#8D4925]/75',
    defaultCard:
      'bg-white border-2 border-[#B98A78]/55 hover:border-[#8D4925]',
    nameText: 'text-[#252321]',
    accentText: 'text-[#8D4925]',
    metaText: 'text-[#252321]/70',
    actionBtn:
      'bg-[#F7F2E9] hover:bg-[#D8755B] text-[#252321] hover:text-white',
    plusBtn: 'bg-[#D8755B] hover:bg-[#8D4925] text-white',
    connectorStrong: 'bg-[#8D4925]',
    connectorSoft: 'bg-[#8D4925]/75',
    connectorBorderDashed: 'border-[#8D4925]/70',
    connectorArrowStrong: 'text-[#8D4925]',
    connectorArrowSoft: 'text-[#8D4925]/75',
    kinshipBadge: 'bg-[#FAF6F0]/95 text-[#8D4925]',
    leafFillStart: '#F3F7EC',
    leafFillEnd: '#DCE8CE',
    leafStroke: '#658354',
    leafVein: '#4D6B3E',
    leafKeepFillStart: '#FFF9EC',
    leafKeepFillEnd: '#E7DFC5',
    leafKeepStroke: '#8D4925',
    leafFemaleFillStart: '#FDF6F1',
    leafFemaleFillEnd: '#F2E2D8',
    leafFemaleStroke: '#B98A78',
    swatches: ['#FAF6F0', '#8D4925', '#D8755B'],
  },
  emerald_gold: {
    id: 'emerald_gold',
    label: 'زمردي وذهبي',
    subtitle: 'أخضر ملكي ومذهب',
    isDarkSurface: false,
    canvasBg: '#F4F8F5',
    canvasDot: '#94B49F',
    canvasBorder: 'border-[#1B4332]/25',
    primaryHex: '#14532D',
    secondaryHex: '#2D6A4F',
    goldAccentHex: '#C5A059',
    cardFillHex: '#FFFFFF',
    cardStrokeHex: '#86A794',
    textPrimaryHex: '#0F2E1E',
    textMutedHex: '#2D5A43',
    recordKeeperCard:
      'bg-gradient-to-br from-[#FFFFFF] via-[#F4FAF6] to-[#E6F4EA] border-2 border-[#14532D] ring-3 ring-[#C5A059]/30 shadow-md',
    verticalCard:
      'bg-gradient-to-br from-[#FFFFFF] to-[#ECF5EF] border-2 border-dashed border-[#1B4332]/65',
    femaleCard:
      'bg-gradient-to-br from-[#FFFDF9] to-[#F7F2E7] border-2 border-[#C5A059]/80',
    elderCard:
      'bg-gradient-to-br from-[#F3F8F4] to-[#E4F0E8] border-2 border-[#1B4332]/70',
    defaultCard:
      'bg-white border-2 border-[#86A794]/65 hover:border-[#14532D]',
    nameText: 'text-[#0F2E1E]',
    accentText: 'text-[#14532D]',
    metaText: 'text-[#1E4631]/70',
    actionBtn:
      'bg-[#EDF5F0] hover:bg-[#14532D] text-[#14532D] hover:text-white',
    plusBtn: 'bg-[#14532D] hover:bg-[#0F3A20] text-[#F7E3A1]',
    connectorStrong: 'bg-[#14532D]',
    connectorSoft: 'bg-[#1B4332]/70',
    connectorBorderDashed: 'border-[#1B4332]/65',
    connectorArrowStrong: 'text-[#14532D]',
    connectorArrowSoft: 'text-[#1B4332]/70',
    kinshipBadge: 'bg-[#F4F8F5]/95 text-[#14532D]',
    leafFillStart: '#EFF8F1',
    leafFillEnd: '#CDE5D4',
    leafStroke: '#2D6A4F',
    leafVein: '#1B4332',
    leafKeepFillStart: '#F9FBF2',
    leafKeepFillEnd: '#DCEBD8',
    leafKeepStroke: '#14532D',
    leafFemaleFillStart: '#FCF9F0',
    leafFemaleFillEnd: '#F0E6CC',
    leafFemaleStroke: '#C5A059',
    swatches: ['#F4F8F5', '#14532D', '#C5A059'],
  },
  andalusian_navy: {
    id: 'andalusian_navy',
    label: 'أندلسي كحلي',
    subtitle: 'كحلي قرطبي وذهب',
    isDarkSurface: false,
    canvasBg: '#F4F6FA',
    canvasDot: '#94A3B8',
    canvasBorder: 'border-[#1E3A5F]/25',
    primaryHex: '#1E3A5F',
    secondaryHex: '#2E5680',
    goldAccentHex: '#C29B59',
    cardFillHex: '#FFFFFF',
    cardStrokeHex: '#94A3B8',
    textPrimaryHex: '#0F233D',
    textMutedHex: '#355070',
    recordKeeperCard:
      'bg-gradient-to-br from-[#FFFFFF] via-[#F4F7FB] to-[#E8EFF8] border-2 border-[#1E3A5F] ring-3 ring-[#C29B59]/30 shadow-md',
    verticalCard:
      'bg-gradient-to-br from-[#FFFFFF] to-[#EEF2F7] border-2 border-dashed border-[#1E3A5F]/65',
    femaleCard:
      'bg-gradient-to-br from-[#FFFDF9] to-[#F9F3EA] border-2 border-[#C29B59]/80',
    elderCard:
      'bg-gradient-to-br from-[#F2F5FA] to-[#E5ECF5] border-2 border-[#1E3A5F]/70',
    defaultCard:
      'bg-white border-2 border-[#94A3B8]/65 hover:border-[#1E3A5F]',
    nameText: 'text-[#0F233D]',
    accentText: 'text-[#1E3A5F]',
    metaText: 'text-[#1E3A5F]/70',
    actionBtn:
      'bg-[#EDF2F8] hover:bg-[#1E3A5F] text-[#1E3A5F] hover:text-white',
    plusBtn: 'bg-[#1E3A5F] hover:bg-[#152B47] text-[#F5D78E]',
    connectorStrong: 'bg-[#1E3A5F]',
    connectorSoft: 'bg-[#1E3A5F]/70',
    connectorBorderDashed: 'border-[#1E3A5F]/65',
    connectorArrowStrong: 'text-[#1E3A5F]',
    connectorArrowSoft: 'text-[#1E3A5F]/70',
    kinshipBadge: 'bg-[#F4F6FA]/95 text-[#1E3A5F]',
    leafFillStart: '#EEF4F9',
    leafFillEnd: '#D5E3F0',
    leafStroke: '#2E5680',
    leafVein: '#1E3A5F',
    leafKeepFillStart: '#F7F9FC',
    leafKeepFillEnd: '#DCE6F2',
    leafKeepStroke: '#1E3A5F',
    leafFemaleFillStart: '#FCF8F1',
    leafFemaleFillEnd: '#F2E5CF',
    leafFemaleStroke: '#C29B59',
    swatches: ['#F4F6FA', '#1E3A5F', '#C29B59'],
  },
  olive_sand: {
    id: 'olive_sand',
    label: 'زيتوني ورملي',
    subtitle: 'أوراق زيتون ورمال',
    isDarkSurface: false,
    canvasBg: '#F6F6EF',
    canvasDot: '#A8B18B',
    canvasBorder: 'border-[#4A5D23]/30',
    primaryHex: '#4A5D23',
    secondaryHex: '#6B7F3A',
    goldAccentHex: '#A67C52',
    cardFillHex: '#FFFFFF',
    cardStrokeHex: '#94A37A',
    textPrimaryHex: '#242F11',
    textMutedHex: '#4D5C2F',
    recordKeeperCard:
      'bg-gradient-to-br from-[#FFFFFF] via-[#F7F8F1] to-[#EAEEDB] border-2 border-[#3A4A1A] ring-3 ring-[#A67C52]/25 shadow-md',
    verticalCard:
      'bg-gradient-to-br from-[#FFFFFF] to-[#F1F3E8] border-2 border-dashed border-[#4A5D23]/65',
    femaleCard:
      'bg-gradient-to-br from-[#FFFDF9] to-[#F7F1E7] border-2 border-[#A67C52]/75',
    elderCard:
      'bg-gradient-to-br from-[#F5F7EC] to-[#E8EDD8] border-2 border-[#4A5D23]/70',
    defaultCard:
      'bg-white border-2 border-[#94A37A]/65 hover:border-[#4A5D23]',
    nameText: 'text-[#242F11]',
    accentText: 'text-[#4A5D23]',
    metaText: 'text-[#3D4B22]/70',
    actionBtn:
      'bg-[#EFF2E6] hover:bg-[#4A5D23] text-[#3A4A1A] hover:text-white',
    plusBtn: 'bg-[#4A5D23] hover:bg-[#354418] text-[#F5ECD7]',
    connectorStrong: 'bg-[#4A5D23]',
    connectorSoft: 'bg-[#4A5D23]/70',
    connectorBorderDashed: 'border-[#4A5D23]/65',
    connectorArrowStrong: 'text-[#4A5D23]',
    connectorArrowSoft: 'text-[#4A5D23]/70',
    kinshipBadge: 'bg-[#F6F6EF]/95 text-[#4A5D23]',
    leafFillStart: '#F2F6E8',
    leafFillEnd: '#D8E3BF',
    leafStroke: '#556B2F',
    leafVein: '#3A4A1A',
    leafKeepFillStart: '#FAFBF4',
    leafKeepFillEnd: '#E3E9CF',
    leafKeepStroke: '#3A4A1A',
    leafFemaleFillStart: '#FDF8F2',
    leafFemaleFillEnd: '#EFE2D1',
    leafFemaleStroke: '#A67C52',
    swatches: ['#F6F6EF', '#4A5D23', '#A67C52'],
  },
  royal_burgundy: {
    id: 'royal_burgundy',
    label: 'دمشقي عنابي',
    subtitle: 'عنابي دمشقي وذهب',
    isDarkSurface: false,
    canvasBg: '#FAF5F6',
    canvasDot: '#C49AA3',
    canvasBorder: 'border-[#6B1D2F]/25',
    primaryHex: '#6B1D2F',
    secondaryHex: '#8A3347',
    goldAccentHex: '#C59B5F',
    cardFillHex: '#FFFFFF',
    cardStrokeHex: '#B88994',
    textPrimaryHex: '#3B101A',
    textMutedHex: '#6E3240',
    recordKeeperCard:
      'bg-gradient-to-br from-[#FFFFFF] via-[#FDF7F8] to-[#F6E8EB] border-2 border-[#6B1D2F] ring-3 ring-[#C59B5F]/30 shadow-md',
    verticalCard:
      'bg-gradient-to-br from-[#FFFFFF] to-[#F7ECEF] border-2 border-dashed border-[#6B1D2F]/65',
    femaleCard:
      'bg-gradient-to-br from-[#FFFDF9] to-[#F8F0E5] border-2 border-[#C59B5F]/80',
    elderCard:
      'bg-gradient-to-br from-[#FAF3F4] to-[#EFE0E4] border-2 border-[#6B1D2F]/70',
    defaultCard:
      'bg-white border-2 border-[#B88994]/65 hover:border-[#6B1D2F]',
    nameText: 'text-[#3B101A]',
    accentText: 'text-[#6B1D2F]',
    metaText: 'text-[#5A1C2A]/70',
    actionBtn:
      'bg-[#F7ECEE] hover:bg-[#6B1D2F] text-[#6B1D2F] hover:text-white',
    plusBtn: 'bg-[#6B1D2F] hover:bg-[#501422] text-[#F7DFB3]',
    connectorStrong: 'bg-[#6B1D2F]',
    connectorSoft: 'bg-[#6B1D2F]/70',
    connectorBorderDashed: 'border-[#6B1D2F]/65',
    connectorArrowStrong: 'text-[#6B1D2F]',
    connectorArrowSoft: 'text-[#6B1D2F]/70',
    kinshipBadge: 'bg-[#FAF5F6]/95 text-[#6B1D2F]',
    leafFillStart: '#F9F1F3',
    leafFillEnd: '#EAD3D8',
    leafStroke: '#8A3347',
    leafVein: '#6B1D2F',
    leafKeepFillStart: '#FDF7F5',
    leafKeepFillEnd: '#F0DFD8',
    leafKeepStroke: '#6B1D2F',
    leafFemaleFillStart: '#FCF8F0',
    leafFemaleFillEnd: '#F0E3CC',
    leafFemaleStroke: '#C59B5F',
    swatches: ['#FAF5F6', '#6B1D2F', '#C59B5F'],
  },
  // =========================================================================
  // 5 NEW MUSEUM-GRADE THEMES (ISOLATED INSIDE TREE CANVAS & EXPORT)
  // =========================================================================
  royal_kiswah: {
    id: 'royal_kiswah',
    label: 'الكسوة الملكية',
    subtitle: 'أسود مخملي وذهب خالص',
    isDarkSurface: true,
    canvasBg: '#181614',
    canvasDot: '#5C4B2C',
    canvasBorder: 'border-[#D4AF37]/55',
    primaryHex: '#D4AF37',
    secondaryHex: '#E8C96F',
    goldAccentHex: '#F3D299',
    cardFillHex: '#231F1B',
    cardStrokeHex: '#D4AF37',
    textPrimaryHex: '#FAF3E3',
    textMutedHex: '#D6C4A1',
    recordKeeperCard:
      'bg-gradient-to-br from-[#2B251D] via-[#211D18] to-[#171411] border-2 border-[#E5C158] ring-3 ring-[#D4AF37]/35 shadow-lg',
    verticalCard:
      'bg-gradient-to-br from-[#25211C] to-[#1C1915] border-2 border-dashed border-[#D4AF37]/70',
    femaleCard:
      'bg-gradient-to-br from-[#2B2320] to-[#1F1A18] border-2 border-[#E2B577]/75',
    elderCard:
      'bg-gradient-to-br from-[#2A241A] to-[#1B1712] border-2 border-[#D4AF37]/80',
    defaultCard:
      'bg-[#221F1B] border-2 border-[#A6893F]/75 hover:border-[#F0CE6D]',
    nameText: 'text-[#FAF3E3]',
    accentText: 'text-[#F0CE6D]',
    metaText: 'text-[#DDD0B5]/80',
    actionBtn:
      'bg-[#332C22] hover:bg-[#D4AF37] text-[#F3D299] hover:text-[#181614]',
    plusBtn: 'bg-[#D4AF37] hover:bg-[#E8C96F] text-[#181614]',
    connectorStrong: 'bg-[#E5C158]',
    connectorSoft: 'bg-[#C49F45]/80',
    connectorBorderDashed: 'border-[#D4AF37]/75',
    connectorArrowStrong: 'text-[#F0CE6D]',
    connectorArrowSoft: 'text-[#C49F45]',
    kinshipBadge: 'bg-[#25201A]/95 text-[#F0CE6D]',
    leafFillStart: '#2E281F',
    leafFillEnd: '#1E1A14',
    leafStroke: '#D4AF37',
    leafVein: '#E5C158',
    leafKeepFillStart: '#3A3122',
    leafKeepFillEnd: '#221C14',
    leafKeepStroke: '#F0CE6D',
    leafFemaleFillStart: '#342A24',
    leafFemaleFillEnd: '#231C18',
    leafFemaleStroke: '#E2B577',
    swatches: ['#181614', '#D4AF37', '#FAF3E3'],
  },
  pearl_bronze: {
    id: 'pearl_bronze',
    label: 'اللؤلؤ والبرونز',
    subtitle: 'عاجي رخامي وبرونز دافئ',
    isDarkSurface: false,
    canvasBg: '#FBF9F6',
    canvasDot: '#CBB8A6',
    canvasBorder: 'border-[#A66E4E]/35',
    primaryHex: '#945B3C',
    secondaryHex: '#B67B59',
    goldAccentHex: '#C99B6B',
    cardFillHex: '#FFFFFF',
    cardStrokeHex: '#B88766',
    textPrimaryHex: '#2C221C',
    textMutedHex: '#6F584A',
    recordKeeperCard:
      'bg-gradient-to-br from-[#FFFFFF] via-[#FBF7F2] to-[#F3E8DC] border-2 border-[#8E5637] ring-3 ring-[#C99B6B]/30 shadow-md',
    verticalCard:
      'bg-gradient-to-br from-[#FFFFFF] to-[#F6EFE7] border-2 border-dashed border-[#A66E4E]/70',
    femaleCard:
      'bg-gradient-to-br from-[#FFFEFC] to-[#F8EEE6] border-2 border-[#C78F6B]/80',
    elderCard:
      'bg-gradient-to-br from-[#FAF5EF] to-[#EFE2D4] border-2 border-[#945B3C]/75',
    defaultCard:
      'bg-white border-2 border-[#C7A68F]/70 hover:border-[#945B3C]',
    nameText: 'text-[#2C221C]',
    accentText: 'text-[#8E5637]',
    metaText: 'text-[#5C4638]/75',
    actionBtn:
      'bg-[#F5ECE4] hover:bg-[#945B3C] text-[#8E5637] hover:text-white',
    plusBtn: 'bg-[#945B3C] hover:bg-[#75452B] text-[#FFF8F0]',
    connectorStrong: 'bg-[#945B3C]',
    connectorSoft: 'bg-[#B07A5B]/75',
    connectorBorderDashed: 'border-[#A66E4E]/70',
    connectorArrowStrong: 'text-[#945B3C]',
    connectorArrowSoft: 'text-[#B07A5B]',
    kinshipBadge: 'bg-[#FBF9F6]/95 text-[#8E5637]',
    leafFillStart: '#FAF5EE',
    leafFillEnd: '#EBDCC9',
    leafStroke: '#9E6647',
    leafVein: '#7D4C32',
    leafKeepFillStart: '#FFFDF8',
    leafKeepFillEnd: '#EFE0CD',
    leafKeepStroke: '#8E5637',
    leafFemaleFillStart: '#FDF8F4',
    leafFemaleFillEnd: '#F2E2D7',
    leafFemaleStroke: '#C78F6B',
    swatches: ['#FBF9F6', '#945B3C', '#D6B08C'],
  },
  papyrus_lapis: {
    id: 'papyrus_lapis',
    label: 'البردي واللازورد',
    subtitle: 'ورق بردي وأزرق لازوردي',
    isDarkSurface: false,
    canvasBg: '#F5EFE0',
    canvasDot: '#B4A17B',
    canvasBorder: 'border-[#1D4E89]/35',
    primaryHex: '#1D4E89',
    secondaryHex: '#2C6BB0',
    goldAccentHex: '#C59A3A',
    cardFillHex: '#FCF8EC',
    cardStrokeHex: '#3A6EA5',
    textPrimaryHex: '#142947',
    textMutedHex: '#475E7B',
    recordKeeperCard:
      'bg-gradient-to-br from-[#FFFDF5] via-[#F7F1DF] to-[#EAE0C5] border-2 border-[#1D4E89] ring-3 ring-[#C59A3A]/35 shadow-md',
    verticalCard:
      'bg-gradient-to-br from-[#FDF9ED] to-[#F1E7CE] border-2 border-dashed border-[#1D4E89]/70',
    femaleCard:
      'bg-gradient-to-br from-[#FFFDF7] to-[#F6EED9] border-2 border-[#C59A3A]/85',
    elderCard:
      'bg-gradient-to-br from-[#F7F0DB] to-[#EAE0C3] border-2 border-[#1D4E89]/75',
    defaultCard:
      'bg-[#FCF8EC] border-2 border-[#88A0BD]/80 hover:border-[#1D4E89]',
    nameText: 'text-[#142947]',
    accentText: 'text-[#1D4E89]',
    metaText: 'text-[#2D4768]/75',
    actionBtn:
      'bg-[#ECE4CD] hover:bg-[#1D4E89] text-[#1D4E89] hover:text-white',
    plusBtn: 'bg-[#1D4E89] hover:bg-[#143763] text-[#FCEAB8]',
    connectorStrong: 'bg-[#1D4E89]',
    connectorSoft: 'bg-[#2C6BB0]/75',
    connectorBorderDashed: 'border-[#1D4E89]/70',
    connectorArrowStrong: 'text-[#1D4E89]',
    connectorArrowSoft: 'text-[#2C6BB0]/80',
    kinshipBadge: 'bg-[#F5EFE0]/95 text-[#1D4E89]',
    leafFillStart: '#F3EEDB',
    leafFillEnd: '#DDD4B7',
    leafStroke: '#1D4E89',
    leafVein: '#163D6B',
    leafKeepFillStart: '#FAF4E2',
    leafKeepFillEnd: '#E7DCBA',
    leafKeepStroke: '#1D4E89',
    leafFemaleFillStart: '#FCF7E8',
    leafFemaleFillEnd: '#EFE3BE',
    leafFemaleStroke: '#C59A3A',
    swatches: ['#F5EFE0', '#1D4E89', '#C59A3A'],
  },
  diriyah_oasis: {
    id: 'diriyah_oasis',
    label: 'واحة الدرعية',
    subtitle: 'طيني نجدي وبني قهوة',
    isDarkSurface: false,
    canvasBg: '#F4ECE1',
    canvasDot: '#B6997D',
    canvasBorder: 'border-[#5C3A21]/35',
    primaryHex: '#5C3A21',
    secondaryHex: '#9C5E36',
    goldAccentHex: '#C89B63',
    cardFillHex: '#FBF7F1',
    cardStrokeHex: '#A67A56',
    textPrimaryHex: '#2E1D10',
    textMutedHex: '#6A4E39',
    recordKeeperCard:
      'bg-gradient-to-br from-[#FFFDF9] via-[#F7EFE4] to-[#EBDCCB] border-2 border-[#4A2D18] ring-3 ring-[#C89B63]/35 shadow-md',
    verticalCard:
      'bg-gradient-to-br from-[#FBF6EE] to-[#EFE3D2] border-2 border-dashed border-[#5C3A21]/70',
    femaleCard:
      'bg-gradient-to-br from-[#FFFDF9] to-[#F5E9DA] border-2 border-[#B3784C]/80',
    elderCard:
      'bg-gradient-to-br from-[#F4EAE0] to-[#E5D4C1] border-2 border-[#5C3A21]/75',
    defaultCard:
      'bg-[#FBF7F1] border-2 border-[#B79476]/75 hover:border-[#5C3A21]',
    nameText: 'text-[#2E1D10]',
    accentText: 'text-[#5C3A21]',
    metaText: 'text-[#5C3A21]/75',
    actionBtn:
      'bg-[#EFE3D4] hover:bg-[#5C3A21] text-[#5C3A21] hover:text-white',
    plusBtn: 'bg-[#5C3A21] hover:bg-[#3F2615] text-[#F5DEC0]',
    connectorStrong: 'bg-[#5C3A21]',
    connectorSoft: 'bg-[#8A5A37]/75',
    connectorBorderDashed: 'border-[#5C3A21]/70',
    connectorArrowStrong: 'text-[#5C3A21]',
    connectorArrowSoft: 'text-[#8A5A37]/80',
    kinshipBadge: 'bg-[#F4ECE1]/95 text-[#5C3A21]',
    leafFillStart: '#F3ECE0',
    leafFillEnd: '#E0D1BC',
    leafStroke: '#6D4529',
    leafVein: '#4A2D18',
    leafKeepFillStart: '#FAF4EA',
    leafKeepFillEnd: '#E8D9C3',
    leafKeepStroke: '#4A2D18',
    leafFemaleFillStart: '#FBF5EC',
    leafFemaleFillEnd: '#EEDBC6',
    leafFemaleStroke: '#B3784C',
    swatches: ['#F4ECE1', '#5C3A21', '#B3784C'],
  },
  manuscript_ink: {
    id: 'manuscript_ink',
    label: 'حبر المخطوطات',
    subtitle: 'أبيض ورقي وحبر داكن للطباعة',
    isDarkSurface: false,
    canvasBg: '#FFFFFF',
    canvasDot: '#CBD5E1',
    canvasBorder: 'border-[#3B2A20]/35',
    primaryHex: '#2B1F17',
    secondaryHex: '#594233',
    goldAccentHex: '#8A6D3B',
    cardFillHex: '#FFFFFF',
    cardStrokeHex: '#3B2A20',
    textPrimaryHex: '#1A130F',
    textMutedHex: '#524034',
    recordKeeperCard:
      'bg-white border-2 border-[#1A130F] ring-3 ring-[#8A6D3B]/30 shadow-md',
    verticalCard:
      'bg-[#FCFBF9] border-2 border-dashed border-[#3B2A20]/75',
    femaleCard:
      'bg-white border-2 border-[#7A5C44]/85',
    elderCard:
      'bg-[#FAF9F6] border-2 border-[#2B1F17]/85',
    defaultCard:
      'bg-white border-2 border-[#6B5A4E]/75 hover:border-[#1A130F]',
    nameText: 'text-[#1A130F]',
    accentText: 'text-[#3B2A20]',
    metaText: 'text-[#3B2A20]/75',
    actionBtn:
      'bg-[#F3F0EB] hover:bg-[#2B1F17] text-[#2B1F17] hover:text-white',
    plusBtn: 'bg-[#2B1F17] hover:bg-[#120D0A] text-[#F9F5EE]',
    connectorStrong: 'bg-[#1A130F]',
    connectorSoft: 'bg-[#4A382B]/80',
    connectorBorderDashed: 'border-[#2B1F17]/75',
    connectorArrowStrong: 'text-[#1A130F]',
    connectorArrowSoft: 'text-[#4A382B]',
    kinshipBadge: 'bg-white/95 text-[#2B1F17]',
    leafFillStart: '#FFFFFF',
    leafFillEnd: '#F2EFE9',
    leafStroke: '#2B1F17',
    leafVein: '#4A382B',
    leafKeepFillStart: '#FFFFFF',
    leafKeepFillEnd: '#EBE6DC',
    leafKeepStroke: '#1A130F',
    leafFemaleFillStart: '#FFFFFF',
    leafFemaleFillEnd: '#F5EFE7',
    leafFemaleStroke: '#7A5C44',
    swatches: ['#FFFFFF', '#2B1F17', '#8A6D3B'],
  },
};

export const TREE_AVATAR_STYLE_OPTIONS: Array<{
  id: TreeAvatarStyle;
  label: string;
  subtitle: string;
}> = [
  { id: 'heritage', label: 'تراثي', subtitle: 'عربي أصيل' },
  { id: 'gulf', label: 'خليجي', subtitle: 'شماغ وبشت' },
  { id: 'levantine', label: 'شامي', subtitle: 'طربوش وحطة' },
  { id: 'contemporary', label: 'معاصر', subtitle: 'حديث وأنيق' },
  { id: 'persian', label: 'فارسي', subtitle: 'قباء وعمامة' },
  { id: 'egyptian', label: 'مصري كلاسيكي', subtitle: 'أزهري وكلاسيكي وقور' },
  { id: 'maghrebi', label: 'مغاربي أندلسي', subtitle: 'جلباب وشاشية أندلسية' },
  {
    id: 'calligraphy_gold',
    label: 'حروفيات ذهبية (بدون وجوه)',
    subtitle: 'ختم هندسي مذهب باسم الفرد فقط',
  },
];

export const DEFAULT_POSTER_SETTINGS: TreePosterSettings = {
  paperSize: 'A3',
  borderStyle: 'islamic_gold',
  headerStyle: 'basmala_verse',
  customTitle: '',
  showLegend: true,
  showQrCode: true,
  showStampAndDates: true,
  inkSaverMode: false,
};

export const DEFAULT_TREE_DISPLAY_SETTINGS: TreeDisplaySettings = {
  defaultsSchemaVersion: TREE_DISPLAY_SETTINGS_SCHEMA_VERSION,
  cardTheme: 'diriyah_oasis',
  avatarStyle: 'heritage',
  fontFamily: 'cairo_modern',
  preferRealPhotos: true,
  femalePrivacyMode: 'full_name',
  showHonorific: true,
  showKunya: true,
  showDates: true,
  showKinshipArrows: true,
  layoutOrientation: 'vertical',
  nodeShape: 'card',
  cardDensity: 'detailed',
  connectorStyle: 'orthogonal',
  canvasBackground: 'marble',
  showGenerationBar: false,
  highlightDirectCompass: true,
  vitalStatusFilter: 'all',
  showDeceasedDignityFrame: true,
  spouseDisplayMode: 'always',
  calendarDisplayMode: 'dual',
  siblingSortOrder: 'birth_oldest',
  showPrestigeBadges: true,
  poster: { ...DEFAULT_POSTER_SETTINGS },
};

export function normalizeTreeDisplaySettings(
  raw: unknown
): TreeDisplaySettings {
  if (!raw || typeof raw !== 'object') {
    return {
      ...DEFAULT_TREE_DISPLAY_SETTINGS,
      poster: { ...DEFAULT_POSTER_SETTINGS },
    };
  }
  const p = raw as Partial<TreeDisplaySettings> & {
    poster?: Partial<TreePosterSettings>;
  };

  // Upgrade legacy auto-saved v1/v2 payloads cleanly to v3 museum defaults
  if (p.defaultsSchemaVersion !== TREE_DISPLAY_SETTINGS_SCHEMA_VERSION) {
    const customTitle =
      p.poster && typeof p.poster.customTitle === 'string'
        ? p.poster.customTitle.slice(0, 120)
        : '';
    return {
      ...DEFAULT_TREE_DISPLAY_SETTINGS,
      poster: {
        ...DEFAULT_POSTER_SETTINGS,
        customTitle,
      },
    };
  }

  const validAvatars = new Set<TreeAvatarStyle>([
    'heritage',
    'gulf',
    'levantine',
    'contemporary',
    'persian',
    'egyptian',
    'maghrebi',
    'calligraphy_gold',
  ]);

  const validLayouts = new Set<TreeLayoutOrientation>([
    'vertical',
    'sideways',
    'fan_180',
    'radial_360',
  ]);

  const validFonts = new Set<TreeArabicFontId>([
    'amiri',
    'noto_naskh',
    'cairo_modern',
    'ruqaa_festive',
  ]);

  const rawPoster: Partial<TreePosterSettings> =
    p.poster && typeof p.poster === 'object' ? p.poster : {};

  return {
    defaultsSchemaVersion: TREE_DISPLAY_SETTINGS_SCHEMA_VERSION,
    cardTheme:
      p.cardTheme && p.cardTheme in TREE_CARD_THEMES
        ? (p.cardTheme as TreeCardThemeId)
        : DEFAULT_TREE_DISPLAY_SETTINGS.cardTheme,
    avatarStyle:
      p.avatarStyle && validAvatars.has(p.avatarStyle)
        ? p.avatarStyle
        : DEFAULT_TREE_DISPLAY_SETTINGS.avatarStyle,
    fontFamily:
      p.fontFamily && validFonts.has(p.fontFamily)
        ? p.fontFamily
        : DEFAULT_TREE_DISPLAY_SETTINGS.fontFamily,
    preferRealPhotos:
      typeof p.preferRealPhotos === 'boolean'
        ? p.preferRealPhotos
        : DEFAULT_TREE_DISPLAY_SETTINGS.preferRealPhotos,
    femalePrivacyMode:
      p.femalePrivacyMode === 'kunya_only' ||
      p.femalePrivacyMode === 'hide_females' ||
      p.femalePrivacyMode === 'full_name'
        ? p.femalePrivacyMode
        : DEFAULT_TREE_DISPLAY_SETTINGS.femalePrivacyMode,
    showHonorific:
      typeof p.showHonorific === 'boolean'
        ? p.showHonorific
        : DEFAULT_TREE_DISPLAY_SETTINGS.showHonorific,
    showKunya:
      typeof p.showKunya === 'boolean'
        ? p.showKunya
        : DEFAULT_TREE_DISPLAY_SETTINGS.showKunya,
    showDates:
      typeof p.showDates === 'boolean'
        ? p.showDates
        : DEFAULT_TREE_DISPLAY_SETTINGS.showDates,
    showKinshipArrows:
      typeof p.showKinshipArrows === 'boolean'
        ? p.showKinshipArrows
        : DEFAULT_TREE_DISPLAY_SETTINGS.showKinshipArrows,
    layoutOrientation:
      p.layoutOrientation && validLayouts.has(p.layoutOrientation)
        ? p.layoutOrientation
        : DEFAULT_TREE_DISPLAY_SETTINGS.layoutOrientation,
    nodeShape:
      p.nodeShape === 'circle' ||
      p.nodeShape === 'leaf' ||
      p.nodeShape === 'card'
        ? p.nodeShape
        : DEFAULT_TREE_DISPLAY_SETTINGS.nodeShape,
    cardDensity:
      p.cardDensity === 'detailed' ||
      p.cardDensity === 'balanced' ||
      p.cardDensity === 'compact'
        ? p.cardDensity
        : DEFAULT_TREE_DISPLAY_SETTINGS.cardDensity,
    connectorStyle:
      p.connectorStyle === 'curved' ||
      p.connectorStyle === 'heritage_branch' ||
      p.connectorStyle === 'orthogonal'
        ? p.connectorStyle
        : DEFAULT_TREE_DISPLAY_SETTINGS.connectorStyle,
    canvasBackground:
      p.canvasBackground === 'dots' ||
      p.canvasBackground === 'parchment' ||
      p.canvasBackground === 'marble'
        ? p.canvasBackground
        : DEFAULT_TREE_DISPLAY_SETTINGS.canvasBackground,
    showGenerationBar:
      typeof p.showGenerationBar === 'boolean'
        ? p.showGenerationBar
        : DEFAULT_TREE_DISPLAY_SETTINGS.showGenerationBar,
    highlightDirectCompass:
      typeof p.highlightDirectCompass === 'boolean'
        ? p.highlightDirectCompass
        : DEFAULT_TREE_DISPLAY_SETTINGS.highlightDirectCompass,
    vitalStatusFilter:
      p.vitalStatusFilter === 'living' ||
      p.vitalStatusFilter === 'deceased' ||
      p.vitalStatusFilter === 'all'
        ? p.vitalStatusFilter
        : DEFAULT_TREE_DISPLAY_SETTINGS.vitalStatusFilter,
    showDeceasedDignityFrame:
      typeof p.showDeceasedDignityFrame === 'boolean'
        ? p.showDeceasedDignityFrame
        : DEFAULT_TREE_DISPLAY_SETTINGS.showDeceasedDignityFrame,
    spouseDisplayMode:
      p.spouseDisplayMode === 'on_select' ||
      p.spouseDisplayMode === 'hidden' ||
      p.spouseDisplayMode === 'always'
        ? p.spouseDisplayMode
        : DEFAULT_TREE_DISPLAY_SETTINGS.spouseDisplayMode,
    calendarDisplayMode:
      p.calendarDisplayMode === 'hijri' ||
      p.calendarDisplayMode === 'gregorian' ||
      p.calendarDisplayMode === 'dual'
        ? p.calendarDisplayMode
        : DEFAULT_TREE_DISPLAY_SETTINGS.calendarDisplayMode,
    siblingSortOrder:
      p.siblingSortOrder === 'added' || p.siblingSortOrder === 'birth_oldest'
        ? p.siblingSortOrder
        : DEFAULT_TREE_DISPLAY_SETTINGS.siblingSortOrder,
    showPrestigeBadges:
      typeof p.showPrestigeBadges === 'boolean'
        ? p.showPrestigeBadges
        : DEFAULT_TREE_DISPLAY_SETTINGS.showPrestigeBadges,
    poster: {
      paperSize:
        rawPoster.paperSize === 'A4' ||
        rawPoster.paperSize === 'A2_A1' ||
        rawPoster.paperSize === 'panorama'
          ? rawPoster.paperSize
          : 'A3',
      borderStyle:
        rawPoster.borderStyle === 'classic_double' ||
        rawPoster.borderStyle === 'modern_soft'
          ? rawPoster.borderStyle
          : 'islamic_gold',
      headerStyle:
        rawPoster.headerStyle === 'basmala_only' ||
        rawPoster.headerStyle === 'none'
          ? rawPoster.headerStyle
          : 'basmala_verse',
      customTitle:
        typeof rawPoster.customTitle === 'string'
          ? rawPoster.customTitle.slice(0, 120)
          : '',
      showLegend:
        typeof rawPoster.showLegend === 'boolean' ? rawPoster.showLegend : true,
      showQrCode:
        typeof rawPoster.showQrCode === 'boolean' ? rawPoster.showQrCode : true,
      showStampAndDates:
        typeof rawPoster.showStampAndDates === 'boolean'
          ? rawPoster.showStampAndDates
          : true,
      inkSaverMode:
        typeof rawPoster.inkSaverMode === 'boolean'
          ? rawPoster.inkSaverMode
          : false,
    },
  };
}

export const TREE_QUICK_PRESETS: Array<{
  id: TreeQuickPresetId;
  label: string;
  description: string;
  patch: (current: TreeDisplaySettings) => TreeDisplaySettings;
}> = [
  {
    id: 'quick_edit',
    label: 'وضع التحرير السريع',
    description: 'بطاقات مضغوطة، شبكة نقطية واضحة وتنقل سريع للتعديل',
    patch: (cur) => ({
      ...cur,
      layoutOrientation: 'vertical',
      nodeShape: 'card',
      cardDensity: 'compact',
      connectorStyle: 'orthogonal',
      canvasBackground: 'dots',
      showGenerationBar: true,
      showDates: false,
      showKinshipArrows: true,
      cardTheme: 'heritage',
    }),
  },
  {
    id: 'luxury_family',
    label: 'وضع العرض العائلي الفاخر',
    description: 'بطاقات مفصّلة على رقّ مخطوطة مع إبراز بوصلة المسار الشخصي',
    patch: (cur) => ({
      ...cur,
      layoutOrientation: 'vertical',
      nodeShape: 'card',
      cardDensity: 'detailed',
      connectorStyle: 'heritage_branch',
      canvasBackground: 'parchment',
      showGenerationBar: true,
      highlightDirectCompass: true,
      showHonorific: true,
      showKunya: true,
      showDates: true,
      showDeceasedDignityFrame: true,
      cardTheme: 'emerald_gold',
    }),
  },
  {
    id: 'wall_poster',
    label: 'وضع البوستر الجداري للطباعة',
    description: 'مقاس A2/A1 مذهّب بحبر واضح وباركود ومفتاح دلالات للطباعة',
    patch: (cur) => ({
      ...cur,
      layoutOrientation: 'fan_180',
      cardDensity: 'balanced',
      canvasBackground: 'parchment',
      showGenerationBar: true,
      showHonorific: true,
      showKunya: true,
      showDates: true,
      cardTheme: 'papyrus_lapis',
      poster: {
        ...cur.poster,
        paperSize: 'A2_A1',
        borderStyle: 'islamic_gold',
        headerStyle: 'basmala_verse',
        showLegend: true,
        showQrCode: true,
        showStampAndDates: true,
        inkSaverMode: false,
      },
    }),
  },
];

// ============================================================================
// HIJRI <-> GREGORIAN YEAR FORMATTER (Clean deterministic approximation)
// ============================================================================
const ARABIC_INDIC_MAP: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
};

function toWesternDigits(input: string): string {
  return input.replace(/[٠-٩]/g, (d) => ARABIC_INDIC_MAP[d] ?? d);
}

export function convertYearBetweenCalendars(
  year: number,
  from: 'hijri' | 'gregorian',
  to: 'hijri' | 'gregorian'
): number {
  if (from === to) return year;
  if (from === 'gregorian' && to === 'hijri') {
    return Math.round((year - 622) * (33 / 32));
  }
  return Math.round(year * (32 / 33) + 622);
}

export function formatTreeDateByCalendarMode(
  rawDateValue: string | undefined,
  sourceCalendar: 'hijri' | 'gregorian' | undefined,
  displayMode: TreeCalendarDisplayMode
): string {
  const clean = (rawDateValue || '').trim();
  if (!clean) return '';

  const normalized = toWesternDigits(clean);
  const yearMatch = normalized.match(/\b(\d{3,4})\b/);
  const srcCal: 'hijri' | 'gregorian' =
    sourceCalendar === 'hijri' ? 'hijri' : 'gregorian';

  if (!yearMatch) {
    return `${clean} ${srcCal === 'hijri' ? 'هـ' : 'م'}`;
  }

  const parsedYear = Number(yearMatch[1]);
  if (!Number.isFinite(parsedYear) || parsedYear < 100 || parsedYear > 2500) {
    return `${clean} ${srcCal === 'hijri' ? 'هـ' : 'م'}`;
  }

  if (displayMode === 'hijri') {
    const hYear = convertYearBetweenCalendars(parsedYear, srcCal, 'hijri');
    return `${hYear} هـ`;
  }
  if (displayMode === 'gregorian') {
    const gYear = convertYearBetweenCalendars(parsedYear, srcCal, 'gregorian');
    return `${gYear} م`;
  }

  const hYear = convertYearBetweenCalendars(parsedYear, srcCal, 'hijri');
  const gYear = convertYearBetweenCalendars(parsedYear, srcCal, 'gregorian');
  return `${hYear} هـ / ${gYear} م`;
}

export interface SingleCalendarDateDisplay {
  /** Single-calendar concise string for card pedestal (never dual-calendar clutter) */
  primaryText: string;
  /** Hover tooltip showing the equivalent year(s) in the alternate calendar */
  alternateTooltip: string;
}

/**
 * Formats birth/death dates for tree cards strictly in ONE calendar system
 * (preferred display calendar, or the person's entered calendar when mode is 'dual')
 * while computing the alternate calendar string for a clean hover tooltip.
 */
export function formatCardSingleCalendarVitalDates(
  birthDateValue: string | undefined,
  deathDateValue: string | undefined,
  sourceCalendar: 'hijri' | 'gregorian' | undefined,
  displayMode: TreeCalendarDisplayMode,
  birthPrecision?: 'year_only' | 'full_date' | 'approximate' | 'era'
): SingleCalendarDateDisplay | null {
  const cleanBirth = (birthDateValue || '').trim();
  const cleanDeath = (deathDateValue || '').trim();
  if (!cleanBirth && !cleanDeath) return null;

  const srcCal: 'hijri' | 'gregorian' =
    sourceCalendar === 'hijri' ? 'hijri' : 'gregorian';
  const targetCal: 'hijri' | 'gregorian' =
    displayMode === 'hijri'
      ? 'hijri'
      : displayMode === 'gregorian'
      ? 'gregorian'
      : srcCal;
  const altCal: 'hijri' | 'gregorian' =
    targetCal === 'hijri' ? 'gregorian' : 'hijri';

  const targetSuffix = targetCal === 'hijri' ? 'هـ' : 'م';
  const altSuffix = altCal === 'hijri' ? 'هـ' : 'م';

  const extractYear = (raw: string): number | null => {
    const normalized = toWesternDigits(raw);
    const match = normalized.match(/\b(\d{3,4})\b/);
    if (!match) return null;
    const yr = Number(match[1]);
    return Number.isFinite(yr) && yr >= 100 && yr <= 2500 ? yr : null;
  };

  const birthYear = cleanBirth ? extractYear(cleanBirth) : null;
  const deathYear = cleanDeath ? extractYear(cleanDeath) : null;

  const precPrefix =
    birthPrecision === 'approximate'
      ? 'قرابة '
      : birthPrecision === 'era'
      ? 'حقبة '
      : '';

  if (birthYear !== null && deathYear !== null) {
    const bTarget = convertYearBetweenCalendars(birthYear, srcCal, targetCal);
    const dTarget = convertYearBetweenCalendars(deathYear, srcCal, targetCal);
    const bAlt = convertYearBetweenCalendars(birthYear, srcCal, altCal);
    const dAlt = convertYearBetweenCalendars(deathYear, srcCal, altCal);
    return {
      primaryText: `${precPrefix}${bTarget}–${dTarget} ${targetSuffix}`,
      alternateTooltip: `الموافق: ${bAlt}–${dAlt} ${altSuffix}`,
    };
  }

  if (birthYear !== null) {
    const bTarget = convertYearBetweenCalendars(birthYear, srcCal, targetCal);
    const bAlt = convertYearBetweenCalendars(birthYear, srcCal, altCal);
    return {
      primaryText: `${precPrefix}${bTarget} ${targetSuffix}`,
      alternateTooltip: `الموافق: ${bAlt} ${altSuffix}`,
    };
  }

  if (deathYear !== null) {
    const dTarget = convertYearBetweenCalendars(deathYear, srcCal, targetCal);
    const dAlt = convertYearBetweenCalendars(deathYear, srcCal, altCal);
    return {
      primaryText: `ت ${dTarget} ${targetSuffix}`,
      alternateTooltip: `الوفاة — الموافق: ${dAlt} ${altSuffix}`,
    };
  }

  const fallbackRaw = cleanBirth || cleanDeath;
  return {
    primaryText: `${precPrefix}${fallbackRaw} ${targetSuffix}`,
    alternateTooltip: `${fallbackRaw} ${targetSuffix}`,
  };
}

// ============================================================================
// DETERMINISTIC OFFLINE QR-STYLE MATRIX (ZERO EXTERNAL CDN DEPENDENCY)
// ============================================================================
export function buildDeterministicQrMatrix(
  payload: string,
  size = 21
): boolean[][] {
  const grid: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false)
  );
  const reserved: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false)
  );

  const stampFinder = (row0: number, col0: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = row0 + r;
        const cc = col0 + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        reserved[rr][cc] = true;
        if (r === -1 || r === 7 || c === -1 || c === 7) {
          grid[rr][cc] = false;
        } else if (
          r === 0 ||
          r === 6 ||
          c === 0 ||
          c === 6 ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        ) {
          grid[rr][cc] = true;
        } else {
          grid[rr][cc] = false;
        }
      }
    }
  };

  stampFinder(0, 0);
  stampFinder(0, size - 7);
  stampFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    reserved[6][i] = true;
    grid[6][i] = i % 2 === 0;
    reserved[i][6] = true;
    grid[i][6] = i % 2 === 0;
  }

  // Deterministic FNV-1a bit stream from payload
  let seed = 2166136261;
  const text = payload || 'https://juthori.com';
  for (let i = 0; i < text.length; i++) {
    seed ^= text.charCodeAt(i);
    seed = Math.imul(seed, 16777619) >>> 0;
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (reserved[r][c]) continue;
      seed ^= (r * 31 + c * 17 + text.charCodeAt((r + c) % text.length)) >>> 0;
      seed = Math.imul(seed, 16777619) >>> 0;
      grid[r][c] = (seed & 3) === 0 || (seed & 7) === 5;
    }
  }

  return grid;
}

export function getTreeCanvasBackgroundStyle(
  theme: TreeCardThemeDefinition,
  bgMode: TreeCanvasBackground
): CSSProperties {
  if (bgMode === 'marble') {
    return {
      backgroundColor: theme.isDarkSurface ? '#151311' : '#FCFBF9',
      backgroundImage: theme.isDarkSurface
        ? 'radial-gradient(ellipse at 20% 20%, rgba(212,175,55,0.08), transparent 55%), radial-gradient(ellipse at 85% 75%, rgba(255,255,255,0.04), transparent 50%)'
        : `radial-gradient(ellipse at 18% 18%, ${theme.primaryHex}0A, transparent 58%), radial-gradient(ellipse at 82% 80%, ${theme.goldAccentHex}12, transparent 55%)`,
    };
  }
  if (bgMode === 'parchment') {
    const base = theme.isDarkSurface ? '#1B1814' : theme.canvasBg;
    return {
      backgroundColor: base,
      backgroundImage: theme.isDarkSurface
        ? 'repeating-linear-gradient(45deg, rgba(212,175,55,0.03) 0px, rgba(212,175,55,0.03) 2px, transparent 2px, transparent 14px), radial-gradient(circle at 50% 0%, rgba(212,175,55,0.09), transparent 65%)'
        : `radial-gradient(circle at 50% 0%, ${theme.goldAccentHex}20, transparent 62%), repeating-linear-gradient(0deg, ${theme.primaryHex}07 0px, ${theme.primaryHex}07 1px, transparent 1px, transparent 28px), radial-gradient(${theme.canvasDot}44 0.8px, transparent 0.8px)`,
      backgroundSize: '100% 100%, 100% 28px, 22px 22px',
    };
  }
  return {
    backgroundColor: theme.canvasBg,
    backgroundImage: `radial-gradient(${theme.canvasDot} 1.15px, transparent 1.15px)`,
    backgroundSize: '24px 24px',
  };
}
