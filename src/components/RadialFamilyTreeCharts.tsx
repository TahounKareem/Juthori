import React, { useMemo, useState } from 'react';
import type {
  PedigreePersonLike,
  PedigreeTreeNode,
} from '../utils/familyTreeLayout';
import type {
  TreeCardThemeDefinition,
  TreeDisplaySettings,
} from '../utils/treeStudioConfig';
import {
  formatTreeDateByCalendarMode,
  getTreeArabicFontDefinition,
} from '../utils/treeStudioConfig';
import { Edit2, Plus, Sparkles } from 'lucide-react';

export interface RadialChartPersonLike extends PedigreePersonLike {
  firstName: string;
  kunya?: string;
  honorificTitle?: string;
  gender: 'male' | 'female';
  isDirectSpineLineage?: boolean;
  vitalStatus?: 'unspecified' | 'living' | 'deceased';
  birthDateValue?: string;
  birthCalendar?: 'hijri' | 'gregorian';
}

interface RadialFamilyTreeChartsProps<T extends RadialChartPersonLike> {
  mode: 'fan_180' | 'radial_360';
  familyName: string;
  topLevelRoots: PedigreeTreeNode<T>[];
  directSpineIds: Set<string>;
  theme: TreeCardThemeDefinition;
  settings: TreeDisplaySettings;
  zoomPercent: number;
  getDisplayName: (person: T) => {
    mainName: string;
    kunyaOrTitle: string;
    isMaskedNow: boolean;
  };
  onSelectPerson: (person: T) => void;
  onAddRelative: (person: T) => void;
}

interface ChartArcNode<T extends RadialChartPersonLike> {
  person: T;
  depth: number;
  startAngle: number; // radians
  endAngle: number; // radians
  innerR: number;
  outerR: number;
  isCompassHighlighted: boolean;
  isDeceased: boolean;
}

function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleRad: number
): { x: number; y: number } {
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  };
}

function buildRingSectorPath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number
): string {
  const sweep = endAngle - startAngle;
  // Full circle guard
  if (sweep >= Math.PI * 1.999) {
    const mid = startAngle + Math.PI;
    return [
      buildRingSectorPath(cx, cy, innerR, outerR, startAngle, mid - 0.002),
      buildRingSectorPath(cx, cy, innerR, outerR, mid, endAngle - 0.002),
    ].join(' ');
  }

  const p1 = polarToCartesian(cx, cy, outerR, startAngle);
  const p2 = polarToCartesian(cx, cy, outerR, endAngle);
  const p3 = polarToCartesian(cx, cy, innerR, endAngle);
  const p4 = polarToCartesian(cx, cy, innerR, startAngle);
  const largeArc = sweep > Math.PI ? 1 : 0;

  return [
    `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
    `A ${outerR.toFixed(2)} ${outerR.toFixed(2)} 0 ${largeArc} 1 ${p2.x.toFixed(
      2
    )} ${p2.y.toFixed(2)}`,
    `L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
    `A ${innerR.toFixed(2)} ${innerR.toFixed(2)} 0 ${largeArc} 0 ${p4.x.toFixed(
      2
    )} ${p4.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

function countSubtreeLeaves<T extends RadialChartPersonLike>(
  node: PedigreeTreeNode<T>
): number {
  if (!node.children.length) return 1;
  return node.children.reduce((sum, ch) => sum + countSubtreeLeaves(ch), 0);
}

function getMaxSubtreeDepth<T extends RadialChartPersonLike>(
  node: PedigreeTreeNode<T>,
  curDepth = 0
): number {
  if (!node.children.length) return curDepth;
  return Math.max(
    ...node.children.map((ch) => getMaxSubtreeDepth(ch, curDepth + 1))
  );
}

const ARABIC_GEN_ORDINALS = [
  'الجيل الأول',
  'الجيل الثاني',
  'الجيل الثالث',
  'الجيل الرابع',
  'الجيل الخامس',
  'الجيل السادس',
  'الجيل السابع',
  'الجيل الثامن',
];

export function RadialFamilyTreeCharts<T extends RadialChartPersonLike>({
  mode,
  familyName,
  topLevelRoots,
  directSpineIds,
  theme,
  settings,
  zoomPercent,
  getDisplayName,
  onSelectPerson,
  onAddRelative,
}: RadialFamilyTreeChartsProps<T>) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusedPerson, setFocusedPerson] = useState<T | null>(null);

  const isFan = mode === 'fan_180';
  const activeFontCss = getTreeArabicFontDefinition(settings.fontFamily).cssFamily;

  const layout = useMemo(() => {
    const cx = isFan ? 520 : 480;
    const cy = isFan ? 510 : 450;

    if (!topLevelRoots.length) {
      return {
        cx,
        cy,
        width: isFan ? 1040 : 960,
        height: isFan ? 560 : 900,
        maxDepth: 0,
        ringStep: 78,
        baseR: 72,
        arcs: [] as ChartArcNode<T>[],
        centerRoot: null as T | null,
      };
    }

    const hasSingleRoot = topLevelRoots.length === 1;
    const centerRoot = hasSingleRoot ? topLevelRoots[0].person : null;
    const firstRingChildren = hasSingleRoot
      ? topLevelRoots[0].children
      : topLevelRoots;

    const maxDepth = firstRingChildren.length
      ? Math.max(...firstRingChildren.map((n) => getMaxSubtreeDepth(n, 1)))
      : 0;

    const totalRings = Math.max(1, maxDepth);
    const maxRadius = isFan ? 455 : 395;
    const baseR = isFan ? 82 : 74;
    const ringStep = Math.min(
      96,
      Math.max(54, (maxRadius - baseR) / totalRings)
    );

    const startSpan = isFan ? Math.PI : -Math.PI / 2;
    const totalAngle = isFan ? Math.PI : Math.PI * 2;
    const gapRad = isFan ? 0.012 : 0.01;

    const arcs: ChartArcNode<T>[] = [];

    const totalLeaves = firstRingChildren.reduce(
      (sum, n) => sum + countSubtreeLeaves(n),
      0
    );

    const traverse = (
      nodes: PedigreeTreeNode<T>[],
      depth: number,
      spanStart: number,
      spanEnd: number
    ) => {
      const groupLeaves = nodes.reduce(
        (sum, n) => sum + countSubtreeLeaves(n),
        0
      );
      if (groupLeaves <= 0) return;

      let cursor = spanStart;
      const innerR = baseR + (depth - 1) * ringStep + 4;
      const outerR = baseR + depth * ringStep - 3;

      for (const n of nodes) {
        const w = countSubtreeLeaves(n);
        const angleWidth = ((spanEnd - spanStart) * w) / groupLeaves;
        const pad = Math.min(gapRad, angleWidth * 0.12);
        const sA = cursor + pad / 2;
        const eA = cursor + angleWidth - pad / 2;

        const isCompassHighlighted =
          settings.highlightDirectCompass &&
          (directSpineIds.has(n.person.id) ||
            Boolean(n.person.isDirectSpineLineage) ||
            Boolean(n.person.isRecordKeeper));

        arcs.push({
          person: n.person,
          depth,
          startAngle: sA,
          endAngle: Math.max(sA + 0.02, eA),
          innerR,
          outerR,
          isCompassHighlighted,
          isDeceased: n.person.vitalStatus === 'deceased',
        });

        if (n.children.length) {
          traverse(n.children, depth + 1, cursor, cursor + angleWidth);
        }
        cursor += angleWidth;
      }
    };

    if (totalLeaves > 0) {
      traverse(firstRingChildren, 1, startSpan, startSpan + totalAngle);
    }

    return {
      cx,
      cy,
      width: isFan ? 1040 : 960,
      height: isFan ? 565 : 900,
      maxDepth: totalRings,
      ringStep,
      baseR,
      arcs,
      centerRoot,
    };
  }, [
    isFan,
    topLevelRoots,
    directSpineIds,
    settings.highlightDirectCompass,
  ]);

  const activePersonForBar =
    focusedPerson ||
    (hoveredId
      ? layout.arcs.find((a) => a.person.id === hoveredId)?.person ||
        (layout.centerRoot?.id === hoveredId ? layout.centerRoot : null)
      : null);

  const getRingFill = (arc: ChartArcNode<T>, isHovered: boolean) => {
    if (arc.isCompassHighlighted) {
      return theme.isDarkSurface ? '#4B3A14' : '#FEF3C7';
    }
    if (isHovered) {
      return theme.isDarkSurface ? '#382F23' : '#F5E6DC';
    }
    if (arc.person.isRecordKeeper) {
      return theme.isDarkSurface ? '#3B2F18' : '#FFF7E6';
    }
    if (arc.person.gender === 'female') {
      return theme.isDarkSurface ? '#2E2321' : '#FDF6F0';
    }
    // Subtle alternating concentric tones
    const alt = arc.depth % 2 === 0;
    if (theme.isDarkSurface) {
      return alt ? '#27221C' : '#201C17';
    }
    return alt ? '#FFFFFF' : theme.cardFillHex;
  };

  const getRingStroke = (arc: ChartArcNode<T>, isHovered: boolean) => {
    if (arc.isCompassHighlighted) return '#D4AF37';
    if (isHovered) return theme.primaryHex;
    if (arc.isDeceased && settings.showDeceasedDignityFrame) {
      return theme.isDarkSurface ? '#9CA3AF' : '#64748B';
    }
    return theme.cardStrokeHex;
  };

  const centerCompassActive =
    settings.highlightDirectCompass &&
    layout.centerRoot &&
    (directSpineIds.has(layout.centerRoot.id) ||
      Boolean(layout.centerRoot.isDirectSpineLineage) ||
      Boolean(layout.centerRoot.isRecordKeeper));

  return (
    <div
      data-testid={
        isFan ? 'pedigree-fan-180-viewport' : 'pedigree-radial-360-viewport'
      }
      className="w-full flex flex-col items-center gap-3 py-2"
    >
      {/* Interactive Top Info Ribbon for Hover / Selected Node */}
      <div
        className={`w-full max-w-3xl rounded-2xl border px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs transition-colors ${
          theme.isDarkSurface
            ? 'bg-[#221E19]/95 border-[#D4AF37]/40 text-[#FAF3E3]'
            : 'bg-white/95 border-[#B98A78]/35 text-[#252321]'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-3.5 h-3.5 text-[#D8755B] shrink-0" />
          {activePersonForBar ? (
            <div className="flex flex-wrap items-center gap-1.5 truncate">
              <strong className="font-display font-extrabold">
                {getDisplayName(activePersonForBar).mainName}
              </strong>
              {activePersonForBar.isRecordKeeper && (
                <span className="px-1.5 py-0.5 rounded-md bg-[#D4AF37]/20 text-[#92400E] text-[10px] font-bold">
                  أمين السجل
                </span>
              )}
              {activePersonForBar.vitalStatus === 'deceased' && (
                <span className="text-[10.5px] opacity-75">
                  ({activePersonForBar.gender === 'female' ? 'رحمها الله' : 'رحمه الله'})
                </span>
              )}
              {settings.showDates && activePersonForBar.birthDateValue && (
                <span className="text-[10.5px] opacity-75 tabular-nums">
                  ·{' '}
                  {formatTreeDateByCalendarMode(
                    activePersonForBar.birthDateValue,
                    activePersonForBar.birthCalendar,
                    settings.calendarDisplayMode
                  )}
                </span>
              )}
            </div>
          ) : (
            <span className="opacity-80">
              {isFan
                ? 'مروحة الأنساب التراثية (180°) — انقر على أي قوس أو فرد لتعديل بياناته أو إضافة فرع'
                : 'الهالة الدائرية الكاملة (360°) — يتمركز الجد الأعلى في القلب وتتوزع الأجيال في مدارات دائرية'}
            </span>
          )}
        </div>

        {activePersonForBar && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onSelectPerson(activePersonForBar)}
              className="px-2.5 py-1 rounded-lg bg-[#F5E6DC] hover:bg-[#D8755B] text-[#8D4925] hover:text-white text-[11px] font-display font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Edit2 className="w-3 h-3" />
              <span>تعديل البطاقة</span>
            </button>
            <button
              type="button"
              onClick={() => onAddRelative(activePersonForBar)}
              className="px-2.5 py-1 rounded-lg bg-[#8D4925] hover:bg-[#D8755B] text-white text-[11px] font-display font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Plus className="w-3 h-3" />
              <span>إضافة قريب</span>
            </button>
          </div>
        )}
      </div>

      {/* Responsive Zoomable SVG Stage */}
      <div className="w-full overflow-x-auto flex justify-center pb-2">
        <div
          className="transition-transform origin-top"
          style={{ transform: `scale(${zoomPercent / 100})` }}
        >
          <svg
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            width={layout.width}
            height={layout.height}
            className="max-w-full h-auto select-none drop-shadow-xs"
            role="img"
            aria-label={
              isFan
                ? `مروحة الأنساب التراثية لعائلة ${familyName}`
                : `الهالة الدائرية الكاملة لعائلة ${familyName}`
            }
          >
            <defs>
              <filter
                id="compass-gold-glow"
                x="-12%"
                y="-12%"
                width="124%"
                height="124%"
              >
                <feDropShadow
                  dx="0"
                  dy="0"
                  stdDeviation="3"
                  floodColor="#D4AF37"
                  floodOpacity="0.6"
                />
              </filter>
            </defs>

            {/* Optional Concentric Generation Orbit Guides & Labels */}
            {settings.showGenerationBar &&
              Array.from({ length: layout.maxDepth }, (_, idx) => {
                const depth = idx + 1;
                const rOuter = layout.baseR + depth * layout.ringStep;
                const labelText =
                  ARABIC_GEN_ORDINALS[depth] || `الجيل ${depth + 1}`;
                return (
                  <g key={`orbit-guide-${depth}`} pointerEvents="none">
                    {isFan ? (
                      <path
                        d={`M ${layout.cx - rOuter} ${layout.cy} A ${rOuter} ${rOuter} 0 0 1 ${layout.cx + rOuter} ${layout.cy}`}
                        fill="none"
                        stroke={theme.goldAccentHex}
                        strokeOpacity="0.28"
                        strokeDasharray="4 4"
                      />
                    ) : (
                      <circle
                        cx={layout.cx}
                        cy={layout.cy}
                        r={rOuter}
                        fill="none"
                        stroke={theme.goldAccentHex}
                        strokeOpacity="0.24"
                        strokeDasharray="4 4"
                      />
                    )}
                    <text
                      x={isFan ? layout.cx + rOuter - 24 : layout.cx}
                      y={
                        isFan
                          ? layout.cy + 16
                          : layout.cy - rOuter + 14
                      }
                      textAnchor="middle"
                      fill={theme.textMutedHex}
                      fontSize="10"
                      fontWeight="700"
                      fontFamily={activeFontCss}
                    >
                      {labelText}
                    </text>
                  </g>
                );
              })}

            {/* Concentric Generation Arcs */}
            {layout.arcs.map((arc) => {
              const isHovered = hoveredId === arc.person.id;
              const isFocused = focusedPerson?.id === arc.person.id;
              const pathD = buildRingSectorPath(
                layout.cx,
                layout.cy,
                arc.innerR,
                arc.outerR,
                arc.startAngle,
                arc.endAngle
              );
              const midAngle = (arc.startAngle + arc.endAngle) / 2;
              const midR = (arc.innerR + arc.outerR) / 2;
              const labelPos = polarToCartesian(
                layout.cx,
                layout.cy,
                midR,
                midAngle
              );

              // Rotate label tangentially or radially depending on arc span
              const arcAngleDeg = ((arc.endAngle - arc.startAngle) * 180) / Math.PI;
              const midDeg = (midAngle * 180) / Math.PI;
              let textRot = 0;
              if (arcAngleDeg < 26) {
                // Radial alignment for narrow slices so text never collides
                textRot = midDeg;
                if (textRot > 90 && textRot < 270) textRot += 180;
                if (textRot < -90 && textRot > -270) textRot += 180;
              } else {
                // Tangential curve alignment
                textRot = midDeg + 90;
                if (textRot > 90 && textRot < 270) textRot += 180;
              }

              const disp = getDisplayName(arc.person);
              const shortName =
                disp.mainName.length > 16
                  ? `${disp.mainName.slice(0, 15)}…`
                  : disp.mainName;
              const dateLabel =
                settings.showDates && arc.person.birthDateValue
                  ? formatTreeDateByCalendarMode(
                      arc.person.birthDateValue,
                      arc.person.birthCalendar,
                      settings.calendarDisplayMode
                    )
                  : '';

              return (
                <g
                  key={`arc-${arc.person.id}`}
                  data-testid={`radial-node-${arc.person.id}`}
                  className="cursor-pointer transition-opacity"
                  filter={
                    arc.isCompassHighlighted ? 'url(#compass-gold-glow)' : undefined
                  }
                  onMouseEnter={() => setHoveredId(arc.person.id)}
                  onMouseLeave={() =>
                    setHoveredId((cur) => (cur === arc.person.id ? null : cur))
                  }
                  onClick={() => {
                    setFocusedPerson(arc.person);
                    onSelectPerson(arc.person);
                  }}
                >
                  <path
                    d={pathD}
                    fill={getRingFill(arc, isHovered || isFocused)}
                    stroke={getRingStroke(arc, isHovered || isFocused)}
                    strokeWidth={
                      arc.isCompassHighlighted || isHovered || isFocused ? 2.6 : 1.35
                    }
                    strokeDasharray={
                      arc.isDeceased && settings.showDeceasedDignityFrame
                        ? '4 2'
                        : undefined
                    }
                  />
                  <g
                    transform={`translate(${labelPos.x.toFixed(
                      1
                    )}, ${labelPos.y.toFixed(1)}) rotate(${textRot.toFixed(1)})`}
                    pointerEvents="none"
                  >
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      y={dateLabel ? -5 : 0}
                      fill={
                        arc.isCompassHighlighted && !theme.isDarkSurface
                          ? '#78350F'
                          : theme.textPrimaryHex
                      }
                      fontSize={arcAngleDeg < 18 ? 10 : 12}
                      fontWeight="800"
                      fontFamily={activeFontCss}
                    >
                      {shortName}
                    </text>
                    {dateLabel && arcAngleDeg >= 16 && (
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        y={10}
                        fill={theme.textMutedHex}
                        fontSize="9"
                        fontWeight="600"
                        fontFamily={activeFontCss}
                      >
                        {dateLabel}
                      </text>
                    )}
                    {arc.isDeceased &&
                      settings.showDeceasedDignityFrame &&
                      arcAngleDeg >= 24 &&
                      !dateLabel && (
                        <text
                          textAnchor="middle"
                          dominantBaseline="central"
                          y={11}
                          fill={theme.textMutedHex}
                          fontSize="8.5"
                          fontWeight="600"
                          fontFamily={activeFontCss}
                        >
                          {arc.person.gender === 'female'
                            ? 'رحمها الله'
                            : 'رحمه الله'}
                        </text>
                      )}
                  </g>
                </g>
              );
            })}

            {/* Center Anchor Medallion (Bottom Center for 180° Fan / Exact Center for 360° Radial) */}
            <g
              className="cursor-pointer"
              filter={centerCompassActive ? 'url(#compass-gold-glow)' : undefined}
              onMouseEnter={() =>
                layout.centerRoot && setHoveredId(layout.centerRoot.id)
              }
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => {
                if (layout.centerRoot) {
                  setFocusedPerson(layout.centerRoot);
                  onSelectPerson(layout.centerRoot);
                }
              }}
            >
              {isFan ? (
                <path
                  d={`M ${layout.cx - layout.baseR} ${layout.cy} A ${layout.baseR} ${layout.baseR} 0 0 1 ${layout.cx + layout.baseR} ${layout.cy} Z`}
                  fill={
                    centerCompassActive
                      ? '#FEF3C7'
                      : theme.isDarkSurface
                      ? '#2F261A'
                      : theme.primaryHex
                  }
                  stroke={theme.goldAccentHex}
                  strokeWidth="3"
                />
              ) : (
                <circle
                  cx={layout.cx}
                  cy={layout.cy}
                  r={layout.baseR - 2}
                  fill={
                    centerCompassActive
                      ? '#FEF3C7'
                      : theme.isDarkSurface
                      ? '#2F261A'
                      : theme.primaryHex
                  }
                  stroke={theme.goldAccentHex}
                  strokeWidth="3"
                />
              )}

              <text
                x={layout.cx}
                y={isFan ? layout.cy - 34 : layout.cy - 10}
                textAnchor="middle"
                fill={
                  centerCompassActive
                    ? '#78350F'
                    : theme.isDarkSurface
                    ? '#F3D299'
                    : '#FDE68A'
                }
                fontSize="10"
                fontWeight="700"
                fontFamily={activeFontCss}
              >
                {layout.centerRoot?.isRecordKeeper
                  ? 'أمين السجل'
                  : layout.centerRoot
                  ? 'الجد الجامع'
                  : 'العائلة'}
              </text>
              <text
                x={layout.cx}
                y={isFan ? layout.cy - 14 : layout.cy + 10}
                textAnchor="middle"
                fill={centerCompassActive ? '#451A03' : '#FFFFFF'}
                fontSize="14"
                fontWeight="800"
                fontFamily={activeFontCss}
              >
                {layout.centerRoot
                  ? getDisplayName(layout.centerRoot).mainName.slice(0, 16)
                  : familyName.slice(0, 16)}
              </text>
            </g>

            {/* Decorative Base Pedestal Line for 180° Fan Chart */}
            {isFan && (
              <g pointerEvents="none">
                <line
                  x1={layout.cx - (layout.baseR + layout.maxDepth * layout.ringStep)}
                  y1={layout.cy}
                  x2={layout.cx + (layout.baseR + layout.maxDepth * layout.ringStep)}
                  y2={layout.cy}
                  stroke={theme.goldAccentHex}
                  strokeWidth="2.2"
                  strokeOpacity="0.7"
                />
                <text
                  x={layout.cx}
                  y={layout.cy + 34}
                  textAnchor="middle"
                  fill={theme.textPrimaryHex}
                  fontSize="13"
                  fontWeight="800"
                  fontFamily={activeFontCss}
                >
                  مشجرة عائلة {familyName} · مروحة الأنساب التراثية
                </text>
              </g>
            )}
          </svg>
        </div>
      </div>
    </div>
  );
}
