import React, { useMemo, useState } from 'react';
import {
  GitBranch,
  List,
  Lock,
  Minus,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  User,
  X,
} from 'lucide-react';
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
    subtitle: 'إكليل سعفي مذهّب يحيط باسم الأسرة',
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
  patriarch_quote: 'كلمة ووصية عميد الأسرة',
  tree_mirror: 'مرآة شجرة الأسرة التفاعلية',
  vault_gallery: 'معرض خزانة الصور والوثائق',
  news: 'أخبار وتباشير الأسرة',
  events: 'المناسبات واللقاءات القادمة',
  stories: 'قصص الأجداد والذكريات',
  notables: 'لوحة الشرف وأعلام الأسرة',
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
          alt={`شعار أسرة ${familyName}`}
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
      aria-label={`ختم أسرة ${familyName}`}
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
// 5. INTERACTIVE VISUAL TREE MIRROR (PUBLIC FAMILY PORTAL)
// =============================================================================
interface PublicVisualTreeMirrorProps {
  members: SanitizedPublicTreeMember[];
  familyName: string;
  compactPreview?: boolean;
  onProposeEnrichment?: () => void;
  onStartOwnSearch?: () => void;
}

export const PublicVisualTreeMirror: React.FC<PublicVisualTreeMirrorProps> = ({
  members,
  familyName,
  compactPreview = false,
  onProposeEnrichment,
  onStartOwnSearch,
}) => {
  const [viewMode, setViewMode] = useState<'visual_tree' | 'generations_list'>(
    'visual_tree'
  );
  const [zoomPercent, setZoomPercent] = useState<number>(100);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const normalizedQuery = searchTerm.trim().toLowerCase();

  // Group members by generation level (top oldest -> bottom youngest)
  const generationRows = useMemo(() => {
    const byGen = new Map<number, SanitizedPublicTreeMember[]>();
    for (const m of members) {
      const g = typeof m.generationLevel === 'number' ? m.generationLevel : 0;
      const list = byGen.get(g) || [];
      list.push(m);
      byGen.set(g, list);
    }
    const sortedLevels = Array.from(byGen.keys()).sort((a, b) => b - a);
    return sortedLevels.map((level, index) => ({
      level,
      ordinalLabel:
        [
          'الجيل المؤسس',
          'الجيل الثاني',
          'الجيل الثالث',
          'الجيل الرابع',
          'الجيل الخامس',
          'الجيل السادس',
          'الجيل السابع',
        ][index] || `الجيل ${index + 1}`,
      people: byGen.get(level) || [],
    }));
  }, [members]);

  // Build parent -> children map for true connected pedigree tree layout
  const { rootMembers, childrenMap } = useMemo(() => {
    const idSet = new Set(members.map((m) => m.id));
    const cMap = new Map<string, SanitizedPublicTreeMember[]>();
    const roots: SanitizedPublicTreeMember[] = [];

    for (const m of members) {
      if (m.fatherId && idSet.has(m.fatherId)) {
        const list = cMap.get(m.fatherId) || [];
        list.push(m);
        cMap.set(m.fatherId, list);
      } else {
        roots.push(m);
      }
    }

    // Sort roots highest generation first
    roots.sort((a, b) => (b.generationLevel || 0) - (a.generationLevel || 0));
    return { rootMembers: roots, childrenMap: cMap };
  }, [members]);

  const matchingCount = useMemo(() => {
    if (!normalizedQuery) return members.length;
    return members.filter((m) =>
      `${m.displayName} ${m.epithet || ''} ${m.kunya || ''} ${m.relationLabel} ${m.birthPlace || ''}`
        .toLowerCase()
        .includes(normalizedQuery)
    ).length;
  }, [members, normalizedQuery]);

  const renderTreeBranch = (
    node: SanitizedPublicTreeMember,
    depth = 0
  ): React.ReactNode => {
    if (depth > 8) return null;
    const children = childrenMap.get(node.id) || [];
    const isMatch =
      normalizedQuery.length > 0 &&
      `${node.displayName} ${node.epithet || ''} ${node.kunya || ''} ${node.relationLabel} ${node.birthPlace || ''}`
        .toLowerCase()
        .includes(normalizedQuery);
    const isDimmed = normalizedQuery.length > 0 && !isMatch;

    return (
      <div
        key={node.id}
        className="flex flex-col items-center relative shrink-0"
      >
        {/* Pedigree Member Card */}
        <div
          className={`w-[156px] rounded-2xl border px-3 py-2.5 text-center transition-all duration-200 relative ${
            isMatch
              ? 'fs-surface border-2 shadow-lg ring-2 ring-[#D4AF6A]/60 scale-[1.03]'
              : 'fs-surface fs-border shadow-xs hover:shadow-md'
          } ${isDimmed ? 'opacity-35' : 'opacity-100'}`}
          style={isMatch ? { borderColor: 'var(--fs-gold)' } : undefined}
        >
          <div className="flex flex-col items-center gap-1.5">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border overflow-hidden shrink-0"
              style={{
                backgroundColor: 'var(--fs-hero-bg)',
                color: 'var(--fs-gold)',
                borderColor: 'var(--fs-gold)',
              }}
            >
              <User className="w-4 h-4" />
            </div>
            <div className="w-full min-w-0">
              <div className="text-xs font-bold leading-snug truncate fs-display-font">
                {node.displayName}
              </div>
              {(node.epithet || node.kunya) ? (
                <div
                  title={[node.epithet, node.kunya].filter(Boolean).join(' · ')}
                  className="text-[10px] fs-muted truncate mt-0.5"
                >
                  {node.epithet && (
                    <span className="font-semibold text-[#9A6B25]">
                      {node.epithet}
                    </span>
                  )}
                  {node.epithet && node.kunya && (
                    <span className="mx-1 text-[#C59B27]/80 font-bold">·</span>
                  )}
                  {node.kunya && <span>{node.kunya}</span>}
                </div>
              ) : (
                <div className="text-[10px] fs-muted truncate mt-0.5">
                  {node.relationLabel}
                </div>
              )}
            </div>
            {(node.birthYear || node.birthPlace || node.isDeceased) && (
              <div className="text-[9.5px] fs-muted tabular-nums truncate w-full pt-1 border-t fs-border">
                {[
                  node.birthYear,
                  node.birthPlace,
                  node.isDeceased ? 'رحمه الله' : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            )}
          </div>
        </div>

        {/* Golden Heritage Connector Lines to Children */}
        {children.length > 0 && (
          <div className="flex flex-col items-center">
            <div
              className="w-[2px] h-5"
              style={{ backgroundColor: 'var(--fs-gold)', opacity: 0.7 }}
            />
            <div className="flex items-start justify-center relative">
              {children.map((child, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === children.length - 1;
                const isOnly = children.length === 1;
                return (
                  <div
                    key={child.id}
                    className="flex flex-col items-center relative px-2.5"
                  >
                    {!isOnly && (
                      <div
                        className="absolute top-0 h-[2px]"
                        style={{
                          backgroundColor: 'var(--fs-gold)',
                          opacity: 0.7,
                          right: isFirst ? '50%' : 0,
                          left: isLast ? '50%' : 0,
                        }}
                      />
                    )}
                    <div
                      className="w-[2px] h-5"
                      style={{
                        backgroundColor: 'var(--fs-gold)',
                        opacity: 0.7,
                      }}
                    />
                    {renderTreeBranch(child, depth + 1)}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

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
              <span>عمود النسب التاريخي المحقّق لأسرة {familyName}</span>
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

      {/* Tree Mirror Interactive Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switcher */}
          <div className="inline-flex rounded-xl fs-surface-alt border fs-border p-1">
            <button
              type="button"
              onClick={() => setViewMode('visual_tree')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                viewMode === 'visual_tree'
                  ? 'fs-accent-bg shadow-2xs'
                  : 'fs-muted hover:opacity-90'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>المخطط الشجري البصري</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('generations_list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                viewMode === 'generations_list'
                  ? 'fs-accent-bg shadow-2xs'
                  : 'fs-muted hover:opacity-90'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>سجل الأجيال المفصل</span>
            </button>
          </div>

          {/* Search inside Tree */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 fs-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ابحث عن اسم في الشجرة..."
              className="h-9 pr-8 pl-7 rounded-xl fs-surface border fs-border text-xs focus:outline-none w-48 sm:w-56"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="مسح البحث"
                className="absolute left-2 top-1/2 -translate-y-1/2 fs-muted hover:opacity-100 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {normalizedQuery && (
            <span className="text-[11px] font-bold fs-accent-text tabular-nums">
              {matchingCount} نتيجة
            </span>
          )}
        </div>

        {/* Zoom Controls (Visual Mode) + Enrichment Action */}
        <div className="flex items-center gap-2">
          {viewMode === 'visual_tree' && (
            <div className="inline-flex items-center gap-1 rounded-xl fs-surface border fs-border px-1.5 py-1">
              <button
                type="button"
                onClick={() => setZoomPercent((z) => Math.max(60, z - 15))}
                title="تصغير"
                className="w-6 h-6 rounded-lg hover:bg-black/5 flex items-center justify-center cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-bold tabular-nums px-1.5">
                {zoomPercent}%
              </span>
              <button
                type="button"
                onClick={() => setZoomPercent((z) => Math.min(130, z + 15))}
                title="تكبير"
                className="w-6 h-6 rounded-lg hover:bg-black/5 flex items-center justify-center cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              {zoomPercent !== 100 && (
                <button
                  type="button"
                  onClick={() => setZoomPercent(100)}
                  title="إعادة الضبط"
                  className="w-6 h-6 rounded-lg hover:bg-black/5 flex items-center justify-center cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {onProposeEnrichment && !compactPreview && (
            <button
              type="button"
              onClick={onProposeEnrichment}
              className="h-9 px-3.5 rounded-xl fs-surface border fs-border hover:opacity-90 text-xs font-bold fs-accent-text cursor-pointer whitespace-nowrap"
            >
              + اقترح إضافة فرع أو قريب
            </button>
          )}
        </div>
      </div>

      {/* Mode 1: Visual Connected Pedigree Tree Canvas */}
      {viewMode === 'visual_tree' ? (
        <div className="rounded-3xl fs-surface-alt border fs-border p-6 overflow-x-auto relative">
          <div
            className="min-w-max mx-auto flex items-start justify-center gap-8 py-2 transition-transform origin-top duration-200"
            style={{
              transform: `scale(${zoomPercent / 100})`,
            }}
          >
            {rootMembers.map((root) => renderTreeBranch(root, 0))}
          </div>
        </div>
      ) : (
        /* Mode 2: Detailed Generations Register */
        <div className="space-y-4">
          {generationRows.map((row) => {
            const visibleInRow = normalizedQuery
              ? row.people.filter((m) =>
                  `${m.displayName} ${m.epithet || ''} ${m.kunya || ''} ${m.relationLabel} ${m.birthPlace || ''}`
                    .toLowerCase()
                    .includes(normalizedQuery)
                )
              : row.people;
            if (visibleInRow.length === 0) return null;

            return (
              <div
                key={row.level}
                className="rounded-2xl fs-surface border fs-border p-4 sm:p-5 space-y-3"
              >
                <div className="flex items-center justify-between border-b fs-border pb-2.5">
                  <span className="text-sm font-bold fs-display-font fs-accent-text">
                    {row.ordinalLabel}
                  </span>
                  <span className="text-xs fs-muted tabular-nums">
                    {visibleInRow.length} أفراد
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {visibleInRow.map((member) => (
                    <div
                      key={member.id}
                      className="rounded-xl fs-surface-alt border fs-border p-3 flex items-center gap-3"
                    >
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden border"
                        style={{
                          backgroundColor: 'var(--fs-hero-bg)',
                          color: 'var(--fs-gold)',
                          borderColor: 'var(--fs-gold)',
                        }}
                      >
                        {member.displayName.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold truncate fs-display-font">
                          {member.displayName}
                        </div>
                        {(member.epithet || member.kunya) && (
                          <div className="text-[11px] fs-muted truncate">
                            {member.epithet && (
                              <span className="font-semibold text-[#9A6B25]">
                                {member.epithet}
                              </span>
                            )}
                            {member.epithet && member.kunya && (
                              <span className="mx-1 text-[#C59B27]/80 font-bold">
                                ·
                              </span>
                            )}
                            {member.kunya && <span>{member.kunya}</span>}
                          </div>
                        )}
                        <div className="text-xs fs-muted truncate">
                          {member.relationLabel}
                          {member.birthYear ? ` · ${member.birthYear}` : ''}
                          {member.birthPlace ? ` · ${member.birthPlace}` : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
