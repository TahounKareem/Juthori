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
 * Shared across the Home welcome greeting and the top header profile capsule
 * for 100% visual unity, zero clutter, and dynamic per-account family naming.
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
      className={`inline-flex items-center rounded-full border border-[#D4AF37]/45 bg-gradient-to-l from-[#FAF3E3] via-[#FDF9F0] to-white max-w-full ${
        isHeader
          ? 'p-[2.5px] shadow-[0_1px_4px_rgba(141,73,37,0.10)]'
          : 'p-1 shadow-[0_2px_10px_-4px_rgba(141,73,37,0.18)]'
      } ${className}`}
    >
      {/* Right Segment (RTL Start): Warm Bronze/Gold Role Capsule */}
      <span
        className={`inline-flex items-center rounded-full bg-gradient-to-l from-[#965627] to-[#B67537] text-[#FFFDF8] font-display font-bold whitespace-nowrap shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] ${
          isHeader
            ? 'gap-1 px-2 py-[3px] text-[10px] xl:text-[10.5px] leading-none'
            : 'gap-1 px-2.5 py-1 text-[11.5px] sm:text-xs leading-none'
        }`}
      >
        <span aria-hidden="true" className="text-[#F8DC99] leading-none">
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
              isHeader ? 'h-3 mx-1.5' : 'h-3.5 mx-2'
            }`}
          />
          <span
            title={familyLabel}
            className={`font-display font-extrabold text-[#3B2618] whitespace-nowrap truncate ${
              isHeader
                ? 'pl-2 pr-0.5 text-[10.5px] xl:text-[11px] leading-none max-w-[110px] xl:max-w-[132px]'
                : 'pl-2.5 pr-0.5 text-xs sm:text-[13px] leading-none max-w-[180px] sm:max-w-[260px]'
            }`}
          >
            {familyLabel}
          </span>
        </>
      )}
    </span>
  );
};
