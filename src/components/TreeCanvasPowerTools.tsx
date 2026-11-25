import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  GitFork,
  LocateFixed,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Search,
  Sparkles,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { WorkspaceIconTooltip } from './UnifiedWorkspaceHeader';
import type {
  KinshipPathResult,
  PedigreePersonLike,
} from '../utils/familyTreeLayout';
import type { TreeCardThemeDefinition } from '../utils/treeStudioConfig';

function normalizeArabicForSearch(text: string): string {
  return (text || '')
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '');
}

// ============================================================================
// 1. SMART NODE SEARCH & SPOTLIGHT RADAR
// ============================================================================
export interface SearchableTreePerson {
  id: string;
  firstName: string;
  epithet?: string;
  kunya?: string;
  honorificTitle?: string;
  relationToTargetLabel?: string;
  generationLevel: number;
  gender: 'male' | 'female';
}

interface TreeSmartNodeSearchProps {
  people: SearchableTreePerson[];
  onSelectPerson: (personId: string) => void;
  /** When true, renders as a compact 40px search lens icon that smoothly expands on click */
  expandable?: boolean;
}

export const TreeSmartNodeSearch: React.FC<TreeSmartNodeSearchProps> = ({
  people,
  onSelectPerson,
  expandable = false,
}) => {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const matches = useMemo(() => {
    const q = normalizeArabicForSearch(query);
    if (!q) return [];
    return people
      .filter((p) => {
        const hay = normalizeArabicForSearch(
          `${p.honorificTitle && p.honorificTitle !== 'بدون' ? p.honorificTitle : ''} ${p.firstName} ${p.epithet || ''} ${p.kunya || ''} ${p.relationToTargetLabel || ''}`
        );
        return hay.includes(q);
      })
      .slice(0, 8);
  }, [people, query]);

  const showInput = !expandable || isExpanded || query.length > 0;

  return (
    <div
      className={
        expandable
          ? `relative transition-all duration-200 ease-out shrink-0 ${
              showInput ? 'w-48' : 'w-10'
            }`
          : 'relative w-full sm:w-[205px] xl:w-[225px]'
      }
      data-testid="tree-smart-search"
    >
      {expandable && !showInput ? (
        <WorkspaceIconTooltip label="البحث عن فرد في الشجرة" placement="bottom">
          <button
            type="button"
            data-testid="tree-smart-search-expand-btn"
            onClick={() => {
              setIsExpanded(true);
              window.setTimeout(() => inputRef.current?.focus(), 20);
            }}
            aria-label="البحث عن فرد في الشجرة"
            className="h-10 w-10 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] text-[#D97757] border border-[#D8C7B2] shadow-2xs inline-flex items-center justify-center transition-all cursor-pointer"
          >
            <Search className="w-4 h-4 text-[#D97757]" />
          </button>
        </WorkspaceIconTooltip>
      ) : (
        <div className="relative flex items-center">
          <Search
            className={`w-3.5 h-3.5 absolute right-3 pointer-events-none ${
              expandable ? 'text-[#D97757]' : 'text-[#D97757]/70'
            }`}
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onFocus={() => setIsFocused(true)}
            onBlur={() =>
              window.setTimeout(() => {
                setIsFocused(false);
                if (expandable && !query.trim()) {
                  setIsExpanded(false);
                }
              }, 180)
            }
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setQuery('');
                setIsFocused(false);
                if (expandable) setIsExpanded(false);
                inputRef.current?.blur();
              }
            }}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={expandable ? 'ابحث عن فرد...' : 'ابحث عن فرد في الشجرة...'}
            aria-label="ابحث عن فرد في الشجرة"
            data-testid="tree-smart-search-input"
            className={
              expandable
                ? 'w-full h-10 pr-8 pl-7 rounded-xl bg-[#F5F1E8] border border-[#D97757] shadow-2xs outline-none text-xs font-display font-semibold text-[#1F1F1C] placeholder:text-[#D97757]/70 transition-all'
                : 'w-full pr-8 pl-7 py-1.5 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] focus:bg-[#F5F1E8] border border-[#D97757]/40 focus:border-[#D97757] outline-none text-[11.5px] font-display font-semibold text-[#1F1F1C] placeholder:text-[#1F1F1C]/50 transition-colors'
            }
          />
          {(query || expandable) && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setQuery('');
                setIsFocused(false);
                if (expandable) setIsExpanded(false);
              }}
              aria-label={query ? 'مسح البحث' : 'إغلاق البحث'}
              className="absolute left-2.5 text-[#D97757] hover:text-[#D97757] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {isFocused && query.trim().length > 0 && (
        <div
          data-testid="tree-smart-search-dropdown"
          className={`absolute top-full mt-1.5 z-50 rounded-2xl bg-[#F5F1E8] border border-[#D97757]/60 shadow-xl overflow-hidden ${
            expandable ? 'right-0 w-64' : 'inset-x-0'
          }`}
        >
          {matches.length === 0 ? (
            <div className="px-3 py-3 text-[11px] text-[#1F1F1C]/60 text-center font-display">
              لا توجد مطابقة للاسم «{query}»
            </div>
          ) : (
            <ul className="max-h-60 overflow-y-auto divide-y divide-[#D8C7B2]">
              {matches.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onSelectPerson(p.id);
                      setQuery('');
                      setIsFocused(false);
                      if (expandable) setIsExpanded(false);
                    }}
                    className="w-full px-3 py-2 text-right hover:bg-[#F5F1E8] flex items-center justify-between gap-2 transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-display font-extrabold text-[#1F1F1C] truncate">
                        {p.honorificTitle && p.honorificTitle !== 'بدون'
                          ? `${p.honorificTitle} `
                          : ''}
                        {p.firstName}
                      </div>
                      {(p.epithet || p.kunya) && (
                        <div className="text-[10px] text-[#D97757] truncate">
                          {p.epithet && (
                            <span className="font-semibold text-[#D97757]">
                              {p.epithet}
                            </span>
                          )}
                          {p.epithet && p.kunya && (
                            <span className="mx-1 text-[#D97757]/80">·</span>
                          )}
                          {p.kunya && <span>{p.kunya}</span>}
                        </div>
                      )}
                    </div>
                    <span className="text-[9.5px] font-bold text-[#1F1F1C]/55 shrink-0 truncate max-w-[85px]">
                      {p.relationToTargetLabel || 'فرد'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 2. FLOATING GLASS STUDIO DOCK (ZOOM, FIT & CENTER, CINEMA MODE, MINIMAP)
// ============================================================================
interface TreeFloatingStudioDockProps {
  zoomPercent: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFitAndCenter: () => void;
  isAutoFitActive?: boolean;
  isCinemaMode: boolean;
  onToggleCinemaMode: () => void;
  showMinimap: boolean;
  onToggleMinimap: () => void;
  isDarkSurface: boolean;
  variant?: 'floating' | 'inline' | 'header';
}

export const TreeFloatingStudioDock: React.FC<TreeFloatingStudioDockProps> = ({
  zoomPercent,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitAndCenter,
  isAutoFitActive = false,
  isCinemaMode,
  onToggleCinemaMode,
  showMinimap,
  onToggleMinimap,
  isDarkSurface,
  variant = 'floating',
}) => {
  const isHeader = variant === 'header';
  const isInline = variant === 'inline' || isHeader;
  const useDarkPalette = !isInline && isDarkSurface;
  const tooltipPlacement = isInline ? 'bottom' : 'top';

  return (
    <div
      data-testid={
        isInline ? 'tree-inline-studio-dock' : 'tree-floating-studio-dock'
      }
      className={`inline-flex items-center transition-colors ${
        isHeader
          ? 'h-10 gap-0.5 px-1.5 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] text-[#1F1F1C] shadow-2xs'
          : isInline
          ? 'gap-0.5 px-1.5 py-1 rounded-xl bg-[#F5F1E8]/95 border border-[#D8C7B2] text-[#1F1F1C] shadow-2xs'
          : useDarkPalette
          ? 'gap-1 px-2 py-1.5 rounded-2xl backdrop-blur-md border shadow-lg bg-[#1F1F1C]/88 border-[#D8C7B2]/45 text-[#F5F1E8]'
          : 'gap-1 px-2 py-1.5 rounded-2xl backdrop-blur-md border shadow-lg bg-[#F5F1E8]/92 border-[#D8C7B2] text-[#1F1F1C]'
      }`}
    >
      <WorkspaceIconTooltip label="تصغير العرض" placement={tooltipPlacement}>
        <button
          type="button"
          onClick={onZoomOut}
          aria-label="تصغير عرض الشجرة"
          className={`w-8 h-8 rounded-lg inline-flex items-center justify-center transition-colors cursor-pointer ${
            useDarkPalette
              ? 'hover:bg-[#F5F1E8]/10 text-[#F5F1E8]'
              : 'hover:bg-[#E8DED2] text-[#1F1F1C]'
          }`}
        >
          <ZoomOut className="w-4 h-4" />
        </button>
      </WorkspaceIconTooltip>

      <WorkspaceIconTooltip
        label="إعادة التكبير إلى 100%"
        placement={tooltipPlacement}
      >
        <button
          type="button"
          onClick={onResetZoom}
          aria-label="إعادة التكبير إلى 100%"
          className="px-1 py-1 rounded-lg text-[11.5px] font-mono font-bold tabular-nums min-w-[38px] text-center text-[#D97757] hover:bg-[#E8DED2] transition-colors cursor-pointer"
          dir="ltr"
        >
          {zoomPercent}%
        </button>
      </WorkspaceIconTooltip>

      <WorkspaceIconTooltip label="تكبير العرض" placement={tooltipPlacement}>
        <button
          type="button"
          onClick={onZoomIn}
          aria-label="تكبير عرض الشجرة"
          className={`w-8 h-8 rounded-lg inline-flex items-center justify-center transition-colors cursor-pointer ${
            useDarkPalette
              ? 'hover:bg-[#F5F1E8]/10 text-[#F5F1E8]'
              : 'hover:bg-[#E8DED2] text-[#1F1F1C]'
          }`}
        >
          <ZoomIn className="w-4 h-4" />
        </button>
      </WorkspaceIconTooltip>

      <span
        aria-hidden="true"
        className={`w-px h-4 mx-1 ${
          useDarkPalette ? 'bg-[#F5F1E8]/15' : 'bg-[#D8C7B2]'
        }`}
      />

      <WorkspaceIconTooltip
        label={
          isAutoFitActive
            ? 'توسيط واحتواء الشجرة (مفعّل)'
            : 'توسيط واحتواء الشجرة'
        }
        placement={tooltipPlacement}
      >
        <button
          type="button"
          data-testid="canvas-fit-center-btn"
          aria-pressed={isAutoFitActive}
          onClick={onFitAndCenter}
          aria-label="توسيط واحتواء الشجرة"
          className={`w-8 h-8 rounded-lg inline-flex items-center justify-center transition-colors cursor-pointer border ${
            isAutoFitActive
              ? useDarkPalette
                ? 'bg-[#D97757]/20 text-[#D97757] border-[#D8C7B2]/45 shadow-2xs'
                : 'bg-[#E8DED2] text-[#D97757] border-[#D8C7B2]'
              : useDarkPalette
              ? 'border-transparent hover:bg-[#F5F1E8]/10 text-[#D97757]'
              : 'border-transparent hover:bg-[#E8DED2] text-[#D97757]'
          }`}
        >
          <LocateFixed className="w-4 h-4 shrink-0" />
        </button>
      </WorkspaceIconTooltip>

      <WorkspaceIconTooltip
        label={showMinimap ? 'إخفاء الخريطة المصغرة' : 'الخريطة المصغرة'}
        placement={tooltipPlacement}
      >
        <button
          type="button"
          data-testid="canvas-minimap-toggle-btn"
          aria-pressed={showMinimap}
          onClick={onToggleMinimap}
          aria-label={
            showMinimap ? 'إخفاء الخريطة المصغرة' : 'الخريطة المصغرة'
          }
          className={`w-8 h-8 rounded-lg inline-flex items-center justify-center transition-colors cursor-pointer ${
            showMinimap
              ? 'bg-[#D97757] text-[#F5F1E8] shadow-2xs'
              : useDarkPalette
              ? 'hover:bg-[#F5F1E8]/10 text-[#F5F1E8]'
              : 'hover:bg-[#E8DED2] text-[#D97757]'
          }`}
        >
          <MapIcon className="w-4 h-4 shrink-0" />
        </button>
      </WorkspaceIconTooltip>

      <span
        aria-hidden="true"
        className={`w-px h-4 mx-1 ${
          useDarkPalette ? 'bg-[#F5F1E8]/15' : 'bg-[#D8C7B2]'
        }`}
      />

      <WorkspaceIconTooltip
        label={isCinemaMode ? 'إنهاء عرض المجالس' : 'عرض المجالس (شاشة كاملة)'}
        placement={tooltipPlacement}
      >
        <button
          type="button"
          data-testid="canvas-cinema-mode-btn"
          aria-pressed={isCinemaMode}
          onClick={onToggleCinemaMode}
          aria-label={
            isCinemaMode ? 'إنهاء عرض المجالس' : 'عرض المجالس (شاشة كاملة)'
          }
          className={`w-8 h-8 rounded-lg inline-flex items-center justify-center transition-colors cursor-pointer ${
            isCinemaMode
              ? 'bg-[#D97757] text-[#F5F1E8] shadow-2xs'
              : 'bg-[#E8DED2] hover:bg-[#D8C7B2]/60 text-[#D97757] border border-[#D8C7B2]/55'
          }`}
        >
          {isCinemaMode ? (
            <Minimize2 className="w-4 h-4 shrink-0" />
          ) : (
            <Maximize2 className="w-4 h-4 shrink-0" />
          )}
        </button>
      </WorkspaceIconTooltip>
    </div>
  );
};

// ============================================================================
// 3. INTERACTIVE MINIMAP WIDGET
// ============================================================================
interface TreeInteractiveMinimapProps {
  people: Array<{
    id: string;
    firstName: string;
    generationLevel: number;
    isRecordKeeper?: boolean;
  }>;
  highlightedIds: Set<string>;
  theme: TreeCardThemeDefinition;
  onJumpToPerson: (personId: string) => void;
  onClose: () => void;
}

export const TreeInteractiveMinimap: React.FC<TreeInteractiveMinimapProps> = ({
  people,
  highlightedIds,
  theme,
  onJumpToPerson,
  onClose,
}) => {
  const generations = useMemo(() => {
    const map = new Map<
      number,
      Array<{ id: string; firstName: string; isRecordKeeper?: boolean }>
    >();
    people.forEach((p) => {
      const list = map.get(p.generationLevel) || [];
      list.push(p);
      map.set(p.generationLevel, list);
    });
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0]);
  }, [people]);

  const width = 188;
  const height = 112;
  const rowStep = height / Math.max(1, generations.length + 1);

  return (
    <div
      data-testid="tree-interactive-minimap"
      className={`w-[206px] rounded-2xl border shadow-xl backdrop-blur-md p-2 transition-colors ${
        theme.isDarkSurface
          ? 'bg-[#1F1F1C]/92 border-[#D8C7B2]/45 text-[#F5F1E8]'
          : 'bg-[#F5F1E8]/95 border-[#D97757]/50 text-[#1F1F1C]'
      }`}
    >
      <div className="flex items-center justify-between gap-2 pb-1 mb-1 border-b border-[#D97757]/20">
        <span className="text-[10px] font-display font-extrabold inline-flex items-center gap-1">
          <MapIcon className="w-3 h-3 text-[#D97757]" />
          <span>الخريطة المصغرة ({people.length})</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق الخريطة المصغرة"
          className="p-0.5 rounded hover:bg-[#F5F1E8]/30 cursor-pointer"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto rounded-xl"
        style={{ backgroundColor: theme.canvasBg }}
      >
        {generations.map(([, rowPeople], rIdx) => {
          const y = (rIdx + 1) * rowStep;
          const colStep = width / Math.max(1, rowPeople.length + 1);
          return (
            <g key={`mm-row-${rIdx}`}>
              {rIdx > 0 && (
                <line
                  x1={14}
                  y1={y - rowStep / 2}
                  x2={width - 14}
                  y2={y - rowStep / 2}
                  stroke={theme.cardStrokeHex}
                  strokeOpacity="0.25"
                  strokeDasharray="2 2"
                />
              )}
              {rowPeople.map((p, cIdx) => {
                const x = (cIdx + 1) * colStep;
                const isHl = highlightedIds.has(p.id);
                return (
                  <g
                    key={p.id}
                    onClick={() => onJumpToPerson(p.id)}
                    className="cursor-pointer"
                  >
                    <title>{p.firstName}</title>
                    <circle
                      cx={x}
                      cy={y}
                      r={p.isRecordKeeper ? 4.8 : isHl ? 4.2 : 3.2}
                      fill={
                        isHl
                          ? '#D97757'
                          : p.isRecordKeeper
                          ? theme.primaryHex
                          : theme.goldAccentHex
                      }
                      stroke={theme.isDarkSurface ? '#1F1F1C' : '#F5F1E8'}
                      strokeWidth="1"
                    />
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      <div className="text-[9px] text-center opacity-70 mt-1 font-display">
        انقر على أي نقطة للانتقال والتركيز الفوري
      </div>
    </div>
  );
};

// ============================================================================
// 4. KINSHIP PATH CALCULATOR MODAL (`حاسبة وكاشف صلة القرابة الذكي`)
// ============================================================================
interface TreeKinshipCalculatorModalProps<T extends PedigreePersonLike> {
  isOpen: boolean;
  onClose: () => void;
  people: T[];
  personAId: string;
  personBId: string;
  onChangePersonA: (id: string) => void;
  onChangePersonB: (id: string) => void;
  result: KinshipPathResult<T> | null;
  isPathHighlightedOnCanvas: boolean;
  onApplyHighlightOnCanvas: () => void;
  onClearHighlightOnCanvas: () => void;
}

export function TreeKinshipCalculatorModal<T extends PedigreePersonLike>({
  isOpen,
  onClose,
  people,
  personAId,
  personBId,
  onChangePersonA,
  onChangePersonB,
  result,
  isPathHighlightedOnCanvas,
  onApplyHighlightOnCanvas,
  onClearHighlightOnCanvas,
}: TreeKinshipCalculatorModalProps<T>) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] bg-[#1F1F1C]/55 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="حاسبة صلة القرابة بين فردين"
    >
      <div
        dir="rtl"
        data-testid="kinship-calculator-modal"
        className="bg-[#F5F1E8] border-2 border-[#D97757] rounded-3xl max-w-lg w-full p-5 sm:p-6 space-y-4 text-right shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[#D8C7B2] pb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-2xl bg-[#F5F1E8] border border-[#D97757]/45 flex items-center justify-center text-[#D97757]">
              <GitFork className="w-4 h-4 text-[#D97757]" />
            </span>
            <div>
              <h4 className="text-sm sm:text-base font-display font-extrabold text-[#1F1F1C]">
                كاشف وحاسبة صلة القرابة الذكي
              </h4>
              <p className="text-[11px] text-[#1F1F1C]/65">
                اختر فردين لاكتشاف الجد الجامع وإضاءة المسار النسبي بالذهب
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-[#F5F1E8] hover:bg-[#E8DED2] flex items-center justify-center text-[#1F1F1C] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-end gap-2.5">
          <div className="space-y-1">
            <label
              htmlFor="kinship-person-a"
              className="text-[11px] font-display font-extrabold text-[#D97757] block"
            >
              الفرد الأول
            </label>
            <select
              id="kinship-person-a"
              data-testid="kinship-select-a"
              value={personAId}
              onChange={(e) => onChangePersonA(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] focus:border-[#D97757] outline-none text-xs font-display font-bold text-[#1F1F1C]"
            >
              <option value="">اختر الفرد الأول...</option>
              {people.map((p) => (
                <option key={`ka-${p.id}`} value={p.id}>
                  {p.firstName}
                  {p.isRecordKeeper ? ' (أمين السجل)' : ''}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              const tmp = personAId;
              onChangePersonA(personBId);
              onChangePersonB(tmp);
            }}
            title="تبديل الفردين"
            className="w-9 h-9 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] flex items-center justify-center text-[#D97757] cursor-pointer self-center sm:self-end"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>

          <div className="space-y-1">
            <label
              htmlFor="kinship-person-b"
              className="text-[11px] font-display font-extrabold text-[#D97757] block"
            >
              الفرد الثاني
            </label>
            <select
              id="kinship-person-b"
              data-testid="kinship-select-b"
              value={personBId}
              onChange={(e) => onChangePersonB(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] focus:border-[#D97757] outline-none text-xs font-display font-bold text-[#1F1F1C]"
            >
              <option value="">اختر الفرد الثاني...</option>
              {people.map((p) => (
                <option key={`kb-${p.id}`} value={p.id}>
                  {p.firstName}
                  {p.isRecordKeeper ? ' (أمين السجل)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Result Card */}
        {result && personAId && personBId && (
          <div
            data-testid="kinship-result-card"
            className={`rounded-2xl border p-4 space-y-2.5 ${
              result.connected
                ? 'bg-gradient-to-br from-[#F5F1E8] to-[#E8DED2] border-[#D8C7B2]/80'
                : 'bg-[#F5F1E8] border-[#D8C7B2]'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-display font-extrabold text-[#D97757] inline-flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#D97757]" />
                <span>العلاقة النسبية: {result.relationshipLabel}</span>
              </div>
              {result.connected && result.degreeCount > 0 && (
                <span className="text-[11px] font-mono font-bold text-[#D97757] tabular-nums">
                  {result.degreeCount}{' '}
                  {result.degreeCount === 1 ? 'درجة' : 'درجات'}
                </span>
              )}
            </div>

            {result.commonAncestor && (
              <div className="text-xs text-[#1F1F1C] font-display">
                الجد الجامع:{' '}
                <strong className="text-[#D97757]">
                  {result.commonAncestor.firstName}
                </strong>
              </div>
            )}

            {result.pathNodes.length > 1 && (
              <div className="pt-2 border-t border-[#D8C7B2]/30 flex flex-wrap items-center gap-1.5 text-[11px] font-display font-bold text-[#1F1F1C]">
                {result.pathNodes.map((n, idx) => (
                  <React.Fragment key={`kp-${n.id}`}>
                    <span
                      className={`px-2 py-0.5 rounded-lg border ${
                        n.id === result.commonAncestor?.id
                          ? 'bg-[#D97757]/25 border-[#D8C7B2] text-[#D97757]'
                          : 'bg-[#F5F1E8] border-[#D8C7B2]'
                      }`}
                    >
                      {n.firstName}
                    </span>
                    {idx < result.pathNodes.length - 1 && (
                      <span className="text-[#D97757]">←</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#D8C7B2]">
          {isPathHighlightedOnCanvas ? (
            <button
              type="button"
              onClick={onClearHighlightOnCanvas}
              className="px-3.5 py-2 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] text-xs font-display font-bold text-[#D97757] cursor-pointer"
            >
              إلغاء الإضاءة الذهبية
            </button>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#F5F1E8] text-xs font-display font-bold text-[#1F1F1C] cursor-pointer"
            >
              إغلاق
            </button>
            {result?.connected && result.pathNodes.length > 0 && (
              <button
                type="button"
                data-testid="kinship-highlight-canvas-btn"
                onClick={() => {
                  onApplyHighlightOnCanvas();
                  onClose();
                }}
                className="px-4 py-2 rounded-xl bg-[#D97757] hover:bg-[#D97757]/90 text-[#F5F1E8] text-xs font-display font-extrabold cursor-pointer transition-colors shadow-2xs"
              >
                إضاءة المسار على الشجرة ✦
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
