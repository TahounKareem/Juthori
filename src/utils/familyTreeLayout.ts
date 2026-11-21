export interface PedigreePersonLike {
  id: string;
  firstName: string;
  gender: 'male' | 'female';
  generationLevel: number;
  isRecordKeeper?: boolean;
  isDirectSpineLineage?: boolean;
  isBridgeAboveFamily?: boolean;
  relationToTargetLabel: string;
  fatherId?: string;
  motherId?: string;
  siblingOfId?: string;
  spouseIds: string[];
  birthDateValue?: string;
  birthCalendar?: 'hijri' | 'gregorian';
}

export interface PedigreeLayoutOptions {
  siblingSortOrder?: 'added' | 'birth_oldest';
  focusRootId?: string | null;
}

export interface PedigreeTreeNode<T extends PedigreePersonLike> {
  person: T;
  spouses: T[];
  children: PedigreeTreeNode<T>[];
  isDirectSpineEdge: boolean;
}

export interface PedigreeTreeLayoutResult<T extends PedigreePersonLike> {
  root: PedigreeTreeNode<T> | null;
  /**
   * All top-level roots sharing the topmost generation when no shared father node
   * has been added yet (e.g. the highest ancestor alongside their brothers/sisters).
   * `topLevelRoots[0]` always equals `root` when non-empty.
   */
  topLevelRoots: PedigreeTreeNode<T>[];
  unpairedTopMother: T | null;
  detachedRoots: PedigreeTreeNode<T>[];
  directSpineIds: Set<string>;
}

/**
 * Husband-Anchored Marital Hub Partition:
 * Guarantees the primary bloodline anchor (husband/parent) ALWAYS occupies the
 * exact geometric center, and NO spouse is ever chained through another spouse.
 *
 * - 0 spouses: right=[], left=[]
 * - 1 spouse:  right=[], left=[wife1] (classic side-by-side bridge on left in RTL)
 * - 2 spouses: right=[wife1], left=[wife2] (husband dead-center with 2 independent bridges)
 * - 3+ spouses: balanced right & left flanks using elevated golden marital rails
 *   branching from husband's lateral ports (zero wife-to-wife pass-through).
 */
export interface SpouseHubPartition<T extends PedigreePersonLike> {
  mode: 'none' | 'single' | 'dual' | 'multi_bus';
  rightSpouses: T[];
  leftSpouses: T[];
}

export function partitionSpousesAroundHusband<T extends PedigreePersonLike>(
  spouses: T[]
): SpouseHubPartition<T> {
  if (!spouses || spouses.length === 0) {
    return { mode: 'none', rightSpouses: [], leftSpouses: [] };
  }
  if (spouses.length === 1) {
    return { mode: 'single', rightSpouses: [], leftSpouses: [spouses[0]] };
  }
  if (spouses.length === 2) {
    return {
      mode: 'dual',
      rightSpouses: [spouses[0]],
      leftSpouses: [spouses[1]],
    };
  }
  // 3 or 4+ spouses: alternate across right & left flanks around the centered husband
  const rightSpouses: T[] = [];
  const leftSpouses: T[] = [];
  spouses.forEach((sp, idx) => {
    if (idx % 2 === 0) {
      rightSpouses.push(sp);
    } else {
      leftSpouses.push(sp);
    }
  });
  return { mode: 'multi_bus', rightSpouses, leftSpouses };
}

export interface MaternalChildUnionGroup<T extends PedigreePersonLike> {
  spouse: T;
  side: 'right' | 'left';
  children: PedigreeTreeNode<T>[];
}

export interface ChildUnionRoutingResult<T extends PedigreePersonLike> {
  /** Children with unspecified mother OR when spouses are hidden — descend strictly from Father's center */
  paternalOnlyChildren: PedigreeTreeNode<T>[];
  /** Children linked to specific visible spouses on the right side (RTL) */
  rightMaternalGroups: MaternalChildUnionGroup<T>[];
  /** Children linked to specific visible spouses on the left side (RTL) */
  leftMaternalGroups: MaternalChildUnionGroup<T>[];
  /** True when at least one child routes through a visible maternal union bridge */
  hasVisibleMaternalRouting: boolean;
}

/**
 * Strict Paternal vs. Maternal-Union Child Routing:
 * - When `shouldShowSpouses` is false (or no visible spouses exist), ALL children route strictly
 *   from the father's bottom-center (`paternalOnlyChildren`).
 * - When `shouldShowSpouses` is true:
 *   - Any child with `!child.person.motherId` (or whose partner ID isn't in `visibleSpouses`)
 *     routes strictly from the father's bottom-center (`paternalOnlyChildren`).
 *   - Any child whose `motherId` (or `fatherId` when primary person is female) matches a
 *     visible spouse routes specifically from that spouse's marital bridge group!
 */
export function partitionChildrenByMotherUnion<T extends PedigreePersonLike>(
  primaryPerson: T,
  children: PedigreeTreeNode<T>[],
  visibleSpouses: T[],
  shouldShowSpouses: boolean
): ChildUnionRoutingResult<T> {
  if (!shouldShowSpouses || visibleSpouses.length === 0 || children.length === 0) {
    return {
      paternalOnlyChildren: children,
      rightMaternalGroups: [],
      leftMaternalGroups: [],
      hasVisibleMaternalRouting: false,
    };
  }

  const spousePartition = partitionSpousesAroundHusband(visibleSpouses);
  const sideBySpouseId = new Map<string, 'right' | 'left'>();
  spousePartition.rightSpouses.forEach((s) => sideBySpouseId.set(s.id, 'right'));
  spousePartition.leftSpouses.forEach((s) => sideBySpouseId.set(s.id, 'left'));

  const childrenBySpouseId = new Map<string, PedigreeTreeNode<T>[]>();
  const paternalOnlyChildren: PedigreeTreeNode<T>[] = [];

  for (const childNode of children) {
    const matchedSpouseId =
      primaryPerson.gender === 'male'
        ? childNode.person.motherId && sideBySpouseId.has(childNode.person.motherId)
          ? childNode.person.motherId
          : undefined
        : childNode.person.fatherId && sideBySpouseId.has(childNode.person.fatherId)
        ? childNode.person.fatherId
        : undefined;

    if (matchedSpouseId) {
      const bucket = childrenBySpouseId.get(matchedSpouseId) || [];
      bucket.push(childNode);
      childrenBySpouseId.set(matchedSpouseId, bucket);
    } else {
      paternalOnlyChildren.push(childNode);
    }
  }

  // Right flank rendered in RTL order (outermost right -> inner right toward husband)
  const rightMaternalGroups: MaternalChildUnionGroup<T>[] = [];
  for (const sp of [...spousePartition.rightSpouses].reverse()) {
    const grp = childrenBySpouseId.get(sp.id);
    if (grp && grp.length > 0) {
      rightMaternalGroups.push({ spouse: sp, side: 'right', children: grp });
    }
  }

  // Left flank rendered in RTL order (inner left next to husband -> outermost left)
  const leftMaternalGroups: MaternalChildUnionGroup<T>[] = [];
  for (const sp of spousePartition.leftSpouses) {
    const grp = childrenBySpouseId.get(sp.id);
    if (grp && grp.length > 0) {
      leftMaternalGroups.push({ spouse: sp, side: 'left', children: grp });
    }
  }

  return {
    paternalOnlyChildren,
    rightMaternalGroups,
    leftMaternalGroups,
    hasVisibleMaternalRouting:
      rightMaternalGroups.length > 0 || leftMaternalGroups.length > 0,
  };
}

export interface NodeQuickActionPolicy<T extends PedigreePersonLike> {
  hasFatherInTree: boolean;
  hasMotherInTree: boolean;
  hasHusband: boolean;
  linkedHusband: T | null;
  /** True when the node is a married-in wife (no blood-line father in tree) */
  isMarriedInWife: boolean;
  /** False for any female who already has a registered husband in the tree */
  canAddSpouse: boolean;
  /** False for married-in wives so external family trees never branch inside the family column */
  canAddParentsAndSiblingsInMenu: boolean;
}

/**
 * Resolves exact quick-action (+) menu capabilities for any tree node:
 * 1. A female node who already has a registered husband NEVER shows "+ إضافة زوج".
 * 2. A married-in wife (no blood-line father in the family tree) has a focused menu
 *    strictly showing "+ إضافة ابن" and "+ إضافة ابنة" (bound to her husband + herself).
 */
export function resolveNodeQuickActionPolicy<T extends PedigreePersonLike>(
  people: T[],
  person: T
): NodeQuickActionPolicy<T> {
  const byId = new Map<string, T>();
  people.forEach((p) => byId.set(p.id, p));

  const hasFatherInTree = Boolean(person.fatherId && byId.has(person.fatherId));
  const hasMotherInTree = Boolean(person.motherId && byId.has(person.motherId));

  const linkedSpouses: T[] = [];
  const seenSpouseIds = new Set<string>();
  (person.spouseIds || []).forEach((sid) => {
    const sp = byId.get(sid);
    if (sp && sp.id !== person.id && !seenSpouseIds.has(sp.id)) {
      seenSpouseIds.add(sp.id);
      linkedSpouses.push(sp);
    }
  });
  people.forEach((other) => {
    if (
      other.id !== person.id &&
      !seenSpouseIds.has(other.id) &&
      (other.spouseIds || []).includes(person.id)
    ) {
      seenSpouseIds.add(other.id);
      linkedSpouses.push(other);
    }
  });

  const linkedHusband =
    person.gender === 'female'
      ? linkedSpouses.find((sp) => sp.gender === 'male') || null
      : null;
  const hasHusband = Boolean(linkedHusband);

  const label = (person.relationToTargetLabel || '').trim();
  const isMarriedInWife =
    person.gender === 'female' &&
    !hasFatherInTree &&
    (hasHusband || label.startsWith('زوجة') || label.startsWith('والدة'));

  return {
    hasFatherInTree,
    hasMotherInTree,
    hasHusband,
    linkedHusband,
    isMarriedInWife,
    canAddSpouse: person.gender === 'male' ? true : !hasHusband,
    canAddParentsAndSiblingsInMenu: !isMarriedInWife,
  };
}

/**
 * Collects all IDs in the same top-level sibling group as `target`
 * (siblings sharing the topmost level with no recorded father yet).
 */
export function collectTopSiblingGroupIds<T extends PedigreePersonLike>(
  people: T[],
  target: T
): Set<string> {
  const activePeople = people.filter((p) => !p.isBridgeAboveFamily);
  const byId = new Map<string, T>();
  activePeople.forEach((p) => byId.set(p.id, p));

  if (target.fatherId && byId.has(target.fatherId)) {
    return new Set<string>([target.id]);
  }

  const group: T[] = [target];
  const groupIds = new Set<string>([target.id]);

  // If `target` points to another root via `siblingOfId`, seed that anchor too
  if (target.siblingOfId && byId.has(target.siblingOfId)) {
    const anchor = byId.get(target.siblingOfId)!;
    if (!(anchor.fatherId && byId.has(anchor.fatherId)) && !groupIds.has(anchor.id)) {
      group.push(anchor);
      groupIds.add(anchor.id);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const candidate of activePeople) {
      if (groupIds.has(candidate.id)) continue;
      if (candidate.fatherId && byId.has(candidate.fatherId)) continue;
      if (candidate.motherId && byId.has(candidate.motherId)) continue;

      const linkedBySiblingId = Boolean(
        (candidate.siblingOfId && groupIds.has(candidate.siblingOfId)) ||
          group.some((m) => m.siblingOfId === candidate.id)
      );

      const linkedByLegacyLabel =
        candidate.generationLevel === target.generationLevel &&
        group.some((m) => {
          const cleanName = m.firstName.trim();
          if (!cleanName) return false;
          const candLabel = candidate.relationToTargetLabel || '';
          const mLabel = m.relationToTargetLabel || '';
          return (
            candLabel.includes(`أخ لـ ${cleanName}`) ||
            candLabel.includes(`أخت لـ ${cleanName}`) ||
            (candidate.firstName.trim() !== '' &&
              (mLabel.includes(`أخ لـ ${candidate.firstName.trim()}`) ||
                mLabel.includes(`أخت لـ ${candidate.firstName.trim()}`)))
          );
        });

      if (linkedBySiblingId || linkedByLegacyLabel) {
        group.push(candidate);
        groupIds.add(candidate.id);
        changed = true;
      }
    }
  }

  return groupIds;
}

/**
 * Computes the complete cascading deletion set for removing `targetPersonId`
 * together with all descendant children/subtrees and unattached spouses so
 * zero orphaned branches are ever left behind in the family tree.
 *
 * The Record Keeper (أمين السجل) and any direct-spine chain below a deleted
 * direct-spine ancestor are always protected from deletion.
 */
export function collectCascadeDeleteIds<T extends PedigreePersonLike>(
  people: T[],
  targetPersonId: string
): {
  allDeletedIds: Set<string>;
  descendantNodes: T[];
  isProtectedSpineAncestor: boolean;
} {
  const byId = new Map<string, T>();
  people.forEach((p) => byId.set(p.id, p));

  const target = byId.get(targetPersonId);
  if (!target || target.isRecordKeeper) {
    return {
      allDeletedIds: new Set<string>(),
      descendantNodes: [],
      isProtectedSpineAncestor: false,
    };
  }

  // Build protected direct spine chain ascending from Record Keeper
  const recordKeeper = people.find((p) => p.isRecordKeeper);
  const protectedSpineIds = new Set<string>();
  let isProtectedSpineAncestor = false;

  if (recordKeeper) {
    protectedSpineIds.add(recordKeeper.id);
    const chainBelowTarget: string[] = [];
    let curr: T | undefined = recordKeeper;
    const guard = new Set<string>();
    while (curr && !guard.has(curr.id)) {
      guard.add(curr.id);
      if (curr.id === targetPersonId) {
        isProtectedSpineAncestor = true;
        chainBelowTarget.forEach((id) => protectedSpineIds.add(id));
        break;
      }
      chainBelowTarget.push(curr.id);
      curr = curr.fatherId ? byId.get(curr.fatherId) : undefined;
    }
  }

  // Identify top-level sibling IDs so deleting a spouse never deletes a blood top-level sibling
  const topRootAnchor =
    recordKeeper
      ? (() => {
          let curr: T | undefined = recordKeeper;
          const seen = new Set<string>();
          let highest: T = recordKeeper;
          while (curr && !seen.has(curr.id)) {
            seen.add(curr.id);
            highest = curr;
            curr = curr.fatherId ? byId.get(curr.fatherId) : undefined;
          }
          return highest;
        })()
      : undefined;
  const topLevelSiblingIds = topRootAnchor
    ? collectTopSiblingGroupIds(people, topRootAnchor)
    : new Set<string>();

  const toDelete = new Set<string>([targetPersonId]);
  let changed = true;

  while (changed) {
    changed = false;

    // 1. Cascade downward through all children & sub-branches
    for (const p of people) {
      if (toDelete.has(p.id) || protectedSpineIds.has(p.id)) continue;

      const fatherDeleted = Boolean(p.fatherId && toDelete.has(p.fatherId));
      const hasSurvivingFather = Boolean(
        p.fatherId && byId.has(p.fatherId) && !toDelete.has(p.fatherId)
      );
      const motherDeletedWithoutFather = Boolean(
        p.motherId && toDelete.has(p.motherId) && !hasSurvivingFather
      );

      if (fatherDeleted || motherDeletedWithoutFather) {
        toDelete.add(p.id);
        changed = true;
      }
    }

    // 2. Cascade to spouses attached exclusively to deleted nodes (no surviving blood line)
    for (const p of people) {
      if (toDelete.has(p.id) || protectedSpineIds.has(p.id)) continue;
      if (p.isBridgeAboveFamily) continue;
      if (topLevelSiblingIds.has(p.id)) continue;

      const hasSurvivingFather = Boolean(
        p.fatherId && byId.has(p.fatherId) && !toDelete.has(p.fatherId)
      );
      const hasSurvivingMother = Boolean(
        p.motherId && byId.has(p.motherId) && !toDelete.has(p.motherId)
      );
      if (hasSurvivingFather || hasSurvivingMother) continue;

      const linkedPartnerIds = new Set<string>();
      (p.spouseIds || []).forEach((sid) => {
        if (byId.has(sid)) linkedPartnerIds.add(sid);
      });
      people.forEach((other) => {
        if (other.id !== p.id && (other.spouseIds || []).includes(p.id)) {
          linkedPartnerIds.add(other.id);
        }
      });

      if (
        linkedPartnerIds.size > 0 &&
        Array.from(linkedPartnerIds).every((pid) => toDelete.has(pid))
      ) {
        toDelete.add(p.id);
        changed = true;
      }
    }
  }

  const descendantNodes = people.filter(
    (p) => p.id !== targetPersonId && toDelete.has(p.id)
  );

  return {
    allDeletedIds: toDelete,
    descendantNodes,
    isProtectedSpineAncestor,
  };
}

/**
 * Builds a strict top-down recursive pedigree tree from flat `InteractiveTreePerson[]`.
 *
 * Guarantees:
 * 1. Every child hangs strictly beneath its actual parent (`fatherId` / couple unit),
 *    never misplaced beneath an uncle/sibling.
 * 2. Siblings share the exact same parent `children[]` array — or, at the topmost level
 *    when no shared father has been added yet, share `topLevelRoots[]` connected upward
 *    to the preceding placeholder/ancestor node.
 * 3. Spouses without their own blood-line parent inside the tree attach horizontally beside
 *    their partner (Couple Unit) and are never duplicated.
 * 4. Cycle-safe and zero-loss: every non-bridge person is visited at most once, and any
 *    detached legacy nodes are cleanly surfaced in `detachedRoots`.
 */
function extractComparableBirthYear(person: PedigreePersonLike): number | null {
  const raw = (person.birthDateValue || '').trim();
  if (!raw) return null;
  const western = raw.replace(/[٠-٩]/g, (d) =>
    String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))
  );
  const match = western.match(/\b(\d{3,4})\b/);
  if (!match) return null;
  const yr = Number(match[1]);
  if (!Number.isFinite(yr)) return null;
  if (person.birthCalendar === 'hijri') {
    return Math.round(yr * (32 / 33) + 622);
  }
  return yr;
}

export function buildPedigreeTreeLayout<T extends PedigreePersonLike>(
  people: T[],
  options?: PedigreeLayoutOptions
): PedigreeTreeLayoutResult<T> {
  const siblingSortOrder = options?.siblingSortOrder || 'added';
  const focusRootId = options?.focusRootId || null;
  const activePeople = people.filter((p) => !p.isBridgeAboveFamily);
  if (activePeople.length === 0) {
    return {
      root: null,
      topLevelRoots: [],
      unpairedTopMother: null,
      detachedRoots: [],
      directSpineIds: new Set<string>(),
    };
  }

  const byId = new Map<string, T>();
  const indexById = new Map<string, number>();
  activePeople.forEach((p, idx) => {
    byId.set(p.id, p);
    indexById.set(p.id, idx);
  });

  // 1. Resolve the direct ascending spine from the Record Keeper to the highest added ancestor
  const recordKeeper =
    activePeople.find((p) => p.isRecordKeeper) || activePeople[0];
  const directSpineChain: T[] = [];
  const directSpineIds = new Set<string>();
  {
    let curr: T | undefined = recordKeeper;
    while (curr && !directSpineIds.has(curr.id)) {
      directSpineIds.add(curr.id);
      directSpineChain.push(curr);
      curr = curr.fatherId ? byId.get(curr.fatherId) : undefined;
    }
  }

  const topMostDirectAncestor =
    directSpineChain[directSpineChain.length - 1] || recordKeeper;

  const visitedIds = new Set<string>();

  // 2. Check if the top-most direct ancestor has an unpaired mother (no father yet)
  let unpairedTopMother: T | null = null;
  if (
    topMostDirectAncestor &&
    !topMostDirectAncestor.fatherId &&
    topMostDirectAncestor.motherId
  ) {
    const candidateMother = byId.get(topMostDirectAncestor.motherId);
    if (
      candidateMother &&
      candidateMother.id !== topMostDirectAncestor.id &&
      !directSpineIds.has(candidateMother.id)
    ) {
      const hasPartnerInTree = activePeople.some(
        (p) =>
          p.id !== candidateMother.id &&
          (candidateMother.spouseIds?.includes(p.id) ||
            p.spouseIds?.includes(candidateMother.id))
      );
      if (!hasPartnerInTree) {
        const otherChildrenOfMother = activePeople.filter(
          (c) =>
            c.id !== topMostDirectAncestor.id &&
            !c.fatherId &&
            c.motherId === candidateMother.id
        );
        if (otherChildrenOfMother.length === 0) {
          unpairedTopMother = candidateMother;
          visitedIds.add(candidateMother.id);
        }
      }
    }
  }

  const findAttachableSpouses = (node: T): T[] => {
    const spouses: T[] = [];
    for (const candidate of activePeople) {
      if (candidate.id === node.id) continue;
      if (visitedIds.has(candidate.id)) continue;
      if (directSpineIds.has(candidate.id)) continue;

      const isLinkedSpouse =
        (node.spouseIds || []).includes(candidate.id) ||
        (candidate.spouseIds || []).includes(node.id);
      if (!isLinkedSpouse) continue;

      if (candidate.fatherId && byId.has(candidate.fatherId)) continue;
      if (
        candidate.motherId &&
        byId.has(candidate.motherId) &&
        candidate.motherId !== unpairedTopMother?.id
      ) {
        continue;
      }

      spouses.push(candidate);
    }
    return spouses;
  };

  const buildSubtree = (
    node: T,
    parentIsDirectSpine: boolean
  ): PedigreeTreeNode<T> => {
    visitedIds.add(node.id);

    const spouses = findAttachableSpouses(node);
    spouses.forEach((s) => visitedIds.add(s.id));
    const spouseIdSet = new Set(spouses.map((s) => s.id));

    // Discover direct children of this person / couple unit
    const directChildren: T[] = [];
    for (const candidate of activePeople) {
      if (candidate.id === node.id) continue;
      if (visitedIds.has(candidate.id)) continue;
      if (spouseIdSet.has(candidate.id)) continue;

      const fatherMatches =
        candidate.fatherId === node.id ||
        spouses.some((s) => candidate.fatherId === s.id);
      const hasValidFatherInTree = Boolean(
        candidate.fatherId && byId.has(candidate.fatherId)
      );
      const motherMatches =
        !hasValidFatherInTree &&
        (candidate.motherId === node.id ||
          spouses.some((s) => candidate.motherId === s.id));

      if (fatherMatches || motherMatches) {
        directChildren.push(candidate);
      }
    }

    // Legacy safety: if a direct spine child of `node` has a legacy sibling whose `fatherId` was dropped
    const directSpineChild = directChildren.find((c) =>
      directSpineIds.has(c.id)
    );
    if (directSpineChild) {
      for (const candidate of activePeople) {
        if (visitedIds.has(candidate.id)) continue;
        if (directChildren.some((c) => c.id === candidate.id)) continue;
        if (spouseIdSet.has(candidate.id)) continue;
        if (candidate.fatherId && byId.has(candidate.fatherId)) continue;
        if (candidate.motherId && byId.has(candidate.motherId)) continue;
        if (
          !candidate.isDirectSpineLineage &&
          candidate.generationLevel === directSpineChild.generationLevel &&
          (candidate.relationToTargetLabel.includes(
            `أخ لـ ${directSpineChild.firstName}`
          ) ||
            candidate.relationToTargetLabel.includes(
              `أخت لـ ${directSpineChild.firstName}`
            ))
        ) {
          directChildren.push(candidate);
        }
      }
    }

    // Sort children: optionally by oldest birth year first, or direct spine + creation order
    directChildren.sort((a, b) => {
      if (siblingSortOrder === 'birth_oldest') {
        const yA = extractComparableBirthYear(a);
        const yB = extractComparableBirthYear(b);
        if (yA !== null && yB !== null && yA !== yB) return yA - yB;
        if (yA !== null && yB === null) return -1;
        if (yA === null && yB !== null) return 1;
      }
      const aSpine = directSpineIds.has(a.id) ? 0 : 1;
      const bSpine = directSpineIds.has(b.id) ? 0 : 1;
      if (aSpine !== bSpine) return aSpine - bSpine;
      return (indexById.get(a.id) ?? 0) - (indexById.get(b.id) ?? 0);
    });

    // Reserve all direct children IDs before recursing to guarantee sibling isolation
    directChildren.forEach((c) => visitedIds.add(c.id));

    const childSubtrees = directChildren.map((child) =>
      buildSubtree(child, directSpineIds.has(node.id))
    );

    return {
      person: node,
      spouses,
      children: childSubtrees,
      isDirectSpineEdge: parentIsDirectSpine && directSpineIds.has(node.id),
    };
  };

  // Determine the primary root: if topMostDirectAncestor has an unvisited mother with multiple children, start at that mother
  let rootPerson: T = topMostDirectAncestor;
  if (
    topMostDirectAncestor &&
    !topMostDirectAncestor.fatherId &&
    topMostDirectAncestor.motherId &&
    !unpairedTopMother
  ) {
    const mom = byId.get(topMostDirectAncestor.motherId);
    if (mom && !visitedIds.has(mom.id)) {
      rootPerson = mom;
    }
  }

  // If Sub-tree Focus mode is active, isolate layout exclusively to that ancestor & descendants
  if (focusRootId && byId.has(focusRootId)) {
    visitedIds.clear();
    const focusedTarget = byId.get(focusRootId)!;
    const focusedNode = buildSubtree(
      focusedTarget,
      directSpineIds.has(focusedTarget.id)
    );
    return {
      root: focusedNode,
      topLevelRoots: [focusedNode],
      unpairedTopMother: null,
      detachedRoots: [],
      directSpineIds,
    };
  }

  // Collect all top-level siblings sharing the topmost generation (no shared father added yet)
  const topSiblingGroupIds = collectTopSiblingGroupIds(activePeople, rootPerson);
  const topSiblingPeople = activePeople
    .filter((p) => topSiblingGroupIds.has(p.id) && !visitedIds.has(p.id))
    .sort((a, b) => {
      if (siblingSortOrder === 'birth_oldest') {
        const yA = extractComparableBirthYear(a);
        const yB = extractComparableBirthYear(b);
        if (yA !== null && yB !== null && yA !== yB) return yA - yB;
        if (yA !== null && yB === null) return -1;
        if (yA === null && yB !== null) return 1;
      }
      if (a.id === rootPerson.id) return -1;
      if (b.id === rootPerson.id) return 1;
      const aSpine = directSpineIds.has(a.id) ? 0 : 1;
      const bSpine = directSpineIds.has(b.id) ? 0 : 1;
      if (aSpine !== bSpine) return aSpine - bSpine;
      return (indexById.get(a.id) ?? 0) - (indexById.get(b.id) ?? 0);
    });

  // Reserve all top-level sibling IDs before recursing so each sibling subtree stays isolated
  topSiblingPeople.forEach((p) => visitedIds.add(p.id));

  const topLevelRoots = topSiblingPeople.map((topPerson) =>
    buildSubtree(topPerson, directSpineIds.has(topPerson.id))
  );
  const root = topLevelRoots[0] || null;

  // 3. Collect any detached/orphan legacy nodes so zero saved members are ever hidden
  const detachedRoots: PedigreeTreeNode<T>[] = [];
  const remaining = activePeople
    .filter((p) => !visitedIds.has(p.id))
    .sort((a, b) => b.generationLevel - a.generationLevel);

  for (const orphan of remaining) {
    if (visitedIds.has(orphan.id)) continue;
    let topOrphan = orphan;
    const guard = new Set<string>([topOrphan.id]);
    while (topOrphan.fatherId) {
      const parent = byId.get(topOrphan.fatherId);
      if (!parent || visitedIds.has(parent.id) || guard.has(parent.id)) break;
      guard.add(parent.id);
      topOrphan = parent;
    }
    detachedRoots.push(buildSubtree(topOrphan, false));
  }

  return {
    root,
    topLevelRoots,
    unpairedTopMother,
    detachedRoots,
    directSpineIds,
  };
}

/**
 * Counts total descendants (children + grandchildren + ...) under a pedigree node.
 */
export function countTreeNodeDescendants<T extends PedigreePersonLike>(
  node: PedigreeTreeNode<T>
): number {
  let total = 0;
  for (const child of node.children) {
    total += 1 + countTreeNodeDescendants(child);
  }
  return total;
}

export interface KinshipPathResult<T extends PedigreePersonLike> {
  connected: boolean;
  personA: T | null;
  personB: T | null;
  commonAncestor: T | null;
  relationshipLabel: string;
  degreeCount: number;
  stepsUpFromA: number;
  stepsUpFromB: number;
  pathNodes: T[];
  pathNodeIds: Set<string>;
}

/**
 * Calculates the shortest genealogical path and lowest common ancestor (الجد الجامع)
 * between two individuals in the family tree, returning an Arabic kinship label,
 * exact degree count, and highlighted path IDs.
 */
export function calculateKinshipPath<T extends PedigreePersonLike>(
  people: T[],
  personAId: string,
  personBId: string
): KinshipPathResult<T> {
  const byId = new Map<string, T>();
  people.forEach((p) => byId.set(p.id, p));

  const personA = byId.get(personAId) || null;
  const personB = byId.get(personBId) || null;

  if (!personA || !personB) {
    return {
      connected: false,
      personA,
      personB,
      commonAncestor: null,
      relationshipLabel: 'يرجى اختيار فردين من الشجرة',
      degreeCount: 0,
      stepsUpFromA: 0,
      stepsUpFromB: 0,
      pathNodes: [],
      pathNodeIds: new Set<string>(),
    };
  }

  if (personA.id === personB.id) {
    return {
      connected: true,
      personA,
      personB,
      commonAncestor: personA,
      relationshipLabel: 'نفس الفرد',
      degreeCount: 0,
      stepsUpFromA: 0,
      stepsUpFromB: 0,
      pathNodes: [personA],
      pathNodeIds: new Set<string>([personA.id]),
    };
  }

  // Direct spouse check
  const isDirectSpouse =
    (personA.spouseIds || []).includes(personB.id) ||
    (personB.spouseIds || []).includes(personA.id);
  if (isDirectSpouse) {
    return {
      connected: true,
      personA,
      personB,
      commonAncestor: null,
      relationshipLabel:
        personA.gender === 'male' ? 'علاقة مصاهرة (زوج وزوجة)' : 'علاقة مصاهرة (زوجة وزوج)',
      degreeCount: 1,
      stepsUpFromA: 0,
      stepsUpFromB: 0,
      pathNodes: [personA, personB],
      pathNodeIds: new Set<string>([personA.id, personB.id]),
    };
  }

  // Build ancestor chains (via fatherId first, then motherId) using BFS upward
  const buildAncestorsMap = (start: T): Map<string, { dist: number; path: string[] }> => {
    const map = new Map<string, { dist: number; path: string[] }>();
    const queue: Array<{ id: string; path: string[] }> = [{ id: start.id, path: [start.id] }];
    map.set(start.id, { dist: 0, path: [start.id] });

    while (queue.length > 0) {
      const curr = queue.shift()!;
      const node = byId.get(curr.id);
      if (!node) continue;
      const parents = [node.fatherId, node.motherId].filter(
        (pid): pid is string => Boolean(pid && byId.has(pid))
      );
      for (const pid of parents) {
        if (!map.has(pid)) {
          const nextPath = [...curr.path, pid];
          map.set(pid, { dist: nextPath.length - 1, path: nextPath });
          queue.push({ id: pid, path: nextPath });
        }
      }
    }
    return map;
  };

  const ancA = buildAncestorsMap(personA);
  const ancB = buildAncestorsMap(personB);

  let bestLcaId: string | null = null;
  let bestScore = Infinity;

  ancA.forEach((infoA, ancId) => {
    const infoB = ancB.get(ancId);
    if (!infoB) return;
    const score = infoA.dist + infoB.dist;
    if (score < bestScore) {
      bestScore = score;
      bestLcaId = ancId;
    }
  });

  if (bestLcaId) {
    const infoA = ancA.get(bestLcaId)!;
    const infoB = ancB.get(bestLcaId)!;
    const upA = infoA.dist;
    const upB = infoB.dist;
    const lcaNode = byId.get(bestLcaId) || null;
    const fullPathIds = [
      ...infoA.path,
      ...infoB.path.slice(0, -1).reverse(),
    ];
    const pathNodes = fullPathIds
      .map((id) => byId.get(id))
      .filter((n): n is T => Boolean(n));

    const describeBloodRelation = (): string => {
      if (upA === 0 && upB === 1) return personB.gender === 'female' ? 'ابنة مباشرة' : 'ابن مباشر';
      if (upB === 0 && upA === 1) return personB.gender === 'female' ? 'الأم المباشرة' : 'الأب المباشر';
      if (upA === 0 && upB === 2) return personB.gender === 'female' ? 'حفيدة' : 'حفيد';
      if (upB === 0 && upA === 2) return personB.gender === 'female' ? 'الجدة المباشرة' : 'الجد المباشر';
      if (upA === 0 && upB > 2) return `سليل مباشر (حفيد من الجيل ${upB})`;
      if (upB === 0 && upA > 2) return `جد مباشر (على بُعد ${upA} أجيال صعوداً)`;
      if (upA === 1 && upB === 1) return personB.gender === 'female' ? 'أخت شقيقة / من نفس الوالد' : 'أخ شقيق / من نفس الوالد';
      if (upA === 2 && upB === 1) return personB.gender === 'female' ? 'عمة / خالة' : 'عم / خال';
      if (upA === 1 && upB === 2) return personB.gender === 'female' ? 'ابنة أخ / أخت' : 'ابن أخ / أخت';
      if (upA === 2 && upB === 2) return 'أبناء عمومة من الدرجة الأولى';
      if (upA === 3 && upB === 1) return personB.gender === 'female' ? 'عمة الوالد' : 'عم الوالد';
      if (upA === 1 && upB === 3) return 'حفيد أخ / أخت';
      if (upA === upB) return `أبناء عمومة من الدرجة ${upA - 1}`;
      const minGen = Math.min(upA, upB);
      const diff = Math.abs(upA - upB);
      return `قرابة نسبية من الدرجة ${minGen} (بفارق ${diff} ${diff === 1 ? 'جيل' : 'أجيال'})`;
    };

    return {
      connected: true,
      personA,
      personB,
      commonAncestor: lcaNode,
      relationshipLabel: describeBloodRelation(),
      degreeCount: upA + upB,
      stepsUpFromA: upA,
      stepsUpFromB: upB,
      pathNodes,
      pathNodeIds: new Set<string>(fullPathIds),
    };
  }

  // Fallback: top-level siblings linked via `siblingOfId` or general undirected BFS across tree links
  const topSiblingsA = collectTopSiblingGroupIds(people, personA);
  if (topSiblingsA.has(personB.id)) {
    return {
      connected: true,
      personA,
      personB,
      commonAncestor: null,
      relationshipLabel: 'إخوة في أعلى طبقة مسجلة (بانتظار تسجيل الأب الجامع)',
      degreeCount: 2,
      stepsUpFromA: 1,
      stepsUpFromB: 1,
      pathNodes: [personA, personB],
      pathNodeIds: new Set<string>([personA.id, personB.id]),
    };
  }

  // General undirected BFS across parent, sibling, and spouse edges
  const adj = new Map<string, Set<string>>();
  const addEdge = (u: string, v: string) => {
    if (!byId.has(u) || !byId.has(v) || u === v) return;
    if (!adj.has(u)) adj.set(u, new Set());
    if (!adj.has(v)) adj.set(v, new Set());
    adj.get(u)!.add(v);
    adj.get(v)!.add(u);
  };

  people.forEach((p) => {
    if (p.fatherId) addEdge(p.id, p.fatherId);
    if (p.motherId) addEdge(p.id, p.motherId);
    if (p.siblingOfId) addEdge(p.id, p.siblingOfId);
    (p.spouseIds || []).forEach((sid) => addEdge(p.id, sid));
  });

  const visited = new Set<string>([personA.id]);
  const bfsQueue: Array<{ id: string; path: string[] }> = [
    { id: personA.id, path: [personA.id] },
  ];

  while (bfsQueue.length > 0) {
    const curr = bfsQueue.shift()!;
    if (curr.id === personB.id) {
      const pathNodes = curr.path
        .map((id) => byId.get(id))
        .filter((n): n is T => Boolean(n));
      return {
        connected: true,
        personA,
        personB,
        commonAncestor: null,
        relationshipLabel: `صلة عائلية / مصاهرة عبر ${curr.path.length - 1} خطوات`,
        degreeCount: curr.path.length - 1,
        stepsUpFromA: 0,
        stepsUpFromB: 0,
        pathNodes,
        pathNodeIds: new Set<string>(curr.path),
      };
    }
    const neighbors = adj.get(curr.id);
    if (!neighbors) continue;
    neighbors.forEach((nId) => {
      if (!visited.has(nId)) {
        visited.add(nId);
        bfsQueue.push({ id: nId, path: [...curr.path, nId] });
      }
    });
  }

  return {
    connected: false,
    personA,
    personB,
    commonAncestor: null,
    relationshipLabel: 'لا يوجد رابط مسجل بعد بين الفردين في الشجرة الحالية',
    degreeCount: 0,
    stepsUpFromA: 0,
    stepsUpFromB: 0,
    pathNodes: [],
    pathNodeIds: new Set<string>(),
  };
}
