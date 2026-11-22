import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  GitFork,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Scan,
  Search,
  Sparkles,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
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
}

export const TreeSmartNodeSearch: React.FC<TreeSmartNodeSearchProps> = ({
  people,
  onSelectPerson,
}) => {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

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

  return (
    <div
      className="relative w-full sm:w-[205px] xl:w-[225px]"
      data-testid="tree-smart-search"
    >
      <div className="relative flex items-center">
        <Search className="w-3.5 h-3.5 text-[#8D4925]/70 absolute right-2.5 pointer-events-none" />
        <input
          type="text"
          value={query}
          onFocus={() => setIsFocused(true)}
          onBlur={() => window.setTimeout(() => setIsFocused(false), 180)}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث عن فرد في الشجرة..."
          aria-label="ابحث عن فرد في الشجرة"
          data-testid="tree-smart-search-input"
          className="w-full pr-8 pl-7 py-1.5 rounded-xl bg-[#FAF6F0] hover:bg-white focus:bg-white border border-[#B98A78]/40 focus:border-[#D8755B] outline-none text-[11.5px] font-display font-semibold text-[#252321] placeholder:text-[#252321]/50 transition-colors"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="مسح البحث"
            className="absolute left-2 text-[#252321]/50 hover:text-[#8D4925] cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {isFocused && query.trim().length > 0 && (
        <div
          data-testid="tree-smart-search-dropdown"
          className="absolute top-full mt-1.5 inset-x-0 z-50 rounded-2xl bg-white border border-[#C5A059]/60 shadow-xl overflow-hidden"
        >
          {matches.length === 0 ? (
            <div className="px-3 py-3 text-[11px] text-[#252321]/60 text-center font-display">
              لا توجد مطابقة للاسم «{query}»
            </div>
          ) : (
            <ul className="max-h-60 overflow-y-auto divide-y divide-[#F0EAE0]">
              {matches.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onSelectPerson(p.id);
                      setQuery('');
                      setIsFocused(false);
                    }}
                    className="w-full px-3 py-2 text-right hover:bg-[#FAF6F0] flex items-center justify-between gap-2 transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-display font-extrabold text-[#252321] truncate">
                        {p.honorificTitle && p.honorificTitle !== 'بدون'
                          ? `${p.honorificTitle} `
                          : ''}
                        {p.firstName}
                      </div>
                      {(p.epithet || p.kunya) && (
                        <div className="text-[10px] text-[#8D4925] truncate">
                          {p.epithet && (
                            <span className="font-semibold text-[#9A6B25]">
                              {p.epithet}
                            </span>
                          )}
                          {p.epithet && p.kunya && (
                            <span className="mx-1 text-[#C59B27]/80">·</span>
                          )}
                          {p.kunya && <span>{p.kunya}</span>}
                        </div>
                      )}
                    </div>
                    <span className="text-[9.5px] font-bold text-[#252321]/55 shrink-0 truncate max-w-[85px]">
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
  isCinemaMode: boolean;
  onToggleCinemaMode: () => void;
  showMinimap: boolean;
  onToggleMinimap: () => void;
  isDarkSurface: boolean;
  variant?: 'floating' | 'inline';
}

export const TreeFloatingStudioDock: React.FC<TreeFloatingStudioDockProps> = ({
  zoomPercent,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitAndCenter,
  isCinemaMode,
  onToggleCinemaMode,
  showMinimap,
  onToggleMinimap,
  isDarkSurface,
  variant = 'floating',
}) => {
  const isInline = variant === 'inline';
  const useDarkPalette = !isInline && isDarkSurface;

  return (
    <div
      data-testid={
        isInline ? 'tree-inline-studio-dock' : 'tree-floating-studio-dock'
      }
      className={`inline-flex items-center gap-0.5 sm:gap-1 transition-colors ${
        isInline
          ? 'px-1.5 py-1 rounded-xl bg-[#FAF6F0]/95 border border-[#D4AF37]/30 text-[#252321] shadow-2xs'
          : useDarkPalette
          ? 'px-2 py-1.5 rounded-2xl backdrop-blur-md border shadow-lg bg-[#211C17]/88 border-[#D4AF37]/45 text-[#FAF3E3]'
          : 'px-2 py-1.5 rounded-2xl backdrop-blur-md border shadow-lg bg-white/92 border-[#B98A78]/45 text-[#252321]'
      }`}
    >
      <button
        type="button"
        onClick={onZoomOut}
        title="تصغير (-)"
        aria-label="تصغير عرض الشجرة"
        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
          useDarkPalette
            ? 'hover:bg-white/10'
            : isInline
            ? 'hover:bg-white text-[#5A4637]'
            : 'hover:bg-[#FAF6F0]'
        }`}
      >
        <ZoomOut className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={onResetZoom}
        title="إعادة التكبير إلى 100%"
        className="px-1.5 py-1 rounded-lg text-[11px] font-mono font-bold tabular-nums hover:text-[#D8755B] transition-colors cursor-pointer"
      >
        {zoomPercent}%
      </button>

      <button
        type="button"
        onClick={onZoomIn}
        title="تكبير (+)"
        aria-label="تكبير عرض الشجرة"
        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
          useDarkPalette
            ? 'hover:bg-white/10'
            : isInline
            ? 'hover:bg-white text-[#5A4637]'
            : 'hover:bg-[#FAF6F0]'
        }`}
      >
        <ZoomIn className="w-3.5 h-3.5" />
      </button>

      <span
        aria-hidden="true"
        className={`w-px h-4 mx-0.5 ${
          useDarkPalette ? 'bg-white/15' : 'bg-[#C59B27]/30'
        }`}
      />

      <button
        type="button"
        data-testid="canvas-fit-center-btn"
        onClick={onFitAndCenter}
        title="احتواء وتوسيط الشجرة الكاملة"
        className={`px-2 py-1 rounded-lg text-[11px] font-display font-bold inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
          useDarkPalette
            ? 'hover:bg-white/10 text-[#F3D299]'
            : isInline
            ? 'hover:bg-white text-[#7A4B21]'
            : 'hover:bg-[#FAF6F0] text-[#8D4925]'
        }`}
      >
        <Scan className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden sm:inline">احتواء وتوسيط</span>
      </button>

      <button
        type="button"
        data-testid="canvas-minimap-toggle-btn"
        onClick={onToggleMinimap}
        title="إظهار / إخفاء الخريطة المصغرة"
        className={`px-2 py-1 rounded-lg text-[11px] font-display font-bold inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
          showMinimap
            ? 'bg-[#C96C4E] text-white shadow-2xs'
            : useDarkPalette
            ? 'hover:bg-white/10 text-[#FAF3E3]'
            : isInline
            ? 'hover:bg-white text-[#483A2F]'
            : 'hover:bg-[#FAF6F0] text-[#252321]'
        }`}
      >
        <MapIcon className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden md:inline">الخريطة</span>
      </button>

      <button
        type="button"
        data-testid="canvas-cinema-mode-btn"
        onClick={onToggleCinemaMode}
        title={
          isCinemaMode
            ? 'الخروج من وضع العرض الكامل'
            : 'وضع العرض الكامل للمجالس'
        }
        className={`px-2.5 py-1 rounded-lg text-[11px] font-display font-extrabold inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
          isCinemaMode
            ? 'bg-[#8D4925] text-white shadow-2xs'
            : 'bg-[#F5E6DC] hover:bg-[#D8755B] text-[#8D4925] hover:text-white'
        }`}
      >
        {isCinemaMode ? (
          <>
            <Minimize2 className="w-3.5 h-3.5 shrink-0" />
            <span>خروج من العرض</span>
          </>
        ) : (
          <>
            <Maximize2 className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">عرض المجالس</span>
          </>
        )}
      </button>
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
          ? 'bg-[#1D1813]/92 border-[#D4AF37]/45 text-[#FAF3E3]'
          : 'bg-white/95 border-[#B98A78]/50 text-[#252321]'
      }`}
    >
      <div className="flex items-center justify-between gap-2 pb-1 mb-1 border-b border-[#B98A78]/20">
        <span className="text-[10px] font-display font-extrabold inline-flex items-center gap-1">
          <MapIcon className="w-3 h-3 text-[#D8755B]" />
          <span>الخريطة المصغرة ({people.length})</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق الخريطة المصغرة"
          className="p-0.5 rounded hover:bg-[#FAF6F0]/30 cursor-pointer"
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
                          ? '#D4AF37'
                          : p.isRecordKeeper
                          ? theme.primaryHex
                          : theme.goldAccentHex
                      }
                      stroke={theme.isDarkSurface ? '#15120E' : '#FFFFFF'}
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
      className="fixed inset-0 z-[70] bg-[#252321]/55 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="حاسبة صلة القرابة بين فردين"
    >
      <div
        dir="rtl"
        data-testid="kinship-calculator-modal"
        className="bg-white border-2 border-[#C5A059] rounded-3xl max-w-lg w-full p-5 sm:p-6 space-y-4 text-right shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[#E5DDD0] pb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-2xl bg-[#FDF6F1] border border-[#D8755B]/45 flex items-center justify-center text-[#8D4925]">
              <GitFork className="w-4 h-4 text-[#D8755B]" />
            </span>
            <div>
              <h4 className="text-sm sm:text-base font-display font-extrabold text-[#252321]">
                كاشف وحاسبة صلة القرابة الذكي
              </h4>
              <p className="text-[11px] text-[#252321]/65">
                اختر فردين لاكتشاف الجد الجامع وإضاءة المسار النسبي بالذهب
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-[#FAF6F0] hover:bg-[#F5E6DC] flex items-center justify-center text-[#252321] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-end gap-2.5">
          <div className="space-y-1">
            <label
              htmlFor="kinship-person-a"
              className="text-[11px] font-display font-extrabold text-[#8D4925] block"
            >
              الفرد الأول
            </label>
            <select
              id="kinship-person-a"
              data-testid="kinship-select-a"
              value={personAId}
              onChange={(e) => onChangePersonA(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#DFD4C2] focus:border-[#D8755B] outline-none text-xs font-display font-bold text-[#252321]"
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
            className="w-9 h-9 rounded-xl bg-[#FAF6F0] hover:bg-[#F5E6DC] border border-[#DFD4C2] flex items-center justify-center text-[#8D4925] cursor-pointer self-center sm:self-end"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>

          <div className="space-y-1">
            <label
              htmlFor="kinship-person-b"
              className="text-[11px] font-display font-extrabold text-[#8D4925] block"
            >
              الفرد الثاني
            </label>
            <select
              id="kinship-person-b"
              data-testid="kinship-select-b"
              value={personBId}
              onChange={(e) => onChangePersonB(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#DFD4C2] focus:border-[#D8755B] outline-none text-xs font-display font-bold text-[#252321]"
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
                ? 'bg-gradient-to-br from-[#FFFDF7] to-[#FAF1DC] border-[#D4AF37]/80'
                : 'bg-[#FAF6F0] border-[#E5DDD0]'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-display font-extrabold text-[#8D4925] inline-flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>العلاقة النسبية: {result.relationshipLabel}</span>
              </div>
              {result.connected && result.degreeCount > 0 && (
                <span className="text-[11px] font-mono font-bold text-[#92400E] tabular-nums">
                  {result.degreeCount}{' '}
                  {result.degreeCount === 1 ? 'درجة' : 'درجات'}
                </span>
              )}
            </div>

            {result.commonAncestor && (
              <div className="text-xs text-[#252321] font-display">
                الجد الجامع:{' '}
                <strong className="text-[#8D4925]">
                  {result.commonAncestor.firstName}
                </strong>
              </div>
            )}

            {result.pathNodes.length > 1 && (
              <div className="pt-2 border-t border-[#D4AF37]/30 flex flex-wrap items-center gap-1.5 text-[11px] font-display font-bold text-[#252321]">
                {result.pathNodes.map((n, idx) => (
                  <React.Fragment key={`kp-${n.id}`}>
                    <span
                      className={`px-2 py-0.5 rounded-lg border ${
                        n.id === result.commonAncestor?.id
                          ? 'bg-[#D4AF37]/25 border-[#D4AF37] text-[#78350F]'
                          : 'bg-white border-[#E5DDD0]'
                      }`}
                    >
                      {n.firstName}
                    </span>
                    {idx < result.pathNodes.length - 1 && (
                      <span className="text-[#B98A78]">←</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E5DDD0]">
          {isPathHighlightedOnCanvas ? (
            <button
              type="button"
              onClick={onClearHighlightOnCanvas}
              className="px-3.5 py-2 rounded-xl bg-[#FAF6F0] hover:bg-[#F5E6DC] border border-[#DFD4C2] text-xs font-display font-bold text-[#8D4925] cursor-pointer"
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
              className="px-4 py-2 rounded-xl bg-[#FAF6F0] text-xs font-display font-bold text-[#252321] cursor-pointer"
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
                className="px-4 py-2 rounded-xl bg-[#8D4925] hover:bg-[#D8755B] text-white text-xs font-display font-extrabold cursor-pointer transition-colors shadow-2xs"
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
