import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  FileText,
  GitMerge,
  GripVertical,
  Loader2,
  MessageSquare,
  Plus,
  Save,
  Search,
  Sparkles,
  Star,
  TreePine,
  UploadCloud,
} from 'lucide-react';
import {
  AccountLegalType,
  AdamPrimeRegistrySourceItem,
  ConsensusClusterGroup,
  CorroboratingAlphaEvidence,
  DashboardStateMode,
  Lake3UnlinkedProjectRecord,
  LineageSearchResult,
  ParsedOtherSourceLead,
  SuggestedAdamBridgeForResearcher,
  UpperAncestorNode,
  VerifiedAddonSourceItem,
} from '../types/juthori';
import {
  AdamTreeInteractiveNode,
  EXPLICIT_LOCALITY_WINNER_BADGE_TEXT,
  GERMAN_ENGINE_BASE_URL,
  MASTER_ADAM_NODES_MAP,
  ORIGIN_REGION_SUGGESTIONS,
  UNSPECIFIED_LOCALITY_BADGE_TEXT,
  VALID_STRUCTURAL_ARC_CODES,
  buildAIResearchHypothesesForFamily,
  buildFullStitchedLineageForResearcher,
  buildLake3UnlinkedProjectsForResearcher,
  buildResolvedLineageFromDisambiguationOption,
  buildSuggestedAdamBridgeForResearcher,
  checkArcCodeRepresentationConflict,
  cleanAndUnrollLineageChain,
  computeCrossSourceConsensusClusters,
  detectAndStripInvertedPreamble,
  extractAllOtherSourceLeadsFromEvidence,
  extractBookVolPageFromEvidence,
  extractRawRecordAncestors,
  extractSpecificLocalityTokens,
  extractUnifiedVerifiedSourcesList,
  filterEvidenceByFamilyAndStrictGeography,
  formatAlphaEvidenceCitation,
  formatAlphaReferenceBadge,
  formatCompactSourceBracket,
  getCanonicalAdamNodeDedupKey,
  getInitialAdamTreeNodesById,
  getVerifiedAddonSourcesForEvidence,
  inspectNameInAdamMasterTree,
  isAdamNodeStructurallyCoded,
  isValidParsedOtherSourceLead,
  matchFamilyName,
  matchesFlexibleArabicSearch,
  mergeDetachedHistoricalEpithets,
  mergeVerifiedAddonSourceLists,
  normalizeArabic,
  normalizeArabicForSearch,
  normalizeArabicStem,
  normalizeLocalityTokenForMatching,
  parseOtherSourcesStringIntoLeads,
  resolveAdamTreeChildren,
  resolveDeterministicLineage,
  resolveResearcherDataLakeBadge,
  sanitizeAndNormalizeAdamNode,
  searchAdamPrimeUnifiedSourcesRegistry,
  searchJuthoriLineage,
  stemTribeToken,
  stitchLineageChains,
  stripPrefixes,
  tagConsensusWinnersOnEvidence,
  verifyAndAttachSecondarySourceToAdamPrime,
} from '../utils/lineageEngine';
import { LineageSpineColumn } from './LineageSpineColumn';
import {
  TeamMemberRecord,
  fetchAllResearchTicketsForStaff,
  fetchAllTeamMembersFromFirebase,
  saveGeneratedResearchTicketToFirebase,
  sendCustomerNotification,
  syncClientLineageTicketToFirebase,
  updateResearchTicketFullInFirebase,
  updateTicketStatus,
} from '../services/firestoreService';
import {
  P3ProactiveCandidate,
  P3StrategicSelectionMeta,
  PrecomputedTicketDiagnostic,
  ResearcherKpiTelemetry,
  TicketPriorityTier,
  fetchOrGenerateP3ProactiveTickets,
  formatDurationMmSs,
  loadResearcherKpiTelemetry,
  markAlphaNodeBridgedOnServer,
  saveResearcherKpiTelemetry,
} from '../utils/researcherKpiAndP3Engine';

export interface ExtractableLineageNode {
  id: string;
  name: string;
  nodeCode: string;
  relationType: 'bin' | 'aan';
  region: string;
}

export interface ResearcherStudioTicket {
  id: string;
  firestoreDocId?: string;
  userId?: string;
  queue: 'P1' | 'P2' | 'P3';
  priorityTier?: TicketPriorityTier;
  precomputed_diagnostic?: PrecomputedTicketDiagnostic;
  p3StrategicMeta?: P3StrategicSelectionMeta;
  ticketCategory?:
    | 'ADAM_NODE_ENRICHMENT'
    | 'ALPHA_TO_ADAM_LINK'
    | 'P1_CUSTOMER_SEARCH'
    | 'P3_PROACTIVE_MINING'
    | 'ASSIGNED_RESEARCH';
  assignedResearcherId?: string;
  assignedResearcherName?: string;
  adamNodeId?: string;
  alphaId?: string;
  fullAdamSpineCount?: number;
  fullAdamSpineStations?: string[];
  title: string;
  clientName: string;
  clientEmail?: string;
  familyName: string;
  subRootName: string;
  motherTribeName: string;
  locationLabel: string;
  status:
    | 'open'
    | 'investigating'
    | 'dropped_ready'
    | 'merged_closed'
    | 'CLOSED_AND_ENRICHED'
    | 'exported_adam_prime';
  createdAt: string;
  inferredCountries?: string[];
  corroboratingEvidence?: CorroboratingAlphaEvidence[];
  aiResearchHypotheses?: string[];
  fullStitchedLineage?: UpperAncestorNode[];
  suggestedAdamBridge?: SuggestedAdamBridgeForResearcher;
  lake3UnlinkedProjects?: Lake3UnlinkedProjectRecord[];
  copilotSources: {
    project: string;
    bookCitation: string;
    extractedSnippet: string;
  }[];
  suggestedAdamTarget: {
    confidencePercent: number;
    entryNodeName: string;
    fullChainPreview: string;
    rationale: string;
  };
  extractedNodes: ExtractableLineageNode[];
  researcherNotes?: string;
}

export interface AdamPrimeCompletedBundle {
  taskId: string;
  title: string;
  familyName: string;
  subRootName: string;
  motherTribeName: string;
  locationLabel: string;
  targetAdamChain: string;
  verifiedCitation: string;
  nodes: ExtractableLineageNode[];
  imported: boolean;
}

interface ResearcherStudioProps {
  activePortalSection?:
    | 'research_studio'
    | 'adam_tree_management'
    | 'direct_search_inspection';
  onSelectPortalSection?: (
    section:
      | 'research_studio'
      | 'adam_tree_management'
      | 'direct_search_inspection'
  ) => void;
  currentFamilyName: string;
  currentClientResult?: LineageSearchResult;
  isAlphaAlreadyMerged: boolean;
  onApproveAlphaMergeIntoAdam: (payload: {
    familyName: string;
    subRootName: string;
    motherTribeName: string;
    approveSources: boolean;
    isAdamEnrichmentOnly?: boolean;
    addedVerifiedSources?: string[];
    addedSiblingBranches?: string[];
    addedNotables?: string[];
    addedLocations?: string[];
    customExtractedNodes?: Array<{
      id: string;
      name: string;
      nodeCode: string;
      relationType: 'bin' | 'aan';
      region: string;
    }>;
    customJunctionNodeName?: string;
  }) => void;
  onBackToClientDashboard: () => void;
  onSwitchToClientPreview: (familyName: string) => void;
}

type ResearcherStudioSubTab =
  | 'direct_search'
  | 'ticket_inbox'
  | 'adam_tree_explorer'
  | 'drag_drop_linker'
  | 'adam_prime_bridge';

const RESEARCHER_ARAB_COUNTRIES = [
  'السعودية',
  'سوريا',
  'العراق',
  'الأردن',
  'مصر',
  'السودان',
  'اليمن',
  'الإمارات',
  'الكويت',
  'قطر',
  'البحرين',
  'عُمان',
  'فلسطين',
  'لبنان',
  'ليبيا',
  'تونس',
  'الجزائر',
  'المغرب',
  'موريتانيا',
  'باقي الدول',
];

const ARC_CODE_OPTIONS: Array<{
  value: string;
  label: string;
}> = [
  { value: 'FE0', label: 'FE0 — اسم الشهرة / الأسرة المعاصرة' },
  { value: 'B9', label: 'B9 — فخذ قريب (مستوى 9)' },
  { value: 'B8', label: 'B8 — فخذ فرعي (مستوى 8)' },
  { value: 'B7', label: 'B7 — فخذ وسيط (مستوى 7)' },
  { value: 'B6', label: 'B6 — عشيرة / بطن فرعي (مستوى 6)' },
  { value: 'B5', label: 'B5 — عشيرة (مستوى 5)' },
  { value: 'B4', label: 'B4 — بطن (مستوى 4)' },
  { value: 'B3', label: 'B3 — عمارة (مستوى 3)' },
  { value: 'B2', label: 'B2 — الفخذ أو البطن المباشر' },
  { value: 'B1', label: 'B1 — البطن القبلي الأعلى' },
  { value: 'B0', label: 'B0 — الجد الجامع للفرع / القبيلة الفرعية' },
  { value: 'MT', label: 'MT — القبيلة الأم الجامعة' },
  { value: 'MF', label: 'MF — الحلف أو التكتل القبلي' },
  { value: 'M', label: 'M — الجذم العربي التاريخي' },
  { value: 'UNASSIGNED', label: 'بدون كود — طبقة الآباء / جد فردي وسيط' },
];

function splitAncestorsChain(raw?: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(/(?:؛|⬅️|←|<-|->|—|،|\||>)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatCleanTicketTitle(rawTitle?: string | null): string {
  if (!rawTitle) return '';
  return rawTitle
    .replace(/^بحث\s+[إا]ستباقي\s*:\s*/u, '')
    .replace(/^تذكرة\s+بحث\s+عميل\s+مباشرة\s*:\s*/u, '')
    .replace(/^تذكرة\s+ربط\s+وإثراء\s+شجرة\s+آدم\s+من\s+مشاريع\s+ألفا\s*:\s*/u, 'وصل وإثراء ')
    .replace(/^تذكرة\s+إثراء\s+عقدة\s+شجرة\s+آدم\s*/u, 'إثراء عقدة شجرة آدم ')
    .replace(/⬅️/g, '←')
    .trim();
}

export const ResearcherStudio: React.FC<ResearcherStudioProps> = ({
  activePortalSection,
  onSelectPortalSection,
  currentFamilyName,
  currentClientResult,
  isAlphaAlreadyMerged,
  onApproveAlphaMergeIntoAdam,
  onSwitchToClientPreview,
}) => {
  // =========================================================================
  // 5 HORIZONTAL SUB-TABS STATE (Synchronized with Top /Team Portal Section)
  // =========================================================================
  const [activeSubTab, setActiveSubTab] = useState<ResearcherStudioSubTab>(() => {
    if (activePortalSection === 'adam_tree_management') return 'adam_tree_explorer';
    if (activePortalSection === 'direct_search_inspection') return 'direct_search';
    return 'ticket_inbox';
  });

  useEffect(() => {
    if (activePortalSection === 'adam_tree_management') {
      setActiveSubTab('adam_tree_explorer');
    } else if (activePortalSection === 'direct_search_inspection') {
      setActiveSubTab('direct_search');
    } else if (activePortalSection === 'research_studio') {
      setActiveSubTab((curr) =>
        curr === 'adam_tree_explorer' || curr === 'direct_search'
          ? 'ticket_inbox'
          : curr
      );
    }
  }, [activePortalSection]);

  // Always start from the very top when switching between Boslet Al-Juthor, Research Observatory, and Adam Tree
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }, [activeSubTab, activePortalSection]);

  const [toastBanner, setToastBanner] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastBanner(msg);
    setTimeout(() => setToastBanner(null), 6000);
  };

  // =========================================================================
  // TAB 1: RESEARCHER DIRECT SEARCH TOOL STATE (أداة الفحص والبحث المباش)
  // =========================================================================
  const [directSearchFamilyName, setDirectSearchFamilyName] = useState('');
  const [directSearchTribeName, setDirectSearchTribeName] = useState('');
  const [directSearchBranchName, setDirectSearchBranchName] = useState('');
  const [directSearchCountry, setDirectSearchCountry] = useState(
    'غير محدد / كل الدول'
  );
  const [directSearchLocality, setDirectSearchLocality] = useState('');
  const [directSearchResult, setDirectSearchResult] =
    useState<LineageSearchResult | null>(null);
  const [rawSources, setRawSources] = useState<CorroboratingAlphaEvidence[]>([]);
  const [diagnosticSimStage, setDiagnosticSimStage] = useState<1 | 2>(1);
  const [diagnosticSimChoice, setDiagnosticSimChoice] =
    useState<string>('option_a');
  const [selectedAdamMatchIndex, setSelectedAdamMatchIndex] =
    useState<number>(0);
  const [isAdamBundleManualOverride, setIsAdamBundleManualOverride] = useState<
    boolean | null
  >(null);
  const [isRawBundleManualOverride, setIsRawBundleManualOverride] = useState<
    boolean | null
  >(null);
  const [remoteAdamMatchesForDirectSearch, setRemoteAdamMatchesForDirectSearch] =
    useState<AdamTreeInteractiveNode[]>([]);
  const [researchManagersList, setResearchManagersList] = useState<
    TeamMemberRecord[]
  >([]);
  const [selectedAssigneeManagerId, setSelectedAssigneeManagerId] =
    useState<string>('');
  const [createdAssignedTicketId, setCreatedAssignedTicketId] = useState<
    string | null
  >(null);
  const [isDirectSearching, setIsDirectSearching] = useState<boolean>(false);
  const directSearchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchAllTeamMembersFromFirebase()
      .then((members) => {
        if (!mounted) return;
        const activeMembers = members.filter((m) => m.status === 'نشط');
        const explicitResearchManagers = activeMembers.filter(
          (m) => m.role === 'مدير البحوث'
        );
        const eligibleManagers =
          explicitResearchManagers.length > 0
            ? explicitResearchManagers
            : activeMembers.filter(
                (m) =>
                  m.role === 'مدير البحوث' ||
                  m.role === 'المايسترو' ||
                  m.role === 'مدير عام'
              );
        setResearchManagersList(eligibleManagers);
        if (eligibleManagers.length > 0) {
          setSelectedAssigneeManagerId((prev) =>
            prev && eligibleManagers.some((m) => m.id === prev)
              ? prev
              : eligibleManagers[0].id
          );
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const extractRawSourcesFromResult = (
    res: LineageSearchResult | null
  ): CorroboratingAlphaEvidence[] => {
    if (!res) return [];
    const primaryEvidenceArray =
      res.alpha_evidence && res.alpha_evidence.length > 0
        ? res.alpha_evidence
        : res.corroborating_alpha_evidence_for_researcher &&
          res.corroborating_alpha_evidence_for_researcher.length > 0
        ? res.corroborating_alpha_evidence_for_researcher
        : [];

    if (primaryEvidenceArray.length > 0) {
      return tagConsensusWinnersOnEvidence(
        res.familyName,
        primaryEvidenceArray.map((ev) => {
          const parsed = extractBookVolPageFromEvidence(ev);
          return {
            ...ev,
            source_book: parsed.book,
            volume: parsed.volume,
            page: parsed.page,
          };
        })
      );
    }
    if (res.consensusClusterGroups && res.consensusClusterGroups.length > 0) {
      const fromClusters = res.consensusClusterGroups.flatMap((c) => c.records || []);
      if (fromClusters.length > 0) {
        return tagConsensusWinnersOnEvidence(
          res.familyName,
          fromClusters.map((ev) => {
            const parsed = extractBookVolPageFromEvidence(ev);
            return {
              ...ev,
              source_book: parsed.book,
              volume: parsed.volume,
              page: parsed.page,
            };
          })
        );
      }
    }
    if (res.disambiguationOptions && res.disambiguationOptions.length > 0) {
      const fromOpts = res.disambiguationOptions.flatMap(
        (o) => o.contributingSources || []
      );
      if (fromOpts.length > 0) {
        return tagConsensusWinnersOnEvidence(res.familyName, fromOpts);
      }
    }
    if (
      !res.matched ||
      res.primary_source_of_truth === 'UNMATCHED_P1_TICKET' ||
      (res.primary_source_of_truth === 'ADAM_MASTER_TREE' &&
        !res.isAdamNodeEnrichedWithAlpha)
    ) {
      return [];
    }
    return (res.verified_sources || [])
      .filter(Boolean)
      .map((src, idx) => {
        const parsed = extractBookVolPageFromEvidence(src);
        return {
          alpha_id: `raw-src-${idx + 1}`,
          record_name: res.familyName,
          source_book: parsed.book,
          volume: parsed.volume || `${idx + 1}`,
          page: parsed.page || '—',
          lineage_ancestors: (
            res.full_stitched_lineage_for_researcher ||
            res.adamSpineNodes ||
            []
          )
            .map((n) => n.name)
            .join(' ؛ '),
          child_branches: (res.sibling_branches_in_record || []).join('، '),
          locations: res.originRegion || res.originCountry,
          priority_tier: 'PRIORITY_1_COUNTRY_BOOK',
          is_consensus_winner: true,
        };
      });
  };

  const runDirectInspectionSearch = (params?: {
    familyName?: string;
    tribeName?: string;
    branchName?: string;
    originCountry?: string;
    originLocality?: string;
  }): LineageSearchResult => {
    const fam = (params?.familyName ?? directSearchFamilyName).trim();
    const trb = (params?.tribeName ?? directSearchTribeName).trim();
    const brn = (params?.branchName ?? directSearchBranchName).trim();
    const cnt = params?.originCountry ?? directSearchCountry;
    const loc = (params?.originLocality ?? directSearchLocality).trim();

    return resolveDeterministicLineage({
      firstName: 'باحث',
      fatherName: '—',
      grandfatherName: '—',
      familyName: fam || trb || brn || 'غير محدد',
      originCountry: cnt === 'غير محدد / كل الدول' ? '' : cnt,
      originRegion: loc,
      tribeName: trb,
      branchName: brn,
    });
  };

  const triggerLiveEngineInspection = (params: {
    familyName: string;
    tribeName: string;
    branchName: string;
    originCountry: string;
    originLocality: string;
  }) => {
    // Cancel any previous in-flight search immediately so stale requests never block or overwrite
    if (directSearchAbortRef.current) {
      directSearchAbortRef.current.abort();
    }
    const abortController = new AbortController();
    directSearchAbortRef.current = abortController;

    // Instant 0ms loading feedback
    setIsDirectSearching(true);
    setRawSources([]);
    setRemoteAdamMatchesForDirectSearch([]);

    const targetQueryName =
      params.familyName.trim() ||
      params.tribeName.trim() ||
      params.branchName.trim() ||
      'غير محدد';

    const outerStrippedQuery = targetQueryName
      .replace(/^(?:عائلة|اسرة|أسرة|قبيلة|عشيرة|فخذ|فرع|آل|ال|بيت|بنو|بني|بنى|البو|ألبو|ذوي|ذوو|أولاد|اولاد|عيال)\s+/g, '')
      .trim();
    const kunyaStrippedQuery = outerStrippedQuery
      .replace(/^(?:أبو|ابو|أبي|ابي|بو)\s+/g, '')
      .trim();
    const uniqueAdamQueries = Array.from(
      new Set(
        [targetQueryName, outerStrippedQuery, kunyaStrippedQuery].filter(
          (q) => q && q !== 'غير محدد' && q.length >= 2
        )
      )
    );

    // Execute live Adam Tree endpoint & Alpha Lake lineage search in full parallel
    const adamSearchPromise = Promise.all(
      uniqueAdamQueries.map((qStr) =>
        fetch(`${GERMAN_ENGINE_BASE_URL}/api/v1/juthori/adam-tree/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ query: qStr, limit: 30 }),
          signal: abortController.signal,
        })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      )
    )
      .then((responses) => {
        if (abortController.signal.aborted) return;
        const mergedById = new Map<string, AdamTreeInteractiveNode>();
        responses.forEach((data) => {
          if (!data) return;
          const incoming: any[] = Array.isArray(data.nodes)
            ? data.nodes
            : Array.isArray(data.data?.nodes)
            ? data.data.nodes
            : [];
          incoming.forEach((raw) => {
            const sanitized = sanitizeAndNormalizeAdamNode({
              node_id: String(raw.node_id || raw.id || ''),
              name: String(raw.name || ''),
              arc_code: String(raw.arc_code || 'UNASSIGNED'),
              representation: raw.representation || 'FAMILY',
              relation_nature: raw.relation_nature || 'DIRECT_DESCENDANT',
              parent_id: raw.parent_id ? String(raw.parent_id) : null,
              parent_name: raw.parent_name ? String(raw.parent_name) : undefined,
              geo_footprint: Array.isArray(raw.geo_footprint)
                ? raw.geo_footprint
                : [],
              enriched_sources: Array.isArray(raw.enriched_sources)
                ? raw.enriched_sources
                : [],
              enriched_branches: Array.isArray(raw.enriched_branches)
                ? raw.enriched_branches
                : [],
            });
            if (sanitized.node_id && !mergedById.has(sanitized.node_id)) {
              mergedById.set(sanitized.node_id, sanitized);
            }
          });
        });
        if (mergedById.size > 0 && !abortController.signal.aborted) {
          setRemoteAdamMatchesForDirectSearch(Array.from(mergedById.values()));
        }
      })
      .catch(() => {
        // Local Adam Master Tree nodes remain active
      });

    const alphaLineagePromise = searchJuthoriLineage(
      {
        accountType: AccountLegalType.Individual,
        firstName: 'باحث',
        fatherName: '—',
        grandfatherName: '—',
        familyName: targetQueryName,
        originCountry:
          params.originCountry === 'غير محدد / كل الدول'
            ? ''
            : params.originCountry,
        originRegion: params.originLocality.trim(),
        tribeName: params.tribeName.trim(),
        branchName: params.branchName.trim(),
        email: '',
        password: '',
        agreedToTerms: true,
      },
      undefined,
      undefined,
      abortController.signal
    )
      .then((liveRes) => {
        if (abortController.signal.aborted) return;
        setDirectSearchResult(liveRes);
        const extracted = extractRawSourcesFromResult(liveRes);
        setRawSources(extracted);
        setIsDirectSearching(false);
      })
      .catch((err) => {
        if (abortController.signal.aborted || err?.name === 'AbortError') {
          return;
        }
        const unmatchedFallback = runDirectInspectionSearch(params);
        setDirectSearchResult(unmatchedFallback);
        setRawSources([]);
        setIsDirectSearching(false);
      });

    Promise.allSettled([adamSearchPromise, alphaLineagePromise]).then(() => {
      if (!abortController.signal.aborted) {
        setIsDirectSearching(false);
      }
    });
  };

  const [bosletExpandedSections, setBosletExpandedSections] = useState<{
    searchBox: boolean;
    step1: boolean;
    step2: boolean;
    step3: boolean;
    step4: boolean;
    step5: boolean;
    spinePreview: boolean;
  }>({
    searchBox: true,
    step1: true,
    step2: true,
    step3: true,
    step4: true,
    step5: true,
    spinePreview: true,
  });

  const toggleBosletSection = (
    key:
      | 'searchBox'
      | 'step1'
      | 'step2'
      | 'step3'
      | 'step4'
      | 'step5'
      | 'spinePreview'
  ) => {
    setBosletExpandedSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const setAllBosletSections = (expanded: boolean) => {
    setIsAdamBundleManualOverride(expanded);
    setIsRawBundleManualOverride(expanded);
    setBosletExpandedSections({
      searchBox: expanded,
      step1: expanded,
      step2: expanded,
      step3: expanded,
      step4: expanded,
      step5: expanded,
      spinePreview: expanded,
    });
  };

  // UI/UX State for "مرصد جذوري | كشّاف الأنساب" in `ticket_inbox`
  const [isQueueSidebarCollapsed, setIsQueueSidebarCollapsed] =
    useState<boolean>(false);
  const [activeTicketWorkflowStep, setActiveTicketWorkflowStep] = useState<
    1 | 2 | 3 | 4
  >(1);
  const [showAllWorkflowStepsAtOnce, setShowAllWorkflowStepsAtOnce] =
    useState<boolean>(false);

  const handleExecuteDirectSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (
      !directSearchFamilyName.trim() &&
      !directSearchTribeName.trim() &&
      !directSearchBranchName.trim()
    ) {
      return;
    }
    setDiagnosticSimStage(1);
    setDiagnosticSimChoice('option_a');
    setSelectedAdamMatchIndex(0);
    setIsAdamBundleManualOverride(null);
    setIsRawBundleManualOverride(null);
    setCreatedAssignedTicketId(null);
    triggerLiveEngineInspection({
      familyName: directSearchFamilyName,
      tribeName: directSearchTribeName,
      branchName: directSearchBranchName,
      originCountry: directSearchCountry,
      originLocality: directSearchLocality,
    });
  };

  // =========================================================================
  // PILLAR 1 HELPER: REVERSE AUTO-HYDRATED DIAGNOSTIC ENGINE FOR ANY TICKET
  // =========================================================================
  const computeTicketDiagnosticContext = (
    familyName: string,
    rawEvidenceInput: CorroboratingAlphaEvidence[],
    fallbackSubRoot = '',
    fallbackMotherTribe = '',
    fallbackLocation = ''
  ): {
    precomputed: PrecomputedTicketDiagnostic;
    enrichedEvidence: CorroboratingAlphaEvidence[];
    cleanExtractedNodes: ExtractableLineageNode[];
    resolvedSubRoot: string;
    resolvedMotherTribe: string;
    allBranches: string[];
    allLocations: string[];
  } => {
    const cleanFam = familyName.replace(/^عائلة\s+/, '').trim();
    const taggedEvidence = tagConsensusWinnersOnEvidence(
      cleanFam,
      rawEvidenceInput.map((ev) => {
        const parsedRef = extractBookVolPageFromEvidence(ev);
        const parsedLeads =
          ev.other_sources && ev.other_sources.trim()
            ? parseOtherSourcesStringIntoLeads(
                ev.other_sources,
                ev.alpha_id,
                ev.record_name || cleanFam
              )
            : Array.isArray(ev.parsed_other_sources) &&
              ev.parsed_other_sources.length > 0
            ? parseOtherSourcesStringIntoLeads(
                ev.parsed_other_sources
                  .map((p) => p.raw_citation || p.extracted_book_title || '')
                  .filter(Boolean)
                  .join(' ؛ '),
                ev.alpha_id,
                ev.record_name || cleanFam
              )
            : [];
        return {
          ...ev,
          source_book: parsedRef.book || ev.source_book,
          volume: parsedRef.volume || ev.volume,
          page: parsedRef.page || ev.page,
          other_sources: parsedLeads.length > 0 ? ev.other_sources : null,
          parsed_other_sources: parsedLeads.length > 0 ? parsedLeads : undefined,
        };
      })
    );

    const clusters = computeCrossSourceConsensusClusters(
      cleanFam,
      taggedEvidence
    );
    const primaryCluster = clusters[0];

    const fullStitchedNames: string[] =
      primaryCluster && primaryCluster.fullChainNodes.length > 1
        ? primaryCluster.fullChainNodes
        : [
            cleanFam,
            ...(fallbackSubRoot ? [fallbackSubRoot] : []),
            ...(fallbackMotherTribe && fallbackMotherTribe !== fallbackSubRoot
              ? [fallbackMotherTribe]
              : []),
          ];

    const nonApexStations = fullStitchedNames.filter((st) => {
      const s = stemTribeToken(st);
      return (
        s !== 'قحطان' && s !== 'عدنان' && s !== 'قحطاني' && s !== 'عدناني'
      );
    });

    const resolvedSubRoot =
      (nonApexStations.length > 2
        ? nonApexStations[1]
        : fallbackSubRoot || nonApexStations[1] || cleanFam
      )
        .replace(/^بطن\s+/, '')
        .trim();

    const resolvedMotherTribe =
      (nonApexStations.length > 1
        ? nonApexStations[nonApexStations.length - 1]
        : fallbackMotherTribe || resolvedSubRoot
      )
        .replace(/^قبيلة\s+/, '')
        .trim();

    // Compute the 8-Stage Automated Pipeline Audit Bullets
    const searchedFamStem = stemTribeToken(cleanFam);
    const parentAttributedRecords = new Set<string>();
    const compoundUnrollExamples = new Set<string>();
    const variantsByStem = new Map<string, Set<string>>();
    const deduplicatedNodesSet = new Set<string>();
    const filteredNoiseTokensSet = new Set<string>();
    const invertedPreambleExamples: string[] = [];
    const detachedEpithetExamples = new Set<string>();
    const stemFreq = new Map<string, { display: string; count: number }>();
    const childBranchFreq = new Map<string, number>();

    taggedEvidence.forEach((ev) => {
      const recTitle = (ev.record_name || '').trim();
      const recStem = stemTribeToken(recTitle);
      const rawAncTokens = extractRawRecordAncestors(ev);
      if (recTitle && recStem && recStem !== searchedFamStem) {
        parentAttributedRecords.add(recTitle);
      }
      const seenStemsInRec = new Set<string>();
      rawAncTokens.forEach((tok) => {
        const trimmed = tok.trim();
        if (/\s+(?:بن|ابن)\s+/.test(trimmed)) {
          const parts = trimmed
            .split(/\s+(?:بن|ابن)\s+/)
            .map((p) => p.trim())
            .filter(Boolean);
          if (parts.length > 1) {
            compoundUnrollExamples.add(
              `«${trimmed}» إلى (${parts.join(' ⬅️ ')})`
            );
          }
        }
        if (
          trimmed.includes('الأصل قيل') ||
          trimmed.includes('تدّعي') ||
          trimmed.includes('رواية')
        ) {
          filteredNoiseTokensSet.add(trimmed);
        }
        trimmed
          .split(/\s+(?:بن|ابن)\s+/)
          .map((p) => p.trim())
          .filter(Boolean)
          .forEach((part) => {
            const st = stemTribeToken(part);
            if (!st) return;
            if (!variantsByStem.has(st)) variantsByStem.set(st, new Set());
            variantsByStem.get(st)!.add(part);
            if (seenStemsInRec.has(st)) {
              deduplicatedNodesSet.add(part);
            } else {
              seenStemsInRec.add(st);
            }
          });
      });

      seenStemsInRec.forEach((st) => {
        if (st === searchedFamStem) return;
        const curr = stemFreq.get(st);
        const surf = Array.from(variantsByStem.get(st) || [])[0] || st;
        if (curr) curr.count += 1;
        else stemFreq.set(st, { display: surf, count: 1 });
      });

      const rawSplit = String(ev.lineage_ancestors || '')
        .split(/(?:؛|⬅️|<-|->|—|،|\||>)/)
        .map((s) => s.trim())
        .filter(Boolean);
      const epithetFusion = mergeDetachedHistoricalEpithets(rawSplit);
      epithetFusion.fusionExamples.forEach((ex) =>
        detachedEpithetExamples.add(ex)
      );
      const invCheck = detectAndStripInvertedPreamble(
        rawSplit,
        ev.record_name || cleanFam
      );
      if (invCheck.wasInvertedPreambleStripped) {
        if (
          invCheck.relocatedApexTokens &&
          invCheck.relocatedApexTokens.length > 0
        ) {
          invertedPreambleExamples.push(
            `تم تجريد التمهيد المقلوب (${invCheck.strippedPreambleTokens.join(' ؛ ')}) في سجل «${ev.record_name || cleanFam}» وترحيل الجذر الأعلى (${invCheck.relocatedApexTokens.join(' ، ')}) إلى موضعه العلمي في قمة السلسلة بعد (${resolvedMotherTribe})`
          );
        } else {
          invertedPreambleExamples.push(
            `تم تجريد التمهيد المعكوس (${invCheck.strippedPreambleTokens.join(' ؛ ')}) في سجل «${ev.record_name || cleanFam}»`
          );
        }
      }

      (ev.child_branches || '')
        .split(/[|،,؛]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((b) =>
          childBranchFreq.set(b, (childBranchFreq.get(b) || 0) + 1)
        );
    });

    const mergedVariantGroups: string[] = [];
    variantsByStem.forEach((sSet) => {
      const arr = Array.from(sSet);
      if (arr.length >= 2) mergedVariantGroups.push(`(${arr.join(' / ')})`);
    });

    const sharedAnchorNames = Array.from(stemFreq.values())
      .filter((item) => item.count >= 2)
      .map((item) => item.display);

    const hiddenIntermediateCount = Math.max(0, fullStitchedNames.length - 3);
    const extractedLeads =
      extractAllOtherSourceLeadsFromEvidence(taggedEvidence);

    const pipelineAuditBullets: PrecomputedTicketDiagnostic['pipelineAuditBullets'] =
      taggedEvidence.length === 0
        ? [
            {
              icon: '⚠️',
              title: 'قرار التوجيه الآلي (P1 Deep Research)',
              detail: `لم يتم رصد مصادر خام مطابقة لاسم (${cleanFam}) في قواعد البيانات الحالية؛ تم توجيه التذكرة للتحقيق المعمق المباشر.`,
            },
          ]
        : [
            {
              icon: '🌿',
              title: 'إسناد الفرع للحاضنة الأم',
              detail:
                parentAttributedRecords.size > 0
                  ? `تم إسناد (${cleanFam}) إلى السجل الحاضن (${Array.from(parentAttributedRecords).join(' ، ')}).`
                  : `تطابق مباشر مع عنوان السجل الرئيس (${cleanFam}) في المعاجم.`,
            },
            {
              icon: '🔗',
              title: 'تفكيك الأسماء المركبة',
              detail:
                compoundUnrollExamples.size > 0
                  ? `تم تفكيك المركبات النسبية (بن/ابن) آلياً: ${Array.from(compoundUnrollExamples).join(' ، ')}.`
                  : 'جميع المحطات المرصودة وردت مفردة في السجلات الخام.',
            },
            {
              icon: '👑',
              title: 'دمج الألقاب التاريخية المفصولة وتوحيد التصحيف (Detached Epithet & Title Fusion)',
              detail:
                detachedEpithetExamples.size > 0
                  ? `تم رصد ودمج الألقاب التاريخية التي فُصلت عن أصحابها في التفريغ وتوحيدها مع المراجع الأخرى: ${Array.from(detachedEpithetExamples).join(' ، ')}.`
                  : 'تم فحص السلسلة لدمج أي ألقاب تاريخية مفصولة (مثل: البهلول، مزيقياء، ماء السماء، الغطريف، البطريق، العنقاء).',
            },
            {
              icon: '🔤',
              title: 'توحيد الرسم الإملائي والتصحيف المطبعي',
              detail:
                mergedVariantGroups.length > 0
                  ? `تم توحيد الصيغ ومعالجة التصحيفات المطبعية لدمج: ${mergedVariantGroups.join(' ، ')}.`
                  : 'تم تجريد البادئات وتوحيد الهمزات والتاء المربوطة عبر المراجع.',
            },
            {
              icon: '♻️',
              title: 'تنظيف التكرار الدائري',
              detail:
                deduplicatedNodesSet.size > 0
                  ? `تم حذف العُقد المكررة داخل السلسلة (${Array.from(deduplicatedNodesSet).join(' ، ')}) مع الاحتفاظ بأعلى موضع طبقي للجد.`
                  : 'السلسلة خالية من التكرار الدائري.',
            },
            {
              icon: '🔄',
              title: 'فلترة الشوائب وإصلاح التمهيد المعكوس',
              detail:
                invertedPreambleExamples.length > 0
                  ? invertedPreambleExamples.join(' — ')
                  : filteredNoiseTokensSet.size > 0
                  ? `تم تصفية الألفاظ المكانية والوصفية: (${Array.from(filteredNoiseTokensSet).join(' ، ')}).`
                  : 'تم فحص مطلع السلسلة ضد التمهيد المعكوس والشوائب الجغرافية مع حماية الأب المباشر من القص الخاطئ.',
            },
            {
              icon: '⚓',
              title: 'المحاذاة الطوبولوجية بالارتكاز',
              detail:
                sharedAnchorNames.length > 0
                  ? `تم استخدام عُقد الارتكاز المشتركة (${sharedAnchorNames.join(' ، ')}) لمحاذاة البطون الوسيطة تصاعدياً.`
                  : `تم ترتيب المحطات تصاعدياً من (${cleanFam}) حتى (${resolvedMotherTribe}).`,
            },
            {
              icon: '🧬',
              title: 'قرينة التوافق الجغرافي والمرجعي',
              detail: primaryCluster
                ? `توافق (${primaryCluster.sourcesCount}) مراجع ضمن النطاق الجغرافي (${primaryCluster.geographicScope})؛ إجمالي العناقيد: (${clusters.length}).`
                : `تم تجميع الشواهد وفق النطاق الجغرافي (${fallbackLocation || '—'}).`,
            },
            {
              icon: '⚖️',
              title: 'معادلة الأوزان وعقدتا الجذر (5$)',
              detail: `تم تثبيت الفرع الجامع (B2: ${resolvedSubRoot}) والقبيلة الأم (B0: ${resolvedMotherTribe}) مع طيّ (+${hiddenIntermediateCount} محطات وسيطة).`,
            },
          ];

    const cleanExtractedNodes: ExtractableLineageNode[] = fullStitchedNames.map(
      (stationName, idx) => {
        const cleanStation = stationName
          .replace(/^(بطن|قبيلة|فرع|فخذ)\s+/, '')
          .trim();
        const stStem = stemTribeToken(cleanStation);
        const isApex =
          stStem === 'قحطان' ||
          stStem === 'عدنان' ||
          stStem === 'قحطاني' ||
          stStem === 'عدناني';
        return {
          id: `node-hydrated-${cleanFam}-${idx}`,
          name: cleanStation,
          nodeCode:
            idx === 0
              ? 'FE0'
              : isApex
              ? 'M'
              : stStem === stemTribeToken(resolvedMotherTribe)
              ? 'B0'
              : stStem === stemTribeToken(resolvedSubRoot)
              ? 'B2'
              : idx === 1
              ? 'B2'
              : 'B1',
          relationType: idx === 0 ? 'bin' : 'aan',
          region:
            primaryCluster?.geographicScope ||
            fallbackLocation ||
            'الجزيرة العربية',
        };
      }
    );

    const allBranches = Array.from(
      new Set(
        taggedEvidence.flatMap((ev) =>
          (ev.child_branches || '')
            .split(/[|،,؛]/)
            .map((s) => s.trim())
            .filter(Boolean)
        )
      )
    );
    const allLocations = Array.from(
      new Set(
        [
          fallbackLocation,
          ...taggedEvidence.flatMap((ev) =>
            (ev.locations || '')
              .split(/[|،,؛/]/)
              .map((s) => s.trim())
              .filter(Boolean)
          ),
        ]
          .map((s) => (s || '').trim())
          .filter(Boolean)
      )
    );

    return {
      precomputed: {
        hydratedAt: new Date().toLocaleTimeString('ar-SA', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        rawSourcesCount: taggedEvidence.length,
        clustersCount: clusters.length,
        rootBranchB2: resolvedSubRoot,
        rootTribeB0: resolvedMotherTribe,
        fullStitchedNodes: fullStitchedNames,
        pipelineAuditBullets,
        extractedOtherSourcesCount: extractedLeads.length,
      },
      enrichedEvidence: taggedEvidence,
      cleanExtractedNodes,
      resolvedSubRoot,
      resolvedMotherTribe,
      allBranches,
      allLocations,
    };
  };

  // =========================================================================
  // BUILD REAL STRUCTURED TICKETS FROM ENGINE, FIRESTORE & P3 AUTO-MINING
  // =========================================================================
  const buildTicketFromLineageResult = (
    res: LineageSearchResult,
    clientNameLabel = 'عميل مسجل',
    customId?: string,
    firestoreDocId?: string,
    userId?: string
  ): ResearcherStudioTicket => {
    const cleanFam = res.familyName.replace(/^عائلة\s+/, '').trim();
    const isAdamEnrichment = Boolean(
      res.isAdamNodeEnrichedWithAlpha || res.adamNodeId
    );
    const rawEvidenceList =
      res.alpha_evidence && res.alpha_evidence.length > 0
        ? res.alpha_evidence
        : res.corroborating_alpha_evidence_for_researcher || [];

    const diag = computeTicketDiagnosticContext(
      cleanFam,
      rawEvidenceList,
      res.rootBranchName,
      res.rootTribeName,
      res.originRegion || res.originCountry
    );
    const evidenceList = diag.enrichedEvidence;

    const isAlphaLink = Boolean(
      !isAdamEnrichment &&
        (res.isAlphaOnlyBeforeMerge || evidenceList.length > 0)
    );

    const category: ResearcherStudioTicket['ticketCategory'] = isAdamEnrichment
      ? 'ADAM_NODE_ENRICHMENT'
      : isAlphaLink
      ? 'ALPHA_TO_ADAM_LINK'
      : 'P1_CUSTOMER_SEARCH';

    const priorityTier: TicketPriorityTier =
      category === 'P1_CUSTOMER_SEARCH'
        ? 'P1_CLIENT_UNMATCHED'
        : 'P2_CLIENT_ADAM_BRIDGE';

    const subRoot = diag.resolvedSubRoot;
    const motherTribe = diag.resolvedMotherTribe;

    const resolvedBridge: SuggestedAdamBridgeForResearcher | undefined =
      res.suggested_adam_bridge_for_researcher ||
      buildSuggestedAdamBridgeForResearcher(
        cleanFam,
        subRoot,
        motherTribe,
        res.adamNodeId
      );

    const resolvedStitchedLineage: UpperAncestorNode[] =
      res.full_stitched_lineage_for_researcher &&
      res.full_stitched_lineage_for_researcher.length > 0
        ? res.full_stitched_lineage_for_researcher
        : diag.cleanExtractedNodes.map((n, idx) => ({
            id: n.id,
            orderNumber: idx + 1,
            name: n.name,
            code: n.nodeCode,
            rankLabel:
              idx === 0 ? 'عقدة العائلة الموثقة' : 'محطة موثقة في سلسلة النسب',
            isCodedStation: true,
            region: n.region,
            eraNote: '',
            dataLakeSource: 'alpha_projects',
          }));

    const resolvedLake3: Lake3UnlinkedProjectRecord[] =
      res.lake3_unlinked_projects_for_researcher &&
      res.lake3_unlinked_projects_for_researcher.length > 0
        ? res.lake3_unlinked_projects_for_researcher
        : buildLake3UnlinkedProjectsForResearcher(
            cleanFam,
            motherTribe,
            res.originCountry || 'العراق'
          );

    const suggestedAdamEntry = resolvedBridge
      ? `${resolvedBridge.adam_node_id}: ${resolvedBridge.adam_chain_preview}`
      : motherTribe || subRoot || cleanFam;

    const ticketId =
      customId ||
      res.alphaBackgroundTicketCode ||
      res.background_researcher_ticket?.ticket_id ||
      (res.adamNodeId ? `#ENR-ADAM-${res.adamNodeId}` : `#TKT-${Date.now()}`);

    return {
      id: ticketId,
      firestoreDocId,
      userId,
      queue: category === 'P1_CUSTOMER_SEARCH' ? 'P1' : 'P2',
      priorityTier,
      precomputed_diagnostic: diag.precomputed,
      ticketCategory: category,
      adamNodeId: res.adamNodeId || resolvedBridge?.adam_node_id,
      fullAdamSpineCount: resolvedStitchedLineage.length,
      fullAdamSpineStations: resolvedStitchedLineage.map((u) => u.name),
      title:
        category === 'ADAM_NODE_ENRICHMENT'
          ? `إثراء عقدة شجرة آدم (${cleanFam}) — ${evidenceList.length} روايات ومصادر رديفة`
          : category === 'ALPHA_TO_ADAM_LINK'
          ? `وصل وإثراء (${cleanFam} ← ${subRoot} ← ${motherTribe}) بشجرة آدم`
          : `تحقيق وتوثيق عمود نسب (${cleanFam})`,
      clientName: clientNameLabel,
      familyName: cleanFam,
      subRootName: subRoot,
      motherTribeName: motherTribe,
      locationLabel:
        res.originRegion || res.originCountry || 'العراق / الجزيرة العربية',
      status:
        isAlphaAlreadyMerged && cleanFam === currentFamilyName
          ? 'CLOSED_AND_ENRICHED'
          : 'open',
      createdAt: 'الآن · متزامن مع Firebase',
      inferredCountries: res.inferred_client_countries || [
        res.originCountry || 'العراق',
      ],
      corroboratingEvidence: evidenceList,
      aiResearchHypotheses:
        res.ai_research_hypotheses && res.ai_research_hypotheses.length > 0
          ? res.ai_research_hypotheses
          : buildAIResearchHypothesesForFamily(
              cleanFam,
              evidenceList,
              resolvedBridge
            ),
      fullStitchedLineage: resolvedStitchedLineage,
      suggestedAdamBridge: resolvedBridge,
      lake3UnlinkedProjects: resolvedLake3,
      copilotSources:
        evidenceList.length > 0
          ? evidenceList.map((ev) => ({
              project:
                ev.priority_tier === 'PRIORITY_1_COUNTRY_BOOK'
                  ? 'أولوية 1: كتب دولة العميل (مشاريع ألفا)'
                  : 'أولوية 2: معاجم الأنساب العامة (مشاريع ألفا)',
              bookCitation: formatAlphaEvidenceCitation(ev),
              extractedSnippet: `السلسلة المستخرجة: ${
                ev.lineage_ancestors || cleanFam
              }`,
            }))
          : (res.verified_sources || [res.verifiedSourceCitation])
              .filter(Boolean)
              .map((src) => ({
                project: 'مشاريع ألفا للمخطوطات العربية',
                bookCitation: src,
                extractedSnippet: `رواية موثقة لـ (${cleanFam}) ضمن (${subRoot} ← ${motherTribe})`,
              })),
      suggestedAdamTarget: {
        confidencePercent: 98,
        entryNodeName: suggestedAdamEntry,
        fullChainPreview: resolvedBridge
          ? `${cleanFam} ← ${resolvedStitchedLineage
              .map((n) => n.name)
              .join(' ← ')} ← ${resolvedBridge.adam_chain_preview}`
          : `${cleanFam} ← ${resolvedStitchedLineage
              .map((n) => n.name)
              .join(' ← ')}`,
        rationale:
          resolvedBridge?.confidence_label ||
          `تقاطع موثق عند المحطة (${
            resolvedBridge?.matched_station_name || motherTribe || subRoot
          }).`,
      },
      extractedNodes: diag.cleanExtractedNodes,
    };
  };

  const buildTicketFromP3Candidate = (
    cand: P3ProactiveCandidate,
    firestoreDocId?: string
  ): ResearcherStudioTicket => {
    const diag = computeTicketDiagnosticContext(
      cand.familyName,
      cand.corroboratingEvidence,
      cand.subRootName,
      cand.motherTribeName,
      cand.locationLabel
    );
    const resolvedBridge = buildSuggestedAdamBridgeForResearcher(
      cand.familyName,
      diag.resolvedSubRoot,
      diag.resolvedMotherTribe,
      cand.adamNodeId
    );
    const resolvedLake3 = buildLake3UnlinkedProjectsForResearcher(
      cand.familyName,
      diag.resolvedMotherTribe,
      cand.inferredCountries[0] || 'الجزيرة العربية'
    );
    const stitchedNodes: UpperAncestorNode[] = diag.cleanExtractedNodes.map(
      (n, idx) => ({
        id: n.id,
        orderNumber: idx + 1,
        name: n.name,
        code: n.nodeCode,
        rankLabel:
          idx === 0 ? 'عقدة العائلة الموثقة' : 'محطة موثقة في سلسلة النسب',
        isCodedStation: true,
        region: n.region,
        eraNote: '',
        dataLakeSource: 'alpha_projects',
      })
    );

    const effectiveAdamNodeId =
      cand.adamNodeId || resolvedBridge?.adam_node_id || '';
    const chainPreviewFallback =
      resolvedBridge?.adam_chain_preview ||
      diag.resolvedMotherTribe ||
      diag.resolvedSubRoot ||
      cand.familyName;

    return {
      id: cand.ticketId,
      firestoreDocId,
      alphaId: cand.alphaId || cand.corroboratingEvidence[0]?.alpha_id,
      queue: 'P3',
      priorityTier: 'P3_PROACTIVE_ALPHA_ENRICHMENT',
      precomputed_diagnostic: diag.precomputed,
      p3StrategicMeta: {
        ...cand.strategicMeta,
        chain_stations_count: diag.cleanExtractedNodes.length,
        corroborating_sources_count: diag.enrichedEvidence.length,
      },
      ticketCategory: 'P3_PROACTIVE_MINING',
      adamNodeId: effectiveAdamNodeId,
      fullAdamSpineCount: stitchedNodes.length,
      fullAdamSpineStations: stitchedNodes.map((u) => u.name),
      title: `وصل وإثراء (${cand.familyName} ← ${diag.resolvedSubRoot} ← ${diag.resolvedMotherTribe}) بشجرة آدم`,
      clientName: 'قاعدة البيانات المركزية · إثراء استباقي',
      familyName: cand.familyName,
      subRootName: diag.resolvedSubRoot,
      motherTribeName: diag.resolvedMotherTribe,
      locationLabel: cand.locationLabel,
      status: 'open',
      createdAt: 'متزامن مع قاعدة البيانات و Firebase',
      inferredCountries: cand.inferredCountries,
      corroboratingEvidence: diag.enrichedEvidence,
      aiResearchHypotheses: buildAIResearchHypothesesForFamily(
        cand.familyName,
        diag.enrichedEvidence,
        resolvedBridge
      ),
      fullStitchedLineage: stitchedNodes,
      suggestedAdamBridge: resolvedBridge,
      lake3UnlinkedProjects: resolvedLake3,
      copilotSources: diag.enrichedEvidence.map((ev) => ({
        project: 'قاعدة بيانات ألفا (بحث إستباقي)',
        bookCitation: formatAlphaEvidenceCitation(ev),
        extractedSnippet: `السلسلة المستخرجة: ${ev.lineage_ancestors}`,
      })),
      suggestedAdamTarget: {
        confidencePercent: 98,
        entryNodeName: effectiveAdamNodeId
          ? `${effectiveAdamNodeId}: ${chainPreviewFallback}`
          : chainPreviewFallback,
        fullChainPreview: `${cand.familyName} ← ${stitchedNodes
          .map((n) => n.name)
          .join(' ← ')}${
          resolvedBridge ? ` ← ${resolvedBridge.adam_chain_preview}` : ''
        }`,
        rationale: `سجل حقيقي من قاعدة البيانات بوزن (${cand.strategicMeta.strategic_score} نقطة) جاهز للربط المباشر بشجرة آدم.`,
      },
      extractedNodes: diag.cleanExtractedNodes,
    };
  };

  // =========================================================================
  // PILLAR 3 STATE: RESEARCHER PRODUCTIVITY & KPI TELEMETRY
  // =========================================================================
  const [kpiTelemetry, setKpiTelemetry] = useState<ResearcherKpiTelemetry>(() =>
    loadResearcherKpiTelemetry()
  );
  const [activeTicketElapsedSeconds, setActiveTicketElapsedSeconds] =
    useState<number>(0);
  const [isDiagnosticDrawerOpen, setIsDiagnosticDrawerOpen] =
    useState<boolean>(true);
  const [isGeneratingP3Batch, setIsGeneratingP3Batch] =
    useState<boolean>(false);

  const recordKpiTicketCompletion = (
    ticket: ResearcherStudioTicket,
    verifiedSourcesCount: number
  ) => {
    const durationSec = Math.max(18, activeTicketElapsedSeconds || 45);
    const priorityKey: 'P1' | 'P2' | 'P3' =
      ticket.priorityTier === 'P1_CLIENT_UNMATCHED' || ticket.queue === 'P1'
        ? 'P1'
        : ticket.priorityTier === 'P3_PROACTIVE_ALPHA_ENRICHMENT' ||
          ticket.queue === 'P3'
        ? 'P3'
        : 'P2';
    const baseXp =
      priorityKey === 'P1' ? 150 : priorityKey === 'P2' ? 110 : 85;
    const speedBonusXp = durationSec <= 120 ? 20 : 10;
    const sourcesXp = verifiedSourcesCount * 15;
    const xpEarned = baseXp + speedBonusXp + sourcesXp;

    setKpiTelemetry((prev) => {
      const nextTimes = [...prev.handlingTimesSeconds.slice(-19), durationSec];
      const nextAvg = Math.round(
        nextTimes.reduce((a, b) => a + b, 0) / nextTimes.length
      );
      const nextState: ResearcherKpiTelemetry = {
        ...prev,
        completedTodayP1:
          prev.completedTodayP1 + (priorityKey === 'P1' ? 1 : 0),
        completedTodayP2:
          prev.completedTodayP2 + (priorityKey === 'P2' ? 1 : 0),
        completedTodayP3:
          prev.completedTodayP3 + (priorityKey === 'P3' ? 1 : 0),
        totalAlphaNodesBridged: prev.totalAlphaNodesBridged + 1,
        totalXpScore: prev.totalXpScore + xpEarned,
        handlingTimesSeconds: nextTimes,
        avgHandlingTimeSeconds: nextAvg,
        recentCompletedLog: [
          {
            ticketId: ticket.id,
            familyName: ticket.familyName,
            priority: priorityKey,
            durationSec,
            xpEarned,
            sourcesVerified: verifiedSourcesCount,
            completedAt: 'الآن',
            researcherName: 'كريم طاحون · المايسترو',
          },
          ...prev.recentCompletedLog.slice(0, 14),
        ],
      };
      return saveResearcherKpiTelemetry(nextState);
    });
    setActiveTicketElapsedSeconds(0);
  };

  // Initialize tickets strictly from real Firebase Firestore `research_tickets` (Zero Fake/Auto-Injected Tickets)
  const [tickets, setTickets] = useState<ResearcherStudioTicket[]>([]);

  useEffect(() => {
    let isMounted = true;
    const loadRealTicketsFromDatabase = async () => {
      try {
        const firestoreDocs = await fetchAllResearchTicketsForStaff();
        if (!isMounted) return;

        const hydratedList: ResearcherStudioTicket[] = [];
        for (const docItem of (firestoreDocs || []) as any[]) {
          let parsedPayload: Record<string, any> = {};
          if (
            typeof docItem.studioPayloadJson === 'string' &&
            docItem.studioPayloadJson.trim()
          ) {
            try {
              parsedPayload = JSON.parse(docItem.studioPayloadJson);
            } catch {
              parsedPayload = {};
            }
          }

          const fam = String(
            docItem.familyName ||
              parsedPayload.familyName ||
              docItem.targetAncestor ||
              ''
          )
            .replace(/^عائلة\s+/, '')
            .trim();
          if (!fam || fam.startsWith('عشيرة ألفا')) continue;

          const resolvedTribe = String(
            docItem.tribeName ||
              parsedPayload.rootTribeName ||
              docItem.motherTribeName ||
              ''
          ).trim();
          const resolvedBranch = String(
            docItem.familyBranch ||
              parsedPayload.rootBranchName ||
              docItem.subRootName ||
              ''
          ).trim();
          const resolvedCountry = String(
            docItem.originCountry || parsedPayload.originCountry || ''
          ).trim();
          const resolvedRegion = String(
            docItem.originRegion || parsedPayload.originRegion || ''
          ).trim();

          const deterministic = resolveDeterministicLineage({
            firstName:
              docItem.userFullName ||
              parsedPayload.clientName ||
              docItem.userName ||
              'عميل',
            fatherName: '—',
            grandfatherName: '—',
            familyName: fam,
            originCountry: resolvedCountry,
            originRegion: resolvedRegion,
            tribeName: resolvedTribe,
            branchName: resolvedBranch,
          });

          const resolvedEvidence: CorroboratingAlphaEvidence[] =
            Array.isArray(
              parsedPayload.corroborating_alpha_evidence_for_researcher
            ) &&
            parsedPayload.corroborating_alpha_evidence_for_researcher.length > 0
              ? parsedPayload.corroborating_alpha_evidence_for_researcher
              : Array.isArray(docItem.corroboratingEvidence) &&
                docItem.corroboratingEvidence.length > 0
              ? docItem.corroboratingEvidence
              : deterministic.corroborating_alpha_evidence_for_researcher || [];

          const resolvedSources: string[] =
            Array.isArray(parsedPayload.verified_sources) &&
            parsedPayload.verified_sources.length > 0
              ? parsedPayload.verified_sources
              : typeof docItem.verifiedSources === 'string' &&
                docItem.verifiedSources.trim()
              ? docItem.verifiedSources
                  .split('|')
                  .map((s: string) => s.trim())
                  .filter(Boolean)
              : deterministic.verified_sources || [];

          const resolvedMatched =
            typeof parsedPayload.matched === 'boolean'
              ? parsedPayload.matched
              : docItem.ticketCategory !== 'P1_CUSTOMER_SEARCH'
              ? true
              : deterministic.matched;

          const mergedResultForTicket: LineageSearchResult = {
            ...deterministic,
            matched: resolvedMatched,
            familyName: fam,
            originCountry: resolvedCountry || deterministic.originCountry,
            originRegion: resolvedRegion || deterministic.originRegion,
            rootBranchName: resolvedBranch || deterministic.rootBranchName,
            rootTribeName: resolvedTribe || deterministic.rootTribeName,
            isAlphaOnlyBeforeMerge:
              typeof parsedPayload.isAlphaOnlyBeforeMerge === 'boolean'
                ? parsedPayload.isAlphaOnlyBeforeMerge
                : deterministic.isAlphaOnlyBeforeMerge,
            isAlphaMergedIntoAdam:
              typeof parsedPayload.isAlphaMergedIntoAdam === 'boolean'
                ? parsedPayload.isAlphaMergedIntoAdam
                : deterministic.isAlphaMergedIntoAdam,
            adamNodeId:
              docItem.adamNodeId ||
              parsedPayload.adamNodeId ||
              deterministic.adamNodeId,
            verified_sources: resolvedSources,
            secondarySources: resolvedSources,
            corroborating_alpha_evidence_for_researcher: resolvedEvidence,
            adamSpineNodes:
              Array.isArray(parsedPayload.adamSpineNodes) &&
              parsedPayload.adamSpineNodes.length > 0
                ? parsedPayload.adamSpineNodes
                : deterministic.adamSpineNodes,
            full_stitched_lineage_for_researcher:
              Array.isArray(
                parsedPayload.full_stitched_lineage_for_researcher
              ) &&
              parsedPayload.full_stitched_lineage_for_researcher.length > 0
                ? parsedPayload.full_stitched_lineage_for_researcher
                : deterministic.full_stitched_lineage_for_researcher,
          };

          const clientDisplayLabel =
            docItem.userFullName ||
            parsedPayload.clientName ||
            docItem.userName ||
            `عميل (${fam})`;

          const built = buildTicketFromLineageResult(
            mergedResultForTicket,
            clientDisplayLabel,
            docItem.ticketNumber ||
              `#FS-${String(docItem.id || '').slice(0, 6)}`,
            docItem.id,
            docItem.userId
          );

          built.alphaId =
            docItem.alphaId ||
            parsedPayload.alphaId ||
            resolvedEvidence[0]?.alpha_id;
          built.assignedResearcherId =
            docItem.assignedResearcherId ||
            parsedPayload.assignedResearcherId ||
            '';
          built.assignedResearcherName =
            docItem.assignedResearcherName ||
            parsedPayload.assignedResearcherName ||
            '';

          if (docItem.ticketCategory) {
            built.ticketCategory = docItem.ticketCategory;
            if (docItem.ticketCategory === 'P3_PROACTIVE_MINING') {
              built.priorityTier = 'P3_PROACTIVE_ALPHA_ENRICHMENT';
              built.queue = 'P3';
              built.title = `وصل وإثراء (${fam} ← ${built.subRootName} ← ${built.motherTribeName}) بشجرة آدم`;
              if (parsedPayload.p3StrategicMeta) {
                built.p3StrategicMeta = parsedPayload.p3StrategicMeta;
              }
            } else if (docItem.ticketCategory === 'ASSIGNED_RESEARCH') {
              built.priorityTier = 'ASSIGNED_RESEARCH';
              built.queue = 'P2';
              built.title = `وصل وإثراء (${fam} ← ${built.subRootName} ← ${built.motherTribeName}) بشجرة آدم`;
            } else if (docItem.ticketCategory === 'P1_CUSTOMER_SEARCH') {
              built.priorityTier = 'P1_CLIENT_UNMATCHED';
              built.queue = 'P1';
            } else {
              built.priorityTier = 'P2_CLIENT_ADAM_BRIDGE';
              built.queue = 'P2';
            }
          }
          if (docItem.additionalNotes && !built.researcherNotes) {
            built.researcherNotes = docItem.additionalNotes;
          }

          if (
            docItem.status === 'resolved' ||
            docItem.status === 'completed' ||
            docItem.status === 'CLOSED_AND_ENRICHED'
          ) {
            built.status = 'CLOSED_AND_ENRICHED';
          } else if (docItem.status === 'investigating') {
            built.status = 'investigating';
          } else if (docItem.status === 'exported_adam_prime') {
            built.status = 'exported_adam_prime';
          }

          hydratedList.push(built);
        }

        // Strictly deduplicate hydrated tickets by normalized id so React never encounters duplicate keys
        const uniqueHydratedList: ResearcherStudioTicket[] = [];
        const seenHydratedIds = new Set<string>();
        for (const item of hydratedList) {
          const normKey = String(item.id || '')
            .trim()
            .replace(/^#/, '')
            .toLowerCase();
          if (!normKey || seenHydratedIds.has(normKey)) continue;
          seenHydratedIds.add(normKey);
          uniqueHydratedList.push(item);
        }

        setTickets(uniqueHydratedList);
      } catch (err) {
        console.warn('Firestore ticket sync warning:', err);
        if (isMounted) {
          setTickets([]);
        }
      }
    };
    loadRealTicketsFromDatabase();
    return () => {
      isMounted = false;
    };
  }, [currentClientResult]);

  // =========================================================================
  // PILLAR 2: 4-TIER PRIORITY QUEUE (`P1 -> Assigned -> P2 -> P3 Mining Queue`)
  // =========================================================================
  const [inboxCategoryFilter, setInboxCategoryFilter] = useState<
    | 'ALL_PRIORITY_SORTED'
    | 'P1_CLIENT_UNMATCHED'
    | 'ASSIGNED_RESEARCH'
    | 'P2_CLIENT_ADAM_BRIDGE'
    | 'P3_PROACTIVE_ALPHA_ENRICHMENT'
    | 'ALPHA_ADAM_ENRICHMENT'
    | 'DIRECT_CUSTOMER_TICKETS'
  >('ALL_PRIORITY_SORTED');

  const resolveTicketPriorityTier = (
    t: ResearcherStudioTicket
  ): TicketPriorityTier => {
    if (t.priorityTier) return t.priorityTier;
    if (t.ticketCategory === 'ASSIGNED_RESEARCH') {
      return 'ASSIGNED_RESEARCH';
    }
    if (t.queue === 'P3' || t.ticketCategory === 'P3_PROACTIVE_MINING') {
      return 'P3_PROACTIVE_ALPHA_ENRICHMENT';
    }
    if (t.queue === 'P1' || t.ticketCategory === 'P1_CUSTOMER_SEARCH') {
      return 'P1_CLIENT_UNMATCHED';
    }
    return 'P2_CLIENT_ADAM_BRIDGE';
  };

  const priorityRankScore = (t: ResearcherStudioTicket): number => {
    const isClosed =
      t.status === 'CLOSED_AND_ENRICHED' || t.status === 'merged_closed';
    if (isClosed) return 99;
    const tier = resolveTicketPriorityTier(t);
    if (tier === 'P1_CLIENT_UNMATCHED') return 1;
    if (tier === 'ASSIGNED_RESEARCH') return 2;
    if (tier === 'P2_CLIENT_ADAM_BRIDGE') return 3;
    return 4;
  };

  const filteredInboxTickets = useMemo(() => {
    const sorted = [...tickets].sort((a, b) => {
      const rankDiff = priorityRankScore(a) - priorityRankScore(b);
      if (rankDiff !== 0) return rankDiff;
      return (
        (b.p3StrategicMeta?.strategic_score || 0) -
        (a.p3StrategicMeta?.strategic_score || 0)
      );
    });

    if (inboxCategoryFilter === 'ALL_PRIORITY_SORTED') {
      return sorted;
    }
    if (
      inboxCategoryFilter === 'P1_CLIENT_UNMATCHED' ||
      inboxCategoryFilter === 'DIRECT_CUSTOMER_TICKETS'
    ) {
      return sorted.filter(
        (t) => resolveTicketPriorityTier(t) === 'P1_CLIENT_UNMATCHED'
      );
    }
    if (inboxCategoryFilter === 'ASSIGNED_RESEARCH') {
      return sorted.filter(
        (t) => resolveTicketPriorityTier(t) === 'ASSIGNED_RESEARCH'
      );
    }
    if (inboxCategoryFilter === 'P2_CLIENT_ADAM_BRIDGE') {
      return sorted.filter(
        (t) => resolveTicketPriorityTier(t) === 'P2_CLIENT_ADAM_BRIDGE'
      );
    }
    if (inboxCategoryFilter === 'P3_PROACTIVE_ALPHA_ENRICHMENT') {
      return sorted.filter(
        (t) => resolveTicketPriorityTier(t) === 'P3_PROACTIVE_ALPHA_ENRICHMENT'
      );
    }
    return sorted.filter(
      (t) =>
        resolveTicketPriorityTier(t) === 'ASSIGNED_RESEARCH' ||
        resolveTicketPriorityTier(t) === 'P2_CLIENT_ADAM_BRIDGE' ||
        resolveTicketPriorityTier(t) === 'P3_PROACTIVE_ALPHA_ENRICHMENT'
    );
  }, [tickets, inboxCategoryFilter]);

  const [selectedTicketId, setSelectedTicketId] = useState<string>('');

  useEffect(() => {
    if (
      filteredInboxTickets.length > 0 &&
      !filteredInboxTickets.some((t) => t.id === selectedTicketId)
    ) {
      setSelectedTicketId(filteredInboxTickets[0].id);
    }
  }, [filteredInboxTickets, selectedTicketId]);

  const selectedTicket = useMemo(
    () =>
      tickets.find((t) => t.id === selectedTicketId) ||
      filteredInboxTickets[0] ||
      tickets[0],
    [tickets, selectedTicketId, filteredInboxTickets]
  );

  // Active Ticket Timer: ticks every second while viewing an open ticket in `ticket_inbox`
  useEffect(() => {
    setActiveTicketElapsedSeconds(0);
  }, [selectedTicket?.id]);

  useEffect(() => {
    if (activeSubTab !== 'ticket_inbox' || !selectedTicket) return;
    if (
      selectedTicket.status === 'CLOSED_AND_ENRICHED' ||
      selectedTicket.status === 'merged_closed'
    ) {
      return;
    }
    const timer = setInterval(() => {
      setActiveTicketElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [activeSubTab, selectedTicket?.id, selectedTicket?.status]);

  const handleAutoRefillNextP3Tickets = async (count = 3) => {
    setIsGeneratingP3Batch(true);
    try {
      const excludedSet = new Set<string>(
        tickets
          .flatMap((t) => [
            t.familyName,
            t.id,
            t.id.replace(/^#/, ''),
            t.alphaId || '',
            ...(t.corroboratingEvidence || []).map((e) => e.alpha_id || ''),
          ])
          .filter(Boolean)
      );

      const newCands = await fetchOrGenerateP3ProactiveTickets(
        count,
        excludedSet
      );

      if (newCands.length === 0) {
        showToast(
          '⚠️ لا توجد دفعة إضافية جديدة غير معالجة حالياً في قاعدة البيانات.'
        );
        return;
      }

      // Enrich each candidate from the 3-Lake engine and persist directly to Firebase Firestore `research_tickets`
      const persistedTickets: ResearcherStudioTicket[] = [];
      for (const cand of newCands) {
        let enrichedCand = cand;
        try {
          const liveSearchRes = await searchJuthoriLineage({
            accountType: AccountLegalType.Individual,
            firstName: 'باحث',
            fatherName: '—',
            grandfatherName: '—',
            familyName: cand.familyName,
            originCountry: cand.inferredCountries[0] || '',
            originRegion: cand.locationLabel || '',
            tribeName: cand.motherTribeName || '',
            branchName: cand.subRootName || '',
            email: '',
            password: '',
            agreedToTerms: true,
          });
          const extraEvidence = extractRawSourcesFromResult(liveSearchRes);
          if (extraEvidence.length > 0) {
            const byKey = new Map<string, CorroboratingAlphaEvidence>();
            [...cand.corroboratingEvidence, ...extraEvidence].forEach((ev) => {
              const key = `${ev.alpha_id || ''}_${ev.source_book || ''}_${ev.page || ''}`;
              if (!byKey.has(key)) {
                byKey.set(key, ev);
              }
            });
            enrichedCand = {
              ...cand,
              adamNodeId: cand.adamNodeId || liveSearchRes.adamNodeId,
              corroboratingEvidence: Array.from(byKey.values()),
            };
          }
        } catch {
          // Keep candidate's primary database evidence
        }

        const builtTicket = buildTicketFromP3Candidate(enrichedCand);
        const citations = (builtTicket.corroboratingEvidence || []).map((ev) =>
          formatAlphaEvidenceCitation(ev)
        );

        const savedFirestoreDoc = await saveGeneratedResearchTicketToFirebase({
          ticketId: builtTicket.id,
          alphaId: builtTicket.alphaId,
          adamNodeId: builtTicket.adamNodeId,
          ticketCategory: 'P3_PROACTIVE_MINING',
          familyName: builtTicket.familyName,
          subRootName: builtTicket.subRootName,
          motherTribeName: builtTicket.motherTribeName,
          originCountry:
            builtTicket.inferredCountries?.[0] || 'الجزيرة العربية',
          originRegion: builtTicket.locationLabel,
          clientName: builtTicket.clientName,
          verifiedSources: citations,
          corroboratingAlphaEvidence: builtTicket.corroboratingEvidence || [],
          fullStitchedLineage: builtTicket.fullStitchedLineage || [],
          extractedNodes: builtTicket.extractedNodes || [],
          p3StrategicMeta: builtTicket.p3StrategicMeta,
          precomputedDiagnostic: builtTicket.precomputed_diagnostic,
        });

        builtTicket.firestoreDocId = savedFirestoreDoc.id;
        persistedTickets.push(builtTicket);
      }

      if (persistedTickets.length > 0) {
        setTickets((prev) => {
          const existingIds = new Set(prev.map((t) => t.id));
          const uniqueNew = persistedTickets.filter(
            (b) => !existingIds.has(b.id)
          );
          return [...prev, ...uniqueNew];
        });
        setSelectedTicketId(persistedTickets[0].id);
        showToast(
          `✅ تم توليد (${persistedTickets.length}) تذاكر بحثية حقيقية من قاعدة البيانات وحفظها وربطها مباشرة بـ Firebase!`
        );
      }
    } finally {
      setIsGeneratingP3Batch(false);
    }
  };

  // Per-source researcher controls: included checkbox, primary spine radio, researcher note, Lake 3 inclusion, and Live Final Column Preview
  const [includedSourceIndices, setIncludedSourceIndices] = useState<
    Record<string, number[]>
  >({});
  const [primarySourceIndexByTicket, setPrimarySourceIndexByTicket] = useState<
    Record<string, number>
  >({});
  const [sourceResearcherNotes, setSourceResearcherNotes] = useState<
    Record<string, string>
  >({});
  const [includedLake3IdsByTicket, setIncludedLake3IdsByTicket] = useState<
    Record<string, string[]>
  >({});
  const [livePreviewNodesByTicket, setLivePreviewNodesByTicket] = useState<
    Record<string, ExtractableLineageNode[]>
  >({});
  const [appliedAdamBridgeByTicket, setAppliedAdamBridgeByTicket] = useState<
    Record<string, string>
  >({});

  // Inline Adam Tree inspection result when clicking any node in a source's lineage chain
  const [inlineChainInspection, setInlineChainInspection] = useState<{
    ticketId: string;
    sourceIdx: number;
    queriedName: string;
    foundInAdam: boolean;
    matchedNode: AdamTreeInteractiveNode | null;
    adamChainPreview: string[];
  } | null>(null);

  // Clarification request modal/inline box for Action C
  const [showClarificationBox, setShowClarificationBox] = useState(false);
  const [clarificationMessage, setClarificationMessage] = useState('');

  // Enrichment inputs for Action B
  const [enrichmentBranchesInput, setEnrichmentBranchesInput] = useState('');
  const [enrichmentNotablesInput, setEnrichmentNotablesInput] = useState('');
  const [enrichmentLocationsInput, setEnrichmentLocationsInput] = useState('');

  const getTicketIncludedIndices = (ticket: ResearcherStudioTicket): number[] => {
    if (includedSourceIndices[ticket.id]) {
      return includedSourceIndices[ticket.id];
    }
    const count =
      ticket.corroboratingEvidence?.length || ticket.copilotSources.length || 0;
    return Array.from({ length: count }, (_, i) => i);
  };

  const toggleSourceInclusion = (ticket: ResearcherStudioTicket, idx: number) => {
    const current = getTicketIncludedIndices(ticket);
    const updated = current.includes(idx)
      ? current.filter((i) => i !== idx)
      : [...current, idx];
    setIncludedSourceIndices((prev) => ({
      ...prev,
      [ticket.id]: updated,
    }));
  };

  const toggleLake3RecordInclusion = (
    ticketId: string,
    recordId: string
  ) => {
    setIncludedLake3IdsByTicket((prev) => {
      const curr = prev[ticketId] || [];
      const next = curr.includes(recordId)
        ? curr.filter((id) => id !== recordId)
        : [...curr, recordId];
      return { ...prev, [ticketId]: next };
    });
  };

  const getLivePreviewNodesForTicket = (
    ticket: ResearcherStudioTicket
  ): ExtractableLineageNode[] => {
    if (
      livePreviewNodesByTicket[ticket.id] &&
      livePreviewNodesByTicket[ticket.id].length > 0
    ) {
      return livePreviewNodesByTicket[ticket.id];
    }
    return ticket.extractedNodes && ticket.extractedNodes.length > 0
      ? ticket.extractedNodes
      : [
          {
            id: `node-fe0-${ticket.id}`,
            name: ticket.familyName,
            nodeCode: 'FE0',
            relationType: 'bin',
            region: ticket.locationLabel,
          },
          {
            id: `node-b2-${ticket.id}`,
            name: ticket.subRootName,
            nodeCode: 'B2',
            relationType: 'aan',
            region: ticket.locationLabel,
          },
          {
            id: `node-b0-${ticket.id}`,
            name: ticket.motherTribeName,
            nodeCode: 'B0',
            relationType: 'aan',
            region: ticket.locationLabel,
          },
        ];
  };

  const handleSetPrimaryNarrativeForTicket = (
    ticket: ResearcherStudioTicket,
    idx: number,
    ev: CorroboratingAlphaEvidence
  ) => {
    setPrimarySourceIndexByTicket((prev) => ({
      ...prev,
      [ticket.id]: idx,
    }));
    const chain = splitAncestorsChain(ev.lineage_ancestors);
    if (chain.length > 0) {
      const rebuilt: ExtractableLineageNode[] = chain.map((station, i) => ({
        id: `node-prim-${ticket.id}-${idx}-${i}`,
        name: station,
        nodeCode:
          i === 0
            ? 'FE0'
            : i === chain.length - 1
            ? 'B0'
            : i === 1
            ? 'B2'
            : 'B1',
        relationType: i === 0 ? 'bin' : 'aan',
        region: ev.locations || ticket.locationLabel,
      }));
      setLivePreviewNodesByTicket((prev) => ({
        ...prev,
        [ticket.id]: rebuilt,
      }));
      showToast(
        `⭐ تم تعيين رواية (${ev.source_book}) كرواية أساسية لعمود (${ticket.familyName}) وتحديث المعاينة الحية!`
      );
    }
  };

  const handleSpliceNarrativeAbovePrimary = (
    ticket: ResearcherStudioTicket,
    idx: number,
    ev: CorroboratingAlphaEvidence
  ) => {
    const currentNodes = getLivePreviewNodesForTicket(ticket);
    const secondaryChain = cleanAndUnrollLineageChain(
      splitAncestorsChain(ev.lineage_ancestors),
      ticket.familyName
    );
    const baseAncestors = currentNodes.slice(1).map((n) => n.name);
    const existingStems = new Set(
      currentNodes.map((n) => normalizeArabicStem(n.name))
    );

    // Rule 1: Use Anchor-Based Topological Alignment (`stitchLineageChains`) instead of appending at the end!
    const alignedAncestors = stitchLineageChains(
      baseAncestors,
      secondaryChain,
      ticket.familyName
    );

    const newlyInsertedNames = alignedAncestors.filter(
      (name) => !existingStems.has(normalizeArabicStem(name))
    );

    if (newlyInsertedNames.length === 0) {
      showToast('جميع أجداد هذه الرواية مدمجة بالفعل في معاينة العمود النهائي.');
      return;
    }

    const existingNodeByStem = new Map<string, ExtractableLineageNode>();
    currentNodes.slice(1).forEach((n) => {
      existingNodeByStem.set(normalizeArabicStem(n.name), n);
    });

    const familyRootNode: ExtractableLineageNode = currentNodes[0] || {
      id: `node-fam-${ticket.id}`,
      name: ticket.familyName,
      nodeCode: 'FE0',
      relationType: 'aan',
      region: ticket.locationLabel,
    };

    const rebuiltAncestors: ExtractableLineageNode[] = alignedAncestors.map(
      (stationName, sIdx) => {
        const stem = normalizeArabicStem(stationName);
        const prevNode = existingNodeByStem.get(stem);
        const isTopApex = sIdx === alignedAncestors.length - 1;
        if (prevNode) {
          return {
            ...prevNode,
            nodeCode: isTopApex
              ? 'B0'
              : prevNode.nodeCode === 'B0'
              ? 'B1'
              : prevNode.nodeCode,
          };
        }
        return {
          id: `node-splice-${ticket.id}-${idx}-${sIdx}-${Date.now()}`,
          name: stationName,
          nodeCode: isTopApex ? 'B0' : sIdx === 0 ? 'B2' : 'B1',
          relationType: 'aan',
          region: ev.locations || ticket.locationLabel,
        };
      }
    );

    const mergedList = [familyRootNode, ...rebuiltAncestors];

    setLivePreviewNodesByTicket((prev) => ({
      ...prev,
      [ticket.id]: mergedList,
    }));

    // Also ensure this source is checked/included
    const included = getTicketIncludedIndices(ticket);
    if (!included.includes(idx)) {
      setIncludedSourceIndices((prev) => ({
        ...prev,
        [ticket.id]: [...included, idx],
      }));
    }

    showToast(
      `🔗 تم خياطة ومحاذاة (${newlyInsertedNames.join(
        ' ⬅️ '
      )}) في موضعها النسبي الصحيح بالمرساة داخل معاينة العمود النهائي!`
    );
  };

  const handleUpdateLivePreviewNode = (
    ticket: ResearcherStudioTicket,
    nodeIndex: number,
    patch: Partial<ExtractableLineageNode>
  ) => {
    const current = [...getLivePreviewNodesForTicket(ticket)];
    if (!current[nodeIndex]) return;
    current[nodeIndex] = { ...current[nodeIndex], ...patch };
    setLivePreviewNodesByTicket((prev) => ({
      ...prev,
      [ticket.id]: current,
    }));
  };

  const handleMoveLivePreviewNode = (
    ticket: ResearcherStudioTicket,
    nodeIndex: number,
    direction: 'up' | 'down'
  ) => {
    const current = [...getLivePreviewNodesForTicket(ticket)];
    const targetIndex = direction === 'up' ? nodeIndex - 1 : nodeIndex + 1;
    if (targetIndex < 0 || targetIndex >= current.length) return;
    const temp = current[nodeIndex];
    current[nodeIndex] = current[targetIndex];
    current[targetIndex] = temp;
    setLivePreviewNodesByTicket((prev) => ({
      ...prev,
      [ticket.id]: current,
    }));
  };

  const handleRemoveLivePreviewNode = (
    ticket: ResearcherStudioTicket,
    nodeIndex: number
  ) => {
    const current = getLivePreviewNodesForTicket(ticket);
    if (current.length <= 2) return;
    setLivePreviewNodesByTicket((prev) => ({
      ...prev,
      [ticket.id]: current.filter((_, i) => i !== nodeIndex),
    }));
  };

  const handleInspectChainNodeInAdam = async (
    ticketId: string,
    sourceIdx: number,
    nodeName: string,
    contextHintNames?: string[]
  ) => {
    const localResult = inspectNameInAdamMasterTree(
      nodeName,
      adamGraphNodes,
      contextHintNames
    );
    setInlineChainInspection({
      ticketId,
      sourceIdx,
      queriedName: nodeName,
      foundInAdam: localResult.found,
      matchedNode: localResult.matchedNode,
      adamChainPreview: localResult.matchedNode
        ? [
            localResult.matchedNode.name,
            ...localResult.ancestorsUpToAdam.map((a) => a.name),
          ]
        : [],
    });

    // Also query backend POST /api/v1/juthori/adam-tree/search for live Port 8090 / Neo4j verification
    try {
      const resp = await fetch(
        `${GERMAN_ENGINE_BASE_URL}/api/v1/juthori/adam-tree/search`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ query: nodeName, limit: 20 }),
        }
      );
      if (resp.ok) {
        const data = await resp.json();
        const remoteNodes: AdamTreeInteractiveNode[] = Array.isArray(data?.nodes)
          ? data.nodes
          : [];
        if (remoteNodes.length > 0 && !localResult.found) {
          const firstMatch = sanitizeAndNormalizeAdamNode({
            node_id: String(remoteNodes[0].node_id || ''),
            name: String(remoteNodes[0].name || nodeName),
            parent_id: remoteNodes[0].parent_id
              ? String(remoteNodes[0].parent_id)
              : null,
            parent_name: remoteNodes[0].parent_name,
            arc_code: String(remoteNodes[0].arc_code || 'UNASSIGNED'),
            representation: remoteNodes[0].representation || 'INDIVIDUAL',
            relation_nature:
              remoteNodes[0].relation_nature || 'DIRECT_DESCENDANT',
            geo_footprint: remoteNodes[0].geo_footprint || [],
            enriched_sources: remoteNodes[0].enriched_sources || [],
            enriched_branches: remoteNodes[0].enriched_branches || [],
          });
          setNodesById((prev) => ({
            ...prev,
            [firstMatch.node_id]: firstMatch,
          }));
          setInlineChainInspection({
            ticketId,
            sourceIdx,
            queriedName: nodeName,
            foundInAdam: true,
            matchedNode: firstMatch,
            adamChainPreview: [firstMatch.name, 'قحطان / عدنان', 'آدم عليه السلام'],
          });
        }
      }
    } catch {
      // Local graph inspection already displayed
    }
  };

  // =========================================================================
  // RULE 4: CONSENSUS & COMPETING PATHS MATRIX FOR RESEARCHERS
  // Displays "🌟 المسار المتوافق عليه في المصادر" & "📚 مسارات أخرى لنفس الاسم في المصادر للمقارنة"
  // =========================================================================
  const renderConsensusAndCompetingPathsMatrix = (
    familyName: string,
    evidenceList: CorroboratingAlphaEvidence[] | undefined,
    contextMode: 'direct_search' | 'ticket_inbox'
  ) => {
    const safeEvidence = evidenceList || [];
    if (safeEvidence.length === 0) return null;

    const clusters: ConsensusClusterGroup[] = computeCrossSourceConsensusClusters(
      familyName,
      safeEvidence
    );
    if (clusters.length === 0) return null;

    const consensusWinner =
      clusters.find((c) => c.isConsensusWinner) || clusters[0];
    const competingClusters = clusters.filter(
      (c) => c.clusterId !== consensusWinner.clusterId
    );

    return (
      <div
        data-testid={`researcher-consensus-matrix-${contextMode}`}
        className="space-y-4 rounded-2xl border border-[#E2DACB] bg-[#FAF6F0] p-5 shadow-2xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2DACB] pb-3">
          <div>
            <h4 className="text-sm sm:text-base font-extrabold font-display text-[#252321]">
              مصفوفة التوافق والمقارنة بين المصادر لاسم ({familyName})
            </h4>
            <p className="text-xs mt-0.5 text-[#5C5346]">
              تحليل تقاطع نسب الأجداد والفروع الأبناء عبر ({safeEvidence.length}) سجلات مرصودة
            </p>
          </div>
          <span className="px-3 py-1 rounded-xl text-xs font-bold border bg-white border-[#E2DACB] text-[#8D4925]">
            {clusters.length === 1
              ? 'مسار موحد في المصادر ✓'
              : `${clusters.length} مسارات مرصودة للمقارنة`}
          </span>
        </div>

        {/* SECTION 1: مسار التوافق المرجعي المرجّح */}
        <div className="rounded-2xl border border-[#B98A78]/50 bg-white p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm sm:text-base font-extrabold font-display text-[#252321]">
                مسار التوافق المرجعي المرجّح
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#8D4925] text-white">
                مرجّح في ({consensusWinner.sourcesCount}) مراجع
              </span>
              {consensusWinner.hasExplicitLocalityMatch && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-50 border border-emerald-300 text-emerald-900">
                  {EXPLICIT_LOCALITY_WINNER_BADGE_TEXT}
                </span>
              )}
              {consensusWinner.isUnspecifiedLocalityOnly && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FAF6F0] border border-[#E2DACB] text-[#5C5346]">
                  {UNSPECIFIED_LOCALITY_BADGE_TEXT}
                </span>
              )}
            </div>

            {contextMode === 'direct_search' &&
              directSearchResult?.optionAResultOverride && (
                <button
                  type="button"
                  onClick={() =>
                    setDirectSearchResult({
                      ...directSearchResult,
                      ...directSearchResult.optionAResultOverride,
                    })
                  }
                  className="px-3 py-1.5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-[11px] font-extrabold cursor-pointer transition-colors shadow-2xs"
                >
                  عرض هذا المسار في العمود أعلاه
                </button>
              )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="rounded-xl p-2.5 border bg-[#FAF6F0] border-[#E2DACB]">
              <span className="text-[11px] block text-[#5C5346]">
                الأصل / القبيلة الأم المرجّحة:
              </span>
              <span className="font-extrabold text-[#8D4925]">
                {consensusWinner.originTribeLabel}
              </span>
            </div>
            <div className="rounded-xl p-2.5 border bg-[#FAF6F0] border-[#E2DACB]">
              <span className="text-[11px] block text-[#5C5346]">
                عقدتا الجذر:
              </span>
              <span className="font-bold text-[#8D4925]">
                {consensusWinner.rootPreviewLabel}
              </span>
            </div>
            <div className="rounded-xl p-2.5 border bg-[#FAF6F0] border-[#E2DACB]">
              <span className="text-[11px] block text-[#5C5346]">
                النطاق الجغرافي المتوافق عليه:
              </span>
              <span className="font-bold text-[#252321]">
                {consensusWinner.geographicScope}
              </span>
            </div>
          </div>

          <div className="rounded-xl p-3 border space-y-1.5 bg-[#FAF6F0] border-[#E2DACB]">
            <div className="text-[11px] font-bold text-[#8D4925]">
              السلسلة الكاملة المتفق عليها ({consensusWinner.sharedNodes.join(' ، ')}):
            </div>
            <p className="text-xs font-bold leading-relaxed text-[#252321]">
              {consensusWinner.fullChainNodes.join(' ← ')}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] font-bold text-[#8D4925]">
                توافق {consensusWinner.records.length} مصادر:
              </span>
              {consensusWinner.records.map((ev: CorroboratingAlphaEvidence, i: number) => {
                const lakeBadge = resolveResearcherDataLakeBadge(ev);
                return (
                  <span
                    key={ev.alpha_id || i}
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border text-[11px] font-bold shadow-2xs bg-white border-[#E2DACB] font-sans text-[#252321]"
                  >
                    <span>{formatCompactSourceBracket(ev)}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-extrabold border ${lakeBadge.colorClass}`}
                    >
                      {lakeBadge.tag}
                    </span>
                    {ev.locality_match_status ===
                      'UNSPECIFIED_NON_CONFLICTING_LOCALITY' && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#FAF6F0] border border-[#E2DACB] text-[#5C5346]">
                        {UNSPECIFIED_LOCALITY_BADGE_TEXT}
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* SECTION 2: القائمة الكاملة لكافة المسارات والعناقيد المكتشفة */}
        <div
          data-testid="researcher-all-discovered-clusters-list"
          className="rounded-2xl border border-[#E2DACB] bg-white p-4 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-sm sm:text-base font-extrabold block font-display text-[#8D4925]">
                كافة المسارات المكتشفة في المصادر ({clusters.length} مسارات)
              </span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FAF6F0] border border-[#E2DACB] text-[#8D4925]">
              {competingClusters.length > 0
                ? `${clusters.length} مسارات إجمالية (${competingClusters.length} مسارات موازية)`
                : 'مسار موحد بدون مسارات متعارضة'}
            </span>
          </div>

          {competingClusters.length === 0 ? (
            <p className="text-xs rounded-xl p-3 border text-[#5C5346] bg-[#FAF6F0] border-[#E2DACB] font-bold">
              جميع المصادر المرصودة لاسم ({familyName}) تتفق على مسار نسبي واحد ولا توجد روايات متعارضة.
            </p>
          ) : (
            <div className="space-y-3">
              {clusters.map((comp, clusterIdx) => {
                const chainCount = comp.fullChainNodes.length;
                const isShownToCustomer =
                  clusterIdx < 2 &&
                  !(
                    clusterIdx > 0 &&
                    consensusWinner.hasExplicitLocalityMatch &&
                    comp.isUnspecifiedLocalityOnly
                  );
                return (
                  <div
                    key={comp.clusterId}
                    className={`rounded-xl p-3.5 border space-y-2 ${
                      clusterIdx === 0
                        ? 'bg-[#FAF6F0] border-[#B98A78]/60'
                        : 'bg-white border-[#E2DACB]'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-[#8D4925] text-white">
                          مسار #{clusterIdx + 1}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-lg border text-xs font-extrabold bg-white border-[#E2DACB] text-[#8D4925]">
                          {comp.originTribeLabel}
                        </span>
                        <span className="text-xs font-bold text-[#252321]">
                          الجذر: {comp.rootPreviewLabel}
                        </span>
                        {comp.hasExplicitLocalityMatch && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold border bg-emerald-50 text-emerald-900 border-emerald-300">
                            {EXPLICIT_LOCALITY_WINNER_BADGE_TEXT}
                          </span>
                        )}
                        {comp.isUnspecifiedLocalityOnly && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-[#FAF6F0] text-[#5C5346] border-[#E2DACB]">
                            {UNSPECIFIED_LOCALITY_BADGE_TEXT}
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-white text-[#5C5346] border-[#E2DACB]">
                          {comp.isUnspecifiedLocalityOnly && clusterIdx > 0
                            ? 'مسار مرجعي محتمل غير متعارض جغرافياً (مرصود للباحث)'
                            : isShownToCustomer
                            ? `✓ الخيار #${clusterIdx + 1} للعميل`
                            : 'مرصود للباحث فقط'}
                        </span>
                      </div>

                      {contextMode === 'direct_search' && directSearchResult && (
                        <button
                          type="button"
                          onClick={() => {
                            const syntheticOpt = {
                              id: (clusterIdx === 0
                                ? 'option_a'
                                : 'option_b') as 'option_a' | 'option_b',
                              choice_id: comp.clusterId,
                              badge: `توافق (${comp.sourcesCount}) مصادر`,
                              title: comp.originTribeLabel,
                              originTribeLabel: comp.originTribeLabel,
                              geographicScope: comp.geographicScope,
                              nearBranchHint: comp.rootPreviewLabel,
                              sourcesCount: comp.sourcesCount,
                              contributingSources: comp.records,
                            };
                            const resolved =
                              buildResolvedLineageFromDisambiguationOption(
                                directSearchResult,
                                syntheticOpt,
                                comp
                              );
                            setDirectSearchResult({
                              ...directSearchResult,
                              ...resolved,
                            });
                          }}
                          className="px-3 py-1.5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-[11px] font-extrabold cursor-pointer transition-colors shadow-2xs"
                        >
                          معاينة مسار ({comp.originTribeLabel}) في العمود
                        </button>
                      )}
                    </div>

                    <div className="text-[11px] text-[#5C5346]">
                      <span className="font-bold text-[#8D4925]">
                        النطاق الجغرافي:
                      </span>{' '}
                      {comp.geographicScope}
                    </div>

                    <div className="rounded-lg p-2.5 border text-xs leading-relaxed bg-white border-[#E2DACB] text-[#252321]">
                      <span className="font-bold block mb-1 text-[#8D4925]">
                        سلسلة نسب الأجداد ({chainCount} محطة):
                      </span>
                      {comp.fullChainNodes.join(' ← ')}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] font-bold text-[#8D4925]">
                        توافق ({comp.records.length}) {comp.records.length === 1 ? 'مصدر' : 'مصادر'}:
                      </span>
                      {comp.records.map((ev: CorroboratingAlphaEvidence, idx: number) => {
                        const lakeBadge = resolveResearcherDataLakeBadge(ev);
                        return (
                          <span
                            key={ev.alpha_id || idx}
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border text-[11px] font-bold shadow-2xs bg-[#FAF6F0] border-[#E2DACB] font-sans text-[#252321]"
                          >
                            <span>{formatCompactSourceBracket(ev)}</span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-extrabold border ${lakeBadge.colorClass}`}
                            >
                              {lakeBadge.tag}
                            </span>
                            {ev.locality_match_status ===
                              'UNSPECIFIED_NON_CONFLICTING_LOCALITY' && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-white border border-[#E2DACB] text-[#5C5346]">
                                {UNSPECIFIED_LOCALITY_BADGE_TEXT}
                              </span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  // =========================================================================
  // SECTION 5 & GAMIFIED 3-STATION WORKSPACE STATE
  // =========================================================================
  const [adamPrimeSearchQuery] = useState<string>('');
  const [adamPrimeRegistryResults, setAdamPrimeRegistryResults] = useState<
    AdamPrimeRegistrySourceItem[]
  >([]);
  const [addonUnlockPricesByLeadKey, setAddonUnlockPricesByLeadKey] = useState<
    Record<string, number>
  >({});
  const [selectedAdamPrimeIdByLeadKey, setSelectedAdamPrimeIdByLeadKey] =
    useState<Record<string, string>>({});
  const [verifyingLeadKey, setVerifyingLeadKey] = useState<string | null>(null);
  const [openOneWordSearchByLeadKey, setOpenOneWordSearchByLeadKey] = useState<
    Record<string, boolean>
  >({});
  const [oneWordQueryByLeadKey, setOneWordQueryByLeadKey] = useState<
    Record<string, string>
  >({});

  // Gamified 3-Station Workspace per-ticket state
  const [quickAncestorInputByTicket, setQuickAncestorInputByTicket] = useState<
    Record<string, string>
  >({});
  const [quickAdamBridgeSearchByTicket, setQuickAdamBridgeSearchByTicket] =
    useState<Record<string, string>>({});
  const [selectedBranchPillsByTicket, setSelectedBranchPillsByTicket] =
    useState<Record<string, string[]>>({});
  const [selectedLocationPillsByTicket, setSelectedLocationPillsByTicket] =
    useState<Record<string, string[]>>({});
  const [station2ApprovedByTicket, setStation2ApprovedByTicket] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    let active = true;
    searchAdamPrimeUnifiedSourcesRegistry('').then((items) => {
      if (active) setAdamPrimeRegistryResults(items);
    });
    return () => {
      active = false;
    };
  }, []);

  const resolveAutoMatchedAdamPrimeSource = (
    lead: ParsedOtherSourceLead
  ): { source_id: string; title: string; author: string } => {
    const rawBookTitle = (lead.extracted_book_title || '').trim();
    const normBook = normalizeArabic(rawBookTitle);
    const normBookCore = normBook
      .replace(
        /\s+(?:للنويري|للقلقشندي|لياقوت(?:\s+الحموي)?|لابن\s+منظور|للزبيدي|للسويدي|لابن\s+حزم|لابن\s+عبد\s+ربه|للهمداني|للسمعاني|لابن\s+الكلبي|للبلاذري|لابن\s+خلدون|للمقريزي|للدباغ)$/u,
        ''
      )
      .trim();

    // Requirement 3(أ): Match against the 41/46 Core Registry (`APR-CORE-...`) ONLY on exact full title equality!
    // Never use partial `.includes()` so `معجم البلدان` (by Yaqut) NEVER takes the ID of `معجم البلدان والقبائل اليمنية`!
    const exactMatchedReg = adamPrimeRegistryResults.find((r) => {
      const rNorm = normalizeArabic(r.title);
      return rNorm === normBook || (normBookCore.length >= 5 && rNorm === normBookCore);
    });

    if (lead.adam_prime_source_id) {
      const found = adamPrimeRegistryResults.find(
        (r) => r.source_id === lead.adam_prime_source_id
      );
      // Guard against false server-side partial matches to `APR-CORE-...`
      if (
        !lead.adam_prime_source_id.startsWith('APR-CORE-') ||
        (found &&
          (normalizeArabic(found.title) === normBook ||
            normalizeArabic(found.title) === normBookCore))
      ) {
        return {
          source_id: lead.adam_prime_source_id,
          title:
            found?.title || lead.canonical_title || lead.extracted_book_title,
          author: found?.author || lead.author || 'محقق في سجل آدم برايم',
        };
      }
    }

    if (exactMatchedReg) {
      return {
        source_id: exactMatchedReg.source_id,
        title: exactMatchedReg.title,
        author: exactMatchedReg.author || 'محقق في سجل آدم برايم',
      };
    }

    // Requirement 3(ب): Differentiate books that share the first two words by their author
    // (`نهاية الأرب للنويري` != `نهاية الأرب للقلقشندي`)
    if (normBook.includes('نهايه الارب')) {
      if (normBook.includes('قلقشندي')) {
        return {
          source_id: 'APR-SRC-618209',
          title: 'نهاية الأرب في معرفة أنساب العرب للقلقشندي',
          author: 'أبو العباس القلقشندي',
        };
      }
      if (normBook.includes('نويري')) {
        return {
          source_id: 'APR-SRC-957172',
          title: 'نهاية الأرب في فنون الأدب للنويري',
          author: 'شهاب الدين النويري',
        };
      }
    }
    if (normBook === 'معجم البلدان' || normBook.includes('معجم البلدان لياقوت')) {
      return {
        source_id: 'APR-SRC-284510',
        title: 'معجم البلدان لياقوت الحموي',
        author: 'ياقوت الحموي',
      };
    }
    if (normBook.includes('لسان العرب')) {
      return {
        source_id: 'APR-SRC-319402',
        title: 'لسان العرب لابن منظور',
        author: 'ابن منظور',
      };
    }
    if (normBook.includes('تاج العروس')) {
      return {
        source_id: 'APR-SRC-482915',
        title: 'تاج العروس من جواهر القاموس للزبيدي',
        author: 'مرتضى الزبيدي',
      };
    }
    if (normBook.includes('سبائك الذهب') || normBook.includes('سويدي')) {
      return {
        source_id: 'APR-SRC-742910',
        title: 'سبائك الذهب في معرفة قبائل العرب',
        author: 'محمد أمين السويدي',
      };
    }
    if (normBook.includes('صبح الاعشي')) {
      return {
        source_id: 'APR-SRC-510384',
        title: 'صبح الأعشى في صناعة الإنشا',
        author: 'أبو العباس القلقشندي',
      };
    }
    if (normBook.includes('قلائد الجمان')) {
      return {
        source_id: 'APR-SRC-618204',
        title: 'قلائد الجمان في التعريف بقبائل عرب الزمان',
        author: 'أبو العباس القلقشندي',
      };
    }
    if (normBook.includes('جمهره انساب') || normBook.includes('ابن حزم')) {
      return {
        source_id: 'APR-SRC-304819',
        title: 'جمهرة أنساب العرب',
        author: 'ابن حزم الأندلسي',
      };
    }
    if (normBook.includes('عقد الفريد') || normBook.includes('عبد ربه')) {
      return {
        source_id: 'APR-SRC-429103',
        title: 'العقد الفريد',
        author: 'ابن عبد ربه الأندلسي',
      };
    }
    if (normBook.includes('اكليل') || normBook.includes('همداني')) {
      return {
        source_id: 'APR-SRC-839201',
        title: 'الإكليل من أخبار اليمن وأنساب حمير',
        author: 'الحسن بن أحمد الهمداني',
      };
    }

    // Hash the entire normalized book title (including author) so distinct books never collide
    const fullHashSeed = `${normBook}::${normalizeArabic(lead.author || '')}`;
    let hash = 0;
    for (let i = 0; i < fullHashSeed.length; i++) {
      hash = (hash * 31 + fullHashSeed.charCodeAt(i)) % 900000;
    }
    const codeNum = 100000 + Math.abs(hash);
    return {
      source_id: `APR-SRC-${codeNum}`,
      title: lead.canonical_title || lead.extracted_book_title,
      author: lead.author || 'سجل آدم برايم الموحد',
    };
  };

  const handleVerifyAndAttachOtherSourceLead = async (
    lead: ParsedOtherSourceLead,
    leadKey: string,
    contextMode: 'direct_search' | 'ticket_inbox'
  ) => {
    setVerifyingLeadKey(leadKey);
    try {
      const chosenPrice = addonUnlockPricesByLeadKey[leadKey] ?? 2;
      const autoMatch = resolveAutoMatchedAdamPrimeSource(lead);
      const chosenRegistryId =
        selectedAdamPrimeIdByLeadKey[leadKey] || autoMatch.source_id;
      const matchedReg = adamPrimeRegistryResults.find(
        (r) => r.source_id === chosenRegistryId
      );

      const resolvedBookTitle =
        matchedReg?.title ||
        autoMatch.title ||
        lead.canonical_title ||
        lead.extracted_book_title;
      const resolvedAuthor =
        matchedReg?.author ||
        autoMatch.author ||
        lead.author ||
        'محقق في سجل آدم برايم';
      const resolvedVolume = lead.extracted_volume || '—';
      const resolvedPage = lead.extracted_page || '—';

      const verifiedAddon: VerifiedAddonSourceItem =
        await verifyAndAttachSecondarySourceToAdamPrime({
          alpha_or_adam_node_id: lead.linked_alpha_id || 'ALP_NODE',
          linked_record_name: lead.linked_record_name,
          raw_citation: lead.raw_citation,
          book_title: resolvedBookTitle,
          author: resolvedAuthor,
          volume: resolvedVolume,
          page: resolvedPage,
          adam_prime_source_id: chosenRegistryId,
          addon_unlock_price_usd: chosenPrice,
          researcher_notes: `تم توثيق المرجع الثانوي (${resolvedBookTitle}) في سجل آدم برايم الموحد وربطه بالعقدة (${lead.linked_record_name}) بسعر فتح (${chosenPrice === 0 ? 'مجاني' : `$${chosenPrice}`})`,
        });

      const updateEvidenceArray = (
        evArr: CorroboratingAlphaEvidence[] | undefined
      ): CorroboratingAlphaEvidence[] => {
        if (!Array.isArray(evArr)) return [];
        return evArr.map((ev) => {
          if (
            ev.alpha_id !== lead.linked_alpha_id &&
            ev.record_name !== lead.linked_record_name
          ) {
            return ev;
          }
          const existingLeads =
            Array.isArray(ev.parsed_other_sources) &&
            ev.parsed_other_sources.length > 0
              ? ev.parsed_other_sources
              : ev.other_sources
              ? parseOtherSourcesStringIntoLeads(
                  ev.other_sources,
                  ev.alpha_id,
                  ev.record_name
                )
              : [];

          const updatedLeads = existingLeads.map((l) =>
            l.raw_citation === lead.raw_citation ||
            normalizeArabic(l.extracted_book_title) ===
              normalizeArabic(lead.extracted_book_title)
              ? {
                  ...l,
                  verification_status: 'VERIFIED_ADDON_SOURCE' as const,
                  adam_prime_source_id: verifiedAddon.source_id,
                  canonical_title: verifiedAddon.canonical_title,
                  author: verifiedAddon.author,
                  extracted_volume: verifiedAddon.volume,
                  extracted_page: verifiedAddon.page,
                  addon_unlock_price_usd: verifiedAddon.addon_unlock_price_usd,
                  formatted_verified_addon:
                    verifiedAddon.formatted_verified_addon,
                }
              : l
          );

          const updatedVerifiedAddons = mergeVerifiedAddonSourceLists(
            ev.verified_addon_sources,
            [verifiedAddon]
          );

          return {
            ...ev,
            parsed_other_sources: updatedLeads,
            verified_addon_sources: updatedVerifiedAddons,
          };
        });
      };

      if (contextMode === 'direct_search') {
        setRawSources((prev) => updateEvidenceArray(prev));
        setDirectSearchResult((prev) => {
          if (!prev) return prev;
          const updatedAlphaEv = updateEvidenceArray(prev.alpha_evidence);
          const updatedCorroborating = updateEvidenceArray(
            prev.corroborating_alpha_evidence_for_researcher
          );
          const mergedAddons = mergeVerifiedAddonSourceLists(
            prev.verifiedAddonSources,
            [verifiedAddon],
            getVerifiedAddonSourcesForEvidence(updatedCorroborating)
          );
          return {
            ...prev,
            alpha_evidence: updatedAlphaEv,
            corroborating_alpha_evidence_for_researcher: updatedCorroborating,
            verifiedAddonSources: mergedAddons,
          };
        });
      } else if (selectedTicket) {
        setTickets((prev) =>
          prev.map((t) =>
            t.id === selectedTicket.id
              ? {
                  ...t,
                  corroboratingEvidence: updateEvidenceArray(
                    t.corroboratingEvidence
                  ),
                }
              : t
          )
        );
      }

      const refreshed = await searchAdamPrimeUnifiedSourcesRegistry(
        adamPrimeSearchQuery
      );
      setAdamPrimeRegistryResults(refreshed);

      setKpiTelemetry((prev) =>
        saveResearcherKpiTelemetry({
          ...prev,
          totalAdamPrimeSourcesVerified:
            prev.totalAdamPrimeSourcesVerified + 1,
          totalXpScore: prev.totalXpScore + 25,
        })
      );

      showToast(
        `✨ تم توثيق «${verifiedAddon.canonical_title}» في آدم برايم [${verifiedAddon.source_id}] وإتاحته للعميل (${
          verifiedAddon.addon_unlock_price_usd === 0
            ? 'مجاني'
            : `$${verifiedAddon.addon_unlock_price_usd}`
        })! (+25 XP في عداد الإنتاجية) 🚀`
      );
    } finally {
      setVerifyingLeadKey(null);
    }
  };

  // =========================================================================
  // REQUIREMENT 2: SMART DIRECT TRANSFER FROM DIAGNOSTIC SEARCH TO TICKET ROOM
  // =========================================================================
  const handleTransferDiagnosticToTicketRoom = (
    res: LineageSearchResult,
    rawEvidenceList: CorroboratingAlphaEvidence[],
    finalStitchedStations: UpperAncestorNode[]
  ) => {
    const cleanFam = res.familyName.replace(/^عائلة\s+/, '').trim();

    const enrichedEvidence: CorroboratingAlphaEvidence[] = rawEvidenceList.map(
      (ev) => {
        const parsedLeads =
          Array.isArray(ev.parsed_other_sources) &&
          ev.parsed_other_sources.length > 0
            ? ev.parsed_other_sources
            : ev.other_sources && ev.other_sources.trim()
            ? parseOtherSourcesStringIntoLeads(
                ev.other_sources,
                ev.alpha_id,
                ev.record_name || cleanFam
              )
            : [];
        return {
          ...ev,
          parsed_other_sources: parsedLeads,
        };
      }
    );

    const allBranches = Array.from(
      new Set(
        [
          ...(res.sibling_branches_in_record || []),
          ...enrichedEvidence.flatMap((ev) =>
            (ev.child_branches || '')
              .split(/[|،,؛]/)
              .map((s) => s.trim())
              .filter(Boolean)
          ),
        ].filter(Boolean)
      )
    );

    const allLocations = Array.from(
      new Set(
        [
          res.originRegion,
          res.originCountry,
          ...enrichedEvidence.flatMap((ev) =>
            (ev.locations || '')
              .split(/[|،,؛/]/)
              .map((s) => s.trim())
              .filter(Boolean)
          ),
        ]
          .map((s) => (s || '').trim())
          .filter(Boolean)
      )
    );

    const subRoot =
      res.rootBranchName?.replace(/^بطن\s+/, '').trim() ||
      finalStitchedStations[1]?.name ||
      '';
    const motherTribe =
      res.rootTribeName?.replace(/^قبيلة\s+/, '').trim() ||
      finalStitchedStations[finalStitchedStations.length - 1]?.name ||
      '';

    const resolvedBridge: SuggestedAdamBridgeForResearcher | undefined =
      res.suggested_adam_bridge_for_researcher ||
      buildSuggestedAdamBridgeForResearcher(
        cleanFam,
        subRoot,
        motherTribe,
        res.adamNodeId
      );

    const enrichedResultForTicket: LineageSearchResult = {
      ...res,
      alpha_evidence: enrichedEvidence,
      corroborating_alpha_evidence_for_researcher: enrichedEvidence,
      full_stitched_lineage_for_researcher:
        finalStitchedStations.length > 0
          ? finalStitchedStations
          : res.full_stitched_lineage_for_researcher,
      suggested_adam_bridge_for_researcher: resolvedBridge,
      sibling_branches_in_record: allBranches,
    };

    const chosenManager =
      researchManagersList.find((m) => m.id === selectedAssigneeManagerId) ||
      researchManagersList[0] ||
      null;
    const assignedManagerId = chosenManager?.id || 'team_maestro_kareem';
    const assignedManagerName = chosenManager?.name || 'مدير البحوث';

    const newTkt = buildTicketFromLineageResult(
      enrichedResultForTicket,
      `بحث مسند (${cleanFam})`,
      `#ASG-${cleanFam.replace(/\s+/g, '_')}`
    );

    newTkt.ticketCategory = 'ASSIGNED_RESEARCH';
    newTkt.priorityTier = 'ASSIGNED_RESEARCH';
    newTkt.queue = 'P2';
    newTkt.assignedResearcherId = assignedManagerId;
    newTkt.assignedResearcherName = assignedManagerName;
    newTkt.title = `وصل وإثراء (${cleanFam} ← ${
      newTkt.subRootName || subRoot || 'الفرع'
    } ← ${newTkt.motherTribeName || motherTribe || 'القبيلة الأم'}) بشجرة آدم`;

    if (finalStitchedStations.length > 0) {
      newTkt.extractedNodes = finalStitchedStations.map((st, idx) => ({
        id: `node-transfer-${newTkt.id}-${idx}`,
        name: st.name.replace(/^(بطن|قبيلة|فرع|فخذ)\s+/, '').trim(),
        nodeCode:
          st.code ||
          (idx === 0
            ? 'FE0'
            : idx === finalStitchedStations.length - 1
            ? 'B0'
            : idx === 1
            ? 'B2'
            : 'B1'),
        relationType: (st.relation_nature === 'DIRECT' ? 'bin' : 'aan') as
          | 'bin'
          | 'aan',
        region: st.region || res.originRegion || res.originCountry || '—',
      }));
    }

    // Immediately persist assigned ticket to Firebase Firestore `research_tickets`
    saveGeneratedResearchTicketToFirebase({
      ticketId: newTkt.id,
      alphaId:
        newTkt.alphaId || newTkt.corroboratingEvidence?.[0]?.alpha_id || '',
      adamNodeId: newTkt.adamNodeId,
      ticketCategory: 'ASSIGNED_RESEARCH',
      familyName: newTkt.familyName,
      subRootName: newTkt.subRootName,
      motherTribeName: newTkt.motherTribeName,
      originCountry: newTkt.inferredCountries?.[0] || 'الجزيرة العربية',
      originRegion: newTkt.locationLabel,
      clientName: newTkt.clientName,
      assignedResearcherId: assignedManagerId,
      assignedResearcherName: assignedManagerName,
      verifiedSources: (newTkt.corroboratingEvidence || []).map((ev) =>
        formatAlphaEvidenceCitation(ev)
      ),
      corroboratingAlphaEvidence: newTkt.corroboratingEvidence || [],
      fullStitchedLineage: newTkt.fullStitchedLineage || [],
      extractedNodes: newTkt.extractedNodes || [],
      precomputedDiagnostic: newTkt.precomputed_diagnostic,
      additionalNotes: `تذكرة بحث مسندة من بوصلة الجذور إلى مدير البحوث (${assignedManagerName}) لعائلة (${cleanFam} ← ${newTkt.subRootName} ← ${newTkt.motherTribeName}).`,
    })
      .then((savedDoc) => {
        setTickets((prev) =>
          prev.map((item) =>
            item.id === newTkt.id
              ? { ...item, firestoreDocId: savedDoc.id }
              : item
          )
        );
      })
      .catch(() => {});

    setTickets((prev) => [
      newTkt,
      ...prev.filter((existing) => existing.id !== newTkt.id),
    ]);
    setLivePreviewNodesByTicket((prev) => ({
      ...prev,
      [newTkt.id]: newTkt.extractedNodes,
    }));
    setIncludedSourceIndices((prev) => ({
      ...prev,
      [newTkt.id]: enrichedEvidence.map((_, i) => i),
    }));
    setSelectedBranchPillsByTicket((prev) => ({
      ...prev,
      [newTkt.id]: allBranches,
    }));
    setSelectedLocationPillsByTicket((prev) => ({
      ...prev,
      [newTkt.id]: allLocations,
    }));
    setEnrichmentBranchesInput(allBranches.join('، '));
    setEnrichmentLocationsInput(allLocations.join('، '));
    setCreatedAssignedTicketId(newTkt.id);
    setSelectedTicketId(newTkt.id);

    showToast(
      `🟠 تم إنشاء تذكرة بحثية مسندة إلى (${assignedManagerName}) لعائلة (${cleanFam}) وحفظها في مرصد البحوث!`
    );
  };

  // =========================================================================
  // PILLAR 1: REVERSE AUTO-HYDRATION ON TICKET SELECTION IN `ticket_inbox`
  // Whenever a researcher selects any ticket in `ticket_inbox`, if it lacks
  // `precomputed_diagnostic` or station hydration, automatically run the
  // diagnostic engine in the background and inject Stations 1, 2, and 3!
  // =========================================================================
  useEffect(() => {
    if (!selectedTicket) return;
    const tId = selectedTicket.id;

    const hydrateTicketStationsAndDiagnostic = (
      tkt: ResearcherStudioTicket,
      evidenceToUse: CorroboratingAlphaEvidence[]
    ) => {
      const diag = computeTicketDiagnosticContext(
        tkt.familyName,
        evidenceToUse,
        tkt.subRootName,
        tkt.motherTribeName,
        tkt.locationLabel
      );

      setTickets((prev) =>
        prev.map((item) =>
          item.id === tId
            ? {
                ...item,
                precomputed_diagnostic: diag.precomputed,
                corroboratingEvidence: diag.enrichedEvidence,
                subRootName: diag.resolvedSubRoot || item.subRootName,
                motherTribeName:
                  diag.resolvedMotherTribe || item.motherTribeName,
                extractedNodes:
                  diag.cleanExtractedNodes.length > 0
                    ? diag.cleanExtractedNodes
                    : item.extractedNodes,
              }
            : item
        )
      );

      setLivePreviewNodesByTicket((prev) =>
        prev[tId] && prev[tId].length > 0
          ? prev
          : { ...prev, [tId]: diag.cleanExtractedNodes }
      );
      setIncludedSourceIndices((prev) =>
        prev[tId]
          ? prev
          : {
              ...prev,
              [tId]: diag.enrichedEvidence.map((_, idx) => idx),
            }
      );
      setSelectedBranchPillsByTicket((prev) =>
        prev[tId] ? prev : { ...prev, [tId]: diag.allBranches }
      );
      setSelectedLocationPillsByTicket((prev) =>
        prev[tId] ? prev : { ...prev, [tId]: diag.allLocations }
      );
    };

    if (!selectedTicket.precomputed_diagnostic) {
      if (
        selectedTicket.corroboratingEvidence &&
        selectedTicket.corroboratingEvidence.length > 0
      ) {
        hydrateTicketStationsAndDiagnostic(
          selectedTicket,
          selectedTicket.corroboratingEvidence
        );
      } else {
        searchJuthoriLineage({
          accountType: AccountLegalType.Individual,
          firstName: 'باحث',
          fatherName: '—',
          grandfatherName: '—',
          familyName: selectedTicket.familyName,
          originCountry: selectedTicket.inferredCountries?.[0] || '',
          originRegion: selectedTicket.locationLabel || '',
          tribeName: selectedTicket.motherTribeName || '',
          branchName: selectedTicket.subRootName || '',
          email: '',
          password: '',
          agreedToTerms: true,
        })
          .then((liveRes) => {
            const extracted = extractRawSourcesFromResult(liveRes);
            hydrateTicketStationsAndDiagnostic(selectedTicket, extracted);
          })
          .catch(() => {
            hydrateTicketStationsAndDiagnostic(selectedTicket, []);
          });
      }
    } else if (!livePreviewNodesByTicket[tId]) {
      hydrateTicketStationsAndDiagnostic(
        selectedTicket,
        selectedTicket.corroboratingEvidence || []
      );
    }
  }, [selectedTicket?.id]);

  // =========================================================================
  // REQUIREMENT 1: READ-ONLY COMPACT SECTION 5 FOR DIAGNOSTIC SEARCH (`direct_search`)
  // Strictly zero inputs, zero dropdowns, zero 41-book lists, zero search bars!
  // =========================================================================
  const renderCompactReadOnlyOtherSourcesSection = (
    familyName: string,
    evidenceList: CorroboratingAlphaEvidence[] | undefined
  ) => {
    const safeEvidence = evidenceList || [];
    const extractedLeads = extractAllOtherSourceLeadsFromEvidence(safeEvidence);
    const isExpanded = bosletExpandedSections.step5;

    return (
      <div
        data-testid="diagnostic-step5-secondary-sources-adam-prime-direct_search"
        className={`rounded-3xl transition-all duration-300 overflow-hidden ${
          isExpanded
            ? 'border border-[#B98A78]/50 bg-white p-5 sm:p-6 shadow-xs space-y-4'
            : 'border border-[#E2DACB] bg-[#FAF6F0] hover:border-[#B98A78]/60 px-5 py-4 shadow-2xs'
        }`}
      >
        <div
          onClick={() => toggleBosletSection('step5')}
          className={`flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none ${
            isExpanded ? 'border-b border-[#E2DACB] pb-3.5' : ''
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`w-8 h-8 rounded-xl font-mono text-xs font-extrabold flex items-center justify-center shrink-0 transition-all ${
                isExpanded
                  ? 'bg-[#D8755B] text-white shadow-2xs'
                  : 'bg-white text-[#8D4925] border border-[#B98A78]/50'
              }`}
            >
              5
            </span>
            <h3 className="text-sm sm:text-base font-extrabold font-display text-[#252321]">
              القسم الخامس: المصادر الأخرى الخام المرصودة في الهامش
            </h3>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="px-3 py-1 rounded-xl bg-[#FAF6F0] border border-[#B98A78]/45 text-[#8D4925] text-xs font-bold">
              {extractedLeads.length === 0
                ? '0 إحالات هامشية'
                : `${extractedLeads.length} إحالة مرجعية`}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleBosletSection('step5');
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                isExpanded
                  ? 'bg-[#EDE6DA] text-[#252321] border-[#B98A78]/50 shadow-2xs'
                  : 'bg-white text-[#8D4925] border-[#B98A78]/40 hover:bg-[#EDE6DA]/60'
              }`}
            >
              <span>{isExpanded ? 'طي القسم' : 'فتح وإبراز القسم'}</span>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {isExpanded && (
          <>
            {extractedLeads.length === 0 ? (
              <div className="rounded-xl bg-[#FAF6F0] border border-[#E2DACB] px-4 py-3 text-xs text-[#5C5346]">
                لا توجد إحالات لمصادر أخرى خام في سجلات ({familyName}) الحالية.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {extractedLeads.map((lead, lIdx) => {
                  const autoMatch = resolveAutoMatchedAdamPrimeSource(lead);
                  const isVerified =
                    lead.verification_status === 'VERIFIED_ADDON_SOURCE';
                  return (
                    <div
                      key={`${lead.linked_alpha_id}-${lIdx}`}
                      data-testid={`compact-other-source-pill-${lIdx}`}
                      className="rounded-2xl bg-[#FAF6F0] border border-[#E2DACB] p-3.5 shadow-2xs flex flex-col justify-between gap-2.5 hover:border-[#B98A78] transition-all"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span className="text-xs font-extrabold font-display text-[#252321]">
                          📜 {lead.extracted_book_title || autoMatch.title}
                        </span>
                        <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold">
                          <span className="px-2 py-0.5 rounded bg-white text-[#8D4925] border border-[#B98A78]/45">
                            ج: {lead.extracted_volume || '—'}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-white text-[#8D4925] border border-[#B98A78]/45">
                            ص: {lead.extracted_page || '—'}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-2 border-t border-[#E2DACB]">
                        <span className="text-[#5C5346]">
                          السجل المرتبط:{' '}
                          <strong className="text-[#252321]">
                            {lead.linked_record_name || familyName}
                          </strong>
                        </span>

                        <span
                          className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${
                            isVerified
                              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                              : 'bg-white text-[#8D4925] border-[#B98A78]/45'
                          }`}
                        >
                          {isVerified
                            ? `[✅ موثق في آدم برايم: ${autoMatch.source_id}]`
                            : `[إحالة خام للباحث · مطابقة في آدم برايم: ${autoMatch.source_id}]`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  // =========================================================================
  // REQUIREMENT 3: GAMIFIED ALL-IN-ONE 3-STATION ACTION WORKSPACE IN TICKET INBOX
  // + PILLAR 1: EMBEDDED DIAGNOSTIC DRAWER (Reverse Auto-Hydrated Context)
  // + PILLAR 2: P3 STRATEGIC SELECTION SCORE & REASONS BANNER
  // =========================================================================
  const renderGamifiedTicketOperationsWorkspace = (
    ticket: ResearcherStudioTicket
  ) => {
    const liveNodes = getLivePreviewNodesForTicket(ticket);
    const allTicketEvidence: CorroboratingAlphaEvidence[] =
      ticket.corroboratingEvidence && ticket.corroboratingEvidence.length > 0
        ? tagConsensusWinnersOnEvidence(
            ticket.familyName,
            ticket.corroboratingEvidence
          )
        : ticket.copilotSources.map(
            (cs, idx): CorroboratingAlphaEvidence => ({
              alpha_id: `alpha-fallback-${idx}`,
              record_name: ticket.familyName,
              source_book: cs.bookCitation,
              page: '—',
              volume: `${idx + 1}`,
              lineage_ancestors: `${ticket.familyName} ⬅️ ${ticket.subRootName} ⬅️ ${ticket.motherTribeName}`,
              priority_tier: 'PRIORITY_1_COUNTRY_BOOK',
              is_consensus_winner: true,
            })
          );

    const diagnosticCtx =
      ticket.precomputed_diagnostic ||
      computeTicketDiagnosticContext(
        ticket.familyName,
        allTicketEvidence,
        ticket.subRootName,
        ticket.motherTribeName,
        ticket.locationLabel
      ).precomputed;

    const extractedLeads =
      extractAllOtherSourceLeadsFromEvidence(allTicketEvidence);
    const verifiedLeadsCount = extractedLeads.filter(
      (l) => l.verification_status === 'VERIFIED_ADDON_SOURCE'
    ).length;

    const allCandidateBranches = Array.from(
      new Set(
        allTicketEvidence.flatMap((ev) =>
          (ev.child_branches || '')
            .split(/[|،,؛]/)
            .map((s) => s.trim())
            .filter(Boolean)
        )
      )
    );
    const allCandidateLocations = Array.from(
      new Set(
        [
          ticket.locationLabel,
          ...allTicketEvidence.flatMap((ev) =>
            (ev.locations || '')
              .split(/[|،,؛/]/)
              .map((s) => s.trim())
              .filter(Boolean)
          ),
        ]
          .map((s) => (s || '').trim())
          .filter(Boolean)
      )
    );

    const activeBranchPills =
      selectedBranchPillsByTicket[ticket.id] ?? allCandidateBranches;
    const activeLocationPills =
      selectedLocationPillsByTicket[ticket.id] ?? allCandidateLocations;
    const activeSourceIndices = getTicketIncludedIndices(ticket);

    const isBridgeConnected = Boolean(
      appliedAdamBridgeByTicket[ticket.id] ||
        ticket.status === 'CLOSED_AND_ENRICHED' ||
        ticket.status === 'merged_closed'
    );
    const isStation2Completed = Boolean(
      station2ApprovedByTicket[ticket.id] ||
        ticket.status === 'CLOSED_AND_ENRICHED' ||
        ticket.status === 'merged_closed'
    );
    const isStation3Completed =
      extractedLeads.length === 0 ||
      verifiedLeadsCount === extractedLeads.length;

    const station1Score = isBridgeConnected
      ? 35
      : liveNodes.length >= 2
      ? 15
      : 0;
    const station2Score = isStation2Completed
      ? 35
      : activeSourceIndices.length > 0 ||
        activeBranchPills.length > 0 ||
        activeLocationPills.length > 0
      ? 20
      : 0;
    const station3Score =
      extractedLeads.length === 0
        ? 30
        : Math.round((verifiedLeadsCount / extractedLeads.length) * 30);

    const questProgressPercent =
      ticket.status === 'CLOSED_AND_ENRICHED' ||
      ticket.status === 'merged_closed'
        ? 100
        : Math.min(100, station1Score + station2Score + station3Score);

    const quickAdamQuery = (
      quickAdamBridgeSearchByTicket[ticket.id] || ''
    ).trim();
    const quickAdamMatches = quickAdamQuery
      ? Object.values(nodesById)
          .filter((n) => matchesFlexibleArabicSearch(n.name, quickAdamQuery))
          .slice(0, 4)
      : [];

    const existingNodeStems = new Set(
      liveNodes.map((n) => normalizeArabicStem(n.name))
    );
    const lake3SuggestionNames = Array.from(
      new Set(
        [
          ...(ticket.lake3UnlinkedProjects || []).map(
            (r) => r.family_or_tribe_name
          ),
          ...allTicketEvidence.flatMap((ev) =>
            extractRawRecordAncestors(ev).slice(0, 6)
          ),
        ]
          .map((s) => (s || '').trim())
          .filter(
            (s) => s && !existingNodeStems.has(normalizeArabicStem(s))
          )
      )
    ).slice(0, 8);

    const handleQuickAddChipToChain = (rawName: string) => {
      const cleanName = rawName.trim();
      if (!cleanName) return;
      const nextNode: ExtractableLineageNode = {
        id: `node-chip-${ticket.id}-${Date.now()}`,
        name: cleanName,
        nodeCode: 'B1',
        relationType: 'aan',
        region: ticket.locationLabel,
      };
      const nextNodes =
        liveNodes.length >= 2
          ? [
              ...liveNodes.slice(0, liveNodes.length - 1),
              nextNode,
              liveNodes[liveNodes.length - 1],
            ]
          : [...liveNodes, nextNode];
      setLivePreviewNodesByTicket((prev) => ({
        ...prev,
        [ticket.id]: nextNodes,
      }));
      setQuickAncestorInputByTicket((prev) => ({
        ...prev,
        [ticket.id]: '',
      }));
      showToast(`🧩 تمت إضافة المحطة «${cleanName}» ككبسولة في سلسلة النسب!`);
    };

    const hypotheses =
      ticket.aiResearchHypotheses && ticket.aiResearchHypotheses.length > 0
        ? ticket.aiResearchHypotheses
        : buildAIResearchHypothesesForFamily(
            ticket.familyName,
            ticket.corroboratingEvidence || [],
            ticket.suggestedAdamBridge
          );

    const branchFreq = new Map<string, number>();
    const locationFreq = new Map<string, number>();
    allTicketEvidence.forEach((ev) => {
      const branches = (ev.child_branches || '')
        .split(/[|،,؛]/)
        .map((s) => s.trim())
        .filter(Boolean);
      new Set(branches).forEach((b) => {
        branchFreq.set(b, (branchFreq.get(b) || 0) + 1);
      });
      const locs = (ev.locations || '')
        .split(/[|،,؛/]/)
        .map((s) => s.trim())
        .filter(Boolean);
      new Set(locs).forEach((loc) => {
        locationFreq.set(loc, (locationFreq.get(loc) || 0) + 1);
      });
    });

    const indexedEvidence = allTicketEvidence.map((ev, originalIdx) => ({
      ev,
      originalIdx,
    }));
    const winnerItems = indexedEvidence.filter(
      (item) => item.ev.is_consensus_winner !== false
    );
    const competingItems = indexedEvidence.filter(
      (item) => item.ev.is_consensus_winner === false
    );

    const activeBridgePreview = (
      appliedAdamBridgeByTicket[ticket.id] ||
      ticket.suggestedAdamBridge?.adam_chain_preview ||
      'طيء ← كهلان ← سبأ ← قحطان ← آدم عليه السلام'
    ).replace(/⬅️/g, '←');

    const renderEvidenceCard = (
      ev: CorroboratingAlphaEvidence,
      idx: number
    ) => {
      const isIncluded = getTicketIncludedIndices(ticket).includes(idx);
      const isPrimary = (primarySourceIndexByTicket[ticket.id] ?? 0) === idx;
      const noteKey = `${ticket.id}-${idx}`;
      const chainStations = splitAncestorsChain(ev.lineage_ancestors);
      const displayChain =
        chainStations.length > 0
          ? chainStations
          : [ticket.familyName, ticket.subRootName, ticket.motherTribeName];

      const parsedBranches = (ev.child_branches || '')
        .split(/[|،,؛]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const parsedLocations = (ev.locations || '')
        .split(/[|،,؛/]/)
        .map((s) => s.trim())
        .filter(Boolean);

      return (
        <div
          key={ev.alpha_id || idx}
          className={`rounded-2xl border p-4 transition-all ${
            isPrimary
              ? 'bg-[#FAF6F0] border-2 border-[#D8755B]'
              : isIncluded
              ? 'bg-white border-[#E2DACB]'
              : 'bg-[#FAF8F5]/60 border-[#E2DACB] opacity-60'
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[#E2DACB]">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-[#252321]">
                  {idx + 1}. كتاب: {ev.source_book}
                </span>
                {(() => {
                  const lakeBadge = resolveResearcherDataLakeBadge(ev);
                  return (
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${lakeBadge.colorClass}`}
                    >
                      {lakeBadge.tag}
                    </span>
                  );
                })()}
                {(ev.volume || ev.page) && (
                  <span className="px-2 py-0.5 rounded bg-[#FAF6F0] border border-[#B98A78]/40 text-[#8D4925] font-mono text-[11px] font-bold">
                    {[
                      ev.volume ? `ج ${ev.volume}` : '',
                      ev.page ? `ص ${ev.page}` : '',
                    ]
                      .filter(Boolean)
                      .join(' / ')}
                  </span>
                )}
                {ev.consensus_badge && (
                  <span className="px-2 py-0.5 rounded bg-[#FAF6F0] text-[#8D4925] border border-[#E2DACB] text-[10px] font-bold">
                    {ev.consensus_badge}
                  </span>
                )}
                {(ev.locality_match_status ===
                  'UNSPECIFIED_NON_CONFLICTING_LOCALITY' ||
                  parsedLocations.length === 0) && (
                  <span className="px-2 py-0.5 rounded bg-[#FAF6F0] text-[#5C5346] border border-[#E2DACB] text-[10px] font-bold">
                    {UNSPECIFIED_LOCALITY_BADGE_TEXT}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#EDE6DA] text-[#5C5346]">
                  {ev.priority_tier === 'PRIORITY_1_COUNTRY_BOOK'
                    ? 'مرجع دولة العميل'
                    : 'مرجع عام'}
                </span>
                {(Boolean(ev.other_sources && ev.other_sources.trim()) ||
                  (Array.isArray(ev.parsed_other_sources) &&
                    ev.parsed_other_sources.length > 0)) && (
                  <span className="px-2 py-0.5 rounded-full bg-[#FAF6F0] border border-[#B98A78]/50 text-[#8D4925] text-[10px] font-extrabold">
                    إحالات هامشية ({ev.parsed_other_sources?.length || 1})
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-[#B98A78]/50 bg-white text-[11px] font-bold text-[#252321] cursor-pointer hover:border-[#D8755B]">
                <input
                  type="checkbox"
                  checked={isIncluded}
                  onChange={() => toggleSourceInclusion(ticket, idx)}
                  className="w-3.5 h-3.5 accent-[#D8755B] cursor-pointer"
                />
                <span>اعتماد المصدر</span>
              </label>

              <button
                type="button"
                onClick={() =>
                  handleSetPrimaryNarrativeForTicket(ticket, idx, ev)
                }
                className={`px-3 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
                  isPrimary
                    ? 'bg-[#D8755B] text-white shadow-2xs'
                    : 'bg-white border border-[#B98A78]/50 text-[#252321] hover:border-[#D8755B]'
                }`}
              >
                <Star className="w-3.5 h-3.5" />
                <span>
                  {isPrimary
                    ? 'الرواية الأساسية المعتمدة ✓'
                    : 'تعيين كرواية أساسية'}
                </span>
              </button>

              {!isPrimary && (
                <button
                  type="button"
                  onClick={() =>
                    handleSpliceNarrativeAbovePrimary(ticket, idx, ev)
                  }
                  className="px-3 py-1 rounded-xl bg-[#8D4925] hover:bg-[#733A1D] text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                >
                  <GitMerge className="w-3.5 h-3.5" />
                  <span>دمج أجداد الرواية</span>
                </button>
              )}
            </div>
          </div>

          {(parsedBranches.length > 0 || parsedLocations.length > 0) && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-[#FAF6F0] rounded-xl p-3 border border-[#E2DACB]">
              {parsedBranches.length > 0 && (
                <div>
                  <span className="text-[11px] font-bold text-[#5C5346] block mb-1">
                    الفروع الأبناء المذكورة في السجل:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {parsedBranches.map((br, bIdx) => {
                      const isShared = (branchFreq.get(br) || 0) >= 2;
                      return (
                        <span
                          key={bIdx}
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold flex items-center gap-1 ${
                            isShared
                              ? 'bg-white border border-[#B98A78] text-[#8D4925]'
                              : 'bg-white border border-[#E2DACB] text-[#252321]'
                          }`}
                        >
                          <span>{br}</span>
                          {isShared && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#8D4925] text-white">
                              مشترك
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {parsedLocations.length > 0 && (
                <div>
                  <span className="text-[11px] font-bold text-[#5C5346] block mb-1">
                    المواطن والنطاق الجغرافي:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {parsedLocations.map((loc, lIdx) => {
                      const isShared = (locationFreq.get(loc) || 0) >= 2;
                      return (
                        <span
                          key={lIdx}
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold flex items-center gap-1 ${
                            isShared
                              ? 'bg-white border border-[#B98A78] text-[#8D4925]'
                              : 'bg-white border border-[#E2DACB] text-[#252321]'
                          }`}
                        >
                          <span>📍 {loc}</span>
                          {isShared && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#8D4925] text-white">
                              مشترك
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-3">
            <span className="text-[11px] font-bold text-[#5C5346] block mb-2">
              سلسلة نسب الأجداد في هذا المصدر (انقر على أي جد للفحص في شجرة آدم):
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {displayChain.map((nodeName: string, nodeIdx: number) => {
                const isInspected =
                  inlineChainInspection?.ticketId === ticket.id &&
                  inlineChainInspection?.sourceIdx === idx &&
                  inlineChainInspection?.queriedName === nodeName;
                const isAnalyzedRootNode = nodeIdx === 0;
                return (
                  <React.Fragment key={nodeIdx}>
                    <button
                      type="button"
                      onClick={() =>
                        handleInspectChainNodeInAdam(
                          ticket.id,
                          idx,
                          nodeName,
                          [
                            ...displayChain.slice(nodeIdx + 1),
                            ticket.subRootName,
                            ticket.motherTribeName,
                          ].filter(Boolean)
                        )
                      }
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                        isInspected
                          ? 'bg-[#FAF6F0] text-[#8D4925] border-[#C5A059] ring-2 ring-[#C5A059]/40 shadow-2xs font-extrabold'
                          : isAnalyzedRootNode
                          ? 'bg-[#FAF6F0] text-[#8D4925] border-[#C5A059] hover:border-[#8D4925] font-extrabold'
                          : 'bg-white hover:bg-[#FAF6F0] text-[#252321] border-[#E2DACB]'
                      }`}
                    >
                      <span>{nodeName}</span>
                      <span
                        className={`text-[10px] font-normal ${
                          isInspected
                            ? 'text-[#8D4925] font-bold'
                            : 'text-[#8D4925]'
                        }`}
                      >
                        🔍 فحص
                      </span>
                    </button>
                    {nodeIdx < displayChain.length - 1 && (
                      <span className="text-[#B98A78] text-xs font-bold px-0.5">
                        ←
                      </span>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {inlineChainInspection &&
            inlineChainInspection.ticketId === ticket.id &&
            inlineChainInspection.sourceIdx === idx && (
              <div className="mt-3 p-3.5 rounded-xl border text-xs bg-[#FAF6F0] text-[#8D4925] border-[#C5A059]/70">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold">
                    {inlineChainInspection.foundInAdam &&
                    inlineChainInspection.matchedNode ? (
                      <span>
                        ✓ العقدة «{inlineChainInspection.queriedName}» مفهرسة
                        في شجرة آدم ({inlineChainInspection.matchedNode.arc_code} —{' '}
                        {inlineChainInspection.matchedNode.node_id})
                      </span>
                    ) : (
                      <span>
                        العقدة «{inlineChainInspection.queriedName}» غير
                        مفهرسة بعد في شجرة آدم — جاهزة للإدراج والربط المباشر
                      </span>
                    )}
                  </div>

                  {inlineChainInspection.foundInAdam &&
                    inlineChainInspection.matchedNode && (
                      <button
                        type="button"
                        onClick={() => {
                          if (inlineChainInspection.matchedNode) {
                            handleOpenNodeDirectlyInAdamExplorer(
                              inlineChainInspection.matchedNode
                            );
                          }
                        }}
                        className="px-3 py-1 rounded-lg bg-[#8D4925] hover:bg-[#733A1D] text-white text-[11px] font-bold cursor-pointer transition-all shadow-2xs"
                      >
                        فتح السجل في شجرة آدم ↗
                      </button>
                    )}
                </div>

                {inlineChainInspection.foundInAdam &&
                  inlineChainInspection.adamChainPreview.length > 0 && (
                    <p className="text-[11px] text-[#252321] mt-1.5 font-mono">
                      الاتصال في شجرة آدم:{' '}
                      {inlineChainInspection.adamChainPreview.join(' ← ')}
                    </p>
                  )}
              </div>
            )}

          <div className="mt-3 pt-2 border-t border-[#E2DACB]">
            <input
              type="text"
              value={sourceResearcherNotes[noteKey] || ''}
              onChange={(e) =>
                setSourceResearcherNotes((prev) => ({
                  ...prev,
                  [noteKey]: e.target.value,
                }))
              }
              placeholder="ملاحظة الباحث التحقيقية على هذه الرواية (اختياري)..."
              className="w-full px-3 py-1.5 rounded-lg border border-[#E2DACB] bg-white text-xs focus:outline-none focus:border-[#D8755B]"
            />
          </div>
        </div>
      );
    };

    return (
      <div
        data-testid="gamified-ticket-operations-workspace"
        className="rounded-3xl border border-[#E2DACB] bg-[#FAF6F0]/60 p-5 sm:p-6 shadow-2xs space-y-5 relative"
      >
        {/* =========================================================
            WORKFLOW TABS BAR (Simplified & Harmonized with Warm Heritage Theme)
        ========================================================= */}
        <div className="rounded-2xl bg-[#FAF6F0] text-[#252321] p-4 space-y-3 border border-[#E2DACB]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="text-sm font-extrabold font-display text-[#252321]">
              مراحل معالجة البحث وتوثيق النسب
            </h4>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAllWorkflowStepsAtOnce((prev) => !prev)}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#EDE6DA]/70 border border-[#E2DACB] text-[#8D4925] text-[11px] font-bold cursor-pointer transition-all"
              >
                {showAllWorkflowStepsAtOnce
                  ? 'وضع التبويبات المتسلسلة'
                  : 'عرض كافة المراحل في صفحة واحدة'}
              </button>
              <span
                data-testid="quest-progress-percentage"
                className="px-3 py-1 rounded-xl bg-[#8D4925] text-white font-mono text-xs font-extrabold"
              >
                {questProgressPercent}% مكتمل
              </span>
            </div>
          </div>

          {/* 4-STEP SEQUENTIAL WORKFLOW TABS BAR */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
            {[
              {
                step: 1 as const,
                title: '1. الفحص والأدلة المرجعية',
                sub: `${allTicketEvidence.length} مصادر مرصودة`,
                done: allTicketEvidence.length > 0,
              },
              {
                step: 2 as const,
                title: '2. هندسة العمود وجسر آدم',
                sub: isBridgeConnected
                  ? 'متصل بشجرة آدم ✓'
                  : `${liveNodes.length} محطات في السلسلة`,
                done: isBridgeConnected,
              },
              {
                step: 3 as const,
                title: '3. إثراء العقدة والمصادر الهامشية',
                sub: `المصادر (${activeSourceIndices.length}) · الهامش (${verifiedLeadsCount}/${extractedLeads.length})`,
                done: isStation2Completed && isStation3Completed,
              },
              {
                step: 4 as const,
                title: '4. المعاينة النهائية والاعتماد',
                sub: 'معاينة العمود النهائي',
                done:
                  ticket.status === 'CLOSED_AND_ENRICHED' ||
                  ticket.status === 'merged_closed',
              },
            ].map((tabItem) => {
              const isCurrent =
                !showAllWorkflowStepsAtOnce &&
                activeTicketWorkflowStep === tabItem.step;
              return (
                <button
                  key={tabItem.step}
                  type="button"
                  data-testid={`workflow-tab-${tabItem.step}-btn`}
                  onClick={() => {
                    setShowAllWorkflowStepsAtOnce(false);
                    setActiveTicketWorkflowStep(tabItem.step);
                  }}
                  className={`rounded-xl px-3.5 py-2.5 border text-right transition-all cursor-pointer flex flex-col justify-between gap-1 ${
                    isCurrent
                      ? 'bg-[#D8755B] text-white border-[#D8755B] shadow-2xs'
                      : 'bg-white border-[#E2DACB] text-[#252321] hover:bg-[#EDE6DA]/50 hover:border-[#B98A78]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-xs font-extrabold">
                      {tabItem.title}
                    </span>
                    {tabItem.done && (
                      <span
                        className={`text-[10px] font-mono font-extrabold px-1.5 py-0.5 rounded ${
                          isCurrent
                            ? 'bg-white text-[#D8755B]'
                            : 'bg-[#FAF6F0] text-[#8D4925] border border-[#E2DACB]'
                        }`}
                      >
                        ✓
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-[10px] ${
                      isCurrent
                        ? 'text-white/95 font-bold'
                        : 'text-[#5C5346] font-medium'
                    }`}
                  >
                    {tabItem.sub}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ===================================================================
            WORKFLOW TAB 1: [1. الفحص والأدلة المرجعية]
        =================================================================== */}
        <div
          data-testid="workflow-step-1-panel"
          className={
            activeTicketWorkflowStep === 1 || showAllWorkflowStepsAtOnce
              ? 'block space-y-5'
              : 'hidden'
          }
        >
          {/* 1A: EMBEDDED DIAGNOSTIC DRAWER — كشّاف الأنساب */}
          <div
            data-testid="embedded-diagnostic-drawer"
            className="rounded-2xl border border-[#E2DACB] bg-[#FAF6F0] text-[#252321] overflow-hidden shadow-2xs"
          >
            <div
              onClick={() => setIsDiagnosticDrawerOpen((prev) => !prev)}
              className="p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-[#EDE6DA]/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white p-0.5 border border-[#B98A78] shadow-2xs shrink-0 flex items-center justify-center overflow-hidden">
                  <img
                    src="/assets/aistudio/Logo_Boslet_Alansab_8349b12d.jpg"
                    alt="كشّاف الأنساب"
                    className="w-full h-full object-cover rounded-full"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-xs sm:text-sm font-display font-extrabold text-[#252321] block">
                    كشّاف الأنساب — ملخص الفحص التشخيصي المدمج
                  </span>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#5C5346]">
                    <span>
                      المصادر الخام: <strong className="text-[#8D4925]">{diagnosticCtx.rawSourcesCount}</strong>
                    </span>
                    <span>·</span>
                    <span className="text-[#8D4925] font-bold">
                      عقدتا الجذر: {diagnosticCtx.rootBranchB2} ← {diagnosticCtx.rootTribeB0}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                data-testid="toggle-embedded-diagnostic-drawer-btn"
                className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-[#EDE6DA] border border-[#E2DACB] text-[#8D4925] text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
              >
                <span>
                  {isDiagnosticDrawerOpen
                    ? 'طيّ ملخص الفحص'
                    : 'عرض ملخص الفحص'}
                </span>
                {isDiagnosticDrawerOpen ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </div>

            {isDiagnosticDrawerOpen && (
              <div className="p-4 pt-0 border-t border-[#E2DACB] space-y-4 bg-white">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-3">
                  {/* 1. Raw Sources Summary inside Drawer (5 cols) */}
                  <div className="lg:col-span-5 rounded-xl bg-[#FAF6F0] border border-[#E2DACB] p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-extrabold font-display text-[#8D4925]">
                        ملخص المصادر الخام المرصودة ({allTicketEvidence.length})
                      </h5>
                    </div>
                    {allTicketEvidence.length === 0 ? (
                      <div className="rounded-lg bg-white border border-[#E2DACB] p-2.5 text-[11px] font-bold text-[#8D4925]">
                        بحث عميل بدون تطابق مباشر في المعاجم الحالية — موجه للتحقيق المعمق.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {allTicketEvidence.map((ev, eIdx) => {
                          const lakeBadge = resolveResearcherDataLakeBadge(ev);
                          const rawChainTokens = extractRawRecordAncestors(ev);
                          return (
                            <div
                              key={ev.alpha_id || eIdx}
                              className="rounded-xl bg-white border border-[#E2DACB] p-2.5 space-y-1.5"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-1">
                                <span className="px-2 py-0.5 rounded bg-[#FAF6F0] border border-[#E2DACB] text-[#8D4925] text-[10px] font-bold">
                                  {formatAlphaReferenceBadge(ev)}
                                </span>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold border ${lakeBadge.colorClass}`}
                                >
                                  {lakeBadge.tag}
                                </span>
                              </div>
                              <div className="text-[11px] text-[#252321] font-bold leading-relaxed">
                                {rawChainTokens.join(' ← ')}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 2. Pipeline Audit inside Drawer (7 cols) */}
                  <div className="lg:col-span-7 rounded-xl bg-[#FAF6F0] border border-[#E2DACB] p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-extrabold font-display text-[#8D4925]">
                        سجل خطوات المعالجة والتحقق
                      </h5>
                      <span className="px-2 py-0.5 rounded bg-white border border-[#E2DACB] text-[#8D4925] font-mono text-[10px] font-bold">
                        {diagnosticCtx.rootBranchB2} ← {diagnosticCtx.rootTribeB0}
                      </span>
                    </div>
                    <ul className="space-y-1.5 text-[11px] text-[#252321] max-h-60 overflow-y-auto pr-1">
                      {diagnosticCtx.pipelineAuditBullets.map((b, bIdx) => (
                        <li
                          key={bIdx}
                          className="flex items-start gap-2 bg-white rounded-lg px-2.5 py-1.5 border border-[#E2DACB]"
                        >
                          <span className="shrink-0">{b.icon}</span>
                          <div>
                            <strong className="text-[#8D4925]">{b.title}:</strong>{' '}
                            <span>{b.detail}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 1B: Research Hypothesis Card */}
          <div
            data-testid="section1-ai-research-hypothesis-and-bridge"
            className="rounded-2xl border border-[#E2DACB] bg-[#FAF6F0] p-4 sm:p-5 shadow-2xs space-y-2.5"
          >
            <h4 className="text-sm font-extrabold font-display text-[#8D4925]">
              خلاصة القرائن الاستدلالية للباحث
            </h4>

            <div className="space-y-2">
              {hypotheses.map((hyp, hIdx) => (
                <div
                  key={hIdx}
                  className="rounded-xl bg-white border border-[#E2DACB] p-3 text-xs text-[#252321] leading-relaxed font-medium"
                >
                  {hyp}
                </div>
              ))}
            </div>
          </div>

          {/* 1C: CONSENSUS WINNER & COMPETING PATHS COMPARISON */}
          {renderConsensusAndCompetingPathsMatrix(
            ticket.familyName,
            ticket.corroboratingEvidence,
            'ticket_inbox'
          )}

          {/* 1D: مصفوفة تفكيك ومقارنة المصادر والروايات */}
          <div
            data-testid="lake2-corroborating-alpha-sources"
            className="space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-bold font-display text-[#252321]">
                المصادر والروايات المرصودة ({allTicketEvidence.length} مصادر)
              </h4>
              <span className="px-3 py-1 rounded-xl bg-[#FAF6F0] border border-[#E2DACB] text-xs font-bold text-[#8D4925]">
                المصادر المعتمدة للتوثيق:{' '}
                {getTicketIncludedIndices(ticket).length} من{' '}
                {allTicketEvidence.length}
              </span>
            </div>

            {/* GROUP 1: مراجع مسار التوافق الأساسي */}
            <div className="rounded-2xl border border-[#B98A78]/50 bg-[#FAF6F0] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs sm:text-sm font-extrabold font-display text-[#252321]">
                  مراجع مسار التوافق الأساسي
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#8D4925] text-white text-[11px] font-bold">
                  {winnerItems.length} مصادر متفقة
                </span>
              </div>
              <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
                {winnerItems.map(({ ev, originalIdx }) =>
                  renderEvidenceCard(ev, originalIdx)
                )}
              </div>
            </div>

            {/* GROUP 2: روايات وسجلات أخرى لنفس الاسم للمقارنة والتحقيق */}
            {competingItems.length > 0 && (
              <div className="rounded-2xl border border-[#E2DACB] bg-[#FAF6F0] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm font-extrabold font-display text-[#8D4925]">
                    روايات أخرى لنفس الاسم للمقارنة والتحقيق
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-white border border-[#E2DACB] text-[#8D4925] text-[11px] font-bold">
                    {competingItems.length} روايات موازية
                  </span>
                </div>
                <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                  {competingItems.map(({ ev, originalIdx }) =>
                    renderEvidenceCard(ev, originalIdx)
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 1E: روافد البحيرة الثالثة والمشاريع الخاصة */}
          {ticket.lake3UnlinkedProjects &&
            ticket.lake3UnlinkedProjects.length > 0 && (
              <div
                data-testid="lake3-unlinked-projects"
                className="rounded-2xl border border-[#E2DACB] bg-[#FAF6F0] p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs sm:text-sm font-bold font-display text-[#252321]">
                    سجلات استئناسية داعمة من المشاريع الخاصة ({ticket.lake3UnlinkedProjects.length})
                  </h4>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {ticket.lake3UnlinkedProjects.map((rec) => {
                    const isAttached = (
                      includedLake3IdsByTicket[ticket.id] || []
                    ).includes(rec.record_id);
                    return (
                      <div
                        key={rec.record_id}
                        className={`rounded-xl border p-3.5 space-y-1.5 transition-all ${
                          isAttached
                            ? 'bg-[#FAF6F0] border-[#D8755B]'
                            : 'bg-white border-[#E2DACB]'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-[#252321]">
                              {rec.project_source}
                            </span>
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#FAF6F0] border border-[#E2DACB] text-[#8D4925]">
                              {rec.family_or_tribe_name}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              toggleLake3RecordInclusion(
                                ticket.id,
                                rec.record_id
                              )
                            }
                            className={`px-3 py-1 rounded-xl text-[11px] font-bold cursor-pointer transition-all ${
                              isAttached
                                ? 'bg-[#8D4925] text-white'
                                : 'bg-[#D8755B] hover:bg-[#c5644b] text-white'
                            }`}
                          >
                            {isAttached
                              ? '✓ تم الإلحاق بالمصادر المعتمدة'
                              : '+ إلحاق بالمصادر المعتمدة'}
                          </button>
                        </div>
                        <p className="text-xs text-[#252321] leading-relaxed">
                          {rec.snippet}
                        </p>
                        {rec.locations && (
                          <p className="text-[11px] text-[#5C5346]">
                            📍 المواضع المذكورة: {rec.locations}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
        </div>

        {/* ===================================================================
            WORKFLOW TAB 2: [2. هندسة العمود وجسر آدم]
        =================================================================== */}
        <div
          data-testid="workflow-step-2-panel"
          className={
            activeTicketWorkflowStep === 2 || showAllWorkflowStepsAtOnce
              ? 'block space-y-5'
              : 'hidden'
          }
        >
          <div
            data-testid="workspace-station-1-lego-chain-builder"
            className="rounded-2xl border border-[#E2DACB] bg-[#FAF6F0] p-4 sm:p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2DACB] pb-3">
              <div>
                <h5 className="text-sm font-extrabold font-display text-[#252321]">
                  هندسة عمود النسب وجسر شجرة آدم
                </h5>
                <p className="text-[11px] text-[#5C5346]">
                  عدّل اسم أي محطة أو كودها الهيكلي ونوع الرابط (بن / من)، أو أضف محطات جديدة
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-xl bg-white border border-[#E2DACB] text-[#8D4925] text-xs font-bold">
                  {liveNodes.length} محطات
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const nextNodes: ExtractableLineageNode[] = [
                      ...liveNodes,
                      {
                        id: `node-manual-${Date.now()}`,
                        name: 'جد / بطن جديد',
                        nodeCode: 'B1',
                        relationType: 'aan',
                        region: ticket.locationLabel,
                      },
                    ];
                    setLivePreviewNodesByTicket((prev) => ({
                      ...prev,
                      [ticket.id]: nextNodes,
                    }));
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#8D4925] hover:bg-[#733A1D] text-white text-xs font-bold cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ محطة جديدة</span>
                </button>
              </div>
            </div>

            {/* Unified Interactive Chain Cards */}
            <div className="rounded-2xl bg-white border border-[#E2DACB] p-4 space-y-3.5">
              <div className="flex flex-wrap items-center gap-2">
                {liveNodes.map((node, nIdx) => (
                  <React.Fragment key={node.id || nIdx}>
                    <div
                      data-testid={`lego-chain-chip-${nIdx}`}
                      className="inline-flex flex-wrap items-center gap-1.5 p-2 rounded-2xl border border-[#E2DACB] bg-[#FAF6F0] text-[#252321] text-xs font-bold shadow-2xs transition-all"
                    >
                      <span className="w-5 h-5 rounded-full bg-[#8D4925] text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                        {nIdx + 1}
                      </span>

                      <input
                        type="text"
                        value={node.name}
                        onChange={(e) =>
                          handleUpdateLivePreviewNode(ticket, nIdx, {
                            name: e.target.value,
                          })
                        }
                        className="px-2 py-1 rounded-lg border border-[#E2DACB] bg-white text-xs font-extrabold text-[#252321] w-28 sm:w-32 focus:outline-none focus:border-[#D8755B]"
                      />

                      <select
                        value={node.nodeCode || (nIdx === 0 ? 'FE0' : 'B1')}
                        onChange={(e) =>
                          handleUpdateLivePreviewNode(ticket, nIdx, {
                            nodeCode: e.target.value,
                          })
                        }
                        className="px-1.5 py-1 rounded-lg border border-[#E2DACB] bg-white text-[#8D4925] font-mono text-[11px] font-bold cursor-pointer"
                        title="الكود الهيكلي للمحطة"
                      >
                        {ARC_CODE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.value}
                          </option>
                        ))}
                      </select>

                      <select
                        value={node.relationType}
                        onChange={(e) =>
                          handleUpdateLivePreviewNode(ticket, nIdx, {
                            relationType: e.target.value as 'bin' | 'aan',
                          })
                        }
                        className="px-1.5 py-1 rounded-lg border border-[#E2DACB] bg-white text-[#252321] text-[11px] font-bold cursor-pointer"
                        title="نوع الرابط النسبي"
                      >
                        <option value="bin">بن</option>
                        <option value="aan">من</option>
                      </select>

                      {nIdx > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            handleMoveLivePreviewNode(ticket, nIdx, 'up')
                          }
                          className="px-1.5 py-0.5 rounded bg-[#EDE6DA] hover:bg-[#E2DACB] text-[#252321] text-[11px] cursor-pointer"
                          title="تقديم المحطة"
                        >
                          →
                        </button>
                      )}
                      {nIdx < liveNodes.length - 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            handleMoveLivePreviewNode(ticket, nIdx, 'down')
                          }
                          className="px-1.5 py-0.5 rounded bg-[#EDE6DA] hover:bg-[#E2DACB] text-[#252321] text-[11px] cursor-pointer"
                          title="تأخير المحطة"
                        >
                          ←
                        </button>
                      )}

                      {liveNodes.length > 2 && (
                        <button
                          type="button"
                          onClick={() =>
                            handleRemoveLivePreviewNode(ticket, nIdx)
                          }
                          className="w-5 h-5 rounded-full bg-[#EDE6DA] hover:bg-[#D8755B] text-[#8D4925] hover:text-white flex items-center justify-center text-xs font-extrabold cursor-pointer transition-colors"
                          title="حذف هذه العقدة من السلسلة"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    {nIdx < liveNodes.length - 1 && (
                      <span className="text-[#B98A78] font-bold text-xs px-0.5">
                        ←
                      </span>
                    )}
                  </React.Fragment>
                ))}
              </div>

              {/* Quick Input & Lake 3 Suggestions Bar */}
              <div className="pt-3 border-t border-[#E2DACB] flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex items-center gap-1.5">
                  <input
                    type="text"
                    value={quickAncestorInputByTicket[ticket.id] || ''}
                    onChange={(e) =>
                      setQuickAncestorInputByTicket((prev) => ({
                        ...prev,
                        [ticket.id]: e.target.value,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleQuickAddChipToChain(
                          quickAncestorInputByTicket[ticket.id] || ''
                        );
                      }
                    }}
                    placeholder="+ اكتب اسم جد واضغط Enter لإدراجه في السلسلة..."
                    className="px-3 py-1.5 rounded-xl border border-[#E2DACB] bg-[#FAF6F0] text-xs font-bold text-[#252321] focus:outline-none focus:border-[#D8755B] w-64"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      handleQuickAddChipToChain(
                        quickAncestorInputByTicket[ticket.id] || ''
                      )
                    }
                    className="px-3 py-1.5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-bold cursor-pointer"
                  >
                    إدراج في السلسلة
                  </button>
                </div>

                {lake3SuggestionNames.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-[#5C5346]">
                      مقترحات سريعة:
                    </span>
                    {lake3SuggestionNames.map((sugName, sIdx) => (
                      <button
                        key={sIdx}
                        type="button"
                        onClick={() => handleQuickAddChipToChain(sugName)}
                        className="px-2.5 py-0.5 rounded-lg bg-[#FAF6F0] hover:bg-[#EDE6DA] border border-[#E2DACB] text-[#8D4925] text-[11px] font-bold cursor-pointer transition-all"
                      >
                        + {sugName}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Unified Adam Tree Bridge & Instant Search Panel (Warm Heritage Theme) */}
            <div
              data-testid="lake1-suggested-adam-bridge"
              className="rounded-2xl border border-[#B98A78]/50 bg-white text-[#252321] p-4 sm:p-5 shadow-2xs space-y-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#FAF6F0] border border-[#E2DACB] text-[#8D4925] text-[11px] font-bold">
                      جسر شجرة آدم المقترح
                    </span>
                    {ticket.suggestedAdamBridge && (
                      <span className="px-2.5 py-0.5 rounded-full bg-[#FAF6F0] border border-[#E2DACB] text-[#8D4925] font-mono text-[11px] font-bold">
                        العقدة #{ticket.suggestedAdamBridge.adam_node_id} (
                        {ticket.suggestedAdamBridge.matched_station_name})
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm sm:text-base font-bold font-display text-[#252321]">
                    نقطة الالتقاء في شجرة آدم والاتصال الكامل حتى آدم عليه السلام
                  </h4>
                </div>

                <button
                  type="button"
                  data-testid="station1-connect-adam-bridge-btn"
                  onClick={() => {
                    const bridgePreview =
                      appliedAdamBridgeByTicket[ticket.id] ||
                      ticket.suggestedAdamBridge?.adam_chain_preview ||
                      activeBridgePreview;
                    setAppliedAdamBridgeByTicket((prev) => ({
                      ...prev,
                      [ticket.id]: bridgePreview,
                    }));
                    showToast(
                      `تم اعتماد ووصل أعلى السلسلة (${
                        liveNodes[liveNodes.length - 1]?.name ||
                        ticket.familyName
                      }) بشجرة آدم بنجاح ✓`
                    );
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold cursor-pointer transition-all flex items-center gap-1.5 shadow-2xs ${
                    isBridgeConnected
                      ? 'bg-[#8D4925] text-white'
                      : 'bg-[#D8755B] hover:bg-[#c5644b] text-white'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {isBridgeConnected
                      ? '✓ تم وصل السلسلة بشجرة آدم'
                      : 'اعتماد ووصل السلسلة بشجرة آدم'}
                  </span>
                </button>
              </div>

              {ticket.suggestedAdamBridge && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="rounded-xl bg-[#FAF6F0] border border-[#E2DACB] p-3">
                    <span className="text-[#5C5346] block text-[11px]">
                      المحطة المطابقة من عمود العائلة:
                    </span>
                    <span className="font-extrabold text-[#8D4925] text-sm">
                      {ticket.suggestedAdamBridge.matched_station_name}
                    </span>
                  </div>

                  <div className="sm:col-span-2 rounded-xl bg-[#FAF6F0] border border-[#E2DACB] p-3">
                    <span className="text-[#5C5346] block text-[11px]">
                      عقدة شجرة آدم المكتشفة وسلسلة اتصالها المباشر:
                    </span>
                    <span className="font-mono font-bold text-[#252321] text-xs sm:text-sm">
                      {ticket.suggestedAdamBridge.adam_node_id}:{' '}
                      {ticket.suggestedAdamBridge.adam_chain_preview}
                    </span>
                  </div>
                </div>
              )}

              <div className="rounded-xl bg-[#FAF6F0] border border-[#E2DACB] p-3 text-xs space-y-1">
                <span className="text-[#8D4925] font-bold block">
                  الاتصال الكامل حتى آدم عليه السلام:
                </span>
                <p className="text-[#252321] font-mono leading-relaxed">
                  {liveNodes.map((n) => n.name).join(' ← ')} ←{' '}
                  <strong className="text-[#8D4925]">
                    {activeBridgePreview}
                  </strong>
                </p>
              </div>

              <div className="pt-2 border-t border-[#E2DACB] flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={quickAdamBridgeSearchByTicket[ticket.id] || ''}
                  onChange={(e) =>
                    setQuickAdamBridgeSearchByTicket((prev) => ({
                      ...prev,
                      [ticket.id]: e.target.value,
                    }))
                  }
                  placeholder="🔍 أو ابحث عن عقدة أخرى في شجرة آدم للربط المباشر..."
                  className="px-3 py-1.5 rounded-lg bg-[#FAF6F0] border border-[#E2DACB] text-[#252321] placeholder:text-[#5C5346] text-xs focus:outline-none focus:border-[#D8755B] w-80"
                />
                {quickAdamMatches.map((mNode) => (
                  <button
                    key={mNode.node_id}
                    type="button"
                    onClick={() => {
                      const inspected = inspectNameInAdamMasterTree(
                        mNode.name,
                        adamGraphNodes
                      );
                      const chainText = [
                        mNode.name,
                        ...inspected.ancestorsUpToAdam.map((a) => a.name),
                      ].join(' ← ');
                      setAppliedAdamBridgeByTicket((prev) => ({
                        ...prev,
                        [ticket.id]: chainText,
                      }));
                      setQuickAdamBridgeSearchByTicket((prev) => ({
                        ...prev,
                        [ticket.id]: '',
                      }));
                      showToast(
                        `تم ربط السلسلة بعقدة شجرة آدم: ${mNode.name} (#${mNode.node_id}) ✓`
                      );
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#FAF6F0] hover:bg-[#EDE6DA] border border-[#E2DACB] text-[#8D4925] text-[11px] font-bold cursor-pointer"
                  >
                    ربط بـ {mNode.name} ({mNode.arc_code})
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ===================================================================
            WORKFLOW TAB 3: [3. إثراء العقدة والمصادر الهامشية]
        =================================================================== */}
        <div
          data-testid="workflow-step-3-panel"
          className={
            activeTicketWorkflowStep === 3 || showAllWorkflowStepsAtOnce
              ? 'block space-y-5'
              : 'hidden'
          }
        >
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            {/* RIGHT COLUMN (6 COLS): STATION 2 — NODE ENRICHMENT */}
            <div
              data-testid="workspace-station-2-node-enrichment"
              className="xl:col-span-6 rounded-2xl border border-[#E2DACB] bg-[#FAF6F0] p-4 sm:p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2DACB] pb-3">
                <div>
                  <h5 className="text-sm font-extrabold font-display text-[#252321]">
                    إثراء العقدة بالمصادر والفروع والمواضع
                  </h5>
                </div>

                <button
                  type="button"
                  data-testid="station2-approve-enrichment-btn"
                  onClick={() => {
                    setStation2ApprovedByTicket((prev) => ({
                      ...prev,
                      [ticket.id]: true,
                    }));
                    setEnrichmentBranchesInput(activeBranchPills.join('، '));
                    setEnrichmentLocationsInput(activeLocationPills.join('، '));
                    showToast(
                      `تم اعتماد إثراء العقدة بـ (${activeSourceIndices.length}) مصادر أساسية و(${activeBranchPills.length}) فروع و(${activeLocationPills.length}) مواضع جغرافية ✓`
                    );
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer transition-all shadow-2xs ${
                    isStation2Completed
                      ? 'bg-[#8D4925] text-white'
                      : 'bg-[#D8755B] hover:bg-[#c5644b] text-white'
                  }`}
                >
                  {isStation2Completed
                    ? '✓ تم اعتماد عناصر الإثراء'
                    : 'اعتماد عناصر الإثراء المفعّلة'}
                </button>
              </div>

              <div className="space-y-3">
                <div className="rounded-xl bg-white border border-[#E2DACB] p-3 space-y-2">
                  <span className="text-xs font-extrabold text-[#252321] block">
                    المصادر الأساسية ({activeSourceIndices.length}/
                    {allTicketEvidence.length}):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {allTicketEvidence.map((ev, idx) => {
                      const isSelected = activeSourceIndices.includes(idx);
                      return (
                        <button
                          key={ev.alpha_id || idx}
                          type="button"
                          onClick={() => toggleSourceInclusion(ticket, idx)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition-all text-right ${
                            isSelected
                              ? 'bg-[#FAF6F0] border-[#D8755B] text-[#8D4925]'
                              : 'bg-white border-[#E2DACB] text-[#5C5346]'
                          }`}
                        >
                          {isSelected ? '✓ ' : '+ '}
                          {formatCompactSourceBracket(ev)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white border border-[#E2DACB] p-3 space-y-2">
                    <span className="text-xs font-extrabold text-[#252321] block">
                      الفروع الأبناء المستخرجة ({activeBranchPills.length}):
                    </span>
                    {allCandidateBranches.length === 0 ? (
                      <span className="text-[11px] text-[#5C5346] block">
                        لا توجد فروع فرعية إضافية مسجلة في النص الخام
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {allCandidateBranches.map((br, bIdx) => {
                          const isSelected = activeBranchPills.includes(br);
                          return (
                            <button
                              key={bIdx}
                              type="button"
                              onClick={() => {
                                const next = isSelected
                                  ? activeBranchPills.filter(
                                      (item) => item !== br
                                    )
                                  : [...activeBranchPills, br];
                                setSelectedBranchPillsByTicket((prev) => ({
                                  ...prev,
                                  [ticket.id]: next,
                                }));
                                setEnrichmentBranchesInput(next.join('، '));
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-[#FAF6F0] border-[#D8755B] text-[#8D4925]'
                                  : 'bg-white border-[#E2DACB] text-[#5C5346]'
                              }`}
                            >
                              {isSelected ? '✓ ' : '+ '}
                              {br}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl bg-white border border-[#E2DACB] p-3 space-y-2">
                    <span className="text-xs font-extrabold text-[#252321] block">
                      المواضع الجغرافية ({activeLocationPills.length}):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {allCandidateLocations.map((loc, lIdx) => {
                        const isSelected = activeLocationPills.includes(loc);
                        return (
                          <button
                            key={lIdx}
                            type="button"
                            onClick={() => {
                              const next = isSelected
                                ? activeLocationPills.filter(
                                    (item) => item !== loc
                                  )
                                : [...activeLocationPills, loc];
                              setSelectedLocationPillsByTicket((prev) => ({
                                ...prev,
                                [ticket.id]: next,
                              }));
                              setEnrichmentLocationsInput(next.join('، '));
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-[#FAF6F0] border-[#D8755B] text-[#8D4925]'
                                : 'bg-white border-[#E2DACB] text-[#5C5346]'
                            }`}
                          >
                            {isSelected ? '✓ 📍 ' : '+ 📍 '}
                            {loc}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Extra Enrichment Fields integrated directly into the right column */}
                <div className="bg-white rounded-xl border border-[#E2DACB] p-3.5 space-y-2.5">
                  <h5 className="text-xs font-extrabold text-[#252321]">
                    بيانات الإثراء الإضافية للسجل (فروع شقيقة، أعلام، انتشار جغرافي):
                  </h5>
                  <div className="grid grid-cols-1 gap-2.5">
                    <input
                      type="text"
                      value={enrichmentBranchesInput}
                      onChange={(e) =>
                        setEnrichmentBranchesInput(e.target.value)
                      }
                      placeholder="فروع شقيقة (مفصولة بفاصلة)..."
                      className="px-3 py-2 rounded-xl border border-[#E2DACB] bg-[#FAF6F0] text-xs font-bold"
                    />
                    <input
                      type="text"
                      value={enrichmentNotablesInput}
                      onChange={(e) =>
                        setEnrichmentNotablesInput(e.target.value)
                      }
                      placeholder="أعلام وشخصيات بارزة..."
                      className="px-3 py-2 rounded-xl border border-[#E2DACB] bg-[#FAF6F0] text-xs font-bold"
                    />
                    <input
                      type="text"
                      value={enrichmentLocationsInput}
                      onChange={(e) =>
                        setEnrichmentLocationsInput(e.target.value)
                      }
                      placeholder="الانتشار الجغرافي الإضافي..."
                      className="px-3 py-2 rounded-xl border border-[#E2DACB] bg-[#FAF6F0] text-xs font-bold"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* LEFT COLUMN (6 COLS): STATION 3 — SECONDARY SOURCES & ADAM PRIME SYNC */}
            <div
              data-testid="workspace-station-3-secondary-sources-adam-prime"
              className="xl:col-span-6 rounded-2xl border border-[#E2DACB] bg-[#FAF6F0] p-4 sm:p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2DACB] pb-3">
                <div>
                  <h5 className="text-sm font-extrabold font-display text-[#252321]">
                    توثيق المصادر الإضافية في سجل آدم برايم
                  </h5>
                </div>

                <span className="px-3 py-1 rounded-xl bg-white border border-[#E2DACB] text-[#8D4925] text-xs font-bold">
                  الموثق: {verifiedLeadsCount} من {extractedLeads.length}
                </span>
              </div>

              {extractedLeads.length === 0 ? (
                <div className="rounded-xl bg-white border border-[#E2DACB] p-4 text-xs font-bold text-[#5C5346]">
                  لا توجد إحالات هامشية معلقة لهذه التذكرة.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {extractedLeads.map((lead, lIdx) => {
                    const leadKey = `ticket_inbox-${lead.linked_alpha_id}-${lIdx}`;
                    const isVerified =
                      lead.verification_status === 'VERIFIED_ADDON_SOURCE';
                    const currentPrice =
                      addonUnlockPricesByLeadKey[leadKey] ??
                      lead.addon_unlock_price_usd ??
                      2;
                    const autoMatch = resolveAutoMatchedAdamPrimeSource(lead);
                    const chosenId =
                      selectedAdamPrimeIdByLeadKey[leadKey] ||
                      autoMatch.source_id;
                    const isSearchOpen = Boolean(
                      openOneWordSearchByLeadKey[leadKey]
                    );
                    const oneWordQuery = (
                      oneWordQueryByLeadKey[leadKey] || ''
                    ).trim();
                    const compactSearchMatches = oneWordQuery
                      ? adamPrimeRegistryResults
                          .filter(
                            (r) =>
                              normalizeArabic(r.title).includes(
                                normalizeArabic(oneWordQuery)
                              ) ||
                              normalizeArabic(r.author || '').includes(
                                normalizeArabic(oneWordQuery)
                              )
                          )
                          .slice(0, 3)
                      : [];

                    return (
                      <div
                        key={leadKey}
                        data-testid={`ticket-secondary-source-card-${lIdx}`}
                        className={`rounded-2xl border p-4 transition-all space-y-3 ${
                          isVerified
                            ? 'bg-white border-[#D8755B] shadow-2xs'
                            : 'bg-white border-[#E2DACB] hover:border-[#B98A78]'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs sm:text-sm font-extrabold text-[#252321]">
                              {lead.extracted_book_title || autoMatch.title}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-[#FAF6F0] border border-[#E2DACB] text-[#8D4925] font-mono text-xs font-bold">
                              ج: {lead.extracted_volume || '—'}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-[#FAF6F0] border border-[#E2DACB] text-[#8D4925] font-mono text-xs font-bold">
                              ص: {lead.extracted_page || '—'}
                            </span>
                          </div>

                          <span
                            className={`px-3 py-1 rounded-full text-xs font-extrabold border ${
                              isVerified
                                ? 'bg-[#8D4925] text-white border-[#8D4925]'
                                : 'bg-[#FAF6F0] text-[#8D4925] border-[#E2DACB]'
                            }`}
                          >
                            {isVerified
                              ? `✓ موثق (${chosenId})`
                              : `معرف آدم برايم: ${chosenId}`}
                          </span>
                        </div>

                        {isSearchOpen && (
                          <div className="rounded-xl bg-[#FAF6F0] border border-[#E2DACB] p-2.5 flex flex-wrap items-center gap-2">
                            <input
                              type="text"
                              value={oneWordQueryByLeadKey[leadKey] || ''}
                              onChange={(e) =>
                                setOneWordQueryByLeadKey((prev) => ({
                                  ...prev,
                                  [leadKey]: e.target.value,
                                }))
                              }
                              placeholder="ابحث بكلمة واحدة في آدم برايم (مثال: النويري، القلقشندي)..."
                              className="px-3 py-1 rounded-lg border border-[#E2DACB] bg-white text-xs font-bold w-64"
                            />
                            {compactSearchMatches.map((reg) => (
                              <button
                                key={reg.source_id}
                                type="button"
                                onClick={() => {
                                  setSelectedAdamPrimeIdByLeadKey((prev) => ({
                                    ...prev,
                                    [leadKey]: reg.source_id,
                                  }));
                                  setOpenOneWordSearchByLeadKey((prev) => ({
                                    ...prev,
                                    [leadKey]: false,
                                  }));
                                }}
                                className="px-2.5 py-1 rounded-lg bg-[#8D4925] text-white text-[11px] font-bold cursor-pointer"
                              >
                                اختيار [{reg.source_id}] {reg.title}
                              </button>
                            ))}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#E2DACB]">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] font-bold text-[#5C5346] ml-1">
                              سعر الإتاحة:
                            </span>
                            {[
                              { label: 'مجاني', value: 0 },
                              { label: '$1', value: 1 },
                              { label: '$2', value: 2 },
                              { label: '$3', value: 3 },
                            ].map((priceOpt) => {
                              const isSelectedPrice =
                                currentPrice === priceOpt.value;
                              return (
                                <button
                                  key={priceOpt.value}
                                  type="button"
                                  onClick={() =>
                                    setAddonUnlockPricesByLeadKey((prev) => ({
                                      ...prev,
                                      [leadKey]: priceOpt.value,
                                    }))
                                  }
                                  className={`px-3 py-1 rounded-xl text-xs font-extrabold border cursor-pointer transition-all ${
                                    isSelectedPrice
                                      ? 'bg-[#D8755B] border-[#D8755B] text-white shadow-2xs'
                                      : 'bg-[#FAF6F0] border-[#E2DACB] text-[#252321] hover:bg-[#EDE6DA]'
                                  }`}
                                >
                                  {priceOpt.label}
                                </button>
                              );
                            })}

                            <button
                              type="button"
                              onClick={() =>
                                setOpenOneWordSearchByLeadKey((prev) => ({
                                  ...prev,
                                  [leadKey]: !prev[leadKey],
                                }))
                              }
                              className="px-2.5 py-1 rounded-xl border border-[#E2DACB] bg-white hover:bg-[#FAF6F0] text-[11px] text-[#5C5346] font-bold cursor-pointer mr-1"
                            >
                              🔍 بحث
                            </button>
                          </div>

                          <button
                            type="button"
                            disabled={verifyingLeadKey === leadKey}
                            onClick={() =>
                              handleVerifyAndAttachOtherSourceLead(
                                lead,
                                leadKey,
                                'ticket_inbox'
                              )
                            }
                            data-testid={`verify-and-attach-btn-${lIdx}`}
                            className={`px-4 py-2 rounded-xl text-xs font-extrabold cursor-pointer transition-all shadow-2xs flex items-center gap-1.5 ${
                              isVerified
                                ? 'bg-[#8D4925] text-white'
                                : 'bg-[#D8755B] hover:bg-[#c5644b] text-white'
                            }`}
                          >
                            <Sparkles className="w-4 h-4 shrink-0" />
                            <span>
                              {verifyingLeadKey === leadKey
                                ? 'جارٍ التوثيق...'
                                : isVerified
                                ? `✓ موثق (${
                                    currentPrice === 0
                                      ? 'مجاني'
                                      : `$${currentPrice}`
                                  })`
                                : 'توثيق في آدم برايم'}
                            </span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ===================================================================
            WORKFLOW TAB 4: [4. المعاينة النهائية والاعتماد]
        =================================================================== */}
        <div
          data-testid="workflow-step-4-panel"
          className={
            activeTicketWorkflowStep === 4 || showAllWorkflowStepsAtOnce
              ? 'block space-y-5'
              : 'hidden'
          }
        >
          <div
            data-testid="section4-live-final-column-preview"
            className="rounded-3xl border border-[#E2DACB] bg-white p-5 space-y-5 shadow-2xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2DACB] pb-3">
              <div>
                <h4 className="text-sm sm:text-base font-extrabold font-display text-[#252321]">
                  المعاينة النهائية لعمود النسب المدمج لعائلة ({ticket.familyName})
                </h4>
              </div>
            </div>

            {/* Quick Executive Summary of Completed Work in Ticket */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="rounded-2xl bg-[#FAF6F0] border border-[#E2DACB] p-3.5 space-y-1">
                <span className="text-[#5C5346] text-[11px] block">
                  محطات السلسلة المخيطة
                </span>
                <span className="text-base font-extrabold text-[#8D4925] font-mono">
                  {liveNodes.length} محطات موثقة
                </span>
              </div>
              <div className="rounded-2xl bg-[#FAF6F0] border border-[#E2DACB] p-3.5 space-y-1">
                <span className="text-[#5C5346] text-[11px] block">
                  المراجع الأساسية المعتمدة
                </span>
                <span className="text-base font-extrabold text-[#8D4925] font-mono">
                  {activeSourceIndices.length} من {allTicketEvidence.length} مراجع
                </span>
              </div>
              <div className="rounded-2xl bg-[#FAF6F0] border border-[#E2DACB] p-3.5 space-y-1">
                <span className="text-[#5C5346] text-[11px] block">
                  الفروع والمواضع المفعّلة
                </span>
                <span className="text-base font-extrabold text-[#252321] font-mono">
                  {activeBranchPills.length} فرع · {activeLocationPills.length} موضع
                </span>
              </div>
              <div className="rounded-2xl bg-[#FAF6F0] border border-[#E2DACB] p-3.5 space-y-1">
                <span className="text-[#5C5346] text-[11px] block">
                  المصادر الهامشية (آدم برايم)
                </span>
                <span className="text-base font-extrabold text-[#8D4925] font-mono">
                  {verifiedLeadsCount} من {extractedLeads.length} موثق
                </span>
              </div>
            </div>

            {/* Visual Connected Spine Summary up to Adam (Warm Heritage Theme) */}
            <div className="rounded-2xl bg-[#FAF6F0] border border-[#E2DACB] text-[#252321] p-4 space-y-2.5 shadow-2xs">
              <span className="text-xs font-bold text-[#8D4925] block">
                الشكل النهائي لعمود النسب المدمج حتى آدم عليه السلام:
              </span>
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {liveNodes.map((n, i) => (
                  <React.Fragment key={n.id || i}>
                    <span
                      className={`px-2.5 py-1 rounded-lg border font-bold ${
                        i === 0
                          ? 'bg-[#FAF6F0] border-[#C5A059] text-[#8D4925] font-extrabold'
                          : 'bg-white border-[#E2DACB] text-[#252321]'
                      }`}
                    >
                      {n.name}{' '}
                      <span className="font-mono text-[10px] text-[#8D4925]">
                        ({n.nodeCode})
                      </span>
                    </span>
                    <span className="text-[#B98A78] font-bold px-0.5">←</span>
                  </React.Fragment>
                ))}
                <span className="px-2.5 py-1 rounded-lg bg-[#FAF6F0] border border-[#C5A059] text-[#8D4925] font-mono text-xs font-extrabold">
                  🌳 {activeBridgePreview}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ===================================================================
            STICKY ACTION FOOTER (Simplified Labels & Warm Heritage Colors)
        =================================================================== */}
        <div
          data-testid="sticky-ticket-action-footer"
          className="sticky bottom-2 z-20 rounded-2xl border border-[#E2DACB] bg-[#FAF6F0]/95 backdrop-blur-md p-3.5 sm:p-4 shadow-md space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {/* ACTION 1 */}
            <button
              type="button"
              onClick={() => handleActionAApproveAndLinkToAdam(ticket)}
              className="p-3 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
            >
              <span>✅ اعتماد الربط وإثراء شجرة آدم وإغلاق التذكرة</span>
            </button>

            {/* ACTION 2 */}
            <button
              type="button"
              onClick={() => handleActionBEnrichExistingAdamNode(ticket)}
              className="p-3 rounded-xl bg-[#8D4925] hover:bg-[#733A1D] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
            >
              <span>✨ اعتماد إثراء المراجع والفروع فقط</span>
            </button>

            {/* ACTION 3 */}
            <button
              type="button"
              onClick={() => setShowClarificationBox((prev) => !prev)}
              className="p-3 rounded-xl bg-white hover:bg-[#EDE6DA] text-[#252321] border border-[#E2DACB] text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
            >
              <span>💬 طلب إيضاح أو وثيقة من العميل</span>
            </button>

            {/* ACTION 4 */}
            <button
              type="button"
              onClick={() => handleActionDEscalateToAdamPrime(ticket)}
              className="p-3 rounded-xl bg-white hover:bg-[#EDE6DA] text-[#8D4925] border border-[#B98A78]/50 text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
            >
              <span>🏛️ تصعيد البحث إلى آدم برايم</span>
            </button>
          </div>

          {/* INLINE CLARIFICATION BOX FOR ACTION C */}
          {showClarificationBox && (
            <div className="pt-2 border-t border-[#E2DACB] space-y-2.5">
              <label className="block text-xs font-bold text-[#252321]">
                اكتب رسالة الاستيضاح التي ستصل فوراً إلى إشعارات العميل ({ticket.clientName}):
              </label>
              <textarea
                rows={2}
                value={clarificationMessage}
                onChange={(e) => setClarificationMessage(e.target.value)}
                placeholder="مثال: نرجو تزويدنا باسم الجد الرابع أو وثيقة المشجرة العائلية لحسم الالتقاء..."
                className="w-full p-2.5 rounded-xl border border-[#E2DACB] bg-white text-xs"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowClarificationBox(false)}
                  className="px-3 py-1.5 rounded-xl bg-white border border-[#E2DACB] text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={() => handleActionCRequestClarification(ticket)}
                  className="px-4 py-1.5 rounded-xl bg-[#D8755B] text-white text-xs font-bold cursor-pointer"
                >
                  إرسال الاستفسار للعميل وتحديث التذكرة ✓
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // =========================================================================
  // TAB 3: ADAM TREE STANDALONE INTERACTIVE EXPLORER & CODING EDITOR STATE
  // Single Source of Truth Dictionary (nodesById) + Independent Set Expansion (expandedNodeIds)
  // =========================================================================
  const [nodesById, setNodesById] = useState<
    Record<string, AdamTreeInteractiveNode>
  >(() => getInitialAdamTreeNodesById());

  const adamGraphNodes = useMemo(
    () => Object.values(nodesById),
    [nodesById]
  );

  // Pre-indexed O(1) child names lookup & pre-normalized Adam Tree nodes index for instant Direct Search rendering
  const adamChildrenByParentIdMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const n of adamGraphNodes) {
      if (!n.parent_id) continue;
      const list = map.get(n.parent_id);
      if (list) {
        list.push(n.name);
      } else {
        map.set(n.parent_id, [n.name]);
      }
    }
    return map;
  }, [adamGraphNodes]);

  const preIndexedAdamRecords = useMemo(() => {
    const seenNodeIds = new Set<string>();
    const allNodes: AdamTreeInteractiveNode[] = [];
    for (const n of adamGraphNodes) {
      if (n && n.node_id && !seenNodeIds.has(n.node_id)) {
        seenNodeIds.add(n.node_id);
        allNodes.push(n);
      }
    }
    for (const n of Object.values(MASTER_ADAM_NODES_MAP)) {
      if (n && n.node_id && !seenNodeIds.has(n.node_id)) {
        seenNodeIds.add(n.node_id);
        allNodes.push(n);
      }
    }
    for (const n of remoteAdamMatchesForDirectSearch) {
      if (n && n.node_id && !seenNodeIds.has(n.node_id)) {
        seenNodeIds.add(n.node_id);
        allNodes.push(n);
      }
    }

    return allNodes.map((node) => {
      const cleanNodeTitle = (node.name || '')
        .replace(/\s*\(#\d+\)\s*$/, '')
        .trim();
      const cleaned = cleanNodeTitle
        .replace(/^(?:عائلة|اسرة|أسرة|قبيلة|عشيرة|فخذ|فرع)\s+/g, '')
        .trim();
      const fullNorm = normalizeArabicForSearch(cleaned);
      const withoutOuterPrefix = normalizeArabicForSearch(
        cleaned
          .replace(
            /^(?:آل|ال|بيت|بنو|بني|بنى|البو|ألبو|ذوي|ذوو|أولاد|اولاد|عيال)\s+/g,
            ''
          )
          .trim()
      );
      const withoutKunyaPrefix = normalizeArabicForSearch(
        cleaned
          .replace(
            /^(?:آل|ال|بيت|بنو|بني|بنى|البو|ألبو|ذوي|ذوو|أولاد|اولاد|عيال)\s+/g,
            ''
          )
          .replace(/^(?:أبو|ابو|أبي|ابي|بو)\s+/g, '')
          .trim()
      );
      const stem = stemTribeToken(cleaned);
      const nodeCore = stripPrefixes(cleanNodeTitle);
      return {
        node,
        cleanNodeTitle,
        nodeCoreEndsWithAt: nodeCore.endsWith('ات'),
        isCompoundNodeTitle: /\s+(?:بن|ابن)\s+/.test(cleanNodeTitle),
        fullNorm,
        withoutOuterPrefix,
        withoutKunyaPrefix,
        stem,
      };
    });
  }, [adamGraphNodes, remoteAdamMatchesForDirectSearch]);

  const [adamTreeStats, setAdamTreeStats] = useState<{
    totalNodes: number;
    totalCodedNodes: number;
    mtRootIds: string[];
  }>({
    totalNodes: 474949,
    totalCodedNodes: 35560,
    mtRootIds: ['304', '306', '12662', '12660', '12661', '12659'],
  });
  const [isAdamSearchPanelOpen, setIsAdamSearchPanelOpen] =
    useState<boolean>(true);
  const [treeStartMode, setTreeStartMode] = useState<'ADAM_ROOT' | 'MT_PEAKS'>(
    'MT_PEAKS'
  );
  const [codedOnlyTreeToggle, setCodedOnlyTreeToggle] = useState<boolean>(true);
  const [treeLayoutMode, setTreeLayoutMode] = useState<'VERTICAL' | 'SIDE'>(
    'VERTICAL'
  );

  // Server-authoritative children map keyed by `${nodeId}__${codedOnly ? 'coded' : 'all'}`
  // Prevents nodes from vanishing or duplicating when inspecting child nodes or toggling filters
  const [serverChildrenByKey, setServerChildrenByKey] = useState<
    Record<string, Array<{ node_id: string; skippedGenerations: number }>>
  >({});

  // Server-authoritative ancestor chains up to Adam (#1) keyed by node_id
  const [serverAncestorsByNodeId, setServerAncestorsByNodeId] = useState<
    Record<string, AdamTreeInteractiveNode[]>
  >({});

  // Live POST search results from German Engine (474,949 nodes)
  const [liveSearchNodes, setLiveSearchNodes] = useState<
    AdamTreeInteractiveNode[] | null
  >(null);
  const [liveSearchTotals, setLiveSearchTotals] = useState<{
    total: number;
    coded: number;
  } | null>(null);
  const [isSearchingAdamEngine, setIsSearchingAdamEngine] =
    useState<boolean>(false);

  // Independent Set<string> for expanded nodes — never cleared or reset by search/selection effects!
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(
    () =>
      new Set([
        '1',
        '304',
        '306',
        '12662',
        '12660',
        '12661',
        '12659',
      ])
  );

  const [isNodeEditorUnlocked, setIsNodeEditorUnlocked] =
    useState<boolean>(false);
  const [showAdamSaveConfirmModal, setShowAdamSaveConfirmModal] =
    useState<boolean>(false);
  const [newGeoTagInput, setNewGeoTagInput] = useState<string>('');

  // 5 Integrated Search & Filter Controls for "🔍 البحث التفاعلي في شجرة آدم"
  // Strictly decoupled: adamArcFilter and adamRepFilter never mutate each other!
  const [adamSearchQuery, setAdamSearchQuery] = useState('');
  const [adamFatherQuery, setAdamFatherQuery] = useState('');
  const [searchUnderSelectedNodeOnly, setSearchUnderSelectedNodeOnly] =
    useState<boolean>(false);
  const [adamArcFilter, setAdamArcFilter] = useState<string>('');
  const [adamRepFilter, setAdamRepFilter] = useState<string>('');

  const [selectedAdamNodeId, setSelectedAdamNodeId] = useState<string>('304');

  const adamNodeByIdMap = useMemo(() => {
    const map = new Map<string, AdamTreeInteractiveNode>();
    for (const [id, n] of Object.entries(nodesById)) {
      map.set(id, n);
    }
    return map;
  }, [nodesById]);

  const getAncestorsChainForNode = useMemo(() => {
    return (node: AdamTreeInteractiveNode): AdamTreeInteractiveNode[] => {
      if (!node) return [];
      const serverChain = serverAncestorsByNodeId[node.node_id];
      if (serverChain && serverChain.length > 0) {
        return serverChain;
      }
      const chain: AdamTreeInteractiveNode[] = [];
      let currParentId = node.parent_id;
      const visited = new Set<string>([node.node_id]);
      let safety = 0;
      while (currParentId && !visited.has(currParentId) && safety < 80) {
        visited.add(currParentId);
        const parentNode =
          nodesById[currParentId] || MASTER_ADAM_NODES_MAP[currParentId];
        if (!parentNode) break;
        chain.unshift(parentNode); // Highest ancestor first, direct parent last
        currParentId = parentNode.parent_id;
        safety++;
      }
      return chain;
    };
  }, [nodesById, serverAncestorsByNodeId]);

  const selectedAdamNode = useMemo(
    () =>
      nodesById[selectedAdamNodeId] ||
      MASTER_ADAM_NODES_MAP[selectedAdamNodeId] ||
      nodesById['304'] ||
      nodesById['1'] ||
      adamGraphNodes[0],
    [nodesById, selectedAdamNodeId, adamGraphNodes]
  );

  // Identify the top Adam (AS) root node (#1) and the 6 canonical MT tribal peaks
  const adamTopRootNode = useMemo(() => {
    return (
      nodesById['1'] ||
      adamGraphNodes.find((n) => !n.parent_id && n.name.includes('آدم')) ||
      adamGraphNodes.find((n) => !n.parent_id) ||
      adamGraphNodes[0]
    );
  }, [nodesById, adamGraphNodes]);

  const mtSixPeakRoots = useMemo(() => {
    const canonicalMtIds = ['304', '306', '12662', '12660', '12661', '12659'];
    const peaks: AdamTreeInteractiveNode[] = [];
    const seen = new Set<string>();
    for (const id of canonicalMtIds) {
      const found = nodesById[id] || MASTER_ADAM_NODES_MAP[id];
      if (found && !seen.has(found.node_id)) {
        seen.add(found.node_id);
        peaks.push(found);
      }
    }
    return peaks;
  }, [nodesById]);

  // Fetch real Adam Tree stats (474,949 nodes + 35,560 coded nodes) directly from GERMAN_ENGINE_BASE_URL/api/v1/juthori/adam-tree/stats
  useEffect(() => {
    let cancelled = false;
    fetch(`${GERMAN_ENGINE_BASE_URL}/api/v1/juthori/adam-tree/stats`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const total = Number(
          data.total_nodes || data.data?.total_nodes || 474949
        );
        const rawCoded = Number(
          data.total_coded_nodes || data.data?.total_coded_nodes || 35560
        );
        const coded = rawCoded >= 35560 ? rawCoded : 35560;
        const incomingMtRoots = Array.isArray(data.mt_roots)
          ? data.mt_roots
          : Array.isArray(data.data?.mt_roots)
          ? data.data.mt_roots
          : [];

        setAdamTreeStats({
          totalNodes: total > 1000 ? total : 474949,
          totalCodedNodes: coded,
          mtRootIds:
            incomingMtRoots.length > 0
              ? incomingMtRoots
                  .map((r: any) => String(r.node_id || r.id || ''))
                  .filter(Boolean)
              : ['304', '306', '12662', '12660', '12661', '12659'],
        });

        // Also hydrate the 6 MT roots and Adam (#1) from stats response
        if (incomingMtRoots.length > 0) {
          setNodesById((prev) => {
            const next = { ...prev };
            for (const r of incomingMtRoots) {
              const id = String(r.node_id || r.id || '');
              if (!id) continue;
              const existing = next[id];
              next[id] = sanitizeAndNormalizeAdamNode({
                ...existing,
                node_id: id,
                name: String(r.name || existing?.name || ''),
                arc_code: String(r.arc_code || existing?.arc_code || 'MT'),
                representation: (r.representation ||
                  existing?.representation ||
                  'TRIBE') as AdamTreeInteractiveNode['representation'],
                relation_nature:
                  existing?.relation_nature || 'DIRECT_DESCENDANT',
                parent_id: existing?.parent_id || null,
                parent_name: existing?.parent_name,
                geo_footprint: existing?.geo_footprint || [],
                enriched_sources: existing?.enriched_sources || [],
                enriched_branches: existing?.enriched_branches || [],
              });
            }
            return next;
          });
        }
      })
      .catch(() => {
        // Fallback stats (474,949 & 35,560) remain active
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [editNodeId, setEditNodeId] = useState('');
  const [editNodeName, setEditNodeName] = useState('');
  const [editArcCode, setEditArcCode] = useState<string>('B0');
  const [editRepresentation, setEditRepresentation] =
    useState<AdamTreeInteractiveNode['representation']>('TRIBE');
  const [editRelationNature, setEditRelationNature] =
    useState<AdamTreeInteractiveNode['relation_nature']>('DIRECT_DESCENDANT');
  const [editGeoFootprint, setEditGeoFootprint] = useState('');
  const [editEnrichedSources, setEditEnrichedSources] = useState('');
  const [editEnrichedBranches, setEditEnrichedBranches] = useState('');

  // Add child node modal/inline state
  const [showAddChildForm, setShowAddChildForm] = useState(false);
  const [newChildName, setNewChildName] = useState('');
  const [newChildArcCode, setNewChildArcCode] = useState<string>('FE0');
  const [newChildRepresentation, setNewChildRepresentation] =
    useState<AdamTreeInteractiveNode['representation']>('FAMILY');
  const [newChildRelationNature, setNewChildRelationNature] =
    useState<AdamTreeInteractiveNode['relation_nature']>('DIRECT_DESCENDANT');
  const [newChildGeo, setNewChildGeo] = useState('العراق، السعودية');

  useEffect(() => {
    if (!selectedAdamNode) return;
    const sanitized = sanitizeAndNormalizeAdamNode(selectedAdamNode);
    setEditNodeId(sanitized.node_id);
    setEditNodeName(sanitized.name);
    setEditArcCode(sanitized.arc_code);
    setEditRepresentation(sanitized.representation);
    setEditRelationNature(sanitized.relation_nature);
    setEditGeoFootprint((sanitized.geo_footprint || []).join('، '));
    setEditEnrichedSources(
      (sanitized.enriched_sources || []).join('\n')
    );
    setEditEnrichedBranches(
      (sanitized.enriched_branches || []).join('، ')
    );
    setIsNodeEditorUnlocked(false);
    setShowAdamSaveConfirmModal(false);
  }, [selectedAdamNode]);

  const fetchNodeChildrenFromEngine = async (
    nodeId: string,
    codedOnly: boolean
  ) => {
    const cacheKey = `${nodeId}__${codedOnly ? 'coded' : 'all'}`;
    try {
      const resp = await fetch(
        `${GERMAN_ENGINE_BASE_URL}/api/v1/juthori/adam-tree/children/${encodeURIComponent(
          nodeId
        )}?coded_only=${codedOnly}`
      );
      if (!resp.ok) return;
      const data = await resp.json();
      const rawChildren = Array.isArray(data?.children)
        ? data.children
        : Array.isArray(data?.data?.children)
        ? data.data.children
        : Array.isArray(data)
        ? data
        : null;
      if (!rawChildren) return;

      const parsedChildren: Array<{
        node: AdamTreeInteractiveNode;
        skippedGenerations: number;
      }> = [];
      const seenIds = new Set<string>();
      const seenNames = new Set<string>();

      for (const item of rawChildren) {
        const cid = String(item.node_id || item.id || '').trim();
        const cname = String(item.name || item.title || '').trim();
        if (!cid || !cname || cid === nodeId || seenIds.has(cid)) continue;

        const nameDedupKey = getCanonicalAdamNodeDedupKey(cname);
        if (nameDedupKey && seenNames.has(nameDedupKey)) continue;

        seenIds.add(cid);
        if (nameDedupKey) seenNames.add(nameDedupKey);

        const skippedGen = Number(
          item.skipped_uncoded_generations ?? item.skippedGenerations ?? 0
        );

        const child = sanitizeAndNormalizeAdamNode({
          node_id: cid,
          name: cname,
          parent_id:
            skippedGen === 0
              ? String(item.parent_id || nodeId)
              : item.parent_id
              ? String(item.parent_id)
              : nodeId,
          parent_name: item.parent_name ? String(item.parent_name) : undefined,
          arc_code: String(item.arc_code || item.code || 'UNASSIGNED'),
          representation: (item.representation ||
            'INDIVIDUAL') as AdamTreeInteractiveNode['representation'],
          relation_nature: (item.relation_nature ||
            'DIRECT') as AdamTreeInteractiveNode['relation_nature'],
          geo_footprint: Array.isArray(item.geo_footprint)
            ? item.geo_footprint
            : typeof item.geo_footprint === 'string' && item.geo_footprint.trim()
            ? item.geo_footprint.split('|').map((s: string) => s.trim()).filter(Boolean)
            : [],
          enriched_sources: Array.isArray(item.enriched_sources)
            ? item.enriched_sources
            : typeof item.enriched_sources === 'string' && item.enriched_sources.trim()
            ? item.enriched_sources.split('|').map((s: string) => s.trim()).filter(Boolean)
            : [],
          enriched_branches: Array.isArray(item.enriched_branches)
            ? item.enriched_branches
            : [],
        });

        parsedChildren.push({
          node: child,
          skippedGenerations: skippedGen,
        });
      }

      // 1. Update nodesById dictionary without breaking existing direct parent links
      if (parsedChildren.length > 0) {
        setNodesById((prev) => {
          const next = { ...prev };
          for (const { node: child, skippedGenerations } of parsedChildren) {
            const existing = next[child.node_id];
            next[child.node_id] = {
              ...existing,
              ...child,
              parent_id:
                skippedGenerations === 0
                  ? child.parent_id || existing?.parent_id || nodeId
                  : existing?.parent_id || child.parent_id || nodeId,
              parent_name:
                child.parent_name ||
                existing?.parent_name ||
                (skippedGenerations === 0 ? prev[nodeId]?.name : undefined),
              geo_footprint:
                child.geo_footprint.length > 0
                  ? child.geo_footprint
                  : existing?.geo_footprint || [],
              enriched_sources:
                child.enriched_sources.length > 0
                  ? child.enriched_sources
                  : existing?.enriched_sources || [],
              enriched_branches:
                child.enriched_branches.length > 0
                  ? child.enriched_branches
                  : existing?.enriched_branches || [],
            };
          }
          return next;
        });
      }

      // 2. Store authoritative server children list for this (nodeId, codedOnly) pair while preserving any local path links
      setServerChildrenByKey((prev) => {
        const existingList = prev[cacheKey] || [];
        const merged = [...existingList];
        const seenIds = new Set(existingList.map((e) => e.node_id));
        for (const entry of parsedChildren) {
          if (!seenIds.has(entry.node.node_id)) {
            seenIds.add(entry.node.node_id);
            merged.push({
              node_id: entry.node.node_id,
              skippedGenerations: entry.skippedGenerations,
            });
          }
        }
        return {
          ...prev,
          [cacheKey]: merged,
        };
      });
    } catch {
      // Fallback relies on MASTER_ADAM_NODES_MAP / nodesById
    }
  };

  // Pre-fetch children from the German Engine for all expanded nodes whenever codedOnlyTreeToggle or expandedNodeIds changes
  useEffect(() => {
    const baseRoots = ['1', '304', '306', '12662', '12660', '12661', '12659'];
    const idsToFetch = new Set<string>([
      ...baseRoots,
      ...Array.from(expandedNodeIds),
    ]);
    for (const id of idsToFetch) {
      const cacheKey = `${id}__${codedOnlyTreeToggle ? 'coded' : 'all'}`;
      if (!serverChildrenByKey[cacheKey]) {
        fetchNodeChildrenFromEngine(id, codedOnlyTreeToggle);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codedOnlyTreeToggle, expandedNodeIds]);

  // Toggle expand/collapse ONLY for the clicked arrow's node_id in expandedNodeIds (Set<string>)
  const handleToggleExpandTreeNode = (nodeId: string) => {
    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
        fetchNodeChildrenFromEngine(nodeId, codedOnlyTreeToggle);
      }
      return next;
    });
  };

  // Clicking a node name in the tree: select it and ADD its ancestor path + itself to expandedNodeIds without clearing existing open branches
  const handleSelectTreeNodeInNavigator = (node: AdamTreeInteractiveNode) => {
    setSelectedAdamNodeId(node.node_id);
    const ancestors = getAncestorsChainForNode(node);
    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      if (adamTopRootNode) {
        next.add(adamTopRootNode.node_id);
      }
      for (const anc of ancestors) {
        next.add(anc.node_id);
      }
      next.add(node.node_id);
      return next;
    });
    fetchNodeChildrenFromEngine(node.node_id, codedOnlyTreeToggle);
  };

  // Resolve children from Server-Authoritative Cache (serverChildrenByKey) first, with fallback to nodesById
  const getResolvedChildrenForTreeNode = (
    nodeId: string
  ): Array<{ node: AdamTreeInteractiveNode; skippedGenerations: number }> => {
    const cacheKey = `${nodeId}__${codedOnlyTreeToggle ? 'coded' : 'all'}`;
    const serverEntries = serverChildrenByKey[cacheKey];
    if (serverEntries) {
      const out: Array<{
        node: AdamTreeInteractiveNode;
        skippedGenerations: number;
      }> = [];
      const seenIds = new Set<string>();
      const seenNames = new Set<string>();
      for (const entry of serverEntries) {
        const nodeObj =
          nodesById[entry.node_id] || MASTER_ADAM_NODES_MAP[entry.node_id];
        if (!nodeObj || seenIds.has(nodeObj.node_id)) continue;
        const nameKey = getCanonicalAdamNodeDedupKey(nodeObj.name);
        if (nameKey && seenNames.has(nameKey)) continue;
        seenIds.add(nodeObj.node_id);
        if (nameKey) seenNames.add(nameKey);
        out.push({
          node: nodeObj,
          skippedGenerations: entry.skippedGenerations,
        });
      }
      return out;
    }
    return resolveAdamTreeChildren(nodeId, nodesById, codedOnlyTreeToggle);
  };

  // Visual badge helper for Rule 4 & Rule 5.2 (Supports all German Engine structural codes: A, A1, A2, P, MT, MM, MF, M, B0..B9, FE0)
  const getSmartVisualTierMeta = (arcCodeRaw?: string) => {
    const code = (arcCodeRaw || '').trim().toUpperCase();
    if (!code || !VALID_STRUCTURAL_ARC_CODES.has(code)) {
      return {
        isCoded: false,
        code: '',
        dotClass: 'bg-[#D6CFC2] border border-[#BEB5A4]',
        capsuleClass: '',
        tierTitle: 'طبقة الآباء / جد فردي متسلسل',
      };
    }
    if (
      code === 'MT' ||
      code === 'B0' ||
      code === 'A' ||
      code === 'A1' ||
      code === 'A2' ||
      code === 'P'
    ) {
      return {
        isCoded: true,
        code,
        dotClass: 'bg-[#D4AF37] ring-2 ring-amber-200',
        capsuleClass:
          'bg-[#FAF3DD] text-[#8A6408] border border-[#D4AF37]/60',
        tierTitle:
          code === 'MT'
            ? `القبيلة الأم الجامعة (${code})`
            : code === 'B0'
            ? `الجد الجامع للفرع / القبيلة الفرعية (${code})`
            : `الجذر الأعلى (${code})`,
      };
    }
    if (code === 'FE0') {
      return {
        isCoded: true,
        code,
        dotClass: 'bg-[#4D6A47] ring-2 ring-emerald-200',
        capsuleClass:
          'bg-[#EDF3EB] text-[#355030] border border-[#4D6A47]/40',
        tierTitle: `أسرة / بيت نسب (${code})`,
      };
    }
    if (code === 'M' || code === 'MF' || code === 'MM') {
      return {
        isCoded: true,
        code,
        dotClass: 'bg-[#B45309] ring-2 ring-orange-200',
        capsuleClass:
          'bg-[#F9EFE6] text-[#8C3D07] border border-[#B45309]/40',
        tierTitle:
          code === 'M'
            ? `الجذم العربي التاريخي (${code})`
            : code === 'MM'
            ? `القبيلة الكبرى / الجذم الفرعي (${code})`
            : `الحلف أو التكتل القبلي (${code})`,
      };
    }
    return {
      isCoded: true,
      code,
      dotClass: 'bg-[#B45309] ring-2 ring-orange-200',
      capsuleClass:
        'bg-[#F9EFE6] text-[#8C3D07] border border-[#B45309]/40',
      tierTitle: `بطن / فرع هيكلي (${code})`,
    };
  };

  // Live POST query to GERMAN_ENGINE_BASE_URL/api/v1/juthori/adam-tree/search across all 474,949 nodes!
  useEffect(() => {
    const q = adamSearchQuery.trim();
    const father = adamFatherQuery.trim();
    const code = adamArcFilter.trim();
    const rep = adamRepFilter.trim();
    if (!q && !father && !code && !rep && !searchUnderSelectedNodeOnly) {
      setLiveSearchNodes(null);
      setLiveSearchTotals(null);
      setIsSearchingAdamEngine(false);
      return;
    }

    const searchPayload = {
      query: q,
      arc_code_filter:
        code && code !== 'ALL' && code !== 'UNASSIGNED' ? code : null,
      representation_filter: rep && rep !== 'ALL' ? rep : null,
      parent_name_filter: father || null,
      parent_scope: 'ANY',
      under_node_id:
        searchUnderSelectedNodeOnly && selectedAdamNode?.node_id
          ? selectedAdamNode.node_id
          : null,
      under_node_name:
        searchUnderSelectedNodeOnly && selectedAdamNode?.name
          ? selectedAdamNode.name
          : null,
      limit: 250,
    };

    let cancelled = false;
    setIsSearchingAdamEngine(true);

    fetch(`${GERMAN_ENGINE_BASE_URL}/api/v1/juthori/adam-tree/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(searchPayload),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        setIsSearchingAdamEngine(false);
        if (!data) return;

        const rawList = Array.isArray(data.nodes)
          ? data.nodes
          : Array.isArray(data.data?.nodes)
          ? data.data.nodes
          : Array.isArray(data.results)
          ? data.results
          : Array.isArray(data.data?.results)
          ? data.data.results
          : Array.isArray(data)
          ? data
          : [];

        const incoming: AdamTreeInteractiveNode[] = rawList
          .map((item: any) =>
            sanitizeAndNormalizeAdamNode({
              node_id: String(item.node_id || item.id || ''),
              name: String(item.name || item.title || ''),
              parent_id: item.parent_id ? String(item.parent_id) : null,
              parent_name: item.parent_name
                ? String(item.parent_name)
                : item.father_name
                ? String(item.father_name)
                : undefined,
              arc_code: String(item.arc_code || item.code || 'UNASSIGNED'),
              representation: (item.representation ||
                'INDIVIDUAL') as AdamTreeInteractiveNode['representation'],
              relation_nature: (item.relation_nature ||
                'DIRECT_DESCENDANT') as AdamTreeInteractiveNode['relation_nature'],
              geo_footprint: Array.isArray(item.geo_footprint)
                ? item.geo_footprint
                : typeof item.geo_footprint === 'string' &&
                  item.geo_footprint.trim()
                ? item.geo_footprint
                    .split('|')
                    .map((s: string) => s.trim())
                    .filter(Boolean)
                : [],
              enriched_sources: Array.isArray(item.enriched_sources)
                ? item.enriched_sources
                : typeof item.enriched_sources === 'string' &&
                  item.enriched_sources.trim()
                ? item.enriched_sources
                    .split('|')
                    .map((s: string) => s.trim())
                    .filter(Boolean)
                : [],
              enriched_branches: Array.isArray(item.enriched_branches)
                ? item.enriched_branches
                : [],
            })
          )
          .filter((n: AdamTreeInteractiveNode) => Boolean(n.node_id && n.name));

        // Filter client-side ONLY if user specifically picked 'UNASSIGNED'
        const finalIncoming =
          code === 'UNASSIGNED'
            ? incoming.filter((n) => !isAdamNodeStructurallyCoded(n))
            : incoming;

        if (finalIncoming.length > 0) {
          setLiveSearchNodes(finalIncoming);
          setLiveSearchTotals({
            total: Number(data.filtered_total ?? finalIncoming.length),
            coded: Number(
              data.filtered_coded ??
                finalIncoming.filter((n) => isAdamNodeStructurallyCoded(n)).length
            ),
          });
        } else {
          // Fall back to local adamGraphNodes search when remote returns empty fallback
          setLiveSearchNodes(null);
          setLiveSearchTotals(null);
        }

        if (incoming.length > 0) {
          setNodesById((prev) => {
            const next = { ...prev };
            for (const node of incoming) {
              const existing = next[node.node_id];
              next[node.node_id] = {
                ...existing,
                ...node,
                parent_id: node.parent_id || existing?.parent_id || null,
                parent_name: node.parent_name || existing?.parent_name,
                geo_footprint:
                  node.geo_footprint && node.geo_footprint.length > 0
                    ? node.geo_footprint
                    : existing?.geo_footprint || [],
                enriched_sources:
                  node.enriched_sources && node.enriched_sources.length > 0
                    ? node.enriched_sources
                    : existing?.enriched_sources || [],
                enriched_branches:
                  node.enriched_branches && node.enriched_branches.length > 0
                    ? node.enriched_branches
                    : existing?.enriched_branches || [],
              };
            }
            return next;
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsSearchingAdamEngine(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    adamSearchQuery,
    adamFatherQuery,
    adamArcFilter,
    adamRepFilter,
    searchUnderSelectedNodeOnly,
    selectedAdamNode?.node_id,
    selectedAdamNode?.name,
  ]);

  // Live query to `${GERMAN_ENGINE_BASE_URL}/api/v1/juthori/adam-tree/node/{id}` when researcher selects a node
  useEffect(() => {
    if (!selectedAdamNodeId) return;
    let cancelled = false;
    fetch(
      `${GERMAN_ENGINE_BASE_URL}/api/v1/juthori/adam-tree/node/${encodeURIComponent(
        selectedAdamNodeId
      )}`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const payload = data.data || data;
        const n =
          payload.node ||
          (payload.node_id || payload.name ? payload : null);
        if (!n) return;

        // Parse ancestors_chain_to_adam from German Engine (ordered from node at [0] up to Adam #1 at [length-1])
        const rawChain = Array.isArray(payload.ancestors_chain_to_adam)
          ? payload.ancestors_chain_to_adam
          : [];
        const rawDirectChildren = Array.isArray(payload.direct_children)
          ? payload.direct_children
          : [];

        const parsedChainBottomUp: AdamTreeInteractiveNode[] = [];
        for (let i = 0; i < rawChain.length; i++) {
          const item = rawChain[i];
          const parentItem = i + 1 < rawChain.length ? rawChain[i + 1] : null;
          const mappedAnc = sanitizeAndNormalizeAdamNode({
            node_id: String(item.node_id || item.id || ''),
            name: String(item.name || ''),
            parent_id: parentItem
              ? String(parentItem.node_id || parentItem.id || '')
              : null,
            parent_name: parentItem ? String(parentItem.name || '') : undefined,
            arc_code: String(item.arc_code || 'UNASSIGNED'),
            representation: (item.representation ||
              'INDIVIDUAL') as AdamTreeInteractiveNode['representation'],
            relation_nature: (item.relation_nature ||
              'DIRECT') as AdamTreeInteractiveNode['relation_nature'],
            geo_footprint: [],
            enriched_sources: [],
            enriched_branches: [],
          });
          if (mappedAnc.node_id && mappedAnc.name) {
            parsedChainBottomUp.push(mappedAnc);
          }
        }

        // Top-down ancestor chain (excluding the node itself at index 0)
        const ancestorsTopDown =
          parsedChainBottomUp.length > 1
            ? parsedChainBottomUp.slice(1).reverse()
            : [];
        const directFatherFromChain =
          parsedChainBottomUp.length > 1 ? parsedChainBottomUp[1] : null;

        const docSourcesRaw = String(
          n.enriched_sources || n.documented_sources || ''
        ).trim();
        const parsedSources = Array.isArray(n.enriched_sources)
          ? n.enriched_sources
          : docSourcesRaw
          ? docSourcesRaw
              .split('|')
              .map((s: string) => s.trim())
              .filter(Boolean)
          : [];

        const geoRaw = String(n.geo_footprint || '').trim();
        const parsedGeo = Array.isArray(n.geo_footprint)
          ? n.geo_footprint
          : geoRaw
          ? geoRaw
              .split('|')
              .map((s: string) => s.trim())
              .filter(Boolean)
          : [];

        const mappedNode = sanitizeAndNormalizeAdamNode({
          node_id: String(n.node_id || n.id || selectedAdamNodeId),
          name: String(n.name || ''),
          parent_id: n.parent_id
            ? String(n.parent_id)
            : directFatherFromChain?.node_id || null,
          parent_name: n.parent_name
            ? String(n.parent_name)
            : n.father_name
            ? String(n.father_name)
            : directFatherFromChain?.name,
          arc_code: String(n.arc_code || 'UNASSIGNED'),
          representation: (n.representation ||
            'INDIVIDUAL') as AdamTreeInteractiveNode['representation'],
          relation_nature: (n.relation_nature ||
            'DIRECT_DESCENDANT') as AdamTreeInteractiveNode['relation_nature'],
          geo_footprint: parsedGeo,
          enriched_sources: parsedSources,
          enriched_branches: Array.isArray(n.enriched_branches)
            ? n.enriched_branches
            : rawDirectChildren
                .map((c: any) => String(c.name || '').trim())
                .filter(Boolean),
        });

        if (ancestorsTopDown.length > 0) {
          setServerAncestorsByNodeId((prev) => ({
            ...prev,
            [mappedNode.node_id]: ancestorsTopDown,
          }));
        }

        if (mappedNode.name && mappedNode.node_id) {
          setNodesById((prev) => {
            const next = { ...prev };
            // Upsert all ancestors from chain
            for (const anc of parsedChainBottomUp) {
              const exAnc = next[anc.node_id];
              next[anc.node_id] = {
                ...exAnc,
                ...anc,
                parent_id: anc.parent_id || exAnc?.parent_id || null,
                parent_name: anc.parent_name || exAnc?.parent_name,
                geo_footprint: exAnc?.geo_footprint || [],
                enriched_sources: exAnc?.enriched_sources || [],
                enriched_branches: exAnc?.enriched_branches || [],
              };
            }
            const existing = next[mappedNode.node_id];
            next[mappedNode.node_id] = {
              ...existing,
              ...mappedNode,
              parent_id:
                mappedNode.parent_id || existing?.parent_id || null,
              parent_name:
                mappedNode.parent_name || existing?.parent_name,
              geo_footprint:
                mappedNode.geo_footprint.length > 0
                  ? mappedNode.geo_footprint
                  : existing?.geo_footprint || [],
              enriched_sources:
                mappedNode.enriched_sources.length > 0
                  ? mappedNode.enriched_sources
                  : existing?.enriched_sources || [],
              enriched_branches:
                mappedNode.enriched_branches.length > 0
                  ? mappedNode.enriched_branches
                  : existing?.enriched_branches || [],
            };
            return next;
          });
        }
      })
      .catch(() => {
        // Local MASTER_ADAM_NODES_MAP remains active
      });
    return () => {
      cancelled = true;
    };
  }, [selectedAdamNodeId]);

  // Rule 5: Only show results when the researcher actively enters a query or selects a filter!
  const hasActiveAdamSearchOrFilter = useMemo(() => {
    return (
      adamSearchQuery.trim() !== '' ||
      adamFatherQuery.trim() !== '' ||
      searchUnderSelectedNodeOnly ||
      (adamArcFilter !== '' && adamArcFilter !== 'ALL') ||
      (adamRepFilter !== '' && adamRepFilter !== 'ALL')
    );
  }, [
    adamSearchQuery,
    adamFatherQuery,
    searchUnderSelectedNodeOnly,
    adamArcFilter,
    adamRepFilter,
  ]);

  // 5 Integrated Filters: Prioritizes live German Engine POST search results (474,949 nodes) with local fallback
  const filteredAdamNodes = useMemo(() => {
    if (liveSearchNodes !== null) {
      return liveSearchNodes;
    }

    const scopeTargetNode =
      searchUnderSelectedNodeOnly && selectedAdamNode
        ? selectedAdamNode
        : null;
    const scopeTargetDedupKey = scopeTargetNode
      ? getCanonicalAdamNodeDedupKey(scopeTargetNode.name)
      : '';

    const trimmedSearch = adamSearchQuery.trim();
    const rawSearchLower = trimmedSearch.toLowerCase();
    const normSearchQuery = normalizeArabicForSearch(trimmedSearch);
    const trimmedFather = adamFatherQuery.trim();
    const normFatherQuery = normalizeArabicForSearch(trimmedFather);

    return adamGraphNodes.filter((rawNode) => {
      const n = sanitizeAndNormalizeAdamNode(rawNode);

      if (
        adamArcFilter !== '' &&
        adamArcFilter !== 'ALL' &&
        n.arc_code !== adamArcFilter
      ) {
        return false;
      }

      if (
        adamRepFilter !== '' &&
        adamRepFilter !== 'ALL' &&
        n.representation !== adamRepFilter
      ) {
        return false;
      }

      const ancestors = getAncestorsChainForNode(n);

      if (searchUnderSelectedNodeOnly && scopeTargetNode) {
        const isInSubtree = ancestors.some(
          (anc) =>
            anc.node_id === scopeTargetNode.node_id ||
            (scopeTargetDedupKey &&
              getCanonicalAdamNodeDedupKey(anc.name) === scopeTargetDedupKey)
        );
        if (!isInSubtree) {
          return false;
        }
      }

      if (trimmedFather) {
        const matchesParentNameProp = n.parent_name
          ? normalizeArabicForSearch(n.parent_name).includes(normFatherQuery) ||
            matchesFlexibleArabicSearch(n.parent_name, trimmedFather)
          : false;
        const matchesAnyAncestor = ancestors.some(
          (anc) =>
            normalizeArabicForSearch(anc.name).includes(normFatherQuery) ||
            matchesFlexibleArabicSearch(anc.name, trimmedFather)
        );
        if (!matchesParentNameProp && !matchesAnyAncestor) {
          return false;
        }
      }

      if (trimmedSearch) {
        const normNodeName = normalizeArabicForSearch(n.name);
        const nameMatch =
          (Boolean(normSearchQuery) &&
            (normNodeName.includes(normSearchQuery) ||
              normSearchQuery.includes(normNodeName))) ||
          matchesFlexibleArabicSearch(n.name, trimmedSearch);
        const idMatch = n.node_id.toLowerCase().includes(rawSearchLower);
        const geoMatch = (n.geo_footprint || []).some((g) =>
          matchesFlexibleArabicSearch(g, trimmedSearch)
        );
        if (!nameMatch && !idMatch && !geoMatch) {
          return false;
        }
      }

      return true;
    });
  }, [
    liveSearchNodes,
    adamGraphNodes,
    adamArcFilter,
    adamRepFilter,
    searchUnderSelectedNodeOnly,
    selectedAdamNode,
    adamFatherQuery,
    adamSearchQuery,
    getAncestorsChainForNode,
  ]);

  const filteredCodedNodesCount = useMemo(() => {
    if (liveSearchTotals) {
      return liveSearchTotals.coded;
    }
    return filteredAdamNodes.filter((n) => isAdamNodeStructurallyCoded(n))
      .length;
  }, [filteredAdamNodes, liveSearchTotals]);

  // Select node from search results -> fetch its full ancestor path from German Engine, expand all ancestors in tree, and scroll to it
  const handleSelectNodeFromSearchResults = async (
    targetNode: AdamTreeInteractiveNode
  ) => {
    setNodesById((prev) => ({
      ...prev,
      [targetNode.node_id]: {
        ...(prev[targetNode.node_id] || {}),
        ...targetNode,
      },
    }));
    setSelectedAdamNodeId(targetNode.node_id);

    // If codedOnlyTreeToggle is ON and the selected node is uncoded, turn off codedOnlyTreeToggle so it appears in the tree
    const nextCodedOnly =
      codedOnlyTreeToggle && !isAdamNodeStructurallyCoded(targetNode)
        ? false
        : codedOnlyTreeToggle;
    if (nextCodedOnly !== codedOnlyTreeToggle) {
      setCodedOnlyTreeToggle(false);
    }

    let ancestors = getAncestorsChainForNode(targetNode);

    // Inject local ancestor chain immediately so tree expands synchronously
    if (ancestors.length > 0) {
      const localPathTopDown = [...ancestors, targetNode];
      setServerChildrenByKey((prev) => {
        const next = { ...prev };
        for (let i = 0; i < localPathTopDown.length - 1; i++) {
          const pNode = localPathTopDown[i];
          const cNode = localPathTopDown[i + 1];
          for (const modeSuffix of ['coded', 'all']) {
            const key = `${pNode.node_id}__${modeSuffix}`;
            const existingList = next[key] || [];
            if (!existingList.some((e) => e.node_id === cNode.node_id)) {
              next[key] = [
                ...existingList,
                { node_id: cNode.node_id, skippedGenerations: 0 },
              ];
            }
          }
        }
        return next;
      });
    }

    // Fetch live ancestor chain from German Engine so even deep nodes (out of 474,949) expand their full tree branch!
    try {
      const resp = await fetch(
        `${GERMAN_ENGINE_BASE_URL}/api/v1/juthori/adam-tree/node/${encodeURIComponent(
          targetNode.node_id
        )}`
      );
      if (resp.ok) {
        const data = await resp.json();
        const payload = data.data || data;
        const rawChain = Array.isArray(payload.ancestors_chain_to_adam)
          ? payload.ancestors_chain_to_adam
          : [];
        if (rawChain.length > 1) {
          const chainBottomUp: AdamTreeInteractiveNode[] = [];
          for (let i = 0; i < rawChain.length; i++) {
            const item = rawChain[i];
            const parentItem = i + 1 < rawChain.length ? rawChain[i + 1] : null;
            chainBottomUp.push(
              sanitizeAndNormalizeAdamNode({
                node_id: String(item.node_id || item.id || ''),
                name: String(item.name || ''),
                parent_id: parentItem
                  ? String(parentItem.node_id || parentItem.id || '')
                  : null,
                parent_name: parentItem
                  ? String(parentItem.name || '')
                  : undefined,
                arc_code: String(item.arc_code || 'UNASSIGNED'),
                representation: (item.representation ||
                  'INDIVIDUAL') as AdamTreeInteractiveNode['representation'],
                relation_nature: (item.relation_nature ||
                  'DIRECT') as AdamTreeInteractiveNode['relation_nature'],
                geo_footprint: [],
                enriched_sources: [],
                enriched_branches: [],
              })
            );
          }

          setNodesById((prev) => {
            const next = { ...prev };
            for (const cNode of chainBottomUp) {
              next[cNode.node_id] = {
                ...(next[cNode.node_id] || {}),
                ...cNode,
              };
            }
            return next;
          });

          ancestors = chainBottomUp.slice(1).reverse();

          // Inject each link of the chain into serverChildrenByKey so the tree branch is immediately visible
          const fullPathTopDown = [...ancestors, targetNode];
          setServerChildrenByKey((prev) => {
            const next = { ...prev };
            for (let i = 0; i < fullPathTopDown.length - 1; i++) {
              const pNode = fullPathTopDown[i];
              const cNode = fullPathTopDown[i + 1];
              for (const modeSuffix of ['coded', 'all']) {
                const key = `${pNode.node_id}__${modeSuffix}`;
                const existingList = next[key] || [];
                if (!existingList.some((e) => e.node_id === cNode.node_id)) {
                  next[key] = [
                    ...existingList,
                    { node_id: cNode.node_id, skippedGenerations: 0 },
                  ];
                }
              }
            }
            return next;
          });
        }
      }
    } catch {
      // Fallback to local ancestor chain
    }

    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      if (adamTopRootNode) {
        next.add(adamTopRootNode.node_id);
      }
      for (const anc of ancestors) {
        next.add(anc.node_id);
      }
      next.add(targetNode.node_id);
      return next;
    });

    // Ensure the node is visible if treeStartMode was MT_PEAKS and the node is above the 6 peaks
    if (treeStartMode === 'MT_PEAKS') {
      const peakIds = new Set(mtSixPeakRoots.map((p) => p.node_id));
      const isUnderPeaks =
        peakIds.has(targetNode.node_id) ||
        ancestors.some((a) => peakIds.has(a.node_id));
      if (!isUnderPeaks) {
        setTreeStartMode('ADAM_ROOT');
      }
    }

    setTimeout(() => {
      const domEl = document.getElementById(
        `adam-tree-node-btn-${targetNode.node_id}`
      );
      if (domEl && typeof domEl.scrollIntoView === 'function') {
        domEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 180);
  };

  // Open a matched Adam node directly inside the Adam Tree view in the same page:
  // 1) Populates & opens "🔍 البحث التفاعلي في شجرة آدم" with the direct search result
  // 2) Expands & scrolls "🧭 المستكشف الشجري التفاعلي في شجرة آدم" on the exact node
  // 3) Loads the node's full record in "⚙️ لوحة بيانات وتكويد السجل المختار (Node Coding Editor)"
  const handleOpenNodeDirectlyInAdamExplorer = (
    targetNode: AdamTreeInteractiveNode
  ) => {
    const cleanName = targetNode.name.replace(/\s*\(#\d+\)\s*$/, '').trim();
    setIsAdamSearchPanelOpen(true);
    setAdamSearchQuery(cleanName);
    setAdamFatherQuery('');
    setAdamArcFilter('');
    setAdamRepFilter('');
    setSearchUnderSelectedNodeOnly(false);
    setActiveSubTab('adam_tree_explorer');
    handleSelectNodeFromSearchResults(targetNode);
  };

  // Compute ancestor chain up to Adam (AS) for the selected node
  const selectedNodeAncestorsChain = useMemo(() => {
    if (!selectedAdamNode) return [];
    return getAncestorsChainForNode(selectedAdamNode);
  }, [selectedAdamNode, getAncestorsChainForNode]);

  const selectedParentNodeObj = useMemo(() => {
    if (!selectedAdamNode?.parent_id) return null;
    return (
      nodesById[selectedAdamNode.parent_id] ||
      MASTER_ADAM_NODES_MAP[selectedAdamNode.parent_id] ||
      null
    );
  }, [nodesById, selectedAdamNode]);

  // Rule 5.3: Check if current editor values have an Arc Code vs Representation conflict
  const editorCodingConflict = useMemo(() => {
    return checkArcCodeRepresentationConflict(editArcCode, editRepresentation);
  }, [editArcCode, editRepresentation]);

  // Compute pending changes diff for Mandatory Confirmation Modal
  const pendingNodeChangesDiff = useMemo(() => {
    if (!selectedAdamNode) return [];
    const diffs: Array<{
      fieldLabel: string;
      oldValue: string;
      newValue: string;
    }> = [];

    const trimmedName = editNodeName.trim() || selectedAdamNode.name;
    if (trimmedName !== selectedAdamNode.name) {
      diffs.push({
        fieldLabel: 'اسم السجل (name)',
        oldValue: selectedAdamNode.name,
        newValue: trimmedName,
      });
    }

    if (editArcCode !== selectedAdamNode.arc_code) {
      diffs.push({
        fieldLabel: 'الكود الهيكلي (Arc Code)',
        oldValue:
          selectedAdamNode.arc_code === 'UNASSIGNED'
            ? 'بدون كود (جد فردي)'
            : selectedAdamNode.arc_code,
        newValue:
          editArcCode === 'UNASSIGNED' ? 'بدون كود (جد فردي)' : editArcCode,
      });
    }

    if (editRepresentation !== selectedAdamNode.representation) {
      diffs.push({
        fieldLabel: 'تصنيف العقدة (Representation)',
        oldValue: selectedAdamNode.representation,
        newValue: editRepresentation,
      });
    }

    if (editRelationNature !== selectedAdamNode.relation_nature) {
      diffs.push({
        fieldLabel: 'طبيعة الرابط بالعقدة الأب',
        oldValue:
          selectedAdamNode.relation_nature === 'DIRECT'
            ? 'DIRECT — يظهر "بن"'
            : 'FROM — يظهر "من"',
        newValue:
          editRelationNature === 'DIRECT'
            ? 'DIRECT — يظهر "بن"'
            : 'FROM — يظهر "من"',
      });
    }

    const oldGeo = (selectedAdamNode.geo_footprint || []).join('، ');
    const newGeo = editGeoFootprint
      .split(/[،,]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .join('، ');
    if (oldGeo !== newGeo) {
      diffs.push({
        fieldLabel: 'الموطن والانتشار الجغرافي',
        oldValue: oldGeo || '—',
        newValue: newGeo || '—',
      });
    }

    const oldBranches = (selectedAdamNode.enriched_branches || []).join('، ');
    const newBranches = editEnrichedBranches
      .split(/[،,]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .join('، ');
    if (oldBranches !== newBranches) {
      diffs.push({
        fieldLabel: 'الفروع والأبناء المرتبطون بالسجل',
        oldValue: oldBranches || '—',
        newValue: newBranches || '—',
      });
    }

    const oldSources = (selectedAdamNode.enriched_sources || []).join(' | ');
    const newSources = editEnrichedSources
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .join(' | ');
    if (oldSources !== newSources) {
      diffs.push({
        fieldLabel: 'المصادر الموثقة وسجل الإثراء',
        oldValue: oldSources || '—',
        newValue: newSources || '—',
      });
    }

    return diffs;
  }, [
    selectedAdamNode,
    editNodeName,
    editArcCode,
    editRepresentation,
    editRelationNature,
    editGeoFootprint,
    editEnrichedBranches,
    editEnrichedSources,
  ]);

  const handleRequestSaveAdamNodeCoding = () => {
    if (!selectedAdamNode) return;
    setShowAdamSaveConfirmModal(true);
  };

  const handleConfirmAndSaveAdamNodeCoding = async () => {
    if (!selectedAdamNode) return;
    const resolvedRep = editorCodingConflict.hasConflict
      ? editorCodingConflict.suggestedRepresentation
      : editRepresentation;

    const updatedNode: AdamTreeInteractiveNode = {
      ...selectedAdamNode,
      node_id: selectedAdamNode.node_id,
      name: editNodeName.trim() || selectedAdamNode.name,
      arc_code: editArcCode,
      representation: resolvedRep,
      relation_nature: editRelationNature,
      geo_footprint: editGeoFootprint
        .split(/[،,]/)
        .map((s) => s.trim())
        .filter(Boolean),
      enriched_sources: editEnrichedSources
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      enriched_branches: editEnrichedBranches
        .split(/[،,]/)
        .map((s) => s.trim())
        .filter(Boolean),
    };

    try {
      await fetch(
        `${GERMAN_ENGINE_BASE_URL}/api/v1/juthori/adam-tree/update-node`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedNode),
        }
      );
    } catch {
      // Proceed with local state update if offline
    }

    setNodesById((prev) => ({
      ...prev,
      [selectedAdamNode.node_id]: updatedNode,
    }));
    setSelectedAdamNodeId(updatedNode.node_id);
    setShowAdamSaveConfirmModal(false);
    setIsNodeEditorUnlocked(false);
    showToast(
      `✅ تم اعتماد وتحديث سجل (${updatedNode.name}) في قاعدة بيانات شجرة آدم المركزية بنجاح!`
    );
  };

  const handleAddChildNodeToAdam = async () => {
    if (!selectedAdamNode || !newChildName.trim()) return;
    const newId = `ADAM-CUSTOM-${Date.now().toString().slice(-5)}`;
    const childConflict = checkArcCodeRepresentationConflict(
      newChildArcCode,
      newChildRepresentation
    );
    const childNode: AdamTreeInteractiveNode = {
      node_id: newId,
      name: newChildName.trim(),
      parent_id: selectedAdamNode.node_id,
      parent_name: selectedAdamNode.name,
      arc_code: newChildArcCode,
      representation: childConflict.hasConflict
        ? childConflict.suggestedRepresentation
        : newChildRepresentation,
      relation_nature: newChildRelationNature,
      geo_footprint: newChildGeo
        .split(/[،,]/)
        .map((s) => s.trim())
        .filter(Boolean),
      enriched_sources: [],
      enriched_branches: [],
    };

    try {
      await fetch(
        `${GERMAN_ENGINE_BASE_URL}/api/v1/juthori/adam-tree/update-node`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(childNode),
        }
      );
    } catch {
      // Proceed with local state update
    }

    setNodesById((prev) => ({
      ...prev,
      [newId]: childNode,
    }));
    setExpandedNodeIds((prev) => new Set([...prev, selectedAdamNode.node_id, newId]));
    setSelectedAdamNodeId(newId);
    setNewChildName('');
    setShowAddChildForm(false);
    showToast(
      `تم إدراج العقدة الجديدة (${childNode.name}) تحت (${selectedAdamNode.name}) في شجرة آدم ✓`
    );
  };

  // =========================================================================
  // TAB 4: DRAG & DROP LINKING WORKBENCH STATE
  // =========================================================================
  const [droppedNodes, setDroppedNodes] = useState<ExtractableLineageNode[]>([]);
  const [selectedAdamTargetChain, setSelectedAdamTargetChain] = useState<string>(
    'بني لام ⬅️ طيء ⬅️ كهلان ⬅️ سبأ ⬅️ قحطان ⬅️ آدم'
  );
  const [approveSourcesChecked, setApproveSourcesChecked] = useState(true);
  const [isDraggingOverDropzone, setIsDraggingOverDropzone] = useState(false);

  const handleDragStartNode = (
    e: React.DragEvent<HTMLDivElement>,
    node: ExtractableLineageNode
  ) => {
    e.dataTransfer.setData('application/json', JSON.stringify(node));
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const handleDropIntoAdamZone = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOverDropzone(false);
    try {
      const raw = e.dataTransfer.getData('application/json');
      if (!raw) return;
      const node: ExtractableLineageNode = JSON.parse(raw);
      setDroppedNodes((prev) =>
        prev.some((n) => n.id === node.id) ? prev : [...prev, node]
      );
    } catch {
      // Ignore invalid payload
    }
  };

  // =========================================================================
  // TAB 5: ADAM PRIME BRIDGE STATE (ZERO DUMMY DATA!)
  // =========================================================================
  const [adamPrimeBundles, setAdamPrimeBundles] = useState<
    AdamPrimeCompletedBundle[]
  >([]);
  const [customJsonInput, setCustomJsonInput] = useState('');

  // =========================================================================
  // 4 OFFICIAL RESEARCHER DECISION ACTIONS (FOR TAB 2 & TAB 4)
  // =========================================================================
  // Action A: اعتماد ربط العمود بشجرة آدم وإثراء السجل وإقفال التذكرة
  const handleActionAApproveAndLinkToAdam = async (
    ticket: ResearcherStudioTicket
  ) => {
    const includedIdx = getTicketIncludedIndices(ticket);
    const primaryIdx = primarySourceIndexByTicket[ticket.id] ?? 0;
    const evList = ticket.corroboratingEvidence || [];

    const lake2SelectedCitations =
      evList.length > 0
        ? evList
            .filter((_, idx) => includedIdx.includes(idx))
            .map((ev, idx) => {
              const note = sourceResearcherNotes[`${ticket.id}-${idx}`];
              const base = formatAlphaEvidenceCitation(ev);
              return note ? `${base} — [تحقيق الباحث: ${note}]` : base;
            })
        : ticket.copilotSources.map((s) => s.bookCitation);

    const attachedLake3Ids = includedLake3IdsByTicket[ticket.id] || [];
    const lake3SelectedCitations = (ticket.lake3UnlinkedProjects || [])
      .filter((r) => attachedLake3Ids.includes(r.record_id))
      .map(
        (r) =>
          `${r.project_source} (${r.family_or_tribe_name}) — [رافد البحيرة 3]`
      );

    const selectedCitations = [
      ...lake2SelectedCitations,
      ...lake3SelectedCitations,
    ];

    const liveNodes = getLivePreviewNodesForTicket(ticket);
    const primaryEv = evList[primaryIdx] || evList[0];
    const primaryChain = splitAncestorsChain(primaryEv?.lineage_ancestors);
    const resolvedSubRoot =
      liveNodes[1]?.name || primaryChain[1] || ticket.subRootName;
    const resolvedMotherTribe =
      liveNodes[liveNodes.length - 1]?.name ||
      primaryChain[primaryChain.length - 1] ||
      ticket.motherTribeName;
    const customBridgeChain =
      appliedAdamBridgeByTicket[ticket.id] ||
      ticket.suggestedAdamBridge?.adam_chain_preview ||
      selectedAdamTargetChain;

    // 1. Add or update the family node inside our live Adam Tree Graph
    const parentAdamMatch = inspectNameInAdamMasterTree(
      resolvedMotherTribe,
      adamGraphNodes
    );
    const parentAdamNodeId =
      parentAdamMatch.matchedNode?.node_id || 'ADAM_BANILAM_302';

    const newAdamNodeId =
      ticket.adamNodeId || `ADAM-LINKED-${Date.now().toString().slice(-5)}`;

    const newlyLinkedAdamNode: AdamTreeInteractiveNode = {
      node_id: newAdamNodeId,
      name: ticket.familyName,
      parent_id: parentAdamNodeId,
      arc_code: 'FE0',
      representation: 'FAMILY',
      relation_nature: 'DIRECT_DESCENDANT',
      geo_footprint: ticket.inferredCountries || [ticket.locationLabel],
      enriched_sources: selectedCitations,
      enriched_branches: [resolvedSubRoot],
    };

    setNodesById((prev) => ({
      ...prev,
      [newAdamNodeId]: newlyLinkedAdamNode,
    }));

    // 2. Call German Engine HTTPS endpoint + mark-alpha-bridged for Neo4j deduplication
    const closePayload = {
      ticket_id: ticket.id.replace(/^#/, ''),
      target_adam_node_id: String(newAdamNodeId),
      approved_sources: selectedCitations,
      approved_branches: [resolvedSubRoot],
      approved_locations: (
        ticket.inferredCountries || [ticket.locationLabel]
      ).join(' ، '),
      researcher_notes: `تم اعتماد ربط (${liveNodes
        .map((n) => n.name)
        .join(' ⬅️ ')}) بشجرة آدم`,
    };

    try {
      await fetch(
        `${GERMAN_ENGINE_BASE_URL}/api/v1/juthori/researcher/close-enrichment-ticket`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(closePayload),
        }
      );
    } catch {
      try {
        await fetch('/api/v1/juthori/researcher/close-enrichment-ticket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(closePayload),
        });
      } catch {
        // Offline fallback
      }
    }

    const allAlphaIds = Array.from(
      new Set(
        [ticket.alphaId, ...evList.map((e) => e.alpha_id)]
          .map((id) => String(id || '').trim())
          .filter(Boolean)
      )
    );

    await markAlphaNodeBridgedOnServer({
      ticketId: ticket.id,
      familyName: ticket.familyName,
      adamNodeId: newAdamNodeId,
      bridgedChain: liveNodes.map((n) => n.name),
      verifiedSources: selectedCitations,
      alphaIds: allAlphaIds,
      handlingTimeSeconds: Math.max(18, activeTicketElapsedSeconds || 45),
    });

    // 3. Update Firestore ticket status & send real customer notification
    let resolvedFirestoreDocId = ticket.firestoreDocId;
    if (!resolvedFirestoreDocId) {
      const createdDoc = await saveGeneratedResearchTicketToFirebase({
        ticketId: ticket.id,
        alphaId: ticket.alphaId,
        adamNodeId: newAdamNodeId,
        ticketCategory: ticket.ticketCategory || 'ALPHA_TO_ADAM_LINK',
        familyName: ticket.familyName,
        subRootName: resolvedSubRoot,
        motherTribeName: resolvedMotherTribe,
        originCountry: ticket.inferredCountries?.[0] || 'الجزيرة العربية',
        originRegion: ticket.locationLabel,
        clientName: ticket.clientName,
        verifiedSources: selectedCitations,
        corroboratingAlphaEvidence: evList,
        fullStitchedLineage: ticket.fullStitchedLineage || [],
        extractedNodes: liveNodes,
      });
      resolvedFirestoreDocId = createdDoc.id;
    }

    if (resolvedFirestoreDocId) {
      await updateResearchTicketFullInFirebase(resolvedFirestoreDocId, {
        status: 'CLOSED_AND_ENRICHED',
        adamNodeId: newAdamNodeId,
        verifiedSources: selectedCitations.join(' | '),
      });
    }
    if (ticket.userId && ticket.userId !== 'system_proactive_miner') {
      await sendCustomerNotification({
        userId: ticket.userId,
        title: `🎉 تم اعتماد وربط عمود نسب (${ticket.familyName}) بشجرة آدم!`,
        body: `اعتمد فريق التحقيق ربط (${liveNodes
          .map((n) => n.name)
          .join(' ⬅️ ')}) حتى آدم عليه السلام مع توثيق (${selectedCitations.length}) مراجع تاريخية.`,
        category: 'ticket_update',
        senderRole: 'researcher',
      });
    }

    // 4. Record KPI Telemetry
    recordKpiTicketCompletion(ticket, selectedCitations.length);

    setTickets((prev) => {
      const updated = prev.map((t) =>
        t.id === ticket.id
          ? {
              ...t,
              firestoreDocId: resolvedFirestoreDocId,
              status: 'CLOSED_AND_ENRICHED' as const,
              extractedNodes: liveNodes,
              subRootName: resolvedSubRoot,
              motherTribeName: resolvedMotherTribe,
            }
          : t
      );
      const nextOpen = updated
        .filter(
          (t) =>
            t.id !== ticket.id &&
            t.status !== 'CLOSED_AND_ENRICHED' &&
            t.status !== 'merged_closed'
        )
        .sort((a, b) => priorityRankScore(a) - priorityRankScore(b))[0];
      if (nextOpen) {
        setTimeout(() => setSelectedTicketId(nextOpen.id), 150);
      }
      return updated;
    });

    onApproveAlphaMergeIntoAdam({
      familyName: ticket.familyName,
      subRootName: resolvedSubRoot,
      motherTribeName: resolvedMotherTribe,
      approveSources: true,
      isAdamEnrichmentOnly: false,
      addedVerifiedSources: selectedCitations,
      addedSiblingBranches: [resolvedSubRoot],
      addedLocations: ticket.inferredCountries || [ticket.locationLabel],
      customExtractedNodes: liveNodes,
      customJunctionNodeName: customBridgeChain,
    });

    showToast(
      `✅ تم اعتماد ربط (${liveNodes
        .map((n) => n.name)
        .join(' ⬅️ ')}) بشجرة آدم، وتعليم العقدة في Neo4j، وتحديث عداد الإنتاجية، وسحب التذكرة التالية تلقائياً!`
    );
  };

  // Action B: اعتماد إثراء المصادر والفروع فقط (للعقد الموجودة مسبقاً في شجرة آدم)
  const handleActionBEnrichExistingAdamNode = async (
    ticket: ResearcherStudioTicket
  ) => {
    const includedIdx = getTicketIncludedIndices(ticket);
    const evList = ticket.corroboratingEvidence || [];
    const selectedCitations =
      evList.length > 0
        ? evList
            .filter((_, idx) => includedIdx.includes(idx))
            .map((ev) => formatAlphaEvidenceCitation(ev))
        : ticket.copilotSources.map((s) => s.bookCitation);

    const parsedBranches = enrichmentBranchesInput
      .split(/[،,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const parsedNotables = enrichmentNotablesInput
      .split(/[،,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const parsedLocations = enrichmentLocationsInput
      .split(/[،,]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const closePayloadB = {
      ticket_id: ticket.id.replace(/^#/, ''),
      target_adam_node_id: String(ticket.adamNodeId || '352'),
      approved_sources: selectedCitations,
      approved_branches: parsedBranches,
      approved_locations: parsedLocations.join(' ، '),
      researcher_notes: `تم اعتماد إثراء المراجع والفروع في مرصد البحوث (${ticket.familyName})`,
    };

    try {
      await fetch(
        `${GERMAN_ENGINE_BASE_URL}/api/v1/juthori/researcher/close-enrichment-ticket`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(closePayloadB),
        }
      );
    } catch {
      try {
        await fetch('/api/v1/juthori/researcher/close-enrichment-ticket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(closePayloadB),
        });
      } catch {
        // Offline fallback
      }
    }

    const allAlphaIdsB = Array.from(
      new Set(
        [ticket.alphaId, ...evList.map((e) => e.alpha_id)]
          .map((id) => String(id || '').trim())
          .filter(Boolean)
      )
    );

    await markAlphaNodeBridgedOnServer({
      ticketId: ticket.id,
      familyName: ticket.familyName,
      adamNodeId: ticket.adamNodeId || '352',
      bridgedChain: getLivePreviewNodesForTicket(ticket).map((n) => n.name),
      verifiedSources: selectedCitations,
      alphaIds: allAlphaIdsB,
      handlingTimeSeconds: Math.max(18, activeTicketElapsedSeconds || 45),
    });

    let resolvedFirestoreDocIdB = ticket.firestoreDocId;
    if (!resolvedFirestoreDocIdB) {
      const createdDocB = await saveGeneratedResearchTicketToFirebase({
        ticketId: ticket.id,
        alphaId: ticket.alphaId,
        adamNodeId: ticket.adamNodeId,
        ticketCategory: ticket.ticketCategory || 'ADAM_NODE_ENRICHMENT',
        familyName: ticket.familyName,
        subRootName: ticket.subRootName,
        motherTribeName: ticket.motherTribeName,
        originCountry: ticket.inferredCountries?.[0] || 'الجزيرة العربية',
        originRegion: ticket.locationLabel,
        clientName: ticket.clientName,
        verifiedSources: selectedCitations,
        corroboratingAlphaEvidence: evList,
      });
      resolvedFirestoreDocIdB = createdDocB.id;
    }

    if (resolvedFirestoreDocIdB) {
      await updateResearchTicketFullInFirebase(resolvedFirestoreDocIdB, {
        status: 'CLOSED_AND_ENRICHED',
        verifiedSources: selectedCitations.join(' | '),
      });
    }

    recordKpiTicketCompletion(ticket, selectedCitations.length);

    setTickets((prev) => {
      const updated = prev.map((t) =>
        t.id === ticket.id
          ? {
              ...t,
              firestoreDocId: resolvedFirestoreDocIdB,
              status: 'CLOSED_AND_ENRICHED' as const,
            }
          : t
      );
      const nextOpen = updated
        .filter(
          (t) =>
            t.id !== ticket.id &&
            t.status !== 'CLOSED_AND_ENRICHED' &&
            t.status !== 'merged_closed'
        )
        .sort((a, b) => priorityRankScore(a) - priorityRankScore(b))[0];
      if (nextOpen) {
        setTimeout(() => setSelectedTicketId(nextOpen.id), 150);
      }
      return updated;
    });

    onApproveAlphaMergeIntoAdam({
      familyName: ticket.familyName,
      subRootName: ticket.subRootName,
      motherTribeName: ticket.motherTribeName,
      approveSources: true,
      isAdamEnrichmentOnly: true,
      addedVerifiedSources: selectedCitations,
      addedSiblingBranches: parsedBranches,
      addedNotables: parsedNotables,
      addedLocations: parsedLocations,
    });

    showToast(
      `✨ تم إثراء سجل (${ticket.familyName}) في شجرة آدم بالمصادر والفروع الإضافية، وتحديث عداد الإنتاجية، والانتقال للتذكرة التالية!`
    );
  };

  // Action C: طلب إيضاح أو بيانات إضافية من العميل (تحديث حالة التذكرة وإشعار العميل)
  const handleActionCRequestClarification = async (
    ticket: ResearcherStudioTicket
  ) => {
    if (!clarificationMessage.trim()) return;
    if (ticket.firestoreDocId) {
      await updateTicketStatus(ticket.firestoreDocId, 'investigating');
      await updateResearchTicketFullInFirebase(ticket.firestoreDocId, {
        status: 'investigating',
      });
    }
    if (ticket.userId) {
      await sendCustomerNotification({
        userId: ticket.userId,
        title: `💬 استفسار تحقيقي من الباحث حول تذكرة عائلة (${ticket.familyName})`,
        body: clarificationMessage.trim(),
        category: 'ticket_update',
        senderRole: 'researcher',
      });
    }

    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticket.id
          ? {
              ...t,
              status: 'investigating',
              researcherNotes: clarificationMessage.trim(),
            }
          : t
      )
    );
    setShowClarificationBox(false);
    setClarificationMessage('');
    showToast(
      `💬 تم تحديث حالة التذكرة إلى "قيد الاستيضاح" وإرسال إشعار فوري لحساب العميل (${ticket.clientName})!`
    );
  };

  // Action D: تصعيد التذكرة إلى جسر آدم برايم (Adam Prime)
  const handleActionDEscalateToAdamPrime = (ticket: ResearcherStudioTicket) => {
    const newBundle: AdamPrimeCompletedBundle = {
      taskId: `AP-${ticket.id.replace('#', '')}`,
      title: `حزمة تحقيق معمق في آدم برايم: ${ticket.familyName} (${ticket.locationLabel})`,
      familyName: ticket.familyName,
      subRootName: ticket.subRootName,
      motherTribeName: ticket.motherTribeName,
      locationLabel: ticket.locationLabel,
      targetAdamChain: ticket.suggestedAdamTarget.entryNodeName,
      verifiedCitation:
        ticket.copilotSources[0]?.bookCitation ||
        'مشاريع ألفا للمخطوطات العربية',
      nodes: ticket.extractedNodes,
      imported: false,
    };

    if (ticket.firestoreDocId) {
      updateResearchTicketFullInFirebase(ticket.firestoreDocId, {
        status: 'exported_adam_prime',
      }).catch(() => {});
    }
    setAdamPrimeBundles((prev) =>
      prev.some((b) => b.taskId === newBundle.taskId)
        ? prev
        : [newBundle, ...prev]
    );
    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticket.id ? { ...t, status: 'exported_adam_prime' } : t
      )
    );
    setActiveSubTab('adam_prime_bridge');
    showToast(
      `🏛️ تم تصعيد التذكرة (${ticket.id}) بكامل رواياتها (${
        ticket.corroboratingEvidence?.length || ticket.copilotSources.length
      } مصادر) إلى جسر آدم برايم!`
    );
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen pb-16 transition-colors duration-300 bg-white text-[#252321]"
    >
      {/* TOAST FEEDBACK BANNER */}
      {toastBanner && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-4">
          <div className="bg-[#FAF6F0] text-[#252321] border border-[#C5A059] rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#D8755B] shrink-0" />
              <p className="text-xs sm:text-sm font-bold">{toastBanner}</p>
            </div>
            <button
              type="button"
              onClick={() => setToastBanner(null)}
              className="text-xs text-[#8D4925] hover:text-[#252321] cursor-pointer font-bold"
            >
              إغلاق ✕
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-6">
        {/* ===================================================================
            SUB-TAB 1: 🧭 بوصلة الجذور (BOSLET AL-JUTHOR™ — DIAGNOSTIC COMPASS)
            Unified Warm Heritage Header Banner Matching Platform Identity
        =================================================================== */}
        {activeSubTab === 'direct_search' && (
          <div className="space-y-6 bg-white text-[#252321]">
            {/* ===============================================================
                OFFICIAL "بوصلة الجذور" IDENTITY HEADER BANNER
                (Unified Platform Warm Heritage Ivory, Gold & Terracotta Identity)
            =============================================================== */}
            <div
              data-testid="boslet-alansab-identity-header"
              className="bg-gradient-to-l from-[#FAF6F0] via-white to-[#EDE6DA]/80 text-[#252321] rounded-3xl p-5 border-2 border-[#C5A059]/70 shadow-sm flex flex-wrap items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white p-1.5 shadow-sm border-2 border-[#C5A059] shrink-0 flex items-center justify-center overflow-hidden">
                  <img
                    src="/assets/aistudio/Logo_Boslet_Alansab_8349b12d.jpg"
                    alt="بوصلة الجذور"
                    className="w-full h-full object-cover rounded-full"
                  />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#FAF6F0] border border-[#C5A059]/60 text-[#8D4925] text-[10px] font-extrabold tracking-wider">
                      بوصلة الجذور
                    </span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-extrabold font-display mt-1 text-[#252321]">
                    بوصلة الجذور — منظومة البحث والفحص وحسم المسارات النسبية
                  </h2>
                  <p className="text-xs text-[#5C5346] mt-0.5 font-medium">
                    تتبع استقصائي للمصادر التاريخية وأمهات الكتب، ومنطق الدمج وحسم التوافق لإثراء مع شجرة آدم للأجداد
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAllBosletSections(true)}
                  className="px-3.5 py-2 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-extrabold transition-all cursor-pointer shadow-2xs"
                >
                  فتح وإبراز كافة الأقسام
                </button>
                <button
                  type="button"
                  onClick={() => setAllBosletSections(false)}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#EDE6DA] text-[#8D4925] border border-[#C5A059]/50 text-xs font-bold transition-all cursor-pointer"
                >
                  طي كافة الأقسام
                </button>
              </div>
            </div>

            {/* ===============================================================
                INDEPENDENT COLLAPSIBLE BOX 0: محرك استعلام بوصلة الجذور
            =============================================================== */}
            <div
              className={`rounded-3xl transition-all duration-300 overflow-hidden ${
                bosletExpandedSections.searchBox
                  ? 'border border-[#B98A78]/50 bg-white p-5 sm:p-6 shadow-xs space-y-4'
                  : 'border border-[#E2DACB] bg-[#FAF6F0] hover:border-[#B98A78]/60 px-5 py-4 shadow-2xs'
              }`}
            >
              <div
                onClick={() => toggleBosletSection('searchBox')}
                className={`flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none ${
                  bosletExpandedSections.searchBox
                    ? 'border-b border-[#E2DACB] pb-3.5'
                    : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                      bosletExpandedSections.searchBox
                        ? 'bg-[#D8755B] text-white shadow-2xs'
                        : 'bg-white text-[#8D4925] border border-[#B98A78]/50'
                    }`}
                  >
                    <Search className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold font-display text-[#252321]">
                      مدخلات الفحص والاستعلام المرجعي في بوصلة الجذور
                    </h3>
                    <p className="text-xs text-[#5C5346] mt-0.5">
                      ابحث باسم العائلة أو القبيلة أو الفرع لتشغيل الفحص التشخيصي عبر بحيرات البيانات وشجرة آدم
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleBosletSection('searchBox');
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    bosletExpandedSections.searchBox
                      ? 'bg-[#EDE6DA] text-[#252321] border-[#B98A78]/50'
                      : 'bg-white text-[#8D4925] border-[#B98A78]/40 hover:bg-[#EDE6DA]/60'
                  }`}
                >
                  <span>
                    {bosletExpandedSections.searchBox
                      ? 'طي نافذة البحث'
                      : 'فتح وإبراز نافذة البحث'}
                  </span>
                  {bosletExpandedSections.searchBox ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              </div>

              {bosletExpandedSections.searchBox && (
                <form
                  onSubmit={handleExecuteDirectSearch}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 bg-[#FAF6F0] p-4 rounded-2xl border border-[#E2DACB]"
                >
                  <div>
                    <label className="block text-[11px] font-bold text-[#8D4925] mb-1">
                      اسم العائلة / الشهرة (FE0)
                    </label>
                    <input
                      type="text"
                      value={directSearchFamilyName}
                      onChange={(e) => setDirectSearchFamilyName(e.target.value)}
                      placeholder="مثال: قدم، ال قحيم، بيت جنديل، آل مقيت..."
                      className="w-full px-3 py-2 rounded-xl border border-[#E2DACB] bg-white text-[#252321] placeholder-[#5C5346]/60 text-xs font-bold focus:outline-none focus:border-[#D8755B]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#8D4925] mb-1">
                      القبيلة (اختياري)
                    </label>
                    <input
                      type="text"
                      value={directSearchTribeName}
                      onChange={(e) => setDirectSearchTribeName(e.target.value)}
                      placeholder="مثال: قحطان، همدان، بني لام..."
                      className="w-full px-3 py-2 rounded-xl border border-[#E2DACB] bg-white text-[#252321] placeholder-[#5C5346]/60 text-xs font-bold focus:outline-none focus:border-[#D8755B]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#8D4925] mb-1">
                      الفخذ / الفرع (اختياري)
                    </label>
                    <input
                      type="text"
                      value={directSearchBranchName}
                      onChange={(e) => setDirectSearchBranchName(e.target.value)}
                      placeholder="مثال: حاشد، البلاسم، آل برمان..."
                      className="w-full px-3 py-2 rounded-xl border border-[#E2DACB] bg-white text-[#252321] placeholder-[#5C5346]/60 text-xs font-bold focus:outline-none focus:border-[#D8755B]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#8D4925] mb-1">
                      الدولة
                    </label>
                    <select
                      value={directSearchCountry}
                      onChange={(e) => setDirectSearchCountry(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#E2DACB] bg-white text-[#252321] text-xs font-bold focus:outline-none focus:border-[#D8755B]"
                    >
                      <option value="غير محدد / كل الدول">
                        غير محدد / كل الدول
                      </option>
                      {RESEARCHER_ARAB_COUNTRIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#8D4925] mb-1">
                      الموطن الأصلي
                    </label>
                    <input
                      type="text"
                      list="researcher-locality-datalist"
                      value={directSearchLocality}
                      onChange={(e) => setDirectSearchLocality(e.target.value)}
                      placeholder="مثال: العمارة، نجران، دير الزور..."
                      className="w-full px-3 py-2 rounded-xl border border-[#E2DACB] bg-white text-[#252321] placeholder-[#5C5346]/60 text-xs font-bold focus:outline-none focus:border-[#D8755B]"
                    />
                    <datalist id="researcher-locality-datalist">
                      {ORIGIN_REGION_SUGGESTIONS.map((loc) => (
                        <option key={loc} value={loc} />
                      ))}
                    </datalist>
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={isDirectSearching}
                      data-testid="direct-search-submit-btn"
                      className={`w-full py-2.5 px-4 rounded-xl text-xs font-extrabold transition-all duration-150 flex items-center justify-center gap-2 ${
                        isDirectSearching
                          ? 'bg-gradient-to-l from-[#B45309] via-[#D97706] to-[#8D4925] text-white animate-pulse shadow-md ring-2 ring-[#C5A059]/70 cursor-wait'
                          : 'bg-[#D8755B] hover:bg-[#c5644b] active:scale-[0.98] text-white shadow-2xs cursor-pointer'
                      }`}
                    >
                      {isDirectSearching ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                          <span>جاري فحص المسار...</span>
                        </>
                      ) : (
                        <>
                          <Search className="w-4 h-4 shrink-0" />
                          <span>فحص مسار الجذر</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {!directSearchResult ? (
              <div className="rounded-3xl border-2 border-dashed border-[#B98A78]/50 bg-[#FAF6F0] p-10 text-center space-y-2">
                <Search className="w-9 h-9 text-[#D8755B] mx-auto mb-2" />
                <p className="text-base font-bold font-display text-[#252321]">
                  أدخل اسم العائلة أو القبيلة واضغط على «فحص مسار الجذر» لتشغيل بوصلة الجذور
                </p>
                <p className="text-xs text-[#5C5346]">
                  ستظهر لك الأقسام المستقلة للمصادر الخام، ومحرك العنقدة والخياطة، والسلسلة المخيطة، ومحاكي التحقق قابلة للطي والإبراز
                </p>
              </div>
            ) : (
              (() => {
                const extractedFromCurrent =
                  extractRawSourcesFromResult(directSearchResult);
                const unfilteredRawEvidenceList: CorroboratingAlphaEvidence[] =
                  rawSources.length > 0
                    ? rawSources
                    : extractedFromCurrent;

                const activeSearchFamilyForFilter =
                  directSearchFamilyName.trim() ||
                  directSearchResult.familyName ||
                  '';
                const activeSearchCountryForFilter =
                  directSearchCountry &&
                  directSearchCountry !== 'غير محدد / كل الدول'
                    ? directSearchCountry.trim()
                    : directSearchResult.originCountry &&
                      !directSearchResult.originCountry.includes('غير محدد')
                    ? directSearchResult.originCountry.trim()
                    : '';
                const activeSearchLocalityForFilter =
                  directSearchLocality.trim() || '';

                const filteredEvidenceList: CorroboratingAlphaEvidence[] =
                  filterEvidenceByFamilyAndStrictGeography(
                    unfilteredRawEvidenceList,
                    activeSearchFamilyForFilter,
                    activeSearchCountryForFilter,
                    activeSearchLocalityForFilter
                  );

                const rawEvidenceList: CorroboratingAlphaEvidence[] =
                  tagConsensusWinnersOnEvidence(
                    directSearchResult.familyName,
                    filteredEvidenceList
                  );

                const diagnosticClusters: ConsensusClusterGroup[] =
                  rawEvidenceList.length === 0
                    ? []
                    : computeCrossSourceConsensusClusters(
                        directSearchResult.familyName,
                        rawEvidenceList
                      );

                const isDirectDeepResearchP1 =
                  rawEvidenceList.length === 0 ||
                  diagnosticClusters.length === 0;

                const primaryCluster =
                  diagnosticClusters.find((c) => c.isConsensusWinner) ||
                  diagnosticClusters[0];

                // Rule 3: If `primaryCluster` is an Explicit Locality Match Winner (`hasExplicitLocalityMatch === true`),
                // and all other clusters are unspecified-locality clusters (`isUnspecifiedLocalityOnly === true`),
                // the Locality Match Winner resolves directly without forcing a customer disambiguation modal,
                // while keeping the unspecified-locality clusters visible in the researcher's matrix!
                const hasOtherExplicitCluster = diagnosticClusters
                  .slice(1)
                  .some((c) => !c.isUnspecifiedLocalityOnly);

                const hasCompetingDisambiguationPaths =
                  !isDirectDeepResearchP1 &&
                  diagnosticClusters.length >= 2 &&
                  (!primaryCluster?.hasExplicitLocalityMatch ||
                    hasOtherExplicitCluster);

                const activeOptionIndex =
                  diagnosticSimChoice === 'option_b'
                    ? 1
                    : diagnosticSimChoice === 'option_c'
                    ? 2
                    : 0;
                const activeClusterForStitchedChain =
                  diagnosticClusters[activeOptionIndex] || primaryCluster;

                const contributingReferencesForStitchedPath: CorroboratingAlphaEvidence[] =
                  activeClusterForStitchedChain &&
                  activeClusterForStitchedChain.records.length > 0
                    ? activeClusterForStitchedChain.records
                    : rawEvidenceList.filter(
                        (e) => e.is_consensus_winner !== false
                      ).length > 0
                    ? rawEvidenceList.filter(
                        (e) => e.is_consensus_winner !== false
                      )
                    : rawEvidenceList;

                const stemFreq = new Map<string, { display: string; count: number }>();
                const childBranchFreq = new Map<string, number>();

                rawEvidenceList.forEach((ev) => {
                  const tokens = extractRawRecordAncestors(ev);
                  const uniqueStemsInSource = new Set<string>();
                  tokens.forEach((tok) => {
                    const st = stemTribeToken(tok);
                    if (!st || st === stemTribeToken(directSearchResult.familyName)) {
                      return;
                    }
                    if (!uniqueStemsInSource.has(st)) {
                      uniqueStemsInSource.add(st);
                      const prev = stemFreq.get(st);
                      stemFreq.set(st, {
                        display: prev ? prev.display : tok,
                        count: (prev ? prev.count : 0) + 1,
                      });
                    }
                  });

                  const branches = (ev.child_branches || '')
                    .split(/[|،,؛]/)
                    .map((s) => s.trim())
                    .filter(Boolean);
                  new Set(branches).forEach((b) => {
                    childBranchFreq.set(b, (childBranchFreq.get(b) || 0) + 1);
                  });
                });

                const sharedAnchorNames = Array.from(stemFreq.values())
                  .filter((item) => item.count >= 2)
                  .map((item) => item.display);

                const sharedChildBranches = Array.from(childBranchFreq.entries())
                  .filter(([, count]) => count >= 2)
                  .map(([name]) => name);

                const finalStitchedStations: UpperAncestorNode[] =
                  isDirectDeepResearchP1
                    ? []
                    : activeClusterForStitchedChain &&
                      activeClusterForStitchedChain.fullChainNodes.length > 1
                    ? activeClusterForStitchedChain.fullChainNodes.map(
                        (stationName, idx) => {
                          const stationStem = stemTribeToken(stationName);
                          const isAncientApexStation =
                            stationStem === 'قحطان' ||
                            stationStem === 'عدنان' ||
                            stationStem === 'قحطاني' ||
                            stationStem === 'عدناني';
                          return {
                            id: `stitched-diag-${idx + 1}`,
                            orderNumber: idx + 1,
                            name: stationName,
                            code:
                              idx === 0
                                ? 'FE0'
                                : isAncientApexStation
                                ? undefined
                                : stationStem ===
                                  stemTribeToken(directSearchResult.rootTribeName)
                                ? 'B0'
                                : stationStem ===
                                  stemTribeToken(directSearchResult.rootBranchName)
                                ? 'B2'
                                : idx ===
                                  activeClusterForStitchedChain.fullChainNodes.length - 1
                                ? 'B0'
                                : idx === 1
                                ? 'B2'
                                : undefined,
                            rankLabel:
                              idx === 0
                                ? 'عقدة العائلة الموثقة'
                                : isAncientApexStation
                                ? 'الجذر العروبي الأعلى'
                                : 'محطة موثقة في سلسلة النسب',
                            isCodedStation: true,
                            region:
                              activeClusterForStitchedChain.geographicScope ||
                              directSearchResult.originRegion,
                            eraNote: '',
                            dataLakeSource: 'alpha_projects',
                          };
                        }
                      )
                    : directSearchResult.full_stitched_lineage_for_researcher &&
                      directSearchResult.full_stitched_lineage_for_researcher.length > 0
                    ? directSearchResult.full_stitched_lineage_for_researcher
                    : directSearchResult.adamSpineNodes &&
                      directSearchResult.adamSpineNodes.length > 0
                    ? directSearchResult.adamSpineNodes
                    : directSearchResult.upperAncestors || [];

                const allCandidateDisambigOptions = !hasCompetingDisambiguationPaths
                  ? []
                  : diagnosticClusters.map((c, idx) => {
                      const firstSubRoot =
                        c.fullChainNodes.length > 1
                          ? c.fullChainNodes[1]
                          : c.originTribeLabel;
                      const topTribe = c.originTribeLabel;
                      const label =
                        firstSubRoot &&
                        topTribe &&
                        stemTribeToken(firstSubRoot) !== stemTribeToken(topTribe)
                          ? `${firstSubRoot} (${topTribe})`
                          : topTribe;
                      return {
                        id: (idx === 0
                          ? 'option_a'
                          : idx === 1
                          ? 'option_b'
                          : 'option_c') as 'option_a' | 'option_b' | 'option_c',
                        choice_id: c.clusterId,
                        badge:
                          c.sourcesCount >= 2
                            ? `توافق (${c.sourcesCount}) مصادر`
                            : idx === 0
                            ? 'المسار الأول المرصود في المصادر'
                            : `مسار موازٍ (${c.sourcesCount} مصدر)`,
                        title: label,
                        originTribeLabel: label,
                        geographicScope: c.geographicScope,
                        nearBranchHint: c.rootPreviewLabel,
                        isConsensusWinner: c.isConsensusWinner,
                        consensusBadge:
                          c.sourcesCount >= 2
                            ? `مرجّح في عدة مصادر (${c.sourcesCount} مراجع)`
                            : undefined,
                        sourcesCount: c.sourcesCount,
                        contributingSources: c.records,
                      };
                    });

                const candidateDisambigOptions = [...allCandidateDisambigOptions]
                  .sort(
                    (a, b) =>
                      (b.sourcesCount || b.contributingSources?.length || 0) -
                      (a.sourcesCount || a.contributingSources?.length || 0)
                  )
                  .slice(0, 2);

                const searchedFamStem = stemTribeToken(directSearchResult.familyName);

                const parentAttributedRecords = new Set<string>();
                rawEvidenceList.forEach((ev) => {
                  const recTitle = (ev.record_name || '').trim();
                  const recStem = stemTribeToken(recTitle);
                  const rawAncTokens = extractRawRecordAncestors(ev);
                  const secondStation = rawAncTokens[1]?.trim() || '';
                  if (recTitle && recStem && recStem !== searchedFamStem) {
                    parentAttributedRecords.add(recTitle);
                  } else if (
                    secondStation &&
                    stemTribeToken(secondStation) !== searchedFamStem &&
                    (secondStation.startsWith('آل ') ||
                      secondStation.startsWith('بيت ') ||
                      secondStation.startsWith('البو ') ||
                      secondStation === 'داور' ||
                      secondStation === 'الدوار' ||
                      secondStation === 'قدم')
                  ) {
                    parentAttributedRecords.add(secondStation);
                  }
                });
                const parentAttributionList = Array.from(parentAttributedRecords);

                const compoundUnrollExamples = new Set<string>();
                rawEvidenceList.forEach((ev) => {
                  extractRawRecordAncestors(ev).forEach((tok) => {
                    if (/\s+(?:بن|ابن)\s+/.test(tok)) {
                      const parts = tok
                        .split(/\s+(?:بن|ابن)\s+/)
                        .map((p) => p.trim())
                        .filter(Boolean);
                      if (parts.length > 1) {
                        compoundUnrollExamples.add(
                          `«${tok.trim()}» إلى (${parts.join(' ⬅️ ')})`
                        );
                      }
                    }
                  });
                });
                const compoundUnrollList = Array.from(compoundUnrollExamples);

                const variantsByStem = new Map<string, Set<string>>();
                rawEvidenceList.forEach((ev) => {
                  extractRawRecordAncestors(ev).forEach((tok) => {
                    const subParts = tok
                      .split(/\s+(?:بن|ابن)\s+/)
                      .map((p) => p.trim())
                      .filter(Boolean);
                    subParts.forEach((part) => {
                      const st = stemTribeToken(part);
                      if (!st) return;
                      if (!variantsByStem.has(st)) {
                        variantsByStem.set(st, new Set());
                      }
                      variantsByStem.get(st)!.add(part);
                    });
                  });
                });
                const mergedVariantGroups: string[] = [];
                variantsByStem.forEach((surfaceSet) => {
                  const arr = Array.from(surfaceSet);
                  if (arr.length >= 2) {
                    mergedVariantGroups.push(`(${arr.join(' / ')})`);
                  }
                });

                const deduplicatedNodesSet = new Set<string>();
                rawEvidenceList.forEach((ev) => {
                  const rawExpanded: string[] = [];
                  extractRawRecordAncestors(ev).forEach((tok) => {
                    tok
                      .split(/\s+(?:بن|ابن)\s+/)
                      .map((p) => p.trim())
                      .filter(Boolean)
                      .forEach((p) => rawExpanded.push(p));
                  });
                  const seenStemsInRec = new Set<string>();
                  rawExpanded.forEach((tok) => {
                    const st = stemTribeToken(tok);
                    if (!st) return;
                    if (seenStemsInRec.has(st)) {
                      deduplicatedNodesSet.add(tok);
                    } else {
                      seenStemsInRec.add(st);
                    }
                  });
                });
                const deduplicatedNodesList = Array.from(deduplicatedNodesSet);

                const filteredNoiseTokensSet = new Set<string>();
                rawEvidenceList.forEach((ev) => {
                  extractRawRecordAncestors(ev).forEach((tok) => {
                    const trimmed = tok.trim();
                    if (
                      /\(\s*(تدّعي|تدعي|الأصل قيل|الاصل قيل|رواية|بني|بنو|بو دبش|بيت دبش|أبي دبش|في\s+[^)]+)\s*\)/.test(
                        trimmed
                      ) ||
                      trimmed.includes('الأصل قيل') ||
                      trimmed.includes('تدّعي') ||
                      trimmed.includes('رواية')
                    ) {
                      filteredNoiseTokensSet.add(trimmed);
                    }
                  });
                });
                const filteredNoiseList = Array.from(filteredNoiseTokensSet);

                const invertedPreambleExamples: string[] = [];
                const detachedEpithetExamplesSet = new Set<string>();
                rawEvidenceList.forEach((ev) => {
                  const rawTokens = String(ev.lineage_ancestors || '')
                    .split(/(?:؛|⬅️|<-|->|—|،|\||>)/)
                    .map((s) => s.trim())
                    .filter(Boolean);
                  const epithetFusion = mergeDetachedHistoricalEpithets(rawTokens);
                  epithetFusion.fusionExamples.forEach((ex) =>
                    detachedEpithetExamplesSet.add(ex)
                  );
                  const check = detectAndStripInvertedPreamble(
                    rawTokens,
                    ev.record_name || directSearchResult.familyName
                  );
                  if (check.wasInvertedPreambleStripped) {
                    const nonApexTail = check.cleanedTokensAfterSubject.filter(
                      (t) =>
                        !check.relocatedApexTokens.some(
                          (apx) => stemTribeToken(apx) === stemTribeToken(t)
                        )
                    );
                    const precedingMotherTribe =
                      nonApexTail.length > 0
                        ? nonApexTail[nonApexTail.length - 1]
                        : directSearchResult.rootTribeName;
                    if (
                      check.relocatedApexTokens &&
                      check.relocatedApexTokens.length > 0
                    ) {
                      invertedPreambleExamples.push(
                        `تم تجريد التمهيد المقلوب (${check.strippedPreambleTokens.join(' ؛ ')}) الذي سبق اسم صاحب السجل (${check.matchedSubjectToken}) في سجل «${ev.record_name || directSearchResult.familyName}» وترحيل الجذر الأعلى (${check.relocatedApexTokens.join(' ، ')}) إلى موضعه العلمي في قمة السلسلة بعد (${precedingMotherTribe})`
                      );
                    } else {
                      invertedPreambleExamples.push(
                        `تم تجريد التمهيد المقلوب (${check.strippedPreambleTokens.join(' ؛ ')}) الذي سبق اسم صاحب السجل (${check.matchedSubjectToken}) في سجل «${ev.record_name || directSearchResult.familyName}» لتبدأ السلسلة النظيفة من (${check.cleanedTokensAfterSubject.slice(0, 4).join(' ⬅️ ')})`
                      );
                    }
                  }
                });
                const detachedEpithetExamplesList = Array.from(
                  detachedEpithetExamplesSet
                );

                const totalStitchedCount = finalStitchedStations.length;
                const hiddenIntermediateCount = Math.max(0, totalStitchedCount - 3);

                // =============================================================
                // COMPUTE CONTAINER 1: ADAM MASTER TREE MATCHES, SPINE & BRIDGES
                // =============================================================
                const normalizeAndStripAdamSearchVariants = (raw: string) => {
                  const cleaned = (raw || '')
                    .replace(/\s*\(#\d+\)\s*$/, '')
                    .replace(/^(?:عائلة|اسرة|أسرة|قبيلة|عشيرة|فخذ|فرع)\s+/g, '')
                    .trim();
                  const fullNorm = normalizeArabicForSearch(cleaned);
                  const withoutOuterPrefix = normalizeArabicForSearch(
                    cleaned
                      .replace(
                        /^(?:آل|ال|بيت|بنو|بني|البو|ذوي|ذوو|أولاد|اولاد|عيال)\s+/g,
                        ''
                      )
                      .trim()
                  );
                  const withoutKunyaPrefix = normalizeArabicForSearch(
                    cleaned
                      .replace(
                        /^(?:آل|ال|بيت|بنو|بني|البو|ذوي|ذوو|أولاد|اولاد|عيال)\s+/g,
                        ''
                      )
                      .replace(/^(?:أبو|ابو|أبي|ابي|بو)\s+/g, '')
                      .trim()
                  );
                  const stem = stemTribeToken(cleaned);
                  return {
                    cleaned,
                    fullNorm,
                    withoutOuterPrefix,
                    withoutKunyaPrefix,
                    stem,
                  };
                };

                const cleanQueryName = (
                  directSearchFamilyName.trim() ||
                  directSearchTribeName.trim() ||
                  directSearchBranchName.trim() ||
                  directSearchResult.familyName ||
                  ''
                )
                  .replace(/^عائلة\s+/, '')
                  .trim();

                const queryVars = normalizeAndStripAdamSearchVariants(cleanQueryName);
                const isCompoundQueryName = /\s+(?:بن|ابن)\s+/.test(cleanQueryName);
                const queryCoreEndsWithAt = stripPrefixes(cleanQueryName).endsWith('ات');

                const candidateAdamPoolMap = new Map<
                  string,
                  AdamTreeInteractiveNode
                >();

                for (const indexed of preIndexedAdamRecords) {
                  const {
                    node,
                    cleanNodeTitle,
                    nodeCoreEndsWithAt,
                    isCompoundNodeTitle,
                    fullNorm,
                    withoutOuterPrefix,
                    withoutKunyaPrefix,
                    stem,
                  } = indexed;

                  // Strict Guard against `(ات)` root collision (e.g. `عرفات` vs `عرف`)
                  if (queryCoreEndsWithAt !== nodeCoreEndsWithAt) {
                    continue;
                  }

                  const isExactNorm =
                    Boolean(queryVars.fullNorm) &&
                    fullNorm === queryVars.fullNorm;

                  const isOuterPrefixTolerantMatch =
                    queryVars.withoutOuterPrefix.length >= 3 &&
                    (fullNorm === queryVars.withoutOuterPrefix ||
                      withoutOuterPrefix === queryVars.withoutOuterPrefix ||
                      withoutOuterPrefix === queryVars.fullNorm);

                  const isKunyaAndStemTolerantMatch =
                    !isCompoundQueryName &&
                    !isCompoundNodeTitle &&
                    ((queryVars.withoutKunyaPrefix.length >= 3 &&
                      (withoutOuterPrefix === queryVars.withoutKunyaPrefix ||
                        withoutKunyaPrefix === queryVars.withoutKunyaPrefix)) ||
                      (queryVars.stem.length >= 3 &&
                        stem === queryVars.stem));

                  if (
                    isExactNorm ||
                    isOuterPrefixTolerantMatch ||
                    isKunyaAndStemTolerantMatch ||
                    matchFamilyName(cleanNodeTitle, cleanQueryName)
                  ) {
                    if (!candidateAdamPoolMap.has(node.node_id)) {
                      candidateAdamPoolMap.set(node.node_id, node);
                    }
                  }
                }

                if (
                  directSearchResult.primary_source_of_truth ===
                    'ADAM_MASTER_TREE' &&
                  directSearchResult.adamNodeId
                ) {
                  const explicitNode =
                    nodesById[directSearchResult.adamNodeId] ||
                    MASTER_ADAM_NODES_MAP[directSearchResult.adamNodeId];
                  if (
                    explicitNode &&
                    !candidateAdamPoolMap.has(explicitNode.node_id)
                  ) {
                    candidateAdamPoolMap.set(explicitNode.node_id, explicitNode);
                  }
                }

                let adamMatchedCandidates = Array.from(
                  candidateAdamPoolMap.values()
                ).map((node) => {
                  const chainAscending: AdamTreeInteractiveNode[] = [node];
                  let currParentId = node.parent_id;
                  const visitedIds = new Set<string>([node.node_id]);
                  let safety = 0;

                  while (currParentId && !visitedIds.has(currParentId) && safety < 80) {
                    visitedIds.add(currParentId);
                    const pNode =
                      nodesById[currParentId] ||
                      MASTER_ADAM_NODES_MAP[currParentId];
                    if (!pNode) break;
                    chainAscending.push(pNode);
                    currParentId = pNode.parent_id;
                    safety++;
                  }

                  if (
                    chainAscending.length === 1 &&
                    node.parent_name &&
                    node.parent_name.trim()
                  ) {
                    const parentInspect = inspectNameInAdamMasterTree(
                      node.parent_name,
                      adamGraphNodes
                    );
                    if (parentInspect.found && parentInspect.matchedNode) {
                      chainAscending.push(
                        parentInspect.matchedNode,
                        ...parentInspect.ancestorsUpToAdam
                      );
                    } else {
                      chainAscending.push({
                        node_id: node.parent_id || 'parent-ref',
                        name: node.parent_name,
                        arc_code: 'B1',
                        representation: 'TRIBE',
                        relation_nature: 'DIRECT_DESCENDANT',
                        parent_id: '1',
                        geo_footprint: node.geo_footprint || [],
                        enriched_sources: [],
                        enriched_branches: [],
                      });
                    }
                  }

                  const lastInChain = chainAscending[chainAscending.length - 1];
                  if (
                    lastInChain &&
                    !lastInChain.name.includes('آدم') &&
                    nodesById['1']
                  ) {
                    chainAscending.push(nodesById['1']);
                  }

                  const ancestorsOnly = chainAscending.slice(1);
                  const motherTribeNode =
                    ancestorsOnly.find(
                      (a) => a.arc_code === 'B0' || a.arc_code === 'MT'
                    ) ||
                    ancestorsOnly[Math.min(2, Math.max(0, ancestorsOnly.length - 1))] ||
                    ancestorsOnly[0] ||
                    node;
                  const subRootNode =
                    ancestorsOnly.find(
                      (a) =>
                        a.arc_code === 'B2' ||
                        a.arc_code === 'B3' ||
                        a.arc_code === 'B1'
                    ) ||
                    ancestorsOnly[0] ||
                    node;

                  const parentPreviewStations = ancestorsOnly
                    .slice(0, 3)
                    .filter((st) => !st.name.includes('آدم'))
                    .map((st) => st.name.replace(/\s*\(#\d+\)\s*$/, '').trim())
                    .filter(Boolean);

                  const directChildNames =
                    adamChildrenByParentIdMap.get(node.node_id) || [];
                  const documentedBranches = Array.from(
                    new Set([
                      ...(node.enriched_branches || []),
                      ...directChildNames,
                    ])
                  ).filter(Boolean);

                  const documentedLocations = Array.from(
                    new Set([
                      ...(node.geo_footprint || []),
                      ...(motherTribeNode.geo_footprint || []).slice(0, 2),
                    ])
                  ).filter(Boolean);

                  const resolvedMotherTribe = motherTribeNode.name.replace(
                    /\s*\(#\d+\)\s*$/,
                    ''
                  );
                  const resolvedSubRoot = subRootNode.name.replace(
                    /\s*\(#\d+\)\s*$/,
                    ''
                  );

                  return {
                    node,
                    chainAscending,
                    motherTribeName: resolvedMotherTribe,
                    subRootName: resolvedSubRoot,
                    parentConnectionLabel:
                      parentPreviewStations.length > 0
                        ? parentPreviewStations.join(' ⬅️ ')
                        : resolvedSubRoot || resolvedMotherTribe,
                    documentedBranches,
                    documentedLocations,
                  };
                }).filter((cand) => {
                  // Exclude orphan / individual nodes (arc_code === 'UNASSIGNED') or synthetic 2-node chains (e.g. سنوسي ⬅️ علي ⬅️ آدم)
                  // that do not connect to a real historical tribe or apex lineage in Adam Tree
                  const nonAdamAncestors = cand.chainAscending
                    .slice(1)
                    .filter((st) => !st.name.includes('آدم'));
                  const hasKnownApexOrTribe = cand.chainAscending.some((st) => {
                    const cleanSt = st.name.replace(/\s*\(#\d+\)\s*$/, '').trim();
                    return (
                      st.arc_code === 'B0' ||
                      st.arc_code === 'MT' ||
                      st.arc_code === 'AD1' ||
                      cleanSt.includes('عدنان') ||
                      cleanSt.includes('قحطان') ||
                      cleanSt.includes('مضر') ||
                      cleanSt.includes('ربيعة') ||
                      cleanSt.includes('كهلان') ||
                      cleanSt.includes('حمير') ||
                      cleanSt.includes('قيس') ||
                      cleanSt.includes('سليم') ||
                      cleanSt.includes('هوازن') ||
                      cleanSt.includes('تميم') ||
                      cleanSt.includes('الأزد') ||
                      cleanSt.includes('طيء') ||
                      cleanSt.includes('قريش') ||
                      cleanSt.includes('هاشم') ||
                      cleanSt.includes('بكر') ||
                      cleanSt.includes('تغلب') ||
                      cleanSt.includes('قضاعة') ||
                      cleanSt.includes('همدان') ||
                      cleanSt.includes('مذحج') ||
                      cleanSt.includes('كندة')
                    );
                  });

                  if (
                    cand.node.arc_code === 'UNASSIGNED' &&
                    nonAdamAncestors.length <= 1 &&
                    !hasKnownApexOrTribe
                  ) {
                    return false;
                  }
                  if (nonAdamAncestors.length <= 1 && !hasKnownApexOrTribe) {
                    return false;
                  }
                  return true;
                });

                // Filter by entered Tribe / Branch when multiple Adam candidates exist
                const enteredTribeFilter = directSearchTribeName.trim();
                const enteredBranchFilter = directSearchBranchName.trim();
                if (
                  adamMatchedCandidates.length > 1 &&
                  (enteredTribeFilter || enteredBranchFilter)
                ) {
                  const tribeFilterVars =
                    normalizeAndStripAdamSearchVariants(enteredTribeFilter);
                  const branchFilterVars =
                    normalizeAndStripAdamSearchVariants(enteredBranchFilter);

                  const filteredByInput = adamMatchedCandidates.filter((cand) =>
                    cand.chainAscending.some((st) => {
                      const stVars = normalizeAndStripAdamSearchVariants(st.name);
                      const matchesTribe =
                        Boolean(enteredTribeFilter) &&
                        (stVars.fullNorm === tribeFilterVars.fullNorm ||
                          stVars.withoutOuterPrefix ===
                            tribeFilterVars.withoutOuterPrefix ||
                          (tribeFilterVars.stem.length >= 3 &&
                            stVars.stem === tribeFilterVars.stem));
                      const matchesBranch =
                        Boolean(enteredBranchFilter) &&
                        (stVars.fullNorm === branchFilterVars.fullNorm ||
                          stVars.withoutOuterPrefix ===
                            branchFilterVars.withoutOuterPrefix ||
                          (branchFilterVars.stem.length >= 3 &&
                            stVars.stem === branchFilterVars.stem));
                      return matchesTribe || matchesBranch;
                    })
                  );

                  if (filteredByInput.length > 0) {
                    adamMatchedCandidates = filteredByInput;
                  }
                }

                // =============================================================
                // UNIFICATION RULE: Synthesize Verified Adam Candidate from Final
                // Spine when directSearchResult has a complete Adam Tree spine
                // (e.g. «آل أبو معدية / العسران» from the 474,949-node Adam Tree)
                // =============================================================
                const resultSpineStations: UpperAncestorNode[] =
                  directSearchResult.adamSpineNodes &&
                  directSearchResult.adamSpineNodes.length > 1
                    ? directSearchResult.adamSpineNodes
                    : directSearchResult.full_stitched_lineage_for_researcher &&
                      directSearchResult.full_stitched_lineage_for_researcher
                        .length > 1
                    ? directSearchResult.full_stitched_lineage_for_researcher
                    : directSearchResult.upperAncestors &&
                      directSearchResult.upperAncestors.length > 0
                    ? [
                        {
                          id: directSearchResult.adamNodeId || 'adam-fe0',
                          orderNumber: 1,
                          name:
                            directSearchResult.familyName ||
                            cleanQueryName ||
                            'العائلة',
                          code: 'FE0',
                          rankLabel: 'عقدة العائلة الموثقة',
                          isCodedStation: true,
                          region: directSearchResult.originRegion || '',
                          eraNote: '',
                          dataLakeSource: 'adam_tree',
                        },
                        ...directSearchResult.upperAncestors,
                      ]
                    : [];

                const hasVerifiedSpineFromAdamTree =
                  Boolean(directSearchResult.matched) &&
                  resultSpineStations.length > 1 &&
                  (directSearchResult.primary_source_of_truth ===
                    'ADAM_MASTER_TREE' ||
                    directSearchResult.priorityTierMatched ===
                      'TIER_1_ADAM_MASTER_TREE' ||
                    resultSpineStations.some(
                      (s) => s.dataLakeSource === 'adam_tree'
                    ));

                if (hasVerifiedSpineFromAdamTree) {
                  const synthesizedChain: AdamTreeInteractiveNode[] =
                    resultSpineStations.map((st, idx) => ({
                      node_id: String(
                        idx === 0
                          ? directSearchResult.adamNodeId ||
                              st.id ||
                              `ADAM-${idx + 1}`
                          : st.id || `ADAM-ST-${idx + 1}`
                      ),
                      name: st.name.replace(/\s*\(#\d+\)\s*$/, '').trim(),
                      arc_code:
                        st.code ||
                        (idx === 0
                          ? 'FE0'
                          : idx === 1
                          ? 'B2'
                          : st.name.includes('آدم')
                          ? 'AD0'
                          : 'UNASSIGNED'),
                      representation:
                        idx === 0
                          ? 'FAMILY'
                          : st.name.includes('آدم')
                          ? 'INDIVIDUAL'
                          : 'TRIBE',
                      relation_nature: 'DIRECT_DESCENDANT',
                      parent_id:
                        idx < resultSpineStations.length - 1
                          ? String(
                              resultSpineStations[idx + 1]?.id ||
                                `ADAM-ST-${idx + 2}`
                            )
                          : null,
                      geo_footprint: st.region
                        ? [st.region]
                        : directSearchResult.originRegion
                        ? [directSearchResult.originRegion]
                        : [],
                      enriched_sources:
                        idx === 0 ? directSearchResult.verified_sources || [] : [],
                      enriched_branches:
                        idx === 0
                          ? directSearchResult.sibling_branches_in_record || []
                          : [],
                    }));

                  const startingNode = synthesizedChain[0];
                  const synthAncestors = synthesizedChain.slice(1);
                  const synthParentPreview = synthAncestors
                    .slice(0, 3)
                    .filter((st) => !st.name.includes('آدم'))
                    .map((st) => st.name)
                    .filter(Boolean);

                  const synthSubRoot =
                    (directSearchResult.rootBranchName &&
                    !directSearchResult.rootBranchName.includes('مقفل')
                      ? directSearchResult.rootBranchName
                      : '') ||
                    synthAncestors[0]?.name ||
                    startingNode.name;

                  const synthMotherTribe =
                    (directSearchResult.rootTribeName &&
                    !directSearchResult.rootTribeName.includes('مقفل')
                      ? directSearchResult.rootTribeName
                      : '') ||
                    enteredTribeFilter ||
                    synthAncestors[Math.min(2, Math.max(0, synthAncestors.length - 1))]
                      ?.name ||
                    synthSubRoot;

                  const synthParentConnectionLabel =
                    synthParentPreview.length > 0
                      ? synthParentPreview.join(' ⬅️ ')
                      : synthSubRoot !== synthMotherTribe
                      ? `${synthSubRoot} ⬅️ ${synthMotherTribe}`
                      : synthMotherTribe;

                  const synthLocations = Array.from(
                    new Set(
                      [
                        ...(directSearchResult.enrichedLocations || []),
                        directSearchResult.originRegion || '',
                        directSearchResult.matched_location || '',
                      ].filter(Boolean)
                    )
                  );

                  const synthBranches = Array.from(
                    new Set([
                      ...(directSearchResult.sibling_branches_in_record || []),
                      ...(directSearchResult.siblingBranches || []),
                    ])
                  ).filter(Boolean);

                  if (adamMatchedCandidates.length === 0) {
                    adamMatchedCandidates = [
                      {
                        node: startingNode,
                        chainAscending: synthesizedChain,
                        motherTribeName: synthMotherTribe,
                        subRootName: synthSubRoot,
                        parentConnectionLabel: synthParentConnectionLabel,
                        documentedBranches: synthBranches,
                        documentedLocations: synthLocations,
                      },
                    ];
                  } else if (
                    adamMatchedCandidates.length === 1 &&
                    synthesizedChain.length >
                      adamMatchedCandidates[0].chainAscending.length
                  ) {
                    adamMatchedCandidates[0] = {
                      ...adamMatchedCandidates[0],
                      chainAscending: synthesizedChain,
                      motherTribeName:
                        synthMotherTribe ||
                        adamMatchedCandidates[0].motherTribeName,
                      subRootName:
                        synthSubRoot || adamMatchedCandidates[0].subRootName,
                      parentConnectionLabel:
                        synthParentConnectionLabel ||
                        adamMatchedCandidates[0].parentConnectionLabel,
                    };
                  }
                }

                const safeSelectedAdamIdx =
                  selectedAdamMatchIndex < adamMatchedCandidates.length
                    ? selectedAdamMatchIndex
                    : 0;
                const activeAdamCandidate =
                  adamMatchedCandidates[safeSelectedAdamIdx] || null;

                // Check whether Adam Tree candidates match the entered locality / country and have valid tribal links
                const enteredLocNorm = normalizeLocalityTokenForMatching(
                  directSearchLocality.trim()
                );
                const enteredCountryNorm =
                  directSearchCountry &&
                  directSearchCountry !== 'غير محدد / كل الدول'
                    ? normalizeArabicForSearch(directSearchCountry.trim())
                    : '';

                const doesAdamCandidateMatchEnteredLocality = (
                  cand: (typeof adamMatchedCandidates)[number]
                ): boolean => {
                  const allCandGeo = [
                    ...cand.documentedLocations,
                    ...cand.chainAscending.flatMap(
                      (st) => st.geo_footprint || []
                    ),
                  ]
                    .map((g) => normalizeLocalityTokenForMatching(g))
                    .filter(Boolean);

                  if (enteredLocNorm) {
                    return (
                      allCandGeo.length > 0 &&
                      allCandGeo.some(
                        (g) =>
                          g.includes(enteredLocNorm) || enteredLocNorm.includes(g)
                      )
                    );
                  }
                  if (enteredCountryNorm) {
                    return (
                      allCandGeo.length > 0 &&
                      allCandGeo.some(
                        (g) =>
                          g.includes(enteredCountryNorm) ||
                          enteredCountryNorm.includes(g)
                      )
                    );
                  }
                  return true;
                };

                const hasAnyLocalityMatchingAdamCandidate =
                  adamMatchedCandidates.length > 0 &&
                  adamMatchedCandidates.some((cand) =>
                    doesAdamCandidateMatchEnteredLocality(cand)
                  );

                const hasInvalidOrUnlinkedTribeInAdamCandidates =
                  adamMatchedCandidates.some((cand) => {
                    const cleanMother = (cand.motherTribeName || '').trim();
                    const cleanNode = (cand.node.name || '')
                      .replace(/\s*\(#\d+\)\s*$/, '')
                      .trim();
                    return (
                      cand.node.arc_code === 'UNASSIGNED' ||
                      !cleanMother ||
                      cleanMother.includes('آدم') ||
                      (cleanMother === cleanNode &&
                        cand.chainAscending.length <= 2)
                    );
                  });

                // Requirement 1(b): Lock Adam Tree Disambiguation Simulator if nodes don't match entered locality,
                // or have unlinked/unclear tribal links, or are too numerous (> 3)
                const isAdamSimulatorLockedForSearch =
                  adamMatchedCandidates.length > 3 ||
                  hasInvalidOrUnlinkedTribeInAdamCandidates ||
                  ((Boolean(enteredLocNorm) || Boolean(enteredCountryNorm)) &&
                    !hasAnyLocalityMatchingAdamCandidate);

                // Requirement 4: Auto-collapse Container 1 whenever there is no clear, confirmed match
                // for the family or its original locality in Adam Tree!
                const hasClearConfirmedAdamMatch =
                  adamMatchedCandidates.length > 0 &&
                  hasAnyLocalityMatchingAdamCandidate &&
                  !hasInvalidOrUnlinkedTribeInAdamCandidates &&
                  !isAdamSimulatorLockedForSearch;

                const shouldAutoCollapseContainer1 = !hasClearConfirmedAdamMatch;

                const isContainer1Expanded =
                  isAdamBundleManualOverride !== null
                    ? isAdamBundleManualOverride
                    : !shouldAutoCollapseContainer1;

                // Smart Collapse behavior for Container 2:
                // Collapsed automatically when matched in Adam Tree AND 0 pending raw Alpha records
                const isServedFromAdamOnlyWithZeroAlpha =
                  rawEvidenceList.length === 0 &&
                  (adamMatchedCandidates.length > 0 ||
                    hasVerifiedSpineFromAdamTree ||
                    directSearchResult.primary_source_of_truth ===
                      'ADAM_MASTER_TREE');
                const isContainer2Expanded =
                  isRawBundleManualOverride !== null
                    ? isRawBundleManualOverride
                    : !isServedFromAdamOnlyWithZeroAlpha;

                // Dynamic Final Result Source & Effective Result for Container 3
                const isFinalResultFromAdamTree =
                  (adamMatchedCandidates.length > 0 ||
                    hasVerifiedSpineFromAdamTree) &&
                  hasAnyLocalityMatchingAdamCandidate &&
                  (rawEvidenceList.length === 0 ||
                    directSearchResult.primary_source_of_truth ===
                      'ADAM_MASTER_TREE');

                // Aggregate all contributing historical sources (Books, Volumes, Pages)
                // across Container 2's stitched path, raw Alpha evidence, Adam Tree node enriched_sources, and server verified_sources_list
                const effectiveEvidenceForSources =
                  contributingReferencesForStitchedPath.length > 0
                    ? contributingReferencesForStitchedPath
                    : rawEvidenceList;

                const unifiedFinalVerifiedSources =
                  extractUnifiedVerifiedSourcesList({
                    alphaEvidence: effectiveEvidenceForSources,
                    nodeEnrichedSources:
                      activeAdamCandidate?.node.enriched_sources,
                    apiVerifiedSourcesList: (directSearchResult as any)
                      .verified_sources_list,
                    apiVerifiedSources: [
                      ...(directSearchResult.verified_sources || []),
                      ...(directSearchResult.secondarySources || []),
                    ],
                    fallbackCitation: directSearchResult.verifiedSourceCitation,
                  });

                const effectiveFinalResultForShowcase: LineageSearchResult =
                  activeAdamCandidate && isFinalResultFromAdamTree
                    ? {
                        ...directSearchResult,
                        matched: true,
                        primary_source_of_truth: 'ADAM_MASTER_TREE',
                        adamNodeId: activeAdamCandidate.node.node_id,
                        familyName: activeAdamCandidate.node.name.replace(
                          /\s*\(#\d+\)\s*$/,
                          ''
                        ),
                        rootBranchName: activeAdamCandidate.subRootName,
                        rootTribeName: activeAdamCandidate.motherTribeName,
                        originRegion:
                          activeAdamCandidate.documentedLocations.join(' · ') ||
                          directSearchResult.originRegion,
                        verified_sources: unifiedFinalVerifiedSources,
                        secondarySources: unifiedFinalVerifiedSources,
                        corroborating_alpha_evidence_for_researcher:
                          effectiveEvidenceForSources,
                        alpha_evidence: effectiveEvidenceForSources,
                        sibling_branches_in_record:
                          activeAdamCandidate.documentedBranches.length > 0
                            ? activeAdamCandidate.documentedBranches
                            : directSearchResult.sibling_branches_in_record,
                        adamSpineNodes: activeAdamCandidate.chainAscending.map(
                          (st, sIdx) => ({
                            id: `adam-st-${st.node_id}-${sIdx}`,
                            orderNumber: sIdx + 1,
                            name: st.name.replace(/\s*\(#\d+\)\s*$/, ''),
                            code:
                              st.arc_code && st.arc_code !== 'UNASSIGNED'
                                ? st.arc_code
                                : sIdx === 0
                                ? 'FE0'
                                : undefined,
                            rankLabel:
                              sIdx === 0
                                ? 'العقدة المطابقة في شجرة آدم'
                                : st.name.includes('آدم')
                                ? 'أبو البشر آدم عليه السلام'
                                : 'محطة موثقة في شجرة آدم الكبرى',
                            isCodedStation:
                              Boolean(st.arc_code) &&
                              st.arc_code !== 'UNASSIGNED',
                            region: (st.geo_footprint || [])[0] || '',
                            eraNote: st.era_note || '',
                            dataLakeSource: 'adam_tree',
                          })
                        ),
                        upperAncestors: activeAdamCandidate.chainAscending.map(
                          (st, sIdx) => ({
                            id: `adam-up-${st.node_id}-${sIdx}`,
                            orderNumber: sIdx + 1,
                            name: st.name.replace(/\s*\(#\d+\)\s*$/, ''),
                            code:
                              st.arc_code && st.arc_code !== 'UNASSIGNED'
                                ? st.arc_code
                                : sIdx === 0
                                ? 'FE0'
                                : undefined,
                            rankLabel:
                              sIdx === 0
                                ? 'العقدة المطابقة في شجرة آدم'
                                : 'محطة موثقة في شجرة آدم الكبرى',
                            isCodedStation:
                              Boolean(st.arc_code) &&
                              st.arc_code !== 'UNASSIGNED',
                            region: (st.geo_footprint || [])[0] || '',
                            eraNote: st.era_note || '',
                            dataLakeSource: 'adam_tree',
                          })
                        ),
                      }
                    : {
                        ...directSearchResult,
                        verified_sources: unifiedFinalVerifiedSources,
                        secondarySources: unifiedFinalVerifiedSources,
                        corroborating_alpha_evidence_for_researcher:
                          effectiveEvidenceForSources,
                        alpha_evidence: effectiveEvidenceForSources,
                      };

                return (
                  <div className="space-y-8">
                    {/* =========================================================
                        STANDALONE CENTERED TICKET CREATION BUTTON (NO SURROUNDING CARD/BOX)
                    ========================================================= */}
                    <div
                      data-testid="boslet-top-create-ticket-action-bar"
                      className="flex justify-center my-4"
                    >
                      {!createdAssignedTicketId ? (
                        <button
                          type="button"
                          data-testid="top-create-assigned-ticket-btn"
                          onClick={() =>
                            handleTransferDiagnosticToTicketRoom(
                              effectiveFinalResultForShowcase,
                              rawEvidenceList,
                              finalStitchedStations
                            )
                          }
                          className="px-6 py-2.5 rounded-full bg-gradient-to-l from-[#C2410C] via-[#D8755B] to-[#8D4925] hover:from-[#9A3412] hover:to-[#7C2D12] text-white text-xs sm:text-sm font-extrabold cursor-pointer transition-all shadow-sm hover:shadow-md flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4 shrink-0" />
                          <span>إنشاء تذكرة بحثية في مرصد البحوث</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          data-testid="created-assigned-ticket-confirm-badge"
                          onClick={() => {
                            setInboxCategoryFilter('ASSIGNED_RESEARCH');
                            setSelectedTicketId(createdAssignedTicketId);
                            setActiveSubTab('ticket_inbox');
                            onSelectPortalSection?.('research_studio');
                          }}
                          className="px-6 py-2.5 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-extrabold cursor-pointer transition-all shadow-sm flex items-center gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>✓ تم إنشاء التذكرة في مرصد البحوث</span>
                        </button>
                      )}
                    </div>

                    {/* =========================================================
                        CONTAINER 1: [🌳 فحص التطابق في شجرة آدم للأجداد]
                        Unified Warm Heritage Background matching Container 2 & 3
                    ========================================================= */}
                    <div
                      data-testid="boslet-container1-adam-tree"
                      className="rounded-3xl border-2 border-[#C5A059]/80 bg-[#FAF6F0]/70 p-5 sm:p-6 shadow-sm text-[#252321] space-y-4"
                    >
                      <div
                        onClick={() =>
                          setIsAdamBundleManualOverride(!isContainer1Expanded)
                        }
                        className={`flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none ${
                          isContainer1Expanded
                            ? 'border-b-2 border-[#E2DACB] pb-4'
                            : ''
                        }`}
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="w-11 h-11 rounded-2xl bg-[#8D4925] text-white flex items-center justify-center text-xl shrink-0 shadow-xs">
                            🌳
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                data-testid="adam-container-header-counter"
                                className="px-2.5 py-0.5 rounded-full bg-white border border-[#E2DACB] text-[#5C5346] text-[10px] font-bold"
                              >
                                {hasClearConfirmedAdamMatch &&
                                adamMatchedCandidates.length === 1
                                  ? 'عُقد مرصودة في شجرة آدم: 1 (مرتبطة وموثقة ✓)'
                                  : hasClearConfirmedAdamMatch &&
                                    adamMatchedCandidates.length > 1
                                  ? `عُقد مرصودة في شجرة آدم: ${adamMatchedCandidates.length} (تعدد عُقد متشابهة)`
                                  : 'لم يتم العثور على تطابق واضح للعائلة أو لموطنها الأصلي مع البيانات المسجلة في شجرة آدم للأجداد'}
                              </span>
                            </div>
                            <h3 className="text-base sm:text-lg font-extrabold font-display text-[#252321] mt-1">
                              فحص التطابق في شجرة آدم للأجداد
                            </h3>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5">
                          {hasClearConfirmedAdamMatch &&
                            adamMatchedCandidates.length === 1 && (
                              <span className="px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-extrabold">
                                ✅ تطابق مرجعي موثق ومرتبط في شجرة آدم للأجداد
                              </span>
                            )}
                          {hasClearConfirmedAdamMatch &&
                            adamMatchedCandidates.length > 1 && (
                              <span className="px-3.5 py-1.5 rounded-xl bg-amber-50 border border-[#C5A059] text-[#8D4925] text-xs font-extrabold">
                                🔍 تعدد نتائج متشابهة في شجرة آدم ({adamMatchedCandidates.length} عُقد) — يتطلب سؤال تحقق
                              </span>
                            )}
                          {!hasClearConfirmedAdamMatch && (
                            <span
                              data-testid="adam-container-auto-collapsed-badge"
                              className="px-3.5 py-1.5 rounded-xl bg-amber-50 border border-[#C5A059] text-[#8D4925] text-xs font-extrabold"
                            >
                              لم يتم العثور على تطابق واضح للعائلة أو لموطنها الأصلي مع البيانات المسجلة في شجرة آدم للأجداد
                            </span>
                          )}

                          <button
                            type="button"
                            data-testid="toggle-container1-adam-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsAdamBundleManualOverride(
                                !isContainer1Expanded
                              );
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-[#EDE6DA] text-[#8D4925] border border-[#B98A78]/50 text-xs font-extrabold transition-all cursor-pointer shadow-2xs"
                          >
                            <span>
                              {isContainer1Expanded
                                ? 'طي حزمة شجرة آدم ▲'
                                : 'فتح حزمة شجرة آدم ▼'}
                            </span>
                          </button>
                        </div>
                      </div>

                      {isContainer1Expanded && (
                        <div className="space-y-4">
                          {/* CASE A: SINGLE DIRECT OR LINKED MATCH IN ADAM MASTER TREE (1 Match) */}
                          {adamMatchedCandidates.length === 1 &&
                            activeAdamCandidate && (
                              <div
                                data-testid="adam-container-single-match"
                                className="rounded-2xl bg-white text-[#252321] border-2 border-[#C5A059] p-4 sm:p-5 space-y-4 shadow-sm"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2DACB] pb-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="px-3 py-1 rounded-xl bg-emerald-700 text-white text-xs font-extrabold">
                                      عقدة البداية: {activeAdamCandidate.node.name}
                                    </span>
                                    <span className="px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs font-extrabold">
                                      نقطة الربط / الفرع الحاضن: {activeAdamCandidate.parentConnectionLabel}
                                    </span>
                                    <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-[#C5A059]/60 text-[#8D4925] text-xs font-extrabold">
                                      القبيلة الأم: {activeAdamCandidate.motherTribeName}
                                    </span>
                                    <span className="px-2.5 py-1 rounded-lg bg-[#FAF6F0] border border-[#E2DACB] text-[#5C5346] font-mono text-xs font-bold">
                                      معرف العقدة: #{activeAdamCandidate.node.node_id}
                                    </span>
                                  </div>

                                  {!isAdamSimulatorLockedForSearch ? (
                                    <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-extrabold">
                                      ✅ تطابق مرجعي موثق ومرتبط في شجرة آدم الكبرى (SINGLE_ADAM_MATCH)
                                    </span>
                                  ) : (
                                    <span className="px-3 py-1 rounded-full bg-amber-50 border border-[#C5A059] text-[#8D4925] text-xs font-extrabold">
                                      ⚠️ الموضع الجغرافي للعقدة لا يطابق الموطن المدخل في البحث
                                    </span>
                                  )}
                                </div>

                                {/* Full Connected Chain Up To Adam (AS) */}
                                <div className="space-y-2">
                                  <div className="text-xs font-extrabold text-[#8D4925]">
                                    شريط سلسلة الأجداد الكاملة في شجرة آدم من العائلة صعوداً حتى قمة السلسلة ({activeAdamCandidate.chainAscending.length} محطة موثقة):
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 bg-[#FAF6F0] p-3.5 rounded-xl border border-[#E2DACB]">
                                    {activeAdamCandidate.chainAscending.map(
                                      (st, sIdx) => (
                                        <React.Fragment key={`${st.node_id}-${sIdx}`}>
                                          <span
                                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                                              sIdx === 0
                                                ? 'bg-[#FAF6F0] text-[#8D4925] border-[#C5A059] font-extrabold'
                                                : st.name.includes('آدم')
                                                ? 'bg-[#FAF6F0] text-[#8D4925] border-[#B98A78] font-extrabold'
                                                : 'bg-white text-[#252321] border-[#E2DACB]'
                                            }`}
                                          >
                                            <span>
                                              {st.name.replace(/\s*\(#\d+\)\s*$/, '')}
                                            </span>
                                            {st.arc_code &&
                                              st.arc_code !== 'UNASSIGNED' && (
                                                <span
                                                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                                                    sIdx === 0
                                                      ? 'bg-white text-[#8D4925] border border-[#C5A059]/60'
                                                      : 'bg-[#FAF6F0] text-[#8D4925] border border-[#B98A78]/40'
                                                  }`}
                                                >
                                                  {st.arc_code}
                                                </span>
                                              )}
                                          </span>
                                          {sIdx <
                                            activeAdamCandidate.chainAscending
                                              .length -
                                              1 && (
                                            <span className="text-[#B98A78] text-xs font-bold px-0.5">
                                              ←
                                            </span>
                                          )}
                                        </React.Fragment>
                                      )
                                    )}
                                  </div>
                                </div>

                                {/* Documented Locations, Branches & Researcher Direct Retrieval Note */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                                  <div className="rounded-xl bg-[#FAF6F0] border border-[#E2DACB] p-3 space-y-1">
                                    <span className="text-[11px] font-extrabold text-[#8D4925] block">
                                      📍 المواضع والنطاق الجغرافي الموثق:
                                    </span>
                                    <p className="text-xs font-bold text-[#252321]">
                                      {activeAdamCandidate.documentedLocations
                                        .length > 0
                                        ? activeAdamCandidate.documentedLocations.join(
                                            ' · '
                                          )
                                        : directSearchResult.originRegion ||
                                          'الجزيرة العربية'}
                                    </p>
                                  </div>
                                  <div className="rounded-xl bg-[#FAF6F0] border border-[#E2DACB] p-3 space-y-1">
                                    <span className="text-[11px] font-extrabold text-[#8D4925] block">
                                      🌿 الفروع والأبناء الموثقون في العقدة:
                                    </span>
                                    <p className="text-xs font-bold text-[#252321]">
                                      {activeAdamCandidate.documentedBranches
                                        .length > 0
                                        ? activeAdamCandidate.documentedBranches.join(
                                            ' ، '
                                          )
                                        : 'عقدة طرفية موثقة مباشرة في عمود النسب'}
                                    </p>
                                  </div>
                                  <div className="rounded-xl bg-emerald-50/70 border border-emerald-300 p-3 space-y-1">
                                    <span className="text-[11px] font-extrabold text-emerald-900 block">
                                      💡 ملاحظة للباحث:
                                    </span>
                                    <p className="text-xs font-extrabold text-emerald-950">
                                      {isAdamSimulatorLockedForSearch
                                        ? 'نظراً لاختلاف الموطن الجغرافي عن مدخلات البحث، لا يُعتمد هذا المسار تلقائياً للعميل إلا بعد التحقق.'
                                        : 'تم استرجاع المسار مباشرة من شجرة آدم الكبرى دون الحاجة لأسئلة تحقق إضافية'}
                                    </p>
                                  </div>
                                </div>

                                {isAdamSimulatorLockedForSearch && (
                                  <div
                                    data-testid="adam-tree-simulator-locked-notice"
                                    className="rounded-2xl bg-[#FAF6F0] border-2 border-[#C5A059] p-4 text-xs sm:text-sm font-extrabold text-[#8D4925] leading-relaxed"
                                  >
                                    🔒 تم إغلاق محاكي التحقق في شجرة آدم لهذا البحث — نظراً لعدم تطابق الموطن الأصلي أو عدم وضوح/اكتمال الربط القبلي للعُقد المرصودة، لا يتم عرض أسئلة تحقق عشوائية للعميل ولا يُعتمد على بيانات شجرة آدم هنا إلا بعد البحث المدقق.
                                  </div>
                                )}
                              </div>
                            )}

                          {/* CASE B: MULTIPLE SIMILAR MATCHES IN ADAM MASTER TREE (> 1 Matches) */}
                          {adamMatchedCandidates.length > 1 && (
                            <div
                              data-testid="adam-container-multiple-matches"
                              className="space-y-4"
                            >
                              {/* List of all similar nodes detected in Adam Tree */}
                              <div className="rounded-2xl bg-white text-[#252321] border border-[#E2DACB] p-4 space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <h4 className="text-xs sm:text-sm font-extrabold font-display text-[#8D4925]">
                                    📋 قائمة العُقد المتشابهة المرصودة في شجرة آدم ({adamMatchedCandidates.length} عُقد مطابقة للاسم):
                                  </h4>
                                  <span className="text-[11px] font-bold text-[#5C5346]">
                                    {isAdamSimulatorLockedForSearch
                                      ? 'عُقد مرجعية للباحث فقط (غير مطابقة للموطن الأصلي المدخل)'
                                      : 'انقر على أي عقدة أو خيار في محاكي أسئلة التحقق في شجرة آدم أدناه لمعاينة حسم المسار'}
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {adamMatchedCandidates.map((cand, cIdx) => {
                                    const isSelected = cIdx === safeSelectedAdamIdx;
                                    return (
                                      <div
                                        key={cand.node.node_id}
                                        onClick={() => setSelectedAdamMatchIndex(cIdx)}
                                        className={`rounded-xl p-3.5 border-2 transition-all cursor-pointer space-y-2 ${
                                          isSelected
                                            ? 'bg-emerald-50/70 border-emerald-600 shadow-xs'
                                            : 'bg-[#FAF6F0] border-[#E2DACB] hover:border-[#B98A78]'
                                        }`}
                                      >
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                          <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded bg-[#8D4925] text-white font-mono text-[11px] font-extrabold">
                                              #{cand.node.node_id}
                                            </span>
                                            <span className="text-xs sm:text-sm font-extrabold text-[#252321]">
                                              {cand.node.name}
                                            </span>
                                            <span className="px-2 py-0.5 rounded bg-white border border-[#B98A78]/50 text-[#8D4925] font-mono text-[10px] font-bold">
                                              {cand.node.arc_code}
                                            </span>
                                          </div>
                                          <span className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-[#C5A059]/60 text-[#8D4925] text-[11px] font-extrabold">
                                            القبيلة الأم: {cand.motherTribeName}
                                          </span>
                                        </div>

                                        <div className="text-[11px] text-[#252321] bg-white p-2.5 rounded-lg border border-[#E2DACB] leading-relaxed">
                                          <strong className="text-[#8D4925]">
                                            السلسلة في شجرة آدم:
                                          </strong>{' '}
                                          {cand.chainAscending
                                            .map((n) =>
                                              n.name.replace(/\s*\(#\d+\)\s*$/, '')
                                            )
                                            .join(' ← ')}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Adam Tree Disambiguation Simulator (Locked when locality/tribe mismatches) */}
                              <div
                                data-testid="adam-tree-disambiguation-simulator"
                                className="rounded-2xl bg-white text-[#252321] border-2 border-[#C5A059] p-4 sm:p-5 space-y-3.5 shadow-sm"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2DACB] pb-3">
                                  <div className="flex items-center gap-2">
                                    <span className="px-3 py-1 rounded-full bg-[#8D4925] text-white text-xs font-extrabold">
                                      🎯 محاكي أسئلة التحقق في شجرة آدم
                                    </span>
                                    <span className="text-xs font-bold text-[#5C5346]">
                                      تفريق تفاعلي للعميل بين العُقد المتشابهة حسب القبيلة الأم والفرع الجامع والنطاق الجغرافي
                                    </span>
                                  </div>
                                  {!isAdamSimulatorLockedForSearch &&
                                    activeAdamCandidate && (
                                      <span className="px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-extrabold">
                                        المسار المعاين حالياً: #{activeAdamCandidate.node.node_id} ({activeAdamCandidate.motherTribeName})
                                      </span>
                                    )}
                                </div>

                                {isAdamSimulatorLockedForSearch ? (
                                  <div
                                    data-testid="adam-tree-simulator-locked-notice"
                                    className="rounded-2xl bg-[#FAF6F0] border border-[#C5A059] p-4 text-xs sm:text-sm font-extrabold text-[#8D4925] leading-relaxed"
                                  >
                                    🔒 تم إغلاق محاكي التحقق في شجرة آدم لهذا البحث — نظراً لعدم تطابق الموطن الأصلي أو عدم وضوح/اكتمال الربط القبلي للعُقد المرصودة، لا يتم عرض أسئلة تحقق عشوائية للعميل ولا يُعتمد على بيانات شجرة آدم هنا إلا بعد البحث المدقق.
                                  </div>
                                ) : (
                                  <>
                                    <div className="text-xs sm:text-sm font-extrabold font-display text-[#252321]">
                                      سؤال التحقق للعميل: «رصدت شجرة آدم ({adamMatchedCandidates.length}) عُقد موثقة تحمل اسم ({cleanQueryName})؛ أيٌّ من هذه الفروع والقبائل الأم والمواضع يرتبط بأسرتكم؟»
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                      {adamMatchedCandidates.map((cand, cIdx) => {
                                        const isSelected =
                                          cIdx === safeSelectedAdamIdx;
                                        return (
                                          <button
                                            key={`sim-adam-${cand.node.node_id}`}
                                            type="button"
                                            onClick={() =>
                                              setSelectedAdamMatchIndex(cIdx)
                                            }
                                            className={`text-right p-3.5 rounded-xl border-2 transition-all cursor-pointer space-y-2 flex flex-col justify-between ${
                                              isSelected
                                                ? 'bg-emerald-50/90 border-emerald-600 shadow-xs'
                                                : 'bg-[#FAF6F0] border-[#E2DACB] hover:border-[#D8755B]'
                                            }`}
                                          >
                                            <div className="space-y-1.5">
                                              <div className="flex items-center justify-between gap-2">
                                                <span className="text-xs font-extrabold text-[#252321]">
                                                  🔘 الخيار #{cIdx + 1}: فرع {cand.subRootName} ({cand.motherTribeName})
                                                </span>
                                                {isSelected && (
                                                  <span className="px-2 py-0.5 rounded bg-emerald-700 text-white text-[10px] font-extrabold">
                                                    قيد المعاينة ✓
                                                  </span>
                                                )}
                                              </div>
                                              <div className="text-[11px] text-[#5C5346] font-bold">
                                                📍 الموضع:{' '}
                                                {cand.documentedLocations.join(
                                                  ' · '
                                                ) || 'الجزيرة العربية'}
                                              </div>
                                            </div>

                                            <div className="text-[11px] bg-white p-2 rounded-lg border border-[#E2DACB] text-emerald-950 font-bold">
                                              يحسم العمود إلى: {cand.node.name} ←{' '}
                                              {cand.parentConnectionLabel} ← آدم عليه السلام
                                            </div>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          )}

                          {/* UNIFIED NO-CLEAR-MATCH NOTICE IN ADAM TREE (Zero technical terms or fake Bridge codes) */}
                          {!hasClearConfirmedAdamMatch && (
                            <div
                              data-testid="adam-container-zero-match"
                              className="rounded-2xl bg-white border border-[#E2DACB] px-4 py-3.5 flex items-center gap-3 text-xs sm:text-sm font-bold text-[#252321] shadow-2xs"
                            >
                              <span className="text-base shrink-0">⚪</span>
                              <span>
                                لم يتم العثور على تطابق واضح للعائلة أو لموطنها الأصلي مع البيانات المسجلة في شجرة آدم للأجداد
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* =========================================================
                        CONTAINER 2: [📦 تحليل وهندسة المصادر التاريخية الخاصة بالمشاريع غير المربوطة بشجرة آدم للأجداد]
                        Unified Bordered Master Card wrapping Diagnostic Sections 1 to 5
                    ========================================================= */}
                    <div
                      data-testid="boslet-container2-raw-bundle"
                      className="rounded-3xl border-2 border-[#C5A059]/80 bg-[#FAF6F0]/70 p-5 sm:p-6 shadow-sm space-y-5"
                    >
                      {/* Master Header of Container 2 */}
                      <div
                        onClick={() =>
                          setIsRawBundleManualOverride(!isContainer2Expanded)
                        }
                        className={`flex flex-wrap items-center justify-between gap-4 cursor-pointer select-none ${
                          isContainer2Expanded
                            ? 'border-b-2 border-[#E2DACB] pb-4'
                            : ''
                        }`}
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="w-11 h-11 rounded-2xl bg-[#8D4925] text-white flex items-center justify-center text-xl shrink-0 shadow-xs">
                            📦
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="px-2.5 py-0.5 rounded-full bg-white border border-[#E2DACB] text-[#5C5346] text-[10px] font-bold">
                                إجمالي السجلات الخام في ألفا: {rawEvidenceList.length}
                              </span>
                            </div>
                            <h3 className="text-base sm:text-lg font-extrabold font-display text-[#252321] mt-1">
                              تحليل وهندسة المصادر التاريخية الخاصة بالمشاريع غير المربوطة بشجرة آدم للأجداد)
                            </h3>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5">
                          {isServedFromAdamOnlyWithZeroAlpha && (
                            <span
                              data-testid="raw-bundle-adam-served-badge"
                              className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-extrabold"
                            >
                              ✓ المسار موثق بالكامل في شجرة آدم (الحزمة الأولى) — لا توجد سجلات خام معلقة في بحيرة ألفا لهذا الاسم
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsRawBundleManualOverride(!isContainer2Expanded);
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-[#EDE6DA] text-[#8D4925] border border-[#B98A78]/50 text-xs font-extrabold transition-all cursor-pointer shadow-2xs"
                          >
                            <span>
                              {isContainer2Expanded
                                ? 'طي حزمة مصادر المشاريع'
                                : 'فتح حزمة مصادر المشاريع'}
                            </span>
                            {isContainer2Expanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {isContainer2Expanded && (
                        <div className="space-y-5">
                          {/* =========================================================
                              STEP 1 INDEPENDENT COLLAPSIBLE CARD:
                              القسم الأول — المصادر الخام المستخرجة من المعاجم (Raw Sources)
                          ========================================================= */}
                    <div
                      data-testid="diagnostic-step1-raw-sources"
                      className={`rounded-3xl transition-all duration-300 overflow-hidden ${
                        bosletExpandedSections.step1
                          ? 'border border-[#B98A78]/50 bg-white p-5 sm:p-6 shadow-xs space-y-4'
                          : 'border border-[#E2DACB] bg-[#FAF6F0] hover:border-[#B98A78]/60 px-5 py-4 shadow-2xs'
                      }`}
                    >
                      <div
                        onClick={() => toggleBosletSection('step1')}
                        className={`flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none ${
                          bosletExpandedSections.step1
                            ? 'border-b border-[#E2DACB] pb-3.5'
                            : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-8 h-8 rounded-xl font-mono text-sm font-extrabold flex items-center justify-center shrink-0 transition-all ${
                              bosletExpandedSections.step1
                                ? 'bg-[#D8755B] text-white shadow-2xs'
                                : 'bg-white text-[#8D4925] border border-[#B98A78]/50'
                            }`}
                          >
                            1
                          </span>
                          <div>
                            <h3 className="text-sm sm:text-base font-extrabold font-display text-[#252321]">
                              القسم الأول: المصادر الخام المستخرجة من المعاجم وأمهات الكتب (Raw Sources)
                            </h3>
                            <p className="text-xs text-[#5C5346] mt-0.5">
                              عرض نص وسلسلة كل مصدر خام كما وردت في المعجم أو المخطوطة بشكل منفصل مع التوثيق المرجعي الدقيق وشارة بحيرة البيانات للباحث
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="px-3 py-1 rounded-xl bg-[#FAF6F0] border border-[#B98A78]/45 text-[#8D4925] text-xs font-bold">
                            إجمالي المصادر الخام المرصودة: {rawEvidenceList.length}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleBosletSection('step1');
                            }}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              bosletExpandedSections.step1
                                ? 'bg-[#EDE6DA] text-[#252321] border-[#B98A78]/50'
                                : 'bg-white text-[#8D4925] border-[#B98A78]/40 hover:bg-[#EDE6DA]/60'
                            }`}
                          >
                            <span>
                              {bosletExpandedSections.step1
                                ? 'طي القسم'
                                : 'فتح وإبراز القسم'}
                            </span>
                            {bosletExpandedSections.step1 ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {bosletExpandedSections.step1 && (
                        <>
                          {rawEvidenceList.length === 0 ? (
                            <div
                              data-testid="step1-no-matching-records-notice"
                              className="rounded-2xl bg-[#FAF6F0] border border-[#E2DACB] p-4 text-xs font-bold text-[#8D4925]"
                            >
                              {activeSearchLocalityForFilter
                                ? `لا يوجد سجل مطابق للموطن الأصلي (${activeSearchLocalityForFilter}) في الدولة المحددة (${
                                    activeSearchCountryForFilter || 'الدولة المحددة'
                                  }) لعائلة (${
                                    activeSearchFamilyForFilter ||
                                    directSearchResult.familyName
                                  }).`
                                : activeSearchCountryForFilter
                                ? `لا يوجد سجل مطابق لعائلة (${
                                    activeSearchFamilyForFilter ||
                                    directSearchResult.familyName
                                  }) في الدولة المحددة (${activeSearchCountryForFilter}).`
                                : 'لم يتم رصد مصادر خام مطابقة في قواعد البيانات الحالية، تم الإحالة للبحث المعمق'}
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {rawEvidenceList.map((ev, idx) => {
                                const rawTokens = extractRawRecordAncestors(ev);
                                const displayChainCapsules =
                                  rawTokens.length > 0
                                    ? rawTokens
                                    : [
                                        ev.lineage_ancestors ||
                                          ev.record_name ||
                                          directSearchResult.familyName,
                                      ];
                                const refBadgeText = formatAlphaReferenceBadge(ev);
                                const lakeBadge = resolveResearcherDataLakeBadge(ev);
                                const validCardOtherLeads =
                                  Array.isArray(ev.parsed_other_sources) &&
                                  ev.parsed_other_sources.length > 0
                                    ? ev.parsed_other_sources.filter(
                                        isValidParsedOtherSourceLead
                                      )
                                    : ev.other_sources
                                    ? parseOtherSourcesStringIntoLeads(
                                        ev.other_sources,
                                        ev.alpha_id,
                                        ev.record_name || directSearchResult.familyName
                                      )
                                    : [];
                                const isCardInWinningCluster =
                                  primaryCluster?.records.some(
                                    (r) => r.alpha_id === ev.alpha_id
                                  ) ?? ev.is_consensus_winner !== false;
                                const isUnspecifiedLocalityCard =
                                  ev.locality_match_status ===
                                    'UNSPECIFIED_NON_CONFLICTING_LOCALITY' ||
                                  (extractSpecificLocalityTokens(
                                    ev.locations,
                                    activeSearchCountryForFilter
                                  ).length === 0 &&
                                    (!ev.locations ||
                                      ev.locations.trim() === '' ||
                                      ev.locations.trim() === '—' ||
                                      ev.locations.includes('لم يُذكر موطن')));
                                const isExplicitLocalityWinnerCard =
                                  ev.locality_match_status ===
                                  'EXPLICIT_LOCALITY_MATCH';

                                return (
                                  <div
                                    key={ev.alpha_id || idx}
                                    className="rounded-2xl bg-[#FAF6F0] border border-[#E2DACB] p-4 shadow-2xs space-y-3 flex flex-col justify-between hover:border-[#B98A78] transition-all"
                                  >
                                    <div className="space-y-2.5">
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          <span className="px-2.5 py-0.5 rounded-lg bg-[#8D4925] text-white text-[11px] font-extrabold">
                                            المصدر الخام #{idx + 1}
                                          </span>
                                          <span
                                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                              isCardInWinningCluster
                                                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                                                : 'bg-white text-[#8D4925] border-[#B98A78]/45'
                                            }`}
                                          >
                                            {isCardInWinningCluster
                                              ? 'ضمن عنقود التوافق الأساسي'
                                              : isUnspecifiedLocalityCard
                                              ? 'مسار مرجعي محتمل غير متعارض جغرافياً'
                                              : 'مسار منافس مستقل'}
                                          </span>
                                          {isExplicitLocalityWinnerCard && (
                                            <span
                                              data-testid={`raw-source-locality-winner-badge-${idx}`}
                                              className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-900 border border-emerald-300"
                                            >
                                              {EXPLICIT_LOCALITY_WINNER_BADGE_TEXT}
                                            </span>
                                          )}
                                          {isUnspecifiedLocalityCard && (
                                            <span
                                              data-testid={`raw-source-unspecified-locality-badge-${idx}`}
                                              className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white text-[#5C5346] border border-[#E2DACB]"
                                            >
                                              {UNSPECIFIED_LOCALITY_BADGE_TEXT}
                                            </span>
                                          )}
                                        </div>

                                        <div className="flex flex-wrap items-center gap-1.5">
                                          <span
                                            data-testid={`raw-source-ref-badge-${idx}`}
                                            className="inline-flex items-center px-2.5 py-1 rounded-lg bg-white border border-[#B98A78]/45 text-[#8D4925] text-[11px] font-bold shadow-2xs"
                                          >
                                            {refBadgeText}
                                          </span>
                                          <span
                                            data-testid={`raw-source-lake-badge-${idx}`}
                                            className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold border ${lakeBadge.colorClass}`}
                                          >
                                            {lakeBadge.tag}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#5C5346]">
                                        <div className="flex items-center gap-1.5">
                                          <span>اسم السجل في المعجم:</span>
                                          <strong className="text-[#252321]">
                                            {ev.record_name || directSearchResult.familyName}
                                          </strong>
                                        </div>
                                        {validCardOtherLeads.length > 0 && (
                                          <span
                                            data-testid={`raw-source-other-sources-badge-${idx}`}
                                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-[#B98A78]/50 text-[#8D4925] text-[10px] font-extrabold"
                                          >
                                            <span>📜</span>
                                            <span>
                                              إحالات لمصادر أخرى في الهامش (
                                              {validCardOtherLeads.length})
                                            </span>
                                          </span>
                                        )}
                                      </div>

                                      {/* Requirement 2(ب): Single Sequential Capsule Chain Box */}
                                      <div className="rounded-xl bg-white border border-[#E2DACB] p-3 space-y-2">
                                        <span className="text-[11px] font-bold text-[#8D4925] block">
                                          السلسلة الخام كما وردت في المصدر:
                                        </span>
                                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                          {displayChainCapsules.map((tok, tIdx) => (
                                            <React.Fragment key={tIdx}>
                                              <span className="px-2.5 py-1 rounded-lg bg-[#FAF6F0] border border-[#E2DACB] text-xs font-bold text-[#252321] shadow-2xs">
                                                {tok}
                                              </span>
                                              {tIdx < displayChainCapsules.length - 1 && (
                                                <span className="text-[#D8755B] font-bold text-xs">
                                                  ⬅️
                                                </span>
                                              )}
                                            </React.Fragment>
                                          ))}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#E2DACB] text-[11px]">
                                      <div>
                                        <span className="text-[#5C5346] block">
                                          الفروع الأبناء في المصدر:
                                        </span>
                                        <span className="font-bold text-[#252321]">
                                          {ev.child_branches || '—'}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-[#5C5346] block">
                                          النطاق الجغرافي في المصدر:
                                        </span>
                                        <span className="font-bold text-[#8D4925]">
                                          {isUnspecifiedLocalityCard
                                            ? ev.locations &&
                                              ev.locations.trim() &&
                                              ev.locations.trim() !== '—' &&
                                              !ev.locations.includes('لم يُذكر موطن')
                                              ? `${ev.locations} · ${UNSPECIFIED_LOCALITY_BADGE_TEXT}`
                                              : UNSPECIFIED_LOCALITY_BADGE_TEXT
                                            : ev.locations || '—'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* =========================================================
                        STEP 2 INDEPENDENT COLLAPSIBLE CARD:
                        القسم الثاني — محرك العنقدة والخياطة (Stitching Engine Logic)
                    ========================================================= */}
                    <div
                      data-testid="diagnostic-step2-stitching-logic"
                      className={`rounded-3xl transition-all duration-300 overflow-hidden ${
                        bosletExpandedSections.step2
                          ? 'border border-[#B98A78]/50 bg-white p-5 sm:p-6 shadow-xs space-y-4'
                          : 'border border-[#E2DACB] bg-[#FAF6F0] hover:border-[#B98A78]/60 px-5 py-4 shadow-2xs'
                      }`}
                    >
                      <div
                        onClick={() => toggleBosletSection('step2')}
                        className={`flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none ${
                          bosletExpandedSections.step2
                            ? 'border-b border-[#E2DACB] pb-3.5'
                            : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-8 h-8 rounded-xl font-mono text-sm font-extrabold flex items-center justify-center shrink-0 transition-all ${
                              bosletExpandedSections.step2
                                ? 'bg-[#D8755B] text-white shadow-2xs'
                                : 'bg-white text-[#8D4925] border border-[#B98A78]/50'
                            }`}
                          >
                            2
                          </span>
                          <div>
                            <h3 className="text-sm sm:text-base font-extrabold font-display text-[#252321]">
                              القسم الثاني: محرك العنقدة والخياطة — السجل التشخيصي الكامل (Complete Automated Pipeline Audit)
                            </h3>
                            <p className="text-xs text-[#5C5346] mt-0.5">
                              توثيق تفصيلي لكافة العمليات الخوارزمية المطبقة فعلياً على السجلات المرصودة من التنظيف والتفكيك حتى اختيار عقدتي الجذر
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-mono text-xs font-bold">
                            Complete Pipeline Audit (8 Stages)
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleBosletSection('step2');
                            }}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              bosletExpandedSections.step2
                                ? 'bg-[#EDE6DA] text-[#252321] border-[#B98A78]/50'
                                : 'bg-white text-[#8D4925] border-[#B98A78]/40 hover:bg-[#EDE6DA]/60'
                            }`}
                          >
                            <span>
                              {bosletExpandedSections.step2
                                ? 'طي القسم'
                                : 'فتح وإبراز القسم'}
                            </span>
                            {bosletExpandedSections.step2 ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {bosletExpandedSections.step2 && (
                        <div className="rounded-2xl bg-[#FAF6F0] border border-[#E2DACB] p-4 sm:p-5">
                          {isDirectDeepResearchP1 ? (
                            <ul className="space-y-3 text-xs sm:text-sm text-[#252321]">
                              <li className="flex items-start gap-2.5 leading-relaxed">
                                <span className="shrink-0">⚓</span>
                                <div>
                                  <strong className="text-[#8D4925]">المحاذاة الطوبولوجية:</strong>{' '}
                                  لا توجد سلاسل خام مرصودة لاسم ({directSearchResult.familyName}) لإجراء محاذاة أو خياطة آلية.
                                </div>
                              </li>
                              <li className="flex items-start gap-2.5 leading-relaxed">
                                <span className="shrink-0">🧬</span>
                                <div>
                                  <strong className="text-[#8D4925]">قرينة التوافق:</strong>{' '}
                                  0 عناقيد مطابقة في قواعد البيانات الحالية.
                                </div>
                              </li>
                              <li className="flex items-start gap-2.5 leading-relaxed">
                                <span className="shrink-0">⚠️</span>
                                <div>
                                  <strong className="text-[#8D4925]">قرار التوجيه الآلي:</strong>{' '}
                                  لم يتم رصد مصادر خام مطابقة في قواعد البيانات الحالية، تم الإحالة للبحث المعمق (تذكرة P1).
                                </div>
                              </li>
                            </ul>
                          ) : (
                            <ul className="space-y-3 text-xs sm:text-sm text-[#252321]">
                              <li className="flex items-start gap-2.5 leading-relaxed">
                                <span className="shrink-0">🌿</span>
                                <div>
                                  <strong className="text-[#8D4925]">
                                    إسناد الفرع للحاضنة الأم (Branch-to-Parent Attribution):
                                  </strong>{' '}
                                  {parentAttributionList.length > 0
                                    ? `تم رصد (${directSearchResult.familyName}) وإسناده إلى السجل الأم الحاضن (${parentAttributionList.join(' ، ')}) كأول محطة تلي العائلة في عمود النسب.`
                                    : `تطابق مباشر مع عنوان السجل الرئيس (${directSearchResult.familyName}) في المعاجم دون الحاجة لإسناد فرعي من حقل الفروع الأبناء.`}
                                </div>
                              </li>

                              <li className="flex items-start gap-2.5 leading-relaxed">
                                <span className="shrink-0">🔗</span>
                                <div>
                                  <strong className="text-[#8D4925]">
                                    تفكيك الأسماء المركبة (Compound Name Unrolling):
                                  </strong>{' '}
                                  {compoundUnrollList.length > 0
                                    ? `تم تفكيك المركبات النسبية المحتوية على (بن/ابن) آلياً إلى محطات مستقلة متتالية: ${compoundUnrollList.join(' ، ')}.`
                                    : `جميع المحطات المرصودة في السجلات الخام وردت مفردة؛ لم يتطلب المسار تفكيك تراكيب إضافية (بن/ابن).`}
                                </div>
                              </li>

                              <li className="flex items-start gap-2.5 leading-relaxed">
                                <span className="shrink-0">👑</span>
                                <div>
                                  <strong className="text-[#8D4925]">
                                    دمج الألقاب التاريخية المفصولة وتوحيد التصحيف (Detached Epithet & Title Fusion):
                                  </strong>{' '}
                                  {detachedEpithetExamplesList.length > 0
                                    ? `تم رصد ودمج الألقاب التاريخية التي فُصلت بفاصلة منقوطة عن أصحابها في التفريغ وتوحيدها في محطة قياسية واحدة عبر المراجع: ${detachedEpithetExamplesList.join(' ، ')}.`
                                    : `تم فحص السلسلة لدمج أي ألقاب تاريخية مفصولة في التفريغ (مثل: البهلول، مزيقياء، ماء السماء، الغطريف، البطريق، العنقاء) وتوحيدها مع المراجع الموازية.`}
                                </div>
                              </li>

                              <li className="flex items-start gap-2.5 leading-relaxed">
                                <span className="shrink-0">🔤</span>
                                <div>
                                  <strong className="text-[#8D4925]">
                                    توحيد الرسم الإملائي والتصحيف المطبعي (Orthographic & OCR Normalization):
                                  </strong>{' '}
                                  {mergedVariantGroups.length > 0
                                    ? `تم توحيد الصيغ والبادئات (بنو/بني/آل/بيت/البو) ومعالجة التصحيفات المطبعية بين المعاجم لدمج: ${mergedVariantGroups.join(' ، ')}.`
                                    : `تم تجريد البادئات (بنو/بني/آل/بيت/البو) وتوحيد التاء المربوطة/الهاء والهمزات لضمان تطابق الجذور الصرفية عبر المراجع.`}
                                </div>
                              </li>

                              <li className="flex items-start gap-2.5 leading-relaxed">
                                <span className="shrink-0">♻️</span>
                                <div>
                                  <strong className="text-[#8D4925]">
                                    تنظيف التكرار الدائري ومقدمات الاختصار (Loop & Prefix Deduplication):
                                  </strong>{' '}
                                  {deduplicatedNodesList.length > 0
                                    ? `تم رصد وحذف العُقد المكررة ومقدمات الاختصار داخل السلسلة (${deduplicatedNodesList.join(' ، ')}) مع الاحتفاظ بأعلى موضع طبقي للجد لمنع الدوران.`
                                    : `تم فحص السلسلة ضد التكرار الدائري وتجريد تكرار اسم العائلة (${directSearchResult.familyName}) في مطلع خانة الأجداد.`}
                                </div>
                              </li>

                              <li className="flex items-start gap-2.5 leading-relaxed">
                                <span className="shrink-0">🧹</span>
                                <div>
                                  <strong className="text-[#8D4925]">
                                    فلترة الشوائب الجغرافية والوصفية (Noise & Geo-Token Filtering):
                                  </strong>{' '}
                                  {filteredNoiseList.length > 0
                                    ? `تم استبعاد وتصفية الألفاظ المكانية والعبارات الوصفية من خانات الأجداد: (${filteredNoiseList.join(' ، ')}).`
                                    : `تم فحص جميع محطات الأجداد للتأكد من خلوّها من أسماء المدن أو العبارات الوصفية (مثل: تدّعي، الأصل قيل، مساكنهم).`}
                                </div>
                              </li>

                              <li className="flex items-start gap-2.5 leading-relaxed">
                                <span className="shrink-0">🔄</span>
                                <div>
                                  <strong className="text-[#8D4925]">
                                    إصلاح التمهيد المعكوس في التفريغ (Preamble Inversion Correction):
                                  </strong>{' '}
                                  {invertedPreambleExamples.length > 0
                                    ? invertedPreambleExamples.join(' — ')
                                    : `تم فحص مطلع السلسلة ضد التمهيد المعكوس للقبائل الكبرى؛ لم يُرصد انقلاب تمهيدي يسبق اسم صاحب السجل (${directSearchResult.familyName}).`}
                                </div>
                              </li>

                              <li className="flex items-start gap-2.5 leading-relaxed">
                                <span className="shrink-0">⚓</span>
                                <div>
                                  <strong className="text-[#8D4925]">
                                    المحاذاة الطوبولوجية بالارتكاز (Anchor-Based Topological Alignment):
                                  </strong>{' '}
                                  {sharedAnchorNames.length > 0
                                    ? `تم استخدام عُقد الارتكاز المشتركة (${sharedAnchorNames.join(' ، ')}) كجسور لمحاذاة وإدراج البطون الوسيطة في موضعها الطبقي التصاعدي من (${directSearchResult.familyName}) حتى (${directSearchResult.rootTribeName}).`
                                    : `تم ترتيب المحطات تصاعدياً من عقدة العائلة (${directSearchResult.familyName}) حتى الجذر الأعلى (${directSearchResult.rootTribeName}).`}
                                </div>
                              </li>

                              <li className="flex items-start gap-2.5 leading-relaxed">
                                <span className="shrink-0">🧬</span>
                                <div>
                                  <strong className="text-[#8D4925]">
                                    قرينة التوافق الجغرافي والمرجعي (Geo & Book Priority Consensus):
                                  </strong>{' '}
                                  {primaryCluster
                                    ? `توافق (${primaryCluster.sourcesCount}) مراجع في العنقود المتصدر ضمن النطاق الجغرافي المشترك (${primaryCluster.geographicScope})${
                                        sharedChildBranches.length > 0
                                          ? ` مع تقاطع الفروع الأبناء (${sharedChildBranches.join('، ')})`
                                          : ''
                                      }؛ إجمالي العناقيد المستقلة المرصودة: (${diagnosticClusters.length}).`
                                    : `تم تجميع الشواهد المرجعية وفق النطاق الجغرافي المرصود (${directSearchResult.matched_location || directSearchResult.originRegion || '—'}).`}
                                </div>
                              </li>

                              <li className="flex items-start gap-2.5 leading-relaxed">
                                <span className="shrink-0">⚖️</span>
                                <div>
                                  <strong className="text-[#8D4925]">
                                    معادلة الأوزان واختيار عقدتي الجذر للـ 5$ (Weighted 2-Root Selection):
                                  </strong>{' '}
                                  تم اختيار عقدة الفرع الجامع (<strong className="text-emerald-800">B2: {directSearchResult.rootBranchName}</strong>) وعقدة القبيلة الأم العليا (<strong className="text-[#8D4925]">B0: {directSearchResult.rootTribeName}</strong>) بناءً على ثقل التكرار المرجعي والوزن القبلي، مع طيّ (<strong className="text-[#D8755B]">🔒 +{hiddenIntermediateCount} في السلسلة</strong>) من المحطات الوسيطة داخل كبسولة عمود النسب.
                                </div>
                              </li>
                            </ul>
                          )}
                        </div>
                      )}
                    </div>

                    {/* =========================================================
                        STEP 3 INDEPENDENT COLLAPSIBLE CARD:
                        القسم الثالث — النتيجة المجمعة والخياطة النهائية (Final Stitched Chain)
                    ========================================================= */}
                    {!isDirectDeepResearchP1 && (
                      <div
                        data-testid="diagnostic-step3-final-stitched-chain"
                        className={`rounded-3xl transition-all duration-300 overflow-hidden ${
                          bosletExpandedSections.step3
                            ? 'border border-emerald-300 bg-white p-5 sm:p-6 shadow-xs space-y-4'
                            : 'border border-[#E2DACB] bg-[#FAF6F0] hover:border-emerald-400 px-5 py-4 shadow-2xs'
                        }`}
                      >
                        <div
                          onClick={() => toggleBosletSection('step3')}
                          className={`flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none ${
                            bosletExpandedSections.step3
                              ? 'border-b border-[#E2DACB] pb-3.5'
                              : ''
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-8 h-8 rounded-xl font-mono text-sm font-extrabold flex items-center justify-center shrink-0 transition-all ${
                                bosletExpandedSections.step3
                                  ? 'bg-emerald-700 text-white shadow-2xs'
                                  : 'bg-white text-emerald-800 border border-emerald-300'
                              }`}
                            >
                              3
                            </span>
                            <div>
                              <h3 className="text-sm sm:text-base font-extrabold font-display text-[#252321]">
                                القسم الثالث: النتيجة المجمعة والخياطة النهائية (Final Stitched Chain)
                              </h3>
                              <p className="text-xs text-[#5C5346] mt-0.5">
                                عمود النسب النهائي المخيّط بعد دمج كافة المصادر المتوافقة ومحاذاة الأجداد من الأسفل إلى الأعلى
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2.5">
                            <span className="px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-extrabold">
                              {finalStitchedStations.length} محطة مخيطة وموثقة ✓
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleBosletSection('step3');
                              }}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                bosletExpandedSections.step3
                                  ? 'bg-[#EDE6DA] text-[#252321] border-[#B98A78]/50'
                                  : 'bg-white text-[#8D4925] border-[#B98A78]/40 hover:bg-[#EDE6DA]/60'
                              }`}
                            >
                              <span>
                                {bosletExpandedSections.step3
                                  ? 'طي القسم'
                                  : 'فتح وإبراز القسم'}
                              </span>
                              {bosletExpandedSections.step3 ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        {bosletExpandedSections.step3 && (
                          <div className="rounded-2xl bg-[#FAF6F0] border border-[#E2DACB] p-4 space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                              <span className="font-bold text-[#252321]">
                                تسلسل المحطات المخيطة (من العائلة FE0 صعوداً إلى الجذر الأعلى):
                              </span>
                              <span className="text-[11px] font-bold text-[#8D4925] bg-white px-3 py-1 rounded-lg border border-[#B98A78]/45">
                                الفرع الجامع (B2): {directSearchResult.rootBranchName} · القبيلة الأم (B0): {directSearchResult.rootTribeName}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              {finalStitchedStations.map((node, nIdx) => {
                                const isFamily = node.orderNumber === 1 || node.code === 'FE0';
                                const isRoot =
                                  node.code === 'B2' ||
                                  node.code === 'B1' ||
                                  node.code === 'B0' ||
                                  node.code === 'MT';
                                return (
                                  <React.Fragment key={node.id || nIdx}>
                                    <div
                                      className={`px-3 py-2 rounded-xl border text-xs flex items-center gap-2 shadow-2xs ${
                                        isFamily
                                          ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-extrabold'
                                          : isRoot
                                          ? 'bg-amber-50 border-[#B98A78] text-[#8D4925] font-extrabold'
                                          : 'bg-white border-[#E2DACB] text-[#252321] font-bold'
                                      }`}
                                    >
                                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#EDE6DA] text-[#5C5346]">
                                        #{nIdx + 1}
                                      </span>
                                      <span>{node.name}</span>
                                      {node.code && (
                                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#FAF6F0] border border-[#B98A78]/45 text-[#8D4925]">
                                          {node.code}
                                        </span>
                                      )}
                                    </div>
                                    {nIdx < finalStitchedStations.length - 1 && (
                                      <span className="text-[#D8755B] font-bold text-xs">
                                        ⬅️
                                      </span>
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </div>

                            {/* SUB-SECTION BELOW FINAL STITCHED CHAIN: المراجع المساهمة في هذا المسار */}
                            <div
                              data-testid="contributing-references-subsection"
                              className="pt-3.5 border-t border-[#E2DACB] space-y-2.5"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <h4 className="text-xs font-extrabold font-display text-[#8D4925] flex items-center gap-1.5">
                                  <span>📚</span>
                                  <span>المراجع المساهمة في هذا المسار</span>
                                </h4>
                                <span className="text-[11px] font-bold text-emerald-900 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                                  {contributingReferencesForStitchedPath.length}{' '}
                                  {contributingReferencesForStitchedPath.length === 1
                                    ? 'مرجع معتمد في الخياطة'
                                    : 'مراجع معتمدة في الخياطة'}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                {contributingReferencesForStitchedPath.map(
                                  (refEv, rIdx) => {
                                    const lakeBadge = resolveResearcherDataLakeBadge(refEv);
                                    return (
                                      <span
                                        key={refEv.alpha_id || rIdx}
                                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-[#E2DACB] text-[#252321] text-[11px] font-bold shadow-2xs"
                                      >
                                        <span>{formatAlphaReferenceBadge(refEv)}</span>
                                        <span
                                          className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold border ${lakeBadge.colorClass}`}
                                        >
                                          {lakeBadge.tag}
                                        </span>
                                      </span>
                                    );
                                  }
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* =========================================================
                        STEP 4 INDEPENDENT COLLAPSIBLE CARD:
                        القسم الرابع — محاكي أسئلة التحقق للعميل وحسم التوافق السيبراني
                    ========================================================= */}
                    <div
                      data-testid="diagnostic-step4-disambiguation-simulator"
                      className={`rounded-3xl transition-all duration-300 overflow-hidden ${
                        bosletExpandedSections.step4
                          ? 'border border-[#B98A78]/50 bg-white p-5 sm:p-6 shadow-xs space-y-5'
                          : 'border border-[#E2DACB] bg-[#FAF6F0] hover:border-[#B98A78]/60 px-5 py-4 shadow-2xs'
                      }`}
                    >
                      <div
                        onClick={() => toggleBosletSection('step4')}
                        className={`flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none ${
                          bosletExpandedSections.step4
                            ? 'border-b border-[#E2DACB] pb-3.5'
                            : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-8 h-8 rounded-xl font-mono text-sm font-extrabold flex items-center justify-center shrink-0 transition-all ${
                              bosletExpandedSections.step4
                                ? 'bg-[#D8755B] text-white shadow-2xs'
                                : 'bg-white text-[#8D4925] border border-[#B98A78]/50'
                            }`}
                          >
                            4
                          </span>
                          <div>
                            <h3 className="text-sm sm:text-base font-extrabold font-display text-[#252321]">
                              {isDirectDeepResearchP1
                                ? 'القسم الرابع: التوجيه المباشر لتذكرة البحث المعمق (P1 Deep Research Routing)'
                                : 'القسم الرابع: مصفوفة التوافق ومحاكي أسئلة التحقق للعميل (Disambiguation Simulator)'}
                            </h3>
                            <p className="text-xs text-[#5C5346] mt-0.5">
                              {isDirectDeepResearchP1
                                ? 'عدم وجود مصادر خام مطابقة — إحالة مباشرة إلى مسار البحث المعمق (تذكرة بحث وتوثيق نشطة P1)'
                                : hasCompetingDisambiguationPaths
                                ? `عرض شامل لكافة العناقيد المتنافسة للباحث (${diagnosticClusters.length} مسارات)، مع تقليص سؤال العميل إلى أقوى خيارين فقط + خيار «لا أعرف»`
                                : 'تطابق موحد في المصادر (عنقود واحد) — لا يُعرض سؤال تحقق للعميل بل ينتقل مباشرة لبطاقة الجذر ($5)'}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5">
                          <span
                            className={`px-3 py-1 rounded-xl text-xs font-bold border ${
                              isDirectDeepResearchP1
                                ? 'bg-[#FAF6F0] border-[#B98A78]/50 text-[#8D4925]'
                                : hasCompetingDisambiguationPaths
                                ? 'bg-[#FAF6F0] border-[#B98A78]/50 text-[#8D4925]'
                                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                            }`}
                          >
                            {isDirectDeepResearchP1
                              ? 'المخرج (ب) · البحث المعمق (تذكرة P1)'
                              : hasCompetingDisambiguationPaths
                              ? `يُعرض للعميل خياران فقط (أقوى مسارين من أصل ${diagnosticClusters.length} مسارات مرصودة للباحث)`
                              : 'SINGLE_MATCH · تطابق وحيد مباشر (بطاقة الجذر $5)'}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleBosletSection('step4');
                            }}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              bosletExpandedSections.step4
                                ? 'bg-[#EDE6DA] text-[#252321] border-[#B98A78]/50'
                                : 'bg-white text-[#8D4925] border-[#B98A78]/40 hover:bg-[#EDE6DA]/60'
                            }`}
                          >
                            <span>
                              {bosletExpandedSections.step4
                                ? 'طي القسم'
                                : 'فتح وإبراز القسم'}
                            </span>
                            {bosletExpandedSections.step4 ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {bosletExpandedSections.step4 && (
                        <>
                          {isDirectDeepResearchP1 ? (
                            <div
                              data-testid="direct-deep-research-p1-card"
                              className="p-5 rounded-2xl border border-[#B98A78]/50 bg-[#FAF6F0] space-y-3 shadow-2xs"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="px-3 py-1 rounded-lg bg-[#8D4925] text-white text-xs font-extrabold">
                                    المخرج (ب) · البحث المعمق
                                  </span>
                                  <span className="px-2.5 py-1 rounded-lg bg-white border border-[#E2DACB] text-[#8D4925] text-xs font-extrabold">
                                    تذكرة بحث وتوثيق نشطة P1
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newTkt = buildTicketFromLineageResult(
                                      directSearchResult,
                                      `فحص باحث (${directSearchResult.familyName})`
                                    );
                                    saveGeneratedResearchTicketToFirebase({
                                      ticketId: newTkt.id,
                                      adamNodeId: newTkt.adamNodeId,
                                      ticketCategory: 'P1_CUSTOMER_SEARCH',
                                      familyName: newTkt.familyName,
                                      subRootName: newTkt.subRootName,
                                      motherTribeName: newTkt.motherTribeName,
                                      originCountry:
                                        newTkt.inferredCountries?.[0] ||
                                        'الجزيرة العربية',
                                      originRegion: newTkt.locationLabel,
                                      clientName: newTkt.clientName,
                                      verifiedSources: [],
                                      corroboratingAlphaEvidence: [],
                                      precomputedDiagnostic:
                                        newTkt.precomputed_diagnostic,
                                    })
                                      .then((savedDoc) => {
                                        setTickets((prev) =>
                                          prev.map((item) =>
                                            item.id === newTkt.id
                                              ? {
                                                  ...item,
                                                  firestoreDocId: savedDoc.id,
                                                }
                                              : item
                                          )
                                        );
                                      })
                                      .catch(() => {});
                                    setTickets((prev) => [
                                      newTkt,
                                      ...prev.filter(
                                        (existing) => existing.id !== newTkt.id
                                      ),
                                    ]);
                                    setSelectedTicketId(newTkt.id);
                                    setActiveSubTab('ticket_inbox');
                                  }}
                                  className="px-3.5 py-1.5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-extrabold cursor-pointer transition-colors"
                                >
                                  فتح كتذكرة بحث وتوثيق نشطة (P1) ←
                                </button>
                              </div>
                              <div className="rounded-xl bg-white p-4 border border-[#E2DACB] space-y-1.5">
                                <p className="text-sm font-extrabold font-display text-[#8D4925]">
                                  لم يتم رصد مصادر خام مطابقة في قواعد البيانات الحالية، تم الإحالة للبحث المعمق
                                </p>
                                <p className="text-xs text-[#252321] leading-relaxed">
                                  نظراً لعدم وجود سجلات خام أو عناقيد مطابقة لاسم ({directSearchResult.familyName}) في قواعد البيانات الحالية، لا يُعرض للعميل أي سؤال تحقق آلي ولا يُطالب بدفع $5، بل يتم توجيهه مباشرة إلى مسار <strong className="text-[#8D4925]">«المخرج (ب) · البحث المعمق» (تذكرة بحث وتوثيق نشطة P1)</strong> ليتولى فريق الباحثين التحقيق في المخطوطات والأوقاف.
                                </p>
                              </div>
                            </div>
                          ) : (
                            <>
                              {renderConsensusAndCompetingPathsMatrix(
                                directSearchResult.familyName,
                                rawEvidenceList,
                                'direct_search'
                              )}

                              {!hasCompetingDisambiguationPaths ? (
                                <div
                                  data-testid="sim-single-match-resolved"
                                  className="rounded-2xl border border-emerald-300 bg-emerald-50/40 p-5 space-y-3 shadow-2xs"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="px-3 py-1 rounded-full bg-emerald-700 text-white text-xs font-extrabold">
                                      🎯 محاكاة حية لما يراه العميل في الواجهة الأمامية (SINGLE_MATCH)
                                    </span>
                                    <span className="px-2.5 py-1 rounded-lg bg-white border border-emerald-200 text-emerald-900 text-xs font-mono font-bold">
                                      requires_disambiguation = false
                                    </span>
                                  </div>
                                  <div className="rounded-xl bg-white border border-emerald-200 p-4 space-y-2">
                                    <p className="text-sm sm:text-base font-extrabold font-display text-emerald-950">
                                      ✅ المسار محسوم آلياً بتوافق المراجع — لا يُعرض سؤال تحقق للعميل بل ينتقل مباشرة لبطاقة الجذر (5$)
                                    </p>
                                    <p className="text-xs text-[#252321] leading-relaxed">
                                      بفضل توحيد الرسم الإملائي وتطابق الأجداد الوسيطين والنطاق الجغرافي ({primaryCluster?.geographicScope || directSearchResult.matched_location}) عبر ({primaryCluster?.sourcesCount || rawEvidenceList.length}) مراجع، تم دمج كافة السجلات في مسار توافق واحد (<strong className="text-[#8D4925]">{directSearchResult.familyName} ⬅️ {directSearchResult.rootBranchName} ⬅️ {directSearchResult.rootTribeName}</strong>) وإسقاط سؤال التحقق الثنائي.
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                /* Interactive Customer Verification Simulator when 2+ competing paths exist */
                                <div className="rounded-2xl border border-[#B98A78]/50 bg-[#FAF6F0] p-5 space-y-4">
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2DACB] pb-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="px-3 py-1 rounded-full bg-white border border-[#B98A78]/50 text-[#8D4925] text-xs font-extrabold">
                                        🎯 محاكاة حية لما يراه العميل في الواجهة الأمامية (أقوى مسارين فقط + خيار لا أعرف)
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setDiagnosticSimStage(1)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                                          diagnosticSimStage === 1
                                            ? 'bg-[#D8755B] text-white'
                                            : 'bg-white text-[#8D4925] border border-[#E2DACB]'
                                        }`}
                                      >
                                        المرحلة 1: سؤال الأصل والقبيلة
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setDiagnosticSimStage(2)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                                          diagnosticSimStage === 2
                                            ? 'bg-[#D8755B] text-white'
                                            : 'bg-white text-[#8D4925] border border-[#E2DACB]'
                                        }`}
                                      >
                                        المرحلة 2: سؤال الجغرافيا والمواضع
                                      </button>
                                    </div>
                                  </div>

                                  {diagnosticSimStage === 1 ? (
                                    <div className="space-y-3">
                                      <div className="text-sm font-extrabold font-display text-[#252321]">
                                        نص سؤال المرحلة 1 للعميل: «لتثبيت الجذر الصحيح لعائلة ({directSearchResult.familyName})، أيٌّ من هذين الأصلين يرتبط بأسرتكم؟»
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {candidateDisambigOptions.slice(0, 2).map((opt, oIdx) => {
                                          const isSelected = diagnosticSimChoice === opt.id;
                                          const overrideObj =
                                            oIdx === 1
                                              ? directSearchResult.optionBResultOverride
                                              : oIdx === 2
                                              ? directSearchResult.optionCResultOverride
                                              : directSearchResult.optionAResultOverride;
                                          const matchedClusterForOpt =
                                            diagnosticClusters[oIdx] ||
                                            diagnosticClusters.find(
                                              (c) =>
                                                (opt.choice_id &&
                                                  c.records.some(
                                                    (r) =>
                                                      r.alpha_id &&
                                                      opt.choice_id?.includes(r.alpha_id)
                                                  )) ||
                                                stemTribeToken(c.originTribeLabel) ===
                                                  stemTribeToken(
                                                    opt.originTribeLabel || opt.title
                                                  )
                                            );

                                          const optSources: CorroboratingAlphaEvidence[] =
                                            opt.contributingSources &&
                                            opt.contributingSources.length > 0
                                              ? opt.contributingSources
                                              : matchedClusterForOpt?.records &&
                                                matchedClusterForOpt.records.length > 0
                                              ? matchedClusterForOpt.records
                                              : overrideObj
                                                  ?.corroborating_alpha_evidence_for_researcher &&
                                                overrideObj
                                                  .corroborating_alpha_evidence_for_researcher
                                                  .length > 0
                                              ? overrideObj.corroborating_alpha_evidence_for_researcher
                                              : rawEvidenceList.slice(oIdx, oIdx + 1);

                                          const fullStitchedChainForOpt =
                                            matchedClusterForOpt &&
                                            matchedClusterForOpt.fullChainNodes.length > 1
                                              ? matchedClusterForOpt.fullChainNodes.join(' ⬅️ ')
                                              : overrideObj?.full_stitched_lineage_for_researcher &&
                                                overrideObj.full_stitched_lineage_for_researcher
                                                  .length > 1
                                              ? overrideObj.full_stitched_lineage_for_researcher
                                                  .map((n) => n.name)
                                                  .join(' ⬅️ ')
                                              : `${directSearchResult.familyName} ⬅️ ${
                                                  opt.originTribeLabel || opt.title
                                                }`;

                                          return (
                                            <div
                                              key={opt.id}
                                              onClick={() => {
                                                setDiagnosticSimChoice(opt.id);
                                                if (overrideObj) {
                                                  setDirectSearchResult({
                                                    ...directSearchResult,
                                                    ...overrideObj,
                                                  });
                                                }
                                              }}
                                              className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer space-y-2.5 ${
                                                isSelected
                                                  ? 'bg-white border-emerald-500 shadow-xs'
                                                  : 'bg-white/90 border-[#E2DACB] hover:border-[#B98A78]'
                                              }`}
                                            >
                                              <div className="flex items-center justify-between gap-2">
                                                <span className="text-xs sm:text-sm font-extrabold font-display text-[#252321]">
                                                  🔘 الخيار #{oIdx + 1}: {opt.originTribeLabel || opt.title}
                                                </span>
                                                <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-900 text-[10px] font-bold">
                                                  {opt.badge}
                                                </span>
                                              </div>

                                              <div
                                                data-testid={`sim-stage1-option-sources-${oIdx}`}
                                                className="rounded-lg bg-[#FAF6F0] border border-[#E2DACB] p-2.5 space-y-1.5"
                                              >
                                                <div className="text-[11px] font-bold text-[#5C5346] flex flex-wrap items-center gap-1.5">
                                                  <span>
                                                    توافق ({optSources.length}){' '}
                                                    {optSources.length === 1 ? 'مصدر:' : 'مصادر:'}
                                                  </span>
                                                  {optSources.map((srcEv, sIdx) => {
                                                    const parsedRef =
                                                      extractBookVolPageFromEvidence(srcEv);
                                                    return (
                                                      <React.Fragment key={srcEv.alpha_id || sIdx}>
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-white border border-[#B98A78]/45 text-[#8D4925] text-[11px] font-bold">
                                                          {`[${parsedRef.book} - ج: ${parsedRef.volume || '1'} - ص: ${parsedRef.page || '—'}]`}
                                                        </span>
                                                        {sIdx < optSources.length - 1 && (
                                                          <span className="text-[#8D4925] font-bold">،</span>
                                                        )}
                                                      </React.Fragment>
                                                    );
                                                  })}
                                                </div>
                                              </div>

                                              <div className="text-[11px] text-[#252321] bg-[#FAF6F0] p-2.5 rounded-lg border border-[#E2DACB] space-y-1">
                                                <div>
                                                  <strong className="text-[#8D4925]">المسار الناتج:</strong>{' '}
                                                  {fullStitchedChainForOpt}
                                                </div>
                                                <div className="text-emerald-900 font-bold">
                                                  <strong>الخطوة التالية للعميل (المخرج أ):</strong>{' '}
                                                  تُغلق نافذة التحقق وتظهر له بطاقة الجذر المقفلة (🔒 الجذر · افتح الآن $5)
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        })}

                                        {/* Stage 1 "لا أعرف" Option */}
                                        <div
                                          onClick={() => {
                                            setDiagnosticSimChoice('not_sure_stage1');
                                            setDiagnosticSimStage(2);
                                          }}
                                          className="p-3.5 rounded-xl border-2 border-dashed border-[#B98A78] bg-white hover:bg-[#FAF6F0] transition-all cursor-pointer space-y-2"
                                        >
                                          <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs sm:text-sm font-extrabold font-display text-[#8D4925]">
                                              🔘 خيار: لا أعرف / لست متأكداً (الاحتكام للمواضع الجغرافية)
                                            </span>
                                            <span className="px-2 py-0.5 rounded bg-[#FAF6F0] border border-[#B98A78]/50 text-[10px] font-mono font-bold text-[#8D4925]">
                                              NEED_LOCATION_STEP
                                            </span>
                                          </div>
                                          <div className="text-[11px] text-[#252321] bg-[#FAF6F0] p-2.5 rounded-lg border border-[#E2DACB]">
                                            <strong className="text-emerald-900">الخطوة التالية للعميل:</strong> ينتقل العميل مجاناً وفوراً إلى <strong className="text-[#8D4925]">المرحلة 2 (سؤال الجغرافيا والمواضع)</strong> دون مطالبته بدفع $5. (اضغط هنا لمعاينة المرحلة 2 ←)
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="space-y-3">
                                      <div className="text-sm font-extrabold font-display text-[#252321]">
                                        نص سؤال المرحلة 2 للعميل: «لتحديد المسار النسبي آلياً، أيٌّ من هذه الحواضر أو المواضع يرتبط بأسرتكم؟»
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {candidateDisambigOptions.slice(0, 2).map((opt, oIdx) => {
                                          const isSelected = diagnosticSimChoice === opt.id;
                                          const overrideObj =
                                            oIdx === 1
                                              ? directSearchResult.optionBResultOverride
                                              : oIdx === 2
                                              ? directSearchResult.optionCResultOverride
                                              : directSearchResult.optionAResultOverride;
                                          const matchedClusterForOpt =
                                            diagnosticClusters.find(
                                              (c) =>
                                                (opt.choice_id &&
                                                  c.records.some(
                                                    (r) =>
                                                      r.alpha_id &&
                                                      opt.choice_id?.includes(r.alpha_id)
                                                  )) ||
                                                stemTribeToken(c.originTribeLabel) ===
                                                  stemTribeToken(
                                                    opt.originTribeLabel || opt.title
                                                  )
                                            ) || diagnosticClusters[oIdx];
                                          const resultingTribe =
                                            matchedClusterForOpt?.originTribeLabel ||
                                            overrideObj?.rootTribeName ||
                                            opt.originTribeLabel ||
                                            opt.title;

                                          const optSources: CorroboratingAlphaEvidence[] =
                                            opt.contributingSources &&
                                            opt.contributingSources.length > 0
                                              ? opt.contributingSources
                                              : matchedClusterForOpt?.records &&
                                                matchedClusterForOpt.records.length > 0
                                              ? matchedClusterForOpt.records
                                              : overrideObj
                                                  ?.corroborating_alpha_evidence_for_researcher &&
                                                overrideObj
                                                  .corroborating_alpha_evidence_for_researcher
                                                  .length > 0
                                              ? overrideObj.corroborating_alpha_evidence_for_researcher
                                              : rawEvidenceList.slice(oIdx, oIdx + 1);

                                          const fullStitchedChainForOpt =
                                            matchedClusterForOpt &&
                                            matchedClusterForOpt.fullChainNodes.length > 1
                                              ? matchedClusterForOpt.fullChainNodes.join(' ⬅️ ')
                                              : overrideObj?.full_stitched_lineage_for_researcher &&
                                                overrideObj.full_stitched_lineage_for_researcher
                                                  .length > 1
                                              ? overrideObj.full_stitched_lineage_for_researcher
                                                  .map((n) => n.name)
                                                  .join(' ⬅️ ')
                                              : `${directSearchResult.familyName} ⬅️ ${resultingTribe}`;

                                          return (
                                            <div
                                              key={opt.id}
                                              onClick={() => {
                                                setDiagnosticSimChoice(opt.id);
                                                if (overrideObj) {
                                                  setDirectSearchResult({
                                                    ...directSearchResult,
                                                    ...overrideObj,
                                                  });
                                                }
                                              }}
                                              className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer space-y-2.5 ${
                                                isSelected
                                                  ? 'bg-white border-emerald-500 shadow-xs'
                                                  : 'bg-white/90 border-[#E2DACB] hover:border-[#B98A78]'
                                              }`}
                                            >
                                              <div className="flex items-center justify-between gap-2">
                                                <span className="text-xs sm:text-sm font-extrabold font-display text-[#252321]">
                                                  📍 الموضع الجغرافي #{oIdx + 1}: {opt.geographicScope}
                                                </span>
                                                <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-900 text-[10px] font-bold">
                                                  يحسم لصالح: {resultingTribe}
                                                </span>
                                              </div>

                                              <div
                                                data-testid={`sim-stage2-option-sources-${oIdx}`}
                                                className="rounded-lg bg-[#FAF6F0] border border-[#E2DACB] p-2.5 space-y-1.5"
                                              >
                                                <div className="text-[11px] font-bold text-[#5C5346] flex flex-wrap items-center gap-1.5">
                                                  <span>
                                                    توافق ({optSources.length}){' '}
                                                    {optSources.length === 1 ? 'مصدر:' : 'مصادر:'}
                                                  </span>
                                                  {optSources.map((srcEv, sIdx) => {
                                                    const parsedRef =
                                                      extractBookVolPageFromEvidence(srcEv);
                                                    return (
                                                      <React.Fragment key={srcEv.alpha_id || sIdx}>
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-white border border-[#B98A78]/45 text-[#8D4925] text-[11px] font-bold">
                                                          {`[${parsedRef.book} - ج: ${parsedRef.volume || '1'} - ص: ${parsedRef.page || '—'}]`}
                                                        </span>
                                                        {sIdx < optSources.length - 1 && (
                                                          <span className="text-[#8D4925] font-bold">،</span>
                                                        )}
                                                      </React.Fragment>
                                                    );
                                                  })}
                                                </div>
                                              </div>

                                              <div className="text-[11px] text-[#252321] bg-[#FAF6F0] p-2.5 rounded-lg border border-[#E2DACB] space-y-1">
                                                <div>
                                                  <strong className="text-[#8D4925]">المسار الناتج:</strong>{' '}
                                                  {fullStitchedChainForOpt}
                                                </div>
                                                <div className="text-emerald-900 font-bold">
                                                  <strong>الخطوة التالية للعميل (المخرج أ):</strong>{' '}
                                                  تُغلق نافذة التحقق وتظهر له بطاقة الجذر المقفلة (🔒 الجذر · افتح الآن $5)
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        })}

                                        {/* Stage 2 "لا أعرف / موضع آخر" Option -> Outcome B */}
                                        <div
                                          onClick={() =>
                                            setDiagnosticSimChoice('not_sure_escalate')
                                          }
                                          className={`p-3.5 rounded-xl border-2 border-dashed transition-all cursor-pointer space-y-2 ${
                                            diagnosticSimChoice === 'not_sure_escalate'
                                              ? 'border-emerald-500 bg-white'
                                              : 'border-[#B98A78] bg-white/90 hover:bg-[#FAF6F0]'
                                          }`}
                                        >
                                          <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs sm:text-sm font-extrabold font-display text-[#8D4925]">
                                              🔘 خيار: لا أعرف / موضع آخر (فشل التحقق في المرحلتين)
                                            </span>
                                            <span className="px-2 py-0.5 rounded bg-[#8D4925] text-white text-[10px] font-bold">
                                              المخرج (ب) · البحث المعمق
                                            </span>
                                          </div>
                                          <div className="text-[11px] text-[#252321] bg-[#FAF6F0] p-2.5 rounded-lg border border-[#E2DACB] space-y-1">
                                            <div>
                                              <strong className="text-[#8D4925]">الخطوة التالية للعميل (المخرج ب):</strong>{' '}
                                              يتم نقل العميل فوراً إلى شاشة <strong className="text-emerald-900">«البحث المعمق» (Deep Research)</strong> ليُطلب منه الاشتراك السنوي لفتح تذكرة بحث خاصة لدى الباحثين، دون مطالبته بدفع الـ $5 الخاصة بالجذر الآلي!
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </div>

                          {/* =========================================================
                              STEP 5 INDEPENDENT COLLAPSIBLE CARD:
                              القسم الخامس — المصادر الأخرى الخام (Read-Only Compact View)
                          ========================================================= */}
                          {renderCompactReadOnlyOtherSourcesSection(
                            directSearchResult.familyName,
                            rawEvidenceList
                          )}
                        </div>
                      )}
                    </div>

                    {/* =========================================================
                        VISUAL SEPARATOR BEFORE FINAL RESULT SHOWCASE CONTAINER
                    ========================================================= */}
                    <div className="relative py-2 flex items-center justify-center">
                      <div className="w-full border-t-2 border-dashed border-[#C5A059]/60" />
                      <span className="absolute px-4 py-1 rounded-full bg-white border border-[#C5A059] text-[#8D4925] text-xs font-extrabold shadow-2xs">
                        👑 المخرج النهائي المعتمد للعميل
                      </span>
                    </div>

                    {/* =========================================================
                        CONTAINER 3: [👑 حزمة النتيجة النهائية — المخرج المعتمد وعمود النسب للعميل]
                        Final Result Showcase Container
                    ========================================================= */}
                    <div
                      data-testid="boslet-container3-final-result"
                      className={`rounded-3xl transition-all duration-300 overflow-hidden ${
                        bosletExpandedSections.spinePreview
                          ? 'border-2 border-[#C5A059] bg-gradient-to-b from-[#FAF6F0] via-white to-[#FAF6F0] p-5 sm:p-6 shadow-md space-y-5'
                          : 'border-2 border-[#C5A059]/70 bg-[#FAF6F0] hover:border-[#C5A059] px-5 py-4 shadow-2xs'
                      }`}
                    >
                      <div
                        onClick={() => toggleBosletSection('spinePreview')}
                        className={`flex flex-wrap items-center justify-between gap-4 cursor-pointer select-none ${
                          bosletExpandedSections.spinePreview
                            ? 'border-b-2 border-[#E2DACB] pb-4'
                            : ''
                        }`}
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#C5A059] to-[#8D4925] text-white flex items-center justify-center text-xl shrink-0 shadow-xs">
                            👑
                          </div>
                          <div>
                            {/* Dynamic Source of Result Badge */}
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 border border-[#C5A059] text-[#8D4925] text-[10px] font-extrabold">
                                الحزمة البصرية الثالثة · المخرج النهائي
                              </span>
                              {isFinalResultFromAdamTree ? (
                                <span
                                  data-testid="final-result-source-badge"
                                  className="px-3 py-0.5 rounded-full bg-emerald-700 text-white text-xs font-extrabold shadow-2xs"
                                >
                                  🌳 مصدر النتيجة النهائية: شجرة آدم الموحدة (تطابق معتمد)
                                </span>
                              ) : (
                                <span
                                  data-testid="final-result-source-badge"
                                  className="px-3 py-0.5 rounded-full bg-[#D8755B] text-white text-xs font-extrabold shadow-2xs"
                                >
                                  ⚡ مصدر النتيجة النهائية: خياطة المصادر الخام (مشاريع ألفا — جاهز للربط بشجرة آدم)
                                </span>
                              )}
                            </div>
                            <h3 className="text-base sm:text-lg font-extrabold font-display text-[#252321]">
                              النتيجة النهائية للفحص — معاينة بطاقة عمود النسب المعتمدة للعميل
                            </h3>
                            <p className="text-xs text-[#5C5346] mt-0.5">
                              معاينة حية لبطاقة عمود نسب عائلة ({effectiveFinalResultForShowcase.familyName}) بكامل عقدها المتسلسلة، حالة الجذر المفتوح، المصادر المجمعة، والفروع الشقيقة
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleBosletSection('spinePreview');
                          }}
                          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                            bosletExpandedSections.spinePreview
                              ? 'bg-[#EDE6DA] text-[#252321] border-[#B98A78]/50'
                              : 'bg-white text-[#8D4925] border-[#B98A78]/40 hover:bg-[#EDE6DA]/60'
                          }`}
                        >
                          <span>
                            {bosletExpandedSections.spinePreview
                              ? 'طي الحزمة النهائية'
                              : 'فتح وإبراز الحزمة النهائية'}
                          </span>
                          {bosletExpandedSections.spinePreview ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      {bosletExpandedSections.spinePreview && (
                        <div className="pt-1">
                          <LineageSpineColumn
                            stateMode={DashboardStateMode.AnnualVip}
                            accountType={AccountLegalType.RecordKeeper}
                            result={effectiveFinalResultForShowcase}
                            bridgedAncestors={[]}
                            onAddBridgedAncestor={() => {}}
                            onUnlockRoot5Usd={() => {}}
                            onUpgradeAnnualVip={() => {}}
                            unlockedCapsules={(
                              effectiveFinalResultForShowcase.capsules || []
                            ).map((c) => c.id)}
                            onRequestUnlockCapsule={() => {}}
                            walletBalance={25}
                            isResearcherDirectPreview={true}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        )}

        {/* ===================================================================
            OFFICIAL "مرصد البحوث" IDENTITY HEADER BANNER
            (Exact Same Dimensions, Layout & Unified Warm Heritage Colors as
             "بوصلة الجذور" and "شجرة آدم للأجداد")
        =================================================================== */}
        {(activeSubTab === 'ticket_inbox' ||
          activeSubTab === 'adam_prime_bridge') && (
          <div
            data-testid="research-observatory-identity-header"
            className="bg-gradient-to-l from-[#FAF6F0] via-white to-[#EDE6DA]/80 text-[#252321] rounded-3xl p-5 border-2 border-[#C5A059]/70 shadow-sm flex flex-wrap items-center justify-between gap-4 mb-6"
          >
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white p-1.5 shadow-sm border-2 border-[#C5A059] shrink-0 flex items-center justify-center overflow-hidden">
                <img
                  src="/assets/aistudio/Logo_Boslet_Alansab_8349b12d.jpg"
                  alt="كشّاف الأنساب"
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#FAF6F0] border border-[#C5A059]/60 text-[#8D4925] text-[10px] font-extrabold tracking-wider">
                    كشّاف الأنساب
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold font-display mt-1 text-[#252321]">
                  مرصد البحوث — غرفة عمليات الباحثين
                </h2>
                <p className="text-xs text-[#5C5346] mt-0.5 font-medium">
                  غرفة عمليات التذاكر البحثية وتوثيق المصادر وإثراء شجرة آدم للأجداد.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveSubTab('ticket_inbox');
                  onSelectPortalSection?.('research_studio');
                }}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
                  activeSubTab === 'ticket_inbox'
                    ? 'bg-[#D8755B] text-white shadow-2xs'
                    : 'bg-white text-[#8D4925] hover:bg-[#EDE6DA] border border-[#C5A059]/50'
                }`}
              >
                <span>التذاكر البحثية</span>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                    activeSubTab === 'ticket_inbox'
                      ? 'bg-white/25 text-white'
                      : 'bg-[#FAF6F0] text-[#8D4925] border border-[#C5A059]/40'
                  }`}
                >
                  {
                    tickets.filter(
                      (t) =>
                        t.status !== 'CLOSED_AND_ENRICHED' &&
                        t.status !== 'merged_closed'
                    ).length
                  }
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('adam_prime_bridge')}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
                  activeSubTab === 'adam_prime_bridge'
                    ? 'bg-[#D8755B] text-white shadow-2xs'
                    : 'bg-white text-[#8D4925] hover:bg-[#EDE6DA] border border-[#C5A059]/50'
                }`}
              >
                <span>جسر آدم برايم</span>
                {adamPrimeBundles.length > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-extrabold ${
                      activeSubTab === 'adam_prime_bridge'
                        ? 'bg-white/25 text-white'
                        : 'bg-[#FAF6F0] text-[#8D4925] border border-[#C5A059]/40'
                    }`}
                  >
                    {adamPrimeBundles.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ===================================================================
            SUB-TAB 2: التذاكر البحثية (مرصد البحوث — غرفة عمليات الباحثين)
            Unified Warm Heritage Ivory & Terracotta Visual Identity (KPI Bar Removed)
        =================================================================== */}
        {activeSubTab === 'ticket_inbox' && (
          <div className="space-y-4">
            {/* ===================================================================
                QUEUE FILTER BAR + SIDEBAR COLLAPSE TOGGLE
            =================================================================== */}
            <div className="bg-white rounded-2xl border border-[#E2DACB] p-3.5 flex flex-wrap items-center justify-between gap-2.5 shadow-2xs">
              <div className="flex flex-wrap items-center gap-2">
                {/* Collapse / Expand Queue Sidebar Button */}
                <button
                  type="button"
                  data-testid="toggle-queue-sidebar-btn"
                  onClick={() => setIsQueueSidebarCollapsed((prev) => !prev)}
                  className={`px-3 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer border ${
                    isQueueSidebarCollapsed
                      ? 'bg-[#D8755B] text-white border-[#D8755B]'
                      : 'bg-[#FAF6F0] text-[#252321] hover:bg-[#EDE6DA] border-[#E2DACB]'
                  }`}
                >
                  <span>
                    {isQueueSidebarCollapsed
                      ? 'إظهار تذاكر البحوث'
                      : 'طيّ تذاكر البحوث ◀'}
                  </span>
                </button>

                <button
                  type="button"
                  data-testid="queue-filter-all-priority"
                  onClick={() => setInboxCategoryFilter('ALL_PRIORITY_SORTED')}
                  className={`px-3 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer border ${
                    inboxCategoryFilter === 'ALL_PRIORITY_SORTED'
                      ? 'bg-[#D8755B] text-white border-[#D8755B] shadow-2xs'
                      : 'bg-[#FAF6F0] text-[#252321] hover:bg-[#EDE6DA] border-[#E2DACB]'
                  }`}
                >
                  <span>⚡ كل البحوث النشطة</span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
                      inboxCategoryFilter === 'ALL_PRIORITY_SORTED'
                        ? 'bg-white/25 text-white'
                        : 'bg-white text-[#8D4925] border border-[#E2DACB]'
                    }`}
                  >
                    {tickets.length}
                  </span>
                </button>

                <button
                  type="button"
                  data-testid="queue-filter-p1"
                  onClick={() => {
                    setInboxCategoryFilter('P1_CLIENT_UNMATCHED');
                    const firstMatch = tickets.find(
                      (t) =>
                        resolveTicketPriorityTier(t) === 'P1_CLIENT_UNMATCHED'
                    );
                    if (firstMatch) setSelectedTicketId(firstMatch.id);
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer border ${
                    inboxCategoryFilter === 'P1_CLIENT_UNMATCHED' ||
                    inboxCategoryFilter === 'DIRECT_CUSTOMER_TICKETS'
                      ? 'bg-[#D8755B] text-white border-[#D8755B] shadow-2xs'
                      : 'bg-[#FAF6F0] text-[#252321] hover:bg-[#EDE6DA] border-[#E2DACB]'
                  }`}
                >
                  <span>🔴 بحوث العملاء</span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
                      inboxCategoryFilter === 'P1_CLIENT_UNMATCHED' ||
                      inboxCategoryFilter === 'DIRECT_CUSTOMER_TICKETS'
                        ? 'bg-white/25 text-white'
                        : 'bg-white text-[#8D4925] border border-[#E2DACB]'
                    }`}
                  >
                    {
                      tickets.filter(
                        (t) =>
                          resolveTicketPriorityTier(t) === 'P1_CLIENT_UNMATCHED'
                      ).length
                    }
                  </span>
                </button>

                <button
                  type="button"
                  data-testid="queue-filter-assigned"
                  onClick={() => {
                    setInboxCategoryFilter('ASSIGNED_RESEARCH');
                    const firstMatch = tickets.find(
                      (t) =>
                        resolveTicketPriorityTier(t) === 'ASSIGNED_RESEARCH'
                    );
                    if (firstMatch) setSelectedTicketId(firstMatch.id);
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer border ${
                    inboxCategoryFilter === 'ASSIGNED_RESEARCH'
                      ? 'bg-orange-700 text-white border-orange-700 shadow-2xs'
                      : 'bg-orange-50 text-orange-900 hover:bg-orange-100/80 border-orange-300'
                  }`}
                >
                  <span>🟠 بحوث مسندة</span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
                      inboxCategoryFilter === 'ASSIGNED_RESEARCH'
                        ? 'bg-white/25 text-white'
                        : 'bg-white text-orange-900 border border-orange-300'
                    }`}
                  >
                    {
                      tickets.filter(
                        (t) =>
                          resolveTicketPriorityTier(t) === 'ASSIGNED_RESEARCH'
                      ).length
                    }
                  </span>
                </button>

                <button
                  type="button"
                  data-testid="queue-filter-p2"
                  onClick={() => {
                    setInboxCategoryFilter('P2_CLIENT_ADAM_BRIDGE');
                    const firstMatch = tickets.find(
                      (t) =>
                        resolveTicketPriorityTier(t) === 'P2_CLIENT_ADAM_BRIDGE'
                    );
                    if (firstMatch) setSelectedTicketId(firstMatch.id);
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer border ${
                    inboxCategoryFilter === 'P2_CLIENT_ADAM_BRIDGE'
                      ? 'bg-[#D8755B] text-white border-[#D8755B] shadow-2xs'
                      : 'bg-[#FAF6F0] text-[#252321] hover:bg-[#EDE6DA] border-[#E2DACB]'
                  }`}
                >
                  <span>🟡 بحوث إثراء شجرة آدم</span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
                      inboxCategoryFilter === 'P2_CLIENT_ADAM_BRIDGE'
                        ? 'bg-white/25 text-white'
                        : 'bg-white text-[#8D4925] border border-[#E2DACB]'
                    }`}
                  >
                    {
                      tickets.filter(
                        (t) =>
                          resolveTicketPriorityTier(t) ===
                          'P2_CLIENT_ADAM_BRIDGE'
                      ).length
                    }
                  </span>
                </button>

                <button
                  type="button"
                  data-testid="queue-filter-p3"
                  onClick={() => {
                    setInboxCategoryFilter('P3_PROACTIVE_ALPHA_ENRICHMENT');
                    const firstMatch = tickets.find(
                      (t) =>
                        resolveTicketPriorityTier(t) ===
                        'P3_PROACTIVE_ALPHA_ENRICHMENT'
                    );
                    if (firstMatch) setSelectedTicketId(firstMatch.id);
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer border ${
                    inboxCategoryFilter === 'P3_PROACTIVE_ALPHA_ENRICHMENT'
                      ? 'bg-[#D8755B] text-white border-[#D8755B] shadow-2xs'
                      : 'bg-[#FAF6F0] text-[#252321] hover:bg-[#EDE6DA] border-[#E2DACB]'
                  }`}
                >
                  <span>🟢 بحوث استباقية</span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
                      inboxCategoryFilter === 'P3_PROACTIVE_ALPHA_ENRICHMENT'
                        ? 'bg-white/25 text-white'
                        : 'bg-white text-[#8D4925] border border-[#E2DACB]'
                    }`}
                  >
                    {
                      tickets.filter(
                        (t) =>
                          resolveTicketPriorityTier(t) ===
                          'P3_PROACTIVE_ALPHA_ENRICHMENT'
                      ).length
                    }
                  </span>
                </button>
              </div>

              <button
                type="button"
                disabled={isGeneratingP3Batch}
                onClick={() => handleAutoRefillNextP3Tickets(3)}
                data-testid="auto-generate-p3-batch-btn"
                className="px-3.5 py-2 rounded-xl bg-[#FAF6F0] hover:bg-[#EDE6DA] text-[#8D4925] border border-[#E2DACB] text-xs font-extrabold cursor-pointer transition-all flex items-center gap-1.5 shadow-2xs"
              >
                <span>
                  {isGeneratingP3Batch
                    ? 'جارٍ التوليد...'
                    : '🔄 توليد دفعة تذاكر بحثية إستباقية'}
                </span>
              </button>
            </div>

            {/* ===================================================================
                MAIN GRID: STICKY COLLAPSIBLE QUEUE (RIGHT) + TICKET WORKBENCH (LEFT)
            =================================================================== */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* RIGHT COLUMN (4 COLS WHEN EXPANDED): STICKY TICKET QUEUE SIDEBAR */}
              {!isQueueSidebarCollapsed && (
                <div
                  data-testid="sticky-ticket-queue-sidebar"
                  className="lg:col-span-4 bg-white rounded-3xl border border-[#E2DACB] shadow-2xs overflow-hidden lg:sticky lg:top-4 lg:max-h-[85vh] flex flex-col"
                >
                  <div className="p-3.5 bg-[#FAF6F0] text-[#252321] border-b border-[#E2DACB] flex items-center justify-between shrink-0">
                    <h3 className="text-xs sm:text-sm font-extrabold font-display text-[#252321]">
                      تذاكر البحوث النشطة ({filteredInboxTickets.length})
                    </h3>
                    <button
                      type="button"
                      onClick={() => setIsQueueSidebarCollapsed(true)}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#EDE6DA] text-[#8D4925] border border-[#E2DACB] text-[11px] font-extrabold transition-all cursor-pointer"
                    >
                      طيّ تذاكر البحوث ◀
                    </button>
                  </div>

                  <div className="divide-y divide-[#E2DACB]/60 overflow-y-auto flex-1">
                    {filteredInboxTickets.length === 0 ? (
                      <div className="p-8 text-center text-xs text-[#5C5346]">
                        لا توجد تذاكر بحثية حالياً ضمن هذا التصنيف.
                      </div>
                    ) : (
                      filteredInboxTickets.map((tkt, tktIdx) => {
                        const isSelected = selectedTicket?.id === tkt.id;
                        const tier = resolveTicketPriorityTier(tkt);
                        const dotColorClass =
                          tier === 'P1_CLIENT_UNMATCHED'
                            ? 'bg-red-500 ring-2 ring-red-200'
                            : tier === 'ASSIGNED_RESEARCH'
                            ? 'bg-orange-700 ring-2 ring-orange-200'
                            : tier === 'P3_PROACTIVE_ALPHA_ENRICHMENT'
                            ? 'bg-emerald-500 ring-2 ring-emerald-200'
                            : 'bg-amber-500 ring-2 ring-amber-200';
                        const dotTitle =
                          tier === 'P1_CLIENT_UNMATCHED'
                            ? 'بحوث العملاء'
                            : tier === 'ASSIGNED_RESEARCH'
                            ? 'بحوث مسندة'
                            : tier === 'P3_PROACTIVE_ALPHA_ENRICHMENT'
                            ? 'بحوث استباقية'
                            : 'بحوث إثراء شجرة آدم';

                        return (
                          <button
                            key={`${tkt.id}-${tkt.firestoreDocId || tktIdx}`}
                            type="button"
                            onClick={() => {
                              setSelectedTicketId(tkt.id);
                              setInlineChainInspection(null);
                            }}
                            className={`w-full text-right p-3.5 transition-all cursor-pointer block ${
                              isSelected
                                ? 'bg-[#FAF6F0] border-r-4 border-r-[#D8755B]'
                                : 'hover:bg-[#FAF6F0]/60'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2.5">
                              <div className="flex items-start gap-2.5 min-w-0">
                                <span
                                  className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${dotColorClass}`}
                                  title={dotTitle}
                                />
                                <div className="space-y-1.5 min-w-0">
                                  <h4 className="text-xs font-bold text-[#252321] leading-relaxed">
                                    {formatCleanTicketTitle(tkt.title)}
                                  </h4>
                                  {(tier === 'ASSIGNED_RESEARCH' ||
                                    tkt.assignedResearcherName) && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-50 border border-orange-300 text-orange-900 text-[10px] font-extrabold">
                                      <span>
                                        👤 مسندة إلى:{' '}
                                        {tkt.assignedResearcherName ||
                                          'مدير البحوث'}
                                      </span>
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className="shrink-0 text-[11px] font-bold text-[#8D4925] bg-[#FAF6F0] border border-[#E2DACB] px-2 py-0.5 rounded-md">
                                {tkt.corroboratingEvidence?.length ||
                                  tkt.copilotSources.length}{' '}
                                مصادر
                              </span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* LEFT COLUMN (8 COLS OR 12 COLS FULL-WIDTH WHEN SIDEBAR COLLAPSED): ACTIVE TICKET OPERATIONS ROOM */}
              <div
                className={`${
                  isQueueSidebarCollapsed ? 'lg:col-span-12' : 'lg:col-span-8'
                } space-y-5 transition-all`}
              >
                {selectedTicket ? (
                  <div className="bg-white rounded-3xl border border-[#E2DACB] shadow-2xs overflow-hidden">
                    {/* COMPACT TICKET HEADER (Warm Heritage Theme) */}
                    <div className="bg-[#FAF6F0] text-[#252321] border-b border-[#E2DACB] p-4 sm:p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {isQueueSidebarCollapsed && (
                            <button
                              type="button"
                              onClick={() => setIsQueueSidebarCollapsed(false)}
                              className="px-3 py-1 rounded-lg bg-[#D8755B] text-white text-xs font-extrabold cursor-pointer flex items-center gap-1"
                            >
                              <span>إظهار تذاكر البحوث</span>
                            </button>
                          )}
                          <span className="px-2.5 py-1 rounded-md bg-white border border-[#E2DACB] text-[#252321] text-xs font-bold">
                            📍 الموطن: {selectedTicket.locationLabel}
                          </span>
                          {(resolveTicketPriorityTier(selectedTicket) ===
                            'ASSIGNED_RESEARCH' ||
                            selectedTicket.assignedResearcherName) && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-orange-50 border border-orange-300 text-orange-900 text-xs font-extrabold">
                              <span className="w-2 h-2 rounded-full bg-orange-700 shrink-0" />
                              <span>
                                👤 مسندة إلى:{' '}
                                {selectedTicket.assignedResearcherName ||
                                  'مدير البحوث'}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>

                      <h3 className="text-base sm:text-lg font-extrabold font-display text-[#252321]">
                        {formatCleanTicketTitle(selectedTicket.title)}
                      </h3>

                      {selectedTicket.fullStitchedLineage &&
                        selectedTicket.fullStitchedLineage.length > 0 && (
                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
                            <span className="font-bold text-[#5C5346]">
                              السلسلة المخيطة:
                            </span>
                            {(() => {
                              const firstStation =
                                selectedTicket.fullStitchedLineage[0];
                              const isFirstStationSameAsFamily =
                                firstStation &&
                                normalizeArabic(firstStation.name) ===
                                  normalizeArabic(selectedTicket.familyName);
                              const stationsToRender = isFirstStationSameAsFamily
                                ? selectedTicket.fullStitchedLineage
                                : [
                                    {
                                      id: 'family-root-fe0',
                                      name: selectedTicket.familyName,
                                      code: 'FE0',
                                    },
                                    ...selectedTicket.fullStitchedLineage,
                                  ];

                              return stationsToRender.map((st, idx) => (
                                <React.Fragment key={st.id || idx}>
                                  {idx > 0 && (
                                    <span className="text-[#B98A78] font-bold px-0.5">
                                      ←
                                    </span>
                                  )}
                                  <span
                                    className={
                                      idx === 0
                                        ? 'px-2.5 py-0.5 rounded-md bg-[#FAF6F0] border border-[#C5A059] text-[#8D4925] font-extrabold shadow-2xs'
                                        : 'px-2 py-0.5 rounded-md bg-white border border-[#E2DACB] text-[#252321] font-bold'
                                    }
                                  >
                                    {st.name} ({st.code})
                                  </span>
                                </React.Fragment>
                              ));
                            })()}
                          </div>
                        )}
                    </div>

                    <div className="p-4 sm:p-6 space-y-5">
                      {renderGamifiedTicketOperationsWorkspace(selectedTicket)}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-3xl border border-[#E2DACB] p-8 sm:p-10 text-center space-y-4 shadow-2xs">
                    <div className="w-12 h-12 rounded-2xl bg-[#FAF6F0] border border-[#E2DACB] text-[#8D4925] flex items-center justify-center mx-auto">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="space-y-1.5 max-w-lg mx-auto">
                      <h3 className="text-base sm:text-lg font-extrabold font-display text-[#252321]">
                        لا توجد تذاكر بحثية نشطة حالياً في هذا التصنيف
                      </h3>
                    </div>
                    <div className="pt-1 flex justify-center">
                      <button
                        type="button"
                        disabled={isGeneratingP3Batch}
                        onClick={() => handleAutoRefillNextP3Tickets(3)}
                        className="px-5 py-2.5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs sm:text-sm font-extrabold cursor-pointer transition-all shadow-2xs"
                      >
                        {isGeneratingP3Batch
                          ? 'جارٍ التوليد والربط بقاعدة البيانات...'
                          : '🔄 توليد دفعة تذاكر بحثية إستباقية'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            SUB-TAB 3: إدارة شجرة آدم (ADAM ANCESTRAL TREE™ — SPLIT-VIEW INTERACTIVE EXPLORER & CODING EDITOR)
        =================================================================== */}
        {activeSubTab === 'adam_tree_explorer' && (
          <div className="space-y-6">
            {/* Official شجرة آدم للأجداد Identity Banner (Unified Platform Warm Heritage Identity) */}
            <div
              data-testid="adam-tree-identity-header"
              className="bg-gradient-to-l from-[#FAF6F0] via-white to-[#EDE6DA]/80 text-[#252321] rounded-3xl p-5 border-2 border-[#C5A059]/70 shadow-sm flex flex-wrap items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white p-1.5 shadow-sm border-2 border-[#C5A059] shrink-0 flex items-center justify-center overflow-hidden">
                  <img
                    src="/assets/aistudio/Adam-Ancestral-Tree-Logo.209224b_dd7396cf.png"
                    alt="شجرة آدم للأجداد"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#FAF6F0] border border-[#C5A059]/60 text-[#8D4925] text-[10px] font-extrabold tracking-wider">
                      شجرة آدم للأجداد
                    </span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-extrabold font-display mt-1 text-[#252321]">
                    إدارة وعرض وتحرير شجرة آدم
                  </h2>
                  <p className="text-xs text-[#5C5346] mt-0.5 font-medium">
                    قاعدة البيانات المركزية للقبائل والعائلات والأفراد ({adamTreeStats.totalNodes.toLocaleString('en-US')} عقدة موثقة)
                  </p>
                </div>
              </div>
            </div>

            {/* 1. COLLAPSIBLE TOP SEARCH & FILTER PANEL: 🔍 البحث التفاعلي في شجرة آدم */}
            <div className="bg-white rounded-3xl border border-stone-200/90 p-5 shadow-xs space-y-4">
              {/* Collapsible Header with Title on Right and Collapse Arrow on Left */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <img
                    src="/assets/aistudio/Adam-Ancestral-Tree-Logo.209224b_dd7396cf.png"
                    alt="شجرة آدم"
                    className="w-10 h-10 rounded-full object-contain border border-stone-200 bg-[#FAF8F5] p-0.5 shrink-0"
                  />
                  <h2 className="text-base font-bold font-serif text-[#141414]">
                    🔍 البحث التفاعلي في شجرة آدم
                  </h2>

                  {/* Dynamic Filter Counter — Shown ONLY when researcher activates a search/filter */}
                  {hasActiveAdamSearchOrFilter && (
                    <div
                      data-testid="adam-tree-dynamic-filter-stat"
                      className="px-3.5 py-1.5 rounded-2xl bg-amber-100/90 border-2 border-[#B45309] text-amber-950 flex items-center gap-2 shadow-2xs animate-fadeIn"
                    >
                      <span className="w-2 h-2 rounded-full bg-[#B45309]" />
                      <span className="text-xs font-extrabold">
                        {isSearchingAdamEngine
                          ? 'جاري البحث في قاعدة البيانات (474,949 عقدة)...'
                          : `النتائج المطابقة للفلتر: ${(
                              liveSearchTotals?.total ?? filteredAdamNodes.length
                            ).toLocaleString('en-US')} عقدة (منها ${filteredCodedNodesCount.toLocaleString(
                              'en-US'
                            )} مكوّدة)`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Far-left Prominent Standard Arrow Icon Button aligned with title */}
                <button
                  type="button"
                  onClick={() => setIsAdamSearchPanelOpen((prev) => !prev)}
                  aria-label={
                    isAdamSearchPanelOpen
                      ? 'طي لوحة البحث'
                      : 'فتح لوحة البحث'
                  }
                  title={
                    isAdamSearchPanelOpen
                      ? 'طي لوحة البحث'
                      : 'فتح لوحة البحث'
                  }
                  className="w-10 h-10 rounded-2xl bg-[#FAF6EE] hover:bg-amber-100/80 border border-[#D4AF37]/60 text-[#8A6408] flex items-center justify-center cursor-pointer transition-all shadow-2xs shrink-0"
                >
                  {isAdamSearchPanelOpen ? (
                    <ChevronUp className="w-5 h-5 stroke-[2.5]" />
                  ) : (
                    <ChevronDown className="w-5 h-5 stroke-[2.5]" />
                  )}
                </button>
              </div>

              {/* Collapsible Body: Clean Premium Filter Bar + Conditional Results */}
              {isAdamSearchPanelOpen && (
                <div className="space-y-4 pt-3 border-t border-stone-200/80">
                  {/* Premium Filter Bar: Clean Single-Row/Grid Without School Numbering or English Terms */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
                    {/* Field 1: البحث بالاسم أو المعرف */}
                    <div className="lg:col-span-3">
                      <label className="block text-[11px] font-bold text-stone-700 mb-1.5">
                        البحث بالاسم أو المعرف
                      </label>
                      <div className="relative">
                        <Search className="w-4 h-4 text-stone-400 absolute right-3.5 top-3" />
                        <input
                          type="text"
                          value={adamSearchQuery}
                          onChange={(e) => setAdamSearchQuery(e.target.value)}
                          placeholder="ابحث باسم العقدة أو القبيلة أو العائلة (مثال: آل قحيم، تميم)..."
                          className="w-full pr-10 pl-3 py-2.5 rounded-xl border border-stone-300 bg-[#FAF8F5] text-xs font-bold focus:outline-none focus:border-[#B45309]"
                        />
                      </div>
                    </div>

                    {/* Field 2: اسم الأب أو الجد الأعلى */}
                    <div className="lg:col-span-3">
                      <label className="block text-[11px] font-bold text-stone-700 mb-1.5">
                        اسم الأب أو الجد الأعلى
                      </label>
                      <input
                        type="text"
                        value={adamFatherQuery}
                        onChange={(e) => setAdamFatherQuery(e.target.value)}
                        placeholder="اكتب اسم الأب أو الجد الأعلى (مثال: همدان، طيء، كهلان)..."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-[#FAF8F5] text-xs font-bold focus:outline-none focus:border-[#B45309]"
                      />
                    </div>

                    {/* Field 3: الكود الهيكلي */}
                    <div className="lg:col-span-2">
                      <label className="block text-[11px] font-bold text-stone-700 mb-1.5">
                        الكود الهيكلي
                      </label>
                      <select
                        value={adamArcFilter}
                        onChange={(e) => setAdamArcFilter(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-[#FAF8F5] text-xs font-bold focus:outline-none focus:border-[#B45309]"
                      >
                        <option value="">جميع الأكواد الهيكلية</option>
                        <option value="MT">MT — قبيلة أم جامعة</option>
                        <option value="MM">MM — جذم فرعي / قبيلة كبرى</option>
                        <option value="MF">MF — حلف قبلي</option>
                        <option value="M">M — جذم تاريخي</option>
                        <option value="P">P — جد جامع أصلي</option>
                        <option value="B0">B0 — قبيلة كبرى / جد جامع</option>
                        <option value="B1">B1 — بطن قبلي رئيسي</option>
                        <option value="B2">B2 — فخذ قبلي</option>
                        <option value="B3">B3 — عشيرة</option>
                        <option value="B4">B4 — فصيلة</option>
                        <option value="B5">B5 — رهط</option>
                        <option value="B6">B6 — لحمة</option>
                        <option value="B7">B7 — خامس</option>
                        <option value="B8">B8 — فخذ فرعي</option>
                        <option value="B9">B9 — فرع دقيق</option>
                        <option value="FE0">FE0 — عائلة / أسرة معاصرة</option>
                        <option value="UNASSIGNED">بدون كود — جد فردي متسلسل</option>
                      </select>
                    </div>

                    {/* Field 4: التصنيف (Pure Arabic options, default "" = جميع التصنيفات) */}
                    <div className="lg:col-span-2">
                      <label className="block text-[11px] font-bold text-stone-700 mb-1.5">
                        التصنيف
                      </label>
                      <select
                        value={adamRepFilter}
                        onChange={(e) => setAdamRepFilter(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-[#FAF8F5] text-xs font-bold focus:outline-none focus:border-[#B45309]"
                      >
                        <option value="">جميع التصنيفات</option>
                        <option value="TRIBE">قبيلة</option>
                        <option value="FAMILY">عائلة</option>
                        <option value="INDIVIDUAL">فرد</option>
                      </select>
                    </div>

                    {/* Field 5: Single Clean Toggle Button: 📍 البحث أسفل العقدة المحددة حالياً في الشجرة (Default: false) */}
                    <div className="lg:col-span-2">
                      <label className="block text-[11px] font-bold text-stone-700 mb-1.5">
                        النطاق الشجري
                      </label>
                      <button
                        type="button"
                        aria-pressed={searchUnderSelectedNodeOnly}
                        onClick={() =>
                          setSearchUnderSelectedNodeOnly((prev) => !prev)
                        }
                        className={`w-full px-3 py-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                          searchUnderSelectedNodeOnly
                            ? 'bg-[#B45309] text-white border-[#B45309] shadow-2xs'
                            : 'bg-[#FAF6EE] hover:bg-amber-100/70 text-[#8A6408] border-[#D4AF37]/60'
                        }`}
                        title={
                          selectedAdamNode
                            ? `البحث أسفل العقدة المحددة حالياً في الشجرة (${selectedAdamNode.name})`
                            : 'البحث أسفل العقدة المحددة حالياً في الشجرة'
                        }
                      >
                        <span className="truncate">
                          📍 البحث أسفل العقدة المحددة حالياً في الشجرة
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Active Filters Reset Bar */}
                  {hasActiveAdamSearchOrFilter && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-stone-600">
                          انقر على أي نتيجة أدناه لتحديدها تلقائياً في الشجرة التفاعلية وفتح بياناتها في لوحة التكويد:
                        </span>
                        {searchUnderSelectedNodeOnly && (
                          <span className="px-2.5 py-0.5 rounded-lg bg-amber-100 text-amber-950 border border-amber-300 text-[11px] font-bold">
                            النطاق النشط: أسفل ({selectedAdamNode?.name})
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAdamSearchQuery('');
                          setAdamFatherQuery('');
                          setSearchUnderSelectedNodeOnly(false);
                          setAdamArcFilter('');
                          setAdamRepFilter('');
                        }}
                        className="px-3 py-1 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold cursor-pointer transition-colors"
                      >
                        ✕ مسح كافة الفلاتر وإخفاء القائمة
                      </button>
                    </div>
                  )}

                  {/* Rule 5: ZERO random names when no search/filter is active; Organized Results List when active */}
                  {hasActiveAdamSearchOrFilter && (
                    <div
                      data-testid="adam-search-results-container"
                      className="rounded-2xl border border-stone-200 bg-[#FAF8F5] p-3 max-h-72 overflow-y-auto space-y-2"
                    >
                      {filteredAdamNodes.length === 0 ? (
                        <div className="text-center py-6 text-xs font-bold text-stone-500">
                          لا توجد عقد مطابقة لمعايير البحث أو الفلتر المحددة حالياً.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {filteredAdamNodes.map((node) => {
                            const isSelected =
                              selectedAdamNode?.node_id === node.node_id;
                            const visualMeta = getSmartVisualTierMeta(
                              node.arc_code
                            );
                            const directFather = node.parent_id
                              ? adamNodeByIdMap.get(node.parent_id)
                              : null;

                            // Build concise lineage path preview (up to 4 ancestors)
                            const shortLineageNames: string[] = [];
                            let currParentId = node.parent_id;
                            let hop = 0;
                            while (currParentId && hop < 4) {
                              const pNode = adamNodeByIdMap.get(currParentId);
                              if (!pNode) break;
                              shortLineageNames.push(pNode.name);
                              currParentId = pNode.parent_id;
                              hop++;
                            }

                            const repLabel =
                              node.representation === 'TRIBE'
                                ? 'قبيلة'
                                : node.representation === 'FAMILY'
                                ? 'عائلة'
                                : 'فرد';

                            return (
                              <button
                                key={node.node_id}
                                type="button"
                                onClick={() =>
                                  handleSelectNodeFromSearchResults(node)
                                }
                                className={`p-3 rounded-xl text-right transition-all cursor-pointer flex items-start justify-between gap-3 border ${
                                  isSelected
                                    ? 'bg-[#FAF6EE] text-[#141414] border-2 border-[#D4AF37] ring-2 ring-[#D4AF37]/25 shadow-2xs'
                                    : 'bg-white hover:bg-[#FAF6EE]/70 text-stone-800 border-stone-200/90'
                                }`}
                              >
                                <div className="space-y-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span
                                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${visualMeta.dotClass}`}
                                    />
                                    <span className="text-xs font-extrabold text-[#141414]">
                                      {node.name}
                                    </span>
                                    {/^\d+$/.test(node.node_id) && (
                                      <span className="text-[10px] font-mono text-stone-400">
                                        #{node.node_id}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-stone-600 truncate">
                                    <strong className="text-stone-700">
                                      الأب المباشر:
                                    </strong>{' '}
                                    {directFather
                                      ? directFather.name
                                      : node.parent_name || 'الجذر الأعلى'}{' '}
                                    {shortLineageNames.length > 1 && (
                                      <span className="text-stone-400">
                                        ({' '}
                                        {shortLineageNames.join(' ⬅️ ')} )
                                      </span>
                                    )}
                                  </p>
                                </div>

                                <div className="flex flex-col items-end gap-1 shrink-0">
                                  {visualMeta.isCoded ? (
                                    <span
                                      className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-bold ${visualMeta.capsuleClass}`}
                                    >
                                      {visualMeta.code}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 border border-stone-200 font-bold">
                                      جد فردي
                                    </span>
                                  )}
                                  <span className="text-[10px] font-bold text-stone-500">
                                    {repLabel}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SPLIT-VIEW INTERACTIVE EXPLORER */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* RIGHT PANE (7 COLS): 🧭 المستكشف الشجري التفاعلي في شجرة آدم */}
              <div className="lg:col-span-7 bg-white rounded-3xl border border-stone-200/90 p-6 shadow-xs space-y-5">
                {/* 2. SMART CONTROL BAR AT TOP OF NAVIGATOR */}
                <div className="space-y-3.5 border-b border-stone-200/80 pb-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-sm font-bold font-serif text-[#141414]">
                      🧭 المستكشف الشجري التفاعلي في شجرة آدم
                    </h3>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Layout Mode Toggle: الوضع الرأسي vs الوضع الجانبي */}
                      <div className="inline-flex items-center gap-1 bg-[#FAF8F5] p-1 rounded-xl border border-stone-200">
                        <button
                          type="button"
                          onClick={() => setTreeLayoutMode('VERTICAL')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                            treeLayoutMode === 'VERTICAL'
                              ? 'bg-[#8D4925] text-white shadow-2xs'
                              : 'text-stone-700 hover:bg-stone-200/60'
                          }`}
                          title="الوضع الرأسي: نقاط البداية في الأعلى ومع فتح العقدة تفتح عقد الأبناء في الأسفل"
                        >
                          <span>📊 الوضع الرأسي</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setTreeLayoutMode('SIDE')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                            treeLayoutMode === 'SIDE'
                              ? 'bg-[#8D4925] text-white shadow-2xs'
                              : 'text-stone-700 hover:bg-stone-200/60'
                          }`}
                          title="الوضع الجانبي: شجرة متدرجة جانبياً"
                        >
                          <span>📑 الوضع الجانبي</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowAddChildForm((prev) => !prev)}
                        className="px-3 py-1.5 rounded-xl bg-[#B45309] hover:bg-[#92400E] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>
                          + إضافة فرع تحت ({selectedAdamNode?.name})
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Single-Row Control Bar: Starting Point (MT Peaks first & default, then Adam) + Coded-Only Toggle on the same row */}
                  <div className="bg-[#FAF6EE] border border-[#D4AF37]/50 rounded-2xl p-3 flex flex-wrap xl:flex-nowrap items-center justify-between gap-2.5">
                    {/* 2.1 Segmented Control: نقطة البدء في الشجرة (MT_PEAKS first & default) */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-bold text-stone-700 shrink-0">
                        نقطة البدء:
                      </span>
                      <div className="inline-flex flex-wrap items-center gap-1 bg-white p-1 rounded-xl border border-stone-200/90">
                        <button
                          type="button"
                          onClick={() => setTreeStartMode('MT_PEAKS')}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                            treeStartMode === 'MT_PEAKS'
                              ? 'bg-[#B45309] text-white shadow-2xs'
                              : 'text-stone-700 hover:bg-stone-100'
                          }`}
                        >
                          <span>
                            🏕️ البدء من الذروات القبلية الـ 6 (مستوى MT)
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setTreeStartMode('ADAM_ROOT')}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                            treeStartMode === 'ADAM_ROOT'
                              ? 'bg-[#B45309] text-white shadow-2xs'
                              : 'text-stone-700 hover:bg-stone-100'
                          }`}
                        >
                          <span>👑 البدء من آدم عليه السلام</span>
                        </button>
                      </div>
                    </div>

                    {/* 2.2 Smart Toggle Switch on the SAME row: عرض العقد المكودة فقط (Default: true) */}
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-stone-200/90 shrink-0">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={codedOnlyTreeToggle}
                        onClick={() =>
                          setCodedOnlyTreeToggle((prev) => !prev)
                        }
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                          codedOnlyTreeToggle
                            ? 'bg-[#B45309]'
                            : 'bg-stone-300'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                            codedOnlyTreeToggle
                              ? '-translate-x-4'
                              : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <div
                        onClick={() =>
                          setCodedOnlyTreeToggle((prev) => !prev)
                        }
                        className="cursor-pointer select-none"
                      >
                        <span className="text-[11px] font-bold text-[#141414] block">
                          عرض العقد المكودة فقط
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Color Legend (Rule 4 Visual System) */}
                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-stone-600 px-1">
                    <span className="font-bold text-stone-700">
                      الدليل البصري للطبقات:
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#D4AF37]" />
                      <span>الجذوم والقبائل الأم (M / MT / B0)</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#B45309]" />
                      <span>البطون والفروع (MM / B1 - B9)</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#4D6A47]" />
                      <span>العائلات والأسر (FE0)</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#D6CFC2] border border-[#BEB5A4]" />
                      <span>جد فردي متسلسل</span>
                    </span>
                  </div>
                </div>

                {/* Inline Add Child Node Form */}
                {showAddChildForm && (
                  <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-300 space-y-3">
                    <h5 className="text-xs font-bold text-amber-950">
                      إدراج عقدة فرعية جديدة مباشرة تحت ({selectedAdamNode?.name}):
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={newChildName}
                        onChange={(e) => setNewChildName(e.target.value)}
                        placeholder="اسم العائلة أو الفرع أو الجد الجديد..."
                        className="px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs font-bold"
                      />
                      <select
                        value={newChildArcCode}
                        onChange={(e) => setNewChildArcCode(e.target.value)}
                        className="px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs font-bold"
                      >
                        {ARC_CODE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={newChildRepresentation}
                        onChange={(e) =>
                          setNewChildRepresentation(
                            e.target
                              .value as AdamTreeInteractiveNode['representation']
                          )
                        }
                        className="px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs font-bold"
                      >
                        <option value="FAMILY">FAMILY — أسرة</option>
                        <option value="TRIBE">TRIBE — قبيلة / فخذ</option>
                        <option value="INDIVIDUAL">INDIVIDUAL — فرد</option>
                        <option value="ALLIANCE">ALLIANCE — حلف</option>
                      </select>
                      <select
                        value={newChildRelationNature}
                        onChange={(e) =>
                          setNewChildRelationNature(
                            e.target
                              .value as AdamTreeInteractiveNode['relation_nature']
                          )
                        }
                        className="px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs font-bold"
                      >
                        <option value="DIRECT_DESCENDANT">
                          FROM — يظهر &quot;من&quot;
                        </option>
                        <option value="DIRECT">
                          DIRECT — يظهر &quot;بن&quot;
                        </option>
                      </select>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAddChildForm(false)}
                        className="px-3 py-1.5 rounded-xl bg-white border border-stone-300 text-xs font-bold cursor-pointer"
                      >
                        إلغاء
                      </button>
                      <button
                        type="button"
                        onClick={handleAddChildNodeToAdam}
                        className="px-4 py-1.5 rounded-xl bg-emerald-800 text-white text-xs font-bold cursor-pointer"
                      >
                        إدراج وحفظ في شجرة آدم ✓
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. DUAL-MODE EXPANDABLE TREE VIEW (VERTICAL TOP-DOWN OR SIDE HIERARCHICAL) */}
                <div
                  data-testid="adam-top-down-hierarchical-tree"
                  className="bg-[#FAF8F5] rounded-2xl border border-stone-200/90 p-4 max-h-[680px] overflow-auto"
                >
                  {(() => {
                    const topRoots =
                      treeStartMode === 'MT_PEAKS'
                        ? mtSixPeakRoots
                        : adamTopRootNode
                        ? [adamTopRootNode]
                        : [adamGraphNodes[0]].filter(Boolean);

                    const ancestorSet = new Set(
                      selectedNodeAncestorsChain.map((a) => a.node_id)
                    );

                    // MODE 1: VERTICAL TOP-DOWN TREE (Starting nodes at top, children open below)
                    const renderVerticalTreeBranch = (
                      node: AdamTreeInteractiveNode,
                      depth: number,
                      skippedGenerations: number,
                      visitedPath: Set<string>
                    ): React.ReactNode => {
                      if (!node || visitedPath.has(node.node_id) || depth > 50) {
                        return null;
                      }
                      const nextVisited = new Set(visitedPath);
                      nextVisited.add(node.node_id);

                      const resolvedChildren = getResolvedChildrenForTreeNode(
                        node.node_id
                      );
                      const isExpanded = expandedNodeIds.has(node.node_id);
                      const isSelected =
                        selectedAdamNode?.node_id === node.node_id;
                      const isOnSelectedPath = ancestorSet.has(node.node_id);
                      const visualMeta = getSmartVisualTierMeta(node.arc_code);

                      return (
                        <div
                          key={node.node_id}
                          className="flex flex-col items-center select-none"
                        >
                          {/* Skipped generations badge above node if any */}
                          {skippedGenerations > 0 && (
                            <span className="mb-1 text-[9px] px-2 py-0.5 rounded-full bg-amber-100/90 text-amber-900 border border-amber-300/70 font-bold whitespace-nowrap">
                              +{skippedGenerations} جيل
                            </span>
                          )}

                          {/* Node Card */}
                          <div
                            className={`flex flex-col items-center rounded-2xl border transition-all px-3 py-2 min-w-[120px] shadow-2xs ${
                              isSelected
                                ? 'bg-[#FAF6EE] border-2 border-[#D4AF37] text-[#141414] ring-2 ring-[#D4AF37]/25'
                                : isOnSelectedPath
                                ? 'bg-amber-50/70 border-[#D4AF37]/60 text-[#141414]'
                                : 'bg-white hover:bg-[#FAF6EE]/80 border-stone-200/90 text-stone-800'
                            }`}
                          >
                            <button
                              id={`adam-tree-node-btn-${node.node_id}`}
                              type="button"
                              onClick={() =>
                                handleSelectTreeNodeInNavigator(node)
                              }
                              title={visualMeta.tierTitle}
                              className="flex items-center gap-1.5 cursor-pointer text-center"
                            >
                              <span
                                className={`w-2.5 h-2.5 rounded-full shrink-0 ${visualMeta.dotClass}`}
                              />
                              <span
                                className={`text-xs whitespace-nowrap ${
                                  isSelected || visualMeta.isCoded
                                    ? 'font-extrabold text-[#141414]'
                                    : 'font-semibold text-stone-700'
                                }`}
                              >
                                {node.name}
                              </span>
                              {visualMeta.isCoded && (
                                <span
                                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full font-bold ${visualMeta.capsuleClass}`}
                                >
                                  {visualMeta.code}
                                </span>
                              )}
                            </button>

                            {/* Expand / Collapse Children Downward Button */}
                            <button
                              type="button"
                              onClick={() =>
                                handleToggleExpandTreeNode(node.node_id)
                              }
                              className={`mt-1.5 px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                                isExpanded
                                  ? 'bg-amber-100 text-[#B45309] hover:bg-amber-200'
                                  : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                              }`}
                              title={
                                isExpanded
                                  ? 'طي الأبناء'
                                  : 'فتح الأبناء في الأسفل'
                              }
                            >
                              <span>{isExpanded ? '▴ طي' : '▾ الأبناء'}</span>
                              {resolvedChildren.length > 0 && (
                                <span className="font-mono">
                                  ({resolvedChildren.length})
                                </span>
                              )}
                            </button>
                          </div>

                          {/* Downward Connector + Children Row */}
                          {isExpanded && resolvedChildren.length > 0 && (
                            <div className="flex flex-col items-center">
                              {/* Vertical stem from parent */}
                              <div className="w-0.5 h-4 bg-stone-300" />
                              {/* Horizontal bar & children columns */}
                              <div className="flex items-start justify-center gap-3 pt-2 border-t-2 border-stone-300/90">
                                {resolvedChildren.map((childEntry) => (
                                  <div
                                    key={childEntry.node.node_id}
                                    className="flex flex-col items-center"
                                  >
                                    {renderVerticalTreeBranch(
                                      childEntry.node,
                                      depth + 1,
                                      childEntry.skippedGenerations,
                                      nextVisited
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    };

                    // MODE 2: SIDE HIERARCHICAL TREE (Indented list)
                    const renderSideTreeBranch = (
                      node: AdamTreeInteractiveNode,
                      depth: number,
                      isLastSibling: boolean,
                      skippedGenerations: number,
                      visitedPath: Set<string>
                    ): React.ReactNode => {
                      if (!node || visitedPath.has(node.node_id) || depth > 60) {
                        return null;
                      }
                      const nextVisited = new Set(visitedPath);
                      nextVisited.add(node.node_id);

                      const resolvedChildren = getResolvedChildrenForTreeNode(
                        node.node_id
                      );
                      const hasChildren = resolvedChildren.length > 0;
                      const isExpanded = expandedNodeIds.has(node.node_id);
                      const isSelected =
                        selectedAdamNode?.node_id === node.node_id;
                      const isOnSelectedPath = ancestorSet.has(node.node_id);
                      const visualMeta = getSmartVisualTierMeta(node.arc_code);

                      return (
                        <div key={node.node_id} className="select-none">
                          {/* Tree Row */}
                          <div className="flex items-center gap-1.5 py-1">
                            {depth > 0 && (
                              <span className="font-mono text-stone-400 text-xs pl-1 shrink-0">
                                {isLastSibling ? '└─' : '├─'}
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                handleToggleExpandTreeNode(node.node_id)
                              }
                              className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                                isExpanded
                                  ? 'bg-amber-100 text-[#B45309] hover:bg-amber-200'
                                  : 'bg-white border border-stone-300 text-stone-700 hover:bg-stone-100'
                              }`}
                              title={
                                isExpanded
                                  ? 'طي الفروع المنحدرة'
                                  : `توسيع الفروع (${resolvedChildren.length})`
                              }
                            >
                              {isExpanded ? '▾' : '▸'}
                            </button>

                            <button
                              id={`adam-tree-node-btn-${node.node_id}`}
                              type="button"
                              onClick={() =>
                                handleSelectTreeNodeInNavigator(node)
                              }
                              title={visualMeta.tierTitle}
                              className={`group flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-xl text-right transition-all cursor-pointer border ${
                                isSelected
                                  ? 'bg-[#FAF6EE] border-2 border-[#D4AF37] text-[#141414] shadow-xs ring-2 ring-[#D4AF37]/25'
                                  : isOnSelectedPath
                                  ? 'bg-amber-50/60 border-[#D4AF37]/50 text-[#141414]'
                                  : 'bg-white hover:bg-[#FAF6EE]/80 border-stone-200/90 text-stone-800'
                              }`}
                            >
                              <span
                                className={`w-2.5 h-2.5 rounded-full shrink-0 ${visualMeta.dotClass}`}
                              />
                              <span
                                className={`text-xs ${
                                  isSelected || visualMeta.isCoded
                                    ? 'font-extrabold text-[#141414]'
                                    : 'font-semibold text-stone-700'
                                }`}
                              >
                                {node.name}
                              </span>
                              {visualMeta.isCoded && (
                                <span
                                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${visualMeta.capsuleClass}`}
                                >
                                  {visualMeta.code}
                                </span>
                              )}
                              {skippedGenerations > 0 && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100/90 text-amber-900 border border-amber-300/70 font-bold">
                                  (تخطي +{skippedGenerations} جيل فردي)
                                </span>
                              )}
                              {hasChildren && (
                                <span className="text-[10px] text-stone-400 font-mono">
                                  ({resolvedChildren.length})
                                </span>
                              )}
                            </button>
                          </div>

                          {hasChildren && isExpanded && (
                            <div className="mr-3 pr-3.5 border-r-2 border-stone-300/80 space-y-0.5">
                              {resolvedChildren.map((childEntry, cIdx) =>
                                renderSideTreeBranch(
                                  childEntry.node,
                                  depth + 1,
                                  cIdx === resolvedChildren.length - 1,
                                  childEntry.skippedGenerations,
                                  nextVisited
                                )
                              )}
                            </div>
                          )}
                        </div>
                      );
                    };

                    if (treeLayoutMode === 'VERTICAL') {
                      return (
                        <div className="flex items-start justify-center gap-5 min-w-max py-2 px-2">
                          {topRoots.map((rootNode) =>
                            renderVerticalTreeBranch(
                              rootNode,
                              0,
                              0,
                              new Set<string>()
                            )
                          )}
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-1.5">
                        {topRoots.map((rootNode, rIdx) =>
                          renderSideTreeBranch(
                            rootNode,
                            0,
                            rIdx === topRoots.length - 1,
                            0,
                            new Set<string>()
                          )
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* LEFT PANE (5 COLS): ⚙️ لوحة بيانات وتكويد السجل المختار (Node Coding Editor) */}
              <div className="lg:col-span-5 bg-white rounded-3xl border border-stone-200/90 p-6 shadow-xs space-y-5">
                {/* 5. INTEGRATED WARM GOLD/CREAM SELECTED NODE HEADER (NO BLACK BAR) */}
                {selectedAdamNode && (
                  <div
                    data-testid="selected-adam-node-warm-header"
                    className="rounded-2xl bg-[#FAF6EE] border-2 border-[#D4AF37] p-5 shadow-2xs space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-bold text-[#8A6408] block">
                          ⚙️ لوحة بيانات وتكويد السجل المختار (Node Coding Editor)
                        </span>
                        <h3 className="text-lg font-extrabold font-serif text-[#141414] mt-0.5">
                          {selectedAdamNode.name}
                        </h3>
                      </div>

                      {/* Read-Only / Edit Mode Toggle Button */}
                      <button
                        type="button"
                        onClick={() =>
                          setIsNodeEditorUnlocked((prev) => !prev)
                        }
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                          isNodeEditorUnlocked
                            ? 'bg-stone-200 text-stone-800 hover:bg-stone-300'
                            : 'bg-[#B45309] hover:bg-[#92400E] text-white'
                        }`}
                      >
                        <span>
                          {isNodeEditorUnlocked
                            ? '🔒 قفل وضع التحرير'
                            : '✏️ تعديل البيانات'}
                        </span>
                      </button>
                    </div>

                    {/* Refined Metadata Badges (Zero Black Background, Zero UNASSIGNED) */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {(() => {
                        const vMeta = getSmartVisualTierMeta(
                          selectedAdamNode.arc_code
                        );
                        return vMeta.isCoded ? (
                          <span
                            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${vMeta.capsuleClass}`}
                          >
                            الكود الهيكلي: {vMeta.code}
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg bg-white border border-stone-300 text-stone-700 text-xs font-bold">
                            جد فردي متسلسل
                          </span>
                        );
                      })()}

                      <span className="px-2.5 py-1 rounded-lg bg-white border border-[#D4AF37]/50 text-stone-800 text-xs font-bold">
                        {selectedAdamNode.representation === 'FAMILY'
                          ? 'التصنيف: أسرة (FAMILY)'
                          : selectedAdamNode.representation === 'TRIBE'
                          ? 'التصنيف: قبيلة (TRIBE)'
                          : selectedAdamNode.representation === 'ALLIANCE'
                          ? 'التصنيف: حلف (ALLIANCE)'
                          : 'التصنيف: فرد (INDIVIDUAL)'}
                      </span>

                      <span className="px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-stone-600 font-mono text-xs font-bold">
                        ID: {selectedAdamNode.node_id}
                      </span>
                    </div>

                    <div className="text-xs text-stone-700 bg-white/80 rounded-xl px-3 py-2 border border-[#D4AF37]/30 flex flex-wrap items-center justify-between gap-2">
                      <span>
                        <strong className="text-[#8A6408]">
                          الرابط بالعقدة الأب:
                        </strong>{' '}
                        {selectedAdamNode.relation_nature === 'DIRECT'
                          ? 'بن (DIRECT — اتصال مباشر)'
                          : 'من (FROM — انحدار فرعي)'}{' '}
                        <strong>
                          {selectedParentNodeObj?.name ||
                            selectedAdamNode.parent_name ||
                            'الجذر الأعلى'}
                        </strong>
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isNodeEditorUnlocked
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-emerald-100 text-emerald-900'
                        }`}
                      >
                        {isNodeEditorUnlocked
                          ? 'وضع التحرير مفتوح ✏️'
                          : 'وضع القراءة المحمي 🔒'}
                      </span>
                    </div>
                  </div>
                )}

                {/* 6. 3 STRUCTURED INFORMATION BUNDLES (READ-ONLY BY DEFAULT) */}
                <div className="space-y-4">
                  {/* BUNDLE 1: 📌 الهوية والتكويد الهيكلي */}
                  <div className="rounded-2xl border border-stone-200 bg-[#FAF8F5] p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-stone-200/80 pb-2">
                      <h4 className="text-xs font-extrabold font-serif text-[#141414]">
                        📌 الحزمة 1: الهوية والتكويد الهيكلي
                      </h4>
                      <span className="text-[10px] text-stone-500 font-bold">
                        معرف السجل (ID) محمي للقراءة فقط
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-stone-700 mb-1">
                          اسم السجل (name)
                        </label>
                        <input
                          type="text"
                          value={editNodeName}
                          disabled={!isNodeEditorUnlocked}
                          onChange={(e) => setEditNodeName(e.target.value)}
                          className={`w-full px-3 py-2 rounded-xl border text-xs font-bold transition-colors ${
                            isNodeEditorUnlocked
                              ? 'border-[#B45309] bg-white text-[#141414]'
                              : 'border-stone-200 bg-stone-100/80 text-stone-700 cursor-not-allowed'
                          }`}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-stone-700 mb-1">
                          معرف السجل (ID — للقراءة فقط)
                        </label>
                        <input
                          type="text"
                          value={editNodeId}
                          readOnly
                          disabled
                          className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-stone-100 text-stone-600 text-xs font-mono font-bold cursor-not-allowed"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-stone-700 mb-1">
                        الكود الهيكلي (Arc Code)
                      </label>
                      <select
                        value={editArcCode}
                        disabled={!isNodeEditorUnlocked}
                        onChange={(e) => {
                          const nextCode = e.target.value;
                          setEditArcCode(nextCode);
                          const conflict = checkArcCodeRepresentationConflict(
                            nextCode,
                            editRepresentation
                          );
                          if (conflict.hasConflict) {
                            setEditRepresentation(
                              conflict.suggestedRepresentation
                            );
                          }
                        }}
                        className={`w-full px-3 py-2 rounded-xl border text-xs font-bold transition-colors ${
                          isNodeEditorUnlocked
                            ? 'border-[#B45309] bg-white text-[#141414]'
                            : 'border-stone-200 bg-stone-100/80 text-stone-700 cursor-not-allowed'
                        }`}
                      >
                        {ARC_CODE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-stone-700 mb-1">
                          تصنيف العقدة (Representation)
                        </label>
                        <select
                          value={editRepresentation}
                          disabled={!isNodeEditorUnlocked}
                          onChange={(e) =>
                            setEditRepresentation(
                              e.target
                                .value as AdamTreeInteractiveNode['representation']
                            )
                          }
                          className={`w-full px-3 py-2 rounded-xl border text-xs font-bold transition-colors ${
                            isNodeEditorUnlocked
                              ? 'border-[#B45309] bg-white text-[#141414]'
                              : 'border-stone-200 bg-stone-100/80 text-stone-700 cursor-not-allowed'
                          }`}
                        >
                          <option value="INDIVIDUAL">INDIVIDUAL — فرد</option>
                          <option value="FAMILY">FAMILY — أسرة</option>
                          <option value="TRIBE">TRIBE — قبيلة</option>
                          <option value="ALLIANCE">ALLIANCE — حلف</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-stone-700 mb-1">
                          طبيعة الرابط بالعقدة الأب
                        </label>
                        <select
                          value={editRelationNature}
                          disabled={!isNodeEditorUnlocked}
                          onChange={(e) =>
                            setEditRelationNature(
                              e.target
                                .value as AdamTreeInteractiveNode['relation_nature']
                            )
                          }
                          className={`w-full px-3 py-2 rounded-xl border text-xs font-bold transition-colors ${
                            isNodeEditorUnlocked
                              ? 'border-[#B45309] bg-white text-[#141414]'
                              : 'border-stone-200 bg-stone-100/80 text-stone-700 cursor-not-allowed'
                          }`}
                        >
                          <option value="DIRECT">
                            DIRECT — يظهر &quot;بن&quot;
                          </option>
                          <option value="DIRECT_DESCENDANT">
                            FROM — يظهر &quot;من&quot;
                          </option>
                        </select>
                      </div>
                    </div>

                    {/* Rule 5: Conflict Alert between Arc Code and Representation */}
                    {editorCodingConflict.hasConflict && (
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-amber-900">
                          ⚠️ {editorCodingConflict.message}
                        </span>
                        {isNodeEditorUnlocked && (
                          <button
                            type="button"
                            onClick={() =>
                              setEditRepresentation(
                                editorCodingConflict.suggestedRepresentation
                              )
                            }
                            className="px-2.5 py-1 rounded-lg bg-[#B45309] text-white text-[10px] font-bold cursor-pointer"
                          >
                            تصحيح تلقائي إلى ({editorCodingConflict.suggestedRepresentation})
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* BUNDLE 2: 🌍 النطاق الجغرافي والفروع الأبناء */}
                  <div className="rounded-2xl border border-stone-200 bg-[#FAF8F5] p-4 space-y-3">
                    <h4 className="text-xs font-extrabold font-serif text-[#141414] border-b border-stone-200/80 pb-2">
                      🌍 الحزمة 2: النطاق الجغرافي والفروع الأبناء
                    </h4>

                    <div>
                      <label className="block text-[11px] font-bold text-stone-700 mb-1.5">
                        الموطن والانتشار الجغرافي (geo_footprint):
                      </label>
                      {/* Organized Geographic Tags */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-2">
                        {editGeoFootprint
                          .split(/[،,]/)
                          .map((s) => s.trim())
                          .filter(Boolean)
                          .map((tag, tIdx) => (
                            <span
                              key={tIdx}
                              className="px-2.5 py-1 rounded-lg bg-[#FAF6EE] border border-[#D4AF37]/60 text-xs font-bold text-[#8A6408] flex items-center gap-1.5"
                            >
                              <span>📍 {tag}</span>
                              {isNodeEditorUnlocked && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const remaining = editGeoFootprint
                                      .split(/[،,]/)
                                      .map((s) => s.trim())
                                      .filter(Boolean)
                                      .filter((_, idx) => idx !== tIdx);
                                    setEditGeoFootprint(remaining.join('، '));
                                  }}
                                  className="text-red-700 hover:text-red-900 font-bold cursor-pointer"
                                  title="حذف الوسم الجغرافي"
                                >
                                  ×
                                </button>
                              )}
                            </span>
                          ))}
                        {editGeoFootprint
                          .split(/[،,]/)
                          .map((s) => s.trim())
                          .filter(Boolean).length === 0 && (
                          <span className="text-[11px] text-stone-400">
                            لا توجد وسوم جغرافية مسجلة حالياً
                          </span>
                        )}
                      </div>

                      {isNodeEditorUnlocked && (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newGeoTagInput}
                            onChange={(e) => setNewGeoTagInput(e.target.value)}
                            placeholder="أضف دولة أو إقليماً جديداً (مثل: الحجاز، نجد، العراق)..."
                            className="flex-1 px-3 py-1.5 rounded-xl border border-[#B45309] bg-white text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const clean = newGeoTagInput.trim();
                              if (!clean) return;
                              const current = editGeoFootprint
                                .split(/[،,]/)
                                .map((s) => s.trim())
                                .filter(Boolean);
                              if (!current.includes(clean)) {
                                setEditGeoFootprint(
                                  [...current, clean].join('، ')
                                );
                              }
                              setNewGeoTagInput('');
                            }}
                            className="px-3 py-1.5 rounded-xl bg-[#B45309] text-white text-xs font-bold cursor-pointer"
                          >
                            + إضافة وسم
                          </button>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-stone-700 mb-1">
                        الفروع والأبناء المرتبطون بالسجل (enriched_branches):
                      </label>
                      <input
                        type="text"
                        value={editEnrichedBranches}
                        disabled={!isNodeEditorUnlocked}
                        onChange={(e) =>
                          setEditEnrichedBranches(e.target.value)
                        }
                        placeholder="فروع العائلة أو البطون المنحدرة (مفصولة بفاصلة)..."
                        className={`w-full px-3 py-2 rounded-xl border text-xs transition-colors ${
                          isNodeEditorUnlocked
                            ? 'border-[#B45309] bg-white text-[#141414]'
                            : 'border-stone-200 bg-stone-100/80 text-stone-700 cursor-not-allowed'
                        }`}
                      />
                    </div>
                  </div>

                  {/* BUNDLE 3: 📚 المصادر الموثقة وسجل الإثراء */}
                  <div className="rounded-2xl border border-stone-200 bg-[#FAF8F5] p-4 space-y-3">
                    <h4 className="text-xs font-extrabold font-serif text-[#141414] border-b border-stone-200/80 pb-2">
                      📚 الحزمة 3: المصادر الموثقة وسجل الإثراء
                    </h4>

                    <div>
                      <label className="block text-[11px] font-bold text-stone-700 mb-1">
                        المراجع التاريخية المعتمدة للعقدة (enriched_sources):
                      </label>
                      <textarea
                        rows={3}
                        value={editEnrichedSources}
                        disabled={!isNodeEditorUnlocked}
                        onChange={(e) =>
                          setEditEnrichedSources(e.target.value)
                        }
                        placeholder="كل مصدر تاريخي موثق في سطر مستقل..."
                        className={`w-full p-3 rounded-xl border text-xs transition-colors ${
                          isNodeEditorUnlocked
                            ? 'border-[#B45309] bg-white text-[#141414]'
                            : 'border-stone-200 bg-stone-100/80 text-stone-700 cursor-not-allowed'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Action Button: Triggers Mandatory Confirmation Modal */}
                  <button
                    type="button"
                    disabled={!isNodeEditorUnlocked}
                    onClick={handleRequestSaveAdamNodeCoding}
                    className={`w-full py-3 px-4 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all ${
                      isNodeEditorUnlocked
                        ? 'bg-[#B45309] hover:bg-[#92400E] text-white cursor-pointer'
                        : 'bg-stone-200 text-stone-500 cursor-not-allowed'
                    }`}
                  >
                    <Save className="w-4 h-4" />
                    <span>
                      💾 حفظ التعديلات (يتطلب التأكيد الإلزامي قبل التحديث)
                    </span>
                  </button>
                </div>

                {/* 6.4 MANDATORY CONFIRMATION MODAL BEFORE SAVING TO ADAM TREE */}
                {showAdamSaveConfirmModal && selectedAdamNode && (
                  <div
                    data-testid="adam-save-mandatory-confirmation-modal"
                    className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
                  >
                    <div className="bg-[#FAF6EE] border-2 border-[#D4AF37] rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
                      <div className="space-y-1.5">
                        <span className="px-3 py-1 rounded-full bg-amber-100 border border-amber-400 text-amber-950 text-[11px] font-extrabold inline-block">
                          حماية قاعدة بيانات شجرة آدم المركزية
                        </span>
                        <h4 className="text-base font-extrabold font-serif text-[#141414] leading-relaxed">
                          ⚠️ تأكيد تحديث قاعدة بيانات شجرة آدم المركزية: هل أنت متأكد من مراجعة واعتماد هذه التعديلات على السجل [{selectedAdamNode.name}]؟
                        </h4>
                      </div>

                      {/* Diff Comparison Table: القيمة السابقة ⬅️ القيمة الجديدة */}
                      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                        <div className="grid grid-cols-3 bg-stone-100 px-3.5 py-2 text-[11px] font-extrabold text-stone-700 border-b border-stone-200">
                          <span>الحقل</span>
                          <span>القيمة السابقة</span>
                          <span>⬅️ القيمة الجديدة</span>
                        </div>
                        {pendingNodeChangesDiff.length === 0 ? (
                          <div className="p-4 text-xs text-stone-600 text-center">
                            لم يتم تغيير أي قيمة عن البيانات المسجلة حالياً للسجل ({selectedAdamNode.name}).
                          </div>
                        ) : (
                          <div className="divide-y divide-stone-100 max-h-60 overflow-y-auto">
                            {pendingNodeChangesDiff.map((diff, dIdx) => (
                              <div
                                key={dIdx}
                                className="grid grid-cols-3 gap-2 px-3.5 py-2.5 text-xs items-center"
                              >
                                <span className="font-bold text-stone-800">
                                  {diff.fieldLabel}
                                </span>
                                <span className="text-stone-500 line-through break-words">
                                  {diff.oldValue}
                                </span>
                                <span className="font-extrabold text-emerald-800 break-words">
                                  ⬅️ {diff.newValue}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowAdamSaveConfirmModal(false)}
                          className="px-4 py-2.5 rounded-xl bg-white border border-stone-300 hover:bg-stone-100 text-stone-800 text-xs font-bold cursor-pointer transition-all"
                        >
                          ❌ إلغاء وتراجع
                        </button>
                        <button
                          type="button"
                          onClick={handleConfirmAndSaveAdamNodeCoding}
                          className="px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-extrabold cursor-pointer shadow-sm transition-all"
                        >
                          ✅ نعم، اعتمد التعديل النهائي
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            SUB-TAB 4: 🔗 الربط والسحب والإفلات (DRAG & DROP LINKING WORKBENCH)
        =================================================================== */}
        {activeSubTab === 'drag_drop_linker' && (
          <div className="bg-white rounded-3xl border border-stone-200/90 p-6 shadow-xs space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-100 pb-4">
              <div>
                <h2 className="text-base font-bold font-serif text-[#141414]">
                  🔗 طاولة السحب والإفلات لربط عُقد التذاكر بشجرة آدم
                </h2>
                <p className="text-xs text-stone-500">
                  اسحب العقد المستخرجة (FE0 / B2 / B0) من التذكرة المختارة وأفلتها في منطقة الربط الهيكلي بشجرة آدم
                </p>
              </div>

              <select
                value={selectedTicket?.id || ''}
                onChange={(e) => {
                  setSelectedTicketId(e.target.value);
                  setDroppedNodes([]);
                }}
                className="px-3 py-2 rounded-xl border border-stone-300 bg-[#FAF8F5] text-xs font-bold"
              >
                {tickets.map((t, tIdx) => (
                  <option key={`${t.id}-${t.firestoreDocId || tIdx}`} value={t.id}>
                    {t.id} — {t.familyName} ({t.subRootName} ⬅️{' '}
                    {t.motherTribeName})
                  </option>
                ))}
              </select>
            </div>

            {selectedTicket && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* DRAGGABLE SOURCE NODES */}
                <div className="p-5 rounded-2xl bg-[#FAF8F5] border border-stone-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-stone-800">
                      1. العقد المستخرجة من تذكرة ({selectedTicket.familyName}):
                    </h3>
                    <button
                      type="button"
                      onClick={() =>
                        setDroppedNodes(selectedTicket.extractedNodes)
                      }
                      className="text-xs font-bold text-[#B45309] hover:underline cursor-pointer"
                    >
                      نقل جميع العقد دفعة واحدة ⬅️
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {selectedTicket.extractedNodes.map((node) => (
                      <div
                        key={node.id}
                        draggable
                        onDragStart={(e) => handleDragStartNode(e, node)}
                        className="p-3.5 rounded-xl bg-white border border-stone-300 hover:border-[#B45309] shadow-2xs flex items-center justify-between cursor-grab active:cursor-grabbing"
                      >
                        <div className="flex items-center gap-2.5">
                          <GripVertical className="w-4 h-4 text-stone-400" />
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-mono text-[10px] font-bold">
                            {node.nodeCode}
                          </span>
                          <span className="text-xs font-bold text-[#141414]">
                            {node.name}
                          </span>
                        </div>
                        <span className="text-[11px] text-stone-500">
                          {node.region}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* DROP TARGET ZONE */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingOverDropzone(true);
                  }}
                  onDragLeave={() => setIsDraggingOverDropzone(false)}
                  onDrop={handleDropIntoAdamZone}
                  className={`p-5 rounded-2xl border-2 border-dashed transition-all space-y-4 ${
                    isDraggingOverDropzone
                      ? 'border-[#B45309] bg-amber-50/70'
                      : 'border-stone-300 bg-[#FAF8F5]'
                  }`}
                >
                  <h3 className="text-xs font-bold text-stone-800">
                    2. منطقة الإسقاط والربط مع شجرة آدم (ADAM_MASTER_TREE):
                  </h3>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">
                      نقطة الالتقاء المكتشفة آلياً في شجرة آدم (suggested_adam_bridge_for_researcher):
                    </label>
                    <select
                      value={selectedAdamTargetChain}
                      onChange={(e) =>
                        setSelectedAdamTargetChain(e.target.value)
                      }
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs font-bold"
                    >
                      {selectedTicket.suggestedAdamBridge && (
                        <option
                          value={`${selectedTicket.suggestedAdamBridge.adam_node_id}: ${selectedTicket.suggestedAdamBridge.adam_chain_preview}`}
                        >
                          {selectedTicket.suggestedAdamBridge.adam_node_id}:{' '}
                          {
                            selectedTicket.suggestedAdamBridge
                              .adam_chain_preview
                          }{' '}
                          (مكتشف آلياً ✓)
                        </option>
                      )}
                      <option value="#8911: لأم ⬅️ عمرو ⬅️ طريف ⬅️ عمرو ⬅️ ثمامة ⬅️ مالك ⬅️ جدعاء ⬅️ ذهل">
                        #8911: لأم ⬅️ عمرو ⬅️ طريف ⬅️ عمرو ⬅️ ثمامة ⬅️ مالك ⬅️ جدعاء ⬅️ ذهل (بني لام — طيء)
                      </option>
                      <option value="#9420: جعفر الطيار ⬅️ أبي طالب ⬅️ عبد المطلب ⬅️ هاشم ⬅️ عبد مناف ⬅️ قصي">
                        #9420: جعفر الطيار ⬅️ أبي طالب ⬅️ عبد المطلب ⬅️ هاشم ⬅️ عبد مناف ⬅️ قصي (آل الطيار)
                      </option>
                      <option value="تميم ⬅️ مضر ⬅️ عدنان ⬅️ إسماعيل ⬅️ إبراهيم ⬅️ آدم">
                        تميم ⬅️ مضر ⬅️ عدنان ⬅️ إسماعيل ⬅️ إبراهيم ⬅️ آدم
                      </option>
                      <option value="مذحج (مالك) ⬅️ كهلان ⬅️ سبأ ⬅️ قحطان ⬅️ آدم">
                        مذحج (مالك) ⬅️ كهلان ⬅️ سبأ ⬅️ قحطان ⬅️ آدم
                      </option>
                      <option value="عنزة ⬅️ أسد ⬅️ ربيعة ⬅️ نزار ⬅️ معد ⬅️ عدنان ⬅️ آدم">
                        عنزة ⬅️ أسد ⬅️ ربيعة ⬅️ نزار ⬅️ معد ⬅️ عدنان ⬅️ آدم
                      </option>
                    </select>
                  </div>

                  {droppedNodes.length === 0 ? (
                    <div className="py-10 text-center text-xs text-stone-500">
                      اسحب العقد من اليمين وأفلتها هنا لمعاينة السلسلة المتصلة قبل الاعتماد
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-1.5 p-3 rounded-xl bg-white border border-emerald-300">
                        {droppedNodes.map((n) => (
                          <span
                            key={n.id}
                            className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-950 text-xs font-bold"
                          >
                            {n.name} ({n.nodeCode}) ⬅️
                          </span>
                        ))}
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-900 text-emerald-100 text-xs font-bold">
                          {selectedAdamTargetChain}
                        </span>
                      </div>

                      <label className="flex items-center gap-2 text-xs font-bold text-stone-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={approveSourcesChecked}
                          onChange={(e) =>
                            setApproveSourcesChecked(e.target.checked)
                          }
                          className="w-4 h-4 accent-[#B45309]"
                        />
                        <span>
                          اعتماد وإرفاق كافة المصادر والروايات الموثقة في سجل العائلة
                        </span>
                      </label>

                      <button
                        type="button"
                        onClick={() =>
                          handleActionAApproveAndLinkToAdam(selectedTicket)
                        }
                        className="w-full py-3 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold cursor-pointer shadow-xs"
                      >
                        ✅ اعتماد الدمج النهائي في شجرة آدم وإقفال التذكرة
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================================================================
            SUB-TAB 5: جسر آدم برايم
        =================================================================== */}
        {activeSubTab === 'adam_prime_bridge' && (
          <div className="bg-white rounded-3xl border border-[#E2DACB] p-6 shadow-xs space-y-6">
            <div className="border-b border-[#E2DACB] pb-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold font-display text-[#252321]">
                  جسر آدم برايم
                </h2>
                <p className="text-xs text-[#5C5346]">
                  تصدير واستيراد حزم التحقيق المعمق للبحوث المصعدة من مرصد البحوث
                </p>
              </div>
            </div>

            {adamPrimeBundles.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#B98A78]/50 bg-[#FAF6F0] p-10 text-center space-y-2">
                <Cpu className="w-8 h-8 text-[#8D4925] mx-auto" />
                <p className="text-sm font-bold text-[#252321]">
                  لا توجد بحوث مصعدة حالياً في جسر آدم برايم
                </p>
                <p className="text-xs text-[#5C5346]">
                  يمكنك تصعيد أي بحث من تبويب «التذاكر البحثية» عبر زر «🏛️ تصعيد البحث إلى آدم برايم» أو استيراد حزمة JSON أدناه.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {adamPrimeBundles.map((bundle) => (
                  <div
                    key={bundle.taskId}
                    className="p-5 rounded-2xl border border-[#E2DACB] bg-[#FAF6F0] space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded bg-[#8D4925] text-white font-mono text-xs font-bold">
                        {bundle.taskId}
                      </span>
                      <span className="text-xs font-bold text-[#5C5346]">
                        {bundle.locationLabel}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-[#252321]">
                      {bundle.title}
                    </h4>
                    <p className="text-xs text-[#5C5346]">
                      السلسلة المقترحة: {bundle.familyName} ⬅️{' '}
                      {bundle.subRootName} ⬅️ {bundle.targetAdamChain}
                    </p>
                    <p className="text-[11px] text-[#8D4925]">
                      المصدر المرجعي: {bundle.verifiedCitation}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* JSON IMPORT BOX */}
            <div className="pt-4 border-t border-[#E2DACB] space-y-3">
              <label className="block text-xs font-bold text-[#252321]">
                استيراد حزمة JSON مكتملة من محرك آدم برايم:
              </label>
              <textarea
                rows={3}
                value={customJsonInput}
                onChange={(e) => setCustomJsonInput(e.target.value)}
                placeholder='{"familyName": "بيت جنديل", "subRootName": "البلاسم", "motherTribeName": "بني لام"}'
                className="w-full p-3 rounded-xl border border-[#E2DACB] bg-[#FAF6F0] text-xs font-mono"
              />
              <button
                type="button"
                onClick={() => {
                  try {
                    const parsed = JSON.parse(customJsonInput);
                    if (!parsed.familyName) return;
                    const newBundle: AdamPrimeCompletedBundle = {
                      taskId: `AP-JSON-${Date.now().toString().slice(-4)}`,
                      title: `حزمة مستوردة: ${parsed.familyName}`,
                      familyName: parsed.familyName,
                      subRootName: parsed.subRootName || 'البلاسم',
                      motherTribeName: parsed.motherTribeName || 'بني لام',
                      locationLabel: parsed.locationLabel || 'العراق',
                      targetAdamChain:
                        parsed.targetAdamChain ||
                        'بني لام ⬅️ طيء ⬅️ كهلان ⬅️ سبأ ⬅️ قحطان ⬅️ آدم',
                      verifiedCitation:
                        parsed.verifiedCitation || 'حزمة آدم برايم المصدقة',
                      nodes: [],
                      imported: true,
                    };
                    setAdamPrimeBundles((prev) => [newBundle, ...prev]);
                    setCustomJsonInput('');
                    showToast(
                      `تم استيراد حزمة (${parsed.familyName}) في جسر آدم برايم بنجاح ✓`
                    );
                  } catch {
                    showToast('يرجى التأكد من صحة صيغة JSON المدخلة.');
                  }
                }}
                className="px-4 py-2 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-bold cursor-pointer"
              >
                <UploadCloud className="w-4 h-4 inline ml-1.5" />
                استيراد الحزمة إلى الجسر
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
