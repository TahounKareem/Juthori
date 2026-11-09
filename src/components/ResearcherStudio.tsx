import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  FileText,
  GitMerge,
  GripVertical,
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
  GERMAN_ENGINE_BASE_URL,
  MASTER_ADAM_NODES_MAP,
  ORIGIN_REGION_SUGGESTIONS,
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
  formatAlphaEvidenceCitation,
  formatAlphaReferenceBadge,
  formatCompactSourceBracket,
  getCanonicalAdamNodeDedupKey,
  getInitialAdamTreeNodesById,
  getVerifiedAddonSourcesForEvidence,
  inspectNameInAdamMasterTree,
  isAdamNodeStructurallyCoded,
  matchesFlexibleArabicSearch,
  mergeDetachedHistoricalEpithets,
  mergeVerifiedAddonSourceLists,
  normalizeArabic,
  normalizeArabicForSearch,
  normalizeArabicStem,
  parseOtherSourcesStringIntoLeads,
  resolveAdamTreeChildren,
  resolveDeterministicLineage,
  resolveResearcherDataLakeBadge,
  sanitizeAndNormalizeAdamNode,
  searchAdamPrimeUnifiedSourcesRegistry,
  searchJuthoriLineage,
  stemTribeToken,
  stitchLineageChains,
  tagConsensusWinnersOnEvidence,
  verifyAndAttachSecondarySourceToAdamPrime,
} from '../utils/lineageEngine';
import { LineageSpineColumn } from './LineageSpineColumn';
import {
  fetchAllResearchTicketsForStaff,
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
    | 'P3_PROACTIVE_MINING';
  adamNodeId?: string;
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
    .split(/(?:؛|⬅️|<-|->|—|،|\||>)/)
    .map((s) => s.trim())
    .filter(Boolean);
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
      res.primary_source_of_truth === 'UNMATCHED_P1_TICKET'
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
    setRawSources([]);
    searchJuthoriLineage({
      accountType: AccountLegalType.Individual,
      firstName: 'باحث',
      fatherName: '—',
      grandfatherName: '—',
      familyName:
        params.familyName.trim() ||
        params.tribeName.trim() ||
        params.branchName.trim() ||
        'غير محدد',
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
    })
      .then((liveRes) => {
        setDirectSearchResult(liveRes);
        const extracted = extractRawSourcesFromResult(liveRes);
        setRawSources(extracted);
      })
      .catch(() => {
        const unmatchedFallback = runDirectInspectionSearch(params);
        setDirectSearchResult(unmatchedFallback);
        setRawSources([]);
      });
  };

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
          source_book: parsedRef.book || ev.source_book,
          volume: parsedRef.volume || ev.volume,
          page: parsedRef.page || ev.page,
          parsed_other_sources: parsedLeads,
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

    const resolvedBridge: SuggestedAdamBridgeForResearcher =
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

    const suggestedAdamEntry = `${resolvedBridge.adam_node_id}: ${resolvedBridge.adam_chain_preview}`;

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
      adamNodeId: res.adamNodeId || resolvedBridge.adam_node_id,
      fullAdamSpineCount: resolvedStitchedLineage.length,
      fullAdamSpineStations: resolvedStitchedLineage.map((u) => u.name),
      title:
        category === 'ADAM_NODE_ENRICHMENT'
          ? `تذكرة إثراء عقدة شجرة آدم (${cleanFam}) — ${evidenceList.length} روايات ومصادر رديفة`
          : category === 'ALPHA_TO_ADAM_LINK'
          ? `تذكرة ربط وإثراء شجرة آدم من مشاريع ألفا: (${cleanFam} ⬅️ ${subRoot} ⬅️ ${motherTribe})`
          : `تذكرة بحث عميل مباشرة: تحقيق وتوثيق عمود نسب (${cleanFam})`,
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
                extractedSnippet: `رواية موثقة لـ (${cleanFam}) ضمن (${subRoot} ⬅️ ${motherTribe})`,
              })),
      suggestedAdamTarget: {
        confidencePercent: 98,
        entryNodeName: suggestedAdamEntry,
        fullChainPreview: `${cleanFam} ⬅️ ${resolvedStitchedLineage
          .map((n) => n.name)
          .join(' ⬅️ ')} ⬅️ ${resolvedBridge.adam_chain_preview}`,
        rationale:
          resolvedBridge.confidence_label ||
          `تقاطع موثق في شجرة آدم عند المحطة (${resolvedBridge.matched_station_name}).`,
      },
      extractedNodes: diag.cleanExtractedNodes,
    };
  };

  const buildTicketFromP3Candidate = (
    cand: P3ProactiveCandidate
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
      diag.resolvedMotherTribe
    );
    const resolvedLake3 = buildLake3UnlinkedProjectsForResearcher(
      cand.familyName,
      diag.resolvedMotherTribe,
      cand.inferredCountries[0] || 'العراق'
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

    return {
      id: cand.ticketId,
      queue: 'P3',
      priorityTier: 'P3_PROACTIVE_ALPHA_ENRICHMENT',
      precomputed_diagnostic: diag.precomputed,
      p3StrategicMeta: {
        ...cand.strategicMeta,
        chain_stations_count: diag.cleanExtractedNodes.length,
        corroborating_sources_count: diag.enrichedEvidence.length,
      },
      ticketCategory: 'P3_PROACTIVE_MINING',
      adamNodeId: resolvedBridge.adam_node_id,
      fullAdamSpineCount: stitchedNodes.length,
      fullAdamSpineStations: stitchedNodes.map((u) => u.name),
      title: `تعدين استباقي ذكي (P3): وصل وإثراء (${cand.familyName} ⬅️ ${diag.resolvedSubRoot} ⬅️ ${diag.resolvedMotherTribe}) بشجرة آدم`,
      clientName: 'مولد التعدين الاستباقي الذكي (Auto-Miner)',
      familyName: cand.familyName,
      subRootName: diag.resolvedSubRoot,
      motherTribeName: diag.resolvedMotherTribe,
      locationLabel: cand.locationLabel,
      status: 'open',
      createdAt: 'توليد ذكي آلي · P3 Auto-Queue',
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
        project: 'بحيرة ألفا (P3 Proactive Mining)',
        bookCitation: formatAlphaEvidenceCitation(ev),
        extractedSnippet: `السلسلة المستخرجة: ${ev.lineage_ancestors}`,
      })),
      suggestedAdamTarget: {
        confidencePercent: 98,
        entryNodeName: `${resolvedBridge.adam_node_id}: ${resolvedBridge.adam_chain_preview}`,
        fullChainPreview: `${cand.familyName} ⬅️ ${stitchedNodes
          .map((n) => n.name)
          .join(' ⬅️ ')} ⬅️ ${resolvedBridge.adam_chain_preview}`,
        rationale: `مرشح استراتيجي بوزن (${cand.strategicMeta.strategic_score} نقطة) جاهز للربط المباشر بشجرة آدم.`,
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

  // Initialize tickets from Firebase Firestore `research_tickets` + Proactive P3 Queue
  const [tickets, setTickets] = useState<ResearcherStudioTicket[]>([]);

  useEffect(() => {
    let isMounted = true;
    const loadRealTicketsAndP3Queue = async () => {
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
          if (!fam) continue;

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

          if (docItem.ticketCategory) {
            built.ticketCategory = docItem.ticketCategory;
            built.priorityTier =
              docItem.ticketCategory === 'P1_CUSTOMER_SEARCH'
                ? 'P1_CLIENT_UNMATCHED'
                : 'P2_CLIENT_ADAM_BRIDGE';
            built.queue =
              docItem.ticketCategory === 'P1_CUSTOMER_SEARCH' ? 'P1' : 'P2';
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
          }

          hydratedList.push(built);
        }

        // Also fetch/generate P3 Proactive Alpha Enrichment tickets so researchers always have high-value mining work
        const existingFams = new Set(hydratedList.map((t) => t.familyName));
        const p3Candidates = await fetchOrGenerateP3ProactiveTickets(
          4,
          existingFams
        );
        if (!isMounted) return;
        const p3Tickets = p3Candidates.map((cand) =>
          buildTicketFromP3Candidate(cand)
        );

        setTickets([...hydratedList, ...p3Tickets]);
      } catch (err) {
        console.warn('Firestore ticket sync warning:', err);
        const p3Fallback = await fetchOrGenerateP3ProactiveTickets(4);
        if (isMounted) {
          setTickets(p3Fallback.map((cand) => buildTicketFromP3Candidate(cand)));
        }
      }
    };
    loadRealTicketsAndP3Queue();
    return () => {
      isMounted = false;
    };
  }, [currentClientResult]);

  // =========================================================================
  // PILLAR 2: 3-TIER PRIORITY QUEUE (`P1 -> P2 -> P3 Auto-Refill Mining Queue`)
  // =========================================================================
  const [inboxCategoryFilter, setInboxCategoryFilter] = useState<
    | 'ALL_PRIORITY_SORTED'
    | 'P1_CLIENT_UNMATCHED'
    | 'P2_CLIENT_ADAM_BRIDGE'
    | 'P3_PROACTIVE_ALPHA_ENRICHMENT'
    | 'ALPHA_ADAM_ENRICHMENT'
    | 'DIRECT_CUSTOMER_TICKETS'
  >('ALL_PRIORITY_SORTED');

  const resolveTicketPriorityTier = (
    t: ResearcherStudioTicket
  ): TicketPriorityTier => {
    if (t.priorityTier) return t.priorityTier;
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
    if (tier === 'P2_CLIENT_ADAM_BRIDGE') return 2;
    return 3;
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

  const handleAutoRefillNextP3Tickets = async (count = 1) => {
    setIsGeneratingP3Batch(true);
    try {
      const existingFams = new Set(tickets.map((t) => t.familyName));
      const newCands = await fetchOrGenerateP3ProactiveTickets(
        count,
        existingFams
      );
      if (newCands.length > 0) {
        const builtNew = newCands.map((c) => buildTicketFromP3Candidate(c));
        setTickets((prev) => {
          const existingIds = new Set(prev.map((t) => t.id));
          const uniqueNew = builtNew.filter((b) => !existingIds.has(b.id));
          return [...prev, ...uniqueNew];
        });
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
    nodeName: string
  ) => {
    const localResult = inspectNameInAdamMasterTree(nodeName, adamGraphNodes);
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
          const firstMatch = remoteNodes[0];
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
        className="space-y-4 rounded-2xl border border-stone-200 bg-[#FAF8F5] p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 pb-3">
          <div>
            <h4 className="text-sm font-bold font-serif text-[#141414]">
              خوارزمية التوافق والمقارنة بين المصادر المتعددة لاسم ({familyName})
            </h4>
            <p className="text-xs text-stone-500 mt-0.5">
              تحليل آلي لتقاطع حقلَي «نسب الأجداد» و«الفروع الأبناء» عبر ({safeEvidence.length}) سجلات مرصودة
            </p>
          </div>
          <span className="px-3 py-1 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-950 text-xs font-bold">
            {clusters.length === 1
              ? 'مسار موحد في المصادر ✓'
              : `${clusters.length} مسارات مرصودة للمقارنة`}
          </span>
        </div>

        {/* SECTION 1: 🌟 مسار التوافق المرجعي المرجّح (Consensus Cluster) */}
        <div className="rounded-2xl border-2 border-emerald-600/80 bg-emerald-50/60 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold font-serif text-emerald-950">
                🌟 مسار التوافق المرجعي المرجّح (Consensus Cluster)
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-700 text-white text-[11px] font-bold">
                مرجّح في عدة مصادر ({consensusWinner.sourcesCount} مراجع)
              </span>
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
                  className="px-3 py-1 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-[11px] font-bold cursor-pointer transition-colors"
                >
                  عرض هذا المسار في العمود أعلاه
                </button>
              )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="bg-white rounded-xl p-2.5 border border-emerald-200">
              <span className="text-[11px] text-stone-500 block">
                الأصل / القبيلة الأم المرجّحة:
              </span>
              <span className="font-extrabold text-emerald-950">
                {consensusWinner.originTribeLabel}
              </span>
            </div>
            <div className="bg-white rounded-xl p-2.5 border border-emerald-200">
              <span className="text-[11px] text-stone-500 block">
                عقدتا الجذر ($5):
              </span>
              <span className="font-bold text-stone-900">
                {consensusWinner.rootPreviewLabel}
              </span>
            </div>
            <div className="bg-white rounded-xl p-2.5 border border-emerald-200">
              <span className="text-[11px] text-stone-500 block">
                النطاق الجغرافي المتوافق عليه:
              </span>
              <span className="font-bold text-stone-900">
                {consensusWinner.geographicScope}
              </span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-3 border border-emerald-200 space-y-1.5">
            <div className="text-[11px] font-bold text-emerald-900">
              السلسلة الكاملة المتفق عليها والعُقد المشتركة ({consensusWinner.sharedNodes.join(' ، ')}):
            </div>
            <p className="text-xs font-bold text-stone-800 leading-relaxed">
              {consensusWinner.fullChainNodes.join(' ⬅️ ')}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] font-bold text-slate-700">
                توافق {consensusWinner.records.length} مصادر:
              </span>
              {consensusWinner.records.map((ev: CorroboratingAlphaEvidence, i: number) => {
                const lakeBadge = resolveResearcherDataLakeBadge(ev);
                return (
                  <span
                    key={ev.alpha_id || i}
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-100 border border-slate-300 text-[11px] font-sans font-bold text-slate-700 shadow-2xs"
                  >
                    <span>{formatCompactSourceBracket(ev)}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-extrabold border ${lakeBadge.colorClass}`}
                    >
                      {lakeBadge.tag}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* SECTION 2: 📚 القائمة الكاملة لكافة المسارات والعناقيد المكتشفة للباحث (حتى المستبعدة من واجهة العميل) */}
        <div
          data-testid="researcher-all-discovered-clusters-list"
          className="rounded-2xl border border-amber-300 bg-amber-50/50 p-4 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-sm font-extrabold font-serif text-amber-950 block">
                📚 القائمة الكاملة لكافة المسارات والعناقيد المكتشفة في البيانات ({clusters.length} مسارات)
              </span>
              <span className="text-[11px] text-stone-600">
                تُعرض جميع المسارات هنا للباحث لأغراض التدقيق الشامل، بينما يقتصر سؤال العميل في المحاكي أدناه على أقوى مسارين فقط (إضافة لخيار لا أعرف)
              </span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-200/80 text-amber-950 text-[11px] font-bold">
              {competingClusters.length > 0
                ? `${clusters.length} عناقيد إجمالية (منها ${competingClusters.length} مسارات موازية)`
                : 'مسار موحد بدون مسارات متعارضة'}
            </span>
          </div>

          {competingClusters.length === 0 ? (
            <p className="text-xs text-stone-600 bg-white rounded-xl p-3 border border-amber-200">
              جميع المصادر المرصودة لاسم ({familyName}) تتفق على مسار نسبي واحد ولا توجد روايات متعارضة في القاعدة.
            </p>
          ) : (
            <div className="space-y-3">
              {clusters.map((comp, clusterIdx) => {
                const chainCount = comp.fullChainNodes.length;
                const isShownToCustomer = clusterIdx < 2;
                return (
                  <div
                    key={comp.clusterId}
                    className={`bg-white rounded-xl p-3.5 border space-y-2 ${
                      clusterIdx === 0
                        ? 'border-emerald-400 bg-emerald-50/20'
                        : 'border-amber-300'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-stone-900 text-amber-300 font-mono text-[10px] font-bold">
                          عنقود #{clusterIdx + 1}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-lg bg-amber-100 border border-amber-300 text-amber-950 text-xs font-extrabold">
                          مسار: {comp.originTribeLabel}
                        </span>
                        <span className="text-xs font-bold text-stone-700">
                          الجذر ($5): {comp.rootPreviewLabel}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isShownToCustomer
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              : 'bg-slate-100 text-slate-700 border-slate-300'
                          }`}
                        >
                          {isShownToCustomer
                            ? `✓ يُعرض للعميل في سؤال التحقق (الخيار #${clusterIdx + 1})`
                            : '👁️ مرصود للباحث فقط (لا يُعرض للعميل لمنع التشتيت)'}
                        </span>
                        {chainCount > 6 && (
                          <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-900 text-[10px] font-bold">
                            سلسلة طويلة ({chainCount} اسماً)
                          </span>
                        )}
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
                          className="px-3 py-1 rounded-xl bg-[#B45309] hover:bg-[#92400E] text-white text-[11px] font-bold cursor-pointer transition-colors"
                        >
                          معاينة مسار ({comp.originTribeLabel}) في العمود
                        </button>
                      )}
                    </div>

                    <div className="text-[11px] text-stone-600">
                      <span className="font-bold text-stone-800">النطاق الجغرافي:</span>{' '}
                      {comp.geographicScope}
                    </div>

                    <div className="bg-[#FAF8F5] rounded-lg p-2.5 border border-stone-200 text-xs text-stone-800 leading-relaxed">
                      <span className="font-bold text-[#B45309] block mb-1">
                        كامل سلسلة نسب الأجداد في السجل ({chainCount} محطة):
                      </span>
                      {comp.fullChainNodes.join(' ⬅️ ')}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] font-bold text-slate-700">
                        توافق ({comp.records.length}) {comp.records.length === 1 ? 'مصدر' : 'مصادر'}:
                      </span>
                      {comp.records.map((ev: CorroboratingAlphaEvidence, idx: number) => {
                        const lakeBadge = resolveResearcherDataLakeBadge(ev);
                        return (
                          <span
                            key={ev.alpha_id || idx}
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-100 border border-slate-300 text-[11px] font-sans font-bold text-slate-700 shadow-2xs"
                          >
                            <span>{formatCompactSourceBracket(ev)}</span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-extrabold border ${lakeBadge.colorClass}`}
                            >
                              {lakeBadge.tag}
                            </span>
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

    const resolvedBridge: SuggestedAdamBridgeForResearcher =
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

    const newTkt = buildTicketFromLineageResult(
      enrichedResultForTicket,
      `فحص باحث (${cleanFam})`
    );

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
    setInboxCategoryFilter('ALL_PRIORITY_SORTED');

    setSelectedTicketId(newTkt.id);
    setActiveSubTab('ticket_inbox');
    onSelectPortalSection?.('research_studio');

    showToast(
      `🚀 تم نقل مخرجات فحص (${cleanFam}) بالكامل إلى غرفة عمليات التذكرة (${newTkt.id}) للإثراء والتوثيق بنقرة واحدة!`
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

    return (
      <div
        data-testid="diagnostic-step5-secondary-sources-adam-prime-direct_search"
        className="rounded-3xl border border-indigo-200/90 bg-gradient-to-l from-indigo-50/40 via-white to-stone-50/60 p-5 shadow-2xs space-y-3.5"
      >
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-lg bg-indigo-900 text-amber-300 font-mono text-xs font-extrabold flex items-center justify-center shrink-0">
            5
          </span>
          <h3 className="text-sm font-extrabold font-serif text-[#141414]">
            القسم الخامس: المصادر الأخرى الخام المرصودة في الهامش
          </h3>
        </div>

        {extractedLeads.length === 0 ? (
          <div className="rounded-xl bg-white/90 border border-stone-200 px-3.5 py-2.5 text-xs text-stone-600">
            لا توجد إحالات لمصادر أخرى خام في سجلات ({familyName}) الحالية.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {extractedLeads.map((lead, lIdx) => {
              const autoMatch = resolveAutoMatchedAdamPrimeSource(lead);
              const isVerified =
                lead.verification_status === 'VERIFIED_ADDON_SOURCE';
              return (
                <div
                  key={`${lead.linked_alpha_id}-${lIdx}`}
                  data-testid={`compact-other-source-pill-${lIdx}`}
                  className="rounded-2xl bg-white border border-indigo-200/80 p-3 shadow-2xs flex flex-col justify-between gap-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <span className="text-xs font-extrabold text-[#141414]">
                      📘 {lead.extracted_book_title || autoMatch.title}
                    </span>
                    <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold">
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-950 border border-amber-300">
                        ج: {lead.extracted_volume || '—'}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-950 border border-amber-300">
                        ص: {lead.extracted_page || '—'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-1 border-t border-stone-100">
                    <span className="text-stone-600">
                      السجل المرتبط:{' '}
                      <strong className="text-stone-900">
                        {lead.linked_record_name || familyName}
                      </strong>
                    </span>

                    <span
                      className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border ${
                        isVerified
                          ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                          : 'bg-slate-100 text-slate-700 border-slate-300'
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
        : [];

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

    return (
      <div
        data-testid="gamified-ticket-operations-workspace"
        className="rounded-3xl border-2 border-[#141414] bg-gradient-to-b from-[#FAF8F5] via-white to-[#FAF8F5] p-5 sm:p-6 shadow-sm space-y-6"
      >
        {/* =========================================================
            P3 STRATEGIC SELECTION WEIGHT & REASONS CARD (WHEN P3 TICKET)
        ========================================================= */}
        {ticket.p3StrategicMeta && (
          <div
            data-testid="p3-strategic-selection-card"
            className="rounded-2xl border-2 border-emerald-600 bg-gradient-to-l from-emerald-950 via-emerald-900 to-stone-900 text-white p-4 space-y-2.5 shadow-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-xl bg-amber-400 text-stone-950 font-mono text-xs font-extrabold shadow-2xs">
                  [★ وزن استراتيجي: {ticket.p3StrategicMeta.strategic_score} نقطة]
                </span>
                <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-bold">
                  🟢 أولوية 3 (P3): التعدين الاستباقي الذكي لعقد ألفا ذات الثقل المرجعي
                </span>
              </div>
              <span className="text-[11px] font-mono text-amber-300">
                Auto-Refill Mining Queue
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-stone-300 font-bold">
                أسباب الاختيار الذكي:
              </span>
              {ticket.p3StrategicMeta.why_selected_reasons.map((reason, rIdx) => (
                <span
                  key={rIdx}
                  className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 text-amber-200 font-bold text-[11px]"
                >
                  • {reason}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* =========================================================
            PILLAR 1(A): EMBEDDED DIAGNOSTIC DRAWER (أكورديون/درج التشخيص الخوارزمي المدمج)
            Reverse Auto-Hydrated Diagnostic Context inside Ticket Operations Room
        ========================================================= */}
        <div
          data-testid="embedded-diagnostic-drawer"
          className="rounded-2xl border-2 border-amber-500/80 bg-gradient-to-l from-amber-50/90 via-[#FAF8F5] to-white overflow-hidden shadow-2xs"
        >
          <div
            onClick={() => setIsDiagnosticDrawerOpen((prev) => !prev)}
            className="p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-amber-50/60 transition-colors"
          >
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-lg bg-[#141414] text-amber-300 text-[11px] font-extrabold">
                  🔬 درج التشخيص الخوارزمي المدمج (Reverse Auto-Hydrated Diagnostic)
                </span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 border border-emerald-300 text-emerald-900 text-[10px] font-bold">
                  مُغذّى آلياً دون مغادرة التذكرة ✓
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-stone-700 pt-0.5">
                <span>
                  المصادر الخام: <strong>{diagnosticCtx.rawSourcesCount}</strong>
                </span>
                <span>·</span>
                <span>
                  العمليات الخوارزمية:{' '}
                  <strong>{diagnosticCtx.pipelineAuditBullets.length} مراحل</strong>
                </span>
                <span>·</span>
                <span className="text-amber-950 font-extrabold">
                  عقدتا الجذر: B2 ({diagnosticCtx.rootBranchB2}) ⬅️ B0 (
                  {diagnosticCtx.rootTribeB0})
                </span>
              </div>
            </div>

            <button
              type="button"
              data-testid="toggle-embedded-diagnostic-drawer-btn"
              className="px-3 py-1.5 rounded-xl bg-white border border-amber-400 text-amber-950 text-xs font-extrabold flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <span>
                {isDiagnosticDrawerOpen
                  ? 'طيّ درج التشخيص الفوري'
                  : 'فتح درج التشخيص الفوري الكامل'}
              </span>
              {isDiagnosticDrawerOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>

          {isDiagnosticDrawerOpen && (
            <div className="p-4 pt-0 border-t border-amber-200/80 space-y-4 bg-white/90">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-3">
                {/* 1. Raw Sources Summary inside Drawer (5 cols) */}
                <div className="lg:col-span-5 rounded-xl bg-[#FAF8F5] border border-stone-200 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-extrabold text-[#141414]">
                      1️⃣ ملخص المصادر الخام المرصودة ({allTicketEvidence.length})
                    </h5>
                    <span className="text-[10px] font-mono text-stone-500">
                      Raw Sources
                    </span>
                  </div>
                  {allTicketEvidence.length === 0 ? (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-[11px] font-bold text-amber-950">
                      تذكرة عميل (P1) بدون تطابق مباشر في المعاجم الحالية — موجهة للتحقيق المعمق.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {allTicketEvidence.map((ev, eIdx) => {
                        const lakeBadge = resolveResearcherDataLakeBadge(ev);
                        const rawChainTokens = extractRawRecordAncestors(ev);
                        return (
                          <div
                            key={ev.alpha_id || eIdx}
                            className="rounded-xl bg-white border border-stone-200 p-2.5 space-y-1.5 shadow-2xs"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-1">
                              <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-300 text-slate-800 text-[10px] font-bold">
                                {formatAlphaReferenceBadge(ev)}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold border ${lakeBadge.colorClass}`}
                              >
                                {lakeBadge.tag}
                              </span>
                            </div>
                            <div className="text-[11px] text-stone-800 font-bold leading-relaxed">
                              {rawChainTokens.join(' ⬅️ ')}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 2. 8-Stage Pipeline Audit inside Drawer (7 cols) */}
                <div className="lg:col-span-7 rounded-xl bg-amber-50/50 border border-amber-200 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-extrabold text-amber-950">
                      2️⃣ سجل العمليات الخوارزمية الـ 8 (8-Stage Pipeline Audit)
                    </h5>
                    <span className="px-2 py-0.5 rounded bg-amber-900 text-amber-100 font-mono text-[10px] font-bold">
                      B2: {diagnosticCtx.rootBranchB2} ⬅️ B0: {diagnosticCtx.rootTribeB0}
                    </span>
                  </div>
                  <ul className="space-y-1.5 text-[11px] text-stone-800 max-h-60 overflow-y-auto pr-1">
                    {diagnosticCtx.pipelineAuditBullets.map((b, bIdx) => (
                      <li
                        key={bIdx}
                        className="flex items-start gap-2 bg-white/90 rounded-lg px-2.5 py-1.5 border border-amber-200/70"
                      >
                        <span className="shrink-0">{b.icon}</span>
                        <div>
                          <strong className="text-amber-950">{b.title}:</strong>{' '}
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

        {/* =========================================================
            QUEST PROGRESS BAR HEADER (0% -> 100%)
        ========================================================= */}
        <div className="rounded-2xl bg-[#141414] text-white p-4 sm:p-5 space-y-3 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-stone-950 text-[11px] font-extrabold">
                  🎮 غرفة عمليات التذكرة التفاعلية (1-Click Studio)
                </span>
                <span className="text-xs text-stone-300 font-mono">
                  {ticket.id}
                </span>
                <span className="px-2.5 py-0.5 rounded-lg bg-stone-800 border border-stone-600 text-amber-300 font-mono text-[11px] font-bold">
                  ⏱️ زمن التذكرة النشطة: {formatDurationMmSs(activeTicketElapsedSeconds)}
                </span>
              </div>
              <h4 className="text-sm sm:text-base font-extrabold font-serif text-amber-300">
                شريط إنجاز التذكرة (Quest Progress Bar): خطوات سريعة بنقرة واحدة لإغلاق التذكرة وتغذية شجرة آدم
              </h4>
            </div>

            <div className="flex items-center gap-2">
              <span
                data-testid="quest-progress-percentage"
                className="px-3.5 py-1.5 rounded-xl bg-amber-400 text-stone-950 font-mono text-sm font-extrabold shadow-xs"
              >
                {questProgressPercent}% مكتمل
              </span>
            </div>
          </div>

          <div className="w-full h-3.5 rounded-full bg-stone-800 overflow-hidden p-0.5 border border-stone-700">
            <div
              className="h-full rounded-full bg-gradient-to-l from-emerald-400 via-amber-400 to-amber-500 transition-all duration-500"
              style={{ width: `${questProgressPercent}%` }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
            <div
              className={`rounded-xl px-3 py-2 border flex items-center justify-between ${
                isBridgeConnected
                  ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200'
                  : 'bg-stone-900 border-stone-700 text-stone-300'
              }`}
            >
              <span className="font-bold">
                1️⃣ المحطة 1: باني السلسلة وجسر آدم
              </span>
              <span className="font-mono text-[11px] font-extrabold">
                {isBridgeConnected ? '✅ مكتملة' : 'قيد الوصل'}
              </span>
            </div>

            <div
              className={`rounded-xl px-3 py-2 border flex items-center justify-between ${
                isStation2Completed
                  ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200'
                  : 'bg-stone-900 border-stone-700 text-stone-300'
              }`}
            >
              <span className="font-bold">
                2️⃣ المحطة 2: إثراء العقدة والفروع
              </span>
              <span className="font-mono text-[11px] font-extrabold">
                {isStation2Completed ? '✅ مكتملة' : 'جاهزة بنقرة'}
              </span>
            </div>

            <div
              className={`rounded-xl px-3 py-2 border flex items-center justify-between ${
                isStation3Completed
                  ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200'
                  : 'bg-stone-900 border-stone-700 text-stone-300'
              }`}
            >
              <span className="font-bold">
                3️⃣ المحطة 3: توثيق المصادر الإضافية ({verifiedLeadsCount}/
                {extractedLeads.length})
              </span>
              <span className="font-mono text-[11px] font-extrabold">
                {isStation3Completed ? '✅ مكتملة' : 'بانتظار التوثيق'}
              </span>
            </div>
          </div>
        </div>

        {/* =========================================================
            STATION 1: المحطة 1 — باني السلسلة التفاعلي وجسر شجرة آدم
        ========================================================= */}
        <div
          data-testid="workspace-station-1-lego-chain-builder"
          className="rounded-2xl border-2 border-emerald-600/80 bg-emerald-50/30 p-4 sm:p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-xl bg-emerald-800 text-white font-mono text-xs font-extrabold flex items-center justify-center">
                1
              </span>
              <div>
                <h5 className="text-sm font-extrabold font-serif text-emerald-950">
                  المحطة 1: باني السلسلة التفاعلي وجسر شجرة آدم (Interactive Lego Chain Builder & Adam Bridge)
                </h5>
                <p className="text-[11px] text-stone-600">
                  احذف أي شائبة بعلامة (×)، أو حرّك الكبسولات، أو اكتب اسم جد واضغط Enter، أو انقر على مقترحات البحيرة الثالثة لإضافتها بنقرة واحدة
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-xl bg-emerald-800 text-white text-xs font-bold">
              {liveNodes.length} كبسولات في السلسلة
            </span>
          </div>

          <div className="rounded-2xl bg-white border border-emerald-200 p-3.5 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {liveNodes.map((node, nIdx) => (
                <React.Fragment key={node.id || nIdx}>
                  <div
                    data-testid={`lego-chain-chip-${nIdx}`}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold shadow-2xs transition-all ${
                      nIdx === 0
                        ? 'bg-purple-50 border-purple-300 text-purple-950'
                        : nIdx === liveNodes.length - 1
                        ? 'bg-amber-50 border-amber-400 text-amber-950'
                        : 'bg-[#FAF8F5] border-stone-300 text-stone-900'
                    }`}
                  >
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/10">
                      {node.nodeCode || (nIdx === 0 ? 'FE0' : 'B1')}
                    </span>
                    <span>{node.name}</span>

                    {nIdx > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          handleMoveLivePreviewNode(ticket, nIdx, 'up')
                        }
                        className="px-1 rounded hover:bg-stone-200 text-stone-600 text-[11px] cursor-pointer"
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
                        className="px-1 rounded hover:bg-stone-200 text-stone-600 text-[11px] cursor-pointer"
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
                        className="w-4 h-4 rounded-full bg-red-100 hover:bg-red-600 text-red-700 hover:text-white flex items-center justify-center text-[11px] font-extrabold cursor-pointer transition-colors"
                        title="حذف هذه العقدة من السلسلة بنقرة واحدة"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  {nIdx < liveNodes.length - 1 && (
                    <span className="text-emerald-700 font-bold text-xs">
                      ⬅️
                    </span>
                  )}
                </React.Fragment>
              ))}

              <div className="inline-flex items-center gap-1">
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
                  placeholder="+ اكتب اسم جد واضغط Enter..."
                  className="px-3 py-1.5 rounded-xl border border-dashed border-emerald-500 bg-emerald-50/40 text-xs font-bold text-stone-900 focus:outline-none focus:border-emerald-700 w-48"
                />
                <button
                  type="button"
                  onClick={() =>
                    handleQuickAddChipToChain(
                      quickAncestorInputByTicket[ticket.id] || ''
                    )
                  }
                  className="px-2.5 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold cursor-pointer"
                >
                  إضافة
                </button>
              </div>
            </div>

            {lake3SuggestionNames.length > 0 && (
              <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-stone-600">
                  💡 مقترحات البحيرة الثالثة والروايات لإضافتها للسلسلة بنقرة واحدة:
                </span>
                {lake3SuggestionNames.map((sugName, sIdx) => (
                  <button
                    key={sIdx}
                    type="button"
                    onClick={() => handleQuickAddChipToChain(sugName)}
                    className="px-2.5 py-0.5 rounded-lg bg-purple-50 hover:bg-purple-100 border border-purple-300 text-purple-950 text-[11px] font-bold cursor-pointer transition-all"
                  >
                    + {sugName}
                  </button>
                ))}
              </div>
            )}
          </div>

          {ticket.suggestedAdamBridge && (
            <div className="rounded-2xl bg-emerald-950 text-white p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-400/20 text-emerald-200 text-[10px] font-bold">
                      جسر شجرة آدم المقترح آلياً
                    </span>
                    <span className="font-mono text-[11px] text-amber-300 font-bold">
                      العقدة #{ticket.suggestedAdamBridge.adam_node_id} (
                      {ticket.suggestedAdamBridge.matched_station_name})
                    </span>
                  </div>
                  <p className="text-xs font-mono text-stone-200">
                    {liveNodes.map((n) => n.name).join(' ⬅️ ')} ⬅️{' '}
                    <strong className="text-amber-300">
                      {appliedAdamBridgeByTicket[ticket.id] ||
                        ticket.suggestedAdamBridge.adam_chain_preview}
                    </strong>
                  </p>
                </div>

                <button
                  type="button"
                  data-testid="station1-connect-adam-bridge-btn"
                  onClick={() => {
                    const bridgePreview =
                      appliedAdamBridgeByTicket[ticket.id] ||
                      ticket.suggestedAdamBridge?.adam_chain_preview ||
                      '';
                    setAppliedAdamBridgeByTicket((prev) => ({
                      ...prev,
                      [ticket.id]: bridgePreview,
                    }));
                    showToast(
                      `⚡ تم اعتماد ووصل أعلى السلسلة (${
                        liveNodes[liveNodes.length - 1]?.name ||
                        ticket.familyName
                      }) بشجرة آدم بنجاح! تقدّم شريط الإنجاز 🚀`
                    );
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold cursor-pointer transition-all flex items-center gap-1.5 shadow-sm ${
                    isBridgeConnected
                      ? 'bg-emerald-500 text-stone-950'
                      : 'bg-amber-400 hover:bg-amber-300 text-stone-950'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {isBridgeConnected
                      ? '✅ تم وصل السلسلة بشجرة آدم بنجاح'
                      : '⚡ اعتماد ووصل السلسلة بشجرة آدم'}
                  </span>
                </button>
              </div>

              <div className="pt-2 border-t border-white/10 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={quickAdamBridgeSearchByTicket[ticket.id] || ''}
                  onChange={(e) =>
                    setQuickAdamBridgeSearchByTicket((prev) => ({
                      ...prev,
                      [ticket.id]: e.target.value,
                    }))
                  }
                  placeholder="🔍 أو ابحث فورياً عن عقدة أخرى في شجرة آدم للربط المباشر..."
                  className="px-3 py-1 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-stone-400 text-xs focus:outline-none focus:border-amber-400 w-72"
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
                      ].join(' ⬅️ ');
                      setAppliedAdamBridgeByTicket((prev) => ({
                        ...prev,
                        [ticket.id]: chainText,
                      }));
                      setQuickAdamBridgeSearchByTicket((prev) => ({
                        ...prev,
                        [ticket.id]: '',
                      }));
                      showToast(
                        `🌳 تم ربط السلسلة بعقدة شجرة آدم: ${mNode.name} (#${mNode.node_id})!`
                      );
                    }}
                    className="px-2.5 py-1 rounded-lg bg-amber-400/20 hover:bg-amber-400/40 border border-amber-400/50 text-amber-200 text-[11px] font-bold cursor-pointer"
                  >
                    ⚡ ربط بـ {mNode.name} ({mNode.arc_code})
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* =========================================================
            STATION 2: المحطة 2 — إثراء العقدة بالمصادر الأساسية والفروع والمواضع
        ========================================================= */}
        <div
          data-testid="workspace-station-2-node-enrichment"
          className="rounded-2xl border-2 border-amber-500/80 bg-amber-50/30 p-4 sm:p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-xl bg-[#B45309] text-white font-mono text-xs font-extrabold flex items-center justify-center">
                2
              </span>
              <div>
                <h5 className="text-sm font-extrabold font-serif text-amber-950">
                  المحطة 2: إثراء العقدة بالمصادر الأساسية والفروع والمواضع (1-Click Node Enrichment)
                </h5>
                <p className="text-[11px] text-stone-600">
                  جميع المصادر الأساسية والفروع الأبناء والمواضع الجغرافية المستخرجة مفعّلة كأزرار سريعة (✓ Toggle Pills) وجاهزة للاعتماد بنقرة واحدة
                </p>
              </div>
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
                  `✅ تم اعتماد إثراء العقدة بـ (${activeSourceIndices.length}) مصادر أساسية و(${activeBranchPills.length}) فروع و(${activeLocationPills.length}) مواضع جغرافية!`
                );
              }}
              className={`px-4 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer transition-all shadow-2xs ${
                isStation2Completed
                  ? 'bg-emerald-700 text-white'
                  : 'bg-[#B45309] hover:bg-[#92400E] text-white'
              }`}
            >
              {isStation2Completed
                ? '✓ تم اعتماد عناصر الإثراء للعقدة'
                : '⚡ اعتماد كافة عناصر الإثراء المفعّلة بنقرة واحدة'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl bg-white border border-amber-200 p-3 space-y-2">
              <span className="text-xs font-extrabold text-stone-800 block">
                📚 المصادر الأساسية ({activeSourceIndices.length}/
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
                          ? 'bg-emerald-100 border-emerald-500 text-emerald-950'
                          : 'bg-stone-50 border-stone-300 text-stone-500'
                      }`}
                    >
                      {isSelected ? '✓ ' : '+ '}
                      {formatCompactSourceBracket(ev)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl bg-white border border-amber-200 p-3 space-y-2">
              <span className="text-xs font-extrabold text-stone-800 block">
                🌿 الفروع الأبناء المستخرجة ({activeBranchPills.length}):
              </span>
              {allCandidateBranches.length === 0 ? (
                <span className="text-[11px] text-stone-500 block">
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
                            ? activeBranchPills.filter((item) => item !== br)
                            : [...activeBranchPills, br];
                          setSelectedBranchPillsByTicket((prev) => ({
                            ...prev,
                            [ticket.id]: next,
                          }));
                          setEnrichmentBranchesInput(next.join('، '));
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-emerald-100 border-emerald-500 text-emerald-950'
                            : 'bg-stone-50 border-stone-300 text-stone-500'
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

            <div className="rounded-xl bg-white border border-amber-200 p-3 space-y-2">
              <span className="text-xs font-extrabold text-stone-800 block">
                📍 المواضع الجغرافية ({activeLocationPills.length}):
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
                          ? activeLocationPills.filter((item) => item !== loc)
                          : [...activeLocationPills, loc];
                        setSelectedLocationPillsByTicket((prev) => ({
                          ...prev,
                          [ticket.id]: next,
                        }));
                        setEnrichmentLocationsInput(next.join('، '));
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-amber-100 border-amber-500 text-amber-950'
                          : 'bg-stone-50 border-stone-300 text-stone-500'
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
        </div>

        {/* =========================================================
            STATION 3: المحطة 3 — توثيق المصادر الإضافية (other_sources) ومزامنة سجل آدم برايم الموحد
        ========================================================= */}
        <div
          data-testid="workspace-station-3-secondary-sources-adam-prime"
          className="rounded-2xl border-2 border-indigo-600/80 bg-indigo-50/30 p-4 sm:p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-200 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-xl bg-indigo-900 text-amber-300 font-mono text-xs font-extrabold flex items-center justify-center">
                3
              </span>
              <div>
                <h5 className="text-sm font-extrabold font-serif text-indigo-950">
                  المحطة 3: توثيق المصادر الإضافية (other_sources) ومزامنة سجل آدم برايم الموحد
                </h5>
                <p className="text-[11px] text-stone-600">
                  مطابقة تلقائية ذكية مع معرف آدم برايم الموحد، مع اختيار سريع لسعر الإتاحة في محفظة العميل وتوثيق فوري بضغطة زر واحدة
                </p>
              </div>
            </div>

            <span className="px-3 py-1 rounded-xl bg-indigo-900 text-amber-300 text-xs font-bold">
              الموثق: {verifiedLeadsCount} من {extractedLeads.length}
            </span>
          </div>

          {extractedLeads.length === 0 ? (
            <div className="rounded-xl bg-white border border-indigo-200 p-3.5 text-xs font-bold text-emerald-900 flex items-center justify-between">
              <span>
                ✅ لا توجد إحالات هامشية معلقة في حقل (other_sources) لهذه التذكرة — المحطة 3 مكتملة تلقائياً!
              </span>
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
                  selectedAdamPrimeIdByLeadKey[leadKey] || autoMatch.source_id;
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
                    className={`rounded-2xl border-2 p-4 transition-all space-y-3 ${
                      isVerified
                        ? 'bg-emerald-50/80 border-emerald-500 shadow-2xs'
                        : 'bg-white border-indigo-200 hover:border-indigo-400'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs sm:text-sm font-extrabold text-[#141414]">
                          📘 {lead.extracted_book_title || autoMatch.title}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-amber-100 border border-amber-300 text-amber-950 font-mono text-xs font-bold">
                          ج: {lead.extracted_volume || '—'}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-amber-100 border border-amber-300 text-amber-950 font-mono text-xs font-bold">
                          ص: {lead.extracted_page || '—'}
                        </span>
                        <span className="text-xs text-stone-600">
                          للسجل:{' '}
                          <strong className="text-stone-900">
                            {lead.linked_record_name || ticket.familyName}
                          </strong>
                        </span>
                      </div>

                      <span
                        className={`px-3 py-1 rounded-full text-xs font-extrabold border ${
                          isVerified
                            ? 'bg-emerald-800 text-white border-emerald-900'
                            : 'bg-indigo-100 text-indigo-950 border-indigo-300'
                        }`}
                      >
                        {isVerified
                          ? `✅ موثق ومربوط بآدم برايم (${chosenId})`
                          : `🏛️ مطابقة آدم برايم التلقائية: ${chosenId}`}
                      </span>
                    </div>

                    {isSearchOpen && (
                      <div className="rounded-xl bg-[#FAF8F5] border border-indigo-200 p-2.5 flex flex-wrap items-center gap-2">
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
                          className="px-3 py-1 rounded-lg border border-stone-300 bg-white text-xs font-bold w-64"
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
                            className="px-2.5 py-1 rounded-lg bg-indigo-900 text-amber-300 text-[11px] font-bold cursor-pointer"
                          >
                            اختيار [{reg.source_id}] {reg.title}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-stone-200/80">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-bold text-stone-600 ml-1">
                          سعر الإتاحة في محفظة العميل:
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
                                  ? 'bg-amber-400 border-amber-600 text-stone-950 shadow-2xs'
                                  : 'bg-stone-50 border-stone-300 text-stone-700 hover:bg-stone-100'
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
                          className="px-2.5 py-1 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-[11px] text-stone-600 font-bold cursor-pointer mr-1"
                        >
                          🔍 بحث بكلمة عند الحاجة
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
                        className={`px-4 py-2 rounded-xl text-xs font-extrabold cursor-pointer transition-all shadow-xs flex items-center gap-1.5 ${
                          isVerified
                            ? 'bg-emerald-800 hover:bg-emerald-900 text-white'
                            : 'bg-indigo-900 hover:bg-indigo-950 text-amber-300'
                        }`}
                      >
                        <Sparkles className="w-4 h-4 shrink-0" />
                        <span>
                          {verifyingLeadKey === leadKey
                            ? 'جارٍ التوثيق والمزامنة...'
                            : isVerified
                            ? `✅ موثق ومربوط بآدم برايم (${
                                currentPrice === 0
                                  ? 'مجاني'
                                  : `$${currentPrice}`
                              })`
                            : '✨ توثيق في آدم برايم وإتاحة للعميل'}
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

      // 2. Store authoritative server children list for this (nodeId, codedOnly) pair
      setServerChildrenByKey((prev) => ({
        ...prev,
        [cacheKey]: parsedChildren.map((entry) => ({
          node_id: entry.node.node_id,
          skippedGenerations: entry.skippedGenerations,
        })),
      }));
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

        setLiveSearchNodes(finalIncoming);
        setLiveSearchTotals({
          total: Number(data.filtered_total ?? finalIncoming.length),
          coded: Number(
            data.filtered_coded ??
              finalIncoming.filter((n) => isAdamNodeStructurallyCoded(n)).length
          ),
        });

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
    try {
      await fetch(
        `${GERMAN_ENGINE_BASE_URL}/api/v1/juthori/researcher/close-enrichment-ticket`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adamNodeId: newAdamNodeId,
            familyName: ticket.familyName,
            addedVerifiedSources: selectedCitations,
            addedSiblingBranches: [resolvedSubRoot],
            addedLocations: ticket.inferredCountries || [ticket.locationLabel],
            mergedNodes: liveNodes,
          }),
        }
      );
    } catch {
      // Offline fallback
    }

    await markAlphaNodeBridgedOnServer({
      ticketId: ticket.id,
      familyName: ticket.familyName,
      adamNodeId: newAdamNodeId,
      bridgedChain: liveNodes.map((n) => n.name),
      verifiedSources: selectedCitations,
      alphaIds: evList.map((e) => e.alpha_id).filter(Boolean) as string[],
    });

    // 3. Update Firestore ticket status & send real customer notification
    if (ticket.firestoreDocId) {
      await updateResearchTicketFullInFirebase(ticket.firestoreDocId, {
        status: 'CLOSED_AND_ENRICHED',
        verifiedSources: selectedCitations.join(' | '),
      });
    }
    if (ticket.userId) {
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

    // 4. Record KPI Telemetry & Auto-Refill P3 Queue
    recordKpiTicketCompletion(ticket, selectedCitations.length);

    setTickets((prev) => {
      const updated = prev.map((t) =>
        t.id === ticket.id
          ? {
              ...t,
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

    if (
      ticket.queue === 'P3' ||
      ticket.priorityTier === 'P3_PROACTIVE_ALPHA_ENRICHMENT'
    ) {
      handleAutoRefillNextP3Tickets(1);
    }

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

    try {
      await fetch(
        `${GERMAN_ENGINE_BASE_URL}/api/v1/juthori/researcher/close-enrichment-ticket`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adamNodeId: ticket.adamNodeId || '272887',
            familyName: ticket.familyName,
            addedVerifiedSources: selectedCitations,
            addedSiblingBranches: parsedBranches,
            addedNotables: parsedNotables,
            addedLocations: parsedLocations,
          }),
        }
      );
    } catch {
      // Offline fallback
    }

    await markAlphaNodeBridgedOnServer({
      ticketId: ticket.id,
      familyName: ticket.familyName,
      adamNodeId: ticket.adamNodeId || '272887',
      bridgedChain: getLivePreviewNodesForTicket(ticket).map((n) => n.name),
      verifiedSources: selectedCitations,
      alphaIds: evList.map((e) => e.alpha_id).filter(Boolean) as string[],
    });

    if (ticket.firestoreDocId) {
      await updateResearchTicketFullInFirebase(ticket.firestoreDocId, {
        status: 'CLOSED_AND_ENRICHED',
        verifiedSources: selectedCitations.join(' | '),
      });
    }

    recordKpiTicketCompletion(ticket, selectedCitations.length);

    setTickets((prev) => {
      const updated = prev.map((t) =>
        t.id === ticket.id
          ? { ...t, status: 'CLOSED_AND_ENRICHED' as const }
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

    if (
      ticket.queue === 'P3' ||
      ticket.priorityTier === 'P3_PROACTIVE_ALPHA_ENRICHMENT'
    ) {
      handleAutoRefillNextP3Tickets(1);
    }

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
    <div dir="rtl" className="min-h-screen bg-[#F5F2EB] text-[#141414] pb-16">
      {/* =====================================================================
          3 CLEAN HORIZONTAL SUB-TABS BAR FOR RESEARCH STUDIO ONLY
          (Hidden in standalone "إدارة شجرة آدم" and "البحث والفحص" pages)
      ===================================================================== */}
      {activeSubTab !== 'adam_tree_explorer' &&
        activeSubTab !== 'direct_search' &&
        activePortalSection !== 'adam_tree_management' &&
        activePortalSection !== 'direct_search_inspection' && (
          <div className="bg-white border-b border-stone-200 sticky top-0 z-30 shadow-xs">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveSubTab('ticket_inbox');
                    onSelectPortalSection?.('research_studio');
                  }}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    activeSubTab === 'ticket_inbox'
                      ? 'bg-[#B45309] text-white shadow-sm'
                      : 'bg-[#FAF8F5] text-stone-700 hover:bg-stone-100 border border-stone-200/80'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>📥 صندوق تذاكر العملاء</span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
                      activeSubTab === 'ticket_inbox'
                        ? 'bg-white/20 text-white'
                        : 'bg-amber-100 text-amber-900'
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
                  onClick={() => setActiveSubTab('drag_drop_linker')}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    activeSubTab === 'drag_drop_linker'
                      ? 'bg-[#B45309] text-white shadow-sm'
                      : 'bg-[#FAF8F5] text-stone-700 hover:bg-stone-100 border border-stone-200/80'
                  }`}
                >
                  <GitMerge className="w-4 h-4" />
                  <span>🔗 الربط والسحب والإفلات</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSubTab('adam_prime_bridge')}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    activeSubTab === 'adam_prime_bridge'
                      ? 'bg-[#B45309] text-white shadow-sm'
                      : 'bg-[#FAF8F5] text-stone-700 hover:bg-stone-100 border border-stone-200/80'
                  }`}
                >
                  <Cpu className="w-4 h-4" />
                  <span>🏛️ جسر آدم برايم</span>
                  {adamPrimeBundles.length > 0 && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-amber-500 text-white">
                      {adamPrimeBundles.length}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

      {/* TOAST FEEDBACK BANNER */}
      {toastBanner && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-4">
          <div className="bg-emerald-950 text-emerald-100 border border-emerald-700 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-md">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <p className="text-xs sm:text-sm font-bold">{toastBanner}</p>
            </div>
            <button
              type="button"
              onClick={() => setToastBanner(null)}
              className="text-xs text-emerald-300 hover:text-white cursor-pointer"
            >
              إغلاق ✕
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-6">
        {/* ===================================================================
            SUB-TAB 1: 🔍 البحث والفحص (أداة الفحص والبحث المباش)
        =================================================================== */}
        {activeSubTab === 'direct_search' && (
          <div className="bg-white rounded-3xl border border-stone-200/90 shadow-xs overflow-hidden">
            <div className="bg-[#FAF8F5] border-b border-stone-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-[#B45309]">
                  <Search className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold font-serif text-[#141414]">
                    🔍 البحث والفحص — محاكي مسار الدمج والخياطة (Diagnostic Tracker)
                  </h2>
                  <p className="text-xs text-stone-500 mt-0.5">
                    تتبع خطوة بخطوة لكيفية قراءة المحرك للمصادر الخام، ومنطق العنقدة والخياطة، والسلسلة النهائية المخيطة، ومحاكي أسئلة التحقق للعميل
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-950 text-[11px] font-mono font-bold">
                4-Step Diagnostic Tracker
              </span>
            </div>

            <div className="p-6 space-y-6">
              <form
                onSubmit={handleExecuteDirectSearch}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 bg-[#FAF8F5] p-4 rounded-2xl border border-stone-200/80"
              >
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    اسم العائلة / الشهرة (FE0)
                  </label>
                  <input
                    type="text"
                    value={directSearchFamilyName}
                    onChange={(e) => setDirectSearchFamilyName(e.target.value)}
                    placeholder="مثال: قدم، ال قحيم، بيت جنديل، آل مقيت..."
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs font-bold focus:outline-none focus:border-[#B45309]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    القبيلة (اختياري)
                  </label>
                  <input
                    type="text"
                    value={directSearchTribeName}
                    onChange={(e) => setDirectSearchTribeName(e.target.value)}
                    placeholder="مثال: قحطان، همدان، بني لام..."
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs font-bold focus:outline-none focus:border-[#B45309]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    الفخذ / الفرع (اختياري)
                  </label>
                  <input
                    type="text"
                    value={directSearchBranchName}
                    onChange={(e) => setDirectSearchBranchName(e.target.value)}
                    placeholder="مثال: حاشد، البلاسم، آل برمان..."
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs font-bold focus:outline-none focus:border-[#B45309]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    الدولة
                  </label>
                  <select
                    value={directSearchCountry}
                    onChange={(e) => setDirectSearchCountry(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs font-bold focus:outline-none focus:border-[#B45309]"
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
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    الإقليم / المدينة (اختياري)
                  </label>
                  <input
                    type="text"
                    list="researcher-locality-datalist"
                    value={directSearchLocality}
                    onChange={(e) => setDirectSearchLocality(e.target.value)}
                    placeholder="مثال: العمارة، نجران، دير الزور..."
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs font-bold focus:outline-none focus:border-[#B45309]"
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
                    className="w-full py-2.5 px-4 bg-[#B45309] hover:bg-[#92400E] text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Search className="w-4 h-4" />
                    <span>فحص وتشخيص المسار</span>
                  </button>
                </div>
              </form>

              {!directSearchResult ? (
                <div className="rounded-2xl border border-dashed border-stone-300 bg-[#FAF8F5] p-8 text-center">
                  <Search className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-stone-700">
                    أدخل اسم العائلة أو القبيلة واضغط على «فحص وتشخيص المسار» لعرض المحاكي التشخيصي المكون من 4 مراحل
                  </p>
                </div>
              ) : (
                (() => {
                  const extractedFromCurrent =
                    extractRawSourcesFromResult(directSearchResult);
                  const rawEvidenceList: CorroboratingAlphaEvidence[] =
                    rawSources.length > 0
                      ? rawSources
                      : extractedFromCurrent;

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

                  const hasCompetingDisambiguationPaths =
                    !isDirectDeepResearchP1 && diagnosticClusters.length >= 2;

                  const primaryCluster =
                    diagnosticClusters.find((c) => c.isConsensusWinner) ||
                    diagnosticClusters[0];

                  // Contributing references for the active merged path (Step 2 & Step 3)
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

                  // Compute shared anchors and shared child branches across raw sources for Step 2
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

                  // Requirement 4(أ) & 4(ب): Synchronize `allCandidateDisambigOptions` 100% with `diagnosticClusters`
                  // If `diagnosticClusters.length === 1` (`!hasCompetingDisambiguationPaths`), `allCandidateDisambigOptions` is empty (`SINGLE_MATCH`)!
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

                  // Strictly limit the Customer Simulator to AT MOST 2 options (the 2 strongest paths by source weight)
                  const candidateDisambigOptions = [...allCandidateDisambigOptions]
                    .sort(
                      (a, b) =>
                        (b.sourcesCount || b.contributingSources?.length || 0) -
                        (a.sourcesCount || a.contributingSources?.length || 0)
                    )
                    .slice(0, 2);

                  // =========================================================================
                  // STEP 2 AUTOMATED PIPELINE AUDIT ANALYZER (8 Dynamic Diagnostic Points)
                  // =========================================================================
                  const searchedFamStem = stemTribeToken(directSearchResult.familyName);

                  // 1. Branch-to-Parent Attribution (`إسناد الفرع للحاضنة الأم`)
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

                  // 2. Compound Name Unrolling (`تفكيك الأسماء المركبة`)
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

                  // 3. Orthographic & OCR Normalization (`توحيد الرسم الإملائي والتصحيف المطبعي`)
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
                        variantsByStem.get(st)! .add(part);
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

                  // 4. Loop & Prefix Deduplication (`تنظيف التكرار الدائري ومقدمات الاختصار`)
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

                  // 5. Noise & Geo-Token Filtering (`فلترة الشوائب الجغرافية والوصفية`)
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

                  // 5b. Inverted Preamble Summary Stripper (`إصلاح التمهيد المعكوس في التفريغ`)
                  // & Detached Epithet Fusion (`دمج الألقاب التاريخية المفصولة وتوحيد التصحيف`)
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

                  // 8. Folded intermediate stations count for $5 2-Root Selection (`🔒 +X في السلسلة`)
                  const totalStitchedCount = finalStitchedStations.length;
                  const hiddenIntermediateCount = Math.max(0, totalStitchedCount - 3);

                  return (
                    <div className="space-y-6">
                      {/* =========================================================
                          STEP 1 CARD: القسم الأول — المصادر الخام (Raw Sources)
                          Requirement 2: Single Reference & Lake Badge in Header + Single Capsule Chain in Box
                      ========================================================= */}
                      <div
                        data-testid="diagnostic-step1-raw-sources"
                        className="rounded-3xl border-2 border-stone-300 bg-[#FAF8F5] p-5 sm:p-6 shadow-xs space-y-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3.5">
                          <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-xl bg-[#141414] text-amber-300 font-mono text-sm font-extrabold flex items-center justify-center shrink-0">
                              1
                            </span>
                            <div>
                              <h3 className="text-sm sm:text-base font-extrabold font-serif text-[#141414]">
                                القسم الأول: المصادر الخام المستخرجة من المعاجم (Raw Sources)
                              </h3>
                              <p className="text-xs text-stone-500 mt-0.5">
                                عرض نص وسلسلة كل مصدر خام كما وردت في المعجم أو المخطوطة بشكل منفصل مع التوثيق المرجعي الدقيق وشارة بحيرة البيانات للباحث
                              </p>
                            </div>
                          </div>
                          <span className="px-3 py-1 rounded-xl bg-white border border-stone-300 text-stone-800 text-xs font-bold">
                            إجمالي المصادر الخام المرصودة: {rawEvidenceList.length}
                          </span>
                        </div>

                        {rawEvidenceList.length === 0 ? (
                          <div className="rounded-2xl bg-amber-50/80 border border-amber-300 p-4 text-xs font-bold text-amber-950">
                            لم يتم رصد مصادر خام مطابقة في قواعد البيانات الحالية، تم الإحالة للبحث المعمق
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
                              return (
                                <div
                                  key={ev.alpha_id || idx}
                                  className="rounded-2xl bg-white border border-stone-200 p-4 shadow-2xs space-y-3 flex flex-col justify-between"
                                >
                                  <div className="space-y-2.5">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="flex items-center gap-1.5">
                                        <span className="px-2.5 py-0.5 rounded-lg bg-stone-900 text-amber-300 font-mono text-[11px] font-bold">
                                          المصدر الخام #{idx + 1}
                                        </span>
                                        <span
                                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                            ev.is_consensus_winner !== false
                                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                              : 'bg-amber-100 text-amber-900 border border-amber-300'
                                          }`}
                                        >
                                          {ev.is_consensus_winner !== false
                                            ? 'ضمن عنقود التوافق الأساسي'
                                            : 'مسار منافس مستقل'}
                                        </span>
                                      </div>

                                      {/* Requirement 2(أ): Single Book/Page Badge + Single Data Lake Badge in Upper Card Header */}
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span
                                          data-testid={`raw-source-ref-badge-${idx}`}
                                          className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-300 text-slate-700 text-[11px] font-sans font-bold shadow-2xs"
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

                                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-500">
                                      <div className="flex items-center gap-1.5">
                                        <span>اسم السجل في المعجم:</span>
                                        <strong className="text-stone-900">
                                          {ev.record_name || directSearchResult.familyName}
                                        </strong>
                                      </div>
                                      {(Boolean(ev.other_sources && ev.other_sources.trim()) ||
                                        (Array.isArray(ev.parsed_other_sources) &&
                                          ev.parsed_other_sources.length > 0)) && (
                                        <span
                                          data-testid={`raw-source-other-sources-badge-${idx}`}
                                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-400 text-amber-950 text-[10px] font-extrabold"
                                        >
                                          <span>⚠️</span>
                                          <span>
                                            إحالات لمصادر أخرى في الهامش (
                                            {ev.parsed_other_sources?.length || 1})
                                          </span>
                                        </span>
                                      )}
                                    </div>

                                    {/* Requirement 2(ب): Single Sequential Capsule Chain Box (No duplicate text line or duplicate badges) */}
                                    <div className="rounded-xl bg-[#FAF8F5] border border-stone-200/90 p-3 space-y-2">
                                      <span className="text-[11px] font-bold text-stone-600 block">
                                        السلسلة الخام كما وردت في المصدر:
                                      </span>
                                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                        {displayChainCapsules.map((tok, tIdx) => (
                                          <React.Fragment key={tIdx}>
                                            <span className="px-2.5 py-1 rounded-lg bg-white border border-stone-300 text-xs font-bold text-stone-900 shadow-2xs">
                                              {tok}
                                            </span>
                                            {tIdx < displayChainCapsules.length - 1 && (
                                              <span className="text-stone-500 font-bold text-xs">
                                                ⬅️
                                              </span>
                                            )}
                                          </React.Fragment>
                                        ))}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-100 text-[11px]">
                                    <div>
                                      <span className="text-stone-500 block">
                                        الفروع الأبناء في المصدر:
                                      </span>
                                      <span className="font-bold text-stone-800">
                                        {ev.child_branches || '—'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-stone-500 block">
                                        النطاق الجغرافي في المصدر:
                                      </span>
                                      <span className="font-bold text-stone-800">
                                        {ev.locations || directSearchResult.originCountry || '—'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* =========================================================
                          STEP 2 CARD: القسم الثاني — محرك العنقدة والخياطة (Stitching Engine Logic)
                          Requirement 3: Complete Automated Pipeline Audit (8 Dynamic Bullet Points)
                      ========================================================= */}
                      <div
                        data-testid="diagnostic-step2-stitching-logic"
                        className="rounded-3xl border-2 border-amber-500/80 bg-gradient-to-l from-amber-50/90 via-[#FAF8F5] to-amber-50/70 p-5 sm:p-6 shadow-xs space-y-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-300/70 pb-3.5">
                          <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-xl bg-[#B45309] text-white font-mono text-sm font-extrabold flex items-center justify-center shrink-0">
                              2
                            </span>
                            <div>
                              <h3 className="text-sm sm:text-base font-extrabold font-serif text-[#141414]">
                                القسم الثاني: محرك العنقدة والخياطة — السجل التشخيصي الكامل (Complete Automated Pipeline Audit)
                              </h3>
                              <p className="text-xs text-stone-600 mt-0.5">
                                توثيق تفصيلي لكافة العمليات الخوارزمية المطبقة فعلياً على السجلات المرصودة من التنظيف والتفكيك حتى اختيار عقدتي الجذر
                              </p>
                            </div>
                          </div>
                          <span className="px-3 py-1 rounded-xl bg-amber-900 text-amber-100 font-mono text-xs font-bold">
                            Complete Pipeline Audit (8 Stages)
                          </span>
                        </div>

                        <div className="rounded-2xl bg-white border border-amber-300 p-4 sm:p-5 shadow-2xs">
                          {isDirectDeepResearchP1 ? (
                            <ul className="space-y-3 text-xs sm:text-sm text-stone-800">
                              <li className="flex items-start gap-2.5 leading-relaxed">
                                <span className="shrink-0">⚓</span>
                                <div>
                                  <strong className="text-amber-950">المحاذاة الطوبولوجية:</strong>{' '}
                                  لا توجد سلاسل خام مرصودة لاسم ({directSearchResult.familyName}) لإجراء محاذاة أو خياطة آلية.
                                </div>
                              </li>
                              <li className="flex items-start gap-2.5 leading-relaxed">
                                <span className="shrink-0">🧬</span>
                                <div>
                                  <strong className="text-amber-950">قرينة التوافق:</strong>{' '}
                                  0 عناقيد مطابقة في قواعد البيانات الحالية.
                                </div>
                              </li>
                              <li className="flex items-start gap-2.5 leading-relaxed">
                                <span className="shrink-0">⚠️</span>
                                <div>
                                  <strong className="text-amber-950">قرار التوجيه الآلي:</strong>{' '}
                                  لم يتم رصد مصادر خام مطابقة في قواعد البيانات الحالية، تم الإحالة للبحث المعمق (تذكرة P1).
                                </div>
                              </li>
                            </ul>
                          ) : (
                            <ul className="space-y-3 text-xs sm:text-sm text-stone-800">
                              {/* 1. Branch-to-Parent Attribution */}
                              <li className="flex items-start gap-2.5 leading-relaxed">
                                <span className="shrink-0">🌿</span>
                                <div>
                                  <strong className="text-amber-950">
                                    إسناد الفرع للحاضنة الأم (Branch-to-Parent Attribution):
                                  </strong>{' '}
                                  {parentAttributionList.length > 0
                                    ? `تم رصد (${directSearchResult.familyName}) وإسناده إلى السجل الأم الحاضن (${parentAttributionList.join(' ، ')}) كأول محطة تلي العائلة في عمود النسب.`
                                    : `تطابق مباشر مع عنوان السجل الرئيس (${directSearchResult.familyName}) في المعاجم دون الحاجة لإسناد فرعي من حقل الفروع الأبناء.`}
                                </div>
                              </li>

                              {/* 2. Compound Name Unrolling */}
                              <li className="flex items-start gap-2.5 leading-relaxed">
                                <span className="shrink-0">🔗</span>
                                <div>
                                  <strong className="text-amber-950">
                                    تفكيك الأسماء المركبة (Compound Name Unrolling):
                                  </strong>{' '}
                                  {compoundUnrollList.length > 0
                                    ? `تم تفكيك المركبات النسبية المحتوية على (بن/ابن) آلياً إلى محطات مستقلة متتالية: ${compoundUnrollList.join(' ، ')}.`
                                    : `جميع المحطات المرصودة في السجلات الخام وردت مفردة؛ لم يتطلب المسار تفكيك تراكيب إضافية (بن/ابن).`}
                                </div>
                              </li>

                              {/* 2b. Detached Epithet & Title Fusion */}
                              <li className="flex items-start gap-2.5 leading-relaxed">
                                <span className="shrink-0">👑</span>
                                <div>
                                  <strong className="text-amber-950">
                                    دمج الألقاب التاريخية المفصولة وتوحيد التصحيف (Detached Epithet & Title Fusion):
                                  </strong>{' '}
                                  {detachedEpithetExamplesList.length > 0
                                    ? `تم رصد ودمج الألقاب التاريخية التي فُصلت بفاصلة منقوطة عن أصحابها في التفريغ وتوحيدها في محطة قياسية واحدة عبر المراجع: ${detachedEpithetExamplesList.join(' ، ')}.`
                                    : `تم فحص السلسلة لدمج أي ألقاب تاريخية مفصولة في التفريغ (مثل: البهلول، مزيقياء، ماء السماء، الغطريف، البطريق، العنقاء) وتوحيدها مع المراجع الموازية.`}
                                </div>
                              </li>

                              {/* 3. Orthographic & OCR Normalization */}
                              <li className="flex items-start gap-2.5 leading-relaxed">
                                <span className="shrink-0">🔤</span>
                                <div>
                                  <strong className="text-amber-950">
                                    توحيد الرسم الإملائي والتصحيف المطبعي (Orthographic & OCR Normalization):
                                  </strong>{' '}
                                  {mergedVariantGroups.length > 0
                                    ? `تم توحيد الصيغ والبادئات (بنو/بني/آل/بيت/البو) ومعالجة التصحيفات المطبعية بين المعاجم لدمج: ${mergedVariantGroups.join(' ، ')}.`
                                    : `تم تجريد البادئات (بنو/بني/آل/بيت/البو) وتوحيد التاء المربوطة/الهاء والهمزات لضمان تطابق الجذور الصرفية عبر المراجع.`}
                                </div>
                              </li>

                              {/* 4. Loop & Prefix Deduplication */}
                              <li className="flex items-start gap-2.5 leading-relaxed">
                                <span className="shrink-0">♻️</span>
                                <div>
                                  <strong className="text-amber-950">
                                    تنظيف التكرار الدائري ومقدمات الاختصار (Loop & Prefix Deduplication):
                                  </strong>{' '}
                                  {deduplicatedNodesList.length > 0
                                    ? `تم رصد وحذف العُقد المكررة ومقدمات الاختصار داخل السلسلة (${deduplicatedNodesList.join(' ، ')}) مع الاحتفاظ بأعلى موضع طبقي للجد لمنع الدوران.`
                                    : `تم فحص السلسلة ضد التكرار الدائري وتجريد تكرار اسم العائلة (${directSearchResult.familyName}) في مطلع خانة الأجداد.`}
                                </div>
                              </li>

                              {/* 5. Noise & Geo-Token Filtering */}
                              <li className="flex items-start gap-2.5 leading-relaxed">
                                <span className="shrink-0">🧹</span>
                                <div>
                                  <strong className="text-amber-950">
                                    فلترة الشوائب الجغرافية والوصفية (Noise & Geo-Token Filtering):
                                  </strong>{' '}
                                  {filteredNoiseList.length > 0
                                    ? `تم استبعاد وتصفية الألفاظ المكانية والعبارات الوصفية من خانات الأجداد: (${filteredNoiseList.join(' ، ')}).`
                                    : `تم فحص جميع محطات الأجداد للتأكد من خلوّها من أسماء المدن أو العبارات الوصفية (مثل: تدّعي، الأصل قيل، مساكنهم).`}
                                </div>
                              </li>

                              {/* 5b. Preamble Inversion Correction */}
                              <li className="flex items-start gap-2.5 leading-relaxed">
                                <span className="shrink-0">🔄</span>
                                <div>
                                  <strong className="text-amber-950">
                                    إصلاح التمهيد المعكوس في التفريغ (Preamble Inversion Correction):
                                  </strong>{' '}
                                  {invertedPreambleExamples.length > 0
                                    ? invertedPreambleExamples.join(' — ')
                                    : `تم فحص مطلع السلسلة ضد التمهيد المعكوس للقبائل الكبرى؛ لم يُرصد انقلاب تمهيدي يسبق اسم صاحب السجل (${directSearchResult.familyName}).`}
                                </div>
                              </li>

                              {/* 6. Anchor-Based Topological Alignment */}
                              <li className="flex items-start gap-2.5 leading-relaxed">
                                <span className="shrink-0">⚓</span>
                                <div>
                                  <strong className="text-amber-950">
                                    المحاذاة الطوبولوجية بالارتكاز (Anchor-Based Topological Alignment):
                                  </strong>{' '}
                                  {sharedAnchorNames.length > 0
                                    ? `تم استخدام عُقد الارتكاز المشتركة (${sharedAnchorNames.join(' ، ')}) كجسور لمحاذاة وإدراج البطون الوسيطة في موضعها الطبقي التصاعدي من (${directSearchResult.familyName}) حتى (${directSearchResult.rootTribeName}).`
                                    : `تم ترتيب المحطات تصاعدياً من عقدة العائلة (${directSearchResult.familyName}) حتى الجذر الأعلى (${directSearchResult.rootTribeName}).`}
                                </div>
                              </li>

                              {/* 7. Geo & Book Priority Consensus */}
                              <li className="flex items-start gap-2.5 leading-relaxed">
                                <span className="shrink-0">🧬</span>
                                <div>
                                  <strong className="text-amber-950">
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

                              {/* 8. Weighted 2-Root Selection ($5) */}
                              <li className="flex items-start gap-2.5 leading-relaxed">
                                <span className="shrink-0">⚖️</span>
                                <div>
                                  <strong className="text-amber-950">
                                    معادلة الأوزان واختيار عقدتي الجذر للـ 5$ (Weighted 2-Root Selection):
                                  </strong>{' '}
                                  تم اختيار عقدة الفرع الجامع (<strong>B2: {directSearchResult.rootBranchName}</strong>) وعقدة القبيلة الأم العليا (<strong>B0: {directSearchResult.rootTribeName}</strong>) بناءً على ثقل التكرار المرجعي والوزن القبلي، مع طيّ (<strong>🔒 +{hiddenIntermediateCount} في السلسلة</strong>) من المحطات الوسيطة داخل كبسولة عمود النسب.
                                </div>
                              </li>
                            </ul>
                          )}
                        </div>
                      </div>

                      {/* =========================================================
                          STEP 3 CARD: القسم الثالث — النتيجة المجمعة والخياطة النهائية (Final Stitched Chain)
                          STRICT RULE: Never render Step 3 when rawSources.length === 0 or diagnosticClusters.length === 0!
                      ========================================================= */}
                      {!isDirectDeepResearchP1 && (
                        <div
                          data-testid="diagnostic-step3-final-stitched-chain"
                          className="rounded-3xl border-2 border-emerald-600/80 bg-emerald-50/40 p-5 sm:p-6 shadow-xs space-y-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-200 pb-3.5">
                            <div className="flex items-center gap-3">
                              <span className="w-8 h-8 rounded-xl bg-emerald-800 text-white font-mono text-sm font-extrabold flex items-center justify-center shrink-0">
                                3
                              </span>
                              <div>
                                <h3 className="text-sm sm:text-base font-extrabold font-serif text-emerald-950">
                                  القسم الثالث: النتيجة المجمعة والخياطة النهائية (Final Stitched Chain)
                                </h3>
                                <p className="text-xs text-emerald-900/80 mt-0.5">
                                  عمود النسب النهائي المخيّط بعد دمج كافة المصادر المتوافقة ومحاذاة الأجداد من الأسفل إلى الأعلى
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="px-3 py-1 rounded-xl bg-emerald-800 text-white text-xs font-bold">
                                {finalStitchedStations.length} محطة مخيطة وموثقة ✓
                              </span>
                            </div>
                          </div>

                          {/* Horizontal / Flow Chain View of Final Stitched Stations */}
                          <div className="rounded-2xl bg-white border border-emerald-200 p-4 space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                              <span className="font-bold text-stone-700">
                                تسلسل المحطات المخيطة (من العائلة FE0 صعوداً إلى الجذر الأعلى):
                              </span>
                              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
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
                                          ? 'bg-purple-50 border-purple-300 text-purple-950 font-extrabold'
                                          : isRoot
                                          ? 'bg-amber-50 border-amber-400 text-amber-950 font-extrabold'
                                          : 'bg-[#FAF8F5] border-stone-300 text-stone-800 font-bold'
                                      }`}
                                    >
                                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/10">
                                        #{nIdx + 1}
                                      </span>
                                      <span>{node.name}</span>
                                      {node.code && (
                                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white border border-stone-300 text-stone-700">
                                          {node.code}
                                        </span>
                                      )}
                                    </div>
                                    {nIdx < finalStitchedStations.length - 1 && (
                                      <span className="text-emerald-700 font-bold text-xs">
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
                              className="pt-3.5 border-t border-emerald-200/80 space-y-2"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                                  <span>📚</span>
                                  <span>المراجع المساهمة في هذا المسار</span>
                                </h4>
                                <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
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
                                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 border border-slate-300 text-slate-700 text-[11px] font-sans font-bold shadow-2xs"
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
                        </div>
                      )}

                      {/* =========================================================
                          STEP 4 CARD: القسم الرابع — محاكي أسئلة التحقق للعميل (أو الإحالة المباشرة للبحث المعمق P1)
                          Requirement 4: 100% Synchronization between Top Matrix & Bottom Customer Simulator
                      ========================================================= */}
                      <div
                        data-testid="diagnostic-step4-disambiguation-simulator"
                        className="rounded-3xl border-2 border-[#7C3AED]/60 bg-gradient-to-l from-purple-50/70 via-white to-amber-50/40 p-5 sm:p-6 shadow-xs space-y-5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-purple-200 pb-3.5">
                          <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-xl bg-[#7C3AED] text-white font-mono text-sm font-extrabold flex items-center justify-center shrink-0">
                              4
                            </span>
                            <div>
                              <h3 className="text-sm sm:text-base font-extrabold font-serif text-[#141414]">
                                {isDirectDeepResearchP1
                                  ? 'القسم الرابع: التوجيه المباشر لتذكرة البحث المعمق (P1 Deep Research Routing)'
                                  : 'القسم الرابع: محاكي أسئلة التحقق للعميل (Disambiguation Simulator)'}
                              </h3>
                              <p className="text-xs text-stone-600 mt-0.5">
                                {isDirectDeepResearchP1
                                  ? 'عدم وجود مصادر خام مطابقة — إحالة مباشرة إلى مسار البحث المعمق (تذكرة بحث وتوثيق نشطة P1)'
                                  : hasCompetingDisambiguationPaths
                                  ? `عرض شامل لكافة العناقيد المتنافسة للباحث (${diagnosticClusters.length} مسارات)، مع تقليص سؤال العميل إلى أقوى خيارين فقط + خيار «لا أعرف»`
                                  : 'تطابق موحد في المصادر (عنقود واحد) — لا يُعرض سؤال تحقق للعميل بل ينتقل مباشرة لبطاقة الجذر ($5)'}
                              </p>
                            </div>
                          </div>

                          <span
                            className={`px-3 py-1 rounded-xl text-xs font-bold border ${
                              isDirectDeepResearchP1
                                ? 'bg-amber-200 border-amber-400 text-amber-950'
                                : hasCompetingDisambiguationPaths
                                ? 'bg-amber-100 border-amber-300 text-amber-950'
                                : 'bg-emerald-100 border-emerald-300 text-emerald-950'
                            }`}
                          >
                            {isDirectDeepResearchP1
                              ? 'المخرج (ب) · البحث المعمق (تذكرة P1)'
                              : hasCompetingDisambiguationPaths
                              ? `يُعرض للعميل خياران فقط (أقوى مسارين من أصل ${diagnosticClusters.length} مسارات مرصودة للباحث)`
                              : 'SINGLE_MATCH · تطابق وحيد مباشر (بطاقة الجذر $5)'}
                          </span>
                        </div>

                        {isDirectDeepResearchP1 ? (
                          <div
                            data-testid="direct-deep-research-p1-card"
                            className="p-5 rounded-2xl border-2 border-amber-500 bg-amber-50/90 space-y-3 shadow-2xs"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="px-3 py-1 rounded-lg bg-amber-900 text-amber-100 text-xs font-extrabold">
                                  المخرج (ب) · البحث المعمق
                                </span>
                                <span className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-950 text-xs font-extrabold">
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
                                  setTickets((prev) => [newTkt, ...prev]);
                                  setSelectedTicketId(newTkt.id);
                                  setActiveSubTab('ticket_inbox');
                                }}
                                className="px-3.5 py-1.5 rounded-xl bg-[#141414] hover:bg-stone-800 text-amber-300 text-xs font-bold cursor-pointer transition-colors"
                              >
                                فتح كتذكرة بحث وتوثيق نشطة (P1) ←
                              </button>
                            </div>
                            <div className="rounded-xl bg-white p-4 border border-amber-300 space-y-1.5">
                              <p className="text-sm font-extrabold text-amber-950">
                                لم يتم رصد مصادر خام مطابقة في قواعد البيانات الحالية، تم الإحالة للبحث المعمق
                              </p>
                              <p className="text-xs text-stone-700 leading-relaxed">
                                نظراً لعدم وجود سجلات خام أو عناقيد مطابقة لاسم ({directSearchResult.familyName}) في قواعد البيانات الحالية، لا يُعرض للعميل أي سؤال تحقق آلي ولا يُطالب بدفع $5، بل يتم توجيهه مباشرة إلى مسار <strong>«المخرج (ب) · البحث المعمق» (تذكرة بحث وتوثيق نشطة P1)</strong> ليتولى فريق الباحثين التحقيق في المخطوطات والأوقاف.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* Competing Paths Comparison Matrix (Shows ALL clusters for the Researcher outside the simulator) */}
                            {renderConsensusAndCompetingPathsMatrix(
                              directSearchResult.familyName,
                              rawEvidenceList,
                              'direct_search'
                            )}

                            {/* Requirement 4(أ): When consensusClusterGroups.length === 1, DO NOT show a fake 2-option verification modal! */}
                            {!hasCompetingDisambiguationPaths ? (
                              <div
                                data-testid="sim-single-match-resolved"
                                className="rounded-2xl border-2 border-emerald-600 bg-gradient-to-l from-emerald-50 via-white to-emerald-50/70 p-5 space-y-3 shadow-2xs"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="px-3 py-1 rounded-full bg-emerald-700 text-white text-xs font-extrabold">
                                    🎯 محاكاة حية لما يراه العميل في الواجهة الأمامية (SINGLE_MATCH)
                                  </span>
                                  <span className="px-2.5 py-1 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-950 text-xs font-mono font-bold">
                                    requires_disambiguation = false
                                  </span>
                                </div>
                                <div className="rounded-xl bg-white border border-emerald-300 p-4 space-y-2">
                                  <p className="text-sm sm:text-base font-extrabold text-emerald-950">
                                    ✅ المسار محسوم آلياً بتوافق المراجع — لا يُعرض سؤال تحقق للعميل بل ينتقل مباشرة لبطاقة الجذر (5$)
                                  </p>
                                  <p className="text-xs text-stone-700 leading-relaxed">
                                    بفضل توحيد الرسم الإملائي وتطابق الأجداد الوسيطين والنطاق الجغرافي ({primaryCluster?.geographicScope || directSearchResult.matched_location}) عبر ({primaryCluster?.sourcesCount || rawEvidenceList.length}) مراجع، تم دمج كافة السجلات في مسار توافق واحد (<strong>{directSearchResult.familyName} ⬅️ {directSearchResult.rootBranchName} ⬅️ {directSearchResult.rootTribeName}</strong>) وإسقاط سؤال التحقق الثنائي.
                                  </p>
                                </div>
                              </div>
                            ) : (
                              /* Requirement 4(ب): Interactive Customer Verification Simulator when 2+ competing paths exist */
                              <div className="rounded-2xl border-2 border-[#D97706]/80 bg-gradient-to-br from-[#FFFDF9] via-[#FAF3E6] to-[#F5E6C8] p-5 space-y-4">
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#B98A78]/30 pb-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="px-3 py-1 rounded-full bg-[#D97706]/20 text-[#92400E] text-xs font-extrabold">
                                      🎯 محاكاة حية لما يراه العميل في الواجهة الأمامية (أقوى مسارين فقط + خيار لا أعرف)
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setDiagnosticSimStage(1)}
                                      className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                                        diagnosticSimStage === 1
                                          ? 'bg-[#252321] text-[#FEF3C7]'
                                          : 'bg-white text-stone-700 border border-stone-300'
                                      }`}
                                    >
                                      المرحلة 1: سؤال الأصل والقبيلة
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDiagnosticSimStage(2)}
                                      className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                                        diagnosticSimStage === 2
                                          ? 'bg-[#252321] text-[#FEF3C7]'
                                          : 'bg-white text-stone-700 border border-stone-300'
                                      }`}
                                    >
                                      المرحلة 2: سؤال الجغرافيا والمواضع
                                    </button>
                                  </div>
                                </div>

                                {diagnosticSimStage === 1 ? (
                                  <div className="space-y-3">
                                    <div className="text-sm font-extrabold text-[#252321]">
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
                                              ? 'bg-white border-[#D8755B] shadow-xs'
                                              : 'bg-white/80 border-stone-300 hover:border-[#8D4925]'
                                          }`}
                                        >
                                          <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs sm:text-sm font-extrabold text-[#252321]">
                                              🔘 الخيار #{oIdx + 1}: {opt.originTribeLabel || opt.title}
                                            </span>
                                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-bold">
                                              {opt.badge}
                                            </span>
                                          </div>

                                          {/* Explicit Sources & Pages under the competing option */}
                                          <div
                                            data-testid={`sim-stage1-option-sources-${oIdx}`}
                                            className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 space-y-1.5"
                                          >
                                            <div className="text-[11px] font-bold text-slate-700 flex flex-wrap items-center gap-1.5">
                                              <span>
                                                توافق ({optSources.length}){' '}
                                                {optSources.length === 1 ? 'مصدر:' : 'مصادر:'}
                                              </span>
                                              {optSources.map((srcEv, sIdx) => {
                                                const parsedRef =
                                                  extractBookVolPageFromEvidence(srcEv);
                                                return (
                                                  <React.Fragment key={srcEv.alpha_id || sIdx}>
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 border border-slate-300 text-slate-700 text-[11px] font-sans font-bold">
                                                      {`[${parsedRef.book} - ج: ${parsedRef.volume || '1'} - ص: ${parsedRef.page || '—'}]`}
                                                    </span>
                                                    {sIdx < optSources.length - 1 && (
                                                      <span className="text-slate-400 font-bold">،</span>
                                                    )}
                                                  </React.Fragment>
                                                );
                                              })}
                                            </div>
                                          </div>

                                          <div className="text-[11px] text-stone-600 bg-[#FAF8F5] p-2 rounded-lg border border-stone-200 space-y-1">
                                            <div>
                                              <strong>المسار الناتج:</strong>{' '}
                                              {fullStitchedChainForOpt}
                                            </div>
                                            <div className="text-amber-900 font-bold">
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
                                      className="p-3.5 rounded-xl border-2 border-dashed border-amber-500 bg-amber-50/70 hover:bg-amber-50 transition-all cursor-pointer space-y-2"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs sm:text-sm font-extrabold text-amber-950">
                                          🔘 خيار: لا أعرف / لست متأكداً (الاحتكام للمواضع الجغرافية)
                                        </span>
                                        <span className="px-2 py-0.5 rounded bg-white border border-amber-300 text-[10px] font-mono font-bold text-amber-900">
                                          NEED_LOCATION_STEP
                                        </span>
                                      </div>
                                      <div className="text-[11px] text-amber-900 bg-white/80 p-2 rounded-lg border border-amber-200">
                                        <strong>الخطوة التالية للعميل:</strong> ينتقل العميل مجاناً وفوراً إلى <strong>المرحلة 2 (سؤال الجغرافيا والمواضع)</strong> دون مطالبته بدفع $5. (اضغط هنا لمعاينة المرحلة 2 ←)
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <div className="text-sm font-extrabold text-[#252321]">
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
                                              ? 'bg-white border-[#D8755B] shadow-xs'
                                              : 'bg-white/80 border-stone-300 hover:border-[#8D4925]'
                                          }`}
                                        >
                                          <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs sm:text-sm font-extrabold text-[#252321]">
                                              📍 الموضع الجغرافي #{oIdx + 1}: {opt.geographicScope}
                                            </span>
                                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 text-[10px] font-bold">
                                              يحسم لصالح: {resultingTribe}
                                            </span>
                                          </div>

                                          {/* Explicit Sources & Pages under the competing geographic option */}
                                          <div
                                            data-testid={`sim-stage2-option-sources-${oIdx}`}
                                            className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 space-y-1.5"
                                          >
                                            <div className="text-[11px] font-bold text-slate-700 flex flex-wrap items-center gap-1.5">
                                              <span>
                                                توافق ({optSources.length}){' '}
                                                {optSources.length === 1 ? 'مصدر:' : 'مصادر:'}
                                              </span>
                                              {optSources.map((srcEv, sIdx) => {
                                                const parsedRef =
                                                  extractBookVolPageFromEvidence(srcEv);
                                                return (
                                                  <React.Fragment key={srcEv.alpha_id || sIdx}>
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 border border-slate-300 text-slate-700 text-[11px] font-sans font-bold">
                                                      {`[${parsedRef.book} - ج: ${parsedRef.volume || '1'} - ص: ${parsedRef.page || '—'}]`}
                                                    </span>
                                                    {sIdx < optSources.length - 1 && (
                                                      <span className="text-slate-400 font-bold">،</span>
                                                    )}
                                                  </React.Fragment>
                                                );
                                              })}
                                            </div>
                                          </div>

                                          <div className="text-[11px] text-stone-600 bg-[#FAF8F5] p-2 rounded-lg border border-stone-200 space-y-1">
                                            <div>
                                              <strong>المسار الناتج:</strong>{' '}
                                              {fullStitchedChainForOpt}
                                            </div>
                                            <div className="text-amber-900 font-bold">
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
                                          ? 'border-red-500 bg-red-50/80'
                                          : 'border-amber-600 bg-amber-50/70 hover:bg-amber-50'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs sm:text-sm font-extrabold text-amber-950">
                                          🔘 خيار: لا أعرف / موضع آخر (فشل التحقق في المرحلتين)
                                        </span>
                                        <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-950 text-[10px] font-bold">
                                          المخرج (ب) · البحث المعمق
                                        </span>
                                      </div>
                                      <div className="text-[11px] text-stone-800 bg-white/90 p-2 rounded-lg border border-amber-300 space-y-1">
                                        <div>
                                          <strong>الخطوة التالية للعميل (المخرج ب):</strong>{' '}
                                          يتم نقل العميل فوراً إلى شاشة <strong>«البحث المعمق» (Deep Research)</strong> ليُطلب منه الاشتراك السنوي لفتح تذكرة بحث خاصة لدى الباحثين، دون مطالبته بدفع الـ $5 الخاصة بالجذر الآلي!
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
                      </div>

                      {/* =========================================================
                          STEP 5 CARD: القسم الخامس — المصادر الأخرى الخام (Read-Only Compact View)
                      ========================================================= */}
                      {renderCompactReadOnlyOtherSourcesSection(
                        directSearchResult.familyName,
                        rawEvidenceList
                      )}

                      {/* =========================================================
                          PROMINENT SMART TRANSFER BAR TO TICKET OPERATIONS ROOM
                      ========================================================= */}
                      <div className="rounded-3xl border-2 border-[#141414] bg-gradient-to-l from-[#141414] via-stone-900 to-[#141414] text-white p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-md">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-stone-950 text-[11px] font-extrabold">
                              غرفة عمليات التذكرة التفاعلية
                            </span>
                            <span className="text-xs text-stone-300">
                              نقل السلسلة المخيطة ({finalStitchedStations.length}{' '}
                              محطات) + جسر آدم + المصادر الإضافية
                            </span>
                          </div>
                          <h4 className="text-sm sm:text-base font-extrabold font-serif text-amber-300">
                            هل اكتمل فحص مسار ({directSearchResult.familyName})؟ انقل المخرجات الآن لغرفة عمليات التذكرة للإثراء والتوثيق بنقرة واحدة
                          </h4>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            handleTransferDiagnosticToTicketRoom(
                              directSearchResult,
                              rawEvidenceList,
                              finalStitchedStations
                            )
                          }
                          data-testid="floating-transfer-to-ticket-room-btn"
                          className="px-5 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-stone-950 text-xs sm:text-sm font-extrabold cursor-pointer transition-all shadow-sm flex items-center gap-2"
                        >
                          <Sparkles className="w-4 h-4 shrink-0" />
                          <span>
                            🚀 نقل مخرجات الفحص إلى غرفة عمليات التذكرة للإثراء والتوثيق
                          </span>
                        </button>
                      </div>

                      {/* =========================================================
                          VISUAL COLUMN PREVIEW FOR RESEARCHER
                      ========================================================= */}
                      <div className="pt-2">
                        <LineageSpineColumn
                          stateMode={DashboardStateMode.AnnualVip}
                          accountType={AccountLegalType.RecordKeeper}
                          result={directSearchResult}
                          bridgedAncestors={[]}
                          onAddBridgedAncestor={() => {}}
                          onUnlockRoot5Usd={() => {}}
                          onUpgradeAnnualVip={() => {}}
                          unlockedCapsules={(directSearchResult.capsules || []).map(
                            (c) => c.id
                          )}
                          onRequestUnlockCapsule={() => {}}
                          walletBalance={25}
                          isResearcherDirectPreview={true}
                          onOpenAsResearcherTicket={() =>
                            handleTransferDiagnosticToTicketRoom(
                              directSearchResult,
                              rawEvidenceList,
                              finalStitchedStations
                            )
                          }
                        />
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        )}

        {/* ===================================================================
            SUB-TAB 2: 📥 صندوق تذاكر العملاء (ANALYTICAL SOURCE CARDS & 4 ACTIONS)
        =================================================================== */}
        {activeSubTab === 'ticket_inbox' && (
          <div className="space-y-6">
            {/* ===================================================================
                PILLAR 3: RESEARCHER PRODUCTIVITY & KPI TELEMETRY BAR
            =================================================================== */}
            <div
              data-testid="researcher-kpi-telemetry-bar"
              className="rounded-3xl border-2 border-[#141414] bg-gradient-to-l from-[#141414] via-stone-900 to-[#141414] text-white p-4 sm:p-5 shadow-md space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="px-3 py-1 rounded-xl bg-amber-400 text-stone-950 font-mono text-xs font-extrabold">
                    📊 مؤشرات إنتاجية الباحث والمكافآت (KPI Telemetry)
                  </span>
                  <span className="text-xs text-stone-300">
                    متزامن حياً مع لوحة تقارير الإدارة العليا وتقييم المكافآت الشهرية
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    data-testid="kpi-xp-incentive-score"
                    className="px-3.5 py-1 rounded-xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-mono text-xs sm:text-sm font-extrabold"
                  >
                    🏆 نقاط الإنجاز والمكافآت: {kpiTelemetry.totalXpScore} XP
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {/* 1. Active Ticket Timer & Avg Handling Time */}
                <div className="rounded-2xl bg-white/5 border border-white/10 p-3 space-y-1">
                  <span className="text-stone-400 text-[11px] block">
                    ⏱️ زمن التذكرة النشطة / متوسط الإنجاز
                  </span>
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      data-testid="kpi-active-ticket-timer"
                      className="text-base sm:text-lg font-mono font-extrabold text-amber-300"
                    >
                      {formatDurationMmSs(activeTicketElapsedSeconds)}
                    </span>
                    <span className="text-[11px] font-mono text-stone-300">
                      المتوسط: {formatDurationMmSs(kpiTelemetry.avgHandlingTimeSeconds)}
                    </span>
                  </div>
                </div>

                {/* 2. Completed Tickets Today by Priority (P1 / P2 / P3) */}
                <div className="rounded-2xl bg-white/5 border border-white/10 p-3 space-y-1">
                  <span className="text-stone-400 text-[11px] block">
                    ✅ المنجز اليوم حسب الأولوية (إجمالي:{' '}
                    {kpiTelemetry.completedTodayP1 +
                      kpiTelemetry.completedTodayP2 +
                      kpiTelemetry.completedTodayP3}
                    )
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5 font-mono text-[11px] font-extrabold">
                    <span className="px-2 py-0.5 rounded bg-red-500/25 border border-red-400/40 text-red-200">
                      P1: {kpiTelemetry.completedTodayP1}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/25 border border-amber-400/40 text-amber-200">
                      P2: {kpiTelemetry.completedTodayP2}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/25 border border-emerald-400/40 text-emerald-200">
                      P3: {kpiTelemetry.completedTodayP3}
                    </span>
                  </div>
                </div>

                {/* 3. Total Alpha Nodes Bridged to Adam */}
                <div className="rounded-2xl bg-white/5 border border-white/10 p-3 space-y-1">
                  <span className="text-stone-400 text-[11px] block">
                    🌳 عُقد ألفا الموصولة بشجرة آدم
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span
                      data-testid="kpi-alpha-nodes-bridged"
                      className="text-base sm:text-lg font-mono font-extrabold text-emerald-300"
                    >
                      {kpiTelemetry.totalAlphaNodesBridged} عقدة موصولة
                    </span>
                  </div>
                </div>

                {/* 4. Total Addon Sources Verified in Adam Prime */}
                <div className="rounded-2xl bg-white/5 border border-white/10 p-3 space-y-1">
                  <span className="text-stone-400 text-[11px] block">
                    🏛️ مصادر إضافية موثقة في آدم برايم
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span
                      data-testid="kpi-adam-prime-sources-verified"
                      className="text-base sm:text-lg font-mono font-extrabold text-indigo-300"
                    >
                      {kpiTelemetry.totalAdamPrimeSourcesVerified} مرجع موثق
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ===================================================================
                PILLAR 2: 3-TIER PRIORITY QUEUE BAR (`P1 -> P2 -> P3 Auto-Refill Mining Queue`)
            =================================================================== */}
            <div className="bg-white rounded-2xl border border-stone-200/90 p-4 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="queue-filter-all-priority"
                  onClick={() => setInboxCategoryFilter('ALL_PRIORITY_SORTED')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
                    inboxCategoryFilter === 'ALL_PRIORITY_SORTED'
                      ? 'bg-[#141414] text-amber-300 shadow-sm'
                      : 'bg-[#FAF8F5] text-stone-700 hover:bg-stone-100 border border-stone-200'
                  }`}
                >
                  <span>⚡ الطابور الذكي المتسلسل (P1 ⬅️ P2 ⬅️ P3)</span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-amber-500/20 text-amber-400">
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
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                    inboxCategoryFilter === 'P1_CLIENT_UNMATCHED' ||
                    inboxCategoryFilter === 'DIRECT_CUSTOMER_TICKETS'
                      ? 'bg-red-900 text-white shadow-sm'
                      : 'bg-red-50/70 text-red-950 hover:bg-red-100 border border-red-200'
                  }`}
                >
                  <span>🔴 P1: طوارئ العملاء</span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-white/80 text-red-950">
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
                  data-testid="queue-filter-p2"
                  onClick={() => {
                    setInboxCategoryFilter('P2_CLIENT_ADAM_BRIDGE');
                    const firstMatch = tickets.find(
                      (t) =>
                        resolveTicketPriorityTier(t) === 'P2_CLIENT_ADAM_BRIDGE'
                    );
                    if (firstMatch) setSelectedTicketId(firstMatch.id);
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                    inboxCategoryFilter === 'P2_CLIENT_ADAM_BRIDGE'
                      ? 'bg-amber-800 text-white shadow-sm'
                      : 'bg-amber-50/80 text-amber-950 hover:bg-amber-100 border border-amber-200'
                  }`}
                >
                  <span>🟡 P2: استكمال تسليم العملاء (جسر آدم)</span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-white/80 text-amber-950">
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
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                    inboxCategoryFilter === 'P3_PROACTIVE_ALPHA_ENRICHMENT'
                      ? 'bg-emerald-900 text-white shadow-sm'
                      : 'bg-emerald-50/80 text-emerald-950 hover:bg-emerald-100 border border-emerald-300'
                  }`}
                >
                  <span>🟢 P3: التعدين الاستباقي الذكي</span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-white/80 text-emerald-950">
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
                className="px-3.5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-amber-300 text-xs font-extrabold cursor-pointer transition-all flex items-center gap-1.5 shadow-2xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {isGeneratingP3Batch
                    ? 'جارٍ سحب تذاكر P3...'
                    : '🔄 توليد دفعة تذاكر P3 ذكية (Auto-Refill)'}
                </span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* RIGHT COLUMN (4 COLS): TICKET LIST */}
              <div className="lg:col-span-4 bg-white rounded-3xl border border-stone-200/80 shadow-xs overflow-hidden">
                <div className="p-4 bg-[#FAF8F5] border-b border-stone-200 flex items-center justify-between">
                  <h3 className="text-sm font-bold font-serif text-[#141414]">
                    طابور التذاكر البحثية ({filteredInboxTickets.length})
                  </h3>
                  <span className="text-[10px] font-mono font-bold text-stone-500">
                    P1 ⬅️ P2 ⬅️ P3
                  </span>
                </div>

                <div className="divide-y divide-stone-100 max-h-[750px] overflow-y-auto">
                  {filteredInboxTickets.length === 0 ? (
                    <div className="p-8 text-center text-xs text-stone-500">
                      لا توجد تذاكر حالياً ضمن هذا التصنيف.
                    </div>
                  ) : (
                    filteredInboxTickets.map((tkt) => {
                      const isSelected = selectedTicket?.id === tkt.id;
                      const isClosed =
                        tkt.status === 'CLOSED_AND_ENRICHED' ||
                        tkt.status === 'merged_closed';
                      const tier = resolveTicketPriorityTier(tkt);
                      const priorityBadge =
                        tier === 'P1_CLIENT_UNMATCHED'
                          ? {
                              label: '🔴 P1 · طوارئ عميل',
                              cls: 'bg-red-100 text-red-900 border border-red-300',
                            }
                          : tier === 'P3_PROACTIVE_ALPHA_ENRICHMENT'
                          ? {
                              label: '🟢 P3 · تعدين ذكي',
                              cls: 'bg-emerald-100 text-emerald-900 border border-emerald-300',
                            }
                          : {
                              label: '🟡 P2 · جسر آدم للعميل',
                              cls: 'bg-amber-100 text-amber-950 border border-amber-300',
                            };
                      return (
                        <button
                          key={tkt.id}
                          type="button"
                          onClick={() => {
                            setSelectedTicketId(tkt.id);
                            setInlineChainInspection(null);
                          }}
                          className={`w-full text-right p-4 transition-all cursor-pointer block ${
                            isSelected
                              ? 'bg-amber-50/80 border-r-4 border-r-[#B45309]'
                              : 'hover:bg-stone-50'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-stone-900 text-amber-300">
                                {tkt.id}
                              </span>
                              <span
                                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${priorityBadge.cls}`}
                              >
                                {priorityBadge.label}
                              </span>
                            </div>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                isClosed
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : tkt.status === 'investigating'
                                  ? 'bg-blue-100 text-blue-800'
                                  : tkt.status === 'exported_adam_prime'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-stone-100 text-stone-800'
                              }`}
                            >
                              {isClosed
                                ? 'مكتملة ومعتمدة ✓'
                                : tkt.status === 'investigating'
                                ? 'بانتظار إيضاح العميل'
                                : tkt.status === 'exported_adam_prime'
                                ? 'مصعدة لآدم برايم'
                                : 'مفتوحة للتحقيق'}
                            </span>
                          </div>

                          <h4 className="text-xs font-bold text-[#141414] leading-snug mb-1">
                            {tkt.title}
                          </h4>

                          {tkt.p3StrategicMeta && (
                            <div className="mt-1.5 mb-1.5 flex flex-wrap items-center gap-1 text-[10px]">
                              <span className="px-2 py-0.5 rounded bg-emerald-900 text-amber-300 font-mono font-extrabold">
                                [★ وزن استراتيجي: {tkt.p3StrategicMeta.strategic_score} نقطة]
                              </span>
                              <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-950 font-bold">
                                عمود ({tkt.p3StrategicMeta.chain_stations_count} محطات)
                              </span>
                              <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-950 font-bold">
                                توافق ({tkt.p3StrategicMeta.corroborating_sources_count}) مراجع
                              </span>
                            </div>
                          )}

                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-500 mt-2">
                            <span>المصدر: {tkt.clientName}</span>
                            <span className="font-bold text-[#B45309]">
                              {tkt.corroboratingEvidence?.length ||
                                tkt.copilotSources.length}{' '}
                              روايات مرصودة
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* LEFT COLUMN (8 COLS): THE 3 DATA LAKES WORKBENCH & RESEARCHER DECISIONS */}
              <div className="lg:col-span-8 space-y-6">
                {selectedTicket ? (
                  <div className="bg-white rounded-3xl border border-stone-200/80 shadow-xs overflow-hidden">
                    {/* TICKET HEADER */}
                    <div className="bg-[#FAF8F5] border-b border-stone-200 p-6">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-1 rounded-md bg-stone-900 text-amber-300 font-mono text-xs font-bold">
                            {selectedTicket.id}
                          </span>
                          <span className="px-2.5 py-1 rounded-md bg-white border border-stone-200 text-stone-700 text-xs font-bold">
                            الموطن: {selectedTicket.locationLabel}
                          </span>
                          <span
                            className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                              selectedTicket.status === 'CLOSED_AND_ENRICHED' ||
                              selectedTicket.status === 'merged_closed'
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : 'bg-amber-100 text-amber-900 border border-amber-300'
                            }`}
                          >
                            {selectedTicket.status === 'CLOSED_AND_ENRICHED' ||
                            selectedTicket.status === 'merged_closed'
                              ? 'مكتملة ومعتمدة ✓'
                              : 'تذكرة عمل نشطة'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            onSwitchToClientPreview(selectedTicket.familyName)
                          }
                          className="px-3 py-1.5 rounded-xl bg-[#141414] hover:bg-stone-800 text-amber-300 text-xs font-bold cursor-pointer transition-all"
                        >
                          معاينة لوحة العميل ({selectedTicket.familyName}) ↗
                        </button>
                      </div>

                      <h3 className="text-lg font-bold font-serif text-[#141414]">
                        {selectedTicket.title}
                      </h3>
                      {selectedTicket.fullStitchedLineage &&
                        selectedTicket.fullStitchedLineage.length > 0 && (
                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
                            <span className="font-bold text-stone-600">
                              السلسلة المخيطة الكاملة للباحث:
                            </span>
                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-950 font-bold">
                              {selectedTicket.familyName} (FE0)
                            </span>
                            {selectedTicket.fullStitchedLineage.map((st, idx) => (
                              <React.Fragment key={st.id || idx}>
                                <span className="text-stone-400 font-bold">⬅️</span>
                                <span className="px-2 py-0.5 rounded bg-white border border-stone-300 text-stone-800 font-bold">
                                  {st.name} ({st.code})
                                </span>
                              </React.Fragment>
                            ))}
                          </div>
                        )}
                    </div>

                    <div className="p-6 space-y-6">
                      {/* =====================================================
                          GAMIFIED ALL-IN-ONE 3-STATION ACTION WORKSPACE
                          (Quest Progress Bar + Station 1 Lego Chain + Station 2 Toggle Pills + Station 3 Adam Prime Sync)
                      ===================================================== */}
                      {renderGamifiedTicketOperationsWorkspace(selectedTicket)}

                      {/* =====================================================
                          القسم 1: بطاقة "🧠 التنبيه الاستدلالي الذكي وتحليل القرائن للباحث (AI Research Hypothesis)"
                          + بطاقة "🎯 جسر الالتقاء المقترح آلياً في شجرة آدم (suggested_adam_bridge_for_researcher)"
                      ===================================================== */}
                      {(() => {
                        const hypotheses =
                          selectedTicket.aiResearchHypotheses &&
                          selectedTicket.aiResearchHypotheses.length > 0
                            ? selectedTicket.aiResearchHypotheses
                            : buildAIResearchHypothesesForFamily(
                                selectedTicket.familyName,
                                selectedTicket.corroboratingEvidence || [],
                                selectedTicket.suggestedAdamBridge
                              );

                        return (
                          <div
                            data-testid="section1-ai-research-hypothesis-and-bridge"
                            className="space-y-4"
                          >
                            {/* 1A: AI Research Hypothesis Card */}
                            <div className="rounded-2xl border-2 border-amber-500/80 bg-gradient-to-l from-amber-50 via-[#FAF8F5] to-amber-50/70 p-5 shadow-2xs space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="px-2.5 py-0.5 rounded-full bg-amber-900 text-amber-200 text-[11px] font-bold">
                                    القسم 1 — التحليل الاستدلالي الذكي للباحث
                                  </span>
                                  <span className="px-2.5 py-0.5 rounded-full bg-amber-200/80 text-amber-950 text-[11px] font-bold">
                                    حصرياً لفريق التحقيق (غير معروض للعميل)
                                  </span>
                                </div>
                                <span className="text-[11px] font-mono font-bold text-[#B45309]">
                                  AI Research Hypothesis v11.1
                                </span>
                              </div>

                              <h4 className="text-sm sm:text-base font-extrabold font-serif text-[#141414]">
                                🧠 التنبيه الاستدلالي الذكي وتحليل القرائن للباحث (AI Research Hypothesis)
                              </h4>

                              <div className="space-y-2">
                                {hypotheses.map((hyp, hIdx) => (
                                  <div
                                    key={hIdx}
                                    className="rounded-xl bg-white border border-amber-300/90 p-3.5 text-xs text-stone-800 leading-relaxed font-medium shadow-2xs"
                                  >
                                    {hyp}
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* 1B: Suggested Adam Bridge Card */}
                            {selectedTicket.suggestedAdamBridge && (
                              <div
                                data-testid="lake1-suggested-adam-bridge"
                                className="rounded-2xl border-2 border-emerald-600 bg-gradient-to-l from-emerald-950 via-emerald-900 to-emerald-950 text-white p-5 shadow-md space-y-4"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-400/20 border border-emerald-400/40 text-emerald-200 text-[11px] font-bold">
                                        البحيرة 1 — شجرة آدم (ADAM_MASTER_TREE)
                                      </span>
                                      <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 font-mono text-[11px] font-bold">
                                        {selectedTicket.suggestedAdamBridge
                                          .confidence_label || 'تطابق آلي 98%'}
                                      </span>
                                    </div>
                                    <h4 className="text-base font-bold font-serif text-amber-300">
                                      🎯 جسر الالتقاء المقترح آلياً في شجرة آدم (suggested_adam_bridge_for_researcher)
                                    </h4>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const bridgePreview =
                                          selectedTicket.suggestedAdamBridge
                                            ?.adam_chain_preview || '';
                                        setAppliedAdamBridgeByTicket((prev) => ({
                                          ...prev,
                                          [selectedTicket.id]: bridgePreview,
                                        }));
                                        showToast(
                                          `⚡ تم تطبيق جسر الالتقاء (${selectedTicket.suggestedAdamBridge?.matched_station_name} ⬅️ ${bridgePreview}) في معاينة العمود النهائي بالأسفل!`
                                        );
                                      }}
                                      className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 text-xs font-extrabold shadow-sm cursor-pointer transition-all flex items-center gap-1.5"
                                    >
                                      <Sparkles className="w-3.5 h-3.5" />
                                      <span>
                                        ⚡ تطبيق هذا الربط في معاينة العمود النهائي
                                      </span>
                                    </button>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                  <div className="rounded-xl bg-white/10 border border-white/15 p-3">
                                    <span className="text-emerald-200/80 block text-[11px]">
                                      المحطة المطابقة من عمود العائلة:
                                    </span>
                                    <span className="font-extrabold text-white text-sm">
                                      {
                                        selectedTicket.suggestedAdamBridge
                                          .matched_station_name
                                      }
                                    </span>
                                  </div>

                                  <div className="sm:col-span-2 rounded-xl bg-white/10 border border-white/15 p-3">
                                    <span className="text-emerald-200/80 block text-[11px]">
                                      عقدة شجرة آدم المكتشفة وسلسلة اتصالها المباشر:
                                    </span>
                                    <span className="font-mono font-bold text-amber-300 text-xs sm:text-sm">
                                      {
                                        selectedTicket.suggestedAdamBridge
                                          .adam_node_id
                                      }
                                      :{' '}
                                      {
                                        selectedTicket.suggestedAdamBridge
                                          .adam_chain_preview
                                      }
                                    </span>
                                  </div>
                                </div>

                                <div className="rounded-xl bg-black/25 border border-white/10 p-3 text-xs space-y-1">
                                  <span className="text-emerald-300 font-bold block">
                                    الاتصال الكامل حتى آدم عليه السلام:
                                  </span>
                                  <p className="text-stone-200 font-mono leading-relaxed">
                                    {getLivePreviewNodesForTicket(selectedTicket)
                                      .map((n) => n.name)
                                      .join(' ⬅️ ')}{' '}
                                    ⬅️{' '}
                                    {
                                      selectedTicket.suggestedAdamBridge
                                        .adam_chain_preview
                                    }
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* RULE 4: CONSENSUS WINNER & COMPETING PATHS COMPARISON IN TICKET INBOX */}
                      {renderConsensusAndCompetingPathsMatrix(
                        selectedTicket.familyName,
                        selectedTicket.corroboratingEvidence,
                        'ticket_inbox'
                      )}

                      {/* =====================================================
                          القسم 2: بطاقات المصادر التحليلية (مصفوفة تفكيك ومقارنة المصادر والروايات)
                          Split into:
                          1) 🌟 مراجع مسار التوافق الأساسي
                          2) 📚 روايات وسجلات أخرى لنفس الاسم للمقارنة والتحقيق
                      ===================================================== */}
                      {(() => {
                        const allTicketEvidence: CorroboratingAlphaEvidence[] =
                          selectedTicket.corroboratingEvidence &&
                          selectedTicket.corroboratingEvidence.length > 0
                            ? tagConsensusWinnersOnEvidence(
                                selectedTicket.familyName,
                                selectedTicket.corroboratingEvidence
                              )
                            : selectedTicket.copilotSources.map(
                                (cs, idx): CorroboratingAlphaEvidence => ({
                                  alpha_id: `alpha-fallback-${idx}`,
                                  record_name: selectedTicket.familyName,
                                  source_book: cs.bookCitation,
                                  page: '—',
                                  volume: `${idx + 1}`,
                                  lineage_ancestors: `${selectedTicket.familyName} ⬅️ ${selectedTicket.subRootName} ⬅️ ${selectedTicket.motherTribeName}`,
                                  priority_tier: 'PRIORITY_1_COUNTRY_BOOK',
                                  is_consensus_winner: true,
                                })
                              );

                        // Compute shared child_branches and shared locations across 2+ sources for "قرينة تقاطع مشتركة" badges
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
                            locationFreq.set(
                              loc,
                              (locationFreq.get(loc) || 0) + 1
                            );
                          });
                        });

                        const indexedEvidence = allTicketEvidence.map(
                          (ev, originalIdx) => ({ ev, originalIdx })
                        );
                        const winnerItems = indexedEvidence.filter(
                          (item) => item.ev.is_consensus_winner !== false
                        );
                        const competingItems = indexedEvidence.filter(
                          (item) => item.ev.is_consensus_winner === false
                        );

                        const renderEvidenceCard = (
                          ev: CorroboratingAlphaEvidence,
                          idx: number
                        ) => {
                          const isIncluded =
                            getTicketIncludedIndices(selectedTicket).includes(
                              idx
                            );
                          const isPrimary =
                            (primarySourceIndexByTicket[selectedTicket.id] ??
                              0) === idx;
                          const noteKey = `${selectedTicket.id}-${idx}`;
                          const chainStations = splitAncestorsChain(
                            ev.lineage_ancestors
                          );
                          const displayChain =
                            chainStations.length > 0
                              ? chainStations
                              : [
                                  selectedTicket.familyName,
                                  selectedTicket.subRootName,
                                  selectedTicket.motherTribeName,
                                ];

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
                                  ? 'bg-amber-50/70 border-2 border-[#B45309]'
                                  : isIncluded
                                  ? 'bg-white border-stone-200'
                                  : 'bg-stone-50/50 border-stone-200 opacity-60'
                              }`}
                            >
                              {/* Source Header & 3 Researcher Controls */}
                              <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-stone-200/80">
                                <div className="space-y-1.5">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-bold text-[#141414]">
                                      {idx + 1}. كتاب: {ev.source_book}
                                    </span>
                                    {(() => {
                                      const lakeBadge =
                                        resolveResearcherDataLakeBadge(ev);
                                      return (
                                        <span
                                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${lakeBadge.colorClass}`}
                                        >
                                          {lakeBadge.tag}
                                        </span>
                                      );
                                    })()}
                                    {(ev.volume || ev.page) && (
                                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-950 font-mono text-[11px] font-bold">
                                        {[
                                          ev.volume ? `ج ${ev.volume}` : '',
                                          ev.page ? `ص ${ev.page}` : '',
                                        ]
                                          .filter(Boolean)
                                          .join(' / ')}
                                      </span>
                                    )}
                                    {ev.consensus_badge && (
                                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-bold">
                                        {ev.consensus_badge}
                                      </span>
                                    )}
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                        ev.priority_tier ===
                                        'PRIORITY_1_COUNTRY_BOOK'
                                          ? 'bg-emerald-100 text-emerald-900'
                                          : 'bg-stone-200 text-stone-800'
                                      }`}
                                    >
                                      {ev.priority_tier ===
                                      'PRIORITY_1_COUNTRY_BOOK'
                                        ? 'كتاب دولة العميل - أولوية 1'
                                        : 'مرجع عام - أولوية 2'}
                                    </span>
                                    {(Boolean(ev.other_sources && ev.other_sources.trim()) ||
                                      (Array.isArray(ev.parsed_other_sources) &&
                                        ev.parsed_other_sources.length > 0)) && (
                                      <span className="px-2 py-0.5 rounded-full bg-amber-100 border border-amber-400 text-amber-950 text-[10px] font-extrabold">
                                        ⚠️ إحالات لمصادر أخرى في الهامش (
                                        {ev.parsed_other_sources?.length || 1})
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* 3 RESEARCHER DECISION CONTROLS ON EACH SOURCE CARD */}
                                <div className="flex flex-wrap items-center gap-2">
                                  {/* Control 1: ☑️ اعتماد هذا المصدر في توثيق العائلة */}
                                  <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-stone-300 bg-white text-[11px] font-bold text-stone-800 cursor-pointer hover:border-[#B45309]">
                                    <input
                                      type="checkbox"
                                      checked={isIncluded}
                                      onChange={() =>
                                        toggleSourceInclusion(
                                          selectedTicket,
                                          idx
                                        )
                                      }
                                      className="w-3.5 h-3.5 accent-[#B45309] cursor-pointer"
                                    />
                                    <span>
                                      ☑️ اعتماد هذا المصدر في توثيق العائلة
                                    </span>
                                  </label>

                                  {/* Control 2: ⭐ تعيين كـ "الرواية الأساسية المعتمدة لعمود العائلة" */}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleSetPrimaryNarrativeForTicket(
                                        selectedTicket,
                                        idx,
                                        ev
                                      )
                                    }
                                    className={`px-3 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
                                      isPrimary
                                        ? 'bg-[#B45309] text-white shadow-2xs'
                                        : 'bg-white border border-stone-300 text-stone-700 hover:border-[#B45309]'
                                    }`}
                                  >
                                    <Star className="w-3.5 h-3.5" />
                                    <span>
                                      {isPrimary
                                        ? '⭐ الرواية الأساسية المعتمدة لعمود العائلة ✓'
                                        : '⭐ تعيين كـ "الرواية الأساسية المعتمدة لعمود العائلة"'}
                                    </span>
                                  </button>

                                  {/* Control 3: 🔗 دمج/إلحاق أجداد هذه الرواية أعلى الرواية الأساسية */}
                                  {!isPrimary && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleSpliceNarrativeAbovePrimary(
                                          selectedTicket,
                                          idx,
                                          ev
                                        )
                                      }
                                      className="px-3 py-1 rounded-xl bg-purple-900 hover:bg-purple-950 text-amber-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                                    >
                                      <GitMerge className="w-3.5 h-3.5" />
                                      <span>
                                        🔗 دمج/إلحاق أجداد هذه الرواية أعلى الرواية الأساسية
                                      </span>
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* CHILD BRANCHES & LOCATIONS WITH SHARED CLUE BADGES (قرينة تقاطع مشتركة) */}
                              {(parsedBranches.length > 0 ||
                                parsedLocations.length > 0) && (
                                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-[#FAF8F5] rounded-xl p-3 border border-stone-200/80">
                                  {parsedBranches.length > 0 && (
                                    <div>
                                      <span className="text-[11px] font-bold text-stone-700 block mb-1">
                                        الفروع الأبناء المذكورة في السجل (child_branches):
                                      </span>
                                      <div className="flex flex-wrap gap-1.5">
                                        {parsedBranches.map((br, bIdx) => {
                                          const isShared =
                                            (branchFreq.get(br) || 0) >= 2;
                                          return (
                                            <span
                                              key={bIdx}
                                              className={`px-2 py-0.5 rounded-md text-[11px] font-bold flex items-center gap-1 ${
                                                isShared
                                                  ? 'bg-emerald-100 border border-emerald-400 text-emerald-950'
                                                  : 'bg-white border border-stone-200 text-stone-700'
                                              }`}
                                            >
                                              <span>{br}</span>
                                              {isShared && (
                                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-800 text-white">
                                                  قرينة تقاطع مشتركة
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
                                      <span className="text-[11px] font-bold text-stone-700 block mb-1">
                                        المواطن والنطاق الجغرافي (locations):
                                      </span>
                                      <div className="flex flex-wrap gap-1.5">
                                        {parsedLocations.map((loc, lIdx) => {
                                          const isShared =
                                            (locationFreq.get(loc) || 0) >= 2;
                                          return (
                                            <span
                                              key={lIdx}
                                              className={`px-2 py-0.5 rounded-md text-[11px] font-bold flex items-center gap-1 ${
                                                isShared
                                                  ? 'bg-amber-100 border border-amber-400 text-amber-950'
                                                  : 'bg-white border border-stone-200 text-stone-700'
                                              }`}
                                            >
                                              <span>📍 {loc}</span>
                                              {isShared && (
                                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-800 text-white">
                                                  قرينة تقاطع مشتركة
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

                              {/* INTERACTIVE LINEAGE CHAIN BUTTONS (🔍 فحص في شجرة آدم) */}
                              <div className="mt-3">
                                <span className="text-[11px] font-bold text-stone-600 block mb-2">
                                  سلسلة نسب الأجداد في هذا المصدر (انقر على أي جد لـ 🔍 فحص في شجرة آدم):
                                </span>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {displayChain.map(
                                    (nodeName: string, nodeIdx: number) => {
                                      const isInspected =
                                        inlineChainInspection?.ticketId ===
                                          selectedTicket.id &&
                                        inlineChainInspection?.sourceIdx ===
                                          idx &&
                                        inlineChainInspection?.queriedName ===
                                          nodeName;
                                      return (
                                        <React.Fragment key={nodeIdx}>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleInspectChainNodeInAdam(
                                                selectedTicket.id,
                                                idx,
                                                nodeName
                                              )
                                            }
                                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                                              isInspected
                                                ? 'bg-[#141414] text-amber-300 border-[#141414]'
                                                : 'bg-white hover:bg-amber-50 text-stone-800 border-stone-300'
                                            }`}
                                          >
                                            <span>{nodeName}</span>
                                            <span className="text-[10px] text-[#B45309] font-normal">
                                              🔍 فحص في شجرة آدم
                                            </span>
                                          </button>
                                          {nodeIdx <
                                            displayChain.length - 1 && (
                                            <span className="text-stone-400 text-xs font-bold">
                                              ⬅️
                                            </span>
                                          )}
                                        </React.Fragment>
                                      );
                                    }
                                  )}
                                </div>
                              </div>

                              {/* INLINE ADAM TREE INSPECTION RESULT */}
                              {inlineChainInspection &&
                                inlineChainInspection.ticketId ===
                                  selectedTicket.id &&
                                inlineChainInspection.sourceIdx === idx && (
                                  <div
                                    className={`mt-3 p-3.5 rounded-xl border text-xs ${
                                      inlineChainInspection.foundInAdam
                                        ? 'bg-emerald-950 text-emerald-100 border-emerald-700'
                                        : 'bg-amber-950 text-amber-100 border-amber-700'
                                    }`}
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="font-bold">
                                        {inlineChainInspection.foundInAdam &&
                                        inlineChainInspection.matchedNode ? (
                                          <span>
                                            ✅ العقدة «
                                            {inlineChainInspection.queriedName}»
                                            مفهرسة وموجودة في شجرة آدم (الكود:{' '}
                                            {
                                              inlineChainInspection.matchedNode
                                                .arc_code
                                            }{' '}
                                            — المعرف:{' '}
                                            {
                                              inlineChainInspection.matchedNode
                                                .node_id
                                            }
                                            )
                                          </span>
                                        ) : (
                                          <span>
                                            ⚠️ العقدة «
                                            {inlineChainInspection.queriedName}»
                                            غير مفهرسة بعد في شجرة آدم — جاهزة للإدراج والربط المباشر
                                          </span>
                                        )}
                                      </div>

                                      {inlineChainInspection.foundInAdam &&
                                        inlineChainInspection.matchedNode && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (
                                                inlineChainInspection.matchedNode
                                              ) {
                                                setSelectedAdamNodeId(
                                                  inlineChainInspection
                                                    .matchedNode.node_id
                                                );
                                                setActiveSubTab(
                                                  'adam_tree_explorer'
                                                );
                                              }
                                            }}
                                            className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-bold cursor-pointer"
                                          >
                                            🌳 فتح هذا السجل في تبويب شجرة آدم ↗
                                          </button>
                                        )}
                                    </div>

                                    {inlineChainInspection.foundInAdam &&
                                      inlineChainInspection.adamChainPreview
                                        .length > 0 && (
                                        <p className="text-[11px] text-emerald-200 mt-1.5 font-mono">
                                          الاتصال في شجرة آدم:{' '}
                                          {inlineChainInspection.adamChainPreview.join(
                                            ' ⬅️ '
                                          )}
                                        </p>
                                      )}
                                  </div>
                                )}

                              {/* Researcher Note Input for this source */}
                              <div className="mt-3 pt-2 border-t border-stone-200/60">
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
                                  className="w-full px-3 py-1.5 rounded-lg border border-stone-200 bg-white text-xs focus:outline-none focus:border-[#B45309]"
                                />
                              </div>
                            </div>
                          );
                        };

                        return (
                          <div
                            data-testid="lake2-corroborating-alpha-sources"
                            className="space-y-5"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <span className="px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-950 text-[11px] font-bold">
                                  القسم 2 — البحيرة 2 (معاجم ومشاريع ألفا)
                                </span>
                                <h4 className="text-sm font-bold font-serif text-[#141414] mt-1">
                                  📚 مصفوفة تفكيك ومقارنة المصادر والروايات (
                                  {allTicketEvidence.length} مصادر)
                                </h4>
                              </div>
                              <span className="px-3 py-1 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-900">
                                المصادر المعتمدة للتوثيق:{' '}
                                {getTicketIncludedIndices(selectedTicket).length}{' '}
                                من {allTicketEvidence.length}
                              </span>
                            </div>

                            {/* GROUP 1: 🌟 مراجع مسار التوافق الأساسي */}
                            <div className="rounded-2xl border-2 border-emerald-500/80 bg-emerald-50/40 p-4 space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs sm:text-sm font-extrabold font-serif text-emerald-950">
                                  🌟 مراجع مسار التوافق الأساسي (is_consensus_winner: true)
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full bg-emerald-700 text-white text-[11px] font-bold">
                                  {winnerItems.length} مصادر متفقة
                                </span>
                              </div>
                              <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                                {winnerItems.map(({ ev, originalIdx }) =>
                                  renderEvidenceCard(ev, originalIdx)
                                )}
                              </div>
                            </div>

                            {/* GROUP 2: 📚 روايات وسجلات أخرى لنفس الاسم للمقارنة والتحقيق */}
                            <div className="rounded-2xl border border-amber-300 bg-amber-50/40 p-4 space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs sm:text-sm font-extrabold font-serif text-amber-950">
                                  📚 روايات وسجلات أخرى لنفس الاسم للمقارنة والتحقيق (is_consensus_winner: false)
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-950 text-[11px] font-bold">
                                  {competingItems.length} روايات موازية للمقارنة أو الدمج
                                </span>
                              </div>
                              {competingItems.length === 0 ? (
                                <p className="text-xs text-stone-600 bg-white rounded-xl p-3 border border-amber-200">
                                  جميع مصادر البحيرة 2 لاسم ({selectedTicket.familyName}) تتفق على مسار التوافق الأساسي أعلاه ولا توجد روايات متشابهة متعارضة.
                                </p>
                              ) : (
                                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                                  {competingItems.map(({ ev, originalIdx }) =>
                                    renderEvidenceCard(ev, originalIdx)
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* =====================================================
                          القسم 3: قسم روافد البحيرة الثالثة والمشاريع الخاصة
                          (lake3_unlinked_projects_for_researcher)
                      ===================================================== */}
                      {selectedTicket.lake3UnlinkedProjects &&
                        selectedTicket.lake3UnlinkedProjects.length > 0 && (
                          <div
                            data-testid="lake3-unlinked-projects"
                            className="rounded-2xl border border-stone-300 bg-[#FAF8F5] p-4 space-y-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <span className="px-2.5 py-0.5 rounded-full bg-stone-200 text-stone-800 text-[11px] font-bold">
                                  القسم 3 — روافد البحيرة الثالثة والمشاريع الخاصة (lake3_unlinked_projects_for_researcher)
                                </span>
                                <h4 className="text-xs sm:text-sm font-bold font-serif text-[#141414] mt-1">
                                  🗂️ سجلات استئناسية داعمة للباحث مع إمكانية إلحاقها بالمصادر المعتمدة
                                </h4>
                              </div>
                              <span className="px-2.5 py-0.5 rounded-lg bg-stone-800 text-amber-300 text-[11px] font-mono font-bold">
                                {selectedTicket.lake3UnlinkedProjects.length} سجلات
                              </span>
                            </div>

                            <div className="grid grid-cols-1 gap-2.5">
                              {selectedTicket.lake3UnlinkedProjects.map(
                                (rec) => {
                                  const isAttached = (
                                    includedLake3IdsByTicket[
                                      selectedTicket.id
                                    ] || []
                                  ).includes(rec.record_id);
                                  return (
                                    <div
                                      key={rec.record_id}
                                      className={`rounded-xl border p-3.5 space-y-1.5 transition-all ${
                                        isAttached
                                          ? 'bg-emerald-50/70 border-emerald-500'
                                          : 'bg-white border-stone-200'
                                      }`}
                                    >
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="text-xs font-bold text-[#141414]">
                                            {rec.project_source}
                                          </span>
                                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold border bg-purple-100 text-purple-900 border-purple-300">
                                            [مشاريع]
                                          </span>
                                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-stone-100 text-stone-700">
                                            {rec.family_or_tribe_name}
                                          </span>
                                        </div>

                                        <button
                                          type="button"
                                          onClick={() =>
                                            toggleLake3RecordInclusion(
                                              selectedTicket.id,
                                              rec.record_id
                                            )
                                          }
                                          className={`px-3 py-1 rounded-xl text-[11px] font-bold cursor-pointer transition-all ${
                                            isAttached
                                              ? 'bg-emerald-800 text-white'
                                              : 'bg-stone-900 hover:bg-stone-800 text-amber-300'
                                          }`}
                                        >
                                          {isAttached
                                            ? '✓ تم الإلحاق بالمصادر المعتمدة'
                                            : '➕ إلحاق بالمصادر المعتمدة'}
                                        </button>
                                      </div>
                                      <p className="text-xs text-stone-700 leading-relaxed">
                                        {rec.snippet}
                                      </p>
                                      {rec.locations && (
                                        <p className="text-[11px] text-stone-500">
                                          📍 المواضع المذكورة: {rec.locations}
                                        </p>
                                      )}
                                    </div>
                                  );
                                }
                              )}
                            </div>
                          </div>
                        )}

                      {/* Station 3 inside Gamified Workspace above handles Secondary Sources & Adam Prime Unified Registry */}

                      {/* =====================================================
                          القسم 4: معاينة العمود النهائي ولوحة الإجراءات والمخرجات الحاسمة
                          (Live Final Column Preview & Researcher Actions)
                      ===================================================== */}
                      {(() => {
                        const liveNodes =
                          getLivePreviewNodesForTicket(selectedTicket);
                        const activeBridgePreview =
                          appliedAdamBridgeByTicket[selectedTicket.id] ||
                          selectedTicket.suggestedAdamBridge
                            ?.adam_chain_preview ||
                          'طيء ⬅️ كهلان ⬅️ سبأ ⬅️ قحطان ⬅️ آدم عليه السلام';

                        return (
                          <div
                            data-testid="section4-live-final-column-preview"
                            className="rounded-3xl border-2 border-[#141414] bg-gradient-to-b from-[#FAF8F5] to-white p-5 space-y-5 shadow-sm"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 pb-3">
                              <div>
                                <span className="px-2.5 py-0.5 rounded-full bg-[#141414] text-amber-300 text-[11px] font-bold">
                                  القسم 4 — معاينة العمود النهائي ولوحة الإجراءات الحاسمة
                                </span>
                                <h4 className="text-sm sm:text-base font-extrabold font-serif text-[#141414] mt-1">
                                  🧬 معاينة حية لعمود النسب المدمج (Live Final Column Preview)
                                </h4>
                                <p className="text-xs text-stone-500">
                                  يمكنك تعديل ترتيب أو اسم أو الكود الهيكلي (Arc Code) لأي عقدة قبل الاعتماد النهائي وتغذية شجرة آدم
                                </p>
                              </div>

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
                                      region: selectedTicket.locationLabel,
                                    },
                                  ];
                                  setLivePreviewNodesByTicket((prev) => ({
                                    ...prev,
                                    [selectedTicket.id]: nextNodes,
                                  }));
                                }}
                                className="px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-amber-300 text-xs font-bold cursor-pointer flex items-center gap-1"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>إضافة محطة وسيطة للعمود</span>
                              </button>
                            </div>

                            {/* Editable Nodes List (Bottom-up or Sequential up to Adam Bridge) */}
                            <div className="space-y-2.5">
                              {liveNodes.map((node, nIdx) => (
                                <div
                                  key={node.id || nIdx}
                                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white border border-stone-300 p-3 shadow-2xs"
                                >
                                  <div className="flex flex-wrap items-center gap-2 flex-1">
                                    <span className="w-6 h-6 rounded-full bg-stone-900 text-amber-300 font-mono text-[11px] font-bold flex items-center justify-center">
                                      {nIdx + 1}
                                    </span>

                                    <input
                                      type="text"
                                      value={node.name}
                                      onChange={(e) =>
                                        handleUpdateLivePreviewNode(
                                          selectedTicket,
                                          nIdx,
                                          { name: e.target.value }
                                        )
                                      }
                                      className="px-3 py-1.5 rounded-xl border border-stone-300 bg-[#FAF8F5] text-xs font-bold text-[#141414] min-w-[150px]"
                                    />

                                    <select
                                      value={node.nodeCode}
                                      onChange={(e) =>
                                        handleUpdateLivePreviewNode(
                                          selectedTicket,
                                          nIdx,
                                          { nodeCode: e.target.value }
                                        )
                                      }
                                      className="px-2.5 py-1.5 rounded-xl border border-stone-300 bg-amber-50 text-amber-950 font-mono text-xs font-bold"
                                    >
                                      {ARC_CODE_OPTIONS.map((opt) => (
                                        <option
                                          key={opt.value}
                                          value={opt.value}
                                        >
                                          {opt.label}
                                        </option>
                                      ))}
                                    </select>

                                    <select
                                      value={node.relationType}
                                      onChange={(e) =>
                                        handleUpdateLivePreviewNode(
                                          selectedTicket,
                                          nIdx,
                                          {
                                            relationType: e.target.value as
                                              | 'bin'
                                              | 'aan',
                                          }
                                        )
                                      }
                                      className="px-2.5 py-1.5 rounded-xl border border-stone-300 bg-white text-stone-800 text-xs font-bold"
                                    >
                                      <option value="bin">الرابط: بن (مباشر)</option>
                                      <option value="aan">الرابط: من (انتساب)</option>
                                    </select>
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleMoveLivePreviewNode(
                                          selectedTicket,
                                          nIdx,
                                          'up'
                                        )
                                      }
                                      disabled={nIdx === 0}
                                      className="px-2 py-1 rounded-lg border border-stone-300 bg-stone-50 hover:bg-stone-100 disabled:opacity-40 text-xs font-bold cursor-pointer"
                                      title="تحريك لأسفل السلسلة"
                                    >
                                      ↑
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleMoveLivePreviewNode(
                                          selectedTicket,
                                          nIdx,
                                          'down'
                                        )
                                      }
                                      disabled={nIdx === liveNodes.length - 1}
                                      className="px-2 py-1 rounded-lg border border-stone-300 bg-stone-50 hover:bg-stone-100 disabled:opacity-40 text-xs font-bold cursor-pointer"
                                      title="تحريك لأعلى السلسلة"
                                    >
                                      ↓
                                    </button>
                                    {liveNodes.length > 2 && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleRemoveLivePreviewNode(
                                            selectedTicket,
                                            nIdx
                                          )
                                        }
                                        className="px-2 py-1 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold cursor-pointer"
                                      >
                                        حذف
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Visual Connected Spine Summary up to Adam */}
                            <div className="rounded-2xl bg-emerald-950 text-white p-4 space-y-2">
                              <span className="text-[11px] font-bold text-amber-300 block">
                                🔗 الشكل النهائي لعمود النسب المدمج حتى آدم عليه السلام (كما سيظهر للعميل فور الاعتماد):
                              </span>
                              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                {liveNodes.map((n, i) => (
                                  <React.Fragment key={n.id || i}>
                                    <span className="px-2.5 py-1 rounded-lg bg-white/15 border border-white/20 font-bold text-amber-200">
                                      {n.name}{' '}
                                      <span className="font-mono text-[10px] text-emerald-300">
                                        ({n.nodeCode})
                                      </span>
                                    </span>
                                    <span className="text-emerald-400 font-bold">
                                      ⬅️
                                    </span>
                                  </React.Fragment>
                                ))}
                                <span className="px-2.5 py-1 rounded-lg bg-emerald-800/90 border border-emerald-500 font-mono text-xs font-bold text-white">
                                  🌳 {activeBridgePreview}
                                </span>
                              </div>
                            </div>

                            {/* OPTIONAL ENRICHMENT FIELDS FOR ACTION B */}
                            <div className="bg-[#FAF8F5] rounded-2xl border border-stone-200/80 p-4 space-y-3">
                              <h5 className="text-xs font-bold text-stone-800">
                                بيانات الإثراء الإضافية للسجل (الفروع الشقيقة، الأعلام، والمواطن):
                              </h5>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <input
                                  type="text"
                                  value={enrichmentBranchesInput}
                                  onChange={(e) =>
                                    setEnrichmentBranchesInput(e.target.value)
                                  }
                                  placeholder="فروع شقيقة (مفصولة بفاصلة)..."
                                  className="px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs"
                                />
                                <input
                                  type="text"
                                  value={enrichmentNotablesInput}
                                  onChange={(e) =>
                                    setEnrichmentNotablesInput(e.target.value)
                                  }
                                  placeholder="أعلام وشخصيات بارزة..."
                                  className="px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs"
                                />
                                <input
                                  type="text"
                                  value={enrichmentLocationsInput}
                                  onChange={(e) =>
                                    setEnrichmentLocationsInput(e.target.value)
                                  }
                                  placeholder="الانتشار الجغرافي الإضافي..."
                                  className="px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs"
                                />
                              </div>
                            </div>

                            {/* 4 OFFICIAL RESEARCHER DECISION ACTIONS */}
                            <div className="border-t border-stone-200 pt-4 space-y-3">
                              <h4 className="text-xs font-bold text-stone-700">
                                أزرار الإجراءات الحاسمة ومخرجاتها الفورية في Firebase وواجهة العميل:
                              </h4>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {/* ACTION 1 */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleActionAApproveAndLinkToAdam(
                                      selectedTicket
                                    )
                                  }
                                  className="p-3.5 rounded-2xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                                >
                                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                                  <span>
                                    ✅ اعتماد الربط وتغذية شجرة آدم وإغلاق التذكرة
                                  </span>
                                </button>

                                {/* ACTION 2 */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleActionBEnrichExistingAdamNode(
                                      selectedTicket
                                    )
                                  }
                                  className="p-3.5 rounded-2xl bg-[#B45309] hover:bg-[#92400E] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                                >
                                  <Sparkles className="w-4 h-4 shrink-0" />
                                  <span>
                                    ✨ اعتماد إثراء المراجع والفروع فقط (لعقدة موجودة مسبقاً في شجرة آدم)
                                  </span>
                                </button>

                                {/* ACTION 3 */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setShowClarificationBox((prev) => !prev)
                                  }
                                  className="p-3.5 rounded-2xl bg-stone-800 hover:bg-stone-900 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                                >
                                  <MessageSquare className="w-4 h-4 shrink-0" />
                                  <span>💬 طلب إيضاح أو وثيقة من العميل</span>
                                </button>

                                {/* ACTION 4 */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleActionDEscalateToAdamPrime(
                                      selectedTicket
                                    )
                                  }
                                  className="p-3.5 rounded-2xl bg-purple-900 hover:bg-purple-950 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                                >
                                  <Cpu className="w-4 h-4 shrink-0" />
                                  <span>
                                    🏛️ تصعيد التذكرة إلى جسر آدم برايم (Adam Prime)
                                  </span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                        {/* INLINE CLARIFICATION BOX FOR ACTION C */}
                        {showClarificationBox && (
                          <div className="mt-3 p-4 rounded-2xl bg-stone-100 border border-stone-300 space-y-3">
                            <label className="block text-xs font-bold text-stone-800">
                              اكتب رسالة الاستيضاح التي ستصل فوراً إلى إشعارات العميل ({selectedTicket.clientName}):
                            </label>
                            <textarea
                              rows={3}
                              value={clarificationMessage}
                              onChange={(e) =>
                                setClarificationMessage(e.target.value)
                              }
                              placeholder="مثال: نرجو تزويدنا باسم الجد الرابع أو وثيقة المشجرة العائلية لحسم الالتقاء بين فرع البلاسم وآل نصيري..."
                              className="w-full p-3 rounded-xl border border-stone-300 bg-white text-xs"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setShowClarificationBox(false)}
                                className="px-3 py-1.5 rounded-xl bg-white border border-stone-300 text-xs font-bold cursor-pointer"
                              >
                                إلغاء
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleActionCRequestClarification(
                                    selectedTicket
                                  )
                                }
                                className="px-4 py-1.5 rounded-xl bg-[#B45309] text-white text-xs font-bold cursor-pointer"
                              >
                                إرسال الاستفسار للعميل وتحديث التذكرة ✓
                              </button>
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            SUB-TAB 3: إدارة شجرة آدم (ADAM ANCESTRAL TREE™ — SPLIT-VIEW INTERACTIVE EXPLORER & CODING EDITOR)
        =================================================================== */}
        {activeSubTab === 'adam_tree_explorer' && (
          <div className="space-y-6">
            {/* Official شجرة آدم للأجداد Identity Banner */}
            <div className="bg-gradient-to-l from-[#102A3F] via-[#173D5A] to-[#1E4E72] text-white rounded-3xl p-5 border border-[#C5A059]/40 shadow-md flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/95 p-1.5 shadow-lg border-2 border-[#C5A059] shrink-0 flex items-center justify-center">
                  <img
                    src="/assets/aistudio/Adam-Ancestral-Tree-Logo.209224b_dd7396cf.png"
                    alt="شجرة آدم للأجداد"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#C5A059]/25 border border-[#C5A059]/50 text-[#F4D799] text-[10px] font-extrabold tracking-wider">
                      شجرة آدم للأجداد
                    </span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold font-serif mt-1 text-white">
                    إدارة وعرض وتحرير شجرة آدم
                  </h2>
                  <p className="text-xs text-sky-100/85 mt-0.5">
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
                              ? 'bg-[#173D5A] text-white shadow-2xs'
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
                              ? 'bg-[#173D5A] text-white shadow-2xs'
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
                {tickets.map((t) => (
                  <option key={t.id} value={t.id}>
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
            SUB-TAB 5: 🏛️ جسر آدم برايم (ADAM PRIME BRIDGE — ZERO DUMMY DATA)
        =================================================================== */}
        {activeSubTab === 'adam_prime_bridge' && (
          <div className="bg-white rounded-3xl border border-stone-200/90 p-6 shadow-xs space-y-6">
            <div className="border-b border-stone-100 pb-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold font-serif text-[#141414]">
                  🏛️ جسر آدم برايم (Adam Prime Bridge)
                </h2>
                <p className="text-xs text-stone-500">
                  تصدير واستيراد حزم التحقيق المعمق للتذاكر المصعدة من صندوق التذاكر (خالي تماماً من أي بيانات وهمية)
                </p>
              </div>
            </div>

            {adamPrimeBundles.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-300 bg-[#FAF8F5] p-10 text-center space-y-2">
                <Cpu className="w-8 h-8 text-stone-400 mx-auto" />
                <p className="text-sm font-bold text-stone-700">
                  لا توجد تذاكر مصعدة حالياً في جسر آدم برايم
                </p>
                <p className="text-xs text-stone-500">
                  يمكنك تصعيد أي تذكرة حقيقية من تبويب «📥 صندوق تذاكر العملاء» عبر زر «🏛️ تصعيد التذكرة إلى جسر آدم برايم» أو استيراد حزمة JSON أدناه.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {adamPrimeBundles.map((bundle) => (
                  <div
                    key={bundle.taskId}
                    className="p-5 rounded-2xl border border-stone-200 bg-[#FAF8F5] space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded bg-purple-900 text-purple-100 font-mono text-xs font-bold">
                        {bundle.taskId}
                      </span>
                      <span className="text-xs font-bold text-stone-600">
                        {bundle.locationLabel}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-[#141414]">
                      {bundle.title}
                    </h4>
                    <p className="text-xs text-stone-600">
                      السلسلة المقترحة: {bundle.familyName} ⬅️{' '}
                      {bundle.subRootName} ⬅️ {bundle.targetAdamChain}
                    </p>
                    <p className="text-[11px] text-stone-500">
                      المصدر المرجعي: {bundle.verifiedCitation}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* JSON IMPORT BOX */}
            <div className="pt-4 border-t border-stone-200 space-y-3">
              <label className="block text-xs font-bold text-stone-700">
                استيراد حزمة JSON مكتملة من محرك آدم برايم:
              </label>
              <textarea
                rows={3}
                value={customJsonInput}
                onChange={(e) => setCustomJsonInput(e.target.value)}
                placeholder='{"familyName": "بيت جنديل", "subRootName": "البلاسم", "motherTribeName": "بني لام"}'
                className="w-full p-3 rounded-xl border border-stone-300 bg-[#FAF8F5] text-xs font-mono"
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
                className="px-4 py-2 rounded-xl bg-[#141414] text-amber-300 text-xs font-bold cursor-pointer"
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
