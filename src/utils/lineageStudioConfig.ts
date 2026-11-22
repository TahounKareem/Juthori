import React from 'react';
import { UpperAncestorNode } from '../types/juthori';

export type LineageViewMode =
  | 'royal_pillar'
  | 'heritage_scroll'
  | 'panoramic_flow'
  | 'compact_medallions';

export type LineageDirection = 'top_down' | 'bottom_up';

export type LineageThemeId =
  | 'golden_parchment'
  | 'andalusian_emerald'
  | 'sultanic_burgundy'
  | 'diriyah_oasis'
  | 'royal_navy_gold';

export type LineageFontId = 'amiri' | 'classical' | 'modern';

export type LineageBackdropId =
  | 'ornate_parchment'
  | 'soft_geometric'
  | 'clean_marble';

export interface LineageStudioPrefs {
  viewMode: LineageViewMode;
  direction: LineageDirection;
  themeId: LineageThemeId;
  fontId: LineageFontId;
  backdropId: LineageBackdropId;
  showNasabStrip: boolean;
}

export const DEFAULT_LINEAGE_STUDIO_PREFS: LineageStudioPrefs = {
  viewMode: 'royal_pillar',
  direction: 'top_down',
  themeId: 'golden_parchment',
  fontId: 'amiri',
  backdropId: 'ornate_parchment',
  showNasabStrip: true,
};

export interface LineageThemePalette {
  id: LineageThemeId;
  label: string;
  subtitle: string;
  isDark: boolean;
  swatchPrimary: string;
  swatchSecondary: string;
  swatchGold: string;
  canvasBg: string;
  canvasBgGradient: string;
  canvasBorder: string;
  surfaceBg: string;
  surfaceAltBg: string;
  surfaceBorder: string;
  surfaceHoverBorder: string;
  accentHex: string;
  accentSoftBg: string;
  accentTextHex: string;
  goldHex: string;
  goldSoftBg: string;
  goldBorderHex: string;
  textPrimaryHex: string;
  textSecondaryHex: string;
  textMutedHex: string;
  railGradient: string;
  patternStrokeHex: string;
  patternOpacity: number;
  summitBg: string;
  summitText: string;
  summitSubtext: string;
  summitBorder: string;
  rootBg: string;
  rootBorder: string;
  rootAccent: string;
  directFamilyBg: string;
  directFamilyBorder: string;
  directFamilyAccent: string;
  keeperBg: string;
  keeperBorder: string;
  keeperAccent: string;
  connectorBg: string;
  connectorBorder: string;
  connectorText: string;
  statusBg: string;
  statusBorder: string;
  statusText: string;
  buttonPrimaryBg: string;
  buttonPrimaryHoverBg: string;
  buttonPrimaryText: string;
}

export const LINEAGE_THEMES: Record<LineageThemeId, LineageThemePalette> = {
  golden_parchment: {
    id: 'golden_parchment',
    label: 'رقّ المخطوط الذهبي',
    subtitle: 'عاجي دافئ وذهب عتيق',
    isDark: false,
    swatchPrimary: '#FAF4E8',
    swatchSecondary: '#8D4925',
    swatchGold: '#C9A243',
    canvasBg: '#F9F3E7',
    canvasBgGradient:
      'linear-gradient(180deg, #FBF7EE 0%, #F6EFE0 52%, #F9F3E7 100%)',
    canvasBorder: '#DFC99B',
    surfaceBg: '#FFFDF9',
    surfaceAltBg: '#FAF4E8',
    surfaceBorder: '#DECBA8',
    surfaceHoverBorder: '#B78334',
    accentHex: '#8D4925',
    accentSoftBg: 'rgba(141, 73, 37, 0.08)',
    accentTextHex: '#7A3E1E',
    goldHex: '#C59A38',
    goldSoftBg: '#FBF3DF',
    goldBorderHex: '#D4AF37',
    textPrimaryHex: '#231D17',
    textSecondaryHex: '#4E4136',
    textMutedHex: '#736150',
    railGradient:
      'linear-gradient(180deg, rgba(197,154,56,0.25) 0%, rgba(197,154,56,0.85) 50%, rgba(141,73,37,0.45) 100%)',
    patternStrokeHex: '#B68D40',
    patternOpacity: 0.075,
    summitBg: 'linear-gradient(135deg, #2C2117 0%, #412E1D 55%, #2C2117 100%)',
    summitText: '#FFFBF2',
    summitSubtext: '#F3D28B',
    summitBorder: '#D4AF37',
    rootBg: 'linear-gradient(135deg, #FFFDF8 0%, #FDF4E0 100%)',
    rootBorder: '#C89B3C',
    rootAccent: '#9A631A',
    directFamilyBg: 'linear-gradient(135deg, #FFFDF7 0%, #FBF1DA 100%)',
    directFamilyBorder: '#C99732',
    directFamilyAccent: '#8A5616',
    keeperBg: 'linear-gradient(135deg, #FFFFFF 0%, #F8F1E3 100%)',
    keeperBorder: '#8D4925',
    keeperAccent: '#8D4925',
    connectorBg: '#FFFDF8',
    connectorBorder: '#D8BD85',
    connectorText: '#7D4B1B',
    statusBg: '#EEF6F0',
    statusBorder: '#B9DEC5',
    statusText: '#14532D',
    buttonPrimaryBg: '#8D4925',
    buttonPrimaryHoverBg: '#733A1C',
    buttonPrimaryText: '#FFFBF2',
  },
  andalusian_emerald: {
    id: 'andalusian_emerald',
    label: 'الزمرد الأندلسي',
    subtitle: 'رخام زمردي ومذهّب هادئ',
    isDark: false,
    swatchPrimary: '#EFF5F1',
    swatchSecondary: '#0F5132',
    swatchGold: '#C59B38',
    canvasBg: '#F1F6F2',
    canvasBgGradient:
      'linear-gradient(180deg, #F5F9F6 0%, #ECF3EE 52%, #F2F6F3 100%)',
    canvasBorder: '#BDD3C4',
    surfaceBg: '#FCFDFC',
    surfaceAltBg: '#EFF5F1',
    surfaceBorder: '#C6D9CC',
    surfaceHoverBorder: '#0F5132',
    accentHex: '#0F5132',
    accentSoftBg: 'rgba(15, 81, 50, 0.08)',
    accentTextHex: '#0D452A',
    goldHex: '#C29636',
    goldSoftBg: '#F9F3E1',
    goldBorderHex: '#C9A144',
    textPrimaryHex: '#13241B',
    textSecondaryHex: '#354F41',
    textMutedHex: '#567062',
    railGradient:
      'linear-gradient(180deg, rgba(15,81,50,0.25) 0%, rgba(194,150,54,0.85) 50%, rgba(15,81,50,0.45) 100%)',
    patternStrokeHex: '#1C6B46',
    patternOpacity: 0.065,
    summitBg: 'linear-gradient(135deg, #0D3523 0%, #154E35 55%, #0C2F1F 100%)',
    summitText: '#F7FBF8',
    summitSubtext: '#F0D58C',
    summitBorder: '#C9A144',
    rootBg: 'linear-gradient(135deg, #FFFFFF 0%, #EFF7F1 100%)',
    rootBorder: '#C29636',
    rootAccent: '#0F5132',
    directFamilyBg: 'linear-gradient(135deg, #FFFEFA 0%, #F7F1DE 100%)',
    directFamilyBorder: '#C29636',
    directFamilyAccent: '#0F5132',
    keeperBg: 'linear-gradient(135deg, #FFFFFF 0%, #EDF5F0 100%)',
    keeperBorder: '#0F5132',
    keeperAccent: '#0F5132',
    connectorBg: '#FCFDFC',
    connectorBorder: '#B7D1BF',
    connectorText: '#0F5132',
    statusBg: '#E6F4EC',
    statusBorder: '#A9D5BB',
    statusText: '#0D452A',
    buttonPrimaryBg: '#0F5132',
    buttonPrimaryHoverBg: '#0A3D25',
    buttonPrimaryText: '#F8FBF9',
  },
  sultanic_burgundy: {
    id: 'sultanic_burgundy',
    label: 'العنابي السلطاني',
    subtitle: 'عاجي وعنابي ديواني مذهّب',
    isDark: false,
    swatchPrimary: '#FAF3F2',
    swatchSecondary: '#6E1E31',
    swatchGold: '#C89C3C',
    canvasBg: '#F9F2F0',
    canvasBgGradient:
      'linear-gradient(180deg, #FCF7F6 0%, #F5EAE7 52%, #FAF3F1 100%)',
    canvasBorder: '#DFC0B9',
    surfaceBg: '#FFFDFC',
    surfaceAltBg: '#F8EFEA',
    surfaceBorder: '#DFC5BE',
    surfaceHoverBorder: '#6E1E31',
    accentHex: '#6E1E31',
    accentSoftBg: 'rgba(110, 30, 49, 0.08)',
    accentTextHex: '#61182A',
    goldHex: '#C59A3B',
    goldSoftBg: '#FBF3E2',
    goldBorderHex: '#CE9F3E',
    textPrimaryHex: '#251519',
    textSecondaryHex: '#54383F',
    textMutedHex: '#785B62',
    railGradient:
      'linear-gradient(180deg, rgba(110,30,49,0.28) 0%, rgba(200,156,60,0.85) 50%, rgba(110,30,49,0.45) 100%)',
    patternStrokeHex: '#84293E',
    patternOpacity: 0.06,
    summitBg: 'linear-gradient(135deg, #4B1220 0%, #6E1E31 55%, #420F1B 100%)',
    summitText: '#FFF9F8',
    summitSubtext: '#F5D58E',
    summitBorder: '#D4AF37',
    rootBg: 'linear-gradient(135deg, #FFFDFC 0%, #FDF2EE 100%)',
    rootBorder: '#C89C3C',
    rootAccent: '#6E1E31',
    directFamilyBg: 'linear-gradient(135deg, #FFFDF9 0%, #FAF0DD 100%)',
    directFamilyBorder: '#C89C3C',
    directFamilyAccent: '#6E1E31',
    keeperBg: 'linear-gradient(135deg, #FFFFFF 0%, #F9EEEC 100%)',
    keeperBorder: '#6E1E31',
    keeperAccent: '#6E1E31',
    connectorBg: '#FFFDFC',
    connectorBorder: '#DCB8B0',
    connectorText: '#6E1E31',
    statusBg: '#F4ECE2',
    statusBorder: '#D7B98A',
    statusText: '#6B3E16',
    buttonPrimaryBg: '#6E1E31',
    buttonPrimaryHoverBg: '#571625',
    buttonPrimaryText: '#FFF9F7',
  },
  diriyah_oasis: {
    id: 'diriyah_oasis',
    label: 'واحة الدرعية',
    subtitle: 'طين نجدي دافئ وذهب أصيل',
    isDark: false,
    swatchPrimary: '#F5EEE2',
    swatchSecondary: '#7B4B28',
    swatchGold: '#B88930',
    canvasBg: '#F4ECE0',
    canvasBgGradient:
      'linear-gradient(180deg, #F8F2E8 0%, #EFE5D5 52%, #F5EEE2 100%)',
    canvasBorder: '#D6C2A3',
    surfaceBg: '#FFFCF6',
    surfaceAltBg: '#F5ECE0',
    surfaceBorder: '#D9C5A8',
    surfaceHoverBorder: '#7B4B28',
    accentHex: '#7B4B28',
    accentSoftBg: 'rgba(123, 75, 40, 0.09)',
    accentTextHex: '#693E1F',
    goldHex: '#B6862C',
    goldSoftBg: '#F9F0DA',
    goldBorderHex: '#C5983E',
    textPrimaryHex: '#241B14',
    textSecondaryHex: '#514134',
    textMutedHex: '#725E4E',
    railGradient:
      'linear-gradient(180deg, rgba(123,75,40,0.3) 0%, rgba(182,134,44,0.85) 50%, rgba(123,75,40,0.45) 100%)',
    patternStrokeHex: '#8E5B32',
    patternOpacity: 0.07,
    summitBg: 'linear-gradient(135deg, #3D2818 0%, #5B3B22 55%, #342113 100%)',
    summitText: '#FFFBF3',
    summitSubtext: '#F2D086',
    summitBorder: '#C5983E',
    rootBg: 'linear-gradient(135deg, #FFFCF7 0%, #F7ECDA 100%)',
    rootBorder: '#B6862C',
    rootAccent: '#7B4B28',
    directFamilyBg: 'linear-gradient(135deg, #FFFCF6 0%, #F7EBD5 100%)',
    directFamilyBorder: '#C5983E',
    directFamilyAccent: '#7B4B28',
    keeperBg: 'linear-gradient(135deg, #FFFFFF 0%, #F4EADD 100%)',
    keeperBorder: '#7B4B28',
    keeperAccent: '#7B4B28',
    connectorBg: '#FFFCF6',
    connectorBorder: '#D2BA97',
    connectorText: '#7B4B28',
    statusBg: '#EAF3EC',
    statusBorder: '#B3D5BC',
    statusText: '#1A4E2C',
    buttonPrimaryBg: '#7B4B28',
    buttonPrimaryHoverBg: '#623A1E',
    buttonPrimaryText: '#FFFBF3',
  },
  royal_navy_gold: {
    id: 'royal_navy_gold',
    label: 'الكحلي المذهّب الملكي',
    subtitle: 'ليلي ملكي ومخطوط ذهبي',
    isDark: true,
    swatchPrimary: '#111E33',
    swatchSecondary: '#1E3454',
    swatchGold: '#E4BF69',
    canvasBg: '#0E192B',
    canvasBgGradient:
      'linear-gradient(180deg, #111F36 0%, #0C1626 52%, #101D32 100%)',
    canvasBorder: '#2C4366',
    surfaceBg: '#16253D',
    surfaceAltBg: '#1B2D4A',
    surfaceBorder: '#2F486E',
    surfaceHoverBorder: '#E4BF69',
    accentHex: '#E4BF69',
    accentSoftBg: 'rgba(228, 191, 105, 0.14)',
    accentTextHex: '#F3D68D',
    goldHex: '#E4BF69',
    goldSoftBg: 'rgba(228, 191, 105, 0.13)',
    goldBorderHex: '#D4AC51',
    textPrimaryHex: '#F8F4EA',
    textSecondaryHex: '#D4DCE8',
    textMutedHex: '#9FB0C8',
    railGradient:
      'linear-gradient(180deg, rgba(228,191,105,0.22) 0%, rgba(228,191,105,0.88) 50%, rgba(228,191,105,0.28) 100%)',
    patternStrokeHex: '#E4BF69',
    patternOpacity: 0.085,
    summitBg: 'linear-gradient(135deg, #1E3252 0%, #274066 55%, #172740 100%)',
    summitText: '#FFFBF0',
    summitSubtext: '#F5D88E',
    summitBorder: '#E4BF69',
    rootBg: 'linear-gradient(135deg, #182944 0%, #213657 100%)',
    rootBorder: '#D4AC51',
    rootAccent: '#F3D68D',
    directFamilyBg: 'linear-gradient(135deg, #1A2C48 0%, #243958 100%)',
    directFamilyBorder: '#E4BF69',
    directFamilyAccent: '#F3D68D',
    keeperBg: 'linear-gradient(135deg, #182944 0%, #1F3454 100%)',
    keeperBorder: '#E4BF69',
    keeperAccent: '#F3D68D',
    connectorBg: '#16253D',
    connectorBorder: '#3C5982',
    connectorText: '#F3D68D',
    statusBg: 'rgba(228, 191, 105, 0.14)',
    statusBorder: 'rgba(228, 191, 105, 0.42)',
    statusText: '#F6DD9C',
    buttonPrimaryBg: '#C89F43',
    buttonPrimaryHoverBg: '#B38B32',
    buttonPrimaryText: '#0E192B',
  },
};

export interface LineageFontDefinition {
  id: LineageFontId;
  label: string;
  sampleText: string;
  cssFamily: string;
  canvasFontName: string;
}

export const LINEAGE_FONTS: Record<LineageFontId, LineageFontDefinition> = {
  amiri: {
    id: 'amiri',
    label: 'النسخ التراثي الأصيل (Amiri)',
    sampleText: 'عمود نسبٍ أصيل',
    cssFamily: "'Amiri', 'Noto Naskh Arabic', Georgia, serif",
    canvasFontName: 'Amiri',
  },
  classical: {
    id: 'classical',
    label: 'الكلاسيكي الوقور (Scheherazade)',
    sampleText: 'عمود نسبٍ أصيل',
    cssFamily: "'Scheherazade New', 'Aref Ruqaa', 'Amiri', serif",
    canvasFontName: 'Scheherazade New',
  },
  modern: {
    id: 'modern',
    label: 'العصري الهندسي الواضح (Cairo)',
    sampleText: 'عمود نسبٍ أصيل',
    cssFamily: "'Cairo', 'Readex Pro', 'IBM Plex Sans Arabic', sans-serif",
    canvasFontName: 'Cairo',
  },
};

export interface LineageViewModeOption {
  id: LineageViewMode;
  label: string;
  shortDesc: string;
}

export const LINEAGE_VIEW_MODE_OPTIONS: LineageViewModeOption[] = [
  {
    id: 'royal_pillar',
    label: 'المسبحة العمودية الملكية',
    shortDesc: 'عمود مذهّب فخم مزدوج القضبان',
  },
  {
    id: 'heritage_scroll',
    label: 'صك وإجازة النسب التراثية',
    shortDesc: 'مخطوطة نسب بإطار وختم رسمي',
  },
  {
    id: 'panoramic_flow',
    label: 'المسار البانورامي الأفقي',
    shortDesc: 'عرض أفقي ممتد من اليمين لليسار',
  },
  {
    id: 'compact_medallions',
    label: 'البطاقات المدمجة الرشيقة',
    shortDesc: 'نظرة شاملة للشجرة في شاشة واحدة',
  },
];

export interface LineageBackdropOption {
  id: LineageBackdropId;
  label: string;
}

export const LINEAGE_BACKDROP_OPTIONS: LineageBackdropOption[] = [
  { id: 'ornate_parchment', label: 'رقّ تراثي مزخرف' },
  { id: 'soft_geometric', label: 'نسيج هندسي ناعم' },
  { id: 'clean_marble', label: 'رخامي صافي' },
];

export function getLineageTheme(themeId?: LineageThemeId): LineageThemePalette {
  return (
    (themeId && LINEAGE_THEMES[themeId]) || LINEAGE_THEMES.golden_parchment
  );
}

export function getLineageFont(fontId?: LineageFontId): LineageFontDefinition {
  return (fontId && LINEAGE_FONTS[fontId]) || LINEAGE_FONTS.amiri;
}

/**
 * Generates an SVG background style tailored to the active theme & canvas backdrop.
 */
export function getLineageCanvasBackdropStyle(
  backdropId: LineageBackdropId,
  theme: LineageThemePalette
): React.CSSProperties {
  const stroke = encodeURIComponent(theme.patternStrokeHex);
  const opacity = theme.patternOpacity;

  if (backdropId === 'ornate_parchment') {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='72' height='72' viewBox='0 0 72 72'><g fill='none' stroke='${stroke}' stroke-opacity='${opacity}' stroke-width='0.9'><path d='M36 4 L44 28 L68 36 L44 44 L36 68 L28 44 L4 36 L28 28 Z'/><circle cx='36' cy='36' r='10'/><path d='M0 0 L12 12 M72 0 L60 12 M0 72 L12 60 M72 72 L60 60'/></g></svg>`;
    return {
      backgroundColor: theme.canvasBg,
      backgroundImage: `url("data:image/svg+xml,${svg}"), ${theme.canvasBgGradient}`,
      backgroundSize: '72px 72px, 100% 100%',
    };
  }

  if (backdropId === 'soft_geometric') {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'><g fill='none' stroke='${stroke}' stroke-opacity='${opacity}' stroke-width='0.75'><path d='M20 0 L40 20 L20 40 L0 20 Z'/><circle cx='20' cy='20' r='2'/></g></svg>`;
    return {
      backgroundColor: theme.canvasBg,
      backgroundImage: `url("data:image/svg+xml,${svg}"), ${theme.canvasBgGradient}`,
      backgroundSize: '40px 40px, 100% 100%',
    };
  }

  // clean_marble
  return {
    backgroundColor: theme.canvasBg,
    backgroundImage: theme.isDark
      ? 'radial-gradient(ellipse at 20% 10%, rgba(228,191,105,0.08), transparent 55%), radial-gradient(ellipse at 85% 90%, rgba(120,165,230,0.07), transparent 50%), ' +
        theme.canvasBgGradient
      : 'radial-gradient(ellipse at 18% 12%, rgba(255,255,255,0.85), transparent 55%), radial-gradient(ellipse at 84% 85%, rgba(212,175,55,0.07), transparent 52%), ' +
        theme.canvasBgGradient,
  };
}

// ============================================================================
// SEMANTIC GENEALOGICAL ENTITY & CONNECTOR ENGINE
// Never puts "بن" between collective tribes/branches/families!
// ============================================================================

export type LineageEntityKind =
  | 'person'
  | 'family'
  | 'branch'
  | 'tribe'
  | 'capsule'
  | 'locked';

const COLLECTIVE_TRIBE_REGEX =
  /^(?:من\s+)?(?:قبيلة|قبائل|حلف|أحلاف|شعب|جذم|مملكة)\b/u;
const COLLECTIVE_BRANCH_REGEX =
  /^(?:من\s+)?(?:فرع|فخذ|بطن|عشيرة|عمارة|خامس|بدن|طائفة)\b/u;
const COLLECTIVE_FAMILY_REGEX =
  /^(?:من\s+)?(?:عائلة|آل|بيت|أسرة|أهل|ذوو|ذوي|بني|بنو|أولاد|ذرية|سلالة)\b/u;

export function classifyUpperAncestorEntityKind(
  node: UpperAncestorNode
): LineageEntityKind {
  const name = (node.name || '').trim();
  const rank = (node.rankLabel || '').trim();
  if (node.code === 'FE0') return 'family';
  if (node.code === 'B0') return 'tribe';
  if (node.code === 'B1' || node.code === 'B2') return 'branch';
  if (node.code === 'AD0' || name.includes('آدم عليه السلام')) return 'person';
  if (COLLECTIVE_TRIBE_REGEX.test(name) || rank.includes('القبيلة الأم')) {
    return 'tribe';
  }
  if (
    COLLECTIVE_BRANCH_REGEX.test(name) ||
    rank.includes('الفرع الجامع') ||
    rank.includes('فخذ') ||
    rank.includes('بطن')
  ) {
    return 'branch';
  }
  if (
    COLLECTIVE_FAMILY_REGEX.test(name) ||
    rank.includes('عائلة') ||
    rank.includes('بيت النسب')
  ) {
    return 'family';
  }
  return 'person';
}

export interface SemanticConnectorResult {
  label: string;
  arrow: string;
  isDirectPersonLink: boolean;
}

/**
 * Resolves a semantically accurate Arabic genealogical connector between two adjacent items.
 * - `upperKind`: the historically older / higher entity (e.g., Mother Tribe, Branch, Ancestor, Father)
 * - `lowerKind`: the historically younger / closer entity (e.g., Branch, Family, Grandfather, Client)
 * - `direction`: 'top_down' (older -> younger) or 'bottom_up' (younger -> older)
 * - `orientation`: 'vertical' or 'horizontal' (RTL panoramic)
 */
export function resolveSemanticLineageConnector(params: {
  upperKind: LineageEntityKind;
  lowerKind: LineageEntityKind;
  direction: LineageDirection;
  orientation?: 'vertical' | 'horizontal';
  hasSkippedGap?: boolean;
}): SemanticConnectorResult {
  const {
    upperKind,
    lowerKind,
    direction,
    orientation = 'vertical',
    hasSkippedGap = false,
  } = params;

  const arrow =
    orientation === 'horizontal'
      ? '←'
      : direction === 'top_down'
      ? '↓'
      : '↑';

  // Locked or folded intermediate capsule boundary
  if (
    upperKind === 'capsule' ||
    lowerKind === 'capsule' ||
    upperKind === 'locked' ||
    lowerKind === 'locked'
  ) {
    return {
      label: direction === 'top_down' ? 'يتفرع عنه' : 'سلسلة نسب متصلة',
      arrow,
      isDirectPersonLink: false,
    };
  }

  // Strictly individual-to-individual links
  if (upperKind === 'person' && lowerKind === 'person') {
    if (hasSkippedGap) {
      return {
        label: direction === 'top_down' ? 'من ذريته' : 'من ذرية',
        arrow,
        isDirectPersonLink: false,
      };
    }
    return {
      label: direction === 'top_down' ? 'ومنه' : 'بن',
      arrow,
      isDirectPersonLink: true,
    };
  }

  // Family -> Person (Record Keeper / Grandfather / Father beneath Direct Family)
  if (upperKind === 'family' && lowerKind === 'person') {
    return {
      label: direction === 'top_down' ? 'من أبنائها' : 'من آل',
      arrow,
      isDirectPersonLink: false,
    };
  }

  // Branch/Tribe -> Family or Tribe -> Branch (NEVER "بن"!)
  if (
    (upperKind === 'tribe' || upperKind === 'branch') &&
    (lowerKind === 'family' || lowerKind === 'branch')
  ) {
    if (direction === 'top_down') {
      return {
        label: upperKind === 'tribe' ? 'يتفرع منه' : 'ومنه فرع',
        arrow,
        isDirectPersonLink: false,
      };
    }
    if (lowerKind === 'branch' && upperKind === 'tribe') {
      return {
        label: 'بطن من',
        arrow,
        isDirectPersonLink: false,
      };
    }
    return {
      label: 'فرع من',
      arrow,
      isDirectPersonLink: false,
    };
  }

  // Person (e.g., Eponymous Ancestor / Prophet) -> Tribe or Branch or Family
  if (
    upperKind === 'person' &&
    (lowerKind === 'tribe' || lowerKind === 'branch' || lowerKind === 'family')
  ) {
    return {
      label: direction === 'top_down' ? 'ومن نسله' : 'ينتسبون إلى',
      arrow,
      isDirectPersonLink: false,
    };
  }

  // Fallback for tribe/branch above person
  return {
    label: direction === 'top_down' ? 'يتفرع منه' : 'ينتسب إلى',
    arrow,
    isDirectPersonLink: false,
  };
}

// ============================================================================
// CLASSICAL ARABIC NASAB NARRATION BUILDER
// ============================================================================

export interface NasabNarrationNodeInput {
  cleanName: string;
  entityKind: LineageEntityKind;
  isDirectFromPreviousPerson?: boolean;
}

function stripLeadingCollectivePrefix(name: string, pattern: RegExp): string {
  return name.replace(pattern, '').trim() || name.trim();
}

/**
 * Composes a classical Arabic nasab narration from the Record Keeper upward
 * through all currently unlocked/visible lineage nodes.
 * Input order: ascending (Record Keeper -> Father -> Grandfather -> Family -> Branch -> Tribe -> Higher Ancestors).
 */
export function buildClassicalArabicNasabNarration(
  ascendingNodes: NasabNarrationNodeInput[]
): string {
  if (!ascendingNodes || ascendingNodes.length === 0) return '';

  const segments: string[] = [];
  let inInitialPersonChain = true;
  let personChainParts: string[] = [];
  let upperPersonChainParts: string[] = [];

  const flushInitialPersonChain = () => {
    if (personChainParts.length > 0) {
      segments.push(personChainParts.join(' بن '));
      personChainParts = [];
    }
  };

  const flushUpperPersonChain = () => {
    if (upperPersonChainParts.length > 0) {
      const joined = upperPersonChainParts.join(' بن ');
      segments.push(`من نسل ${joined}`);
      upperPersonChainParts = [];
    }
  };

  for (const item of ascendingNodes) {
    const clean = item.cleanName.trim();
    if (!clean) continue;

    if (item.entityKind === 'person') {
      if (inInitialPersonChain) {
        personChainParts.push(clean);
      } else {
        if (clean.includes('آدم عليه السلام')) {
          flushUpperPersonChain();
          segments.push('حتى أبينا آدم عليه السلام');
        } else {
          upperPersonChainParts.push(clean);
        }
      }
      continue;
    }

    // Switching to collective entity (family / branch / tribe)
    inInitialPersonChain = false;
    flushInitialPersonChain();
    flushUpperPersonChain();

    if (item.entityKind === 'family') {
      const famCore = stripLeadingCollectivePrefix(
        clean,
        /^(?:عائلة|أسرة|آل|بيت)\s+/u
      );
      const hasHousePrefix = /^(?:آل|بيت|بني|بنو)\s+/u.test(clean);
      segments.push(hasHousePrefix ? `من ${clean}` : `من آل ${famCore}`);
    } else if (item.entityKind === 'branch') {
      const branchCore = stripLeadingCollectivePrefix(
        clean,
        /^(?:فرع|فخذ|بطن|عشيرة)\s+/u
      );
      segments.push(`من فرع ${branchCore}`);
    } else if (item.entityKind === 'tribe') {
      const tribeCore = stripLeadingCollectivePrefix(
        clean,
        /^(?:قبيلة|قبائل)\s+/u
      );
      segments.push(`من قبيلة ${tribeCore}`);
    }
  }

  flushInitialPersonChain();
  flushUpperPersonChain();

  return segments.join('، ');
}

// ============================================================================
// HERITAGE BOOK SPINE CITATION PARSER
// Extracts volume & page citations such as (ج4 ص29) or (ج 4 / ص 29)
// ============================================================================

export interface ParsedHistoricalSource {
  raw: string;
  title: string;
  author?: string;
  volumePageTag?: string;
}

export function parseHistoricalSourceCitation(
  rawSource: string
): ParsedHistoricalSource {
  const raw = (rawSource || '').trim();
  if (!raw) {
    return { raw: '', title: 'مرجع تاريخي موثق' };
  }

  let working = raw;
  let volumePageTag: string | undefined;

  // Match parenthetical volume/page info like (ج4 ص29), (ج 4 / ص 29), (المجلد 2، صفحة 115)
  const parenMatch = working.match(
    /\(([^)]*(?:ج\s*[\d٠-٩]+|مجلد|ص\s*[\d٠-٩]+|صفحة)[^)]*)\)/u
  );
  if (parenMatch) {
    volumePageTag = parenMatch[1]
      .replace(/\s*\/\s*/g, ' · ')
      .replace(/\s*،\s*/g, ' · ')
      .replace(/\s+/g, ' ')
      .trim();
    working = working.replace(parenMatch[0], '').replace(/\s+/g, ' ').trim();
  } else {
    // Match trailing volume/page without parentheses
    const trailingMatch = working.match(
      /(?:[-–—،,]\s*)?((?:ج|مجلد)\s*[\d٠-٩]+(?:\s*[/،,-]?\s*(?:ص|صفحة)\s*[\d٠-٩]+)?|(?:ص|صفحة)\s*[\d٠-٩]+)\s*$/u
    );
    if (trailingMatch) {
      volumePageTag = trailingMatch[1]
        .replace(/\s*\/\s*/g, ' · ')
        .replace(/\s+/g, ' ')
        .trim();
      working = working
        .slice(0, trailingMatch.index)
        .replace(/[-–—،,\s]+$/u, '')
        .trim();
    }
  }

  // Split optional author separated by em-dash or " — " or " تأليف "
  let title = working;
  let author: string | undefined;
  const dashSplit = working.split(/\s+[—–]\s+/);
  if (dashSplit.length >= 2 && dashSplit[0].length >= 4) {
    title = dashSplit[0].trim();
    author = dashSplit.slice(1).join(' — ').trim();
  }

  return {
    raw,
    title: title || raw,
    author: author || undefined,
    volumePageTag,
  };
}

// ============================================================================
// LOCAL STORAGE PERSISTENCE
// ============================================================================

const LINEAGE_PREFS_STORAGE_PREFIX = 'juthori_lineage_studio_prefs_v1';

export function loadLineageStudioPrefsFromLocal(
  userId?: string
): LineageStudioPrefs {
  if (typeof window === 'undefined') return DEFAULT_LINEAGE_STUDIO_PREFS;
  try {
    const key = `${LINEAGE_PREFS_STORAGE_PREFIX}_${userId || 'guest'}`;
    const raw = window.localStorage.getItem(key);
    if (!raw) return DEFAULT_LINEAGE_STUDIO_PREFS;
    const parsed = JSON.parse(raw) as Partial<LineageStudioPrefs>;
    return normalizeLineageStudioPrefs(parsed);
  } catch {
    return DEFAULT_LINEAGE_STUDIO_PREFS;
  }
}

export function saveLineageStudioPrefsToLocal(
  userId: string | undefined,
  prefs: LineageStudioPrefs
): void {
  if (typeof window === 'undefined') return;
  try {
    const key = `${LINEAGE_PREFS_STORAGE_PREFIX}_${userId || 'guest'}`;
    window.localStorage.setItem(key, JSON.stringify(prefs));
  } catch {
    // Ignore quota errors
  }
}

export function normalizeLineageStudioPrefs(
  raw?: Partial<LineageStudioPrefs> | null
): LineageStudioPrefs {
  if (!raw || typeof raw !== 'object') return DEFAULT_LINEAGE_STUDIO_PREFS;
  const viewMode: LineageViewMode =
    raw.viewMode === 'royal_pillar' ||
    raw.viewMode === 'heritage_scroll' ||
    raw.viewMode === 'panoramic_flow' ||
    raw.viewMode === 'compact_medallions'
      ? raw.viewMode
      : DEFAULT_LINEAGE_STUDIO_PREFS.viewMode;

  const direction: LineageDirection =
    raw.direction === 'top_down' || raw.direction === 'bottom_up'
      ? raw.direction
      : DEFAULT_LINEAGE_STUDIO_PREFS.direction;

  const themeId: LineageThemeId =
    raw.themeId && raw.themeId in LINEAGE_THEMES
      ? raw.themeId
      : DEFAULT_LINEAGE_STUDIO_PREFS.themeId;

  const fontId: LineageFontId =
    raw.fontId && raw.fontId in LINEAGE_FONTS
      ? raw.fontId
      : DEFAULT_LINEAGE_STUDIO_PREFS.fontId;

  const backdropId: LineageBackdropId =
    raw.backdropId === 'ornate_parchment' ||
    raw.backdropId === 'soft_geometric' ||
    raw.backdropId === 'clean_marble'
      ? raw.backdropId
      : DEFAULT_LINEAGE_STUDIO_PREFS.backdropId;

  return {
    viewMode,
    direction,
    themeId,
    fontId,
    backdropId,
    showNasabStrip:
      typeof raw.showNasabStrip === 'boolean'
        ? raw.showNasabStrip
        : DEFAULT_LINEAGE_STUDIO_PREFS.showNasabStrip,
  };
}
