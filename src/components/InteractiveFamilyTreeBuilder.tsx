import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowUp,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Copy,
  Crown,
  Download,
  Edit2,
  FileSignature,
  FileText,
  Heart,
  Link2,
  Loader2,
  Lock,
  MapPin,
  Paperclip,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  Users,
  Wallet,
  X,
  ZoomIn,
  ZoomOut,
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
  fetchUserVaultArchive,
  getTreeStorageKeyForVaultSync,
  readUserFamilyTreeFromLocal,
  readVaultArchiveFromLocal,
  saveUserFamilyTreeToFirebase,
  saveUserFamilyTreeToLocal,
  saveUserVaultArchive,
  uploadTreeNodeAvatarWithFallback,
} from '../services/firestoreService';
import {
  processMediaFileForUpload,
  uploadMediaToCloudWithFallback,
} from '../utils/mediaPipeline';
import { OfficialBrandedExportModal } from './OfficialBrandedExportModal';
import { ExportTreeMemberSummary } from '../utils/brandedExport';

export type ArabicHonorificTitle =
  | 'بدون'
  | 'الشيخ'
  | 'الشريف'
  | 'الأمير'
  | 'الحاج'
  | 'الدكتور'
  | 'المهندس'
  | 'العميد'
  | 'النسّابة';

export const ARABIC_HONORIFIC_TITLES: ArabicHonorificTitle[] = [
  'بدون',
  'الشيخ',
  'الشريف',
  'الأمير',
  'الحاج',
  'الدكتور',
  'المهندس',
  'العميد',
  'النسّابة',
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
  motherNameFallback?: string;
  spouseIds: string[];
  vitalStatus: 'unspecified' | 'living' | 'deceased';
  birthPrecision: 'year_only' | 'full_date';
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
  userAvatarUrl,
  userId,
  userEmail,
  onOpenVaultForPerson,
  onRequestReferenceCorrectionTicket,
}) => {
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
          setLastSavedLabel(
            new Date().toLocaleTimeString('ar-SA', {
              hour: '2-digit',
              minute: '2-digit',
            })
          );
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
        setLastSavedLabel(
          new Date().toLocaleTimeString('ar-SA', {
            hour: '2-digit',
            minute: '2-digit',
          })
        );
      })
      .catch(() => {
        if (!cancelled) setTreeSaveState('local_only');
      });

    return () => {
      cancelled = true;
    };
  }, [people, userId, userEmail, result.familyName]);

  const handleManualSaveTree = async () => {
    setTreeSaveState('saving');
    const wrote = await saveUserFamilyTreeToFirebase(
      userId || '',
      result.familyName,
      people,
      userEmail
    );
    setTreeSaveState(wrote ? 'saved' : 'local_only');
    setLastSavedLabel(
      new Date().toLocaleTimeString('ar-SA', {
        hour: '2-digit',
        minute: '2-digit',
      })
    );
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

  const familyInviteUrl = useMemo(() => {
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://juthori.com';
    return `${origin}/?inviteTree=${familyTreeShareId}&family=${encodeURIComponent(
      result.familyName || ''
    )}&role=${inviteRoleMode}`;
  }, [familyTreeShareId, result.familyName, inviteRoleMode]);

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
          ? `العائلة المباشرة (${cleanNaturalSpineName(result.familyName)})`
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
  const [formMotherId, setFormMotherId] = useState<string>('');
  const [formVitalStatus, setFormVitalStatus] = useState<
    'unspecified' | 'living' | 'deceased'
  >('unspecified');
  const [formBirthPrecision, setFormBirthPrecision] = useState<
    'year_only' | 'full_date'
  >('year_only');
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
  const [showMoreBioSection, setShowMoreBioSection] = useState(false);
  const [formError, setFormError] = useState('');

  const findPerson = (id?: string) => people.find((p) => p.id === id);

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

  const openAddRelativeModal = (
    targetNode: InteractiveTreePerson,
    relationKind: RelativeRelationKind
  ) => {
    setRadialTargetNodeId(null);

    // 1. Strict Charter Gate: Must sign Record Keeper Charter (`ميثاق أمين السجل`) before adding ANY node!
    if (!isRecordKeeperCharterSigned) {
      onSignCharterAndEnableTree();
      return;
    }

    // 2. Strict 3-Zone Genealogical Boundaries:
    // - Zone 2 (generationLevel > 7: ما قبل الجد الخامس حتى الجذر): ONLY upward vertical ancestor links allowed!
    if (
      targetNode.generationLevel > FIFTH_GRANDFATHER_LEVEL &&
      relationKind !== 'vertical_ancestor'
    ) {
      return;
    }
    // - Boundary of 5th Grandfather (generationLevel === 7): upward link is strictly vertical (`vertical_ancestor`),
    //   no horizontal siblings or mother of 5th grandfather (since level 8 is vertical-only).
    if (
      targetNode.generationLevel === FIFTH_GRANDFATHER_LEVEL &&
      (relationKind === 'mother' ||
        relationKind === 'brother' ||
        relationKind === 'sister')
    ) {
      return;
    }
    const resolvedRelationKind: RelativeRelationKind =
      targetNode.generationLevel >= FIFTH_GRANDFATHER_LEVEL &&
      relationKind === 'father'
        ? 'vertical_ancestor'
        : relationKind;

    setFormError('');

    const isFemaleRelation =
      resolvedRelationKind === 'mother' ||
      resolvedRelationKind === 'sister' ||
      resolvedRelationKind === 'daughter' ||
      (resolvedRelationKind === 'spouse' && targetNode.gender === 'male');

    // Zero Fabrication: Never pre-fill kunya, honorific, dates, places, or vitalStatus!
    setFormGender(isFemaleRelation ? 'female' : 'male');
    setFormFirstName('');
    setFormFamilyName('');
    setFormKunya('');
    setFormHonorific('بدون');

    let candidateWives: InteractiveTreePerson[] = [];
    if (resolvedRelationKind === 'son' || resolvedRelationKind === 'daughter') {
      const fatherNode =
        targetNode.gender === 'male'
          ? targetNode
          : targetNode.spouseIds.length > 0
          ? findPerson(targetNode.spouseIds[0])
          : undefined;
      if (fatherNode) {
        candidateWives = fatherNode.spouseIds
          .map((id) => findPerson(id))
          .filter((w): w is InteractiveTreePerson => Boolean(w));
      }
    } else if (
      resolvedRelationKind === 'brother' ||
      resolvedRelationKind === 'sister'
    ) {
      const fatherNode = targetNode.fatherId
        ? findPerson(targetNode.fatherId)
        : undefined;
      if (fatherNode) {
        candidateWives = fatherNode.spouseIds
          .map((id) => findPerson(id))
          .filter((w): w is InteractiveTreePerson => Boolean(w));
      }
      if (
        targetNode.motherId &&
        !candidateWives.some((w) => w.id === targetNode.motherId)
      ) {
        const directMom = findPerson(targetNode.motherId);
        if (directMom) candidateWives.unshift(directMom);
      }
    }
    setFormMotherId(candidateWives[0]?.id || '');

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
    setShowMoreBioSection(false);
    setNewPersonPendingVaultIds([]);
    pendingVaultIdsRef.current = new Set();

    setModalConfig({
      mode: 'add',
      targetNodeId: targetNode.id,
      relationKind: resolvedRelationKind,
    });
  };

  const openAddBridgeAboveFamilyModal = (
    relationKind: 'bridge_above_family' | 'horizontal_branch_above_family',
    targetBridgeTier: number
  ) => {
    setRadialTargetNodeId(null);
    if (!isRecordKeeperCharterSigned) {
      onSignCharterAndEnableTree();
      return;
    }

    setFormError('');
    setFormGender('male');
    setFormFirstName('');
    setFormFamilyName('');
    setFormKunya('');
    setFormHonorific('بدون');
    setFormMotherId('');
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
    setShowMoreBioSection(false);
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

    if (!isRecordKeeperCharterSigned) {
      onSignCharterAndEnableTree();
      return;
    }

    setFormError('');
    setFormGender(person.gender);
    setFormFirstName(person.firstName);
    setFormFamilyName('');
    setFormKunya(person.kunya || '');
    setFormHonorific(person.honorificTitle || 'بدون');
    setFormMotherId(person.motherId || '');
    setFormVitalStatus(person.vitalStatus || 'unspecified');
    setFormBirthPrecision(person.birthPrecision);
    setFormBirthCalendar(person.birthCalendar);
    setFormBirthDate(person.birthDateValue || '');
    setFormBirthPlace(person.birthPlace || '');
    setFormDeathDate(person.deathDateValue || '');
    setFormDeathPlace(person.deathPlace || '');
    setFormFemalePrivacyMasked(person.femalePrivacyMasked);
    setFormContactInfo(person.contactInfo || '');
    setFormBiography(person.biography || '');
    setFormAttachedDocName(person.attachedDocName || '');
    setFormPhotoUrl(person.photoUrl || '');
    setShowMoreBioSection(Boolean(person.biography || person.attachedDocName));

    setModalConfig({
      mode: 'edit',
      targetNodeId: person.id,
      editPersonId: person.id,
    });
  };

  const modalMeta = useMemo(() => {
    if (!modalConfig) return null;

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
            : `إضافة عقدة فوق العائلة المباشرة (${cleanFam}) نحو الجذر`,
        subtitle: `نطاق الوصل بين العائلة المباشرة والجذر · شجرة عائلة ${result.familyName}`,
        showMotherSelector: false,
        motherOptions: [] as InteractiveTreePerson[],
      };
    }

    const target = findPerson(modalConfig.targetNodeId);
    if (!target) return null;

    if (modalConfig.mode === 'edit') {
      return {
        title: `تعديل بيانات «${target.firstName}»`,
        subtitle: `شجرة عائلة ${result.familyName}`,
        showMotherSelector: false,
        motherOptions: [] as InteractiveTreePerson[],
      };
    }

    const rel = modalConfig.relationKind!;
    const nextUpwardLabel = getNextVerticalGrandfatherLabel(
      target.generationLevel + 1
    );
    const relationTitleMap: Record<RelativeRelationKind, string> = {
      father: `إضافة (${nextUpwardLabel}) لـ ${target.firstName}`,
      mother: `إضافة الأم لـ ${target.firstName}`,
      vertical_ancestor: `إضافة حلقة عمودية نحو الجذر (${nextUpwardLabel})`,
      bridge_above_family: `إضافة عقدة فوق العائلة المباشرة نحو الجذر`,
      horizontal_branch_above_family: `إضافة فرع أفقي فوق العائلة المباشرة وحتى الجذر`,
      spouse: `إضافة زوجة / شريك لـ ${target.firstName}`,
      brother: `إضافة أخ لـ ${target.firstName}`,
      sister: `إضافة أخت لـ ${target.firstName}`,
      son: `إضافة ابن لـ ${target.firstName}`,
      daughter: `إضافة ابنة لـ ${target.firstName}`,
    };

    const showMotherSelector =
      rel === 'son' ||
      rel === 'daughter' ||
      rel === 'brother' ||
      rel === 'sister';

    let motherOptions: InteractiveTreePerson[] = [];
    if (rel === 'son' || rel === 'daughter') {
      const father =
        target.gender === 'male'
          ? target
          : target.spouseIds.length > 0
          ? findPerson(target.spouseIds[0])
          : undefined;
      if (father) {
        motherOptions = father.spouseIds
          .map((id) => findPerson(id))
          .filter((w): w is InteractiveTreePerson => Boolean(w));
      }
    } else if (rel === 'brother' || rel === 'sister') {
      const father = target.fatherId ? findPerson(target.fatherId) : undefined;
      if (father) {
        motherOptions = father.spouseIds
          .map((id) => findPerson(id))
          .filter((w): w is InteractiveTreePerson => Boolean(w));
      }
      if (
        target.motherId &&
        !motherOptions.some((m) => m.id === target.motherId)
      ) {
        const targetMom = findPerson(target.motherId);
        if (targetMom) motherOptions.unshift(targetMom);
      }
    }

    return {
      title: relationTitleMap[rel],
      subtitle: `شجرة عائلة ${result.familyName}`,
      showMotherSelector,
      motherOptions,
    };
  }, [modalConfig, people, result.familyName]);

  const handleSavePersonModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalConfig) return;

    if (!isRecordKeeperCharterSigned) {
      setModalConfig(null);
      onSignCharterAndEnableTree();
      return;
    }

    const cleanFirst = formFirstName.trim();
    if (!cleanFirst) {
      setFormError('يرجى إدخال الاسم المسجل في الحقل العلوي لحفظ الفرد في الشجرة');
      modalScrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      nameInputRef.current?.focus();
      return;
    }

    if (modalConfig.mode === 'edit' && modalConfig.editPersonId) {
      setPeople((prev) => {
        const updated = prev.map((p) => {
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
            gender: isVerticalOnly ? 'male' : formGender,
            motherId: isVerticalOnly ? undefined : formMotherId || p.motherId,
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
            photoUrl: formPhotoUrl.trim() || p.photoUrl,
            photoThumbnailUrl: formPhotoUrl.trim() || p.photoThumbnailUrl,
          };
        });

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

        return updated;
      });

      onLogActivity(
        'تحديث بيانات فرد في شجرتي',
        `تم تعديل بيانات «${cleanFirst}» في شجرة الأسرة`
      );
      setModalConfig(null);
      return;
    }

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

    const newId = `node-${Date.now()}`;

    let nextGenLevel = target ? target.generationLevel : 8;
    let isDirectSpineLineage = false;
    let relationLabel = '';
    let assignedFatherId: string | undefined;
    let assignedMotherId: string | undefined = formMotherId || undefined;
    let assignedSpouseIds: string[] = [];

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
      isDirectSpineLineage = Boolean(target.isDirectSpineLineage);
      relationLabel = getNextVerticalGrandfatherLabel(nextGenLevel);
      if (nextGenLevel <= FIFTH_GRANDFATHER_LEVEL && target.motherId) {
        assignedSpouseIds = [target.motherId];
      }
      assignedMotherId = undefined;
    } else if (target && rel === 'mother') {
      nextGenLevel = target.generationLevel + 1;
      relationLabel = `والدة ${target.firstName}`;
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
      assignedMotherId = formMotherId || target.motherId;
    } else if (target && (rel === 'son' || rel === 'daughter')) {
      nextGenLevel = target.generationLevel - 1;
      relationLabel =
        rel === 'son' ? `ابن ${target.firstName}` : `ابنة ${target.firstName}`;
      if (target.gender === 'male') {
        assignedFatherId = target.id;
        assignedMotherId = formMotherId || target.spouseIds[0];
      } else {
        assignedMotherId = target.id;
        assignedFatherId = target.spouseIds[0];
      }
    }

    const effectiveGender: 'male' | 'female' =
      isAddingBridgeAboveFamily || nextGenLevel > FIFTH_GRANDFATHER_LEVEL
        ? 'male'
        : formGender;

    const newPerson: InteractiveTreePerson = {
      id: newId,
      firstName: cleanFirst,
      familyName: '',
      kunya: formKunya.trim(),
      honorificTitle: formHonorific,
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
      spouseIds:
        isAddingBridgeAboveFamily || nextGenLevel > FIFTH_GRANDFATHER_LEVEL
          ? []
          : assignedSpouseIds,
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

    // Tier Quota Check BEFORE mutating `people` — preserves all entered form fields!
    const willCreateSharedFather =
      !isAddingBridgeAboveFamily &&
      target &&
      (rel === 'brother' || rel === 'sister') &&
      !target.fatherId;
    const nodesToAddCount = willCreateSharedFather ? 2 : 1;
    if (
      caps.maxTreeMembers !== null &&
      people.length + nodesToAddCount > caps.maxTreeMembers
    ) {
      setQuotaUpgradePrompt({
        kind: 'tree_members',
        currentCount: people.length,
        maxAllowed: caps.maxTreeMembers,
      });
      return;
    }

    // Synchronously pre-register `newPerson` in Vault summary cache BEFORE `saveUserVaultArchive` fires `juthori:vault-updated`
    if (typeof window !== 'undefined') {
      try {
        const syncKey = getTreeStorageKeyForVaultSync(userId, result.familyName);
        const preSyncedList = ensureDirectFamilyInVaultSummaries(
          [...people, newPerson].map((p) => ({
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

    setPeople((prev) => {
      let updated = [...prev];

      if (
        !isAddingBridgeAboveFamily &&
        target &&
        (rel === 'brother' || rel === 'sister') &&
        !target.fatherId
      ) {
        const autoFatherId = `node-father-shared-${Date.now()}`;
        const inferredFatherName =
          parseInitialRegistrationAncestors(result.fatherName).fatherFirst ||
          `والد ${target.firstName}`;
        const sharedFather: InteractiveTreePerson = {
          id: autoFatherId,
          firstName: inferredFatherName,
          familyName: '',
          kunya: '',
          honorificTitle: 'بدون',
          gender: 'male',
          generationLevel: target.generationLevel + 1,
          isDirectSpineLineage: Boolean(target.isDirectSpineLineage),
          relationToTargetLabel: getNextVerticalGrandfatherLabel(
            target.generationLevel + 1
          ),
          spouseIds: target.motherId ? [target.motherId] : [],
          vitalStatus: 'unspecified',
          birthPrecision: 'year_only',
          birthCalendar: 'hijri',
          birthDateValue: '',
          birthPlace: '',
          femalePrivacyMasked: false,
        };
        newPerson.fatherId = autoFatherId;
        updated = updated.map((p) =>
          p.id === target.id ? { ...p, fatherId: autoFatherId } : p
        );
        updated.push(sharedFather);
      }

      if (!isAddingBridgeAboveFamily && target) {
        updated = updated.map((p) => {
          if (
            (rel === 'father' || rel === 'vertical_ancestor') &&
            p.id === target.id
          ) {
            return { ...p, fatherId: newId };
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

      const finalList = [...updated, newPerson];

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

      return finalList;
    });

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
      `تمت إضافة «${cleanFirst}» (${relationLabel})`
    );
    setModalConfig(null);
  };

  // ============================================================================
  // SAFE NODE DELETION WITH GENTLE CONFIRMATION & ATOMIC VAULT ORPHAN CLEANUP
  // ============================================================================
  const handleDeleteNode = (person: InteractiveTreePerson) => {
    if (!isRecordKeeperCharterSigned) {
      onSignCharterAndEnableTree();
      return;
    }
    if (person.isRecordKeeper) return;

    const linkedDocsCount = vaultItems.filter((vi) =>
      vi.linkedPersonIds.includes(person.id)
    ).length;

    setPendingDeletePrompt({
      person,
      linkedDocsCount,
    });
  };

  const handleConfirmDeleteNode = async () => {
    if (!pendingDeletePrompt) return;
    const { person, linkedDocsCount } = pendingDeletePrompt;
    setPendingDeletePrompt(null);

    if (person.isRecordKeeper) return;

    // Bridge upward `fatherId` if deleting an intermediate direct-spine ancestor so upper links stay connected
    const bridgedFatherId = person.isDirectSpineLineage
      ? person.fatherId
      : undefined;

    let nextPeople = people
      .filter((p) => p.id !== person.id)
      .map((p) => ({
        ...p,
        fatherId:
          p.fatherId === person.id
            ? p.isDirectSpineLineage
              ? bridgedFatherId
              : undefined
            : p.fatherId,
        motherId: p.motherId === person.id ? undefined : p.motherId,
        spouseIds: p.spouseIds.filter((s) => s !== person.id),
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

    // Atomically scrub `person.id` from all vault items (`linkedPersonIds`) so zero Orphaned IDs remain
    const hadAnyVaultReferences = vaultItems.some((vi) =>
      vi.linkedPersonIds.includes(person.id)
    );
    if (hadAnyVaultReferences) {
      const cleanedVaultItems = vaultItems.map((vi) =>
        vi.linkedPersonIds.includes(person.id)
          ? {
              ...vi,
              linkedPersonIds: vi.linkedPersonIds.filter(
                (pid) => pid !== person.id
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
      'حذف عقدة من شجرتي وتنظيف الروابط',
      linkedDocsCount > 0
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
      person.honorificTitle && person.honorificTitle !== 'بدون'
        ? `${person.honorificTitle} `
        : '';

    const isMaskedFemale =
      person.gender === 'female' && person.femalePrivacyMasked;

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

  const cleanNaturalSpineName = (rawName: string): string =>
    rawName
      .replace(/^(القبيلة الأم|الفرع الجامع|العائلة المباشرة)\s*:\s*/u, '')
      .replace(/^(من قبيلة|قبيلة|قبائل|فرع|عائلة)\s+/u, '')
      .trim();

  const renderFamilyStationCard = () => {
    const station1Node = spineNodes[0];
    const directFamilyMediaCount = vaultItems.filter((vi) =>
      vi.linkedPersonIds.includes(DIRECT_FAMILY_VAULT_NODE_ID)
    ).length;

    return (
      <div className="max-w-[420px] w-full mx-auto rounded-2xl bg-gradient-to-r from-purple-50/95 via-white to-purple-50/95 border-2 border-[#7C3AED]/55 py-3 px-4 shadow-xs relative z-10 text-right">
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
                {cleanNaturalSpineName(result.familyName)}
              </div>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-[#7C3AED] bg-white px-2.5 py-1 rounded-lg border border-[#7C3AED]/30 shrink-0">
            بيت النسب
          </span>
        </div>

        <div className="mt-2.5 pt-2 border-t border-[#7C3AED]/20 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            data-testid="tree-direct-family-vault-btn"
            onClick={() =>
              setQuickVaultPreviewPersonId(DIRECT_FAMILY_VAULT_NODE_ID)
            }
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white hover:bg-[#FAF6F0] border border-[#7C3AED]/35 hover:border-[#D8755B] text-[11px] font-display font-extrabold text-[#252321] transition-colors cursor-pointer shadow-2xs"
          >
            <span>📂 وثائق وصور هذا الفرد في خزانتي</span>
            <span className="px-1.5 py-0.5 rounded-full bg-[#FEF3C7] border border-[#D4AF37]/60 text-[#8D4925] text-[10px]">
              {directFamilyMediaCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              openAddBridgeAboveFamilyModal('horizontal_branch_above_family', 0)
            }
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#FAF6F0] hover:bg-white border border-dashed border-[#7C3AED]/55 hover:border-[#D8755B] text-[11px] font-display font-bold text-[#7C3AED] hover:text-[#D8755B] cursor-pointer transition-colors"
          >
            <Plus className="w-3 h-3" />
            <span>إضافة فرع أفقي</span>
          </button>
        </div>
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

        {/* Horizontal Add Bar Directly Above `العائلة المباشرة` up to `الجذر` */}
        <div
          data-testid="above-direct-family-add-bar"
          className="my-1.5 flex flex-wrap items-center justify-center gap-2.5 relative z-20"
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
            <span>إضافة فوق العائلة المباشرة نحو الجذر</span>
          </button>

          <button
            type="button"
            data-testid="add-above-family-horizontal-btn"
            onClick={() =>
              openAddBridgeAboveFamilyModal(
                'horizontal_branch_above_family',
                maxUpperBridgeTier > 0 ? maxUpperBridgeTier : 1
              )
            }
            className="px-4 py-2 rounded-2xl bg-[#FFFDF9] hover:bg-white border-2 border-dashed border-[#8D4925]/70 hover:border-[#D8755B] text-xs font-display font-extrabold text-[#8D4925] hover:text-[#D8755B] shadow-2xs transition-all cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة بشكل أفقي نحو الجذر</span>
          </button>
        </div>

        <div className="w-0.5 h-3.5 bg-[#8D4925]/45 my-0.5" />

        {/* Base of Natural Lineage Spine: Family Station Node + Optional Horizontal Sibling Branches */}
        <div className="w-full flex flex-wrap items-start justify-center gap-4">
          {renderFamilyStationCard()}
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

    // Build clean single-line date / mercy text ONLY when explicitly entered by the user
    const dateAndStatusParts: string[] = [];
    if (person.birthDateValue?.trim()) {
      dateAndStatusParts.push(
        `${person.birthDateValue.trim()} ${
          person.birthCalendar === 'hijri' ? 'هـ' : 'م'
        }`
      );
    }
    if (person.vitalStatus === 'deceased') {
      dateAndStatusParts.push(
        person.gender === 'female' ? 'رحمها الله' : 'رحمه الله'
      );
    }
    const cleanMetaLine = dateAndStatusParts.join(' · ');

    // Collateral children attached to a non-spine card (excluding spouses rendered beside their husband so children don't duplicate)
    const nonSpineDirectChildren =
      !person.isDirectSpineLineage && !person.isRecordKeeper
        ? people.filter(
            (ch) =>
              ch.id !== person.id &&
              !ch.isDirectSpineLineage &&
              (person.gender === 'male'
                ? ch.fatherId === person.id
                : person.spouseIds.length === 0 && ch.motherId === person.id)
          )
        : [];

    const topRoleLabel = person.isRecordKeeper
      ? 'أمين السجل'
      : person.isBridgeAboveFamily
      ? person.relationToTargetLabel || 'حلقة ربط فوق العائلة نحو الجذر'
      : isVerticalOnlyLink
      ? `${getNextVerticalGrandfatherLabel(person.generationLevel)} · حلقة عمودية`
      : isFifthGrandfatherBoundary && person.isDirectSpineLineage
      ? 'الجد الخامس · بداية التفرع'
      : person.isDirectSpineLineage && person.generationLevel >= 2
      ? getNextVerticalGrandfatherLabel(person.generationLevel)
      : '';

    return (
      <div
        key={person.id}
        data-testid={`tree-person-card-${person.id}`}
        className={`relative group transition-all flex flex-col items-center ${
          isRadialOpen ? 'z-40' : 'z-10'
        }`}
      >
        <div
          className={`w-[245px] sm:w-[265px] rounded-2xl p-3.5 text-right transition-all shadow-sm relative ${
            person.isRecordKeeper
              ? 'bg-gradient-to-br from-[#FFFDF9] via-white to-[#FAF3E8] border-2 border-[#252321] ring-4 ring-[#D8755B]/20 shadow-md'
              : isVerticalOnlyLink
              ? 'bg-gradient-to-br from-[#FFFDF9] to-[#F5EFE4] border-2 border-dashed border-[#8D4925]/70'
              : person.gender === 'female'
              ? 'bg-gradient-to-br from-[#FFFDFB] to-[#FAF3EE] border-2 border-[#B98A78]/70'
              : person.generationLevel >= 4
              ? 'bg-gradient-to-br from-[#FAF6F0] to-[#EFE6D5] border-2 border-[#8D4925]/75'
              : 'bg-white border-2 border-[#B98A78]/55 hover:border-[#8D4925]'
          }`}
        >
          {/* Subtle Top Badges & Edit / Delete Actions */}
          <div className="flex items-center justify-between gap-1 mb-2">
            <div className="min-w-0">
              {topRoleLabel ? (
                <span className="text-[10px] font-display font-bold text-[#8D4925] truncate block">
                  {topRoleLabel}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => openEditPersonModal(person)}
                title={
                  isRecordKeeperCharterSigned
                    ? 'تعديل بيانات الفرد'
                    : 'يلزم التوقيع على ميثاق أمين السجل لتعديل السجلات'
                }
                className="w-6 h-6 rounded-lg bg-[#F7F2E9] hover:bg-[#D8755B] text-[#252321] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              {!person.isRecordKeeper && (
                <button
                  type="button"
                  data-testid={`delete-tree-node-btn-${person.id}`}
                  onClick={() => handleDeleteNode(person)}
                  title="حذف العقدة"
                  className="w-6 h-6 rounded-lg bg-[#F7F2E9] hover:bg-red-700 text-[#252321]/60 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Center Row: Warm Sepia & Charcoal Cameo Avatar + Camera + Strictly Registered Info */}
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <HeritageNodeAvatar
                personRole={avatarPersonRole}
                gender={person.gender}
                customImageUrl={person.photoThumbnailUrl || person.photoUrl}
                isPrivacyMasked={isMaskedNow}
                size="md"
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
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#252321] hover:bg-[#D8755B] text-white border-2 border-white flex items-center justify-center shadow-xs transition-colors cursor-pointer"
              >
                <Camera className="w-3 h-3" />
              </button>
            </div>

            <div className="min-w-0 flex-1 space-y-0.5">
              {/* 1. Registered Name ONLY (No appended family name) */}
              <div className="text-sm font-display font-extrabold text-[#252321] truncate">
                {mainName}
              </div>

              {/* 2. Kunya ONLY if explicitly entered */}
              {kunyaOrTitle && (
                <div className="text-xs font-semibold text-[#8D4925] truncate">
                  {kunyaOrTitle}
                </div>
              )}

              {/* 3. Birth Year / Mercy ONLY if explicitly entered */}
              {cleanMetaLine && (
                <div className="text-[11px] font-medium text-[#252321]/70 tabular-nums truncate">
                  {cleanMetaLine}
                </div>
              )}

              {/* 4. Interactive Linked Vault Media Badge (`📎 X وثائق/صور`) -> Opens Quick Vault Preview */}
              {(() => {
                const personMediaCount = vaultItems.filter((vi) =>
                  vi.linkedPersonIds.includes(person.id)
                ).length;
                if (personMediaCount === 0) return null;
                return (
                  <div className="pt-1">
                    <button
                      type="button"
                      data-testid={`tree-card-vault-badge-${person.id}`}
                      onClick={() => setQuickVaultPreviewPersonId(person.id)}
                      title="معاينة سريعة للصور والوثائق المربوطة بهذا الفرد في خزانتي"
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FEF3C7] hover:bg-[#FDE68A] border border-[#D97706]/60 text-[#92400E] text-[10px] font-display font-extrabold cursor-pointer transition-colors shadow-2xs"
                    >
                      <span>📎 {personMediaCount} وثائق/صور</span>
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Prominent Circular (+) Button ONLY within the Branching Zone (<= 5th Grandfather).
              Above the 5th Grandfather (generationLevel >= 8), nodes are strictly vertical links without horizontal branching. */}
          {!isVerticalOnlyLink && (
            <div className="mt-3 flex justify-center -mb-6 relative z-20">
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
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-md border-2 border-white transition-all cursor-pointer ${
                  isRadialOpen
                    ? 'bg-[#252321] text-white scale-110 ring-4 ring-[#D8755B]/35'
                    : 'bg-[#D8755B] hover:bg-[#8D4925] text-white hover:scale-105'
                }`}
              >
                {isRadialOpen ? (
                  <X className="w-4 h-4" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
              </button>
            </div>
          )}
        </div>

        {/* ================================================================== */}
        {/* RADIAL NODE QUICK-SELECTOR OVERLAY (من الجد الخامس نزولاً فقط)        */}
        {/* ================================================================== */}
        {isRadialOpen && !isVerticalOnlyLink && (
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

            {/* 2. MIDDLE: Siblings (<= 4th Grandfather) & Spouse/Partner (<= 5th Grandfather) */}
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
                <button
                  type="button"
                  onClick={() => openAddRelativeModal(person, 'spouse')}
                  className="w-full h-full min-h-[54px] rounded-xl bg-[#8D4925] hover:bg-[#D8755B] text-white text-xs font-display font-bold cursor-pointer transition-colors flex items-center justify-center px-2"
                >
                  <span>+ إضافة زوجة / شريك</span>
                </button>
              </div>
            </div>

            {/* 3. BOTTOM: Son & Daughter (Allowed from 5th Grandfather downward) */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/10">
              <button
                type="button"
                onClick={() => openAddRelativeModal(person, 'son')}
                className="py-2 px-2.5 rounded-xl bg-white/15 hover:bg-[#D8755B] text-white text-xs font-display font-bold text-center cursor-pointer transition-colors"
              >
                {isFifthGrandfatherBoundary ? '+ إضافة ابن / فرع' : '+ إضافة ابن'}
              </button>
              <button
                type="button"
                onClick={() => openAddRelativeModal(person, 'daughter')}
                className="py-2 px-2.5 rounded-xl bg-white/15 hover:bg-[#B98A78] text-white text-xs font-display font-bold text-center cursor-pointer transition-colors"
              >
                + إضافة ابنة
              </button>
            </div>
          </div>
        )}

        {/* Nested Collateral Descendants under non-spine branch cards */}
        {nonSpineDirectChildren.length > 0 && (
          <div className="mt-4 pt-2 border-t border-dashed border-[#B98A78]/60 flex flex-wrap items-start justify-center gap-3">
            {nonSpineDirectChildren.map((subChild) =>
              renderPersonCard(subChild)
            )}
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // RENDER DASHED PLACEHOLDER CARDS ABOVE ANY LINEAGE NODE MISSING FATHER/MOTHER
  // Strictly only below the 5th Grandfather (`generationLevel < 7`)
  // ============================================================================
  const renderDashedParentPlaceholders = (childNode: InteractiveTreePerson) => {
    if (childNode.generationLevel >= FIFTH_GRANDFATHER_LEVEL) return null;

    const hasFather = Boolean(
      childNode.fatherId && findPerson(childNode.fatherId)
    );
    const hasMother = Boolean(
      childNode.motherId && findPerson(childNode.motherId)
    );

    if (hasFather && hasMother) return null;

    return (
      <div className="flex flex-col items-center mb-3">
        <div className="flex flex-wrap items-center justify-center gap-4">
          {!hasFather && (
            <button
              type="button"
              onClick={() => openAddRelativeModal(childNode, 'father')}
              className="w-[185px] sm:w-[205px] rounded-2xl border-2 border-dashed border-[#8D4925]/65 hover:border-[#D8755B] bg-[#FAF6F0]/90 hover:bg-white py-3 px-4 text-center transition-all cursor-pointer group shadow-2xs"
            >
              <div className="text-xs font-display font-extrabold text-[#252321] group-hover:text-[#D8755B]">
                + إضافة ({getNextVerticalGrandfatherLabel(childNode.generationLevel + 1)})
              </div>
            </button>
          )}

          {!hasMother && (
            <button
              type="button"
              onClick={() => openAddRelativeModal(childNode, 'mother')}
              className="w-[185px] sm:w-[205px] rounded-2xl border-2 border-dashed border-[#B98A78]/85 hover:border-[#D8755B] bg-[#FAF6F0]/90 hover:bg-white py-3 px-4 text-center transition-all cursor-pointer group shadow-2xs"
            >
              <div className="text-xs font-display font-extrabold text-[#252321] group-hover:text-[#D8755B]">
                + إضافة الأم
              </div>
            </button>
          )}
        </div>

        <div className="w-0.5 h-5 bg-[#8D4925]/45 mt-1" />
      </div>
    );
  };

  // ============================================================================
  // RENDER FULL GENERATION ROW (Strict 3-Zone Layout)
  // ============================================================================
  const renderLineageGenerationBlock = (spineNode: InteractiveTreePerson) => {
    const isVerticalOnlyZone =
      spineNode.generationLevel > FIFTH_GRANDFATHER_LEVEL;

    // Zone 2 (`generationLevel >= 8`: ما قبل الجد الخامس حتى الجذر):
    // Render strictly as a single vertical link node with zero horizontal siblings/spouses!
    if (isVerticalOnlyZone) {
      return (
        <div
          key={spineNode.id}
          className="flex flex-col items-center w-full relative"
        >
          {renderPersonCard(spineNode)}
        </div>
      );
    }

    const motherNode = spineNode.motherId
      ? findPerson(spineNode.motherId)
      : undefined;

    const wives = spineNode.spouseIds
      .map((id) => findPerson(id))
      .filter((w): w is InteractiveTreePerson => Boolean(w));

    const siblings =
      spineNode.generationLevel < FIFTH_GRANDFATHER_LEVEL
        ? people.filter(
            (p) =>
              p.id !== spineNode.id &&
              !p.isDirectSpineLineage &&
              p.generationLevel === spineNode.generationLevel &&
              ((spineNode.fatherId && p.fatherId === spineNode.fatherId) ||
                p.relationToTargetLabel.includes(spineNode.firstName)) &&
              !spineNode.spouseIds.includes(p.id)
          )
        : [];

    return (
      <div
        key={spineNode.id}
        className="flex flex-col items-center w-full relative"
      >
        {spineNode.generationLevel === FIFTH_GRANDFATHER_LEVEL && (
          <div className="mb-3 inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#FAF3E6] border border-[#D4AF37]/65 text-[11px] font-display font-bold text-[#8D4925] shadow-2xs">
            <span>✦</span>
            <span>
              بداية نطاق التشجير العائلي الكامل (من الجد الخامس نزولاً: الفروع والأبناء والزوجات)
            </span>
          </div>
        )}

        {spineNode.id === topMostDirectAncestor?.id &&
          spineNode.generationLevel < FIFTH_GRANDFATHER_LEVEL &&
          renderDashedParentPlaceholders(spineNode)}

        {/* Horizontal Row: Siblings / Collateral Branches (Right) + Spine Node (Center) + Wives/Spouses (Left) */}
        <div className="flex flex-wrap items-start justify-center gap-5 w-full">
          {siblings.length > 0 && (
            <div className="flex flex-wrap items-start justify-center gap-3 bg-[#FAF6F0]/90 border border-[#B98A78]/40 rounded-2xl p-3">
              <div className="w-full text-[10px] font-display font-bold text-[#8D4925] text-center mb-1">
                الإخوة والفروع الشقيقة ({siblings.length})
              </div>
              {siblings.map((sib) => renderPersonCard(sib))}
            </div>
          )}

          {/* Center: Main Lineage Node */}
          <div className="flex flex-col items-center">
            {renderPersonCard(spineNode)}

            {spineNode.generationLevel < FIFTH_GRANDFATHER_LEVEL &&
              spineNode.fatherId &&
              !motherNode && (
                <button
                  type="button"
                  onClick={() => openAddRelativeModal(spineNode, 'mother')}
                  className="mt-4 px-3.5 py-1.5 rounded-xl border border-dashed border-[#B98A78] bg-white/90 hover:border-[#D8755B] text-[11px] font-display font-bold text-[#8D4925] hover:text-[#D8755B] cursor-pointer"
                >
                  + إضافة الأم
                </button>
              )}
          </div>

          {wives.length > 0 && (
            <div className="flex flex-wrap items-start justify-center gap-3 bg-[#FFFDFB] border border-[#D8755B]/40 rounded-2xl p-3">
              <div className="w-full text-[10px] font-display font-bold text-[#D8755B] text-center mb-1 flex items-center justify-center gap-1">
                <Heart className="w-3 h-3" />
                <span>الزوجات ({wives.length})</span>
              </div>
              {wives.map((wife) => renderPersonCard(wife))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Children of Record Keeper (Level 0: Sons & Daughters)
  const recordKeeperNode = people.find((p) => p.isRecordKeeper);
  const recordKeeperChildren = people.filter(
    (p) =>
      !p.isBridgeAboveFamily &&
      p.generationLevel <= 0 &&
      recordKeeperNode &&
      (p.fatherId === recordKeeperNode.id ||
        p.motherId === recordKeeperNode.id ||
        p.generationLevel === 0)
  );

  const topDownDirectLineage = [...directLineageSpine].reverse();

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
      {/* 1. CLEAN SINGLE-ROW TOP HEADER BAR (بدون زر الاستيراد وبدون تكدس المدى) */}
      {/* ==================================================================== */}
      <div className="rounded-3xl bg-white border border-[#B98A78]/45 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg sm:text-2xl font-display font-extrabold text-[#252321]">
              شجرة عائلة {result.familyName}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#252321]/70">
              {treeSaveState === 'loading' || treeSaveState === 'saving' ? (
                <span className="inline-flex items-center gap-1.5 text-[#8D4925]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D8755B]" />
                  <span>
                    {treeSaveState === 'loading'
                      ? 'جاري استرجاع المشجرة من قاعدة البيانات...'
                      : 'جاري حفظ التعديلات تلقائياً...'}
                  </span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    محفوظة في قاعدة البيانات ({people.length} فرداً)
                    {lastSavedLabel ? ` · آخر حفظ ${lastSavedLabel}` : ''}
                  </span>
                </span>
              )}

              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-[#FAF6F0] border border-[#B98A78]/45 text-[11px] font-display font-bold text-[#8D4925]">
                <Users className="w-3 h-3 text-[#D8755B]" />
                <span>
                  السعة:{' '}
                  {caps.maxTreeMembers !== null
                    ? `${people.length} / ${caps.maxTreeMembers} فرداً`
                    : `${people.length} · سعة مفتوحة (أمين السجل ✦)`}
                </span>
              </span>
            </div>
          </div>

          {/* Clean Action Buttons: Invite + Save + Official Export */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setCopiedInviteLink(false);
                setShowInviteFamilyModal(true);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors border ${
                caps.canInviteFamilyContributors
                  ? 'bg-[#FFFDF9] hover:bg-[#FAF6F0] text-[#8D4925] border-[#D4AF37]'
                  : 'bg-[#FAF6F0] hover:bg-[#EDE6DA] text-[#252321] border-[#B98A78]/50'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5 text-[#D8755B]" />
              <span>دعوة أفراد العائلة</span>
            </button>

            <button
              type="button"
              disabled={treeSaveState === 'saving' || treeSaveState === 'loading'}
              onClick={handleManualSaveTree}
              className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
            >
              {treeSaveState === 'saving' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>حفظ المشجرة</span>
            </button>

            <button
              type="button"
              data-testid="open-tree-official-export-btn"
              onClick={() => setShowOfficialExportModal(true)}
              className="px-4 py-2 rounded-xl bg-[#252321] hover:bg-[#3a3734] text-white text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-[#F3D299]" />
              <span>تصدير المشجرة الموثقة</span>
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
      {/* 2. INTERACTIVE TREE CANVAS WITH COMFORTABLE DEPTH BAR & SIDE NOTE    */}
      {/* ==================================================================== */}
      <div
        className="rounded-3xl border-2 border-[#B98A78]/45 p-3 sm:p-6 shadow-sm relative overflow-x-auto touch-pan-x touch-pan-y scroll-smooth"
        style={{
          backgroundColor: '#FAF6F0',
          backgroundImage: 'radial-gradient(#B98A78 1.15px, transparent 1.15px)',
          backgroundSize: '24px 24px',
        }}
      >
        {/* Comfortable Non-Intrusive Canvas Control Bar (Outside scale transform) */}
        <div className="rounded-2xl bg-white/95 backdrop-blur-xs border border-[#B98A78]/40 px-3.5 py-2.5 mb-6 shadow-2xs flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0">
            <span className="text-xs font-display font-extrabold text-[#8D4925] shrink-0">
              مدى العرض من أمين السجل حتى:
            </span>
            <div
              role="group"
              aria-label="عرض الشجرة من أمين السجل وحتى"
              className="flex items-center gap-1.5 overflow-x-auto no-scrollbar whitespace-nowrap touch-pan-x pb-0.5 sm:pb-0 sm:flex-wrap bg-[#FAF6F0] p-1 rounded-xl border border-[#B98A78]/30"
            >
              {DEPTH_SELECTOR_OPTIONS.map((opt) => {
                const isSelected = spineDepth === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      handleSelectSpineDepth(opt.id, `حتى ${opt.label}`)
                    }
                    title={`${opt.label} (${opt.detail})`}
                    className={`px-3 py-1.5 rounded-lg text-xs font-display font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shrink-0 ${
                      isSelected
                        ? 'bg-[#252321] text-[#F7F2E9] shadow-2xs'
                        : 'text-[#252321]/80 hover:bg-white hover:text-[#252321]'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {isSelected && (
                      <span className="text-[10px] font-normal text-[#F3D299]">
                        · {opt.detail}
                      </span>
                    )}
                    {opt.locked && (
                      <Lock className="w-3 h-3 text-[#D8755B] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
            <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FAF6F0] border border-[#B98A78]/35 text-[11px] font-semibold text-[#8D4925]">
              <span>التفريع الكامل: من الجد الخامس نزولاً · فوقه حلقات عمودية فقط</span>
            </span>

            <div className="inline-flex items-center rounded-xl bg-[#FAF6F0] border border-[#B98A78]/45 p-0.5">
              <button
                type="button"
                onClick={() => setZoomPercent((z) => Math.max(75, z - 10))}
                title="تصغير"
                className="p-1.5 rounded-lg hover:bg-white text-[#252321] cursor-pointer"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 text-xs font-mono font-bold text-[#252321] tabular-nums">
                {zoomPercent}%
              </span>
              <button
                type="button"
                onClick={() => setZoomPercent((z) => Math.min(115, z + 10))}
                title="تكبير"
                className="p-1.5 rounded-lg hover:bg-white text-[#252321] cursor-pointer"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Centered Tree Layout + Collapsible Left-Side Follow-Up Note */}
        <div className="w-full flex flex-col items-center">
          <div
            className="flex flex-col items-center min-w-[300px] w-full mx-auto transition-transform origin-top"
            style={{
              transform: `scale(${zoomPercent / 100})`,
            }}
          >
            {/* ================================================================ */}
            {/* A. NATURAL LINEAGE SPINE + LEFT-SIDE COLLAPSIBLE FOLLOW-UP NOTE  */}
            {/* ================================================================ */}
            {sideNoteElement ? (
              <div className="w-full flex flex-col lg:grid lg:grid-cols-[1fr_minmax(0,560px)_1fr] items-start gap-4">
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
            )}

            {/* ================================================================ */}
            {/* B. UPWARD ANCESTOR / VERTICAL MISSING-LINK ADDITION BUTTON       */}
            {/* ================================================================ */}
            {topMostDirectAncestor && (
              <div className="mb-4 flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => {
                    openAddRelativeModal(
                      topMostDirectAncestor,
                      topMostDirectAncestor.generationLevel >=
                        FIFTH_GRANDFATHER_LEVEL
                        ? 'vertical_ancestor'
                        : 'father'
                    );
                  }}
                  className="px-5 py-2.5 rounded-2xl bg-[#FFFDF9] hover:bg-white border-2 border-dashed border-[#D8755B] text-xs sm:text-sm font-display font-extrabold text-[#252321] hover:text-[#D8755B] shadow-2xs transition-all cursor-pointer"
                >
                  {topMostDirectAncestor.generationLevel >=
                  FIFTH_GRANDFATHER_LEVEL
                    ? `+ إضافة عقدة عمودية كحلقة نحو الجذر (${getNextVerticalGrandfatherLabel(
                        topMostDirectAncestor.generationLevel + 1
                      )})`
                    : `+ إضافة (${getNextVerticalGrandfatherLabel(
                        topMostDirectAncestor.generationLevel + 1
                      )})`}
                </button>
                <div className="w-0.5 h-5 bg-[#8D4925]/45 mt-1" />
              </div>
            )}

            {/* ================================================================ */}
            {/* C. GENERATIONS STACK (From Highest Added Ancestor down to Record Keeper) */}
            {/* ================================================================ */}
            <div className="space-y-4 w-full flex flex-col items-center">
              {topDownDirectLineage.map((spineNode, idx) => (
                <React.Fragment key={spineNode.id}>
                  {renderLineageGenerationBlock(spineNode)}

                  {idx < topDownDirectLineage.length - 1 && (
                    <div className="flex flex-col items-center my-1">
                      <div className="w-0.5 h-4 bg-[#8D4925]/55" />
                      <span className="px-2.5 py-0.5 rounded-full bg-[#FAF6F0] border border-[#8D4925]/45 text-[10px] font-display font-bold text-[#8D4925] inline-flex items-center gap-1">
                        <ArrowUp className="w-2.5 h-2.5" />
                        <span>بن (سليل مباشر)</span>
                      </span>
                      <div className="w-0.5 h-4 bg-[#8D4925]/55" />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* ================================================================ */}
            {/* D. DESCENDANTS / CHILDREN OF RECORD KEEPER (الأبناء والبنات)      */}
            {/* ================================================================ */}
            <div className="flex flex-col items-center w-full mt-4">
              <div className="w-0.5 h-6 bg-[#8D4925]/55" />
              <div className="rounded-3xl bg-white/85 border-2 border-dashed border-[#B98A78]/65 p-4 sm:p-5 max-w-4xl w-full text-center space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#B98A78]/25 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#D8755B]" />
                    <span className="text-xs sm:text-sm font-display font-extrabold text-[#252321]">
                      الأبناء والبنات
                    </span>
                  </div>
                  {recordKeeperNode && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          openAddRelativeModal(recordKeeperNode, 'son')
                        }
                        className="px-3 py-1.5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-display font-bold cursor-pointer"
                      >
                        + إضافة ابن
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          openAddRelativeModal(recordKeeperNode, 'daughter')
                        }
                        className="px-3 py-1.5 rounded-xl bg-[#8D4925] hover:bg-[#73391b] text-white text-xs font-display font-bold cursor-pointer"
                      >
                        + إضافة ابنة
                      </button>
                    </div>
                  )}
                </div>

                {recordKeeperChildren.length === 0 ? (
                  <p className="text-xs text-[#252321]/65 py-1">
                    {isRecordKeeperCharterSigned
                      ? 'اضغط على زر (+) لإضافة الأبناء والبنات.'
                      : 'وقّع على ميثاق أمين السجل أولاً لتفعيل إضافة الأبناء والفروع.'}
                  </p>
                ) : (
                  <div className="flex flex-wrap items-start justify-center gap-4 pt-1">
                    {recordKeeperChildren.map((child) =>
                      renderPersonCard(child)
                    )}
                  </div>
                )}
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
                    className="px-3.5 py-2 rounded-xl bg-[#252321] hover:bg-[#3a3734] text-[#F3D299] text-xs font-display font-bold shrink-0 cursor-pointer"
                  >
                    ترقية VIP
                  </button>
                </div>
              )}

              {!caps.hasRegistrarBadge && (
                <div className="rounded-2xl bg-gradient-to-l from-[#FFFDF9] to-[#FEF3C7]/45 border border-[#D4AF37] p-3.5 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-display font-extrabold text-[#8D4925]">
                      عضوية أمين سجل العائلة ✦
                    </div>
                    <div className="text-[11px] text-[#252321]/75">
                      سعة مفتوحة غير محدودة للأفراد والوثائق + دعوة أفراد العائلة للمساهمة
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
                  ميزة <strong>«دعوة أفراد العائلة للمساهمة أو المعاينة»</strong> عبر رابط عائلي موحد هي إحدى صلاحيات الحوكمة المخصصة لحاملي صفة <strong>«أمين سجل العائلة»</strong>، وتشمل أيضاً سعة غير محدودة للأفراد والوثائق وصلاحية النشر العائلي الموثق.
                </p>
                <div className="flex items-center justify-end gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowInviteFamilyModal(false)}
                    className="px-4 py-2 rounded-xl bg-[#F7F2E9] text-xs font-bold text-[#252321] cursor-pointer"
                  >
                    لاحقاً
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowInviteFamilyModal(false);
                      onSignCharterAndEnableTree();
                    }}
                    className="px-5 py-2.5 rounded-xl bg-[#252321] hover:bg-[#3a3734] text-[#F3D299] text-xs font-display font-extrabold cursor-pointer"
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
      {/* 3. ARABIC GENEALOGY METADATA POPUP MODAL (النافذة المنبثقة الذكية)   */}
      {/* ==================================================================== */}
      {modalConfig && modalMeta && (
        <div
          className="fixed inset-0 z-50 bg-[#252321]/65 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label={modalMeta.title}
        >
          <div
            ref={modalScrollContainerRef}
            dir="rtl"
            className="bg-white border-2 border-[#B98A78] rounded-3xl max-w-2xl w-full p-5 sm:p-7 shadow-2xl space-y-5 my-8 max-h-[92vh] overflow-y-auto text-right"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#B98A78]/30 pb-4">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-display font-bold text-[#D8755B] mb-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{modalMeta.subtitle}</span>
                </span>
                <h3 className="text-lg sm:text-xl font-display font-extrabold text-[#252321]">
                  {modalMeta.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalConfig(null)}
                className="w-8 h-8 rounded-xl bg-[#F7F2E9] hover:bg-[#EDE6DA] text-[#252321] flex items-center justify-center cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePersonModal} noValidate className="space-y-4">
              {(() => {
                const editingPerson =
                  modalConfig.mode === 'edit' && modalConfig.editPersonId
                    ? findPerson(modalConfig.editPersonId)
                    : undefined;
                const targetForAdd =
                  modalConfig.mode === 'add'
                    ? findPerson(modalConfig.targetNodeId)
                    : undefined;
                const isVerticalOnlyModal =
                  (editingPerson &&
                    !editingPerson.isBridgeAboveFamily &&
                    editingPerson.generationLevel > FIFTH_GRANDFATHER_LEVEL) ||
                  (modalConfig.mode === 'add' &&
                    (modalConfig.relationKind === 'bridge_above_family' ||
                      modalConfig.relationKind ===
                        'horizontal_branch_above_family' ||
                      (modalConfig.relationKind === 'vertical_ancestor' &&
                        (targetForAdd?.generationLevel ?? 0) >=
                          FIFTH_GRANDFATHER_LEVEL)));

                return (
                  <>
                    {isVerticalOnlyModal && (
                      <div className="rounded-2xl bg-[#FAF6F0] border border-[#D4AF37]/70 p-3.5 text-xs text-[#252321]/85 leading-relaxed">
                        <strong className="text-[#8D4925]">
                          حلقة ربط عمودية نحو الجذر (ما فوق الجد الخامس):
                        </strong>{' '}
                        تُسجَّل كعقدة عمودية منفردة لربط عمود أسرتك بنقطة الجذر الموثقة دون تفريع أفقي.
                      </div>
                    )}

                    {/* Gender Selection (Locked to male on vertical-only ancestor links above 5th Grandfather) */}
                    {!isVerticalOnlyModal && (
                      <div>
                        <label className="block text-xs font-display font-bold text-[#252321] mb-1.5">
                          الجنس:
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setFormGender('male');
                              setFormFemalePrivacyMasked(false);
                            }}
                            className={`py-2.5 px-4 rounded-xl border text-xs font-display font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                              formGender === 'male'
                                ? 'bg-[#252321] text-white border-[#252321] shadow-2xs'
                                : 'bg-[#FAF6F0] text-[#252321]/75 border-[#B98A78]/45'
                            }`}
                          >
                            <span>ذكر</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setFormGender('female');
                              setFormFemalePrivacyMasked(true);
                            }}
                            className={`py-2.5 px-4 rounded-xl border text-xs font-display font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                              formGender === 'female'
                                ? 'bg-[#8D4925] text-white border-[#8D4925] shadow-2xs'
                                : 'bg-[#FAF6F0] text-[#252321]/75 border-[#B98A78]/45'
                            }`}
                          >
                            <span>أنثى</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Registered Name ONLY + Optional Kunya + Optional Honorific (Zero family-name concatenation) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                      <div className="sm:col-span-1">
                        <label className="block text-xs font-display font-bold text-[#252321] mb-1">
                          الاسم المسجل في العقدة{' '}
                          <span className="text-[#D8755B]">*</span>
                        </label>
                        <input
                          ref={nameInputRef}
                          type="text"
                          autoFocus
                          value={formFirstName}
                          onChange={(e) => {
                            setFormFirstName(e.target.value);
                            if (formError) setFormError('');
                          }}
                          placeholder={
                            formGender === 'female'
                              ? 'مثال: نورة / فاطمة'
                              : 'مثال: محمد / عبدالله'
                          }
                          className="w-full rounded-xl bg-[#FAF6F0] border border-[#B98A78]/60 px-3.5 py-2.5 text-sm text-[#252321] focus:outline-none focus:border-[#D8755B]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-display font-bold text-[#252321] mb-1">
                          الكنية (اختياري)
                        </label>
                        <input
                          type="text"
                          value={formKunya}
                          onChange={(e) => setFormKunya(e.target.value)}
                          placeholder="تُترك فارغة ما لم تُدخَل"
                          className="w-full rounded-xl bg-[#FAF6F0] border border-[#B98A78]/60 px-3.5 py-2.5 text-sm text-[#252321] focus:outline-none focus:border-[#D8755B]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-display font-bold text-[#252321] mb-1">
                          اللقب / الصفة (اختياري)
                        </label>
                        <select
                          value={formHonorific}
                          onChange={(e) =>
                            setFormHonorific(
                              e.target.value as ArabicHonorificTitle
                            )
                          }
                          className="w-full rounded-xl bg-[#FAF6F0] border border-[#B98A78]/60 px-3.5 py-2.5 text-sm text-[#252321] focus:outline-none focus:border-[#D8755B]"
                        >
                          {ARABIC_HONORIFIC_TITLES.map((title) => (
                            <option key={title} value={title}>
                              {title}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Mother Link Dropdown */}
                    {modalMeta.showMotherSelector && (
                      <div className="rounded-2xl bg-[#FAF6F0] border border-[#B98A78]/55 p-3.5 space-y-2">
                        <label className="block text-xs font-display font-bold text-[#8D4925]">
                          تحديد الأم (من زوجات الأب):
                        </label>
                        {modalMeta.motherOptions.length > 0 ? (
                          <select
                            value={formMotherId}
                            onChange={(e) => setFormMotherId(e.target.value)}
                            className="w-full rounded-xl bg-white border border-[#B98A78]/60 px-3.5 py-2 text-xs sm:text-sm text-[#252321] font-semibold"
                          >
                            <option value="">
                              — اختر الأم من زوجات الأب المسجلات —
                            </option>
                            {modalMeta.motherOptions.map((mom) => (
                              <option key={mom.id} value={mom.id}>
                                {mom.firstName}{' '}
                                {mom.kunya ? `(${mom.kunya})` : ''}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <p className="text-xs text-[#252321]/70">
                            يمكنك إضافة الزوجة أولاً من زر (+) على بطاقة الأب ليتم ربط كل ابن بوالدته بدقة.
                          </p>
                        )}
                      </div>
                    )}

                    {/* Vital Status & Hijri/Gregorian Dates (No assumed default!) */}
                    <div className="rounded-2xl bg-[#FAF6F0] border border-[#B98A78]/45 p-4 space-y-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-display font-bold text-[#252321]">
                          الحالة الحياتية والتواريخ (اختياري):
                        </span>
                        <div className="inline-flex flex-wrap rounded-xl bg-white border border-[#B98A78]/45 p-1 gap-1">
                          <button
                            type="button"
                            onClick={() => setFormVitalStatus('unspecified')}
                            className={`px-3 py-1 rounded-lg text-xs font-display font-bold cursor-pointer transition-colors ${
                              formVitalStatus === 'unspecified'
                                ? 'bg-[#8D4925] text-white'
                                : 'text-[#252321]/75'
                            }`}
                          >
                            غير محدد
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormVitalStatus('living')}
                            className={`px-3 py-1 rounded-lg text-xs font-display font-bold cursor-pointer transition-colors ${
                              formVitalStatus === 'living'
                                ? 'bg-[#D8755B] text-white'
                                : 'text-[#252321]/75'
                            }`}
                          >
                            على قيد الحياة
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormVitalStatus('deceased')}
                            className={`px-3 py-1 rounded-lg text-xs font-display font-bold cursor-pointer transition-colors ${
                              formVitalStatus === 'deceased'
                                ? 'bg-[#252321] text-white'
                                : 'text-[#252321]/75'
                            }`}
                          >
                            متوفى - رحمه الله
                          </button>
                        </div>
                      </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#252321]/75 mb-1">
                      دقة تاريخ الميلاد
                    </label>
                    <select
                      value={formBirthPrecision}
                      onChange={(e) =>
                        setFormBirthPrecision(
                          e.target.value as 'year_only' | 'full_date'
                        )
                      }
                      className="w-full rounded-xl bg-white border border-[#B98A78]/50 px-2.5 py-2 text-xs text-[#252321]"
                    >
                      <option value="year_only">سنة فقط / تقريبي</option>
                      <option value="full_date">تاريخ كامل</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#252321]/75 mb-1">
                      التقويم المعتمد
                    </label>
                    <select
                      value={formBirthCalendar}
                      onChange={(e) =>
                        setFormBirthCalendar(
                          e.target.value as 'hijri' | 'gregorian'
                        )
                      }
                      className="w-full rounded-xl bg-white border border-[#B98A78]/50 px-2.5 py-2 text-xs text-[#252321]"
                    >
                      <option value="hijri">هجري (هـ)</option>
                      <option value="gregorian">ميلادي (م)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#252321]/75 mb-1">
                      {formBirthPrecision === 'year_only'
                        ? 'سنة الميلاد'
                        : 'تاريخ الميلاد'}
                    </label>
                    <input
                      type="text"
                      value={formBirthDate}
                      onChange={(e) => setFormBirthDate(e.target.value)}
                      placeholder={
                        formBirthCalendar === 'hijri'
                          ? 'مثال: 1395'
                          : 'مثال: 1975'
                      }
                      className="w-full rounded-xl bg-white border border-[#B98A78]/50 px-3 py-2 text-xs text-[#252321] tabular-nums"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#252321]/75 mb-1">
                    مكان الميلاد / الديرة
                  </label>
                  <input
                    type="text"
                    value={formBirthPlace}
                    onChange={(e) => setFormBirthPlace(e.target.value)}
                    placeholder="مثال: سراة عبيدة / الرياض / دير الزور"
                    className="w-full rounded-xl bg-white border border-[#B98A78]/50 px-3 py-2 text-xs text-[#252321]"
                  />
                </div>

                {formVitalStatus === 'deceased' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-[#B98A78]/30">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#252321]/75 mb-1">
                        سنة / تاريخ الوفاة
                      </label>
                      <input
                        type="text"
                        value={formDeathDate}
                        onChange={(e) => setFormDeathDate(e.target.value)}
                        placeholder={
                          formBirthCalendar === 'hijri'
                            ? 'مثال: 1435 هـ'
                            : 'مثال: 2014 م'
                        }
                        className="w-full rounded-xl bg-white border border-[#B98A78]/50 px-3 py-2 text-xs text-[#252321] tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#252321]/75 mb-1">
                        مكان الوفاة أو المدفن
                      </label>
                      <input
                        type="text"
                        value={formDeathPlace}
                        onChange={(e) => setFormDeathPlace(e.target.value)}
                        placeholder="مثال: مقبرة العود / البقيع"
                        className="w-full rounded-xl bg-white border border-[#B98A78]/50 px-3 py-2 text-xs text-[#252321]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Arabic Family Privacy Option (Automatically applied on the card) */}
              {formGender === 'female' && (
                <div className="rounded-2xl bg-[#FFF8F0] border-2 border-[#D8755B]/60 p-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-display font-extrabold text-[#8D4925]">
                    <ShieldCheck className="w-4 h-4 text-[#D8755B]" />
                    <span>خيار الخصوصية العائلية العربية:</span>
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white border border-[#B98A78]/40 cursor-pointer">
                      <input
                        type="radio"
                        name="femalePrivacyOption"
                        checked={!formFemalePrivacyMasked}
                        onChange={() => setFormFemalePrivacyMasked(false)}
                        className="mt-0.5 accent-[#D8755B]"
                      />
                      <span className="text-xs font-semibold text-[#252321]">
                        إظهار الاسم الكامل في المشجرة
                      </span>
                    </label>
                    <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white border border-[#D8755B]/50 cursor-pointer">
                      <input
                        type="radio"
                        name="femalePrivacyOption"
                        checked={formFemalePrivacyMasked}
                        onChange={() => setFormFemalePrivacyMasked(true)}
                        className="mt-0.5 accent-[#D8755B]"
                      />
                      <span className="text-xs font-bold text-[#252321]">
                        عرض الكنية فقط لغير المحارم
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* Contact Info for Living Relatives */}
              {formVitalStatus === 'living' && (
                <div>
                  <label className="block text-xs font-display font-bold text-[#252321] mb-1">
                    البريد الإلكتروني / رقم الجوال (اختياري)
                  </label>
                  <input
                    type="text"
                    value={formContactInfo}
                    onChange={(e) => setFormContactInfo(e.target.value)}
                    placeholder="relative@family.com / +966500000000"
                    dir="ltr"
                    className="w-full rounded-xl bg-[#FAF6F0] border border-[#B98A78]/60 px-3.5 py-2 text-xs sm:text-sm text-[#252321] text-right"
                  />
                </div>
              )}

              {/* ============================================================ */}
              {/* TWO-WAY LINKED VAULT MEDIA SECTION (`📂 وثائق وصور هذا الفرد في خزانتي`) */}
              {/* ============================================================ */}
              {(() => {
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
                  <div
                    data-testid="person-modal-vault-media-section"
                    className="rounded-2xl bg-gradient-to-br from-[#FFFDF9] via-[#FAF6F0] to-[#F5E6C8]/45 border-2 border-[#D4AF37]/65 p-4 space-y-3.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Paperclip className="w-4 h-4 text-[#D8755B]" />
                        <span className="text-xs sm:text-sm font-display font-extrabold text-[#252321]">
                          📂 وثائق وصور هذا الفرد في خزانتي ({linkedMediaForModalPerson.length})
                        </span>
                      </div>
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-white border border-[#D4AF37]/60 text-[#8D4925]">
                        مزامنة ثنائية فورية مع «خزانتي»
                      </span>
                    </div>

                    {/* Linked Photos & Documents List */}
                    {linkedMediaForModalPerson.length === 0 ? (
                      <div className="rounded-xl bg-white/85 border border-[#B98A78]/35 p-3 text-xs text-[#252321]/70">
                        لا توجد صور أو وثائق مربوطة بهذا الفرد حالياً. يمكنك رفع صورة/وثيقة جديدة أدناه أو ربط ملف موجود من «خزانتي».
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {linkedMediaForModalPerson.map((media) => (
                          <div
                            key={media.id}
                            className="rounded-xl bg-white border border-[#D4AF37]/60 p-2.5 flex items-center justify-between gap-2.5 shadow-2xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-11 h-11 rounded-lg bg-[#FAF6F0] border border-[#B98A78]/35 overflow-hidden shrink-0 flex items-center justify-center">
                                {media.mediaType === 'photo' ||
                                (media.thumbnailDataUrl || media.fileDataUrl).startsWith(
                                  'data:image'
                                ) ? (
                                  <img
                                    src={media.thumbnailDataUrl || media.fileDataUrl}
                                    alt={media.title}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <FileText className="w-5 h-5 text-[#8D4925]" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-display font-extrabold text-[#252321] truncate">
                                  {media.title}
                                </div>
                                <div className="text-[10px] text-[#8D4925] font-semibold">
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
                                handleToggleVaultItemForModalPerson(media.id)
                              }
                              title="فك ارتباط الملف عن هذا الفرد"
                              className="px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-[10px] font-bold shrink-0 cursor-pointer"
                            >
                              فك الربط
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Direct Upload from inside `شجرتي` to `خزانتي` */}
                    <div className="rounded-xl bg-white border border-[#B98A78]/40 p-3 space-y-2.5">
                      <div className="text-[11px] font-display font-bold text-[#8D4925]">
                        + رفع صورة أو وثيقة جديدة لهذا الفرد (تُحفظ تلقائياً في خزانتي):
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={treeVaultUploadTitle}
                          onChange={(e) =>
                            setTreeVaultUploadTitle(e.target.value)
                          }
                          placeholder="عنوان الصورة أو الوثيقة..."
                          className="px-3 py-1.5 rounded-lg bg-[#FAF6F0] border border-[#B98A78]/45 text-xs text-[#252321]"
                        />
                        <select
                          value={treeVaultUploadFolderId}
                          onChange={(e) =>
                            setTreeVaultUploadFolderId(e.target.value)
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-[#FAF6F0] border border-[#B98A78]/45 text-xs font-bold text-[#252321]"
                        >
                          {vaultFolders.map((vf) => (
                            <option key={vf.id} value={vf.id}>
                              {vf.icon} {vf.name}
                            </option>
                          ))}
                        </select>
                        <label className="px-3 py-1.5 rounded-lg bg-[#252321] hover:bg-[#8D4925] text-[#FEF3C7] text-xs font-display font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition-colors">
                          <Upload className="w-3.5 h-3.5" />
                          <span>
                            {isUploadingToVaultFromTree
                              ? 'جاري الحفظ...'
                              : 'اختيار ملف ورفعه'}
                          </span>
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden"
                            onChange={(e) => {
                              handleUploadFileDirectlyToVaultFromTree(
                                e.target.files
                              );
                              e.target.value = '';
                            }}
                          />
                        </label>
                      </div>
                    </div>

                    {/* Quick Picker to Link Existing Vault Items */}
                    {unlinkedMediaInVault.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <div className="text-[11px] font-display font-bold text-[#252321] flex items-center gap-1.5">
                          <Link2 className="w-3.5 h-3.5 text-[#D8755B]" />
                          <span>أو اربط ملفاً موجوداً مسبقاً في «خزانتي»:</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                          {unlinkedMediaInVault.map((uv) => (
                            <button
                              key={uv.id}
                              type="button"
                              onClick={() =>
                                handleToggleVaultItemForModalPerson(uv.id)
                              }
                              className="px-2.5 py-1 rounded-full bg-white hover:bg-[#252321] text-[#252321] hover:text-[#FEF3C7] border border-[#B98A78]/45 text-[11px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <span>
                                {uv.mediaType === 'photo' ? '📸' : '📜'}
                              </span>
                              <span>+ {uv.title}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Collapsible Section: تحرير المزيد */}
              <div className="rounded-2xl border border-[#B98A78]/50 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowMoreBioSection((v) => !v)}
                  className="w-full px-4 py-3 bg-[#FAF6F0] hover:bg-[#EDE6DA] flex items-center justify-between text-xs font-display font-bold text-[#252321] cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#8D4925]" />
                    <span>
                      تحرير المزيد (السيرة الذاتية، المآثر، والوثائق المرفقة)
                    </span>
                  </span>
                  {showMoreBioSection ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>

                {showMoreBioSection && (
                  <div className="p-4 bg-white space-y-3 border-t border-[#B98A78]/30">
                    <div>
                      <label className="block text-xs font-semibold text-[#252321] mb-1">
                        السيرة الذاتية والمآثر:
                      </label>
                      <textarea
                        rows={3}
                        value={formBiography}
                        onChange={(e) => setFormBiography(e.target.value)}
                        placeholder="اكتب نبذة عن سيرته أو مآثره..."
                        className="w-full rounded-xl bg-[#FAF6F0] border border-[#B98A78]/50 p-3 text-xs text-[#252321]"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-[#252321] mb-1">
                          إرفاق وثيقة أو صك متعلق بالفرد:
                        </label>
                        <input
                          type="text"
                          value={formAttachedDocName}
                          onChange={(e) =>
                            setFormAttachedDocName(e.target.value)
                          }
                          placeholder="مثال: وثيقة قسمة إرث 1372 هـ"
                          className="w-full rounded-xl bg-[#FAF6F0] border border-[#B98A78]/50 px-3 py-2 text-xs text-[#252321]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#252321] mb-1">
                          رابط الصورة الشخصية الحقيقية (اختياري):
                        </label>
                        <input
                          type="url"
                          dir="ltr"
                          value={formPhotoUrl}
                          onChange={(e) => setFormPhotoUrl(e.target.value)}
                          placeholder="https://..."
                          className="w-full rounded-xl bg-[#FAF6F0] border border-[#B98A78]/50 px-3 py-2 text-xs text-[#252321]"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {formError && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2 text-xs font-bold text-red-700">
                  {formError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#B98A78]/30">
                <button
                  type="button"
                  onClick={() => setModalConfig(null)}
                  className="px-5 py-2.5 rounded-xl bg-[#F7F2E9] hover:bg-[#EDE6DA] text-xs font-display font-bold text-[#252321] cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isUploadingToVaultFromTree}
                  className="px-6 py-2.5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] disabled:opacity-60 text-white text-xs sm:text-sm font-display font-extrabold cursor-pointer shadow-sm"
                >
                  {isUploadingToVaultFromTree
                    ? 'جاري حفظ الملف المرفوع...'
                    : modalConfig.mode === 'edit'
                    ? 'حفظ التعديلات ✓'
                    : 'حفظ وإضافة للشجرة ✓'}
                </button>
              </div>
                  </>
                );
              })()}
            </form>
          </div>
        </div>
      )}

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
              هل تود إزالة{' '}
              <strong>«{pendingDeletePrompt.person.firstName}»</strong> من مشجرة العائلة؟
            </p>

            {pendingDeletePrompt.linkedDocsCount > 0 && (
              <div className="rounded-2xl bg-[#FAF6F0] border border-[#D4AF37] p-3.5 text-xs text-[#252321] leading-relaxed space-y-1">
                <div className="font-display font-extrabold text-[#8D4925]">
                  📎 تنبيه بخصوص الوثائق والصور المرتبطة ({pendingDeletePrompt.linkedDocsCount}):
                </div>
                <p>
                  سيتم تلقائياً فك ارتباط هذا الفرد من ({pendingDeletePrompt.linkedDocsCount}) وثيقة/صورة لمنع أي روابط يتيمة، مع بقاء الوثائق والصور نفسها محفوظة بأمان تام داخل «خزانتي».
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
                تأكيد الحذف وفك الارتباط
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
            ? `العائلة المباشرة (${cleanNaturalSpineName(result.familyName)})`
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
        treeMembers={people.map((p): ExportTreeMemberSummary => {
          const disp = getCleanCardDisplay(p);
          const metaBits: string[] = [];
          if (p.birthDateValue?.trim()) {
            metaBits.push(
              `${p.birthDateValue.trim()} ${
                p.birthCalendar === 'hijri' ? 'هـ' : 'م'
              }`
            );
          }
          if (p.vitalStatus === 'deceased') {
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
