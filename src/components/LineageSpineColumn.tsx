import React, { useState } from 'react';
import {
  BookOpenCheck,
  CheckCircle2,
  Sparkles,
  MapPin,
  ArrowUp,
} from 'lucide-react';
import {
  AccountLegalType,
  AncestorCapsule,
  DashboardStateMode,
  LineageSearchResult,
  SpineConnectorLabel,
  UpperAncestorNode,
} from '../types/juthori';
import {
  getDashboardCapabilities,
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
}) => {
  const caps = getDashboardCapabilities(stateMode, accountType);
  const [selectedAncestor, setSelectedAncestor] =
    useState<UpperAncestorNode | null>(null);
  const [showSourceDetails, setShowSourceDetails] = useState<boolean>(true);

  const fatherName = result.fatherName?.trim() || '';
  const grandfatherName = result.grandfatherName?.trim() || '';

  const spineNodes: UpperAncestorNode[] =
    result.adamSpineNodes && result.adamSpineNodes.length > 0
      ? result.adamSpineNodes
      : result.upperAncestors;

  const capsulesList: AncestorCapsule[] = result.capsules || [];

  const totalFamilySpineNodesCount = spineNodes.length;
  const codedStationsCount = spineNodes.filter(
    (n: UpperAncestorNode) => n.isCodedStation
  ).length;
  const totalIntermediateAncestorsCount = capsulesList.reduce(
    (acc: number, c: AncestorCapsule) => acc + c.ancestors.length,
    0
  );

  const unlockedIntermediateNodesCount = capsulesList
    .filter((c: AncestorCapsule) => unlockedCapsules.includes(c.id))
    .reduce((acc: number, c: AncestorCapsule) => acc + c.ancestors.length, 0);

  const visibleAdamNodesCount = result.isAlphaMergedIntoAdam
    ? totalFamilySpineNodesCount
    : codedStationsCount + unlockedIntermediateNodesCount;

  const remainingLockedCapsules = capsulesList.filter(
    (c: AncestorCapsule) => !unlockedCapsules.includes(c.id)
  );
  const remainingLockedAncestorsCount = remainingLockedCapsules.reduce(
    (acc: number, c: AncestorCapsule) => acc + c.ancestors.length,
    0
  );

  // ============================================================================
  // CONNECTOR BADGE ("من (سليل غير مباشر)" vs "بن (سليل مباشر)")
  // ============================================================================
  const renderConnectorBadge = (
    connectorType: SpineConnectorLabel = 'من (سليل غير مباشر)'
  ) => {
    const isDirectBin = connectorType === 'بن (سليل مباشر)';
    return (
      <div className="flex justify-center relative z-20 my-1">
        <div
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-display font-bold shadow-2xs border ${
            isDirectBin
              ? 'bg-[#FAF6F0] border-[#8D4925]/45 text-[#8D4925]'
              : 'bg-[#FFF8F0] border-[#D8755B]/60 text-[#D8755B]'
          }`}
        >
          <ArrowUp className="w-3 h-3" />
          <span>{connectorType}</span>
        </div>
      </div>
    );
  };

  // ============================================================================
  // 1. CLIENT NODE (Bottom of Spine - Read-Only Official Record)
  // ============================================================================
  const renderClientNode = () => (
    <div className="max-w-[420px] w-full mx-auto rounded-2xl bg-white border-2 border-[#252321] py-3 px-4 shadow-sm relative z-20 text-right">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <HeritageNodeAvatar personRole="client" size="md" />
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-[#8D4925]">
              نقطة البداية · صاحب السجل
            </div>
            <div className="text-base sm:text-lg font-display font-extrabold text-[#252321] truncate">
              {result.clientName}
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
  // 2. FATHER NODE (Rendered ONLY if fatherName is not empty)
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
                الأب المباشر
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
  // 3. GRANDFATHER NODE (Rendered ONLY if grandfatherName is not empty)
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
                الجد المباشر
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
  // 4. FAMILY STATION NODE (عقدة العائلة - بيت النسب)
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
                {getCleanSpineNodeName(result.familyName)}
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
  // 5. SINGLE LOCKED LAYER / ROOT CARD (Strictly Layer Title + Interactive Lock Icon 🔒)
  // ============================================================================
  const renderLockedLayerCard = (
    title: string,
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
      title="اضغط لفتح هذه الطبقة الموثقة"
      className="max-w-[420px] w-full mx-auto rounded-2xl bg-gradient-to-l from-[#FAF5EC] via-[#F6EFE2] to-[#EFE5D4] border border-[#B98A78]/80 hover:border-[#D8755B] py-3 px-4 shadow-2xs flex items-center justify-between gap-3 transition-all cursor-pointer group relative z-20 text-right"
    >
      <div className="flex items-center gap-3 min-w-0">
        <HeritageNodeAvatar eraOverride={era} size="sm" />
        <span className="text-xs sm:text-sm font-display font-extrabold text-[#252321] group-hover:text-[#8D4925] transition-colors truncate">
          {title}
        </span>
      </div>
      <span
        aria-label="مقفل — اضغط للفتح"
        className="w-8 h-8 rounded-full bg-white/90 group-hover:bg-[#D8755B] text-[#8D4925] group-hover:text-white border border-[#B98A78]/45 flex items-center justify-center text-sm shadow-2xs transition-colors shrink-0"
      >
        🔒
      </span>
    </div>
  );

  // ============================================================================
  // 6. SINGLE ADAM NODE CARD (Compact max-w-[420px], No Prefix Repetition, No 3rd Line)
  // ============================================================================
  const renderAdamNodeCard = (node: UpperAncestorNode) => {
    const isSubRootNode =
      node.code === 'B2' ||
      node.code === 'B1' ||
      (!node.code && node.orderNumber === 4);
    const isMotherTribeNode =
      node.code === 'B0' || (!node.code && node.orderNumber === 6);
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

    // A) Root Nodes (Sub-Branch or Mother Tribe)
    if (isRootNode) {
      return (
        <div
          key={node.id}
          onClick={() => setSelectedAncestor(node)}
          className={`max-w-[420px] w-full mx-auto rounded-2xl bg-gradient-to-br from-[#FFFDF9] via-[#FFF8F0] to-[#FFEDD5] border-2 ${
            isSelected
              ? 'border-[#D8755B] ring-2 ring-[#D8755B]/25'
              : 'border-[#E67E22]'
          } py-3 px-4 shadow-xs text-right relative z-20 overflow-hidden cursor-pointer transition-all`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <HeritageNodeAvatar node={node} size="md" />
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-[#E67E22]">
                  {isSubRootNode ? 'الفرع الجامع' : 'القبيلة الأم'}
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
  // 7. COMPACT PILL BADGE FOR INTERMEDIATE ANCESTORS (🔒 +8 أجداد)
  // ============================================================================
  const renderCompactIntermediatePillBadge = (ringGroup: AncestorCapsule) => {
    const count = ringGroup.ancestors.length;
    return (
      <div
        key={ringGroup.id}
        className="flex justify-center relative z-20 my-1"
      >
        <button
          type="button"
          onClick={() => onRequestUnlockCapsule(ringGroup)}
          title={`اضغط لإظهار أسماء الأجداد الفرعيين (${ringGroup.betweenLabel})`}
          className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#F7F2E9] hover:bg-[#EFE6D5] border border-[#E6DFD3] hover:border-[#D8755B] text-[#8D4925] text-xs font-display font-bold shadow-2xs transition-all cursor-pointer"
        >
          <span>🔒</span>
          <span>+{count} أجداد</span>
        </button>
      </div>
    );
  };

  // ============================================================================
  // 8. VIP FULL SPINE RENDERING (Top = Adam directly, quiet bar in middle)
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
  // 9. SHORT 3-NODE ALPHA-ONLY SPINE (Before Researcher Merge)
  // ============================================================================
  const renderAlphaOnlyBeforeMergeSpine = () => {
    const subBranchNode =
      spineNodes.find((n: UpperAncestorNode) => n.orderNumber === 2) ||
      spineNodes[1];
    const motherTribeNode =
      spineNodes.find((n: UpperAncestorNode) => n.orderNumber === 3) ||
      spineNodes[2];

    return (
      <div className="space-y-2.5 relative z-20">
        {!caps.isRootUnlocked ? (
          renderLockedLayerCard(
            'نقطة الربط بالجذر',
            'major_tribe',
            onUnlockRoot5Usd,
            'root-unlock-5usd-card'
          )
        ) : (
          <div className="space-y-2">
            {motherTribeNode && renderAdamNodeCard(motherTribeNode)}

            {motherTribeNode &&
              subBranchNode &&
              subBranchNode.id !== motherTribeNode.id &&
              renderConnectorBadge(
                resolveSpineConnectorLabel(subBranchNode, motherTribeNode, false)
              )}

            {subBranchNode &&
              subBranchNode.id !== motherTribeNode?.id &&
              renderAdamNodeCard(subBranchNode)}
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // 10. NON-VIP SPINE FOR FULL ADAM CHAINS (Free Stage 1 & $5 Basic Stage 2)
  // ============================================================================
  const renderNonVipSpineAboveFamily = () => {
    const subRootStation =
      spineNodes.find(
        (n: UpperAncestorNode) => n.code === 'B2' || n.code === 'B1'
      ) || spineNodes[1];
    const motherTribeStation =
      spineNodes.find((n: UpperAncestorNode) => n.code === 'B0') ||
      spineNodes[2] ||
      spineNodes[spineNodes.length - 1];

    return (
      <div className="space-y-2.5 relative z-20">
        {/* Locked Upper Lineage Layers (Concise layer title + lock icon 🔒 only) */}
        {LOCKED_UPPER_LINEAGE_LAYERS.map((layerItem) => (
          <React.Fragment key={layerItem.id}>
            {renderLockedLayerCard(
              layerItem.label,
              layerItem.era,
              onUpgradeAnnualVip
            )}
          </React.Fragment>
        ))}

        {renderConnectorBadge('من (سليل غير مباشر)')}

        {/* THE ROOT SECTION: Locked Root Card in Stage 1, Unlocked Root Nodes in Stage 2 */}
        {!caps.isRootUnlocked ? (
          renderLockedLayerCard(
            'نقطة الربط بالجذر',
            'major_tribe',
            onUnlockRoot5Usd,
            'root-unlock-5usd-card'
          )
        ) : (
          <div className="space-y-2 relative z-20">
            {motherTribeStation && renderAdamNodeCard(motherTribeStation)}

            {motherTribeStation &&
              subRootStation &&
              subRootStation.id !== motherTribeStation.id &&
              renderConnectorBadge('من (سليل غير مباشر)')}

            {subRootStation &&
              subRootStation.id !== motherTribeStation?.id &&
              renderAdamNodeCard(subRootStation)}
          </div>
        )}
      </div>
    );
  };

  const firstRingId = capsulesList[0]?.id;
  const isFirstRingUnlocked = firstRingId
    ? unlockedCapsules.includes(firstRingId)
    : true;

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
                عمود نسب عائلة {result.familyName} الموثق
              </h2>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#D8755B]/15 text-[#D8755B]">
                {caps.isVip
                  ? `${visibleAdamNodesCount} عقدة مفتوحة من أصل ${totalFamilySpineNodesCount}`
                  : caps.isRootUnlocked
                  ? `نقطة الربط مفتوحة (${getCleanSpineNodeName(result.rootBranchName)} · ${getCleanSpineNodeName(result.rootTribeName)})`
                  : 'نتيجة الفحص: تطابق موثق ✓'}
              </span>
            </div>
            <p className="text-xs text-[#252321]/70 mt-1">
              السلسلة التاريخية الموثقة لعائلة {result.familyName}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {caps.isVip &&
              !result.isAlphaMergedIntoAdam &&
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

            {caps.isVip && (
              <span className="text-xs font-bold text-[#252321] bg-white border border-[#B98A78]/45 px-3 py-1.5 rounded-xl">
                💳 المحفظة: ${walletBalance.toFixed(2)}
              </span>
            )}
          </div>
        </div>

        {/* Centered Vertical Pedigree Spine (Ascending Bottom-to-Top) */}
        <div className="relative py-4 min-h-[420px]">
          <div
            className="absolute left-1/2 -translate-x-1/2 top-4 bottom-4 w-0.5 bg-gradient-to-t from-[#252321]/30 via-[#D8755B]/40 to-[#8D4925]/30 rounded-full pointer-events-none"
            aria-hidden="true"
          />

          <div className="space-y-2">
            {result.isAlphaOnlyBeforeMerge
              ? renderAlphaOnlyBeforeMergeSpine()
              : caps.isVip
              ? renderVipFullAdamSpine()
              : renderNonVipSpineAboveFamily()}

            {/* Connector above Family Station */}
            {renderConnectorBadge(
              resolveSpineConnectorLabel(
                spineNodes[0],
                spineNodes[1] || null,
                !result.isAlphaOnlyBeforeMerge &&
                  (!caps.isVip ||
                    (!result.isAlphaMergedIntoAdam && !isFirstRingUnlocked))
              )
            )}

            {/* Family Station Node (بيت النسب) */}
            {renderFamilyStationNode()}

            {/* Connector between topmost Personal Card and Family Station Node */}
            {renderConnectorBadge(
              resolveSpineConnectorLabel(
                {
                  name: grandfatherName || fatherName || result.clientName,
                  representation: 'INDIVIDUAL',
                  relation_type: 'DIRECT_DESCENDANT',
                  relation_nature: 'INDIRECT',
                },
                spineNodes[0],
                true
              )
            )}

            {/* Grandfather Node (ONLY rendered if grandfatherName is provided) */}
            {grandfatherName && (
              <>
                {renderGrandfatherNode()}
                {renderConnectorBadge(
                  resolveSpineConnectorLabel(
                    {
                      name: fatherName || result.clientName,
                      representation: 'INDIVIDUAL',
                      relation_type: 'DIRECT_CHILD_OF',
                      relation_nature: 'DIRECT',
                    },
                    {
                      name: grandfatherName || 'الجد',
                      representation: 'INDIVIDUAL',
                      relation_type: 'DIRECT_DESCENDANT',
                      relation_nature: 'INDIRECT',
                    },
                    !fatherName
                  )
                )}
              </>
            )}

            {/* Father Node (ONLY rendered if fatherName is provided) */}
            {fatherName && (
              <>
                {renderFatherNode()}
                {renderConnectorBadge(
                  resolveSpineConnectorLabel(
                    {
                      name: result.clientName,
                      representation: 'INDIVIDUAL',
                      relation_type: 'DIRECT_CHILD_OF',
                      relation_nature: 'DIRECT',
                    },
                    {
                      name: fatherName || 'الأب',
                      representation: 'INDIVIDUAL',
                      relation_type: 'DIRECT_CHILD_OF',
                      relation_nature: 'DIRECT',
                    },
                    false
                  )
                )}
              </>
            )}

            {/* Client Node at Bottom */}
            {renderClientNode()}
          </div>
        </div>

        {/* ======================================================== */}
        {/* VERIFIED HISTORICAL SOURCES CARD                         */}
        {/* ======================================================== */}
        <div className="mt-10 pt-6 border-t border-[#B98A78]/35 max-w-2xl mx-auto w-full relative z-20">
          {!caps.isVip ? (
            <div
              onClick={onUpgradeAnnualVip}
              className="rounded-2xl bg-gradient-to-br from-[#FAF5EC] via-[#F6EFE2] to-[#EFE4D2] border border-[#B98A78] hover:border-[#D8755B] py-3.5 px-4 shadow-2xs hover:shadow-sm transition-all cursor-pointer group text-right flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#8D4925] via-[#B98A78] to-[#D8755B] text-[#FAF6F0] border border-[#F3D299] flex items-center justify-center shrink-0">
                  <BookOpenCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-display font-extrabold text-[#252321] group-hover:text-[#8D4925] transition-colors truncate">
                    المصادر والمراجع التاريخية الموثقة لعائلة {result.familyName}
                  </h3>
                </div>
              </div>
              <span className="w-8 h-8 rounded-full bg-white/90 group-hover:bg-[#D8755B] text-[#8D4925] group-hover:text-white border border-[#B98A78]/45 flex items-center justify-center text-sm shadow-2xs transition-colors shrink-0">
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
                        بطاقة المصادر والمراجع التاريخية المعتمدة
                      </h3>
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#EDE6DA] text-[#8D4925]">
                        ✓ إسناد مصدري موثق
                      </span>
                    </div>
                    <p className="text-xs text-[#8D4925] font-semibold mt-0.5">
                      «{result.verifiedSourceCitation}»
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-[#8D4925] px-3 py-1.5 rounded-xl bg-[#8D4925]/10 shrink-0">
                  {showSourceDetails ? 'إخفاء التفاصيل ▲' : 'عرض التفاصيل ▼'}
                </span>
              </button>

              {showSourceDetails && (
                <div className="pt-4 border-t border-[#B98A78]/30 space-y-4">
                  <div>
                    <div className="text-xs font-display font-bold text-[#252321] mb-1.5">
                      المحطات الرئيسية الموثقة لعائلة {result.familyName}:
                    </div>
                    <p className="text-xs sm:text-sm text-[#252321]/85 leading-relaxed bg-[#FAF6F0] p-3.5 rounded-2xl border border-[#B98A78]/25 font-serif">
                      {spineNodes
                        .filter((n: UpperAncestorNode) => n.isCodedStation)
                        .map((n: UpperAncestorNode) => n.name)
                        .join(' ➔ ')}
                      .
                    </p>
                  </div>

                  {result.secondarySources && result.secondarySources.length > 0 && (
                    <div className="rounded-2xl bg-[#FAF6F0] border border-[#8D4925]/30 p-3.5 space-y-1.5">
                      <div className="text-xs font-display font-bold text-[#8D4925]">
                        المصادر والمراجع التاريخية المعتمدة للسلسلة:
                      </div>
                      <ul className="space-y-1 text-xs text-[#252321]/85 list-disc list-inside">
                        {result.secondarySources.map((src: string, i: number) => (
                          <li key={i}>{src}</li>
                        ))}
                      </ul>
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
      </div>
    </div>
  );
};
