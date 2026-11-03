import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Cpu,
  Database,
  Download,
  FileText,
  GitBranch,
  GitMerge,
  GripVertical,
  Layers,
  Link2,
  MapPin,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import { JuthoriLogo } from './JuthoriLogo';
import {
  AccountLegalType,
  CorroboratingAlphaEvidence,
  LineageSearchResult,
  UpperAncestorNode,
} from '../types/juthori';
import {
  ORIGIN_REGION_SUGGESTIONS,
  formatAlphaEvidenceCitation,
  inferNodeRepresentation,
  resolveDeterministicLineage,
  resolveSpineConnectorLabel,
  searchJuthoriLineage,
} from '../utils/lineageEngine';
import {
  HeritageNodeAvatar,
  getHistoricalEraBadgeLabel,
  resolveNodeHistoricalEra,
} from './HeritageNodeAvatar';
import {
  fetchAllResearchTicketsForStaff,
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
  queue: 'P1' | 'P2';
  ticketCategory?: 'ADAM_NODE_ENRICHMENT' | 'ALPHA_TO_ADAM_LINK' | 'P1_CUSTOMER_SEARCH';
  adamNodeId?: string;
  fullAdamSpineCount?: number;
  fullAdamSpineStations?: string[];
  title: string;
  clientName: string;
  familyName: string;
  subRootName: string;
  motherTribeName: string;
  locationLabel: string;
  status:
    | 'open'
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
  'المهجر',
];

const DIRECT_SEARCH_QUICK_CASES = [
  {
    id: 'case-adam-40-muqit',
    badge: 'أولوية 1 (شجرة آدم + إثراء ألفا) · 40 عقدة · ID: 272887',
    label: 'آل مقيت ⬅️ عايض ⬅️ آل برمان ⬅️ بني بشر ⬅️ قحطان ⬅️ آدم (#ENR-ADAM-272887)',
    firstName: 'حسن',
    familyName: 'آل مقيت',
    tribeName: 'بني بشر',
    branchName: 'آل برمان',
    originCountry: 'السعودية',
    originLocality: 'سراة عبيدة',
  },
  {
    id: 'case-adam-47-qasim-najran',
    badge: 'أولوية 1 (شجرة آدم + إثراء ألفا) · 47 عقدة · ID: 249230',
    label: 'آل قاسم (نجران) ⬅️ آل مليح ⬅️ القطعان ⬅️ يام ⬅️ همدان ⬅️ آدم (#ENR-ADAM-249230)',
    firstName: 'سلطان',
    familyName: 'آل قاسم',
    tribeName: 'يام',
    branchName: 'القطعان',
    originCountry: 'السعودية',
    originLocality: 'نجران',
  },
  {
    id: 'case-adam-43-khabour',
    badge: 'أولوية 1 (شجرة آدم + إثراء ألفا) · 43 عقدة · ID: 232718',
    label: 'الخابور ⬅️ السميحان ⬅️ الدبجان ⬅️ ملاك ⬅️ عبده ⬅️ عنزة ⬅️ آدم (#ENR-ADAM-232718)',
    firstName: 'فهد',
    familyName: 'الخابور',
    tribeName: 'عنزة',
    branchName: 'السميحان',
    originCountry: 'السعودية',
    originLocality: 'نجد',
  },
  {
    id: 'case-adam-36-qasim-mawdahi',
    badge: 'أولوية 1 (شجرة آدم + إثراء ألفا) · 36 عقدة · ID: 189691',
    label: 'آل قاسم (المودحي) ⬅️ آل سلمان ⬅️ آل امداثر ⬅️ المودحي ⬅️ آدم (#ENR-ADAM-189691)',
    firstName: 'عبدالله',
    familyName: 'آل قاسم',
    tribeName: 'المودحي',
    branchName: 'آل امداثر',
    originCountry: 'السعودية',
    originLocality: 'الحواضر العربية',
  },
  {
    id: 'case-alpha-3-muait',
    badge: 'أولوية 2 (كتاب الدولة) · 5 مصادر مجمعة',
    label: 'الابو معيط ⬅️ قبيلة خابور ⬅️ قبيلة العقيدات (دير الزور ⬅️ سوريا)',
    firstName: 'كريم',
    familyName: 'الابو معيط',
    tribeName: 'العقيدات',
    branchName: 'خابور',
    originCountry: 'سوريا',
    originLocality: 'دير الزور',
  },
  {
    id: 'case-alpha-habahbeh-shobak',
    badge: 'أولوية 2 (كتاب الدولة) · 7 مصادر مجمعة',
    label: 'الهباهبة ⬅️ النعيمات / الدعجة (الشوبك ⬅️ الأردن)',
    firstName: 'أحمد',
    familyName: 'الهباهبة',
    tribeName: '',
    branchName: '',
    originCountry: 'الأردن',
    originLocality: 'الشوبك',
  },
  {
    id: 'case-alpha-5-awdah',
    badge: 'أولوية 2 (كتاب الدولة) · 5 عُقد',
    label: 'آل محجم (الأوضاح) ⬅️ آل تومان ⬅️ الثابت ⬅️ سنجارة ⬅️ شمر الطائية',
    firstName: 'بندر',
    familyName: 'آل محجم',
    tribeName: 'قبيلة شمر الطائية',
    branchName: 'الأوضاح — آل تومان',
    originCountry: 'السعودية',
    originLocality: 'حائل',
  },
  {
    id: 'case-alpha-4-ayda',
    badge: 'أولوية 2 (كتاب الدولة) · 4 عُقد',
    label: 'المشادقة (الأيدا) ⬅️ ولد علي / الوهب ⬅️ مسلم ⬅️ قبيلة عنزة',
    firstName: 'نايف',
    familyName: 'المشادقة',
    tribeName: 'قبيلة عنزة',
    branchName: 'قبيلة الأيدا',
    originCountry: 'السعودية',
    originLocality: 'تيماء',
  },
];

export const ResearcherStudio: React.FC<ResearcherStudioProps> = ({
  currentFamilyName,
  currentClientResult,
  isAlphaAlreadyMerged,
  onApproveAlphaMergeIntoAdam,
  onBackToClientDashboard,
  onSwitchToClientPreview,
}) => {
  const activeAlphaFamily =
    currentFamilyName.includes('معيط') ||
    currentFamilyName.includes('حليحل') ||
    currentFamilyName.includes('عمرو') ||
    currentFamilyName.includes('جرص') ||
    currentFamilyName.includes('جار الله')
      ? currentFamilyName
      : 'الابو معيط';

  // Track closed #ENR-ADAM-{node_id} tickets so they are not regenerated after closure
  const [closedEnrichedTicketIds, setClosedEnrichedTicketIds] = useState<string[]>(
    () =>
      currentClientResult?.isAdamNodeEnrichedWithAlpha &&
      currentClientResult?.adamNodeId
        ? [`#ENR-ADAM-${currentClientResult.adamNodeId}`]
        : []
  );

  // =========================================================================
  // RESEARCHER DIRECT SEARCH TOOL STATE (أداة الفحص والبحث المباشر للباحث)
  // =========================================================================
  const [directSearchFirstName, setDirectSearchFirstName] = useState('حسن');
  const [directSearchFamilyName, setDirectSearchFamilyName] = useState(
    currentFamilyName || 'آل مقيت'
  );
  const [directSearchTribeName, setDirectSearchTribeName] = useState(
    currentFamilyName?.includes('معيط') ? 'العقيدات' : 'بني بشر'
  );
  const [directSearchBranchName, setDirectSearchBranchName] = useState(
    currentFamilyName?.includes('معيط') ? 'خابور' : 'آل برمان'
  );
  const [directSearchCountry, setDirectSearchCountry] = useState(
    currentFamilyName?.includes('معيط') ? 'سوريا' : 'السعودية'
  );
  const [directSearchLocality, setDirectSearchLocality] = useState(
    currentFamilyName?.includes('معيط') ? 'دير الزور' : 'سراة عبيدة'
  );
  const [showAllNodesInInspector, setShowAllNodesInInspector] = useState(true);

  const runDirectInspectionSearch = (params?: {
    firstName?: string;
    familyName?: string;
    tribeName?: string;
    branchName?: string;
    originCountry?: string;
    originLocality?: string;
  }): LineageSearchResult => {
    const fName = params?.firstName ?? directSearchFirstName;
    const fam = params?.familyName ?? directSearchFamilyName;
    const trb = params?.tribeName ?? directSearchTribeName;
    const brn = params?.branchName ?? directSearchBranchName;
    const cnt = params?.originCountry ?? directSearchCountry;
    const loc = params?.originLocality ?? directSearchLocality;

    return resolveDeterministicLineage({
      firstName: fName || 'باحث',
      fatherName: '—',
      grandfatherName: '—',
      familyName: fam || 'آل مقيت',
      originCountry: cnt,
      originRegion: loc,
      tribeName: trb,
      branchName: brn,
    });
  };

  const [directSearchResult, setDirectSearchResult] =
    useState<LineageSearchResult>(() => runDirectInspectionSearch());

  const triggerLiveEngineInspection = (params: {
    firstName: string;
    familyName: string;
    tribeName: string;
    branchName: string;
    originCountry: string;
    originLocality: string;
  }) => {
    searchJuthoriLineage({
      accountType: AccountLegalType.Individual,
      firstName: params.firstName || 'باحث',
      fatherName: '—',
      grandfatherName: '—',
      familyName: params.familyName || 'آل مقيت',
      originCountry: params.originCountry,
      originRegion: params.originLocality,
      tribeName: params.tribeName,
      branchName: params.branchName,
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
    const res = runDirectInspectionSearch();
    setDirectSearchResult(res);
    triggerLiveEngineInspection({
      firstName: directSearchFirstName,
      familyName: directSearchFamilyName,
      tribeName: directSearchTribeName,
      branchName: directSearchBranchName,
      originCountry: directSearchCountry,
      originLocality: directSearchLocality,
    });
  };

  const handleSelectQuickCase = (
    quickCase: (typeof DIRECT_SEARCH_QUICK_CASES)[number]
  ) => {
    setDirectSearchFirstName(quickCase.firstName);
    setDirectSearchFamilyName(quickCase.familyName);
    setDirectSearchTribeName(quickCase.tribeName);
    setDirectSearchBranchName(quickCase.branchName);
    setDirectSearchCountry(quickCase.originCountry);
    setDirectSearchLocality(quickCase.originLocality);

    const res = runDirectInspectionSearch({
      firstName: quickCase.firstName,
      familyName: quickCase.familyName,
      tribeName: quickCase.tribeName,
      branchName: quickCase.branchName,
      originCountry: quickCase.originCountry,
      originLocality: quickCase.originLocality,
    });
    setDirectSearchResult(res);
    triggerLiveEngineInspection({
      firstName: quickCase.firstName,
      familyName: quickCase.familyName,
      tribeName: quickCase.tribeName,
      branchName: quickCase.branchName,
      originCountry: quickCase.originCountry,
      originLocality: quickCase.originLocality,
    });
  };

  const [activeQueueTab, setActiveQueueTab] = useState<'P2' | 'P1'>('P1');

  // Zero Mock Data: Initialize empty and load real tickets from Firebase research_tickets
  const [tickets, setTickets] = useState<ResearcherStudioTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string>('');

  useEffect(() => {
    let active = true;
    fetchAllResearchTicketsForStaff()
      .then((fbTickets) => {
        if (!active) return;
        const mapped: ResearcherStudioTicket[] = fbTickets.map((t) => ({
          id: t.id.startsWith('#') ? t.id : `#P1-${t.id.slice(0, 6)}`,
          queue: t.ticketCategory === 'P1_CUSTOMER_SEARCH' || !t.ticketCategory ? 'P1' : 'P2',
          ticketCategory: t.ticketCategory || 'P1_CUSTOMER_SEARCH',
          adamNodeId: t.adamNodeId,
          title: `تذكرة بحث عميل (${t.userFullName}) — عائلة (${t.targetAncestor})`,
          clientName: t.userFullName,
          familyName: t.targetAncestor,
          subRootName: t.familyBranch || 'فرع قيد التحقيق',
          motherTribeName: t.tribeName || 'قبيلة قيد التحقيق',
          locationLabel: t.originCountry || 'غير محدد',
          status:
            t.status === 'completed' || t.status === 'CLOSED_AND_ENRICHED'
              ? 'merged_closed'
              : 'open',
          createdAt: t.createdAt || t.openedAt
            ? new Date(t.createdAt || t.openedAt).toLocaleDateString('ar-SA')
            : 'مسجلة في Firebase',
          copilotSources: [
            {
              project: 'تذكرة عميل مسجلة في Firebase',
              bookCitation: t.additionalNotes || 'طلب فحص أرشيفي مباشر من العميل',
              extractedSnippet: `«طلب بحث مقدم من العميل (${t.userFullName} - ${t.userEmail}) حول (${t.targetAncestor}) في (${t.originCountry}).»`,
            },
          ],
          suggestedAdamTarget: {
            confidencePercent: 90,
            entryNodeName: t.tribeName || t.targetAncestor,
            fullChainPreview: `${t.targetAncestor} ⬅️ ${t.familyBranch || '...'} ⬅️ ${t.tribeName || '...'} ⬅️ آدم عليه السلام`,
            rationale:
              t.additionalNotes ||
              'تذكرة مسجلة فعلياً من العميل في قاعدة بيانات Firebase.',
          },
          extractedNodes: [
            {
              id: `fb-fe0-${t.id}`,
              name: t.targetAncestor,
              nodeCode: 'FE0',
              relationType: 'aan',
              region: t.originCountry || 'غير محدد',
            },
            ...(t.familyBranch
              ? [
                  {
                    id: `fb-b2-${t.id}`,
                    name: t.familyBranch,
                    nodeCode: 'B2' as const,
                    relationType: 'aan' as const,
                    region: t.originCountry || 'غير محدد',
                  },
                ]
              : []),
            ...(t.tribeName
              ? [
                  {
                    id: `fb-b0-${t.id}`,
                    name: t.tribeName,
                    nodeCode: 'B0' as const,
                    relationType: 'aan' as const,
                    region: t.originCountry || 'غير محدد',
                  },
                ]
              : []),
          ],
        }));
        setTickets(mapped);
        if (mapped.length > 0) {
          setSelectedTicketId(mapped[0].id);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const fallbackWorkbenchTicket: ResearcherStudioTicket = {
    id: directSearchResult.adamNodeId
      ? `#ENR-ADAM-${directSearchResult.adamNodeId}`
      : `#SRCH-${directSearchResult.familyName || 'نشط'}`,
    queue: 'P2',
    ticketCategory:
      directSearchResult.primary_source_of_truth === 'ADAM_MASTER_TREE'
        ? 'ADAM_NODE_ENRICHMENT'
        : 'ALPHA_TO_ADAM_LINK',
    adamNodeId: directSearchResult.adamNodeId,
    fullAdamSpineCount: directSearchResult.adamSpineNodes?.length || 0,
    fullAdamSpineStations: directSearchResult.adamSpineNodes
      ?.filter((n) => n.isCodedStation)
      .map((n) => n.name),
    title: `معاينة مساحة عمل الفحص المباشر — عائلة (${directSearchResult.familyName})`,
    clientName: directSearchResult.clientName,
    familyName: directSearchResult.familyName,
    subRootName: directSearchResult.rootBranchName,
    motherTribeName: directSearchResult.rootTribeName,
    locationLabel: `${directSearchResult.originRegion || ''} — ${directSearchResult.originCountry}`,
    status: 'open',
    createdAt: 'معاينة فورية من أداة الفحص المباشر',
    corroboratingEvidence:
      directSearchResult.corroborating_alpha_evidence_for_researcher || [],
    copilotSources: [
      {
        project: 'مخرجات محرك البحث المباشر (Port 8090)',
        bookCitation: directSearchResult.verifiedSourceCitation,
        extractedSnippet: `«نتيجة الفحص المباشر لعائلة (${directSearchResult.familyName}) متصلة بـ (${directSearchResult.rootBranchName}) من (${directSearchResult.rootTribeName}).»`,
      },
    ],
    suggestedAdamTarget: {
      confidencePercent: 98,
      entryNodeName: directSearchResult.rootTribeName || directSearchResult.familyName,
      fullChainPreview:
        (directSearchResult.adamSpineNodes || [])
          .slice(0, 8)
          .map((n) => n.name)
          .join(' ⬅️ ') || directSearchResult.familyName,
      rationale:
        'معاينة مباشرة من أداة الفحص الهيكلي للباحث — اضغط على «تحويل نتيجة الفحص لمساحة السحب والإفلات» لإدراجها كتذكرة رسمية.',
    },
    extractedNodes: [
      {
        id: 'wb-fe0',
        name: directSearchResult.familyName,
        nodeCode: 'FE0',
        relationType: 'aan',
        region: directSearchResult.originRegion || directSearchResult.originCountry,
      },
      {
        id: 'wb-b2',
        name: directSearchResult.rootBranchName,
        nodeCode: 'B2',
        relationType: 'aan',
        region: directSearchResult.originRegion || directSearchResult.originCountry,
      },
      {
        id: 'wb-b0',
        name: directSearchResult.rootTribeName,
        nodeCode: 'B0',
        relationType: 'aan',
        region: directSearchResult.originRegion || directSearchResult.originCountry,
      },
    ],
  };

  const selectedTicket =
    tickets.find((t) => t.id === selectedTicketId) ||
    tickets[0] ||
    fallbackWorkbenchTicket;

  const isSelectedTicketAdamEnrichment =
    selectedTicket.ticketCategory === 'ADAM_NODE_ENRICHMENT' ||
    selectedTicket.id.startsWith('#ENR-ADAM-');

  // Drag & Drop state between Right Pane and Left Pane
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [isDragOverAdamTree, setIsDragOverAdamTree] = useState(false);
  const [droppedInAdamTree, setDroppedInAdamTree] = useState<boolean>(
    isAlphaAlreadyMerged
  );
  const [approveSourcesChecked, setApproveSourcesChecked] = useState(true);
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([
    'ALP_SA_MUQIT_1',
    'ALP_SA_MUQIT_2',
    'ALP_SA_MUQIT_3',
    'ALP_SA_MUQIT_4',
    'ALP_QASIM_NAJRAN_1',
    'ALP_QASIM_NAJRAN_2',
    'ALP_QASIM_NAJRAN_3',
    'ALP_KHABOUR_ANAZZAH_490',
    'ALP_KHABOUR_ANAZZAH_215',
    'ALP_KHABOUR_ANAZZAH_294',
    'ALP_QASIM_MAWDAHI_1',
    'ALP_QASIM_MAWDAHI_2',
    'alpha_sham_224_khabour',
    'alpha_sham_233_khabour',
    'alpha_agri_27_khabour',
    'alpha_bedouin_381_khabour',
    'alpha_kahhala_324_khabour',
    'alpha_jordan_peake_habahbeh',
    'alpha_kahhala_1203_habahbeh',
    'alpha_qamous_542_habahbeh',
  ]);
  const [mergeSuccessNotice, setMergeSuccessNotice] = useState<string | null>(
    isAlphaAlreadyMerged
      ? `تم دمج عمود (${activeAlphaFamily} ⬅️ قبيلة خابور ⬅️ قبيلة العقيدات) في شجرة آدم بنجاح!`
      : null
  );

  const handleToggleEvidenceRow = (recordId: string) => {
    setSelectedEvidenceIds((prev) =>
      prev.includes(recordId)
        ? prev.filter((id) => id !== recordId)
        : [...prev, recordId]
    );
  };

  const handleAdoptAndDragEvidenceSource = (ev: CorroboratingAlphaEvidence) => {
    if (!selectedEvidenceIds.includes(ev.alpha_id)) {
      setSelectedEvidenceIds((prev) => [...prev, ev.alpha_id]);
    }

    if (isSelectedTicketAdamEnrichment) {
      setDroppedInAdamTree(true);
      setApproveSourcesChecked(true);
      return;
    }

    const parsedAncestors = (ev.lineage_ancestors || '')
      .split(/[؛،,-]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const chainNames = Array.from(
      new Set([
        selectedTicket.familyName,
        ev.record_name,
        ...parsedAncestors,
      ])
    ).filter(Boolean);

    const regionStr = ev.locations || selectedTicket.locationLabel;

    const newExtractedNodes: ExtractableLineageNode[] = chainNames.map(
      (name, idx) => ({
        id: `ev-${ev.alpha_id}-${idx}`,
        name,
        nodeCode:
          idx === 0 ? 'FE0' : idx === chainNames.length - 1 ? 'B0' : 'B2',
        relationType: 'aan',
        region: regionStr,
      })
    );

    setTickets((prev) =>
      prev.map((t) => {
        if (t.id !== selectedTicket.id) return t;
        return {
          ...t,
          subRootName: chainNames[1] || t.subRootName,
          motherTribeName:
            chainNames[chainNames.length - 1] || t.motherTribeName,
          extractedNodes:
            newExtractedNodes.length > 0 ? newExtractedNodes : t.extractedNodes,
          status: t.status === 'open' ? 'dropped_ready' : t.status,
        };
      })
    );

    setDroppedInAdamTree(true);
    setApproveSourcesChecked(true);
  };

  // Transfer Direct Search Result to Drag & Drop Workbench (or open #ENR-ADAM-{node_id} if Priority 1 Adam match)
  const handleTransferSearchResultToDragAndDrop = () => {
    const spine = directSearchResult.adamSpineNodes || [];
    const corroboratingList =
      directSearchResult.corroborating_alpha_evidence_for_researcher || [];
    const isAdamMasterMatch =
      directSearchResult.primary_source_of_truth === 'ADAM_MASTER_TREE' ||
      !directSearchResult.isAlphaOnlyBeforeMerge;

    const resolvedNodeId =
      directSearchResult.adamNodeId ||
      (directSearchResult.familyCode?.startsWith('FE0-')
        ? directSearchResult.familyCode.replace('FE0-', '')
        : '272887');

    const customTicketId = isAdamMasterMatch
      ? `#ENR-ADAM-${resolvedNodeId}`
      : `#SRCH-${directSearchResult.familyName.replace(/\s+/g, '-')}`;

    // If this #ENR-ADAM-{node_id} ticket was already closed and enriched, just select it and scroll to it without re-opening it!
    if (isAdamMasterMatch && closedEnrichedTicketIds.includes(customTicketId)) {
      setActiveQueueTab('P2');
      setSelectedTicketId(customTicketId);
      const el = document.getElementById('researcher-drag-drop-workbench');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }

    const extractedFromSearch: ExtractableLineageNode[] =
      spine.length <= 5
        ? spine.map((n, i) => ({
            id: `srch-ext-${n.id}-${i}`,
            name: n.name,
            nodeCode:
              i === 0 ? 'FE0' : i === spine.length - 1 ? 'B0' : 'B2',
            relationType:
              resolveSpineConnectorLabel(n, spine[i + 1], false) ===
              'بن (سليل مباشر)'
                ? 'bin'
                : 'aan',
            region:
              n.region ||
              directSearchResult.originRegion ||
              directSearchResult.originCountry,
          }))
        : [
            {
              id: `srch-fe0-${Date.now()}`,
              name: directSearchResult.familyName,
              nodeCode: 'FE0',
              relationType: 'aan',
              region:
                directSearchResult.originRegion ||
                directSearchResult.originCountry,
            },
            {
              id: `srch-b2-${Date.now()}`,
              name: directSearchResult.rootBranchName,
              nodeCode: 'B2',
              relationType: 'aan',
              region:
                directSearchResult.originRegion ||
                directSearchResult.originCountry,
            },
            {
              id: `srch-b0-${Date.now()}`,
              name: directSearchResult.rootTribeName,
              nodeCode: 'B0',
              relationType: 'aan',
              region:
                directSearchResult.originRegion ||
                directSearchResult.originCountry,
            },
          ];

    const newTicket: ResearcherStudioTicket = {
      id: customTicketId,
      queue: 'P2',
      ticketCategory: isAdamMasterMatch
        ? 'ADAM_NODE_ENRICHMENT'
        : 'ALPHA_TO_ADAM_LINK',
      adamNodeId: isAdamMasterMatch ? resolvedNodeId : undefined,
      fullAdamSpineCount: isAdamMasterMatch ? spine.length : undefined,
      fullAdamSpineStations: isAdamMasterMatch
        ? spine.filter((n) => n.isCodedStation).map((n) => n.name)
        : undefined,
      title: isAdamMasterMatch
        ? `تذكرة إثراء وتأكيد مصادر (${customTicketId}) — عقدة (${directSearchResult.familyName}) في شجرة آدم`
        : `ربط نتيجة الفحص المباشر: (${directSearchResult.familyName} ⬅️ ${directSearchResult.rootBranchName} ⬅️ ${directSearchResult.rootTribeName})`,
      clientName: `${directSearchResult.clientName} ${directSearchResult.familyName}`,
      familyName: directSearchResult.familyName,
      subRootName: directSearchResult.rootBranchName,
      motherTribeName: directSearchResult.rootTribeName,
      locationLabel: `${directSearchResult.originRegion || ''} — ${directSearchResult.originCountry}`,
      inferredCountries: directSearchResult.inferred_client_countries,
      corroboratingEvidence: corroboratingList,
      status: 'open',
      createdAt: isAdamMasterMatch
        ? `الآن · استمرار البحث المتوازي في مشاريع ألفا (${corroboratingList.length} شواهد مرصودة)`
        : `الآن · من أداة الفحص المباشر (${corroboratingList.length || 1} مصادر مرصودة)`,
      copilotSources: [
        {
          project: isAdamMasterMatch
            ? 'استمرارية البحث المتوازي في مشاريع ألفا لإثراء شجرة آدم (الأولوية 1)'
            : 'بحيرة مشاريع ألفا (تجميع متعدد المصادر)',
          bookCitation: directSearchResult.verifiedSourceCitation,
          extractedSnippet: isAdamMasterMatch
            ? `«عقدة (${directSearchResult.familyName} — ID: ${resolvedNodeId}) متصلة فعلياً في شجرة آدم بعدد (${spine.length} عقدة)؛ استمر المحرك في فحص مشاريع ألفا واستخرج (${corroboratingList.length}) مصادر موازية لإثراء العقدة.»`
            : `«سجل محقق لعائلة (${directSearchResult.familyName}) يتصل بـ (${directSearchResult.rootBranchName}) من (${directSearchResult.rootTribeName}) بعدد عُقد فعلي (${spine.length} عقدة) وعدد مصادر مرصودة (${corroboratingList.length || 1}).»`,
        },
      ],
      suggestedAdamTarget: {
        confidencePercent: isAdamMasterMatch ? 100 : 97,
        entryNodeName: isAdamMasterMatch
          ? `عقدة (${directSearchResult.familyName} — ID: ${resolvedNodeId}) متصلة فعلياً في شجرة آدم (${spine.length} عقدة)`
          : 'عمرو بن معدي كرب الزبيدي (مذحج — قحطان)',
        fullChainPreview:
          spine.length > 0
            ? spine
                .slice(0, 8)
                .map((n) => n.name)
                .join(' ⬅️ ') +
              (spine.length > 8 ? ' ⬅️ ... ⬅️ آدم عليه السلام' : '')
            : `${directSearchResult.familyName} ⬅️ ${directSearchResult.rootBranchName} ⬅️ ${directSearchResult.rootTribeName}`,
        rationale: isAdamMasterMatch
          ? 'تطابق الأولوية 1 في شجرة آدم مع استمرار البحث المتوازي في مشاريع ألفا (كتب الدولة ثم الكتب العامة) لاستخراج المصادر الإضافية والفروع الشقيقة والأعلام والمواضع.'
          : 'تم استخراج العُقد والمصادر المتعددة المجمعة من أداة الفحص المباشر للباحث وفق منهجية الأولويات الأربع.',
      },
      extractedNodes: extractedFromSearch,
    };

    if (corroboratingList.length > 0) {
      setSelectedEvidenceIds((prev) =>
        Array.from(
          new Set([...prev, ...corroboratingList.map((c) => c.alpha_id)])
        )
      );
    }

    setTickets((prev) => {
      const exists = prev.some((t) => t.id === customTicketId);
      if (exists) {
        return prev.map((t) =>
          t.id === customTicketId
            ? t.status === 'CLOSED_AND_ENRICHED'
              ? t
              : newTicket
            : t
        );
      }
      return [newTicket, ...prev];
    });
    setActiveQueueTab('P2');
    setSelectedTicketId(customTicketId);
    setDroppedInAdamTree(false);

    const el = document.getElementById('researcher-drag-drop-workbench');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Adam Prime Deep Project Bridge State
  const [exportedAdamPrimeTasks, setExportedAdamPrimeTasks] = useState<
    {
      taskId: string;
      ticketId: string;
      familyName: string;
      dispatchedAt: string;
      status: string;
    }[]
  >([]);

  const [adamPrimeBundles, setAdamPrimeBundles] = useState<
    AdamPrimeCompletedBundle[]
  >([
    {
      taskId: 'AP-PRJ-2026-771',
      title: 'حزمة تحقيق آدم برايم المكتملة: وصل (قبيلة العقيدات — خابور) بعمود زبيد ومذحج',
      familyName: activeAlphaFamily,
      subRootName: 'قبيلة خابور',
      motherTribeName: 'قبيلة العقيدات',
      locationLabel: 'دير الزور — وادي الفرات',
      targetAdamChain:
        'عمرو بن معدي كرب الزبيدي ⬅️ زبيد ⬅️ سعد العشيرة ⬅️ مذحج ⬅️ قحطان ⬅️ آدم عليه السلام',
      verifiedCitation:
        'تقرير Adam Prime الاستدلالي #771 + عشائر الشام ج2 ص224 + معجم قبائل العرب ج1 ص324',
      nodes: [
        {
          id: 'ap-1',
          name: activeAlphaFamily,
          nodeCode: 'FE0',
          relationType: 'aan',
          region: 'دير الزور — وادي الفرات',
        },
        {
          id: 'ap-2',
          name: 'قبيلة خابور',
          nodeCode: 'B2',
          relationType: 'aan',
          region: 'دير الزور — وادي الفرات',
        },
        {
          id: 'ap-3',
          name: 'قبيلة العقيدات',
          nodeCode: 'B0',
          relationType: 'aan',
          region: 'دير الزور — وادي الفرات',
        },
      ],
      imported: false,
    },
    {
      taskId: 'AP-PRJ-2026-819',
      title: 'حزمة تحقيق آدم برايم المكتملة: تحقيق عمود عائلة (آل سنجر) وإسناده الوثائقي',
      familyName: 'آل سنجر',
      subRootName: 'فرع سنجر الموثق',
      motherTribeName: 'قبيلة كنانة',
      locationLabel: 'حواضر المشرق والحجاز',
      targetAdamChain:
        'كنانة ⬅️ خزيمة ⬅️ مدركة ⬅️ إلياس ⬅️ مضر ⬅️ معد ⬅️ عدنان ⬅️ آدم عليه السلام',
      verifiedCitation: 'حزمة مخطوطات Adam Prime #819 — السجلات والوقفيات الكنانية ص 64',
      nodes: [
        {
          id: 'ap-snj-1',
          name: 'آل سنجر',
          nodeCode: 'FE0',
          relationType: 'aan',
          region: 'حواضر المشرق',
        },
        {
          id: 'ap-snj-2',
          name: 'فرع سنجر الموثق',
          nodeCode: 'B2',
          relationType: 'aan',
          region: 'حواضر المشرق',
        },
        {
          id: 'ap-snj-3',
          name: 'قبيلة كنانة',
          nodeCode: 'B0',
          relationType: 'aan',
          region: 'الحجاز',
        },
      ],
      imported: false,
    },
  ]);

  const filteredTickets = tickets.filter((t) => t.queue === activeQueueTab);

  // Handlers for updating node code (FE0 / B2 / B0) or relation (bin / aan)
  const handleUpdateExtractedNode = (
    nodeId: string,
    field: 'nodeCode' | 'relationType',
    value: string
  ) => {
    setTickets((prev) =>
      prev.map((t) => {
        if (t.id !== selectedTicket.id) return t;
        return {
          ...t,
          extractedNodes: t.extractedNodes.map((n) =>
            n.id === nodeId ? { ...n, [field]: value } : n
          ),
        };
      })
    );
  };

  // Drag & Drop onto Master Adam Tree Drop Target
  const handleDropIntoAdamTree = (e?: React.DragEvent) => {
    if (e) {
      e.preventDefault();
      const rawTransfer = e.dataTransfer?.getData('text/plain') || '';
      if (rawTransfer.startsWith('evidence:')) {
        const recordId = rawTransfer.replace('evidence:', '');
        const matchedEv = selectedTicket.corroboratingEvidence?.find(
          (ev) => ev.alpha_id === recordId
        );
        if (matchedEv) {
          handleAdoptAndDragEvidenceSource(matchedEv);
          setIsDragOverAdamTree(false);
          setDraggedNodeId(null);
          return;
        }
      }
    }
    setIsDragOverAdamTree(false);
    setDraggedNodeId(null);
    setDroppedInAdamTree(true);
    setTickets((prev) =>
      prev.map((t) =>
        t.id === selectedTicket.id && t.status === 'open'
          ? { ...t, status: 'dropped_ready' }
          : t
      )
    );
  };

  // Helper to extract selected Alpha sources, branches, notables, and locations from the active ticket
  const getSelectedEnrichmentPayloadFromTicket = (
    ticket: ResearcherStudioTicket
  ) => {
    const chosenEvs = (ticket.corroboratingEvidence || []).filter((ev) =>
      selectedEvidenceIds.includes(ev.alpha_id)
    );
    const activeEvs =
      chosenEvs.length > 0 ? chosenEvs : ticket.corroboratingEvidence || [];

    const addedVerifiedSources: string[] = [];
    const addedSiblingBranches: string[] = [];
    const addedNotables: string[] = [];
    const addedLocations: string[] = [];

    activeEvs.forEach((ev) => {
      addedVerifiedSources.push(formatAlphaEvidenceCitation(ev));
      if (ev.child_branches) {
        ev.child_branches
          .split(/[|،؛,]/)
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((b) => addedSiblingBranches.push(b));
      }
      if (ev.notables) {
        ev.notables
          .split(/[|،؛,]/)
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((n) => addedNotables.push(n));
      }
      if (ev.locations) {
        ev.locations
          .split(/[|،؛,]/)
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((l) => addedLocations.push(l));
      }
    });

    return {
      addedVerifiedSources: Array.from(new Set(addedVerifiedSources)),
      addedSiblingBranches: Array.from(new Set(addedSiblingBranches)),
      addedNotables: Array.from(new Set(addedNotables)),
      addedLocations: Array.from(new Set(addedLocations)),
    };
  };

  // Decisive Action for #ENR-ADAM-{node_id}: "اعتماد إثراء شجرة آدم بالمصادر الإضافية وإقفال التذكرة ✓"
  // Or Primary Action for #ALP-ADAM-...: "اعتماد الربط وتغذية شجرة آدم فوراً ✓"
  const handleCommitMergeToAdamTree = () => {
    setDroppedInAdamTree(true);
    const enrichmentData = getSelectedEnrichmentPayloadFromTicket(selectedTicket);

    // Call German Neo4j Engine (Port 8090) via server proxy to close/enrich the ticket
    fetch('/api/juthori/researcher/close-enrichment-ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticket_id: selectedTicket.id,
        adam_node_id: selectedTicket.adamNodeId,
        family_name: selectedTicket.familyName,
        sub_root_name: selectedTicket.subRootName,
        mother_tribe_name: selectedTicket.motherTribeName,
        added_verified_sources: enrichmentData.addedVerifiedSources,
        added_sibling_branches: enrichmentData.addedSiblingBranches,
        added_notables: enrichmentData.addedNotables,
        added_locations: enrichmentData.addedLocations,
      }),
    }).catch(() => {});

    // Also update ticket status in Firebase if it is a Firebase ticket
    const rawFbId = selectedTicket.id.replace(/^#(P1-|P2-)/, '');
    updateTicketStatus(rawFbId, 'CLOSED_AND_ENRICHED').catch(() => {});

    if (isSelectedTicketAdamEnrichment) {
      setClosedEnrichedTicketIds((prev) =>
        Array.from(new Set([...prev, selectedTicket.id]))
      );
      setTickets((prev) =>
        prev.map((t) =>
          t.id === selectedTicket.id
            ? { ...t, status: 'CLOSED_AND_ENRICHED' }
            : t
        )
      );
      onApproveAlphaMergeIntoAdam({
        familyName: selectedTicket.familyName,
        subRootName: selectedTicket.subRootName,
        motherTribeName: selectedTicket.motherTribeName,
        approveSources: true,
        isAdamEnrichmentOnly: true,
        ...enrichmentData,
      });
      setMergeSuccessNotice(
        `تم اعتماد إثراء عقدة (${selectedTicket.familyName} — ID: ${selectedTicket.adamNodeId || 'ADAM'}) في شجرة آدم بـ (${enrichmentData.addedVerifiedSources.length}) مصادر إضافية من مشاريع ألفا وإقفال التذكرة ${selectedTicket.id} بحالة: مكتملة ومُقفلة (تم إثراء شجرة آدم) ✓`
      );
      return;
    }

    setTickets((prev) =>
      prev.map((t) =>
        t.id === selectedTicket.id ? { ...t, status: 'merged_closed' } : t
      )
    );
    onApproveAlphaMergeIntoAdam({
      familyName: selectedTicket.familyName,
      subRootName: selectedTicket.subRootName,
      motherTribeName: selectedTicket.motherTribeName,
      approveSources: approveSourcesChecked,
      isAdamEnrichmentOnly: false,
      ...enrichmentData,
    });
    setMergeSuccessNotice(
      `تم اعتماد الربط رسمياً وتغذية شجرة آدم بعمود (${selectedTicket.familyName} ⬅️ ${selectedTicket.subRootName} ⬅️ ${selectedTicket.motherTribeName} ⬅️ زبيد ⬅️ مذحج ⬅️ قحطان ⬅️ آدم عليه السلام) وإغلاق التذكرة ${selectedTicket.id}!`
    );
  };

  // Export current ticket as standalone deep research task to Adam Prime
  const handleExportTicketToAdamPrime = () => {
    const newTaskId = `AP-TASK-2026-${Math.floor(900 + Math.random() * 90)}`;
    setExportedAdamPrimeTasks((prev) => [
      {
        taskId: newTaskId,
        ticketId: selectedTicket.id,
        familyName: selectedTicket.familyName,
        dispatchedAt: 'الآن · مرسل إلى Adam Prime',
        status: 'قيد المعالجة الاستدلالية في Adam Prime',
      },
      ...prev,
    ]);
    setTickets((prev) =>
      prev.map((t) =>
        t.id === selectedTicket.id
          ? { ...t, status: 'exported_adam_prime' }
          : t
      )
    );
  };

  // Drag/Import completed bundle from Adam Prime into Master Adam Tree
  const handleImportAdamPrimeBundle = (bundle: AdamPrimeCompletedBundle) => {
    setAdamPrimeBundles((prev) =>
      prev.map((b) =>
        b.taskId === bundle.taskId ? { ...b, imported: true } : b
      )
    );
    setDroppedInAdamTree(true);
    onApproveAlphaMergeIntoAdam({
      familyName: bundle.familyName,
      subRootName: bundle.subRootName,
      motherTribeName: bundle.motherTribeName,
      approveSources: true,
    });
    setMergeSuccessNotice(
      `تم استلام وسحب حزمة Adam Prime (${bundle.taskId}) وتغذية شجرة آدم فوراً لعائلة (${bundle.familyName}) حتى آدم عليه السلام!`
    );
  };

  const inspectedNodes: UpperAncestorNode[] =
    directSearchResult.adamSpineNodes || [];
  const displayedInspectedNodes = showAllNodesInInspector
    ? inspectedNodes
    : inspectedNodes.slice(0, 12);

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#F7F2E9] text-[#252321] flex flex-col justify-between"
    >
      {/* Top Researcher Workbench Header */}
      <header className="sticky top-0 z-40 bg-[#252321] text-[#F7F2E9] border-b border-[#D8755B]/40 shadow-md">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <JuthoriLogo size="sm" onClick={onBackToClientDashboard} />
            <div className="h-8 w-px bg-white/15 hidden sm:block" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-display font-extrabold text-white">
                  لوحة تحكم الباحثين (Researcher Studio)
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#D8755B] text-white text-[11px] font-bold">
                  أداة الفحص المباشر + تغذية شجرة آدم
                </span>
              </div>
              <p className="text-[11px] text-[#F7F2E9]/70 hidden sm:block">
                الفحص الهيكلي الفوري بالأرقام والأكواد + السحب والإفلات (Drag & Drop) لوصل سجلات مشاريع ألفا وتذاكر العملاء بشجرة آدم
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() =>
                onSwitchToClientPreview(
                  directSearchResult.familyName || activeAlphaFamily
                )
              }
              className="px-3.5 py-2 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-display font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                معاينة عمود العميل ({directSearchResult.familyName || activeAlphaFamily})
              </span>
            </button>

            <button
              type="button"
              onClick={onBackToClientDashboard}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-display font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-white/15"
            >
              <span>العودة لواجهة العميل</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
        {/* Live Merge Confirmation Alert Banner */}
        {mergeSuccessNotice && (
          <div className="rounded-3xl bg-gradient-to-r from-[#1E3A2F] via-[#25473A] to-[#1E3A2F] text-white p-5 border-2 border-[#D8755B] shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[#D8755B] text-white flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="text-xs font-display font-bold text-[#D8755B]">
                  ✓ تم التحديث الحي لشجرة آدم في حالة التطبيق (Live State Sync)
                </div>
                <p className="text-xs sm:text-sm font-semibold text-white leading-relaxed">
                  {mergeSuccessNotice}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onSwitchToClientPreview(selectedTicket.familyName)}
              className="px-5 py-2.5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs sm:text-sm font-display font-extrabold whitespace-nowrap cursor-pointer shrink-0 shadow-sm"
            >
              انتقل لشاشة العميل لرؤية العمود كاملاً حتى آدم ←
            </button>
          </div>
        )}

        {/* ===================================================================== */}
        {/* SECTION 0: RESEARCHER DIRECT SEARCH TOOL (أداة الفحص والبحث المباشر للباحث) */}
        {/* ===================================================================== */}
        <section
          aria-label="أداة الفحص والبحث المباشر للباحث"
          className="rounded-3xl bg-white border-2 border-[#252321] p-5 sm:p-6 shadow-md space-y-5"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#B98A78]/30 pb-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#252321] text-[#F7F2E9] text-xs font-display font-extrabold">
                <Search className="w-3.5 h-3.5 text-[#D8755B]" />
                <span>🔍 أداة الفحص والبحث المباشر للباحث (منهجية الأولويات الـ 4 وتجميع المصادر)</span>
              </div>
              <h2 className="text-lg sm:text-xl font-display font-extrabold text-[#252321]">
                فحص هيكلي فوري لأي عائلة أو قبيلة أو إقليم (متصل بمحرك السيرفر Port 8090)
              </h2>
              <p className="text-xs text-[#252321]/75">
                تعرض هذه الأداة حصرياً للباحث أولوية المطابقة (<code className="font-mono font-bold">الأولوية 1..4</code>)، واستنتاج الدولة من الموطن (<code className="font-mono font-bold">inferred_client_countries</code>)، وتجميع المصادر المتعددة (<code className="font-mono font-bold">corroborating_alpha_evidence_for_researcher</code>).
              </p>
            </div>

            <button
              type="button"
              onClick={handleTransferSearchResultToDragAndDrop}
              className="px-4 py-2.5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-display font-extrabold inline-flex items-center gap-2 transition-colors cursor-pointer shrink-0 shadow-xs"
            >
              <GitMerge className="w-4 h-4" />
              <span>
                نقل نتيجة ({directSearchResult.familyName}) إلى طاولة السحب والإفلات لربطها بشجرة آدم ↓
              </span>
            </button>
          </div>

          {/* Quick Test Presets for Researcher */}
          <div className="space-y-2">
            <div className="text-xs font-display font-bold text-[#8D4925]">
              نماذج فحص فوري للسلاسل الحقيقية المعزولة وتجميع المصادر المتعددة (انقر للفحص اللحظي):
            </div>
            <div className="flex flex-wrap gap-2">
              {DIRECT_SEARCH_QUICK_CASES.map((qCase) => {
                const isCurrentCase =
                  directSearchFamilyName === qCase.familyName &&
                  directSearchBranchName === qCase.branchName &&
                  directSearchLocality === qCase.originLocality;
                return (
                  <button
                    key={qCase.id}
                    type="button"
                    onClick={() => handleSelectQuickCase(qCase)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-display font-bold border transition-all cursor-pointer inline-flex items-center gap-2 ${
                      isCurrentCase
                        ? 'bg-[#252321] text-white border-[#252321] shadow-xs'
                        : 'bg-[#FAF6F0] text-[#252321] border-[#B98A78]/50 hover:border-[#D8755B]'
                    }`}
                  >
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                        isCurrentCase
                          ? 'bg-[#D8755B] text-white'
                          : 'bg-[#EDE6DA] text-[#8D4925]'
                      }`}
                    >
                      {qCase.badge}
                    </span>
                    <span>{qCase.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Direct Search Input Form */}
          <form
            onSubmit={handleExecuteDirectSearch}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 bg-[#FAF6F0] p-4 rounded-2xl border border-[#B98A78]/45"
          >
            <div>
              <label className="block text-[11px] font-bold text-[#252321]/75 mb-1">
                الاسم الأول
              </label>
              <input
                type="text"
                value={directSearchFirstName}
                onChange={(e) => setDirectSearchFirstName(e.target.value)}
                placeholder="مثال: كريم"
                className="w-full px-3 py-2 rounded-xl bg-white border border-[#B98A78]/50 text-xs font-semibold text-[#252321]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#252321]/75 mb-1">
                اسم العائلة *
              </label>
              <input
                type="text"
                value={directSearchFamilyName}
                onChange={(e) => setDirectSearchFamilyName(e.target.value)}
                placeholder="مثال: الابو معيط / الهباهبة / آل مقيت"
                className="w-full px-3 py-2 rounded-xl bg-white border border-[#B98A78]/50 text-xs font-bold text-[#252321]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#252321]/75 mb-1">
                الفرع / الفخذ
              </label>
              <input
                type="text"
                value={directSearchBranchName}
                onChange={(e) => setDirectSearchBranchName(e.target.value)}
                placeholder="مثال: خابور / السميحان / آل برمان"
                className="w-full px-3 py-2 rounded-xl bg-white border border-[#B98A78]/50 text-xs font-semibold text-[#252321]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#252321]/75 mb-1">
                القبيلة الأم
              </label>
              <input
                type="text"
                value={directSearchTribeName}
                onChange={(e) => setDirectSearchTribeName(e.target.value)}
                placeholder="مثال: العقيدات / عنزة / بني بشر"
                className="w-full px-3 py-2 rounded-xl bg-white border border-[#B98A78]/50 text-xs font-semibold text-[#252321]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#252321]/75 mb-1">
                الدولة (اختياري)
              </label>
              <select
                value={directSearchCountry}
                onChange={(e) => setDirectSearchCountry(e.target.value)}
                className="w-full px-2.5 py-2 rounded-xl bg-white border border-[#B98A78]/50 text-xs font-semibold text-[#252321]"
              >
                <option value="غير محدد / كل الدول">غير محدد / كل الدول</option>
                {RESEARCHER_ARAB_COUNTRIES.map((c: string) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#252321]/75 mb-1">
                الإقليم / المدينة (مثل دير الزور أو الشوبك)
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  list="researcher-locality-suggestions"
                  value={directSearchLocality}
                  onChange={(e) => setDirectSearchLocality(e.target.value)}
                  placeholder="دير الزور / الشوبك / نجران"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#B98A78]/50 text-xs font-semibold text-[#252321]"
                />
                <datalist id="researcher-locality-suggestions">
                  {ORIGIN_REGION_SUGGESTIONS.map((loc: string) => (
                    <option key={loc} value={loc} />
                  ))}
                </datalist>
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-xl bg-[#252321] hover:bg-[#D8755B] text-white text-xs font-display font-extrabold shrink-0 cursor-pointer transition-colors"
                >
                  فحص
                </button>
              </div>
            </div>
          </form>

          {/* Instant Structural Inspection Output */}
          <div className="rounded-2xl bg-[#FAF6F0] border border-[#B98A78]/50 p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#B98A78]/30">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="px-3 py-1 rounded-lg bg-[#252321] text-white text-xs font-mono font-bold">
                  عدد العُقد الفعلي: {inspectedNodes.length} عقدة
                </span>
                <span
                  className={`px-3 py-1 rounded-lg text-xs font-display font-extrabold ${
                    directSearchResult.isAlphaOnlyBeforeMerge
                      ? 'bg-[#D8755B]/15 text-[#D8755B] border border-[#D8755B]/40'
                      : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                  }`}
                >
                  {directSearchResult.priorityTierMatched === 'TIER_1_ADAM_MASTER_TREE'
                    ? 'الأولوية 1: شجرة آدم (ADAM_MASTER_TREE)'
                    : directSearchResult.priorityTierMatched === 'TIER_2_PRIORITY_1_COUNTRY_BOOK'
                    ? 'الأولوية 2: مشاريع ألفا المخصصة لدولة/موطن العميل (PRIORITY_1_COUNTRY_BOOK)'
                    : directSearchResult.priorityTierMatched === 'TIER_3_PRIORITY_2_GENERAL_BOOK'
                    ? 'الأولوية 3: مشاريع ألفا العامة (PRIORITY_2_GENERAL_BOOK)'
                    : directSearchResult.isAlphaOnlyBeforeMerge
                    ? 'مشاريع ألفا (MULTI_SOURCE_AGGREGATED)'
                    : 'شجرة آدم الموثقة (ADAM_MASTER_TREE)'}
                </span>
                {directSearchResult.inferred_client_countries &&
                  directSearchResult.inferred_client_countries.length > 0 && (
                    <span className="text-xs font-bold text-[#8D4925] bg-white px-2.5 py-1 rounded-lg border border-[#8D4925]/35 inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[#D8755B]" />
                      <span>
                        استنتاج الدولة من الموطن:{' '}
                        {directSearchResult.inferred_client_countries.join(' ، ')}
                      </span>
                    </span>
                  )}
                {directSearchResult.corroborating_alpha_evidence_for_researcher &&
                  directSearchResult.corroborating_alpha_evidence_for_researcher
                    .length > 0 && (
                    <span className="text-xs font-bold text-[#252321] bg-[#EDE6DA] px-2.5 py-1 rounded-lg border border-[#B98A78]/50">
                      📚 المصادر المجمعة:{' '}
                      {
                        directSearchResult
                          .corroborating_alpha_evidence_for_researcher.length
                      }{' '}
                      مصادر
                    </span>
                  )}
              </div>

              <div className="flex items-center gap-2">
                {inspectedNodes.length > 12 && (
                  <button
                    type="button"
                    onClick={() => setShowAllNodesInInspector((v) => !v)}
                    className="px-3 py-1.5 rounded-lg bg-white border border-[#B98A78]/45 text-xs font-bold text-[#8D4925] cursor-pointer"
                  >
                    {showAllNodesInInspector
                      ? 'عرض أول 12 طبقة فقط'
                      : `عرض كافة الطبقات (${inspectedNodes.length})`}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    onSwitchToClientPreview(directSearchResult.familyName)
                  }
                  className="px-3 py-1.5 rounded-lg bg-[#252321] text-white text-xs font-bold cursor-pointer hover:bg-[#D8755B] transition-colors"
                >
                  معاينة في شاشة العميل ←
                </button>
              </div>
            </div>

            {/* Exclusive Researcher Structural Nodes Grid (#01..#N + Structural Code + node_id + Data Lake Source) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[420px] overflow-y-auto pr-1">
              {displayedInspectedNodes.map((node) => {
                const layerNum = String(node.orderNumber).padStart(2, '0');
                const structuralCode =
                  node.code ||
                  (node.isCodedStation ? `ST-${layerNum}` : `RNG-${layerNum}`);
                const lakeLabel =
                  node.dataLakeSource === 'alpha_projects' ||
                  directSearchResult.isAlphaOnlyBeforeMerge
                    ? 'مشاريع ألفا'
                    : 'شجرة آدم';
                const era = resolveNodeHistoricalEra(node);
                const parentNode =
                  inspectedNodes.find(
                    (n) => n.orderNumber === node.orderNumber + 1
                  ) || null;
                const nodeRep = inferNodeRepresentation(node);
                const connectorToParent = parentNode
                  ? resolveSpineConnectorLabel(node, parentNode, false)
                  : null;

                return (
                  <div
                    key={node.id}
                    className="rounded-2xl bg-white border border-[#B98A78]/45 p-3 flex items-center justify-between gap-2.5 shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <HeritageNodeAvatar node={node} size="sm" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-[#252321] text-white font-mono text-[11px] font-bold">
                            #{layerNum}
                          </span>
                          <span className="text-xs sm:text-sm font-display font-extrabold text-[#252321] truncate">
                            {node.name}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px]">
                          <span className="font-mono font-bold text-[#D8755B] bg-[#D8755B]/10 px-1.5 py-0.5 rounded">
                            كود: {structuralCode}
                          </span>
                          <span className="font-mono text-[#252321]/70 bg-[#F7F2E9] px-1.5 py-0.5 rounded">
                            {nodeRep}
                          </span>
                          {connectorToParent && (
                            <span
                              className={`font-bold px-1.5 py-0.5 rounded ${
                                connectorToParent === 'بن (سليل مباشر)'
                                  ? 'bg-[#EDE6DA] text-[#8D4925]'
                                  : 'bg-[#FFF8F0] text-[#D8755B]'
                              }`}
                            >
                              {connectorToParent}
                            </span>
                          )}
                          <span className="text-[#8D4925] font-semibold">
                            {getHistoricalEraBadgeLabel(era)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-1 rounded-lg shrink-0 ${
                        lakeLabel === 'مشاريع ألفا'
                          ? 'bg-[#FFF8F0] text-[#D8755B] border border-[#D8755B]/35'
                          : 'bg-[#EDE6DA] text-[#8D4925]'
                      }`}
                    >
                      <Database className="w-3 h-3 inline ml-1" />
                      {lakeLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ===================================================================== */}
        {/* SECTION 1: DUAL-QUEUE TICKET INBOX (صندوق التذاكر المزدوج حسب الأولوية) */}
        {/* ===================================================================== */}
        <section className="rounded-3xl bg-white border border-[#B98A78]/45 p-5 sm:p-6 shadow-sm space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#B98A78]/25 pb-4">
            <div>
              <span className="text-xs font-display font-bold text-[#D8755B]">
                1. صندوق التذاكر المزدوج حسب الأولوية (Dual-Queue Ticket Inbox)
              </span>
              <h2 className="text-lg sm:text-xl font-display font-extrabold text-[#252321]">
                طابور تذاكر العملاء المباشرة (P1) وتذاكر إثراء ودمج شجرة آدم من مشاريع ألفا (P2)
              </h2>
            </div>

            {/* Priority Queue Switcher Tabs */}
            <div className="inline-flex rounded-2xl bg-[#F7F2E9] p-1.5 border border-[#B98A78]/40 self-start">
              <button
                type="button"
                onClick={() => {
                  setActiveQueueTab('P2');
                  setSelectedTicketId('#ENR-ADAM-272887');
                }}
                className={`px-4 py-2 rounded-xl text-xs font-display font-extrabold transition-all cursor-pointer ${
                  activeQueueTab === 'P2'
                    ? 'bg-[#D8755B] text-white shadow-xs'
                    : 'text-[#252321]/75 hover:text-[#252321]'
                }`}
              >
                أولوية تطوير P2 — إثراء ودمج شجرة آدم من ألفا ({tickets.filter((t) => t.queue === 'P2').length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveQueueTab('P1');
                  setSelectedTicketId('#P1-CUST-8901');
                }}
                className={`px-4 py-2 rounded-xl text-xs font-display font-extrabold transition-all cursor-pointer ${
                  activeQueueTab === 'P1'
                    ? 'bg-[#252321] text-white shadow-xs'
                    : 'text-[#252321]/75 hover:text-[#252321]'
                }`}
              >
                أولوية قصوى P1 — تذاكر بحث العملاء المباشرة ({tickets.filter((t) => t.queue === 'P1').length})
              </button>
            </div>
          </div>

          {filteredTickets.length === 0 ? (
            <div className="rounded-2xl bg-[#FAF6F0] border border-dashed border-[#B98A78]/60 p-8 text-center space-y-2">
              <div className="text-base font-display font-extrabold text-[#252321]">
                لا توجد سجلات حالياً
              </div>
              <p className="text-xs text-[#252321]/70 max-w-xl mx-auto">
                لا توجد تذاكر مسجلة حالياً في هذا الطابور داخل قاعدة بيانات Firebase. يمكنك استخدام «أداة الفحص والبحث المباشر للباحث» بالأعلى لتحويل أي سجل إلى تذكرة عمل نشطة.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTickets.map((ticket) => {
                const isSelected = ticket.id === selectedTicket.id;
                const isTicketEnrAdam =
                  ticket.ticketCategory === 'ADAM_NODE_ENRICHMENT' ||
                  ticket.id.startsWith('#ENR-ADAM-');
                return (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => {
                      setSelectedTicketId(ticket.id);
                      setDroppedInAdamTree(
                        ticket.status === 'merged_closed' ||
                          ticket.status === 'CLOSED_AND_ENRICHED' ||
                          isTicketEnrAdam
                      );
                    }}
                    className={`rounded-2xl p-4 sm:p-5 text-right border-2 transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                      isSelected
                        ? 'bg-[#FAF6F0] border-[#D8755B] shadow-md ring-2 ring-[#D8755B]/20'
                        : 'bg-[#F7F2E9]/55 border-[#B98A78]/35 hover:border-[#B98A78]'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="px-2.5 py-0.5 rounded-lg bg-[#252321] text-white font-mono text-xs font-bold">
                          {ticket.id}
                        </span>
                        <span
                          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                            ticket.status === 'CLOSED_AND_ENRICHED' ||
                            ticket.status === 'merged_closed'
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : ticket.status === 'exported_adam_prime'
                              ? 'bg-purple-100 text-purple-900 border border-purple-300'
                              : 'bg-[#D8755B]/15 text-[#D8755B]'
                          }`}
                        >
                          {ticket.status === 'CLOSED_AND_ENRICHED'
                            ? 'مكتملة ومُقفلة (تم إثراء شجرة آدم) ✓'
                            : ticket.status === 'merged_closed'
                            ? '✓ تم الدمج في شجرة آدم ومغلقة'
                            : ticket.status === 'exported_adam_prime'
                            ? '↗ مرسلة لنظام Adam Prime'
                            : ticket.status === 'dropped_ready'
                            ? 'جاهزة لاعتماد التغذية'
                            : isTicketEnrAdam
                            ? 'بانتظار اعتماد الإثراء المتوازي من ألفا'
                            : 'قيد المعالجة والربط'}
                        </span>
                      </div>

                      <h3 className="text-sm sm:text-base font-display font-extrabold text-[#252321] leading-snug">
                        {ticket.title}
                      </h3>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#252321]/70">
                        <span>العميل: {ticket.clientName}</span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-[#D8755B]" />
                          {ticket.locationLabel}
                        </span>
                        {ticket.corroboratingEvidence &&
                          ticket.corroboratingEvidence.length > 0 && (
                            <span className="px-2 py-0.5 rounded bg-[#EDE6DA] text-[#8D4925] text-[10px] font-bold">
                              📚 {ticket.corroboratingEvidence.length} مصادر ألفا موازية
                            </span>
                          )}
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-[#B98A78]/25 flex items-center justify-between text-[11px] text-[#8D4925] font-bold">
                      <span>{ticket.createdAt}</span>
                      <span>
                        {isSelected ? 'التذكرة النشطة في مساحة العمل ✓' : 'فتح في مساحة العمل ←'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ===================================================================== */}
        {/* SECTION 2: AUTOMATED RESEARCHER COPILOT & MULTI-SOURCE EVIDENCE TABLE */}
        {/* ===================================================================== */}
        <section className="rounded-3xl bg-white border border-[#B98A78]/45 p-5 sm:p-6 shadow-sm space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#B98A78]/25 pb-4">
            <div>
              <span className="text-xs font-display font-bold text-[#D8755B]">
                2. مساعد الباحث الآلي وتجميع السجلات المتعددة (Multi-Source Aggregation & Copilot)
              </span>
              <h2 className="text-lg sm:text-xl font-display font-extrabold text-[#252321]">
                كشاف المواضع والصفحات الآلي + مقترح نقاط الالتقاء الذكي للتذكرة ({selectedTicket.id})
              </h2>
            </div>
            <span className="px-3 py-1 rounded-full bg-[#EDE6DA] text-[#8D4925] text-xs font-display font-bold">
              نسبة ثقة المطابقة الاستدلالية: {selectedTicket.suggestedAdamTarget.confidencePercent}%
            </span>
          </div>

          {/* =================================================================== */}
          {/* DETAILED MULTI-SOURCE EVIDENCE TABLE FOR P2 ENRICHMENT TICKETS      */}
          {/* Reads corroborating_alpha_evidence_for_researcher                   */}
          {/* =================================================================== */}
          {selectedTicket.corroboratingEvidence &&
            selectedTicket.corroboratingEvidence.length > 0 && (
              <div className="rounded-2xl bg-[#FAF6F0] border-2 border-[#8D4925]/45 p-4 sm:p-5 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#B98A78]/35">
                  <div className="space-y-1">
                    <h3 className="text-base sm:text-lg font-display font-extrabold text-[#252321]">
                      📚 السجلات والمصادر المتعددة المرصودة للعائلة ({selectedTicket.corroboratingEvidence.length} مصادر)
                    </h3>
                    <p className="text-xs text-[#252321]/75">
                      يقرأ هذا الجدول حقل{' '}
                      <code className="font-mono font-bold text-[#8D4925]">
                        corroborating_alpha_evidence_for_researcher
                      </code>{' '}
                      ويعرض كافة الكتب والروايات المرصودة في مشاريع ألفا (كتب الدولة أولاً ثم الكتب العامة). يمكنك تحديد أو سحب أي رواية (<strong className="text-[#D8755B]">Drag & Drop</strong>) لإثراء عقدة العائلة في شجرة آدم.
                    </p>
                  </div>
                  <span className="px-3 py-1.5 rounded-xl bg-[#252321] text-white text-xs font-mono font-bold shrink-0">
                    تم تحديد {selectedTicket.corroboratingEvidence.filter((e) => selectedEvidenceIds.includes(e.alpha_id)).length} من {selectedTicket.corroboratingEvidence.length} مصادر للإثراء
                  </span>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-[#B98A78]/45 bg-white">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-[#252321] text-[#F7F2E9] text-xs font-display font-bold">
                        <th className="p-3 border-b border-white/10 whitespace-nowrap">
                          اختيار / سحب الرواية
                        </th>
                        <th className="p-3 border-b border-white/10">
                          اسم الكتاب والمرجع + الجزء والصفحة + درجة الأولوية
                        </th>
                        <th className="p-3 border-b border-white/10">
                          نسب الأجداد المذكور في هذا المصدر (lineage_ancestors)
                        </th>
                        <th className="p-3 border-b border-white/10">
                          الفروع والأعلام المذكورين (child_branches & notables)
                        </th>
                        <th className="p-3 border-b border-white/10">
                          المواضع الجغرافية المذكورة (locations)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#B98A78]/25 text-xs">
                      {selectedTicket.corroboratingEvidence.map((ev) => {
                        const isChecked = selectedEvidenceIds.includes(
                          ev.alpha_id
                        );
                        const isCountryPriority =
                          ev.priority_tier === 'PRIORITY_1_COUNTRY_BOOK';
                        const volPageLabel =
                          ev.volume && ev.page
                            ? `ج${ev.volume} — ص ${ev.page}`
                            : ev.page
                            ? `ص ${ev.page}`
                            : ev.volume
                            ? `ج${ev.volume}`
                            : 'مفهرس بالكامل';

                        const ancestorsArr = (ev.lineage_ancestors || '')
                          .split(/[؛،,-]+/)
                          .map((s) => s.trim())
                          .filter(Boolean);
                        const branchesArr = (ev.child_branches || '')
                          .split(/[؛،,-]+/)
                          .map((s) => s.trim())
                          .filter(Boolean);
                        const notablesArr = (ev.notables || '')
                          .split(/[؛،,-]+/)
                          .map((s) => s.trim())
                          .filter(Boolean);
                        const locationsArr = (ev.locations || '')
                          .split(/[؛،,-]+/)
                          .map((s) => s.trim())
                          .filter(Boolean);

                        return (
                          <tr
                            key={ev.alpha_id}
                            draggable
                            onDragStart={(e) => {
                              setDraggedNodeId(ev.alpha_id);
                              e.dataTransfer.setData(
                                'text/plain',
                                `evidence:${ev.alpha_id}`
                              );
                            }}
                            onDragEnd={() => setDraggedNodeId(null)}
                            className={`transition-colors cursor-grab active:cursor-grabbing ${
                              isChecked
                                ? 'bg-[#FFFDF9] hover:bg-[#FAF3E6]'
                                : 'bg-white/60 hover:bg-[#FAF6F0]'
                            }`}
                          >
                            {/* Selection Checkbox + Adopt & Drag Action */}
                            <td className="p-3 align-top whitespace-nowrap">
                              <div className="flex flex-col gap-2">
                                <label className="inline-flex items-center gap-2 cursor-pointer font-bold text-[#252321]">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() =>
                                      handleToggleEvidenceRow(ev.alpha_id)
                                    }
                                    className="w-4 h-4 accent-[#D8755B] rounded cursor-pointer"
                                  />
                                  <span>اعتماد المصدر</span>
                                </label>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleAdoptAndDragEvidenceSource(ev)
                                  }
                                  className="px-2.5 py-1.5 rounded-lg bg-[#D8755B] hover:bg-[#c5644b] text-white text-[11px] font-display font-bold inline-flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                                >
                                  <GripVertical className="w-3.5 h-3.5" />
                                  <span>اعتماد وسحب لشجرة آدم ⬅️</span>
                                </button>
                              </div>
                            </td>

                            {/* Book Name + Volume/Page + Priority Tier */}
                            <td className="p-3 align-top space-y-1.5">
                              <div className="font-display font-extrabold text-[#252321] text-xs sm:text-sm">
                                {ev.source_book}
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded bg-[#FAF6F0] border border-[#B98A78]/40 text-[#8D4925] font-mono font-bold text-[11px]">
                                  {volPageLabel}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-display font-extrabold ${
                                    isCountryPriority
                                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                      : 'bg-[#EDE6DA] text-[#8D4925] border border-[#B98A78]/40'
                                  }`}
                                >
                                  {isCountryPriority
                                    ? 'أولوية كتاب الدولة والموطن'
                                    : 'أولوية كتاب عام'}
                                </span>
                              </div>
                            </td>

                            {/* Lineage Ancestors in this Source */}
                            <td className="p-3 align-top">
                              {ancestorsArr.length > 0 ? (
                                <div className="flex flex-wrap items-center gap-1 font-display font-bold text-[#252321]">
                                  <span className="px-2 py-0.5 rounded bg-[#F7F2E9] border border-[#B98A78]/40">
                                    {ev.record_name}
                                  </span>
                                  {ancestorsArr.map((anc: string, i: number) => (
                                    <React.Fragment key={i}>
                                      <span className="text-[#D8755B]">⬅️</span>
                                      <span className="px-2 py-0.5 rounded bg-[#EDE6DA] text-[#8D4925]">
                                        {anc}
                                      </span>
                                    </React.Fragment>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[#252321]/50">
                                  غير مذكور تفصيلاً
                                </span>
                              )}
                            </td>

                            {/* Child Branches & Notables in this Source */}
                            <td className="p-3 align-top space-y-1.5">
                              {branchesArr.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {branchesArr.map((br: string, i: number) => (
                                    <span
                                      key={i}
                                      className="px-2 py-0.5 rounded-lg bg-[#FAF6F0] border border-[#B98A78]/35 text-[#252321] font-semibold"
                                    >
                                      فرع: {br}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {notablesArr.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {notablesArr.map((nt: string, i: number) => (
                                    <span
                                      key={i}
                                      className="px-2 py-0.5 rounded-lg bg-[#EDE6DA]/80 border border-[#8D4925]/35 text-[#8D4925] font-bold"
                                    >
                                      علم: {nt}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {branchesArr.length === 0 &&
                                notablesArr.length === 0 && (
                                  <span className="text-[#252321]/50">—</span>
                                )}
                            </td>

                            {/* Locations Mentioned in this Source */}
                            <td className="p-3 align-top">
                              {locationsArr.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {locationsArr.map((loc: string, i: number) => (
                                    <span
                                      key={i}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#FFF8F0] border border-[#D8755B]/35 text-[#8D4925] font-bold"
                                    >
                                      <MapPin className="w-3 h-3 text-[#D8755B]" />
                                      <span>{loc}</span>
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[#252321]/50">
                                  —
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Right 7 Cols: Automated Book & Page Locator */}
            <div className="lg:col-span-7 space-y-3">
              <div className="flex items-center gap-2 text-xs font-display font-extrabold text-[#252321]">
                <BookOpen className="w-4 h-4 text-[#D8755B]" />
                <span>كشاف المواضع والصفحات الآلي في المخطوطات ومشاريع ألفا:</span>
              </div>

              <div className="space-y-2.5">
                {selectedTicket.copilotSources.map((src, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl bg-[#FAF6F0] border border-[#B98A78]/40 p-3.5 space-y-1.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-display font-bold text-[#8D4925]">
                        {src.bookCitation}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#EDE6DA] text-[#252321]">
                        {src.project}
                      </span>
                    </div>
                    <p className="text-xs text-[#252321]/85 leading-relaxed font-serif bg-white p-2.5 rounded-xl border border-[#B98A78]/20">
                      {src.extractedSnippet}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Left 5 Cols: Smart Adam Tree Junction Recommender */}
            <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl bg-gradient-to-br from-[#252321] via-[#312D2A] to-[#252321] text-white p-5 border border-[#D8755B]/50 space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-display font-bold text-[#D8755B]">
                    <Cpu className="w-4 h-4" />
                    <span>مقترح نقاط الالتقاء الذكي في شجرة آدم</span>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#D8755B] text-white text-xs font-mono font-bold">
                    ثقة {selectedTicket.suggestedAdamTarget.confidencePercent}%
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-white/10 border border-white/15 space-y-1.5">
                  <div className="text-[11px] text-white/70">
                    {isSelectedTicketAdamEnrichment
                      ? 'عقدة العائلة المتصلة فعلياً في شجرة آدم:'
                      : 'العقدة المرشحة للوصل في شجرة آدم:'}
                  </div>
                  <div className="text-sm sm:text-base font-display font-extrabold text-[#F7F2E9]">
                    {selectedTicket.suggestedAdamTarget.entryNodeName}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-[#D8755B]">
                    مسار العمود الكامل في شجرة آدم حتى آدم عليه السلام:
                  </div>
                  <p className="text-xs text-white/90 leading-relaxed bg-black/25 p-3 rounded-xl border border-white/10 font-serif">
                    {selectedTicket.suggestedAdamTarget.fullChainPreview}
                  </p>
                </div>

                <p className="text-xs text-white/75 leading-relaxed">
                  <strong>القرينة التاريخية والجغرافية:</strong>{' '}
                  {selectedTicket.suggestedAdamTarget.rationale}
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleDropIntoAdamTree()}
                className="w-full py-2.5 px-4 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-display font-extrabold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <GitMerge className="w-4 h-4" />
                <span>
                  {isSelectedTicketAdamEnrichment
                    ? 'معاينة إثراء عقدة شجرة آدم بالمصادر المحددة ↓'
                    : 'تطبيق مقترح الالتقاء الذكي في مساحة السحب والإفلات ↓'}
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* ===================================================================== */}
        {/* SECTION 3: TWO-PANE WORKBENCH (إثراء عقدة شجرة آدم / السحب والإفلات)     */}
        {/* ===================================================================== */}
        <section
          id="researcher-drag-drop-workbench"
          className="rounded-3xl bg-white border-2 border-[#D8755B]/55 p-5 sm:p-6 shadow-md space-y-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#B98A78]/25 pb-4">
            <div>
              <span className="text-xs font-display font-bold text-[#D8755B]">
                {isSelectedTicketAdamEnrichment
                  ? `3. مساحة إثراء وتأكيد مصادر عقدة (${selectedTicket.familyName}) في شجرة آدم (${selectedTicket.id})`
                  : '3. مساحة السحب والإفلات والتكويد لتغذية شجرة آدم (Drag & Drop Graph Linker & Coder)'}
              </span>
              <h2 className="text-lg sm:text-xl font-display font-extrabold text-[#252321]">
                {isSelectedTicketAdamEnrichment
                  ? `حدد أو اسحب المصادر الإضافية والفروع والأعلام والمواضع المكتشفة من مشاريع ألفا (الكفة اليمنى) لإثراء عقدة (${selectedTicket.familyName}) المتصلة في شجرة آدم (الكفة اليسرى)`
                  : `اسحب عُقد (${selectedTicket.familyName} ➔ ${selectedTicket.subRootName} ➔ ${selectedTicket.motherTribeName}) وأفلتها فوق عقدة الالتقاء في شجرة آدم`}
              </h2>
            </div>

            <span className="text-xs font-semibold text-[#8D4925] bg-[#FAF6F0] px-3 py-1.5 rounded-xl border border-[#B98A78]/40">
              يدعم الاختيار المباشر (Checkboxes) أو السحب والإفلات (Drag & Drop)
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* ================================================================= */}
            {/* RIGHT PANE (الكفة اليمنى):                                          */}
            {/* - If #ENR-ADAM-{node_id}: Table of additional Alpha sources,       */}
            {/*   sibling branches, notables, and locations with Checkboxes & D&D  */}
            {/* - Otherwise: Draggable Extracted Nodes with Coding (FE0 / B2 / B0) */}
            {/* ================================================================= */}
            <div className="lg:col-span-6 rounded-2xl bg-[#F7F2E9] border border-[#B98A78]/50 p-4 sm:p-5 flex flex-col justify-between space-y-4">
              {isSelectedTicketAdamEnrichment &&
              selectedTicket.corroboratingEvidence &&
              selectedTicket.corroboratingEvidence.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm sm:text-base font-display font-extrabold text-[#252321] flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-[#D8755B]" />
                      <span>
                        الكفة اليمنى: جدول المصادر الإضافية والفروع والأعلام والمواضع المكتشفة من مشاريع ألفا
                      </span>
                    </h3>
                    <span className="text-[11px] font-bold text-[#8D4925] bg-white px-2.5 py-1 rounded-lg border border-[#B98A78]/40">
                      محدد ({selectedEvidenceIds.length}) من ({selectedTicket.corroboratingEvidence.length}) مصادر
                    </span>
                  </div>

                  <p className="text-xs text-[#252321]/75 leading-relaxed">
                    تم استخراج هذه المصادر بالتوازي من مشاريع ألفا (كتب دولة العميل أولاً ثم الكتب العامة). حدد عبر مربعات الاختيار (<strong>Checkboxes</strong>) أو اسحب البطاقة بالماوس (<strong>Drag & Drop</strong>) نحو الكفة اليسرى لإثراء العقدة:
                  </p>

                  <div className="space-y-3">
                    {selectedTicket.corroboratingEvidence.map((ev) => {
                      const isChecked = selectedEvidenceIds.includes(
                        ev.alpha_id
                      );
                      const isCountryPriority =
                        ev.priority_tier === 'PRIORITY_1_COUNTRY_BOOK';
                      const volPageLabel =
                        ev.volume && ev.page
                          ? `ج${ev.volume} — ص ${ev.page}`
                          : ev.page
                          ? `ص ${ev.page}`
                          : ev.volume
                          ? `ج${ev.volume}`
                          : 'مفهرس';

                      const branchesArr = (ev.child_branches || '')
                        .split(/[؛،,-]+/)
                        .map((s) => s.trim())
                        .filter(Boolean);
                      const notablesArr = (ev.notables || '')
                        .split(/[؛،,-]+/)
                        .map((s) => s.trim())
                        .filter(Boolean);
                      const locationsArr = (ev.locations || '')
                        .split(/[؛،,-]+/)
                        .map((s) => s.trim())
                        .filter(Boolean);

                      return (
                        <div
                          key={ev.alpha_id}
                          draggable
                          onDragStart={(e) => {
                            setDraggedNodeId(ev.alpha_id);
                            e.dataTransfer.setData(
                              'text/plain',
                              `evidence:${ev.alpha_id}`
                            );
                          }}
                          onDragEnd={() => setDraggedNodeId(null)}
                          className={`rounded-2xl bg-white border-2 p-4 shadow-2xs transition-all cursor-grab active:cursor-grabbing space-y-2.5 ${
                            isChecked
                              ? 'border-[#D8755B] ring-2 ring-[#D8755B]/15'
                              : 'border-[#B98A78]/40 opacity-80 hover:border-[#D8755B]'
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <label className="inline-flex items-start gap-2.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() =>
                                  handleToggleEvidenceRow(ev.alpha_id)
                                }
                                className="mt-1 w-4 h-4 accent-[#D8755B] rounded cursor-pointer shrink-0"
                              />
                              <div>
                                <div className="text-xs sm:text-sm font-display font-extrabold text-[#252321]">
                                  {ev.source_book} ({volPageLabel})
                                </div>
                                <div className="text-[11px] text-[#8D4925] font-bold">
                                  السجل في المصدر: {ev.record_name}
                                  {ev.lineage_ancestors
                                    ? ` ⬅️ ${ev.lineage_ancestors}`
                                    : ''}
                                </div>
                              </div>
                            </label>

                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-display font-extrabold shrink-0 ${
                                isCountryPriority
                                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                  : 'bg-[#EDE6DA] text-[#8D4925] border border-[#B98A78]/40'
                              }`}
                            >
                              {isCountryPriority
                                ? 'أولوية 1: كتاب الدولة'
                                : 'أولوية 2: كتاب عام'}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-[#B98A78]/20 text-[11px]">
                            <div className="rounded-xl bg-[#FAF6F0] p-2 border border-[#B98A78]/30">
                              <div className="font-bold text-[#8D4925] mb-1">
                                الفروع الشقيقة:
                              </div>
                              <div className="text-[#252321] font-semibold">
                                {branchesArr.length > 0
                                  ? branchesArr.join(' · ')
                                  : '—'}
                              </div>
                            </div>
                            <div className="rounded-xl bg-[#FAF6F0] p-2 border border-[#B98A78]/30">
                              <div className="font-bold text-[#8D4925] mb-1">
                                الأعلام والرموز:
                              </div>
                              <div className="text-[#252321] font-semibold">
                                {notablesArr.length > 0
                                  ? notablesArr.join(' · ')
                                  : '—'}
                              </div>
                            </div>
                            <div className="rounded-xl bg-[#FAF6F0] p-2 border border-[#B98A78]/30">
                              <div className="font-bold text-[#8D4925] mb-1">
                                المواضع الجغرافية:
                              </div>
                              <div className="text-[#252321] font-semibold">
                                {locationsArr.length > 0
                                  ? locationsArr.join(' · ')
                                  : '—'}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[10px] font-mono text-[#252321]/60">
                              ID: {ev.alpha_id}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                handleAdoptAndDragEvidenceSource(ev)
                              }
                              className="px-2.5 py-1 rounded-lg bg-[#252321] hover:bg-[#3a3734] text-white text-[11px] font-display font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <GripVertical className="w-3 h-3 text-[#D8755B]" />
                              <span>سحب وإلحاق بعقدة شجرة آدم ⬅️</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm sm:text-base font-display font-extrabold text-[#252321] flex items-center gap-2">
                      <Layers className="w-4 h-4 text-[#D8755B]" />
                      <span>الكفة اليمنى: العُقد المستخرجة الجاهزة للسحب والتكويد</span>
                    </h3>
                    <span className="text-[11px] font-bold text-[#8D4925]">
                      اسحب أي عقدة لليسار ⬅️
                    </span>
                  </div>

                  <div className="space-y-3">
                    {selectedTicket.extractedNodes.map((node, index) => (
                      <div
                        key={node.id}
                        draggable
                        onDragStart={(e) => {
                          setDraggedNodeId(node.id);
                          e.dataTransfer.setData('text/plain', node.id);
                        }}
                        onDragEnd={() => setDraggedNodeId(null)}
                        className={`rounded-2xl bg-white border-2 p-4 shadow-2xs transition-all cursor-grab active:cursor-grabbing ${
                          draggedNodeId === node.id
                            ? 'border-[#D8755B] opacity-75 scale-[0.99]'
                            : 'border-[#B98A78]/45 hover:border-[#D8755B]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2.5">
                            <GripVertical className="w-4 h-4 text-[#252321]/40 shrink-0" />
                            <span className="w-7 h-7 rounded-lg bg-[#252321] text-white text-xs font-mono font-bold flex items-center justify-center">
                              #{String(index + 1).padStart(2, '0')}
                            </span>
                            <div>
                              <div className="text-sm sm:text-base font-display font-extrabold text-[#252321]">
                                {node.name}
                              </div>
                              <div className="text-[11px] text-[#252321]/65">
                                {node.region} · <code className="font-mono">id: {node.id}</code>
                              </div>
                            </div>
                          </div>

                          <span className="px-2.5 py-1 rounded-lg bg-[#FAF6F0] border border-[#B98A78]/40 text-xs font-mono font-bold text-[#8D4925]">
                            كود: {node.nodeCode}
                          </span>
                        </div>

                        {/* Node Code & Relationship Selectors */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2.5 border-t border-[#B98A78]/20 text-xs">
                          <div>
                            <label className="block text-[11px] font-bold text-[#252321]/70 mb-1">
                              تصنيف وتكويد العقدة:
                            </label>
                            <select
                              value={node.nodeCode}
                              onChange={(e) =>
                                handleUpdateExtractedNode(
                                  node.id,
                                  'nodeCode',
                                  e.target.value
                                )
                              }
                              className="w-full rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 px-2.5 py-1.5 text-xs font-bold text-[#252321]"
                            >
                              <option value="FE0">FE0 — عقدة عائلة / فرع مباشر</option>
                              <option value="B2">B2 — فرع جامع / جذر فرعي</option>
                              <option value="B0">B0 — قبيلة أم / جذر جامع</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-[#252321]/70 mb-1">
                              نوع العلاقة بالعقدة الأعلى:
                            </label>
                            <select
                              value={node.relationType}
                              onChange={(e) =>
                                handleUpdateExtractedNode(
                                  node.id,
                                  'relationType',
                                  e.target.value
                                )
                              }
                              className="w-full rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 px-2.5 py-1.5 text-xs font-bold text-[#252321]"
                            >
                              <option value="aan">من (سليل غير مباشر) — افتراضي للقبائل والعائلات</option>
                              <option value="bin">بن (سليل مباشر) — للأفراد المتصلين مباشرة فقط</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => handleDropIntoAdamTree()}
                className="w-full py-2.5 px-4 rounded-xl bg-[#252321] hover:bg-[#3a3734] text-white text-xs font-display font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Link2 className="w-4 h-4 text-[#D8755B]" />
                <span>
                  {isSelectedTicketAdamEnrichment
                    ? 'إلحاق المصادر والفروع المحددة بعقدة شجرة آدم في الكفة اليسرى ←'
                    : 'إفلات العُقد وتركيبها فوق نقطة الالتقاء في شجرة آدم ←'}
                </span>
              </button>
            </div>

            {/* ================================================================= */}
            {/* LEFT PANE (الكفة اليسرى):                                           */}
            {/* - Displays the connected family node in Adam's Tree and its full   */}
            {/*   spine, plus the live enrichment preview & decisive button        */}
            {/* ================================================================= */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOverAdamTree(true);
              }}
              onDragLeave={() => setIsDragOverAdamTree(false)}
              onDrop={handleDropIntoAdamTree}
              className={`lg:col-span-6 rounded-2xl border-2 p-4 sm:p-5 flex flex-col justify-between space-y-4 transition-all ${
                isDragOverAdamTree
                  ? 'bg-[#FFF8F0] border-[#D8755B] ring-4 ring-[#D8755B]/25 scale-[1.01]'
                  : droppedInAdamTree || isSelectedTicketAdamEnrichment
                  ? 'bg-[#FAF6F0] border-emerald-600/70'
                  : 'bg-[#FAF6F0] border-dashed border-[#D8755B]/70'
              }`}
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm sm:text-base font-display font-extrabold text-[#252321] flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-[#D8755B]" />
                    <span>
                      {isSelectedTicketAdamEnrichment
                        ? `الكفة اليسرى: عقدة (${selectedTicket.familyName}) المرتبطة فعلياً في شجرة آدم وعمودها الكامل`
                        : 'الكفة اليسرى: شجرة آدم الحية (Master Adam Tree Drop Target)'}
                    </span>
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#252321] text-white text-[11px] font-bold">
                    {selectedTicket.fullAdamSpineCount
                      ? `عمود متصل (${selectedTicket.fullAdamSpineCount} محطة حتى آدم)`
                      : 'منتهى العمود: آدم عليه السلام'}
                  </span>
                </div>

                {/* Connected Family Node + Full Spine in Adam's Tree */}
                <div className="rounded-2xl bg-white border border-[#B98A78]/40 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold text-[#8D4925]">
                    <span>
                      {isSelectedTicketAdamEnrichment
                        ? `عقدة العائلة (#${selectedTicket.adamNodeId || 'ADAM'}) وعمودها الكامل في شجرة آدم:`
                        : 'عمود شجرة آدم الأصلي (الأصول العليا المعتمدة):'}
                    </span>
                    <span className="text-emerald-800">متصل حتى آدم عليه السلام ✓</span>
                  </div>

                  {selectedTicket.fullAdamSpineStations &&
                  selectedTicket.fullAdamSpineStations.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1.5 text-xs font-display font-bold text-[#252321]">
                      {selectedTicket.fullAdamSpineStations.map((st, idx) => (
                        <React.Fragment key={idx}>
                          <span
                            className={`px-2.5 py-1 rounded-lg ${
                              idx === 0
                                ? 'bg-[#D8755B] text-white shadow-2xs'
                                : idx ===
                                  selectedTicket.fullAdamSpineStations!.length -
                                    1
                                ? 'bg-[#252321] text-white'
                                : 'bg-[#EDE6DA] text-[#252321]'
                            }`}
                          >
                            {st}
                          </span>
                          {idx <
                            selectedTicket.fullAdamSpineStations!.length - 1 && (
                            <span className="text-[#D8755B]">⬅️</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5 text-xs font-display font-bold text-[#252321]">
                      <span className="px-2.5 py-1 rounded-lg bg-[#252321] text-white">
                        آدم عليه السلام (AD0)
                      </span>
                      <span>⬅️</span>
                      <span className="px-2.5 py-1 rounded-lg bg-[#EDE6DA]">
                        نوح
                      </span>
                      <span>⬅️</span>
                      <span className="px-2.5 py-1 rounded-lg bg-[#EDE6DA]">
                        سام
                      </span>
                      <span>⬅️</span>
                      <span className="px-2.5 py-1 rounded-lg bg-[#EDE6DA]">
                        قحطان (Q0)
                      </span>
                      <span>⬅️</span>
                      <span className="px-2.5 py-1 rounded-lg bg-[#EDE6DA]">
                        كهلان (K0)
                      </span>
                      <span>⬅️</span>
                      <span className="px-2.5 py-1 rounded-lg bg-[#EDE6DA]">
                        مذحج (M0)
                      </span>
                      <span>⬅️</span>
                      <span className="px-2.5 py-1 rounded-lg bg-[#D8755B]/20 text-[#8D4925] border border-[#D8755B]/40">
                        {selectedTicket.suggestedAdamTarget.entryNodeName}
                      </span>
                    </div>
                  )}
                </div>

                {/* Interactive Drop Zone / Parallel Alpha Enrichment Preview */}
                {isSelectedTicketAdamEnrichment ? (
                  <div className="rounded-2xl p-4 border-2 bg-emerald-50/90 border-emerald-600 text-emerald-950 space-y-3 text-right">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-display font-extrabold text-emerald-900 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                        <span>
                          معاينة حزمة الإثراء المتوازي من مشاريع ألفا لعقدة ({selectedTicket.familyName}):
                        </span>
                      </span>
                      <span className="text-[11px] font-mono font-bold bg-emerald-200/80 text-emerald-950 px-2 py-0.5 rounded">
                        {selectedTicket.status === 'CLOSED_AND_ENRICHED'
                          ? 'مكتملة ومُقفلة ✓'
                          : 'جاهزة للإثراء والاعتماد'}
                      </span>
                    </div>

                    {(() => {
                      const chosenEvs = (
                        selectedTicket.corroboratingEvidence || []
                      ).filter((ev) =>
                        selectedEvidenceIds.includes(ev.alpha_id)
                      );
                      const activeEvs =
                        chosenEvs.length > 0
                          ? chosenEvs
                          : selectedTicket.corroboratingEvidence || [];

                      const previewSources = Array.from(
                        new Set(
                          activeEvs.map((ev) => {
                            const vp =
                              ev.volume && ev.page
                                ? ` (ج${ev.volume} ص${ev.page})`
                                : ev.page
                                ? ` (ص${ev.page})`
                                : '';
                            return `${ev.source_book}${vp}`;
                          })
                        )
                      );
                      const previewBranches = Array.from(
                        new Set(
                          activeEvs.flatMap((ev) =>
                            (ev.child_branches || '')
                              .split(/[؛،,-]+/)
                              .map((s) => s.trim())
                              .filter(Boolean)
                          )
                        )
                      );
                      const previewNotables = Array.from(
                        new Set(
                          activeEvs.flatMap((ev) =>
                            (ev.notables || '')
                              .split(/[؛،,-]+/)
                              .map((s) => s.trim())
                              .filter(Boolean)
                          )
                        )
                      );
                      const previewLocations = Array.from(
                        new Set(
                          activeEvs.flatMap((ev) =>
                            (ev.locations || '')
                              .split(/[؛،,-]+/)
                              .map((s) => s.trim())
                              .filter(Boolean)
                          )
                        )
                      );

                      return (
                        <div className="space-y-2 text-xs">
                          <div className="p-2.5 rounded-xl bg-white border border-emerald-500/40">
                            <span className="font-bold text-emerald-950">
                              📚 المصادر والصفحات المعتمدة للإضافة ({previewSources.length}):
                            </span>{' '}
                            <span className="text-[#252321] font-semibold">
                              {previewSources.join(' · ') || '—'}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div className="p-2 rounded-xl bg-white border border-emerald-500/40">
                              <div className="font-bold text-emerald-950 mb-0.5">
                                🌿 الفروع الشقيقة ({previewBranches.length}):
                              </div>
                              <div className="text-[#252321] font-semibold">
                                {previewBranches.join(' · ') || '—'}
                              </div>
                            </div>
                            <div className="p-2 rounded-xl bg-white border border-emerald-500/40">
                              <div className="font-bold text-emerald-950 mb-0.5">
                                ⭐ الأعلام والرموز ({previewNotables.length}):
                              </div>
                              <div className="text-[#252321] font-semibold">
                                {previewNotables.join(' · ') || '—'}
                              </div>
                            </div>
                            <div className="p-2 rounded-xl bg-white border border-emerald-500/40">
                              <div className="font-bold text-emerald-950 mb-0.5">
                                📍 المواضع الجغرافية ({previewLocations.length}):
                              </div>
                              <div className="text-[#252321] font-semibold">
                                {previewLocations.join(' · ') || '—'}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div
                    className={`rounded-2xl p-4 border-2 transition-all text-center space-y-2 ${
                      droppedInAdamTree
                        ? 'bg-emerald-50/90 border-emerald-600 text-emerald-950'
                        : 'bg-white/90 border-dashed border-[#D8755B] text-[#252321]'
                    }`}
                  >
                    {!droppedInAdamTree ? (
                      <div className="py-4 space-y-2">
                        <UploadCloud className="w-8 h-8 text-[#D8755B] mx-auto animate-bounce" />
                        <div className="text-sm font-display font-extrabold text-[#252321]">
                          منطقة الإفلات والوصل في شجرة آدم (Drop Zone)
                        </div>
                        <p className="text-xs text-[#252321]/70">
                          اسحب عقدة <strong>({selectedTicket.motherTribeName})</strong> من الكفة اليمنى وأفلتها هنا لوصلها بعقدة{' '}
                          <strong>({selectedTicket.suggestedAdamTarget.entryNodeName})</strong>
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 text-right">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-display font-extrabold text-emerald-900 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                            <span>تم تركيب العُقد وربطها بعقدة الالتقاء في شجرة آدم:</span>
                          </span>
                          <span className="text-[11px] font-mono font-bold bg-emerald-200/80 text-emerald-950 px-2 py-0.5 rounded">
                            متصل ✓
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs font-display font-bold">
                          {selectedTicket.extractedNodes.map((n, i) => (
                            <React.Fragment key={n.id}>
                              <span className="px-2.5 py-1 rounded-lg bg-white border border-emerald-500 text-[#252321]">
                                #{String(i + 1).padStart(2, '0')}. {n.name} ({n.nodeCode} · {n.relationType === 'bin' ? 'بن' : 'عن'})
                              </span>
                              <span>⬅️</span>
                            </React.Fragment>
                          ))}
                          <span className="px-2.5 py-1 rounded-lg bg-[#D8755B] text-white">
                            {selectedTicket.suggestedAdamTarget.entryNodeName} ⬅️ آدم عليه السلام
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Approve New Historical Sources Checkbox */}
                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-[#B98A78]/35 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={approveSourcesChecked}
                    onChange={(e) => setApproveSourcesChecked(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[#D8755B] rounded cursor-pointer"
                  />
                  <span className="text-xs text-[#252321]/85 leading-relaxed">
                    <strong>اعتماد وإلحاق المصادر التاريخية والفروع الشقيقة والأعلام والمواضع ببطاقة العميل:</strong>{' '}
                    ستظهر المصادر الإضافية والفروع الشقيقة والأعلام المحددة أعلاه تلقائياً للعميل في قسم «المصادر والمراجع التاريخية» في عمود النسب.
                  </span>
                </label>
              </div>

              {/* Primary Decisive Commit Button */}
              <button
                type="button"
                onClick={handleCommitMergeToAdamTree}
                className={`w-full py-3.5 px-6 rounded-2xl font-display font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer ${
                  selectedTicket.status === 'CLOSED_AND_ENRICHED'
                    ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                    : 'bg-[#D8755B] hover:bg-[#c5644b] text-white'
                }`}
              >
                <ShieldCheck className="w-5 h-5" />
                <span>
                  {isSelectedTicketAdamEnrichment
                    ? selectedTicket.status === 'CLOSED_AND_ENRICHED'
                      ? 'مكتملة ومُقفلة (تم إثراء شجرة آدم) ✓'
                      : 'اعتماد إثراء شجرة آدم بالمصادر الإضافية وإقفال التذكرة ✓'
                    : 'اعتماد الربط وتغذية شجرة آدم فوراً ✓'}
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* ===================================================================== */}
        {/* SECTION 4: ADAM PRIME DEEP PROJECT BRIDGE (جسر الربط مع نظام آدم برايم) */}
        {/* ===================================================================== */}
        <section className="rounded-3xl bg-white border border-[#B98A78]/45 p-5 sm:p-6 shadow-sm space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#B98A78]/25 pb-4">
            <div>
              <span className="text-xs font-display font-bold text-[#D8755B]">
                4. جسر الربط مع نظام «آدم برايم» للطلبات الصعبة (Adam Prime Deep Project Bridge)
              </span>
              <h2 className="text-lg sm:text-xl font-display font-extrabold text-[#252321]">
                تصدير القضايا المعقدة كمشروع بحث مستقل واستلام حزم العُقد والمصادر الجاهزة بالسحب والإفلات
              </h2>
            </div>

            <button
              type="button"
              onClick={handleExportTicketToAdamPrime}
              className="px-4 py-2.5 rounded-xl bg-[#252321] hover:bg-[#3a3734] text-white text-xs font-display font-bold inline-flex items-center gap-2 transition-colors cursor-pointer shrink-0 shadow-xs"
            >
              <Send className="w-3.5 h-3.5 text-[#D8755B]" />
              <span>تصدير التذكرة ({selectedTicket.id}) كمشروع بحث مستقل إلى Adam Prime</span>
            </button>
          </div>

          {/* Dispatched Adam Prime Tasks List */}
          {exportedAdamPrimeTasks.length > 0 && (
            <div className="rounded-2xl bg-[#FAF6F0] border border-[#D8755B]/45 p-4 space-y-2">
              <div className="text-xs font-display font-bold text-[#8D4925]">
                المشاريع المصدّرة حديثاً إلى نظام Adam Prime:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {exportedAdamPrimeTasks.map((task) => (
                  <div
                    key={task.taskId}
                    className="rounded-xl bg-white border border-[#B98A78]/35 p-3 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-mono font-bold text-[#D8755B]">
                        {task.taskId}
                      </span>
                      <span className="mx-2 text-[#252321] font-bold">
                        عائلة {task.familyName} ({task.ticketId})
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                      {task.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Incoming Completed Adam Prime Bundles (Draggable & One-Click Import) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-display font-extrabold text-[#252321] flex items-center gap-2">
                <Download className="w-4 h-4 text-[#D8755B]" />
                <span>واجهة استلام نتائج مشاريع Adam Prime المكتملة (اسحب الحزمة وأفلتها في شجرة آدم):</span>
              </h3>
              <span className="text-xs text-[#252321]/65">
                حزم عُقد ومصادر محققة جاهزة للدمج الفوري
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {adamPrimeBundles.map((bundle) => (
                <div
                  key={bundle.taskId}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', bundle.taskId);
                  }}
                  onDragEnd={() => handleImportAdamPrimeBundle(bundle)}
                  className="rounded-2xl bg-[#F7F2E9] border-2 border-[#B98A78]/45 hover:border-[#D8755B] p-4 space-y-3 transition-all cursor-grab active:cursor-grabbing"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg bg-[#252321] text-white font-mono text-xs font-bold">
                      {bundle.taskId}
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                        bundle.imported
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-[#D8755B]/15 text-[#D8755B]'
                      }`}
                    >
                      {bundle.imported
                        ? '✓ تم سحب الحزمة وتغذية شجرة آدم'
                        : 'حزمة مكتملة من Adam Prime — جاهزة للسحب'}
                    </span>
                  </div>

                  <h4 className="text-sm font-display font-extrabold text-[#252321]">
                    {bundle.title}
                  </h4>

                  <p className="text-xs text-[#252321]/80 bg-white p-2.5 rounded-xl border border-[#B98A78]/25 font-serif">
                    <strong>مسار الوصل المعتمد:</strong> {bundle.familyName} ⬅️{' '}
                    {bundle.subRootName} ⬅️ {bundle.motherTribeName} ⬅️{' '}
                    {bundle.targetAdamChain}
                  </p>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] text-[#8D4925] font-semibold flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" />
                      {bundle.verifiedCitation}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleImportAdamPrimeBundle(bundle)}
                      className="px-3.5 py-1.5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-display font-bold transition-colors cursor-pointer shrink-0"
                    >
                      سحب ودمج في شجرة آدم ←
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#B98A78]/30 py-5 bg-[#EDE6DA]/60 text-center text-xs text-[#252321]/70">
        بيئة عمل الباحثين المعتمدة — منصة جذوري للأنساب العربية · متصلة حياً مع شجرة آدم وجسر Adam Prime
      </footer>
    </div>
  );
};
