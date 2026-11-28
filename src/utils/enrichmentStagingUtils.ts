/**
 * Granular 3-Tier Circle RBAC Permissions, Staging Tree Sandbox Diff Extraction,
 * and Collision-Safe Visual Diff / Authoritative Tree Merge Utilities.
 *
 * ZERO Anonymous Enrichment: Only authenticated, approved circle members with
 * explicit role entitlements (`memory_contributor` for Vault, `assistant_registrar`
 * for Tree + Vault) or the Site Owner may propose enrichments.
 */

export const FAMILY_TREE_SYNC_EVENT = 'juthori:family-tree-merged';
export const JUTHORI_KINSHIP_CIRCLE_SYNC_EVENT = 'juthori:kinship-circle-synced';

export type CircleRoleKey =
  | 'assistant_registrar'
  | 'memory_contributor'
  | 'family_viewer';

export interface CirclePermissionTierMeta {
  id: CircleRoleKey;
  labelAr: string;
  shortLabelAr: string;
  descriptionAr: string;
  requestIntentLabelAr: string;
  requestSummaryAr: string;
  canEnrichVault: boolean;
  canEnrichTree: boolean;
}

export const CIRCLE_PERMISSION_TIERS: ReadonlyArray<CirclePermissionTierMeta> = [
  {
    id: 'family_viewer',
    labelAr: 'تصفح الديوان والمشاركة',
    shortLabelAr: 'تصفح الديوان',
    descriptionAr:
      'دخول البوابة الخاصة والعامة، تصفح الشجرة والخزانة، والمشاركة في المجلس وتأكيد المناسبات (بدون صلاحية إثراء).',
    requestIntentLabelAr: 'تصفح الديوان وصلة الرحم',
    requestSummaryAr: 'يرغب بتصفح الديوان وصلة الرحم',
    canEnrichVault: false,
    canEnrichTree: false,
  },
  {
    id: 'memory_contributor',
    labelAr: 'راوي الذاكرة — إثراء الخزانة',
    shortLabelAr: 'راوي الذاكرة',
    descriptionAr:
      'كل صلاحيات التصفح والمشاركة + إهداء واقتراح الصور والوثائق والقصص في خزانة العائلة فقط.',
    requestIntentLabelAr: 'لدي صور ووثائق للخزانة',
    requestSummaryAr: 'يرغب بإثراء خزانة الصور والوثائق',
    canEnrichVault: true,
    canEnrichTree: false,
  },
  {
    id: 'assistant_registrar',
    labelAr: 'مساعد أمين السجل — إثراء الشجرة والخزانة',
    shortLabelAr: 'مساعد أمين السجل',
    descriptionAr:
      'كل الصلاحيات السابقة + اقتراح إضافة فروع وأفراد على الشجرة التفاعلية وإثراء خزانة العائلة.',
    requestIntentLabelAr: 'لدي معلومات لإثراء فروع الشجرة',
    requestSummaryAr: 'يرغب بإثراء فروع الشجرة والخزانة',
    canEnrichVault: true,
    canEnrichTree: true,
  },
];

export function normalizeCircleRoleKey(rawRole?: string | null): CircleRoleKey {
  const clean = (rawRole || '').trim().toLowerCase();
  if (clean === 'assistant_registrar' || clean === 'co_registrar') {
    return 'assistant_registrar';
  }
  if (clean === 'memory_contributor' || clean === 'vault_contributor') {
    return 'memory_contributor';
  }
  return 'family_viewer';
}

export function getCircleRoleTierMeta(role?: string | null): CirclePermissionTierMeta {
  const normalized = normalizeCircleRoleKey(role);
  return (
    CIRCLE_PERMISSION_TIERS.find((t) => t.id === normalized) ||
    CIRCLE_PERMISSION_TIERS[0]
  );
}

export function mapCircleRoleToArabicLabel(role?: CircleRoleKey | string): string {
  return getCircleRoleTierMeta(role).shortLabelAr;
}

export interface CircleMemberAccessMeta {
  email: string;
  uid?: string;
  name?: string;
  role?: CircleRoleKey;
  kinshipRelation?: string;
}

export interface StagingProposedTreeNode {
  id: string;
  firstName: string;
  familyName?: string;
  epithet?: string;
  kunya?: string;
  honorificTitle?: string;
  prestigeBadge?: string;
  gender: 'male' | 'female';
  generationLevel: number;
  isDirectSpineLineage?: boolean;
  relationToTargetLabel: string;
  fatherId?: string;
  motherId?: string;
  siblingOfId?: string;
  spouseIds: string[];
  maidenFamilyLine?: string;
  marriageAllianceNote?: string;
  vitalStatus?: 'living' | 'deceased' | 'unspecified';
  birthPrecision?: 'year_only' | 'full_date' | 'approximate' | 'era' | 'exact';
  birthCalendar?: 'hijri' | 'gregorian';
  birthDateValue?: string;
  birthPlace?: string;
  deathDateValue?: string;
  deathPlace?: string;
  femalePrivacyMasked?: boolean;
  biography?: string;
  photoUrl?: string;
  photoThumbnailUrl?: string;
}

export interface StagingParentLinkPatch {
  existingNodeId: string;
  addSpouseIds?: string[];
  setFatherId?: string;
  setMotherId?: string;
  setSiblingOfId?: string;
}

export interface EnrichmentPermissionInput {
  privacyConfig?: {
    allowCircleMembersEnrichment?: boolean;
    allowPublicMajlis?: boolean;
  };
  siteOwnerId?: string;
  whitelistedEmails?: string[];
  whitelistedUids?: string[];
  whitelistedMemberMeta?: CircleMemberAccessMeta[];
  viewerUid?: string | null;
  viewerEmail?: string | null;
  isOwnerPreview?: boolean;
  activeInvitationStatus?: 'PENDING' | 'SENT' | 'ACTIVE' | 'OPTED_OUT' | null;
  activeInvitationEmail?: string | null;
  justClaimedEmail?: string | null;
}

export interface ResolvedEnrichmentPermission {
  /** True only when viewer can propose tree branches (Owner or assistant_registrar) */
  canProposeTreeEnrichment: boolean;
  /** True only when viewer can gift/propose vault media (Owner, assistant_registrar, or memory_contributor) */
  canProposeVaultEnrichment: boolean;
  /** Convenience flag: true if viewer has either tree or vault enrichment rights */
  canProposeEnrichment: boolean;
  /** True when viewer is allowed to post in Majlis & RSVP to events */
  canInteractInMajlis: boolean;
  isCircleMember: boolean;
  isSiteOwner: boolean;
  allowCircleMembersEnrichment: boolean;
  allowPublicMajlis: boolean;
  viewerCircleRole?: CircleRoleKey;
  viewerRoleLabel: string;
  matchedCircleMember?: CircleMemberAccessMeta;
}

/**
 * Single source of truth for enforcing the 3-Tier Circle Permissions Matrix
 * with ZERO anonymous enrichment:
 * - Site Owner: full tree + vault + Majlis rights.
 * - `assistant_registrar`: tree sandbox + vault gift + Majlis/RSVP (when circle enrichment enabled).
 * - `memory_contributor`: vault gift + Majlis/RSVP ONLY (no tree sandbox).
 * - `family_viewer`: browse + Majlis/RSVP ONLY (no tree or vault enrichment).
 * - Non-member visitor: NO tree or vault enrichment ever; Majlis/RSVP only if `allowPublicMajlis === true`.
 */
export function resolvePublicSiteEnrichmentPermission(
  input: EnrichmentPermissionInput
): ResolvedEnrichmentPermission {
  const allowCircleMembersEnrichment =
    input.privacyConfig?.allowCircleMembersEnrichment !== false;
  const allowPublicMajlis = input.privacyConfig?.allowPublicMajlis === true;

  const cleanUid = (input.viewerUid || '').trim();
  const cleanEmail = (input.viewerEmail || '').trim().toLowerCase();

  const isSiteOwner = Boolean(
    input.isOwnerPreview ||
      (cleanUid && input.siteOwnerId && cleanUid === input.siteOwnerId)
  );

  if (isSiteOwner) {
    return {
      canProposeTreeEnrichment: true,
      canProposeVaultEnrichment: true,
      canProposeEnrichment: true,
      canInteractInMajlis: true,
      isCircleMember: true,
      isSiteOwner: true,
      allowCircleMembersEnrichment,
      allowPublicMajlis,
      viewerCircleRole: 'assistant_registrar',
      viewerRoleLabel: 'أمين السجل',
    };
  }

  // Unauthenticated visitors or opted-out invitees NEVER receive enrichment rights
  if (!cleanUid || input.activeInvitationStatus === 'OPTED_OUT') {
    return {
      canProposeTreeEnrichment: false,
      canProposeVaultEnrichment: false,
      canProposeEnrichment: false,
      canInteractInMajlis: allowPublicMajlis,
      isCircleMember: false,
      isSiteOwner: false,
      allowCircleMembersEnrichment,
      allowPublicMajlis,
      viewerRoleLabel: 'زائر',
    };
  }

  const metaList = Array.isArray(input.whitelistedMemberMeta)
    ? input.whitelistedMemberMeta
    : [];

  const matchedMeta = metaList.find((m) => {
    const mEmail = (m.email || '').trim().toLowerCase();
    const mUid = (m.uid || '').trim();
    if (cleanUid && mUid && mUid === cleanUid) return true;
    if (cleanEmail && mEmail && mEmail === cleanEmail) return true;
    return false;
  });

  const whitelistedEmailsLower = (input.whitelistedEmails || [])
    .map((e) => (e || '').trim().toLowerCase())
    .filter(Boolean);
  const whitelistedUidsClean = (input.whitelistedUids || [])
    .map((u) => (u || '').trim())
    .filter(Boolean);

  const matchedByUid = Boolean(cleanUid && whitelistedUidsClean.includes(cleanUid));
  const matchedByEmail = Boolean(
    cleanEmail && whitelistedEmailsLower.includes(cleanEmail)
  );
  const matchedByClaimedInvite = Boolean(
    cleanEmail &&
      ((input.justClaimedEmail &&
        input.justClaimedEmail.trim().toLowerCase() === cleanEmail) ||
        (input.activeInvitationStatus === 'ACTIVE' &&
          input.activeInvitationEmail &&
          input.activeInvitationEmail.trim().toLowerCase() === cleanEmail))
  );

  const isCircleMember = Boolean(
    matchedMeta || matchedByUid || matchedByEmail || matchedByClaimedInvite
  );

  if (!isCircleMember) {
    return {
      canProposeTreeEnrichment: false,
      canProposeVaultEnrichment: false,
      canProposeEnrichment: false,
      canInteractInMajlis: allowPublicMajlis,
      isCircleMember: false,
      isSiteOwner: false,
      allowCircleMembersEnrichment,
      allowPublicMajlis,
      viewerRoleLabel: 'عضو جذوري',
    };
  }

  const viewerCircleRole: CircleRoleKey = normalizeCircleRoleKey(
    matchedMeta?.role || 'family_viewer'
  );
  const tierMeta = getCircleRoleTierMeta(viewerCircleRole);

  const canProposeTreeEnrichment = Boolean(
    allowCircleMembersEnrichment && tierMeta.canEnrichTree
  );
  const canProposeVaultEnrichment = Boolean(
    allowCircleMembersEnrichment && tierMeta.canEnrichVault
  );

  return {
    canProposeTreeEnrichment,
    canProposeVaultEnrichment,
    canProposeEnrichment: canProposeTreeEnrichment || canProposeVaultEnrichment,
    canInteractInMajlis: true,
    isCircleMember: true,
    isSiteOwner: false,
    allowCircleMembersEnrichment,
    allowPublicMajlis,
    viewerCircleRole,
    viewerRoleLabel: tierMeta.shortLabelAr,
    matchedCircleMember: matchedMeta,
  };
}

/**
 * Computes the minimal staging diff (only newly added nodes + link patches on base nodes)
 * without mutating any original baseline person's core profile.
 */
export function extractStagingDiffFromTree<
  T extends {
    id: string;
    firstName: string;
    familyName?: string;
    epithet?: string;
    kunya?: string;
    honorificTitle?: string;
    prestigeBadge?: string;
    gender: 'male' | 'female';
    generationLevel: number;
    isDirectSpineLineage?: boolean;
    relationToTargetLabel: string;
    fatherId?: string;
    motherId?: string;
    siblingOfId?: string;
    spouseIds?: string[];
    maidenFamilyLine?: string;
    marriageAllianceNote?: string;
    vitalStatus?: 'living' | 'deceased' | 'unspecified' | string;
    birthPrecision?: 'exact' | 'year_only' | 'approximate' | string;
    birthCalendar?: 'hijri' | 'gregorian' | string;
    birthDateValue?: string;
    birthPlace?: string;
    deathDateValue?: string;
    deathPlace?: string;
    femalePrivacyMasked?: boolean;
    biography?: string;
    photoUrl?: string;
    photoThumbnailUrl?: string;
  }
>(
  baseMembers: T[],
  stagedMembers: T[]
): {
  baseSnapshotIds: string[];
  proposedNodes: StagingProposedTreeNode[];
  parentLinkPatches: StagingParentLinkPatch[];
} {
  const baseById = new Map<string, T>();
  const baseSnapshotIds: string[] = [];
  for (const m of baseMembers) {
    if (!m?.id) continue;
    baseById.set(m.id, m);
    baseSnapshotIds.push(m.id);
  }

  const proposedNodes: StagingProposedTreeNode[] = [];
  const proposedIdSet = new Set<string>();

  for (const node of stagedMembers) {
    if (!node?.id || baseById.has(node.id)) continue;
    proposedIdSet.add(node.id);
    proposedNodes.push({
      id: node.id,
      firstName: String(node.firstName || '').trim().slice(0, 80),
      familyName: node.familyName
        ? String(node.familyName).trim().slice(0, 80)
        : undefined,
      epithet: node.epithet ? String(node.epithet).trim().slice(0, 80) : undefined,
      kunya: node.kunya ? String(node.kunya).trim().slice(0, 80) : undefined,
      honorificTitle: node.honorificTitle || undefined,
      prestigeBadge: node.prestigeBadge || undefined,
      gender: node.gender === 'female' ? 'female' : 'male',
      generationLevel:
        typeof node.generationLevel === 'number' ? node.generationLevel : 0,
      isDirectSpineLineage: Boolean(node.isDirectSpineLineage),
      relationToTargetLabel: String(
        node.relationToTargetLabel || 'فرد مقترح'
      ).slice(0, 120),
      fatherId: node.fatherId || undefined,
      motherId: node.motherId || undefined,
      siblingOfId: node.siblingOfId || undefined,
      spouseIds: Array.isArray(node.spouseIds)
        ? Array.from(new Set(node.spouseIds.filter(Boolean)))
        : [],
      maidenFamilyLine: node.maidenFamilyLine
        ? String(node.maidenFamilyLine).trim().slice(0, 120)
        : undefined,
      marriageAllianceNote: node.marriageAllianceNote
        ? String(node.marriageAllianceNote).trim().slice(0, 120)
        : undefined,
      vitalStatus:
        node.vitalStatus === 'living' ||
        node.vitalStatus === 'deceased' ||
        node.vitalStatus === 'unspecified'
          ? node.vitalStatus
          : 'unspecified',
      birthPrecision:
        node.birthPrecision === 'full_date' ||
        node.birthPrecision === 'year_only' ||
        node.birthPrecision === 'approximate' ||
        node.birthPrecision === 'era' ||
        node.birthPrecision === 'exact'
          ? node.birthPrecision
          : 'year_only',
      birthCalendar:
        node.birthCalendar === 'gregorian' ? 'gregorian' : 'hijri',
      birthDateValue: node.birthDateValue
        ? String(node.birthDateValue).trim().slice(0, 40)
        : undefined,
      birthPlace: node.birthPlace
        ? String(node.birthPlace).trim().slice(0, 80)
        : undefined,
      deathDateValue: node.deathDateValue
        ? String(node.deathDateValue).trim().slice(0, 40)
        : undefined,
      deathPlace: node.deathPlace
        ? String(node.deathPlace).trim().slice(0, 80)
        : undefined,
      femalePrivacyMasked: Boolean(node.femalePrivacyMasked),
      biography: node.biography
        ? String(node.biography).trim().slice(0, 800)
        : undefined,
      photoUrl:
        node.photoUrl && node.photoUrl.length <= 160000
          ? node.photoUrl
          : undefined,
      photoThumbnailUrl:
        node.photoThumbnailUrl && node.photoThumbnailUrl.length <= 160000
          ? node.photoThumbnailUrl
          : undefined,
    });
  }

  const parentLinkPatches: StagingParentLinkPatch[] = [];
  for (const staged of stagedMembers) {
    const base = baseById.get(staged.id);
    if (!base) continue;

    const baseSpouses = new Set(base.spouseIds || []);
    const addedSpouses = (staged.spouseIds || []).filter(
      (sid) => !baseSpouses.has(sid) && proposedIdSet.has(sid)
    );
    const nextFatherId =
      !base.fatherId && staged.fatherId && proposedIdSet.has(staged.fatherId)
        ? staged.fatherId
        : undefined;
    const nextMotherId =
      !base.motherId && staged.motherId && proposedIdSet.has(staged.motherId)
        ? staged.motherId
        : undefined;
    const nextSiblingOfId =
      !base.siblingOfId &&
      staged.siblingOfId &&
      proposedIdSet.has(staged.siblingOfId)
        ? staged.siblingOfId
        : undefined;

    if (
      addedSpouses.length > 0 ||
      nextFatherId ||
      nextMotherId ||
      nextSiblingOfId
    ) {
      parentLinkPatches.push({
        existingNodeId: base.id,
        addSpouseIds: addedSpouses.length > 0 ? addedSpouses : undefined,
        setFatherId: nextFatherId,
        setMotherId: nextMotherId,
        setSiblingOfId: nextSiblingOfId,
      });
    }
  }

  return {
    baseSnapshotIds,
    proposedNodes,
    parentLinkPatches,
  };
}

export interface GenericTreeRecord {
  id: string;
  firstName?: string;
  name?: string;
  familyName?: string;
  epithet?: string;
  kunya?: string;
  honorificTitle?: string;
  prestigeBadge?: string;
  gender?: 'male' | 'female';
  generationLevel?: number;
  isRecordKeeper?: boolean;
  isDirectSpineLineage?: boolean;
  isCertifiedReference?: boolean;
  relationLabel?: string;
  relationToTargetLabel?: string;
  fatherId?: string;
  motherId?: string;
  siblingOfId?: string;
  spouseIds?: string[];
  maidenFamilyLine?: string;
  marriageAllianceNote?: string;
  vitalStatus?: 'living' | 'deceased' | 'unspecified' | string;
  isDeceased?: boolean;
  isAlive?: boolean;
  birthPrecision?: 'exact' | 'year_only' | 'approximate' | string;
  birthCalendar?: 'hijri' | 'gregorian' | string;
  birthDateValue?: string;
  birthYear?: string;
  birthPlace?: string;
  deathDateValue?: string;
  deathYear?: string;
  deathPlace?: string;
  femalePrivacyMasked?: boolean;
  biography?: string;
  photoUrl?: string;
  photoThumbnailUrl?: string;
  [key: string]: unknown;
}

/**
 * Collision-safe merge of staging proposed nodes & link patches into an authoritative tree.
 */
export function mergeStagingTreeProposalIntoAuthoritativeTree<
  T extends GenericTreeRecord
>(
  baseTree: T[],
  proposedNodes: StagingProposedTreeNode[],
  parentLinkPatches: StagingParentLinkPatch[] = [],
  familyName = ''
): {
  mergedTree: T[];
  insertedIds: string[];
  idRemap: Record<string, string>;
} {
  const existingIds = new Set(baseTree.map((n) => String(n.id)));
  const idRemap: Record<string, string> = {};
  const insertedIds: string[] = [];

  proposedNodes.forEach((p, idx) => {
    let targetId = p.id || `node_enr_${Date.now()}_${idx}`;
    if (existingIds.has(targetId)) {
      let suffix = 1;
      while (existingIds.has(`${targetId}_m${suffix}`)) {
        suffix += 1;
      }
      targetId = `${targetId}_m${suffix}`;
    }
    idRemap[p.id] = targetId;
    existingIds.add(targetId);
    insertedIds.push(targetId);
  });

  const remapRef = (rawId?: string): string | undefined => {
    if (!rawId) return undefined;
    return idRemap[rawId] || rawId;
  };

  const extraSpousesByBaseId = new Map<string, Set<string>>();
  const patchByBaseId = new Map<string, StagingParentLinkPatch>();

  for (const patch of parentLinkPatches) {
    if (!patch?.existingNodeId) continue;
    patchByBaseId.set(patch.existingNodeId, patch);
    if (Array.isArray(patch.addSpouseIds)) {
      const set =
        extraSpousesByBaseId.get(patch.existingNodeId) || new Set<string>();
      patch.addSpouseIds.forEach((sid) => {
        const mapped = remapRef(sid);
        if (mapped) set.add(mapped);
      });
      extraSpousesByBaseId.set(patch.existingNodeId, set);
    }
  }

  for (const p of proposedNodes) {
    const mappedSelfId = idRemap[p.id];
    (p.spouseIds || []).forEach((sid) => {
      const mappedTarget = remapRef(sid);
      if (mappedTarget && !idRemap[sid]) {
        const set =
          extraSpousesByBaseId.get(mappedTarget) || new Set<string>();
        set.add(mappedSelfId);
        extraSpousesByBaseId.set(mappedTarget, set);
      }
    });
  }

  const patchedBase = baseTree.map((node) => {
    const patch = patchByBaseId.get(node.id);
    const addedSpouses = extraSpousesByBaseId.get(node.id);
    if (!patch && (!addedSpouses || addedSpouses.size === 0)) {
      return node;
    }
    const existingSpouses = Array.isArray(node.spouseIds)
      ? node.spouseIds
      : [];
    const mergedSpouses =
      addedSpouses && addedSpouses.size > 0
        ? Array.from(new Set([...existingSpouses, ...Array.from(addedSpouses)]))
        : existingSpouses;

    return {
      ...node,
      spouseIds: mergedSpouses,
      fatherId:
        !node.fatherId && patch?.setFatherId
          ? remapRef(patch.setFatherId)
          : node.fatherId,
      motherId:
        !node.motherId && patch?.setMotherId
          ? remapRef(patch.setMotherId)
          : node.motherId,
      siblingOfId:
        !node.siblingOfId && patch?.setSiblingOfId
          ? remapRef(patch.setSiblingOfId)
          : node.siblingOfId,
    } as T;
  });

  const materializedProposed = proposedNodes.map((p) => {
    const mappedId = idRemap[p.id];
    const isDeceased = p.vitalStatus === 'deceased';
    const nextNode: GenericTreeRecord = {
      id: mappedId,
      firstName: p.firstName,
      familyName: p.familyName || familyName || '',
      epithet: p.epithet,
      kunya: p.kunya || '',
      honorificTitle: p.honorificTitle || 'بدون',
      prestigeBadge: p.prestigeBadge,
      gender: p.gender === 'female' ? 'female' : 'male',
      generationLevel:
        typeof p.generationLevel === 'number' ? p.generationLevel : 0,
      isRecordKeeper: false,
      isDirectSpineLineage: Boolean(p.isDirectSpineLineage),
      isCertifiedReference: false,
      relationLabel: p.relationToTargetLabel || 'فرد مضاف بالإثراء',
      relationToTargetLabel: p.relationToTargetLabel || 'فرد مضاف بالإثراء',
      fatherId: remapRef(p.fatherId),
      motherId: remapRef(p.motherId),
      siblingOfId: remapRef(p.siblingOfId),
      spouseIds: Array.from(
        new Set(
          (p.spouseIds || [])
            .map((sid) => remapRef(sid))
            .filter((x): x is string => Boolean(x))
        )
      ),
      maidenFamilyLine: p.maidenFamilyLine,
      marriageAllianceNote: p.marriageAllianceNote,
      vitalStatus: p.vitalStatus || 'unspecified',
      isDeceased,
      isAlive: !isDeceased,
      birthPrecision: p.birthPrecision || 'year_only',
      birthCalendar: p.birthCalendar || 'hijri',
      birthDateValue: p.birthDateValue || '',
      birthYear: p.birthDateValue || undefined,
      birthPlace: p.birthPlace || '',
      deathDateValue: isDeceased ? p.deathDateValue : undefined,
      deathYear: isDeceased ? p.deathDateValue : undefined,
      deathPlace: isDeceased ? p.deathPlace : undefined,
      femalePrivacyMasked:
        p.gender === 'female' ? Boolean(p.femalePrivacyMasked) : false,
      biography: p.biography,
      photoUrl: p.photoUrl,
      photoThumbnailUrl: p.photoThumbnailUrl || p.photoUrl,
    };
    return nextNode as T;
  });

  return {
    mergedTree: [...patchedBase, ...materializedProposed],
    insertedIds,
    idRemap,
  };
}
