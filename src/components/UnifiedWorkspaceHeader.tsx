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
      className={`bg-[#FDFBF7] border border-[#E6DAC3] rounded-2xl px-5 sm:px-6 py-4 shadow-[0_2px_12px_rgba(44,30,20,0.03)] min-h-[86px] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 text-right ${className}`}
    >
      {/* Right Block: Unified 44x44 Icon Box + Title + Optional Single-Line Meta Strip */}
      <div className="flex items-center gap-3.5 min-w-0">
        <div
          aria-hidden="true"
          className={`w-11 h-11 rounded-xl shrink-0 flex items-center justify-center border ${
            iconVariant === 'obsidian'
              ? 'bg-[#241D16] border-[#D4AF37]/45 text-[#E8C56E] shadow-2xs'
              : 'bg-[#F5ECE0] border-[#D4AF37]/30 text-[#8C5327]'
          }`}
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

      {/* Center Block (Desktop >=1180px): Optional Compact Studio Controls */}
      {centerSlot && (
        <div className="hidden min-[1180px]:flex items-center justify-center shrink-0">
          {centerSlot}
        </div>
      )}

      {/* Left Block: Unified 40px Action Cluster (Secondary right -> Primary far left) */}
      {actions && (
        <div className="flex flex-wrap items-center justify-start lg:justify-end gap-2 shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
};
