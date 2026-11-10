import React, { useState } from 'react';
import {
  BookOpenCheck,
  CheckCircle2,
  Sparkles,
  MapPin,
} from 'lucide-react';
import {
  AccountLegalType,
  AncestorCapsule,
  DashboardStateMode,
  LineageSearchResult,
  SpineConnectorLabel,
  UpperAncestorNode,
  VerifiedAddonSourceItem,
} from '../types/juthori';
import {
  buildResolvedLineageFromDisambiguationOption,
  deduplicateNotablesWithOcrTolerance,
  getDashboardCapabilities,
  getVerifiedAddonSourcesForEvidence,
  mergeVerifiedAddonSourceLists,
  resolveSpineConnectorLabel,
} from '../utils/lineageEngine';
import {
  HeritageNodeAvatar,
  ExtendedEraType,
  resolveNodeHistoricalEra,
  getHistoricalEraBadgeLabel,
} from './HeritageNodeAvatar';

interface LineageSpineColumnProps {
  stateMode: DashboardStateMode;
  accountType: AccountLegalType;
  result: LineageSearchResult;
  bridgedAncestors: string[];
  onAddBridgedAncestor: (name: string) => void;
  onUnlockRoot5Usd: () => void;
  onUpgradeAnnualVip: () => void;
  unlockedCapsules: string[];
  onRequestUnlockCapsule: (capsule: AncestorCapsule) => void;
  onRequestUnlockAllCapsulesBundle?: () => void;
  walletBalance: number;
  onUpdateImmediateParents?: (
    fatherName: string,
    grandfatherName: string
  ) => void;
  onOpenMyTreeTab?: () => void;
  userAvatarUrl?: string;
  isResearcherDirectPreview?: boolean;
  onOpenAsResearcherTicket?: () => void;
  onSelectVerificationPath?: (optionId: 'option_a' | 'option_b' | 'option_c') => void;
  onEscalateVerificationToTicket?: () => void;
  unlockedAddonSourceIds?: string[];
  onUnlockVerifiedAddonSource?: (addon: VerifiedAddonSourceItem) => void;
}

const LOCKED_UPPER_LINEAGE_LAYERS: Array<{
  id: string;
  label: string;
  era: ExtendedEraType;
}> = [
  {
    id: 'layer-4-prophets',
    label: 'طبقة منتهى العمود وأصول البشرية',
    era: 'prophets_genesis',
  },
  {
    id: 'layer-3-ancient',
    label: 'طبقة الجذوم والممالك العربية القديمة',
    era: 'ancient_root',
  },
  {
    id: 'layer-2-tribes',
    label: 'طبقة القبائل والأحلاف الكبرى',
    era: 'major_tribe',
  },
  {
    id: 'layer-1-near',
    label: 'طبقة الفخذ القريب',
    era: 'family_branch',
  },
];

const CASE_1_ADAM_VIP_MARKETING_COPY =
  'اشترك في الباقة السنوية لتوثيق واستعراض كامل عمود نسب عائلتك التاريخي حتى آدم عليه السلام وفتح المصادر التاريخية';

const CASE_2_ALPHA_VIP_MARKETING_COPY =
  'اشترك في الباقة السنوية لاستكمال توثيق وكشف حلقات عمود نسبك الأعلى حتى آدم عليه السلام والاطلاع على المصادر والمراجع التاريخية';

/**
 * Strips redundant descriptive prefixes from a node name when the top badge
 * already indicates the classification (e.g., "القبيلة الأم", "الفرع الجامع", "العائلة المباشرة").
 */
export function getCleanSpineNodeName(rawName: string): string {
  return rawName
    .replace(/^(القبيلة الأم|الفرع الجامع|العائلة المباشرة)\s*:\s*/u, '')
    .replace(/^(من قبيلة|قبيلة|قبائل|فرع|عائلة)\s+/u, '')
    .trim();
}

/**
 * Sanitizes optional Father / Grandfather input so empty strings, dashes ("—", "-"),
 * or placeholder strings are treated as empty and never rendered as cards.
 */
export function cleanOptionalParentName(rawName?: string): string {
  if (!rawName) return '';
  const cleaned = rawName.trim();
  if (
    !cleaned ||
    cleaned === '—' ||
    cleaned === '-' ||
    cleaned === '--' ||
    cleaned === 'غير محدد' ||
    cleaned === 'غير متوفر'
  ) {
    return '';
  }
  return cleaned;
}

export const LineageSpineColumn: React.FC<LineageSpineColumnProps> = ({
  stateMode,
  accountType,
  result,
  onUnlockRoot5Usd,
  onUpgradeAnnualVip,
  unlockedCapsules,
  onRequestUnlockCapsule,
  onRequestUnlockAllCapsulesBundle,
  walletBalance,
  onOpenMyTreeTab,
  userAvatarUrl,
  isResearcherDirectPreview = false,
  onOpenAsResearcherTicket,
  onSelectVerificationPath,
  onEscalateVerificationToTicket,
  unlockedAddonSourceIds = [],
  onUnlockVerifiedAddonSource,
}) => {
  const caps = getDashboardCapabilities(stateMode, accountType);
  const [selectedAncestor, setSelectedAncestor] =
    useState<UpperAncestorNode | null>(null);
  const [showSourceDetails, setShowSourceDetails] = useState<boolean>(true);
  const [localUnlockedAddonIds, setLocalUnlockedAddonIds] = useState<string[]>(
    []
  );
  const [localWalletDeduction, setLocalWalletDeduction] = useState<number>(0);
  const [addonWalletWarning, setAddonWalletWarning] = useState<string | null>(
    null
  );

  // Progressive 2-Stage Verification State (Triggered ONLY AFTER paying $5)
  const [verificationStage, setVerificationStage] = useState<1 | 2>(1);
  const [stage1Choice, setStage1Choice] = useState<
    'option_a' | 'option_b' | 'option_c' | 'not_sure_stage1'
  >('option_a');
  const [stage2Choice, setStage2Choice] = useState<
    'option_a' | 'option_b' | 'option_c' | 'not_sure_escalate'
  >('option_a');
  const [localResolvedOption, setLocalResolvedOption] = useState<
    'option_a' | 'option_b' | 'option_c' | 'escalated_ticket' | null
  >(null);
  const [researcherExpandedCapsules, setResearcherExpandedCapsules] = useState<
    string[]
  >([]);

  React.useEffect(() => {
    setVerificationStage(1);
    setStage1Choice('option_a');
    setStage2Choice('option_a');
    setLocalResolvedOption(null);
  }, [result.familyName]);

  // Effective result after local or parent verification path selection
  const effectiveResult: LineageSearchResult = React.useMemo(() => {
    if (localResolvedOption === 'escalated_ticket') {
      return {
        ...result,
        matched: false,
        requiresBlindDisambiguation: false,
        recommendedInitialState: DashboardStateMode.State3Unmatched,
      };
    }
    if (
      localResolvedOption === 'option_a' ||
      localResolvedOption === 'option_b' ||
      localResolvedOption === 'option_c'
    ) {
      const explicitOverride =
        localResolvedOption === 'option_b'
          ? result.optionBResultOverride
          : localResolvedOption === 'option_c'
          ? result.optionCResultOverride
          : result.optionAResultOverride;

      if (
        explicitOverride &&
        Array.isArray(explicitOverride.adamSpineNodes) &&
        explicitOverride.adamSpineNodes.length >= 2
      ) {
        return {
          ...result,
          ...explicitOverride,
          matched: true,
          requiresBlindDisambiguation: false,
        };
      }

      const optIndex =
        localResolvedOption === 'option_b'
          ? 1
          : localResolvedOption === 'option_c'
          ? 2
          : 0;
      const chosenOpt =
        result.disambiguationOptions?.find((o) => o.id === localResolvedOption) ||
        result.disambiguationOptions?.[optIndex] || {
          id: localResolvedOption,
          badge: 'المسار المعتمد',
          title: result.rootTribeName || result.familyName,
          originTribeLabel: result.rootTribeName || result.familyName,
          geographicScope: result.originRegion || result.originCountry,
          nearBranchHint: result.rootBranchName || '',
        };
      const chosenCluster = result.consensusClusterGroups?.[optIndex];
      return buildResolvedLineageFromDisambiguationOption(
        result,
        chosenOpt,
        chosenCluster
      );
    }
    return result;
  }, [result, localResolvedOption]);

  const isVerificationPending =
    Boolean(effectiveResult.requiresBlindDisambiguation) &&
    !isResearcherDirectPreview &&
    localResolvedOption === null;

  const fatherName = cleanOptionalParentName(effectiveResult.fatherName);
  const grandfatherName = cleanOptionalParentName(effectiveResult.grandfatherName);

  // Case 3: Unmatched family (or user selected "لا أعرف / موضع آخر" in Stage 2 verification)
  // IMPORTANT: Never show "لم يظهر تطابق آلي" when effectiveResult.matched is true!
  const isUnmatchedCase =
    !effectiveResult.matched || localResolvedOption === 'escalated_ticket';

  const spineNodes: UpperAncestorNode[] = React.useMemo(() => {
    const rawNodes =
      isResearcherDirectPreview &&
      effectiveResult.full_stitched_lineage_for_researcher &&
      effectiveResult.full_stitched_lineage_for_researcher.length > 0
        ? effectiveResult.full_stitched_lineage_for_researcher
        : effectiveResult.adamSpineNodes && effectiveResult.adamSpineNodes.length > 0
        ? effectiveResult.adamSpineNodes
        : effectiveResult.upperAncestors || [];

    if (isUnmatchedCase) {
      return rawNodes;
    }

    // Guarantee at least Family (order 1) + Sub-Root B2 + Mother Tribe B0 when matched & verified
    if (rawNodes.filter((n) => n.orderNumber > 1).length === 0) {
      const famStation: UpperAncestorNode = rawNodes[0] || {
        id: 'synth-fe0-1',
        orderNumber: 1,
        name: effectiveResult.familyName,
        code: 'FE0',
        rankLabel: 'عقدة العائلة المباشرة — بيت النسب',
        isCodedStation: true,
        region: effectiveResult.originRegion || effectiveResult.originCountry,
        eraNote: `عقدة عائلة ${effectiveResult.familyName}.`,
        dataLakeSource: 'alpha_projects',
      };
      const b2Name =
        effectiveResult.rootBranchName &&
        !effectiveResult.rootBranchName.includes('غير مفهرس')
          ? effectiveResult.rootBranchName
          : `فرع ${effectiveResult.familyName}`;
      const b0Name =
        effectiveResult.rootTribeName &&
        !effectiveResult.rootTribeName.includes('قيد التحقيق')
          ? effectiveResult.rootTribeName
          : b2Name;

      const synthesized: UpperAncestorNode[] = [
        famStation,
        {
          id: 'synth-b2-2',
          orderNumber: 2,
          name: b2Name,
          code: 'B2',
          rankLabel: 'الجذر · الفرع الجامع (B2)',
          isCodedStation: true,
          region: effectiveResult.originRegion || effectiveResult.originCountry,
          eraNote: `الفرع الجامع الموثق لعائلة ${effectiveResult.familyName}.`,
          dataLakeSource: 'alpha_projects',
        },
      ];
      if (b0Name !== b2Name) {
        synthesized.push({
          id: 'synth-b0-3',
          orderNumber: 3,
          name: b0Name,
          code: 'B0',
          rankLabel: 'الجذر · القبيلة الأم (B0)',
          isCodedStation: true,
          region: effectiveResult.originRegion || effectiveResult.originCountry,
          eraNote: `القبيلة الأم والجذم الجامع (${b0Name}).`,
          dataLakeSource: 'alpha_projects',
        });
      }
      return synthesized;
    }

    return rawNodes;
  }, [effectiveResult, isResearcherDirectPreview, isUnmatchedCase]);

  const capsulesList: AncestorCapsule[] = effectiveResult.capsules || [];

  const totalFamilySpineNodesCount = spineNodes.length;
  const codedStationsCount = spineNodes.filter(
    (n: UpperAncestorNode) => n.isCodedStation
  ).length;
  const totalIntermediateAncestorsCount = capsulesList.reduce(
    (acc: number, c: AncestorCapsule) => acc + c.ancestors.length,
    0
  );

  const unlockedIntermediateNodesCount = spineNodes.filter(
    (n: UpperAncestorNode) =>
      !n.isCodedStation &&
      Boolean(n.capsuleId && unlockedCapsules.includes(n.capsuleId))
  ).length;

  const visibleAdamNodesCount = Math.min(
    totalFamilySpineNodesCount,
    isResearcherDirectPreview || effectiveResult.isAlphaMergedIntoAdam
      ? totalFamilySpineNodesCount
      : codedStationsCount + unlockedIntermediateNodesCount
  );

  const remainingLockedCapsules =
    effectiveResult.isAlphaMergedIntoAdam || isUnmatchedCase
      ? []
      : capsulesList.filter(
          (c: AncestorCapsule) => !unlockedCapsules.includes(c.id)
        );
  const remainingLockedAncestorsCount = remainingLockedCapsules.reduce(
    (acc: number, c: AncestorCapsule) => acc + c.ancestors.length,
    0
  );

  const unifiedVipMarketingCopy = effectiveResult.isAlphaOnlyBeforeMerge
    ? CASE_2_ALPHA_VIP_MARKETING_COPY
    : CASE_1_ADAM_VIP_MARKETING_COPY;

  // ============================================================================
  // CONNECTOR BADGE (Strictly "↑ بن" vs "↑ من" without extra parenthetical text)
  // ============================================================================
  const renderConnectorBadge = (
    connectorType: SpineConnectorLabel | 'بن' | 'من' = 'من (سليل غير مباشر)'
  ) => {
    const isDirectBin =
      connectorType === 'بن' || connectorType === 'بن (سليل مباشر)';
    const shortConnectorText = isDirectBin ? '↑ بن' : '↑ من';

    return (
      <div className="flex justify-center relative z-20 my-1">
        <div
          className={`inline-flex items-center justify-center px-3.5 py-1 rounded-full text-xs font-display font-bold shadow-2xs border ${
            isDirectBin
              ? 'bg-[#FAF6F0] border-[#8D4925]/45 text-[#8D4925]'
              : 'bg-[#FFF8F0] border-[#D8755B]/60 text-[#D8755B]'
          }`}
        >
          <span>{shortConnectorText}</span>
        </div>
      </div>
    );
  };

  // ============================================================================
  // 1. CLIENT NODE (Bottom of Spine - "أمين السجل")
  // ============================================================================
  const renderClientNode = () => (
    <div className="max-w-[420px] w-full mx-auto rounded-2xl bg-white border-2 border-[#252321] py-3 px-4 shadow-sm relative z-20 text-right">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <HeritageNodeAvatar
            personRole="client"
            size="md"
            customImageUrl={userAvatarUrl}
          />
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-[#8D4925]">
              أمين السجل
            </div>
            <div className="text-base sm:text-lg font-display font-extrabold text-[#252321] truncate">
              {effectiveResult.clientName || result.clientName}
            </div>
          </div>
        </div>
        <span className="text-[11px] font-mono font-bold text-[#8D4925] bg-[#EDE6DA] px-2.5 py-1 rounded-lg border border-[#B98A78]/40 shrink-0">
          معرف نشط
        </span>
      </div>
    </div>
  );

  // ============================================================================
  // 2. FATHER NODE (Rendered ONLY if fatherName is filled - "الأب")
  // ============================================================================
  const renderFatherNode = () => {
    if (!fatherName) return null;
    return (
      <div className="max-w-[420px] w-full mx-auto rounded-2xl bg-white border border-[#B98A78]/70 py-3 px-4 shadow-2xs relative z-20 text-right">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <HeritageNodeAvatar personRole="father" size="md" />
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-[#8D4925]">
                الأب
              </div>
              <div className="text-sm sm:text-base font-display font-bold text-[#252321] truncate">
                {fatherName}
              </div>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-[#8D4925] bg-[#FAF6F0] px-2.5 py-1 rounded-lg border border-[#B98A78]/30 shrink-0">
            موثق ✓
          </span>
        </div>
      </div>
    );
  };

  // ============================================================================
  // 3. GRANDFATHER NODE (Rendered ONLY if grandfatherName is filled - "الجد")
  // ============================================================================
  const renderGrandfatherNode = () => {
    if (!grandfatherName) return null;
    return (
      <div className="max-w-[420px] w-full mx-auto rounded-2xl bg-white border border-[#B98A78]/70 py-3 px-4 shadow-2xs relative z-20 text-right">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <HeritageNodeAvatar personRole="grandfather" size="md" />
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-[#8D4925]">
                الجد
              </div>
              <div className="text-sm sm:text-base font-display font-bold text-[#252321] truncate">
                {grandfatherName}
              </div>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-[#8D4925] bg-[#FAF6F0] px-2.5 py-1 rounded-lg border border-[#B98A78]/30 shrink-0">
            موثق ✓
          </span>
        </div>
      </div>
    );
  };

  // ============================================================================
  // 4. FAMILY STATION NODE (عقدة العائلة المباشرة - بيت النسب)
  // ============================================================================
  const renderFamilyStationNode = () => {
    const station1Node = spineNodes[0];
    return (
      <div className="max-w-[420px] w-full mx-auto rounded-2xl bg-gradient-to-r from-purple-50/95 via-white to-purple-50/95 border-2 border-[#7C3AED]/55 py-3 px-4 shadow-xs relative z-20 text-right">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <HeritageNodeAvatar
              node={station1Node}
              eraOverride="family_branch"
              size="md"
            />
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-[#7C3AED]">
                العائلة المباشرة
              </div>
              <div className="text-base sm:text-lg font-display font-extrabold text-[#252321] truncate">
                {getCleanSpineNodeName(effectiveResult.familyName)}
              </div>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-[#7C3AED] bg-white px-2.5 py-1 rounded-lg border border-[#7C3AED]/30 shrink-0">
            بيت النسب
          </span>
        </div>
      </div>
    );
  };

  // ============================================================================
  // 5A. THE $5 LOCKED ROOT PAYWALL CARD ("الجذر")
  // Shown in Case 1 & Case 2 before paying $5
  // ============================================================================
  const renderLockedRoot5UsdCard = () => {
    const locationParts = [
      effectiveResult.originRegion,
      effectiveResult.originCountry,
    ].filter((part) => part && part !== 'غير محدد' && part !== '—');
    const locationSuffix =
      locationParts.length > 0 ? ` (موطن: ${locationParts.join(' / ')})` : '';
    const stationsCount = Math.max(3, totalFamilySpineNodesCount);
    const sourcesCount = Math.max(
      1,
      effectiveResult.verified_sources?.length || 1
    );

    return (
      <div
        data-testid="root-unlock-5usd-card"
        onClick={onUnlockRoot5Usd}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onUnlockRoot5Usd();
          }
        }}
        title="اضغط لفتح جذر العائلة الموثق الآن مقابل $5 فقط"
        className="max-w-[420px] w-full mx-auto rounded-2xl bg-gradient-to-br from-[#FFFBEB] via-[#FEF3C7] to-[#FDE68A] border-2 border-[#D97706] hover:border-[#B45309] p-4 sm:p-5 shadow-md hover:shadow-lg transition-all cursor-pointer group relative z-20 text-right overflow-hidden space-y-3.5"
      >
        {/* Subtle golden shimmer aura */}
        <div
          className="absolute -top-10 -left-10 w-32 h-32 rounded-full bg-[#F59E0B]/20 blur-xl pointer-events-none"
          aria-hidden="true"
        />

        {/* Top Verified Discovery Banner + Station/Source Count Badge */}
        <div className="flex flex-wrap items-center justify-between gap-2 relative z-10">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#92400E] text-[#FEF3C7] text-[11px] font-display font-extrabold shadow-2xs">
            <span>باقة الـ $5 — فتح الجذر المباشر</span>
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/90 border border-[#D97706]/50 text-[#78350F] text-[11px] font-display font-bold">
            <span>
              {stationsCount} محطة نسبية موثقة · {sourcesCount} مرجع تاريخي
            </span>
          </span>
        </div>

        {/* Exciting Verified Root Heading */}
        <div className="space-y-1 relative z-10">
          <h3 className="text-sm sm:text-base font-display font-extrabold text-[#252321] group-hover:text-[#92400E] transition-colors leading-snug">
            🎉 تم رصد وتوثيق جذر عائلة ({effectiveResult.familyName}) في أمهات المعاجم التاريخية{locationSuffix}
          </h3>
          <p className="text-xs font-display font-bold text-[#78350F] leading-relaxed">
            اكشف الفرع الجامع والقبيلة الأم والمصدر التاريخي المعتمد لعائلتك بفتح الجذر الآن:
          </p>
        </div>

        {/* Partially Blurred / Encrypted Root Nodes Preview (B0 + B2) */}
        <div className="space-y-2 relative z-10">
          <div className="rounded-xl bg-white/85 border border-[#D97706]/50 px-3.5 py-2.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-display font-extrabold text-[#92400E]">
                الجذر · القبيلة الأم (B0)
              </div>
              <div className="text-sm font-display font-extrabold text-[#252321] flex items-center gap-2">
                <span className="blur-[4px] select-none" aria-hidden="true">
                  قبيلة بني سليم القيسية
                </span>
                <span className="text-[11px] font-bold text-[#B45309] bg-[#FEF3C7] px-2 py-0.5 rounded-md border border-[#F59E0B]/40">
                  مشفر · يفتح بـ $5
                </span>
              </div>
            </div>
            <span className="text-base shrink-0">🔒</span>
          </div>

          <div className="rounded-xl bg-white/85 border border-[#D97706]/50 px-3.5 py-2.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-display font-extrabold text-[#92400E]">
                الجذر · الفرع الجامع (B2)
              </div>
              <div className="text-sm font-display font-extrabold text-[#252321] flex items-center gap-2">
                <span className="blur-[4px] select-none" aria-hidden="true">
                  فرع العرفاء السعادي
                </span>
                <span className="text-[11px] font-bold text-[#B45309] bg-[#FEF3C7] px-2 py-0.5 rounded-md border border-[#F59E0B]/40">
                  مشفر · يفتح بـ $5
                </span>
              </div>
            </div>
            <span className="text-base shrink-0">🔒</span>
          </div>
        </div>

        {/* Prominent Direct Unlock CTA Button */}
        <div className="pt-1 relative z-10">
          <div className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#252321] via-[#3A2E28] to-[#252321] group-hover:from-[#92400E] group-hover:to-[#78350F] text-[#FEF3C7] text-xs sm:text-sm font-display font-extrabold shadow-sm flex items-center justify-center gap-2 transition-all">
            <span>🔓 افتح جذر العائلة الموثق الآن مقابل $5 فقط</span>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // 5B. LOCKED UPPER LINEAGE LAYER CARD (Visible ONLY after $5 Root is Unlocked)
  // Large prominent lock icon 🔒 + unified marketing copy
  // ============================================================================
  const renderLockedUpperLayerCard = (
    title: string,
    marketingSubtitle: string,
    era: ExtendedEraType,
    onClickAction: () => void,
    testId?: string
  ) => (
    <div
      data-testid={testId}
      onClick={onClickAction}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClickAction();
        }
      }}
      title={marketingSubtitle}
      className="max-w-[420px] w-full mx-auto rounded-2xl bg-gradient-to-l from-[#FFFDF9] via-[#FAF3E6] to-[#F3E5AB]/70 border-2 border-[#D4AF37]/75 hover:border-[#D8755B] py-3.5 px-4 shadow-xs hover:shadow-md flex items-center justify-between gap-3.5 transition-all cursor-pointer group relative z-20 text-right"
    >
      <div className="flex items-center gap-3 min-w-0">
        <HeritageNodeAvatar eraOverride={era} size="md" />
        <div className="min-w-0 space-y-1">
          <div className="text-xs sm:text-sm font-display font-extrabold text-[#252321] group-hover:text-[#8D4925] transition-colors truncate">
            {title}
          </div>
          <p className="text-[11px] font-semibold text-[#8D4925] leading-snug">
            {marketingSubtitle}
          </p>
        </div>
      </div>
      <span
        aria-label="مقفل — اضغط للفتح"
        className="w-11 h-11 rounded-full bg-gradient-to-br from-[#F59E0B] via-[#D97706] to-[#8D4925] text-white border-2 border-[#FEF3C7] flex items-center justify-center text-xl shadow-sm group-hover:scale-105 transition-transform shrink-0"
      >
        🔒
      </span>
    </div>
  );

  // ============================================================================
  // 5C. CASE 2 VIP RESEARCHER FOLLOW-UP CARD (Alpha Family in Annual VIP before Researcher Merge)
  // ============================================================================
  const renderAlphaVipPendingResearcherMergeCard = () => {
    const tribeLabel = getCleanSpineNodeName(
      result.rootTribeName || 'قبيلة العقيدات'
    );
    const fullTribeDisplay = result.rootTribeName?.startsWith('قبيلة')
      ? result.rootTribeName
      : `قبيلة ${tribeLabel}`;

    return (
      <div
        data-testid="alpha-vip-researcher-followup-card"
        className="max-w-[420px] w-full mx-auto rounded-2xl bg-gradient-to-br from-[#FFFDF9] via-[#FAF3E6] to-[#F5E6C8] border-2 border-[#D4AF37] p-4 sm:p-5 shadow-md relative z-20 text-right space-y-2"
      >
        <div className="flex items-start gap-3">
          <HeritageNodeAvatar eraOverride="ancient_root" size="md" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <h3 className="text-sm sm:text-base font-display font-extrabold text-[#252321] leading-snug">
              ⏳ جاري استكمال ربط وتوثيق الطبقات العليا حتى آدم عليه السلام
            </h3>
            <p className="text-xs text-[#252321]/85 leading-relaxed font-medium">
              باقتك السنوية مفعّلة — يعمل فريق النسابين حالياً على المراجعة النهائية لوصل ({fullTribeDisplay}) بعمودها التاريخي الأعلى، وستظهر العُقد المفتوحة هنا تلقائياً فور اعتمادها.
            </p>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // 5D. CASE 3 UNMATCHED FAMILY SPINE (Before VIP vs After VIP)
  // ============================================================================
  const renderUnmatchedFamilyUpperSection = () => {
    // 1. Before Subscription (Free Account)
    if (!caps.isVip) {
      return (
        <div
          data-testid="unmatched-special-research-paywall-card"
          className="max-w-[420px] w-full mx-auto rounded-2xl bg-gradient-to-br from-[#FFFBEB] via-[#FEF3C7] to-[#FDE68A] border-2 border-[#D97706] p-5 shadow-md relative z-20 text-right space-y-4"
        >
          <div className="flex items-start justify-between gap-3.5">
            <div className="space-y-1.5 min-w-0 flex-1">
              <h3 className="text-sm sm:text-base font-display font-extrabold text-[#252321] leading-snug">
                لم يظهر تطابق آلي مباشر لعائلة ({result.familyName}) في الفهرس الفوري
              </h3>
              <p className="text-xs text-[#78350F] font-semibold leading-relaxed">
                اشترك في الباقة السنوية ليقوم فريق الباحثين المتخصصين بالبحث المعمّق في أرشيف المخطوطات وأمهات الكتب لتوثيق جذر وعمود نسب عائلتك وربطه حتى آدم عليه السلام.
              </p>
            </div>

            <div className="w-13 h-13 rounded-full bg-gradient-to-br from-[#F59E0B] via-[#D97706] to-[#92400E] text-white border-2 border-[#FEF3C7] flex items-center justify-center text-lg shadow-md shrink-0 whitespace-nowrap">
              <span>🔒 🔍</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onUpgradeAnnualVip}
            className="w-full py-3 px-4 rounded-xl bg-[#252321] hover:bg-[#8D4925] text-[#FEF3C7] text-xs sm:text-sm font-display font-extrabold transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-2"
          >
            <span>اشترك في الباقة السنوية وافتح تذكرة بحث لعائلتك ←</span>
          </button>
        </div>
      );
    }

    // 2. After Annual VIP Subscription (Active P1 Research Ticket)
    return (
      <div
        data-testid="unmatched-active-p1-ticket-card"
        className="max-w-[420px] w-full mx-auto rounded-2xl bg-gradient-to-br from-[#FFFDF9] via-[#FAF3E6] to-[#F5E6C8] border-2 border-[#8D4925] p-5 shadow-md relative z-20 text-right space-y-3.5"
      >
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-full bg-[#252321] text-[#F5D78E] border-2 border-[#D4AF37] flex items-center justify-center text-xl shrink-0 shadow-xs">
            🔍
          </div>
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="text-[11px] font-display font-extrabold text-[#8D4925]">
              تذكرة أولوية قصوى P1 · مفعّلة ✓
            </div>
            <h3 className="text-sm sm:text-base font-display font-extrabold text-[#252321] leading-snug">
              🔍 تذكرة بحث وتوثيق نشطة لدى فريق الباحثين — جاري استخراج وتوثيق عمود نسب العائلة
            </h3>
            <p className="text-xs text-[#252321]/80 leading-relaxed">
              يعمل فريق النسابين والمحققين حالياً على مراجعة أرشيف المخطوطات وأمهات الكتب لتوثيق جذر وعمود نسب عائلة ({result.familyName}). يمكنك الآن البدء ببناء شجرة أسرتك القريبة في تبويب «شجرتي» ريثما يعتمد الباحثون عمودك الكامل.
            </p>
          </div>
        </div>

        {onOpenMyTreeTab && (
          <button
            type="button"
            onClick={onOpenMyTreeTab}
            className="w-full py-2.5 px-4 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-display font-bold transition-colors cursor-pointer shadow-2xs"
          >
            ابدأ ببناء شجرة أسرتك القريبة في «شجرتي» ←
          </button>
        )}
      </div>
    );
  };

  // ============================================================================
  // 6. SINGLE ADAM NODE CARD (Compact max-w-[420px])
  // ============================================================================
  const renderAdamNodeCard = (node: UpperAncestorNode) => {
    const isSubRootNode =
      node.code === 'B2' ||
      node.code === 'B1' ||
      (!node.code && node.orderNumber === 4 && node.dataLakeSource !== 'alpha_projects');
    const isMotherTribeNode =
      node.code === 'B0' ||
      (!node.code && node.orderNumber === 6 && node.dataLakeSource !== 'alpha_projects');
    const isRootNode = isSubRootNode || isMotherTribeNode;
    const isAdamNode =
      node.code === 'AD0' ||
      node.name.includes('آدم عليه السلام') ||
      (node.orderNumber === spineNodes.length && spineNodes.length > 10);
    const isCoded = node.isCodedStation;
    const isSelected = selectedAncestor?.id === node.id;
    const resolvedEra = resolveNodeHistoricalEra(node);
    const eraBadgeText = getHistoricalEraBadgeLabel(resolvedEra);
    const cleanTitle = getCleanSpineNodeName(node.name);

    // A) Root Nodes (الجذر — Sub-Branch or Mother Tribe)
    if (isRootNode) {
      const rootSourceCitation =
        effectiveResult.verifiedSourceCitation ||
        effectiveResult.verified_sources?.[0] ||
        '';
      return (
        <div
          key={node.id}
          onClick={() => setSelectedAncestor(node)}
          className={`max-w-[420px] w-full mx-auto rounded-2xl bg-gradient-to-br from-[#FFFDF9] via-[#FFF8F0] to-[#FFEDD5] border-2 ${
            isSelected
              ? 'border-[#D8755B] ring-2 ring-[#D8755B]/25'
              : 'border-[#E67E22]'
          } py-3 px-4 shadow-xs text-right relative z-20 overflow-hidden cursor-pointer transition-all space-y-2`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <HeritageNodeAvatar
                node={node}
                eraOverride="major_tribe"
                size="md"
              />
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-[#E67E22]">
                  {isSubRootNode ? 'الجذر · الفرع الجامع' : 'الجذر · القبيلة الأم'}
                </div>
                <h3 className="text-base sm:text-lg font-display font-extrabold text-[#252321] truncate">
                  {cleanTitle}
                </h3>
              </div>
            </div>
            <span className="text-[11px] font-bold text-[#E67E22] bg-white border border-[#E67E22]/40 px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>جذر موثق</span>
            </span>
          </div>
          {rootSourceCitation && (
            <div className="pt-1.5 border-t border-[#E67E22]/25 flex items-center justify-between gap-2 text-[11px] font-display font-bold text-[#8D4925]">
              <span className="truncate">📚 المصدر المعتمد: {rootSourceCitation}</span>
            </div>
          )}
        </div>
      );
    }

    // B) Prophet Adam (Topmost Summit Node of the Spine)
    if (isAdamNode) {
      return (
        <div
          key={node.id}
          onClick={() => setSelectedAncestor(node)}
          className="max-w-[420px] w-full mx-auto rounded-2xl bg-gradient-to-l from-[#252321] via-[#352F2B] to-[#252321] text-white border-2 border-[#D8755B] py-3 px-4 shadow-md text-right relative z-20 overflow-hidden cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <HeritageNodeAvatar
                node={node}
                eraOverride="prophets_genesis"
                size="md"
              />
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-[#F5D78E] flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>قمة شجرة آدم الموثقة</span>
                </div>
                <h3 className="text-base sm:text-lg font-display font-extrabold text-white truncate">
                  {node.name}
                </h3>
              </div>
            </div>
            <span className="text-[11px] font-bold text-[#F7F2E9] bg-white/15 px-2.5 py-1 rounded-full shrink-0">
              منتهى العمود
            </span>
          </div>
        </div>
      );
    }

    // C) Coded Main Station or Unlocked Intermediate Ancestor
    return (
      <div
        key={node.id}
        onClick={() => setSelectedAncestor(node)}
        className={`max-w-[420px] w-full mx-auto rounded-2xl py-3 px-4 text-right transition-all cursor-pointer relative z-20 ${
          isSelected
            ? 'bg-white border-2 border-[#D8755B] shadow-sm'
            : isCoded
            ? 'bg-white border-2 border-[#8D4925]/55 hover:border-[#D8755B] shadow-2xs'
            : 'bg-[#FFFDF9] border border-[#B98A78]/55 hover:border-[#8D4925]'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <HeritageNodeAvatar node={node} size={isCoded ? 'md' : 'sm'} />
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-[#8D4925]">
                {eraBadgeText}
              </div>
              <div className="text-sm sm:text-base font-display font-extrabold text-[#252321] truncate">
                {cleanTitle}
              </div>
            </div>
          </div>
          <span className="text-[11px] font-bold text-[#8D4925] bg-[#8D4925]/10 px-2.5 py-1 rounded-lg shrink-0">
            موثق ✓
          </span>
        </div>
      </div>
    );
  };

  // ============================================================================
  // 7. COMPACT PILL BADGE FOR INTERMEDIATE ANCESTORS (🔒 +1 في السلسلة / 🔒 +26 جدّاً في السلسلة)
  // ============================================================================
  const renderCompactIntermediatePillBadge = (ringGroup: AncestorCapsule) => {
    const count = ringGroup.ancestors.length;
    const countLabel =
      count === 1
        ? '+1 في السلسلة'
        : count >= 11
        ? `+${count} جدّاً في السلسلة`
        : `+${count} في السلسلة`;

    const handlePillClick = () => {
      if (isResearcherDirectPreview) {
        setResearcherExpandedCapsules((prev) =>
          prev.includes(ringGroup.id)
            ? prev.filter((id) => id !== ringGroup.id)
            : [...prev, ringGroup.id]
        );
        return;
      }
      if (!caps.isVip) {
        onUpgradeAnnualVip();
        return;
      }
      onRequestUnlockCapsule(ringGroup);
    };

    return (
      <div
        key={ringGroup.id}
        className="flex justify-center relative z-20 my-1"
      >
        <button
          type="button"
          data-testid={`capsule-pill-${ringGroup.id}`}
          onClick={handlePillClick}
          title={
            caps.isVip
              ? `اضغط لفتح أسماء الأجداد الفرعيين من رصيد المحفظة (${ringGroup.betweenLabel})`
              : `تُفتح بالباقة السنوية والمحفظة (${ringGroup.betweenLabel})`
          }
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#F7F2E9] hover:bg-[#EFE6D5] border border-[#D4AF37]/70 hover:border-[#D8755B] text-[#8D4925] text-xs font-display font-extrabold shadow-2xs transition-all cursor-pointer"
        >
          <span>🔒</span>
          <span>{countLabel}</span>
        </button>
      </div>
    );
  };

  // ============================================================================
  // 7B. POST-$5 TWO-STAGE PROGRESSIVE VERIFICATION CARD (سؤال التحقق المتدرج)
  // Shown ONLY AFTER paying $5 when multiple candidate paths exist
  // ============================================================================
  const renderPost5UsdProgressiveVerificationCard = () => {
    const candidateOptions = (effectiveResult.disambiguationOptions || []).slice(0, 3);

    const handleConfirmStage1 = () => {
      if (stage1Choice === 'not_sure_stage1') {
        setVerificationStage(2);
        return;
      }
      setLocalResolvedOption(stage1Choice);
      if (onSelectVerificationPath) {
        onSelectVerificationPath(stage1Choice);
      }
    };

    const handleConfirmStage2 = () => {
      if (stage2Choice === 'not_sure_escalate') {
        setLocalResolvedOption('escalated_ticket');
        if (onEscalateVerificationToTicket) {
          onEscalateVerificationToTicket();
        }
        return;
      }
      setLocalResolvedOption(stage2Choice);
      if (onSelectVerificationPath) {
        onSelectVerificationPath(stage2Choice);
      }
    };

    return (
      <div
        data-testid="post-5usd-progressive-verification-card"
        className="max-w-[460px] w-full mx-auto rounded-2xl bg-gradient-to-br from-[#FFFDF9] via-[#FAF3E6] to-[#F5E6C8] border-2 border-[#D97706] p-5 shadow-md relative z-20 text-right space-y-4"
      >
        <div className="flex items-center justify-between gap-2 border-b border-[#B98A78]/30 pb-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D97706]/15 text-[#92400E] text-[11px] font-display font-extrabold">
            <span>
              {verificationStage === 1
                ? 'سؤال التحقق المتدرج (المرحلة 1 من 2)'
                : 'سؤال التحقق المتدرج (المرحلة 2 من 2)'}
            </span>
          </span>
          <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-lg">
            {caps.isRootUnlocked ? 'تم فتح الجذر ($5) ✓' : 'تحقق مجاني قبل فتح الجذر ✓'}
          </span>
        </div>

        {verificationStage === 1 ? (
          <div className="space-y-3.5">
            <div className="space-y-1">
              <h3 className="text-sm sm:text-base font-display font-extrabold text-[#252321] leading-snug">
                لتثبيت الجذر الصحيح لعائلة ({effectiveResult.familyName})، أيٌّ من هذه الأصول أو القبائل يرتبط بأسرتكم؟
              </h3>
              <p className="text-xs text-[#78350F] font-medium">
                {caps.isRootUnlocked
                  ? 'اختر الأصل أو القبيلة الأم لفتح عقدتي الجذر الموثق مباشرة:'
                  : 'اختر الأصل أو القبيلة الأم لتحديد مسار عائلتك الصحيح مجاناً قبل فتح الجذر:'}
              </p>
            </div>

            <div className="space-y-2">
              {candidateOptions.map((opt) => {
                const shortLabel = opt.originTribeLabel || opt.title;
                const isSelected = stage1Choice === opt.id;
                const badgeText =
                  opt.consensusBadge ||
                  (opt.isConsensusWinner ? 'مرجّح في عدة مصادر' : undefined);

                return (
                  <label
                    key={opt.id}
                    onClick={() => setStage1Choice(opt.id)}
                    className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-white border-[#D8755B] shadow-2xs'
                        : 'bg-white/80 border-[#B98A78]/40 hover:border-[#8D4925]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="radio"
                        name="post5_stage1_origin"
                        checked={isSelected}
                        onChange={() => setStage1Choice(opt.id)}
                        className="w-4 h-4 accent-[#D8755B] cursor-pointer shrink-0"
                      />
                      <span className="text-sm sm:text-base font-display font-extrabold text-[#252321]">
                        {shortLabel}
                      </span>
                    </div>

                    {badgeText && (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-900 text-[11px] font-display font-extrabold shrink-0">
                        {badgeText}
                      </span>
                    )}
                  </label>
                );
              })}

              {/* Option: لا أعرف / لست متأكداً (الاحتكام للمواضع الجغرافية) -> Triggers Stage 2 (STAGE_2_GEOGRAPHY / NEED_LOCATION_STEP) */}
              <label
                onClick={() => setStage1Choice('not_sure_stage1')}
                className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                  stage1Choice === 'not_sure_stage1'
                    ? 'bg-white border-[#D8755B] shadow-2xs'
                    : 'bg-white/80 border-[#B98A78]/40 hover:border-[#8D4925]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="post5_stage1_origin"
                    checked={stage1Choice === 'not_sure_stage1'}
                    onChange={() => setStage1Choice('not_sure_stage1')}
                    className="w-4 h-4 accent-[#D8755B] cursor-pointer shrink-0"
                  />
                  <span className="text-sm font-display font-bold text-[#252321]">
                    لا أعرف / لست متأكداً (الاحتكام للمواضع الجغرافية)
                  </span>
                </div>
                <span className="text-[10px] font-bold font-mono text-[#8D4925] bg-[#FAF6F0] px-2 py-0.5 rounded border border-[#B98A78]/35">
                  NEED_LOCATION_STEP
                </span>
              </label>
            </div>

            <button
              type="button"
              onClick={handleConfirmStage1}
              className="w-full py-3 px-4 rounded-xl bg-[#252321] hover:bg-[#8D4925] text-[#FEF3C7] text-xs sm:text-sm font-display font-extrabold transition-colors cursor-pointer shadow-sm"
            >
              {stage1Choice === 'not_sure_stage1'
                ? 'المتابعة إلى التحقق الجغرافي الآلي ←'
                : caps.isRootUnlocked
                ? 'تأكيد الاختيار وكشف الجذر الموثق ←'
                : 'تأكيد الاختيار وتحديد الجذر المطابق ←'}
            </button>
          </div>
        ) : (
          <div className="space-y-3.5">
            <div className="space-y-1">
              <h3 className="text-sm sm:text-base font-display font-extrabold text-[#252321] leading-snug">
                لتحديد المسار النسبي آلياً، أيٌّ من هذه الحواضر أو المواضع يرتبط بأسرتكم؟
              </h3>
              <p className="text-xs text-[#78350F] font-medium">
                اختر الموضع الجغرافي المرتبط بأسرتك ليقوم المحرك بحسم الجذر تلقائياً:
              </p>
            </div>

            <div className="space-y-2">
              {candidateOptions.map((opt) => {
                const isSelected = stage2Choice === opt.id;
                const shortOrigin = opt.originTribeLabel || opt.title;
                return (
                  <label
                    key={opt.id}
                    onClick={() => setStage2Choice(opt.id)}
                    className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-white border-[#D8755B] shadow-2xs'
                        : 'bg-white/80 border-[#B98A78]/40 hover:border-[#8D4925]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="radio"
                        name="post5_stage2_geo"
                        checked={isSelected}
                        onChange={() => setStage2Choice(opt.id)}
                        className="w-4 h-4 accent-[#D8755B] cursor-pointer shrink-0"
                      />
                      <span className="text-sm font-display font-extrabold text-[#252321]">
                        {opt.geographicScope}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-[#8D4925] bg-[#FAF6F0] px-2 py-0.5 rounded border border-[#B98A78]/35 shrink-0">
                      يُحسم آلياً: {shortOrigin}
                    </span>
                  </label>
                );
              })}

              {/* Option: لا أعرف / موضع آخر -> Converts automatically to a direct researcher ticket */}
              <label
                onClick={() => setStage2Choice('not_sure_escalate')}
                className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                  stage2Choice === 'not_sure_escalate'
                    ? 'bg-white border-[#D8755B] shadow-2xs'
                    : 'bg-white/80 border-[#B98A78]/40 hover:border-[#8D4925]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="post5_stage2_geo"
                    checked={stage2Choice === 'not_sure_escalate'}
                    onChange={() => setStage2Choice('not_sure_escalate')}
                    className="w-4 h-4 accent-[#D8755B] cursor-pointer shrink-0"
                  />
                  <span className="text-sm font-display font-bold text-[#252321]">
                    لا أعرف / موضع آخر
                  </span>
                </div>
                <span className="text-[10px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300 shrink-0">
                  إحالة لتذكرة بحث متخصصة
                </span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleConfirmStage2}
                className="flex-1 py-3 px-4 rounded-xl bg-[#252321] hover:bg-[#8D4925] text-[#FEF3C7] text-xs sm:text-sm font-display font-extrabold transition-colors cursor-pointer shadow-sm"
              >
                {stage2Choice === 'not_sure_escalate'
                  ? 'المتابعة إلى البحث المعمق (الباقة السنوية) ←'
                  : caps.isRootUnlocked
                  ? 'تأكيد الموضع وكشف الجذر الموثق ←'
                  : 'تأكيد الموضع وتحديد الجذر المطابق ←'}
              </button>
              <button
                type="button"
                onClick={() => setVerificationStage(1)}
                className="py-3 px-3.5 rounded-xl bg-white border border-[#B98A78]/50 text-xs font-bold text-[#252321] hover:bg-[#EDE6DA] cursor-pointer"
              >
                رجوع
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // 8. CASE 1 VIP SPINE RENDERING (Coded stations open up to Adam; non-coded folded in pills)
  // ============================================================================
  const renderVipFullAdamSpine = () => {
    type SpineRenderEntry =
      | { kind: 'node'; node: UpperAncestorNode }
      | { kind: 'ringGroup'; ringGroup: AncestorCapsule };

    const ascendingEntries: SpineRenderEntry[] = [];
    const handledRings = new Set<string>();

    for (const node of spineNodes) {
      if (node.orderNumber === 1) continue; // Family station rendered below

      if (result.isAlphaMergedIntoAdam || node.isCodedStation) {
        ascendingEntries.push({ kind: 'node', node });
      } else if (node.capsuleId) {
        if (unlockedCapsules.includes(node.capsuleId)) {
          ascendingEntries.push({ kind: 'node', node });
        } else if (!handledRings.has(node.capsuleId)) {
          handledRings.add(node.capsuleId);
          const ringObj = capsulesList.find(
            (c: AncestorCapsule) => c.id === node.capsuleId
          );
          if (ringObj) {
            ascendingEntries.push({ kind: 'ringGroup', ringGroup: ringObj });
          }
        }
      } else {
        ascendingEntries.push({ kind: 'node', node });
      }
    }

    // Reverse so Prophet Adam is ALWAYS the very first element at the top of the spine
    const topToBottomEntries = [...ascendingEntries].reverse();
    const middleInsertIndex = Math.max(
      1,
      Math.floor(topToBottomEntries.length / 2)
    );

    return (
      <div className="space-y-2 relative z-20">
        {topToBottomEntries.map((entry, idx) => {
          const nextEntryBelow = topToBottomEntries[idx + 1];

          const connectorLabel: SpineConnectorLabel =
            !nextEntryBelow ||
            entry.kind === 'ringGroup' ||
            nextEntryBelow.kind === 'ringGroup'
              ? 'من (سليل غير مباشر)'
              : resolveSpineConnectorLabel(
                  nextEntryBelow.node,
                  entry.node,
                  entry.node.orderNumber - nextEntryBelow.node.orderNumber > 1
                );

          return (
            <React.Fragment
              key={
                entry.kind === 'node' ? entry.node.id : entry.ringGroup.id
              }
            >
              {entry.kind === 'node'
                ? renderAdamNodeCard(entry.node)
                : renderCompactIntermediatePillBadge(entry.ringGroup)}

              {/* Quiet, compact bar in the middle of the spine to unlock all sub-ancestors (+26) */}
              {idx === middleInsertIndex - 1 &&
                !result.isAlphaMergedIntoAdam &&
                remainingLockedCapsules.length > 0 &&
                onRequestUnlockAllCapsulesBundle && (
                  <div className="flex justify-center py-1 relative z-20">
                    <button
                      type="button"
                      onClick={onRequestUnlockAllCapsulesBundle}
                      className="max-w-[420px] w-full mx-auto rounded-xl bg-[#F7F2E9] hover:bg-[#EFE6D5] border border-[#E6DFD3] hover:border-[#D8755B] text-[#8D4925] py-2 px-3.5 text-xs font-display font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                    >
                      <span>🔒</span>
                      <span>
                        إظهار جميع الأجداد الفرعيين في السلسلة (+{remainingLockedAncestorsCount || totalIntermediateAncestorsCount})
                      </span>
                    </button>
                  </div>
                )}

              {idx < topToBottomEntries.length - 1 &&
                renderConnectorBadge(connectorLabel)}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  // ============================================================================
  // 9. CASE 2 ALPHA-ONLY SPINE (Before Researcher Merge)
  // - Before $5: Only locked "الجذر" card
  // - Immediately After $5 (if multiple candidate paths): 2-Stage Progressive Verification Card
  // - After $5 (Resolved): Unified 2-Node Root (B2 & B0) + Folded Intermediate Capsule (🔒 +1 في السلسلة / 🔒 +26 جدّاً في السلسلة)
  // ============================================================================
  const renderAlphaOnlyBeforeMergeSpine = () => {
    // 1. Case A: If disambiguation is required, show the 2-Stage Progressive Verification Card FIRST for FREE (NEVER show the $5 paywall before verification!)
    if (isVerificationPending) {
      return (
        <div className="space-y-2.5 relative z-20">
          {renderPost5UsdProgressiveVerificationCard()}
        </div>
      );
    }

    // 2. Outcome A (Resolved Match) or Case B (Single Direct Match): Now show the locked $5 Root card ("الجذر · افتح الآن $5")
    if (!caps.isRootUnlocked) {
      return (
        <div className="space-y-2.5 relative z-20">
          {renderLockedRoot5UsdCard()}
        </div>
      );
    }

    type AlphaSpineRenderEntry =
      | { kind: 'node'; node: UpperAncestorNode }
      | { kind: 'ringGroup'; ringGroup: AncestorCapsule };

    const ascendingEntries: AlphaSpineRenderEntry[] = [];
    const handledRings = new Set<string>();

    for (const node of spineNodes) {
      if (node.orderNumber === 1) continue; // Family station rendered below

      if (node.isCodedStation) {
        ascendingEntries.push({ kind: 'node', node });
      } else if (node.capsuleId) {
        const ringObj = capsulesList.find(
          (c: AncestorCapsule) => c.id === node.capsuleId
        );
        const isUnlockedForCustomer =
          caps.isVip && unlockedCapsules.includes(node.capsuleId);
        const isUnlockedForResearcher = isResearcherDirectPreview;

        if (isUnlockedForCustomer || isUnlockedForResearcher) {
          ascendingEntries.push({ kind: 'node', node });
        } else if (!handledRings.has(node.capsuleId)) {
          handledRings.add(node.capsuleId);
          if (ringObj) {
            ascendingEntries.push({ kind: 'ringGroup', ringGroup: ringObj });
          }
        }
      } else {
        ascendingEntries.push({ kind: 'node', node });
      }
    }

    const topToBottomAlphaEntries = [...ascendingEntries].reverse();

    return (
      <div className="space-y-2.5 relative z-20">
        {!caps.isVip ? (
          <>
            {LOCKED_UPPER_LINEAGE_LAYERS.map((layerItem) => (
              <React.Fragment key={layerItem.id}>
                {renderLockedUpperLayerCard(
                  layerItem.label,
                  CASE_2_ALPHA_VIP_MARKETING_COPY,
                  layerItem.era,
                  onUpgradeAnnualVip,
                  layerItem.id
                )}
              </React.Fragment>
            ))}
            {renderConnectorBadge('من')}
          </>
        ) : (
          <>
            {renderAlphaVipPendingResearcherMergeCard()}
            {renderConnectorBadge('من')}
          </>
        )}

        <div className="space-y-2">
          {topToBottomAlphaEntries.map((entry, idx) => {
            const nextEntryBelow = topToBottomAlphaEntries[idx + 1];
            const connectorLabel: SpineConnectorLabel =
              !nextEntryBelow ||
              entry.kind === 'ringGroup' ||
              nextEntryBelow.kind === 'ringGroup'
                ? 'من (سليل غير مباشر)'
                : resolveSpineConnectorLabel(
                    nextEntryBelow.node,
                    entry.node,
                    entry.node.orderNumber - nextEntryBelow.node.orderNumber > 1
                  );

            return (
              <React.Fragment
                key={entry.kind === 'node' ? entry.node.id : entry.ringGroup.id}
              >
                {entry.kind === 'node'
                  ? renderAdamNodeCard(entry.node)
                  : renderCompactIntermediatePillBadge(entry.ringGroup)}
                {nextEntryBelow && renderConnectorBadge(connectorLabel)}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  };

  // ============================================================================
  // 10. CASE 1 NON-VIP SPINE FOR FULL ADAM CHAINS (Free Stage 1 vs $5 Basic Stage 2)
  // ============================================================================
  const renderNonVipSpineAboveFamily = () => {
    // 1. Case A: If disambiguation is required, show the 2-Stage Progressive Verification Card FIRST for FREE (NEVER show the $5 paywall before verification!)
    if (isVerificationPending) {
      return (
        <div className="space-y-2.5 relative z-20">
          {renderPost5UsdProgressiveVerificationCard()}
        </div>
      );
    }

    // 2. Outcome A (Resolved Match) or Case B (Single Direct Match): Show the locked $5 Root card ("الجذر · افتح الآن $5")
    if (!caps.isRootUnlocked) {
      return (
        <div className="space-y-2.5 relative z-20">
          {renderLockedRoot5UsdCard()}
        </div>
      );
    }

    // Stage 2 ($5 Paid — Root Unlocked, Non-VIP): Show the 4 locked upper layers + Unified 2 Root Nodes (B2 & B0) + folded intermediate capsules below B0
    const subRootStation =
      spineNodes.find(
        (n: UpperAncestorNode) => n.code === 'B2' || n.code === 'B1'
      ) || spineNodes[1];
    const motherTribeStation =
      spineNodes.find((n: UpperAncestorNode) => n.code === 'B0') ||
      spineNodes[2] ||
      spineNodes[spineNodes.length - 1];

    const capsuleBetweenB2AndB0 = capsulesList.find(
      (c) =>
        subRootStation &&
        motherTribeStation &&
        c.ancestors.some(
          (a) =>
            a.orderNumber > subRootStation.orderNumber &&
            a.orderNumber < motherTribeStation.orderNumber
        )
    );
    const capsuleBetweenFamilyAndB2 = capsulesList.find(
      (c) =>
        subRootStation &&
        c.ancestors.some(
          (a) => a.orderNumber > 1 && a.orderNumber < subRootStation.orderNumber
        )
    );

    return (
      <div className="space-y-2.5 relative z-20">
        {LOCKED_UPPER_LINEAGE_LAYERS.map((layerItem) => (
          <React.Fragment key={layerItem.id}>
            {renderLockedUpperLayerCard(
              layerItem.label,
              CASE_1_ADAM_VIP_MARKETING_COPY,
              layerItem.era,
              onUpgradeAnnualVip,
              layerItem.id
            )}
          </React.Fragment>
        ))}

        {renderConnectorBadge('من')}

        <div className="space-y-2 relative z-20">
          {motherTribeStation && renderAdamNodeCard(motherTribeStation)}

          {capsuleBetweenB2AndB0 && (
            <>
              {renderConnectorBadge('من')}
              {renderCompactIntermediatePillBadge(capsuleBetweenB2AndB0)}
            </>
          )}

          {motherTribeStation &&
            subRootStation &&
            subRootStation.id !== motherTribeStation.id &&
            renderConnectorBadge('من')}

          {subRootStation &&
            subRootStation.id !== motherTribeStation?.id &&
            renderAdamNodeCard(subRootStation)}

          {capsuleBetweenFamilyAndB2 && (
            <>
              {renderConnectorBadge('من')}
              {renderCompactIntermediatePillBadge(capsuleBetweenFamilyAndB2)}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      data-testid={`lineage-spine-${stateMode}`}
      className="w-full space-y-6 text-right"
    >
      {/* ======================================================== */}
      {/* PEDIGREE CANVAS                                          */}
      {/* ======================================================== */}
      <div
        className="rounded-3xl border-2 border-[#EDE6DA] p-5 sm:p-8 shadow-sm relative overflow-hidden"
        style={{
          backgroundColor: '#FAF6F0',
          backgroundImage: 'radial-gradient(#B98A78 1.2px, transparent 1.2px)',
          backgroundSize: '24px 24px',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-[#FAF6F0]/80 via-transparent to-[#FAF6F0]/90 pointer-events-none" />

        {/* Spine Top Status Header */}
        <div className="relative z-20 mb-8 pb-4 border-b border-[#B98A78]/30 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg sm:text-2xl font-display font-extrabold text-[#252321]">
                عمود نسب عائلة {effectiveResult.familyName} الموثق
              </h2>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#D8755B]/15 text-[#D8755B]">
                {isUnmatchedCase
                  ? caps.isVip
                    ? '🔍 تذكرة بحث وتوثيق نشطة (P1)'
                    : 'قيد الفحص والتوثيق الخاص'
                  : isVerificationPending
                  ? 'بانتظار تحديد المسار لتأكيد التطابق ✓'
                  : effectiveResult.isAlphaOnlyBeforeMerge && caps.isVip
                  ? `الجذر مفتوح (${visibleAdamNodesCount} عُقد مفتوحة من أصل ${totalFamilySpineNodesCount}) · جاري ربط الطبقات العليا`
                  : caps.isVip
                  ? `${visibleAdamNodesCount} عقدة مفتوحة من أصل ${totalFamilySpineNodesCount}`
                  : caps.isRootUnlocked
                  ? `الجذر مفتوح (${getCleanSpineNodeName(effectiveResult.rootBranchName)} · ${getCleanSpineNodeName(effectiveResult.rootTribeName)})`
                  : 'نتيجة الفحص: تطابق موثق ✓'}
              </span>
            </div>
            <p className="text-xs text-[#252321]/70 mt-1">
              السلسلة التاريخية الموثقة لعائلة {effectiveResult.familyName}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {caps.isVip &&
              !isUnmatchedCase &&
              !isVerificationPending &&
              !effectiveResult.isAlphaMergedIntoAdam &&
              remainingLockedCapsules.length > 0 &&
              onRequestUnlockAllCapsulesBundle && (
                <button
                  type="button"
                  onClick={onRequestUnlockAllCapsulesBundle}
                  className="px-3.5 py-1.5 rounded-xl bg-[#F7F2E9] hover:bg-[#EFE6D5] border border-[#E6DFD3] text-[#8D4925] text-xs font-display font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <span>🔒</span>
                  <span>
                    إظهار جميع الأجداد الفرعيين في السلسلة (+{remainingLockedAncestorsCount || totalIntermediateAncestorsCount})
                  </span>
                </button>
              )}

            {caps.isVip && !isResearcherDirectPreview && (
              <span className="text-xs font-bold text-[#252321] bg-white border border-[#B98A78]/45 px-3 py-1.5 rounded-xl">
                💳 المحفظة: ${walletBalance.toFixed(2)}
              </span>
            )}
          </div>
        </div>

        {/* Centered Vertical Pedigree Spine (Ascending Bottom-to-Top) */}
        <div className="relative py-4 min-h-[380px]">
          <div
            className="absolute left-1/2 -translate-x-1/2 top-4 bottom-4 w-0.5 bg-gradient-to-t from-[#252321]/30 via-[#D8755B]/40 to-[#8D4925]/30 rounded-full pointer-events-none"
            aria-hidden="true"
          />

          <div className="space-y-2">
            {/* Upper Spine Section (Handled strictly for Case 1, Case 2, and Case 3) */}
            {isUnmatchedCase
              ? renderUnmatchedFamilyUpperSection()
              : effectiveResult.isAlphaOnlyBeforeMerge
              ? renderAlphaOnlyBeforeMergeSpine()
              : caps.isVip && !isVerificationPending
              ? renderVipFullAdamSpine()
              : renderNonVipSpineAboveFamily()}

            {/* Connector between Family Station and Root/Upper Spine ("↑ من") */}
            {renderConnectorBadge('من')}

            {/* Family Station Node (العائلة المباشرة - بيت النسب) */}
            {renderFamilyStationNode()}

            {!isResearcherDirectPreview && (
              <>
                {/* Connector between topmost Personal Card (Grandfather, Father, or Record Keeper) and Family Station ("↑ من") */}
                {renderConnectorBadge('من')}

                {/* Grandfather Node (ONLY rendered if grandfatherName is filled) */}
                {grandfatherName && (
                  <>
                    {renderGrandfatherNode()}
                    {renderConnectorBadge(fatherName ? 'بن' : 'من')}
                  </>
                )}

                {/* Father Node (ONLY rendered if fatherName is filled) */}
                {fatherName && (
                  <>
                    {renderFatherNode()}
                    {renderConnectorBadge('بن')}
                  </>
                )}

                {/* Client Node at Bottom ("أمين السجل") */}
                {renderClientNode()}
              </>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* VERIFIED HISTORICAL SOURCES CARD                         */}
        {/* Shown in Case 1 & Case 2 only after $5 Root is unlocked  */}
        {/* ======================================================== */}
        {!isUnmatchedCase && caps.isRootUnlocked && !isVerificationPending && (
          <div className="mt-10 pt-6 border-t border-[#B98A78]/35 max-w-2xl mx-auto w-full relative z-20">
            {!caps.isVip ? (
              <div
                onClick={onUpgradeAnnualVip}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onUpgradeAnnualVip();
                  }
                }}
                className="rounded-2xl bg-gradient-to-br from-[#FFFDF9] via-[#FAF3E6] to-[#F3E5AB]/75 border-2 border-[#D4AF37]/80 hover:border-[#D8755B] p-4 shadow-xs hover:shadow-md transition-all cursor-pointer group text-right flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#8D4925] via-[#B98A78] to-[#D8755B] text-[#FAF6F0] border-2 border-[#F5D78E] flex items-center justify-center shrink-0 shadow-xs">
                    <BookOpenCheck className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <h3 className="text-sm sm:text-base font-display font-extrabold text-[#252321] group-hover:text-[#8D4925] transition-colors truncate">
                      المصادر والمراجع التاريخية الموثقة لعائلة {effectiveResult.familyName}
                    </h3>
                    <p className="text-xs font-semibold text-[#8D4925] leading-snug">
                      {unifiedVipMarketingCopy}
                    </p>
                  </div>
                </div>
                <span
                  aria-label="مقفل — اضغط للفتح"
                  className="w-11 h-11 rounded-full bg-gradient-to-br from-[#F59E0B] via-[#D97706] to-[#8D4925] text-white border-2 border-[#FEF3C7] flex items-center justify-center text-xl shadow-sm group-hover:scale-105 transition-transform shrink-0"
                >
                  🔒
                </span>
              </div>
            ) : (
              <div className="rounded-3xl bg-white border-2 border-[#8D4925]/35 p-5 sm:p-6 shadow-xs text-right space-y-4">
                <button
                  type="button"
                  onClick={() => setShowSourceDetails((prev) => !prev)}
                  className="w-full flex items-center justify-between gap-4 text-right cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-[#8D4925] text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <BookOpenCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base sm:text-lg font-display font-extrabold text-[#252321]">
                          بطاقة المصادر والمراجع التاريخية المجمعة ({(effectiveResult.verified_sources?.length || effectiveResult.secondarySources?.length || 1)} مراجع)
                        </h3>
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-[#8D4925] px-3 py-1.5 rounded-xl bg-[#8D4925]/10 shrink-0">
                    {showSourceDetails ? 'إخفاء التفاصيل ▲' : 'عرض التفاصيل ▼'}
                  </span>
                </button>

                {showSourceDetails && (
                  <div className="pt-4 border-t border-[#B98A78]/30 space-y-4">
                    {/* Aggregated Verified Sources List (Books, Volumes & Pages) */}
                    {(() => {
                      const aggregatedSources =
                        effectiveResult.verified_sources && effectiveResult.verified_sources.length > 0
                          ? effectiveResult.verified_sources
                          : effectiveResult.secondarySources && effectiveResult.secondarySources.length > 0
                          ? effectiveResult.secondarySources
                          : [effectiveResult.verifiedSourceCitation];

                      return (
                        <div className="rounded-2xl bg-[#FAF6F0] border border-[#8D4925]/30 p-3.5 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-xs font-display font-extrabold text-[#8D4925]">
                              قائمة المصادر والمراجع التاريخية المجمعة (الكتب والأجزاء والصفحات):
                            </div>
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-white border border-[#8D4925]/25 text-[#8D4925]">
                              verified_sources ({aggregatedSources.length})
                            </span>
                          </div>
                          <ul className="space-y-1.5 text-xs text-[#252321]/90">
                            {aggregatedSources.map((src: string, i: number) => (
                              <li
                                key={i}
                                className="flex items-start gap-2 bg-white px-3 py-2 rounded-xl border border-[#B98A78]/25 font-semibold"
                              >
                                <span className="w-5 h-5 rounded-full bg-[#8D4925]/15 text-[#8D4925] text-[10px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                                  {i + 1}
                                </span>
                                <span className="leading-relaxed">{src}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })()}

                    {/* ======================================================== */}
                    {/* VERIFIED ADDON SOURCES SUBSECTION (VERIFIED_ADDON_SOURCE) */}
                    {/* STRICT RULE: Raw `other_sources` (`RAW_UNVERIFIED_LEAD`)  */}
                    {/* NEVER appear here; ONLY researcher-verified Adam Prime    */}
                    {/* `VERIFIED_ADDON_SOURCE` items are displayed!              */}
                    {/* ======================================================== */}
                    {(() => {
                      const verifiedAddonList = mergeVerifiedAddonSourceLists(
                        effectiveResult.verifiedAddonSources,
                        getVerifiedAddonSourcesForEvidence(
                          effectiveResult.corroborating_alpha_evidence_for_researcher ||
                            effectiveResult.alpha_evidence
                        )
                      );

                      if (verifiedAddonList.length === 0) return null;

                      const effectiveWalletBalance = Math.max(
                        0,
                        walletBalance - localWalletDeduction
                      );

                      return (
                        <div
                          data-testid="verified-addon-sources-customer-section"
                          className="rounded-2xl bg-gradient-to-br from-[#FFFDF9] via-[#FAF3E6] to-[#F3E5AB]/55 border-2 border-[#D4AF37]/80 p-4 space-y-3 shadow-2xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-base">🏛️</span>
                              <div className="text-xs sm:text-sm font-display font-extrabold text-[#252321]">
                                مراجع تاريخية إضافية موثقة من فريق الخبراء (قابلة للفتح عبر المحفظة)
                              </div>
                            </div>
                            <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#252321] text-[#F5D78E]">
                              VERIFIED_ADDON_SOURCE ({verifiedAddonList.length})
                            </span>
                          </div>

                          {addonWalletWarning && (
                            <div className="rounded-xl bg-amber-100 border border-amber-400 px-3 py-2 text-xs font-bold text-amber-950">
                              {addonWalletWarning}
                            </div>
                          )}

                          <div className="space-y-2.5">
                            {verifiedAddonList.map((addon, aIdx) => {
                              const addonKey = `${addon.attached_to_node}::${addon.source_id}::${addon.volume}::${addon.page}`;
                              const isAddonUnlocked =
                                unlockedAddonSourceIds.includes(addonKey) ||
                                unlockedAddonSourceIds.includes(addon.source_id) ||
                                localUnlockedAddonIds.includes(addonKey);
                              const priceUsd =
                                typeof addon.addon_unlock_price_usd === 'number' &&
                                addon.addon_unlock_price_usd > 0
                                  ? addon.addon_unlock_price_usd
                                  : 2;

                              const handleUnlockAddonClick = () => {
                                setAddonWalletWarning(null);
                                if (onUnlockVerifiedAddonSource) {
                                  onUnlockVerifiedAddonSource(addon);
                                  setLocalUnlockedAddonIds((prev) =>
                                    prev.includes(addonKey)
                                      ? prev
                                      : [...prev, addonKey]
                                  );
                                  return;
                                }
                                if (effectiveWalletBalance < priceUsd) {
                                  setAddonWalletWarning(
                                    `رصيد المحفظة الحالي ($${effectiveWalletBalance.toFixed(2)}) غير كافٍ لفتح المرجع الإضافي ($${priceUsd}). يرجى شحن المحفظة.`
                                  );
                                  return;
                                }
                                setLocalWalletDeduction(
                                  (prev) => prev + priceUsd
                                );
                                setLocalUnlockedAddonIds((prev) =>
                                  prev.includes(addonKey)
                                    ? prev
                                    : [...prev, addonKey]
                                );
                              };

                              return (
                                <div
                                  key={addonKey || aIdx}
                                  data-testid={`verified-addon-source-item-${aIdx}`}
                                  className="rounded-xl bg-white border border-[#D4AF37]/70 p-3.5 space-y-2 shadow-2xs"
                                >
                                  {isAddonUnlocked ? (
                                    <div className="space-y-1.5">
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="px-2 py-0.5 rounded bg-emerald-800 text-white font-mono text-[10px] font-bold">
                                            [{addon.source_id}]
                                          </span>
                                          <span className="text-xs sm:text-sm font-display font-extrabold text-[#252321]">
                                            {addon.canonical_title}
                                          </span>
                                          {addon.author && (
                                            <span className="text-[11px] text-[#8D4925] font-semibold">
                                              — المؤلف: {addon.author}
                                            </span>
                                          )}
                                        </div>
                                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-900 text-[10px] font-extrabold">
                                          تم الفتح من المحفظة ✓
                                        </span>
                                      </div>

                                      <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#8D4925] bg-[#FAF6F0] px-3 py-1.5 rounded-lg border border-[#B98A78]/30">
                                        <span>
                                          📚 الجزء: <strong>{addon.volume || '—'}</strong>
                                        </span>
                                        <span>·</span>
                                        <span>
                                          📄 الصفحة: <strong>{addon.page || '—'}</strong>
                                        </span>
                                        <span>·</span>
                                        <span className="font-mono text-[11px] text-stone-600">
                                          معرف آدم برايم الموحد: {addon.source_id} (SYNCED_UNIFIED_ID)
                                        </span>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                      <div className="space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="px-2 py-0.5 rounded bg-[#252321] text-[#F5D78E] font-mono text-[10px] font-bold">
                                            [{addon.source_id}]
                                          </span>
                                          <span className="text-xs sm:text-sm font-display font-extrabold text-[#252321]">
                                            مرجع تاريخي إضافي موثق في سجل آدم برايم الموحد
                                          </span>
                                        </div>
                                        <p className="text-[11px] text-[#78350F] font-semibold">
                                          تم التحقق من هذا المصدر الثانوي ومطابقته مع العقدة ({addon.linked_record_name || effectiveResult.familyName}) بواسطة فريق الخبراء.
                                        </p>
                                      </div>

                                      <button
                                        type="button"
                                        data-testid={`unlock-verified-addon-btn-${aIdx}`}
                                        onClick={handleUnlockAddonClick}
                                        className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#8D4925] to-[#B45309] hover:from-[#78350F] hover:to-[#92400E] text-white text-xs font-display font-extrabold shadow-xs transition-all cursor-pointer shrink-0 flex items-center gap-1.5"
                                      >
                                        <span>🔓</span>
                                        <span>
                                          فتح بيانات المرجع الإضافي ورقم الصفحة (${priceUsd} من المحفظة)
                                        </span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Aggregated Sibling Branches List */}
                    {(() => {
                      const aggregatedSiblings =
                        effectiveResult.sibling_branches_in_record &&
                        effectiveResult.sibling_branches_in_record.length > 0
                          ? effectiveResult.sibling_branches_in_record
                          : effectiveResult.siblingBranches || [];

                      if (aggregatedSiblings.length === 0) return null;

                      return (
                        <div className="rounded-2xl bg-[#FAF6F0] border border-[#B98A78]/35 p-3.5 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-xs font-display font-extrabold text-[#252321]">
                              قائمة الفروع الشقيقة المجمعة في المصادر المرصودة ({aggregatedSiblings.length} فروع):
                            </div>
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-white border border-[#B98A78]/35 text-[#8D4925]">
                              sibling_branches_in_record
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {aggregatedSiblings.map((branch: string, idx: number) => (
                              <span
                                key={`${branch}-${idx}`}
                                className="px-2.5 py-1 rounded-xl bg-white border border-[#8D4925]/30 text-xs font-display font-bold text-[#252321] shadow-2xs"
                              >
                                {branch}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {effectiveResult.notables_in_record &&
                      effectiveResult.notables_in_record.length > 0 && (
                        <div className="rounded-2xl bg-[#FAF6F0] border border-[#B98A78]/30 p-3.5 space-y-1.5">
                          <div className="text-xs font-display font-bold text-[#8D4925]">
                            الأعلام والشخصيات المرصودة في السجل:
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {deduplicateNotablesWithOcrTolerance(
                              effectiveResult.notables_in_record
                            ).map((notable: string, idx: number) => (
                              <span
                                key={idx}
                                className="px-2.5 py-1 rounded-lg bg-white border border-[#B98A78]/30 text-xs font-semibold text-[#252321]"
                              >
                                {notable}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                    {effectiveResult.enrichedLocations && effectiveResult.enrichedLocations.length > 0 && (
                      <div className="rounded-2xl bg-[#FAF6F0] border border-[#B98A78]/30 p-3.5 space-y-1.5">
                        <div className="text-xs font-display font-bold text-[#8D4925]">
                          المواضع الجغرافية الموثقة في المراجع الموازية:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {effectiveResult.enrichedLocations.map((loc: string, idx: number) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-[#B98A78]/30 text-xs font-semibold text-[#252321]"
                            >
                              <MapPin className="w-3 h-3 text-[#D8755B]" />
                              <span>{loc}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedAncestor && (
                      <div className="bg-[#FAF6F0] p-3.5 rounded-2xl border border-[#B98A78]/25 space-y-1.5">
                        <div className="text-xs font-bold text-[#8D4925]">
                          إضاءة تاريخية على العقدة المختارة ({selectedAncestor.name}):
                        </div>
                        <p className="text-xs text-[#252321]/80 leading-relaxed">
                          {selectedAncestor.eraNote}
                        </p>
                        {selectedAncestor.region && (
                          <div className="flex items-center gap-1.5 text-xs text-[#8D4925] font-semibold pt-0.5">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>{selectedAncestor.region}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
