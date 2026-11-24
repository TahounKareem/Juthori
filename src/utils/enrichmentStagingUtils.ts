/**
 * Granular Enrichment Permissions, Staging Tree Sandbox Diff Extraction,
 * and Collision-Safe Visual Diff / Authoritative Tree Merge Utilities.
 */

export const FAMILY_TREE_SYNC_EVENT = 'juthori:family-tree-merged';

export type CircleRoleKey =
  | 'assistant_registrar'
  | 'memory_contributor'
  | 'family_viewer';

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
    allowVisitorEnrichment?: boolean;
  };
  siteOwnerId?: string;
  whitelistedEmails?: string[];
  whitelistedUids?: string[];
  whitelistedMemberMeta?: CircleMemberAccessMeta[];
  viewerUid?: string | null;
  viewerEmail?: string | null;
  isOwnerPreview?: boolean;
  accessCodeUnlocked?: boolean;
  activeInvitationStatus?: 'PENDING' | 'SENT' | 'ACTIVE' | 'OPTED_OUT' | null;
  activeInvitationEmail?: string | null;
  justClaimedEmail?: string | null;
}

export interface ResolvedEnrichmentPermission {
  canProposeEnrichment: boolean;
  isCircleMember: boolean;
  isSiteOwner: boolean;
  allowCircleMembersEnrichment: boolean;
  allowVisitorEnrichment: boolean;
  viewerCircleRole?: CircleRoleKey;
  viewerRoleLabel: string;
  matchedCircleMember?: CircleMemberAccessMeta;
}

export function mapCircleRoleToArabicLabel(role?: CircleRoleKey): string {
  if (role === 'assistant_registrar') return 'مساعد أمين السجل';
  if (role === 'memory_contributor') return 'راوي ومساهم في الذاكرة';
  return 'عضو دائرة العائلة';
}

/**
 * Single source of truth for deciding whether a public microsite viewer may propose
 * tree branches or gift vault photos.
 *
 * Defaults:
 * - `allowCircleMembersEnrichment`: true (unless explicitly false)
 * - `allowVisitorEnrichment`: false (only true when explicitly true)
 */
export function resolvePublicSiteEnrichmentPermission(
  input: EnrichmentPermissionInput
): ResolvedEnrichmentPermission {
  const allowCircleMembersEnrichment =
    input.privacyConfig?.allowCircleMembersEnrichment !== false;
  const allowVisitorEnrichment =
    input.privacyConfig?.allowVisitorEnrichment === true;

  const cleanUid = (input.viewerUid || '').trim();
  const cleanEmail = (input.viewerEmail || '').trim().toLowerCase();

  const isSiteOwner = Boolean(
    input.isOwnerPreview ||
      (cleanUid && input.siteOwnerId && cleanUid === input.siteOwnerId)
  );

  if (isSiteOwner) {
    return {
      canProposeEnrichment:
        allowVisitorEnrichment || allowCircleMembersEnrichment,
      isCircleMember: true,
      isSiteOwner: true,
      allowCircleMembersEnrichment,
      allowVisitorEnrichment,
      viewerRoleLabel: 'أمين السجل',
    };
  }

  if (input.activeInvitationStatus === 'OPTED_OUT') {
    return {
      canProposeEnrichment: allowVisitorEnrichment,
      isCircleMember: false,
      isSiteOwner: false,
      allowCircleMembersEnrichment,
      allowVisitorEnrichment,
      viewerRoleLabel: 'قريب زائر',
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

  const matchedByUid = Boolean(
    cleanUid && whitelistedUidsClean.includes(cleanUid)
  );
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
    matchedMeta ||
      matchedByUid ||
      matchedByEmail ||
      matchedByClaimedInvite ||
      input.accessCodeUnlocked
  );

  const viewerCircleRole = matchedMeta?.role;
  const viewerRoleLabel = isCircleMember
    ? mapCircleRoleToArabicLabel(viewerCircleRole)
    : 'قريب زائر';

  const canProposeEnrichment =
    allowVisitorEnrichment || (allowCircleMembersEnrichment && isCircleMember);

  return {
    canProposeEnrichment,
    isCircleMember,
    isSiteOwner: false,
    allowCircleMembersEnrichment,
    allowVisitorEnrichment,
    viewerCircleRole,
    viewerRoleLabel,
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
 * Used for BOTH:
 * 1) Visual Diff Preview in «مجتمعي» (virtual non-destructive merge)
 * 2) Authoritative 1-Click Approval Merge into Firestore «شجرتي»
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

  // 1. Allocate collision-free IDs for all proposed nodes
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

  // 2. Collect all reciprocal spouse additions targeting existing base nodes
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

  // 3. Apply non-destructive link patches onto existing base nodes
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

  // 4. Materialize proposed nodes with remapped references & both schema conventions
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
