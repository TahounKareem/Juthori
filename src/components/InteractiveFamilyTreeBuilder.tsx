import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowUp,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Crown,
  Download,
  Edit2,
  FileSignature,
  FileText,
  Heart,
  Lock,
  MapPin,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
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
  fetchUserFamilyTreeFromFirebase,
  saveUserFamilyTreeToFirebase,
} from '../services/firestoreService';

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
   * 0 = Sons / Daughters of Record Keeper
   * 1 = Record Keeper (أمين السجل) & spouses/siblings
   * 2 = Father & Mother
   * 3 = Grandfather (الجد الثاني)
   * 4 = Great-Grandfather (الجد الثالث)
   * 5 = 4th Grandfather (الجد الرابع)
   * 6 = 5th Grandfather (الجد الخامس — أقصى حد للتفرع الأفقي الكامل)
   * 7+ = 6th Grandfather and above (عمود رأسي مستقيم فقط نحو عمود النسب الطبيعي)
   */
  generationLevel: number;
  isRecordKeeper?: boolean;
  isDirectSpineLineage?: boolean;
  relationToTargetLabel: string;
  fatherId?: string;
  motherId?: string;
  motherNameFallback?: string;
  spouseIds: string[];
  vitalStatus: 'living' | 'deceased';
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
}

const ARABIC_ORDINAL_GRANDFATHER: Record<number, string> = {
  2: 'الأب المباشر',
  3: 'الجد الثاني',
  4: 'الجد الثالث',
  5: 'الجد الرابع',
  6: 'الجد الخامس',
  7: 'الجد السادس',
  8: 'الجد السابع',
  9: 'الجد الثامن',
  10: 'الجد التاسع',
  11: 'الجد العاشر',
  12: 'الجد الحادي عشر',
};

const getNextVerticalGrandfatherLabel = (nextLevel: number): string => {
  return ARABIC_ORDINAL_GRANDFATHER[nextLevel] || `الجد رقم ${nextLevel - 1}`;
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
}) => {
  // Build initial tree nodes from registration data (Auto-Initialization)
  const buildInitialTree = (): InteractiveTreePerson[] => {
    const { fatherFirst, grandfatherFirst } = parseInitialRegistrationAncestors(
      result.fatherName,
      result.grandfatherName
    );

    const nodes: InteractiveTreePerson[] = [];

    const recordKeeperId = 'node-record-keeper';
    const fatherId = fatherFirst ? 'node-auto-father' : undefined;
    const grandfatherId = grandfatherFirst ? 'node-auto-grandfather' : undefined;

    // 1. Record Keeper (أمين السجل — نقطة الانطلاق في الشجرة)
    nodes.push({
      id: recordKeeperId,
      firstName: result.clientName || 'المستخدم',
      familyName: result.familyName,
      kunya: fatherFirst ? `أبو ${fatherFirst}` : '',
      honorificTitle: 'بدون',
      gender: 'male',
      generationLevel: 1,
      isRecordKeeper: true,
      isDirectSpineLineage: true,
      relationToTargetLabel: 'أمين السجل',
      fatherId,
      spouseIds: [],
      vitalStatus: 'living',
      birthPrecision: 'year_only',
      birthCalendar: 'hijri',
      birthDateValue: '1410',
      birthPlace: result.originRegion || result.originCountry,
      femalePrivacyMasked: false,
      biography: `أمين سجل عائلة ${result.familyName} المعتمد في منصة جذوري.`,
      photoUrl: userAvatarUrl || undefined,
    });

    // 2. Auto-generated Father if provided during registration
    if (fatherFirst) {
      nodes.push({
        id: 'node-auto-father',
        firstName: fatherFirst,
        familyName: result.familyName,
        kunya: `أبو ${result.clientName}`,
        honorificTitle: 'بدون',
        gender: 'male',
        generationLevel: 2,
        isDirectSpineLineage: true,
        relationToTargetLabel: 'الأب المباشر',
        fatherId: grandfatherId,
        spouseIds: [],
        vitalStatus: 'living',
        birthPrecision: 'year_only',
        birthCalendar: 'hijri',
        birthDateValue: '1380',
        birthPlace: result.originRegion || result.originCountry,
        femalePrivacyMasked: false,
      });
    }

    // 3. Auto-generated Grandfather if provided during registration
    if (grandfatherFirst) {
      if (!fatherFirst) {
        nodes[0].fatherId = 'node-auto-father';
        nodes.push({
          id: 'node-auto-father',
          firstName: 'الأب',
          familyName: result.familyName,
          kunya: '',
          honorificTitle: 'بدون',
          gender: 'male',
          generationLevel: 2,
          isDirectSpineLineage: true,
          relationToTargetLabel: 'الأب المباشر',
          fatherId: 'node-auto-grandfather',
          spouseIds: [],
          vitalStatus: 'living',
          birthPrecision: 'year_only',
          birthCalendar: 'hijri',
          birthDateValue: '1380',
          birthPlace: result.originRegion || result.originCountry,
          femalePrivacyMasked: false,
        });
      }

      nodes.push({
        id: 'node-auto-grandfather',
        firstName: grandfatherFirst,
        familyName: result.familyName,
        kunya: fatherFirst ? `أبو ${fatherFirst}` : '',
        honorificTitle: 'الشيخ',
        gender: 'male',
        generationLevel: 3,
        isDirectSpineLineage: true,
        relationToTargetLabel: 'الجد الثاني',
        spouseIds: [],
        vitalStatus: 'deceased',
        birthPrecision: 'year_only',
        birthCalendar: 'hijri',
        birthDateValue: '1348',
        birthPlace: result.originRegion || result.originCountry,
        deathDateValue: '1422',
        deathPlace: result.originRegion || result.originCountry,
        femalePrivacyMasked: false,
      });
    }

    return nodes;
  };

  const [people, setPeople] = useState<InteractiveTreePerson[]>(buildInitialTree);

  useEffect(() => {
    let active = true;
    if (userId) {
      fetchUserFamilyTreeFromFirebase<InteractiveTreePerson>(userId)
        .then((savedNodes) => {
          if (!active) return;
          if (savedNodes && Array.isArray(savedNodes) && savedNodes.length > 0) {
            setPeople(
              savedNodes.map((node) =>
                node.isRecordKeeper && userAvatarUrl && !node.photoUrl
                  ? { ...node, photoUrl: userAvatarUrl }
                  : node
              )
            );
          } else {
            setPeople(buildInitialTree());
          }
        })
        .catch(() => {
          if (active) setPeople(buildInitialTree());
        });
    } else {
      setPeople(buildInitialTree());
    }
    return () => {
      active = false;
    };
  }, [result.familyName, result.clientName, userId]);

  // Sync Record Keeper photoUrl when user uploads a new profile avatar
  useEffect(() => {
    if (!userAvatarUrl) return;
    setPeople((prev) =>
      prev.map((node) =>
        node.isRecordKeeper ? { ...node, photoUrl: userAvatarUrl } : node
      )
    );
  }, [userAvatarUrl]);

  // Persist family tree nodes to Firebase whenever modified
  useEffect(() => {
    if (userId && people.length > 0) {
      saveUserFamilyTreeToFirebase(userId, result.familyName, people).catch(() => {});
    }
  }, [people, userId, result.familyName]);

  // Display Depth Selector State (محدّد مدى العرض فوق الشجرة)
  const [spineDepth, setSpineDepth] = useState<TreeSpineDepthMode>(
    caps.isVip ? 'adam_full' : 'sub_branch'
  );

  useEffect(() => {
    if (caps.isVip) {
      setSpineDepth('adam_full');
    }
  }, [caps.isVip]);

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
  } | null>(null);

  const [formGender, setFormGender] = useState<'male' | 'female'>('male');
  const [formFirstName, setFormFirstName] = useState('');
  const [formFamilyName, setFormFamilyName] = useState(result.familyName);
  const [formKunya, setFormKunya] = useState('');
  const [formHonorific, setFormHonorific] =
    useState<ArabicHonorificTitle>('بدون');
  const [formMotherId, setFormMotherId] = useState<string>('');
  const [formVitalStatus, setFormVitalStatus] = useState<'living' | 'deceased'>(
    'living'
  );
  const [formBirthPrecision, setFormBirthPrecision] = useState<
    'year_only' | 'full_date'
  >('year_only');
  const [formBirthCalendar, setFormBirthCalendar] = useState<
    'hijri' | 'gregorian'
  >('hijri');
  const [formBirthDate, setFormBirthDate] = useState('');
  const [formBirthPlace, setFormBirthPlace] = useState(
    result.originRegion || result.originCountry
  );
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
    setFormError('');

    const isFemaleRelation =
      relationKind === 'mother' ||
      relationKind === 'sister' ||
      relationKind === 'daughter' ||
      (relationKind === 'spouse' && targetNode.gender === 'male');

    setFormGender(isFemaleRelation ? 'female' : 'male');
    setFormFirstName('');
    setFormFamilyName(
      relationKind === 'mother' || relationKind === 'spouse'
        ? ''
        : targetNode.familyName || result.familyName
    );
    setFormKunya(
      relationKind === 'father' || relationKind === 'vertical_ancestor'
        ? `أبو ${targetNode.firstName}`
        : relationKind === 'mother'
        ? `أم ${targetNode.firstName}`
        : ''
    );
    setFormHonorific(
      relationKind === 'vertical_ancestor' ||
        (relationKind === 'father' && targetNode.generationLevel >= 3)
        ? 'الشيخ'
        : 'بدون'
    );

    let candidateWives: InteractiveTreePerson[] = [];
    if (relationKind === 'son' || relationKind === 'daughter') {
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
    } else if (relationKind === 'brother' || relationKind === 'sister') {
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

    const isHistorical =
      relationKind === 'vertical_ancestor' ||
      (relationKind === 'father' && targetNode.generationLevel >= 3) ||
      (relationKind === 'mother' && targetNode.generationLevel >= 3);

    setFormVitalStatus(isHistorical ? 'deceased' : 'living');
    setFormBirthPrecision('year_only');
    setFormBirthCalendar('hijri');
    setFormBirthDate('');
    setFormBirthPlace(
      targetNode.birthPlace || result.originRegion || result.originCountry
    );
    setFormDeathDate('');
    setFormDeathPlace('');
    setFormFemalePrivacyMasked(isFemaleRelation);
    setFormContactInfo('');
    setFormBiography('');
    setFormAttachedDocName('');
    setFormPhotoUrl('');
    setShowMoreBioSection(false);

    setModalConfig({
      mode: 'add',
      targetNodeId: targetNode.id,
      relationKind,
    });
  };

  const openEditPersonModal = (person: InteractiveTreePerson) => {
    setRadialTargetNodeId(null);
    setFormError('');
    setFormGender(person.gender);
    setFormFirstName(person.firstName);
    setFormFamilyName(person.familyName);
    setFormKunya(person.kunya);
    setFormHonorific(person.honorificTitle);
    setFormMotherId(person.motherId || '');
    setFormVitalStatus(person.vitalStatus);
    setFormBirthPrecision(person.birthPrecision);
    setFormBirthCalendar(person.birthCalendar);
    setFormBirthDate(person.birthDateValue);
    setFormBirthPlace(person.birthPlace);
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
    const target = findPerson(modalConfig.targetNodeId);
    if (!target) return null;

    if (modalConfig.mode === 'edit') {
      return {
        title: `تعديل بيانات ${target.firstName} ${target.familyName}`,
        subtitle: `شجرة عائلة ${result.familyName}`,
        showMotherSelector: false,
        motherOptions: [] as InteractiveTreePerson[],
      };
    }

    const rel = modalConfig.relationKind!;
    const relationTitleMap: Record<RelativeRelationKind, string> = {
      father: `إضافة الأب لـ ${target.firstName}`,
      mother: `إضافة الأم لـ ${target.firstName}`,
      vertical_ancestor: `إضافة الجد الأعلى لـ ${target.firstName}`,
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

    const cleanFirst = formFirstName.trim();
    if (!cleanFirst) {
      setFormError('يرجى إدخال الاسم الأول لحفظ الفرد في الشجرة');
      return;
    }

    const cleanFamily = formFamilyName.trim() || result.familyName;

    if (modalConfig.mode === 'edit' && modalConfig.editPersonId) {
      setPeople((prev) => {
        const updated = prev.map((p) =>
          p.id === modalConfig.editPersonId
            ? {
                ...p,
                firstName: cleanFirst,
                familyName: cleanFamily,
                kunya: formKunya.trim(),
                honorificTitle: formHonorific,
                gender: formGender,
                motherId: formMotherId || p.motherId,
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
                  formGender === 'female' ? formFemalePrivacyMasked : false,
                contactInfo:
                  formVitalStatus === 'living' ? formContactInfo.trim() : undefined,
                biography: formBiography.trim(),
                attachedDocName: formAttachedDocName.trim() || undefined,
                photoUrl: formPhotoUrl.trim() || p.photoUrl,
              }
            : p
        );

        const rk = updated.find((u) => u.isRecordKeeper);
        const fNode = rk?.fatherId
          ? updated.find((u) => u.id === rk.fatherId)
          : undefined;
        const gNode = fNode?.fatherId
          ? updated.find((u) => u.id === fNode.fatherId)
          : undefined;
        if (onSyncImmediateParents) {
          onSyncImmediateParents(
            fNode?.firstName || '',
            gNode?.firstName || ''
          );
        }

        return updated;
      });

      onLogActivity(
        'تحديث بيانات فرد في شجرتي',
        `تم تعديل بيانات «${cleanFirst} ${cleanFamily}» في شجرة الأسرة`
      );
      setModalConfig(null);
      return;
    }

    const target = findPerson(modalConfig.targetNodeId);
    const rel = modalConfig.relationKind;
    if (!target || !rel) return;

    const newId = `node-${Date.now()}`;

    let nextGenLevel = target.generationLevel;
    let isDirectSpineLineage = false;
    let relationLabel = '';
    let assignedFatherId: string | undefined;
    let assignedMotherId: string | undefined = formMotherId || undefined;
    let assignedSpouseIds: string[] = [];

    if (rel === 'father' || rel === 'vertical_ancestor') {
      nextGenLevel = target.generationLevel + 1;
      isDirectSpineLineage = Boolean(target.isDirectSpineLineage);
      relationLabel = getNextVerticalGrandfatherLabel(nextGenLevel);
      if (target.motherId) {
        assignedSpouseIds = [target.motherId];
      }
    } else if (rel === 'mother') {
      nextGenLevel = target.generationLevel + 1;
      relationLabel = `والدة ${target.firstName}`;
      if (target.fatherId) {
        assignedSpouseIds = [target.fatherId];
      }
    } else if (rel === 'spouse') {
      nextGenLevel = target.generationLevel;
      relationLabel =
        formGender === 'female'
          ? `زوجة ${target.firstName}`
          : `زوج ${target.firstName}`;
      assignedSpouseIds = [target.id];
    } else if (rel === 'brother' || rel === 'sister') {
      nextGenLevel = target.generationLevel;
      relationLabel =
        rel === 'brother'
          ? `أخ لـ ${target.firstName}`
          : `أخت لـ ${target.firstName}`;
      assignedFatherId = target.fatherId;
      assignedMotherId = formMotherId || target.motherId;
    } else if (rel === 'son' || rel === 'daughter') {
      nextGenLevel = target.generationLevel - 1;
      relationLabel =
        rel === 'son'
          ? `ابن ${target.firstName}`
          : `ابنة ${target.firstName}`;
      if (target.gender === 'male') {
        assignedFatherId = target.id;
        assignedMotherId = formMotherId || target.spouseIds[0];
      } else {
        assignedMotherId = target.id;
        assignedFatherId = target.spouseIds[0];
      }
    }

    const newPerson: InteractiveTreePerson = {
      id: newId,
      firstName: cleanFirst,
      familyName: cleanFamily,
      kunya: formKunya.trim(),
      honorificTitle: formHonorific,
      gender: formGender,
      generationLevel: nextGenLevel,
      isDirectSpineLineage,
      relationToTargetLabel: relationLabel,
      fatherId: assignedFatherId,
      motherId: assignedMotherId,
      spouseIds: assignedSpouseIds,
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
        formGender === 'female' ? formFemalePrivacyMasked : false,
      contactInfo:
        formVitalStatus === 'living' ? formContactInfo.trim() : undefined,
      biography: formBiography.trim() || undefined,
      attachedDocName: formAttachedDocName.trim() || undefined,
      photoUrl: formPhotoUrl.trim() || undefined,
    };

    setPeople((prev) => {
      let updated = [...prev];

      if ((rel === 'brother' || rel === 'sister') && !target.fatherId) {
        const autoFatherId = `node-father-shared-${Date.now()}`;
        const inferredFatherName =
          parseInitialRegistrationAncestors(result.fatherName).fatherFirst ||
          `والد ${target.firstName}`;
        const sharedFather: InteractiveTreePerson = {
          id: autoFatherId,
          firstName: inferredFatherName,
          familyName: target.familyName,
          kunya: `أبو ${target.firstName}`,
          honorificTitle: 'بدون',
          gender: 'male',
          generationLevel: target.generationLevel + 1,
          isDirectSpineLineage: Boolean(target.isDirectSpineLineage),
          relationToTargetLabel: getNextVerticalGrandfatherLabel(
            target.generationLevel + 1
          ),
          spouseIds: target.motherId ? [target.motherId] : [],
          vitalStatus: 'living',
          birthPrecision: 'year_only',
          birthCalendar: 'hijri',
          birthDateValue: '',
          birthPlace: target.birthPlace,
          femalePrivacyMasked: false,
        };
        newPerson.fatherId = autoFatherId;
        updated = updated.map((p) =>
          p.id === target.id ? { ...p, fatherId: autoFatherId } : p
        );
        updated.push(sharedFather);
      }

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
          (rel === 'father' || rel === 'vertical_ancestor') &&
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

    onLogActivity(
      'إضافة فرد جديد في شجرتي',
      `تمت إضافة «${cleanFirst} ${cleanFamily}»`
    );
    setModalConfig(null);
  };

  const handleDeleteNode = (person: InteractiveTreePerson) => {
    if (person.isRecordKeeper) return;
    setPeople((prev) =>
      prev
        .filter((p) => p.id !== person.id)
        .map((p) => ({
          ...p,
          fatherId: p.fatherId === person.id ? undefined : p.fatherId,
          motherId: p.motherId === person.id ? undefined : p.motherId,
          spouseIds: p.spouseIds.filter((s) => s !== person.id),
        }))
    );
    onLogActivity(
      'حذف عقدة من شجرتي',
      `تمت إزالة «${person.firstName} ${person.familyName}» من المشجرة`
    );
  };

  /**
   * Formats card display strictly to:
   * Name + Title/Kunya + Birth Year or "رحمه الله"
   * And applies Female Privacy Setting automatically and quietly when enabled on that node.
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
      const maskedName = person.kunya
        ? person.kunya
        : father
        ? `كريمة ${father.firstName} ${person.familyName}`
        : `كريمة آل ${person.familyName || result.familyName}`;
      return {
        mainName: maskedName,
        kunyaOrTitle: person.familyName ? `آل ${person.familyName}` : '',
        isMaskedNow: true,
      };
    }

    return {
      mainName: `${honorificPrefix}${person.firstName} ${person.familyName}`.trim(),
      kunyaOrTitle: person.kunya ? person.kunya : '',
      isMaskedNow: false,
    };
  };

  // ============================================================================
  // ACCESS CONTROL GATE (Requires VIP + Record Keeper Legal Charter)
  // ============================================================================
  if (!caps.isVip || accountType !== AccountLegalType.RecordKeeper) {
    return (
      <div className="rounded-3xl bg-white border-2 border-[#B98A78]/50 p-6 sm:p-10 shadow-sm text-right space-y-6">
        <div className="max-w-2xl mx-auto text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[#252321] text-[#D8755B] flex items-center justify-center mx-auto shadow-md">
            <FileSignature className="w-8 h-8" />
          </div>
          <h2 className="text-xl sm:text-3xl font-display font-extrabold text-[#252321]">
            شجرة عائلة {result.familyName}
          </h2>
          <p className="text-xs sm:text-sm text-[#252321]/75 leading-relaxed">
            يُفتح نظام بناء الشجرة التفاعلي للمشتركين في الباقة السنوية (بريميوم) والحاملين لصفة <strong>«رب أسرة / أمين السجل»</strong> بعد التوقيع الإلكتروني على ميثاق أمانة النسب.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-right pt-2">
            <div
              className={`rounded-2xl p-4 border-2 ${
                caps.isVip
                  ? 'bg-[#FAF6F0] border-[#8D4925]/40'
                  : 'bg-[#FFF8F0] border-[#D8755B]'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-display font-bold text-[#252321]">
                  1. الباقة السنوية الشاملة (VIP)
                </span>
                {caps.isVip ? (
                  <span className="text-[11px] font-bold text-[#8D4925]">
                    مفعّلة ✓
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-[#D8755B]">
                    مطلوبة ($60/سنة)
                  </span>
                )}
              </div>
              <p className="text-xs text-[#252321]/70 leading-relaxed mb-3">
                تفتح المحطات الموثقة في عمود النسب + التبويبات الخمسة + رصيد محفظة $25 هدية.
              </p>
              {!caps.isVip && (
                <button
                  type="button"
                  onClick={onUpgradeAnnualVip}
                  className="w-full py-2 px-4 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-display font-bold cursor-pointer"
                >
                  ترقية للباقة السنوية الآن ($60)
                </button>
              )}
            </div>

            <div
              className={`rounded-2xl p-4 border-2 ${
                accountType === AccountLegalType.RecordKeeper
                  ? 'bg-[#FAF6F0] border-[#8D4925]/40'
                  : 'bg-[#FFF8F0] border-[#D8755B]'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-display font-bold text-[#252321]">
                  2. ميثاق أمين السجل القانوني
                </span>
                {accountType === AccountLegalType.RecordKeeper ? (
                  <span className="text-[11px] font-bold text-[#8D4925]">
                    موقّع ✓
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-[#D8755B]">
                    مجاني · توقيع فوري
                  </span>
                )}
              </div>
              <p className="text-xs text-[#252321]/70 leading-relaxed mb-3">
                إقرار بصحة البيانات المدخلة للأبناء والزوجات والأجداد في سجل الأسرة.
              </p>
              {accountType !== AccountLegalType.RecordKeeper && (
                <button
                  type="button"
                  onClick={onSignCharterAndEnableTree}
                  className="w-full py-2 px-4 rounded-xl bg-[#252321] hover:bg-[#3a3734] text-white text-xs font-display font-bold cursor-pointer"
                >
                  التوقيع الإلكتروني وتفعيل أمين السجل ✓
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

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

  const renderNaturalLineageSpineAboveTree = () => {
    // Determine max orderNumber to include based on spineDepth
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
    const firstUpperEntry = ascendingUpperEntries[0];

    return (
      <div className="w-full max-w-[420px] mx-auto flex flex-col items-center">
        {/* Case 2: Alpha-only family before researcher merge */}
        {result.isAlphaOnlyBeforeMerge &&
          (spineDepth === 'historical_stock' || spineDepth === 'adam_full') && (
            <div className="w-full mb-3 rounded-2xl bg-[#FAF5EC] border-2 border-[#D4AF37]/80 p-3.5 text-right text-xs text-[#252321]/85 space-y-1 shadow-2xs">
              <div className="font-display font-extrabold text-[#252321]">
                ⏳ جاري استكمال ربط وتوثيق الطبقات العليا حتى آدم عليه السلام
              </div>
              <p className="text-[11px] leading-relaxed">
                باقتك السنوية مفعّلة — يعمل فريق النسابين حالياً على المراجعة النهائية لوصل ({result.rootTribeName}) بعمودها التاريخي الأعلى، وستظهر العُقد المفتوحة هنا تلقائياً فور اعتمادها.
              </p>
            </div>
          )}

        {/* Case 3: Unmatched family with active P1 research ticket */}
        {!result.matched && spineDepth !== 'family' && (
          <div className="w-full mb-3 rounded-2xl bg-[#FAF5EC] border-2 border-[#8D4925]/70 p-3.5 text-right text-xs text-[#252321]/85 space-y-1 shadow-2xs">
            <div className="font-display font-extrabold text-[#252321]">
              🔍 تذكرة بحث وتوثيق نشطة لدى فريق الباحثين — جاري استخراج وتوثيق عمود نسب العائلة
            </div>
            <p className="text-[11px] leading-relaxed">
              تظهر عُقد عمود النسب الأعلى هنا تلقائياً فور اعتماد فريق الباحثين لتذكرة عائلة ({result.familyName}).
            </p>
          </div>
        )}

        {/* Top-to-Bottom Upper Spine Nodes */}
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

        {/* Connector between lowest Upper Spine entry and Family Station Node */}
        {topToBottomEntries.length > 0 &&
          renderSpineConnectorBadge(
            firstUpperEntry?.kind === 'node'
              ? resolveSpineConnectorLabel(
                  spineNodes[0],
                  firstUpperEntry.node,
                  firstUpperEntry.node.orderNumber - spineNodes[0].orderNumber > 1
                )
              : 'من (سليل غير مباشر)'
          )}

        {/* Base of Natural Lineage Spine: Family Station Node (عقدة العائلة) */}
        {renderFamilyStationCard()}

        {/* Natural Connector from Topmost Family Tree Ancestor to Family Station Node */}
        {renderSpineConnectorBadge('من (سليل غير مباشر)')}
      </div>
    );
  };

  // ============================================================================
  // RENDER PERSON CARD (Strictly: Name + Title/Kunya + Birth Year or "رحمه الله")
  // ============================================================================
  const renderPersonCard = (person: InteractiveTreePerson) => {
    const isRadialOpen = radialTargetNodeId === person.id;
    const { mainName, kunyaOrTitle, isMaskedNow } = getCleanCardDisplay(person);
    const isWithinFifthGrandfather = person.generationLevel <= 6;
    const canAddParentsBranching = person.generationLevel < 6;
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

    // Build clean single-line date / mercy text (Birth Year or "رحمه الله")
    const dateAndStatusParts: string[] = [];
    if (person.birthDateValue) {
      dateAndStatusParts.push(
        `${person.birthDateValue} ${
          person.birthCalendar === 'hijri' ? 'هـ' : 'م'
        }`
      );
    }
    if (person.vitalStatus === 'deceased') {
      dateAndStatusParts.push('رحمه الله');
    }
    const cleanMetaLine = dateAndStatusParts.join(' · ');

    return (
      <div
        key={person.id}
        className={`relative group transition-all ${
          isRadialOpen ? 'z-40' : 'z-10'
        }`}
      >
        <div
          className={`w-[245px] sm:w-[265px] rounded-2xl p-3.5 text-right transition-all shadow-sm relative ${
            person.isRecordKeeper
              ? 'bg-gradient-to-br from-[#FFFDF9] via-white to-[#FAF3E8] border-2 border-[#252321] ring-4 ring-[#D8755B]/20 shadow-md'
              : person.gender === 'female'
              ? 'bg-gradient-to-br from-[#FFFDFB] to-[#FAF3EE] border-2 border-[#B98A78]/70'
              : person.generationLevel >= 4
              ? 'bg-gradient-to-br from-[#FAF6F0] to-[#EFE6D5] border-2 border-[#8D4925]/75'
              : 'bg-white border-2 border-[#B98A78]/55 hover:border-[#8D4925]'
          }`}
        >
          {/* Subtle Edit / Delete Actions in Top-Left Corner */}
          <div className="flex items-center justify-between gap-1 mb-2">
            <div>
              {person.isRecordKeeper && (
                <span className="text-[10px] font-display font-bold text-[#8D4925]">
                  أمين السجل
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => openEditPersonModal(person)}
                title="تعديل بيانات الفرد"
                className="w-6 h-6 rounded-lg bg-[#F7F2E9] hover:bg-[#D8755B] text-[#252321] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              {!person.isRecordKeeper && (
                <button
                  type="button"
                  onClick={() => handleDeleteNode(person)}
                  title="حذف العقدة"
                  className="w-6 h-6 rounded-lg bg-[#F7F2E9] hover:bg-red-700 text-[#252321]/60 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Center Row: Warm Sepia & Charcoal Cameo Avatar + Camera + Strictly Clean Info */}
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <HeritageNodeAvatar
                personRole={avatarPersonRole}
                gender={person.gender}
                customImageUrl={person.photoUrl}
                isPrivacyMasked={isMaskedNow}
                size="md"
              />

              <button
                type="button"
                onClick={() => {
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
              {/* 1. Name */}
              <div className="text-sm font-display font-extrabold text-[#252321] truncate">
                {mainName}
              </div>

              {/* 2. Title / Kunya */}
              {kunyaOrTitle && (
                <div className="text-xs font-semibold text-[#8D4925] truncate">
                  {kunyaOrTitle}
                </div>
              )}

              {/* 3. Birth Year or "رحمه الله" */}
              {cleanMetaLine && (
                <div className="text-[11px] font-medium text-[#252321]/70 tabular-nums">
                  {cleanMetaLine}
                </div>
              )}
            </div>
          </div>

          {/* Prominent Circular (+) Button at the Bottom of the Card */}
          <div className="mt-3 flex justify-center -mb-6 relative z-20">
            <button
              type="button"
              onClick={() =>
                setRadialTargetNodeId((cur) =>
                  cur === person.id ? null : person.id
                )
              }
              title="إضافة قريب (+)"
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
        </div>

        {/* ================================================================== */}
        {/* RADIAL NODE QUICK-SELECTOR OVERLAY (القائمة الدائرية السريعة حول العقدة) */}
        {/* ================================================================== */}
        {isRadialOpen && (
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

            {/* 1. TOP: Father & Mother (within 5th Grandfather limit) OR Upper Ancestor */}
            <div className="space-y-1.5">
              {canAddParentsBranching ? (
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
                <div>
                  {!hasFather ? (
                    <button
                      type="button"
                      onClick={() =>
                        openAddRelativeModal(person, 'vertical_ancestor')
                      }
                      className="w-full py-2 px-3 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-display font-bold text-center cursor-pointer"
                    >
                      + إضافة الجد الأعلى
                    </button>
                  ) : (
                    <div className="py-1.5 px-2 rounded-xl bg-white/5 text-white/50 text-[11px] text-center">
                      الجد الأعلى مضاف ✓
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. RIGHT & LEFT: Siblings (Right) & Spouse/Partner (Left) */}
            {isWithinFifthGrandfather && (
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/10">
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

                <div>
                  <button
                    type="button"
                    onClick={() => openAddRelativeModal(person, 'spouse')}
                    className="w-full h-full min-h-[58px] rounded-xl bg-[#8D4925] hover:bg-[#D8755B] text-white text-xs font-display font-bold cursor-pointer transition-colors flex items-center justify-center px-2"
                  >
                    <span>+ إضافة زوجة / شريك</span>
                  </button>
                </div>
              </div>
            )}

            {/* 3. BOTTOM: Son & Daughter */}
            {isWithinFifthGrandfather && (
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => openAddRelativeModal(person, 'son')}
                  className="py-2 px-2.5 rounded-xl bg-white/15 hover:bg-[#D8755B] text-white text-xs font-display font-bold text-center cursor-pointer transition-colors"
                >
                  + إضافة ابن
                </button>
                <button
                  type="button"
                  onClick={() => openAddRelativeModal(person, 'daughter')}
                  className="py-2 px-2.5 rounded-xl bg-white/15 hover:bg-[#B98A78] text-white text-xs font-display font-bold text-center cursor-pointer transition-colors"
                >
                  + إضافة ابنة
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // RENDER DASHED PLACEHOLDER CARDS ABOVE ANY LINEAGE NODE MISSING FATHER/MOTHER
  // Strictly "+ إضافة الأب" and "+ إضافة الأم" without extra explanatory text
  // ============================================================================
  const renderDashedParentPlaceholders = (childNode: InteractiveTreePerson) => {
    if (childNode.generationLevel >= 6) return null;

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
                + إضافة الأب
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
  // RENDER FULL GENERATION ROW (Node + Mother/Wives + Siblings)
  // ============================================================================
  const renderLineageGenerationBlock = (spineNode: InteractiveTreePerson) => {
    const isAboveFifthGrandfather = spineNode.generationLevel >= 7;
    const motherNode = spineNode.motherId
      ? findPerson(spineNode.motherId)
      : undefined;

    const wives = spineNode.spouseIds
      .map((id) => findPerson(id))
      .filter((w): w is InteractiveTreePerson => Boolean(w));

    const siblings = people.filter(
      (p) =>
        p.id !== spineNode.id &&
        !p.isDirectSpineLineage &&
        p.generationLevel === spineNode.generationLevel &&
        ((spineNode.fatherId && p.fatherId === spineNode.fatherId) ||
          p.relationToTargetLabel.includes(spineNode.firstName)) &&
        !spineNode.spouseIds.includes(p.id)
    );

    return (
      <div
        key={spineNode.id}
        className="flex flex-col items-center w-full relative"
      >
        {spineNode.id === topMostDirectAncestor?.id &&
          spineNode.generationLevel < 6 &&
          renderDashedParentPlaceholders(spineNode)}

        {/* Horizontal Row: Siblings (Right) + Spine Node (Center) + Wives/Spouses (Left) */}
        <div className="flex flex-wrap items-start justify-center gap-5 w-full">
          {!isAboveFifthGrandfather && siblings.length > 0 && (
            <div className="flex flex-wrap items-start justify-center gap-3 bg-[#FAF6F0]/90 border border-[#B98A78]/40 rounded-2xl p-3">
              <div className="w-full text-[10px] font-display font-bold text-[#8D4925] text-center mb-1">
                الإخوة والأخوات ({siblings.length})
              </div>
              {siblings.map((sib) => renderPersonCard(sib))}
            </div>
          )}

          {/* Center: Main Lineage Node */}
          <div className="flex flex-col items-center">
            {renderPersonCard(spineNode)}

            {spineNode.generationLevel < 6 &&
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

          {!isAboveFifthGrandfather && wives.length > 0 && (
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
      p.generationLevel === 0 ||
      (recordKeeperNode &&
        (p.fatherId === recordKeeperNode.id ||
          p.motherId === recordKeeperNode.id))
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
      label: 'حتى العائلة',
      detail: result.familyName,
      locked: false,
    },
    {
      id: 'sub_branch',
      label: 'حتى الفرع الجامع',
      detail: depthMilestones.subBranchLabel,
      locked: !caps.isRootUnlocked && !caps.isVip,
    },
    {
      id: 'mother_tribe',
      label: 'حتى القبيلة الأم',
      detail: depthMilestones.motherTribeLabel,
      locked: !caps.isRootUnlocked && !caps.isVip,
    },
    {
      id: 'historical_stock',
      label: 'حتى الجذم التاريخي',
      detail: depthMilestones.historicalStockLabel,
      locked: !caps.isVip && !caps.areUpperAncestorsUnlocked,
    },
    {
      id: 'adam_full',
      label: 'حتى آدم عليه السلام',
      detail: 'العمود الكامل',
      locked: !caps.isVip && !caps.areUpperAncestorsUnlocked,
    },
  ];

  const [agreedToLegalCharter, setAgreedToLegalCharter] = useState(true);

  if (accountType !== AccountLegalType.RecordKeeper) {
    return (
      <div className="max-w-2xl mx-auto py-4 sm:py-8 text-right">
        <div className="rounded-3xl bg-white border-2 border-[#D8755B]/65 p-5 sm:p-8 shadow-xl space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-2.5 h-full bg-[#D8755B]" />

          <div className="flex items-start gap-4 pr-2">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#D8755B]/15 border border-[#D8755B]/35 text-[#D8755B] flex items-center justify-center shrink-0">
              <FileSignature className="w-6 h-6 sm:w-7 sm:h-7" aria-hidden="true" />
            </div>
            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF3EA] border border-[#D8755B]/35 text-[#8D4925] text-xs font-display font-bold">
                <span>🏛️ الترقية القانونية المجانية لبناء المشجرة</span>
              </span>
              <h2 className="text-lg sm:text-2xl font-display font-extrabold text-[#252321] leading-snug">
                وثيقة الإقرار والمواثيق القانونية لأمين السجل (رب الأسرة)
              </h2>
              <p className="text-xs sm:text-sm text-[#252321]/75 leading-relaxed">
                حسابك مسجّل حالياً كـ <strong>«حساب فرد»</strong>. للبدء ببناء وتفرع شجرة عائلة{' '}
                <strong>({result.familyName})</strong> التفاعلية، يرجى الموافقة والتوقيع إلكترونياً على ميثاق أمين السجل لتحويل حسابك فوراً إلى <strong>«أمين السجل»</strong>.
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-[#FAF6F0] border border-[#B98A78]/45 p-4 sm:p-5 text-xs sm:text-sm text-[#252321]/90 space-y-2.5 leading-relaxed mr-2">
            <div className="font-display font-extrabold text-[#252321] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#D8755B] shrink-0" />
              <span>بنود ميثاق أمين السجل المعتمدة في منصة جذوري:</span>
            </div>
            <p>
              1. <strong>صحة البيانات النسبية:</strong> أقرّ بصحة ودقة بيانات الأفراد والآباء والأبناء والفروع الذين أقوم بإضافتهم في مشجرة الأسرة المباشرة على مسؤوليتي الأدبية والقانونية.
            </p>
            <p>
              2. <strong>حماية الخصوصية العائلية:</strong> ألتزم باحترام خصوصية الأحياء وتطبيق خيارات حجب الأسماء أو البيانات الخاصة وفق رغبة الأسرة وأعرافها.
            </p>
            <p>
              3. <strong>التدقيق والتوثيق الأعلى:</strong> تخضع طلبات وصل الفروع العليا بعمود النسب التاريخي لمراجعة واعتماد فريق الباحثين والنسابين في منصة جذوري.
            </p>
          </div>

          <label className="flex items-start gap-3 pr-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={agreedToLegalCharter}
              onChange={(e) => setAgreedToLegalCharter(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-[#B98A78] text-[#D8755B] focus:ring-[#D8755B] cursor-pointer"
            />
            <span className="text-xs sm:text-sm font-display font-bold text-[#252321]">
              أقرّ بأنني قرأت بنود وثيقة الإقرار والمواثيق القانونية وأوافق عليها بصفتي أمين سجل العائلة.
            </span>
          </label>

          <div className="pt-1 pr-2">
            <button
              type="button"
              disabled={!agreedToLegalCharter}
              onClick={onSignCharterAndEnableTree}
              className="w-full min-h-[46px] py-3.5 px-6 rounded-2xl bg-[#D8755B] hover:bg-[#c5644b] disabled:opacity-50 text-white font-display font-extrabold text-sm sm:text-base inline-flex items-center justify-center gap-2.5 transition-colors cursor-pointer shadow-md"
            >
              <CheckCircle2 className="w-5 h-5 shrink-0" aria-hidden="true" />
              <span>الموافقة والتوقيع الإلكتروني — التحول إلى «أمين السجل» وبدء بناء المشجرة</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-right">
      {/* ==================================================================== */}
      {/* 1. CLEAN TOP HEADER BAR & DISPLAY DEPTH SELECTOR                      */}
      {/* ==================================================================== */}
      <div className="rounded-3xl bg-white border border-[#B98A78]/45 p-4 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg sm:text-2xl font-display font-extrabold text-[#252321]">
            شجرة عائلة {result.familyName}
          </h2>

          {/* Toolbar Actions: Zoom + Export (Confusing privacy preview toggle removed) */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div className="inline-flex items-center rounded-xl bg-[#FAF6F0] border border-[#B98A78]/45 p-1">
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

            <button
              type="button"
              onClick={() => {
                setExportedBanner(true);
                onLogActivity(
                  'تصدير مشجرة العائلة التفاعلية',
                  `تصدير شجرة عائلة ${result.familyName} (${people.length} فرداً)`
                );
              }}
              className="px-4 py-2 rounded-xl bg-[#252321] hover:bg-[#3a3734] text-white text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تصدير المشجرة</span>
            </button>
          </div>
        </div>

        {/* Display Depth Selector (محدّد مدى العرض: عرض الشجرة من أمين السجل وحتى:) */}
        <div className="pt-4 border-t border-[#B98A78]/25 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <span className="text-xs sm:text-sm font-display font-bold text-[#252321] shrink-0">
            عرض الشجرة من أمين السجل وحتى:
          </span>

          <div
            role="group"
            aria-label="عرض الشجرة من أمين السجل وحتى"
            className="flex items-center gap-2 overflow-x-auto no-scrollbar whitespace-nowrap touch-pan-x pb-1 sm:pb-0 sm:flex-wrap"
          >
            {DEPTH_SELECTOR_OPTIONS.map((opt) => {
              const isSelected = spineDepth === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectSpineDepth(opt.id, opt.label)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-display font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 border shrink-0 ${
                    isSelected
                      ? 'bg-[#252321] text-[#F7F2E9] border-[#252321] shadow-xs'
                      : 'bg-[#FAF6F0] hover:bg-[#EDE6DA] text-[#252321] border-[#B98A78]/45'
                  }`}
                >
                  <span>{opt.label}</span>
                  <span
                    className={`text-[10px] font-normal ${
                      isSelected ? 'text-[#F3D299]' : 'text-[#8D4925]'
                    }`}
                  >
                    ({opt.detail})
                  </span>
                  {opt.locked && (
                    <Lock className="w-3 h-3 text-[#D8755B] shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

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
      {/* 2. INTERACTIVE TREE CANVAS CONNECTED TO NATURAL LINEAGE SPINE        */}
      {/* ==================================================================== */}
      <div
        className="rounded-3xl border-2 border-[#B98A78]/45 p-3 sm:p-8 shadow-sm relative overflow-x-auto touch-pan-x touch-pan-y scroll-smooth"
        style={{
          backgroundColor: '#FAF6F0',
          backgroundImage: 'radial-gradient(#B98A78 1.15px, transparent 1.15px)',
          backgroundSize: '24px 24px',
        }}
      >
        <div
          className="flex flex-col items-center min-w-[300px] mx-auto transition-transform origin-top"
          style={{
            transform: `scale(${zoomPercent / 100})`,
          }}
        >
          {/* ================================================================ */}
          {/* A. NATURAL LINEAGE SPINE ABOVE THE FAMILY TREE                   */}
          {/* (Directly connected to the top of the family tree)               */}
          {/* ================================================================ */}
          {renderNaturalLineageSpineAboveTree()}

          {/* ================================================================ */}
          {/* B. CLEAN DASHED BUTTON ABOVE 5TH GRANDFATHER: "+ إضافة الجد الأعلى" */}
          {/* ================================================================ */}
          <div className="mb-4 flex flex-col items-center">
            <button
              type="button"
              onClick={() => {
                if (!topMostDirectAncestor) return;
                openAddRelativeModal(
                  topMostDirectAncestor,
                  topMostDirectAncestor.generationLevel >= 6
                    ? 'vertical_ancestor'
                    : 'father'
                );
              }}
              className="px-6 py-2.5 rounded-2xl bg-[#FFFDF9] hover:bg-white border-2 border-dashed border-[#D8755B] text-xs sm:text-sm font-display font-extrabold text-[#252321] hover:text-[#D8755B] shadow-2xs transition-all cursor-pointer"
            >
              + إضافة الجد الأعلى
            </button>
            <div className="w-0.5 h-5 bg-[#8D4925]/45 mt-1" />
          </div>

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
                  اضغط على زر (+) لإضافة الأبناء والبنات.
                </p>
              ) : (
                <div className="flex flex-wrap items-start justify-center gap-4 pt-1">
                  {recordKeeperChildren.map((child) => renderPersonCard(child))}
                </div>
              )}
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

            <form onSubmit={handleSavePersonModal} className="space-y-4">
              {/* Gender Selection */}
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

              {/* Arabic Name, Family Name, Kunya & Honorific Title */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-display font-bold text-[#252321] mb-1">
                    الاسم الأول <span className="text-[#D8755B]">*</span>
                  </label>
                  <input
                    type="text"
                    required
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
                    اسم العائلة / الشهرة
                  </label>
                  <input
                    type="text"
                    value={formFamilyName}
                    onChange={(e) => setFormFamilyName(e.target.value)}
                    placeholder={result.familyName}
                    className="w-full rounded-xl bg-[#FAF6F0] border border-[#B98A78]/60 px-3.5 py-2.5 text-sm text-[#252321] focus:outline-none focus:border-[#D8755B]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-display font-bold text-[#252321] mb-1">
                    الكنية العربية (اختياري)
                  </label>
                  <input
                    type="text"
                    value={formKunya}
                    onChange={(e) => setFormKunya(e.target.value)}
                    placeholder={
                      formGender === 'female'
                        ? 'مثال: أم خالد / أم محمد'
                        : 'مثال: أبو محمد / أبو سلطان'
                    }
                    className="w-full rounded-xl bg-[#FAF6F0] border border-[#B98A78]/60 px-3.5 py-2.5 text-sm text-[#252321] focus:outline-none focus:border-[#D8755B]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-display font-bold text-[#252321] mb-1">
                    اللقب / الصفة
                  </label>
                  <select
                    value={formHonorific}
                    onChange={(e) =>
                      setFormHonorific(e.target.value as ArabicHonorificTitle)
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
                      <option value="">— اختر الأم من زوجات الأب المسجلات —</option>
                      {modalMeta.motherOptions.map((mom) => (
                        <option key={mom.id} value={mom.id}>
                          {mom.firstName} {mom.familyName}{' '}
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

              {/* Vital Status & Hijri/Gregorian Dates */}
              <div className="rounded-2xl bg-[#FAF6F0] border border-[#B98A78]/45 p-4 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-display font-bold text-[#252321]">
                    الحالة الحياتية والتواريخ:
                  </span>
                  <div className="inline-flex rounded-xl bg-white border border-[#B98A78]/45 p-1">
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
                  className="px-6 py-2.5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs sm:text-sm font-display font-extrabold cursor-pointer shadow-sm"
                >
                  {modalConfig.mode === 'edit'
                    ? 'حفظ التعديلات ✓'
                    : 'حفظ وإضافة للشجرة ✓'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. CAMERA AVATAR PICKER MODAL (رفع صورة حقيقية أو استخدام البورتريه التراثي) */}
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
                  setPeople((prev) =>
                    prev.map((p) =>
                      p.id === photoPickerNodeId
                        ? {
                            ...p,
                            photoUrl: customPhotoUrlInput.trim() || undefined,
                          }
                        : p
                    )
                  );
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
    </div>
  );
};
