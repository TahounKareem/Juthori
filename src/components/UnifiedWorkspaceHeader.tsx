import React from 'react';

export type WorkspaceHeaderIconVariant = 'heritage' | 'obsidian';

export interface UnifiedWorkspaceHeaderProps {
  /** Standard icon rendered inside the 44x44px (w-11 h-11) unified icon frame */
  icon: React.ReactNode;
  /** Icon box visual variant: warm heritage parchment (default) or gilded obsidian (Kashafi) */
  iconVariant?: WorkspaceHeaderIconVariant;
  /** Main workspace title */
  title: React.ReactNode;
  /** 1-line metadata segments automatically joined with golden middot separators */
  metaItems?: Array<React.ReactNode | null | undefined | false>;
  /** Optional custom 1-line metadata node (used if caller needs custom layout) */
  meta?: React.ReactNode;
  /** Optional centered control capsule on wide desktop viewports (>=1180px) */
  centerSlot?: React.ReactNode;
  /** Unified 40px action buttons cluster (Secondary buttons right -> Primary CTA far left in RTL) */
  actions?: React.ReactNode;
  /** Optional test id for automated QA */
  testId?: string;
  /** Optional extra classes on outer shell */
  className?: string;
}

/** Shared button class tokens for strict 40px height & unified color hierarchy across all tabs */
export const WORKSPACE_PRIMARY_BTN_CLASS =
  'h-10 px-4 rounded-xl text-[13px] font-display font-semibold inline-flex items-center justify-center gap-2 bg-[#9E5631] hover:bg-[#874726] text-white shadow-sm transition-all cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60 disabled:cursor-not-allowed';

export const WORKSPACE_SECONDARY_BTN_CLASS =
  'h-10 px-4 rounded-xl text-[13px] font-display font-semibold inline-flex items-center justify-center gap-2 bg-white hover:bg-[#FAF5EC] text-[#3D2B1F] border border-[#E2D5BE] transition-all cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60 disabled:cursor-not-allowed';

export const WORKSPACE_SECONDARY_ACTIVE_BTN_CLASS =
  'h-10 px-4 rounded-xl text-[13px] font-display font-semibold inline-flex items-center justify-center gap-2 bg-[#F5ECE0] hover:bg-[#EFE2D0] text-[#8C5327] border border-[#D4AF37]/55 shadow-2xs transition-all cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60 disabled:cursor-not-allowed';

export const WORKSPACE_ICON_BTN_CLASS =
  'h-10 w-10 rounded-xl inline-flex items-center justify-center bg-white hover:bg-[#FAF5EC] text-[#3D2B1F] border border-[#E2D5BE] transition-all cursor-pointer shrink-0 disabled:opacity-60 disabled:cursor-not-allowed';

/**
 * Reusable Quiet Heritage Luxury ornament backdrop shared across
 * UnifiedWorkspaceHeader (all 6 tabs) and the Home welcome hero card.
 * Clipped strictly inside its own `rounded-2xl overflow-hidden` layer so
 * interactive popovers/dropdowns inside header slots are never clipped.
 */
export const HeritagePlaqueOrnamentLayer: React.FC<{
  /** Optional variant to scale the Shamsa watermark gracefully for taller hero cards */
  scale?: 'header' | 'hero';
}> = ({ scale = 'header' }) => {
  const isHero = scale === 'hero';
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none select-none absolute inset-0 rounded-2xl overflow-hidden"
    >
      {/* 1. Top Edge Specular Gold Crest Hairline */}
      <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent" />

      {/* 2. Subtle Warm Amber/Gold Ambient Halo behind the Right Corner (Icon & Title zone) */}
      <div
        className={`absolute -top-10 -right-8 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.06)_0%,rgba(212,175,55,0)_72%)] blur-2xl ${
          isHero ? 'w-72 h-44' : 'w-56 h-36'
        }`}
      />

      {/* 3. Masked Heritage Filigree SVG Watermark (Andalusian 8-Pointed Shamsa + Fine Lineage Vine Lines) */}
      <div className="absolute inset-0 opacity-[0.048] group-hover:opacity-[0.07] transition-opacity duration-500 [mask-image:linear-gradient(to_left,rgba(0,0,0,1)_0%,rgba(0,0,0,0.72)_18%,rgba(0,0,0,0)_42%,rgba(0,0,0,0)_62%,rgba(0,0,0,0.48)_84%,rgba(0,0,0,0.85)_100%)] [-webkit-mask-image:linear-gradient(to_left,rgba(0,0,0,1)_0%,rgba(0,0,0,0.72)_18%,rgba(0,0,0,0)_42%,rgba(0,0,0,0)_62%,rgba(0,0,0,0.48)_84%,rgba(0,0,0,0.85)_100%)]">
        {/* Primary Right-Corner Shamsa Rosette (~220px diameter) + Delicate Lineage Filigree Arcs */}
        <svg
          viewBox="0 0 240 240"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`absolute -right-12 top-1/2 -translate-y-1/2 ${
            isHero ? 'w-[248px] h-[248px]' : 'w-[220px] h-[220px]'
          }`}
        >
          <g stroke="#B88928" strokeWidth="0.75" strokeLinecap="round" strokeLinejoin="round">
            {/* Outer manuscript halo rings */}
            <circle cx="120" cy="120" r="108" strokeDasharray="3 5" />
            <circle cx="120" cy="120" r="98" />
            <circle cx="120" cy="120" r="78" />
            <circle cx="120" cy="120" r="52" />
            <circle cx="120" cy="120" r="24" />
            <circle cx="120" cy="120" r="9" />

            {/* Andalusian 8-Pointed Star (Rub el Hizb — Dual Rotated Squares) */}
            <rect x="52" y="52" width="136" height="136" />
            <rect
              x="52"
              y="52"
              width="136"
              height="136"
              transform="rotate(45 120 120)"
            />

            {/* Inner secondary 8-pointed star */}
            <rect x="82" y="82" width="76" height="76" />
            <rect
              x="82"
              y="82"
              width="76"
              height="76"
              transform="rotate(45 120 120)"
            />

            {/* 8-Pointed Geometric Starburst Petals & Fine Compass Rays */}
            <path d="M120 22 L134 86 L189 51 L154 106 L218 120 L154 134 L189 189 L134 154 L120 218 L106 154 L51 189 L86 134 L22 120 L86 106 L51 51 L106 86 Z" />
            <path d="M120 12 V228 M12 120 H228 M44 44 L196 196 M196 44 L44 196" opacity="0.7" />

            {/* Fine Lineage Vine / Arabesque Tendrils extending softly inward (leftward) */}
            <path d="M22 120 C8 112 4 98 10 86 M22 120 C8 128 4 142 10 154" />
            <path d="M51 51 C34 48 22 60 18 74 M51 189 C34 192 22 180 18 166" />
            <circle cx="120" cy="22" r="2.5" />
            <circle cx="120" cy="218" r="2.5" />
            <circle cx="22" cy="120" r="2.5" />
            <circle cx="218" cy="120" r="2.5" />
            <circle cx="51" cy="51" r="2.2" />
            <circle cx="189" cy="51" r="2.2" />
            <circle cx="51" cy="189" r="2.2" />
            <circle cx="189" cy="189" r="2.2" />
          </g>
        </svg>

        {/* Secondary Lighter Left-Corner Geometric Echo */}
        <svg
          viewBox="0 0 180 180"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`absolute -left-10 top-1/2 -translate-y-1/2 opacity-75 ${
            isHero ? 'w-[176px] h-[176px]' : 'w-[152px] h-[152px]'
          }`}
        >
          <g stroke="#B88928" strokeWidth="0.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="90" cy="90" r="78" strokeDasharray="2.5 5" />
            <circle cx="90" cy="90" r="64" />
            <circle cx="90" cy="90" r="36" />
            <rect x="44" y="44" width="92" height="92" />
            <rect
              x="44"
              y="44"
              width="92"
              height="92"
              transform="rotate(45 90 90)"
            />
            <path d="M90 26 L101 69 L136 44 L111 79 L154 90 L111 101 L136 136 L101 111 L90 154 L79 111 L44 136 L69 101 L26 90 L69 79 L44 44 L79 69 Z" />
          </g>
        </svg>
      </div>

      {/* 4. Micro-Manuscript Corner Filigrees (Inset 6px on sm+ viewports) */}
      <span className="hidden sm:block absolute top-[6px] right-[6px] w-3 h-3 border-t border-r border-[#C59B27]/25 group-hover:border-[#C59B27]/40 rounded-tr-[4px] transition-colors duration-500" />
      <span className="hidden sm:block absolute top-[6px] left-[6px] w-3 h-3 border-t border-l border-[#C59B27]/25 group-hover:border-[#C59B27]/40 rounded-tl-[4px] transition-colors duration-500" />
      <span className="hidden sm:block absolute bottom-[6px] right-[6px] w-3 h-3 border-b border-r border-[#C59B27]/25 group-hover:border-[#C59B27]/40 rounded-br-[4px] transition-colors duration-500" />
      <span className="hidden sm:block absolute bottom-[6px] left-[6px] w-3 h-3 border-b border-l border-[#C59B27]/25 group-hover:border-[#C59B27]/40 rounded-bl-[4px] transition-colors duration-500" />
    </div>
  );
};

export const UnifiedWorkspaceHeader: React.FC<UnifiedWorkspaceHeaderProps> = ({
  icon,
  iconVariant = 'heritage',
  title,
  metaItems,
  meta,
  centerSlot,
  actions,
  testId,
  className = '',
}) => {
  const validMetaItems = (metaItems || []).filter(
    (item): item is React.ReactNode =>
      item !== null && item !== undefined && item !== false && item !== ''
  );

  return (
    <header
      dir="rtl"
      data-testid={testId}
      className={`group relative w-full bg-gradient-to-l from-[#FCF8F0] via-[#FDFBF7] to-[#FAF5EA] border border-[#E6DAC3] rounded-2xl px-5 sm:px-6 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_4px_18px_-6px_rgba(44,30,20,0.05)] min-h-[86px] flex flex-col lg:flex-row lg:items-center lg:justify-between min-[1200px]:flex-nowrap gap-3 xl:gap-4 text-right ${className}`}
    >
      {/* Decorative Masked Heritage Plaque Layer (Non-interactive, cleanly clipped to rounded-2xl) */}
      <HeritagePlaqueOrnamentLayer scale="header" />

      {/* Right Block: Sculpted 44x44 Jewel Medallion + Title + Optional Single-Line Meta Strip */}
      <div className="relative z-10 flex items-center gap-3 min-w-0 shrink">
        <div
          aria-hidden="true"
          className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center border border-[#D8C7B2] bg-[#E8DED2] text-[#D97757] shadow-2xs transition-colors duration-300 group-hover:border-[#D97757]/45"
        >
          {icon}
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-[19px] sm:text-[21px] font-display font-bold text-[#2C1E14] leading-snug truncate">
            {title}
          </h1>

          {meta ? (
            <div className="text-[12.5px] text-[#7A6855] flex flex-wrap items-center gap-x-2 gap-y-1 leading-normal">
              {meta}
            </div>
          ) : validMetaItems.length > 0 ? (
            <div className="text-[12.5px] text-[#7A6855] flex flex-wrap items-center gap-x-2 gap-y-1 leading-normal">
              {validMetaItems.map((item, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && (
                    <span
                      aria-hidden="true"
                      className="text-[#C8A666] font-bold select-none"
                    >
                      ·
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 min-w-0">
                    {item}
                  </span>
                </React.Fragment>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Center Block (Desktop >=1200px / xl): Compact Studio Controls */}
      {centerSlot && (
        <div className="relative z-10 hidden min-[1200px]:flex items-center justify-center shrink-0 min-w-0 whitespace-nowrap">
          {centerSlot}
        </div>
      )}

      {/* Left Block: Unified 40px Action Cluster (Secondary right -> Primary far left) */}
      {actions && (
        <div className="relative z-10 flex flex-wrap min-[1200px]:flex-nowrap items-center justify-start lg:justify-end gap-2 shrink-0 whitespace-nowrap">
          {actions}
        </div>
      )}
    </header>
  );
};
