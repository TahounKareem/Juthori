import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
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
  ConsensusClusterGroup,
  CorroboratingAlphaEvidence,
  DashboardStateMode,
  LineageSearchResult,
} from '../types/juthori';
import {
  AdamTreeInteractiveNode,
  ORIGIN_REGION_SUGGESTIONS,
  computeCrossSourceConsensusClusters,
  formatAlphaEvidenceCitation,
  getInitialAdamTreeGraphNodes,
  inspectNameInAdamMasterTree,
  resolveDeterministicLineage,
  searchJuthoriLineage,
} from '../utils/lineageEngine';
import { LineageSpineColumn } from './LineageSpineColumn';
import {
  fetchAllResearchTicketsForStaff,
  sendCustomerNotification,
  syncClientLineageTicketToFirebase,
  updateResearchTicketFullInFirebase,
  updateTicketStatus,
} from '../services/firestoreService';

export interface ExtractableLineageNode {
  id: string;
  name: string;
  nodeCode: 'FE0' | 'B2' | 'B0';
  relationType: 'bin' | 'aan';
  region: string;
}

export interface ResearcherStudioTicket {
  id: string;
  firestoreDocId?: string;
  userId?: string;
  queue: 'P1' | 'P2';
  ticketCategory?:
    | 'ADAM_NODE_ENRICHMENT'
    | 'ALPHA_TO_ADAM_LINK'
    | 'P1_CUSTOMER_SEARCH';
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
  { value: 'AT', label: 'AT — طبقة الآباء الكبار' },
  { value: 'UNASSIGNED', label: 'بدون كود — جد فرعي وسيط' },
];

function splitAncestorsChain(raw?: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(/(?:⬅️|<-|->|—|،|-|\|)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export const ResearcherStudio: React.FC<ResearcherStudioProps> = ({
  currentFamilyName,
  currentClientResult,
  isAlphaAlreadyMerged,
  onApproveAlphaMergeIntoAdam,
  onSwitchToClientPreview,
}) => {
  // =========================================================================
  // 5 HORIZONTAL SUB-TABS STATE
  // =========================================================================
  const [activeSubTab, setActiveSubTab] =
    useState<ResearcherStudioSubTab>('ticket_inbox');

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
      })
      .catch(() => {
        // Keep synchronous deterministic result if offline
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
    const res = runDirectInspectionSearch();
    setDirectSearchResult(res);
    triggerLiveEngineInspection({
      familyName: directSearchFamilyName,
      tribeName: directSearchTribeName,
      branchName: directSearchBranchName,
      originCountry: directSearchCountry,
      originLocality: directSearchLocality,
    });
  };

  // =========================================================================
  // BUILD REAL STRUCTURED TICKETS FROM ENGINE & FIRESTORE
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
    const evidenceList = res.corroborating_alpha_evidence_for_researcher || [];
    const isAlphaLink = Boolean(
      !isAdamEnrichment &&
        (res.isAlphaOnlyBeforeMerge || evidenceList.length > 0)
    );

    const category: ResearcherStudioTicket['ticketCategory'] = isAdamEnrichment
      ? 'ADAM_NODE_ENRICHMENT'
      : isAlphaLink
      ? 'ALPHA_TO_ADAM_LINK'
      : 'P1_CUSTOMER_SEARCH';

    const firstChain = splitAncestorsChain(evidenceList[0]?.lineage_ancestors);
    const subRoot =
      res.rootBranchName?.replace(/^بطن\s+/, '').trim() ||
      firstChain[1] ||
      'فرع قيد التحقيق';
    const motherTribe =
      res.rootTribeName?.replace(/^قبيلة\s+/, '').trim() ||
      firstChain[firstChain.length - 1] ||
      'قبيلة قيد التحقيق';

    let suggestedAdamEntry = 'بني لام ⬅️ طيء ⬅️ كهلان ⬅️ سبأ ⬅️ قحطان ⬅️ آدم';
    if (
      motherTribe.includes('تميم') ||
      subRoot.includes('تميم') ||
      cleanFam.includes('حصان')
    ) {
      suggestedAdamEntry = 'تميم ⬅️ مضر ⬅️ عدنان ⬅️ إسماعيل ⬅️ إبراهيم ⬅️ آدم';
    } else if (
      motherTribe.includes('مذحج') ||
      motherTribe.includes('قحطان') ||
      subRoot.includes('عبيدة')
    ) {
      suggestedAdamEntry = 'مذحج (مالك) ⬅️ كهلان ⬅️ سبأ ⬅️ قحطان ⬅️ آدم';
    } else if (
      motherTribe.includes('عنزة') ||
      motherTribe.includes('وائل') ||
      motherTribe.includes('ربيعة')
    ) {
      suggestedAdamEntry = 'عنزة ⬅️ أسد ⬅️ ربيعة ⬅️ نزار ⬅️ معد ⬅️ عدنان ⬅️ آدم';
    }

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
      ticketCategory: category,
      adamNodeId: res.adamNodeId,
      fullAdamSpineCount: res.upperAncestors.length,
      fullAdamSpineStations: res.upperAncestors.map((u) => u.name),
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
      locationLabel: res.originCountry || 'العراق / الجزيرة العربية',
      status:
        isAlphaAlreadyMerged && cleanFam === currentFamilyName
          ? 'merged_closed'
          : 'open',
      createdAt: 'الآن · متزامن مع Firebase',
      inferredCountries: res.inferred_client_countries || [
        res.originCountry || 'العراق',
      ],
      corroboratingEvidence: evidenceList,
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
        fullChainPreview: `${cleanFam} ⬅️ ${subRoot} ⬅️ ${suggestedAdamEntry}`,
        rationale: `تقاطع موثق في (${
          evidenceList.length || res.verified_sources?.length || 1
        }) مراجع تاريخية يربط (${cleanFam}) بعمود (${motherTribe}) في شجرة آدم.`,
      },
      extractedNodes: [
        {
          id: `node-fe0-${cleanFam}`,
          name: cleanFam,
          nodeCode: 'FE0',
          relationType: 'bin',
          region: res.originCountry || 'العراق / نجد',
        },
        {
          id: `node-b2-${cleanFam}`,
          name: subRoot,
          nodeCode: 'B2',
          relationType: 'bin',
          region: res.originCountry || 'العراق / نجد',
        },
        {
          id: `node-b0-${cleanFam}`,
          name: motherTribe,
          nodeCode: 'B0',
          relationType: 'aan',
          region: res.originCountry || 'الجزيرة العربية',
        },
      ],
    };
  };

  // Seed tickets from actual engine queries so `بيت جنديل` (13 sources), `آل الحصان` (4 sources), `الابو معيط`, and `آل مقيت` are always present and synced
  const initialEngineTickets = useMemo<ResearcherStudioTicket[]>(() => {
    const jandilRes = resolveDeterministicLineage({
      firstName: 'أحمد',
      fatherName: 'جنديل',
      grandfatherName: 'البلاسم',
      familyName: 'بيت جنديل',
      originCountry: 'العراق',
      originRegion: 'العمارة / ميسان',
      tribeName: 'بني لام',
      branchName: 'البلاسم',
    });
    const hisanRes = resolveDeterministicLineage({
      firstName: 'عبدالله',
      fatherName: 'محمد',
      grandfatherName: 'الحصان',
      familyName: 'آل الحصان',
      originCountry: 'السعودية',
      originRegion: 'القصيم / بريدة',
      tribeName: 'تميم',
      branchName: 'النواصر',
    });
    const muaitRes = resolveDeterministicLineage({
      firstName: 'خالد',
      fatherName: 'محمد',
      grandfatherName: 'معيط',
      familyName: 'الابو معيط',
      originCountry: 'سوريا',
      originRegion: 'دير الزور / الميادين',
      tribeName: 'طيء',
      branchName: 'البو كمول',
    });
    const muqaytRes = resolveDeterministicLineage({
      firstName: 'حسن',
      fatherName: 'علي',
      grandfatherName: 'مقيت',
      familyName: 'آل مقيت',
      originCountry: 'السعودية',
      originRegion: 'عسير / سراة عبيدة',
      tribeName: 'قحطان',
      branchName: 'آل برمان',
    });

    const list: ResearcherStudioTicket[] = [
      buildTicketFromLineageResult(
        jandilRes,
        'أحمد بيت جنديل (عميل مسجل)',
        '#ALPHA-LINK-JANDIL-01'
      ),
      buildTicketFromLineageResult(
        hisanRes,
        'عبدالله آل الحصان (عميل مسجل)',
        '#ALPHA-LINK-HISAN-02'
      ),
      buildTicketFromLineageResult(
        muaitRes,
        'خالد الابو معيط (عميل مسجل)',
        '#ALPHA-LINK-MUAIT-03'
      ),
      buildTicketFromLineageResult(
        muqaytRes,
        'حسن آل مقيت (عميل مسجل)',
        `#ENR-ADAM-${muqaytRes.adamNodeId || '272887'}`
      ),
    ];

    if (currentClientResult && currentClientResult.familyName) {
      const cleanCurr = currentClientResult.familyName
        .replace(/^عائلة\s+/, '')
        .trim();
      const alreadyInList = list.some(
        (t) => t.familyName.replace(/^عائلة\s+/, '').trim() === cleanCurr
      );
      if (!alreadyInList) {
        list.unshift(
          buildTicketFromLineageResult(
            currentClientResult,
            `عميل حالي (${cleanCurr})`
          )
        );
      }
    }
    return list;
  }, [currentClientResult, isAlphaAlreadyMerged, currentFamilyName]);

  const [tickets, setTickets] =
    useState<ResearcherStudioTicket[]>(initialEngineTickets);

  // Sync current client result to Firebase and load all real Firestore tickets
  useEffect(() => {
    let isMounted = true;
    const syncAndLoad = async () => {
      try {
        if (currentClientResult && currentClientResult.familyName) {
          await syncClientLineageTicketToFirebase({
            userId: 'active-session-client',
            userFullName: `عميل مسجل (${currentClientResult.familyName})`,
            userEmail: 'client@juthori.com',
            familyName: currentClientResult.familyName,
            originCountry: currentClientResult.originCountry || 'السعودية',
            originRegion: currentClientResult.originRegion,
            rootBranchName: currentClientResult.rootBranchName,
            rootTribeName: currentClientResult.rootTribeName,
            matched: currentClientResult.matched,
            isAlphaOnlyBeforeMerge: currentClientResult.isAlphaOnlyBeforeMerge,
            isAlphaMergedIntoAdam: currentClientResult.isAlphaMergedIntoAdam,
            adamNodeId: currentClientResult.adamNodeId,
            alphaBackgroundTicketCode:
              currentClientResult.alphaBackgroundTicketCode,
            verifiedSources: currentClientResult.verified_sources,
            corroboratingAlphaEvidence:
              currentClientResult.corroborating_alpha_evidence_for_researcher,
          });
        }
        const firestoreDocs = await fetchAllResearchTicketsForStaff();
        if (!isMounted || !firestoreDocs || firestoreDocs.length === 0) return;

        setTickets((prev) => {
          const merged = [...prev];
          for (const docItem of firestoreDocs as any[]) {
            const fam = (docItem.familyName || '')
              .replace(/^عائلة\s+/, '')
              .trim();
            if (!fam) continue;

            const deterministic = resolveDeterministicLineage({
              firstName: docItem.userName || 'عميل',
              fatherName: '—',
              grandfatherName: '—',
              familyName: fam,
              originCountry: docItem.originRegion || '',
              originRegion: docItem.originRegion || '',
              tribeName: docItem.motherTribeName || '',
              branchName: docItem.subRootName || '',
            });

            const existingIdx = merged.findIndex(
              (t) =>
                t.firestoreDocId === docItem.id ||
                t.familyName.replace(/^عائلة\s+/, '').trim() === fam
            );

            const resolvedEvidence: CorroboratingAlphaEvidence[] =
              Array.isArray(docItem.corroboratingEvidence) &&
              docItem.corroboratingEvidence.length > 0
                ? docItem.corroboratingEvidence
                : deterministic.corroborating_alpha_evidence_for_researcher ||
                  [];

            const built = buildTicketFromLineageResult(
              {
                ...deterministic,
                familyName: fam,
                corroborating_alpha_evidence_for_researcher: resolvedEvidence,
              },
              docItem.userName || `عميل (${fam})`,
              docItem.ticketNumber || `#FS-${docItem.id.slice(0, 6)}`,
              docItem.id,
              docItem.userId
            );

            if (
              docItem.status === 'resolved' ||
              docItem.status === 'CLOSED_AND_ENRICHED'
            ) {
              built.status = 'CLOSED_AND_ENRICHED';
            } else if (docItem.status === 'investigating') {
              built.status = 'investigating';
            }

            if (existingIdx >= 0) {
              merged[existingIdx] = {
                ...merged[existingIdx],
                firestoreDocId: docItem.id,
                userId: docItem.userId,
                status: built.status,
              };
            } else {
              merged.unshift(built);
            }
          }
          return merged;
        });
      } catch (err) {
        console.warn('Firestore ticket sync warning:', err);
      }
    };
    syncAndLoad();
    return () => {
      isMounted = false;
    };
  }, [currentClientResult]);

  // =========================================================================
  // TAB 2: TICKET INBOX FILTER (ONLY 2 BUTTONS) & ANALYTICAL SOURCES STATE
  // =========================================================================
  const [inboxCategoryFilter, setInboxCategoryFilter] = useState<
    'ALPHA_ADAM_ENRICHMENT' | 'DIRECT_CUSTOMER_TICKETS'
  >('ALPHA_ADAM_ENRICHMENT');

  const filteredInboxTickets = useMemo(() => {
    if (inboxCategoryFilter === 'ALPHA_ADAM_ENRICHMENT') {
      return tickets.filter(
        (t) =>
          t.ticketCategory === 'ALPHA_TO_ADAM_LINK' ||
          t.ticketCategory === 'ADAM_NODE_ENRICHMENT'
      );
    }
    return tickets.filter((t) => t.ticketCategory === 'P1_CUSTOMER_SEARCH');
  }, [tickets, inboxCategoryFilter]);

  const [selectedTicketId, setSelectedTicketId] = useState<string>(
    initialEngineTickets[0]?.id || ''
  );

  const selectedTicket = useMemo(
    () =>
      tickets.find((t) => t.id === selectedTicketId) ||
      filteredInboxTickets[0] ||
      tickets[0],
    [tickets, selectedTicketId, filteredInboxTickets]
  );

  // Per-source researcher controls: included checkbox, primary spine radio, and researcher note
  const [includedSourceIndices, setIncludedSourceIndices] = useState<
    Record<string, number[]>
  >({});
  const [primarySourceIndexByTicket, setPrimarySourceIndexByTicket] = useState<
    Record<string, number>
  >({});
  const [sourceResearcherNotes, setSourceResearcherNotes] = useState<
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

  const handleInspectChainNodeInAdam = (
    ticketId: string,
    sourceIdx: number,
    nodeName: string
  ) => {
    const result = inspectNameInAdamMasterTree(nodeName, adamGraphNodes);
    setInlineChainInspection({
      ticketId,
      sourceIdx,
      queriedName: nodeName,
      foundInAdam: result.found,
      matchedNode: result.matchedNode,
      adamChainPreview: result.matchedNode
        ? [
            result.matchedNode.name,
            ...result.ancestorsUpToAdam.map((a) => a.name),
          ]
        : [],
    });
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
            <div className="flex flex-wrap gap-1.5 pt-1">
              {consensusWinner.records.slice(0, 6).map((ev: CorroboratingAlphaEvidence, i: number) => (
                <span
                  key={ev.alpha_id || i}
                  className="px-2 py-0.5 rounded bg-emerald-100/80 border border-emerald-300 text-[10px] font-bold text-emerald-950"
                >
                  {ev.source_book}
                  {ev.volume ? ` (ج${ev.volume}` : ''}
                  {ev.page ? ` ص${ev.page})` : ev.volume ? ')' : ''}
                </span>
              ))}
              {consensusWinner.records.length > 6 && (
                <span className="px-2 py-0.5 rounded bg-emerald-200 text-[10px] font-bold text-emerald-950">
                  +{consensusWinner.records.length - 6} مصادر أخرى متفقة
                </span>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 2: 📚 سجلات ومسارات أخرى متشابهة بالاسم في المصادر */}
        <div className="rounded-2xl border border-amber-300 bg-amber-50/50 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-extrabold font-serif text-amber-950">
              📚 سجلات ومسارات أخرى متشابهة بالاسم في المصادر
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-200/80 text-amber-950 text-[11px] font-bold">
              {competingClusters.length > 0
                ? `${competingClusters.length} مسار منافس مرصود`
                : 'لا توجد مسارات متعارضة أخرى'}
            </span>
          </div>

          {competingClusters.length === 0 ? (
            <p className="text-xs text-stone-600 bg-white rounded-xl p-3 border border-amber-200">
              جميع المصادر المرصودة لاسم ({familyName}) تتفق على مسار نسبي واحد ولا توجد روايات متعارضة في القاعدة.
            </p>
          ) : (
            <div className="space-y-3">
              {competingClusters.map((comp) => {
                const chainCount = comp.fullChainNodes.length;
                return (
                  <div
                    key={comp.clusterId}
                    className="bg-white rounded-xl p-3.5 border border-amber-300 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-lg bg-amber-100 border border-amber-300 text-amber-950 text-xs font-extrabold">
                          الأصل / القبيلة: {comp.originTribeLabel}
                        </span>
                        <span className="text-xs font-bold text-stone-700">
                          الجذر ($5): {comp.rootPreviewLabel}
                        </span>
                        {chainCount > 6 && (
                          <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-900 text-[10px] font-bold">
                            سلسلة طويلة ({chainCount} اسماً — يُطوى منها {Math.max(1, chainCount - 3)} جدّاً في كبسولة للعميل)
                          </span>
                        )}
                      </div>

                      {contextMode === 'direct_search' &&
                        directSearchResult?.optionBResultOverride && (
                          <button
                            type="button"
                            onClick={() =>
                              setDirectSearchResult({
                                ...directSearchResult,
                                ...directSearchResult.optionBResultOverride,
                              })
                            }
                            className="px-3 py-1 rounded-xl bg-[#B45309] hover:bg-[#92400E] text-white text-[11px] font-bold cursor-pointer transition-colors"
                          >
                            معاينة هذا المسار ({comp.originTribeLabel}) في العمود أعلاه
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

                    <div className="flex flex-wrap gap-1.5">
                      {comp.records.map((ev: CorroboratingAlphaEvidence, idx: number) => (
                        <span
                          key={ev.alpha_id || idx}
                          className="px-2 py-0.5 rounded bg-stone-100 border border-stone-300 text-[10px] font-bold text-stone-800"
                        >
                          المصدر: {ev.source_book}
                          {ev.volume ? ` (ج${ev.volume}` : ''}
                          {ev.page ? ` ص${ev.page})` : ev.volume ? ')' : ''}
                        </span>
                      ))}
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
  // =========================================================================
  const [adamGraphNodes, setAdamGraphNodes] = useState<
    AdamTreeInteractiveNode[]
  >(() => getInitialAdamTreeGraphNodes());
  const [adamSearchQuery, setAdamSearchQuery] = useState('');
  const [adamArcFilter, setAdamArcFilter] = useState<string>('ALL');
  const [adamRepFilter, setAdamRepFilter] = useState<string>('ALL');
  const [selectedAdamNodeId, setSelectedAdamNodeId] = useState<string>(
    'ADAM_BANILAM_302'
  );

  const selectedAdamNode = useMemo(
    () =>
      adamGraphNodes.find((n) => n.node_id === selectedAdamNodeId) ||
      adamGraphNodes[0],
    [adamGraphNodes, selectedAdamNodeId]
  );

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
    setEditNodeId(selectedAdamNode.node_id);
    setEditNodeName(selectedAdamNode.name);
    setEditArcCode(selectedAdamNode.arc_code);
    setEditRepresentation(selectedAdamNode.representation);
    setEditRelationNature(selectedAdamNode.relation_nature);
    setEditGeoFootprint((selectedAdamNode.geo_footprint || []).join('، '));
    setEditEnrichedSources(
      (selectedAdamNode.enriched_sources || []).join('\n')
    );
    setEditEnrichedBranches(
      (selectedAdamNode.enriched_branches || []).join('، ')
    );
  }, [selectedAdamNode]);

  const filteredAdamNodes = useMemo(() => {
    return adamGraphNodes.filter((n) => {
      if (adamArcFilter !== 'ALL' && n.arc_code !== adamArcFilter) {
        return false;
      }
      if (adamRepFilter !== 'ALL' && n.representation !== adamRepFilter) {
        return false;
      }
      if (adamSearchQuery.trim()) {
        const q = adamSearchQuery.trim();
        return (
          n.name.includes(q) ||
          n.node_id.toLowerCase().includes(q.toLowerCase()) ||
          (n.geo_footprint || []).some((g) => g.includes(q))
        );
      }
      return true;
    });
  }, [adamGraphNodes, adamArcFilter, adamRepFilter, adamSearchQuery]);

  // Compute ancestor chain up to Adam (AS) for the selected node
  const selectedNodeAncestorsChain = useMemo(() => {
    if (!selectedAdamNode) return [];
    const chain: AdamTreeInteractiveNode[] = [];
    const byId = new Map<string, AdamTreeInteractiveNode>(
      adamGraphNodes.map((n) => [n.node_id, n])
    );
    let currParentId = selectedAdamNode.parent_id;
    let safety = 0;
    while (currParentId && safety < 50) {
      const parentNode = byId.get(currParentId);
      if (!parentNode) break;
      chain.unshift(parentNode); // Put highest ancestor first
      currParentId = parentNode.parent_id;
      safety++;
    }
    return chain;
  }, [adamGraphNodes, selectedAdamNode]);

  const selectedParentNodeObj = useMemo(() => {
    if (!selectedAdamNode?.parent_id) return null;
    return (
      adamGraphNodes.find((n) => n.node_id === selectedAdamNode.parent_id) ||
      null
    );
  }, [adamGraphNodes, selectedAdamNode]);

  // Compute direct children of the selected node
  const selectedNodeDirectChildren = useMemo(() => {
    if (!selectedAdamNode) return [];
    return adamGraphNodes.filter(
      (n) => n.parent_id === selectedAdamNode.node_id
    );
  }, [adamGraphNodes, selectedAdamNode]);

  const handleSaveAdamNodeCoding = async () => {
    if (!selectedAdamNode) return;
    const updatedNode: AdamTreeInteractiveNode = {
      ...selectedAdamNode,
      node_id: editNodeId.trim() || selectedAdamNode.node_id,
      name: editNodeName.trim() || selectedAdamNode.name,
      arc_code: editArcCode,
      representation: editRepresentation,
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
      await fetch('/api/v1/juthori/adam-tree/update-node', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedNode),
      });
    } catch {
      // Proceed with local state update if offline
    }

    setAdamGraphNodes((prev) =>
      prev.map((n) =>
        n.node_id === selectedAdamNode.node_id ? updatedNode : n
      )
    );
    setSelectedAdamNodeId(updatedNode.node_id);
    showToast(
      `تم حفظ وتحديث تكويد العقدة (${updatedNode.name} — ${updatedNode.arc_code}) في شجرة آدم بنجاح ✓`
    );
  };

  const handleAddChildNodeToAdam = async () => {
    if (!selectedAdamNode || !newChildName.trim()) return;
    const newId = `ADAM-CUSTOM-${Date.now().toString().slice(-5)}`;
    const childNode: AdamTreeInteractiveNode = {
      node_id: newId,
      name: newChildName.trim(),
      parent_id: selectedAdamNode.node_id,
      arc_code: newChildArcCode,
      representation: newChildRepresentation,
      relation_nature: newChildRelationNature,
      geo_footprint: newChildGeo
        .split(/[،,]/)
        .map((s) => s.trim())
        .filter(Boolean),
      enriched_sources: [],
      enriched_branches: [],
    };

    try {
      await fetch('/api/v1/juthori/adam-tree/update-node', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(childNode),
      });
    } catch {
      // Proceed with local state update
    }

    setAdamGraphNodes((prev) => [...prev, childNode]);
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

    const selectedCitations =
      evList.length > 0
        ? evList
            .filter((_, idx) => includedIdx.includes(idx))
            .map((ev, idx) => {
              const note = sourceResearcherNotes[`${ticket.id}-${idx}`];
              const base = formatAlphaEvidenceCitation(ev);
              return note ? `${base} — [تحقيق الباحث: ${note}]` : base;
            })
        : ticket.copilotSources.map((s) => s.bookCitation);

    const primaryEv = evList[primaryIdx] || evList[0];
    const primaryChain = splitAncestorsChain(primaryEv?.lineage_ancestors);
    const resolvedSubRoot = primaryChain[1] || ticket.subRootName;
    const resolvedMotherTribe =
      primaryChain[primaryChain.length - 1] || ticket.motherTribeName;

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

    setAdamGraphNodes((prev) => {
      const exists = prev.some((n) => n.node_id === newAdamNodeId);
      if (exists) {
        return prev.map((n) =>
          n.node_id === newAdamNodeId ? newlyLinkedAdamNode : n
        );
      }
      return [...prev, newlyLinkedAdamNode];
    });

    // 2. Call backend endpoint
    try {
      await fetch('/api/v1/juthori/researcher/close-enrichment-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adamNodeId: newAdamNodeId,
          familyName: ticket.familyName,
          addedVerifiedSources: selectedCitations,
          addedSiblingBranches: [resolvedSubRoot],
          addedLocations: ticket.inferredCountries || [ticket.locationLabel],
        }),
      });
    } catch {
      // Offline fallback
    }

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
        body: `اعتمد فريق التحقيق ربط (${ticket.familyName}) بـ (${resolvedSubRoot} ⬅️ ${resolvedMotherTribe}) حتى آدم عليه السلام مع توثيق (${selectedCitations.length}) مراجع تاريخية.`,
        category: 'ticket_update',
        senderRole: 'researcher',
      });
    }

    // 4. Update local ticket status & notify parent App state
    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticket.id ? { ...t, status: 'CLOSED_AND_ENRICHED' } : t
      )
    );

    onApproveAlphaMergeIntoAdam({
      familyName: ticket.familyName,
      subRootName: resolvedSubRoot,
      motherTribeName: resolvedMotherTribe,
      approveSources: true,
      isAdamEnrichmentOnly: false,
      addedVerifiedSources: selectedCitations,
      addedSiblingBranches: [resolvedSubRoot],
      addedLocations: ticket.inferredCountries || [ticket.locationLabel],
    });

    showToast(
      `✅ تم اعتماد ربط (${ticket.familyName} ⬅️ ${resolvedSubRoot} ⬅️ ${resolvedMotherTribe}) بشجرة آدم وإثراء السجل بـ (${selectedCitations.length}) مصادر وإقفال التذكرة!`
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
      await fetch('/api/v1/juthori/researcher/close-enrichment-ticket', {
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
      });
    } catch {
      // Offline fallback
    }

    if (ticket.firestoreDocId) {
      await updateResearchTicketFullInFirebase(ticket.firestoreDocId, {
        status: 'CLOSED_AND_ENRICHED',
        verifiedSources: selectedCitations.join(' | '),
      });
    }

    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticket.id ? { ...t, status: 'CLOSED_AND_ENRICHED' } : t
      )
    );

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
      `✨ تم إثراء سجل (${ticket.familyName}) في شجرة آدم بالمصادر والفروع الإضافية وإقفال التذكرة!`
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
          5 CLEAN HORIZONTAL SUB-TABS BAR (NO BLACK HEADER BAR)
      ===================================================================== */}
      <div className="bg-white border-b border-stone-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveSubTab('direct_search')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeSubTab === 'direct_search'
                  ? 'bg-[#B45309] text-white shadow-sm'
                  : 'bg-[#FAF8F5] text-stone-700 hover:bg-stone-100 border border-stone-200/80'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>🔍 البحث والفحص</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('ticket_inbox')}
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
              onClick={() => setActiveSubTab('adam_tree_explorer')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeSubTab === 'adam_tree_explorer'
                  ? 'bg-[#B45309] text-white shadow-sm'
                  : 'bg-[#FAF8F5] text-stone-700 hover:bg-stone-100 border border-stone-200/80'
              }`}
            >
              <TreePine className="w-4 h-4" />
              <span>🌳 شجرة آدم</span>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
                  activeSubTab === 'adam_tree_explorer'
                    ? 'bg-white/20 text-white'
                    : 'bg-emerald-100 text-emerald-900'
                }`}
              >
                {adamGraphNodes.length}
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
          <div className="bg-white rounded-3xl border-2 border-[#B45309]/25 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-l from-[#1C1917] via-[#292524] to-[#1C1917] text-white px-6 py-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
                  <Search className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold font-serif text-amber-300">
                    🔍 أداة الفحص والبحث المباش
                  </h2>
                  <p className="text-xs text-stone-300 mt-0.5">
                    فحص هيكلي فوري لأي عائلة
                  </p>
                </div>
              </div>
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
                    placeholder="مثال: بيت جنديل، آل مقيت..."
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
                    placeholder="مثال: قحطان، بني لام، تميم..."
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
                    placeholder="مثال: البلاسم، آل برمان..."
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
                    <span>فحص وتحليل السلسلة</span>
                  </button>
                </div>
              </form>

              {!directSearchResult ? (
                <div className="rounded-2xl border border-dashed border-stone-300 bg-[#FAF8F5] p-8 text-center">
                  <Search className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-stone-700">
                    أدخل اسم العائلة أو القبيلة واضغط على «فحص وتحليل السلسلة» لعرض عمود النسب والمصادر المجمعة
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* UNIFIED CLIENT LINEAGE SPINE COLUMN (WITH ALL INTERMEDIATE NODES, ASCENDING ORDER, AND AGGREGATED SOURCES CARD) */}
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
                    onOpenAsResearcherTicket={() => {
                      const newTkt = buildTicketFromLineageResult(
                        directSearchResult,
                        `فحص باحث (${directSearchResult.familyName})`
                      );
                      setTickets((prev) => [newTkt, ...prev]);
                      setSelectedTicketId(newTkt.id);
                      setActiveSubTab('ticket_inbox');
                    }}
                  />

                  {/* STICKY NOTES SUMMARY BELOW LINEAGE COLUMN */}
                  <div className="max-w-[420px] mx-auto">
                    {directSearchResult.isAlphaOnlyBeforeMerge ? (
                      <div className="relative rounded-none rounded-bl-2xl rounded-tr-2xl border border-amber-300/90 border-r-4 border-r-amber-500 bg-[#FEF9C3] p-5 shadow-md">
                        <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-amber-300/70">
                          <span className="text-xs sm:text-sm font-bold font-serif text-amber-950">
                            📌 ملاحظة: تم إصدار تذكرة بحث لإثراء هذه العقد في شجرة آدم
                          </span>
                          {directSearchResult.alphaBackgroundTicketCode && (
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-300/60 text-amber-950">
                              {directSearchResult.alphaBackgroundTicketCode}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-amber-900/95 leading-relaxed">
                          يتم حالياً عرض ما هو متاح فقط من عُقد موثقة لعائلة (
                          {directSearchResult.familyName}) في مشاريع ألفا، وقد تم
                          إصدار تذكرة بحث لإثراء هذه العقد وربطها بعمودها التاريخي
                          الأعلى في شجرة آدم.
                        </p>
                      </div>
                    ) : (
                      <div className="relative rounded-none rounded-bl-2xl rounded-tr-2xl border border-amber-300/90 border-r-4 border-r-emerald-600 bg-[#FEFCE8] p-5 shadow-md space-y-3">
                        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-amber-300/70">
                          <span className="text-xs sm:text-sm font-bold font-serif text-stone-900">
                            📌 ملاحظة توثيقية مجمّعة: المصادر المعتمدة للوصول لهذا العمود النسبي
                          </span>
                          <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">
                            مربوط بشجرة آدم ✓
                          </span>
                        </div>
                        <ul className="space-y-1.5 text-xs text-stone-800 list-disc list-inside">
                          {(
                            directSearchResult.verified_sources || [
                              directSearchResult.verifiedSourceCitation,
                            ]
                          )
                            .filter(Boolean)
                            .map((src: string, idx: number) => (
                              <li key={idx} className="leading-relaxed">
                                {src}
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* RULE 4: CONSENSUS WINNER & COMPETING PATHS COMPARISON IN DIRECT SEARCH */}
                  {renderConsensusAndCompetingPathsMatrix(
                    directSearchResult.familyName,
                    directSearchResult.corroborating_alpha_evidence_for_researcher,
                    'direct_search'
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================================================================
            SUB-TAB 2: 📥 صندوق تذاكر العملاء (ANALYTICAL SOURCE CARDS & 4 ACTIONS)
        =================================================================== */}
        {activeSubTab === 'ticket_inbox' && (
          <div className="space-y-6">
            {/* TOP FILTER BAR WITH ONLY 2 BUTTONS */}
            <div className="bg-white rounded-2xl border border-stone-200/90 p-4 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setInboxCategoryFilter('ALPHA_ADAM_ENRICHMENT');
                    const firstMatch = tickets.find(
                      (t) =>
                        t.ticketCategory === 'ALPHA_TO_ADAM_LINK' ||
                        t.ticketCategory === 'ADAM_NODE_ENRICHMENT'
                    );
                    if (firstMatch) setSelectedTicketId(firstMatch.id);
                  }}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    inboxCategoryFilter === 'ALPHA_ADAM_ENRICHMENT'
                      ? 'bg-[#141414] text-amber-300 shadow-sm'
                      : 'bg-[#FAF8F5] text-stone-700 hover:bg-stone-100 border border-stone-200'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>إثراء ودمج شجرة آدم من مشاريع ألفا</span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-amber-500/20 text-amber-400">
                    {
                      tickets.filter(
                        (t) =>
                          t.ticketCategory === 'ALPHA_TO_ADAM_LINK' ||
                          t.ticketCategory === 'ADAM_NODE_ENRICHMENT'
                      ).length
                    }
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setInboxCategoryFilter('DIRECT_CUSTOMER_TICKETS');
                    const firstMatch = tickets.find(
                      (t) => t.ticketCategory === 'P1_CUSTOMER_SEARCH'
                    );
                    if (firstMatch) setSelectedTicketId(firstMatch.id);
                  }}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    inboxCategoryFilter === 'DIRECT_CUSTOMER_TICKETS'
                      ? 'bg-[#141414] text-amber-300 shadow-sm'
                      : 'bg-[#FAF8F5] text-stone-700 hover:bg-stone-100 border border-stone-200'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>تذاكر بحث العملاء المباشرة</span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-stone-200 text-stone-700">
                    {
                      tickets.filter(
                        (t) => t.ticketCategory === 'P1_CUSTOMER_SEARCH'
                      ).length
                    }
                  </span>
                </button>
              </div>

              <span className="text-xs text-stone-500 font-medium">
                متصل مباشرة بمجموعة <code className="font-mono">research_tickets</code> في Firebase
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* RIGHT COLUMN (4 COLS): TICKET LIST */}
              <div className="lg:col-span-4 bg-white rounded-3xl border border-stone-200/80 shadow-xs overflow-hidden">
                <div className="p-4 bg-[#FAF8F5] border-b border-stone-200 flex items-center justify-between">
                  <h3 className="text-sm font-bold font-serif text-[#141414]">
                    قائمة التذاكر البحثية ({filteredInboxTickets.length})
                  </h3>
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
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-stone-900 text-amber-300">
                              {tkt.id}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                isClosed
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : tkt.status === 'investigating'
                                  ? 'bg-blue-100 text-blue-800'
                                  : tkt.status === 'exported_adam_prime'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-amber-100 text-amber-900'
                              }`}
                            >
                              {isClosed
                                ? 'معتمدة ومقفلة ✓'
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

                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-500 mt-2">
                            <span>العميل: {tkt.clientName}</span>
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

              {/* LEFT COLUMN (8 COLS): ANALYTICAL SOURCES WORKBENCH & 4 RESEARCHER DECISIONS */}
              <div className="lg:col-span-8 space-y-6">
                {selectedTicket ? (
                  <div className="bg-white rounded-3xl border border-stone-200/80 shadow-xs overflow-hidden">
                    {/* TICKET HEADER */}
                    <div className="bg-[#1C1917] text-white p-6">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-300 font-mono text-xs font-bold border border-amber-400/30">
                            {selectedTicket.id}
                          </span>
                          <span className="px-2.5 py-1 rounded-md bg-white/10 text-stone-200 text-xs font-bold">
                            الموطن: {selectedTicket.locationLabel}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            onSwitchToClientPreview(selectedTicket.familyName)
                          }
                          className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-amber-300 text-xs font-bold cursor-pointer transition-all"
                        >
                          معاينة لوحة العميل ({selectedTicket.familyName}) ↗
                        </button>
                      </div>

                      <h3 className="text-lg font-bold font-serif text-white">
                        {selectedTicket.title}
                      </h3>
                      <p className="text-xs text-stone-300 mt-1">
                        نقطة الالتقاء المقترحة في شجرة آدم:{' '}
                        <span className="text-amber-300 font-bold">
                          {selectedTicket.suggestedAdamTarget.entryNodeName}
                        </span>
                      </p>
                    </div>

                    <div className="p-6 space-y-6">
                      {/* RULE 4: CONSENSUS WINNER & COMPETING PATHS COMPARISON IN TICKET INBOX */}
                      {renderConsensusAndCompetingPathsMatrix(
                        selectedTicket.familyName,
                        selectedTicket.corroboratingEvidence,
                        'ticket_inbox'
                      )}

                      {/* ANALYTICAL SOURCE CARDS (قائمة المصادر التحليلية للباحث) */}
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                          <div>
                            <h4 className="text-sm font-bold font-serif text-[#141414]">
                              📚 قائمة المصادر والروايات التحليلية للباحث (
                              {selectedTicket.corroboratingEvidence?.length ||
                                selectedTicket.copilotSources.length}{' '}
                              مصادر)
                            </h4>
                            <p className="text-xs text-stone-500">
                              انقر على أي اسم في السلسلة المستخرجة لفحص وجوده الفوري في شجرة آدم وتحديد نقطة الربط
                            </p>
                          </div>
                          <span className="px-3 py-1 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-900">
                            المصادر المحددة للإثراء:{' '}
                            {getTicketIncludedIndices(selectedTicket).length} من{' '}
                            {selectedTicket.corroboratingEvidence?.length ||
                              selectedTicket.copilotSources.length}
                          </span>
                        </div>

                        <div className="space-y-4 max-h-[540px] overflow-y-auto pr-1">
                          {(selectedTicket.corroboratingEvidence &&
                          selectedTicket.corroboratingEvidence.length > 0
                            ? selectedTicket.corroboratingEvidence
                            : selectedTicket.copilotSources.map(
                                (cs, idx): CorroboratingAlphaEvidence => ({
                                  alpha_id: `alpha-fallback-${idx}`,
                                  record_name: selectedTicket.familyName,
                                  source_book: cs.bookCitation,
                                  page: '—',
                                  volume: `${idx + 1}`,
                                  lineage_ancestors: `${selectedTicket.familyName} ⬅️ ${selectedTicket.subRootName} ⬅️ ${selectedTicket.motherTribeName}`,
                                  priority_tier: 'PRIORITY_1_COUNTRY_BOOK',
                                })
                              )
                          ).map((ev, idx) => {
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

                            return (
                              <div
                                key={ev.alpha_id || idx}
                                className={`rounded-2xl border p-4 transition-all ${
                                  isPrimary
                                    ? 'bg-amber-50/70 border-2 border-[#B45309]'
                                    : isIncluded
                                    ? 'bg-[#FAF8F5] border-stone-200'
                                    : 'bg-stone-50/50 border-stone-200 opacity-60'
                                }`}
                              >
                                {/* Source Header & Controls */}
                                <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-stone-200/80">
                                  <div className="flex items-start gap-2.5">
                                    <input
                                      type="checkbox"
                                      checked={isIncluded}
                                      onChange={() =>
                                        toggleSourceInclusion(
                                          selectedTicket,
                                          idx
                                        )
                                      }
                                      className="mt-1 w-4 h-4 accent-[#B45309] cursor-pointer"
                                    />
                                    <div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-xs font-bold text-[#141414]">
                                          {idx + 1}. كتاب: {ev.source_book}
                                        </span>
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
                                            ? 'أولوية 1: كتب دولة العميل'
                                            : 'أولوية 2: معاجم الأنساب العامة'}
                                        </span>
                                      </div>
                                      {ev.locations && (
                                        <p className="text-[11px] text-stone-500 mt-0.5">
                                          المواطن المذكورة في المصدر:{' '}
                                          {ev.locations}
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPrimarySourceIndexByTicket((prev) => ({
                                        ...prev,
                                        [selectedTicket.id]: idx,
                                      }))
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
                                        ? 'الرواية الأساسية لعمود النسب ✓'
                                        : 'تعيين كرواية أساسية لعمود النسب'}
                                    </span>
                                  </button>
                                </div>

                                {/* INTERACTIVE LINEAGE CHAIN BUTTONS (فحص كل اسم في شجرة آدم) */}
                                <div className="mt-3">
                                  <span className="text-[11px] font-bold text-stone-600 block mb-2">
                                    السلسلة المستخرجة في هذا المصدر (انقر على أي محطة لفحصها في شجرة آدم):
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
                                              <Search className="w-3 h-3 text-[#B45309]" />
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
                                              {
                                                inlineChainInspection.queriedName
                                              }
                                              » مفهرسة وموجودة في شجرة آدم (الكود:{' '}
                                              {
                                                inlineChainInspection
                                                  .matchedNode.arc_code
                                              }{' '}
                                              — المعرف:{' '}
                                              {
                                                inlineChainInspection
                                                  .matchedNode.node_id
                                              }
                                              )
                                            </span>
                                          ) : (
                                            <span>
                                              ⚠️ العقدة «
                                              {
                                                inlineChainInspection.queriedName
                                              }
                                              » غير مفهرسة بعد في شجرة آدم — جاهزة للإدراج والربط المباشر
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
                          })}
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
                      <div className="border-t border-stone-200 pt-5 space-y-3">
                        <h4 className="text-xs font-bold text-stone-700">
                          قرارات الباحث المعتمدة لمعالجة التذكرة وإشعار العميل:
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* ACTION A */}
                          <button
                            type="button"
                            onClick={() =>
                              handleActionAApproveAndLinkToAdam(selectedTicket)
                            }
                            className="p-3.5 rounded-2xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>
                              ✅ اعتماد ربط العمود بشجرة آدم وإثراء السجل وإقفال التذكرة
                            </span>
                          </button>

                          {/* ACTION B */}
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
                              ✨ اعتماد إثراء المصادر والفروع فقط (للعقد الموجودة مسبقاً)
                            </span>
                          </button>

                          {/* ACTION C */}
                          <button
                            type="button"
                            onClick={() =>
                              setShowClarificationBox((prev) => !prev)
                            }
                            className="p-3.5 rounded-2xl bg-stone-800 hover:bg-stone-900 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                          >
                            <MessageSquare className="w-4 h-4 shrink-0" />
                            <span>
                              💬 طلب إيضاح أو بيانات إضافية من العميل
                            </span>
                          </button>

                          {/* ACTION D */}
                          <button
                            type="button"
                            onClick={() =>
                              handleActionDEscalateToAdamPrime(selectedTicket)
                            }
                            className="p-3.5 rounded-2xl bg-purple-900 hover:bg-purple-950 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                          >
                            <Cpu className="w-4 h-4 shrink-0" />
                            <span>
                              🏛️ تصعيد التذكرة إلى جسر آدم برايم (Adam Prime)
                            </span>
                          </button>
                        </div>

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
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            SUB-TAB 3: 🌳 شجرة آدم (SPLIT-VIEW INTERACTIVE EXPLORER & CODING EDITOR)
        =================================================================== */}
        {activeSubTab === 'adam_tree_explorer' && (
          <div className="space-y-6">
            {/* TOP SEARCH & FILTER BAR */}
            <div className="bg-white rounded-3xl border border-stone-200/90 p-5 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold font-serif text-[#141414]">
                    🌳 المستكشف التفاعلي ومحرر تكويد شجرة آدم (ADAM_MASTER_TREE)
                  </h2>
                  <p className="text-xs text-stone-500">
                    تصفح السجلات، افحص اتصالها حتى آدم عليه السلام، وعدّل الأكواد الهيكلية (Arc Codes) وطبيعة الروابط مباشرة
                  </p>
                </div>
                <span className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold">
                  إجمالي العقد المفهرسة في المستكشف: {adamGraphNodes.length} عقدة
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-5 relative">
                  <Search className="w-4 h-4 text-stone-400 absolute right-3.5 top-3" />
                  <input
                    type="text"
                    value={adamSearchQuery}
                    onChange={(e) => setAdamSearchQuery(e.target.value)}
                    placeholder="ابحث باسم العائلة أو القبيلة أو الجد أو معرف السجل (node_id)..."
                    className="w-full pr-10 pl-3 py-2.5 rounded-xl border border-stone-300 bg-[#FAF8F5] text-xs font-bold focus:outline-none focus:border-[#B45309]"
                  />
                </div>

                <div className="md:col-span-4">
                  <select
                    value={adamArcFilter}
                    onChange={(e) => setAdamArcFilter(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-[#FAF8F5] text-xs font-bold focus:outline-none focus:border-[#B45309]"
                  >
                    <option value="ALL">جميع الأكواد الهيكلية (Arc Codes)</option>
                    <option value="FE0">FE0 — أسر معاصرة / اسم الشهرة</option>
                    <option value="B2">B2 — فخذ مباشر</option>
                    <option value="B1">B1 — بطن قبلي</option>
                    <option value="B0">B0 — جد جامع للفرع</option>
                    <option value="MT">MT — قبيلة أم جامعة</option>
                    <option value="MF">MF — حلف قبلي</option>
                    <option value="M">M — جذم تاريخي</option>
                    <option value="AT">AT — آباء كبار</option>
                    <option value="UNASSIGNED">بدون كود — جد فرعي وسيط</option>
                  </select>
                </div>

                <div className="md:col-span-3">
                  <select
                    value={adamRepFilter}
                    onChange={(e) => setAdamRepFilter(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-[#FAF8F5] text-xs font-bold focus:outline-none focus:border-[#B45309]"
                  >
                    <option value="ALL">جميع التصنيفات (Representation)</option>
                    <option value="INDIVIDUAL">INDIVIDUAL — فرد</option>
                    <option value="FAMILY">FAMILY — أسرة</option>
                    <option value="TRIBE">TRIBE — قبيلة</option>
                    <option value="ALLIANCE">ALLIANCE — حلف</option>
                  </select>
                </div>
              </div>

              {/* Quick matching pills from filter */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1 max-h-28 overflow-y-auto">
                {filteredAdamNodes.map((node) => (
                  <button
                    key={node.node_id}
                    type="button"
                    onClick={() => setSelectedAdamNodeId(node.node_id)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      selectedAdamNode?.node_id === node.node_id
                        ? 'bg-[#141414] text-amber-300 shadow-2xs'
                        : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                    }`}
                  >
                    <span>{node.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/10">
                      {node.arc_code}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* SPLIT-VIEW INTERACTIVE EXPLORER */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* RIGHT PANE (7 COLS): المستكشف الشجري التفاعلي العصري (Interactive Tree & Lineage Navigator) */}
              <div className="lg:col-span-7 bg-white rounded-3xl border border-stone-200/90 p-6 shadow-xs space-y-6">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold font-serif text-[#141414]">
                      🧭 المستكشف الشجري التفاعلي (Interactive Lineage Navigator)
                    </h3>
                    <p className="text-[11px] text-stone-500">
                      يعرض عمود الآباء حتى آدم عليه السلام في الأعلى، والعقدة المختارة في المركز، والفروع المنحدرة منها في الأسفل
                    </p>
                  </div>
                </div>

                {/* 1. UPPER ANCESTOR CHAIN UP TO ADAM (AS) */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-stone-500 block">
                    ⬆️ سلسلة الآباء والأجداد المتصلة حتى آدم عليه السلام ({selectedNodeAncestorsChain.length} محطات عليا):
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5 bg-[#FAF8F5] p-3.5 rounded-2xl border border-stone-200/80">
                    {selectedNodeAncestorsChain.length === 0 ? (
                      <span className="text-xs text-emerald-800 font-bold">
                        هذه العقدة هي الجذر الأعلى (آدم عليه السلام)
                      </span>
                    ) : (
                      selectedNodeAncestorsChain.map((anc, idx) => (
                        <React.Fragment key={anc.node_id}>
                          <button
                            type="button"
                            onClick={() => setSelectedAdamNodeId(anc.node_id)}
                            className="px-2.5 py-1 rounded-xl bg-white hover:bg-amber-50 border border-stone-300 text-xs font-bold text-stone-800 flex items-center gap-1.5 cursor-pointer transition-all"
                          >
                            <span>{anc.name}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-100 text-amber-900">
                              {anc.arc_code}
                            </span>
                          </button>
                          {idx < selectedNodeAncestorsChain.length - 1 && (
                            <span className="text-stone-400 text-xs font-bold">
                              ⬅️
                            </span>
                          )}
                        </React.Fragment>
                      ))
                    )}
                  </div>
                </div>

                {/* 2. SELECTED NODE IN CENTER */}
                {selectedAdamNode && (
                  <div className="relative rounded-3xl bg-gradient-to-l from-[#1C1917] via-[#292524] to-[#1C1917] text-white p-6 border-2 border-amber-500/50 shadow-md">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-lg bg-amber-500 text-stone-950 font-mono text-xs font-bold">
                          {selectedAdamNode.arc_code}
                        </span>
                        <span className="px-3 py-1 rounded-lg bg-white/10 text-amber-200 font-mono text-xs">
                          ID: {selectedAdamNode.node_id}
                        </span>
                        <span className="px-3 py-1 rounded-lg bg-white/10 text-stone-200 text-xs font-bold">
                          {selectedAdamNode.representation === 'FAMILY'
                            ? 'أسرة (FAMILY)'
                            : selectedAdamNode.representation === 'TRIBE'
                            ? 'قبيلة (TRIBE)'
                            : selectedAdamNode.representation === 'ALLIANCE'
                            ? 'حلف (ALLIANCE)'
                            : 'فرد (INDIVIDUAL)'}
                        </span>
                      </div>

                      <span className="px-3 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold">
                        الرابط مع الأب:{' '}
                        {selectedAdamNode.relation_nature === 'DIRECT'
                          ? 'بن (اتصال مباشر)'
                          : 'من (انحدار فرعي)'}{' '}
                        {selectedParentNodeObj?.name || '—'}
                      </span>
                    </div>

                    <h4 className="text-xl font-bold font-serif text-amber-300">
                      {selectedAdamNode.name}
                    </h4>

                    {selectedAdamNode.geo_footprint &&
                      selectedAdamNode.geo_footprint.length > 0 && (
                        <p className="text-xs text-stone-300 mt-2">
                          📍 الانتشار الجغرافي:{' '}
                          {selectedAdamNode.geo_footprint.join(' · ')}
                        </p>
                      )}
                  </div>
                )}

                {/* 3. DIRECT CHILDREN / DESCENDANT BRANCHES BELOW */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-700">
                      ⬇️ الفروع والأبناء المنحدرون مباشرة من ({selectedAdamNode?.name}) ({selectedNodeDirectChildren.length}):
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddChildForm((prev) => !prev)}
                      className="px-3 py-1.5 rounded-xl bg-[#B45309] hover:bg-[#92400E] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ إضافة عقدة ابن/فرع جديد تحت هذا السجل</span>
                    </button>
                  </div>

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
                            DIRECT_DESCENDANT — يظهر &quot;من&quot;
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

                  {selectedNodeDirectChildren.length === 0 ? (
                    <div className="p-6 rounded-2xl border border-dashed border-stone-300 text-center text-xs text-stone-500">
                      لا توجد عقد أبناء مسجلة تحت هذه العقدة حالياً. يمكنك إضافة عقدة فرعية جديدة بالزر أعلاه.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedNodeDirectChildren.map((child) => (
                        <button
                          key={child.node_id}
                          type="button"
                          onClick={() => setSelectedAdamNodeId(child.node_id)}
                          className="p-3.5 rounded-2xl border border-stone-200 hover:border-[#B45309] bg-[#FAF8F5] hover:bg-amber-50/50 text-right transition-all cursor-pointer flex items-center justify-between gap-2"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-[#141414]">
                                {child.name}
                              </span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-[#B45309] font-bold">
                                {child.arc_code}
                              </span>
                            </div>
                            <span className="text-[11px] text-stone-500 block mt-0.5">
                              الرابط:{' '}
                              {child.relation_nature === 'DIRECT' ? 'بن' : 'من'}{' '}
                              {selectedAdamNode?.name}
                            </span>
                          </div>
                          <ArrowLeft className="w-4 h-4 text-stone-400" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* LEFT PANE (5 COLS): لوحة بيانات وتكويد السجل المختار (Node Inspector & Coding Editor) */}
              <div className="lg:col-span-5 bg-white rounded-3xl border border-stone-200/90 p-6 shadow-xs space-y-4">
                <div className="border-b border-stone-100 pb-3">
                  <h3 className="text-sm font-bold font-serif text-[#141414]">
                    ⚙️ لوحة بيانات وتكويد السجل المختار (Node Coding Editor)
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    تعديل فوري لمعرف السجل، الكود الهيكلي (Arc Code)، التصنيف، وطبيعة الرابط
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-stone-700 mb-1">
                        معرف السجل (node_id)
                      </label>
                      <input
                        type="text"
                        value={editNodeId}
                        onChange={(e) => setEditNodeId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-[#FAF8F5] text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-stone-700 mb-1">
                        اسم السجل (name)
                      </label>
                      <input
                        type="text"
                        value={editNodeName}
                        onChange={(e) => setEditNodeName(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">
                      الكود الهيكلي (Arc Code)
                    </label>
                    <select
                      value={editArcCode}
                      onChange={(e) => setEditArcCode(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs font-bold"
                    >
                      {ARC_CODE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-stone-700 mb-1">
                        تصنيف العقدة (Representation)
                      </label>
                      <select
                        value={editRepresentation}
                        onChange={(e) =>
                          setEditRepresentation(
                            e.target
                              .value as AdamTreeInteractiveNode['representation']
                          )
                        }
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs font-bold"
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
                        onChange={(e) =>
                          setEditRelationNature(
                            e.target
                              .value as AdamTreeInteractiveNode['relation_nature']
                          )
                        }
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs font-bold"
                      >
                        <option value="DIRECT">DIRECT — يظهر &quot;بن&quot;</option>
                        <option value="DIRECT_DESCENDANT">
                          DIRECT_DESCENDANT — يظهر &quot;من&quot;
                        </option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">
                      الموطن والانتشار الجغرافي (geo_footprint)
                    </label>
                    <input
                      type="text"
                      value={editGeoFootprint}
                      onChange={(e) => setEditGeoFootprint(e.target.value)}
                      placeholder="السعودية، العراق، اليمن..."
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">
                      الفروع المرتبطة بالسجل (enriched_branches)
                    </label>
                    <input
                      type="text"
                      value={editEnrichedBranches}
                      onChange={(e) => setEditEnrichedBranches(e.target.value)}
                      placeholder="فروع العائلة أو البطون المنحدرة..."
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">
                      المصادر الموثقة المرتبطة بالسجل (enriched_sources)
                    </label>
                    <textarea
                      rows={3}
                      value={editEnrichedSources}
                      onChange={(e) => setEditEnrichedSources(e.target.value)}
                      placeholder="كل مصدر في سطر مستقل..."
                      className="w-full p-3 rounded-xl border border-stone-300 bg-white text-xs"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveAdamNodeCoding}
                    className="w-full py-3 px-4 rounded-2xl bg-[#141414] hover:bg-stone-800 text-amber-300 text-xs font-bold flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all"
                  >
                    <Save className="w-4 h-4" />
                    <span>💾 حفظ التعديلات وتحديث شجرة آدم</span>
                  </button>
                </div>
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
                      اختر نقطة الالتقاء العليا في شجرة آدم:
                    </label>
                    <select
                      value={selectedAdamTargetChain}
                      onChange={(e) =>
                        setSelectedAdamTargetChain(e.target.value)
                      }
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs font-bold"
                    >
                      <option value="بني لام ⬅️ طيء ⬅️ كهلان ⬅️ سبأ ⬅️ قحطان ⬅️ آدم">
                        بني لام ⬅️ طيء ⬅️ كهلان ⬅️ سبأ ⬅️ قحطان ⬅️ آدم
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
