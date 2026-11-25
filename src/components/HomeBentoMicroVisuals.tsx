import React from 'react';
import {
  Camera,
  Check,
  FileSearch,
  Lock,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { JUTHORI_SERVICE_ICONS } from '../config/serviceIcons';
import {
  ACTIVE_PUBLIC_SITE_DISPLAY_HOST,
  FAMILY_SITE_THEMES,
  FamilySiteThemeId,
  normalizeFamilySiteThemeId,
} from '../config/referralAndSiteConfig';
import {
  FamilyPortalVisualBranding,
  buildDefaultVisualBranding,
} from '../services/priority4Service';
import {
  FamilyCrestEmblem,
  HeroArchitecturalBackdrop,
  TYPOGRAPHY_PAIR_OPTIONS,
} from './FamilySiteHeritageVisuals';

// =============================================================================
// 1. LINEAGE GLOWING NODES PATH (عمود نسبي)
// =============================================================================
interface LineageGlowPathVisualProps {
  familyName: string;
  rootLabel: string;
  matched: boolean;
  totalCapsules: number;
  unlockedCapsulesCount: number;
}

export const LineageGlowPathVisual: React.FC<LineageGlowPathVisualProps> = ({
  familyName,
  rootLabel,
  matched,
  totalCapsules,
  unlockedCapsulesCount,
}) => {
  const middleNodeCount = Math.min(4, Math.max(3, totalCapsules || 3));
  const litMiddleNodes =
    totalCapsules > 0
      ? Math.round((unlockedCapsulesCount / totalCapsules) * middleNodeCount)
      : matched
      ? 1
      : 0;

  return (
    <div
      aria-hidden="true"
      className="relative rounded-xl bg-gradient-to-l from-[#E8DED2]/90 via-[#F5F1E8] to-[#E8DED2]/90 border border-[#D8C7B2]/50 px-4 py-4 overflow-hidden"
    >
      {/* Subtle parchment grid lines */}
      <div className="relative flex items-center justify-between gap-2">
        {/* Connecting golden thread */}
        <div className="absolute inset-x-10 top-5 h-[2px] bg-gradient-to-l from-[#D97757] via-[#D97757]/65 to-[#D97757]/60 transition-opacity duration-300 group-hover:opacity-100 opacity-80" />

        {/* Origin Node: Client Family */}
        <div className="relative z-10 flex flex-col items-center gap-1.5 max-w-[34%]">
          <div className="w-10 h-10 rounded-full bg-[#E8DED2] text-[#1F1F1C] border-2 border-[#D97757] shadow-xs flex items-center justify-center text-xs font-display font-bold transition-transform duration-300 group-hover:scale-105">
            {familyName.slice(0, 1) || 'أ'}
          </div>
          <span className="text-[11px] font-display font-bold text-[#1F1F1C] truncate max-w-full">
            عائلة {familyName}
          </span>
        </div>

        {/* Intermediate Capsule Nodes */}
        <div className="relative z-10 flex items-center gap-2.5 sm:gap-4 -mt-4">
          {Array.from({ length: middleNodeCount }).map((_, idx) => {
            const isLit = idx < litMiddleNodes;
            return (
              <div
                key={idx}
                className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all duration-300 ${
                  isLit
                    ? 'bg-[#D97757] border-[#D97757]/40 text-[#F5F1E8] shadow-[0_0_12px_rgba(217,119,87,0.55)] group-hover:scale-110'
                    : 'bg-[#F5F1E8] border-[#D8C7B2]/60 text-[#D97757]/60 group-hover:border-[#D8C7B2]'
                }`}
              >
                {isLit ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <Lock className="w-2.5 h-2.5" />
                )}
              </div>
            );
          })}
        </div>

        {/* Verified Root / Archival Inspection Node */}
        <div className="relative z-10 flex flex-col items-center gap-1.5 max-w-[34%]">
          <div
            className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-transform duration-300 group-hover:scale-105 ${
              matched
                ? 'bg-[#D97757] border-[#D8C7B2] text-[#F5F1E8] shadow-[0_0_16px_rgba(217,119,87,0.45)]'
                : 'bg-[#F5F1E8] border-[#D8C7B2] text-[#D97757] shadow-xs'
            }`}
          >
            {matched ? (
              <ShieldCheck className="w-4 h-4" />
            ) : (
              <FileSearch className="w-4 h-4" />
            )}
          </div>
          <span className="text-[11px] font-display font-bold text-[#D97757] truncate max-w-full">
            {rootLabel}
          </span>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// 2. MINI TREE BRANCH SVG + GOLDEN RADIAL GAUGE (شجرتي)
// =============================================================================
interface TreeBranchGaugeVisualProps {
  treeMembersCount: number;
  totalTreeCapacity: number;
  isTreeUnlocked?: boolean;
}

function formatArabicTreeMembersCount(count: number): string {
  if (count <= 0) return '0 أفراد';
  if (count === 1) return 'فرد واحد';
  if (count === 2) return 'فردان';
  if (count <= 10) return `${count} أفراد`;
  return `${count} فرداً`;
}

export const TreeBranchGaugeVisual: React.FC<TreeBranchGaugeVisualProps> = ({
  treeMembersCount,
  totalTreeCapacity,
  isTreeUnlocked = true,
}) => {
  const effectiveCount = isTreeUnlocked ? Math.max(0, treeMembersCount) : 0;
  const safeCap = Math.max(1, totalTreeCapacity);
  const ratio = Math.min(1, Math.max(0, effectiveCount / safeCap));
  const percent = Math.round(ratio * 100);
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - Math.max(ratio, effectiveCount > 0 ? 0.04 : 0));

  return (
    <div
      aria-hidden="true"
      className="rounded-xl bg-[#F5F1E8]/75 border border-[#D8C7B2]/60 px-4 py-3 flex items-center justify-between gap-4 overflow-hidden"
    >
      {/* Mini Interactive Pedigree Branch SVG */}
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <svg
          viewBox="0 0 132 76"
          className="w-28 sm:w-32 h-[72px] shrink-0 transition-transform duration-300 group-hover:scale-[1.03]"
          fill="none"
        >
          {/* Golden branch connectors */}
          <path
            d="M66 16 V34 M34 34 H98 M34 34 V46 M66 34 V46 M98 34 V46 M22 58 V50 H46 V58 M86 58 V50 H110 V58"
            stroke="#D97757"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.75"
          />
          {/* Root ancestor node */}
          <rect
            x="48"
            y="4"
            width="36"
            height="14"
            rx="7"
            fill="#D97757"
            stroke="#D8C7B2"
            strokeWidth="1.4"
          />
          <line
            x1="58"
            y1="11"
            x2="74"
            y2="11"
            stroke="#F5F1E8"
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity="0.9"
          />
          {/* Second generation nodes */}
          <circle
            cx="34"
            cy="46"
            r="5.5"
            fill={effectiveCount >= 1 ? '#D97757' : '#E8DED2'}
            stroke="#D8C7B2"
            strokeWidth="1.2"
          />
          <circle
            cx="66"
            cy="46"
            r="5.5"
            fill={effectiveCount >= 2 ? '#D8C7B2' : '#E8DED2'}
            stroke="#D97757"
            strokeWidth="1.2"
          />
          <circle
            cx="98"
            cy="46"
            r="5.5"
            fill={effectiveCount >= 3 ? '#D97757' : '#E8DED2'}
            stroke="#D8C7B2"
            strokeWidth="1.2"
          />
          {/* Third generation leaf nodes */}
          {[22, 46, 86, 110].map((cx, idx) => (
            <circle
              key={cx}
              cx={cx}
              cy="63"
              r="4"
              fill={effectiveCount >= idx + 4 ? '#D97757' : '#E8DED2'}
              stroke="#D8C7B2"
              strokeWidth="1.1"
            />
          ))}
        </svg>

        <div className="space-y-0.5 min-w-0">
          {!isTreeUnlocked ? (
            <>
              <div className="text-xs font-display font-bold text-[#1F1F1C]">
                لم يبدأ تأسيس المشجرة بعد
              </div>
              <div className="text-[11px] text-[#1F1F1C]/70 tabular-nums">
                تُفتح سعة {totalTreeCapacity} فرداً عند الترقية للباقة السنوية
              </div>
            </>
          ) : (
            <>
              <div className="text-xs font-display font-bold text-[#1F1F1C] tabular-nums">
                {formatArabicTreeMembersCount(effectiveCount)} من سعة {totalTreeCapacity}
              </div>
              <div className="text-[11px] text-[#1F1F1C]/70 tabular-nums">
                المتبقي: {Math.max(0, totalTreeCapacity - effectiveCount)} مقعداً
              </div>
            </>
          )}
        </div>
      </div>

      {/* Sleek Golden Radial Gauge */}
      <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
        <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90">
          <circle
            cx="32"
            cy="32"
            r={radius}
            fill="none"
            stroke="#E8DED2"
            strokeWidth="5"
          />
          <circle
            cx="32"
            cy="32"
            r={radius}
            fill="none"
            stroke="url(#treeGoldGauge)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-500"
          />
          <defs>
            <linearGradient id="treeGoldGauge" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#D97757" />
              <stop offset="100%" stopColor="#D8C7B2" />
            </linearGradient>
          </defs>
        </svg>
        <span className="absolute text-[11px] font-mono font-bold text-[#1F1F1C] tabular-nums">
          {percent}%
        </span>
      </div>
    </div>
  );
};

// =============================================================================
// 3. STACKED POLAROID / FRAME FAN (خزانتي)
// =============================================================================
interface VaultPolaroidFanVisualProps {
  previewPhotos: Array<{ id: string; title: string; url: string }>;
  itemsCount: number;
}

export const VaultPolaroidFanVisual: React.FC<VaultPolaroidFanVisualProps> = ({
  previewPhotos,
  itemsCount,
}) => {
  if (previewPhotos.length === 0) {
    return (
      <div
        aria-hidden="true"
        className="h-32 rounded-xl bg-gradient-to-b from-[#F5F1E8] to-[#E8DED2] border border-[#D8C7B2]/60 flex items-center justify-center relative overflow-hidden"
      >
        <div className="relative flex items-center justify-center">
          <div className="w-24 h-16 rounded-lg bg-[#F5F1E8]/80 border border-[#D8C7B2]/55 shadow-xs -rotate-6 -translate-x-4 transition-transform duration-300 group-hover:-rotate-12 group-hover:-translate-x-6" />
          <div className="w-24 h-16 rounded-lg bg-[#F5F1E8]/95 border border-[#D8C7B2]/75 shadow-sm absolute flex flex-col items-center justify-center gap-1 transition-transform duration-300 group-hover:scale-105">
            <JUTHORI_SERVICE_ICONS.vault className="w-4.5 h-4.5 text-[#D97757]" />
            <span className="text-[9px] font-display font-bold text-[#D97757]">
              ألبوم متحفي مذهّب
            </span>
          </div>
          <div className="w-24 h-16 rounded-lg bg-[#F5F1E8]/80 border border-[#D8C7B2]/55 shadow-xs rotate-6 translate-x-4 transition-transform duration-300 group-hover:rotate-12 group-hover:translate-x-6" />
        </div>
      </div>
    );
  }

  const stack = previewPhotos.slice(0, 3);
  return (
    <div
      aria-hidden="true"
      className="h-32 rounded-xl bg-gradient-to-b from-[#F5F1E8] to-[#E8DED2] border border-[#D8C7B2]/55 flex items-center justify-center relative isolate overflow-hidden"
    >
      <div className="relative w-40 h-22 flex items-center justify-center">
        {stack.map((photo, idx) => {
          const transformClass =
            stack.length === 1
              ? 'rotate-0 group-hover:scale-105 z-[2]'
              : idx === 0
              ? '-rotate-6 -translate-x-5 group-hover:-rotate-12 group-hover:-translate-x-8 z-[1]'
              : idx === 1
              ? 'rotate-0 translate-y-0 group-hover:-translate-y-1.5 group-hover:scale-105 z-[3]'
              : 'rotate-6 translate-x-5 group-hover:rotate-12 group-hover:translate-x-8 z-[2]';
          return (
            <div
              key={photo.id}
              className={`absolute w-20 h-20 rounded-lg bg-[#F5F1E8] p-1 pb-3 border border-[#D8C7B2]/75 shadow-md transition-all duration-300 ${transformClass}`}
            >
              <img
                src={photo.url}
                alt={photo.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover rounded-[4px] bg-[#E8DED2]"
              />
            </div>
          );
        })}
      </div>
      <div className="absolute bottom-1.5 left-2.5 inline-flex items-center gap-1 text-[10px] font-mono font-bold text-[#D97757]/80 tabular-nums">
        <Camera className="w-3 h-3" />
        <span>{itemsCount}</span>
      </div>
    </div>
  );
};

// =============================================================================
// 4. REAL LIVE MINI PORTAL SNAPSHOT (موقعي)
// =============================================================================
interface SiteMiniBrowserVisualProps {
  familyName: string;
  slug: string;
  isPublished: boolean;
  themeId?: FamilySiteThemeId;
  bioTitle?: string;
  emblemTag?: string;
  visualBranding?: FamilyPortalVisualBranding;
}

export const SiteMiniBrowserVisual: React.FC<SiteMiniBrowserVisualProps> = ({
  familyName,
  slug,
  isPublished,
  themeId,
  bioTitle,
  emblemTag,
  visualBranding,
}) => {
  const normalizedThemeId = normalizeFamilySiteThemeId(themeId);
  const theme =
    FAMILY_SITE_THEMES.find((t) => t.id === normalizedThemeId) ||
    FAMILY_SITE_THEMES[0];
  const branding = visualBranding || buildDefaultVisualBranding(familyName);
  const typography =
    TYPOGRAPHY_PAIR_OPTIONS.find((t) => t.id === branding.typographyId) ||
    TYPOGRAPHY_PAIR_OPTIONS[0];
  const resolvedTitle =
    (bioTitle || '').trim() || `ديوان وسجل عائلة ${familyName}`;
  const resolvedEmblem = (emblemTag || '').trim();
  const displayUrl = slug
    ? `${ACTIVE_PUBLIC_SITE_DISPLAY_HOST}/${slug}`
    : 'لم يُخصّص الرابط بعد';

  return (
    <div
      aria-hidden="true"
      className="h-32 rounded-xl border border-[#D8C7B2] overflow-hidden shadow-xs flex flex-col transition-transform duration-300 group-hover:-translate-y-0.5"
      style={{ backgroundColor: theme.swatchCanvas }}
    >
      {/* Light heritage browser top bar showing the client's real custom URL */}
      <div className="px-2.5 py-1.5 bg-[#F5F1E8] border-b border-[#D8C7B2] text-[#1F1F1C]/70 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#D97757]/80" />
          <span className="w-1.5 h-1.5 rounded-full bg-[#D97757]/90" />
          <span className="w-1.5 h-1.5 rounded-full bg-[#D97757]/75" />
        </div>
        <div
          dir="ltr"
          className="text-[9px] font-mono font-semibold text-[#1F1F1C]/70 truncate max-w-[165px]"
        >
          {displayUrl}
        </div>
      </div>

      {/* Authentic live snapshot of the client's customized Hero & Crest */}
      <div className="relative flex-1 overflow-hidden flex flex-col justify-between">
        {/* Exact same cover image / architectural preset & overlay as PublicFamilyMicrositePage */}
        <HeroArchitecturalBackdrop branding={branding} />

        {/* Subtle theme tint harmonize layer when using preset */}
        {branding.heroCoverMode !== 'custom_image' && (
          <div
            className="absolute inset-0 pointer-events-none opacity-25"
            style={{
              background: `linear-gradient(135deg, ${theme.swatchHero} 0%, ${theme.swatchAccent}88 100%)`,
            }}
          />
        )}

        {/* Real Hero Content Snapshot matching chosen layout */}
        <div className="relative z-10 flex-1 px-3 py-2 flex items-center justify-center">
          {branding.heroLayout === 'editorial_split' ? (
            <div className="w-full flex items-center justify-between gap-2 text-right">
              <div className="min-w-0 flex-1 space-y-0.5">
                {resolvedEmblem && (
                  <div className="text-[8px] font-bold text-[#D97757] truncate">
                    {resolvedEmblem}
                  </div>
                )}
                <div
                  className="text-[11px] font-bold text-[#F5F1E8] truncate drop-shadow-xs"
                  style={{ fontFamily: typography.fontCss }}
                >
                  {resolvedTitle}
                </div>
              </div>
              <div className="shrink-0 scale-[0.78] origin-left">
                <FamilyCrestEmblem
                  familyName={familyName}
                  crestMode={branding.crestMode}
                  crestStyle={branding.crestStyle}
                  customCrestUrl={branding.customCrestUrl}
                  size="xs"
                />
              </div>
            </div>
          ) : branding.heroLayout === 'floating_glass' ? (
            <div className="w-full rounded-lg bg-[#1F1F1C]/30 backdrop-blur-[3px] border border-[#F5F1E8]/20 px-2.5 py-1.5 flex items-center gap-2">
              <div className="shrink-0 scale-[0.75] origin-right">
                <FamilyCrestEmblem
                  familyName={familyName}
                  crestMode={branding.crestMode}
                  crestStyle={branding.crestStyle}
                  customCrestUrl={branding.customCrestUrl}
                  size="xs"
                />
              </div>
              <div className="min-w-0 flex-1 text-right">
                {resolvedEmblem && (
                  <div className="text-[7.5px] font-bold text-[#D97757] truncate">
                    {resolvedEmblem}
                  </div>
                )}
                <div
                  className="text-[10.5px] font-bold text-[#F5F1E8] truncate"
                  style={{ fontFamily: typography.fontCss }}
                >
                  {resolvedTitle}
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full flex flex-col items-center text-center gap-0.5">
              <div className="scale-[0.72] -my-1.5">
                <FamilyCrestEmblem
                  familyName={familyName}
                  crestMode={branding.crestMode}
                  crestStyle={branding.crestStyle}
                  customCrestUrl={branding.customCrestUrl}
                  size="xs"
                />
              </div>
              <div
                className="text-[11px] font-bold text-[#F5F1E8] truncate max-w-full drop-shadow-xs"
                style={{ fontFamily: typography.fontCss }}
              >
                {resolvedTitle}
              </div>
              {resolvedEmblem && (
                <div className="text-[8px] font-semibold text-[#D97757]/95 truncate max-w-[92%]">
                  {resolvedEmblem}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mini Theme Canvas Strip matching the actual public portal body */}
        <div
          className="relative z-10 px-2.5 py-1 flex items-center justify-between gap-2 border-t border-[#1F1F1C]/5"
          style={{ backgroundColor: theme.swatchCanvas }}
        >
          <span className="inline-flex items-center gap-1 text-[8.5px] font-bold text-[#1F1F1C]/70 truncate">
            <JUTHORI_SERVICE_ICONS.site className="w-2.5 h-2.5 shrink-0 text-[#D97757]" />
            <span className="truncate">{theme.nameAr}</span>
          </span>
          <span
            className="text-[8.5px] font-display font-bold px-1.5 py-0.5 rounded text-[#F5F1E8] shrink-0"
            style={{ backgroundColor: theme.swatchAccent }}
          >
            {isPublished ? 'منشور ✓' : 'مسودة'}
          </span>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// 5. KINSHIP ORBIT & AVATAR STACK (مجتمعي)
// =============================================================================
interface KinshipOrbitVisualProps {
  memberNames: string[];
  relativesCount: number;
  pendingEnrichments: number;
}

export const KinshipOrbitVisual: React.FC<KinshipOrbitVisualProps> = ({
  memberNames,
  relativesCount,
  pendingEnrichments,
}) => {
  const initials = memberNames
    .slice(0, 4)
    .map((n) => (n || '').trim().slice(0, 1) || 'ع');

  return (
    <div
      aria-hidden="true"
      className="h-32 rounded-xl bg-gradient-to-b from-[#F5F1E8] to-[#E8DED2] border border-[#D8C7B2]/60 flex items-center justify-center relative overflow-hidden"
    >
      {/* Concentric delicate golden orbit rings */}
      <div className="absolute w-36 h-36 rounded-full border border-dashed border-[#D8C7B2]/45 transition-transform duration-500 group-hover:scale-105" />
      <div className="absolute w-24 h-24 rounded-full border border-[#D97757]/30 transition-transform duration-500 group-hover:scale-110" />

      {initials.length > 0 ? (
        <div className="relative z-10 flex items-center -space-x-2 space-x-reverse">
          {initials.map((ch, idx) => (
            <div
              key={idx}
              className="w-10 h-10 rounded-full bg-[#E8DED2] text-[#1F1F1C] border-2 border-[#D8C7B2] font-display font-bold text-xs flex items-center justify-center shadow-xs transition-transform duration-300 group-hover:-translate-y-0.5"
            >
              {ch}
            </div>
          ))}
          {relativesCount > 4 && (
            <div className="w-10 h-10 rounded-full bg-[#D97757] text-[#F5F1E8] border-2 border-[#F5F1E8] font-mono font-bold text-[10px] flex items-center justify-center shadow-sm tabular-nums">
              +{relativesCount - 4}
            </div>
          )}
        </div>
      ) : (
        <div className="relative z-10 flex items-center gap-2">
          {[0, 1, 2].map((slot) => (
            <div
              key={slot}
              className={`rounded-full border border-dashed border-[#D97757] flex items-center justify-center transition-transform duration-300 ${
                slot === 1
                  ? 'w-11 h-11 bg-[#F5F1E8]/90 text-[#D97757] shadow-xs group-hover:scale-105'
                  : 'w-8 h-8 bg-[#F5F1E8]/75 text-[#D97757]'
              }`}
            >
              <UserPlus className={slot === 1 ? 'w-4 h-4' : 'w-3 h-3'} />
            </div>
          ))}
        </div>
      )}

      {pendingEnrichments > 0 && (
        <span className="absolute top-2 left-2.5 text-[10px] font-display font-bold text-[#D97757] tabular-nums">
          {pendingEnrichments} إثراء وارد
        </span>
      )}
    </div>
  );
};

// =============================================================================
// 6. WARM PARCHMENT & ANTIQUE GOLD RADAR SCENE (كشّافي)
// =============================================================================
interface KashafiRadarVisualProps {
  hasActiveTicket: boolean;
  discoveriesCount: number;
  matchingCampaignsCount: number;
}

export const KashafiRadarVisual: React.FC<KashafiRadarVisualProps> = ({
  hasActiveTicket,
  discoveriesCount,
  matchingCampaignsCount,
}) => {
  return (
    <div
      aria-hidden="true"
      className="h-32 rounded-xl bg-gradient-to-b from-[#F5F1E8] via-[#E8DED2] to-[#E8DED2] border border-[#D8C7B2]/75 flex items-center justify-center relative overflow-hidden"
    >
      {/* Subtle concentric antique-gold radar rings */}
      <div className="absolute w-40 h-40 rounded-full border border-dashed border-[#D97757]/35 transition-transform duration-500 group-hover:scale-110" />
      <div className="absolute w-28 h-28 rounded-full border border-[#D97757]/35 transition-transform duration-500 group-hover:scale-105" />
      <div className="absolute w-16 h-16 rounded-full border border-[#D97757]/35" />

      {/* Center warm terracotta emblem */}
      <div className="relative z-10 w-11 h-11 rounded-full bg-[#E8DED2] text-[#D97757] flex items-center justify-center shadow-[0_6px_18px_rgba(217,119,87,0.2)] border border-[#D8C7B2] transition-transform duration-300 group-hover:scale-105">
        <JUTHORI_SERVICE_ICONS.kashafi className="w-5 h-5" />
      </div>

      {/* Bottom unobtrusive real status caption */}
      <div className="absolute bottom-2 inset-x-3 flex items-center justify-between text-[10px] font-bold text-[#D97757] tabular-nums">
        <span>{hasActiveTicket ? 'بعثة نشطة' : 'المرصد متأهب'}</span>
        <span>
          {discoveriesCount} رصد · {matchingCampaignsCount} خدمة
        </span>
      </div>
    </div>
  );
};
