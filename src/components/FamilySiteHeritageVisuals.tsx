import React, { useMemo } from 'react';
import { Lock, Sparkles } from 'lucide-react';
import { FamilySiteThemeDefinition } from '../config/referralAndSiteConfig';
import {
  COMMERCIAL_LINEAGE_PAYWALL_TEASER_AR,
  FamilyCrestStyle,
  FamilyPortalVisualBranding,
  HeroCoverPresetId,
  HeroLayoutStyle,
  PortalSectionKey,
  PortalTypographyId,
  SanitizedPublicTreeMember,
} from '../services/priority4Service';
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
  tree_mirror: 'مرآة شجرة العائلة التفاعلية',
  vault_gallery: 'معرض خزانة الصور والوثائق',
  news: 'أخبار وتباشير العائلة',
  events: 'المناسبات واللقاءات القادمة',
  stories: 'قصص الأجداد والذكريات',
  notables: 'لوحة الشرف وأعلام العائلة',
  atlas: 'أطلس الديار والإحصائيات',
  oral_heritage: 'الموروث الصوتي والشعري',
  professions: 'دليل الكفاءات والتخصصات',
  memorial: 'ركن الوفاء وكبسولة الزمن',
  majlis: 'مجلس العائلة وحراس الذاكرة',
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
            ? 'border-[#D4AF6A]/60 bg-[#FAF6EE] shadow-xs'
            : 'border-[#D4AF6A]/65 bg-[#1B1815]/60 shadow-lg'
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
  tierHeaderTitle: 'مرآة شجرة العائلة',
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
  treeDisplaySettings?: TreeDisplaySettings;
  isAuthorizedFamilyViewer?: boolean;
  compactPreview?: boolean;
  onProposeEnrichment?: () => void;
  onStartOwnSearch?: () => void;
}

export const PublicVisualTreeMirror: React.FC<PublicVisualTreeMirrorProps> = ({
  members,
  familyName,
  treeDisplaySettings,
  isAuthorizedFamilyViewer = false,
  compactPreview = false,
  onProposeEnrichment,
  onStartOwnSearch,
}) => {
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

  return (
    <div className="space-y-5">
      {/* Refined Gilded Commercial Lineage Teaser (Strict Paywall Isolation) */}
      <div
        className="rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5"
        style={{
          background:
            'linear-gradient(135deg, rgba(212,175,106,0.12) 0%, rgba(255,255,255,0.45) 100%)',
          borderColor: 'var(--fs-gold)',
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border"
            style={{
              backgroundColor: 'var(--fs-hero-bg)',
              color: 'var(--fs-gold)',
              borderColor: 'var(--fs-gold)',
            }}
          >
            <Lock className="w-4 h-4" />
          </div>
          <div className="space-y-0.5">
            <div className="text-xs font-bold fs-accent-text flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>عمود النسب التاريخي المحقّق لعائلة {familyName}</span>
            </div>
            <p className="text-xs fs-muted leading-relaxed">
              {COMMERCIAL_LINEAGE_PAYWALL_TEASER_AR}
            </p>
          </div>
        </div>
        {onStartOwnSearch && !compactPreview && (
          <button
            type="button"
            onClick={onStartOwnSearch}
            className="px-4 py-2 rounded-xl fs-accent-bg text-xs font-bold shrink-0 cursor-pointer hover:opacity-95 transition-opacity whitespace-nowrap"
          >
            استكشف عمود النسب في جذوري
          </button>
        )}
      </div>

      {/* Exact Read-Only Mirror of «شجرتي» Engine (100% Unified Display Settings) */}
      {mappedMirrorMembers.length > 0 ? (
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
            compactPreview,
            onProposeEnrichment: !compactPreview
              ? onProposeEnrichment
              : undefined,
          }}
        />
      ) : (
        <div className="rounded-3xl fs-surface-alt border fs-border p-10 text-center space-y-2">
          <div className="text-sm font-bold fs-display-font">
            لم تُضف فروع معاصرة للعرض العام بعد
          </div>
          <p className="text-xs fs-muted">
            ستظهر مشجرة عائلة {familyName} هنا بنفس التصميم المعتمد فور إضافة
            الأفراد في «شجرتي».
          </p>
        </div>
      )}
    </div>
  );
};
