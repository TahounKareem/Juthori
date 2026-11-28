import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Crown,
  FileText,
  Layers,
  Link2,
  Loader2,
  Lock,
  Paperclip,
  ScrollText,
  SlidersHorizontal,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import {
  UnifiedWorkspaceHeader,
  WORKSPACE_ICON_ACTIVE_BTN_CLASS,
  WORKSPACE_ICON_BTN_CLASS,
  WORKSPACE_PRIMARY_ICON_BTN_CLASS,
  WorkspaceIconTooltip,
} from './UnifiedWorkspaceHeader';
import { JUTHORI_SERVICE_ICONS } from '../config/serviceIcons';
import {
  SUBSCRIPTION_FOOTNOTES,
  SUBSCRIPTION_PLANS,
  formatPlanPriceUsd,
} from '../config/subscriptionPlans';
import type { UpgradePromptRequest } from './UpgradeToPremiumModal';
import {
  AccountLegalType,
  AncestorCapsule,
  DashboardStateMode,
  FreeLeadRadarSignal,
  LineageConnectionDecisionStatus,
  LineageSearchResult,
  UpperAncestorNode,
  VerifiedAddonSourceItem,
} from '../types/juthori';
import {
  buildResolvedLineageFromDisambiguationOption,
  extractUnifiedVerifiedSourcesList,
  getDashboardCapabilities,
  getVerifiedAddonSourcesForEvidence,
  isBannedMacroApexForRoot,
  isHighApexStopNode,
  mergeVerifiedAddonSourceLists,
} from '../utils/lineageEngine';
import {
  HeritageNodeAvatar,
  ExtendedEraType,
  resolveNodeHistoricalEra,
  getHistoricalEraBadgeLabel,
} from './HeritageNodeAvatar';
import { OfficialBrandedExportModal } from './OfficialBrandedExportModal';
import { ExportPosterOptions } from '../utils/brandedExport';
import {
  DEFAULT_POSTER_SETTINGS,
  JUTHORI_SHARED_VISUAL_SYNC_EVENT,
  SharedVisualSyncEventDetail,
  TreeDisplaySettings,
  dispatchSharedVisualAppearanceSync,
  normalizeTreeDisplaySettings,
  readSharedTreeDisplaySettingsFromLocal,
  readSharedVisualAppearanceFromLocal,
  writeSharedTreeDisplaySettingsToLocal,
} from '../utils/treeStudioConfig';
import {
  DEFAULT_STARTER_VAULT_FOLDERS,
  DIRECT_FAMILY_VAULT_NODE_ID,
  FamilyVaultMediaItem,
  VaultFolderRecord,
  fetchUserLineageStudioPrefsFromFirebase,
  fetchUserTreeDisplaySettingsFromFirebase,
  fetchUserVaultArchive,
  readVaultArchiveFromLocal,
  saveUserLineageStudioPrefsToFirebase,
  saveUserTreeDisplaySettingsToFirebase,
  saveUserVaultArchive,
} from '../services/firestoreService';
import {
  processMediaFileForUpload,
  uploadMediaToCloudWithFallback,
} from '../utils/mediaPipeline';
import {
  DEFAULT_LINEAGE_STUDIO_PREFS,
  LineageEntityKind,
  LineageStudioPrefs,
  NasabNarrationNodeInput,
  buildClassicalArabicNasabNarration,
  classifyUpperAncestorEntityKind,
  getLineageCanvasBackdropStyle,
  getLineageFont,
  getLineageTheme,
  loadLineageStudioPrefsFromLocal,
  normalizeLineageStudioPrefs,
  resolveSemanticLineageConnector,
  saveLineageStudioPrefsToLocal,
} from '../utils/lineageStudioConfig';
import {
  ClassicalNasabNarrationBar,
  LineageCanvasFloatingControls,
  LineageCustomizationPanel,
  LuxuryReferenceLibrary,
} from './LineageStudioParts';
import { UnifiedLineageNameplate } from './UnifiedLineageNameplate';

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
  onSelectVerificationPath?: (
    optionId: 'option_a' | 'option_b' | 'option_c'
  ) => void;
  onEscalateVerificationToTicket?: () => void;
  unlockedAddonSourceIds?: string[];
  onUnlockVerifiedAddonSource?: (
    addon: VerifiedAddonSourceItem
  ) => Promise<boolean> | boolean | void;
  onResyncLineage?: () => void;
  isResyncingLineage?: boolean;
  onCreateResearchTicket?: (
    reasonType:
      | 'unmatched_family'
      | 'geographic_disambiguation'
      | 'deep_archival_verification'
  ) => void;
  userId?: string;
  userEmail?: string;
  onOpenVaultForPerson?: (personId: string) => void;
  onOpenResearchTicketsTab?: () => void;
  onSignCharterAndEnableTree?: () => void;
  onRequirePremiumAction?: (req: UpgradePromptRequest) => void;
  onLogActivity?: (action: string, detail: string) => void;
  freeLeadRadarSignal?: FreeLeadRadarSignal | null;
  lineageResearchStatus?: LineageConnectionDecisionStatus;
  lineageResearchStatusNote?: string;
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

// Unified internal spine item model supporting all 4 View Modes and both reading directions
type UnifiedSpineItem =
  | {
      id: string;
      kind: 'ancestor_node';
      node: UpperAncestorNode;
      entityKind: LineageEntityKind;
      isRoot: boolean;
      isSubRoot: boolean;
      isMotherTribe: boolean;
      isSummit: boolean;
      isIntermediate: boolean;
    }
  | {
      id: string;
      kind: 'capsule_pill';
      ringGroup: AncestorCapsule;
      entityKind: 'capsule';
    }
  | {
      id: string;
      kind: 'locked_layer';
      layerId: string;
      label: string;
      marketingSubtitle: string;
      era: ExtendedEraType;
      entityKind: 'locked';
    }
  | {
      id: string;
      kind: 'intermediate_toggle';
      mode: 'unlock_bundle' | 'fold_toggle';
      count: number;
      entityKind: 'capsule';
    }
  | {
      id: string;
      kind: 'direct_family';
      entityKind: 'family';
    }
  | {
      id: string;
      kind: 'grandfather';
      name: string;
      entityKind: 'person';
    }
  | {
      id: string;
      kind: 'father';
      name: string;
      entityKind: 'person';
    }
  | {
      id: string;
      kind: 'client';
      name: string;
      entityKind: 'person';
    };

/**
 * Corner ornament SVG for Heritage Scroll Charter mode
 */
const HeritageCornerOrnament: React.FC<{
  color: string;
  positionClass: string;
  flipX?: boolean;
  flipY?: boolean;
}> = ({ color, positionClass, flipX = false, flipY = false }) => (
  <svg
    viewBox="0 0 64 64"
    width="44"
    height="44"
    aria-hidden="true"
    className={`pointer-events-none select-none absolute ${positionClass} opacity-75`}
    style={{
      transform: `scale(${flipX ? -1 : 1}, ${flipY ? -1 : 1})`,
    }}
  >
    <path
      d="M4 4 H56 M4 4 V56 M10 10 H44 M10 10 V44 M10 10 L26 26 M26 10 Q18 18 10 26 M36 10 Q24 24 10 36"
      fill="none"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <circle cx="18" cy="18" r="2.5" fill={color} />
  </svg>
);

export const LineageSpineColumn: React.FC<LineageSpineColumnProps> = ({
  stateMode,
  accountType,
  result,
  onUnlockRoot5Usd,
  onUpgradeAnnualVip,
  onRequirePremiumAction,
  unlockedCapsules,
  onRequestUnlockCapsule,
  onRequestUnlockAllCapsulesBundle,
  walletBalance,
  onOpenMyTreeTab,
  userAvatarUrl,
  isResearcherDirectPreview = false,
  onSelectVerificationPath,
  onEscalateVerificationToTicket,
  unlockedAddonSourceIds = [],
  onUnlockVerifiedAddonSource,
  userId,
  userEmail,
  onOpenVaultForPerson,
  onOpenResearchTicketsTab,
  onSignCharterAndEnableTree,
  onLogActivity,
  freeLeadRadarSignal = null,
  lineageResearchStatus,
  lineageResearchStatusNote,
}) => {
  const caps = getDashboardCapabilities(stateMode, accountType);
  const [selectedAncestor, setSelectedAncestor] =
    useState<UpperAncestorNode | null>(null);
  const [showOfficialExportModal, setShowOfficialExportModal] =
    useState<boolean>(false);
  const [isFollowUpNoteOpen, setIsFollowUpNoteOpen] = useState<boolean>(false);
  const [showDirectFamilyVaultModal, setShowDirectFamilyVaultModal] =
    useState<boolean>(false);
  const [localUnlockedAddonIds, setLocalUnlockedAddonIds] = useState<string[]>(
    []
  );
  const [processingAddonKey, setProcessingAddonKey] = useState<string | null>(
    null
  );
  const [localWalletDeduction, setLocalWalletDeduction] = useState<number>(0);
  const [addonWalletWarning, setAddonWalletWarning] = useState<string | null>(
    null
  );

  // ============================================================================
  // STUDIO PREFERENCES (4 View Modes, Direction, 5 Themes, 3 Fonts, 3 Backdrops)
  // Auto-saved to localStorage & Firestore workspace profile
  // ============================================================================
  const [studioPrefs, setStudioPrefs] = useState<LineageStudioPrefs>(() => {
    const localLineage = loadLineageStudioPrefsFromLocal(userId);
    const sharedVisual = readSharedVisualAppearanceFromLocal(
      userId,
      result.familyName
    );
    if (!sharedVisual) return localLineage;
    return normalizeLineageStudioPrefs({
      ...localLineage,
      themeId: sharedVisual.cardTheme,
      fontId: sharedVisual.fontFamily,
      backdropId: sharedVisual.canvasBackground,
      avatarStyle: sharedVisual.avatarStyle || localLineage.avatarStyle,
    });
  });
  const [isCustomizerOpen, setIsCustomizerOpen] = useState<boolean>(false);
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const panOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  panOffsetRef.current = panOffset;
  const [isCanvasDragging, setIsCanvasDragging] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [foldUnlockedIntermediates, setFoldUnlockedIntermediates] =
    useState<boolean>(false);
  const panoramicScrollRef = useRef<HTMLDivElement | null>(null);
  const canvasTopRef = useRef<HTMLDivElement | null>(null);
  const lineageCanvasViewportRef = useRef<HTMLDivElement | null>(null);
  const lineageDragPanRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
    panX: number;
    panY: number;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
    panX: 0,
    panY: 0,
  });

  // Sync preferences from unified cloud Single Source of Truth on mount/user change
  useEffect(() => {
    const localLoaded = loadLineageStudioPrefsFromLocal(userId);
    const sharedLocal = readSharedVisualAppearanceFromLocal(
      userId,
      result.familyName
    );
    const mergedInitial = normalizeLineageStudioPrefs(
      sharedLocal
        ? {
            ...localLoaded,
            themeId: sharedLocal.cardTheme,
            fontId: sharedLocal.fontFamily,
            backdropId: sharedLocal.canvasBackground,
            avatarStyle: sharedLocal.avatarStyle || localLoaded.avatarStyle,
          }
        : localLoaded
    );
    setStudioPrefs(mergedInitial);
    if (!userId || isResearcherDirectPreview) return;
    let mounted = true;
    Promise.all([
      fetchUserLineageStudioPrefsFromFirebase<Partial<LineageStudioPrefs>>(
        userId,
        userEmail
      ).catch(() => null),
      fetchUserTreeDisplaySettingsFromFirebase<Partial<TreeDisplaySettings>>(
        userId,
        userEmail
      ).catch(() => null),
    ]).then(([cloudLineagePrefs, cloudTreeDisplay]) => {
      if (!mounted) return;
      if (!cloudLineagePrefs && !cloudTreeDisplay) return;
      const baseLineage = cloudLineagePrefs
        ? normalizeLineageStudioPrefs(cloudLineagePrefs)
        : mergedInitial;
      if (cloudTreeDisplay) {
        const normalizedTree = normalizeTreeDisplaySettings(cloudTreeDisplay);
        const synced = normalizeLineageStudioPrefs({
          ...baseLineage,
          themeId: normalizedTree.cardTheme,
          fontId: normalizedTree.fontFamily,
          backdropId: normalizedTree.canvasBackground,
          avatarStyle: normalizedTree.avatarStyle,
        });
        setStudioPrefs(synced);
        saveLineageStudioPrefsToLocal(userId, synced);
        writeSharedTreeDisplaySettingsToLocal(
          userId,
          result.familyName,
          normalizedTree
        );
      } else {
        setStudioPrefs(baseLineage);
        saveLineageStudioPrefsToLocal(userId, baseLineage);
      }
    });
    return () => {
      mounted = false;
    };
  }, [userId, userEmail, result.familyName, isResearcherDirectPreview]);

  // Listen to real-time visual theme/font/backdrop/avatar updates from «شجرتي»
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleVisualSync = (evt: Event) => {
      const detail = (evt as CustomEvent<SharedVisualSyncEventDetail>).detail;
      if (!detail || detail.source === 'lineage') return;
      if (detail.userId && userId && detail.userId !== userId) return;
      setStudioPrefs((prev) => {
        const next = normalizeLineageStudioPrefs({
          ...prev,
          themeId: detail.appearance.cardTheme,
          fontId: detail.appearance.fontFamily,
          backdropId: detail.appearance.canvasBackground,
          avatarStyle: detail.appearance.avatarStyle || prev.avatarStyle,
        });
        saveLineageStudioPrefsToLocal(userId, next);
        return next;
      });
    };
    window.addEventListener(JUTHORI_SHARED_VISUAL_SYNC_EVENT, handleVisualSync);
    return () =>
      window.removeEventListener(
        JUTHORI_SHARED_VISUAL_SYNC_EVENT,
        handleVisualSync
      );
  }, [userId]);

  // Escape key exits Majlis Fullscreen Mode
  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen]);

  const updateStudioPrefs = (patch: Partial<LineageStudioPrefs>) => {
    setStudioPrefs((prev) => {
      const next = normalizeLineageStudioPrefs({ ...prev, ...patch });
      saveLineageStudioPrefsToLocal(userId, next);

      const visualChanged =
        patch.themeId !== undefined ||
        patch.fontId !== undefined ||
        patch.backdropId !== undefined ||
        patch.avatarStyle !== undefined;

      if (visualChanged) {
        const currentTreeSettings = readSharedTreeDisplaySettingsFromLocal(
          userId,
          result.familyName
        );
        const syncedTreeSettings = normalizeTreeDisplaySettings({
          ...currentTreeSettings,
          cardTheme: next.themeId,
          fontFamily: next.fontId,
          canvasBackground: next.backdropId,
          avatarStyle: next.avatarStyle,
        });
        writeSharedTreeDisplaySettingsToLocal(
          userId,
          result.familyName,
          syncedTreeSettings
        );
        dispatchSharedVisualAppearanceSync({
          source: 'lineage',
          userId,
          familyName: result.familyName,
          appearance: {
            cardTheme: syncedTreeSettings.cardTheme,
            fontFamily: syncedTreeSettings.fontFamily,
            canvasBackground: syncedTreeSettings.canvasBackground,
            avatarStyle: syncedTreeSettings.avatarStyle,
          },
          displaySettings: syncedTreeSettings,
        });
        if (userId && !isResearcherDirectPreview) {
          saveUserTreeDisplaySettingsToFirebase(
            userId,
            result.familyName,
            syncedTreeSettings as unknown as Record<string, unknown>,
            userEmail
          ).catch(() => {});
        }
      }

      if (userId && !isResearcherDirectPreview) {
        saveUserLineageStudioPrefsToFirebase(
          userId,
          result.familyName,
          next as unknown as Record<string, unknown>,
          userEmail
        ).catch(() => {});
      }
      return next;
    });
  };

  const resetStudioPrefs = () => {
    updateStudioPrefs(DEFAULT_LINEAGE_STUDIO_PREFS);
    setZoomScale(1);
  };

  const theme = useMemo(
    () => getLineageTheme(studioPrefs.themeId),
    [studioPrefs.themeId]
  );
  const fontDef = useMemo(
    () => getLineageFont(studioPrefs.fontId),
    [studioPrefs.fontId]
  );
  const canvasBackdropStyle = useMemo(
    () => getLineageCanvasBackdropStyle(studioPrefs.backdropId, theme),
    [studioPrefs.backdropId, theme]
  );

  // Progressive 2-Stage Verification State
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

  useEffect(() => {
    setVerificationStage(1);
    setStage1Choice('option_a');
    setStage2Choice('option_a');
    setLocalResolvedOption(null);
  }, [result.familyName]);

  // Effective result after local or parent verification path selection
  const effectiveResult: LineageSearchResult = useMemo(() => {
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
        result.disambiguationOptions?.find(
          (o) => o.id === localResolvedOption
        ) ||
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
    caps.isRootUnlocked &&
    !isResearcherDirectPreview &&
    localResolvedOption === null;

  const fatherName = cleanOptionalParentName(effectiveResult.fatherName);
  const grandfatherName = cleanOptionalParentName(
    effectiveResult.grandfatherName
  );
  const clientDisplayName = (
    effectiveResult.clientName ||
    result.clientName ||
    ''
  ).trim();

  const isUnmatchedCase =
    !effectiveResult.matched || localResolvedOption === 'escalated_ticket';

  const spineNodes: UpperAncestorNode[] = useMemo(() => {
    const rawNodes =
      isResearcherDirectPreview &&
      effectiveResult.full_stitched_lineage_for_researcher &&
      effectiveResult.full_stitched_lineage_for_researcher.length > 0
        ? effectiveResult.full_stitched_lineage_for_researcher
        : effectiveResult.adamSpineNodes &&
          effectiveResult.adamSpineNodes.length > 0
        ? effectiveResult.adamSpineNodes
        : effectiveResult.upperAncestors || [];

    if (isUnmatchedCase) {
      return rawNodes;
    }

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

  // Two-Way Vault Sync for Direct Family (`العائلة المباشرة`)
  const initialVaultForSpine = useMemo(
    () =>
      readVaultArchiveFromLocal(
        userId,
        effectiveResult.familyName,
        userEmail
      ),
    [userId, effectiveResult.familyName, userEmail]
  );
  const [vaultFolders, setVaultFolders] = useState<VaultFolderRecord[]>(
    initialVaultForSpine.folders.length > 0
      ? initialVaultForSpine.folders
      : DEFAULT_STARTER_VAULT_FOLDERS
  );
  const [vaultItems, setVaultItems] = useState<FamilyVaultMediaItem[]>(
    initialVaultForSpine.items
  );
  const [familyVaultUploadTitle, setFamilyVaultUploadTitle] =
    useState<string>('');
  const [familyVaultUploadFolderId, setFamilyVaultUploadFolderId] =
    useState<string>('folder_ancestors');
  const [isUploadingFamilyVault, setIsUploadingFamilyVault] =
    useState<boolean>(false);
  const [familyVaultFeedback, setFamilyVaultFeedback] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (isResearcherDirectPreview) return;
    let mounted = true;
    fetchUserVaultArchive(userId, effectiveResult.familyName, userEmail).then(
      (archive) => {
        if (!mounted) return;
        setVaultFolders(
          archive.folders.length > 0
            ? archive.folders
            : DEFAULT_STARTER_VAULT_FOLDERS
        );
        setVaultItems(archive.items);
      }
    );
    const onVaultUpdated = () => {
      const latest = readVaultArchiveFromLocal(
        userId,
        effectiveResult.familyName,
        userEmail
      );
      setVaultFolders(
        latest.folders.length > 0
          ? latest.folders
          : DEFAULT_STARTER_VAULT_FOLDERS
      );
      setVaultItems(latest.items);
    };
    window.addEventListener('juthori:vault-updated', onVaultUpdated);
    return () => {
      mounted = false;
      window.removeEventListener('juthori:vault-updated', onVaultUpdated);
    };
  }, [
    userId,
    effectiveResult.familyName,
    userEmail,
    isResearcherDirectPreview,
  ]);

  const directFamilyMediaCount = useMemo(
    () =>
      vaultItems.filter((vi) =>
        vi.linkedPersonIds.includes(DIRECT_FAMILY_VAULT_NODE_ID)
      ).length,
    [vaultItems]
  );
  void directFamilyMediaCount;

  const handleToggleVaultItemForDirectFamily = (itemId: string) => {
    const nextItems = vaultItems.map((it) => {
      if (it.id !== itemId) return it;
      const already = it.linkedPersonIds.includes(DIRECT_FAMILY_VAULT_NODE_ID);
      return {
        ...it,
        linkedPersonIds: already
          ? it.linkedPersonIds.filter((id) => id !== DIRECT_FAMILY_VAULT_NODE_ID)
          : [...it.linkedPersonIds, DIRECT_FAMILY_VAULT_NODE_ID],
      };
    });
    setVaultItems(nextItems);
    saveUserVaultArchive(
      userId,
      effectiveResult.familyName,
      {
        folders: vaultFolders,
        items: nextItems,
      },
      userEmail
    ).catch(() => {});
  };

  const handleUploadDirectFamilyVaultFile = async (
    fileList: FileList | null
  ) => {
    if (!fileList || fileList.length === 0) return;
    setFamilyVaultFeedback(null);
    if (
      caps.maxVaultDocuments !== null &&
      vaultItems.length + 1 > caps.maxVaultDocuments
    ) {
      setFamilyVaultFeedback(
        `وصلت إلى الحد الأقصى لوثائق الخزانة في باقتك الحالية (${caps.maxVaultDocuments} ملفات). يمكنك الترقية لزيادة السعة.`
      );
      return;
    }

    const file = fileList[0];
    setIsUploadingFamilyVault(true);
    try {
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      const isDoc =
        file.type.includes('pdf') ||
        /وثيقة|صك|حجة|عقد|شهادة|مخطوط/i.test(baseName);
      const processed = await processMediaFileForUpload(
        file,
        isDoc ? 'vault_document' : 'vault_photo'
      );
      const newItemId = `vault_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 6)}`;
      const cloudRes = await uploadMediaToCloudWithFallback({
        uid: userId,
        category: 'vault',
        itemId: newItemId,
        mainDataUrl: processed.mainDataUrl,
        thumbnailDataUrl: processed.thumbnailDataUrl,
        mimeType: processed.mimeType,
      });

      const cleanFam = getCleanSpineNodeName(effectiveResult.familyName);
      const newItem: FamilyVaultMediaItem = {
        id: newItemId,
        title:
          familyVaultUploadTitle.trim() ||
          baseName ||
          `وثيقة عائلة ${cleanFam}`,
        mediaType: isDoc ? 'document' : 'photo',
        folderId:
          familyVaultUploadFolderId ||
          (isDoc ? 'folder_docs' : 'folder_ancestors'),
        dateOrOccasion: 'أرشيف العائلة المباشرة',
        fileDataUrl: cloudRes.url,
        thumbnailDataUrl: cloudRes.thumbnailUrl || processed.thumbnailDataUrl,
        storagePath: cloudRes.storagePath,
        storageProvider: cloudRes.provider,
        fileName: file.name,
        fileMimeType: processed.mimeType || file.type || 'image/jpeg',
        linkedPersonIds: [DIRECT_FAMILY_VAULT_NODE_ID],
        enhanced: false,
        createdAt: new Date().toISOString(),
      };

      const nextItems = [newItem, ...vaultItems];
      setVaultItems(nextItems);
      await saveUserVaultArchive(
        userId,
        effectiveResult.familyName,
        {
          folders: vaultFolders,
          items: nextItems,
        },
        userEmail
      );
      setFamilyVaultUploadTitle('');
      onLogActivity?.(
        'رفع ملف للعائلة المباشرة من عمود النسب',
        `إيداع «${newItem.title}» في الخزانة وربطه بالعائلة المباشرة (${cleanFam})`
      );
      setShowDirectFamilyVaultModal(false);
    } catch {
      setFamilyVaultFeedback(
        'تعذر قراءة الملف المرفوع، يرجى تجربة صورة أو PDF آخر.'
      );
    } finally {
      setIsUploadingFamilyVault(false);
    }
  };

  // ============================================================================
  // HELPER: STRICT TWO ROOT STATIONS FOR $5 TIER
  // ============================================================================
  const resolveStrictTwoRootStationsFor5UsdTier = () => {
    const nodesAboveFamily = spineNodes.filter((n) => n.orderNumber > 1);
    const nonMacroAboveFamily = nodesAboveFamily.filter(
      (n) => !isBannedMacroApexForRoot(n.name) && !isHighApexStopNode(n.name)
    );

    const subRootCandidate =
      nonMacroAboveFamily.find((n) => n.code === 'B2' || n.code === 'B1') ||
      nonMacroAboveFamily[0] ||
      nodesAboveFamily[0];

    const motherTribeCandidate =
      nonMacroAboveFamily.find(
        (n) =>
          n.code === 'B0' &&
          (!subRootCandidate || n.orderNumber > subRootCandidate.orderNumber)
      ) ||
      nonMacroAboveFamily
        .slice()
        .reverse()
        .find(
          (n) =>
            !subRootCandidate || n.orderNumber > subRootCandidate.orderNumber
        ) ||
      nodesAboveFamily
        .slice()
        .reverse()
        .find(
          (n) =>
            !subRootCandidate || n.orderNumber > subRootCandidate.orderNumber
        ) ||
      subRootCandidate;

    const subRootStation: UpperAncestorNode | undefined = subRootCandidate
      ? {
          ...subRootCandidate,
          code:
            motherTribeCandidate &&
            motherTribeCandidate.id !== subRootCandidate.id
              ? 'B2'
              : 'B0',
        }
      : undefined;

    const motherTribeStation: UpperAncestorNode | undefined =
      motherTribeCandidate
        ? {
            ...motherTribeCandidate,
            code: 'B0',
          }
        : undefined;

    const intermediateBetweenB2AndB0 =
      subRootStation &&
      motherTribeStation &&
      motherTribeStation.orderNumber > subRootStation.orderNumber + 1
        ? nodesAboveFamily.filter(
            (n) =>
              n.orderNumber > subRootStation.orderNumber &&
              n.orderNumber < motherTribeStation.orderNumber
          )
        : [];

    const existingCapsuleBetweenB2AndB0 = capsulesList.find(
      (c) =>
        subRootStation &&
        motherTribeStation &&
        c.ancestors.some(
          (a) =>
            a.orderNumber > subRootStation.orderNumber &&
            a.orderNumber < motherTribeStation.orderNumber
        )
    );

    const capsuleBetweenB2AndB0: AncestorCapsule | undefined =
      existingCapsuleBetweenB2AndB0 ||
      (intermediateBetweenB2AndB0.length > 0 &&
      subRootStation &&
      motherTribeStation
        ? {
            id: `strict-between-b2-b0-${subRootStation.id}`,
            number: 1,
            title: `حلقات الأجداد الوسيطين (بين ${subRootStation.name} و${motherTribeStation.name})`,
            betweenFromOrder: subRootStation.orderNumber,
            betweenToOrder: motherTribeStation.orderNumber,
            betweenLabel: `بين ${subRootStation.name} و${motherTribeStation.name}`,
            priceUsd:
              intermediateBetweenB2AndB0.length >= 6
                ? 4
                : intermediateBetweenB2AndB0.length >= 4
                ? 3
                : 2,
            ancestors: intermediateBetweenB2AndB0,
          }
        : undefined);

    return {
      subRootStation,
      motherTribeStation,
      capsuleBetweenB2AndB0,
    };
  };

  // ============================================================================
  // UNIFIED ORDERED CHAIN BUILDER (Top-Down Historical Array)
  // Preserves 100% of Case 1, Case 2, Case 3, $5 Paywall, VIP, & Researcher rules
  // ============================================================================
  const toAncestorItem = (
    node: UpperAncestorNode,
    isIntermediate: boolean
  ): UnifiedSpineItem => {
    const isSubRoot =
      node.code === 'B2' ||
      node.code === 'B1' ||
      (!node.code &&
        node.orderNumber === 4 &&
        node.dataLakeSource !== 'alpha_projects');
    const isMotherTribe =
      node.code === 'B0' ||
      (!node.code &&
        node.orderNumber === 6 &&
        node.dataLakeSource !== 'alpha_projects');
    const isSummit =
      node.code === 'AD0' ||
      node.name.includes('آدم عليه السلام') ||
      (node.orderNumber === spineNodes.length && spineNodes.length > 10);
    return {
      id: node.id,
      kind: 'ancestor_node',
      node,
      entityKind: classifyUpperAncestorEntityKind(node),
      isRoot: isSubRoot || isMotherTribe,
      isSubRoot,
      isMotherTribe,
      isSummit,
      isIntermediate,
    };
  };

  const hasLineageConnectionAccess = Boolean(
    caps.isRootUnlocked || caps.isVip || isResearcherDirectPreview
  );

  const hasSpecialUpperPaywallOrVerification =
    !hasLineageConnectionAccess || isUnmatchedCase || isVerificationPending;

  const topDownUnifiedItems: UnifiedSpineItem[] = useMemo(() => {
    const upperTopDown: UnifiedSpineItem[] = [];

    if (!hasSpecialUpperPaywallOrVerification) {
      if (effectiveResult.isAlphaOnlyBeforeMerge) {
        if (!hasLineageConnectionAccess) {
          // Locked upper lineage layers
          LOCKED_UPPER_LINEAGE_LAYERS.forEach((layer) => {
            upperTopDown.push({
              id: layer.id,
              kind: 'locked_layer',
              layerId: layer.id,
              label: layer.label,
              marketingSubtitle: CASE_2_ALPHA_VIP_MARKETING_COPY,
              era: layer.era,
              entityKind: 'locked',
            });
          });
          const { subRootStation, motherTribeStation, capsuleBetweenB2AndB0 } =
            resolveStrictTwoRootStationsFor5UsdTier();
          if (motherTribeStation) {
            upperTopDown.push(toAncestorItem(motherTribeStation, false));
          }
          if (capsuleBetweenB2AndB0) {
            upperTopDown.push({
              id: capsuleBetweenB2AndB0.id,
              kind: 'capsule_pill',
              ringGroup: capsuleBetweenB2AndB0,
              entityKind: 'capsule',
            });
          }
          if (
            motherTribeStation &&
            subRootStation &&
            subRootStation.id !== motherTribeStation.id
          ) {
            upperTopDown.push(toAncestorItem(subRootStation, false));
          }
        } else {
          // Basic / Premium / Researcher Direct Preview
          const ascending: UnifiedSpineItem[] = [];
          const handledRings = new Set<string>();
          for (const node of spineNodes) {
            if (node.orderNumber === 1) continue;
            if (node.isCodedStation) {
              ascending.push(toAncestorItem(node, false));
            } else if (node.capsuleId) {
              const ringObj = capsulesList.find((c) => c.id === node.capsuleId);
              const isUnlockedForCustomer =
                hasLineageConnectionAccess &&
                unlockedCapsules.includes(node.capsuleId);
              const isUnlockedForResearcher =
                isResearcherDirectPreview &&
                (researcherExpandedCapsules.length === 0 ||
                  researcherExpandedCapsules.includes(node.capsuleId));
              if (isUnlockedForCustomer || isUnlockedForResearcher) {
                if (!foldUnlockedIntermediates) {
                  ascending.push(toAncestorItem(node, true));
                }
              } else if (!handledRings.has(node.capsuleId) && ringObj) {
                handledRings.add(node.capsuleId);
                ascending.push({
                  id: ringObj.id,
                  kind: 'capsule_pill',
                  ringGroup: ringObj,
                  entityKind: 'capsule',
                });
              }
            } else if (isResearcherDirectPreview) {
              ascending.push(toAncestorItem(node, false));
            }
          }
          const reversed = [...ascending].reverse();
          while (reversed.length > 0 && reversed[0].kind === 'capsule_pill') {
            reversed.shift();
          }
          upperTopDown.push(...reversed);
        }
      } else if (hasLineageConnectionAccess) {
        // Basic & Premium Full Adam Spine
        const ascending: UnifiedSpineItem[] = [];
        const handledRings = new Set<string>();
        for (const node of spineNodes) {
          if (node.orderNumber === 1) continue;
          if (effectiveResult.isAlphaMergedIntoAdam || node.isCodedStation) {
            ascending.push(toAncestorItem(node, false));
          } else if (node.capsuleId) {
            if (
              unlockedCapsules.includes(node.capsuleId) ||
              (isResearcherDirectPreview &&
                researcherExpandedCapsules.includes(node.capsuleId))
            ) {
              if (!foldUnlockedIntermediates) {
                ascending.push(toAncestorItem(node, true));
              }
            } else if (!handledRings.has(node.capsuleId)) {
              handledRings.add(node.capsuleId);
              const ringObj = capsulesList.find((c) => c.id === node.capsuleId);
              if (ringObj) {
                ascending.push({
                  id: ringObj.id,
                  kind: 'capsule_pill',
                  ringGroup: ringObj,
                  entityKind: 'capsule',
                });
              }
            }
          } else {
            ascending.push(toAncestorItem(node, false));
          }
        }
        const reversed = [...ascending].reverse();
        const midIdx = Math.max(1, Math.floor(reversed.length / 2));

        // Insert elegant inline intermediate toggle/unlock node inside the chain
        if (
          !effectiveResult.isAlphaMergedIntoAdam &&
          remainingLockedCapsules.length > 0 &&
          onRequestUnlockAllCapsulesBundle &&
          hasLineageConnectionAccess &&
          !isResearcherDirectPreview
        ) {
          reversed.splice(midIdx, 0, {
            id: 'inline-unlock-all-intermediates',
            kind: 'intermediate_toggle',
            mode: 'unlock_bundle',
            count:
              remainingLockedAncestorsCount || totalIntermediateAncestorsCount,
            entityKind: 'capsule',
          });
        } else if (unlockedIntermediateNodesCount > 0) {
          reversed.splice(midIdx, 0, {
            id: 'inline-fold-intermediates',
            kind: 'intermediate_toggle',
            mode: 'fold_toggle',
            count: unlockedIntermediateNodesCount,
            entityKind: 'capsule',
          });
        }
        upperTopDown.push(...reversed);
      } else {
        // Locked fallback
        LOCKED_UPPER_LINEAGE_LAYERS.forEach((layer) => {
          upperTopDown.push({
            id: layer.id,
            kind: 'locked_layer',
            layerId: layer.id,
            label: layer.label,
            marketingSubtitle: CASE_1_ADAM_VIP_MARKETING_COPY,
            era: layer.era,
            entityKind: 'locked',
          });
        });
      }
    }

    // Lower / Contemporary Chain (Family -> Grandfather -> Father -> Client)
    const lowerTopDown: UnifiedSpineItem[] = [
      { id: 'station-direct-family', kind: 'direct_family', entityKind: 'family' },
    ];
    if (!isResearcherDirectPreview) {
      if (grandfatherName) {
        lowerTopDown.push({
          id: 'station-grandfather',
          kind: 'grandfather',
          name: grandfatherName,
          entityKind: 'person',
        });
      }
      if (fatherName) {
        lowerTopDown.push({
          id: 'station-father',
          kind: 'father',
          name: fatherName,
          entityKind: 'person',
        });
      }
      lowerTopDown.push({
        id: 'station-client',
        kind: 'client',
        name: clientDisplayName || effectiveResult.familyName,
        entityKind: 'person',
      });
    }

    return [...upperTopDown, ...lowerTopDown];
  }, [
    hasSpecialUpperPaywallOrVerification,
    effectiveResult,
    caps.isVip,
    hasLineageConnectionAccess,
    isResearcherDirectPreview,
    spineNodes,
    capsulesList,
    unlockedCapsules,
    researcherExpandedCapsules,
    foldUnlockedIntermediates,
    remainingLockedCapsules.length,
    remainingLockedAncestorsCount,
    totalIntermediateAncestorsCount,
    unlockedIntermediateNodesCount,
    onRequestUnlockAllCapsulesBundle,
    grandfatherName,
    fatherName,
    clientDisplayName,
  ]);

  // Apply chosen Reading Direction (`top_down` vs `bottom_up`)
  const orderedDisplayItems: UnifiedSpineItem[] = useMemo(() => {
    return studioPrefs.direction === 'bottom_up'
      ? [...topDownUnifiedItems].reverse()
      : topDownUnifiedItems;
  }, [topDownUnifiedItems, studioPrefs.direction]);

  // ============================================================================
  // CLASSICAL ARABIC NASAB NARRATION (Strictly uses UNLOCKED visible nodes!)
  // ============================================================================
  const classicalNasabText = useMemo(() => {
    if (isUnmatchedCase || isVerificationPending) return '';
    // Build ascending list: Client -> Father -> Grandfather -> Family -> Unlocked Upper Nodes
    const ascendingInputs: NasabNarrationNodeInput[] = [];
    const reversedTopDown = [...topDownUnifiedItems].reverse();
    for (const item of reversedTopDown) {
      if (item.kind === 'client') {
        ascendingInputs.push({ cleanName: item.name, entityKind: 'person' });
      } else if (item.kind === 'father') {
        ascendingInputs.push({ cleanName: item.name, entityKind: 'person' });
      } else if (item.kind === 'grandfather') {
        ascendingInputs.push({ cleanName: item.name, entityKind: 'person' });
      } else if (item.kind === 'direct_family') {
        ascendingInputs.push({
          cleanName: getCleanSpineNodeName(effectiveResult.familyName),
          entityKind: 'family',
        });
      } else if (item.kind === 'ancestor_node') {
        ascendingInputs.push({
          cleanName: getCleanSpineNodeName(item.node.name),
          entityKind: item.entityKind,
        });
      }
    }
    return buildClassicalArabicNasabNarration(ascendingInputs);
  }, [
    isUnmatchedCase,
    isVerificationPending,
    topDownUnifiedItems,
    effectiveResult.familyName,
  ]);

  // ============================================================================
  // VERIFIED SOURCES LIST (Strictly computed for VIP/Researcher & Export Charter)
  // ============================================================================
  const isSourcesUnlocked = hasLineageConnectionAccess;
  const officialMatchingDisclaimer =
    SUBSCRIPTION_FOOTNOTES.find((f) => f.id === 'matching_note')?.textAr ||
    'يعتمد ربط سلاسل الأنساب على مدى توفر وكفاية المعلومات والمصادر الموثوقة، ولا يُعدّ العثور على اتصال أمراً مضموناً بالضرورة.';

  const triggerLineageBasicUpgrade = (customTitle?: string) => {
    if (onRequirePremiumAction) {
      onRequirePremiumAction({
        feature: 'lineage_connection',
        requiredTier: 'basic',
        title: customTitle,
      });
    } else {
      onUnlockRoot5Usd();
    }
  };

  const aggregatedSources: string[] = useMemo(() => {
    if (!isSourcesUnlocked) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyRes = effectiveResult as Record<string, any>;
    return extractUnifiedVerifiedSourcesList({
      alphaEvidence:
        effectiveResult.corroborating_alpha_evidence_for_researcher ||
        effectiveResult.alpha_evidence,
      apiVerifiedSourcesList: anyRes.verified_sources_list,
      apiVerifiedSources: [
        ...(effectiveResult.verified_sources || []),
        ...(effectiveResult.secondarySources || []),
      ],
      fallbackCitation: effectiveResult.verifiedSourceCitation,
    });
  }, [isSourcesUnlocked, effectiveResult]);

  const verifiedAddonList = useMemo(
    () =>
      isSourcesUnlocked
        ? mergeVerifiedAddonSourceLists(
            effectiveResult.verifiedAddonSources,
            getVerifiedAddonSourcesForEvidence(
              effectiveResult.corroborating_alpha_evidence_for_researcher ||
                effectiveResult.alpha_evidence
            )
          )
        : [],
    [isSourcesUnlocked, effectiveResult]
  );

  const aggregatedSiblings = useMemo(
    () =>
      effectiveResult.sibling_branches_in_record &&
      effectiveResult.sibling_branches_in_record.length > 0
        ? effectiveResult.sibling_branches_in_record
        : effectiveResult.siblingBranches || [],
    [effectiveResult]
  );

  // Build ExportPosterOptions carrying active Theme, Font, Direction, Nasab, & Unlocked Sources
  const lineageExportPosterOptions: ExportPosterOptions = useMemo(
    () => ({
      poster: {
        ...DEFAULT_POSTER_SETTINGS,
        headerStyle: 'basmala_verse',
        borderStyle: 'islamic_gold',
        showQrCode: true,
        showStampAndDates: true,
      },
      lineageCharter: {
        themeLabel: theme.label,
        direction: studioPrefs.direction,
        fontCssFamily: fontDef.cssFamily,
        fontLabel: fontDef.label,
        canvasFontName: fontDef.canvasFontName,
        nasabNarration: classicalNasabText || undefined,
        verifiedSources: isSourcesUnlocked ? aggregatedSources : undefined,
        isDarkSurface: theme.isDark,
        primaryHex: theme.accentHex,
        goldHex: theme.goldHex,
        canvasBg: theme.canvasBg,
        sheetBg: theme.surfaceBg,
        textPrimaryHex: theme.textPrimaryHex,
        textMutedHex: theme.textMutedHex,
        cardStrokeHex: theme.surfaceBorder,
      },
    }),
    [
      theme,
      studioPrefs.direction,
      fontDef,
      classicalNasabText,
      isSourcesUnlocked,
      aggregatedSources,
    ]
  );

  // ============================================================================
  // SPECIAL UPPER PAYWALL / VERIFICATION / UNMATCHED CARDS (Preserved 100%)
  // ============================================================================
  const renderLockedRoot5UsdCard = () => {
    const locationParts = [
      effectiveResult.originRegion,
      effectiveResult.originCountry,
    ].filter((part) => part && part !== 'غير محدد' && part !== '—');
    const locationSuffix =
      locationParts.length > 0 ? ` (${locationParts.join(' / ')})` : '';

    return (
      <div
        data-testid="root-unlock-5usd-card"
        onClick={() =>
          triggerLineageBasicUpgrade(
            `افتح البحث عن ربط الجذور واستعرض السلسلة المرصودة لعائلة ${effectiveResult.familyName}`
          )
        }
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            triggerLineageBasicUpgrade(
              `افتح البحث عن ربط الجذور واستعرض السلسلة المرصودة لعائلة ${effectiveResult.familyName}`
            );
          }
        }}
        title="رقِّ إلى Basic أو Premium لفتح البحث عن ربط الجذور"
        className="max-w-[480px] w-full mx-auto rounded-2xl p-5 sm:p-6 bg-[#FAF7F2] border-2 border-[#D97757]/60 shadow-[0_10px_28px_-14px_rgba(31,31,28,0.14)] hover:border-[#D97757] transition-all cursor-pointer group relative z-20 text-right overflow-hidden space-y-4"
      >
        <div className="flex items-center justify-between gap-2 relative z-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-display font-bold bg-[#F5F1E8] border border-[#D8C7B2] text-[#D97757]">
            <Sparkles className="w-3.5 h-3.5 text-[#D97757]" />
            <span>رادار جذوري للربط المرجعي</span>
          </span>
          <span className="text-[11px] font-display font-bold text-[#1F1F1C]/65">
            متاح بدءاً من Basic ({formatPlanPriceUsd(SUBSCRIPTION_PLANS.basic.monthlyPriceUsd)}/شهر)
          </span>
        </div>

        <div className="space-y-1.5 relative z-10">
          <h3 className="text-sm sm:text-base font-display font-extrabold leading-relaxed text-[#1F1F1C]">
            ✦ رصد رادار جذوري تقاطعاً مرجعياً محتملاً يرتبط ببيانات عائلة ({effectiveResult.familyName}){locationSuffix} — رقِّ إلى الباقة الأساسية (Basic) أو المميزة (Premium) لفتح البحث عن ربط الجذور واستعراض السلسلة المرصودة
          </h3>
        </div>

        <div className="relative z-10">
          <div className="rounded-xl px-4 py-3 flex items-center justify-between gap-3 bg-[#F5F1E8] border border-[#D8C7B2]">
            <div className="min-w-0 space-y-1">
              <div className="text-[11px] font-display font-extrabold text-[#D97757]">
                🔒 الجذر التاريخي المرصود — مقفل على الباقة المجانية
              </div>
              <div
                className="text-sm font-display font-extrabold blur-sm select-none text-[#1F1F1C]"
                aria-hidden="true"
              >
                سلسلة النسب الموثقة والقبيلة الأم المرتبطة بالعائلة
              </div>
            </div>
            <span
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-[#E8DED2] border border-[#D8C7B2] text-[#D97757]"
              aria-hidden="true"
            >
              <Lock className="w-4 h-4" />
            </span>
          </div>
        </div>

        <div className="pt-1 relative z-10 space-y-2">
          <div className="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-display font-extrabold bg-[#D97757] group-hover:bg-[#C46546] text-[#F5F1E8] shadow-xs flex items-center justify-center transition-colors">
            <span>الترقية إلى Basic أو Premium لفتح البحث عن ربط الجذور</span>
          </div>
          <p className="text-[10.5px] text-[#1F1F1C]/65 leading-relaxed">
            {officialMatchingDisclaimer}
          </p>
        </div>
      </div>
    );
  };

  const renderPost5UsdProgressiveVerificationCard = () => {
    const candidateOptions = (
      effectiveResult.disambiguationOptions || []
    ).slice(0, 3);

    const handleConfirmStage1 = () => {
      if (stage1Choice === 'not_sure_stage1') {
        setVerificationStage(2);
        return;
      }
      setLocalResolvedOption(stage1Choice);
      onSelectVerificationPath?.(stage1Choice);
    };

    const handleConfirmStage2 = () => {
      if (stage2Choice === 'not_sure_escalate') {
        setLocalResolvedOption('escalated_ticket');
        onEscalateVerificationToTicket?.();
        return;
      }
      setLocalResolvedOption(stage2Choice);
      onSelectVerificationPath?.(stage2Choice);
    };

    return (
      <div
        data-testid="post-5usd-progressive-verification-card"
        className="max-w-[460px] w-full mx-auto rounded-2xl p-5 shadow-md relative z-20 text-right space-y-4"
        style={{
          backgroundColor: theme.surfaceBg,
          border: `2px solid ${theme.goldBorderHex}`,
        }}
      >
        <div
          className="flex items-center justify-between gap-2 pb-3"
          style={{ borderBottom: `1px solid ${theme.surfaceBorder}` }}
        >
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-display font-extrabold"
            style={{
              backgroundColor: theme.goldSoftBg,
              color: theme.accentTextHex,
            }}
          >
            {verificationStage === 1
              ? 'سؤال التحقق المتدرج (المرحلة 1 من 2)'
              : 'سؤال التحقق المتدرج (المرحلة 2 من 2)'}
          </span>
          <span
            className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg"
            style={{
              backgroundColor: theme.statusBg,
              color: theme.statusText,
              border: `1px solid ${theme.statusBorder}`,
            }}
          >
            {caps.isRootUnlocked
              ? 'تم فتح الجذر ($5) ✓'
              : 'تحقق مجاني قبل فتح الجذر ✓'}
          </span>
        </div>

        {verificationStage === 1 ? (
          <div className="space-y-3.5">
            <div className="space-y-1">
              <h3
                className="text-sm sm:text-base font-display font-extrabold leading-snug"
                style={{ color: theme.textPrimaryHex }}
              >
                لتثبيت الجذر الصحيح لعائلة ({effectiveResult.familyName})، أيٌّ من هذه الأصول أو القبائل يرتبط بعائلتكم؟
              </h3>
              <p
                className="text-xs font-medium"
                style={{ color: theme.textMutedHex }}
              >
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
                    className="flex items-center justify-between gap-3 p-3.5 rounded-xl border-2 transition-all cursor-pointer"
                    style={{
                      backgroundColor: isSelected
                        ? theme.goldSoftBg
                        : theme.surfaceAltBg,
                      borderColor: isSelected
                        ? theme.goldBorderHex
                        : theme.surfaceBorder,
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="radio"
                        name="post5_stage1_origin"
                        checked={isSelected}
                        onChange={() => setStage1Choice(opt.id)}
                        className="w-4 h-4 accent-[#D97757] cursor-pointer shrink-0"
                      />
                      <span
                        className="text-sm sm:text-base font-display font-extrabold"
                        style={{ color: theme.textPrimaryHex }}
                      >
                        {shortLabel}
                      </span>
                    </div>
                    {badgeText && (
                      <span
                        className="px-2.5 py-0.5 rounded-lg text-[11px] font-display font-extrabold shrink-0"
                        style={{
                          backgroundColor: theme.statusBg,
                          color: theme.statusText,
                          border: `1px solid ${theme.statusBorder}`,
                        }}
                      >
                        {badgeText}
                      </span>
                    )}
                  </label>
                );
              })}

              <label
                onClick={() => setStage1Choice('not_sure_stage1')}
                className="flex items-center justify-between gap-3 p-3.5 rounded-xl border-2 transition-all cursor-pointer"
                style={{
                  backgroundColor:
                    stage1Choice === 'not_sure_stage1'
                      ? theme.goldSoftBg
                      : theme.surfaceAltBg,
                  borderColor:
                    stage1Choice === 'not_sure_stage1'
                      ? theme.goldBorderHex
                      : theme.surfaceBorder,
                }}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="post5_stage1_origin"
                    checked={stage1Choice === 'not_sure_stage1'}
                    onChange={() => setStage1Choice('not_sure_stage1')}
                    className="w-4 h-4 accent-[#D97757] cursor-pointer shrink-0"
                  />
                  <span
                    className="text-sm font-display font-bold"
                    style={{ color: theme.textPrimaryHex }}
                  >
                    لا أعرف / لست متأكداً (الاحتكام للمواضع الجغرافية)
                  </span>
                </div>
              </label>
            </div>

            <button
              type="button"
              onClick={handleConfirmStage1}
              className="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-display font-extrabold transition-colors cursor-pointer shadow-xs"
              style={{
                backgroundColor: theme.buttonPrimaryBg,
                color: theme.buttonPrimaryText,
              }}
            >
              {stage1Choice === 'not_sure_stage1'
                ? 'المتابعة إلى التحقق الجغرافي الآلي'
                : caps.isRootUnlocked
                ? 'تأكيد الاختيار وكشف الجذر الموثق'
                : 'تأكيد الاختيار وتحديد الجذر المطابق'}
            </button>
          </div>
        ) : (
          <div className="space-y-3.5">
            <div className="space-y-1">
              <h3
                className="text-sm sm:text-base font-display font-extrabold leading-snug"
                style={{ color: theme.textPrimaryHex }}
              >
                لتحديد المسار النسبي آلياً، أيٌّ من هذه الحواضر أو المواضع يرتبط بعائلتكم؟
              </h3>
              <p
                className="text-xs font-medium"
                style={{ color: theme.textMutedHex }}
              >
                اختر الموضع الجغرافي المرتبط بعائلتك ليقوم المحرك بحسم الجذر تلقائياً:
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
                    className="flex items-center justify-between gap-3 p-3.5 rounded-xl border-2 transition-all cursor-pointer"
                    style={{
                      backgroundColor: isSelected
                        ? theme.goldSoftBg
                        : theme.surfaceAltBg,
                      borderColor: isSelected
                        ? theme.goldBorderHex
                        : theme.surfaceBorder,
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="radio"
                        name="post5_stage2_geo"
                        checked={isSelected}
                        onChange={() => setStage2Choice(opt.id)}
                        className="w-4 h-4 accent-[#D97757] cursor-pointer shrink-0"
                      />
                      <span
                        className="text-sm font-display font-extrabold"
                        style={{ color: theme.textPrimaryHex }}
                      >
                        {opt.geographicScope}
                      </span>
                    </div>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded shrink-0"
                      style={{
                        backgroundColor: theme.surfaceBg,
                        color: theme.accentTextHex,
                        border: `1px solid ${theme.surfaceBorder}`,
                      }}
                    >
                      يُحسم آلياً: {shortOrigin}
                    </span>
                  </label>
                );
              })}

              <label
                onClick={() => setStage2Choice('not_sure_escalate')}
                className="flex items-center justify-between gap-3 p-3.5 rounded-xl border-2 transition-all cursor-pointer"
                style={{
                  backgroundColor:
                    stage2Choice === 'not_sure_escalate'
                      ? theme.goldSoftBg
                      : theme.surfaceAltBg,
                  borderColor:
                    stage2Choice === 'not_sure_escalate'
                      ? theme.goldBorderHex
                      : theme.surfaceBorder,
                }}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="post5_stage2_geo"
                    checked={stage2Choice === 'not_sure_escalate'}
                    onChange={() => setStage2Choice('not_sure_escalate')}
                    className="w-4 h-4 accent-[#D97757] cursor-pointer shrink-0"
                  />
                  <span
                    className="text-sm font-display font-bold"
                    style={{ color: theme.textPrimaryHex }}
                  >
                    لا أعرف / موضع آخر
                  </span>
                </div>
                <span className="text-[10px] font-bold text-[#1F1F1C] bg-[#E8DED2] px-2 py-0.5 rounded border border-[#D8C7B2] shrink-0">
                  إحالة لتذكرة بحث متخصصة
                </span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleConfirmStage2}
                className="flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-display font-extrabold transition-colors cursor-pointer shadow-xs"
                style={{
                  backgroundColor: theme.buttonPrimaryBg,
                  color: theme.buttonPrimaryText,
                }}
              >
                {stage2Choice === 'not_sure_escalate'
                  ? 'المتابعة إلى البحث المعمق (الباقة السنوية)'
                  : caps.isRootUnlocked
                  ? 'تأكيد الموضع وكشف الجذر الموثق'
                  : 'تأكيد الموضع وتحديد الجذر المطابق'}
              </button>
              <button
                type="button"
                onClick={() => setVerificationStage(1)}
                className="py-3 px-3.5 rounded-xl text-xs font-bold cursor-pointer"
                style={{
                  backgroundColor: theme.surfaceAltBg,
                  border: `1px solid ${theme.surfaceBorder}`,
                  color: theme.textPrimaryHex,
                }}
              >
                رجوع
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderUnmatchedFamilyUpperSection = () => {
    if (!hasLineageConnectionAccess) {
      return (
        <div
          data-testid="unmatched-special-research-paywall-card"
          className="max-w-[480px] w-full mx-auto rounded-2xl p-5 sm:p-6 bg-[#FAF7F2] border border-[#D8C7B2] shadow-[0_6px_22px_-10px_rgba(31,31,28,0.12)] relative z-20 text-right space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-display font-bold bg-[#F5F1E8] border border-[#D8C7B2] text-[#D97757]">
              <Sparkles className="w-3.5 h-3.5 text-[#D97757]" />
              <span>رادار الجذور · البحث عن ربط الجذور</span>
            </span>
            <span className="text-[11px] font-display font-bold text-[#1F1F1C]/65">
              بدءاً من Basic
            </span>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-sm sm:text-base font-display font-extrabold leading-snug text-[#1F1F1C]">
              {freeLeadRadarSignal?.active
                ? `✦ رصد مرصد جذوري إشارة مرجعية واعدة لعائلة (${result.familyName})`
                : `كيف يعمل البحث عن ربط الجذور لعائلة (${result.familyName})؟`}
            </h3>
            <p className="text-xs font-medium leading-relaxed text-[#1F1F1C]/80">
              {freeLeadRadarSignal?.active
                ? freeLeadRadarSignal.teaserNoteAr ||
                  `رصد مرصد جذوري تقاطعاً مرجعياً واعداً يرتبط ببيانات عائلة (${result.familyName}) — رقِّ إلى الباقة الأساسية (Basic) أو المميزة (Premium) لفتح البحث الموثق واستعراض الجذر التاريخي دون قيود.`
                : 'يُطابق رادار جذوري بيانات عائلتك مع فهرس الأنساب والمعاجم التاريخية الموثّقة. لم تُسجَّل مطابقة فورية حالياً، ويمكنك الترقية إلى الباقة الأساسية (Basic) لفتح أداة البحث الكامل عن ربط الجذور وتقديم طلب التحقق النسبي.'}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              triggerLineageBasicUpgrade(
                `رقِّ إلى باقة Basic لفتح أداة البحث عن ربط الجذور لعائلة ${result.familyName}`
              )
            }
            className="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-display font-extrabold bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] transition-colors cursor-pointer shadow-xs"
          >
            الترقية إلى Basic لفتح البحث عن ربط الجذور ({formatPlanPriceUsd(SUBSCRIPTION_PLANS.basic.monthlyPriceUsd)}/شهر)
          </button>

          <p className="text-[10.5px] text-[#1F1F1C]/65 leading-relaxed">
            {officialMatchingDisclaimer}
          </p>
        </div>
      );
    }

    const decisionHeadline =
      lineageResearchStatus === 'partial_investigating'
        ? 'تقاطع جزئي واعد — ملف عائلتك قيد الاستقصاء المعمق لدى هيئة البحوث'
        : lineageResearchStatus === 'needs_client_info'
        ? 'تحتاج هيئة البحوث إلى إيضاح أو وثيقة إضافية لإكمال ربط الجذر'
        : lineageResearchStatus === 'insufficient_sources'
        ? 'تعذّر إثبات الربط المرجعي حالياً لعدم كفاية المصادر — ملفك محفوظ في الرصد المستمر'
        : `لم يظهر اتصال مباشر لعائلة (${result.familyName}) في الفهرس الآلي حالياً`;

    return (
      <div
        data-testid="unmatched-active-p1-ticket-card"
        className="max-w-[480px] w-full mx-auto rounded-2xl p-5 bg-[#FAF7F2] border border-[#D8C7B2] shadow-[0_6px_22px_-10px_rgba(31,31,28,0.12)] relative z-20 text-right space-y-3.5"
      >
        <div className="space-y-1.5">
          <div className="text-[11px] font-display font-extrabold text-[#D97757]">
            {lineageResearchStatus
              ? 'تحديث رسمي من مدير البحوث وهيئة الأنساب'
              : 'البحث عن ربط الجذور · مفعّل في باقتك ✓'}
          </div>
          <h3 className="text-sm sm:text-base font-display font-extrabold leading-snug text-[#1F1F1C]">
            {decisionHeadline}
          </h3>
          <p className="text-xs leading-relaxed text-[#1F1F1C]/75">
            {lineageResearchStatusNote ||
              'يمكنك متابعة توثيق شجرة عائلتك القريبة في تبويب «شجرتي» أو فتح طلب تحقق مرجعي لدى فريق الباحثين، وسيُحدَّث عمود نسبك تلقائياً فور توفر مصدر موثوق.'}
          </p>
        </div>

        <div className="space-y-2">
          {onOpenResearchTicketsTab && (
            <button
              type="button"
              onClick={onOpenResearchTicketsTab}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-display font-bold bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] transition-colors cursor-pointer shadow-2xs"
            >
              متابعة طلب التحقق النسبي ومراسلة الباحثين
            </button>
          )}
          {onOpenMyTreeTab && (
            <button
              type="button"
              onClick={onOpenMyTreeTab}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-display font-bold bg-[#E8DED2] hover:bg-[#D8C7B2]/60 text-[#1F1F1C] border border-[#D8C7B2] transition-colors cursor-pointer"
            >
              ابدأ ببناء شجرة عائلتك القريبة في «شجرتي»
            </button>
          )}
        </div>

        <p className="text-[10.5px] text-[#1F1F1C]/65 leading-relaxed pt-1 border-t border-[#D8C7B2]/70">
          {officialMatchingDisclaimer}
        </p>
      </div>
    );
  };

  // ============================================================================
  // SEMANTIC CONNECTOR RENDERER (Vertical & Horizontal Panoramic)
  // ============================================================================
  const renderSemanticConnectorBetween = (
    firstItem: UnifiedSpineItem,
    secondItem: UnifiedSpineItem,
    orientation: 'vertical' | 'horizontal' = 'vertical'
  ) => {
    const isTopDown = studioPrefs.direction === 'top_down';
    const upperItem = isTopDown ? firstItem : secondItem;
    const lowerItem = isTopDown ? secondItem : firstItem;

    const hasSkippedGap =
      upperItem.kind === 'ancestor_node' &&
      lowerItem.kind === 'ancestor_node' &&
      upperItem.node.orderNumber - lowerItem.node.orderNumber > 1;

    const conn = resolveSemanticLineageConnector({
      upperKind: upperItem.entityKind,
      lowerKind: lowerItem.entityKind,
      direction: studioPrefs.direction,
      orientation,
      hasSkippedGap,
    });

    if (orientation === 'horizontal') {
      return (
        <div className="flex flex-col items-center justify-center shrink-0 px-1.5 relative z-20">
          <div
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-display font-bold whitespace-nowrap shadow-2xs"
            style={{
              backgroundColor: theme.connectorBg,
              border: `1px solid ${theme.connectorBorder}`,
              color: theme.connectorText,
            }}
          >
            <span>{conn.label}</span>
            <span aria-hidden="true">{conn.arrow}</span>
          </div>
        </div>
      );
    }

    return (
      <div className="w-full flex justify-center relative z-20 py-2">
        <div
          className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-display font-bold shadow-2xs"
          style={{
            backgroundColor: theme.connectorBg,
            border: `1px solid ${theme.connectorBorder}`,
            color: theme.connectorText,
          }}
        >
          <span aria-hidden="true">{conn.arrow}</span>
          <span>{conn.label}</span>
        </div>
      </div>
    );
  };

  // ============================================================================
  // INDIVIDUAL ITEM CARD RENDERER (Theme-Aware, Zero Purple Clash!)
  // ============================================================================
  const handleCapsuleClick = (ringGroup: AncestorCapsule) => {
    if (isResearcherDirectPreview) {
      setResearcherExpandedCapsules((prev) =>
        prev.includes(ringGroup.id)
          ? prev.filter((id) => id !== ringGroup.id)
          : [...prev, ringGroup.id]
      );
      return;
    }
    if (!hasLineageConnectionAccess) {
      triggerLineageBasicUpgrade();
      return;
    }
    onRequestUnlockCapsule(ringGroup);
  };

  const renderUnifiedItemCard = (
    item: UnifiedSpineItem,
    indexInView: number,
    options?: {
      isTopmostCrown?: boolean;
      variant?: 'pillar' | 'scroll' | 'panoramic' | 'medallion';
    }
  ) => {
    const variant = options?.variant || 'pillar';
    const isCompact = variant === 'medallion';
    const isPanoramic = variant === 'panoramic';
    const widthClass = isPanoramic
      ? 'w-[254px] sm:w-[274px] shrink-0'
      : isCompact
      ? 'w-full h-full'
      : 'w-[258px] sm:w-[288px] max-w-full mx-auto';

    // 1. Capsule Pill (Folded Intermediate Ancestors)
    if (item.kind === 'capsule_pill') {
      const count = item.ringGroup.ancestors.length;
      const countLabel =
        count === 1
          ? '+1 في السلسلة'
          : count >= 11
          ? `+${count} جدّاً في السلسلة`
          : `+${count} في السلسلة`;

      return (
        <div
          className={
            isCompact
              ? 'w-full h-full flex items-center justify-center'
              : isPanoramic
              ? 'shrink-0 flex items-center justify-center px-1'
              : 'flex justify-center relative z-20 my-1'
          }
        >
          <button
            type="button"
            data-testid={`capsule-pill-${item.ringGroup.id}`}
            onClick={() => handleCapsuleClick(item.ringGroup)}
            title={
              caps.isVip
                ? `اضغط لفتح أسماء الأجداد الفرعيين (${item.ringGroup.betweenLabel})`
                : `تُفتح بالباقة المدفوعة (${item.ringGroup.betweenLabel})`
            }
            className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-2xl text-xs font-display font-extrabold transition-all duration-150 cursor-pointer shadow-2xs ${
              isCompact ? 'w-full h-full min-h-[92px] flex-col text-center' : ''
            }`}
            style={{
              backgroundColor: theme.goldSoftBg,
              border: `1.5px dashed ${theme.goldBorderHex}`,
              color: theme.accentTextHex,
            }}
          >
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span>{countLabel}</span>
            {isCompact && (
              <span
                className="text-[10px] font-medium"
                style={{ color: theme.textMutedHex }}
              >
                حلقات وسطية قابلة للفتح
              </span>
            )}
          </button>
        </div>
      );
    }

    // 2. Inline Intermediate Capsules Toggle / Unlock Node (inside the chain itself!)
    if (item.kind === 'intermediate_toggle') {
      const isUnlockBundle = item.mode === 'unlock_bundle';
      return (
        <div
          className={
            isCompact
              ? 'w-full h-full flex items-center justify-center'
              : isPanoramic
              ? 'shrink-0 flex items-center justify-center px-1'
              : 'flex justify-center relative z-20 my-1.5'
          }
        >
          <button
            type="button"
            data-testid={
              isUnlockBundle
                ? 'inline-unlock-all-intermediates-btn'
                : 'inline-fold-intermediates-btn'
            }
            onClick={() => {
              if (isUnlockBundle) {
                onRequestUnlockAllCapsulesBundle?.();
              } else {
                setFoldUnlockedIntermediates((prev) => !prev);
              }
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-2xl text-xs font-display font-extrabold transition-all duration-150 cursor-pointer shadow-2xs"
            style={{
              backgroundColor: theme.surfaceBg,
              border: `1.5px solid ${theme.goldBorderHex}`,
              color: theme.accentTextHex,
            }}
          >
            {isUnlockBundle ? (
              <Sparkles
                className="w-3.5 h-3.5 shrink-0"
                style={{ color: theme.goldHex }}
              />
            ) : (
              <Layers
                className="w-3.5 h-3.5 shrink-0"
                style={{ color: theme.goldHex }}
              />
            )}
            <span>
              {isUnlockBundle
                ? `✦ إظهار جميع الحلقات الوسطية في السلسلة (+${item.count})`
                : foldUnlockedIntermediates
                ? `✦ إظهار الحلقات الوسطية المفتوحة (${item.count})`
                : `✦ طيّ الحلقات الوسطية في السلسلة (${item.count})`}
            </span>
          </button>
        </div>
      );
    }

    // 3. Locked Upper Layer Card ($5 Basic Tier)
    if (item.kind === 'locked_layer') {
      return (
        <div
          data-testid={item.layerId}
          onClick={onUpgradeAnnualVip}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onUpgradeAnnualVip();
            }
          }}
          title={item.marketingSubtitle}
          className={`${widthClass} rounded-2xl py-3.5 px-4 shadow-2xs hover:shadow-md flex items-center justify-between gap-3 transition-all duration-150 cursor-pointer group relative z-20 text-right`}
          style={{
            backgroundColor: theme.surfaceAltBg,
            border: `1.5px dashed ${theme.goldBorderHex}95`,
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <HeritageNodeAvatar
              eraOverride={item.era}
              avatarStyle={studioPrefs.avatarStyle}
              nodeOrigin="historical"
              size="sm"
            />
            <div className="min-w-0 space-y-0.5">
              <div
                className="text-xs sm:text-sm font-display font-extrabold truncate"
                style={{ color: theme.textPrimaryHex }}
              >
                {item.label}
              </div>
              <p
                className="text-[11px] font-medium line-clamp-2 leading-snug"
                style={{ color: theme.textMutedHex }}
              >
                {item.marketingSubtitle}
              </p>
            </div>
          </div>
          <span
            aria-label="مقفل — اضغط للترقية"
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{
              backgroundColor: theme.goldSoftBg,
              border: `1px solid ${theme.goldBorderHex}`,
              color: theme.accentTextHex,
            }}
          >
            <Lock className="w-4 h-4" />
          </span>
        </div>
      );
    }

    // 4. Direct Family Station Node (Compact Sculpted Luxury Nameplate — Warm Royal Gold Double Frame)
    if (item.kind === 'direct_family') {
      const station1Node = spineNodes[0];
      const cleanFamName = getCleanSpineNodeName(effectiveResult.familyName);
      return (
        <UnifiedLineageNameplate
          variant="direct_family"
          dataTestId="direct-family-station-card"
          tierLabel="بيت النسب المباشر"
          title={cleanFamName}
          badgeText="بيت النسب"
          widthClass={widthClass}
          fontFamily={fontDef.cssFamily}
          palette={theme}
          avatar={
            <HeritageNodeAvatar
              node={station1Node}
              eraOverride="family_branch"
              avatarStyle={studioPrefs.avatarStyle}
              nodeOrigin="direct_family"
              size="md"
              className="!w-full !h-full !border-0"
            />
          }
        />
      );
    }

    // 5. Client Node («أمين السجل»)
    if (item.kind === 'client') {
      return (
        <UnifiedLineageNameplate
          variant="record_keeper"
          dataTestId="record-keeper-station-card"
          tierLabel="أمين السجل"
          title={item.name}
          badgeText="معرف نشط"
          widthClass={widthClass}
          fontFamily={fontDef.cssFamily}
          palette={theme}
          avatar={
            <HeritageNodeAvatar
              personRole="client"
              avatarStyle={studioPrefs.avatarStyle}
              nodeOrigin="client_entered"
              size="md"
              customImageUrl={userAvatarUrl}
              className="!w-full !h-full !border-0"
            />
          }
        />
      );
    }

    // 6. Father & Grandfather Nodes
    if (item.kind === 'father' || item.kind === 'grandfather') {
      const isFather = item.kind === 'father';
      return (
        <UnifiedLineageNameplate
          variant="standard"
          tierLabel={isFather ? 'الأب المباشر' : 'الجد المباشر'}
          title={item.name}
          badgeText="موثق ✓"
          widthClass={widthClass}
          fontFamily={fontDef.cssFamily}
          palette={theme}
          avatar={
            <HeritageNodeAvatar
              personRole={isFather ? 'father' : 'grandfather'}
              gender="M"
              avatarStyle={studioPrefs.avatarStyle}
              nodeOrigin="client_entered"
              size="md"
              className="!w-full !h-full !border-0"
            />
          }
        />
      );
    }

    // 7. Historical Ancestor / Root / Summit Node
    const node = item.node;
    const isSelected = selectedAncestor?.id === node.id;
    const resolvedEra = resolveNodeHistoricalEra(node);
    const eraBadgeText = getHistoricalEraBadgeLabel(resolvedEra);
    const cleanTitle = getCleanSpineNodeName(node.name);
    const showRoyalCrown =
      Boolean(options?.isTopmostCrown) &&
      (variant === 'pillar' || variant === 'scroll');

    if (item.isSummit) {
      return (
        <UnifiedLineageNameplate
          variant="summit"
          tierLabel="قمة شجرة آدم الموثقة"
          title={node.name}
          badgeText="منتهى العمود"
          crownLabel={showRoyalCrown ? 'ذروة عمود النسب الموثق' : undefined}
          widthClass={widthClass}
          fontFamily={fontDef.cssFamily}
          isSelected={isSelected}
          palette={theme}
          onClick={() => setSelectedAncestor(node)}
          avatar={
            <HeritageNodeAvatar
              node={node}
              eraOverride="prophets_genesis"
              avatarStyle={studioPrefs.avatarStyle}
              nodeOrigin="historical"
              size="md"
              className="!w-full !h-full !border-0"
            />
          }
        />
      );
    }

    if (item.isRoot) {
      return (
        <UnifiedLineageNameplate
          variant="root"
          tierLabel={
            item.isSubRoot ? 'الجذر · الفرع الجامع' : 'الجذر · القبيلة الأم'
          }
          title={cleanTitle}
          badgeText="جذر موثق"
          badgeIcon="check"
          crownLabel={showRoyalCrown ? 'تاج الجذر الأعلى الموثق' : undefined}
          widthClass={widthClass}
          fontFamily={fontDef.cssFamily}
          isSelected={isSelected}
          palette={theme}
          onClick={() => setSelectedAncestor(node)}
          avatar={
            <HeritageNodeAvatar
              node={node}
              eraOverride="major_tribe"
              avatarStyle={studioPrefs.avatarStyle}
              nodeOrigin="historical"
              size="md"
              className="!w-full !h-full !border-0"
            />
          }
        />
      );
    }

    // Standard coded station or unlocked intermediate ancestor
    return (
      <UnifiedLineageNameplate
        variant={item.isIntermediate ? 'intermediate' : 'standard'}
        tierLabel={eraBadgeText}
        title={cleanTitle}
        badgeText="موثق ✓"
        widthClass={widthClass}
        fontFamily={fontDef.cssFamily}
        isSelected={isSelected}
        palette={theme}
        onClick={() => setSelectedAncestor(node)}
        avatar={
          <HeritageNodeAvatar
            node={node}
            avatarStyle={studioPrefs.avatarStyle}
            nodeOrigin="historical"
            size="md"
            className="!w-full !h-full !border-0"
          />
        }
      />
    );
  };

  // ============================================================================
  // SPECIAL UPPER CARD + STANDARD ITEMS RENDERING ACROSS ALL 4 VIEW MODES
  // ============================================================================
  const renderSpecialTopBlock = () => {
    if (!hasSpecialUpperPaywallOrVerification) return null;
    if (!hasLineageConnectionAccess) {
      return effectiveResult.matched
        ? renderLockedRoot5UsdCard()
        : renderUnmatchedFamilyUpperSection();
    }
    if (isUnmatchedCase) return renderUnmatchedFamilyUpperSection();
    if (isVerificationPending) return renderPost5UsdProgressiveVerificationCard();
    return renderLockedRoot5UsdCard();
  };

  const scrollPanoramicBy = (delta: number) => {
    if (!panoramicScrollRef.current) return;
    panoramicScrollRef.current.scrollBy({
      left: delta,
      behavior: 'smooth',
    });
  };

  const renderLineageVisualizerBody = () => {
    const viewMode = studioPrefs.viewMode;
    const specialUpper = renderSpecialTopBlock();
    const isBottomUp = studioPrefs.direction === 'bottom_up';

    const getConnectorBetweenItems = (
      firstItem: UnifiedSpineItem,
      secondItem: UnifiedSpineItem,
      orientation: 'vertical' | 'horizontal' = 'vertical'
    ) => {
      const isTopDown = studioPrefs.direction === 'top_down';
      const upperItem = isTopDown ? firstItem : secondItem;
      const lowerItem = isTopDown ? secondItem : firstItem;
      const hasSkippedGap =
        upperItem.kind === 'ancestor_node' &&
        lowerItem.kind === 'ancestor_node' &&
        upperItem.node.orderNumber - lowerItem.node.orderNumber > 1;
      return resolveSemanticLineageConnector({
        upperKind: upperItem.entityKind,
        lowerKind: lowerItem.entityKind,
        direction: studioPrefs.direction,
        orientation,
        hasSkippedGap,
      });
    };

    const getItemStepMeta = (item: UnifiedSpineItem): string => {
      if (item.kind === 'client') return 'أمين السجل';
      if (item.kind === 'father') return 'الأب المباشر';
      if (item.kind === 'grandfather') return 'الجد المباشر';
      if (item.kind === 'direct_family') return 'بيت النسب';
      if (item.kind === 'capsule_pill') return 'حلقات وسطية';
      if (item.kind === 'intermediate_toggle') return 'سلسلة الحلقات';
      if (item.kind === 'locked_layer') return 'طبقة تاريخية';
      if (item.isSummit) return 'ذروة العمود';
      if (item.isRoot) return item.isSubRoot ? 'الفرع الجامع' : 'القبيلة الأم';
      return getHistoricalEraBadgeLabel(resolveNodeHistoricalEra(item.node));
    };

    // MODE 4: ANDALUSIAN ZIGZAG ASCENSION (المعراج الأندلسي المتعرّج)
    if (viewMode === 'andalusian_zigzag') {
      return (
        <div
          data-testid="lineage-view-andalusian_zigzag"
          className="relative z-20 max-w-4xl mx-auto py-2 px-1 sm:px-3"
        >
          {!isBottomUp && specialUpper && (
            <div className="max-w-md mx-auto pb-5">{specialUpper}</div>
          )}

          <div className="relative">
            {/* Single Precision-Centered Vertical Axis (Desktop md+) / Right Rail (Mobile) */}
            <div
              aria-hidden="true"
              className="hidden md:block absolute left-1/2 -translate-x-1/2 top-4 bottom-4 w-[2px] rounded-full pointer-events-none"
              style={{ background: theme.railGradient }}
            />
            <div
              aria-hidden="true"
              className="md:hidden absolute right-4 top-4 bottom-4 w-[2px] rounded-full pointer-events-none"
              style={{ background: theme.railGradient }}
            />

            <div className="space-y-4 md:space-y-3 relative z-10">
              {orderedDisplayItems.map((item, idx) => {
                const isRightSide = idx % 2 === 0;
                const stepNum = String(idx + 1).padStart(2, '0');
                const nextConn =
                  idx < orderedDisplayItems.length - 1
                    ? getConnectorBetweenItems(
                        item,
                        orderedDisplayItems[idx + 1],
                        'vertical'
                      )
                    : null;

                return (
                  <div key={item.id} className="space-y-2">
                    <div className="relative grid grid-cols-1 md:grid-cols-[1fr_76px_1fr] items-center gap-y-2 md:gap-x-0">
                      {/* Right Column (Even indices on Desktop; All items on Mobile) */}
                      <div
                        className={`pr-10 md:pr-0 flex ${
                          isRightSide
                            ? 'md:justify-end md:pl-3'
                            : 'md:invisible md:pointer-events-none hidden md:flex'
                        }`}
                      >
                        {isRightSide && (
                          <div className="w-full max-w-[300px] relative">
                            <span
                              aria-hidden="true"
                              className="hidden md:block absolute top-1/2 -left-3 w-3 h-[2px] -translate-y-1/2"
                              style={{ backgroundColor: theme.goldBorderHex }}
                            />
                            {renderUnifiedItemCard(item, idx, {
                              isTopmostCrown:
                                idx === 0 &&
                                item.kind === 'ancestor_node' &&
                                (item.isSummit || item.isRoot),
                              variant: 'pillar',
                            })}
                          </div>
                        )}
                      </div>

                      {/* Center Axis Jewel Medallion */}
                      <div className="hidden md:flex flex-col items-center justify-center relative z-20">
                        <div
                          className="w-9 h-9 rounded-xl rotate-45 flex items-center justify-center shadow-xs transition-transform"
                          style={{
                            backgroundColor: theme.surfaceBg,
                            border: `1.5px solid ${theme.goldBorderHex}`,
                            boxShadow: `0 0 0 4px ${theme.canvasBg}`,
                          }}
                        >
                          <span
                            className="-rotate-45 text-[11px] font-mono font-extrabold tabular-nums"
                            style={{ color: theme.accentTextHex }}
                          >
                            {stepNum}
                          </span>
                        </div>
                      </div>

                      {/* Mobile Step Jewel on Right Rail */}
                      <div
                        className="md:hidden absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg rotate-45 flex items-center justify-center z-20"
                        style={{
                          backgroundColor: theme.surfaceBg,
                          border: `1.5px solid ${theme.goldBorderHex}`,
                        }}
                      >
                        <span
                          className="-rotate-45 text-[9px] font-mono font-extrabold tabular-nums"
                          style={{ color: theme.accentTextHex }}
                        >
                          {stepNum}
                        </span>
                      </div>

                      {/* Left Column (Odd indices on Desktop; Mobile renders here if odd) */}
                      <div
                        className={`pr-10 md:pr-0 flex ${
                          !isRightSide
                            ? 'md:justify-start md:pr-3'
                            : 'md:invisible md:pointer-events-none hidden md:flex'
                        }`}
                      >
                        {!isRightSide && (
                          <div className="w-full max-w-[300px] relative">
                            <span
                              aria-hidden="true"
                              className="hidden md:block absolute top-1/2 -right-3 w-3 h-[2px] -translate-y-1/2"
                              style={{ backgroundColor: theme.goldBorderHex }}
                            />
                            {renderUnifiedItemCard(item, idx, {
                              isTopmostCrown: false,
                              variant: 'pillar',
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Centered Semantic Axis Connector */}
                    {nextConn && (
                      <div className="flex justify-start pr-12 md:pr-0 md:justify-center relative z-20">
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-display font-bold shadow-2xs"
                          style={{
                            backgroundColor: theme.connectorBg,
                            border: `1px solid ${theme.connectorBorder}`,
                            color: theme.connectorText,
                          }}
                        >
                          <span aria-hidden="true">{nextConn.arrow}</span>
                          <span>{nextConn.label}</span>
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {isBottomUp && specialUpper && (
            <div className="max-w-md mx-auto pt-5">{specialUpper}</div>
          )}
        </div>
      );
    }

    // MODE 5: DIWANI HERITAGE MEDALLIONS GALLERY (قلادة الميداليات الديوانية)
    if (viewMode === 'heritage_medallions') {
      return (
        <div
          data-testid="lineage-view-heritage_medallions"
          className="relative z-20 max-w-5xl mx-auto py-2 space-y-5"
        >
          {!isBottomUp && specialUpper && (
            <div className="max-w-lg mx-auto">{specialUpper}</div>
          )}

          {/* Gallery Ribbon Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div
              className="text-xs font-display font-bold flex items-center gap-2"
              style={{ color: theme.textSecondaryHex }}
            >
              <Crown className="w-3.5 h-3.5" style={{ color: theme.goldHex }} />
              <span>
                {isBottomUp
                  ? 'معرض الحلقات المتسلسلة من أمين السجل صعوداً إلى الجذر الأعلى'
                  : 'معرض الحلقات المتسلسلة من الجذر الأعلى نزولاً إلى أمين السجل'}
              </span>
            </div>
            <span
              className="text-[11px] font-mono font-bold tabular-nums"
              style={{ color: theme.textMutedHex }}
            >
              {orderedDisplayItems.length} محطة معروضة
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {orderedDisplayItems.map((item, idx) => {
              const stepNum = String(idx + 1).padStart(2, '0');
              const stepMeta = getItemStepMeta(item);
              const nextConn =
                idx < orderedDisplayItems.length - 1
                  ? getConnectorBetweenItems(
                      item,
                      orderedDisplayItems[idx + 1],
                      'horizontal'
                    )
                  : null;

              return (
                <div
                  key={item.id}
                  className="relative rounded-2xl p-3 flex flex-col gap-2.5 transition-all"
                  style={{
                    backgroundColor: theme.surfaceAltBg,
                    border: `1.5px solid ${theme.goldBorderHex}65`,
                    boxShadow: theme.isDark
                      ? '0 8px 24px rgba(31,31,28,0.28)'
                      : '0 4px 16px rgba(217,119,87,0.05)',
                  }}
                >
                  {/* Top Medallion Index & Directional Link */}
                  <div className="flex items-center justify-between gap-2 px-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-6 h-6 rounded-lg text-[10.5px] font-mono font-extrabold tabular-nums inline-flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: theme.goldSoftBg,
                          border: `1px solid ${theme.goldBorderHex}`,
                          color: theme.accentTextHex,
                        }}
                      >
                        {stepNum}
                      </span>
                      <span
                        className="text-[11px] font-display font-bold truncate"
                        style={{ color: theme.textMutedHex }}
                      >
                        {stepMeta}
                      </span>
                    </div>

                    {nextConn && (
                      <span
                        className="text-[10px] font-display font-bold inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                        style={{ color: theme.connectorText }}
                      >
                        <span>{nextConn.label}</span>
                        <span aria-hidden="true">{nextConn.arrow}</span>
                      </span>
                    )}
                  </div>

                  {/* Embedded Interactive Plaque */}
                  <div className="flex-1 flex items-stretch">
                    {renderUnifiedItemCard(item, idx, {
                      isTopmostCrown: false,
                      variant: 'medallion',
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {isBottomUp && specialUpper && (
            <div className="max-w-lg mx-auto">{specialUpper}</div>
          )}
        </div>
      );
    }

    // MODE 6: MIHRAB ARCHES & HERITAGE TERRACES (عقود المحراب والمقامات)
    if (viewMode === 'majlis_arch_steps') {
      return (
        <div
          data-testid="lineage-view-majlis_arch_steps"
          className="relative z-20 max-w-2xl mx-auto py-2 px-1 sm:px-3"
        >
          {!isBottomUp && specialUpper && (
            <div className="pb-5">{specialUpper}</div>
          )}

          <div className="relative space-y-3">
            {/* Braided Architectural Right Elevation Rail */}
            <div
              aria-hidden="true"
              className="hidden sm:block absolute right-6 top-6 bottom-6 w-[2px] rounded-full pointer-events-none"
              style={{ background: theme.railGradient }}
            />

            {orderedDisplayItems.map((item, idx) => {
              const stepNum = String(idx + 1).padStart(2, '0');
              const stepMeta = getItemStepMeta(item);
              const nextConn =
                idx < orderedDisplayItems.length - 1
                  ? getConnectorBetweenItems(
                      item,
                      orderedDisplayItems[idx + 1],
                      'vertical'
                    )
                  : null;
              // Gentle stepped indentation (cycles softly 0 -> 1 -> 2 -> 1 -> 0 to prevent narrow squeeze on long chains)
              const stepTier = Math.min(idx % 4, 3);
              const stepIndentPx = stepTier * 14;

              return (
                <div key={item.id} className="space-y-2">
                  <div className="relative flex flex-col sm:flex-row sm:items-center gap-3">
                    {/* Architectural Milestone Marker on Right Elevation Rail */}
                    <div className="hidden sm:flex flex-col items-center justify-center w-12 shrink-0 relative z-20">
                      <div
                        className="w-10 h-10 rounded-t-full rounded-b-xl flex flex-col items-center justify-center shadow-2xs"
                        style={{
                          backgroundColor: theme.surfaceBg,
                          border: `1.5px solid ${theme.goldBorderHex}`,
                          color: theme.accentTextHex,
                        }}
                      >
                        <span className="text-[11px] font-mono font-extrabold tabular-nums leading-none">
                          {stepNum}
                        </span>
                      </div>
                    </div>

                    {/* Pointed Mihrab Arch Sculpted Chamber */}
                    <div
                      className="flex-1 min-w-0 transition-all"
                      style={{
                        marginInlineStart:
                          stepIndentPx > 0 ? `${stepIndentPx}px` : undefined,
                      }}
                    >
                      <div
                        className="relative rounded-t-[28px] rounded-b-2xl pt-4 pb-3 px-3.5 sm:px-4 overflow-hidden"
                        style={{
                          backgroundColor: theme.surfaceBg,
                          border: `1.5px solid ${theme.goldBorderHex}80`,
                          boxShadow: theme.isDark
                            ? '0 10px 26px rgba(31,31,28,0.32)'
                            : '0 6px 20px rgba(217,119,87,0.06)',
                        }}
                      >
                        {/* Delicate Islamic Pointed Mihrab Arch Crown Filigree */}
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 240 22"
                          preserveAspectRatio="none"
                          className="pointer-events-none absolute top-0 inset-x-0 w-full h-5 opacity-70"
                        >
                          <path
                            d="M 8 20 Q 65 18 120 3 Q 175 18 232 20"
                            fill="none"
                            stroke={theme.goldHex}
                            strokeWidth="1.4"
                          />
                          <circle cx="120" cy="4.5" r="2.2" fill={theme.goldHex} />
                        </svg>

                        {/* Arch Header Meta Line */}
                        <div className="flex items-center justify-between gap-2 pb-2 mb-2 relative z-10 border-b border-dashed"
                          style={{ borderColor: `${theme.goldBorderHex}45` }}
                        >
                          <span
                            className="text-[11px] font-display font-bold flex items-center gap-1.5"
                            style={{ color: theme.accentTextHex }}
                          >
                            <span className="sm:hidden font-mono tabular-nums">
                              {stepNum} ·
                            </span>
                            <span>{stepMeta}</span>
                          </span>
                          {nextConn && (
                            <span
                              className="text-[10.5px] font-display font-semibold inline-flex items-center gap-1"
                              style={{ color: theme.textMutedHex }}
                            >
                              <span>{nextConn.label}</span>
                              <span aria-hidden="true">{nextConn.arrow}</span>
                            </span>
                          )}
                        </div>

                        {/* Interactive Lineage Card */}
                        <div className="relative z-10">
                          {renderUnifiedItemCard(item, idx, {
                            isTopmostCrown: false,
                            variant: 'medallion',
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {isBottomUp && specialUpper && (
            <div className="pt-5">{specialUpper}</div>
          )}
        </div>
      );
    }

    // MODE 3: PANORAMIC HORIZONTAL FLOW (المسار البانورامي الأفقي)
    if (viewMode === 'panoramic_flow') {
      return (
        <div
          data-testid="lineage-view-panoramic_flow"
          className="relative z-20 space-y-4"
        >
          {specialUpper && <div className="pb-2">{specialUpper}</div>}

          <div className="flex items-center justify-between gap-2 px-1">
            <span
              className="text-xs font-display font-bold"
              style={{ color: theme.textMutedHex }}
            >
              {isBottomUp
                ? 'اسحب أو تنقّل أفقياً من اليمين إلى اليسار (من أمين السجل صعوداً إلى الجذر الأعلى)'
                : 'اسحب أو تنقّل أفقياً من اليمين إلى اليسار (من الجذر الأعلى نزولاً إلى الفروع)'}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => scrollPanoramicBy(320)}
                aria-label="التمرير لليمين"
                className="w-8 h-8 rounded-xl inline-flex items-center justify-center cursor-pointer transition-colors"
                style={{
                  backgroundColor: theme.surfaceBg,
                  border: `1px solid ${theme.surfaceBorder}`,
                  color: theme.textPrimaryHex,
                }}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollPanoramicBy(-320)}
                aria-label="التمرير لليسار"
                className="w-8 h-8 rounded-xl inline-flex items-center justify-center cursor-pointer transition-colors"
                style={{
                  backgroundColor: theme.surfaceBg,
                  border: `1px solid ${theme.surfaceBorder}`,
                  color: theme.textPrimaryHex,
                }}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div
            ref={panoramicScrollRef}
            className="overflow-x-auto pb-4 pt-2 px-2 scroll-smooth"
          >
            <div className="relative inline-flex items-center gap-0 min-w-full py-4">
              {/* Glowing Horizontal Spine Rail */}
              <div
                aria-hidden="true"
                className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-1 rounded-full pointer-events-none"
                style={{
                  background: `linear-gradient(90deg, ${theme.goldHex}25 0%, ${theme.goldHex}AA 50%, ${theme.accentHex}45 100%)`,
                }}
              />
              {orderedDisplayItems.map((item, idx) => (
                <React.Fragment key={item.id}>
                  <div className="relative z-10">
                    {renderUnifiedItemCard(item, idx, {
                      variant: 'panoramic',
                    })}
                  </div>
                  {idx < orderedDisplayItems.length - 1 &&
                    renderSemanticConnectorBetween(
                      item,
                      orderedDisplayItems[idx + 1],
                      'horizontal'
                    )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // MODE 2: HERITAGE SCROLL CHARTER (صك وإجازة النسب التراثية)
    if (viewMode === 'heritage_scroll') {
      return (
        <div
          data-testid="lineage-view-heritage_scroll"
          className="relative z-20 max-w-2xl mx-auto rounded-3xl p-6 sm:p-10 overflow-hidden"
          style={{
            backgroundColor: theme.surfaceBg,
            border: `2px solid ${theme.goldBorderHex}`,
            boxShadow: theme.isDark
              ? `inset 0 0 0 8px ${theme.canvasBg}, inset 0 0 0 9.5px ${theme.goldBorderHex}66, 0 18px 40px rgba(31,31,28,0.4)`
              : `inset 0 0 0 8px ${theme.surfaceBg}, inset 0 0 0 9.5px ${theme.goldBorderHex}80, 0 14px 36px rgba(217,119,87,0.1)`,
          }}
        >
          {/* 4 Islamic Geometric Corner Ornaments */}
          <HeritageCornerOrnament
            color={theme.goldHex}
            positionClass="top-3 right-3"
            flipX
          />
          <HeritageCornerOrnament
            color={theme.goldHex}
            positionClass="top-3 left-3"
          />
          <HeritageCornerOrnament
            color={theme.goldHex}
            positionClass="bottom-3 right-3"
            flipX
            flipY
          />
          <HeritageCornerOrnament
            color={theme.goldHex}
            positionClass="bottom-3 left-3"
            flipY
          />

          {/* Manuscript Basmala & Charter Title */}
          <div
            className="text-center pb-5 mb-6 space-y-1.5 relative z-10"
            style={{ borderBottom: `1px dashed ${theme.goldBorderHex}70` }}
          >
            <div
              className="text-lg sm:text-xl font-bold"
              style={{
                fontFamily: fontDef.cssFamily,
                color: theme.accentHex,
              }}
            >
              بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
            </div>
            <div
              className="text-xs sm:text-sm font-semibold"
              style={{
                fontFamily: fontDef.cssFamily,
                color: theme.textMutedHex,
              }}
            >
              ﴿ وَجَعَلْنَاكُمْ شُعُوبًا وَقَبَائِلَ لِتَعَارَفُوا ﴾
            </div>
            <div
              className="text-sm font-display font-extrabold pt-1"
              style={{ color: theme.textPrimaryHex }}
            >
              صك وإجازة عمود نسب عائلة {effectiveResult.familyName}
            </div>
          </div>

          {/* Centered Manuscript Chain */}
          <div className="relative max-w-[440px] mx-auto">
            <div
              aria-hidden="true"
              className="absolute left-1/2 -translate-x-1/2 top-6 bottom-6 w-[2px] rounded-full pointer-events-none"
              style={{ background: theme.railGradient }}
            />

            <div className="flex flex-col items-center relative z-10">
              {!isBottomUp && specialUpper && (
                <>
                  {specialUpper}
                  <div className="w-full flex justify-center relative z-20 py-2">
                    <span
                      className="px-3 py-0.5 rounded-full text-[11px] font-display font-bold"
                      style={{
                        backgroundColor: theme.connectorBg,
                        border: `1px solid ${theme.connectorBorder}`,
                        color: theme.connectorText,
                      }}
                    >
                      ↓ يتصل بـ
                    </span>
                  </div>
                </>
              )}

              {orderedDisplayItems.map((item, idx) => (
                <React.Fragment key={item.id}>
                  {renderUnifiedItemCard(item, idx, {
                    isTopmostCrown:
                      idx === 0 &&
                      item.kind === 'ancestor_node' &&
                      (item.isSummit || item.isRoot),
                    variant: 'scroll',
                  })}
                  {idx < orderedDisplayItems.length - 1 &&
                    renderSemanticConnectorBetween(
                      item,
                      orderedDisplayItems[idx + 1],
                      'vertical'
                    )}
                </React.Fragment>
              ))}

              {isBottomUp && specialUpper && (
                <>
                  <div className="w-full flex justify-center relative z-20 py-2">
                    <span
                      className="px-3 py-0.5 rounded-full text-[11px] font-display font-bold"
                      style={{
                        backgroundColor: theme.connectorBg,
                        border: `1px solid ${theme.connectorBorder}`,
                        color: theme.connectorText,
                      }}
                    >
                      ↑ يتصل بـ
                    </span>
                  </div>
                  {specialUpper}
                </>
              )}
            </div>
          </div>

          {/* Gilded Manuscript Authentication Seal */}
          <div
            className="mt-8 pt-5 flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10"
            style={{ borderTop: `1px dashed ${theme.goldBorderHex}70` }}
          >
            <div className="text-right space-y-0.5">
              <div
                className="text-xs font-display font-extrabold"
                style={{ color: theme.textPrimaryHex }}
              >
                وثيقة مسجّلة في السجل السحابي لمنصة جذوري
              </div>
              <div
                className="text-[11px]"
                style={{ color: theme.textMutedHex }}
              >
                {isBottomUp
                  ? 'تسلسل صاعد من أمين السجل حتى الجذر الموثق'
                  : 'تسلسل تاريخي نازل من الجذر الأعلى إلى الفروع'}
              </div>
            </div>

            <div
              className="w-20 h-20 rounded-full flex flex-col items-center justify-center text-center p-2 shrink-0"
              style={{
                backgroundColor: theme.goldSoftBg,
                border: `2px double ${theme.goldBorderHex}`,
                color: theme.accentTextHex,
              }}
            >
              <Crown
                className="w-4 h-4 mb-0.5"
                style={{ color: theme.goldHex }}
              />
              <span className="text-[10px] font-display font-extrabold leading-tight">
                ختم جذوري
              </span>
              <span className="text-[9px] font-bold opacity-85">موثق ✓</span>
            </div>
          </div>
        </div>
      );
    }

    // MODE 1 (DEFAULT): ROYAL PILLAR (المسبحة العمودية الملكية)
    return (
      <div
        data-testid="lineage-view-royal_pillar"
        className="relative w-full max-w-[460px] mx-auto py-2"
      >
        {/* Single Precision-Centered Vertical Spine Stem */}
        <div
          aria-hidden="true"
          className="absolute left-1/2 -translate-x-1/2 top-6 bottom-6 w-[2px] rounded-full pointer-events-none"
          style={{ background: theme.railGradient }}
        />

        <div className="flex flex-col items-center relative z-10">
          {!isBottomUp && specialUpper && (
            <>
              {specialUpper}
              <div className="w-full flex justify-center relative z-20 py-2">
                <span
                  className="px-3 py-0.5 rounded-full text-[11px] font-display font-bold"
                  style={{
                    backgroundColor: theme.connectorBg,
                    border: `1px solid ${theme.connectorBorder}`,
                    color: theme.connectorText,
                  }}
                >
                  ↓ يتصل بـ
                </span>
              </div>
            </>
          )}

          {orderedDisplayItems.map((item, idx) => (
            <React.Fragment key={item.id}>
              {renderUnifiedItemCard(item, idx, {
                isTopmostCrown:
                  idx === 0 &&
                  item.kind === 'ancestor_node' &&
                  (item.isSummit || item.isRoot),
                variant: 'pillar',
              })}
              {idx < orderedDisplayItems.length - 1 &&
                renderSemanticConnectorBetween(
                  item,
                  orderedDisplayItems[idx + 1],
                  'vertical'
                )}
            </React.Fragment>
          ))}

          {isBottomUp && specialUpper && (
            <>
              <div className="w-full flex justify-center relative z-20 py-2">
                <span
                  className="px-3 py-0.5 rounded-full text-[11px] font-display font-bold"
                  style={{
                    backgroundColor: theme.connectorBg,
                    border: `1px solid ${theme.connectorBorder}`,
                    color: theme.connectorText,
                  }}
                >
                  ↑ يتصل بـ
                </span>
              </div>
              {specialUpper}
            </>
          )}
        </div>
      </div>
    );
  };

  // ============================================================================
  // VERIFICATION FOLLOW-UP NOTE & CANVAS PAN / ZOOM CONTROLS
  // ============================================================================
  const handleZoomIn = () =>
    setZoomScale((z) => Math.min(1.8, Number((z + 0.1).toFixed(2))));

  const handleZoomOut = () =>
    setZoomScale((z) => Math.max(0.45, Number((z - 0.1).toFixed(2))));

  const handleResetZoomCenter = () => {
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
    lineageCanvasViewportRef.current?.scrollTo({
      left: 0,
      top: 0,
      behavior: 'smooth',
    });
    panoramicScrollRef.current?.scrollTo({
      left: 0,
      behavior: 'smooth',
    });
    canvasTopRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
  };

  // Reset pan offset cleanly when switching display modes
  useEffect(() => {
    setPanOffset({ x: 0, y: 0 });
  }, [studioPrefs.viewMode]);

  // Mouse-wheel zoom directly on the Lineage Visualizer Canvas
  useEffect(() => {
    const vp = lineageCanvasViewportRef.current;
    if (!vp) return;
    const handleWheelZoom = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 0.5) return;
      e.preventDefault();
      const step = Math.abs(e.deltaY) < 35 ? 0.04 : 0.08;
      const direction = e.deltaY < 0 ? 1 : -1;
      setZoomScale((prev) =>
        Math.max(0.45, Math.min(1.8, Number((prev + direction * step).toFixed(2))))
      );
    };
    vp.addEventListener('wheel', handleWheelZoom, { passive: false });
    return () => {
      vp.removeEventListener('wheel', handleWheelZoom);
    };
  }, []);

  // Window-level mousemove/mouseup tracking for smooth drag-to-pan on empty canvas areas
  useEffect(() => {
    if (!isCanvasDragging) return;
    const handleWindowMouseMove = (e: MouseEvent) => {
      const drag = lineageDragPanRef.current;
      const vp = lineageCanvasViewportRef.current;
      if (!drag.active || !vp) return;
      e.preventDefault();
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      vp.scrollLeft = drag.scrollLeft - dx;
      vp.scrollTop = drag.scrollTop - dy;
      const actualDx = drag.scrollLeft - vp.scrollLeft;
      const actualDy = drag.scrollTop - vp.scrollTop;
      const remX = dx - actualDx;
      const remY = dy - actualDy;
      setPanOffset({
        x: Math.max(-700, Math.min(700, drag.panX + remX)),
        y: Math.max(-700, Math.min(700, drag.panY + remY)),
      });
    };
    const handleWindowMouseUp = () => {
      lineageDragPanRef.current.active = false;
      setIsCanvasDragging(false);
    };
    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [isCanvasDragging]);

  const handleLineageCanvasMouseDown = (
    e: React.MouseEvent<HTMLDivElement>
  ) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (
      target?.closest(
        'button, input, a, select, textarea, [role="button"], [data-no-canvas-pan="true"]'
      )
    ) {
      return;
    }
    const vp = lineageCanvasViewportRef.current;
    if (!vp) return;
    e.preventDefault();
    lineageDragPanRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: vp.scrollLeft,
      scrollTop: vp.scrollTop,
      panX: panOffsetRef.current.x,
      panY: panOffsetRef.current.y,
    };
    setIsCanvasDragging(true);
  };

  const handleToggleFullscreen = () => setIsFullscreen((prev) => !prev);

  const showAlphaPendingSideNote =
    !isUnmatchedCase &&
    !isVerificationPending &&
    Boolean(
      effectiveResult.isAlphaOnlyBeforeMerge &&
        !effectiveResult.isAlphaMergedIntoAdam &&
        hasLineageConnectionAccess
    );

  const effectiveWalletBalance = Math.max(
    0,
    walletBalance - localWalletDeduction
  );

  const handleUnlockAddonFromLibrary = async (
    addon: VerifiedAddonSourceItem,
    addonKey: string,
    priceUsd: number
  ) => {
    if (processingAddonKey === addonKey) return;
    setAddonWalletWarning(null);
    if (onUnlockVerifiedAddonSource) {
      setProcessingAddonKey(addonKey);
      try {
        const unlockedOk = await onUnlockVerifiedAddonSource(addon);
        if (unlockedOk === true) {
          setLocalUnlockedAddonIds((prev) =>
            prev.includes(addonKey) ? prev : [...prev, addonKey]
          );
        }
      } finally {
        setProcessingAddonKey(null);
      }
      return;
    }
    if (effectiveWalletBalance < priceUsd) {
      setAddonWalletWarning(
        `فتح هذا المرجع الإضافي ($${priceUsd.toFixed(2)}) يتطلب إتمام الفوترة عبر مركز إدارة الاشتراك.`
      );
      return;
    }
    setLocalWalletDeduction((prev) => prev + priceUsd);
    setLocalUnlockedAddonIds((prev) =>
      prev.includes(addonKey) ? prev : [...prev, addonKey]
    );
  };

  // ============================================================================
  // MAIN STUDIO RENDER (Supports Normal & Full-Viewport Majlis Showcase Mode)
  // ============================================================================
  const studioContainerClasses = isFullscreen
    ? 'fixed inset-0 z-[70] overflow-y-auto p-4 sm:p-7 transition-colors duration-200'
    : 'rounded-3xl p-4 sm:p-7 lg:p-8 relative overflow-hidden transition-colors duration-200';

  return (
    <div
      data-testid={`lineage-spine-${stateMode}`}
      className="w-full space-y-3.5 text-right"
    >
      {/* ==================================================================== */}
      {/* 1. UNIFIED WORKSPACE HEADER (Title + Desktop Controls + Actions)     */}
      {/* ==================================================================== */}
      {!isFullscreen && (
        <UnifiedWorkspaceHeader
          testId="lineage-unified-header"
          icon={<JUTHORI_SERVICE_ICONS.lineage className="w-5 h-5" />}
          title={`عمود نسب عائلة ${effectiveResult.familyName}`}
          centerSlot={
            <LineageCanvasFloatingControls
              variant="header"
              zoom={zoomScale}
              isFullscreen={isFullscreen}
              theme={theme}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onResetZoomCenter={handleResetZoomCenter}
              onToggleFullscreen={handleToggleFullscreen}
            />
          }
          actions={
            <>
              <WorkspaceIconTooltip
                label="تخصيص المظهر"
                align={
                  !isResearcherDirectPreview &&
                  !isUnmatchedCase &&
                  caps.isRootUnlocked
                    ? 'center'
                    : 'left'
                }
              >
                <button
                  type="button"
                  data-testid="toggle-lineage-customizer-btn"
                  aria-label="تخصيص المظهر"
                  aria-pressed={isCustomizerOpen}
                  onClick={() => setIsCustomizerOpen((prev) => !prev)}
                  className={
                    isCustomizerOpen
                      ? WORKSPACE_ICON_ACTIVE_BTN_CLASS
                      : WORKSPACE_ICON_BTN_CLASS
                  }
                >
                  <SlidersHorizontal className="w-4 h-4 shrink-0" />
                </button>
              </WorkspaceIconTooltip>

              {!isResearcherDirectPreview &&
                !isUnmatchedCase &&
                caps.isRootUnlocked && (
                  <WorkspaceIconTooltip
                    label="تصدير صك النسب"
                    align="left"
                  >
                    <button
                      type="button"
                      data-testid="open-lineage-official-export-btn"
                      aria-label="تصدير صك النسب"
                      onClick={() => setShowOfficialExportModal(true)}
                      className={WORKSPACE_PRIMARY_ICON_BTN_CLASS}
                    >
                      <ScrollText className="w-4 h-4 shrink-0" />
                    </button>
                  </WorkspaceIconTooltip>
                )}
            </>
          }
        />
      )}

      <div
        ref={canvasTopRef}
        className={studioContainerClasses}
        style={{
          ...canvasBackdropStyle,
          border: isFullscreen ? 'none' : `1.5px solid ${theme.canvasBorder}`,
          boxShadow: isFullscreen
            ? undefined
            : theme.isDark
            ? '0 16px 40px rgba(31,31,28,0.35)'
            : '0 8px 30px rgba(217,119,87,0.06)',
        }}
      >
        <div
          className={
            isFullscreen ? 'w-full max-w-7xl mx-auto space-y-5' : 'w-full space-y-4'
          }
        >
          {/* ================================================================ */}
          {/* 1B. FULLSCREEN-ONLY TOP BAR (No extra chrome in normal view)     */}
          {/* ================================================================ */}
          {isFullscreen && (
            <div
              data-testid="lineage-canvas-control-bar"
              className="relative z-20 pb-3.5 flex flex-wrap min-[1180px]:flex-nowrap items-center justify-between gap-2.5"
              style={{ borderBottom: `1px solid ${theme.surfaceBorder}` }}
            >
              <h2
                className="text-lg sm:text-xl font-extrabold tracking-tight"
                style={{
                  fontFamily: fontDef.cssFamily,
                  color: theme.textPrimaryHex,
                }}
              >
                عمود نسب عائلة {effectiveResult.familyName}
              </h2>

              <div className="flex items-center justify-center gap-2 shrink-0">
                <div className="hidden min-[1180px]:inline-flex items-center shrink-0">
                  <LineageCanvasFloatingControls
                    variant="inline"
                    zoom={zoomScale}
                    isFullscreen={isFullscreen}
                    theme={theme}
                    onZoomIn={handleZoomIn}
                    onZoomOut={handleZoomOut}
                    onResetZoomCenter={handleResetZoomCenter}
                    onToggleFullscreen={handleToggleFullscreen}
                  />
                </div>

                <WorkspaceIconTooltip label="إغلاق العرض الكامل" align="left">
                  <button
                    type="button"
                    onClick={() => setIsFullscreen(false)}
                    aria-label="إغلاق العرض الكامل"
                    className="w-9 h-9 rounded-xl inline-flex items-center justify-center cursor-pointer shrink-0 transition-colors"
                    style={{
                      backgroundColor: theme.surfaceBg,
                      border: `1px solid ${theme.surfaceBorder}`,
                      color: theme.textPrimaryHex,
                    }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </WorkspaceIconTooltip>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* 2. COMPACT 2-ROW CUSTOMIZATION BAR (Collapsible)                 */}
          {/* ================================================================ */}
          <LineageCustomizationPanel
            isOpen={isCustomizerOpen}
            prefs={studioPrefs}
            theme={theme}
            onUpdatePrefs={updateStudioPrefs}
            onResetDefaults={resetStudioPrefs}
            onClose={() => setIsCustomizerOpen(false)}
          />

          {/* ================================================================ */}
          {/* 3. MULTI-MODE LINEAGE VISUALIZER CANVAS (Pannable & Zoomable)    */}
          {/* ================================================================ */}
          <div
            ref={lineageCanvasViewportRef}
            onMouseDown={handleLineageCanvasMouseDown}
            className={`relative z-20 py-4 overflow-auto touch-pan-x touch-pan-y ${
              isFullscreen ? 'flex-1 min-h-0' : 'min-h-[420px] max-h-[78vh]'
            } ${
              isCanvasDragging ? 'cursor-grabbing select-none' : 'cursor-grab'
            }`}
          >
            <div
              className={`${
                isCanvasDragging ? '' : 'transition-transform duration-150'
              } origin-top`}
              style={{
                transform:
                  panOffset.x !== 0 || panOffset.y !== 0 || zoomScale !== 1
                    ? `translate3d(${panOffset.x}px, ${panOffset.y}px, 0) scale(${zoomScale})`
                    : undefined,
                width:
                  zoomScale > 1 ? `${Math.round(100 / zoomScale)}%` : undefined,
                marginInline: 'auto',
              }}
            >
              {renderLineageVisualizerBody()}
            </div>
          </div>

          {/* ================================================================ */}
          {/* 4. FLOATING CANVAS CONTROLS (Tablet/Mobile < 1200px only)        */}
          {/* ================================================================ */}
          <div className="min-[1200px]:hidden">
            <LineageCanvasFloatingControls
              variant="floating"
              zoom={zoomScale}
              isFullscreen={isFullscreen}
              theme={theme}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onResetZoomCenter={handleResetZoomCenter}
              onToggleFullscreen={handleToggleFullscreen}
            />
          </div>

          {/* ================================================================ */}
          {/* 5. CLASSICAL ARABIC NASAB NARRATION BAR                          */}
          {/* ================================================================ */}
          {studioPrefs.showNasabStrip &&
            !isUnmatchedCase &&
            !isVerificationPending &&
            classicalNasabText && (
              <ClassicalNasabNarrationBar
                narrationText={classicalNasabText}
                theme={theme}
                fontId={studioPrefs.fontId}
                onHideStrip={() => updateStudioPrefs({ showNasabStrip: false })}
              />
            )}

          {/* ================================================================ */}
          {/* 6. LUXURY REFERENCE LIBRARY (خزانة الشواهد والمصادر التاريخية)   */}
          {/* ================================================================ */}
          {!isUnmatchedCase &&
            !isVerificationPending &&
            hasLineageConnectionAccess &&
            !isFullscreen && (
              <LuxuryReferenceLibrary
                familyName={effectiveResult.familyName}
                isUnlocked={isSourcesUnlocked}
                lockedSourcesCount={Math.max(
                  1,
                  effectiveResult.verified_sources?.length ||
                    effectiveResult.secondarySources?.length ||
                    1
                )}
                aggregatedSources={aggregatedSources}
                verifiedAddonList={verifiedAddonList}
                unlockedAddonSourceIds={unlockedAddonSourceIds}
                localUnlockedAddonIds={localUnlockedAddonIds}
                processingAddonKey={processingAddonKey}
                addonWalletWarning={addonWalletWarning}
                onUnlockAddon={handleUnlockAddonFromLibrary}
                siblingBranches={aggregatedSiblings}
                enrichedLocations={effectiveResult.enrichedLocations || []}
                selectedAncestor={selectedAncestor}
                onUpgradeAnnualVip={onUpgradeAnnualVip}
                theme={theme}
                fontId={studioPrefs.fontId}
              />
            )}

          {/* Official Calm Credibility Disclaimer for Basic & Premium Lineage Search */}
          {hasLineageConnectionAccess && !isFullscreen && (
            <p
              data-testid="lineage-official-credibility-disclaimer"
              className="relative z-20 max-w-4xl mx-auto w-full text-center text-[11px] text-[#1F1F1C]/65 leading-relaxed pt-1"
            >
              {officialMatchingDisclaimer}
            </p>
          )}

          {/* ================================================================ */}
          {/* 7. SLIM VERIFICATION FOLLOW-UP FOOTER RIBBON (Below Library)     */}
          {/* ================================================================ */}
          {showAlphaPendingSideNote && !isFullscreen && (
            <aside
              data-testid="alpha-vip-researcher-followup-card"
              aria-label="ملاحظة متابعة التوثيق"
              className="relative z-20 max-w-4xl mx-auto w-full rounded-xl px-4 py-2.5 transition-colors"
              style={{
                backgroundColor: theme.surfaceAltBg,
                border: `1px solid ${theme.goldBorderHex}50`,
              }}
            >
              <button
                type="button"
                onClick={() => setIsFollowUpNoteOpen((prev) => !prev)}
                aria-expanded={isFollowUpNoteOpen}
                data-testid="alpha-vip-followup-toggle-btn"
                className="w-full flex items-center justify-between gap-3 text-right cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Sparkles
                    className="w-3.5 h-3.5 shrink-0"
                    style={{ color: theme.goldHex }}
                  />
                  <span
                    className="text-[11.5px] font-display font-bold truncate"
                    style={{ color: theme.textSecondaryHex }}
                  >
                    متابعة التوثيق — جاري استكمال ربط الطبقات العليا حتى آدم عليه السلام
                  </span>
                </div>
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-display font-bold shrink-0"
                  style={{ color: theme.accentTextHex }}
                >
                  <span>{isFollowUpNoteOpen ? 'إخفاء' : 'التفاصيل'}</span>
                  {isFollowUpNoteOpen ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </span>
              </button>

              {isFollowUpNoteOpen && (
                <p
                  className="mt-2 pt-2 text-[11.5px] leading-relaxed"
                  style={{
                    borderTop: `1px solid ${theme.surfaceBorder}`,
                    color: theme.textSecondaryHex,
                  }}
                >
                  باقتك السنوية مفعّلة — يعمل فريق النسابين حالياً على المراجعة النهائية لوصل (
                  {result.rootTribeName?.startsWith('قبيلة')
                    ? result.rootTribeName
                    : `قبيلة ${getCleanSpineNodeName(result.rootTribeName || 'العقيدات')}`}
                  ) بعمودها التاريخي الأعلى، وستظهر العُقد المفتوحة تلقائياً فور اعتمادها.
                </p>
              )}
            </aside>
          )}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* DIRECT FAMILY VAULT MODAL (Preserved 100%, Warm Gold Palette)        */}
      {/* ==================================================================== */}
      {!isResearcherDirectPreview &&
        showDirectFamilyVaultModal &&
        (() => {
          const cleanFam = getCleanSpineNodeName(effectiveResult.familyName);
          const linkedFamilyMedia = vaultItems.filter((vi) =>
            vi.linkedPersonIds.includes(DIRECT_FAMILY_VAULT_NODE_ID)
          );
          const unlinkedVaultMedia = vaultItems.filter(
            (vi) => !vi.linkedPersonIds.includes(DIRECT_FAMILY_VAULT_NODE_ID)
          );

          return (
            <div
              data-testid="direct-family-vault-modal"
              className="fixed inset-0 z-[75] bg-[#1F1F1C]/65 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
              role="dialog"
              aria-modal="true"
              aria-label={`وثائق وصور العائلة المباشرة (${cleanFam})`}
            >
              <div
                dir="rtl"
                className="bg-[#F5F1E8] border-2 border-[#D8C7B2] rounded-3xl max-w-2xl w-full p-5 sm:p-6 space-y-4 text-right shadow-2xl my-8 max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-start justify-between gap-3 border-b border-[#D97757]/30 pb-3">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-xs font-display font-bold text-[#D97757] mb-0.5">
                      <Paperclip className="w-3.5 h-3.5 text-[#D97757]" />
                      <span>العائلة المباشرة — بيت النسب ({cleanFam})</span>
                    </div>
                    <h4 className="text-base sm:text-lg font-display font-extrabold text-[#1F1F1C]">
                      وثائق وصور هذا الفرد في خزانتي ({linkedFamilyMedia.length})
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDirectFamilyVaultModal(false)}
                    className="w-8 h-8 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] flex items-center justify-center text-[#1F1F1C] cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {familyVaultFeedback && (
                  <div className="rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] px-3.5 py-2.5 text-xs font-bold text-[#1F1F1C]">
                    {familyVaultFeedback}
                  </div>
                )}

                {linkedFamilyMedia.length === 0 ? (
                  <div className="rounded-xl bg-[#F5F1E8] border border-[#D97757]/35 p-3.5 text-xs text-[#1F1F1C]/75">
                    لا توجد صور أو وثائق مربوطة بالعائلة المباشرة ({cleanFam}) حالياً. يمكنك رفع صورة أو وثيقة جديدة أدناه أو ربط ملف موجود من «خزانتي».
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-0.5">
                    {linkedFamilyMedia.map((media) => {
                      const thumbSrc =
                        media.thumbnailDataUrl || media.fileDataUrl;
                      const showImg =
                        media.mediaType === 'photo' ||
                        thumbSrc.startsWith('data:image');
                      return (
                        <div
                          key={media.id}
                          className="rounded-xl bg-[#F5F1E8] border border-[#D8C7B2]/60 p-2.5 flex items-center justify-between gap-2.5 shadow-2xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-11 h-11 rounded-lg bg-[#F5F1E8] border border-[#D97757]/35 overflow-hidden shrink-0 flex items-center justify-center">
                              {showImg ? (
                                <img
                                  src={thumbSrc}
                                  alt={media.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <FileText className="w-5 h-5 text-[#D97757]" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-display font-extrabold text-[#1F1F1C] truncate">
                                {media.title}
                              </div>
                              <div className="text-[10px] text-[#D97757] font-semibold">
                                {media.mediaType === 'photo'
                                  ? 'صورة'
                                  : 'وثيقة'}{' '}
                                · {media.dateOrOccasion}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleVaultItemForDirectFamily(media.id)
                            }
                            className="px-2 py-1 rounded-lg bg-[#F5F1E8] hover:bg-[#E8DED2] text-[#D97757] text-[10px] font-bold shrink-0 cursor-pointer"
                          >
                            فك الربط
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="rounded-2xl bg-[#F5F1E8] border border-[#D97757]/45 p-3.5 space-y-2.5">
                  <div className="text-xs font-display font-bold text-[#D97757]">
                    + رفع صورة أو وثيقة جديدة للعائلة المباشرة (تُحفظ وتُربط تلقائياً في خزانتي):
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={familyVaultUploadTitle}
                      onChange={(e) =>
                        setFamilyVaultUploadTitle(e.target.value)
                      }
                      placeholder="عنوان الصورة أو الوثيقة..."
                      className="px-3 py-2 rounded-xl bg-[#F5F1E8] border border-[#D97757]/45 text-xs text-[#1F1F1C]"
                    />
                    <select
                      value={familyVaultUploadFolderId}
                      onChange={(e) =>
                        setFamilyVaultUploadFolderId(e.target.value)
                      }
                      className="px-2.5 py-2 rounded-xl bg-[#F5F1E8] border border-[#D97757]/45 text-xs font-bold text-[#1F1F1C]"
                    >
                      {vaultFolders.map((vf) => (
                        <option key={vf.id} value={vf.id}>
                          {vf.icon} {vf.name}
                        </option>
                      ))}
                    </select>
                    <label className="px-3 py-2 rounded-xl bg-[#D97757] hover:bg-[#D97757]/90 text-[#F5F1E8] text-xs font-display font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition-colors">
                      {isUploadingFamilyVault ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>جاري الحفظ...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
                          <span>اختيار ملف ورفعه</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        disabled={isUploadingFamilyVault}
                        className="hidden"
                        onChange={(e) => {
                          handleUploadDirectFamilyVaultFile(e.target.files);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                </div>

                {unlinkedVaultMedia.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[11px] font-display font-bold text-[#1F1F1C] flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-[#D97757]" />
                      <span>أو اربط ملفاً موجوداً مسبقاً في «خزانتي»:</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {unlinkedVaultMedia.map((uv) => (
                        <button
                          key={uv.id}
                          type="button"
                          onClick={() =>
                            handleToggleVaultItemForDirectFamily(uv.id)
                          }
                          className="px-2.5 py-1 rounded-full bg-[#F5F1E8] hover:bg-[#D97757] text-[#1F1F1C] hover:text-[#F5F1E8] border border-[#D97757]/45 text-[11px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <span>+ {uv.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-3 border-t border-[#D97757]/30 flex flex-wrap items-center justify-between gap-2">
                  {onOpenVaultForPerson ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowDirectFamilyVaultModal(false);
                        onOpenVaultForPerson(DIRECT_FAMILY_VAULT_NODE_ID);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D97757]/50 text-xs font-display font-bold text-[#D97757] cursor-pointer"
                    >
                      عرض في خزانتي
                    </button>
                  ) : (
                    <span />
                  )}

                  <button
                    type="button"
                    onClick={() => setShowDirectFamilyVaultModal(false)}
                    className="px-5 py-2 rounded-xl bg-[#D97757] hover:bg-[#D97757]/90 text-[#F5F1E8] text-xs font-display font-extrabold cursor-pointer shadow-2xs"
                  >
                    تم وإغلاق ✓
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* ==================================================================== */}
      {/* UPGRADED OFFICIAL CHARTER EXPORT MODAL                               */}
      {/* ==================================================================== */}
      {!isResearcherDirectPreview && (
        <OfficialBrandedExportModal
          isOpen={showOfficialExportModal}
          onClose={() => setShowOfficialExportModal(false)}
          exportKind="lineage_spine"
          result={effectiveResult}
          accountType={accountType}
          caps={caps}
          userId={userId}
          unlockedCapsules={unlockedCapsules}
          posterOptions={lineageExportPosterOptions}
          onUnlockRoot5Usd={onUnlockRoot5Usd}
          onUpgradeAnnualVip={onUpgradeAnnualVip}
          onSignCharterAndEnableTree={onSignCharterAndEnableTree}
          onLogExport={(formatLabel, verificationId) =>
            onLogActivity?.(
              'تصدير صك عمود النسب الموثق',
              `تصدير ${formatLabel} (${theme.label}) برمز التحقق المرجعي (${verificationId})`
            )
          }
        />
      )}
    </div>
  );
};
