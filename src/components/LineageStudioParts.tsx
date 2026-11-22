import React, { useState } from 'react';
import {
  ArrowDownUp,
  BookMarked,
  BookOpenCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Compass,
  Copy,
  Eye,
  EyeOff,
  LayoutGrid,
  Lock,
  MapPin,
  Maximize2,
  Minimize2,
  Palette,
  RotateCcw,
  ScrollText,
  SlidersHorizontal,
  Sparkles,
  Type,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  UpperAncestorNode,
  VerifiedAddonSourceItem,
} from '../types/juthori';
import {
  DEFAULT_LINEAGE_STUDIO_PREFS,
  LINEAGE_BACKDROP_OPTIONS,
  LINEAGE_FONTS,
  LINEAGE_THEMES,
  LINEAGE_VIEW_MODE_OPTIONS,
  LineageBackdropId,
  LineageDirection,
  LineageFontId,
  LineageStudioPrefs,
  LineageThemeId,
  LineageThemePalette,
  LineageViewMode,
  getLineageFont,
  parseHistoricalSourceCitation,
} from '../utils/lineageStudioConfig';

// ============================================================================
// 1. CLASSICAL ARABIC NASAB NARRATION BAR
// ============================================================================

interface ClassicalNasabNarrationBarProps {
  narrationText: string;
  theme: LineageThemePalette;
  fontId: LineageFontId;
  onHideStrip: () => void;
}

export const ClassicalNasabNarrationBar: React.FC<
  ClassicalNasabNarrationBarProps
> = ({ narrationText, theme, fontId, onHideStrip }) => {
  const [copied, setCopied] = useState(false);
  const fontDef = getLineageFont(fontId);

  if (!narrationText.trim()) return null;

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(narrationText);
      } else {
        const ta = document.createElement('textarea');
        ta.value = narrationText;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      data-testid="classical-nasab-narration-bar"
      className="relative z-20 rounded-2xl px-4 sm:px-5 py-3.5 transition-colors duration-200"
      style={{
        backgroundColor: theme.surfaceBg,
        border: `1px solid ${theme.goldBorderHex}66`,
        boxShadow: theme.isDark
          ? '0 4px 18px rgba(0,0,0,0.25)'
          : '0 2px 10px rgba(141,73,37,0.05)',
      }}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <ScrollText
              className="w-3.5 h-3.5 shrink-0"
              style={{ color: theme.goldHex }}
            />
            <span
              className="text-[11px] font-display font-bold tracking-wide"
              style={{ color: theme.textMutedHex }}
            >
              الصياغة النسبية المتصلة
            </span>
          </div>
          <p
            className="text-sm sm:text-base font-bold leading-relaxed"
            style={{
              fontFamily: fontDef.cssFamily,
              color: theme.textPrimaryHex,
            }}
          >
            «{narrationText}»
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
          <button
            type="button"
            data-testid="copy-nasab-narration-btn"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-display font-bold transition-all duration-150 cursor-pointer whitespace-nowrap shrink-0"
            style={{
              backgroundColor: copied ? '#ECFDF5' : theme.goldSoftBg,
              color: copied ? '#065F46' : theme.accentTextHex,
              border: `1px solid ${copied ? '#6EE7B7' : `${theme.goldBorderHex}75`}`,
            }}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>تم النسخ</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>نسخ الصياغة النسبية</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onHideStrip}
            title="إخفاء شريط الصياغة النسبية"
            aria-label="إخفاء شريط الصياغة النسبية"
            className="w-8 h-8 rounded-xl inline-flex items-center justify-center transition-colors cursor-pointer shrink-0"
            style={{
              backgroundColor: theme.surfaceAltBg,
              color: theme.textMutedHex,
              border: `1px solid ${theme.surfaceBorder}`,
            }}
          >
            <EyeOff className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 2. ULTRA-COMPACT 2-ROW LINEAGE STUDIO CUSTOMIZER (Zero Text Bloat)
// ============================================================================

const COMPACT_VIEW_MODE_LABELS: Record<LineageViewMode, string> = {
  royal_pillar: 'المسبحة العمودية',
  heritage_scroll: 'صك النسب',
  panoramic_flow: 'المسار الأفقي',
  andalusian_zigzag: 'المعراج المتعرج',
  heritage_medallions: 'قلادة الميداليات',
  majlis_arch_steps: 'عقود المحراب',
};

const COMPACT_FONT_LABELS: Record<LineageFontId, string> = {
  amiri: 'نسخ أميري',
  classical: 'كلاسيكي',
  modern: 'عصري',
};

const COMPACT_BACKDROP_LABELS: Record<LineageBackdropId, string> = {
  ornate_parchment: 'رقّ تراثي',
  soft_geometric: 'نقش هندسي',
  clean_marble: 'صافي',
};

interface LineageCustomizationPanelProps {
  isOpen: boolean;
  prefs: LineageStudioPrefs;
  theme: LineageThemePalette;
  onUpdatePrefs: (patch: Partial<LineageStudioPrefs>) => void;
  onResetDefaults: () => void;
  onClose: () => void;
}

export const LineageCustomizationPanel: React.FC<
  LineageCustomizationPanelProps
> = ({ isOpen, prefs, theme, onUpdatePrefs, onResetDefaults, onClose }) => {
  if (!isOpen) return null;

  const isDefault =
    prefs.viewMode === DEFAULT_LINEAGE_STUDIO_PREFS.viewMode &&
    prefs.direction === DEFAULT_LINEAGE_STUDIO_PREFS.direction &&
    prefs.themeId === DEFAULT_LINEAGE_STUDIO_PREFS.themeId &&
    prefs.fontId === DEFAULT_LINEAGE_STUDIO_PREFS.fontId &&
    prefs.backdropId === DEFAULT_LINEAGE_STUDIO_PREFS.backdropId &&
    prefs.showNasabStrip === DEFAULT_LINEAGE_STUDIO_PREFS.showNasabStrip;

  return (
    <section
      data-testid="lineage-customization-panel"
      aria-label="تخصيص مظهر عمود النسب"
      className="relative z-30 rounded-2xl px-4 py-3.5 space-y-3 transition-all duration-200"
      style={{
        backgroundColor: theme.surfaceBg,
        border: `1px solid ${theme.goldBorderHex}65`,
        boxShadow: theme.isDark
          ? '0 12px 30px rgba(0,0,0,0.34)'
          : '0 6px 22px rgba(44,30,20,0.06)',
      }}
    >
      {/* Row 1: Display Style (6 Concise Pills) + Reset / Close */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0 flex-1">
          <span
            className="text-[11px] font-display font-bold inline-flex items-center gap-1 ml-1 shrink-0"
            style={{ color: theme.textMutedHex }}
          >
            <LayoutGrid className="w-3.5 h-3.5" style={{ color: theme.goldHex }} />
            <span>النمط</span>
          </span>

          {LINEAGE_VIEW_MODE_OPTIONS.map((opt) => {
            const active = prefs.viewMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                title={opt.label}
                data-testid={`lineage-view-mode-${opt.id}`}
                onClick={() =>
                  onUpdatePrefs({ viewMode: opt.id as LineageViewMode })
                }
                className="h-8 px-3 rounded-xl text-xs font-display font-bold inline-flex items-center gap-1.5 transition-all duration-150 cursor-pointer whitespace-nowrap"
                style={{
                  backgroundColor: active
                    ? theme.goldSoftBg
                    : theme.surfaceAltBg,
                  color: active ? theme.accentTextHex : theme.textPrimaryHex,
                  border: `1px solid ${
                    active ? theme.goldBorderHex : theme.surfaceBorder
                  }`,
                }}
              >
                <span>{COMPACT_VIEW_MODE_LABELS[opt.id]}</span>
                {active && (
                  <Check
                    className="w-3 h-3 shrink-0"
                    style={{ color: theme.goldHex }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {!isDefault && (
            <button
              type="button"
              onClick={onResetDefaults}
              title="استعادة الإعدادات الافتراضية"
              className="h-8 px-2.5 rounded-xl text-[11px] font-display font-bold inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
              style={{
                backgroundColor: theme.surfaceAltBg,
                color: theme.textSecondaryHex,
                border: `1px solid ${theme.surfaceBorder}`,
              }}
            >
              <RotateCcw className="w-3 h-3" />
              <span>افتراضي</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق لوحة التخصيص"
            className="w-8 h-8 rounded-xl inline-flex items-center justify-center transition-colors cursor-pointer"
            style={{
              backgroundColor: theme.surfaceAltBg,
              color: theme.textSecondaryHex,
              border: `1px solid ${theme.surfaceBorder}`,
            }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Row 2: Direction + Nasab Strip | Theme Swatch Circles | Font Pills | Backdrop Pills */}
      <div
        className="pt-3 flex flex-wrap items-center gap-x-4 gap-y-2.5"
        style={{ borderTop: `1px solid ${theme.surfaceBorder}` }}
      >
        {/* Direction 2-Way Segmented Toggle */}
        <div
          role="group"
          aria-label="اتجاه قراءة عمود النسب"
          className="inline-flex items-center p-0.5 rounded-xl shrink-0"
          style={{
            backgroundColor: theme.surfaceAltBg,
            border: `1px solid ${theme.surfaceBorder}`,
          }}
        >
          {(
            [
              { id: 'top_down', label: 'من الجذر نزولاً' },
              { id: 'bottom_up', label: 'من اسمي صعوداً' },
            ] as Array<{ id: LineageDirection; label: string }>
          ).map((dirOpt) => {
            const active = prefs.direction === dirOpt.id;
            return (
              <button
                key={dirOpt.id}
                type="button"
                data-testid={`lineage-direction-${dirOpt.id}`}
                onClick={() => onUpdatePrefs({ direction: dirOpt.id })}
                className="h-7 px-2.5 rounded-lg text-[11.5px] font-display font-bold transition-all cursor-pointer whitespace-nowrap"
                style={{
                  backgroundColor: active ? theme.surfaceBg : 'transparent',
                  color: active ? theme.accentTextHex : theme.textSecondaryHex,
                  border: active
                    ? `1px solid ${theme.goldBorderHex}80`
                    : '1px solid transparent',
                }}
              >
                {dirOpt.label}
              </button>
            );
          })}
        </div>

        {/* Classical Nasab Narration Strip Toggle */}
        <button
          type="button"
          onClick={() =>
            onUpdatePrefs({ showNasabStrip: !prefs.showNasabStrip })
          }
          className="h-8 px-3 rounded-xl text-[11.5px] font-display font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0"
          style={{
            backgroundColor: prefs.showNasabStrip
              ? theme.goldSoftBg
              : theme.surfaceAltBg,
            color: prefs.showNasabStrip
              ? theme.accentTextHex
              : theme.textMutedHex,
            border: `1px solid ${
              prefs.showNasabStrip ? theme.goldBorderHex : theme.surfaceBorder
            }`,
          }}
        >
          {prefs.showNasabStrip ? (
            <Eye className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <EyeOff className="w-3.5 h-3.5 shrink-0" />
          )}
          <span>شريط الصياغة النسبية</span>
        </button>

        <span
          className="hidden lg:inline-block w-px h-5"
          style={{ backgroundColor: theme.surfaceBorder }}
          aria-hidden="true"
        />

        {/* 5 Dual-Tone Theme Color Swatch Circles */}
        <div
          className="inline-flex items-center gap-2 shrink-0"
          role="group"
          aria-label="الهوية اللونية"
        >
          <span
            className="text-[11px] font-display font-bold inline-flex items-center gap-1"
            style={{ color: theme.textMutedHex }}
          >
            <Palette className="w-3.5 h-3.5" style={{ color: theme.goldHex }} />
            <span>الثيم</span>
          </span>
          <div className="inline-flex items-center gap-1.5">
            {(Object.keys(LINEAGE_THEMES) as LineageThemeId[]).map((tId) => {
              const t = LINEAGE_THEMES[tId];
              const active = prefs.themeId === tId;
              return (
                <button
                  key={tId}
                  type="button"
                  title={t.label}
                  aria-label={t.label}
                  data-testid={`lineage-theme-${tId}`}
                  onClick={() => onUpdatePrefs({ themeId: tId })}
                  className="relative w-7 h-7 rounded-full inline-flex items-center justify-center transition-transform duration-150 hover:scale-105 cursor-pointer shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${t.swatchPrimary} 52%, ${t.swatchGold} 48%)`,
                    boxShadow: active
                      ? `0 0 0 2px ${theme.surfaceBg}, 0 0 0 4px ${theme.goldHex}`
                      : 'inset 0 0 0 1px rgba(0,0,0,0.16)',
                  }}
                >
                  {active && (
                    <span className="w-3.5 h-3.5 rounded-full bg-white/90 text-[#2C1E14] flex items-center justify-center shadow-2xs">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <span
          className="hidden lg:inline-block w-px h-5"
          style={{ backgroundColor: theme.surfaceBorder }}
          aria-hidden="true"
        />

        {/* 3 Compact Arabic Font Pills */}
        <div
          className="inline-flex items-center gap-1 shrink-0"
          role="group"
          aria-label="الخط العربي"
        >
          {(Object.keys(LINEAGE_FONTS) as LineageFontId[]).map((fId) => {
            const f = LINEAGE_FONTS[fId];
            const active = prefs.fontId === fId;
            return (
              <button
                key={fId}
                type="button"
                title={f.label}
                data-testid={`lineage-font-${fId}`}
                onClick={() => onUpdatePrefs({ fontId: fId })}
                className="h-8 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
                style={{
                  fontFamily: f.cssFamily,
                  backgroundColor: active
                    ? theme.goldSoftBg
                    : theme.surfaceAltBg,
                  color: active ? theme.accentTextHex : theme.textPrimaryHex,
                  border: `1px solid ${
                    active ? theme.goldBorderHex : theme.surfaceBorder
                  }`,
                }}
              >
                {COMPACT_FONT_LABELS[fId]}
              </button>
            );
          })}
        </div>

        {/* 3 Compact Backdrop Pills */}
        <div
          className="inline-flex items-center gap-1 shrink-0"
          role="group"
          aria-label="خلفية مساحة العرض"
        >
          {LINEAGE_BACKDROP_OPTIONS.map((b) => {
            const active = prefs.backdropId === b.id;
            return (
              <button
                key={b.id}
                type="button"
                title={b.label}
                data-testid={`lineage-backdrop-${b.id}`}
                onClick={() =>
                  onUpdatePrefs({ backdropId: b.id as LineageBackdropId })
                }
                className="h-8 px-2.5 rounded-xl text-[11.5px] font-display font-bold transition-all cursor-pointer whitespace-nowrap"
                style={{
                  backgroundColor: active
                    ? theme.goldSoftBg
                    : theme.surfaceAltBg,
                  color: active ? theme.accentTextHex : theme.textSecondaryHex,
                  border: `1px solid ${
                    active ? theme.goldBorderHex : theme.surfaceBorder
                  }`,
                }}
              >
                {COMPACT_BACKDROP_LABELS[b.id]}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

// ============================================================================
// 3. FLOATING / HEADER-INLINE CANVAS TOOLBAR (Zoom / Center / Majlis Showcase)
// ============================================================================

interface LineageCanvasFloatingControlsProps {
  zoom: number;
  isFullscreen: boolean;
  theme: LineageThemePalette;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoomCenter: () => void;
  onToggleFullscreen: () => void;
  variant?: 'floating' | 'inline' | 'header';
}

export const LineageCanvasFloatingControls: React.FC<
  LineageCanvasFloatingControlsProps
> = ({
  zoom,
  isFullscreen,
  theme,
  onZoomIn,
  onZoomOut,
  onResetZoomCenter,
  onToggleFullscreen,
  variant = 'floating',
}) => {
  const isHeader = variant === 'header';
  const isInline = variant === 'inline' || isHeader;

  const toolbarContent = (
    <div
      data-testid={
        isInline ? 'lineage-inline-controls' : 'lineage-floating-controls'
      }
      className={`pointer-events-auto inline-flex items-center transition-colors ${
        isHeader
          ? 'h-10 gap-0.5 px-1.5 rounded-xl bg-white border border-[#E2D5BE] shadow-2xs'
          : isInline
          ? 'gap-0.5 px-1.5 py-1 rounded-xl'
          : 'gap-1 sm:gap-1.5 px-2.5 py-1.5 rounded-2xl backdrop-blur-md'
      }`}
      style={
        isHeader
          ? undefined
          : {
              backgroundColor: isInline
                ? theme.surfaceBg
                : theme.isDark
                ? 'rgba(18, 31, 51, 0.92)'
                : 'rgba(255, 253, 248, 0.94)',
              border: `1px solid ${theme.goldBorderHex}${isInline ? '55' : '70'}`,
              boxShadow: isInline
                ? '0 1px 2px rgba(35,29,23,0.04)'
                : theme.isDark
                ? '0 8px 26px rgba(0,0,0,0.45)'
                : '0 8px 24px rgba(35,29,23,0.1)',
            }
      }
    >
      <button
        type="button"
        onClick={onZoomOut}
        disabled={zoom <= 0.7}
        title="تصغير العرض"
        aria-label="تصغير العرض"
        className={`${
          isInline ? 'w-7 h-7 rounded-lg hover:bg-[#FAF5EC]' : 'w-8 h-8 rounded-xl'
        } inline-flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed`}
        style={{ color: isHeader ? '#3D2B1F' : theme.textPrimaryHex }}
      >
        <ZoomOut className={isInline ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
      </button>

      <span
        className={`${
          isInline
            ? 'text-[11.5px] px-1 min-w-[38px]'
            : 'text-xs px-1.5 min-w-[44px]'
        } font-mono font-bold tabular-nums text-center`}
        style={{ color: isHeader ? '#5C4938' : theme.textSecondaryHex }}
        dir="ltr"
      >
        {Math.round(zoom * 100)}%
      </span>

      <button
        type="button"
        onClick={onZoomIn}
        disabled={zoom >= 1.35}
        title="تكبير العرض"
        aria-label="تكبير العرض"
        className={`${
          isInline ? 'w-7 h-7 rounded-lg hover:bg-[#FAF5EC]' : 'w-8 h-8 rounded-xl'
        } inline-flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed`}
        style={{ color: isHeader ? '#3D2B1F' : theme.textPrimaryHex }}
      >
        <ZoomIn className={isInline ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
      </button>

      <span
        className={`w-px ${isInline ? 'h-4 mx-1' : 'h-5 mx-0.5'}`}
        style={{ backgroundColor: isHeader ? '#E6DAC3' : theme.surfaceBorder }}
        aria-hidden="true"
      />

      <button
        type="button"
        onClick={onResetZoomCenter}
        title="توسيط وإعادة الضبط"
        className={`inline-flex items-center gap-1.5 ${
          isHeader
            ? 'px-2 py-1 rounded-lg text-[12px] text-[#3D2B1F] hover:bg-[#FAF5EC]'
            : isInline
            ? 'px-2 py-1 rounded-lg text-[11.5px]'
            : 'px-2.5 py-1.5 rounded-xl text-xs'
        } font-display font-bold transition-colors cursor-pointer whitespace-nowrap`}
        style={isHeader ? undefined : { color: theme.textSecondaryHex }}
      >
        <Compass
          className="w-3.5 h-3.5 shrink-0"
          style={{ color: isHeader ? '#B8893A' : theme.goldHex }}
        />
        <span className={isInline ? 'inline' : 'hidden sm:inline'}>توسيط</span>
      </button>

      <button
        type="button"
        data-testid="lineage-fullscreen-toggle-btn"
        onClick={onToggleFullscreen}
        title={
          isFullscreen
            ? 'إغلاق وضع العرض الكامل'
            : 'وضع العرض الكامل للمجالس'
        }
        className={`inline-flex items-center gap-1.5 ${
          isHeader
            ? 'px-2.5 py-1 rounded-lg text-[12px] bg-[#F5ECE0] hover:bg-[#EFE2D0] text-[#8C5327] border border-[#D4AF37]/45'
            : isInline
            ? 'px-2.5 py-1 rounded-lg text-[11.5px]'
            : 'px-3 py-1.5 rounded-xl text-xs'
        } font-display font-bold transition-colors cursor-pointer whitespace-nowrap`}
        style={
          isHeader
            ? undefined
            : {
                backgroundColor: theme.goldSoftBg,
                color: theme.accentTextHex,
                border: `1px solid ${theme.goldBorderHex}80`,
              }
        }
      >
        {isFullscreen ? (
          <>
            <Minimize2 className="w-3.5 h-3.5 shrink-0" />
            <span>إنهاء العرض</span>
          </>
        ) : (
          <>
            <Maximize2 className="w-3.5 h-3.5 shrink-0" />
            <span>عرض المجالس</span>
          </>
        )}
      </button>
    </div>
  );

  if (isInline) {
    return toolbarContent;
  }

  return (
    <div className="sticky bottom-3 z-30 flex justify-center pointer-events-none mt-5">
      {toolbarContent}
    </div>
  );
};

// ============================================================================
// 4. LUXURY REFERENCE LIBRARY («خزانة الشواهد والمصادر التاريخية الموثقة»)
// ============================================================================

interface LuxuryReferenceLibraryProps {
  familyName: string;
  isUnlocked: boolean;
  lockedSourcesCount: number;
  aggregatedSources: string[];
  verifiedAddonList: VerifiedAddonSourceItem[];
  unlockedAddonSourceIds: string[];
  localUnlockedAddonIds: string[];
  processingAddonKey: string | null;
  addonWalletWarning: string | null;
  onUnlockAddon: (addon: VerifiedAddonSourceItem, addonKey: string, priceUsd: number) => void;
  siblingBranches: string[];
  enrichedLocations: string[];
  selectedAncestor: UpperAncestorNode | null;
  onUpgradeAnnualVip: () => void;
  theme: LineageThemePalette;
  fontId: LineageFontId;
}

export const LuxuryReferenceLibrary: React.FC<LuxuryReferenceLibraryProps> = ({
  familyName,
  isUnlocked,
  lockedSourcesCount,
  aggregatedSources,
  verifiedAddonList,
  unlockedAddonSourceIds,
  localUnlockedAddonIds,
  processingAddonKey,
  addonWalletWarning,
  onUnlockAddon,
  siblingBranches,
  enrichedLocations,
  selectedAncestor,
  onUpgradeAnnualVip,
  theme,
  fontId,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const fontDef = getLineageFont(fontId);

  // Strict non-VIP locked & blurred paywall state (NEVER leaks real book titles in DOM!)
  if (!isUnlocked) {
    const safeCount = Math.max(1, lockedSourcesCount);
    return (
      <section
        data-testid="locked-blurred-sources-section"
        className="mt-10 pt-6 max-w-4xl mx-auto w-full relative z-20"
        style={{ borderTop: `1px solid ${theme.surfaceBorder}` }}
      >
        <div
          className="rounded-3xl p-5 sm:p-6 text-right space-y-5 relative overflow-hidden"
          style={{
            backgroundColor: theme.surfaceBg,
            border: `1.5px solid ${theme.goldBorderHex}90`,
            boxShadow: theme.isDark
              ? '0 10px 30px rgba(0,0,0,0.3)'
              : '0 8px 26px rgba(141,73,37,0.06)',
          }}
        >
          <div className="flex items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: theme.goldSoftBg,
                  border: `1.5px solid ${theme.goldBorderHex}`,
                  color: theme.accentHex,
                }}
              >
                <BookOpenCheck className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h3
                  className="text-base sm:text-lg font-display font-extrabold"
                  style={{ color: theme.textPrimaryHex }}
                >
                  خزانة الشواهد والمصادر التاريخية الموثقة ({safeCount}{' '}
                  {safeCount === 1 ? 'مرجع' : 'مراجع'})
                </h3>
                <p
                  className="text-xs font-medium mt-0.5 leading-relaxed"
                  style={{ color: theme.textMutedHex }}
                >
                  تم رصد وتوثيق المعاجم التاريخية وأرقام الأجزاء والصفحات الخاصة بعائلة {familyName}.
                </p>
              </div>
            </div>

            <span
              aria-label="خزانة المصادر مقفلة"
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{
                backgroundColor: theme.goldSoftBg,
                border: `1.5px solid ${theme.goldBorderHex}`,
                color: theme.accentHex,
              }}
            >
              <Lock className="w-4 h-4" />
            </span>
          </div>

          {/* Blurred Heritage Book Spine Previews (Zero Real Title Leakage) */}
          <div
            className="grid grid-cols-1 md:grid-cols-2 gap-3 select-none pointer-events-none"
            aria-hidden="true"
          >
            {Array.from({ length: Math.min(4, Math.max(2, safeCount)) }).map(
              (_, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl overflow-hidden flex items-stretch"
                  style={{
                    backgroundColor: theme.surfaceAltBg,
                    border: `1px solid ${theme.surfaceBorder}`,
                  }}
                >
                  <div
                    className="w-10 shrink-0 flex items-center justify-center font-mono text-xs font-bold tabular-nums"
                    style={{
                      backgroundColor: theme.goldSoftBg,
                      color: theme.accentTextHex,
                      borderLeft: `1px solid ${theme.goldBorderHex}55`,
                    }}
                  >
                    {String(idx + 1).padStart(2, '0')}
                  </div>
                  <div className="p-3.5 flex-1 min-w-0 space-y-1.5">
                    <div
                      className="text-xs font-bold blur-[5px]"
                      style={{ color: theme.textPrimaryHex }}
                    >
                      معجم القبائل والأنساب العربية الموثق في السجل — الطبعة المحققة
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="text-[11px] font-bold blur-[4px]"
                        style={{ color: theme.accentTextHex }}
                      >
                        ج{idx + 1} · ص{(idx + 1) * 74}
                      </span>
                      <span
                        className="text-[10px] font-semibold"
                        style={{ color: theme.textMutedHex }}
                      >
                        شاهد مرجعي معتمد
                      </span>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>

          <button
            type="button"
            onClick={onUpgradeAnnualVip}
            className="w-full py-3.5 px-5 rounded-xl text-xs sm:text-sm font-display font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2 text-center leading-relaxed shadow-xs"
            style={{
              backgroundColor: theme.buttonPrimaryBg,
              color: theme.buttonPrimaryText,
            }}
          >
            <Lock className="w-4 h-4 shrink-0" />
            <span>
              للاطلاع على أسماء الكتب والمخطوطات وأرقام الأجزاء والصفحات، رقِّ حسابك إلى الباقة السنوية (Premium)
            </span>
          </button>
        </div>
      </section>
    );
  }

  // Unlocked VIP / Researcher Luxury Archival Reference Library
  const parsedSources = aggregatedSources.map((src) =>
    parseHistoricalSourceCitation(src)
  );

  return (
    <section
      data-testid="luxury-reference-library"
      className="mt-10 pt-6 max-w-4xl mx-auto w-full relative z-20"
      style={{ borderTop: `1px solid ${theme.surfaceBorder}` }}
    >
      <div
        className="rounded-3xl p-5 sm:p-6 text-right space-y-5 transition-colors"
        style={{
          backgroundColor: theme.surfaceBg,
          border: `1.5px solid ${theme.goldBorderHex}75`,
          boxShadow: theme.isDark
            ? '0 10px 30px rgba(0,0,0,0.28)'
            : '0 6px 22px rgba(141,73,37,0.05)',
        }}
      >
        {/* Archival Wing Header */}
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="w-full flex items-center justify-between gap-4 text-right cursor-pointer"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                backgroundColor: theme.goldSoftBg,
                border: `1.5px solid ${theme.goldBorderHex}`,
                color: theme.accentHex,
              }}
            >
              <BookMarked className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3
                  className="text-base sm:text-lg font-display font-extrabold"
                  style={{ color: theme.textPrimaryHex }}
                >
                  خزانة الشواهد والمصادر التاريخية الموثقة
                </h3>
                <span
                  className="text-xs font-mono font-bold tabular-nums px-2.5 py-0.5 rounded-lg"
                  style={{
                    backgroundColor: theme.goldSoftBg,
                    color: theme.accentTextHex,
                    border: `1px solid ${theme.goldBorderHex}60`,
                  }}
                >
                  {parsedSources.length}{' '}
                  {parsedSources.length === 1 ? 'مرجع معتمد' : 'مراجع معتمدة'}
                </span>
              </div>
              <p
                className="text-xs mt-0.5"
                style={{ color: theme.textMutedHex }}
              >
                أمهات المعاجم والمشجرات المعتمدة في توثيق عمود نسب عائلة {familyName}
              </p>
            </div>
          </div>

          <span
            className="inline-flex items-center gap-1 text-xs font-display font-bold px-3 py-1.5 rounded-xl shrink-0 whitespace-nowrap"
            style={{
              backgroundColor: theme.surfaceAltBg,
              color: theme.textSecondaryHex,
              border: `1px solid ${theme.surfaceBorder}`,
            }}
          >
            <span>{isExpanded ? 'طيّ الخزانة' : 'فتح الخزانة'}</span>
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </span>
        </button>

        {isExpanded && (
          <div
            className="pt-5 space-y-5"
            style={{ borderTop: `1px solid ${theme.surfaceBorder}` }}
          >
            {/* Heritage Book Spine Cards — Responsive 2-Column Grid */}
            {parsedSources.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {parsedSources.map((src, idx) => (
                  <article
                    key={`${src.raw}-${idx}`}
                    data-testid={`heritage-book-spine-card-${idx}`}
                    className="rounded-2xl overflow-hidden flex items-stretch transition-all duration-150"
                    style={{
                      backgroundColor: theme.surfaceAltBg,
                      border: `1px solid ${theme.surfaceBorder}`,
                    }}
                  >
                    {/* Numbered Gilded Book Spine Side Strip */}
                    <div
                      className="w-11 shrink-0 flex flex-col items-center justify-between py-3 px-1 relative"
                      style={{
                        background: theme.isDark
                          ? 'linear-gradient(180deg, rgba(228,191,105,0.22) 0%, rgba(228,191,105,0.08) 100%)'
                          : 'linear-gradient(180deg, rgba(197,154,56,0.26) 0%, rgba(141,73,37,0.12) 100%)',
                        borderLeft: `1.5px solid ${theme.goldBorderHex}75`,
                      }}
                    >
                      <span
                        className="w-4 h-0.5 rounded-full"
                        style={{ backgroundColor: theme.goldHex }}
                      />
                      <span
                        className="text-xs font-mono font-extrabold tabular-nums"
                        style={{ color: theme.accentTextHex }}
                      >
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span
                        className="w-4 h-0.5 rounded-full"
                        style={{ backgroundColor: theme.goldHex }}
                      />
                    </div>

                    {/* Book Citation Body */}
                    <div className="p-3.5 flex-1 min-w-0 flex flex-col justify-between gap-2.5">
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <h4
                            className="text-sm font-bold leading-snug"
                            style={{
                              fontFamily: fontDef.cssFamily,
                              color: theme.textPrimaryHex,
                            }}
                          >
                            {src.title}
                          </h4>
                          {src.volumePageTag && (
                            <span
                              className="px-2 py-0.5 rounded-lg text-[11px] font-display font-extrabold shrink-0 whitespace-nowrap"
                              style={{
                                backgroundColor: theme.surfaceBg,
                                color: theme.accentTextHex,
                                border: `1px solid ${theme.goldBorderHex}80`,
                              }}
                            >
                              {src.volumePageTag}
                            </span>
                          )}
                        </div>
                        {src.author && (
                          <p
                            className="text-[11px] font-medium"
                            style={{ color: theme.textMutedHex }}
                          >
                            {src.author}
                          </p>
                        )}
                      </div>

                      <div
                        className="pt-2 flex items-center justify-between gap-2 text-[11px] font-display font-bold"
                        style={{
                          borderTop: `1px dashed ${theme.surfaceBorder}`,
                          color: theme.statusText,
                        }}
                      >
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>شاهد مرجعي معتمد ✓</span>
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div
                className="rounded-2xl px-4 py-3 text-xs font-semibold"
                style={{
                  backgroundColor: theme.surfaceAltBg,
                  border: `1px solid ${theme.surfaceBorder}`,
                  color: theme.textSecondaryHex,
                }}
              >
                توثيق مرجعي معتمد في شجرة آدم للأجداد والمصادر التاريخية المحققة.
              </div>
            )}

            {/* Verified Addon Sources (VERIFIED_ADDON_SOURCE) */}
            {verifiedAddonList.length > 0 && (
              <div
                data-testid="verified-addon-sources-customer-section"
                className="rounded-2xl p-4 space-y-3"
                style={{
                  backgroundColor: theme.goldSoftBg,
                  border: `1.5px solid ${theme.goldBorderHex}80`,
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles
                      className="w-4 h-4 shrink-0"
                      style={{ color: theme.goldHex }}
                    />
                    <span
                      className="text-xs sm:text-sm font-display font-extrabold"
                      style={{ color: theme.textPrimaryHex }}
                    >
                      مراجع تاريخية إضافية موثقة من فريق الخبراء (قابلة للفتح عبر المحفظة)
                    </span>
                  </div>
                  <span
                    className="text-[11px] font-mono font-bold tabular-nums"
                    style={{ color: theme.accentTextHex }}
                  >
                    {verifiedAddonList.length} مراجع إضافية
                  </span>
                </div>

                {addonWalletWarning && (
                  <div className="rounded-xl bg-amber-100 border border-amber-400 px-3 py-2 text-xs font-bold text-amber-950">
                    {addonWalletWarning}
                  </div>
                )}

                <div className="space-y-2.5">
                  {verifiedAddonList.map((addon, aIdx) => {
                    const addonKey = `${addon.attached_to_node}::${addon.source_id}::${addon.volume}::${addon.page}`;
                    const isAddonUnlocked =
                      unlockedAddonSourceIds.includes(addonKey) ||
                      unlockedAddonSourceIds.includes(addon.source_id) ||
                      localUnlockedAddonIds.includes(addonKey);
                    const priceUsd =
                      typeof addon.addon_unlock_price_usd === 'number' &&
                      addon.addon_unlock_price_usd > 0
                        ? addon.addon_unlock_price_usd
                        : 2;

                    return (
                      <div
                        key={addonKey || aIdx}
                        data-testid={`verified-addon-source-item-${aIdx}`}
                        className="rounded-xl p-3.5 space-y-2"
                        style={{
                          backgroundColor: theme.surfaceBg,
                          border: `1px solid ${theme.goldBorderHex}75`,
                        }}
                      >
                        {isAddonUnlocked ? (
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className="px-2 py-0.5 rounded font-mono text-[10px] font-bold"
                                  style={{
                                    backgroundColor: theme.statusBg,
                                    color: theme.statusText,
                                    border: `1px solid ${theme.statusBorder}`,
                                  }}
                                >
                                  [{addon.source_id}]
                                </span>
                                <span
                                  className="text-xs sm:text-sm font-display font-extrabold"
                                  style={{ color: theme.textPrimaryHex }}
                                >
                                  {addon.canonical_title}
                                </span>
                                {addon.author && (
                                  <span
                                    className="text-[11px] font-semibold"
                                    style={{ color: theme.textMutedHex }}
                                  >
                                    — {addon.author}
                                  </span>
                                )}
                              </div>
                              <span
                                className="text-[11px] font-display font-bold"
                                style={{ color: theme.statusText }}
                              >
                                تم الفتح من المحفظة ✓
                              </span>
                            </div>
                            <div
                              className="flex flex-wrap items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg"
                              style={{
                                backgroundColor: theme.surfaceAltBg,
                                color: theme.textSecondaryHex,
                              }}
                            >
                              <span>الجزء: {addon.volume || '—'}</span>
                              <span>·</span>
                              <span>الصفحة: {addon.page || '—'}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className="px-2 py-0.5 rounded font-mono text-[10px] font-bold"
                                  style={{
                                    backgroundColor: theme.goldSoftBg,
                                    color: theme.accentTextHex,
                                  }}
                                >
                                  [{addon.source_id}]
                                </span>
                                <span
                                  className="text-xs sm:text-sm font-display font-extrabold"
                                  style={{ color: theme.textPrimaryHex }}
                                >
                                  مرجع تاريخي إضافي موثق في السجل الموحد
                                </span>
                              </div>
                              <p
                                className="text-[11px] font-medium"
                                style={{ color: theme.textMutedHex }}
                              >
                                تم التحقق من هذا المصدر الثانوي ومطابقته مع العقدة ({addon.linked_record_name || familyName}) بواسطة فريق الخبراء.
                              </p>
                            </div>

                            <button
                              type="button"
                              disabled={processingAddonKey === addonKey}
                              data-testid={`unlock-verified-addon-btn-${aIdx}`}
                              onClick={() =>
                                onUnlockAddon(addon, addonKey, priceUsd)
                              }
                              className="px-3.5 py-2 rounded-xl text-xs font-display font-extrabold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
                              style={{
                                backgroundColor: theme.buttonPrimaryBg,
                                color: theme.buttonPrimaryText,
                              }}
                            >
                              <span>
                                {processingAddonKey === addonKey
                                  ? 'جاري الفتح...'
                                  : `فتح المرجع ورقم الصفحة ($${priceUsd})`}
                              </span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sibling Branches & Enriched Locations */}
            {(siblingBranches.length > 0 || enrichedLocations.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {siblingBranches.length > 0 && (
                  <div
                    className="rounded-2xl p-3.5 space-y-2"
                    style={{
                      backgroundColor: theme.surfaceAltBg,
                      border: `1px solid ${theme.surfaceBorder}`,
                    }}
                  >
                    <div
                      className="text-xs font-display font-extrabold"
                      style={{ color: theme.textPrimaryHex }}
                    >
                      الفروع الشقيقة المرصودة ({siblingBranches.length})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {siblingBranches.map((branch, idx) => (
                        <span
                          key={`${branch}-${idx}`}
                          className="px-2.5 py-1 rounded-lg text-xs font-display font-bold"
                          style={{
                            backgroundColor: theme.surfaceBg,
                            border: `1px solid ${theme.surfaceBorder}`,
                            color: theme.textPrimaryHex,
                          }}
                        >
                          {branch}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {enrichedLocations.length > 0 && (
                  <div
                    className="rounded-2xl p-3.5 space-y-2"
                    style={{
                      backgroundColor: theme.surfaceAltBg,
                      border: `1px solid ${theme.surfaceBorder}`,
                    }}
                  >
                    <div
                      className="text-xs font-display font-extrabold"
                      style={{ color: theme.textPrimaryHex }}
                    >
                      المواضع والديار الجغرافية الموثقة
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {enrichedLocations.map((loc, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold"
                          style={{
                            backgroundColor: theme.surfaceBg,
                            border: `1px solid ${theme.surfaceBorder}`,
                            color: theme.textPrimaryHex,
                          }}
                        >
                          <MapPin
                            className="w-3 h-3 shrink-0"
                            style={{ color: theme.goldHex }}
                          />
                          <span>{loc}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Selected Ancestor Historical Illumination */}
            {selectedAncestor && (
              <div
                className="rounded-2xl p-4 space-y-1.5"
                style={{
                  backgroundColor: theme.goldSoftBg,
                  border: `1px solid ${theme.goldBorderHex}75`,
                }}
              >
                <div
                  className="text-xs font-display font-extrabold"
                  style={{ color: theme.accentTextHex }}
                >
                  إضاءة تاريخية على العقدة المختارة ({selectedAncestor.name})
                </div>
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: theme.textSecondaryHex }}
                >
                  {selectedAncestor.eraNote ||
                    'محطة نسب موثقة ضمن التسلسل التاريخي المعتمد.'}
                </p>
                {selectedAncestor.region && (
                  <div
                    className="flex items-center gap-1.5 text-xs font-semibold pt-0.5"
                    style={{ color: theme.accentTextHex }}
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{selectedAncestor.region}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
