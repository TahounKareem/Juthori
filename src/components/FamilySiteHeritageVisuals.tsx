import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  GitBranch,
  Maximize2,
  Plus,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { FamilySiteThemeDefinition } from '../config/referralAndSiteConfig';
import {
  FamilyCrestStyle,
  FamilyPortalVisualBranding,
  HeroCoverPresetId,
  HeroLayoutStyle,
  PortalSectionKey,
  PortalTypographyId,
  SanitizedPublicTreeMember,
  submitTreeEnrichmentRequest,
} from '../services/priority4Service';
import {
  StagingParentLinkPatch,
  StagingProposedTreeNode,
} from '../utils/enrichmentStagingUtils';
import {
  AccountLegalType,
  DashboardAccessCapabilities,
  DashboardStateMode,
  LineageSearchResult,
} from '../types/juthori';
import {
  TreeDisplaySettings,
  TreePrestigeBadgeId,
  normalizeTreeDisplaySettings,
} from '../utils/treeStudioConfig';
import {
  ArabicHonorificTitle,
  InteractiveFamilyTreeBuilder,
  InteractiveTreePerson,
} from './InteractiveFamilyTreeBuilder';
import { LivingFamilyConstellation } from './FamilySiteEditorialPrimitives';

// =============================================================================
// 1. BESPOKE VISUAL PRESETS & LABELS
// =============================================================================
export const CREST_STYLE_OPTIONS: ReadonlyArray<{
  id: FamilyCrestStyle;
  label: string;
  subtitle: string;
}> = [
  {
    id: 'royal_shield',
    label: 'درع ملكي مذهّب',
    subtitle: 'درع تراثي بتاج زخرفي وإطار ذهبي مزدوج',
  },
  {
    id: 'islamic_octagon',
    label: 'ختم هندسي إسلامي ثماني',
    subtitle: 'نجمة ثمانية متشابكة مستوحاة من خزائن المخطوطات',
  },
  {
    id: 'heritage_wreath',
    label: 'إكليل تراثي كلاسيكي',
    subtitle: 'إكليل سعفي مذهّب يحيط باسم العائلة',
  },
  {
    id: 'calligraphic_tughra',
    label: 'طغراء خطية بسيطة',
    subtitle: 'ختم دائري ناعم بطوق مذهّب وحلية علوية',
  },
];

export const HERO_COVER_PRESET_OPTIONS: ReadonlyArray<{
  id: HeroCoverPresetId;
  label: string;
  subtitle: string;
  previewGradient: string;
}> = [
  {
    id: 'gilded_geometry',
    label: 'نقوش هندسية مذهّبة',
    subtitle: 'زخرفة نجمية إسلامية ناعمة على عمق داكن',
    previewGradient:
      'linear-gradient(135deg, #1E1B18 0%, #2C241B 55%, #4A3820 100%)',
  },
  {
    id: 'najdi_adobe',
    label: 'عمارة طينية نجدية دافئة',
    subtitle: 'طرز ومثلثات العمارة الطينية النجدية الدافئة',
    previewGradient:
      'linear-gradient(135deg, #3A271D 0%, #63402B 55%, #8D5B3A 100%)',
  },
  {
    id: 'hijazi_roshan',
    label: 'رواشين حجازية وأندلسية',
    subtitle: 'أقواس ومشربيات تراثية بإضاءة فانوس دافئة',
    previewGradient:
      'linear-gradient(135deg, #102B24 0%, #1B4438 55%, #2D5C4B 100%)',
  },
  {
    id: 'golden_dunes',
    label: 'كثبان ذهبية هادئة',
    subtitle: 'أفق صحراوي ذهبي شاعري وقت الأصيل',
    previewGradient:
      'linear-gradient(135deg, #2D1F14 0%, #6D4927 52%, #B98A4D 100%)',
  },
  {
    id: 'antique_parchment',
    label: 'رقّ مخطوطات عتيق',
    subtitle: 'دفء المخطوطات التاريخية بزوايا مذهّبة',
    previewGradient:
      'linear-gradient(135deg, #3C3022 0%, #695338 55%, #9B7E54 100%)',
  },
  {
    id: 'royal_marble',
    label: 'رخام ملكي داكن',
    subtitle: 'عروق رخامية فخمة بلمعة معدنية هادئة',
    previewGradient:
      'linear-gradient(135deg, #12151A 0%, #222831 55%, #374151 100%)',
  },
];

export const HERO_LAYOUT_OPTIONS: ReadonlyArray<{
  id: HeroLayoutStyle;
  label: string;
  subtitle: string;
}> = [
  {
    id: 'centered_royal',
    label: 'متمركز ملكي مهيب',
    subtitle: 'الختم والعنوان في المنتصف بإيقاع كلاسيكي',
  },
  {
    id: 'editorial_split',
    label: 'تحريري مقسوم يمين/يسار',
    subtitle: 'النص والتوثيق يميناً مع بطاقة الختم يساراً',
  },
  {
    id: 'floating_glass',
    label: 'بطاقة زجاجية عائمة',
    subtitle: 'تأطير زجاجي شفاف يبرز الخلفية المعمارية',
  },
];

export const TYPOGRAPHY_PAIR_OPTIONS: ReadonlyArray<{
  id: PortalTypographyId;
  label: string;
  subtitle: string;
  sampleFamily: string;
  fontCss: string;
}> = [
  {
    id: 'amiri_naskh',
    label: 'أصالة الأميري والنسخ',
    subtitle: 'عناوين بخط الأميري العريق ومتون بالنسخ العربي المريح',
    sampleFamily: 'ديوان آل العراقة',
    fontCss: '"Amiri", serif',
  },
  {
    id: 'classical_ruqaa',
    label: 'فخامة الخط الكلاسيكي',
    subtitle: 'عناوين بخط الرقعة الفني ولمسة معاصرة في القراءة',
    sampleFamily: 'ديوان آل العراقة',
    fontCss: '"Aref Ruqaa", serif',
  },
  {
    id: 'modern_geometric',
    label: 'حداثة هندسية راقية',
    subtitle: 'خط هندسي متزن يناسب البوابات العائلية المعاصرة',
    sampleFamily: 'ديوان آل العراقة',
    fontCss: '"Readex Pro", sans-serif',
  },
];

export const PORTAL_SECTION_LABELS: Record<PortalSectionKey, string> = {
  patriarch_quote: 'كلمة ووصية عميد العائلة',
  tree_mirror: 'دوحة نسب العائلة التفاعلية',
  vault_gallery: 'معرض خزانة الصور والوثائق',
  news: 'أخبار وتباشير العائلة',
  events: 'المناسبات واللقاءات القادمة',
  stories: 'قصص الأجداد والذكريات',
  notables: 'لوحة الشرف وأعلام العائلة',
  atlas: 'أطلس الديار والإحصائيات',
  oral_heritage: 'الموروث الصوتي والشعري',
  professions: 'دليل الكفاءات والتخصصات',
  memorial: 'ركن الوفاء وكبسولة الزمن',
  majlis: 'مجلس العائلة وحرّاس الذاكرة',
};

// =============================================================================
// 2. AUTO-GENERATED GILDED FAMILY CREST / CUSTOM LOGO
// =============================================================================
interface FamilyCrestEmblemProps {
  familyName: string;
  crestMode?: 'auto_gilded' | 'custom_image';
  crestStyle?: FamilyCrestStyle;
  customCrestUrl?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  tone?: 'dark' | 'ivory';
  className?: string;
}

export const FamilyCrestEmblem: React.FC<FamilyCrestEmblemProps> = ({
  familyName,
  crestMode = 'auto_gilded',
  crestStyle = 'royal_shield',
  customCrestUrl,
  size = 'md',
  tone = 'dark',
  className = '',
}) => {
  const cleanLabel = (familyName || 'العائلة')
    .replace(/^آل\s+|^ال\s+|^عائلة\s+/u, '')
    .trim();
  const displayMonogram =
    cleanLabel.length <= 9 ? cleanLabel : cleanLabel.slice(0, 8) + '…';

  const dims =
    size === 'xs'
      ? 'w-9 h-9'
      : size === 'sm'
        ? 'w-11 h-11'
        : size === 'lg'
          ? 'w-24 h-24 sm:w-28 sm:h-28'
          : 'w-16 h-16';

  const isIvory = tone === 'ivory';
  const goldGradId = isIvory ? 'jtCrestGoldIvory' : 'jtCrestGold';
  const fillGradId = isIvory ? 'jtCrestIvoryFill' : 'jtCrestDark';
  const primaryTextFill = isIvory ? '#3D2B1F' : '#FDF6E3';
  const accentTextFill = isIvory ? '#9A6B25' : '#D4AF6A';
  const crownDotFill = isIvory ? '#B88A3B' : '#F8E7B9';

  if (crestMode === 'custom_image' && customCrestUrl) {
    return (
      <div
        className={`${dims} rounded-2xl overflow-hidden border flex items-center justify-center shrink-0 ${
          isIvory
            ? 'border-[#D8C7B2] bg-[#FAF7F2] shadow-xs'
            : 'border-[#D8C7B2] bg-[#E8DED2] shadow-sm'
        } ${className}`}
      >
        <img
          src={customCrestUrl}
          alt={`شعار عائلة ${familyName}`}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  const fontSize =
    size === 'xs'
      ? displayMonogram.length > 5
        ? 15
        : 18
      : size === 'sm'
        ? displayMonogram.length > 5
          ? 16
          : 19
        : displayMonogram.length > 6
          ? 16
          : 20;

  return (
    <div
      className={`${dims} inline-flex items-center justify-center shrink-0 select-none ${className}`}
      aria-label={`ختم عائلة ${familyName}`}
    >
      <svg
        viewBox="0 0 120 120"
        className={`w-full h-full ${
          isIvory
            ? 'drop-shadow-[0_3px_8px_rgba(140,83,39,0.14)]'
            : 'drop-shadow-[0_6px_18px_rgba(0,0,0,0.32)]'
        }`}
        role="img"
      >
        <defs>
          {isIvory ? (
            <>
              <linearGradient
                id="jtCrestGoldIvory"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#D6AE5A" />
                <stop offset="50%" stopColor="#B88735" />
                <stop offset="100%" stopColor="#8C5D23" />
              </linearGradient>
              <radialGradient id="jtCrestIvoryFill" cx="50%" cy="32%" r="72%">
                <stop offset="0%" stopColor="#FFFDF9" />
                <stop offset="100%" stopColor="#F3E9D6" />
              </radialGradient>
            </>
          ) : (
            <>
              <linearGradient
                id="jtCrestGold"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#F8E7B9" />
                <stop offset="48%" stopColor="#D4AF6A" />
                <stop offset="100%" stopColor="#9C7331" />
              </linearGradient>
              <radialGradient id="jtCrestDark" cx="50%" cy="35%" r="70%">
                <stop offset="0%" stopColor="#2F2821" />
                <stop offset="100%" stopColor="#161310" />
              </radialGradient>
            </>
          )}
        </defs>

        {crestStyle === 'royal_shield' && (
          <>
            {/* Crown Fleuron */}
            <path
              d="M48 16 L54 8 L60 14 L66 8 L72 16 Z"
              fill={`url(#${goldGradId})`}
            />
            <circle cx="60" cy="6.5" r="2.2" fill={crownDotFill} />
            {/* Outer Shield */}
            <path
              d="M22 22 C38 18, 82 18, 98 22 L95 66 C93 90, 76 105, 60 113 C44 105, 27 90, 25 66 Z"
              fill={`url(#${fillGradId})`}
              stroke={`url(#${goldGradId})`}
              strokeWidth="3.2"
            />
            {/* Inner Gold Hairline Shield */}
            <path
              d="M29 28 C42 25, 78 25, 91 28 L88.5 64.5 C87 84.5, 73 97.5, 60 104.5 C47 97.5, 33 84.5, 31.5 64.5 Z"
              fill="none"
              stroke={`url(#${goldGradId})`}
              strokeWidth="1.2"
              strokeOpacity="0.72"
            />
            <text
              x="60"
              y="47"
              textAnchor="middle"
              fill={accentTextFill}
              fontSize="11"
              fontWeight="700"
              style={{ fontFamily: '"Amiri", serif' }}
            >
              آل
            </text>
            <text
              x="60"
              y="72"
              textAnchor="middle"
              fill={primaryTextFill}
              fontSize={fontSize}
              fontWeight="700"
              style={{ fontFamily: '"Amiri", "Cairo", serif' }}
            >
              {displayMonogram}
            </text>
            <path
              d="M45 84 L60 88 L75 84"
              fill="none"
              stroke={`url(#${goldGradId})`}
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </>
        )}

        {crestStyle === 'islamic_octagon' && (
          <>
            {/* Rub el Hizb 8-Point Star */}
            <rect
              x="24"
              y="24"
              width="72"
              height="72"
              rx="6"
              fill={`url(#${fillGradId})`}
              stroke={`url(#${goldGradId})`}
              strokeWidth="2.8"
            />
            <rect
              x="24"
              y="24"
              width="72"
              height="72"
              rx="6"
              transform="rotate(45 60 60)"
              fill={`url(#${fillGradId})`}
              stroke={`url(#${goldGradId})`}
              strokeWidth="2.8"
            />
            <circle
              cx="60"
              cy="60"
              r="34"
              fill={`url(#${fillGradId})`}
              stroke={`url(#${goldGradId})`}
              strokeWidth="1.4"
              strokeDasharray="3 2.5"
            />
            <text
              x="60"
              y="50"
              textAnchor="middle"
              fill={accentTextFill}
              fontSize="10.5"
              fontWeight="700"
              style={{ fontFamily: '"Amiri", serif' }}
            >
              ديوان
            </text>
            <text
              x="60"
              y="71"
              textAnchor="middle"
              fill={primaryTextFill}
              fontSize={fontSize}
              fontWeight="700"
              style={{ fontFamily: '"Amiri", "Cairo", serif' }}
            >
              {displayMonogram}
            </text>
          </>
        )}

        {crestStyle === 'heritage_wreath' && (
          <>
            <circle
              cx="60"
              cy="60"
              r="49"
              fill={`url(#${fillGradId})`}
              stroke={`url(#${goldGradId})`}
              strokeWidth="2.2"
            />
            {/* Symmetrical Wreath Arcs */}
            <path
              d="M36 96 C19 82, 16 54, 29 33"
              fill="none"
              stroke={`url(#${goldGradId})`}
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <path
              d="M84 96 C101 82, 104 54, 91 33"
              fill="none"
              stroke={`url(#${goldGradId})`}
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            {/* Delicate Laurel Leaves */}
            {[38, 52, 66, 80].map((cy, idx) => (
              <g key={cy} fill={`url(#${goldGradId})`} opacity="0.9">
                <ellipse
                  cx={22 + idx * 1.4}
                  cy={cy}
                  rx="4.2"
                  ry="2"
                  transform={`rotate(-35 ${22 + idx * 1.4} ${cy})`}
                />
                <ellipse
                  cx={98 - idx * 1.4}
                  cy={cy}
                  rx="4.2"
                  ry="2"
                  transform={`rotate(35 ${98 - idx * 1.4} ${cy})`}
                />
              </g>
            ))}
            <polygon
              points="60,15 62.5,21 69,21 63.8,24.8 65.8,31 60,27.2 54.2,31 56.2,24.8 51,21 57.5,21"
              fill={`url(#${goldGradId})`}
            />
            <text
              x="60"
              y="66"
              textAnchor="middle"
              fill={primaryTextFill}
              fontSize={fontSize}
              fontWeight="700"
              style={{ fontFamily: '"Amiri", "Cairo", serif' }}
            >
              {displayMonogram}
            </text>
            <path
              d="M46 98 L60 92 L74 98"
              fill="none"
              stroke={`url(#${goldGradId})`}
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </>
        )}

        {crestStyle === 'calligraphic_tughra' && (
          <>
            <circle
              cx="60"
              cy="60"
              r="50"
              fill={`url(#${fillGradId})`}
              stroke={`url(#${goldGradId})`}
              strokeWidth="2.6"
            />
            <circle
              cx="60"
              cy="60"
              r="42"
              fill="none"
              stroke={`url(#${goldGradId})`}
              strokeWidth="1"
              strokeOpacity="0.65"
            />
            <path
              d="M36 42 Q60 28 84 42"
              fill="none"
              stroke={`url(#${goldGradId})`}
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <text
              x="60"
              y="68"
              textAnchor="middle"
              fill={primaryTextFill}
              fontSize={fontSize + 1}
              fontWeight="700"
              style={{ fontFamily: '"Aref Ruqaa", "Amiri", serif' }}
            >
              {displayMonogram}
            </text>
            <path
              d="M38 82 Q60 92 82 82"
              fill="none"
              stroke={`url(#${goldGradId})`}
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <circle cx="60" cy="24" r="2.4" fill={`url(#${goldGradId})`} />
          </>
        )}
      </svg>
    </div>
  );
};

// =============================================================================
// 3. ARCHITECTURAL & HERITAGE HERO COVER BACKDROP
// =============================================================================
interface HeroArchitecturalBackdropProps {
  branding: FamilyPortalVisualBranding;
}

export const HeroArchitecturalBackdrop: React.FC<
  HeroArchitecturalBackdropProps
> = ({ branding }) => {
  const preset =
    HERO_COVER_PRESET_OPTIONS.find((p) => p.id === branding.heroCoverPreset) ||
    HERO_COVER_PRESET_OPTIONS[0];
  const overlayOpacity = Math.max(
    0.05,
    Math.min(0.9, (branding.heroOverlayIntensity ?? 55) / 100)
  );

  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none select-none"
      aria-hidden="true"
    >
      {branding.heroCoverMode === 'custom_image' &&
      branding.customHeroCoverUrl ? (
        <img
          src={branding.customHeroCoverUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover scale-[1.01]"
        />
      ) : (
        <div
          className="w-full h-full relative"
          style={{ background: preset.previewGradient }}
        >
          {/* Bespoke SVG Architectural Pattern per Preset */}
          {branding.heroCoverPreset === 'gilded_geometry' && (
            <svg
              className="w-full h-full opacity-[0.16]"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <pattern
                  id="pat-gilded-geo"
                  width="68"
                  height="68"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M34 4 L44 24 L64 34 L44 44 L34 64 L24 44 L4 34 L24 24 Z"
                    fill="none"
                    stroke="#E7C882"
                    strokeWidth="1"
                  />
                  <circle
                    cx="34"
                    cy="34"
                    r="11"
                    fill="none"
                    stroke="#E7C882"
                    strokeWidth="0.7"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#pat-gilded-geo)" />
            </svg>
          )}

          {branding.heroCoverPreset === 'najdi_adobe' && (
            <svg
              className="w-full h-full opacity-[0.2]"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <pattern
                  id="pat-najdi"
                  width="64"
                  height="48"
                  patternUnits="userSpaceOnUse"
                >
                  <polygon
                    points="32,6 42,22 22,22"
                    fill="none"
                    stroke="#F0C98D"
                    strokeWidth="1.2"
                  />
                  <polygon
                    points="16,28 24,42 8,42"
                    fill="none"
                    stroke="#F0C98D"
                    strokeWidth="1"
                  />
                  <polygon
                    points="48,28 56,42 40,42"
                    fill="none"
                    stroke="#F0C98D"
                    strokeWidth="1"
                  />
                  <line
                    x1="0"
                    y1="24"
                    x2="64"
                    y2="24"
                    stroke="#F0C98D"
                    strokeWidth="0.6"
                    strokeOpacity="0.6"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#pat-najdi)" />
            </svg>
          )}

          {branding.heroCoverPreset === 'hijazi_roshan' && (
            <svg
              className="w-full h-full opacity-[0.18]"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <pattern
                  id="pat-roshan"
                  width="76"
                  height="96"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M12 96 L12 42 Q38 6 64 42 L64 96"
                    fill="none"
                    stroke="#E5C584"
                    strokeWidth="1.1"
                  />
                  <path
                    d="M22 96 L22 46 Q38 20 54 46 L54 96"
                    fill="none"
                    stroke="#E5C584"
                    strokeWidth="0.7"
                  />
                  <line
                    x1="38"
                    y1="24"
                    x2="38"
                    y2="96"
                    stroke="#E5C584"
                    strokeWidth="0.5"
                    strokeDasharray="4 4"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#pat-roshan)" />
            </svg>
          )}

          {branding.heroCoverPreset === 'golden_dunes' && (
            <svg
              viewBox="0 0 1200 420"
              preserveAspectRatio="none"
              className="w-full h-full opacity-40"
            >
              <path
                d="M0 290 Q240 210 520 280 T1200 250 L1200 420 L0 420 Z"
                fill="#D4A662"
                fillOpacity="0.28"
              />
              <path
                d="M0 330 Q360 250 740 325 T1200 300 L1200 420 L0 420 Z"
                fill="#1D140E"
                fillOpacity="0.45"
              />
            </svg>
          )}

          {branding.heroCoverPreset === 'antique_parchment' && (
            <svg
              className="w-full h-full opacity-[0.2]"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <pattern
                  id="pat-parchment"
                  width="80"
                  height="80"
                  patternUnits="userSpaceOnUse"
                >
                  <rect
                    x="8"
                    y="8"
                    width="64"
                    height="64"
                    fill="none"
                    stroke="#F4DEB0"
                    strokeWidth="0.7"
                  />
                  <path
                    d="M8 20 L20 8 M60 8 L72 20 M72 60 L60 72 M20 72 L8 60"
                    stroke="#F4DEB0"
                    strokeWidth="0.9"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#pat-parchment)" />
            </svg>
          )}

          {branding.heroCoverPreset === 'royal_marble' && (
            <svg
              viewBox="0 0 1200 420"
              preserveAspectRatio="none"
              className="w-full h-full opacity-30"
            >
              <path
                d="M-20 80 C280 140 420 20 760 110 C980 170 1100 70 1240 120"
                fill="none"
                stroke="#D4AF6A"
                strokeWidth="1.2"
              />
              <path
                d="M-20 260 C240 210 540 340 860 230 C1020 175 1120 260 1240 220"
                fill="none"
                stroke="#E5E7EB"
                strokeWidth="0.8"
                strokeOpacity="0.55"
              />
            </svg>
          )}

          {/* Soft Radial Ambient Crown Glow */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 50% 24%, rgba(212,175,106,0.22), transparent 62%)',
            }}
          />
        </div>
      )}

      {/* Configurable Scrim Overlay for Crisp Contrast */}
      <div
        className="absolute inset-0 transition-opacity duration-200"
        style={{
          background: `linear-gradient(180deg, rgba(16,13,10,${overlayOpacity * 0.72}) 0%, rgba(16,13,10,${overlayOpacity}) 100%)`,
        }}
      />
    </div>
  );
};

// =============================================================================
// 4. MINI WEBSITE THUMBNAIL PREVIEW FOR THE 5 THEMES
// =============================================================================
export const ThemeMiniSiteThumbnail: React.FC<{
  theme: FamilySiteThemeDefinition;
  selected: boolean;
  onSelect: () => void;
}> = ({ theme, selected, onSelect }) => {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group rounded-2xl border-2 p-2.5 text-right transition-all duration-150 cursor-pointer flex flex-col gap-2.5 bg-white ${
        selected
          ? 'border-[#C5A059] ring-2 ring-[#C5A059]/30 shadow-md'
          : 'border-[#E5DAC8] hover:border-[#C5A059]/75 shadow-2xs'
      }`}
    >
      {/* Miniature Live Website Mockup */}
      <div
        className="w-full rounded-xl overflow-hidden border border-black/10 shadow-2xs"
        style={{ backgroundColor: theme.swatchCanvas }}
      >
        {/* Mini Hero */}
        <div
          className="px-3 py-3 flex flex-col items-center gap-1.5 relative"
          style={{ backgroundColor: theme.swatchHero }}
        >
          <div
            className="w-5 h-5 rounded-full border flex items-center justify-center text-[7px] font-bold"
            style={{
              borderColor: theme.swatchAccent,
              color: theme.swatchCanvas,
              backgroundColor: 'rgba(255,255,255,0.08)',
            }}
          >
            ✦
          </div>
          <div
            className="h-1.5 w-16 rounded-full"
            style={{ backgroundColor: theme.swatchCanvas, opacity: 0.9 }}
          />
          <div
            className="h-1 w-11 rounded-full"
            style={{ backgroundColor: theme.swatchAccent, opacity: 0.85 }}
          />
        </div>
        {/* Mini Body & Cards */}
        <div className="p-2 space-y-1.5">
          <div className="grid grid-cols-3 gap-1">
            <div className="h-3.5 rounded bg-white/95 border border-black/5" />
            <div className="h-3.5 rounded bg-white/95 border border-black/5" />
            <div className="h-3.5 rounded bg-white/95 border border-black/5" />
          </div>
          <div className="flex items-center justify-between gap-1 pt-0.5">
            <div
              className="h-1.5 w-12 rounded-full opacity-30"
              style={{ backgroundColor: theme.swatchHero }}
            />
            <div
              className="h-2.5 w-8 rounded-md"
              style={{ backgroundColor: theme.swatchAccent }}
            />
          </div>
        </div>
      </div>

      {/* Theme Label & Active Indicator */}
      <div className="px-0.5 space-y-0.5">
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs font-display font-extrabold text-[#252321] truncate">
            {theme.nameAr}
          </span>
          {selected && (
            <span className="text-[10px] font-bold text-[#8D4925] shrink-0">
              مختار ✓
            </span>
          )}
        </div>
        <p className="text-[10.5px] text-[#252321]/60 line-clamp-1">
          {theme.subtitleAr}
        </p>
      </div>
    </button>
  );
};

// =============================================================================
// 5. EXACT READ-ONLY INTERACTIVE TREE MIRROR (UNIFIED «شجرتي» ENGINE)
// =============================================================================
const MIRROR_NOOP_VOID = () => {};
const MIRROR_NOOP_LOG = (_action: string, _detail: string) => {};

const READ_ONLY_MIRROR_CAPS: DashboardAccessCapabilities = {
  isVip: true,
  isMatched: false,
  isRootUnlocked: false,
  areUpperAncestorsUnlocked: false,
  showFifthBridgeNode: false,
  arePremiumTabsUnlocked: true,
  canAccessTreeDirectly: true,
  requiresCharterUpgradeForTree: false,
  tierHeaderTitle: 'دوحة نسب العائلة التفاعلية',
  membershipTierKey: 'annual_vip',
  maxTreeMembers: 5000,
  maxVaultDocuments: null,
  canPublishPublicSite: false,
  canInviteFamilyContributors: false,
  hasRegistrarBadge: false,
  hasPriorityResearchObservatory: false,
};

interface PublicVisualTreeMirrorProps {
  members: SanitizedPublicTreeMember[];
  familyName: string;
  generationsCount?: number;
  treeDisplaySettings?: TreeDisplaySettings;
  isAuthorizedFamilyViewer?: boolean;
  compactPreview?: boolean;
  velvetBandMode?: boolean;
  canProposeEnrichment?: boolean;
  siteSlug?: string;
  ownerId?: string;
  viewerDefaultName?: string;
  viewerDefaultEmail?: string;
  viewerDefaultKinship?: string;
  viewerRoleLabel?: string;
  externalTheaterOpen?: boolean;
  onExternalTheaterClose?: () => void;
  hideInlinePreview?: boolean;
}

export const PublicVisualTreeMirror: React.FC<PublicVisualTreeMirrorProps> = ({
  members,
  familyName,
  generationsCount,
  treeDisplaySettings,
  isAuthorizedFamilyViewer = false,
  compactPreview = false,
  velvetBandMode = false,
  canProposeEnrichment = false,
  siteSlug = '',
  ownerId = '',
  viewerDefaultName = '',
  viewerDefaultEmail = '',
  viewerDefaultKinship = '',
  viewerRoleLabel = 'عضو دائرة العائلة',
  externalTheaterOpen,
  onExternalTheaterClose,
  hideInlinePreview = false,
}) => {
  const [isTheaterOpen, setIsTheaterOpen] = useState(false);
  const effectiveTheaterOpen =
    typeof externalTheaterOpen === 'boolean'
      ? externalTheaterOpen
      : isTheaterOpen;
  const [isProposalSandboxActive, setIsProposalSandboxActive] = useState(false);
  const [sandboxResetNonce, setSandboxResetNonce] = useState(0);
  const [stagingDiff, setStagingDiff] = useState<{
    baseSnapshotIds: string[];
    proposedNodes: StagingProposedTreeNode[];
    parentLinkPatches: StagingParentLinkPatch[];
  }>({
    baseSnapshotIds: [],
    proposedNodes: [],
    parentLinkPatches: [],
  });
  const [showSubmitProposalModal, setShowSubmitProposalModal] = useState(false);
  const [submitName, setSubmitName] = useState(viewerDefaultName);
  const [submitEmail, setSubmitEmail] = useState(viewerDefaultEmail);
  const [submitKinship, setSubmitKinship] = useState(viewerDefaultKinship);
  const [submitNotes, setSubmitNotes] = useState('');
  const [submittingProposal, setSubmittingProposal] = useState(false);
  const [submitSuccessText, setSubmitSuccessText] = useState<string | null>(
    null
  );
  const [submitErrorText, setSubmitErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (viewerDefaultName) {
      setSubmitName((prev) => prev || viewerDefaultName);
    }
    if (viewerDefaultEmail) {
      setSubmitEmail((prev) => prev || viewerDefaultEmail);
    }
    if (viewerDefaultKinship) {
      setSubmitKinship((prev) => prev || viewerDefaultKinship);
    }
  }, [viewerDefaultName, viewerDefaultEmail, viewerDefaultKinship]);

  const handleStagingDiffChange = useCallback(
    (diff: {
      baseSnapshotIds: string[];
      proposedNodes: StagingProposedTreeNode[];
      parentLinkPatches: StagingParentLinkPatch[];
    }) => {
      setStagingDiff(diff);
    },
    []
  );

  const handleExitSandboxMode = useCallback(() => {
    setIsProposalSandboxActive(false);
    setShowSubmitProposalModal(false);
    setSubmitErrorText(null);
    setStagingDiff({
      baseSnapshotIds: [],
      proposedNodes: [],
      parentLinkPatches: [],
    });
    setSandboxResetNonce((n) => n + 1);
  }, []);

  const handleCloseTheater = useCallback(() => {
    setIsTheaterOpen(false);
    setIsProposalSandboxActive(false);
    setShowSubmitProposalModal(false);
    setSubmitSuccessText(null);
    setSubmitErrorText(null);
    setStagingDiff({
      baseSnapshotIds: [],
      proposedNodes: [],
      parentLinkPatches: [],
    });
    setSandboxResetNonce((n) => n + 1);
    onExternalTheaterClose?.();
  }, [onExternalTheaterClose]);

  const resolvedDisplaySettings = useMemo(
    () => normalizeTreeDisplaySettings(treeDisplaySettings),
    [treeDisplaySettings]
  );

  // Convert sanitized public members into InteractiveTreePerson nodes while
  // preserving exact «شجرتي» 3-tier node anatomy (firstName without forced familyName)
  // and full relational links (fatherId, motherId, spouseIds, siblingOfId).
  const mappedMirrorMembers = useMemo<InteractiveTreePerson[]>(() => {
    const validIds = new Set(members.map((m) => m.id));
    const spousePairs = new Map<string, Set<string>>();

    for (const m of members) {
      if (!spousePairs.has(m.id)) spousePairs.set(m.id, new Set());
      if (Array.isArray(m.spouseIds)) {
        for (const sid of m.spouseIds) {
          if (sid && sid !== m.id && validIds.has(sid)) {
            spousePairs.get(m.id)!.add(sid);
            if (!spousePairs.has(sid)) spousePairs.set(sid, new Set());
            spousePairs.get(sid)!.add(m.id);
          }
        }
      }
    }

    return members.map((m): InteractiveTreePerson => {
      const resolvedFirstName = (
        (isAuthorizedFamilyViewer && m.familyCircleFirstName) ||
        (isAuthorizedFamilyViewer && !m.firstName && m.familyCircleDisplayName) ||
        m.firstName ||
        m.displayName ||
        'فرد من العائلة'
      ).trim();

      const safeFatherId =
        m.fatherId && validIds.has(m.fatherId) ? m.fatherId : undefined;
      const safeMotherId =
        m.motherId && validIds.has(m.motherId) ? m.motherId : undefined;
      const safeSiblingOfId =
        m.siblingOfId && validIds.has(m.siblingOfId)
          ? m.siblingOfId
          : undefined;

      const resolvedVitalStatus: 'unspecified' | 'living' | 'deceased' =
        m.vitalStatus || (m.isDeceased ? 'deceased' : 'living');

      return {
        id: m.id,
        firstName: resolvedFirstName,
        familyName: '',
        epithet: m.epithet,
        kunya: m.kunya || '',
        honorificTitle: (m.honorificTitle as ArabicHonorificTitle) || 'بدون',
        prestigeBadge: m.prestigeBadge as TreePrestigeBadgeId | undefined,
        gender: m.gender === 'female' ? 'female' : 'male',
        generationLevel:
          typeof m.generationLevel === 'number' ? m.generationLevel : 0,
        isRecordKeeper: Boolean(m.isRecordKeeper),
        isDirectSpineLineage: Boolean(m.isDirectSpineLineage),
        relationToTargetLabel: m.relationLabel || 'فرد من العائلة',
        fatherId: safeFatherId,
        motherId: safeMotherId,
        siblingOfId: safeSiblingOfId,
        spouseIds: Array.from(spousePairs.get(m.id) || []),
        maidenFamilyLine: m.maidenFamilyLine,
        marriageAllianceNote: m.marriageAllianceNote,
        vitalStatus: resolvedVitalStatus,
        birthPrecision: m.birthPrecision || 'year_only',
        birthCalendar: m.birthCalendar || 'hijri',
        birthDateValue: m.birthYear || '',
        birthPlace: m.birthPlace || '',
        deathDateValue: m.deathYear,
        deathPlace: m.deathPlace,
        femalePrivacyMasked: Boolean(m.femalePrivacyMasked),
        biography: m.bioSnippet,
        photoUrl: m.photoUrl,
        photoThumbnailUrl: m.photoThumbnailUrl,
      };
    });
  }, [members, isAuthorizedFamilyViewer]);

  const resolvedGenerationsCount = useMemo(() => {
    if (typeof generationsCount === 'number' && generationsCount > 0) {
      return generationsCount;
    }
    return new Set(mappedMirrorMembers.map((m) => m.generationLevel)).size;
  }, [generationsCount, mappedMirrorMembers]);

  const mirrorLineageResult = useMemo<LineageSearchResult>(
    () => ({
      matched: false,
      engineSource: 'neo4j_verified_graph',
      clientName: '',
      fatherName: '',
      grandfatherName: '',
      familyName,
      familyCode: '',
      originCountry: '',
      rootBranchName: '',
      rootBranchCode: '',
      rootTribeName: '',
      rootTribeCode: '',
      rootSummaryLabel: '',
      upperAncestors: [],
      adamSpineNodes: [],
      capsules: [],
      requiresBlindDisambiguation: false,
      disambiguationOptions: [],
      verifiedSourceCitation: '',
      secondarySources: [],
      historicalRegion: '',
      conflictingNarrativesNote: '',
      confidenceLabel: '',
      recommendedInitialState: DashboardStateMode.AnnualVip,
    }),
    [familyName]
  );

  // Lock page scroll and allow Escape key to close topmost dialog cleanly
  useEffect(() => {
    if (!effectiveTheaterOpen || typeof document === 'undefined') return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showSubmitProposalModal) {
        setShowSubmitProposalModal(false);
        return;
      }
      const openDialogs = document.querySelectorAll('[role="dialog"]');
      if (openDialogs.length <= 1) {
        handleCloseTheater();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [effectiveTheaterOpen, showSubmitProposalModal, handleCloseTheater]);

  const handleSubmitStagingProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitName.trim() || stagingDiff.proposedNodes.length === 0) {
      setSubmitErrorText('يرجى كتابة اسمك والتأكد من إضافة فرد واحد على الأقل.');
      return;
    }
    if (!siteSlug || !ownerId) {
      setSubmitErrorText(
        'تعذر تحديد سجل البوابة العائلية لإرسال المقترح في وضع المعاينة.'
      );
      return;
    }
    setSubmittingProposal(true);
    setSubmitErrorText(null);
    try {
      const firstProposed = stagingDiff.proposedNodes[0];
      const anchorParentId =
        firstProposed.fatherId ||
        firstProposed.motherId ||
        firstProposed.spouseIds[0] ||
        firstProposed.siblingOfId;
      const anchorNode = anchorParentId
        ? mappedMirrorMembers.find((m) => m.id === anchorParentId)
        : undefined;

      await submitTreeEnrichmentRequest({
        siteSlug,
        ownerId,
        familyName,
        requesterName: submitName.trim(),
        requesterEmail: submitEmail.trim() || undefined,
        requesterRoleLabel: viewerRoleLabel,
        kinshipRelation: submitKinship.trim() || undefined,
        requestType: 'ADD_TREE_MEMBER',
        proposalMode: 'STAGING_TREE',
        targetPersonId: anchorNode?.id,
        targetPersonName: anchorNode?.firstName,
        proposedFirstName:
          stagingDiff.proposedNodes.length === 1
            ? firstProposed.firstName
            : `${firstProposed.firstName} و${stagingDiff.proposedNodes.length - 1} آخرين`,
        proposedGender: firstProposed.gender,
        proposedBirthYear: firstProposed.birthDateValue || undefined,
        proposedBirthPlace: firstProposed.birthPlace || undefined,
        proposedNotes: submitNotes.trim() || undefined,
        baseSnapshotIds: stagingDiff.baseSnapshotIds,
        proposedNodes: stagingDiff.proposedNodes,
        parentLinkPatches: stagingDiff.parentLinkPatches,
      });

      setSubmitSuccessText(
        `تم إرسال مقترح إضافة (${stagingDiff.proposedNodes.length} ${
          stagingDiff.proposedNodes.length === 1 ? 'فرد جديد' : 'أفراد جدد'
        }) إلى صندوق اعتماد أمين سجل عائلة ${familyName} بنجاح ✦ ستُدمج إضافاتك في الشجرة فور المراجعة.`
      );
      setSubmitNotes('');
      setIsProposalSandboxActive(false);
      setStagingDiff({
        baseSnapshotIds: [],
        proposedNodes: [],
        parentLinkPatches: [],
      });
      setSandboxResetNonce((n) => n + 1);
    } catch {
      setSubmitErrorText(
        'تعذر إرسال المقترح حالياً. يرجى التأكد من اتصالك بالإنترنت أو صلاحية الإثراء ثم المحاولة مجدداً.'
      );
    } finally {
      setSubmittingProposal(false);
    }
  };

  if (mappedMirrorMembers.length === 0) {
    if (hideInlinePreview) return null;
    return (
      <div className="rounded-3xl fs-surface-alt border fs-border p-10 text-center space-y-2">
        <div className="text-sm font-bold fs-display-font">
          لم تُضف فروع معاصرة للعرض العام بعد
        </div>
        <p className="text-xs fs-muted">
          ستظهر دوحة نسب عائلة {familyName} هنا بنفس التصميم المعتمد فور إضافة
          الأفراد في «شجرتي».
        </p>
      </div>
    );
  }

  const proposedCount = stagingDiff.proposedNodes.length;

  const theaterModal =
    effectiveTheaterOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            dir="rtl"
            role="dialog"
            aria-modal="true"
            aria-label={`قاعة استعراض دوحة نسب عائلة ${familyName}`}
            className="fixed inset-0 z-[70] flex flex-col bg-[#F7F1E4] text-[#231E1A]"
          >
            {/* Theater Top Bar — Strict Warm Ivory Brand Palette */}
            <header className="shrink-0 bg-[#E8DED2] text-[#1F1F1C] border-b border-[#D8C7B2] px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl border border-[#D8C7B2] bg-[#FAF7F2] text-[#D97757] flex items-center justify-center shrink-0">
                  <GitBranch className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold tracking-wide text-[#D97757]">
                    {isProposalSandboxActive
                      ? 'وضع اقتراح إثراء الدوحة (مسودة تفاعلية آمنة)'
                      : 'قاعة استعراض السجل الشجري الجامع'}
                  </div>
                  <h2 className="text-sm sm:text-lg font-display font-bold truncate text-[#1F1F1C]">
                    دوحة نسب عائلة {familyName}
                  </h2>
                </div>
                <div className="hidden lg:flex items-center gap-2 mr-2 text-[11px] text-[#1F1F1C]/70 tabular-nums">
                  <span>{mappedMirrorMembers.length} فرد موثق</span>
                  {resolvedGenerationsCount > 0 && (
                    <>
                      <span aria-hidden="true" className="opacity-45">
                        ·
                      </span>
                      <span>{resolvedGenerationsCount} أجيال متصلة</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {!isProposalSandboxActive &&
                  canProposeEnrichment &&
                  !compactPreview && (
                    <button
                      type="button"
                      data-testid="enter-tree-proposal-sandbox-btn"
                      onClick={() => {
                        setSubmitSuccessText(null);
                        setSubmitErrorText(null);
                        setIsProposalSandboxActive(true);
                      }}
                      className="h-9 px-3.5 rounded-xl bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>اقترح إضافة فرع أو قريب</span>
                    </button>
                  )}

                {isProposalSandboxActive && (
                  <>
                    {proposedCount > 0 && (
                      <button
                        type="button"
                        data-testid="open-submit-staging-proposal-btn"
                        onClick={() => {
                          setSubmitErrorText(null);
                          setSubmitSuccessText(null);
                          setShowSubmitProposalModal(true);
                        }}
                        className="h-9 px-4 rounded-xl bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] text-xs font-display font-extrabold inline-flex items-center gap-1.5 cursor-pointer transition-all shadow-sm whitespace-nowrap"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>
                          إرسال الإضافات المقترحة لاعتماد أمين السجل (
                          {proposedCount}{' '}
                          {proposedCount === 1 ? 'فرد جديد' : 'أفراد جدد'})
                        </span>
                      </button>
                    )}
                    <button
                      type="button"
                      data-testid="cancel-tree-proposal-sandbox-btn"
                      onClick={handleExitSandboxMode}
                      className="h-9 px-3 rounded-xl bg-[#FAF7F2] hover:bg-[#D8C7B2]/45 border border-[#D8C7B2] text-[#1F1F1C] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-[#D97757]" />
                      <span>إلغاء وضع الاقتراح</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  data-testid="close-tree-theater-btn"
                  onClick={handleCloseTheater}
                  className="h-9 px-4 rounded-xl bg-[#FAF7F2] hover:bg-[#D8C7B2]/50 border border-[#D8C7B2] text-[#1F1F1C] text-xs font-display font-extrabold inline-flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs whitespace-nowrap"
                >
                  <span>إغلاق والعودة للديوان</span>
                  <X className="w-4 h-4 text-[#D97757]" />
                </button>
              </div>
            </header>

            {/* Active Interactive Sandbox Guidance Banner */}
            {isProposalSandboxActive && (
              <div
                data-testid="proposal-sandbox-guidance-banner"
                className="shrink-0 bg-[#FAF7F2] text-[#1F1F1C] border-b border-[#D8C7B2] px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2 leading-relaxed">
                  <Sparkles className="w-4 h-4 text-[#D97757] shrink-0" />
                  <span className="font-semibold">
                    وضع اقتراح الإثراء نشط: اضغط على علامة (+) في أي بطاقة قريب
                    لإضافة ابن أو ابنة أو زوجة أو شقيق كما في الشجرة الحقيقية،
                    ثم أرسل مقترحك لاعتماد أمين السجل.
                  </span>
                </div>
                <div className="text-[11px] font-bold text-[#D97757] tabular-nums shrink-0">
                  {proposedCount > 0
                    ? `تمت إضافة ${proposedCount} ${
                        proposedCount === 1 ? 'فرد مقترح' : 'أفراد مقترحين'
                      } · البطاقات الأصلية محمية`
                    : 'البطاقات الأصلية محمية من التعديل أو الحذف'}
                </div>
              </div>
            )}

            {/* Post-Submission Success Toast Banner inside Theater */}
            {submitSuccessText && !showSubmitProposalModal && (
              <div className="shrink-0 bg-emerald-900 text-emerald-50 border-b border-emerald-400/40 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                  <span>{submitSuccessText}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSubmitSuccessText(null)}
                  className="text-emerald-200 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Full-Height Exact «شجرتي» Interactive Tree Stage */}
            <div className="flex-1 min-h-0 flex flex-col p-2.5 sm:p-4 overflow-hidden">
              <InteractiveFamilyTreeBuilder
                result={mirrorLineageResult}
                accountType={AccountLegalType.Individual}
                caps={READ_ONLY_MIRROR_CAPS}
                onUpgradeAnnualVip={MIRROR_NOOP_VOID}
                onSignCharterAndEnableTree={MIRROR_NOOP_VOID}
                onLogActivity={MIRROR_NOOP_LOG}
                publicMirrorMode={{
                  members: mappedMirrorMembers,
                  displaySettings: resolvedDisplaySettings,
                  compactPreview: false,
                  theaterMode: true,
                  proposalSandbox:
                    canProposeEnrichment && !compactPreview
                      ? {
                          active: isProposalSandboxActive,
                          baseSnapshotIds: mappedMirrorMembers.map((m) => m.id),
                          resetNonce: sandboxResetNonce,
                          onStagingChange: handleStagingDiffChange,
                        }
                      : undefined,
                }}
              />
            </div>

            {/* In-Theater Confirmation Dialog for Submitting Staged Tree Proposals */}
            {showSubmitProposalModal && (
              <div
                role="dialog"
                aria-modal="true"
                data-testid="submit-staging-proposal-modal"
                className="fixed inset-0 z-[95] bg-[#16120E]/72 backdrop-blur-xs flex items-center justify-center p-4"
              >
                <div className="w-full max-w-lg rounded-3xl bg-[#FCF9F2] border-2 border-[#C8A054]/60 text-[#231E1A] p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between border-b border-[#B98A78]/30 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-emerald-800 text-white flex items-center justify-center shrink-0">
                        <Send className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm sm:text-base font-display font-extrabold text-[#231E1A]">
                          إرسال الإضافات المقترحة لاعتماد أمين السجل
                        </h3>
                        <p className="text-[11px] text-[#231E1A]/65 flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                          <span>صفتك الموثّقة: {viewerRoleLabel}</span>
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowSubmitProposalModal(false)}
                      className="w-8 h-8 rounded-lg hover:bg-black/5 flex items-center justify-center cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {submitSuccessText ? (
                    <div className="rounded-2xl bg-emerald-50 border border-emerald-300/80 p-5 text-center space-y-3">
                      <CheckCircle2 className="w-9 h-9 text-emerald-700 mx-auto" />
                      <p className="text-xs sm:text-sm font-bold text-emerald-950 leading-relaxed">
                        {submitSuccessText}
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowSubmitProposalModal(false)}
                        className="px-5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold cursor-pointer"
                      >
                        العودة لاستعراض الدوحة
                      </button>
                    </div>
                  ) : (
                    <form
                      onSubmit={handleSubmitStagingProposal}
                      className="space-y-4"
                    >
                      {/* Summary of Proposed Additions */}
                      <div className="rounded-2xl bg-white border border-emerald-700/25 p-3.5 space-y-2">
                        <div className="text-xs font-display font-bold text-emerald-900">
                          ملخص الأفراد المقترح إضافتهم ({proposedCount}):
                        </div>
                        <ul className="space-y-1.5 text-xs text-[#231E1A]/85">
                          {stagingDiff.proposedNodes.map((pn) => {
                            const parentName = pn.fatherId
                              ? mappedMirrorMembers.find(
                                  (m) => m.id === pn.fatherId
                                )?.firstName ||
                                stagingDiff.proposedNodes.find(
                                  (x) => x.id === pn.fatherId
                                )?.firstName
                              : undefined;
                            return (
                              <li
                                key={pn.id}
                                className="flex items-center justify-between gap-2 border-b border-[#B98A78]/15 last:border-b-0 pb-1 last:pb-0"
                              >
                                <span className="font-bold text-[#231E1A]">
                                  ✦ {pn.firstName}
                                  {pn.birthDateValue
                                    ? ` (${pn.birthDateValue})`
                                    : ''}
                                </span>
                                <span className="text-[11px] text-[#8D4925] font-semibold">
                                  {pn.relationToTargetLabel}
                                  {parentName ? ` · يتبع ${parentName}` : ''}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-bold text-[#231E1A]/75 mb-1">
                            اسمك الكامل *
                          </label>
                          <input
                            type="text"
                            required
                            value={submitName}
                            onChange={(e) => setSubmitName(e.target.value)}
                            placeholder="الاسم الكامل"
                            className="w-full px-3 py-2 rounded-xl bg-white border border-[#B98A78]/45 text-xs focus:outline-none focus:border-emerald-700"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-[#231E1A]/75 mb-1">
                            صلة القرابة بالعائلة
                          </label>
                          <input
                            type="text"
                            value={submitKinship}
                            onChange={(e) => setSubmitKinship(e.target.value)}
                            placeholder="مثال: ابن عم، شقيق، ابن أخت..."
                            className="w-full px-3 py-2 rounded-xl bg-white border border-[#B98A78]/45 text-xs focus:outline-none focus:border-emerald-700"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#231E1A]/75 mb-1">
                          ملاحظة إضافية لأمين السجل (اختياري)
                        </label>
                        <textarea
                          rows={2}
                          value={submitNotes}
                          onChange={(e) => setSubmitNotes(e.target.value)}
                          placeholder="أي تفاصيل أو توثيق إضافي يساعد أمين السجل عند المراجعة..."
                          className="w-full px-3 py-2 rounded-xl bg-white border border-[#B98A78]/45 text-xs focus:outline-none focus:border-emerald-700"
                        />
                      </div>

                      {submitErrorText && (
                        <div className="rounded-xl bg-rose-50 border border-rose-300 px-3 py-2 text-xs text-rose-900 font-semibold">
                          {submitErrorText}
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowSubmitProposalModal(false)}
                          className="px-4 py-2.5 rounded-xl bg-[#F2EAE0] text-xs font-bold text-[#231E1A] cursor-pointer"
                        >
                          متابعة الإضافة على الشجرة
                        </button>
                        <button
                          type="submit"
                          disabled={submittingProposal}
                          data-testid="confirm-send-staging-proposal-btn"
                          className="px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 disabled:opacity-55 text-white text-xs font-display font-extrabold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>
                            {submittingProposal
                              ? 'جارٍ الإرسال...'
                              : 'إرسال المقترح لاعتماد أمين السجل ✦'}
                          </span>
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>,
          document.body
        )
      : null;

  if (hideInlinePreview) {
    return <>{theaterModal}</>;
  }

  return (
    <>
      {/* ROYAL TREE GATEHOUSE CARD (Ceremonial Gateway + Living Family Constellation) */}
      <div
        data-testid="royal-tree-gatehouse-card"
        className={`relative overflow-hidden rounded-3xl border shadow-[0_16px_44px_rgba(12,8,5,0.22)] ${
          compactPreview
            ? 'min-h-[300px] px-4 py-7'
            : 'min-h-[380px] sm:min-h-[430px] px-5 sm:px-10 py-10 sm:py-12'
        } flex items-center justify-center`}
        style={{
          borderColor: velvetBandMode
            ? 'color-mix(in srgb, var(--fs-gold) 45%, transparent)'
            : 'color-mix(in srgb, var(--fs-gold) 44%, transparent)',
          backgroundColor: velvetBandMode
            ? 'rgba(255, 250, 240, 0.04)'
            : 'var(--fs-surface-alt)',
        }}
      >
        {/* Blurred Heritage Tree Silhouette Backdrop (Atmospheric Teaser) */}
        <div
          aria-hidden="true"
          className="pointer-events-none select-none absolute inset-0 overflow-hidden"
        >
          <svg
            viewBox="0 0 1100 540"
            preserveAspectRatio="xMidYMid slice"
            className={`w-full h-full blur-[5px] scale-105 ${
              velvetBandMode ? 'opacity-25' : 'opacity-35'
            }`}
          >
            {/* Connecting Genealogy Lines */}
            <g
              fill="none"
              stroke={velvetBandMode ? 'var(--fs-gold)' : 'var(--fs-accent)'}
              strokeWidth="2.5"
              strokeOpacity="0.65"
            >
              <path d="M550 94 V145 M275 145 H825 M275 145 V184 M550 145 V184 M825 145 V184" />
              <path d="M275 248 V292 M155 292 H395 M155 292 V328 M275 292 V328 M395 292 V328" />
              <path d="M550 248 V292 M490 292 H610 M490 292 V328 M610 292 V328" />
              <path d="M825 248 V292 M725 292 H945 M725 292 V328 M835 292 V328 M945 292 V328" />
              <path d="M155 390 V440 M395 390 V440 M610 390 V440 M835 390 V440" />
            </g>

            <g>
              <rect
                x="460"
                y="34"
                width="180"
                height="62"
                rx="16"
                fill="var(--fs-hero-bg)"
                stroke="var(--fs-gold)"
                strokeWidth="3"
              />
              <rect
                x="494"
                y="54"
                width="112"
                height="10"
                rx="5"
                fill="var(--fs-gold)"
                fillOpacity="0.85"
              />
            </g>

            {[275, 550, 825].map((cx) => (
              <g key={`t2-${cx}`}>
                <rect
                  x={cx - 76}
                  y="184"
                  width="152"
                  height="64"
                  rx="14"
                  fill={velvetBandMode ? 'rgba(255,255,255,0.12)' : 'var(--fs-surface)'}
                  stroke="var(--fs-gold)"
                  strokeWidth="2.4"
                />
                <circle
                  cx={cx + 48}
                  cy="216"
                  r="15"
                  fill="var(--fs-gold)"
                  fillOpacity="0.45"
                />
              </g>
            ))}

            {[155, 275, 395, 490, 610, 725, 835, 945].map((cx) => (
              <rect
                key={`t3-${cx}`}
                x={cx - 48}
                y="328"
                width="96"
                height="62"
                rx="12"
                fill={velvetBandMode ? 'rgba(255,255,255,0.08)' : 'var(--fs-surface)'}
                stroke="var(--fs-gold)"
                strokeWidth="1.8"
                strokeOpacity="0.55"
              />
            ))}
          </svg>
        </div>

        {/* Atmospheric Veil — Strict Warm Ivory Parchment */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 48%, rgba(250,247,242,0.72) 0%, rgba(245,241,232,0.88) 68%, rgba(232,222,210,0.94) 100%)',
          }}
        />

        {/* Delicate Inner Archival Corner Hairline */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-3 rounded-2xl border border-[#D8C7B2]/60"
        />

        {/* Centered Heritage Charter Gatehouse Plaque — Strict Warm Ivory */}
        <div
          className={`relative z-10 w-full max-w-2xl rounded-3xl backdrop-blur-md border border-[#D8C7B2] bg-[#FAF7F2]/95 text-[#1F1F1C] shadow-[0_18px_44px_rgba(31,31,28,0.08)] text-center flex flex-col items-center ${
            compactPreview ? 'p-5 space-y-4' : 'p-6 sm:p-9 space-y-5'
          }`}
        >
          {/* Top Gilded Crown Line */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-12 top-0 h-[2px]"
            style={{
              background:
                'linear-gradient(90deg, transparent, var(--fs-gold), transparent)',
            }}
          />

          {/* Living Family Faces Constellation (Circular Gold-Ringed Medallions) */}
          <LivingFamilyConstellation
            members={members}
            compactPreview={compactPreview}
            tone={velvetBandMode ? 'dark' : 'light'}
          />

          <div className="space-y-2">
            <h3
              className={`${
                compactPreview ? 'text-lg' : 'text-xl sm:text-2xl'
              } font-bold fs-display-font`}
            >
              دوحة نسب عائلة {familyName}
            </h3>
            <p
              className={`text-xs sm:text-sm leading-relaxed max-w-lg mx-auto ${
                velvetBandMode ? 'text-[#FAF4E8]/80' : 'fs-muted'
              }`}
            >
              توثّق هذه الدوحة تسلسل أجيال وفروع عائلة {familyName} المسجلة في
              الديوان العائلي ضمن لوحة تفاعلية كاملة قابلة للتكبير والبحث.
            </p>
          </div>

          {/* Clean Unboxed Typographic Metadata Line */}
          <div
            className={`flex flex-wrap items-center justify-center gap-3 text-xs font-bold tabular-nums ${
              velvetBandMode ? 'text-[#F3D299]' : 'fs-accent-text'
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>{mappedMirrorMembers.length} فرد موثق</span>
            </span>
            {resolvedGenerationsCount > 0 && (
              <>
                <span aria-hidden="true" className="opacity-45">
                  ·
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{resolvedGenerationsCount} أجيال متصلة</span>
                </span>
              </>
            )}
          </div>

          {/* Gatehouse Primary Action Button (Enrichment moved strictly inside Theater) */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1 w-full">
            <button
              type="button"
              data-testid="open-tree-theater-btn"
              onClick={() => setIsTheaterOpen(true)}
              className="px-5 sm:px-6 py-3 rounded-2xl text-xs sm:text-sm font-display font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:scale-[1.015] transition-all border whitespace-nowrap"
              style={
                velvetBandMode
                  ? {
                      background:
                        'linear-gradient(135deg, #E8C77B 0%, #C89B45 100%)',
                      color: '#1E150E',
                      borderColor: '#F5DFAA',
                    }
                  : {
                      backgroundColor: 'var(--fs-accent)',
                      color: '#FFFFFF',
                      borderColor:
                        'color-mix(in srgb, var(--fs-gold) 50%, transparent)',
                    }
              }
            >
              <Maximize2 className="w-4 h-4 shrink-0" />
              <span>✦ فتح واستعراض دوحة العائلة التفاعلية</span>
            </button>
          </div>
        </div>
      </div>

      {theaterModal}
    </>
  );
};

// =============================================================================
// 6. FRAMED MUSEUM HERITAGE PAVILION & ORNAMENTED SECTION HEADER
// =============================================================================
export const HeritageSectionPavilion: React.FC<{
  id: string;
  compactPreview?: boolean;
  watermarkVariant?: 'arabesque' | 'compass' | 'manuscript';
  children: React.ReactNode;
}> = ({
  id,
  compactPreview = false,
  watermarkVariant = 'arabesque',
  children,
}) => {
  return (
    <section id={id} className="scroll-mt-24">
      <div
        className={`relative overflow-hidden rounded-3xl border fs-pavilion ${
          compactPreview ? 'p-4 sm:p-5 space-y-4' : 'p-6 sm:p-9 lg:p-10 space-y-6'
        }`}
        style={{
          borderColor: 'color-mix(in srgb, var(--fs-gold) 32%, transparent)',
        }}
      >
        {/* Delicate Gilded Top Crown Hairline */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-10 top-0 h-[1.5px]"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, var(--fs-gold) 50%, transparent 100%)',
          }}
        />

        {/* Faint Corner Filigree Watermark (Top-Left) */}
        {watermarkVariant === 'compass' ? (
          <svg
            aria-hidden="true"
            viewBox="0 0 220 220"
            className="pointer-events-none select-none absolute -top-10 -left-10 w-52 h-52 opacity-[0.065]"
            style={{ color: 'var(--fs-gold)' }}
          >
            <circle
              cx="110"
              cy="110"
              r="86"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.1"
            />
            <circle
              cx="110"
              cy="110"
              r="62"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              strokeDasharray="4 4"
            />
            <path
              d="M110 14 L122 98 L206 110 L122 122 L110 206 L98 122 L14 110 L98 98 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            />
            <path
              d="M44 44 L103 103 M176 44 L117 103 M176 176 L117 117 M44 176 L103 117"
              stroke="currentColor"
              strokeWidth="0.7"
            />
          </svg>
        ) : (
          <svg
            aria-hidden="true"
            viewBox="0 0 200 200"
            className="pointer-events-none select-none absolute -top-12 -left-12 w-48 h-48 opacity-[0.055]"
            style={{ color: 'var(--fs-gold)' }}
          >
            <g fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="44" y="44" width="112" height="112" />
              <rect
                x="44"
                y="44"
                width="112"
                height="112"
                transform="rotate(45 100 100)"
              />
              <circle cx="100" cy="100" r="78" strokeDasharray="3 5" />
              <circle cx="100" cy="100" r="36" />
            </g>
          </svg>
        )}

        {/* Secondary Quiet Filigree Echo (Bottom-Right) */}
        <svg
          aria-hidden="true"
          viewBox="0 0 140 140"
          className="pointer-events-none select-none absolute -bottom-10 -right-10 w-36 h-36 opacity-[0.04]"
          style={{ color: 'var(--fs-accent)' }}
        >
          <g fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="30" y="30" width="80" height="80" />
            <rect
              x="30"
              y="30"
              width="80"
              height="80"
              transform="rotate(45 70 70)"
            />
            <circle cx="70" cy="70" r="56" />
          </g>
        </svg>

        <div className="relative z-10 space-y-6">{children}</div>
      </div>
    </section>
  );
};

export const HeritagePavilionHeader: React.FC<{
  kicker: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  tone?: 'light' | 'dark';
}> = ({ kicker, title, subtitle, icon, action, tone = 'light' }) => {
  const isDark = tone === 'dark';
  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="space-y-1.5">
          <div
            className={`inline-flex items-center gap-1.5 text-[11.5px] font-bold tracking-wide ${
              isDark ? 'text-[#F3D299]' : 'fs-accent-text'
            }`}
          >
            {icon}
            <span>{kicker}</span>
          </div>
          <h2
            className={`text-xl sm:text-2xl lg:text-[28px] font-bold fs-display-font leading-snug text-balance ${
              isDark ? 'text-[#FFF9EE]' : ''
            }`}
          >
            {title}
          </h2>
          {subtitle && (
            <p
              className={`text-xs sm:text-sm leading-relaxed max-w-2xl ${
                isDark ? 'text-[#FAF4E8]/80' : 'fs-muted'
              }`}
            >
              {subtitle}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      {/* Gilded Architectural Divider Hairline */}
      <div className="flex items-center gap-2.5" aria-hidden="true">
        <span
          className="text-[10px] leading-none"
          style={{ color: isDark ? '#F3D299' : 'var(--fs-gold)' }}
        >
          ✦
        </span>
        <div
          className="h-px flex-1"
          style={{
            background: isDark
              ? 'linear-gradient(270deg, rgba(243,210,153,0.75) 0%, rgba(243,210,153,0.22) 55%, transparent 100%)'
              : 'linear-gradient(270deg, var(--fs-gold) 0%, color-mix(in srgb, var(--fs-gold) 28%, transparent) 55%, transparent 100%)',
          }}
        />
      </div>
    </div>
  );
};
