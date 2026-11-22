import React from 'react';
import { CheckCircle2, Crown, Sparkles } from 'lucide-react';

export type UnifiedNameplateVariant =
  | 'summit'
  | 'root'
  | 'direct_family'
  | 'record_keeper'
  | 'standard'
  | 'intermediate';

export interface UnifiedNameplatePalette {
  isDark?: boolean;
  surfaceBg?: string;
  surfaceAltBg?: string;
  surfaceBorder?: string;
  textPrimaryHex?: string;
  textMutedHex?: string;
  accentHex?: string;
  accentTextHex?: string;
  goldHex?: string;
  goldBorderHex?: string;
  goldSoftBg?: string;
  directFamilyBg?: string;
  directFamilyBorder?: string;
  directFamilyAccent?: string;
  keeperBg?: string;
  keeperBorder?: string;
  keeperAccent?: string;
  rootBg?: string;
  rootBorder?: string;
  rootAccent?: string;
  summitBg?: string;
  summitBorder?: string;
  summitText?: string;
  summitSubtext?: string;
  statusText?: string;
}

export interface UnifiedLineageNameplateProps {
  variant: UnifiedNameplateVariant;
  tierLabel: string;
  title: string;
  badgeText?: string;
  badgeIcon?: 'check' | 'none';
  crownLabel?: string;
  avatar: React.ReactNode;
  fontFamily?: string;
  widthClass?: string;
  isSelected?: boolean;
  palette?: UnifiedNameplatePalette;
  onClick?: () => void;
  dataTestId?: string;
  inlineExtra?: React.ReactNode;
  floatingTopLeft?: React.ReactNode;
  bottomCenterControl?: React.ReactNode;
  className?: string;
}

const DEFAULT_LIGHT_PALETTE: Required<UnifiedNameplatePalette> = {
  isDark: false,
  surfaceBg: '#FFFDF9',
  surfaceAltBg: '#FAF5EC',
  surfaceBorder: '#DECBA8',
  textPrimaryHex: '#252321',
  textMutedHex: '#7A634C',
  accentHex: '#8D4925',
  accentTextHex: '#8C5E22',
  goldHex: '#C59B43',
  goldBorderHex: '#C59B43',
  goldSoftBg: '#FAF2DF',
  directFamilyBg:
    'linear-gradient(270deg, #FFFBF0 0%, #FFFDF8 52%, #F8EED8 100%)',
  directFamilyBorder: '#C59B43',
  directFamilyAccent: '#9A691F',
  keeperBg: 'linear-gradient(270deg, #FFFBF2 0%, #FFFDF9 52%, #FAF3E4 100%)',
  keeperBorder: '#C59B43',
  keeperAccent: '#9E6E24',
  rootBg: 'linear-gradient(270deg, #FFFBF0 0%, #FFF7E4 55%, #F6E6C2 100%)',
  rootBorder: '#C59A38',
  rootAccent: '#96651B',
  summitBg: 'linear-gradient(270deg, #241E19 0%, #342B22 50%, #201A16 100%)',
  summitBorder: '#D4AF37',
  summitText: '#FFFBF2',
  summitSubtext: '#F2D28B',
  statusText: '#8C6226',
};

const DEFAULT_DARK_PALETTE: Required<UnifiedNameplatePalette> = {
  isDark: true,
  surfaceBg: '#221E1A',
  surfaceAltBg: '#1C1815',
  surfaceBorder: '#574832',
  textPrimaryHex: '#FAF3E4',
  textMutedHex: '#C8B89A',
  accentHex: '#E0B862',
  accentTextHex: '#F3D299',
  goldHex: '#D4AF37',
  goldBorderHex: '#D4AF37',
  goldSoftBg: 'rgba(212, 175, 55, 0.14)',
  directFamilyBg:
    'linear-gradient(270deg, #2D2418 0%, #241E17 55%, #1E1913 100%)',
  directFamilyBorder: '#D4AF37',
  directFamilyAccent: '#ECCB7A',
  keeperBg: 'linear-gradient(270deg, #292219 0%, #221D17 55%, #1D1914 100%)',
  keeperBorder: '#D4AF37',
  keeperAccent: '#ECCB7A',
  rootBg: 'linear-gradient(270deg, #322618 0%, #261E16 55%, #1E1812 100%)',
  rootBorder: '#DFB956',
  rootAccent: '#F3D487',
  summitBg: 'linear-gradient(270deg, #1B1612 0%, #2D2318 50%, #191410 100%)',
  summitBorder: '#E5C368',
  summitText: '#FFFBF2',
  summitSubtext: '#F3D487',
  statusText: '#DFBE73',
};

/**
 * Shared Compact Sculpted Luxury Nameplate used across BOTH
 * «عمود نسبي» (LineageSpineColumn) and the upper pulled lineage spine of «شجرتي» (InteractiveFamilyTreeBuilder).
 * Guarantees identical golden proportions (~258–288px, ~72px height), double-gilded circular portrait ring,
 * royal graduated hierarchy, and zero dead white space.
 */
export const UnifiedLineageNameplate: React.FC<UnifiedLineageNameplateProps> = ({
  variant,
  tierLabel,
  title,
  badgeText,
  badgeIcon = 'none',
  crownLabel,
  avatar,
  fontFamily,
  widthClass = 'w-[258px] sm:w-[288px] max-w-full mx-auto',
  isSelected = false,
  palette,
  onClick,
  dataTestId,
  inlineExtra,
  floatingTopLeft,
  bottomCenterControl,
  className = '',
}) => {
  const isDark = Boolean(palette?.isDark);
  const p: Required<UnifiedNameplatePalette> = {
    ...(isDark ? DEFAULT_DARK_PALETTE : DEFAULT_LIGHT_PALETTE),
    ...palette,
    isDark,
  };

  const isSummit = variant === 'summit';
  const isRoot = variant === 'root';
  const isDirectFamily = variant === 'direct_family';
  const isRecordKeeper = variant === 'record_keeper';
  const isIntermediate = variant === 'intermediate';

  const hasRoyalRightStrip = isSummit || isRoot || isDirectFamily || isRecordKeeper;

  // Surface background, border, and double-frame shadow by variant
  let surfaceStyle: React.CSSProperties;
  if (isSummit) {
    surfaceStyle = {
      background: p.summitBg,
      border: `1.5px solid ${p.summitBorder}`,
      boxShadow: isSelected
        ? `inset 0 0 0 2px rgba(243,210,153,0.22), 0 0 0 3px ${p.goldBorderHex}38, 0 10px 26px rgba(0,0,0,0.34)`
        : `inset 0 0 0 2px rgba(243,210,153,0.18), 0 8px 22px rgba(0,0,0,0.28)`,
    };
  } else if (isRoot) {
    surfaceStyle = {
      background: p.rootBg,
      border: `1.5px solid ${isSelected ? p.accentHex : p.rootBorder}`,
      boxShadow: isDark
        ? `inset 0 0 0 2px ${p.goldBorderHex}28, 0 6px 20px rgba(0,0,0,0.38)`
        : `inset 0 0 0 2.5px rgba(255,253,249,0.88), 0 4px 16px rgba(176,130,44,0.15)`,
    };
  } else if (isDirectFamily) {
    surfaceStyle = {
      background: p.directFamilyBg,
      border: `1.5px solid ${p.directFamilyBorder}`,
      boxShadow: isDark
        ? `inset 0 0 0 2px ${p.goldBorderHex}26, 0 6px 20px rgba(0,0,0,0.36)`
        : `inset 0 0 0 2.5px rgba(255,253,249,0.9), 0 4px 16px rgba(176,130,44,0.14)`,
    };
  } else if (isRecordKeeper) {
    surfaceStyle = {
      background: p.keeperBg,
      border: `1.5px solid ${p.keeperBorder}`,
      boxShadow: isDark
        ? `inset 0 0 0 1.5px ${p.goldBorderHex}22, 0 4px 16px rgba(0,0,0,0.34)`
        : `inset 0 0 0 1.5px rgba(233,209,150,0.48), 0 3px 14px rgba(165,123,44,0.13)`,
    };
  } else {
    surfaceStyle = {
      backgroundColor: isIntermediate ? p.surfaceAltBg : p.surfaceBg,
      border: `1.5px solid ${isSelected ? p.goldBorderHex : p.surfaceBorder}`,
      boxShadow: isSelected
        ? `0 0 0 3px ${p.goldBorderHex}28, 0 4px 14px rgba(120,86,32,0.12)`
        : isDark
        ? '0 3px 12px rgba(0,0,0,0.28)'
        : '0 2px 10px rgba(90,65,35,0.06)',
    };
  }

  const tierTextColor = isSummit
    ? p.summitSubtext
    : isRoot
    ? p.rootAccent
    : isDirectFamily
    ? p.directFamilyAccent
    : isRecordKeeper
    ? p.keeperAccent
    : p.accentTextHex;

  const titleTextColor = isSummit ? p.summitText : p.textPrimaryHex;

  const avatarOuterRingGradient = isSummit
    ? 'linear-gradient(135deg, #F3D487 0%, #B8862D 55%, #F7DF9F 100%)'
    : isRoot || isDirectFamily || isRecordKeeper
    ? `linear-gradient(135deg, ${p.goldHex} 0%, #F2D79B 50%, ${p.goldBorderHex} 100%)`
    : `linear-gradient(135deg, ${p.goldBorderHex}AA 0%, ${p.goldHex}66 55%, ${p.goldBorderHex}AA 100%)`;

  const avatarInnerRingBg = isSummit
    ? '#2A221B'
    : isDark
    ? '#221E1A'
    : '#FFFDF9';

  const badgeStyle: React.CSSProperties = isSummit
    ? {
        backgroundColor: 'rgba(243, 210, 153, 0.14)',
        color: p.summitSubtext,
        border: '1px solid rgba(243, 210, 153, 0.34)',
      }
    : isRoot || isDirectFamily || isRecordKeeper
    ? {
        backgroundColor: p.goldSoftBg,
        color: tierTextColor,
        border: `1px solid ${p.goldBorderHex}55`,
      }
    : {
        backgroundColor: isDark
          ? 'rgba(212, 175, 55, 0.1)'
          : 'rgba(197, 155, 67, 0.09)',
        color: p.statusText,
        border: `1px solid ${p.goldBorderHex}38`,
      };

  const rightAccentGradient = isSummit
    ? 'linear-gradient(180deg, #F3D487 0%, #C59B43 50%, #F3D487 100%)'
    : `linear-gradient(180deg, ${p.goldHex} 0%, #A97B2A 50%, ${p.goldHex} 100%)`;

  return (
    <div
      data-testid={dataTestId}
      className={`group relative z-20 ${widthClass} ${className}`}
    >
      {/* Optional Royal Top Crown Ribbon (Summit / Topmost Root) */}
      {crownLabel && (
        <div className="flex justify-center mb-1.5">
          <span
            className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-display font-bold shadow-2xs"
            style={{
              backgroundColor: p.goldSoftBg,
              color: p.accentTextHex,
              border: `1px solid ${p.goldBorderHex}80`,
            }}
          >
            <Crown className="w-3 h-3 shrink-0" style={{ color: p.goldHex }} />
            <span>{crownLabel}</span>
          </span>
        </div>
      )}

      {/* Sculpted Luxury Horizontal Nameplate */}
      <div
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={
          onClick
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onClick();
                }
              }
            : undefined
        }
        className={`relative rounded-2xl px-3.5 py-2.5 min-h-[70px] flex items-center gap-3 text-right transition-all duration-200 ${
          onClick ? 'cursor-pointer hover:-translate-y-[1px]' : ''
        }`}
        style={surfaceStyle}
      >
        {/* Slim Royal Right-Edge Gilded Accent Strip */}
        {hasRoyalRightStrip && (
          <span
            aria-hidden="true"
            className="absolute right-0 top-2.5 bottom-2.5 w-[2.5px] rounded-full pointer-events-none"
            style={{ background: rightAccentGradient }}
          />
        )}

        {/* Optional Floating Hover Controls (e.g. Edit Vault Capsule in «شجرتي») */}
        {floatingTopLeft}

        {/* Pure Circular Portrait with Double Gilded Ring & Silky Warm Shadow */}
        <span
          className="relative p-[1.5px] rounded-full shrink-0 shadow-[0_3px_10px_rgba(120,86,32,0.16)]"
          style={{ background: avatarOuterRingGradient }}
        >
          <span
            className="block p-[1.5px] rounded-full"
            style={{ backgroundColor: avatarInnerRingBg }}
          >
            <span className="w-[42px] h-[42px] rounded-full overflow-hidden flex items-center justify-center">
              {avatar}
            </span>
          </span>
        </span>

        {/* Cohesive Two-Line Typographic Block (Zero Dead Middle Space!) */}
        <div className="min-w-0 flex-1 flex flex-col justify-center gap-0.5">
          {/* Top Row: Refined Gold/Bronze Tier Label + Integrated Compact Verification Tag */}
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <span
              className="inline-flex items-center gap-1 text-[10px] font-display font-semibold tracking-wide leading-tight truncate"
              style={{ color: tierTextColor }}
            >
              {isSummit && <Sparkles className="w-2.5 h-2.5 shrink-0" />}
              <span className="truncate">{tierLabel}</span>
            </span>

            {badgeText && (
              <span
                className="inline-flex items-center gap-0.5 px-1.5 py-[1.5px] rounded-md text-[9.5px] font-display font-bold leading-tight whitespace-nowrap shrink-0"
                style={badgeStyle}
              >
                {badgeIcon === 'check' && (
                  <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                )}
                <span>{badgeText}</span>
              </span>
            )}
          </div>

          {/* Primary Name Row: Full-Width Crisp Arabic Typography + Optional Inline Vault Badge */}
          <div className="flex items-center gap-1.5 min-w-0">
            <div
              className="text-[15px] sm:text-[16px] font-extrabold leading-snug truncate"
              style={{
                fontFamily: fontFamily || undefined,
                color: titleTextColor,
              }}
              title={title}
            >
              {title}
            </div>
            {inlineExtra}
          </div>
        </div>

        {/* Optional Bottom-Center Control (e.g. Sleek 22px + Button on Direct Family in «شجرتي») */}
        {bottomCenterControl}
      </div>
    </div>
  );
};
