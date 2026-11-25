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
 * Segmented Role & Family Badge (`عائلة [الاسم] | عضو / أمين سجل`)
 * Places the family name immediately beside the customer's name in RTL to
 * reinforce the personal-family bond, paired with a compact role pill (no ✦).
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
      className={`inline-flex items-center w-auto shrink-0 rounded-full border border-[#D8C7B2] bg-[#E8DED2]/90 ${
        isHeader
          ? 'px-1.5 py-[2px] gap-1.5 shadow-[0_1px_4px_rgba(31,31,28,0.06)]'
          : 'px-2 py-1 gap-2 shadow-[0_2px_10px_-4px_rgba(31,31,28,0.1)]'
      } ${className}`}
    >
      {/* Right Segment (RTL Start): Family Name directly tied to Customer Name */}
      {familyLabel && (
        <>
          <span
            className={`inline-flex items-center gap-1.5 font-display font-extrabold text-[#1F1F1C] leading-normal whitespace-nowrap shrink-0 ${
              isHeader
                ? 'pr-1 text-[11px]'
                : 'pr-1.5 text-[12px] sm:text-[12.5px]'
            }`}
          >
            <span
              aria-hidden="true"
              className="w-1.5 h-1.5 rounded-full bg-[#D97757] shrink-0"
            />
            <span>{familyLabel}</span>
          </span>

          <span
            aria-hidden="true"
            className={`w-px bg-[#D8C7B2] shrink-0 ${
              isHeader ? 'h-3' : 'h-3.5'
            }`}
          />
        </>
      )}

      {/* Compact Role Pill (No ✦) */}
      <span
        className={`inline-flex items-center rounded-full bg-[#D97757] text-[#F5F1E8] font-display font-bold leading-none whitespace-nowrap shrink-0 ${
          isHeader
            ? 'px-2 py-[3px] text-[9.5px]'
            : 'px-2 py-1 text-[10.5px]'
        }`}
      >
        {roleLabel}
      </span>
    </span>
  );
};
