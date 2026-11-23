import React from 'react';
import { UpperAncestorNode } from '../types/juthori';
import {
  DEFAULT_TREE_DISPLAY_SETTINGS,
  TREE_ARABIC_FONT_OPTIONS,
  TREE_CANVAS_BACKGROUND_OPTIONS,
  TREE_CARD_THEMES,
  TreeArabicFontId,
  TreeCanvasBackground,
  TreeCardThemeDefinition,
  TreeCardThemeId,
  getTreeCanvasBackgroundStyle,
} from './treeStudioConfig';

export type LineageViewMode =
  | 'royal_pillar'
  | 'heritage_scroll'
  | 'panoramic_flow'
  | 'andalusian_zigzag'
  | 'heritage_medallions'
  | 'majlis_arch_steps';

export type LineageDirection = 'top_down' | 'bottom_up';

/** Single Source of Truth: exact 10 museum theme IDs from treeStudioConfig.ts */
export type LineageThemeId = TreeCardThemeId;

/** Single Source of Truth: exact 4 Arabic font IDs from treeStudioConfig.ts */
export type LineageFontId = TreeArabicFontId;

/** Single Source of Truth: exact 3 canvas backdrop IDs from treeStudioConfig.ts */
export type LineageBackdropId = TreeCanvasBackground;

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
  themeId: DEFAULT_TREE_DISPLAY_SETTINGS.cardTheme,
  fontId: DEFAULT_TREE_DISPLAY_SETTINGS.fontFamily,
  backdropId: DEFAULT_TREE_DISPLAY_SETTINGS.canvasBackground,
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

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6) return `rgba(141, 73, 37, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Derives a full LineageThemePalette directly from the canonical
 * TreeCardThemeDefinition (Single Source of Truth across عمود نسبي & شجرتي).
 */
export function deriveLineageThemePaletteFromTreeTheme(
  t: TreeCardThemeDefinition
): LineageThemePalette {
  const isDark = t.isDarkSurface;
  const primary = t.primaryHex;
  const secondary = t.secondaryHex;
  const gold = t.goldAccentHex;

  return {
    id: t.id,
    label: t.label,
    subtitle: t.subtitle,
    isDark,
    swatchPrimary: t.swatches[0],
    swatchSecondary: t.swatches[1],
    swatchGold: t.swatches[2],
    canvasBg: t.canvasBg,
    canvasBgGradient: isDark
      ? `linear-gradient(180deg, #1E1B17 0%, ${t.canvasBg} 52%, #141210 100%)`
      : `linear-gradient(180deg, ${t.cardFillHex} 0%, ${t.canvasBg} 55%, ${t.canvasBg} 100%)`,
    canvasBorder: isDark
      ? hexToRgba(gold, 0.5)
      : hexToRgba(t.cardStrokeHex, 0.55),
    surfaceBg: t.cardFillHex,
    surfaceAltBg: isDark ? '#1D1915' : t.canvasBg,
    surfaceBorder: isDark
      ? hexToRgba(gold, 0.42)
      : hexToRgba(t.cardStrokeHex, 0.52),
    surfaceHoverBorder: isDark ? gold : primary,
    accentHex: primary,
    accentSoftBg: hexToRgba(primary, isDark ? 0.16 : 0.08),
    accentTextHex: isDark ? gold : primary,
    goldHex: gold,
    goldSoftBg: isDark ? hexToRgba(gold, 0.16) : hexToRgba(gold, 0.14),
    goldBorderHex: isDark ? hexToRgba(gold, 0.65) : gold,
    textPrimaryHex: t.textPrimaryHex,
    textSecondaryHex: isDark ? t.textMutedHex : t.textPrimaryHex,
    textMutedHex: t.textMutedHex,
    railGradient: isDark
      ? `linear-gradient(180deg, ${hexToRgba(gold, 0.25)} 0%, ${hexToRgba(gold, 0.85)} 50%, ${hexToRgba(primary, 0.45)} 100%)`
      : `linear-gradient(180deg, ${hexToRgba(gold, 0.35)} 0%, ${hexToRgba(primary, 0.82)} 50%, ${hexToRgba(gold, 0.5)} 100%)`,
    patternStrokeHex: isDark ? gold : t.canvasDot,
    patternOpacity: isDark ? 0.09 : 0.075,
    summitBg: isDark
      ? 'linear-gradient(135deg, #2D261C 0%, #1C1813 55%, #2A2319 100%)'
      : `linear-gradient(135deg, ${t.textPrimaryHex} 0%, ${primary} 60%, ${t.textPrimaryHex} 100%)`,
    summitText: '#FFFBF2',
    summitSubtext: isDark ? '#F6DFA4' : '#F3D79B',
    summitBorder: gold,
    rootBg: isDark
      ? 'linear-gradient(135deg, #28231C 0%, #1F1B16 100%)'
      : `linear-gradient(135deg, ${t.cardFillHex} 0%, ${t.canvasBg} 100%)`,
    rootBorder: gold,
    rootAccent: isDark ? gold : primary,
    directFamilyBg: isDark
      ? 'linear-gradient(135deg, #2B241B 0%, #201B15 100%)'
      : `linear-gradient(135deg, ${t.cardFillHex} 0%, ${hexToRgba(gold, 0.16)} 100%)`,
    directFamilyBorder: isDark ? gold : primary,
    directFamilyAccent: isDark ? gold : primary,
    keeperBg: isDark
      ? 'linear-gradient(135deg, #2E271E 0%, #1E1A15 100%)'
      : `linear-gradient(135deg, #FFFFFF 0%, ${t.canvasBg} 100%)`,
    keeperBorder: primary,
    keeperAccent: isDark ? gold : primary,
    connectorBg: isDark ? '#24201B' : t.cardFillHex,
    connectorBorder: isDark ? hexToRgba(gold, 0.52) : hexToRgba(primary, 0.38),
    connectorText: isDark ? gold : primary,
    statusBg: isDark ? 'rgba(20, 83, 45, 0.28)' : '#EEF6F0',
    statusBorder: isDark ? 'rgba(74, 222, 128, 0.35)' : '#B9DEC5',
    statusText: isDark ? '#BBF7D0' : '#14532D',
    buttonPrimaryBg: primary,
    buttonPrimaryHoverBg: secondary,
    buttonPrimaryText: isDark ? '#181614' : '#FFFBF2',
  };
}

export const LINEAGE_THEMES: Record<LineageThemeId, LineageThemePalette> = (
  Object.keys(TREE_CARD_THEMES) as TreeCardThemeId[]
).reduce((acc, themeId) => {
  acc[themeId] = deriveLineageThemePaletteFromTreeTheme(
    TREE_CARD_THEMES[themeId]
  );
  return acc;
}, {} as Record<LineageThemeId, LineageThemePalette>);

export interface LineageFontDefinition {
  id: LineageFontId;
  label: string;
  sampleText: string;
  cssFamily: string;
  canvasFontName: string;
}

export const LINEAGE_FONTS: Record<LineageFontId, LineageFontDefinition> =
  TREE_ARABIC_FONT_OPTIONS.reduce((acc, f) => {
    acc[f.id] = {
      id: f.id,
      label: f.label,
      sampleText: 'عمود نسبٍ أصيل',
      cssFamily: f.cssFamily,
      canvasFontName: f.canvasFontName,
    };
    return acc;
  }, {} as Record<LineageFontId, LineageFontDefinition>);

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
    id: 'andalusian_zigzag',
    label: 'المعراج الأندلسي المتعرّج',
    shortDesc: 'تناوب يميناً ويساراً حول محور ذهبي',
  },
  {
    id: 'heritage_medallions',
    label: 'قلادة الميداليات الديوانية',
    shortDesc: 'معرض ميداليات مترابطة بشاشة واحدة',
  },
  {
    id: 'majlis_arch_steps',
    label: 'عقود المحراب والمقامات',
    shortDesc: 'مدرّج أقواس تراثية بمسار الحقَب',
  },
];

export interface LineageBackdropOption {
  id: LineageBackdropId;
  label: string;
}

export const LINEAGE_BACKDROP_OPTIONS: LineageBackdropOption[] =
  TREE_CANVAS_BACKGROUND_OPTIONS.map((opt) => ({
    id: opt.id,
    label: opt.label,
  }));

const LEGACY_LINEAGE_THEME_MAP: Record<string, LineageThemeId> = {
  golden_parchment: 'heritage',
  andalusian_emerald: 'emerald_gold',
  sultanic_burgundy: 'royal_burgundy',
  diriyah_oasis: 'diriyah_oasis',
  royal_navy_gold: 'royal_kiswah',
};

const LEGACY_LINEAGE_FONT_MAP: Record<string, LineageFontId> = {
  amiri: 'amiri',
  classical: 'noto_naskh',
  modern: 'cairo_modern',
};

const LEGACY_LINEAGE_BACKDROP_MAP: Record<string, LineageBackdropId> = {
  ornate_parchment: 'parchment',
  soft_geometric: 'dots',
  clean_marble: 'marble',
};

export function normalizeLineageThemeId(raw?: string | null): LineageThemeId {
  if (!raw) return DEFAULT_LINEAGE_STUDIO_PREFS.themeId;
  if (raw in LINEAGE_THEMES) return raw as LineageThemeId;
  if (raw in LEGACY_LINEAGE_THEME_MAP) return LEGACY_LINEAGE_THEME_MAP[raw];
  return DEFAULT_LINEAGE_STUDIO_PREFS.themeId;
}

export function normalizeLineageFontId(raw?: string | null): LineageFontId {
  if (!raw) return DEFAULT_LINEAGE_STUDIO_PREFS.fontId;
  if (raw in LINEAGE_FONTS) return raw as LineageFontId;
  if (raw in LEGACY_LINEAGE_FONT_MAP) return LEGACY_LINEAGE_FONT_MAP[raw];
  return DEFAULT_LINEAGE_STUDIO_PREFS.fontId;
}

export function normalizeLineageBackdropId(
  raw?: string | null
): LineageBackdropId {
  if (!raw) return DEFAULT_LINEAGE_STUDIO_PREFS.backdropId;
  if (raw === 'parchment' || raw === 'dots' || raw === 'marble') return raw;
  if (raw in LEGACY_LINEAGE_BACKDROP_MAP) {
    return LEGACY_LINEAGE_BACKDROP_MAP[raw];
  }
  return DEFAULT_LINEAGE_STUDIO_PREFS.backdropId;
}

export function getLineageTheme(
  themeId?: LineageThemeId | string
): LineageThemePalette {
  const normalized = normalizeLineageThemeId(themeId);
  return LINEAGE_THEMES[normalized] || LINEAGE_THEMES.diriyah_oasis;
}

export function getLineageFont(
  fontId?: LineageFontId | string
): LineageFontDefinition {
  const normalized = normalizeLineageFontId(fontId);
  return LINEAGE_FONTS[normalized] || LINEAGE_FONTS.amiri;
}

/**
 * Generates exact canvas backdrop styles synchronized 1:1 with «شجرتي»
 * (`getTreeCanvasBackgroundStyle` in treeStudioConfig.ts).
 */
export function getLineageCanvasBackdropStyle(
  backdropId: LineageBackdropId,
  theme: LineageThemePalette
): React.CSSProperties {
  const treeTheme =
    TREE_CARD_THEMES[theme.id] || TREE_CARD_THEMES.diriyah_oasis;
  return getTreeCanvasBackgroundStyle(
    treeTheme,
    normalizeLineageBackdropId(backdropId)
  );
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
    raw.viewMode === 'andalusian_zigzag' ||
    raw.viewMode === 'heritage_medallions' ||
    raw.viewMode === 'majlis_arch_steps'
      ? raw.viewMode
      : DEFAULT_LINEAGE_STUDIO_PREFS.viewMode;

  const direction: LineageDirection =
    raw.direction === 'top_down' || raw.direction === 'bottom_up'
      ? raw.direction
      : DEFAULT_LINEAGE_STUDIO_PREFS.direction;

  const themeId = normalizeLineageThemeId(raw.themeId as string | undefined);
  const fontId = normalizeLineageFontId(raw.fontId as string | undefined);
  const backdropId = normalizeLineageBackdropId(
    raw.backdropId as string | undefined
  );

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
