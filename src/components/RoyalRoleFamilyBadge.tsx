import React from 'react';
import { AccountLegalType } from '../types/juthori';

/**
 * Normalizes a raw family name so it always displays cleanly as `عائلة [الاسم]`
 * without duplicating prefixes like `عائلة عائلة ...` or `عائلة أسرة ...`.
 */
export function formatRoyalFamilyLabel(rawFamilyName?: string): string {
  const trimmed = (rawFamilyName || '').trim().replace(/\s+/g, ' ');
  if (!trimmed || trimmed === '—' || trimmed === '-') return '';
  const withoutPrefix = trimmed
    .replace(/^(?:عائلة|عائله|أسرة|اسرة)\s+/u, '')
    .trim();
  if (!withoutPrefix) return '';
  return `عائلة ${withoutPrefix}`;
}

/**
 * Resolves the concise Arabic account role label for the segmented royal badge.
 */
export function resolveRoyalRoleLabel(options: {
  accountType?: AccountLegalType;
  hasRegistrarBadge?: boolean;
  isVerifiedOrVip?: boolean;
}): string {
  if (
    options.accountType === AccountLegalType.RecordKeeper ||
    options.hasRegistrarBadge
  ) {
    return 'أمين سجل';
  }
  return options.isVerifiedOrVip ? 'عضو موثّق' : 'عضو';
}

interface RoyalRoleFamilyBadgeProps {
  roleLabel: string;
  familyName?: string;
  variant?: 'hero' | 'header';
  className?: string;
  testId?: string;
}

/**
 * Royal Segmented Role & Family Badge (`✦ أمين سجل | عائلة [الاسم]`)
 * Shared across the Home welcome greeting, Header profile capsule, and profile dropdown
 * with generous Arabic line-height (`leading-normal`) and unconstrained width so no letters clip.
 */
export const RoyalRoleFamilyBadge: React.FC<RoyalRoleFamilyBadgeProps> = ({
  roleLabel,
  familyName,
  variant = 'hero',
  className = '',
  testId,
}) => {
  const familyLabel = formatRoyalFamilyLabel(familyName);
  const isHeader = variant === 'header';

  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center w-auto shrink-0 rounded-full border border-[#D4AF37]/45 bg-gradient-to-l from-[#FAF3E3] via-[#FDF9F0] to-white ${
        isHeader
          ? 'p-[3px] shadow-[0_1px_5px_rgba(141,73,37,0.10)]'
          : 'p-1 shadow-[0_2px_10px_-4px_rgba(141,73,37,0.18)]'
      } ${className}`}
    >
      {/* Right Segment (RTL Start): Warm Bronze/Gold Role Capsule */}
      <span
        className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-l from-[#965627] to-[#B67537] text-[#FFFDF8] font-display font-bold leading-normal whitespace-nowrap shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] ${
          isHeader
            ? 'px-2.5 py-0.5 text-[11px]'
            : 'px-2.5 py-1 text-xs'
        }`}
      >
        <span aria-hidden="true" className="text-[#F8DC99]">
          ✦
        </span>
        <span>{roleLabel}</span>
      </span>

      {/* Graceful Golden Vertical Divider + Dynamic Family Name */}
      {familyLabel && (
        <>
          <span
            aria-hidden="true"
            className={`w-px bg-[#D4AF37]/40 shrink-0 ${
              isHeader ? 'h-3.5 mx-1.5' : 'h-4 mx-2'
            }`}
          />
          <span
            className={`font-display font-extrabold text-[#3B2618] leading-normal whitespace-nowrap shrink-0 ${
              isHeader
                ? 'px-2.5 py-0.5 text-[11.5px]'
                : 'px-3 py-1 text-[12.5px] sm:text-[13px]'
            }`}
          >
            {familyLabel}
          </span>
        </>
      )}
    </span>
  );
};
