import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  Award,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Cloud,
  Compass,
  Copy,
  Crosshair,
  Crown,
  Download,
  Edit2,
  FileSignature,
  FileText,
  GitFork,
  Heart,
  Layers,
  Link2,
  Loader2,
  Lock,
  MapPin,
  Paperclip,
  Plus,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import {
  AccountLegalType,
  AncestorCapsule,
  DashboardAccessCapabilities,
  LineageSearchResult,
  SpineConnectorLabel,
  UpperAncestorNode,
} from '../types/juthori';
import { resolveSpineConnectorLabel } from '../utils/lineageEngine';
import { resolveClientPublicAppBaseUrl } from '../config/referralAndSiteConfig';
import {
  HeritageNodeAvatar,
  getHistoricalEraBadgeLabel,
  resolveNodeHistoricalEra,
} from './HeritageNodeAvatar';
import {
  DEFAULT_STARTER_VAULT_FOLDERS,
  DIRECT_FAMILY_VAULT_NODE_ID,
  FamilyVaultMediaItem,
  VaultFolderRecord,
  ensureDirectFamilyInVaultSummaries,
  fetchUserFamilyTreeFromFirebase,
  fetchUserTreeDisplaySettingsFromFirebase,
  fetchUserVaultArchive,
  getTreeStorageKeyForVaultSync,
  readUserFamilyTreeFromLocal,
  readVaultArchiveFromLocal,
  saveMirrorDefaultTreeSettingsToFirebase,
  saveUserFamilyTreeToFirebase,
  saveUserFamilyTreeToLocal,
  saveUserTreeDisplaySettingsToFirebase,
  saveUserVaultArchive,
  uploadTreeNodeAvatarWithFallback,
} from '../services/firestoreService';
import {
  processMediaFileForUpload,
  uploadMediaToCloudWithFallback,
} from '../utils/mediaPipeline';
import { OfficialBrandedExportModal } from './OfficialBrandedExportModal';
import { ExportTreeMemberSummary } from '../utils/brandedExport';
import {
  PedigreeTreeNode,
  buildPedigreeTreeLayout,
  calculateKinshipPath,
  collectCascadeDeleteIds,
  collectTopSiblingGroupIds,
  countTreeNodeDescendants,
  partitionChildrenByMotherUnion,
  partitionSpousesAroundHusband,
  resolveNodeQuickActionPolicy,
} from '../utils/familyTreeLayout';
import {
  DEFAULT_TREE_DISPLAY_SETTINGS,
  TREE_CARD_THEMES,
  TreeDisplaySettings,
  TreePrestigeBadgeId,
  TreeSettingsTabId,
  formatTreeDateByCalendarMode,
  getTreeArabicFontDefinition,
  getTreeCanvasBackgroundStyle,
  normalizeTreeDisplaySettings,
  resolvePrestigeBadgeMeta,
} from '../utils/treeStudioConfig';
import { RadialFamilyTreeCharts } from './RadialFamilyTreeCharts';
import { TreeStudioSideInspector } from './TreeStudioSideInspector';
import {
  TreeFloatingStudioDock,
  TreeInteractiveMinimap,
  TreeKinshipCalculatorModal,
  TreeSmartNodeSearch,
} from './TreeCanvasPowerTools';
import {
  ArabicHonorificTitle,
  BirthPrecisionMode,
  FEMALE_HONORIFIC_TITLES,
  MALE_HONORIFIC_TITLES,
  NEW_MOTHER_SENTINEL,
  TreePersonStudioModal,
} from './TreePersonStudioModal';

export type { ArabicHonorificTitle, BirthPrecisionMode };
export { MALE_HONORIFIC_TITLES, FEMALE_HONORIFIC_TITLES };

export const ARABIC_HONORIFIC_TITLES: ArabicHonorificTitle[] = [
  ...MALE_HONORIFIC_TITLES,
];

export type RelativeRelationKind =
  | 'father'
  | 'mother'
  | 'vertical_ancestor'
  | 'bridge_above_family'
  | 'horizontal_branch_above_family'
  | 'spouse'
  | 'brother'
  | 'sister'
  | 'son'
  | 'daughter';

export type TreeSpineDepthMode =
  | 'family'
  | 'sub_branch'
  | 'mother_tribe'
  | 'historical_stock'
  | 'adam_full';

export interface InteractiveTreePerson {
  id: string;
  firstName: string;
  familyName: string;
  kunya: string;
  honorificTitle: ArabicHonorificTitle;
  prestigeBadge?: TreePrestigeBadgeId;
  gender: 'male' | 'female';
  /**
   * Generational level relative to the Record Keeper:
   * <= 0 = Sons / Daughters / Grandchildren of Record Keeper
   * 1 = Record Keeper (أمين السجل) & spouses/siblings
   * 2 = Father (الأب) & Mother
   * 3 = 1st Grandfather (الجد الأول)
   * 4 = 2nd Grandfather (الجد الثاني)
   * 5 = 3rd Grandfather (الجد الثالث)
   * 6 = 4th Grandfather (الجد الرابع)
   * 7 = 5th Grandfather (الجد الخامس — بداية نطاق التفرع العائلي الكامل نزولاً)
   * 8+ = 6th Grandfather and above (عُقد عمودية فقط كحلقات مفقودة تُربط بنقطة الجذر دون تفرع أفقي)
   */
  generationLevel: number;
  isRecordKeeper?: boolean;
  isDirectSpineLineage?: boolean;
  relationToTargetLabel: string;
  fatherId?: string;
  motherId?: string;
  siblingOfId?: string;
  motherNameFallback?: string;
  spouseIds: string[];
  /** Optional noble maiden family / lineage note for a married-in wife */
  maidenFamilyLine?: string;
  /** Optional marriage alliance / spouse family note for a daughter */
  marriageAllianceNote?: string;
  vitalStatus: 'unspecified' | 'living' | 'deceased';
  birthPrecision: BirthPrecisionMode;
  birthCalendar: 'hijri' | 'gregorian';
  birthDateValue: string;
  birthPlace: string;
  deathDateValue?: string;
  deathPlace?: string;
  /** Arabic Family Privacy Option for female members */
  femalePrivacyMasked: boolean;
  contactInfo?: string;
  biography?: string;
  attachedDocName?: string;
  photoUrl?: string;
  photoThumbnailUrl?: string;
  photoStoragePath?: string;
  /** Nodes added in the zone above Direct Family (`العائلة المباشرة`) up to the Root (`الجذر`) */
  isBridgeAboveFamily?: boolean;
  bridgeTier?: number;
  /** Legacy flag scrubbed on hydration (Root upward is strictly read-only from verified spine) */
  isCertifiedReference?: boolean;
  referenceSourceNodeId?: string;
  referenceRankLabel?: string;
}

interface InteractiveFamilyTreeBuilderProps {
  result: LineageSearchResult;
  accountType: AccountLegalType;
  caps: DashboardAccessCapabilities;
  onUnlockRoot5Usd?: () => void;
  onUpgradeAnnualVip: () => void;
  onSignCharterAndEnableTree: () => void;
  onLogActivity: (action: string, detail: string) => void;
  onSyncImmediateParents?: (fatherName: string, grandfatherName: string) => void;
  unlockedCapsules?: string[];
  onRequestUnlockCapsule?: (capsule: AncestorCapsule) => void;
  onRequestUnlockAllCapsulesBundle?: () => void;
  walletBalance?: number;
  extraTreeCapacity?: number;
  onPurchaseExtraTreeCapacity?: (
    extraSlots: number,
    priceUsd: number
  ) => Promise<{
    ok: boolean;
    shortfallUsd?: number;
    balanceAfter?: number;
    errorMessage?: string;
  }>;
  onOpenWalletDrawer?: () => void;
  userAvatarUrl?: string;
  userId?: string;
  userEmail?: string;
  onOpenVaultForPerson?: (personId: string) => void;
  onRequestReferenceCorrectionTicket?: (
    personName: string,
    referenceRank?: string
  ) => void;
}

/**
 * 5th Grandfather boundary (`الجد الخامس` = generationLevel 7):
 * - Level <= 7: Full family branching allowed (spouses, sons/daughters; plus parents/siblings for <= 6)
 * - Level >= 8: Strictly vertical-only ancestor links toward the Root (zero horizontal branching)
 */
const FIFTH_GRANDFATHER_LEVEL = 7;

const ARABIC_ORDINAL_GRANDFATHER: Record<number, string> = {
  2: 'الأب',
  3: 'الجد الأول',
  4: 'الجد الثاني',
  5: 'الجد الثالث',
  6: 'الجد الرابع',
  7: 'الجد الخامس',
  8: 'الجد السادس',
  9: 'الجد السابع',
  10: 'الجد الثامن',
  11: 'الجد التاسع',
  12: 'الجد العاشر',
  13: 'الجد الحادي عشر',
  14: 'الجد الثاني عشر',
};

const getNextVerticalGrandfatherLabel = (nextLevel: number): string => {
  return ARABIC_ORDINAL_GRANDFATHER[nextLevel] || `الجد رقم ${nextLevel - 2}`;
};

function cleanNaturalSpineName(rawName?: string): string {
  return String(rawName || '')
    .replace(/^(القبيلة الأم|الفرع الجامع|العائلة المباشرة)\s*:\s*/u, '')
    .replace(/^(من قبيلة|قبيلة|قبائل|فرع|عائلة)\s+/u, '')
    .trim();
}

/**
 * Parses initial registration fatherName & grandfatherName cleanly
 */
function parseInitialRegistrationAncestors(
  rawFather?: string,
  rawGrandfather?: string
): { fatherFirst: string; grandfatherFirst: string } {
  const clean = (s?: string) =>
    s && s.trim() && s.trim() !== '—' ? s.trim() : '';

  const fRaw = clean(rawFather);
  const gRaw = clean(rawGrandfather);

  if (fRaw && gRaw) {
    return { fatherFirst: fRaw, grandfatherFirst: gRaw };
  }

  if (fRaw) {
    const binParts = fRaw
      .split(/\s+(?:بن|ابن)\s+/i)
      .map((p) => p.trim())
      .filter(Boolean);
    if (binParts.length >= 2) {
      return {
        fatherFirst: binParts[0],
        grandfatherFirst: binParts[1],
      };
    }
  }

  return {
    fatherFirst: fRaw,
    grandfatherFirst: gRaw,
  };
}

export const InteractiveFamilyTreeBuilder: React.FC<
  InteractiveFamilyTreeBuilderProps
> = ({
  result,
  accountType,
  caps,
  onUnlockRoot5Usd,
  onUpgradeAnnualVip,
  onSignCharterAndEnableTree,
  onLogActivity,
  onSyncImmediateParents,
  unlockedCapsules = [],
  onRequestUnlockCapsule,
  onRequestUnlockAllCapsulesBundle,
  walletBalance = 0,
  extraTreeCapacity = 0,
  onPurchaseExtraTreeCapacity,
  onOpenWalletDrawer,
  userAvatarUrl,
  userId,
  userEmail,
  onOpenVaultForPerson,
  onRequestReferenceCorrectionTicket,
}) => {
  const effectiveMaxTreeMembers = (caps.maxTreeMembers || 250) + extraTreeCapacity;
  const formatSavedDateTime = (d: Date) =>
    d.toLocaleString('ar-SA', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const [showCapacityAddonModal, setShowCapacityAddonModal] = useState(false);
  const [capacityPurchaseLoadingId, setCapacityPurchaseLoadingId] = useState<string | null>(null);
  const [capacityPurchaseFeedback, setCapacityPurchaseFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
    shortfallUsd?: number;
  } | null>(null);

  const TREE_CAPACITY_ADDON_PACKAGES = [
    { id: 'cap_100', extraSlots: 100, priceUsd: 5, label: '+100 فرد إضافي' },
    { id: 'cap_250', extraSlots: 250, priceUsd: 10, label: '+250 فرد إضافي' },
    { id: 'cap_500', extraSlots: 500, priceUsd: 18, label: '+500 فرد إضافي' },
  ];

  const handleBuyCapacityAddon = async (
    pkg: (typeof TREE_CAPACITY_ADDON_PACKAGES)[number]
  ) => {
    setCapacityPurchaseFeedback(null);
    if (!onPurchaseExtraTreeCapacity) {
      setCapacityPurchaseFeedback({
        type: 'error',
        message: 'خدمة إضافة السعة من المحفظة غير متاحة حالياً.',
      });
      return;
    }
    setCapacityPurchaseLoadingId(pkg.id);
    try {
      const res = await onPurchaseExtraTreeCapacity(pkg.extraSlots, pkg.priceUsd);
      if (!res.ok) {
        setCapacityPurchaseFeedback({
          type: 'error',
          message:
            res.shortfallUsd && res.shortfallUsd > 0
              ? `رصيد المحفظة غير كافٍ. تحتاج إلى شحن $${res.shortfallUsd} إضافية لإتمام العملية.`
              : res.errorMessage || 'تعذر إتمام الخصم من المحفظة.',
          shortfallUsd: res.shortfallUsd,
        });
      } else {
        setCapacityPurchaseFeedback({
          type: 'success',
          message: `تمت إضافة ${pkg.extraSlots} فرداً إلى سعة الشجرة بنجاح (خُصم $${pkg.priceUsd} من رصيد المحفظة).`,
        });
        setQuotaUpgradePrompt(null);
      }
    } finally {
      setCapacityPurchaseLoadingId(null);
    }
  };
  // Strict Charter Gate: Adding or editing nodes requires signing the Record Keeper Charter (`ميثاق أمين السجل`)
  const isRecordKeeperCharterSigned =
    accountType === AccountLegalType.RecordKeeper;

  // Build initial tree nodes from registration data strictly using ONLY what the user entered (Zero Fabrication)
  const buildInitialTree = (): InteractiveTreePerson[] => {
    const { fatherFirst, grandfatherFirst } = parseInitialRegistrationAncestors(
      result.fatherName,
      result.grandfatherName
    );

    const nodes: InteractiveTreePerson[] = [];

    const recordKeeperId = 'node-record-keeper';
    const fatherId =
      fatherFirst || grandfatherFirst ? 'node-auto-father' : undefined;
    const grandfatherId = grandfatherFirst ? 'node-auto-grandfather' : undefined;

    // 1. Record Keeper (أمين السجل — فقط الاسم المسجل دون افتراض كنية أو تاريخ أو لقب)
    nodes.push({
      id: recordKeeperId,
      firstName: result.clientName || 'المستخدم',
      familyName: '',
      kunya: '',
      honorificTitle: 'بدون',
      gender: 'male',
      generationLevel: 1,
      isRecordKeeper: true,
      isDirectSpineLineage: true,
      relationToTargetLabel: 'أمين السجل',
      fatherId,
      spouseIds: [],
      vitalStatus: 'unspecified',
      birthPrecision: 'year_only',
      birthCalendar: 'hijri',
      birthDateValue: '',
      birthPlace: '',
      femalePrivacyMasked: false,
      photoUrl: userAvatarUrl || undefined,
    });

    // 2. Father if provided during registration (or bridge if grandfather was provided)
    if (fatherFirst || grandfatherFirst) {
      nodes.push({
        id: 'node-auto-father',
        firstName: fatherFirst || 'الأب',
        familyName: '',
        kunya: '',
        honorificTitle: 'بدون',
        gender: 'male',
        generationLevel: 2,
        isDirectSpineLineage: true,
        relationToTargetLabel: 'الأب',
        fatherId: grandfatherId,
        spouseIds: [],
        vitalStatus: 'unspecified',
        birthPrecision: 'year_only',
        birthCalendar: 'hijri',
        birthDateValue: '',
        birthPlace: '',
        femalePrivacyMasked: false,
      });
    }

    // 3. 1st Grandfather (`الجد الأول`) if provided during registration
    if (grandfatherFirst) {
      nodes.push({
        id: 'node-auto-grandfather',
        firstName: grandfatherFirst,
        familyName: '',
        kunya: '',
        honorificTitle: 'بدون',
        gender: 'male',
        generationLevel: 3,
        isDirectSpineLineage: true,
        relationToTargetLabel: 'الجد الأول',
        spouseIds: [],
        vitalStatus: 'unspecified',
        birthPrecision: 'year_only',
        birthCalendar: 'hijri',
        birthDateValue: '',
        birthPlace: '',
        femalePrivacyMasked: false,
      });
    }

    return nodes;
  };

  /**
   * Cleans hydrated nodes so:
   * 1. Legacy imported `isCertifiedReference` nodes are removed (Root upward is 100% read-only from verified spine).
   * 2. Legacy auto-seeded fake years (`1410`, `1380`, `1348`, `1422`), fake `الشيخ` honorific, fake `أبو ...` kunyas,
   *    and unconfirmed `deceased` status on auto-created nodes are scrubbed immediately.
   */
  const sanitizeHydratedTreeNodes = (
    rawNodes: InteractiveTreePerson[]
  ): InteractiveTreePerson[] => {
    const { fatherFirst } = parseInitialRegistrationAncestors(
      result.fatherName,
      result.grandfatherName
    );
    const removedCertIds = new Set(
      rawNodes.filter((n) => n.isCertifiedReference).map((n) => n.id)
    );
    const defaultRegion = (
      result.originRegion ||
      result.originCountry ||
      ''
    ).trim();

    const filtered = rawNodes.filter((n) => !n.isCertifiedReference);
    if (filtered.length === 0) {
      return buildInitialTree();
    }

    return filtered.map((node) => {
      const isAutoSeedNode =
        node.id === 'node-record-keeper' ||
        node.id === 'node-auto-father' ||
        node.id === 'node-auto-grandfather' ||
        node.id.startsWith('node-father-shared-');

      let cleanKunya = (node.kunya || '').trim();
      if (isAutoSeedNode) {
        const autoKunyas = new Set(
          [
            fatherFirst ? `أبو ${fatherFirst}` : '',
            result.clientName ? `أبو ${result.clientName}` : '',
          ].filter(Boolean)
        );
        if (autoKunyas.has(cleanKunya)) {
          cleanKunya = '';
        }
      }

      let cleanBirthDate = (node.birthDateValue || '').trim();
      let cleanDeathDate = node.deathDateValue?.trim() || undefined;
      let cleanHonorific: ArabicHonorificTitle = node.honorificTitle || 'بدون';
      let cleanVitalStatus: 'unspecified' | 'living' | 'deceased' =
        node.vitalStatus === 'deceased' ||
        node.vitalStatus === 'living' ||
        node.vitalStatus === 'unspecified'
          ? node.vitalStatus
          : 'unspecified';
      let cleanBirthPlace = (node.birthPlace || '').trim();
      let cleanDeathPlace = node.deathPlace?.trim() || undefined;
      let cleanBio = node.biography;

      if (
        node.id === 'node-record-keeper' &&
        cleanBirthDate === '1410'
      ) {
        cleanBirthDate = '';
        cleanVitalStatus = 'unspecified';
        if (cleanBirthPlace === defaultRegion) cleanBirthPlace = '';
        if (
          cleanBio ===
          `أمين سجل عائلة ${result.familyName} المعتمد في منصة جذوري.`
        ) {
          cleanBio = undefined;
        }
      }

      if (node.id === 'node-auto-father' && cleanBirthDate === '1380') {
        cleanBirthDate = '';
        cleanVitalStatus = 'unspecified';
        if (cleanBirthPlace === defaultRegion) cleanBirthPlace = '';
      }

      if (
        node.id === 'node-auto-grandfather' &&
        (cleanBirthDate === '1348' || cleanDeathDate === '1422')
      ) {
        if (cleanBirthDate === '1348') cleanBirthDate = '';
        if (cleanDeathDate === '1422') cleanDeathDate = undefined;
        if (cleanHonorific === 'الشيخ') cleanHonorific = 'بدون';
        if (cleanVitalStatus === 'deceased') cleanVitalStatus = 'unspecified';
        if (cleanBirthPlace === defaultRegion) cleanBirthPlace = '';
        if (cleanDeathPlace === defaultRegion) cleanDeathPlace = undefined;
      }

      const nextFatherId =
        node.fatherId && removedCertIds.has(node.fatherId)
          ? undefined
          : node.fatherId;

      const updatedRelationLabel = node.isRecordKeeper
        ? 'أمين السجل'
        : node.isDirectSpineLineage && node.generationLevel >= 2
        ? getNextVerticalGrandfatherLabel(node.generationLevel)
        : node.relationToTargetLabel;

      return {
        ...node,
        familyName: '',
        kunya: cleanKunya,
        honorificTitle: cleanHonorific,
        vitalStatus: cleanVitalStatus,
        birthDateValue: cleanBirthDate,
        birthPlace: cleanBirthPlace,
        deathDateValue:
          cleanVitalStatus === 'deceased' ? cleanDeathDate : undefined,
        deathPlace:
          cleanVitalStatus === 'deceased' ? cleanDeathPlace : undefined,
        biography: cleanBio,
        fatherId: nextFatherId,
        spouseIds: (node.spouseIds || []).filter(
          (sid) => !removedCertIds.has(sid)
        ),
        relationToTargetLabel: updatedRelationLabel,
      };
    });
  };

  const [people, setPeople] = useState<InteractiveTreePerson[]>(() => {
    const cached = readUserFamilyTreeFromLocal<InteractiveTreePerson>(
      userId,
      userEmail,
      result.familyName
    );
    return cached && cached.length > 0
      ? sanitizeHydratedTreeNodes(cached)
      : buildInitialTree();
  });

  const isTreeHydratedRef = useRef<boolean>(false);
  const skipNextAutoSaveRef = useRef<boolean>(false);
  const [treeSaveState, setTreeSaveState] = useState<
    'loading' | 'saving' | 'saved' | 'local_only'
  >('loading');
  const [lastSavedLabel, setLastSavedLabel] = useState<string>('');

  // Hydrate saved tree from Firestore BEFORE enabling auto-save (prevents mount overwrite bug)
  useEffect(() => {
    let active = true;
    isTreeHydratedRef.current = false;
    setTreeSaveState('loading');

    const hydrateTree = async () => {
      try {
        const savedNodes =
          await fetchUserFamilyTreeFromFirebase<InteractiveTreePerson>(
            userId || '',
            userEmail,
            result.familyName
          );
        if (!active) return;

        if (savedNodes && Array.isArray(savedNodes) && savedNodes.length > 0) {
          const cleanedNodes = sanitizeHydratedTreeNodes(savedNodes).map(
            (node) =>
              node.isRecordKeeper && userAvatarUrl && !node.photoUrl
                ? { ...node, photoUrl: userAvatarUrl }
                : node
          );
          skipNextAutoSaveRef.current = true;
          setPeople(cleanedNodes);
          isTreeHydratedRef.current = true;
          setTreeSaveState('saved');
          setLastSavedLabel(formatSavedDateTime(new Date()));
        } else {
          const initialSeed = buildInitialTree();
          skipNextAutoSaveRef.current = true;
          setPeople(initialSeed);
          isTreeHydratedRef.current = true;
          const wrote = await saveUserFamilyTreeToFirebase(
            userId || '',
            result.familyName,
            initialSeed,
            userEmail
          );
          if (active) {
            setTreeSaveState(wrote ? 'saved' : 'local_only');
            setLastSavedLabel(formatSavedDateTime(new Date()));
          }
        }
      } catch {
        if (!active) return;
        const fallbackLocal = readUserFamilyTreeFromLocal<InteractiveTreePerson>(
          userId,
          userEmail,
          result.familyName
        );
        skipNextAutoSaveRef.current = true;
        setPeople(
          fallbackLocal && fallbackLocal.length > 0
            ? sanitizeHydratedTreeNodes(fallbackLocal)
            : buildInitialTree()
        );
        isTreeHydratedRef.current = true;
        setTreeSaveState('local_only');
      }
    };

    hydrateTree();
    return () => {
      active = false;
    };
  }, [userId, userEmail, result.familyName]);

  // Sync Record Keeper photoUrl when user uploads a new profile avatar
  useEffect(() => {
    if (!userAvatarUrl) return;
    setPeople((prev) =>
      prev.map((node) =>
        node.isRecordKeeper && node.photoUrl !== userAvatarUrl
          ? { ...node, photoUrl: userAvatarUrl }
          : node
      )
    );
  }, [userAvatarUrl]);

  // Persist family tree nodes to Firebase + Local Cache and sync with خزانتي (`juthori:tree-updated`) whenever modified
  useEffect(() => {
    if (people.length > 0 && typeof window !== 'undefined') {
      try {
        const syncKey = getTreeStorageKeyForVaultSync(userId, result.familyName);
        const summaryForVault = ensureDirectFamilyInVaultSummaries(
          people.map((p) => ({
            id: p.id,
            fullName: p.firstName.trim(),
            relationLabel: p.isRecordKeeper
              ? 'أمين السجل'
              : p.relationToTargetLabel || 'فرد في المشجرة',
            gender: p.gender,
            avatarDataUrl: p.photoThumbnailUrl || p.photoUrl,
            birthYear: p.birthDateValue,
            isAlive: p.vitalStatus !== 'deceased',
            isCertifiedReference: false,
          })),
          result.familyName
        );
        window.localStorage.setItem(syncKey, JSON.stringify(summaryForVault));
        window.dispatchEvent(new CustomEvent('juthori:tree-updated'));
      } catch {
        // Ignore storage error
      }
    }

    if (!isTreeHydratedRef.current || people.length === 0) {
      return;
    }

    saveUserFamilyTreeToLocal(userId, result.familyName, people, userEmail);

    if (skipNextAutoSaveRef.current) {
      skipNextAutoSaveRef.current = false;
      return;
    }

    let cancelled = false;
    setTreeSaveState('saving');
    saveUserFamilyTreeToFirebase(
      userId || '',
      result.familyName,
      people,
      userEmail
    )
      .then((wrote) => {
        if (cancelled) return;
        setTreeSaveState(wrote ? 'saved' : 'local_only');
        setLastSavedLabel(formatSavedDateTime(new Date()));
      })
      .catch(() => {
        if (!cancelled) setTreeSaveState('local_only');
      });

    return () => {
      cancelled = true;
    };
  }, [people, userId, userEmail, result.familyName]);

  const findPerson = (id?: string) => people.find((p) => p.id === id);

  const handleManualSaveTree = async () => {
    setTreeSaveState('saving');
    const wrote = await saveUserFamilyTreeToFirebase(
      userId || '',
      result.familyName,
      people,
      userEmail
    );
    setTreeSaveState(wrote ? 'saved' : 'local_only');
    setLastSavedLabel(formatSavedDateTime(new Date()));
    onLogActivity(
      'حفظ مشجرة العائلة في قاعدة البيانات',
      `تم حفظ ${people.length} فرداً في شجرة عائلة ${result.familyName}`
    );
  };

  // Two-Way Vault Sync (`خزانتي <-> شجرتي`)
  const initialVault = useMemo(
    () => readVaultArchiveFromLocal(userId, result.familyName, userEmail),
    [userId, result.familyName, userEmail]
  );
  const [vaultFolders, setVaultFolders] = useState<VaultFolderRecord[]>(
    initialVault.folders.length > 0
      ? initialVault.folders
      : DEFAULT_STARTER_VAULT_FOLDERS
  );
  const [vaultItems, setVaultItems] = useState<FamilyVaultMediaItem[]>(
    initialVault.items
  );
  const [newPersonPendingVaultIds, setNewPersonPendingVaultIds] = useState<
    string[]
  >([]);
  const [treeVaultUploadTitle, setTreeVaultUploadTitle] = useState('');
  const [treeVaultUploadDate, setTreeVaultUploadDate] = useState(
    new Date().getFullYear().toString()
  );
  const [treeVaultUploadFolderId, setTreeVaultUploadFolderId] =
    useState('folder_ancestors');
  const [isUploadingToVaultFromTree, setIsUploadingToVaultFromTree] =
    useState(false);

  // Membership Quota Governance & Family Registrar Invite Link state
  const [quotaUpgradePrompt, setQuotaUpgradePrompt] = useState<{
    kind: 'tree_members' | 'vault_docs';
    currentCount: number;
    maxAllowed: number;
  } | null>(null);
  const [showInviteFamilyModal, setShowInviteFamilyModal] = useState(false);
  const [inviteRoleMode, setInviteRoleMode] = useState<'contribute' | 'view'>(
    'contribute'
  );
  const [copiedInviteLink, setCopiedInviteLink] = useState(false);

  const familyTreeShareId = useMemo(() => {
    const uidPart = (userId || 'family').replace(/[^a-zA-Z0-9_-]/g, '_');
    const famSlug = encodeURIComponent((result.familyName || 'tree').trim());
    return `${uidPart}__${famSlug}`;
  }, [userId, result.familyName]);

  useEffect(() => {
    let mounted = true;
    fetchUserVaultArchive(userId, result.familyName, userEmail).then((archive) => {
      if (!mounted) return;
      setVaultFolders(
        archive.folders.length > 0
          ? archive.folders
          : DEFAULT_STARTER_VAULT_FOLDERS
      );
      setVaultItems(archive.items);
    });
    const onVaultUpdated = () => {
      const latest = readVaultArchiveFromLocal(userId, result.familyName, userEmail);
      setVaultFolders(latest.folders);
      setVaultItems(latest.items);
    };
    window.addEventListener('juthori:vault-updated', onVaultUpdated);
    return () => {
      mounted = false;
      window.removeEventListener('juthori:vault-updated', onVaultUpdated);
    };
  }, [userId, result.familyName, userEmail]);

  const pendingVaultIdsRef = useRef<Set<string>>(new Set());
  const modalScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const [isFollowUpNoteOpen, setIsFollowUpNoteOpen] = useState(false);

  // ============================================================================
  // COLLAPSIBLE «إعدادات شجرتي» 4-TAB STUDIO PREFERENCES (Local + Firestore Sync)
  // ============================================================================
  const treeDisplaySettingsStorageKey = useMemo(
    () =>
      `juthori_tree_display_settings_v2_${userId || 'guest'}_${
        result.familyName || 'default'
      }`,
    [userId, result.familyName]
  );

  const [isTreeSettingsOpen, setIsTreeSettingsOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] =
    useState<TreeSettingsTabId>('layout');
  const [settingsSyncStatus, setSettingsSyncStatus] = useState<
    'idle' | 'syncing' | 'synced'
  >('idle');
  const [mirrorPresetFeedback, setMirrorPresetFeedback] = useState<
    string | null
  >(null);
  const [selectedPersonIdForSpouses, setSelectedPersonIdForSpouses] = useState<
    string | null
  >(null);
  const [isCinemaMode, setIsCinemaMode] = useState(false);
  const [showMinimap, setShowMinimap] = useState(false);
  const [spotlightPersonId, setSpotlightPersonId] = useState<string | null>(
    null
  );
  const [collapsedBranchIds, setCollapsedBranchIds] = useState<Set<string>>(
    () => new Set<string>()
  );
  const [focusSubtreeRootId, setFocusSubtreeRootId] = useState<string | null>(
    null
  );
  const [showKinshipModal, setShowKinshipModal] = useState(false);
  const [kinshipPersonAId, setKinshipPersonAId] = useState<string>('');
  const [kinshipPersonBId, setKinshipPersonBId] = useState<string>('');
  const [isKinshipHighlightedOnCanvas, setIsKinshipHighlightedOnCanvas] =
    useState(false);
  const canvasViewportRef = useRef<HTMLDivElement | null>(null);
  const canvasContentRef = useRef<HTMLDivElement | null>(null);
  const spotlightTimerRef = useRef<number | null>(null);
  const hasHydratedCloudSettingsRef = useRef(false);

  // Escape key exits Fullscreen Cinema Mode gracefully
  useEffect(() => {
    if (!isCinemaMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsCinemaMode(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isCinemaMode]);

  useEffect(() => {
    return () => {
      if (spotlightTimerRef.current) {
        window.clearTimeout(spotlightTimerRef.current);
      }
    };
  }, []);

  const [treeDisplaySettings, setTreeDisplaySettings] =
    useState<TreeDisplaySettings>(() => {
      if (typeof window === 'undefined') {
        return normalizeTreeDisplaySettings(DEFAULT_TREE_DISPLAY_SETTINGS);
      }
      try {
        const raw = window.localStorage.getItem(treeDisplaySettingsStorageKey);
        if (!raw) {
          return normalizeTreeDisplaySettings(DEFAULT_TREE_DISPLAY_SETTINGS);
        }
        return normalizeTreeDisplaySettings(JSON.parse(raw));
      } catch {
        return normalizeTreeDisplaySettings(DEFAULT_TREE_DISPLAY_SETTINGS);
      }
    });

  // Hydrate saved studio settings from Firestore so preferences persist across devices
  useEffect(() => {
    let active = true;
    if (!userId && !userEmail) {
      hasHydratedCloudSettingsRef.current = true;
      return;
    }
    fetchUserTreeDisplaySettingsFromFirebase<Partial<TreeDisplaySettings>>(
      userId || '',
      userEmail
    )
      .then((cloudSettings) => {
        if (!active) return;
        if (cloudSettings) {
          const normalized = normalizeTreeDisplaySettings(cloudSettings);
          setTreeDisplaySettings(normalized);
          setSettingsSyncStatus('synced');
        }
        hasHydratedCloudSettingsRef.current = true;
      })
      .catch(() => {
        hasHydratedCloudSettingsRef.current = true;
      });
    return () => {
      active = false;
    };
  }, [userId, userEmail]);

  // Immediate localStorage persistence + debounced Firestore cloud auto-save
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(
          treeDisplaySettingsStorageKey,
          JSON.stringify(treeDisplaySettings)
        );
      } catch {
        // Ignore storage quota errors
      }
    }

    if (!userId && !userEmail) return;
    if (!hasHydratedCloudSettingsRef.current) return;

    setSettingsSyncStatus('syncing');
    const timer = window.setTimeout(() => {
      saveUserTreeDisplaySettingsToFirebase(
        userId || '',
        result.familyName || 'العائلة',
        treeDisplaySettings as unknown as Record<string, unknown>,
        userEmail
      )
        .then((ok) => {
          setSettingsSyncStatus(ok ? 'synced' : 'idle');
        })
        .catch(() => {
          setSettingsSyncStatus('idle');
        });
    }, 650);

    return () => window.clearTimeout(timer);
  }, [
    treeDisplaySettingsStorageKey,
    treeDisplaySettings,
    userId,
    userEmail,
    result.familyName,
  ]);

  const handleApplyAsMirrorDefault = async () => {
    setMirrorPresetFeedback('جاري اعتماد المظهر لمرآة موقعي...');
    const ok = await saveMirrorDefaultTreeSettingsToFirebase(
      userId || '',
      result.familyName || 'العائلة',
      treeDisplaySettings as unknown as Record<string, unknown>,
      userEmail
    );
    setMirrorPresetFeedback(
      ok
        ? 'تم اعتماد هذا المظهر كإعداد افتراضي لمرآة موقعك العائلي وحفظه سحابياً ✓'
        : 'تم حفظ المظهر كإعداد افتراضي محلي لمرآة موقعك العائلي ✓'
    );
    onLogActivity(
      'اعتماد مظهر شجرة مرآة موقعي',
      `تعيين ثيم «${TREE_CARD_THEMES[treeDisplaySettings.cardTheme].label}» وطريقة عرض «${treeDisplaySettings.layoutOrientation}» كافتراضي لمرآة موقع عائلة ${result.familyName}`
    );
    window.setTimeout(() => setMirrorPresetFeedback(null), 4500);
  };

  const isInvitedGuestHideFemales = useMemo(() => {
    if (typeof window === 'undefined') return false;
    try {
      const params = new URLSearchParams(window.location.search);
      return (
        Boolean(params.get('inviteTree')) &&
        params.get('femalePrivacy') === 'hide_females'
      );
    } catch {
      return false;
    }
  }, []);

  const familyInviteUrl = useMemo(() => {
    const origin = resolveClientPublicAppBaseUrl();
    return `${origin}/?inviteTree=${familyTreeShareId}&family=${encodeURIComponent(
      result.familyName || ''
    )}&role=${inviteRoleMode}&femalePrivacy=${
      treeDisplaySettings.femalePrivacyMode
    }`;
  }, [
    familyTreeShareId,
    result.familyName,
    inviteRoleMode,
    treeDisplaySettings.femalePrivacyMode,
  ]);

  const activeTreeTheme = TREE_CARD_THEMES[treeDisplaySettings.cardTheme];
  const activeTreeFont = getTreeArabicFontDefinition(
    treeDisplaySettings.fontFamily
  );

  // Direct lineage compass spine (from Record Keeper upward to topmost ancestor)
  const directCompassIds = useMemo(() => {
    const ids = new Set<string>();
    const byId = new Map(people.map((p) => [p.id, p]));
    const keeper = people.find((p) => p.isRecordKeeper);
    if (keeper) {
      let cur: InteractiveTreePerson | undefined = keeper;
      const guard = new Set<string>();
      while (cur && !guard.has(cur.id)) {
        guard.add(cur.id);
        ids.add(cur.id);
        cur = cur.fatherId ? byId.get(cur.fatherId) : undefined;
      }
    }
    people.forEach((p) => {
      if (p.isDirectSpineLineage || p.isRecordKeeper) {
        ids.add(p.id);
      }
    });
    return ids;
  }, [people]);

  const toggleBranchCollapse = (personId: string) => {
    setCollapsedBranchIds((prev) => {
      const next = new Set(prev);
      if (next.has(personId)) {
        next.delete(personId);
      } else {
        next.add(personId);
      }
      return next;
    });
  };

  const handleFitAndCenterCanvas = () => {
    const viewport = canvasViewportRef.current;
    const content = canvasContentRef.current;
    if (!viewport || !content) {
      setZoomPercent(100);
      return;
    }
    const contentWidth = content.scrollWidth || content.offsetWidth;
    const viewportWidth = viewport.clientWidth || 1;
    if (contentWidth > viewportWidth && contentWidth > 0) {
      const idealZoom = Math.max(
        55,
        Math.min(100, Math.floor(((viewportWidth - 32) / contentWidth) * 100))
      );
      setZoomPercent(idealZoom);
    } else {
      setZoomPercent(100);
    }
    window.requestAnimationFrame(() => {
      const vp = canvasViewportRef.current;
      if (!vp) return;
      const maxScroll = Math.max(0, vp.scrollWidth - vp.clientWidth);
      if (maxScroll > 0) {
        vp.scrollTo({ left: -maxScroll / 2, top: 0, behavior: 'smooth' });
      }
    });
  };

  const handleSpotlightPerson = (personId: string) => {
    // Expand any collapsed ancestors so the target card is guaranteed visible
    setCollapsedBranchIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set(prev);
      const byId = new Map(people.map((p) => [p.id, p]));
      let cur = byId.get(personId);
      const guard = new Set<string>();
      while (cur && !guard.has(cur.id)) {
        guard.add(cur.id);
        next.delete(cur.id);
        cur = cur.fatherId ? byId.get(cur.fatherId) : undefined;
      }
      return next;
    });

    if (focusSubtreeRootId) {
      setFocusSubtreeRootId(null);
    }

    setSpotlightPersonId(personId);
    if (spotlightTimerRef.current) {
      window.clearTimeout(spotlightTimerRef.current);
    }
    spotlightTimerRef.current = window.setTimeout(() => {
      setSpotlightPersonId((cur) => (cur === personId ? null : cur));
    }, 3600);

    window.setTimeout(() => {
      const cardEl = document.querySelector(
        `[data-testid="tree-person-card-${personId}"]`
      );
      if (cardEl && typeof cardEl.scrollIntoView === 'function') {
        cardEl.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'center',
        });
      }
    }, 90);
  };

  const handleToggleVaultItemForModalPerson = (
    itemId: string,
    explicitPersonId?: string
  ) => {
    const resolvedEditPid =
      explicitPersonId ||
      (modalConfig?.mode === 'edit' ? modalConfig.editPersonId : undefined);
    if (resolvedEditPid) {
      const nextItems = vaultItems.map((it) => {
        if (it.id !== itemId) return it;
        const already = it.linkedPersonIds.includes(resolvedEditPid);
        return {
          ...it,
          linkedPersonIds: already
            ? it.linkedPersonIds.filter((id) => id !== resolvedEditPid)
            : [...it.linkedPersonIds, resolvedEditPid],
        };
      });
      setVaultItems(nextItems);
      saveUserVaultArchive(
        userId,
        result.familyName,
        {
          folders: vaultFolders,
          items: nextItems,
        },
        userEmail
      ).catch(() => {});
    } else {
      setNewPersonPendingVaultIds((prev) => {
        const exists = prev.includes(itemId);
        const next = exists
          ? prev.filter((id) => id !== itemId)
          : [...prev, itemId];
        pendingVaultIdsRef.current = new Set(next);
        return next;
      });
    }
  };

  const handleUploadFileDirectlyToVaultFromTree = async (
    fileList: FileList | null,
    explicitTargetPersonId?: string
  ) => {
    if (!fileList || fileList.length === 0) return;
    if (
      caps.maxVaultDocuments !== null &&
      vaultItems.length + 1 > caps.maxVaultDocuments
    ) {
      setQuotaUpgradePrompt({
        kind: 'vault_docs',
        currentCount: vaultItems.length,
        maxAllowed: caps.maxVaultDocuments,
      });
      return;
    }
    const file = fileList[0];
    const editPid =
      explicitTargetPersonId ||
      (modalConfig?.mode === 'edit' ? modalConfig.editPersonId : undefined) ||
      quickVaultPreviewPersonId ||
      undefined;
    const newItemId = `vault_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 6)}`;

    if (!editPid) {
      pendingVaultIdsRef.current.add(newItemId);
    }

    setIsUploadingToVaultFromTree(true);

    try {
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      const isDoc =
        file.type.includes('pdf') ||
        /وثيقة|صك|حجة|عقد|شهادة|مخطوط/i.test(baseName);
      const processed = await processMediaFileForUpload(
        file,
        isDoc ? 'vault_document' : 'vault_photo'
      );
      const cloudRes = await uploadMediaToCloudWithFallback({
        uid: userId,
        category: 'vault',
        itemId: newItemId,
        mainDataUrl: processed.mainDataUrl,
        thumbnailDataUrl: processed.thumbnailDataUrl,
        mimeType: processed.mimeType,
      });

      const resolvedDisplayName =
        editPid === DIRECT_FAMILY_VAULT_NODE_ID
          ? `العائلة (${cleanNaturalSpineName(result.familyName)})`
          : editPid
          ? findPerson(editPid)?.firstName || formFirstName || 'الفرد'
          : formFirstName || 'الفرد';

      const newItem: FamilyVaultMediaItem = {
        id: newItemId,
        title:
          treeVaultUploadTitle.trim() ||
          baseName ||
          `ملف ${resolvedDisplayName} في الخزانة`,
        mediaType: isDoc ? 'document' : 'photo',
        folderId:
          treeVaultUploadFolderId ||
          (isDoc ? 'folder_docs' : 'folder_ancestors'),
        dateOrOccasion: treeVaultUploadDate.trim() || 'أرشيف المشجرة',
        fileDataUrl: cloudRes.url,
        thumbnailDataUrl: cloudRes.thumbnailUrl || processed.thumbnailDataUrl,
        storagePath: cloudRes.storagePath,
        storageProvider: cloudRes.provider,
        fileName: file.name,
        fileMimeType: processed.mimeType || file.type || 'image/jpeg',
        linkedPersonIds: editPid ? [editPid] : [],
        enhanced: false,
        createdAt: new Date().toISOString(),
      };

      const nextItems = [newItem, ...vaultItems];
      setVaultItems(nextItems);
      await saveUserVaultArchive(
        userId,
        result.familyName,
        {
          folders: vaultFolders,
          items: nextItems,
        },
        userEmail
      );

      // If uploaded as a photo inside the Add/Edit Person modal and no custom avatar is set yet, sync node avatar preview too
      if (!isDoc && modalConfig && !formPhotoUrl.trim()) {
        setFormPhotoUrl(cloudRes.thumbnailUrl || cloudRes.url);
      }
      if (
        !isDoc &&
        editPid &&
        editPid !== DIRECT_FAMILY_VAULT_NODE_ID &&
        !modalConfig
      ) {
        setPeople((prev) =>
          prev.map((p) =>
            p.id === editPid && !p.photoUrl
              ? {
                  ...p,
                  photoUrl: cloudRes.url,
                  photoThumbnailUrl: cloudRes.thumbnailUrl || cloudRes.url,
                }
              : p
          )
        );
      }

      if (!editPid) {
        setNewPersonPendingVaultIds((prev) =>
          prev.includes(newItemId) ? prev : [...prev, newItemId]
        );
      }

      setTreeVaultUploadTitle('');
      onLogActivity(
        'رفع ملف من شجرتي إلى خزانتي',
        `إيداع «${newItem.title}» في الخزانة وربطه بـ «${resolvedDisplayName}»`
      );
    } catch {
      pendingVaultIdsRef.current.delete(newItemId);
    } finally {
      setIsUploadingToVaultFromTree(false);
    }
  };

  // Display Depth Selector State (محدّد مدى العرض فوق الشجرة)
  const computeDefaultSpineDepth = (): TreeSpineDepthMode => {
    if (!result.matched) return 'family';
    if (result.isAlphaOnlyBeforeMerge && !result.isAlphaMergedIntoAdam) {
      return caps.isRootUnlocked || caps.isVip ? 'mother_tribe' : 'family';
    }
    if (caps.isVip || caps.areUpperAncestorsUnlocked) return 'adam_full';
    if (caps.isRootUnlocked) return 'mother_tribe';
    return 'family';
  };

  const [spineDepth, setSpineDepth] = useState<TreeSpineDepthMode>(
    computeDefaultSpineDepth
  );

  useEffect(() => {
    setSpineDepth(computeDefaultSpineDepth());
  }, [
    caps.isVip,
    caps.isRootUnlocked,
    caps.areUpperAncestorsUnlocked,
    result.matched,
    result.isAlphaOnlyBeforeMerge,
    result.isAlphaMergedIntoAdam,
  ]);

  const [depthLockPrompt, setDepthLockPrompt] = useState<{
    targetDepth: TreeSpineDepthMode;
    label: string;
    requireType: 'root_5_usd' | 'vip_annual' | 'alpha_pending';
  } | null>(null);

  // Radial Quick-Selector State (+ button on any node)
  const [radialTargetNodeId, setRadialTargetNodeId] = useState<string | null>(
    null
  );

  // Camera Quick Photo Picker Modal State
  const [photoPickerNodeId, setPhotoPickerNodeId] = useState<string | null>(
    null
  );
  const [customPhotoUrlInput, setCustomPhotoUrlInput] = useState('');
  const [isUploadingNodeAvatar, setIsUploadingNodeAvatar] = useState(false);

  // Safe Delete Confirmation Modal & Quick Vault Media Preview Modal
  const [pendingDeletePrompt, setPendingDeletePrompt] = useState<{
    person: InteractiveTreePerson;
    descendantNodes: InteractiveTreePerson[];
    isProtectedSpineAncestor: boolean;
    linkedDocsCount: number;
  } | null>(null);
  const [quickVaultPreviewPersonId, setQuickVaultPreviewPersonId] = useState<
    string | null
  >(null);
  const [showOfficialExportModal, setShowOfficialExportModal] = useState(false);

  // Canvas Zoom level
  const [zoomPercent, setZoomPercent] = useState(100);
  const [exportedBanner, setExportedBanner] = useState(false);

  // ============================================================================
  // NATURAL LINEAGE SPINE NODES & DEPTH RESOLUTION
  // ============================================================================
  const spineNodes: UpperAncestorNode[] = useMemo(() => {
    if (result.adamSpineNodes?.length) {
      return result.adamSpineNodes;
    }
    return [
      {
        id: `isolated-fe0-${result.familyName}`,
        orderNumber: 1,
        name: result.familyName,
        code: 'FE0',
        isCodedStation: true,
        rankLabel: 'بيت العائلة المباشر',
        region: result.originRegion || result.originCountry,
        eraNote: `بيت أسرة ${result.familyName}.`,
        historicalEra: 'late_families',
        dataLakeSource: result.isAlphaOnlyBeforeMerge
          ? 'alpha_projects'
          : 'adam_tree',
      },
    ];
  }, [result]);

  const capsulesList: AncestorCapsule[] = useMemo(
    () =>
      result.isAlphaOnlyBeforeMerge || result.isAlphaMergedIntoAdam
        ? []
        : result.capsules || [],
    [result]
  );

  // Identify milestone orderNumbers in spineNodes for the 5 Depth Modes
  const depthMilestones = useMemo(() => {
    const familyNode = spineNodes[0];
    const familyOrder = familyNode?.orderNumber ?? 1;

    // 2. Sub-Branch (الفرع الجامع: e.g., آل برمان / خابور)
    const subBranchNode =
      spineNodes.find(
        (n) =>
          n.code === 'B2' ||
          n.code === 'B1' ||
          (result.rootBranchName && n.name.includes(result.rootBranchName))
      ) || spineNodes[Math.min(1, spineNodes.length - 1)];
    const subBranchOrder = subBranchNode?.orderNumber ?? familyOrder;

    // 3. Mother Tribe (القبيلة الأم: e.g., بني بشر / العقيدات)
    const motherTribeNode =
      spineNodes.find(
        (n) =>
          n.code === 'B0' ||
          (result.rootTribeName && n.name.includes(result.rootTribeName))
      ) || spineNodes[Math.min(2, spineNodes.length - 1)];
    const motherTribeOrder = Math.max(
      subBranchOrder,
      motherTribeNode?.orderNumber ?? subBranchOrder
    );

    // 4. Historical Stock (الجذم التاريخي: مذحج / قحطان / عدنان / مضر / كهلان)
    const historicalStockCandidates = spineNodes.filter((n) => {
      const era = resolveNodeHistoricalEra(n);
      const isStockKeyword =
        n.name.includes('مذحج') ||
        n.name.includes('قحطان') ||
        n.name.includes('عدنان') ||
        n.name.includes('كهلان') ||
        n.name.includes('سبأ') ||
        n.name.includes('مضر') ||
        n.name.includes('ربيعة') ||
        n.code === 'M0' ||
        n.code === 'Z0' ||
        n.code === 'QA0';
      return (
        n.orderNumber > motherTribeOrder &&
        era !== 'prophets_origins' &&
        (era === 'ancient_kingdoms' || isStockKeyword)
      );
    });
    const historicalStockNode =
      historicalStockCandidates[historicalStockCandidates.length - 1] ||
      spineNodes.find((n) => n.code === 'M0' || n.code === 'Z0') ||
      motherTribeNode;
    const historicalStockOrder = Math.max(
      motherTribeOrder,
      historicalStockNode?.orderNumber ?? motherTribeOrder
    );

    // 5. Full Spine to Adam (حتى آدم عليه السلام)
    const maxOrder =
      spineNodes[spineNodes.length - 1]?.orderNumber ?? historicalStockOrder;

    return {
      familyOrder,
      subBranchOrder,
      motherTribeOrder,
      historicalStockOrder,
      maxOrder,
      subBranchLabel: subBranchNode?.name || result.rootBranchName || 'الفرع الجامع',
      motherTribeLabel: motherTribeNode?.name || result.rootTribeName || 'القبيلة الأم',
      historicalStockLabel:
        historicalStockNode && historicalStockNode.orderNumber > motherTribeOrder
          ? historicalStockNode.name
          : 'مذحج / قحطان / عدنان',
    };
  }, [spineNodes, result.rootBranchName, result.rootTribeName]);

  const handleSelectSpineDepth = (
    targetDepth: TreeSpineDepthMode,
    optionLabel: string
  ) => {
    if (targetDepth === 'family') {
      setSpineDepth('family');
      return;
    }

    if (targetDepth === 'sub_branch' || targetDepth === 'mother_tribe') {
      if (!caps.isRootUnlocked && !caps.isVip) {
        setDepthLockPrompt({
          targetDepth,
          label: optionLabel,
          requireType: 'root_5_usd',
        });
        return;
      }
      setSpineDepth(targetDepth);
      return;
    }

    // historical_stock or adam_full
    if (!caps.isVip && !caps.areUpperAncestorsUnlocked) {
      setDepthLockPrompt({
        targetDepth,
        label: optionLabel,
        requireType: 'vip_annual',
      });
      return;
    }

    setSpineDepth(targetDepth);
  };

  // ============================================================================
  // METADATA POPUP MODAL STATE
  // ============================================================================
  const [modalConfig, setModalConfig] = useState<{
    mode: 'add' | 'edit';
    targetNodeId: string;
    relationKind?: RelativeRelationKind;
    editPersonId?: string;
    bridgeTier?: number;
  } | null>(null);

  const [formGender, setFormGender] = useState<'male' | 'female'>('male');
  const [formFirstName, setFormFirstName] = useState('');
  const [formFamilyName, setFormFamilyName] = useState('');
  const [formKunya, setFormKunya] = useState('');
  const [formHonorific, setFormHonorific] =
    useState<ArabicHonorificTitle>('بدون');
  const [formPrestigeBadge, setFormPrestigeBadge] =
    useState<TreePrestigeBadgeId>('none');
  const [formMotherId, setFormMotherId] = useState<string>('');
  const [inlineNewMotherName, setInlineNewMotherName] = useState('');
  const [inlineNewMotherMaidenLine, setInlineNewMotherMaidenLine] =
    useState('');
  const [addMotherChoiceMode, setAddMotherChoiceMode] = useState<
    'select_existing' | 'create_new'
  >('create_new');
  const [selectedExistingMotherId, setSelectedExistingMotherId] =
    useState<string>('');
  const [formMaidenFamilyLine, setFormMaidenFamilyLine] = useState('');
  const [formMarriageAllianceNote, setFormMarriageAllianceNote] = useState('');
  const [formVitalStatus, setFormVitalStatus] = useState<
    'unspecified' | 'living' | 'deceased'
  >('unspecified');
  const [formBirthPrecision, setFormBirthPrecision] =
    useState<BirthPrecisionMode>('year_only');
  const [formBirthCalendar, setFormBirthCalendar] = useState<
    'hijri' | 'gregorian'
  >('hijri');
  const [formBirthDate, setFormBirthDate] = useState('');
  const [formBirthPlace, setFormBirthPlace] = useState('');
  const [formDeathDate, setFormDeathDate] = useState('');
  const [formDeathPlace, setFormDeathPlace] = useState('');
  const [formFemalePrivacyMasked, setFormFemalePrivacyMasked] = useState(true);
  const [formContactInfo, setFormContactInfo] = useState('');
  const [formBiography, setFormBiography] = useState('');
  const [formAttachedDocName, setFormAttachedDocName] = useState('');
  const [formPhotoUrl, setFormPhotoUrl] = useState('');
  const [isUploadingStudioPortrait, setIsUploadingStudioPortrait] =
    useState(false);
  const [activeUnionQuickAddKey, setActiveUnionQuickAddKey] = useState<
    string | null
  >(null);
  const [formError, setFormError] = useState('');

  // Direct Spine Lineage chain ascending from Record Keeper (Level 1 -> Level 2 -> ...)
  const directLineageSpine = useMemo(() => {
    const chain: InteractiveTreePerson[] = [];
    const rk = people.find((p) => p.isRecordKeeper);
    if (!rk) return chain;
    let current: InteractiveTreePerson | undefined = rk;
    const visited = new Set<string>();
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      chain.push(current);
      current = current.fatherId ? findPerson(current.fatherId) : undefined;
    }
    return chain;
  }, [people]);

  const topMostDirectAncestor =
    directLineageSpine[directLineageSpine.length - 1] || people[0];

  const handleUploadStudioPortrait = async (file: File) => {
    setIsUploadingStudioPortrait(true);
    try {
      const targetPid =
        modalConfig?.mode === 'edit' && modalConfig.editPersonId
          ? modalConfig.editPersonId
          : `pending_${Date.now()}`;
      const uploaded = await uploadTreeNodeAvatarWithFallback(
        userId,
        targetPid,
        file
      );
      setFormPhotoUrl(uploaded.thumbnailUrl || uploaded.url);
    } catch {
      // Safe fallback — keep existing avatar
    } finally {
      setIsUploadingStudioPortrait(false);
    }
  };

  const openAddRelativeModal = (
    targetNode: InteractiveTreePerson,
    relationKind: RelativeRelationKind,
    preselectedMotherId?: string
  ) => {
    setRadialTargetNodeId(null);
    setActiveUnionQuickAddKey(null);

    // 1. Strict Charter Gate: Must sign Record Keeper Charter (`ميثاق أمين السجل`) before adding ANY node!
    if (!isRecordKeeperCharterSigned) {
      onSignCharterAndEnableTree();
      return;
    }

    // 2. Smart Spousal & Wife Quick-Action Guard:
    // - Never allow adding a second husband to any female who already has a husband.
    // - Married-in wives (no blood-line father in tree) only accept son/daughter additions.
    // - Adding a son/daughter from a wife's card automatically anchors fatherId = husband & motherId = wife.
    const targetPolicy = resolveNodeQuickActionPolicy(people, targetNode);
    if (relationKind === 'spouse' && !targetPolicy.canAddSpouse) {
      return;
    }
    if (
      targetPolicy.isMarriedInWife &&
      relationKind !== 'son' &&
      relationKind !== 'daughter'
    ) {
      return;
    }

    let effectiveTargetNode = targetNode;
    let effectivePreselectedMotherId = preselectedMotherId;
    if (
      (relationKind === 'son' || relationKind === 'daughter') &&
      targetNode.gender === 'female' &&
      targetPolicy.linkedHusband
    ) {
      effectiveTargetNode = targetPolicy.linkedHusband;
      effectivePreselectedMotherId = targetNode.id;
    }

    // 3. Strict 3-Zone Genealogical Boundaries:
    // - Zone 2 (generationLevel > 7: ما قبل الجد الخامس حتى الجذر): ONLY upward vertical ancestor links allowed!
    if (
      effectiveTargetNode.generationLevel > FIFTH_GRANDFATHER_LEVEL &&
      relationKind !== 'vertical_ancestor'
    ) {
      return;
    }
    // - Boundary of 5th Grandfather (generationLevel === 7): upward link is strictly vertical (`vertical_ancestor`),
    //   no horizontal siblings or mother of 5th grandfather (since level 8 is vertical-only).
    if (
      effectiveTargetNode.generationLevel === FIFTH_GRANDFATHER_LEVEL &&
      (relationKind === 'mother' ||
        relationKind === 'brother' ||
        relationKind === 'sister')
    ) {
      return;
    }
    const resolvedRelationKind: RelativeRelationKind =
      effectiveTargetNode.generationLevel >= FIFTH_GRANDFATHER_LEVEL &&
      relationKind === 'father'
        ? 'vertical_ancestor'
        : relationKind;

    setFormError('');
    setInlineNewMotherName('');
    setInlineNewMotherMaidenLine('');

    const isFemaleRelation =
      resolvedRelationKind === 'mother' ||
      resolvedRelationKind === 'sister' ||
      resolvedRelationKind === 'daughter' ||
      (resolvedRelationKind === 'spouse' &&
        effectiveTargetNode.gender === 'male');

    // Zero Fabrication: Never pre-fill kunya, honorific, dates, places, or vitalStatus!
    setFormGender(isFemaleRelation ? 'female' : 'male');
    setFormFirstName('');
    setFormFamilyName('');
    setFormKunya('');
    setFormHonorific('بدون');
    setFormPrestigeBadge('none');

    // Smart Add-Mother workflow: if target already has a father with registered wife(s),
    // present existing wives first to prevent duplicate mother nodes.
    if (resolvedRelationKind === 'mother') {
      const childFather = effectiveTargetNode.fatherId
        ? findPerson(effectiveTargetNode.fatherId)
        : undefined;
      const fatherWives: InteractiveTreePerson[] = [];
      if (childFather) {
        const seen = new Set<string>();
        (childFather.spouseIds || []).forEach((sid) => {
          const w = findPerson(sid);
          if (w && w.id !== childFather.id && !seen.has(w.id)) {
            seen.add(w.id);
            fatherWives.push(w);
          }
        });
        people.forEach((candidate) => {
          if (
            candidate.id !== childFather.id &&
            !seen.has(candidate.id) &&
            (candidate.spouseIds || []).includes(childFather.id)
          ) {
            seen.add(candidate.id);
            fatherWives.push(candidate);
          }
        });
      }
      if (fatherWives.length > 0) {
        setAddMotherChoiceMode('select_existing');
        setSelectedExistingMotherId(fatherWives[0].id);
      } else {
        setAddMotherChoiceMode('create_new');
        setSelectedExistingMotherId('');
      }
    } else {
      setAddMotherChoiceMode('create_new');
      setSelectedExistingMotherId('');
    }

    // Strict Non-Assumption Rule:
    // NEVER default `formMotherId` to the first wife when adding from Father's general (+).
    // Default is ALWAYS `""` (unspecified — directly linked to Father), UNLESS:
    // (a) user explicitly clicked a specific wife's card or `💍` bridge (`effectivePreselectedMotherId`), OR
    // (b) user clicked `+` directly on an unmarried/mother-only female card (`effectiveTargetNode.gender === 'female'`).
    if (effectivePreselectedMotherId) {
      setFormMotherId(effectivePreselectedMotherId);
    } else if (
      (resolvedRelationKind === 'son' || resolvedRelationKind === 'daughter') &&
      effectiveTargetNode.gender === 'female'
    ) {
      setFormMotherId(effectiveTargetNode.id);
    } else {
      setFormMotherId('');
    }

    setFormMaidenFamilyLine('');
    setFormMarriageAllianceNote('');
    setFormVitalStatus('unspecified');
    setFormBirthPrecision('year_only');
    setFormBirthCalendar('hijri');
    setFormBirthDate('');
    setFormBirthPlace('');
    setFormDeathDate('');
    setFormDeathPlace('');
    setFormFemalePrivacyMasked(isFemaleRelation);
    setFormContactInfo('');
    setFormBiography('');
    setFormAttachedDocName('');
    setFormPhotoUrl('');
    setNewPersonPendingVaultIds([]);
    pendingVaultIdsRef.current = new Set();

    setModalConfig({
      mode: 'add',
      targetNodeId: effectiveTargetNode.id,
      relationKind: resolvedRelationKind,
    });
  };

  const openAddBridgeAboveFamilyModal = (
    relationKind: 'bridge_above_family' | 'horizontal_branch_above_family',
    targetBridgeTier: number
  ) => {
    setRadialTargetNodeId(null);
    setActiveUnionQuickAddKey(null);
    if (!isRecordKeeperCharterSigned) {
      onSignCharterAndEnableTree();
      return;
    }

    setFormError('');
    setInlineNewMotherName('');
    setInlineNewMotherMaidenLine('');
    setAddMotherChoiceMode('create_new');
    setSelectedExistingMotherId('');
    setFormGender('male');
    setFormFirstName('');
    setFormFamilyName('');
    setFormKunya('');
    setFormHonorific('بدون');
    setFormPrestigeBadge('none');
    setFormMotherId('');
    setFormMaidenFamilyLine('');
    setFormMarriageAllianceNote('');
    setFormVitalStatus('unspecified');
    setFormBirthPrecision('year_only');
    setFormBirthCalendar('hijri');
    setFormBirthDate('');
    setFormBirthPlace('');
    setFormDeathDate('');
    setFormDeathPlace('');
    setFormFemalePrivacyMasked(false);
    setFormContactInfo('');
    setFormBiography('');
    setFormAttachedDocName('');
    setFormPhotoUrl('');
    setNewPersonPendingVaultIds([]);
    pendingVaultIdsRef.current = new Set();

    setModalConfig({
      mode: 'add',
      targetNodeId: DIRECT_FAMILY_VAULT_NODE_ID,
      relationKind,
      bridgeTier: targetBridgeTier,
    });
  };

  const openEditPersonModal = (person: InteractiveTreePerson) => {
    setRadialTargetNodeId(null);
    setActiveUnionQuickAddKey(null);

    if (!isRecordKeeperCharterSigned) {
      onSignCharterAndEnableTree();
      return;
    }

    setFormError('');
    setInlineNewMotherName('');
    setInlineNewMotherMaidenLine('');
    setAddMotherChoiceMode('create_new');
    setSelectedExistingMotherId('');
    setFormGender(person.gender);
    setFormFirstName(person.firstName);
    setFormFamilyName('');
    setFormKunya(person.kunya || '');
    setFormHonorific(person.honorificTitle || 'بدون');
    setFormPrestigeBadge(person.prestigeBadge || 'none');
    setFormMotherId(person.motherId || '');
    setFormMaidenFamilyLine(person.maidenFamilyLine || '');
    setFormMarriageAllianceNote(person.marriageAllianceNote || '');
    setFormVitalStatus(person.vitalStatus || 'unspecified');
    setFormBirthPrecision(person.birthPrecision || 'year_only');
    setFormBirthCalendar(person.birthCalendar || 'hijri');
    setFormBirthDate(person.birthDateValue || '');
    setFormBirthPlace(person.birthPlace || '');
    setFormDeathDate(person.deathDateValue || '');
    setFormDeathPlace(person.deathPlace || '');
    setFormFemalePrivacyMasked(person.femalePrivacyMasked);
    setFormContactInfo(person.contactInfo || '');
    setFormBiography(person.biography || '');
    setFormAttachedDocName(person.attachedDocName || '');
    setFormPhotoUrl(person.photoUrl || '');

    setModalConfig({
      mode: 'edit',
      targetNodeId: person.id,
      editPersonId: person.id,
    });
  };

  const modalMeta = useMemo(() => {
    if (!modalConfig) return null;

    const collectFatherWives = (
      fatherNode: InteractiveTreePerson | undefined
    ): InteractiveTreePerson[] => {
      if (!fatherNode) return [];
      const wifeMap = new Map<string, InteractiveTreePerson>();
      (fatherNode.spouseIds || []).forEach((id) => {
        const w = findPerson(id);
        if (w) wifeMap.set(w.id, w);
      });
      people.forEach((candidate) => {
        if (
          candidate.id !== fatherNode.id &&
          (candidate.spouseIds || []).includes(fatherNode.id)
        ) {
          wifeMap.set(candidate.id, candidate);
        }
      });
      return Array.from(wifeMap.values());
    };

    if (
      modalConfig.mode === 'add' &&
      (modalConfig.relationKind === 'bridge_above_family' ||
        modalConfig.relationKind === 'horizontal_branch_above_family')
    ) {
      const cleanFam = cleanNaturalSpineName(result.familyName);
      return {
        title:
          modalConfig.relationKind === 'horizontal_branch_above_family'
            ? `إضافة فرع أفقي فوق (${cleanFam}) وحتى الجذر`
            : `إضافة عقدة فوق العائلة (${cleanFam}) نحو الجذر`,
        bindingHeadline:
          modalConfig.relationKind === 'horizontal_branch_above_family'
            ? `إضافة فرع أفقي فوق (${cleanFam})`
            : `إضافة حلقة ربط فوق (${cleanFam}) نحو الجذر`,
        subtitle: `نطاق الوصل بين العائلة والجذر · شجرة عائلة ${result.familyName}`,
        isSpouseRole: false,
        isDaughterRole: false,
        showMotherSelector: false,
        motherSelectorFatherId: undefined as string | undefined,
        motherSelectorFatherName: undefined as string | undefined,
        motherOptions: [] as InteractiveTreePerson[],
        smartMotherInfo: null as {
          childName: string;
          fatherId?: string;
          fatherName?: string;
          existingFatherWives: InteractiveTreePerson[];
        } | null,
      };
    }

    const target = findPerson(modalConfig.targetNodeId);
    if (!target) return null;

    if (modalConfig.mode === 'edit') {
      const targetPolicy = resolveNodeQuickActionPolicy(people, target);
      const isMarriedInWife = targetPolicy.isMarriedInWife;
      const isDaughterNode =
        target.gender === 'female' &&
        !isMarriedInWife &&
        (targetPolicy.hasFatherInTree ||
          target.relationToTargetLabel.startsWith('ابنة') ||
          target.relationToTargetLabel.startsWith('أخت'));

      const fatherNode = target.fatherId
        ? findPerson(target.fatherId)
        : undefined;
      const editMotherOptions = !isMarriedInWife
        ? collectFatherWives(fatherNode)
        : [];
      if (
        !isMarriedInWife &&
        target.motherId &&
        !editMotherOptions.some((w) => w.id === target.motherId)
      ) {
        const directMom = findPerson(target.motherId);
        if (directMom) editMotherOptions.unshift(directMom);
      }

      return {
        title: `تعديل بيانات «${target.firstName}»`,
        bindingHeadline: isMarriedInWife
          ? `تعديل بطاقة الزوجة الكريمة: ${target.firstName}`
          : `تعديل بطاقة الفرد: ${target.firstName}`,
        subtitle: `شجرة عائلة ${result.familyName}`,
        isSpouseRole: isMarriedInWife,
        isDaughterRole: isDaughterNode,
        showMotherSelector:
          !isMarriedInWife &&
          (Boolean(fatherNode) || editMotherOptions.length > 0),
        motherSelectorFatherId: fatherNode?.id,
        motherSelectorFatherName: fatherNode?.firstName,
        motherOptions: editMotherOptions,
        smartMotherInfo: null,
      };
    }

    const rel = modalConfig.relationKind!;
    const nextUpwardLabel = getNextVerticalGrandfatherLabel(
      target.generationLevel + 1
    );
    const relationTitleMap: Record<RelativeRelationKind, string> = {
      father: `إضافة (${nextUpwardLabel}) لـ: ${target.firstName}`,
      mother: `إضافة الأم الكريمة لـ: ${target.firstName}`,
      vertical_ancestor: `إضافة حلقة عمودية نحو الجذر (${nextUpwardLabel})`,
      bridge_above_family: `إضافة عقدة فوق العائلة نحو الجذر`,
      horizontal_branch_above_family: `إضافة فرع أفقي فوق العائلة وحتى الجذر`,
      spouse:
        target.gender === 'male'
          ? `إضافة زوجة مقترنة بـ: ${target.firstName}`
          : `إضافة زوج مقترن بـ: ${target.firstName}`,
      brother: `إضافة أخ لـ: ${target.firstName}`,
      sister: `إضافة أخت لـ: ${target.firstName}`,
      son: `إضافة ابن لـ: ${target.firstName}`,
      daughter: `إضافة ابنة لـ: ${target.firstName}`,
    };

    const isSpouseRole =
      (rel === 'spouse' && target.gender === 'male') || rel === 'mother';
    const isDaughterRole = rel === 'daughter' || rel === 'sister';

    const canHaveMotherSelection =
      rel === 'son' ||
      rel === 'daughter' ||
      rel === 'brother' ||
      rel === 'sister';

    let motherOptions: InteractiveTreePerson[] = [];
    let resolvedMotherFather: InteractiveTreePerson | undefined;
    if (rel === 'son' || rel === 'daughter') {
      const targetPolicy = resolveNodeQuickActionPolicy(people, target);
      resolvedMotherFather =
        target.gender === 'male'
          ? target
          : targetPolicy.linkedHusband || undefined;
      motherOptions = collectFatherWives(resolvedMotherFather);
      if (
        target.gender === 'female' &&
        !motherOptions.some((w) => w.id === target.id)
      ) {
        motherOptions.unshift(target);
      }
    } else if (rel === 'brother' || rel === 'sister') {
      resolvedMotherFather = target.fatherId
        ? findPerson(target.fatherId)
        : undefined;
      motherOptions = collectFatherWives(resolvedMotherFather);
      if (
        target.motherId &&
        !motherOptions.some((m) => m.id === target.motherId)
      ) {
        const targetMom = findPerson(target.motherId);
        if (targetMom) motherOptions.unshift(targetMom);
      }
    }

    // Dynamic contextual binding headline for Son / Daughter and Smart Add-Mother
    let dynamicHeadline = relationTitleMap[rel];
    if ((rel === 'son' || rel === 'daughter') && resolvedMotherFather) {
      const childRoleWord = rel === 'son' ? 'ابن' : 'ابنة';
      if (formMotherId && formMotherId !== NEW_MOTHER_SENTINEL) {
        const selectedMom =
          motherOptions.find((m) => m.id === formMotherId) ||
          findPerson(formMotherId);
        if (selectedMom) {
          dynamicHeadline = `إضافة ${childRoleWord} لـ ${resolvedMotherFather.firstName} (من السيدة ${selectedMom.firstName})`;
        }
      } else if (
        formMotherId === NEW_MOTHER_SENTINEL &&
        inlineNewMotherName.trim()
      ) {
        dynamicHeadline = `إضافة ${childRoleWord} لـ ${resolvedMotherFather.firstName} (من السيدة ${inlineNewMotherName.trim()})`;
      }
    }

    let smartMotherInfo: {
      childName: string;
      fatherId?: string;
      fatherName?: string;
      existingFatherWives: InteractiveTreePerson[];
    } | null = null;
    if (rel === 'mother') {
      const childFather = target.fatherId
        ? findPerson(target.fatherId)
        : undefined;
      const existingFatherWives = collectFatherWives(childFather);
      smartMotherInfo = {
        childName: target.firstName,
        fatherId: childFather?.id,
        fatherName: childFather?.firstName,
        existingFatherWives,
      };
      if (childFather && existingFatherWives.length > 0) {
        dynamicHeadline = `تحديد أو إضافة الأم لـ: ${target.firstName}`;
      } else if (childFather) {
        dynamicHeadline = `إضافة الأم لـ ${target.firstName} (زوجة لـ ${childFather.firstName})`;
      }
    }

    return {
      title: relationTitleMap[rel],
      bindingHeadline: dynamicHeadline,
      subtitle: `شجرة عائلة ${result.familyName}`,
      isSpouseRole,
      isDaughterRole,
      showMotherSelector:
        canHaveMotherSelection &&
        !isSpouseRole &&
        (Boolean(resolvedMotherFather) || motherOptions.length > 0),
      motherSelectorFatherId: resolvedMotherFather?.id,
      motherSelectorFatherName: resolvedMotherFather?.firstName,
      motherOptions,
      smartMotherInfo,
    };
  }, [
    modalConfig,
    people,
    result.familyName,
    formMotherId,
    inlineNewMotherName,
  ]);

  const handleSavePersonModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalConfig) return;

    if (!isRecordKeeperCharterSigned) {
      setModalConfig(null);
      onSignCharterAndEnableTree();
      return;
    }

    // ------------------------------------------------------------------
    // BRANCH 0: SMART ADD-MOTHER (Bind existing wife of father — ZERO DUPLICATE)
    // ------------------------------------------------------------------
    if (
      modalConfig.mode === 'add' &&
      modalConfig.relationKind === 'mother' &&
      addMotherChoiceMode === 'select_existing'
    ) {
      const targetChild = findPerson(modalConfig.targetNodeId);
      const chosenMother = selectedExistingMotherId
        ? findPerson(selectedExistingMotherId)
        : undefined;

      if (!targetChild || !chosenMother) {
        setFormError(
          'يرجى اختيار الأم من زوجات الأب المسجلات، أو الضغط على «+ إضافة أم جديدة»'
        );
        modalScrollContainerRef.current?.scrollTo({
          top: 0,
          behavior: 'smooth',
        });
        return;
      }

      const fatherId = targetChild.fatherId;
      const updatedPeople = people.map((p) => {
        if (p.id === targetChild.id) {
          return { ...p, motherId: chosenMother.id };
        }
        if (fatherId && p.id === fatherId) {
          return {
            ...p,
            spouseIds: (p.spouseIds || []).includes(chosenMother.id)
              ? p.spouseIds
              : [...(p.spouseIds || []), chosenMother.id],
          };
        }
        if (fatherId && p.id === chosenMother.id) {
          return {
            ...p,
            spouseIds: (p.spouseIds || []).includes(fatherId)
              ? p.spouseIds
              : [...(p.spouseIds || []), fatherId],
          };
        }
        return p;
      });

      setPeople(updatedPeople);
      onLogActivity(
        'ربط الأم المسجلة بالفرد في شجرتي',
        `تم ربط السيدة «${chosenMother.firstName}» أماً لـ «${targetChild.firstName}» مباشرةً دون تكرار`
      );
      setModalConfig(null);
      return;
    }

    const cleanFirst = formFirstName.trim();
    if (!cleanFirst) {
      setFormError('يرجى إدخال الاسم الكريم في الحقل العلوي لحفظ البطاقة في الشجرة');
      modalScrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      nameInputRef.current?.focus();
      return;
    }

    // ------------------------------------------------------------------
    // BRANCH 1: EDIT EXISTING PERSON (with optional Inline New Mother creation)
    // ------------------------------------------------------------------
    if (modalConfig.mode === 'edit' && modalConfig.editPersonId) {
      const wantsInlineMotherOnEdit =
        Boolean(modalMeta?.showMotherSelector) &&
        formMotherId === NEW_MOTHER_SENTINEL;
      const cleanInlineMotherName = inlineNewMotherName.trim();

      if (wantsInlineMotherOnEdit && !cleanInlineMotherName) {
        setFormError(
          'يرجى إدخال «اسم الأم الكريمة» لإضافتها كزوجة للأب وربطها بهذا الفرد، أو اختيار «غير محدد»'
        );
        modalScrollContainerRef.current?.scrollTo({
          top: 120,
          behavior: 'smooth',
        });
        return;
      }

      if (
        wantsInlineMotherOnEdit &&
        people.length + 1 > effectiveMaxTreeMembers
      ) {
        setQuotaUpgradePrompt({
          kind: 'tree_members',
          currentCount: people.length,
          maxAllowed: effectiveMaxTreeMembers,
        });
        return;
      }

      let createdInlineMotherOnEdit: InteractiveTreePerson | null = null;
      let resolvedEditMotherId: string | undefined =
        formMotherId && formMotherId !== NEW_MOTHER_SENTINEL
          ? formMotherId
          : undefined;
      const editFatherNode = modalMeta?.motherSelectorFatherId
        ? findPerson(modalMeta.motherSelectorFatherId)
        : undefined;

      if (wantsInlineMotherOnEdit) {
        const newMomId = `node-mother-${Date.now()}`;
        const editingTarget = findPerson(modalConfig.editPersonId);
        createdInlineMotherOnEdit = {
          id: newMomId,
          firstName: cleanInlineMotherName,
          familyName: '',
          kunya: '',
          honorificTitle: 'بدون',
          gender: 'female',
          generationLevel: editFatherNode
            ? editFatherNode.generationLevel
            : (editingTarget?.generationLevel ?? 1) + 1,
          isDirectSpineLineage: false,
          relationToTargetLabel: editFatherNode
            ? `زوجة ${editFatherNode.firstName}`
            : `والدة ${cleanFirst}`,
          spouseIds: editFatherNode ? [editFatherNode.id] : [],
          maidenFamilyLine: inlineNewMotherMaidenLine.trim() || undefined,
          vitalStatus: 'unspecified',
          birthPrecision: 'year_only',
          birthCalendar: 'hijri',
          birthDateValue: '',
          birthPlace: '',
          femalePrivacyMasked: true,
        };
        resolvedEditMotherId = newMomId;
      }

      const updatedBase = people.map((p) => {
        if (
          createdInlineMotherOnEdit &&
          editFatherNode &&
          p.id === editFatherNode.id
        ) {
          return {
            ...p,
            spouseIds: (p.spouseIds || []).includes(
              createdInlineMotherOnEdit.id
            )
              ? p.spouseIds
              : [...(p.spouseIds || []), createdInlineMotherOnEdit.id],
          };
        }
        if (p.id !== modalConfig.editPersonId) return p;
        const isVerticalOnly =
          p.generationLevel > FIFTH_GRANDFATHER_LEVEL &&
          !p.isBridgeAboveFamily;

        return {
          ...p,
          firstName: cleanFirst,
          familyName: '',
          kunya: formKunya.trim(),
          honorificTitle: formHonorific,
          prestigeBadge:
            formPrestigeBadge !== 'none' ? formPrestigeBadge : undefined,
          gender: isVerticalOnly ? 'male' : formGender,
          // Strictly respect explicit selection (including clearing back to `""` -> undefined!)
          motherId: isVerticalOnly
            ? undefined
            : modalMeta?.showMotherSelector
            ? resolvedEditMotherId
            : p.motherId,
          maidenFamilyLine:
            modalMeta?.isSpouseRole
              ? formMaidenFamilyLine.trim() || undefined
              : p.maidenFamilyLine,
          marriageAllianceNote:
            modalMeta?.isDaughterRole && !modalMeta?.isSpouseRole
              ? formMarriageAllianceNote.trim() || undefined
              : p.marriageAllianceNote,
          vitalStatus: formVitalStatus,
          birthPrecision: formBirthPrecision,
          birthCalendar: formBirthCalendar,
          birthDateValue: formBirthDate.trim(),
          birthPlace: formBirthPlace.trim(),
          deathDateValue:
            formVitalStatus === 'deceased' ? formDeathDate.trim() : undefined,
          deathPlace:
            formVitalStatus === 'deceased'
              ? formDeathPlace.trim()
              : undefined,
          femalePrivacyMasked:
            !isVerticalOnly && formGender === 'female'
              ? formFemalePrivacyMasked
              : false,
          contactInfo:
            formVitalStatus === 'living' ? formContactInfo.trim() : undefined,
          biography: formBiography.trim(),
          attachedDocName: formAttachedDocName.trim() || undefined,
          photoUrl: formPhotoUrl.trim() || undefined,
          photoThumbnailUrl: formPhotoUrl.trim() || undefined,
        };
      });

      const updated = createdInlineMotherOnEdit
        ? [...updatedBase, createdInlineMotherOnEdit]
        : updatedBase;

      setPeople(updated);

      const rk = updated.find((u) => u.isRecordKeeper);
      const fNode = rk?.fatherId
        ? updated.find((u) => u.id === rk.fatherId)
        : undefined;
      const gNode = fNode?.fatherId
        ? updated.find((u) => u.id === fNode.fatherId)
        : undefined;
      if (onSyncImmediateParents) {
        onSyncImmediateParents(fNode?.firstName || '', gNode?.firstName || '');
      }

      onLogActivity(
        'تحديث بيانات فرد في شجرتي',
        createdInlineMotherOnEdit
          ? `تم تعديل بيانات «${cleanFirst}» وإضافة والدته «${createdInlineMotherOnEdit.firstName}» كزوجة للأب`
          : `تم تعديل بيانات «${cleanFirst}» في شجرة الأسرة`
      );
      setModalConfig(null);
      return;
    }

    // ------------------------------------------------------------------
    // BRANCH 2: ADD NEW RELATIVE (with optional atomic Inline New Mother)
    // ------------------------------------------------------------------
    const rel = modalConfig.relationKind;
    if (!rel) return;

    const isAddingBridgeAboveFamily =
      rel === 'bridge_above_family' || rel === 'horizontal_branch_above_family';

    const target = isAddingBridgeAboveFamily
      ? undefined
      : findPerson(modalConfig.targetNodeId);
    if (!isAddingBridgeAboveFamily && !target) return;

    // Enforce 3-Zone Genealogical Boundaries on save for lower tree nodes
    if (
      !isAddingBridgeAboveFamily &&
      target &&
      target.generationLevel > FIFTH_GRANDFATHER_LEVEL &&
      !target.isBridgeAboveFamily &&
      rel !== 'vertical_ancestor'
    ) {
      return;
    }

    const wantsInlineNewMother =
      !isAddingBridgeAboveFamily &&
      (rel === 'son' ||
        rel === 'daughter' ||
        rel === 'brother' ||
        rel === 'sister') &&
      formMotherId === NEW_MOTHER_SENTINEL;
    const cleanInlineMotherName = inlineNewMotherName.trim();

    if (wantsInlineNewMother && !cleanInlineMotherName) {
      setFormError(
        'يرجى إدخال «اسم الأم الكريمة» لإضافتها كزوجة للأب وربط الابن/الابنة بها، أو اختيار «غير محدد»'
      );
      modalScrollContainerRef.current?.scrollTo({
        top: 120,
        behavior: 'smooth',
      });
      return;
    }

    // Tier Quota Check BEFORE mutating `people` — preserves all entered form fields!
    const requiredSlots = wantsInlineNewMother ? 2 : 1;
    if (people.length + requiredSlots > effectiveMaxTreeMembers) {
      setQuotaUpgradePrompt({
        kind: 'tree_members',
        currentCount: people.length,
        maxAllowed: effectiveMaxTreeMembers,
      });
      return;
    }

    const nowTs = Date.now();
    const newId = `node-${nowTs}`;

    let nextGenLevel = target ? target.generationLevel : 8;
    let isDirectSpineLineage = false;
    let relationLabel = '';
    let assignedFatherId: string | undefined;
    let assignedMotherId: string | undefined =
      formMotherId && formMotherId !== NEW_MOTHER_SENTINEL
        ? formMotherId
        : undefined;
    let assignedSpouseIds: string[] = [];

    const targetTopSiblingGroupIds =
      !isAddingBridgeAboveFamily &&
      target &&
      (rel === 'father' || rel === 'vertical_ancestor')
        ? collectTopSiblingGroupIds(people, target)
        : new Set<string>();

    let assignedSiblingOfId: string | undefined;
    let createdInlineMother: InteractiveTreePerson | null = null;
    let inlineMotherFatherId: string | undefined;

    if (isAddingBridgeAboveFamily) {
      const assignedTier = Math.max(0, modalConfig.bridgeTier ?? 1);
      nextGenLevel = FIFTH_GRANDFATHER_LEVEL + 1 + assignedTier;
      isDirectSpineLineage = false;
      relationLabel =
        rel === 'horizontal_branch_above_family'
          ? 'فرع أفقي فوق العائلة نحو الجذر'
          : 'حلقة ربط فوق العائلة نحو الجذر';
      assignedMotherId = undefined;
      assignedSpouseIds = [];
    } else if (target && (rel === 'father' || rel === 'vertical_ancestor')) {
      nextGenLevel = target.generationLevel + 1;
      isDirectSpineLineage = Boolean(
        target.isDirectSpineLineage ||
          people.some(
            (p) => targetTopSiblingGroupIds.has(p.id) && p.isDirectSpineLineage
          )
      );
      relationLabel = getNextVerticalGrandfatherLabel(nextGenLevel);
      if (nextGenLevel <= FIFTH_GRANDFATHER_LEVEL && target.motherId) {
        assignedSpouseIds = [target.motherId];
      }
      assignedMotherId = undefined;
    } else if (target && rel === 'mother') {
      const childFather = target.fatherId
        ? findPerson(target.fatherId)
        : undefined;
      nextGenLevel = childFather
        ? childFather.generationLevel
        : target.generationLevel + 1;
      relationLabel = childFather
        ? `زوجة ${childFather.firstName}`
        : `والدة ${target.firstName}`;
      if (target.fatherId) {
        assignedSpouseIds = [target.fatherId];
      }
      assignedMotherId = undefined;
    } else if (target && rel === 'spouse') {
      nextGenLevel = target.generationLevel;
      relationLabel =
        formGender === 'female'
          ? `زوجة ${target.firstName}`
          : `زوج ${target.firstName}`;
      assignedSpouseIds = [target.id];
      assignedMotherId = undefined;
    } else if (target && (rel === 'brother' || rel === 'sister')) {
      nextGenLevel = target.generationLevel;
      relationLabel =
        rel === 'brother'
          ? `أخ لـ ${target.firstName}`
          : `أخت لـ ${target.firstName}`;
      assignedFatherId = target.fatherId;
      inlineMotherFatherId = target.fatherId;
      if (!target.fatherId) {
        assignedSiblingOfId = target.siblingOfId || target.id;
      }
    } else if (target && (rel === 'son' || rel === 'daughter')) {
      nextGenLevel = target.generationLevel - 1;
      relationLabel =
        rel === 'son' ? `ابن ${target.firstName}` : `ابنة ${target.firstName}`;
      if (target.gender === 'male') {
        assignedFatherId = target.id;
        inlineMotherFatherId = target.id;
      } else {
        assignedMotherId = target.id;
        const linkedHusband = resolveNodeQuickActionPolicy(
          people,
          target
        ).linkedHusband;
        assignedFatherId = linkedHusband?.id || target.spouseIds[0];
        inlineMotherFatherId = assignedFatherId;
      }
    }

    // Atomic inline new-mother creation (linked as Father's wife + Child's mother in one step)
    if (wantsInlineNewMother) {
      const inlineMomFather = inlineMotherFatherId
        ? findPerson(inlineMotherFatherId)
        : undefined;
      const newMotherId = `node-mother-${nowTs + 1}`;
      createdInlineMother = {
        id: newMotherId,
        firstName: cleanInlineMotherName,
        familyName: '',
        kunya: '',
        honorificTitle: 'بدون',
        gender: 'female',
        generationLevel: inlineMomFather
          ? inlineMomFather.generationLevel
          : nextGenLevel + 1,
        isDirectSpineLineage: false,
        relationToTargetLabel: inlineMomFather
          ? `زوجة ${inlineMomFather.firstName}`
          : `والدة ${cleanFirst}`,
        spouseIds: inlineMomFather ? [inlineMomFather.id] : [],
        maidenFamilyLine: inlineNewMotherMaidenLine.trim() || undefined,
        vitalStatus: 'unspecified',
        birthPrecision: 'year_only',
        birthCalendar: 'hijri',
        birthDateValue: '',
        birthPlace: '',
        femalePrivacyMasked: true,
      };
      assignedMotherId = newMotherId;
    }

    const isDeterministicFemaleRel =
      rel === 'mother' ||
      rel === 'sister' ||
      rel === 'daughter' ||
      (rel === 'spouse' && target?.gender === 'male');

    const effectiveGender: 'male' | 'female' =
      isAddingBridgeAboveFamily || nextGenLevel > FIFTH_GRANDFATHER_LEVEL
        ? 'male'
        : isDeterministicFemaleRel
        ? 'female'
        : 'male';

    const newPerson: InteractiveTreePerson = {
      id: newId,
      firstName: cleanFirst,
      familyName: '',
      kunya: formKunya.trim(),
      honorificTitle: formHonorific,
      prestigeBadge:
        formPrestigeBadge !== 'none' ? formPrestigeBadge : undefined,
      gender: effectiveGender,
      generationLevel: nextGenLevel,
      isDirectSpineLineage,
      isBridgeAboveFamily: isAddingBridgeAboveFamily || undefined,
      bridgeTier: isAddingBridgeAboveFamily
        ? Math.max(0, modalConfig.bridgeTier ?? 1)
        : undefined,
      relationToTargetLabel: relationLabel,
      fatherId: assignedFatherId,
      motherId:
        isAddingBridgeAboveFamily || nextGenLevel > FIFTH_GRANDFATHER_LEVEL
          ? undefined
          : assignedMotherId,
      siblingOfId: assignedSiblingOfId,
      spouseIds:
        isAddingBridgeAboveFamily || nextGenLevel > FIFTH_GRANDFATHER_LEVEL
          ? []
          : assignedSpouseIds,
      maidenFamilyLine: modalMeta?.isSpouseRole
        ? formMaidenFamilyLine.trim() || undefined
        : undefined,
      marriageAllianceNote:
        modalMeta?.isDaughterRole && !modalMeta?.isSpouseRole
          ? formMarriageAllianceNote.trim() || undefined
          : undefined,
      vitalStatus: formVitalStatus,
      birthPrecision: formBirthPrecision,
      birthCalendar: formBirthCalendar,
      birthDateValue: formBirthDate.trim(),
      birthPlace: formBirthPlace.trim(),
      deathDateValue:
        formVitalStatus === 'deceased' ? formDeathDate.trim() : undefined,
      deathPlace:
        formVitalStatus === 'deceased' ? formDeathPlace.trim() : undefined,
      femalePrivacyMasked:
        effectiveGender === 'female' ? formFemalePrivacyMasked : false,
      contactInfo:
        formVitalStatus === 'living' ? formContactInfo.trim() : undefined,
      biography: formBiography.trim() || undefined,
      attachedDocName: formAttachedDocName.trim() || undefined,
      photoUrl: formPhotoUrl.trim() || undefined,
      photoThumbnailUrl: formPhotoUrl.trim() || undefined,
    };

    const newlyAddedNodes = createdInlineMother
      ? [createdInlineMother, newPerson]
      : [newPerson];

    // Synchronously pre-register newly created nodes in Vault summary cache BEFORE `saveUserVaultArchive` fires `juthori:vault-updated`
    if (typeof window !== 'undefined') {
      try {
        const syncKey = getTreeStorageKeyForVaultSync(userId, result.familyName);
        const preSyncedList = ensureDirectFamilyInVaultSummaries(
          [...people, ...newlyAddedNodes].map((p) => ({
            id: p.id,
            fullName: p.firstName.trim(),
            relationLabel: p.isRecordKeeper
              ? 'أمين السجل'
              : p.relationToTargetLabel || 'فرد في المشجرة',
            gender: p.gender,
            avatarDataUrl: p.photoThumbnailUrl || p.photoUrl,
            birthYear: p.birthDateValue,
            isAlive: p.vitalStatus !== 'deceased',
            isCertifiedReference: false,
          })),
          result.familyName
        );
        window.localStorage.setItem(syncKey, JSON.stringify(preSyncedList));
      } catch {
        // Ignore storage error
      }
    }

    let updated = [...people];

    if (!isAddingBridgeAboveFamily && target) {
      const sibGroupForFather =
        rel === 'father' || rel === 'vertical_ancestor'
          ? collectTopSiblingGroupIds(people, target)
          : new Set<string>();

      updated = updated.map((p) => {
        if (
          createdInlineMother &&
          inlineMotherFatherId &&
          p.id === inlineMotherFatherId
        ) {
          return {
            ...p,
            spouseIds: (p.spouseIds || []).includes(createdInlineMother.id)
              ? p.spouseIds
              : [...(p.spouseIds || []), createdInlineMother.id],
          };
        }
        if (
          (rel === 'father' || rel === 'vertical_ancestor') &&
          (p.id === target.id || sibGroupForFather.has(p.id))
        ) {
          return { ...p, fatherId: newId, siblingOfId: undefined };
        }
        if (rel === 'mother' && p.id === target.id) {
          return { ...p, motherId: newId };
        }
        if (
          rel === 'father' &&
          nextGenLevel <= FIFTH_GRANDFATHER_LEVEL &&
          target.motherId &&
          p.id === target.motherId
        ) {
          return {
            ...p,
            spouseIds: p.spouseIds.includes(newId)
              ? p.spouseIds
              : [...p.spouseIds, newId],
          };
        }
        if (rel === 'mother' && target.fatherId && p.id === target.fatherId) {
          return {
            ...p,
            spouseIds: p.spouseIds.includes(newId)
              ? p.spouseIds
              : [...p.spouseIds, newId],
          };
        }
        if (rel === 'spouse' && p.id === target.id) {
          return {
            ...p,
            spouseIds: p.spouseIds.includes(newId)
              ? p.spouseIds
              : [...p.spouseIds, newId],
          };
        }
        return p;
      });
    }

    const finalList = [...updated, ...newlyAddedNodes];
    setPeople(finalList);

    const rk = finalList.find((u) => u.isRecordKeeper);
    const fNode = rk?.fatherId
      ? finalList.find((u) => u.id === rk.fatherId)
      : undefined;
    const gNode = fNode?.fatherId
      ? finalList.find((u) => u.id === fNode.fatherId)
      : undefined;
    if (onSyncImmediateParents) {
      onSyncImmediateParents(
        fNode?.firstName || '',
        gNode?.firstName || ''
      );
    }

    const combinedPendingVaultIds = Array.from(
      new Set([
        ...newPersonPendingVaultIds,
        ...Array.from(pendingVaultIdsRef.current),
      ])
    );

    if (combinedPendingVaultIds.length > 0) {
      const pendingSet = new Set(combinedPendingVaultIds);
      const latestVaultFromStorage = readVaultArchiveFromLocal(
        userId,
        result.familyName,
        userEmail
      );
      const baseVaultItems =
        latestVaultFromStorage.items.length >= vaultItems.length
          ? latestVaultFromStorage.items
          : vaultItems;
      const updatedVaultItems = baseVaultItems.map((item) => {
        if (!pendingSet.has(item.id)) return item;
        const nextIds = item.linkedPersonIds.includes(newId)
          ? item.linkedPersonIds
          : [...item.linkedPersonIds, newId];
        return { ...item, linkedPersonIds: nextIds };
      });
      setVaultItems(updatedVaultItems);
      saveUserVaultArchive(
        userId,
        result.familyName,
        {
          folders: vaultFolders,
          items: updatedVaultItems,
        },
        userEmail
      ).catch(() => {});
      setNewPersonPendingVaultIds([]);
      pendingVaultIdsRef.current = new Set();
    }

    onLogActivity(
      'إضافة فرد جديد في شجرتي',
      createdInlineMother
        ? `تمت إضافة «${cleanFirst}» (${relationLabel}) ووالدته «${createdInlineMother.firstName}» كزوجة للأب`
        : `تمت إضافة «${cleanFirst}» (${relationLabel})`
    );
    setModalConfig(null);
  };

  // ============================================================================
  // SAFE CASCADING SUBTREE DELETION WITH STRICT CONFIRMATION & VAULT CLEANUP
  // ============================================================================
  const handleDeleteNode = (person: InteractiveTreePerson) => {
    if (!isRecordKeeperCharterSigned) {
      onSignCharterAndEnableTree();
      return;
    }
    if (person.isRecordKeeper) return;

    const { allDeletedIds, descendantNodes, isProtectedSpineAncestor } =
      collectCascadeDeleteIds(people, person.id);

    const linkedDocsCount = vaultItems.filter((vi) =>
      vi.linkedPersonIds.some((pid) => allDeletedIds.has(pid))
    ).length;

    setPendingDeletePrompt({
      person,
      descendantNodes,
      isProtectedSpineAncestor,
      linkedDocsCount,
    });
  };

  const handleConfirmDeleteNode = async () => {
    if (!pendingDeletePrompt) return;
    const { person, linkedDocsCount } = pendingDeletePrompt;
    setPendingDeletePrompt(null);

    if (person.isRecordKeeper) return;

    const { allDeletedIds, descendantNodes, isProtectedSpineAncestor } =
      collectCascadeDeleteIds(people, person.id);

    // Bridge upward `fatherId` ONLY for the protected direct-spine child if deleting a direct-spine ancestor
    const bridgedFatherId = isProtectedSpineAncestor
      ? person.fatherId
      : undefined;

    let nextPeople = people
      .filter((p) => !allDeletedIds.has(p.id))
      .map((p) => ({
        ...p,
        fatherId:
          p.fatherId && allDeletedIds.has(p.fatherId)
            ? p.isDirectSpineLineage && isProtectedSpineAncestor
              ? bridgedFatherId
              : undefined
            : p.fatherId,
        motherId:
          p.motherId && allDeletedIds.has(p.motherId) ? undefined : p.motherId,
        siblingOfId:
          p.siblingOfId && allDeletedIds.has(p.siblingOfId)
            ? undefined
            : p.siblingOfId,
        spouseIds: p.spouseIds.filter((s) => !allDeletedIds.has(s)),
      }));

    // Recompute direct spine generation levels cleanly after deletion
    const rk = nextPeople.find((p) => p.isRecordKeeper);
    if (rk) {
      const levelById = new Map<string, number>();
      let curr: InteractiveTreePerson | undefined = rk;
      let lvl = 1;
      const seen = new Set<string>();
      while (curr && !seen.has(curr.id)) {
        seen.add(curr.id);
        levelById.set(curr.id, lvl);
        curr = curr.fatherId
          ? nextPeople.find((x) => x.id === curr!.fatherId)
          : undefined;
        lvl += 1;
      }
      nextPeople = nextPeople.map((p) => {
        const syncedLvl = levelById.get(p.id);
        if (syncedLvl && syncedLvl !== p.generationLevel) {
          return {
            ...p,
            generationLevel: syncedLvl,
            relationToTargetLabel: p.isRecordKeeper
              ? 'أمين السجل'
              : getNextVerticalGrandfatherLabel(syncedLvl),
          };
        }
        return p;
      });
    }

    setPeople(nextPeople);

    // Atomically scrub ALL deleted IDs from all vault items (`linkedPersonIds`) so zero Orphaned IDs remain
    const hadAnyVaultReferences = vaultItems.some((vi) =>
      vi.linkedPersonIds.some((pid) => allDeletedIds.has(pid))
    );
    if (hadAnyVaultReferences) {
      const cleanedVaultItems = vaultItems.map((vi) =>
        vi.linkedPersonIds.some((pid) => allDeletedIds.has(pid))
          ? {
              ...vi,
              linkedPersonIds: vi.linkedPersonIds.filter(
                (pid) => !allDeletedIds.has(pid)
              ),
            }
          : vi
      );
      setVaultItems(cleanedVaultItems);
      await saveUserVaultArchive(
        userId,
        result.familyName,
        {
          folders: vaultFolders,
          items: cleanedVaultItems,
        },
        userEmail
      );
    }

    onLogActivity(
      'حذف عقدة وفروعها من شجرتي وتنظيف الروابط',
      descendantNodes.length > 0
        ? `تم حذف «${person.firstName}» و(${descendantNodes.length}) من الفروع والأبناء التابعين له بالكامل`
        : linkedDocsCount > 0
          ? `تمت إزالة «${person.firstName}» وفك ارتباطه من (${linkedDocsCount}) وثائق مع بقاء الملفات محفوظة في خزانتي`
          : `تمت إزالة «${person.firstName}» من المشجرة`
    );
  };

  /**
   * Formats card display strictly to ONLY what the user entered:
   * - Registered Name ONLY (`firstName` + explicit `honorificTitle` if not `'بدون'`) — NEVER appends `familyName`!
   * - Kunya ONLY if explicitly entered by the user.
   * - Female Privacy Option applied quietly when enabled.
   */
  const getCleanCardDisplay = (person: InteractiveTreePerson) => {
    const honorificPrefix =
      treeDisplaySettings.showHonorific &&
      person.honorificTitle &&
      person.honorificTitle !== 'بدون'
        ? `${person.honorificTitle} `
        : '';

    const isMaskedFemale =
      person.gender === 'female' &&
      treeDisplaySettings.femalePrivacyMode === 'kunya_only';

    if (isMaskedFemale) {
      const father = person.fatherId ? findPerson(person.fatherId) : undefined;
      const maskedName = person.kunya?.trim()
        ? person.kunya.trim()
        : father
        ? `كريمة ${father.firstName}`
        : 'كريمة العائلة';
      return {
        mainName: maskedName,
        kunyaOrTitle: '',
        isMaskedNow: true,
      };
    }

    return {
      mainName: `${honorificPrefix}${person.firstName}`.trim(),
      kunyaOrTitle: person.kunya?.trim() ? person.kunya.trim() : '',
      isMaskedNow: false,
    };
  };

  // ============================================================================
  // TIER GOVERNANCE: All customers can access «شجرتي» within their tier quota:
  // Free = 15, $5 Basic = 50, Annual VIP Individual = 250, Family Registrar = Unlimited
  // ============================================================================

  // ============================================================================
  // NATURAL LINEAGE SPINE RENDERER ABOVE THE FAMILY TREE
  // (Same card design and simplified "↑ بن" / "↑ من" connectors as LineageSpineColumn.tsx)
  // ============================================================================
  const renderSpineConnectorBadge = (
    connectorLabel: SpineConnectorLabel = 'من (سليل غير مباشر)'
  ) => {
    const isDirectBin = connectorLabel === 'بن (سليل مباشر)';
    if (!treeDisplaySettings.showKinshipArrows) {
      return (
        <div
          data-testid={
            isDirectBin
              ? 'spine-connector-solid-arrow'
              : 'spine-connector-dashed-arrow'
          }
          title={isDirectBin ? 'نسب مباشر' : 'امتداد نسب غير مباشر'}
          className="flex flex-col items-center relative z-10 my-1"
        >
          {isDirectBin ? (
            <div className={`w-[2px] h-7 ${activeTreeTheme.connectorStrong}`} />
          ) : (
            <div
              className={`w-0 h-7 border-r-2 border-dashed ${activeTreeTheme.connectorBorderDashed}`}
            />
          )}
          {renderDownwardArrowTip(isDirectBin)}
        </div>
      );
    }

    const shortConnectorText = isDirectBin ? '↑ بن' : '↑ من';
    return (
      <div className="flex flex-col items-center relative z-10 my-1">
        <div className="w-0.5 h-3.5 bg-[#8D4925]/45" />
        <div
          className={`inline-flex items-center justify-center px-3.5 py-1 rounded-full text-xs font-display font-bold shadow-2xs border ${
            isDirectBin
              ? 'bg-[#FAF6F0] border-[#8D4925]/45 text-[#8D4925]'
              : 'bg-[#FFF8F0] border-[#D8755B]/60 text-[#D8755B]'
          }`}
        >
          <span>{shortConnectorText}</span>
        </div>
        <div className="w-0.5 h-3.5 bg-[#8D4925]/45" />
      </div>
    );
  };

  const renderSidewaysSpineConnector = (
    connectorLabel: SpineConnectorLabel = 'من (سليل غير مباشر)'
  ) => {
    const isDirectBin = connectorLabel === 'بن (سليل مباشر)';
    if (!treeDisplaySettings.showKinshipArrows) {
      return (
        <div
          title={isDirectBin ? 'نسب مباشر' : 'امتداد نسب غير مباشر'}
          className="flex flex-row items-center shrink-0 mx-0.5"
        >
          {isDirectBin ? (
            <div className={`h-[2px] w-7 ${activeTreeTheme.connectorStrong}`} />
          ) : (
            <div
              className={`h-0 w-7 border-t-2 border-dashed ${activeTreeTheme.connectorBorderDashed}`}
            />
          )}
          {renderLeftwardArrowTip(isDirectBin)}
        </div>
      );
    }

    return (
      <div className="flex flex-row items-center shrink-0 mx-0.5">
        <div className={`h-[2px] w-3 ${activeTreeTheme.connectorSoft}`} />
        <span
          className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-display font-bold border ${
            isDirectBin
              ? 'bg-[#FAF6F0] border-[#8D4925]/45 text-[#8D4925]'
              : 'bg-[#FFF8F0] border-[#D8755B]/60 text-[#D8755B]'
          }`}
        >
          {isDirectBin ? '← بن' : '← من'}
        </span>
        <div className={`h-[2px] w-2 ${activeTreeTheme.connectorSoft}`} />
        {renderLeftwardArrowTip(isDirectBin)}
      </div>
    );
  };

  const renderFamilyStationCard = (nextBridgeTier: number) => {
    const station1Node = spineNodes[0];
    const isDirectFamilyMenuOpen =
      radialTargetNodeId === DIRECT_FAMILY_VAULT_NODE_ID;
    const directFamilyMediaCount = vaultItems.filter((vi) =>
      vi.linkedPersonIds.includes(DIRECT_FAMILY_VAULT_NODE_ID)
    ).length;

    return (
      <div
        className={`relative flex flex-col items-center pb-3 ${
          isDirectFamilyMenuOpen ? 'z-40' : 'z-10'
        }`}
      >
        <div className="max-w-[340px] w-[248px] sm:w-[280px] mx-auto rounded-2xl bg-gradient-to-r from-purple-50/95 via-white to-purple-50/95 border-2 border-[#7C3AED]/55 py-3 px-4 shadow-xs relative text-right">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <HeritageNodeAvatar
                node={station1Node}
                eraOverride="family_branch"
                avatarStyle={treeDisplaySettings.avatarStyle}
                size="sm"
              />
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-[#7C3AED]">
                  العائلة
                </div>
                <div className="text-sm sm:text-base font-display font-extrabold text-[#252321] truncate">
                  {cleanNaturalSpineName(result.familyName)}
                </div>
              </div>
            </div>
            <button
              type="button"
              data-testid="direct-family-edit-vault-btn"
              onClick={() => {
                if (!isRecordKeeperCharterSigned) {
                  onSignCharterAndEnableTree();
                  return;
                }
                setQuickVaultPreviewPersonId(DIRECT_FAMILY_VAULT_NODE_ID);
              }}
              title="إضافة وإدارة وثائق وصور العائلة في خزانتي"
              aria-label="تعديل وثائق وصور العائلة في خزانتي"
              className="w-7 h-7 rounded-lg bg-white hover:bg-[#7C3AED] text-[#7C3AED] hover:text-white border border-[#7C3AED]/30 flex items-center justify-center transition-colors cursor-pointer shrink-0 shadow-2xs"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {directFamilyMediaCount > 0 && (
            <button
              type="button"
              data-testid="direct-family-vault-badge"
              onClick={() => setQuickVaultPreviewPersonId(DIRECT_FAMILY_VAULT_NODE_ID)}
              title="معاينة سريعة للصور والوثائق المربوطة بالعائلة في خزانتي"
              className="absolute bottom-1.5 left-1.5 z-20 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[#FEF3C7] hover:bg-[#FDE68A] border border-[#D97706]/55 text-[#92400E] text-[9px] font-display font-extrabold cursor-pointer transition-colors shadow-2xs"
            >
              <span>📎 {directFamilyMediaCount}</span>
            </button>
          )}

          {/* Circular (+) Button matching all other tree nodes — opens ONLY 2 choices: إضافة جد / إضافة فرع */}
          <div className="mt-2.5 flex justify-center -mb-5 relative z-20">
            <button
              type="button"
              data-testid="direct-family-plus-btn"
              onClick={() => {
                if (!isRecordKeeperCharterSigned) {
                  onSignCharterAndEnableTree();
                  return;
                }
                setRadialTargetNodeId((cur) =>
                  cur === DIRECT_FAMILY_VAULT_NODE_ID
                    ? null
                    : DIRECT_FAMILY_VAULT_NODE_ID
                );
              }}
              title="إضافة جد أو فرع"
              aria-label="إضافة جد أو فرع للعائلة"
              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold shadow-sm border-2 border-white transition-all cursor-pointer ${
                isDirectFamilyMenuOpen
                  ? 'bg-[#252321] text-white scale-110 ring-3 ring-[#7C3AED]/35'
                  : 'bg-[#7C3AED] hover:bg-[#6D28D9] text-white hover:scale-105'
              }`}
            >
              {isDirectFamilyMenuOpen ? (
                <X className="w-3 h-3" />
              ) : (
                <Plus className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>

        {/* 2-Option Popover for Direct Family Node: إضافة جد | إضافة فرع */}
        {isDirectFamilyMenuOpen && (
          <div
            data-testid="direct-family-radial-menu"
            className="mt-4 rounded-2xl bg-[#252321] text-white p-3.5 shadow-2xl border-2 border-[#7C3AED] space-y-2.5 relative z-50 w-[240px]"
          >
            <div className="flex items-center justify-between border-b border-white/15 pb-1.5">
              <span className="text-xs font-display font-bold text-[#F3D299]">
                {cleanNaturalSpineName(result.familyName)}
              </span>
              <button
                type="button"
                onClick={() => setRadialTargetNodeId(null)}
                className="px-1.5 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-[10px] font-bold text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-testid="direct-family-add-ancestor-option"
                onClick={() =>
                  openAddBridgeAboveFamilyModal(
                    'bridge_above_family',
                    nextBridgeTier
                  )
                }
                className="py-2 px-2.5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-display font-bold text-center cursor-pointer transition-colors"
              >
                + إضافة جد
              </button>
              <button
                type="button"
                data-testid="direct-family-add-branch-option"
                onClick={() =>
                  openAddBridgeAboveFamilyModal(
                    'horizontal_branch_above_family',
                    0
                  )
                }
                className="py-2 px-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-display font-bold text-center cursor-pointer transition-colors"
              >
                + إضافة فرع
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSingleNaturalSpineNodeCard = (node: UpperAncestorNode) => {
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
    const resolvedEra = resolveNodeHistoricalEra(node);
    const eraBadgeText = getHistoricalEraBadgeLabel(resolvedEra);
    const cleanTitle = cleanNaturalSpineName(node.name);

    if (isRootNode) {
      return (
        <div
          key={node.id}
          className="max-w-[420px] w-full mx-auto rounded-2xl bg-gradient-to-br from-[#FFFDF9] via-[#FFF8F0] to-[#FFEDD5] border-2 border-[#E67E22] py-3 px-4 shadow-xs text-right relative overflow-hidden"
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
        </div>
      );
    }

    if (isAdamNode) {
      return (
        <div
          key={node.id}
          className="max-w-[420px] w-full mx-auto rounded-2xl bg-gradient-to-l from-[#252321] via-[#352F2B] to-[#252321] text-white border-2 border-[#D8755B] py-3 px-4 shadow-md text-right relative overflow-hidden"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <HeritageNodeAvatar
                node={node}
                eraOverride="prophets_genesis"
                size="md"
              />
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-[#F5D78E]">
                  قمة شجرة آدم الموثقة
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

    return (
      <div
        key={node.id}
        className="max-w-[420px] w-full mx-auto rounded-2xl bg-white/95 border border-[#B98A78]/55 py-3 px-4 text-right shadow-2xs"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <HeritageNodeAvatar node={node} size="md" />
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

  // Calm collapsible left-side note for pending upper-layer researcher merge (collapsed by default, unfolds leftward)
  const renderTreeUpperLayersSideNote = () => {
    const showAlphaPendingMerge =
      result.matched &&
      result.isAlphaOnlyBeforeMerge &&
      !result.isAlphaMergedIntoAdam &&
      caps.isVip;
    const showUnmatchedPendingTicket = !result.matched && caps.isVip;

    if (!showAlphaPendingMerge && !showUnmatchedPendingTicket) {
      return null;
    }

    return (
      <aside
        data-testid="tree-upper-layers-side-note"
        aria-label="ملاحظة متابعة التوثيق"
        className="inline-flex flex-col items-start max-w-full"
      >
        <button
          type="button"
          onClick={() => setIsFollowUpNoteOpen((prev) => !prev)}
          aria-expanded={isFollowUpNoteOpen}
          data-testid="tree-followup-toggle-btn"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#FFFDF9] hover:bg-[#FAF3E6] border border-[#D4AF37]/85 border-r-4 border-r-[#D8755B] text-xs font-display font-extrabold text-[#8D4925] shadow-xs transition-all cursor-pointer shrink-0"
        >
          <span>⏳</span>
          <span>ملاحظة متابعة التوثيق</span>
          <ChevronLeft
            className={`w-3.5 h-3.5 text-[#D8755B] transition-transform duration-200 ${
              isFollowUpNoteOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {isFollowUpNoteOpen && (
          <div className="mt-2 w-[265px] sm:w-[285px] max-w-full rounded-2xl bg-[#FFFDF9]/98 border border-[#D4AF37]/80 border-r-4 border-r-[#D8755B] p-4 shadow-md text-right space-y-2 origin-top-right transition-all">
            {showAlphaPendingMerge ? (
              <>
                <h4 className="text-xs sm:text-sm font-display font-extrabold text-[#252321] leading-snug">
                  جاري استكمال ربط وتوثيق الطبقات العليا حتى آدم عليه السلام
                </h4>
                <p className="text-[11px] text-[#252321]/80 leading-relaxed">
                  باقتك السنوية مفعّلة — يعمل فريق النسابين حالياً على المراجعة النهائية لوصل (
                  {cleanNaturalSpineName(result.rootTribeName || 'القبيلة الأم')}) بعمودها التاريخي الأعلى، وستظهر العُقد المفتوحة تلقائياً فور اعتمادها.
                </p>
              </>
            ) : (
              <>
                <h4 className="text-xs sm:text-sm font-display font-extrabold text-[#252321] leading-snug">
                  تذكرة بحث وتوثيق نشطة لدى فريق الباحثين
                </h4>
                <p className="text-[11px] text-[#252321]/80 leading-relaxed">
                  تظهر عُقد عمود النسب الأعلى تلقائياً فور اعتماد فريق الباحثين لتذكرة عائلة ({result.familyName}).
                </p>
              </>
            )}
          </div>
        )}
      </aside>
    );
  };

  const renderNaturalLineageSpineAboveTree = () => {
    // Zone 3 (من نقطة الجذر صعوداً): 100% read-only from verified platform lineage data
    const targetMaxOrder =
      spineDepth === 'family'
        ? depthMilestones.familyOrder
        : spineDepth === 'sub_branch'
        ? depthMilestones.subBranchOrder
        : spineDepth === 'mother_tribe'
        ? depthMilestones.motherTribeOrder
        : spineDepth === 'historical_stock'
        ? depthMilestones.historicalStockOrder
        : depthMilestones.maxOrder;

    type SpineEntry =
      | { kind: 'node'; node: UpperAncestorNode }
      | { kind: 'ringGroup'; ringGroup: AncestorCapsule };

    const ascendingUpperEntries: SpineEntry[] = [];
    const handledRings = new Set<string>();

    for (const node of spineNodes) {
      if (node.orderNumber === 1) continue; // Family station rendered at base of natural spine
      if (node.orderNumber > targetMaxOrder) break;

      if (result.isAlphaMergedIntoAdam || node.isCodedStation) {
        ascendingUpperEntries.push({ kind: 'node', node });
      } else if (node.capsuleId) {
        if (unlockedCapsules.includes(node.capsuleId)) {
          ascendingUpperEntries.push({ kind: 'node', node });
        } else if (!handledRings.has(node.capsuleId)) {
          handledRings.add(node.capsuleId);
          const ringObj = capsulesList.find((c) => c.id === node.capsuleId);
          if (ringObj) {
            ascendingUpperEntries.push({ kind: 'ringGroup', ringGroup: ringObj });
          }
        }
      } else {
        ascendingUpperEntries.push({ kind: 'node', node });
      }
    }

    const topToBottomEntries = [...ascendingUpperEntries].reverse();
    // Never leave a dangling folded ring (`+X أجداد`) above the highest verified node
    while (
      topToBottomEntries.length > 0 &&
      topToBottomEntries[0].kind === 'ringGroup'
    ) {
      topToBottomEntries.shift();
    }

    const lowestRenderedUpperEntry =
      topToBottomEntries[topToBottomEntries.length - 1];

    const bridgeNodesAboveFamily = people.filter((p) => p.isBridgeAboveFamily);
    const horizontalBesideFamily = bridgeNodesAboveFamily.filter(
      (p) => (p.bridgeTier ?? 1) === 0
    );
    const upperBridgeTiersMap = new Map<number, InteractiveTreePerson[]>();
    let maxUpperBridgeTier = 0;
    for (const bn of bridgeNodesAboveFamily) {
      const t = bn.bridgeTier ?? 1;
      if (t >= 1) {
        if (t > maxUpperBridgeTier) maxUpperBridgeTier = t;
        const arr = upperBridgeTiersMap.get(t) || [];
        arr.push(bn);
        upperBridgeTiersMap.set(t, arr);
      }
    }
    const descendingBridgeTiers = Array.from(upperBridgeTiersMap.keys()).sort(
      (a, b) => b - a
    );

    return (
      <div className="w-full flex flex-col items-center">
        {/* Top-to-Bottom Verified Read-Only Spine Nodes (Highest linked node always cleanly at the top) */}
        <div className="w-full max-w-[420px] mx-auto flex flex-col items-center">
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
                {entry.kind === 'node' ? (
                  renderSingleNaturalSpineNodeCard(entry.node)
                ) : (
                  <div className="flex justify-center relative z-10 my-1">
                    <button
                      type="button"
                      onClick={() => onRequestUnlockCapsule?.(entry.ringGroup)}
                      title={`اضغط لإظهار أسماء الأجداد الفرعيين (${entry.ringGroup.betweenLabel})`}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#F7F2E9] hover:bg-[#EFE6D5] border border-[#E6DFD3] hover:border-[#D8755B] text-[#8D4925] text-xs font-display font-bold shadow-2xs transition-all cursor-pointer"
                    >
                      <span>🔒</span>
                      <span>+{entry.ringGroup.ancestors.length} أجداد</span>
                    </button>
                  </div>
                )}

                {idx < topToBottomEntries.length - 1 &&
                  renderSpineConnectorBadge(connectorLabel)}
              </React.Fragment>
            );
          })}

          {/* Connector between lowest Upper Spine entry and Bridge Zone / Family Station Node */}
          {topToBottomEntries.length > 0 &&
            renderSpineConnectorBadge(
              lowestRenderedUpperEntry?.kind === 'node'
                ? resolveSpineConnectorLabel(
                    spineNodes[0],
                    lowestRenderedUpperEntry.node,
                    lowestRenderedUpperEntry.node.orderNumber -
                      spineNodes[0].orderNumber >
                      1
                  )
                : 'من (سليل غير مباشر)'
            )}
        </div>

        {/* ================================================================ */}
        {/* ZONE ABOVE DIRECT FAMILY UP TO ROOT (`فوق العائلة المباشرة وحتى الجذر`) */}
        {/* Supports horizontal sibling/branch addition & upward links        */}
        {/* ================================================================ */}
        {descendingBridgeTiers.map((tierNum) => {
          const tierNodes = upperBridgeTiersMap.get(tierNum) || [];
          return (
            <React.Fragment key={`bridge-tier-${tierNum}`}>
              <div className="w-full flex flex-col items-center my-1">
                <div className="flex flex-wrap items-center justify-center gap-4">
                  {tierNodes.map((bNode) => renderPersonCard(bNode))}
                  <button
                    type="button"
                    onClick={() =>
                      openAddBridgeAboveFamilyModal(
                        'horizontal_branch_above_family',
                        tierNum
                      )
                    }
                    className="px-3.5 py-2.5 rounded-2xl bg-[#FFFDF9] hover:bg-white border-2 border-dashed border-[#8D4925]/65 hover:border-[#D8755B] text-xs font-display font-extrabold text-[#8D4925] hover:text-[#D8755B] shadow-2xs transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة فرع أفقي</span>
                  </button>
                </div>
              </div>
              {renderSpineConnectorBadge('من (سليل غير مباشر)')}
            </React.Fragment>
          );
        })}

        {/* Single Clean Add Ancestor Button Directly Above `العائلة المباشرة` */}
        <div
          data-testid="above-direct-family-add-bar"
          className="my-1.5 flex items-center justify-center relative z-20"
        >
          <button
            type="button"
            data-testid="add-above-family-upward-btn"
            onClick={() =>
              openAddBridgeAboveFamilyModal(
                'bridge_above_family',
                maxUpperBridgeTier + 1
              )
            }
            className="px-4 py-2 rounded-2xl bg-[#FFFDF9] hover:bg-white border-2 border-dashed border-[#D8755B] text-xs font-display font-extrabold text-[#252321] hover:text-[#D8755B] shadow-2xs transition-all cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 text-[#D8755B]" />
            <span>إضافة جد</span>
          </button>
        </div>

        <div className="w-0.5 h-3.5 bg-[#8D4925]/45 my-0.5" />

        {/* Base of Natural Lineage Spine: Family Station Node + Optional Horizontal Sibling Branches */}
        <div className="w-full flex flex-wrap items-start justify-center gap-4">
          {renderFamilyStationCard(maxUpperBridgeTier + 1)}
          {horizontalBesideFamily.map((hNode) => renderPersonCard(hNode))}
        </div>

        {/* Natural Connector from Topmost Family Tree Ancestor to Family Station Node */}
        {renderSpineConnectorBadge('من (سليل غير مباشر)')}
      </div>
    );
  };

  // ============================================================================
  // RENDER PERSON CARD (Strictly Zero-Fabrication + 3-Zone Genealogical Rules)
  // ============================================================================
  const renderPersonCard = (person: InteractiveTreePerson) => {
    const isRadialOpen = radialTargetNodeId === person.id;
    const { mainName, kunyaOrTitle, isMaskedNow } = getCleanCardDisplay(person);
    const isVerticalOnlyLink = person.generationLevel > FIFTH_GRANDFATHER_LEVEL;
    const isFifthGrandfatherBoundary =
      person.generationLevel === FIFTH_GRANDFATHER_LEVEL;
    const canAddFullParentsAndSiblings =
      person.generationLevel < FIFTH_GRANDFATHER_LEVEL;
    const hasFather = Boolean(person.fatherId && findPerson(person.fatherId));
    const hasMother = Boolean(person.motherId && findPerson(person.motherId));

    // Determine historical portrait role for HeritageNodeAvatar
    const avatarPersonRole =
      person.generationLevel >= 4
        ? 'near_ancestor'
        : person.isRecordKeeper
        ? 'client'
        : person.generationLevel === 2
        ? 'father'
        : person.generationLevel === 3
        ? 'grandfather'
        : 'child';

    // Build clean single-line date / mercy text using selected calendar system (Hijri / Gregorian / Dual)
    const dateAndStatusParts: string[] = [];
    if (person.birthDateValue?.trim()) {
      const formattedBirth = formatTreeDateByCalendarMode(
        person.birthDateValue,
        person.birthCalendar,
        treeDisplaySettings.calendarDisplayMode
      );
      if (formattedBirth) {
        const precPrefix =
          person.birthPrecision === 'approximate'
            ? 'قرابة '
            : person.birthPrecision === 'era'
            ? 'حقبة '
            : '';
        dateAndStatusParts.push(`${precPrefix}${formattedBirth}`);
      }
    }
    const isDeceased = person.vitalStatus === 'deceased';
    if (isDeceased && treeDisplaySettings.showDeceasedDignityFrame) {
      dateAndStatusParts.push(
        person.gender === 'female' ? 'رحمها الله' : 'رحمه الله'
      );
    }
    const cleanMetaLine = dateAndStatusParts.join(' · ');
    const allianceSubLine = (
      person.maidenFamilyLine ||
      person.marriageAllianceNote ||
      ''
    ).trim();

    // Show ONLY 'أمين السجل' badge inside Record Keeper node — omit الأب/الجد الأول/... on all other cards for clean uniform alignment
    const topRoleLabel = person.isRecordKeeper ? 'أمين السجل' : '';

    const personMediaCount = vaultItems.filter((vi) =>
      vi.linkedPersonIds.includes(person.id)
    ).length;

    const isCompassHighlighted =
      treeDisplaySettings.highlightDirectCompass &&
      directCompassIds.has(person.id);

    const isVitalDimmed =
      (treeDisplaySettings.vitalStatusFilter === 'living' && isDeceased) ||
      (treeDisplaySettings.vitalStatusFilter === 'deceased' && !isDeceased);

    const deceasedDignityClass =
      isDeceased && treeDisplaySettings.showDeceasedDignityFrame
        ? activeTreeTheme.isDarkSurface
          ? 'border-[#9CA3AF]/75 ring-1 ring-[#D4AF37]/30'
          : 'border-[#64748B]/75 ring-1 ring-[#94A3B8]/35'
        : '';

    const compassGlowClass = isCompassHighlighted
      ? 'ring-3 ring-[#D4AF37]/80 border-[#D4AF37] shadow-[0_0_22px_rgba(212,175,55,0.42)]'
      : '';

    const isSpotlighted = spotlightPersonId === person.id;
    const isKinshipNodeHighlighted =
      isKinshipHighlightedOnCanvas &&
      Boolean(kinshipPathResult?.pathNodeIds.has(person.id));

    const spotlightGlowClass = isSpotlighted
      ? 'ring-4 ring-[#D4AF37] border-[#D4AF37] shadow-[0_0_28px_rgba(212,175,55,0.7)] scale-[1.03]'
      : '';

    const kinshipPathGlowClass = isKinshipNodeHighlighted
      ? 'ring-3 ring-[#C5A059] border-[#C5A059] shadow-[0_0_24px_rgba(197,160,89,0.58)]'
      : '';

    const prestigeBadgeMeta = treeDisplaySettings.showPrestigeBadges
      ? resolvePrestigeBadgeMeta(person.prestigeBadge, person.gender)
      : null;

    const cardSurfaceClass = `${
      person.isRecordKeeper
        ? activeTreeTheme.recordKeeperCard
        : isVerticalOnlyLink
        ? activeTreeTheme.verticalCard
        : person.gender === 'female'
        ? activeTreeTheme.femaleCard
        : person.generationLevel >= 4
        ? activeTreeTheme.elderCard
        : activeTreeTheme.defaultCard
    } ${deceasedDignityClass} ${compassGlowClass} ${kinshipPathGlowClass} ${spotlightGlowClass} ${
      isVitalDimmed ? 'opacity-35 saturate-50' : ''
    }`;

    const cardDensityClasses =
      treeDisplaySettings.cardDensity === 'compact'
        ? 'w-[138px] sm:w-[148px] min-h-[70px] p-1.5 rounded-lg'
        : treeDisplaySettings.cardDensity === 'detailed'
        ? 'w-[186px] sm:w-[202px] min-h-[104px] p-3 rounded-2xl'
        : 'w-[156px] sm:w-[168px] min-h-[84px] p-2.5 rounded-xl';

    const avatarSizeForDensity =
      treeDisplaySettings.cardDensity === 'compact'
        ? 'xs'
        : treeDisplaySettings.cardDensity === 'detailed'
        ? 'md'
        : 'sm';

    const renderVaultCornerBadge = (positionClass = 'bottom-1.5 left-1.5') =>
      personMediaCount > 0 ? (
        <button
          type="button"
          data-testid={`tree-card-vault-badge-${person.id}`}
          onClick={() => setQuickVaultPreviewPersonId(person.id)}
          title="معاينة سريعة للصور والوثائق المربوطة بهذا الفرد في خزانتي"
          className={`absolute ${positionClass} z-20 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[#FEF3C7] hover:bg-[#FDE68A] border border-[#D97706]/55 text-[#92400E] text-[9px] font-display font-extrabold cursor-pointer transition-colors shadow-2xs`}
        >
          <span>📎 {personMediaCount}</span>
        </button>
      ) : null;

    const renderAvatarWithCamera = () => (
      <div className="relative shrink-0">
        <HeritageNodeAvatar
          personRole={avatarPersonRole}
          gender={person.gender}
          avatarStyle={treeDisplaySettings.avatarStyle}
          customImageUrl={person.photoThumbnailUrl || person.photoUrl}
          preferRealPhoto={treeDisplaySettings.preferRealPhotos}
          displayName={mainName}
          frameAccentHex={activeTreeTheme.primaryHex}
          isPrivacyMasked={isMaskedNow}
          size={avatarSizeForDensity}
        />

        <button
          type="button"
          onClick={() => {
            if (!isRecordKeeperCharterSigned) {
              onSignCharterAndEnableTree();
              return;
            }
            setPhotoPickerNodeId(person.id);
            setCustomPhotoUrlInput(person.photoUrl || '');
          }}
          title="تغيير الصورة الشخصية"
          className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#252321] hover:bg-[#D8755B] text-white border border-white flex items-center justify-center shadow-2xs transition-colors cursor-pointer"
        >
          <Camera className="w-2.5 h-2.5" />
        </button>
      </div>
    );

    const renderEditDeleteIcons = () => (
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => openEditPersonModal(person)}
          title={
            isRecordKeeperCharterSigned
              ? 'تعديل بيانات الفرد'
              : 'يلزم التوقيع على ميثاق أمين السجل لتعديل السجلات'
          }
          className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors cursor-pointer ${activeTreeTheme.actionBtn}`}
        >
          <Edit2 className="w-2.5 h-2.5" />
        </button>
        {!person.isRecordKeeper && (
          <button
            type="button"
            data-testid={`delete-tree-node-btn-${person.id}`}
            onClick={() => handleDeleteNode(person)}
            title="حذف العقدة"
            className="w-5 h-5 rounded-md bg-black/5 hover:bg-red-700 text-[#252321]/60 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <Trash2 className="w-2.5 h-2.5" />
          </button>
        )}
      </div>
    );

    const renderPlusNodeButton = (wrapperClass = 'mt-2 flex justify-center -mb-5 relative z-20') =>
      !isVerticalOnlyLink ? (
        <div className={wrapperClass}>
          <button
            type="button"
            onClick={() => {
              if (!isRecordKeeperCharterSigned) {
                onSignCharterAndEnableTree();
                return;
              }
              setRadialTargetNodeId((cur) =>
                cur === person.id ? null : person.id
              );
            }}
            title={
              isRecordKeeperCharterSigned
                ? 'إضافة قريب (+)'
                : 'وقّع ميثاق أمين السجل لتفعيل الإضافة'
            }
            aria-label={`إضافة قريب لـ ${person.firstName}`}
            className={`w-6 h-6 rounded-full flex items-center justify-center font-bold shadow-sm border-2 border-white transition-all cursor-pointer ${
              isRadialOpen
                ? 'bg-[#252321] text-white scale-110 ring-3 ring-[#D8755B]/35'
                : `${activeTreeTheme.plusBtn} hover:scale-105`
            }`}
          >
            {isRadialOpen ? (
              <X className="w-3 h-3" />
            ) : (
              <Plus className="w-3 h-3" />
            )}
          </button>
        </div>
      ) : null;

    const safeLeafUid = person.id.replace(/[^a-zA-Z0-9_-]/g, '');
    const leafFillStart = person.isRecordKeeper
      ? activeTreeTheme.leafKeepFillStart
      : person.gender === 'female'
      ? activeTreeTheme.leafFemaleFillStart
      : activeTreeTheme.leafFillStart;
    const leafFillEnd = person.isRecordKeeper
      ? activeTreeTheme.leafKeepFillEnd
      : person.gender === 'female'
      ? activeTreeTheme.leafFemaleFillEnd
      : activeTreeTheme.leafFillEnd;
    const leafStrokeColor = person.isRecordKeeper
      ? activeTreeTheme.leafKeepStroke
      : person.gender === 'female'
      ? activeTreeTheme.leafFemaleStroke
      : activeTreeTheme.leafStroke;

    return (
      <div
        key={person.id}
        data-testid={`tree-person-card-${person.id}`}
        className={`relative group transition-all flex flex-col items-center ${
          !isVerticalOnlyLink ? 'pb-3' : ''
        } ${isRadialOpen ? 'z-40' : 'z-10'}`}
      >
        {treeDisplaySettings.nodeShape === 'circle' ? (
          /* ================================================================ */
          /* SHAPE 2: BALANCED CIRCULAR MEDALLION NODE (`دائرة`)               */
          /* ================================================================ */
          <div
            data-node-shape="circle"
            className={`w-[138px] h-[138px] sm:w-[146px] sm:h-[146px] rounded-full px-3 pt-4 pb-3 flex flex-col items-center justify-center text-center transition-all shadow-sm relative ${cardSurfaceClass}`}
          >
            {/* Subtle top-edge Edit / Delete micro-icons */}
            <div className="absolute top-1.5 left-1/2 -translate-x-1/2 z-20 opacity-85 group-hover:opacity-100 transition-opacity">
              {renderEditDeleteIcons()}
            </div>

            <div className="flex flex-col items-center justify-center gap-1 mt-2 w-full">
              {renderAvatarWithCamera()}
              {topRoleLabel && (
                <span
                  className={`text-[8.5px] font-display font-bold truncate max-w-[104px] leading-none ${activeTreeTheme.accentText}`}
                >
                  {topRoleLabel}
                </span>
              )}
              <div
                className={`text-[11.5px] font-display font-extrabold truncate max-w-[114px] leading-tight ${activeTreeTheme.nameText}`}
              >
                {mainName}
              </div>
              {treeDisplaySettings.showKunya && kunyaOrTitle && (
                <div
                  className={`text-[9.5px] font-semibold truncate max-w-[106px] leading-none ${activeTreeTheme.accentText}`}
                >
                  {kunyaOrTitle}
                </div>
              )}
              {treeDisplaySettings.showDates && cleanMetaLine && (
                <div
                  className={`text-[8.5px] font-medium tabular-nums truncate max-w-[104px] leading-none ${activeTreeTheme.metaText}`}
                >
                  {cleanMetaLine}
                </div>
              )}
            </div>

            {/* Bottom-Left Vault Badge */}
            {renderVaultCornerBadge('bottom-2 left-1')}

            {/* Docked Circular (+) Button */}
            {renderPlusNodeButton('absolute -bottom-3 left-1/2 -translate-x-1/2 z-20')}
          </div>
        ) : treeDisplaySettings.nodeShape === 'leaf' ? (
          /* ================================================================ */
          /* SHAPE 3: REALISTIC SCULPTED BOTANICAL LEAF NODE (`ورقة شجر`)     */
          /* ================================================================ */
          <div
            data-node-shape="leaf"
            className="w-[192px] sm:w-[204px] h-[148px] px-6 pt-5 pb-4 flex flex-col items-center justify-center text-center transition-all relative"
          >
            {/* Realistic Botanical Leaf SVG with Organic Asymmetry, Split 3D Shading, Tapered Midrib & Alternating Veins */}
            <svg
              viewBox="0 0 212 158"
              fill="none"
              aria-hidden="true"
              className="absolute inset-0 w-full h-full pointer-events-none drop-shadow-sm"
            >
              <defs>
                <linearGradient
                  id={`leaf-sun-${safeLeafUid}`}
                  x1="168"
                  y1="14"
                  x2="52"
                  y2="146"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0%" stopColor={leafFillStart} />
                  <stop offset="52%" stopColor={leafFillEnd} />
                  <stop offset="100%" stopColor={leafFillEnd} />
                </linearGradient>
                <linearGradient
                  id={`leaf-shade-${safeLeafUid}`}
                  x1="106"
                  y1="20"
                  x2="24"
                  y2="132"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0%" stopColor={activeTreeTheme.leafVein} stopOpacity="0.14" />
                  <stop offset="100%" stopColor={activeTreeTheme.leafVein} stopOpacity="0.04" />
                </linearGradient>
                <linearGradient
                  id={`leaf-gloss-${safeLeafUid}`}
                  x1="162"
                  y1="24"
                  x2="112"
                  y2="88"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.58" />
                  <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Soft Natural Shadow Offset Under Leaf Blade */}
              <path
                d="M111 19 C155 23 196 48 197 82 C198 111 163 137 107 151 C56 141 18 116 17 84 C16 50 59 23 111 19 Z"
                fill={activeTreeTheme.leafVein}
                fillOpacity="0.1"
              />

              {/* Curved Woody Petiole Stem (Top Right-of-Center) */}
              <path
                d="M119 4 C114 9 110 13 108 19"
                stroke={leafStrokeColor}
                strokeWidth="3"
                strokeLinecap="round"
              />
              <path
                d="M118.5 4.5 C114.5 9 111 13 109 18"
                stroke="#FFFFFF"
                strokeOpacity="0.45"
                strokeWidth="1"
                strokeLinecap="round"
              />

              {/* Organic Sculpted Botanical Leaf Blade with Tapered Pointed Tip */}
              <path
                d="M108 17 C148 19 194 42 197 77 C199 109 162 135 104 149 C50 139 14 114 14 81 C14 45 58 19 108 17 Z"
                fill={`url(#leaf-sun-${safeLeafUid})`}
                stroke={leafStrokeColor}
                strokeWidth={person.isRecordKeeper ? '2.4' : '1.7'}
                strokeLinejoin="round"
                strokeDasharray={isVerticalOnlyLink ? '5 3' : undefined}
              />

              {/* 3D Natural Fold Shading: Subtle Shaded Left Half Along Curved Midrib */}
              <path
                d="M108 17 C58 19 14 45 14 81 C14 114 50 139 104 149 C108 106 111 60 108 17 Z"
                fill={`url(#leaf-shade-${safeLeafUid})`}
              />

              {/* Sunlit Specular Sheen Along Upper-Right Leaf Surface */}
              <path
                d="M113 22 C148 25 184 44 188 73 C172 62 146 53 114 51 C113 40 113 30 113 22 Z"
                fill={`url(#leaf-gloss-${safeLeafUid})`}
              />

              {/* Delicate Inner Rim Highlight */}
              <path
                d="M108 20.5 C146 22.5 189 44 192 77 C194 106 159 131 104 144.5 C53 135 19 112 19 81 C19 48 60 22.5 108 20.5 Z"
                stroke="#FFFFFF"
                strokeOpacity="0.48"
                strokeWidth="1"
              />

              {/* Organic Gently Curved Tapered Midrib Vein */}
              <path
                d="M108 18 C111 58 109 102 104 145"
                stroke={activeTreeTheme.leafVein}
                strokeOpacity="0.34"
                strokeWidth="1.9"
                strokeLinecap="round"
              />
              <path
                d="M109.2 19 C112.2 58 110.2 102 105.2 143"
                stroke="#FFFFFF"
                strokeOpacity="0.42"
                strokeWidth="0.8"
                strokeLinecap="round"
              />

              {/* Alternating Arched Lateral Veins (Right Side) */}
              <path
                d="M109 39 C130 35 151 39 170 49 M110 64 C135 58 162 63 185 75 M109 92 C134 86 158 91 177 103 M107 116 C126 112 143 116 155 124"
                stroke={activeTreeTheme.leafVein}
                strokeOpacity="0.24"
                strokeWidth="1.15"
                strokeLinecap="round"
              />
              {/* Fine Secondary Veinlets (Right Side) */}
              <path
                d="M148 41 C155 37 161 36 166 37 M157 65 C166 61 174 60 181 62 M150 93 C158 89 166 89 172 91"
                stroke={activeTreeTheme.leafVein}
                strokeOpacity="0.14"
                strokeWidth="0.75"
                strokeLinecap="round"
              />

              {/* Alternating Arched Lateral Veins (Left Side — Offset Naturally) */}
              <path
                d="M109 47 C86 42 62 46 39 58 M109 74 C82 68 53 73 27 86 M108 102 C83 97 58 102 38 114 M106 124 C88 121 72 125 60 132"
                stroke={activeTreeTheme.leafVein}
                strokeOpacity="0.24"
                strokeWidth="1.15"
                strokeLinecap="round"
              />
              {/* Fine Secondary Veinlets (Left Side) */}
              <path
                d="M66 49 C58 45 51 44 45 45 M56 75 C47 71 39 70 32 72 M63 104 C54 100 47 100 41 102"
                stroke={activeTreeTheme.leafVein}
                strokeOpacity="0.14"
                strokeWidth="0.75"
                strokeLinecap="round"
              />
            </svg>

            {/* Subtle Edit / Delete Micro-Actions on Upper Leaf Shoulder */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 opacity-85 group-hover:opacity-100 transition-opacity">
              {renderEditDeleteIcons()}
            </div>

            {/* Centered Botanical Leaf Content */}
            <div className="relative z-10 flex flex-col items-center justify-center gap-0.5 mt-3 w-full">
              {renderAvatarWithCamera()}
              {topRoleLabel && (
                <span
                  className={`text-[8.5px] font-display font-bold truncate max-w-[126px] leading-none mt-0.5 ${activeTreeTheme.accentText}`}
                >
                  {topRoleLabel}
                </span>
              )}
              <div
                className={`text-xs font-display font-extrabold truncate max-w-[138px] leading-tight ${activeTreeTheme.nameText}`}
              >
                {mainName}
              </div>
              {treeDisplaySettings.showKunya && kunyaOrTitle && (
                <div
                  className={`text-[9.5px] font-semibold truncate max-w-[126px] leading-none ${activeTreeTheme.accentText}`}
                >
                  {kunyaOrTitle}
                </div>
              )}
              {treeDisplaySettings.showDates && cleanMetaLine && (
                <div
                  className={`text-[8.5px] font-medium tabular-nums truncate max-w-[126px] leading-none ${activeTreeTheme.metaText}`}
                >
                  {cleanMetaLine}
                </div>
              )}
            </div>

            {/* Bottom-Left Vault Badge */}
            {renderVaultCornerBadge('bottom-3 left-4')}

            {/* Docked Circular (+) Button at Leaf Bottom Tip */}
            {renderPlusNodeButton('absolute -bottom-2.5 left-1/2 -translate-x-1/2 z-20')}
          </div>
        ) : (
          /* ================================================================ */
          /* SHAPE 1: DENSITY-ADAPTIVE CARD NODE (`بطاقة`)                    */
          /* ================================================================ */
          <div
            data-node-shape="card"
            onClick={() =>
              setSelectedPersonIdForSpouses((cur) =>
                cur === person.id ? null : person.id
              )
            }
            className={`${cardDensityClasses} text-right transition-all shadow-sm relative cursor-pointer ${cardSurfaceClass}`}
          >
            {/* Compact Top Row: Record Keeper Badge Only (Uniform Height Across All Cards) + Edit / Delete */}
            <div className="flex items-center justify-between gap-1 mb-1.5 min-h-[20px]">
              <div className="min-w-0 flex items-center gap-1">
                {topRoleLabel ? (
                  <span
                    className={`text-[9.5px] font-display font-bold truncate block ${activeTreeTheme.accentText}`}
                  >
                    {topRoleLabel}
                  </span>
                ) : isDeceased && treeDisplaySettings.showDeceasedDignityFrame ? (
                  <span
                    className={`text-[8.5px] font-display font-bold truncate block ${activeTreeTheme.metaText}`}
                  >
                    {person.gender === 'female' ? 'رحمها الله' : 'رحمه الله'}
                  </span>
                ) : null}
              </div>
              {renderEditDeleteIcons()}
            </div>

            {/* Center Row: Cultural / Calligraphy Avatar + Registered Info */}
            <div className="flex items-center gap-2">
              {renderAvatarWithCamera()}

              <div className="min-w-0 flex-1 space-y-0.5">
                {/* 1. Registered Name ONLY (With Optional Honorific when showHonorific is ON) */}
                <div
                  className={`${
                    treeDisplaySettings.cardDensity === 'compact'
                      ? 'text-[11px]'
                      : treeDisplaySettings.cardDensity === 'detailed'
                      ? 'text-[13px]'
                      : 'text-xs'
                  } font-display font-extrabold truncate ${activeTreeTheme.nameText}`}
                >
                  {mainName}
                </div>

                {/* 2. Kunya ONLY if explicitly entered and showKunya is enabled */}
                {treeDisplaySettings.showKunya && kunyaOrTitle && (
                  <div
                    className={`text-[10px] font-semibold truncate ${activeTreeTheme.accentText}`}
                  >
                    {kunyaOrTitle}
                  </div>
                )}

                {/* 2b. Dignified Wife Maiden Family / Daughter Marriage Alliance Note */}
                {allianceSubLine && (
                  <div
                    className={`text-[9.5px] font-medium truncate ${activeTreeTheme.accentText} opacity-90`}
                    title={allianceSubLine}
                  >
                    {allianceSubLine}
                  </div>
                )}

                {/* 3. Birth Year / Mercy ONLY if explicitly entered and showDates is enabled */}
                {treeDisplaySettings.showDates && cleanMetaLine && (
                  <div
                    className={`text-[9.5px] font-medium tabular-nums truncate ${activeTreeTheme.metaText}`}
                  >
                    {cleanMetaLine}
                  </div>
                )}

                {/* 4. Extra Bio / Place snippet when Density is 'detailed' */}
                {treeDisplaySettings.cardDensity === 'detailed' &&
                  (person.birthPlace || person.biography) && (
                    <div
                      className={`text-[9px] truncate pt-0.5 ${activeTreeTheme.metaText}`}
                    >
                      {person.birthPlace || person.biography}
                    </div>
                  )}

                {/* 5. Optional Dignified Prestige Badge (Gender-Aware) */}
                {prestigeBadgeMeta && (
                  <div className="pt-1">
                    <span
                      data-testid={`tree-card-prestige-${person.id}`}
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8.5px] font-display font-extrabold border ${
                        activeTreeTheme.isDarkSurface
                          ? 'bg-[#D4AF37]/15 border-[#D4AF37]/45 text-[#F3D299]'
                          : 'bg-[#FEF9EC] border-[#C5A059]/50 text-[#8D4925]'
                      }`}
                    >
                      <Award className="w-2.5 h-2.5 shrink-0 text-[#C5A059]" />
                      <span className="truncate">{prestigeBadgeMeta.label}</span>
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 6. Linked Vault Media Badge Pinned to Bottom-Left so ALL Sibling Names Stay Aligned */}
            {renderVaultCornerBadge('bottom-1.5 left-1.5')}

            {/* Compact Circular (+) Button ONLY within the Branching Zone (<= 5th Grandfather) */}
            {renderPlusNodeButton('mt-2 flex justify-center -mb-5 relative z-20')}
          </div>
        )}

        {/* ================================================================== */}
        {/* RADIAL NODE QUICK-SELECTOR OVERLAY (من الجد الخامس نزولاً فقط)        */}
        {/* ================================================================== */}
        {isRadialOpen &&
          !isVerticalOnlyLink &&
          (() => {
            const quickPolicy = resolveNodeQuickActionPolicy(people, person);

            // Focused Spouse Menu: Married-in wives (no blood-line father in tree)
            // strictly expose (+ إضافة ابن) and (+ إضافة ابنة) bound to Husband + Wife.
            if (quickPolicy.isMarriedInWife) {
              const childAnchorNode = quickPolicy.linkedHusband || person;
              return (
                <div
                  data-testid="wife-focused-quick-menu"
                  className="mt-5 rounded-3xl bg-[#252321] text-white p-4 shadow-2xl border-2 border-[#D4AF37] space-y-3 relative z-50 w-[280px] sm:w-[300px] mx-auto"
                >
                  <div className="flex items-center justify-between border-b border-white/15 pb-2">
                    <div className="min-w-0">
                      <span className="text-xs font-display font-bold text-[#F3D299] block truncate">
                        أبناء السيدة «{person.firstName}»
                      </span>
                      {quickPolicy.linkedHusband && (
                        <span className="text-[10px] text-white/65 block truncate">
                          مقترنة بـ {quickPolicy.linkedHusband.firstName} 💍
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setRadialTargetNodeId(null)}
                      className="px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-bold text-white cursor-pointer shrink-0"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        openAddRelativeModal(childAnchorNode, 'son', person.id)
                      }
                      className="py-2.5 px-2.5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-display font-bold text-center cursor-pointer transition-colors shadow-2xs"
                    >
                      + إضافة ابن
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        openAddRelativeModal(
                          childAnchorNode,
                          'daughter',
                          person.id
                        )
                      }
                      className="py-2.5 px-2.5 rounded-xl bg-[#B98A78] hover:bg-[#a37462] text-white text-xs font-display font-bold text-center cursor-pointer transition-colors shadow-2xs"
                    >
                      + إضافة ابنة
                    </button>
                  </div>

                  <div className="pt-1.5 border-t border-white/10 flex items-center justify-between gap-2 text-[10px] text-white/65">
                    <span className="leading-snug">
                      لتوثيق والدها أو أسرتها الكريمة، عدّل حقل نسب المصاهرة
                    </span>
                    <button
                      type="button"
                      onClick={() => openEditPersonModal(person)}
                      className="px-2 py-1 rounded-lg bg-white/10 hover:bg-[#D4AF37] hover:text-[#252321] text-[#F3D299] font-display font-bold shrink-0 cursor-pointer transition-colors"
                    >
                      تعديل ✎
                    </button>
                  </div>
                </div>
              );
            }

            const childAnchorNode =
              person.gender === 'female' && quickPolicy.linkedHusband
                ? quickPolicy.linkedHusband
                : person;
            const childPreselectedMotherId =
              person.gender === 'female' && quickPolicy.linkedHusband
                ? person.id
                : undefined;

            return (
              <div className="mt-5 rounded-3xl bg-[#252321] text-white p-4 shadow-2xl border-2 border-[#D8755B] space-y-3 relative z-50 w-[280px] sm:w-[300px] mx-auto">
                <div className="flex items-center justify-between border-b border-white/15 pb-2">
                  <span className="text-xs font-display font-bold text-[#F3D299]">
                    إضافة قريب لـ «{person.firstName}»
                  </span>
                  <button
                    type="button"
                    onClick={() => setRadialTargetNodeId(null)}
                    className="px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-bold text-white cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {/* 1. TOP: Parents (<= 4th Grandfather) OR Vertical Link Only (on 5th Grandfather) */}
                <div className="space-y-1.5">
                  {canAddFullParentsAndSiblings ? (
                    <div className="grid grid-cols-2 gap-2">
                      {!hasFather ? (
                        <button
                          type="button"
                          onClick={() => openAddRelativeModal(person, 'father')}
                          className="py-2 px-2.5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-display font-bold text-center cursor-pointer shadow-2xs"
                        >
                          + إضافة الأب
                        </button>
                      ) : (
                        <span className="py-2 px-2 rounded-xl bg-white/5 text-white/40 text-[11px] text-center">
                          الأب مضاف ✓
                        </span>
                      )}

                      {!hasMother ? (
                        <button
                          type="button"
                          onClick={() => openAddRelativeModal(person, 'mother')}
                          className="py-2 px-2.5 rounded-xl bg-[#B98A78] hover:bg-[#a37462] text-white text-xs font-display font-bold text-center cursor-pointer shadow-2xs"
                        >
                          + إضافة الأم
                        </button>
                      ) : (
                        <span className="py-2 px-2 rounded-xl bg-white/5 text-white/40 text-[11px] text-center">
                          الأم مضافة ✓
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {!hasFather ? (
                        <button
                          type="button"
                          onClick={() =>
                            openAddRelativeModal(person, 'vertical_ancestor')
                          }
                          className="w-full py-2 px-3 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-display font-bold text-center cursor-pointer"
                        >
                          + حلقة عمودية نحو الجذر (
                          {getNextVerticalGrandfatherLabel(
                            person.generationLevel + 1
                          )}
                          )
                        </button>
                      ) : (
                        <div className="py-1.5 px-2 rounded-xl bg-white/5 text-white/50 text-[11px] text-center">
                          الحلقة العمودية الأعلى مضافة ✓
                        </div>
                      )}
                      <div className="text-[10px] text-[#F3D299]/80 text-center">
                        ما فوق الجد الخامس: عُقد ربط عمودية فقط دون تفرع أفقي
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. MIDDLE: Siblings (<= 4th Grandfather) & Spouse/Partner (strictly hidden for married females) */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/10">
                  {canAddFullParentsAndSiblings ? (
                    <div className="space-y-1.5">
                      <button
                        type="button"
                        onClick={() => openAddRelativeModal(person, 'brother')}
                        className="w-full py-1.5 px-2 rounded-xl bg-white/12 hover:bg-[#D8755B] text-white text-xs font-display font-bold cursor-pointer transition-colors"
                      >
                        + إضافة أخ
                      </button>
                      <button
                        type="button"
                        onClick={() => openAddRelativeModal(person, 'sister')}
                        className="w-full py-1.5 px-2 rounded-xl bg-white/12 hover:bg-[#B98A78] text-white text-xs font-display font-bold cursor-pointer transition-colors"
                      >
                        + إضافة أخت
                      </button>
                    </div>
                  ) : (
                    <div className="w-full h-full min-h-[54px] rounded-xl bg-white/5 border border-white/10 text-white/60 text-[10px] font-semibold flex items-center justify-center px-2 text-center">
                      بداية التفرع العائلي من الجد الخامس نزولاً
                    </div>
                  )}

                  <div>
                    {quickPolicy.canAddSpouse ? (
                      <button
                        type="button"
                        onClick={() => openAddRelativeModal(person, 'spouse')}
                        className="w-full h-full min-h-[54px] rounded-xl bg-[#8D4925] hover:bg-[#D8755B] text-white text-xs font-display font-bold cursor-pointer transition-colors flex items-center justify-center px-2"
                      >
                        <span>
                          {person.gender === 'male'
                            ? '+ إضافة زوجة'
                            : '+ إضافة زوج'}
                        </span>
                      </button>
                    ) : (
                      <div className="w-full h-full min-h-[54px] rounded-xl bg-white/5 border border-[#D4AF37]/30 text-[#F3D299]/85 text-[11px] font-display font-bold flex flex-col items-center justify-center px-2 text-center leading-snug">
                        <span>مقترنة بـ {quickPolicy.linkedHusband?.firstName}</span>
                        <span className="text-[10px] text-white/50 font-normal">
                          الزوج مسجل ✓
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. BOTTOM: Son & Daughter (Allowed from 5th Grandfather downward) */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() =>
                      openAddRelativeModal(
                        childAnchorNode,
                        'son',
                        childPreselectedMotherId
                      )
                    }
                    className="py-2 px-2.5 rounded-xl bg-white/15 hover:bg-[#D8755B] text-white text-xs font-display font-bold text-center cursor-pointer transition-colors"
                  >
                    {isFifthGrandfatherBoundary
                      ? '+ إضافة ابن / فرع'
                      : '+ إضافة ابن'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      openAddRelativeModal(
                        childAnchorNode,
                        'daughter',
                        childPreselectedMotherId
                      )
                    }
                    className="py-2 px-2.5 rounded-xl bg-white/15 hover:bg-[#B98A78] text-white text-xs font-display font-bold text-center cursor-pointer transition-colors"
                  >
                    + إضافة ابنة
                  </button>
                </div>
              </div>
            );
          })()}

      </div>
    );
  };

  // ============================================================================
  // RECURSIVE TOP-DOWN PEDIGREE TREE ENGINE (DOWNWARD ARROWS & SIBLING BRACKETS)
  // ============================================================================
  const visiblePeopleForTree = useMemo(
    () =>
      isInvitedGuestHideFemales
        ? people.filter((p) => p.gender !== 'female')
        : people,
    [people, isInvitedGuestHideFemales]
  );

  const pedigreeLayout = useMemo(
    () =>
      buildPedigreeTreeLayout(visiblePeopleForTree, {
        siblingSortOrder: treeDisplaySettings.siblingSortOrder,
        focusRootId: focusSubtreeRootId,
      }),
    [
      visiblePeopleForTree,
      treeDisplaySettings.siblingSortOrder,
      focusSubtreeRootId,
    ]
  );

  const kinshipPathResult = useMemo(() => {
    if (!kinshipPersonAId || !kinshipPersonBId) return null;
    return calculateKinshipPath(
      visiblePeopleForTree,
      kinshipPersonAId,
      kinshipPersonBId
    );
  }, [visiblePeopleForTree, kinshipPersonAId, kinshipPersonBId]);

  const focusedSubtreePerson = useMemo(
    () =>
      focusSubtreeRootId
        ? visiblePeopleForTree.find((p) => p.id === focusSubtreeRootId) || null
        : null,
    [visiblePeopleForTree, focusSubtreeRootId]
  );

  const renderDownwardArrowTip = (isDirectSpine = false) => (
    <svg
      width="10"
      height="7"
      viewBox="0 0 12 8"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 -mt-px ${
        isDirectSpine
          ? activeTreeTheme.connectorArrowStrong
          : activeTreeTheme.connectorArrowSoft
      }`}
    >
      <path d="M6 8L0.5 0.5H11.5L6 8Z" fill="currentColor" />
    </svg>
  );

  const renderLeftwardArrowTip = (isDirectSpine = false) => (
    <svg
      width="7"
      height="10"
      viewBox="0 0 8 12"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 -mr-px ${
        isDirectSpine
          ? activeTreeTheme.connectorArrowStrong
          : activeTreeTheme.connectorArrowSoft
      }`}
    >
      <path d="M0 6L7.5 0.5V11.5L0 6Z" fill="currentColor" />
    </svg>
  );

  const renderTopAncestorAdditionBar = (
    topAncestor: InteractiveTreePerson,
    unpairedTopMother: InteractiveTreePerson | null,
    hasTopSiblings = false
  ) => {
    const isAtOrAboveFifth =
      topAncestor.generationLevel >= FIFTH_GRANDFATHER_LEVEL;
    const hasFather = Boolean(
      topAncestor.fatherId && findPerson(topAncestor.fatherId)
    );

    if (hasFather && !unpairedTopMother) {
      return null;
    }

    const nextFatherLabel = getNextVerticalGrandfatherLabel(
      topAncestor.generationLevel + 1
    );

    return (
      <div
        data-testid="tree-top-parent-addition-bar"
        className="flex flex-col items-center"
      >
        {isAtOrAboveFifth ? (
          !hasFather ? (
            <button
              type="button"
              onClick={() =>
                openAddRelativeModal(topAncestor, 'vertical_ancestor')
              }
              className="px-5 py-2.5 rounded-2xl bg-[#FFFDF9] hover:bg-white border-2 border-dashed border-[#D8755B] text-xs sm:text-sm font-display font-extrabold text-[#252321] hover:text-[#D8755B] shadow-2xs transition-all cursor-pointer"
            >
              + إضافة ({nextFatherLabel})
            </button>
          ) : null
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-3">
            {!hasFather && (
              <button
                type="button"
                onClick={() => openAddRelativeModal(topAncestor, 'father')}
                className="w-[185px] sm:w-[205px] rounded-2xl border-2 border-dashed border-[#8D4925]/70 hover:border-[#D8755B] bg-[#FFFDF9] hover:bg-white py-2.5 px-4 text-center transition-all cursor-pointer group shadow-2xs"
              >
                <div className="text-xs font-display font-extrabold text-[#252321] group-hover:text-[#D8755B]">
                  + إضافة ({nextFatherLabel})
                </div>
              </button>
            )}

            {unpairedTopMother ? renderPersonCard(unpairedTopMother) : null}
          </div>
        )}

        {/* Downward stem: feeds into sibling horizontal bracket when multiple top-level siblings exist, or arrow into single top ancestor */}
        {hasTopSiblings ? (
          <div className={`w-[2px] h-5 ${activeTreeTheme.connectorSoft}`} />
        ) : (
          <div className="flex flex-col items-center">
            <div className={`w-[2px] h-6 ${activeTreeTheme.connectorStrong}`} />
            {renderDownwardArrowTip(true)}
          </div>
        )}
      </div>
    );
  };

  const renderPedigreeSubtree = (
    treeNode: PedigreeTreeNode<InteractiveTreePerson>
  ): React.ReactNode => {
    const { person, spouses, children } = treeNode;
    const isVerticalOnlyZone =
      person.generationLevel > FIFTH_GRANDFATHER_LEVEL;
    const descendantCount =
      children.length > 0 ? countTreeNodeDescendants(treeNode) : 0;
    const isBranchCollapsed =
      children.length > 0 && collapsedBranchIds.has(person.id);

    const shouldShowSpouses =
      !isVerticalOnlyZone &&
      spouses.length > 0 &&
      (treeDisplaySettings.spouseDisplayMode === 'always' ||
        (treeDisplaySettings.spouseDisplayMode === 'on_select' &&
          (selectedPersonIdForSpouses === person.id ||
            radialTargetNodeId === person.id)));

    const spouseHub = partitionSpousesAroundHusband(
      shouldShowSpouses ? spouses : []
    );
    const childRouting = partitionChildrenByMotherUnion(
      person,
      children,
      spouses,
      shouldShowSpouses
    );

    const connectorLineThickness =
      treeDisplaySettings.connectorStyle === 'heritage_branch'
        ? 'w-[3px]'
        : 'w-[2px]';
    const connectorRadiusClass =
      treeDisplaySettings.connectorStyle === 'curved' ? 'rounded-full' : '';

    const isKinshipEdge = (childId: string) =>
      isKinshipHighlightedOnCanvas &&
      Boolean(
        kinshipPathResult?.pathNodeIds.has(person.id) &&
          kinshipPathResult?.pathNodeIds.has(childId)
      );

    // Interactive Golden Marital Ring Medallion (`💍`) with quick-add child strictly from THIS couple union
    const renderMaritalRingMedallion = (spouse: InteractiveTreePerson) => {
      const unionKey = `${person.id}::${spouse.id}`;
      const isQuickOpen = activeUnionQuickAddKey === unionKey;
      const canAddFromUnion = !isVerticalOnlyZone && person.gender === 'male';
      return (
        <div className="relative flex items-center justify-center z-30">
          <button
            type="button"
            data-testid={`marital-union-ring-${person.id}-${spouse.id}`}
            onClick={(e) => {
              e.stopPropagation();
              if (!canAddFromUnion) return;
              setActiveUnionQuickAddKey((cur) =>
                cur === unionKey ? null : unionKey
              );
            }}
            title={
              canAddFromUnion
                ? `اقتران ${person.firstName} و${spouse.firstName} — انقر لإضافة مولود من هذا الاقتران`
                : `رابطة اقتران ${person.firstName} و${spouse.firstName}`
            }
            className={`w-6 h-6 rounded-full bg-[#FFFDF9] border border-[#C5A059] text-[11px] leading-none flex items-center justify-center shadow-xs transition-transform ${
              canAddFromUnion
                ? 'cursor-pointer hover:scale-110 hover:bg-[#FEF6E4]'
                : 'cursor-default'
            } ${isQuickOpen ? 'ring-2 ring-[#C5A059]/60 scale-110' : ''}`}
          >
            <span aria-hidden="true">💍</span>
          </button>

          {isQuickOpen && canAddFromUnion && (
            <div
              dir="rtl"
              onClick={(e) => e.stopPropagation()}
              className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 z-50 rounded-2xl bg-[#1C1917] text-[#F7E7CE] border border-[#C5A059]/75 p-2 shadow-xl w-44 space-y-1.5"
            >
              <div className="flex items-center justify-between gap-1 text-[10px] font-display font-bold text-[#F3D299] border-b border-white/10 pb-1">
                <span className="truncate">
                  ذرية {person.firstName} و{spouse.firstName}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveUnionQuickAddKey(null)}
                  className="text-white/60 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => openAddRelativeModal(person, 'son', spouse.id)}
                  className="py-1.5 px-2 rounded-lg bg-[#8D4925] hover:bg-[#D8755B] text-white text-[10.5px] font-display font-extrabold cursor-pointer transition-colors"
                >
                  + ابن
                </button>
                <button
                  type="button"
                  onClick={() =>
                    openAddRelativeModal(person, 'daughter', spouse.id)
                  }
                  className="py-1.5 px-2 rounded-lg bg-white/15 hover:bg-[#C5A059] hover:text-[#1C1917] text-white text-[10.5px] font-display font-extrabold cursor-pointer transition-colors"
                >
                  + ابنة
                </button>
              </div>
            </div>
          )}
        </div>
      );
    };

    const spouseIdsWithAssignedChildren = new Set<string>([
      ...childRouting.rightMaternalGroups.map((g) => g.spouse.id),
      ...childRouting.leftMaternalGroups.map((g) => g.spouse.id),
    ]);

    // Double horizontal golden marital bridge (used for single wife or each side of 2-wife centered hub)
    const renderHorizontalMaritalBridge = (
      spouse: InteractiveTreePerson,
      side: 'right' | 'left'
    ) => {
      const hasUnionChildren =
        !isBranchCollapsed && spouseIdsWithAssignedChildren.has(spouse.id);
      return (
        <div
          data-testid={`marital-bridge-${side}-${spouse.id}`}
          className="flex flex-col items-center w-9 sm:w-11 self-stretch shrink-0 relative"
          aria-label={`جسر اقتران ${person.firstName} و${spouse.firstName}`}
        >
          <div className="w-full mt-9 flex items-center justify-center relative">
            <div className="w-full flex flex-col gap-[3px]">
              <div className="w-full h-[1.5px] bg-[#C5A059]/85" />
              <div className="w-full h-[1.5px] bg-[#C5A059]/85" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              {renderMaritalRingMedallion(spouse)}
            </div>
          </div>
          {hasUnionChildren && (
            <div
              data-testid={`marital-bridge-offspring-stem-${spouse.id}`}
              className="w-[2px] flex-1 min-h-[24px] bg-gradient-to-b from-[#C5A059] to-[#C5A059]/60 mt-2"
            />
          )}
        </div>
      );
    };

    // Elevated Golden Marital Overhead Bus for flanks with 2+ wives (3 or 4+ total wives):
    // Exits directly from Husband's side marital port ABOVE the wife cards and drops an
    // independent vertical golden stem + 💍 medallion onto each wife — ZERO wife-to-wife pass-through!
    const renderMultiWifeSideFlank = (
      flankSpouses: InteractiveTreePerson[],
      side: 'right' | 'left'
    ) => {
      if (flankSpouses.length === 0) return null;

      // Single wife on this side -> sleek direct horizontal double golden bridge
      if (flankSpouses.length === 1) {
        const sp = flankSpouses[0];
        return (
          <div
            data-testid={`spouse-flank-${side}-${person.id}`}
            className={`flex flex-row flex-nowrap items-start ${
              side === 'right' ? 'justify-end' : 'justify-start'
            }`}
          >
            {side === 'right' ? (
              <>
                {renderPersonCard(sp)}
                {renderHorizontalMaritalBridge(sp, 'right')}
              </>
            ) : (
              <>
                {renderHorizontalMaritalBridge(sp, 'left')}
                {renderPersonCard(sp)}
              </>
            )}
          </div>
        );
      }

      // 2+ wives on this side -> Elevated Golden Overhead Bus branching from Husband's lateral port
      // In RTL: right flank renders outermost-right -> innermost-right (next to husband),
      // left flank renders innermost-left (next to husband) -> outermost-left.
      const ordered =
        side === 'right' ? [...flankSpouses].reverse() : flankSpouses;

      return (
        <div
          data-testid={`spouse-multi-bus-${side}-${person.id}`}
          className={`flex flex-row flex-nowrap items-start ${
            side === 'right' ? 'justify-end' : 'justify-start'
          }`}
        >
          {side === 'left' && (
            /* Lateral Golden Port connecting Husband's left edge up to the left overhead rail */
            <div className="w-5 sm:w-6 h-11 shrink-0 relative">
              <div className="absolute top-[2px] inset-x-0 h-[2px] bg-[#C5A059]" />
              <div className="absolute top-[2px] right-0 w-[2px] h-9 bg-[#C5A059]" />
            </div>
          )}

          <div className="flex flex-row flex-nowrap items-start">
            {ordered.map((sp, idx) => {
              const isOutermost =
                side === 'right' ? idx === 0 : idx === ordered.length - 1;
              return (
                <div
                  key={sp.id}
                  data-testid={`spouse-bus-slot-${sp.id}`}
                  className="flex flex-col items-center relative px-1.5"
                >
                  {/* Overhead golden marital rail + independent vertical drop stem + 💍 medallion */}
                  <div className="relative w-full h-9 flex flex-col items-center justify-center">
                    <div
                      className={`absolute top-[2px] h-[2px] bg-[#C5A059] ${
                        isOutermost
                          ? side === 'right'
                            ? 'start-[calc(50%-1px)] end-0'
                            : 'start-0 end-[calc(50%-1px)]'
                          : 'start-0 end-0'
                      }`}
                    />
                    <div className="w-[2px] flex-1 bg-[#C5A059]/90 mt-[2px]" />
                    <div className="absolute top-2 left-1/2 -translate-x-1/2">
                      {renderMaritalRingMedallion(sp)}
                    </div>
                  </div>
                  {renderPersonCard(sp)}
                </div>
              );
            })}
          </div>

          {side === 'right' && (
            /* Lateral Golden Port connecting right overhead rail straight into Husband's right edge */
            <div className="w-5 sm:w-6 h-11 shrink-0 relative">
              <div className="absolute top-[2px] inset-x-0 h-[2px] bg-[#C5A059]" />
              <div className="absolute top-[2px] left-0 w-[2px] h-9 bg-[#C5A059]" />
            </div>
          )}
        </div>
      );
    };

    // Renders a clean child / sibling bracket for a specific branch cluster (paternal-only OR specific maternal union)
    const renderChildrenCluster = (
      clusterChildren: PedigreeTreeNode<InteractiveTreePerson>[],
      clusterKey: string,
      isGoldUnionStem = false
    ) => {
      if (clusterChildren.length === 0) return null;

      if (clusterChildren.length === 1) {
        const onlyChild = clusterChildren[0];
        const edgeHighlighted =
          isKinshipEdge(onlyChild.person.id) ||
          (treeDisplaySettings.highlightDirectCompass &&
            directCompassIds.has(onlyChild.person.id));
        const stemColorClass = edgeHighlighted
          ? 'bg-[#D4AF37] shadow-[0_0_8px_rgba(212,175,55,0.75)]'
          : isGoldUnionStem
          ? 'bg-[#C5A059]'
          : onlyChild.isDirectSpineEdge
          ? activeTreeTheme.connectorStrong
          : activeTreeTheme.connectorSoft;

        return (
          <div
            data-testid={`pedigree-single-child-branch-${clusterKey}`}
            className="flex flex-col items-center"
          >
            <div className="flex flex-col items-center">
              <div
                className={`${connectorLineThickness} ${connectorRadiusClass} ${
                  treeDisplaySettings.showKinshipArrows ? 'h-3' : 'h-6'
                } ${stemColorClass}`}
              />
              {treeDisplaySettings.showKinshipArrows && (
                <>
                  <span
                    className={`px-1.5 py-0.5 text-[9.5px] font-display font-extrabold inline-flex items-center gap-0.5 leading-none ${activeTreeTheme.kinshipBadge}`}
                  >
                    <ArrowDown className="w-2.5 h-2.5" />
                    <span>
                      {onlyChild.person.gender === 'female' ? 'بنت' : 'بن'}
                    </span>
                  </span>
                  <div className={`w-[2px] h-2.5 ${stemColorClass}`} />
                </>
              )}
              {renderDownwardArrowTip(
                onlyChild.isDirectSpineEdge || edgeHighlighted
              )}
            </div>
            {renderPedigreeSubtree(onlyChild)}
          </div>
        );
      }

      return (
        <div
          data-testid={`pedigree-siblings-branch-${clusterKey}`}
          className="flex flex-col items-center"
        >
          {/* Vertical stem descending from anchor into the continuous siblings top bar */}
          <div
            className={`w-[2px] h-4 ${
              clusterChildren.some((c) => isKinshipEdge(c.person.id))
                ? 'bg-[#D4AF37] shadow-[0_0_8px_rgba(212,175,55,0.75)]'
                : isGoldUnionStem
                ? 'bg-[#C5A059]'
                : activeTreeTheme.connectorSoft
            }`}
          />

          <div
            dir="rtl"
            data-testid={`pedigree-siblings-row-${clusterKey}`}
            className="flex flex-row flex-nowrap items-start justify-center"
          >
            {clusterChildren.map((childNode, idx) => {
              const isFirst = idx === 0;
              const isLast = idx === clusterChildren.length - 1;
              const childKinshipWord =
                childNode.person.gender === 'female' ? 'بنت' : 'بن';
              const childOnKinship = isKinshipEdge(childNode.person.id);

              return (
                <div
                  key={childNode.person.id}
                  data-testid={`pedigree-sibling-col-${childNode.person.id}`}
                  className="flex flex-col items-center relative"
                >
                  <div className="relative w-full h-8 flex flex-col items-center justify-end">
                    <div
                      className={`absolute top-0 h-[2px] ${
                        childOnKinship
                          ? 'bg-[#D4AF37]'
                          : isGoldUnionStem
                          ? 'bg-[#C5A059]/90'
                          : activeTreeTheme.connectorSoft
                      } ${
                        isFirst
                          ? 'start-[calc(50%-1px)] end-0'
                          : isLast
                          ? 'start-0 end-[calc(50%-1px)]'
                          : 'start-0 end-0'
                      }`}
                    />
                    <div
                      className={`w-[2px] flex-1 ${
                        childOnKinship
                          ? 'bg-[#D4AF37] shadow-[0_0_8px_rgba(212,175,55,0.75)]'
                          : isGoldUnionStem
                          ? 'bg-[#C5A059]'
                          : childNode.isDirectSpineEdge
                          ? activeTreeTheme.connectorStrong
                          : activeTreeTheme.connectorSoft
                      }`}
                    />
                    {treeDisplaySettings.showKinshipArrows && (
                      <span
                        className={`absolute top-1.5 start-[calc(50%+5px)] text-[9.5px] font-display font-extrabold px-1 leading-none ${activeTreeTheme.kinshipBadge}`}
                      >
                        {childKinshipWord}
                      </span>
                    )}
                    {renderDownwardArrowTip(
                      childNode.isDirectSpineEdge || childOnKinship
                    )}
                  </div>

                  <div className="px-1.5 sm:px-2">
                    {renderPedigreeSubtree(childNode)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    const hasElevatedMultiBus =
      spouseHub.rightSpouses.length >= 2 || spouseHub.leftSpouses.length >= 2;

    return (
      <div
        key={person.id}
        data-testid={`pedigree-subtree-${person.id}`}
        className="flex flex-col items-center"
      >
        {person.generationLevel === FIFTH_GRANDFATHER_LEVEL &&
          person.isDirectSpineLineage && (
            <div className="mb-2.5 text-[11px] font-display font-bold text-[#8D4925] text-center">
              ✦ بداية نطاق التشجير العائلي الكامل من الجد الخامس نزولاً
            </div>
          )}

        {/* ================================================================= */}
        {/* HUSBAND-ANCHORED MARITAL HUB (`grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]`) */}
        {/* Guarantees incoming paternal stem ALWAYS lands on exact center of Husband!  */}
        {/* ================================================================= */}
        {shouldShowSpouses ? (
          <div
            dir="rtl"
            data-testid={`pedigree-couple-unit-${person.id}`}
            className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start"
          >
            {/* RIGHT FLANK (Column 1 in RTL) */}
            <div className="flex flex-row justify-end items-start">
              {renderMultiWifeSideFlank(spouseHub.rightSpouses, 'right')}
            </div>

            {/* EXACT CENTER ANCHOR (Column 2 = X: 50% ALWAYS = Husband/Primary Bloodline) */}
            <div
              data-testid={`husband-center-anchor-${person.id}`}
              className={`flex flex-col items-center relative ${
                hasElevatedMultiBus ? 'pt-9' : ''
              }`}
            >
              {hasElevatedMultiBus && (
                /* Vertical extension connecting top paternal arrow cleanly down into the husband card */
                <div
                  className={`absolute top-0 left-1/2 -translate-x-1/2 w-[2px] h-9 ${
                    treeNode.isDirectSpineEdge
                      ? activeTreeTheme.connectorStrong
                      : activeTreeTheme.connectorSoft
                  }`}
                />
              )}
              {renderPersonCard(person)}
            </div>

            {/* LEFT FLANK (Column 3 in RTL) */}
            <div className="flex flex-row justify-start items-start">
              {renderMultiWifeSideFlank(spouseHub.leftSpouses, 'left')}
            </div>
          </div>
        ) : (
          <div className="relative flex flex-col items-center">
            {renderPersonCard(person)}
            {!isVerticalOnlyZone &&
              spouses.length > 0 &&
              treeDisplaySettings.spouseDisplayMode === 'on_select' && (
                <button
                  type="button"
                  onClick={() => setSelectedPersonIdForSpouses(person.id)}
                  className="mt-0.5 px-2 py-0.5 rounded-full bg-[#FAF6F0] hover:bg-[#F5E6DC] border border-[#D8755B]/45 text-[9.5px] font-display font-bold text-[#8D4925] inline-flex items-center gap-1 cursor-pointer"
                >
                  <Heart className="w-2.5 h-2.5 text-[#D8755B]" />
                  <span>عرض المصاهرة ({spouses.length})</span>
                </button>
              )}
          </div>
        )}

        {/* Branch Collapse / Expand Control for Parents with Descendants */}
        {children.length > 0 && (
          <button
            type="button"
            data-testid={`toggle-branch-collapse-${person.id}`}
            onClick={() => toggleBranchCollapse(person.id)}
            title={
              isBranchCollapsed
                ? `إظهار ذرية ${person.firstName} (${descendantCount})`
                : `طيّ فرع ${person.firstName} (${descendantCount})`
            }
            className={`mt-1 mb-0.5 px-2 py-0.5 rounded-full text-[9.5px] font-display font-bold inline-flex items-center gap-1 border transition-colors cursor-pointer ${
              isBranchCollapsed
                ? 'bg-[#D8755B] text-white border-[#B85A42] shadow-xs'
                : activeTreeTheme.isDarkSurface
                ? 'bg-[#262019]/90 hover:bg-[#332B21] text-[#F3D299] border-[#D4AF37]/40'
                : 'bg-white/90 hover:bg-[#FAF6F0] text-[#8D4925] border-[#B98A78]/40'
            }`}
          >
            {isBranchCollapsed ? (
              <>
                <ChevronLeft className="w-2.5 h-2.5" />
                <span>إظهار الذرية ({descendantCount})</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-2.5 h-2.5" />
                <span>{descendantCount}</span>
              </>
            )}
          </button>
        )}

        {/* ================================================================= */}
        {/* STRICT PATERNAL VS. MATERNAL-UNION CHILD ROUTING                  */}
        {/* ================================================================= */}
        {!isBranchCollapsed && children.length > 0 ? (
          !childRouting.hasVisibleMaternalRouting ? (
            /* CASE A: All children have unspecified mother (OR spouses hidden) -> STRICTLY from Husband's bottom-center */
            renderChildrenCluster(
              childRouting.paternalOnlyChildren,
              person.id,
              false
            )
          ) : (
            /* CASE B: Maternal-Union Routing active — children with motherId route from their specific Wife+Husband union! */
            (() => {
              const allUnionLanes: Array<{
                key: string;
                kind: 'maternal' | 'paternal';
                label: string;
                side: 'right' | 'center' | 'left';
                nodes: PedigreeTreeNode<InteractiveTreePerson>[];
              }> = [];

              childRouting.rightMaternalGroups.forEach((grp) => {
                allUnionLanes.push({
                  key: `${person.id}-m-${grp.spouse.id}`,
                  kind: 'maternal',
                  label: `ذرية ${person.firstName} و${grp.spouse.firstName}`,
                  side: 'right',
                  nodes: grp.children,
                });
              });

              if (childRouting.paternalOnlyChildren.length > 0) {
                allUnionLanes.push({
                  key: `${person.id}-paternal`,
                  kind: 'paternal',
                  label: `ذرية ${person.firstName}`,
                  side: 'center',
                  nodes: childRouting.paternalOnlyChildren,
                });
              }

              childRouting.leftMaternalGroups.forEach((grp) => {
                allUnionLanes.push({
                  key: `${person.id}-m-${grp.spouse.id}`,
                  kind: 'maternal',
                  label: `ذرية ${person.firstName} و${grp.spouse.firstName}`,
                  side: 'left',
                  nodes: grp.children,
                });
              });

              // Single maternal union lane (e.g. 1 wife + her children, 0 unspecified children)
              if (allUnionLanes.length === 1) {
                const onlyLane = allUnionLanes[0];
                return (
                  <div
                    data-testid={`pedigree-maternal-union-single-${onlyLane.key}`}
                    className="flex flex-col items-center"
                  >
                    {/* Golden marital union stem descending with union caption */}
                    <div className="flex flex-col items-center">
                      <div className="w-[2px] h-3.5 bg-[#C5A059]" />
                      <div className="px-2.5 py-0.5 rounded-full bg-[#FEF9EC] border border-[#C5A059]/65 text-[10px] font-display font-extrabold text-[#78350F] inline-flex items-center gap-1 shadow-2xs">
                        <span aria-hidden="true">💍</span>
                        <span>{onlyLane.label}</span>
                      </div>
                    </div>
                    {renderChildrenCluster(
                      onlyLane.nodes,
                      onlyLane.key,
                      onlyLane.kind === 'maternal'
                    )}
                  </div>
                );
              }

              // Multi-lane mixed routing (Right Wife children | Center Father-only children | Left Wife children)
              return (
                <div
                  data-testid={`pedigree-multi-union-lanes-${person.id}`}
                  className="flex flex-col items-center"
                >
                  <div className="w-[2px] h-3 bg-[#C5A059]" />
                  <div
                    dir="rtl"
                    className="flex flex-row flex-nowrap items-start justify-center"
                  >
                    {allUnionLanes.map((lane, idx) => {
                      const isFirst = idx === 0;
                      const isLast = idx === allUnionLanes.length - 1;
                      const isMaternal = lane.kind === 'maternal';
                      return (
                        <div
                          key={lane.key}
                          data-testid={`pedigree-union-lane-${lane.key}`}
                          className="flex flex-col items-center relative"
                        >
                          {/* Continuous union routing rail uniting the couple's active offspring lanes */}
                          <div className="relative w-full h-5 flex flex-col items-center justify-end">
                            <div
                              className={`absolute top-0 h-[2px] bg-[#C5A059]/85 ${
                                isFirst
                                  ? 'start-[calc(50%-1px)] end-0'
                                  : isLast
                                  ? 'start-0 end-[calc(50%-1px)]'
                                  : 'start-0 end-0'
                              }`}
                            />
                            <div
                              className={`w-[2px] flex-1 ${
                                isMaternal
                                  ? 'bg-[#C5A059]'
                                  : activeTreeTheme.connectorSoft
                              }`}
                            />
                          </div>

                          <div className="px-3 flex flex-col items-center">
                            <div
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-display font-extrabold inline-flex items-center gap-1 border shadow-2xs ${
                                isMaternal
                                  ? 'bg-[#FEF9EC] border-[#C5A059]/65 text-[#78350F]'
                                  : activeTreeTheme.isDarkSurface
                                  ? 'bg-[#262019] border-[#D4AF37]/35 text-[#F3D299]'
                                  : 'bg-white border-[#B98A78]/50 text-[#5C2D12]'
                              }`}
                            >
                              {isMaternal && <span aria-hidden="true">💍</span>}
                              <span>{lane.label}</span>
                            </div>
                            {renderChildrenCluster(
                              lane.nodes,
                              lane.key,
                              isMaternal
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()
          )
        ) : children.length === 0 && person.isRecordKeeper ? (
          /* Quiet quick-add action directly beneath Record Keeper when no children exist yet */
          <div className="flex flex-col items-center">
            <div className="w-[2px] h-6 border-r-2 border-dashed border-[#B98A78]/75" />
            {renderDownwardArrowTip(false)}
            <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => openAddRelativeModal(person, 'son')}
                className="px-3.5 py-2 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-display font-bold cursor-pointer transition-colors shadow-2xs"
              >
                + إضافة ابن
              </button>
              <button
                type="button"
                onClick={() => openAddRelativeModal(person, 'daughter')}
                className="px-3.5 py-2 rounded-xl bg-[#8D4925] hover:bg-[#73391b] text-white text-xs font-display font-bold cursor-pointer transition-colors shadow-2xs"
              >
                + إضافة ابنة
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  // ============================================================================
  // RECURSIVE SIDEWAYS (LATERAL RTL ASCENDING) PEDIGREE ENGINE
  // Record Keeper on the RIGHT -> Lineage, Fathers, Uncles & Family branch LEFT
  // Reading Right-to-Left: أمين السجل ← بن ← الأب ← بن ← الجد ← من ← العائلة
  // ============================================================================
  const renderSidewaysPedigreeSubtree = (
    treeNode: PedigreeTreeNode<InteractiveTreePerson>
  ): React.ReactNode => {
    const { person, spouses, children } = treeNode;
    const isVerticalOnlyZone =
      person.generationLevel > FIFTH_GRANDFATHER_LEVEL;
    const descendantCount =
      children.length > 0 ? countTreeNodeDescendants(treeNode) : 0;
    const isBranchCollapsed =
      children.length > 0 && collapsedBranchIds.has(person.id);

    const isKinshipEdge = (childId: string) =>
      isKinshipHighlightedOnCanvas &&
      Boolean(
        kinshipPathResult?.pathNodeIds.has(person.id) &&
          kinshipPathResult?.pathNodeIds.has(childId)
      );

    return (
      <div
        key={`sideways-${person.id}`}
        data-testid={`pedigree-sideways-subtree-${person.id}`}
        dir="rtl"
        className="flex flex-row flex-nowrap items-center"
      >
        {/* 1. RIGHT SIDE (Children / Record Keeper & Branches feeding LEFT into their Father) */}
        {!isBranchCollapsed && children.length === 1 ? (
          <div
            data-testid={`pedigree-sideways-single-branch-${person.id}`}
            className="flex flex-row flex-nowrap items-center"
          >
            {renderSidewaysPedigreeSubtree(children[0])}
            <div className="flex flex-row items-center shrink-0">
              <div
                className={`h-[2px] ${
                  treeDisplaySettings.showKinshipArrows ? 'w-4' : 'w-7'
                } ${
                  isKinshipEdge(children[0].person.id)
                    ? 'bg-[#D4AF37] shadow-[0_0_8px_rgba(212,175,55,0.75)]'
                    : children[0].isDirectSpineEdge
                    ? activeTreeTheme.connectorStrong
                    : activeTreeTheme.connectorSoft
                }`}
              />
              {treeDisplaySettings.showKinshipArrows && (
                <>
                  <span
                    className={`px-1.5 py-0.5 text-[9.5px] font-display font-extrabold inline-flex items-center gap-0.5 leading-none ${activeTreeTheme.kinshipBadge}`}
                  >
                    <span>
                      {children[0].person.gender === 'female' ? 'بنت' : 'بن'}
                    </span>
                    <ArrowLeft className="w-2.5 h-2.5" />
                  </span>
                  <div
                    className={`h-[2px] w-3 ${
                      isKinshipEdge(children[0].person.id)
                        ? 'bg-[#D4AF37]'
                        : children[0].isDirectSpineEdge
                        ? activeTreeTheme.connectorStrong
                        : activeTreeTheme.connectorSoft
                    }`}
                  />
                </>
              )}
              {renderLeftwardArrowTip(
                children[0].isDirectSpineEdge ||
                  isKinshipEdge(children[0].person.id)
              )}
            </div>
          </div>
        ) : !isBranchCollapsed && children.length > 1 ? (
          <div
            data-testid={`pedigree-sideways-siblings-branch-${person.id}`}
            className="flex flex-row flex-nowrap items-center"
          >
            {/* Vertical stack of siblings on the RIGHT, aligned flush-left against the continuous vertical bracket */}
            <div className="flex flex-col items-end">
              {children.map((childNode, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === children.length - 1;
                const childKinshipWord =
                  childNode.person.gender === 'female' ? 'بنت' : 'بن';
                const childOnKinship = isKinshipEdge(childNode.person.id);

                return (
                  <div
                    key={`sideways-col-${childNode.person.id}`}
                    className="flex flex-row flex-nowrap items-center relative"
                  >
                    {/* Vertical spacing lives BEFORE the bracket so the vertical bar stays 100% unbroken */}
                    <div className="py-1.5">
                      {renderSidewaysPedigreeSubtree(childNode)}
                    </div>

                    {/* Horizontal stem extending LEFT into continuous vertical bracket bar on the LEFT edge */}
                    <div className="relative w-10 self-stretch flex flex-row items-center shrink-0">
                      <div
                        className={`h-[2px] flex-1 ${
                          childOnKinship
                            ? 'bg-[#D4AF37]'
                            : childNode.isDirectSpineEdge
                            ? activeTreeTheme.connectorStrong
                            : activeTreeTheme.connectorSoft
                        }`}
                      />
                      {treeDisplaySettings.showKinshipArrows && (
                        <span
                          className={`absolute top-1/2 -translate-y-[16px] left-2 text-[9px] font-display font-extrabold px-1 leading-none ${activeTreeTheme.kinshipBadge}`}
                        >
                          {childKinshipWord}
                        </span>
                      )}
                      <div
                        className={`absolute left-0 w-[2px] ${
                          childOnKinship
                            ? 'bg-[#D4AF37]'
                            : activeTreeTheme.connectorSoft
                        } ${
                          isFirst
                            ? 'top-[calc(50%-1px)] bottom-0'
                            : isLast
                            ? 'top-0 bottom-[calc(50%-1px)]'
                            : 'inset-y-0'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Horizontal stem + leftward arrow exiting the continuous vertical bracket directly into the Father on the LEFT */}
            <div className="flex flex-row items-center shrink-0">
              <div
                className={`h-[2px] w-5 ${
                  children.some((c) => isKinshipEdge(c.person.id))
                    ? 'bg-[#D4AF37]'
                    : activeTreeTheme.connectorSoft
                }`}
              />
              {renderLeftwardArrowTip(true)}
            </div>
          </div>
        ) : null}

        {/* 2. LEFT SIDE: This Parent / Ancestor Node (+ Spouses stacked cleanly below) */}
        <div className="flex flex-col items-center shrink-0">
          {renderPersonCard(person)}
          {children.length > 0 && (
            <button
              type="button"
              onClick={() => toggleBranchCollapse(person.id)}
              className={`mt-1 px-2 py-0.5 rounded-full text-[9.5px] font-display font-bold inline-flex items-center gap-1 border transition-colors cursor-pointer ${
                isBranchCollapsed
                  ? 'bg-[#D8755B] text-white border-[#B85A42]'
                  : 'bg-white/90 hover:bg-[#FAF6F0] text-[#8D4925] border-[#B98A78]/40'
              }`}
            >
              {isBranchCollapsed ? (
                <>
                  <ChevronRight className="w-2.5 h-2.5" />
                  <span>إظهار الذرية ({descendantCount})</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-2.5 h-2.5" />
                  <span>{descendantCount}</span>
                </>
              )}
            </button>
          )}
          {!isVerticalOnlyZone &&
            spouses.length > 0 &&
            (treeDisplaySettings.spouseDisplayMode === 'always' ||
              (treeDisplaySettings.spouseDisplayMode === 'on_select' &&
                (selectedPersonIdForSpouses === person.id ||
                  radialTargetNodeId === person.id))) && (
              /* Independent Husband-Anchored Marital Spine for Sideways Mode (NEVER chains wife-to-wife) */
              <div className="flex flex-col items-center mt-1">
                <div className="w-[2px] h-3 bg-[#C5A059]" />
                <div className="flex flex-row flex-nowrap items-start justify-center">
                  {spouses.map((spouse, sIdx) => {
                    const isFirstS = sIdx === 0;
                    const isLastS = sIdx === spouses.length - 1;
                    return (
                      <div
                        key={`sideways-spouse-${spouse.id}`}
                        className="flex flex-col items-center relative px-1"
                      >
                        <div className="relative w-full h-6 flex flex-col items-center justify-center">
                          {spouses.length > 1 && (
                            <div
                              className={`absolute top-0 h-[2px] bg-[#C5A059] ${
                                isFirstS
                                  ? 'start-[calc(50%-1px)] end-0'
                                  : isLastS
                                  ? 'start-0 end-[calc(50%-1px)]'
                                  : 'start-0 end-0'
                              }`}
                            />
                          )}
                          <div className="w-[2px] flex-1 bg-[#C5A059]" />
                          <span className="absolute w-5 h-5 rounded-full bg-[#FFFDF9] border border-[#C5A059] text-[10px] leading-none flex items-center justify-center shadow-2xs">
                            💍
                          </span>
                        </div>
                        {renderPersonCard(spouse)}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          {/* Quiet quick-add buttons cleanly beneath Record Keeper when he has no children yet */}
          {person.isRecordKeeper && children.length === 0 && (
            <div className="mt-2 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => openAddRelativeModal(person, 'son')}
                className="px-2.5 py-1 rounded-lg bg-[#F5E6DC] hover:bg-[#D8755B] text-[#8D4925] hover:text-white border border-[#D8755B]/50 text-[10.5px] font-display font-bold cursor-pointer transition-colors whitespace-nowrap"
              >
                + ابن
              </button>
              <button
                type="button"
                onClick={() => openAddRelativeModal(person, 'daughter')}
                className="px-2.5 py-1 rounded-lg bg-[#FAF6F0] hover:bg-[#8D4925] text-[#8D4925] hover:text-white border border-[#B98A78]/50 text-[10.5px] font-display font-bold cursor-pointer transition-colors whitespace-nowrap"
              >
                + ابنة
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderSidewaysFamilyAnchor = () => {
    const bridgeNodesAboveFamily = people.filter((p) => p.isBridgeAboveFamily);
    const maxUpperBridgeTier = bridgeNodesAboveFamily.reduce(
      (max, bn) => Math.max(max, bn.bridgeTier ?? 1),
      0
    );

    return (
      <div
        dir="rtl"
        className="flex flex-row flex-nowrap items-center shrink-0"
      >
        {renderSidewaysSpineConnector('من (سليل غير مباشر)')}
        <div className="flex flex-col items-center gap-2">
          {renderFamilyStationCard(maxUpperBridgeTier + 1)}
          {topMostDirectAncestor &&
            !(
              topMostDirectAncestor.fatherId &&
              findPerson(topMostDirectAncestor.fatherId)
            ) && (
              <button
                type="button"
                onClick={() =>
                  openAddRelativeModal(
                    topMostDirectAncestor,
                    topMostDirectAncestor.generationLevel >=
                      FIFTH_GRANDFATHER_LEVEL
                      ? 'vertical_ancestor'
                      : 'father'
                  )
                }
                className="px-3 py-1.5 rounded-xl bg-[#FFFDF9] hover:bg-white border border-dashed border-[#8D4925]/70 hover:border-[#D8755B] text-[11px] font-display font-extrabold text-[#252321] hover:text-[#D8755B] shadow-2xs transition-all cursor-pointer whitespace-nowrap"
              >
                + إضافة (
                {getNextVerticalGrandfatherLabel(
                  topMostDirectAncestor.generationLevel + 1
                )}
                )
              </button>
            )}
        </div>
      </div>
    );
  };

  const DEPTH_SELECTOR_OPTIONS: Array<{
    id: TreeSpineDepthMode;
    label: string;
    detail: string;
    locked: boolean;
  }> = [
    {
      id: 'family',
      label: 'العائلة',
      detail: cleanNaturalSpineName(result.familyName),
      locked: false,
    },
    {
      id: 'sub_branch',
      label: 'الفرع الجامع',
      detail: cleanNaturalSpineName(depthMilestones.subBranchLabel),
      locked: !caps.isRootUnlocked && !caps.isVip,
    },
    {
      id: 'mother_tribe',
      label: 'القبيلة الأم',
      detail: cleanNaturalSpineName(depthMilestones.motherTribeLabel),
      locked: !caps.isRootUnlocked && !caps.isVip,
    },
    {
      id: 'historical_stock',
      label: 'الجذم التاريخي',
      detail: cleanNaturalSpineName(depthMilestones.historicalStockLabel),
      locked: !caps.isVip && !caps.areUpperAncestorsUnlocked,
    },
    {
      id: 'adam_full',
      label: 'آدم عليه السلام',
      detail: 'العمود الكامل',
      locked: !caps.isVip && !caps.areUpperAncestorsUnlocked,
    },
  ];

  const sideNoteElement = renderTreeUpperLayersSideNote();

  return (
    <div className="space-y-4 text-right">
      {/* ==================================================================== */}
      {/* 1. CLEAN SINGLE-ROW TOP HEADER BAR (بادج آخر حفظ + السعة + أيقونات فقط) */}
      {/* ==================================================================== */}
      <div className="rounded-3xl bg-white border border-[#B98A78]/45 px-4 py-3.5 sm:px-5 sm:py-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-lg sm:text-2xl font-display font-extrabold text-[#252321]">
            شجرة عائلة {result.familyName}
          </h2>

          {/* Badges (Last Saved Date + 250 Max Capacity) followed by Icon-Only Actions (Save Last) */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Badge 1: تاريخ آخر حفظ */}
            <span
              data-testid="tree-last-saved-badge"
              title={
                treeSaveState === 'saving'
                  ? 'جاري الحفظ...'
                  : lastSavedLabel
                  ? `تاريخ آخر حفظ: ${lastSavedLabel}`
                  : 'حالة الحفظ'
              }
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#FAF6F0] border border-[#B98A78]/35 text-[11px] font-medium text-[#252321]/80"
            >
              {treeSaveState === 'loading' || treeSaveState === 'saving' ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D8755B]" />
                  <span>
                    {treeSaveState === 'loading'
                      ? 'جاري التحميل...'
                      : 'جاري الحفظ...'}
                  </span>
                </>
              ) : (
                <>
                  <Clock className="w-3.5 h-3.5 text-[#8D4925]/75 shrink-0" />
                  <span className="tabular-nums">
                    آخر حفظ: {lastSavedLabel || 'الآن'}
                  </span>
                </>
              )}
            </span>

            {/* Badge 2: السعة (بحد أقصى 250 أساسي + إضافة سعة من المحفظة) */}
            <button
              type="button"
              data-testid="tree-capacity-badge"
              onClick={() => {
                setCapacityPurchaseFeedback(null);
                setShowCapacityAddonModal(true);
              }}
              title="الحد الأقصى الأساسي 250 فرداً — اضغط لإضافة سعة إضافية تُخصم من رصيد المحفظة"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#FAF6F0] hover:bg-[#F5E6DC] border border-[#B98A78]/45 hover:border-[#D8755B]/75 text-[11px] font-display font-bold text-[#8D4925] transition-colors cursor-pointer"
            >
              <Users className="w-3.5 h-3.5 text-[#D8755B] shrink-0" />
              <span className="tabular-nums">
                السعة: {people.length} / {effectiveMaxTreeMembers}
              </span>
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-md bg-white border border-[#D8755B]/45 text-[#8D4925]">
                <Plus className="w-2.5 h-2.5" />
              </span>
            </button>

            <span
              className="hidden sm:inline-block h-6 w-px bg-[#B98A78]/30 mx-0.5"
              aria-hidden="true"
            />

            {/* Icon-Only Action 1: دعوة أفراد العائلة */}
            <button
              type="button"
              data-testid="invite-family-icon-btn"
              onClick={() => {
                setCopiedInviteLink(false);
                setShowInviteFamilyModal(true);
              }}
              title="دعوة أفراد العائلة"
              aria-label="دعوة أفراد العائلة"
              className="w-9 h-9 rounded-xl bg-[#FAF6F0] hover:bg-[#F5E6DC] text-[#8D4925] border border-[#B98A78]/45 hover:border-[#D8755B]/75 inline-flex items-center justify-center cursor-pointer shadow-2xs transition-colors"
            >
              <UserPlus className="w-4 h-4" />
            </button>

            {/* Icon-Only Action 2: تصدير المشجرة الموثقة */}
            <button
              type="button"
              data-testid="open-tree-official-export-btn"
              onClick={() => setShowOfficialExportModal(true)}
              title="تصدير المشجرة الموثقة"
              aria-label="تصدير المشجرة الموثقة"
              className="w-9 h-9 rounded-xl bg-[#FAF6F0] hover:bg-[#F5E6DC] text-[#8D4925] border border-[#B98A78]/45 hover:border-[#D8755B]/75 inline-flex items-center justify-center cursor-pointer shadow-2xs transition-colors"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Icon-Only Action 3 (الأخير): حفظ المشجرة */}
            <button
              type="button"
              data-testid="save-tree-icon-btn"
              disabled={treeSaveState === 'saving' || treeSaveState === 'loading'}
              onClick={handleManualSaveTree}
              title="حفظ المشجرة"
              aria-label="حفظ المشجرة"
              className="w-9 h-9 rounded-xl bg-emerald-50 hover:bg-emerald-100 disabled:opacity-60 text-emerald-700 border border-emerald-600/35 inline-flex items-center justify-center cursor-pointer shadow-2xs transition-colors"
            >
              {treeSaveState === 'saving' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 1B. MANDATORY RECORD KEEPER CHARTER GATE BANNER                      */}
      {/* (لا تُتاح إضافة أي عقدة أو سجل للشجرة إلا بعد التوقيع على ميثاق أمين السجل) */}
      {/* ==================================================================== */}
      {!isRecordKeeperCharterSigned && (
        <div
          data-testid="tree-charter-required-banner"
          className="rounded-2xl bg-gradient-to-l from-[#FFFDF9] via-[#FAF3E6] to-[#FFF8EB] border-2 border-[#D4AF37] px-4 py-3.5 sm:px-5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 shadow-2xs"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#252321] text-[#F3D299] flex items-center justify-center shrink-0 mt-0.5">
              <FileSignature className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <h3 className="text-xs sm:text-sm font-display font-extrabold text-[#252321]">
                يلزم التوقيع على «ميثاق أمين السجل» قبل إضافة أي عقدة أو تعديل سجلات المشجرة
              </h3>
              <p className="text-[11px] sm:text-xs text-[#252321]/75 leading-relaxed">
                حفاظاً على أمانة التوثيق النَّسبي، تُفعَّل صلاحية إضافة الأفراد والفروع والحلقات العمودية فور اعتماد توقيعك الإلكتروني على ميثاق أمين السجل.
              </p>
            </div>
          </div>

          <button
            type="button"
            data-testid="require-charter-before-add-btn"
            onClick={onSignCharterAndEnableTree}
            className="px-4 py-2.5 rounded-xl bg-[#252321] hover:bg-[#8D4925] text-[#F3D299] text-xs font-display font-extrabold inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer transition-colors shadow-2xs"
          >
            <FileSignature className="w-3.5 h-3.5" />
            <span>التوقيع على ميثاق أمين السجل وتفعيل الإضافة ←</span>
          </button>
        </div>
      )}

      {exportedBanner && (
        <div className="rounded-2xl bg-[#EDE6DA] border-2 border-[#D8755B] px-5 py-3.5 flex items-center justify-between gap-3 text-xs sm:text-sm text-[#252321]">
          <div className="flex items-center gap-2 font-bold">
            <CheckCircle2 className="w-4 h-4 text-[#D8755B] shrink-0" />
            <span>
              تم تجهيز ملف شجرة عائلة {result.familyName} ({people.length} عقدة) للطباعة والحفظ.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setExportedBanner(false)}
            className="text-xs font-bold text-[#D8755B] hover:underline cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. PREMIUM STUDIO WORKSPACE: SIDE INSPECTOR + FLOATING CANVAS HUD    */}
      {/* ==================================================================== */}
      <div
        data-testid="tree-studio-workspace"
        className={
          isCinemaMode
            ? 'fixed inset-0 z-[60] flex flex-col bg-[#FAF6F0] overflow-hidden'
            : `rounded-3xl border-2 ${activeTreeTheme.canvasBorder} shadow-sm relative overflow-hidden transition-colors flex flex-col`
        }
      >
        {/* Clean Non-Overlapping Studio Top Header Bar */}
        <div
          data-testid="tree-settings-collapsible-bar"
          className="px-3.5 py-2.5 bg-white/95 backdrop-blur-xs border-b border-[#B98A78]/25 flex flex-wrap items-center justify-between gap-2.5 text-[#252321] shrink-0 z-20"
        >
          {/* Right Cluster: Studio Inspector Toggle + Clean Inline Metadata Summary */}
          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
            <button
              type="button"
              data-testid="toggle-tree-settings-btn"
              onClick={() => setIsTreeSettingsOpen((open) => !open)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-display font-extrabold inline-flex items-center gap-1.5 cursor-pointer transition-all border shrink-0 ${
                isTreeSettingsOpen
                  ? 'bg-[#252321] text-white border-[#252321] shadow-xs'
                  : 'bg-[#FAF6F0] hover:bg-[#F5E6DC] text-[#8D4925] border-[#D8755B]/55 shadow-2xs'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#D8755B]" />
              <span>إعدادات شجرتي</span>
            </button>
          </div>

          {/* Left Cluster: Smart Node Search & Spotlight + Kinship Calculator Button */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <TreeSmartNodeSearch
              people={visiblePeopleForTree}
              onSelectPerson={handleSpotlightPerson}
            />

            <button
              type="button"
              data-testid="open-kinship-calculator-btn"
              onClick={() => {
                if (!kinshipPersonAId && visiblePeopleForTree.length > 0) {
                  const keeper =
                    visiblePeopleForTree.find((p) => p.isRecordKeeper) ||
                    visiblePeopleForTree[0];
                  setKinshipPersonAId(keeper.id);
                }
                if (!kinshipPersonBId && visiblePeopleForTree.length > 1) {
                  const other =
                    visiblePeopleForTree.find(
                      (p) =>
                        p.id !==
                        (kinshipPersonAId || visiblePeopleForTree[0]?.id)
                    ) || visiblePeopleForTree[1];
                  if (other) setKinshipPersonBId(other.id);
                }
                setShowKinshipModal(true);
              }}
              className={`px-3 py-1.5 rounded-xl text-[11.5px] font-display font-extrabold inline-flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap ${
                isKinshipHighlightedOnCanvas
                  ? 'bg-[#FEF3C7] text-[#92400E] border-[#C5A059] shadow-2xs'
                  : 'bg-[#FAF6F0] hover:bg-[#F5E6DC] text-[#8D4925] border-[#B98A78]/45'
              }`}
            >
              <GitFork className="w-3.5 h-3.5 text-[#D8755B]" />
              <span>صلة القرابة بين فردين ✦</span>
            </button>
          </div>
        </div>

        {/* Active Sub-tree Focus Banner */}
        {focusedSubtreePerson && (
          <div
            data-testid="subtree-focus-banner"
            className="px-4 py-2 bg-[#FEF9EC] border-b border-[#C5A059]/45 flex flex-wrap items-center justify-between gap-2 text-xs text-[#252321] shrink-0"
          >
            <div className="flex items-center gap-2 font-display font-bold">
              <Crosshair className="w-4 h-4 text-[#D8755B] shrink-0" />
              <span>
                وضع التركيز الفرعي: عرض ذرية{' '}
                <strong className="text-[#8D4925]">
                  «{focusedSubtreePerson.firstName}»
                </strong>{' '}
                فقط
              </span>
            </div>
            <button
              type="button"
              data-testid="exit-subtree-focus-btn"
              onClick={() => setFocusSubtreeRootId(null)}
              className="px-3 py-1 rounded-lg bg-[#8D4925] hover:bg-[#73391b] text-white text-[11px] font-display font-extrabold cursor-pointer transition-colors"
            >
              العودة إلى الشجرة الكاملة
            </button>
          </div>
        )}

        {/* Active Kinship Path Highlight Banner */}
        {isKinshipHighlightedOnCanvas && kinshipPathResult && (
          <div
            data-testid="kinship-active-banner"
            className="px-4 py-2 bg-[#252321] text-white border-b border-[#C5A059]/50 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0"
          >
            <div className="flex flex-wrap items-center gap-2 font-display">
              <Sparkles className="w-3.5 h-3.5 text-[#F3D299] shrink-0" />
              <span className="font-extrabold text-[#F3D299]">
                {kinshipPathResult.relationshipLabel}
              </span>
              {kinshipPathResult.commonAncestor && (
                <span className="text-white/75 text-[11px]">
                  · الجد الجامع: {kinshipPathResult.commonAncestor.firstName} (
                  {kinshipPathResult.degreeCount} درجات)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowKinshipModal(true)}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[#F3D299] text-[11px] font-bold cursor-pointer"
              >
                تفاصيل المسار
              </button>
              <button
                type="button"
                onClick={() => setIsKinshipHighlightedOnCanvas(false)}
                className="px-2.5 py-1 rounded-lg bg-[#D8755B] hover:bg-[#c5644b] text-white text-[11px] font-bold cursor-pointer"
              >
                إلغاء الإضاءة
              </button>
            </div>
          </div>
        )}

        {/* Split Studio Workspace: Side Inspector (Desktop 370px / Mobile Bottom Sheet) + 100%-Height Live Tree Canvas */}
        <div
          className={`flex flex-col lg:flex-row relative flex-1 min-w-0 ${
            isCinemaMode ? 'min-h-0' : 'min-h-[580px]'
          }`}
        >
          <TreeStudioSideInspector
            isOpen={isTreeSettingsOpen}
            onClose={() => setIsTreeSettingsOpen(false)}
            activeTab={activeSettingsTab}
            onTabChange={setActiveSettingsTab}
            settings={treeDisplaySettings}
            onUpdateSettings={setTreeDisplaySettings}
            depthOptions={DEPTH_SELECTOR_OPTIONS}
            spineDepth={spineDepth}
            onSelectSpineDepth={handleSelectSpineDepth}
            canApplyMirrorDefault={
              isRecordKeeperCharterSigned || caps.hasRegistrarBadge
            }
            onApplyMirrorDefault={handleApplyAsMirrorDefault}
            mirrorPresetFeedback={mirrorPresetFeedback}
            familyName={result.familyName}
            onOpenExportModal={() => setShowOfficialExportModal(true)}
          />

          {/* Live Tree Canvas Stage */}
          <div
            className="flex-1 min-w-0 relative flex flex-col overflow-hidden transition-colors"
            style={{
              ...getTreeCanvasBackgroundStyle(
                activeTreeTheme,
                treeDisplaySettings.canvasBackground
              ),
              fontFamily: activeTreeFont.cssFamily,
            }}
          >
            {/* Scrollable Pedigree Viewport (Vertical, Sideways RTL, 180° Fan, 360° Radial) */}
            <div
              ref={canvasViewportRef}
              dir="rtl"
              className={`w-full flex-1 overflow-auto touch-pan-x touch-pan-y scroll-smooth px-2 sm:px-4 pt-4 pb-24 ${
                isCinemaMode ? 'min-h-0' : 'min-h-[540px]'
              }`}
            >
              <div ref={canvasContentRef} className="w-max min-w-full">
          {treeDisplaySettings.layoutOrientation === 'fan_180' ||
          treeDisplaySettings.layoutOrientation === 'radial_360' ? (
            <RadialFamilyTreeCharts
              mode={treeDisplaySettings.layoutOrientation}
              familyName={result.familyName}
              topLevelRoots={pedigreeLayout.topLevelRoots}
              directSpineIds={directCompassIds}
              theme={activeTreeTheme}
              settings={treeDisplaySettings}
              zoomPercent={zoomPercent}
              getDisplayName={getCleanCardDisplay}
              onSelectPerson={(p) => openEditPersonModal(p)}
              onAddRelative={(p) => {
                if (!isRecordKeeperCharterSigned) {
                  onSignCharterAndEnableTree();
                  return;
                }
                openAddRelativeModal(p, 'son');
              }}
            />
          ) : treeDisplaySettings.layoutOrientation === 'sideways' ? (
            <div
              data-testid="pedigree-sideways-viewport"
              className="w-max min-w-full flex flex-col items-start px-4 sm:px-8 py-4 transition-transform origin-top-right"
              style={{
                transform: `scale(${zoomPercent / 100})`,
              }}
            >
              {sideNoteElement && (
                <div className="mb-4 max-w-md">{sideNoteElement}</div>
              )}

              {/* Record Keeper anchored on the RIGHT -> Lineage, Fathers, Siblings & Family branch to the LEFT */}
              <div
                dir="rtl"
                data-testid="pedigree-tree-root-container"
                className="flex flex-row flex-nowrap items-center"
              >
                {pedigreeLayout.topLevelRoots.length > 1 ? (
                  <div
                    data-testid="pedigree-sideways-top-siblings-branch"
                    className="flex flex-row flex-nowrap items-center"
                  >
                    <div className="flex flex-col items-end">
                      {pedigreeLayout.topLevelRoots.map((topNode, idx) => {
                        const isFirst = idx === 0;
                        const isLast =
                          idx === pedigreeLayout.topLevelRoots.length - 1;
                        const childKinshipWord =
                          topNode.person.gender === 'female' ? 'بنت' : 'بن';

                        return (
                          <div
                            key={`sideways-top-col-${topNode.person.id}`}
                            className="flex flex-row flex-nowrap items-center relative"
                          >
                            <div className="py-1.5">
                              {renderSidewaysPedigreeSubtree(topNode)}
                            </div>

                            <div className="relative w-10 self-stretch flex flex-row items-center shrink-0">
                              <div
                                className={`h-[2px] flex-1 ${
                                  topNode.isDirectSpineEdge
                                    ? activeTreeTheme.connectorStrong
                                    : activeTreeTheme.connectorSoft
                                }`}
                              />
                              {treeDisplaySettings.showKinshipArrows && (
                                <span
                                  className={`absolute top-1/2 -translate-y-[16px] left-2 text-[9px] font-display font-extrabold px-1 leading-none ${activeTreeTheme.kinshipBadge}`}
                                >
                                  {childKinshipWord}
                                </span>
                              )}
                              <div
                                className={`absolute left-0 w-[2px] ${
                                  activeTreeTheme.connectorSoft
                                } ${
                                  isFirst
                                    ? 'top-[calc(50%-1px)] bottom-0'
                                    : isLast
                                    ? 'top-0 bottom-[calc(50%-1px)]'
                                    : 'inset-y-0'
                                }`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  pedigreeLayout.root &&
                  renderSidewaysPedigreeSubtree(pedigreeLayout.root)
                )}
                {!focusedSubtreePerson && renderSidewaysFamilyAnchor()}
              </div>

              {!focusedSubtreePerson &&
                pedigreeLayout.detachedRoots.length > 0 && (
                  <div className="mt-8 pt-5 border-t border-dashed border-[#B98A78]/55 flex flex-col items-start gap-4">
                    <div className="text-xs font-display font-bold text-[#8D4925]">
                      فروع مسجلة أخرى في المشجرة
                    </div>
                    <div className="flex flex-col items-start gap-5">
                      {pedigreeLayout.detachedRoots.map((detachedNode) =>
                        renderSidewaysPedigreeSubtree(detachedNode)
                      )}
                    </div>
                  </div>
                )}
            </div>
          ) : (
            <div
              className="w-max min-w-full flex flex-col items-center px-4 sm:px-8 transition-transform origin-top"
              style={{
                transform: `scale(${zoomPercent / 100})`,
              }}
            >
              {/* ================================================================ */}
              {/* A. NATURAL LINEAGE SPINE + LEFT-SIDE COLLAPSIBLE FOLLOW-UP NOTE  */}
              {/* ================================================================ */}
              {!focusedSubtreePerson &&
                (sideNoteElement ? (
                  <div className="w-full max-w-[1160px] flex flex-col lg:grid lg:grid-cols-[1fr_minmax(0,560px)_1fr] items-start gap-4">
                    {/* Right Spacer in RTL so Spine remains dead-center */}
                    <div className="hidden lg:block lg:order-1" aria-hidden="true" />

                    {/* Center Spine & Bridge Zone */}
                    <div className="w-full order-2 lg:order-2">
                      {renderNaturalLineageSpineAboveTree()}
                    </div>

                    {/* Left Column in RTL (`على يسار عمود النسب والشجرة`): Collapsed by default & unfolds leftward */}
                    <div className="w-full flex justify-end lg:justify-start lg:sticky lg:top-4 order-1 lg:order-3">
                      {sideNoteElement}
                    </div>
                  </div>
                ) : (
                  renderNaturalLineageSpineAboveTree()
                ))}

              {/* ================================================================ */}
              {/* B. SINGLE CONSOLIDATED UPWARD PARENT PLACEHOLDER (NO DUPLICATES) */}
              {/* ================================================================ */}
              {!focusedSubtreePerson &&
                topMostDirectAncestor &&
                renderTopAncestorAdditionBar(
                  topMostDirectAncestor,
                  pedigreeLayout.unpairedTopMother,
                  pedigreeLayout.topLevelRoots.length > 1
                )}

              {/* ================================================================ */}
              {/* C. TRUE RECURSIVE TOP-DOWN PEDIGREE TREE (FATHERS -> CHILDREN)   */}
              {/*    Top-level siblings unite directly under the preceding node    */}
              {/* ================================================================ */}
              <div
                data-testid="pedigree-tree-root-container"
                className="flex flex-col items-center"
              >
                {pedigreeLayout.topLevelRoots.length > 1 ? (
                  <div
                    dir="rtl"
                    data-testid="pedigree-top-siblings-row"
                    className="flex flex-row flex-nowrap items-start justify-center"
                  >
                    {pedigreeLayout.topLevelRoots.map((topNode, idx) => {
                      const isFirst = idx === 0;
                      const isLast =
                        idx === pedigreeLayout.topLevelRoots.length - 1;
                      const childKinshipWord =
                        topNode.person.gender === 'female' ? 'بنت' : 'بن';

                      return (
                        <div
                          key={topNode.person.id}
                          data-testid={`pedigree-top-sibling-col-${topNode.person.id}`}
                          className="flex flex-col items-center relative"
                        >
                          <div className="relative w-full h-8 flex flex-col items-center justify-end">
                            <div
                              className={`absolute top-0 h-[2px] ${
                                activeTreeTheme.connectorSoft
                              } ${
                                isFirst
                                  ? 'start-[calc(50%-1px)] end-0'
                                  : isLast
                                  ? 'start-0 end-[calc(50%-1px)]'
                                  : 'start-0 end-0'
                              }`}
                            />
                            <div
                              className={`w-[2px] flex-1 ${
                                topNode.isDirectSpineEdge
                                  ? activeTreeTheme.connectorStrong
                                  : activeTreeTheme.connectorSoft
                              }`}
                            />
                            {treeDisplaySettings.showKinshipArrows && (
                              <span
                                className={`absolute top-1.5 start-[calc(50%+5px)] text-[9.5px] font-display font-extrabold px-1 leading-none ${activeTreeTheme.kinshipBadge}`}
                              >
                                {childKinshipWord}
                              </span>
                            )}
                            {renderDownwardArrowTip(topNode.isDirectSpineEdge)}
                          </div>

                          <div className="px-1.5 sm:px-2">
                            {renderPedigreeSubtree(topNode)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  pedigreeLayout.root &&
                  renderPedigreeSubtree(pedigreeLayout.root)
                )}
              </div>

              {/* ================================================================ */}
              {/* D. DETACHED / UNATTACHED LEGACY SUBTREES (ZERO DATA LOSS)        */}
              {/* ================================================================ */}
              {!focusedSubtreePerson &&
                pedigreeLayout.detachedRoots.length > 0 && (
                  <div className="mt-10 pt-6 border-t border-dashed border-[#B98A78]/55 flex flex-col items-center gap-4">
                    <div className="text-xs font-display font-bold text-[#8D4925]">
                      فروع مسجلة أخرى في المشجرة
                    </div>
                    <div
                      dir="rtl"
                      className="flex flex-row flex-nowrap items-start justify-center gap-6"
                    >
                      {pedigreeLayout.detachedRoots.map((detachedNode) =>
                        renderPedigreeSubtree(detachedNode)
                      )}
                    </div>
                  </div>
                )}
            </div>
          )}
              </div>
            </div>

            {/* Interactive Minimap Floating Corner Widget */}
            {showMinimap && (
              <div className="absolute bottom-20 right-3 z-30">
                <TreeInteractiveMinimap
                  people={visiblePeopleForTree}
                  highlightedIds={
                    isKinshipHighlightedOnCanvas && kinshipPathResult
                      ? kinshipPathResult.pathNodeIds
                      : directCompassIds
                  }
                  theme={activeTreeTheme}
                  onJumpToPerson={handleSpotlightPerson}
                  onClose={() => setShowMinimap(false)}
                />
              </div>
            )}

            {/* Quiet Canvas Bottom Edge: Floating Glass Studio Dock */}
            <div className="pointer-events-none absolute inset-x-0 bottom-3 z-30 px-3 flex flex-col items-center gap-2">

              <div className="pointer-events-auto">
                <TreeFloatingStudioDock
                  zoomPercent={zoomPercent}
                  onZoomIn={() => setZoomPercent((z) => Math.min(130, z + 10))}
                  onZoomOut={() => setZoomPercent((z) => Math.max(50, z - 10))}
                  onResetZoom={() => setZoomPercent(100)}
                  onFitAndCenter={handleFitAndCenterCanvas}
                  isCinemaMode={isCinemaMode}
                  onToggleCinemaMode={() => setIsCinemaMode((v) => !v)}
                  showMinimap={showMinimap}
                  onToggleMinimap={() => setShowMinimap((v) => !v)}
                  isDarkSurface={activeTreeTheme.isDarkSurface}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 2B. DEPTH UNLOCK / UPGRADE MODAL (إذا اختار العميل مدى غير مفتوح بعد) */}
      {/* ==================================================================== */}
      {depthLockPrompt && (
        <div
          className="fixed inset-0 z-50 bg-[#252321]/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            dir="rtl"
            className="bg-white border-2 border-[#D8755B] rounded-3xl max-w-md w-full p-6 space-y-4 text-right shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#B98A78]/30 pb-3">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-[#D8755B]" />
                <h4 className="text-base font-display font-extrabold text-[#252321]">
                  فتح مدى العرض ({depthLockPrompt.label})
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setDepthLockPrompt(null)}
                className="w-7 h-7 rounded-lg bg-[#F7F2E9] flex items-center justify-center text-[#252321] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-[#252321]/80 leading-relaxed">
              {depthLockPrompt.requireType === 'root_5_usd'
                ? `لإظهار امتداد شجرة عائلة ${result.familyName} ${depthLockPrompt.label} (${result.rootBranchName} · ${result.rootTribeName})، يرجى فتح نقطة الربط الموثقة.`
                : `لإظهار امتداد عمود النسب الطبيعي فوق شجرة عائلتك ${depthLockPrompt.label}، يلزم تفعيل الباقة السنوية الشاملة.`}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDepthLockPrompt(null)}
                className="px-4 py-2 rounded-xl bg-[#F7F2E9] text-xs font-bold text-[#252321] cursor-pointer"
              >
                إلغاء
              </button>
              {depthLockPrompt.requireType === 'root_5_usd' ? (
                <button
                  type="button"
                  onClick={() => {
                    setDepthLockPrompt(null);
                    onUnlockRoot5Usd?.();
                  }}
                  className="px-5 py-2.5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-display font-extrabold cursor-pointer"
                >
                  فتح نقطة الربط الآن ($5) ←
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setDepthLockPrompt(null);
                    onUpgradeAnnualVip();
                  }}
                  className="px-5 py-2.5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-display font-extrabold cursor-pointer"
                >
                  ترقية للباقة السنوية ($60) ←
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2C. QUOTA UPGRADE MODAL (Zero Data Loss — preserves typed form data) */}
      {/* ==================================================================== */}
      {quotaUpgradePrompt && (
        <div
          className="fixed inset-0 z-[70] bg-[#252321]/65 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            dir="rtl"
            className="bg-white border-2 border-[#D4AF37] rounded-3xl max-w-lg w-full p-6 space-y-4 text-right shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#B98A78]/30 pb-3">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-[#D8755B]" />
                <h4 className="text-base font-display font-extrabold text-[#252321]">
                  {quotaUpgradePrompt.kind === 'tree_members'
                    ? 'وصلت إلى الحد الأقصى لأفراد الشجرة في باقتك الحالية'
                    : 'وصلت إلى الحد الأقصى لوثائق الخزانة في باقتك الحالية'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setQuotaUpgradePrompt(null)}
                className="w-7 h-7 rounded-lg bg-[#F7F2E9] flex items-center justify-center text-[#252321] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-2xl bg-[#FAF6F0] border border-[#B98A78]/40 p-3.5 text-xs text-[#252321]/85 leading-relaxed space-y-1">
              <div className="font-bold text-[#8D4925]">
                الاستخدام الحالي: {quotaUpgradePrompt.currentCount} من أصل{' '}
                {quotaUpgradePrompt.maxAllowed}{' '}
                {quotaUpgradePrompt.kind === 'tree_members' ? 'فرداً' : 'ملفاً'}
              </div>
              <p>
                اطمئن: جميع البيانات التي أدخلتها في النموذج محفوظة كما هي ولن تضيع عند الترقية.
              </p>
            </div>

            <div className="space-y-2.5">
              {!caps.isRootUnlocked && onUnlockRoot5Usd && (
                <div className="rounded-2xl bg-[#FFFDF9] border border-[#D8755B]/50 p-3.5 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-display font-extrabold text-[#252321]">
                      الباقة الأساسية ($5 — فتح الجذر الموثق)
                    </div>
                    <div className="text-[11px] text-[#252321]/70">
                      ترفع السعة إلى 50 فرداً في شجرتي + 20 وثيقة في خزانتي
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setQuotaUpgradePrompt(null);
                      onUnlockRoot5Usd();
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-display font-bold shrink-0 cursor-pointer"
                  >
                    ترقية ($5)
                  </button>
                </div>
              )}

              {!caps.isVip && (
                <div className="rounded-2xl bg-[#FFFDF9] border border-[#8D4925]/45 p-3.5 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-display font-extrabold text-[#252321]">
                      الباقة السنوية الشاملة — بريميوم ($60/سنة)
                    </div>
                    <div className="text-[11px] text-[#252321]/70">
                      ترفع السعة إلى 250 فرداً + 100 وثيقة + فتح المصادر ونشر «موقعي»
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setQuotaUpgradePrompt(null);
                      onUpgradeAnnualVip();
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#F5E6DC] hover:bg-[#D8755B] text-[#8D4925] hover:text-white border border-[#D8755B]/75 text-xs font-display font-bold shrink-0 cursor-pointer transition-colors"
                  >
                    ترقية VIP
                  </button>
                </div>
              )}

              {quotaUpgradePrompt.kind === 'tree_members' && (
                <div className="rounded-2xl bg-gradient-to-l from-[#FFFDF9] to-[#F5E6DC]/60 border border-[#D8755B]/55 p-3.5 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-display font-extrabold text-[#8D4925]">
                      إضافة سعة إضافية من رصيد المحفظة
                    </div>
                    <div className="text-[11px] text-[#252321]/75">
                      الحد الأساسي الأقصى هو 250 فرداً — يمكنك زيادة السعة فوراً بخصم من المحفظة (رصيدك: ${walletBalance})
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setQuotaUpgradePrompt(null);
                      setCapacityPurchaseFeedback(null);
                      setShowCapacityAddonModal(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#F5E6DC] hover:bg-[#D8755B] text-[#8D4925] hover:text-white border border-[#D8755B]/75 text-xs font-display font-bold shrink-0 cursor-pointer transition-colors"
                  >
                    إضافة سعة
                  </button>
                </div>
              )}

              {!caps.hasRegistrarBadge && quotaUpgradePrompt.kind !== 'tree_members' && (
                <div className="rounded-2xl bg-gradient-to-l from-[#FFFDF9] to-[#FEF3C7]/45 border border-[#D4AF37] p-3.5 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-display font-extrabold text-[#8D4925]">
                      عضوية أمين سجل العائلة ✦
                    </div>
                    <div className="text-[11px] text-[#252321]/75">
                      رفع سعة الشجرة حتى 250 فرداً + دعوة أفراد العائلة للمساهمة
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setQuotaUpgradePrompt(null);
                      onSignCharterAndEnableTree();
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#8D4925] hover:bg-[#733a1c] text-white text-xs font-display font-bold shrink-0 cursor-pointer"
                  >
                    تفعيل أمين السجل
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2C-EXTRA. PAID TREE CAPACITY EXPANSION MODAL (إضافة سعة من المحفظة)  */}
      {/* ==================================================================== */}
      {showCapacityAddonModal && (
        <div
          className="fixed inset-0 z-[72] bg-[#252321]/55 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          data-testid="tree-capacity-addon-modal"
        >
          <div
            dir="rtl"
            className="bg-white border-2 border-[#D8755B]/60 rounded-3xl max-w-lg w-full p-6 space-y-4 text-right shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#B98A78]/30 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#D8755B]" />
                <h4 className="text-base font-display font-extrabold text-[#252321]">
                  إضافة سعة إضافية للشجرة
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowCapacityAddonModal(false)}
                className="w-7 h-7 rounded-lg bg-[#FAF6F0] hover:bg-[#F5E6DC] flex items-center justify-center text-[#8D4925] cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-2xl bg-[#FAF6F0] border border-[#B98A78]/40 p-3.5 text-xs text-[#252321]/85 leading-relaxed space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-display font-extrabold text-[#8D4925]">
                  السعة الحالية: {people.length} / {effectiveMaxTreeMembers} فرداً
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-[#B98A78]/40 text-[#8D4925] font-display font-bold">
                  <Wallet className="w-3.5 h-3.5 text-[#D8755B]" />
                  <span>رصيد المحفظة: ${walletBalance}</span>
                </span>
              </div>
              <p className="text-[11px] text-[#252321]/75">
                الحد الأقصى الأساسي للشجرة هو <strong>250 فرداً</strong>، ولإضافة أكثر من ذلك يمكنك توسيع السعة فوراً عبر إحدى الباقات التالية بخصم مباشر من رصيد محفظتك.
              </p>
              {extraTreeCapacity > 0 && (
                <div className="text-[11px] font-bold text-emerald-700">
                  سعة إضافية مفعّلة لديك حالياً: +{extraTreeCapacity} فرداً
                </div>
              )}
            </div>

            {capacityPurchaseFeedback && (
              <div
                className={`rounded-2xl p-3 text-xs font-medium flex flex-col gap-2 border ${
                  capacityPurchaseFeedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 border-amber-300 text-amber-900'
                }`}
              >
                <div className="flex items-start gap-2">
                  {capacityPurchaseFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <Wallet className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  )}
                  <span>{capacityPurchaseFeedback.message}</span>
                </div>
                {capacityPurchaseFeedback.type === 'error' &&
                  capacityPurchaseFeedback.shortfallUsd &&
                  capacityPurchaseFeedback.shortfallUsd > 0 &&
                  onOpenWalletDrawer && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setShowCapacityAddonModal(false);
                          onOpenWalletDrawer();
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-[#F5E6DC] hover:bg-[#D8755B] text-[#8D4925] hover:text-white border border-[#D8755B]/75 text-xs font-display font-bold cursor-pointer transition-colors"
                      >
                        شحن رصيد المحفظة
                      </button>
                    </div>
                  )}
              </div>
            )}

            <div className="space-y-2.5">
              {TREE_CAPACITY_ADDON_PACKAGES.map((pkg) => {
                const isBuying = capacityPurchaseLoadingId === pkg.id;
                return (
                  <div
                    key={pkg.id}
                    className="rounded-2xl bg-[#FFFDF9] border border-[#B98A78]/45 hover:border-[#D8755B]/70 p-3.5 flex items-center justify-between gap-3 transition-colors"
                  >
                    <div>
                      <div className="text-xs sm:text-sm font-display font-extrabold text-[#252321]">
                        {pkg.label}
                      </div>
                      <div className="text-[11px] text-[#252321]/70">
                        ترفع السعة الإجمالية إلى{' '}
                        <strong className="text-[#8D4925]">
                          {effectiveMaxTreeMembers + pkg.extraSlots}
                        </strong>{' '}
                        فرداً · يُخصم ${pkg.priceUsd} من رصيد المحفظة
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={capacityPurchaseLoadingId !== null}
                      onClick={() => handleBuyCapacityAddon(pkg)}
                      className="px-3.5 py-2 rounded-xl bg-[#F5E6DC] hover:bg-[#D8755B] disabled:opacity-60 text-[#8D4925] hover:text-white border border-[#D8755B]/75 text-xs font-display font-extrabold shrink-0 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      {isBuying ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>جاري الخصم...</span>
                        </>
                      ) : (
                        <span>إضافة (${pkg.priceUsd})</span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2D. FAMILY REGISTRAR INVITE MODAL (دعوة أفراد العائلة للمساهمة/المعاينة) */}
      {/* ==================================================================== */}
      {showInviteFamilyModal && (
        <div
          className="fixed inset-0 z-[65] bg-[#252321]/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            dir="rtl"
            className="bg-white border-2 border-[#B98A78] rounded-3xl max-w-lg w-full p-6 space-y-4 text-right shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#B98A78]/30 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#D8755B]" />
                <h4 className="text-base font-display font-extrabold text-[#252321]">
                  دعوة أفراد عائلة {result.familyName} للمساهمة أو المعاينة
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowInviteFamilyModal(false)}
                className="w-7 h-7 rounded-lg bg-[#F7F2E9] flex items-center justify-center text-[#252321] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {caps.canInviteFamilyContributors ? (
              <div className="space-y-4">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#FEF3C7] border border-[#D4AF37] text-xs font-display font-bold text-[#8D4925]">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#D97706]" />
                  <span>صلاحية أمين سجل العائلة مفعّلة ✦</span>
                </div>

                <p className="text-xs text-[#252321]/80 leading-relaxed">
                  بصفتك <strong>أمين سجل عائلة {result.familyName}</strong>، يمكنك مشاركة هذا الرابط المخصص والمربوط بمعرّف شجرتك مع أبناء العمومة وأفراد الأسرة للمساهمة في إثراء الفروع أو معاينة المشجرة.
                </p>

                {treeDisplaySettings.femalePrivacyMode === 'hide_females' && (
                  <div className="rounded-xl bg-[#FFF8F0] border border-[#D8755B]/45 px-3 py-2 flex items-start gap-2 text-[11px] font-semibold text-[#8D4925]">
                    <ShieldCheck className="w-4 h-4 text-[#D8755B] shrink-0 mt-0.5" />
                    <span>
                      خيار الخصوصية «إخفاء الإناث» مفعّل — لن تظهر أسماء الإناث لأفراد الأسرة المدعوين عبر هذا الرابط.
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setInviteRoleMode('contribute');
                      setCopiedInviteLink(false);
                    }}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-display font-bold cursor-pointer transition-colors ${
                      inviteRoleMode === 'contribute'
                        ? 'bg-[#252321] text-[#F3D299] border-[#252321]'
                        : 'bg-[#FAF6F0] text-[#252321] border-[#B98A78]/45'
                    }`}
                  >
                    دعوة للمساهمة والإثراء
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInviteRoleMode('view');
                      setCopiedInviteLink(false);
                    }}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-display font-bold cursor-pointer transition-colors ${
                      inviteRoleMode === 'view'
                        ? 'bg-[#252321] text-[#F3D299] border-[#252321]'
                        : 'bg-[#FAF6F0] text-[#252321] border-[#B98A78]/45'
                    }`}
                  >
                    دعوة للمعاينة فقط
                  </button>
                </div>

                <div className="rounded-2xl bg-[#F7F2E9] border border-[#B98A78]/50 p-3 flex items-center justify-between gap-2">
                  <span
                    dir="ltr"
                    className="text-[11px] font-mono text-[#252321] truncate flex-1 select-all"
                  >
                    {familyInviteUrl}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(familyInviteUrl).catch(() => {});
                      setCopiedInviteLink(true);
                      onLogActivity(
                        'نسخ رابط دعوة العائلة',
                        `نسخ رابط دعوة (${inviteRoleMode === 'contribute' ? 'مساهمة' : 'معاينة'}) لشجرة عائلة ${result.familyName}`
                      );
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-display font-bold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    {copiedInviteLink ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>تم النسخ ✓</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>نسخ الرابط</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs sm:text-sm text-[#252321]/80 leading-relaxed">
                  ميزة <strong>«دعوة أفراد العائلة للمساهمة أو المعاينة»</strong> عبر رابط عائلي موحد هي إحدى صلاحيات الحوكمة المخصصة لحاملي صفة <strong>«أمين سجل العائلة»</strong>، وتشمل أيضاً سعة تصل إلى 250 فرداً (مع إمكانية إضافة سعة إضافية من المحفظة) وصلاحية النشر العائلي الموثق.
                </p>
                <div className="flex items-center justify-end gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowInviteFamilyModal(false)}
                    className="px-4 py-2 rounded-xl bg-[#FAF6F0] hover:bg-[#F5E6DC] text-xs font-bold text-[#8D4925] cursor-pointer transition-colors"
                  >
                    لاحقاً
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowInviteFamilyModal(false);
                      onSignCharterAndEnableTree();
                    }}
                    className="px-5 py-2.5 rounded-xl bg-[#F5E6DC] hover:bg-[#D8755B] text-[#8D4925] hover:text-white border border-[#D8755B]/75 text-xs font-display font-extrabold cursor-pointer transition-colors"
                  >
                    التوقيع وتفعيل أمين سجل العائلة ✦
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. ROYAL PERSON CARD STUDIO MODAL (استوديو بطاقة الفرد الملكي)       */}
      {/* ==================================================================== */}
      {modalConfig && modalMeta && (() => {
        const editingPerson =
          modalConfig.mode === 'edit' && modalConfig.editPersonId
            ? findPerson(modalConfig.editPersonId)
            : undefined;
        const targetForAdd =
          modalConfig.mode === 'add'
            ? findPerson(modalConfig.targetNodeId)
            : undefined;
        const isVerticalOnlyModal = Boolean(
          (editingPerson &&
            !editingPerson.isBridgeAboveFamily &&
            editingPerson.generationLevel > FIFTH_GRANDFATHER_LEVEL) ||
            (modalConfig.mode === 'add' &&
              (modalConfig.relationKind === 'bridge_above_family' ||
                modalConfig.relationKind ===
                  'horizontal_branch_above_family' ||
                (modalConfig.relationKind === 'vertical_ancestor' &&
                  (targetForAdd?.generationLevel ?? 0) >=
                    FIFTH_GRANDFATHER_LEVEL)))
        );
        const currentModalPersonId =
          modalConfig.mode === 'edit' ? modalConfig.editPersonId : null;
        const linkedMediaForModalPerson = vaultItems.filter((vi) =>
          currentModalPersonId
            ? vi.linkedPersonIds.includes(currentModalPersonId)
            : newPersonPendingVaultIds.includes(vi.id)
        );
        const unlinkedMediaInVault = vaultItems.filter((vi) =>
          currentModalPersonId
            ? !vi.linkedPersonIds.includes(currentModalPersonId)
            : !newPersonPendingVaultIds.includes(vi.id)
        );

        return (
          <TreePersonStudioModal
            mode={modalConfig.mode}
            bindingHeadline={modalMeta.bindingHeadline}
            familyName={result.familyName}
            isVerticalOnlyModal={isVerticalOnlyModal}
            isHorizontalBridgeAboveFamily={
              modalConfig.mode === 'add' &&
              modalConfig.relationKind === 'horizontal_branch_above_family'
            }
            isSpouseRole={modalMeta.isSpouseRole}
            isDaughterRole={modalMeta.isDaughterRole}
            showMotherSelector={modalMeta.showMotherSelector}
            motherSelectorFatherName={modalMeta.motherSelectorFatherName}
            motherOptions={modalMeta.motherOptions.map((m) => ({
              id: m.id,
              firstName: m.firstName,
              kunya: m.kunya,
              maidenFamilyLine: m.maidenFamilyLine,
              photoUrl: m.photoUrl,
              photoThumbnailUrl: m.photoThumbnailUrl,
            }))}
            inlineNewMotherName={inlineNewMotherName}
            onChangeInlineNewMotherName={(val) => {
              setInlineNewMotherName(val);
              if (formError) setFormError('');
            }}
            inlineNewMotherMaidenLine={inlineNewMotherMaidenLine}
            onChangeInlineNewMotherMaidenLine={setInlineNewMotherMaidenLine}
            smartAddMotherContext={
              modalConfig.mode === 'add' &&
              modalConfig.relationKind === 'mother' &&
              modalMeta.smartMotherInfo
                ? {
                    childName: modalMeta.smartMotherInfo.childName,
                    fatherId: modalMeta.smartMotherInfo.fatherId,
                    fatherName: modalMeta.smartMotherInfo.fatherName,
                    existingFatherWives:
                      modalMeta.smartMotherInfo.existingFatherWives.map(
                        (w) => ({
                          id: w.id,
                          firstName: w.firstName,
                          kunya: w.kunya,
                          maidenFamilyLine: w.maidenFamilyLine,
                          photoUrl: w.photoUrl,
                          photoThumbnailUrl: w.photoThumbnailUrl,
                        })
                      ),
                    choiceMode: addMotherChoiceMode,
                    onChangeChoiceMode: (mode) => {
                      setAddMotherChoiceMode(mode);
                      if (formError) setFormError('');
                    },
                    selectedExistingMotherId,
                    onChangeSelectedExistingMotherId: (id) => {
                      setSelectedExistingMotherId(id);
                      if (formError) setFormError('');
                    },
                  }
                : null
            }
            activeTreeTheme={activeTreeTheme}
            avatarStyle={treeDisplaySettings.avatarStyle}
            preferRealPhotos={treeDisplaySettings.preferRealPhotos}
            calendarDisplayMode={treeDisplaySettings.calendarDisplayMode}
            showHonorific={treeDisplaySettings.showHonorific}
            showKunya={treeDisplaySettings.showKunya}
            showDates={treeDisplaySettings.showDates}
            showPrestigeBadges={treeDisplaySettings.showPrestigeBadges}
            showDeceasedDignityFrame={
              treeDisplaySettings.showDeceasedDignityFrame
            }
            isRecordKeeperTarget={Boolean(editingPerson?.isRecordKeeper)}
            formGender={formGender}
            formFirstName={formFirstName}
            onChangeFirstName={(val) => {
              setFormFirstName(val);
              if (formError) setFormError('');
            }}
            formKunya={formKunya}
            onChangeKunya={setFormKunya}
            formHonorific={formHonorific}
            onChangeHonorific={setFormHonorific}
            formPrestigeBadge={formPrestigeBadge}
            onChangePrestigeBadge={setFormPrestigeBadge}
            formMotherId={formMotherId}
            onChangeMotherId={setFormMotherId}
            formMaidenFamilyLine={formMaidenFamilyLine}
            onChangeMaidenFamilyLine={setFormMaidenFamilyLine}
            formMarriageAllianceNote={formMarriageAllianceNote}
            onChangeMarriageAllianceNote={setFormMarriageAllianceNote}
            formVitalStatus={formVitalStatus}
            onChangeVitalStatus={setFormVitalStatus}
            formBirthPrecision={formBirthPrecision}
            onChangeBirthPrecision={setFormBirthPrecision}
            formBirthCalendar={formBirthCalendar}
            onChangeBirthCalendar={setFormBirthCalendar}
            formBirthDate={formBirthDate}
            onChangeBirthDate={setFormBirthDate}
            formBirthPlace={formBirthPlace}
            onChangeBirthPlace={setFormBirthPlace}
            formDeathDate={formDeathDate}
            onChangeDeathDate={setFormDeathDate}
            formDeathPlace={formDeathPlace}
            onChangeDeathPlace={setFormDeathPlace}
            formFemalePrivacyMasked={formFemalePrivacyMasked}
            onChangeFemalePrivacyMasked={setFormFemalePrivacyMasked}
            formContactInfo={formContactInfo}
            onChangeContactInfo={setFormContactInfo}
            formBiography={formBiography}
            onChangeBiography={setFormBiography}
            formAttachedDocName={formAttachedDocName}
            onChangeAttachedDocName={setFormAttachedDocName}
            formPhotoUrl={formPhotoUrl}
            onClearPhotoUrl={() => setFormPhotoUrl('')}
            onUploadPortraitFile={handleUploadStudioPortrait}
            isUploadingPortrait={isUploadingStudioPortrait}
            formError={formError}
            linkedMediaForPerson={linkedMediaForModalPerson}
            unlinkedMediaInVault={unlinkedMediaInVault}
            vaultFolders={vaultFolders}
            treeVaultUploadTitle={treeVaultUploadTitle}
            onChangeTreeVaultUploadTitle={setTreeVaultUploadTitle}
            treeVaultUploadFolderId={treeVaultUploadFolderId}
            onChangeTreeVaultUploadFolderId={setTreeVaultUploadFolderId}
            isUploadingToVault={isUploadingToVaultFromTree}
            onUploadFileToVault={(files) =>
              handleUploadFileDirectlyToVaultFromTree(files)
            }
            onToggleVaultItemLink={(mediaId) =>
              handleToggleVaultItemForModalPerson(mediaId)
            }
            canFocusSubtree={Boolean(
              modalConfig.mode === 'edit' && modalConfig.editPersonId
            )}
            onFocusSubtree={() => {
              const targetId = modalConfig.editPersonId;
              if (!targetId) return;
              setCollapsedBranchIds((prev) => {
                const next = new Set(prev);
                next.delete(targetId);
                return next;
              });
              setFocusSubtreeRootId(targetId);
              setModalConfig(null);
            }}
            modalScrollContainerRef={modalScrollContainerRef}
            nameInputRef={nameInputRef}
            onSubmit={handleSavePersonModal}
            onClose={() => setModalConfig(null)}
          />
        );
      })()}

      {/* ==================================================================== */}
      {/* 4. CAMERA AVATAR PICKER MODAL (رفع صورة مضغوطة ذكياً أو البورتريه التراثي) */}
      {/* ==================================================================== */}
      {photoPickerNodeId && (
        <div
          className="fixed inset-0 z-50 bg-[#252321]/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            dir="rtl"
            className="bg-white border-2 border-[#B98A78] rounded-3xl max-w-md w-full p-5 space-y-4 text-right shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-[#B98A78]/30 pb-3">
              <h4 className="text-base font-display font-extrabold text-[#252321]">
                الصورة الشخصية في المشجرة
              </h4>
              <button
                type="button"
                onClick={() => setPhotoPickerNodeId(null)}
                className="w-7 h-7 rounded-lg bg-[#F7F2E9] flex items-center justify-center text-[#252321] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-2xl bg-[#FAF6F0] border border-[#B98A78]/45 p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <HeritageNodeAvatar
                  personRole="client"
                  gender={findPerson(photoPickerNodeId)?.gender || 'male'}
                  size="md"
                />
                <div>
                  <div className="text-xs font-display font-bold text-[#252321]">
                    البورتريه التراثي الكلاسيكي الافتراضي
                  </div>
                  <div className="text-[11px] text-[#252321]/65">
                    مرسوم بالظل والنور الدافئ ومحايد عربياً
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCustomPhotoUrlInput('')}
                className="px-3 py-1.5 rounded-xl bg-white border border-[#B98A78]/50 text-[11px] font-bold text-[#8D4925] hover:border-[#D8755B] cursor-pointer shrink-0"
              >
                استخدام البورتريه
              </button>
            </div>

            {/* Smart Compressed File Upload to `users/{uid}/tree_avatars/{personId}` */}
            <div className="rounded-2xl bg-[#FFFDF9] border border-[#D4AF37]/60 p-3.5 space-y-2">
              <div className="text-xs font-display font-bold text-[#252321]">
                رفع صورة حقيقية من جهازك (ضغط WebP/JPEG ذكي وتخزين سحابي آمن):
              </div>
              <label className="w-full py-2.5 px-4 rounded-xl bg-[#252321] hover:bg-[#8D4925] text-[#FEF3C7] text-xs font-display font-extrabold flex items-center justify-center gap-2 cursor-pointer transition-colors">
                {isUploadingNodeAvatar ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري ضغط وحفظ الصورة...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>اختيار صورة من الجهاز</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  disabled={isUploadingNodeAvatar}
                  className="hidden"
                  onChange={async (e) => {
                    const selected = e.target.files?.[0];
                    e.target.value = '';
                    if (!selected || !photoPickerNodeId) return;
                    const targetPersonId = photoPickerNodeId;
                    const targetPerson = findPerson(targetPersonId);
                    setIsUploadingNodeAvatar(true);
                    try {
                      const uploaded = await uploadTreeNodeAvatarWithFallback(
                        userId,
                        targetPersonId,
                        selected
                      );
                      setPeople((prev) =>
                        prev.map((p) =>
                          p.id === targetPersonId
                            ? {
                                ...p,
                                photoUrl: uploaded.url,
                                photoThumbnailUrl:
                                  uploaded.thumbnailUrl || uploaded.url,
                                photoStoragePath: uploaded.storagePath,
                              }
                            : p
                        )
                      );

                      // Automatically add & link the uploaded portrait in `خزانتي` so it appears immediately in `وثائق وصور هذا الفرد` without manual linking
                      const vaultItemId = `vault_avatar_${Date.now()}_${Math.random()
                        .toString(36)
                        .slice(2, 6)}`;
                      const baseFileTitle = selected.name.replace(/\.[^/.]+$/, '');
                      const newVaultPhoto: FamilyVaultMediaItem = {
                        id: vaultItemId,
                        title:
                          baseFileTitle ||
                          `صورة ${targetPerson?.firstName || 'الفرد'}`,
                        mediaType: 'photo',
                        folderId: 'folder_ancestors',
                        dateOrOccasion: 'صورة شخصية في المشجرة',
                        fileDataUrl: uploaded.url,
                        thumbnailDataUrl:
                          uploaded.thumbnailUrl || uploaded.url,
                        storagePath: uploaded.storagePath,
                        storageProvider: uploaded.storagePath
                          ? 'firebase_storage'
                          : 'firestore_chunked',
                        fileName: selected.name,
                        fileMimeType: selected.type || 'image/jpeg',
                        linkedPersonIds: [targetPersonId],
                        enhanced: false,
                        createdAt: new Date().toISOString(),
                      };
                      const nextVaultItems = [newVaultPhoto, ...vaultItems];
                      setVaultItems(nextVaultItems);
                      await saveUserVaultArchive(
                        userId,
                        result.familyName,
                        {
                          folders: vaultFolders,
                          items: nextVaultItems,
                        },
                        userEmail
                      );

                      onLogActivity(
                        'تحديث صورة فرد في شجرتي وربطها بالخزانة',
                        `تم حفظ الصورة الشخصية لـ «${targetPerson?.firstName || 'الفرد'}» وربطها تلقائياً بملفه في خزانتي`
                      );
                    } catch {
                      // Safe fallback so modal never hangs open
                    } finally {
                      setIsUploadingNodeAvatar(false);
                      setPhotoPickerNodeId(null);
                    }
                  }}
                />
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#252321] mb-1">
                أو أدخل رابط الصورة الحقيقية للفرد (image_url):
              </label>
              <input
                type="url"
                dir="ltr"
                value={customPhotoUrlInput}
                onChange={(e) => setCustomPhotoUrlInput(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-xl bg-[#FAF6F0] border border-[#B98A78]/60 px-3 py-2 text-xs text-[#252321]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPhotoPickerNodeId(null)}
                className="px-4 py-2 rounded-xl bg-[#F7F2E9] text-xs font-bold text-[#252321] cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetPid = photoPickerNodeId;
                  const cleanUrl = customPhotoUrlInput.trim();
                  const targetP = findPerson(targetPid);
                  setPeople((prev) =>
                    prev.map((p) =>
                      p.id === targetPid
                        ? {
                            ...p,
                            photoUrl: cleanUrl || undefined,
                            photoThumbnailUrl: cleanUrl || undefined,
                          }
                        : p
                    )
                  );
                  if (cleanUrl && targetPid) {
                    const alreadyLinked = vaultItems.some(
                      (vi) =>
                        vi.fileDataUrl === cleanUrl &&
                        vi.linkedPersonIds.includes(targetPid)
                    );
                    if (!alreadyLinked) {
                      const newVaultPhoto: FamilyVaultMediaItem = {
                        id: `vault_url_${Date.now()}_${Math.random()
                          .toString(36)
                          .slice(2, 6)}`,
                        title: `صورة ${targetP?.firstName || 'الفرد'}`,
                        mediaType: 'photo',
                        folderId: 'folder_ancestors',
                        dateOrOccasion: 'صورة شخصية في المشجرة',
                        fileDataUrl: cleanUrl,
                        thumbnailDataUrl: cleanUrl,
                        storageProvider: 'firestore_chunked',
                        fileName: 'portrait.jpg',
                        fileMimeType: 'image/jpeg',
                        linkedPersonIds: [targetPid],
                        enhanced: false,
                        createdAt: new Date().toISOString(),
                      };
                      const nextVaultItems = [newVaultPhoto, ...vaultItems];
                      setVaultItems(nextVaultItems);
                      saveUserVaultArchive(
                        userId,
                        result.familyName,
                        {
                          folders: vaultFolders,
                          items: nextVaultItems,
                        },
                        userEmail
                      ).catch(() => {});
                    }
                  }
                  setPhotoPickerNodeId(null);
                }}
                className="px-5 py-2 rounded-xl bg-[#D8755B] text-white text-xs font-display font-bold cursor-pointer"
              >
                حفظ الصورة ✓
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 5. GENTLE NODE DELETE CONFIRMATION & ORPHAN-LINK CLEANUP MODAL       */}
      {/* ==================================================================== */}
      {pendingDeletePrompt && (
        <div
          data-testid="gentle-delete-node-modal"
          className="fixed inset-0 z-[75] bg-[#252321]/65 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            dir="rtl"
            className="bg-white border-2 border-[#D8755B] rounded-3xl max-w-md w-full p-6 space-y-4 text-right shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#B98A78]/30 pb-3">
              <h4 className="text-base font-display font-extrabold text-[#252321]">
                تأكيد حذف الفرد من المشجرة
              </h4>
              <button
                type="button"
                onClick={() => setPendingDeletePrompt(null)}
                className="w-7 h-7 rounded-lg bg-[#F7F2E9] flex items-center justify-center text-[#252321] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-[#252321]/85 leading-relaxed">
              هل تود حذف{' '}
              <strong>«{pendingDeletePrompt.person.firstName}»</strong> من مشجرة العائلة نهائياً؟
            </p>

            {pendingDeletePrompt.descendantNodes.length > 0 && (
              <div
                data-testid="cascade-delete-warning-box"
                className="rounded-2xl bg-red-50 border-2 border-red-400 p-3.5 text-xs text-red-950 leading-relaxed space-y-2"
              >
                <div className="font-display font-extrabold text-red-800 flex items-center gap-1.5">
                  <span>⚠️</span>
                  <span>
                    تنبيه صارم: حذف كامل لجميع الفروع والأبناء التابعين (
                    {pendingDeletePrompt.descendantNodes.length} فرداً)
                  </span>
                </div>
                <p className="font-semibold">
                  بحذفك لعقدة{' '}
                  <strong>«{pendingDeletePrompt.person.firstName}»</strong>، سيتم
                  حذف <strong>جميع عقد الفروع والأبناء التابعة لها بالكامل</strong>{' '}
                  ولن تبقى أي عقدة منها بشكل مستقل في المشجرة:
                </p>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {pendingDeletePrompt.descendantNodes
                    .slice(0, 8)
                    .map((desc) => (
                      <span
                        key={desc.id}
                        className="px-2 py-0.5 rounded-md bg-white border border-red-200 text-red-900 text-[11px] font-bold"
                      >
                        {desc.firstName}
                      </span>
                    ))}
                  {pendingDeletePrompt.descendantNodes.length > 8 && (
                    <span className="px-2 py-0.5 rounded-md bg-red-100 text-red-900 text-[11px] font-bold">
                      +{pendingDeletePrompt.descendantNodes.length - 8} آخرين
                    </span>
                  )}
                </div>
                {pendingDeletePrompt.isProtectedSpineAncestor && (
                  <p className="text-[11px] text-red-900/90 border-t border-red-200 pt-1.5">
                    ملاحظة: عمود النسب المباشر المتصل بأمين السجل يبقى محفوظاً وموصولاً تلقائياً، بينما تُحذف الفروع الجانبية التابعة لهذه العقدة بالكامل.
                  </p>
                )}
              </div>
            )}

            {pendingDeletePrompt.linkedDocsCount > 0 && (
              <div className="rounded-2xl bg-[#FAF6F0] border border-[#D4AF37] p-3.5 text-xs text-[#252321] leading-relaxed space-y-1">
                <div className="font-display font-extrabold text-[#8D4925]">
                  📎 تنبيه بخصوص الوثائق والصور المرتبطة ({pendingDeletePrompt.linkedDocsCount}):
                </div>
                <p>
                  سيتم تلقائياً فك ارتباط الأفراد المحذوفين من ({pendingDeletePrompt.linkedDocsCount}) وثيقة/صورة لمنع أي روابط يتيمة، مع بقاء الوثائق والصور نفسها محفوظة بأمان تام داخل «خزانتي».
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPendingDeletePrompt(null)}
                className="px-4 py-2 rounded-xl bg-[#F7F2E9] text-xs font-bold text-[#252321] cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                data-testid="confirm-delete-tree-node-btn"
                onClick={handleConfirmDeleteNode}
                className="px-5 py-2.5 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-display font-extrabold cursor-pointer"
              >
                {pendingDeletePrompt.descendantNodes.length > 0
                  ? `تأكيد الحذف الكامل (${pendingDeletePrompt.descendantNodes.length + 1} عقدة)`
                  : 'تأكيد الحذف وفك الارتباط'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 6. QUICK VAULT MEDIA PREVIEW MODAL ON TREE CARD (`معاينة سريعة`)     */}
      {/* ==================================================================== */}
      {quickVaultPreviewPersonId &&
        (() => {
          const isDirectFamilyPreview =
            quickVaultPreviewPersonId === DIRECT_FAMILY_VAULT_NODE_ID;
          const previewPerson = isDirectFamilyPreview
            ? null
            : findPerson(quickVaultPreviewPersonId);
          if (!isDirectFamilyPreview && !previewPerson) return null;

          const resolvedPreviewId = isDirectFamilyPreview
            ? DIRECT_FAMILY_VAULT_NODE_ID
            : previewPerson!.id;
          const resolvedPreviewLabel = isDirectFamilyPreview
            ? `العائلة (${cleanNaturalSpineName(result.familyName)})`
            : previewPerson!.firstName;

          const personMediaList = vaultItems.filter((vi) =>
            vi.linkedPersonIds.includes(resolvedPreviewId)
          );
          const unlinkedForPreview = vaultItems.filter(
            (vi) => !vi.linkedPersonIds.includes(resolvedPreviewId)
          );

          return (
            <div
              data-testid="tree-quick-vault-preview-modal"
              className="fixed inset-0 z-[75] bg-[#252321]/65 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
              role="dialog"
              aria-modal="true"
            >
              <div
                dir="rtl"
                className="bg-[#FFFDF9] border-2 border-[#D4AF37] rounded-3xl max-w-xl w-full p-5 sm:p-6 space-y-4 text-right shadow-2xl my-8 max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-start justify-between gap-3 border-b border-[#B98A78]/30 pb-3">
                  <div>
                    <div className="text-[11px] font-bold text-[#8D4925]">
                      📂 وثائق وصور هذا الفرد في خزانتي ({personMediaList.length})
                    </div>
                    <h4 className="text-base font-display font-extrabold text-[#252321]">
                      وثائق وصور «{resolvedPreviewLabel}»
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setQuickVaultPreviewPersonId(null)}
                    className="w-8 h-8 rounded-xl bg-[#F7F2E9] hover:bg-[#EDE6DA] flex items-center justify-center text-[#252321] cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {personMediaList.length === 0 ? (
                  <div className="rounded-xl bg-white border border-[#B98A78]/35 p-3.5 text-xs text-[#252321]/75">
                    لا توجد صور أو وثائق مربوطة بـ «{resolvedPreviewLabel}» حالياً. يمكنك رفع صورة أو وثيقة جديدة أدناه أو ربط ملف موجود من «خزانتي».
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-2.5 pr-0.5">
                    {personMediaList.map((media) => {
                      const thumbSrc =
                        media.thumbnailDataUrl || media.fileDataUrl;
                      const showImg =
                        media.mediaType === 'photo' ||
                        thumbSrc.startsWith('data:image');
                      return (
                        <div
                          key={media.id}
                          className="rounded-2xl bg-white border border-[#B98A78]/45 p-2.5 flex items-center justify-between gap-3 shadow-2xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-12 h-12 rounded-xl bg-[#FAF6F0] border border-[#B98A78]/35 overflow-hidden shrink-0 flex items-center justify-center">
                              {showImg ? (
                                <img
                                  src={thumbSrc}
                                  alt={media.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <FileText className="w-5 h-5 text-[#8D4925]" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs sm:text-sm font-display font-extrabold text-[#252321] truncate">
                                {media.title}
                              </div>
                              <div className="text-[11px] text-[#8D4925] font-semibold">
                                {media.mediaType === 'photo'
                                  ? '📸 صورة'
                                  : '📜 وثيقة'}{' '}
                                · {media.dateOrOccasion}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleVaultItemForModalPerson(
                                media.id,
                                resolvedPreviewId
                              )
                            }
                            className="px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-[10px] font-bold shrink-0 cursor-pointer"
                          >
                            فك الربط
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Direct 1-Click Upload into Vault Linked to This Node */}
                <div className="rounded-2xl bg-white border border-[#B98A78]/45 p-3.5 space-y-2.5">
                  <div className="text-xs font-display font-bold text-[#8D4925]">
                    + رفع صورة أو وثيقة جديدة وربطها تلقائياً بـ «{resolvedPreviewLabel}»:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={treeVaultUploadTitle}
                      onChange={(e) => setTreeVaultUploadTitle(e.target.value)}
                      placeholder="عنوان الصورة أو الوثيقة..."
                      className="px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#B98A78]/45 text-xs text-[#252321]"
                    />
                    <select
                      value={treeVaultUploadFolderId}
                      onChange={(e) =>
                        setTreeVaultUploadFolderId(e.target.value)
                      }
                      className="px-2.5 py-2 rounded-xl bg-[#FAF6F0] border border-[#B98A78]/45 text-xs font-bold text-[#252321]"
                    >
                      {vaultFolders.map((vf) => (
                        <option key={vf.id} value={vf.id}>
                          {vf.icon} {vf.name}
                        </option>
                      ))}
                    </select>
                    <label className="px-3 py-2 rounded-xl bg-[#252321] hover:bg-[#8D4925] text-[#FEF3C7] text-xs font-display font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      <span>
                        {isUploadingToVaultFromTree
                          ? 'جاري الحفظ...'
                          : 'اختيار ملف ورفعه'}
                      </span>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        disabled={isUploadingToVaultFromTree}
                        className="hidden"
                        onChange={async (e) => {
                          const files = e.target.files;
                          await handleUploadFileDirectlyToVaultFromTree(
                            files,
                            resolvedPreviewId
                          );
                          e.target.value = '';
                          setQuickVaultPreviewPersonId(null);
                        }}
                      />
                    </label>
                  </div>
                </div>

                {unlinkedForPreview.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-display font-bold text-[#252321] flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-[#D8755B]" />
                      <span>أو اربط ملفاً موجوداً في «خزانتي»:</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {unlinkedForPreview.map((uv) => (
                        <button
                          key={uv.id}
                          type="button"
                          onClick={() =>
                            handleToggleVaultItemForModalPerson(
                              uv.id,
                              resolvedPreviewId
                            )
                          }
                          className="px-2.5 py-1 rounded-full bg-white hover:bg-[#252321] text-[#252321] hover:text-[#FEF3C7] border border-[#B98A78]/45 text-[11px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <span>{uv.mediaType === 'photo' ? '📸' : '📜'}</span>
                          <span>+ {uv.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-3 border-t border-[#B98A78]/30 flex flex-wrap items-center justify-between gap-2">
                  {previewPerson ? (
                    <button
                      type="button"
                      onClick={() => {
                        const targetP = previewPerson;
                        setQuickVaultPreviewPersonId(null);
                        openEditPersonModal(targetP);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-[#FAF6F0] hover:bg-[#EDE6DA] border border-[#B98A78]/50 text-xs font-display font-bold text-[#252321] cursor-pointer"
                    >
                      تعديل بطاقة الفرد الكاملة
                    </button>
                  ) : (
                    <span />
                  )}

                  <div className="flex items-center gap-2">
                    {onOpenVaultForPerson && (
                      <button
                        type="button"
                        data-testid="jump-to-vault-filtered-by-person-btn"
                        onClick={() => {
                          setQuickVaultPreviewPersonId(null);
                          onOpenVaultForPerson(resolvedPreviewId);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-[#252321] hover:bg-[#8D4925] text-[#FEF3C7] text-xs font-display font-extrabold cursor-pointer transition-colors"
                      >
                        عرض وفلترة في خزانتي ←
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setQuickVaultPreviewPersonId(null)}
                      className="px-4 py-2 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-display font-extrabold cursor-pointer"
                    >
                      تم ✓
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      {/* ==================================================================== */}
      {/* 6B. KINSHIP PATH CALCULATOR MODAL (`صلة القرابة بين فردين ✦`)         */}
      {/* ==================================================================== */}
      <TreeKinshipCalculatorModal
        isOpen={showKinshipModal}
        onClose={() => setShowKinshipModal(false)}
        people={visiblePeopleForTree}
        personAId={kinshipPersonAId}
        personBId={kinshipPersonBId}
        onChangePersonA={setKinshipPersonAId}
        onChangePersonB={setKinshipPersonBId}
        result={kinshipPathResult}
        isPathHighlightedOnCanvas={isKinshipHighlightedOnCanvas}
        onApplyHighlightOnCanvas={() => {
          setIsKinshipHighlightedOnCanvas(true);
          setShowKinshipModal(false);
          if (kinshipPathResult?.commonAncestor) {
            handleSpotlightPerson(kinshipPathResult.commonAncestor.id);
          } else if (kinshipPersonAId) {
            handleSpotlightPerson(kinshipPersonAId);
          }
        }}
        onClearHighlightOnCanvas={() => {
          setIsKinshipHighlightedOnCanvas(false);
        }}
      />

      {/* ==================================================================== */}
      {/* 7. OFFICIAL BRANDED EXPORT MODAL (PDF / HIGH-RES PNG)                */}
      {/* ==================================================================== */}
      <OfficialBrandedExportModal
        isOpen={showOfficialExportModal}
        onClose={() => setShowOfficialExportModal(false)}
        exportKind="family_tree"
        result={result}
        accountType={accountType}
        caps={caps}
        userId={userId}
        unlockedCapsules={unlockedCapsules}
        femalePrivacyHidden={
          treeDisplaySettings.femalePrivacyMode === 'hide_females' ||
          isInvitedGuestHideFemales
        }
        posterOptions={{
          poster: treeDisplaySettings.poster,
          theme: activeTreeTheme,
          fontFamily: treeDisplaySettings.fontFamily,
          layoutLabel:
            treeDisplaySettings.layoutOrientation === 'fan_180'
              ? 'مروحة الأنساب 180°'
              : treeDisplaySettings.layoutOrientation === 'radial_360'
              ? 'الهالة الدائرية 360°'
              : treeDisplaySettings.layoutOrientation === 'sideways'
              ? 'عرض جانبي أفقي'
              : 'عرض عمودي متدرج',
          verificationUrl: familyInviteUrl,
        }}
        treeMembers={people
          .filter(
            (p) =>
              !(
                (treeDisplaySettings.femalePrivacyMode === 'hide_females' ||
                  isInvitedGuestHideFemales) &&
                p.gender === 'female'
              )
          )
          .filter((p) => {
            if (treeDisplaySettings.vitalStatusFilter === 'living') {
              return p.vitalStatus !== 'deceased';
            }
            if (treeDisplaySettings.vitalStatusFilter === 'deceased') {
              return p.vitalStatus === 'deceased';
            }
            return true;
          })
          .map((p): ExportTreeMemberSummary => {
            const disp = getCleanCardDisplay(p);
            const metaBits: string[] = [];
            if (p.birthDateValue?.trim()) {
              const formatted = formatTreeDateByCalendarMode(
                p.birthDateValue,
                p.birthCalendar,
                treeDisplaySettings.calendarDisplayMode
              );
              if (formatted) metaBits.push(formatted);
            }
            if (
              p.vitalStatus === 'deceased' &&
              treeDisplaySettings.showDeceasedDignityFrame
            ) {
              metaBits.push(p.gender === 'female' ? 'رحمها الله' : 'رحمه الله');
            }
            return {
              id: p.id,
              displayName: disp.mainName,
              relationLabel: p.isRecordKeeper
                ? 'أمين السجل'
                : p.relationToTargetLabel || 'فرد في المشجرة',
              generationLevel: p.generationLevel,
              metaLine: metaBits.join(' · '),
              isRecordKeeper: p.isRecordKeeper,
              isCertifiedReference: false,
            };
          })}
        onUnlockRoot5Usd={onUnlockRoot5Usd}
        onUpgradeAnnualVip={onUpgradeAnnualVip}
        onSignCharterAndEnableTree={onSignCharterAndEnableTree}
        onLogExport={(fmt, verId) =>
          onLogActivity(
            'تصدير مشجرة العائلة الموثقة',
            `تصدير شجرة عائلة ${result.familyName} بصيغة (${fmt}) · معرّف التحقق ${verId}`
          )
        }
      />
    </div>
  );
};
