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
  unpairedTopMother: T | null;
  detachedRoots: PedigreeTreeNode<T>[];
  directSpineIds: Set<string>;
}

/**
 * Builds a strict top-down recursive pedigree tree from flat `InteractiveTreePerson[]`.
 *
 * Guarantees:
 * 1. Every child hangs strictly beneath its actual parent (`fatherId` / couple unit),
 *    never misplaced beneath an uncle/sibling.
 * 2. Siblings share the exact same parent `children[]` array so they render side-by-side
 *    on the exact same horizontal baseline connected by a top parent bracket.
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
        // Check if this mother has other children besides topMostDirectAncestor
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

      // If this spouse already has a blood parent in this tree, keep them under their own parent
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

  // Determine the actual root: if topMostDirectAncestor has an unvisited mother with multiple children, start at that mother
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

  const root = buildSubtree(rootPerson, false);

  // 3. Collect any detached/orphan legacy nodes so zero saved members are ever hidden
  const detachedRoots: PedigreeTreeNode<T>[] = [];
  const remaining = activePeople
    .filter((p) => !visitedIds.has(p.id))
    .sort((a, b) => b.generationLevel - a.generationLevel);

  for (const orphan of remaining) {
    if (visitedIds.has(orphan.id)) continue;
    // Prefer starting from the highest unvisited ancestor of this orphan
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
    unpairedTopMother,
    detachedRoots,
    directSpineIds,
  };
}
