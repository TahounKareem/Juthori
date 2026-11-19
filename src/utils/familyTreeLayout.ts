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
export function buildPedigreeTreeLayout<T extends PedigreePersonLike>(
  people: T[]
): PedigreeTreeLayoutResult<T> {
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

    // Sort children: direct spine child first (rightmost in RTL), then stable creation order
    directChildren.sort((a, b) => {
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

  // Collect all top-level siblings sharing the topmost generation (no shared father added yet)
  const topSiblingGroupIds = collectTopSiblingGroupIds(activePeople, rootPerson);
  const topSiblingPeople = activePeople
    .filter((p) => topSiblingGroupIds.has(p.id) && !visitedIds.has(p.id))
    .sort((a, b) => {
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
