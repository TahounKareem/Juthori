import React, { useState } from 'react';
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
  LineageSearchResult,
  UpperAncestorNode,
} from '../types/juthori';
import {
  ORIGIN_REGION_SUGGESTIONS,
  inferNodeRepresentation,
  resolveDeterministicLineage,
  resolveSpineConnectorLabel,
} from '../utils/lineageEngine';
import {
  HeritageNodeAvatar,
  getHistoricalEraBadgeLabel,
  resolveNodeHistoricalEra,
} from './HeritageNodeAvatar';

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
  title: string;
  clientName: string;
  familyName: string;
  subRootName: string;
  motherTribeName: string;
  locationLabel: string;
  status: 'open' | 'dropped_ready' | 'merged_closed' | 'exported_adam_prime';
  createdAt: string;
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
  isAlphaAlreadyMerged: boolean;
  onApproveAlphaMergeIntoAdam: (payload: {
    familyName: string;
    subRootName: string;
    motherTribeName: string;
    approveSources: boolean;
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
    id: 'case-adam-47-qasim-najran',
    badge: 'شجرة آدم · 47 عقدة · ID: 249230',
    label: 'آل قاسم (نجران) ⬅️ آل مليح ⬅️ القطعان ⬅️ يام ⬅️ همدان ⬅️ آدم',
    firstName: 'سلطان',
    familyName: 'آل قاسم',
    tribeName: 'يام',
    branchName: 'القطعان',
    originCountry: 'السعودية',
    originLocality: 'نجران',
  },
  {
    id: 'case-adam-36-qasim-mawdahi',
    badge: 'شجرة آدم · 36 عقدة · ID: 189691',
    label: 'آل قاسم (المودحي) ⬅️ آل سلمان ⬅️ آل امداثر ⬅️ المودحي ⬅️ آدم',
    firstName: 'عبدالله',
    familyName: 'آل قاسم',
    tribeName: 'المودحي',
    branchName: 'آل امداثر',
    originCountry: 'السعودية',
    originLocality: 'الحواضر العربية',
  },
  {
    id: 'case-adam-43-khabour',
    badge: 'شجرة آدم · 43 عقدة · ID: 232718',
    label: 'الخابور ⬅️ السميحان ⬅️ الدبجان ⬅️ ملاك ⬅️ عبده ⬅️ عنزة ⬅️ آدم',
    firstName: 'فهد',
    familyName: 'الخابور',
    tribeName: 'عنزة',
    branchName: 'السميحان',
    originCountry: 'السعودية',
    originLocality: 'نجد',
  },
  {
    id: 'case-adam-40-muqit',
    badge: 'شجرة آدم · 40 عقدة · ID: 272887',
    label: 'آل مقيت ⬅️ عايض ⬅️ آل برمان ⬅️ بني بشر ⬅️ قحطان ⬅️ آدم',
    firstName: 'حسن',
    familyName: 'آل مقيت',
    tribeName: 'بني بشر',
    branchName: 'آل برمان',
    originCountry: 'السعودية',
    originLocality: 'سراة عبيدة',
  },
  {
    id: 'case-alpha-3-muait',
    badge: 'مشاريع ألفا · 3 عُقد',
    label: 'الابو معيط ⬅️ قبيلة خابور ⬅️ قبيلة العقيدات (دير الزور)',
    firstName: 'كريم',
    familyName: 'الابو معيط',
    tribeName: 'العقيدات',
    branchName: 'خابور',
    originCountry: 'سوريا',
    originLocality: 'دير الزور',
  },
  {
    id: 'case-alpha-5-awdah',
    badge: 'مشاريع ألفا · 5 عُقد',
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
    badge: 'مشاريع ألفا · 4 عُقد',
    label: 'المشادقة (الأيدا) ⬅️ ولد علي / الوهب ⬅️ مسلم ⬅️ قبيلة عنزة',
    firstName: 'نايف',
    familyName: 'المشادقة',
    tribeName: 'قبيلة عنزة',
    branchName: 'قبيلة الأيدا',
    originCountry: 'السعودية',
    originLocality: 'تيماء',
  },
  {
    id: 'case-alpha-2-aws',
    badge: 'مشاريع ألفا · عقدتان (2)',
    label: 'الغورية (الأوس) ⬅️ قبيلة بلحارث',
    firstName: 'سعد',
    familyName: 'الغورية',
    tribeName: 'قبيلة بلحارث',
    branchName: 'قبيلة الأوس',
    originCountry: 'السعودية',
    originLocality: 'الحجاز',
  },
];

export const ResearcherStudio: React.FC<ResearcherStudioProps> = ({
  currentFamilyName,
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
      : 'الابو حليحل';

  // =========================================================================
  // RESEARCHER DIRECT SEARCH TOOL STATE (أداة الفحص والبحث المباشر للباحث)
  // =========================================================================
  const [directSearchFirstName, setDirectSearchFirstName] = useState('كريم');
  const [directSearchFamilyName, setDirectSearchFamilyName] = useState(
    currentFamilyName || 'الابو معيط'
  );
  const [directSearchTribeName, setDirectSearchTribeName] = useState('العقيدات');
  const [directSearchBranchName, setDirectSearchBranchName] = useState('خابور');
  const [directSearchCountry, setDirectSearchCountry] = useState('سوريا');
  const [directSearchLocality, setDirectSearchLocality] = useState('دير الزور');
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
      familyName: fam || 'الابو معيط',
      originCountry: cnt,
      originRegion: loc,
      tribeName: trb,
      branchName: brn,
    });
  };

  const [directSearchResult, setDirectSearchResult] =
    useState<LineageSearchResult>(() => runDirectInspectionSearch());

  const handleExecuteDirectSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const res = runDirectInspectionSearch();
    setDirectSearchResult(res);
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
  };

  const [activeQueueTab, setActiveQueueTab] = useState<'P2' | 'P1'>('P2');

  const [tickets, setTickets] = useState<ResearcherStudioTicket[]>(() => [
    {
      id: '#ALP-ADAM-1042',
      queue: 'P2',
      title: `ربط وتغذية عمود (${activeAlphaFamily} -> خابور -> العقيدات - دير الزور) في شجرة آدم الأم`,
      clientName: `كريم ${activeAlphaFamily}`,
      familyName: activeAlphaFamily,
      subRootName: 'قبيلة خابور',
      motherTribeName: 'قبيلة العقيدات',
      locationLabel: 'دير الزور — وادي الفرات (سوريا)',
      status: isAlphaAlreadyMerged ? 'merged_closed' : 'open',
      createdAt: 'منذ 5 دقائق · تلقائي من مشاريع ألفا',
      copilotSources: [
        {
          project: 'مشروع ألفا — فهرس عشائر الشام والفرات',
          bookCitation: 'عشائر الشام لوصفي زكريا — ج2 ص 224، 233',
          extractedSnippet:
            '«عشيرة خابور من العقيدات في دير الزور ووادي الفرات، وتتفرع إلى الفروع الأبناء: الابو حليحل ؛ الابو عمرو ؛ الابو معيط، ومساكنهم في حواضر وقرى دير الزور.»',
        },
        {
          project: 'مشروع ألفا — معاجم القبائل العربية',
          bookCitation: 'معجم قبائل العرب لعمر رضا كحالة — ج1 ص 324',
          extractedSnippet:
            '«خابور: بطن من العقيدات بمحافظة الفرات (دير الزور)، ينقسم إلى أفخاذ الابو حليحل والابو عمرو والابو معيط.»',
        },
        {
          project: 'أرشيف المخطوطات العثمانية والزراعية لوادي الفرات',
          bookCitation: 'المعلومات الزراعية — مخطوط ص 27',
          extractedSnippet:
            '«ثبت أملاك ومضارب فروع خابور (الابو حليحل والابو معيط والابو عمرو) من العقيدات الزبيدية في لواء دير الزور.»',
        },
      ],
      suggestedAdamTarget: {
        confidencePercent: 96,
        entryNodeName: 'عمرو بن معدي كرب الزبيدي',
        fullChainPreview:
          'قبيلة العقيدات ⬅️ عمرو بن معدي كرب الزبيدي ⬅️ زبيد ⬅️ سعد العشيرة ⬅️ مذحج ⬅️ كهلان ⬅️ قحطان ⬅️ سام ⬅️ نوح ⬅️ آدم عليه السلام',
        rationale:
          'تطابق جغرافي ونَسَبي متواتر بين حلف وعشائر العقيدات في وادي الفرات وذرية عمرو بن معدي كرب الزبيدي من سعد العشيرة (مذحج).',
      },
      extractedNodes: [
        {
          id: 'ext-node-1',
          name: activeAlphaFamily,
          nodeCode: 'FE0',
          relationType: 'aan',
          region: 'دير الزور — وادي الفرات',
        },
        {
          id: 'ext-node-2',
          name: 'قبيلة خابور',
          nodeCode: 'B2',
          relationType: 'aan',
          region: 'دير الزور — وادي الفرات',
        },
        {
          id: 'ext-node-3',
          name: 'قبيلة العقيدات',
          nodeCode: 'B0',
          relationType: 'aan',
          region: 'دير الزور — وادي الفرات',
        },
      ],
    },
    {
      id: '#ALP-ADAM-1045',
      queue: 'P2',
      title: 'دمج وتوثيق المصادر الإضافية الموازية لسجل (آل مقيت -> آل برمان -> بني بشر) في شجرة آدم',
      clientName: 'حسن زهير آل مقيت',
      familyName: 'آل مقيت',
      subRootName: 'آل برمان',
      motherTribeName: 'قبيلة بني بشر',
      locationLabel: 'سراة عبيدة — عسير (السعودية)',
      status: 'open',
      createdAt: 'منذ 18 دقيقة · إثراء مصدري P2',
      copilotSources: [
        {
          project: 'شجرة آدم المحققة — مشجرات سراة بني بشر',
          bookCitation: 'توفيق العزيز المقيت في مشجرة آل مقيت بني بشر قحطان — ص 14-42',
          extractedSnippet:
            '«اتصال بيت آل مقيت بآل درع من آل برمان من الجبرة من بني بشر بن حرب بن أوس بن كعب بن منبه (جنب) بن مذحج.»',
        },
        {
          project: 'مشاريع ألفا — موسوعة أسر الجزيرة العربية',
          bookCitation: 'معجم قبائل المملكة العربية السعودية لحمد الجاسر — ج1 ص 88',
          extractedSnippet:
            '«آل برمان من بطون الجبرة من بني بشر في سراة عبيدة وتهامة قحطان.»',
        },
      ],
      suggestedAdamTarget: {
        confidencePercent: 99,
        entryNodeName: 'حرب بن أوس بن كعب بن منبه',
        fullChainPreview:
          'بني بشر ⬅️ حرب ⬅️ أوس ⬅️ كعب ⬅️ منبه ⬅️ قبائل جنب ⬅️ علة ⬅️ مذحج ⬅️ كهلان ⬅️ قحطان ⬅️ آدم عليه السلام',
        rationale:
          'العمود موصول مسبقاً في شجرة آدم بـ 40 عقدة؛ التذكرة مخصصة لإلحاق الشواهد الإضافية من مشاريع ألفا ببطاقة المصادر.',
      },
      extractedNodes: [
        {
          id: 'muq-1',
          name: 'آل مقيت',
          nodeCode: 'FE0',
          relationType: 'aan',
          region: 'سراة عبيدة',
        },
        {
          id: 'muq-2',
          name: 'آل برمان',
          nodeCode: 'B2',
          relationType: 'aan',
          region: 'سراة عبيدة',
        },
        {
          id: 'muq-3',
          name: 'قبيلة بني بشر',
          nodeCode: 'B0',
          relationType: 'aan',
          region: 'سراة عبيدة — عسير',
        },
      ],
    },
    {
      id: '#P1-CUST-8901',
      queue: 'P1',
      title: 'تذكرة بحث عميل مباشرة: تحقيق سجل عائلة (آل سنجر) غير المفهرسة آلياً',
      clientName: 'خالد محمد آل سنجر',
      familyName: 'آل سنجر',
      subRootName: 'آل سنجر الكنانية',
      motherTribeName: 'قبيلة كنانة',
      locationLabel: 'الشرقية / الحجاز / بلاد الشام',
      status: 'open',
      createdAt: 'منذ 12 دقيقة · أولوية قصوى P1',
      copilotSources: [
        {
          project: 'كشاف المخطوطات والأسر غير المفهرسة',
          bookCitation: 'معجم الأسر الحضرية والقبائل — فهرس المخطوطات قيد الرقمنة ص 119',
          extractedSnippet:
            '«عائلة آل سنجر: توجد شواهد متعددة في سجلات النفوس والوقفيات تتطلب تحرياً عميقاً عبر مشروع Adam Prime لحسم الفرع المباشر.»',
        },
      ],
      suggestedAdamTarget: {
        confidencePercent: 84,
        entryNodeName: 'كنانة بن خزيمة (عدنان)',
        fullChainPreview:
          'آل سنجر ⬅️ كنانة ⬅️ خزيمة ⬅️ مدركة ⬅️ إلياس ⬅️ مضر ⬅️ نزار ⬅️ معد ⬅️ عدنان ⬅️ آدم عليه السلام',
        rationale:
          'يُنصح بتصدير التذكرة كمشروع بحث مستقل إلى نظام Adam Prime لاستلام حزمة العقد المحققة قبل الدمج.',
      },
      extractedNodes: [
        {
          id: 'snj-1',
          name: 'آل سنجر',
          nodeCode: 'FE0',
          relationType: 'aan',
          region: 'حواضر المشرق والحجاز',
        },
        {
          id: 'snj-2',
          name: 'فرع سنجر الموثق',
          nodeCode: 'B2',
          relationType: 'aan',
          region: 'حواضر المشرق',
        },
        {
          id: 'snj-3',
          name: 'قبيلة كنانة',
          nodeCode: 'B0',
          relationType: 'aan',
          region: 'الحجاز وتهامة',
        },
      ],
    },
    {
      id: '#P1-CUST-8904',
      queue: 'P1',
      title: 'حسم تشابه مسارين لعائلة (خابور) — العميل ضغط «لست متأكداً»',
      clientName: 'عميل سجل خابور',
      familyName: 'خابور',
      subRootName: 'السميحان (عنزة) / خابور (العقيدات)',
      motherTribeName: 'قبائل عنزة / قبيلة العقيدات',
      locationLabel: 'شبه الجزيرة العربية vs دير الزور ووادي الفرات',
      status: 'open',
      createdAt: 'منذ 25 دقيقة · محال من نافذة التحقق P1',
      copilotSources: [
        {
          project: 'المسار الأول (شجرة آدم — شبه الجزيرة العربية)',
          bookCitation: 'أصدق الدلائل في أنساب بني وائل (قبائل عنزة) — ص 490',
          extractedSnippet:
            '«الخابور من السميحان من آل منديل من العمارات من ضنا بشر من قبائل عنزة بن أسد بن ربيعة بن عدنان.»',
        },
        {
          project: 'المسار الثاني (مشاريع ألفا — دير الزور ووادي الفرات)',
          bookCitation: 'عشائر الشام لوصفي زكريا — ج2 ص 224، 233',
          extractedSnippet:
            '«قبيلة خابور من العقيدات في دير الزور، ومن فروعها الابو حليحل والابو عمرو والابو معيط.»',
        },
      ],
      suggestedAdamTarget: {
        confidencePercent: 94,
        entryNodeName: 'عمرو بن معدي كرب الزبيدي (أو أسد بن ربيعة)',
        fullChainPreview:
          'مسار الفرات: خابور ⬅️ العقيدات ⬅️ زبيد ⬅️ مذحج ⬅️ قحطان ⬅️ آدم عليه السلام',
        rationale:
          'كلا المسارين موثقان؛ يمكن للباحث سحب المسار المطابق لبيانات العميل وإفلاته مباشرة في شجرة آدم.',
      },
      extractedNodes: [
        {
          id: 'khb-1',
          name: 'الابو حليحل / خابور',
          nodeCode: 'FE0',
          relationType: 'aan',
          region: 'دير الزور — وادي الفرات',
        },
        {
          id: 'khb-2',
          name: 'قبيلة خابور',
          nodeCode: 'B2',
          relationType: 'aan',
          region: 'دير الزور — وادي الفرات',
        },
        {
          id: 'khb-3',
          name: 'قبيلة العقيدات',
          nodeCode: 'B0',
          relationType: 'aan',
          region: 'دير الزور — وادي الفرات',
        },
      ],
    },
  ]);

  const [selectedTicketId, setSelectedTicketId] = useState<string>('#ALP-ADAM-1042');
  const selectedTicket =
    tickets.find((t) => t.id === selectedTicketId) || tickets[0];

  // Drag & Drop state between Right Pane (Extracted Nodes) and Left Pane (Master Adam Tree)
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [isDragOverAdamTree, setIsDragOverAdamTree] = useState(false);
  const [droppedInAdamTree, setDroppedInAdamTree] = useState<boolean>(
    isAlphaAlreadyMerged
  );
  const [approveSourcesChecked, setApproveSourcesChecked] = useState(true);
  const [mergeSuccessNotice, setMergeSuccessNotice] = useState<string | null>(
    isAlphaAlreadyMerged
      ? `تم دمج عمود (${activeAlphaFamily} ⬅️ قبيلة خابور ⬅️ قبيلة العقيدات) في شجرة آدم بنجاح!`
      : null
  );

  // Transfer Direct Search Result to Drag & Drop Table
  const handleTransferSearchResultToDragAndDrop = () => {
    const spine = directSearchResult.adamSpineNodes || [];
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

    const customTicketId = `#SRCH-${directSearchResult.familyName.replace(/\s+/g, '-')}`;
    const newTicket: ResearcherStudioTicket = {
      id: customTicketId,
      queue: 'P2',
      title: `ربط نتيجة الفحص المباشر: (${directSearchResult.familyName} ⬅️ ${directSearchResult.rootBranchName} ⬅️ ${directSearchResult.rootTribeName})`,
      clientName: `${directSearchResult.clientName} ${directSearchResult.familyName}`,
      familyName: directSearchResult.familyName,
      subRootName: directSearchResult.rootBranchName,
      motherTribeName: directSearchResult.rootTribeName,
      locationLabel: `${directSearchResult.originRegion || ''} — ${directSearchResult.originCountry}`,
      status: 'open',
      createdAt: 'الآن · من أداة الفحص المباشر للباحث',
      copilotSources: [
        {
          project: directSearchResult.isAlphaOnlyBeforeMerge
            ? 'بحيرة مشاريع ألفا'
            : 'بحيرة شجرة آدم الموثقة',
          bookCitation: directSearchResult.verifiedSourceCitation,
          extractedSnippet: `«سجل محقق لعائلة (${directSearchResult.familyName}) يتصل بـ (${directSearchResult.rootBranchName}) من (${directSearchResult.rootTribeName}) بعدد عُقد فعلي (${spine.length} عقدة).»`,
        },
      ],
      suggestedAdamTarget: {
        confidencePercent: 97,
        entryNodeName: directSearchResult.isAlphaOnlyBeforeMerge
          ? 'عمرو بن معدي كرب الزبيدي (مذحج — قحطان)'
          : spine[spine.length - 1]?.name || 'آدم عليه السلام',
        fullChainPreview:
          spine.length > 0
            ? spine
                .slice(0, 8)
                .map((n) => n.name)
                .join(' ⬅️ ') +
              (spine.length > 8 ? ' ⬅️ ... ⬅️ آدم عليه السلام' : '')
            : `${directSearchResult.familyName} ⬅️ ${directSearchResult.rootBranchName} ⬅️ ${directSearchResult.rootTribeName}`,
        rationale:
          'تم استخراج العُقد الحقيقية من أداة الفحص المباشر للباحث دون خلطها بأي عائلة أخرى.',
      },
      extractedNodes: extractedFromSearch,
    };

    setTickets((prev) => {
      const exists = prev.some((t) => t.id === customTicketId);
      if (exists) {
        return prev.map((t) => (t.id === customTicketId ? newTicket : t));
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
    if (e) e.preventDefault();
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

  // Primary Action: "اعتماد الربط وتغذية شجرة آدم فوراً ✓"
  const handleCommitMergeToAdamTree = () => {
    setDroppedInAdamTree(true);
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
                <span>🔍 أداة الفحص والبحث المباشر للباحث</span>
              </div>
              <h2 className="text-lg sm:text-xl font-display font-extrabold text-[#252321]">
                فحص هيكلي فوري لأي عائلة أو قبيلة أو إقليم (بدون شاشات انتظار وبدون تسجيل حساب)
              </h2>
              <p className="text-xs text-[#252321]/75">
                تعرض هذه الأداة حصرياً للباحث أرقام الطبقات التسلسلية (<code className="font-mono font-bold">#01..#N</code>)، والأكواد الهيكلية (<code className="font-mono font-bold">FE0, FE1, B2, B0, M0, K0, Q0, AD0</code>)، ومعرّف العقدة (<code className="font-mono font-bold">node_id</code>)، ومصدر البحيرة (<code className="font-mono font-bold">شجرة آدم / مشاريع ألفا</code>).
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
              نماذج فحص فوري للسلاسل الحقيقية المعزولة (انقر للفحص اللحظي ومقارنة عدد العُقد الفعلي):
            </div>
            <div className="flex flex-wrap gap-2">
              {DIRECT_SEARCH_QUICK_CASES.map((qCase) => {
                const isCurrentCase =
                  directSearchFamilyName === qCase.familyName &&
                  directSearchBranchName === qCase.branchName;
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
                placeholder="مثال: الابو معيط / ذوو مقيت / المقايتة"
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
                placeholder="مثال: خابور / السميحان / البكير"
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
                الإقليم / المدينة (مثل دير الزور أو نجد)
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  list="researcher-locality-suggestions"
                  value={directSearchLocality}
                  onChange={(e) => setDirectSearchLocality(e.target.value)}
                  placeholder="دير الزور / نجد / الحجاز"
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
                  مصدر البحيرة:{' '}
                  {directSearchResult.isAlphaOnlyBeforeMerge
                    ? 'مشاريع ألفا (قبل الدمج في شجرة آدم)'
                    : 'شجرة آدم الموثقة (Adam Tree)'}
                </span>
                {directSearchResult.resolvedGeoOntologyLabel && (
                  <span className="text-xs font-semibold text-[#8D4925] bg-white px-2.5 py-1 rounded-lg border border-[#B98A78]/35 inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#D8755B]" />
                    <span>{directSearchResult.resolvedGeoOntologyLabel}</span>
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
                  setSelectedTicketId('#ALP-ADAM-1042');
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTickets.map((ticket) => {
              const isSelected = ticket.id === selectedTicket.id;
              return (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => {
                    setSelectedTicketId(ticket.id);
                    setDroppedInAdamTree(ticket.status === 'merged_closed');
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
                          ticket.status === 'merged_closed'
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            : ticket.status === 'exported_adam_prime'
                            ? 'bg-purple-100 text-purple-900 border border-purple-300'
                            : 'bg-[#D8755B]/15 text-[#D8755B]'
                        }`}
                      >
                        {ticket.status === 'merged_closed'
                          ? '✓ تم الدمج في شجرة آدم ومغلقة'
                          : ticket.status === 'exported_adam_prime'
                          ? '↗ مرسلة لنظام Adam Prime'
                          : ticket.status === 'dropped_ready'
                          ? 'جاهزة لاعتماد التغذية'
                          : 'قيد المعالجة والربط'}
                      </span>
                    </div>

                    <h3 className="text-sm sm:text-base font-display font-extrabold text-[#252321] leading-snug">
                      {ticket.title}
                    </h3>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-[#252321]/70">
                      <span>العميل: {ticket.clientName}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-[#D8755B]" />
                        {ticket.locationLabel}
                      </span>
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
        </section>

        {/* ===================================================================== */}
        {/* SECTION 2: AUTOMATED RESEARCHER COPILOT (مساعد الباحث الآلي والكشاف)   */}
        {/* ===================================================================== */}
        <section className="rounded-3xl bg-white border border-[#B98A78]/45 p-5 sm:p-6 shadow-sm space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#B98A78]/25 pb-4">
            <div>
              <span className="text-xs font-display font-bold text-[#D8755B]">
                2. مساعد الباحث الآلي والكشاف الاستدلالي (Automated Researcher Copilot)
              </span>
              <h2 className="text-lg sm:text-xl font-display font-extrabold text-[#252321]">
                كشاف المواضع والصفحات الآلي + مقترح نقاط الالتقاء الذكي للتذكرة ({selectedTicket.id})
              </h2>
            </div>
            <span className="px-3 py-1 rounded-full bg-[#EDE6DA] text-[#8D4925] text-xs font-display font-bold">
              نسبة ثقة المطابقة الاستدلالية: {selectedTicket.suggestedAdamTarget.confidencePercent}%
            </span>
          </div>

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
                    العقدة المرشحة للوصل في شجرة آدم:
                  </div>
                  <div className="text-sm sm:text-base font-display font-extrabold text-[#F7F2E9]">
                    {selectedTicket.suggestedAdamTarget.entryNodeName}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-[#D8755B]">
                    مسار التغذية الكامل المقترح حتى آدم عليه السلام:
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
                <span>تطبيق مقترح الالتقاء الذكي في مساحة السحب والإفلات ↓</span>
              </button>
            </div>
          </div>
        </section>

        {/* ===================================================================== */}
        {/* SECTION 3: DRAG & DROP GRAPH LINKER & CODER (مساحة السحب والإفلات)     */}
        {/* ===================================================================== */}
        <section
          id="researcher-drag-drop-workbench"
          className="rounded-3xl bg-white border-2 border-[#D8755B]/55 p-5 sm:p-6 shadow-md space-y-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#B98A78]/25 pb-4">
            <div>
              <span className="text-xs font-display font-bold text-[#D8755B]">
                3. مساحة السحب والإفلات والتكويد لتغذية شجرة آدم (Drag & Drop Graph Linker & Coder)
              </span>
              <h2 className="text-lg sm:text-xl font-display font-extrabold text-[#252321]">
                اسحب عُقد ({selectedTicket.familyName} ➔ {selectedTicket.subRootName} ➔ {selectedTicket.motherTribeName}) وأفلتها فوق عقدة الالتقاء في شجرة آدم
              </h2>
            </div>

            <span className="text-xs font-semibold text-[#8D4925] bg-[#FAF6F0] px-3 py-1.5 rounded-xl border border-[#B98A78]/40">
              يدعم السحب بالماوس (Drag & Drop) أو الزر الفوري
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* RIGHT PANE (6 Cols): Draggable Extracted Nodes with Coding (FE0 / B2 / B0) & Relation (بن / عن) */}
            <div className="lg:col-span-6 rounded-2xl bg-[#F7F2E9] border border-[#B98A78]/50 p-4 sm:p-5 flex flex-col justify-between space-y-4">
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

              <button
                type="button"
                onClick={() => handleDropIntoAdamTree()}
                className="w-full py-2.5 px-4 rounded-xl bg-[#252321] hover:bg-[#3a3734] text-white text-xs font-display font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Link2 className="w-4 h-4 text-[#D8755B]" />
                <span>إفلات العُقد وتركيبها فوق نقطة الالتقاء في شجرة آدم ←</span>
              </button>
            </div>

            {/* LEFT PANE (6 Cols): Master Adam Tree Drop Target */}
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
                  : droppedInAdamTree
                  ? 'bg-[#FAF6F0] border-emerald-600/70'
                  : 'bg-[#FAF6F0] border-dashed border-[#D8755B]/70'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm sm:text-base font-display font-extrabold text-[#252321] flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-[#D8755B]" />
                    <span>الكفة اليسرى: شجرة آدم الحية (Master Adam Tree Drop Target)</span>
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#252321] text-white text-[11px] font-bold">
                    منتهى العمود: آدم عليه السلام
                  </span>
                </div>

                {/* Upper Master Adam Tree Chain */}
                <div className="rounded-2xl bg-white border border-[#B98A78]/40 p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-[#8D4925]">
                    <span>عمود شجرة آدم الأصلي (الأصول العليا المعتمدة):</span>
                    <span>متصل حتى آدم ✓</span>
                  </div>
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
                    <span className="px-2.5 py-1 rounded-lg bg-[#EDE6DA]">
                      سعد العشيرة
                    </span>
                    <span>⬅️</span>
                    <span className="px-2.5 py-1 rounded-lg bg-[#D8755B]/20 text-[#8D4925] border border-[#D8755B]/40">
                      زبيد ({selectedTicket.suggestedAdamTarget.entryNodeName})
                    </span>
                  </div>
                </div>

                {/* Interactive Drop Zone Target */}
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

                {/* Approve New Historical Sources Checkbox */}
                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-[#B98A78]/35 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={approveSourcesChecked}
                    onChange={(e) => setApproveSourcesChecked(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[#D8755B] rounded cursor-pointer"
                  />
                  <span className="text-xs text-[#252321]/85 leading-relaxed">
                    <strong>اعتماد وإلحاق المصادر التاريخية المحققة بالسلسلة:</strong> إضافة (عشائر الشام لوصفي زكريا ج2 ص224، 233 | المعلومات الزراعية مخطوط ص27 | معجم قبائل العرب ج1 ص324) إلى بطاقة مصادر العميل.
                  </span>
                </label>
              </div>

              {/* Primary Commit Button: "اعتماد الربط وتغذية شجرة آدم فوراً ✓" */}
              <button
                type="button"
                onClick={handleCommitMergeToAdamTree}
                className="w-full py-3.5 px-6 rounded-2xl bg-[#D8755B] hover:bg-[#c5644b] text-white font-display font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
              >
                <ShieldCheck className="w-5 h-5" />
                <span>اعتماد الربط وتغذية شجرة آدم فوراً ✓</span>
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
