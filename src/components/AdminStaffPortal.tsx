import React, { useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Crown,
  Eye,
  FileSignature,
  Filter,
  GitMerge,
  Headphones,
  KeyRound,
  MessageSquare,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  AccountLegalType,
  DashboardStateMode,
  LineageSearchResult,
} from '../types/juthori';
import { JuthoriLogo } from './JuthoriLogo';
import { ResearcherStudio } from './ResearcherStudio';

export type AdminPortalTabId =
  | 'orders_clients'
  | 'researcher_studio'
  | 'staff_rbac'
  | 'support_charter'
  | 'executive_reports';

export interface AdminClientOrderRow {
  id: string;
  fullName: string;
  firstName: string;
  fatherName: string;
  grandfatherName: string;
  familyName: string;
  originCountry: string;
  originRegion: string;
  email: string;
  phone: string;
  legalRole: AccountLegalType;
  accountStatus: 'free' | 'paid_5_root' | 'annual_vip';
  walletBalanceUsd: number;
  paidRevenueUsd: number;
  matchStatus:
    | 'auto_adam_full'
    | 'staged_3_nodes'
    | 'pending_geo_clarification'
    | 'open_research_ticket'
    | 'enriched_delivered';
  ticketId: string;
  ticketType: 'طلب عميل P1' | 'إثراء شجرة آدم P2' | 'آلي مكتمل';
  assignedResearcher: string;
  slaStatus:
    | 'جديدة'
    | 'قيد العمل'
    | 'محولة لآدم برايم'
    | 'مكتملة وتمت تغذية شجرة آدم';
  nodesCountLabel: string;
}

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role:
    | 'الإدارة العليا Super Admin'
    | 'كبار النسابين والباحثين Senior Researchers'
    | 'باحثو التكويد والإثراء Junior Researchers'
    | 'مسؤولو خدمة العملاء وتوثيق أمناء السجلات Customer Support';
  status: 'نشط' | 'موقوف';
  assignedTickets: number;
  completedTickets: number;
  avgCompletionTime: string;
  permissions: string[];
}

interface CharterUpgradeRequest {
  id: string;
  clientName: string;
  familyName: string;
  email: string;
  country: string;
  submittedAt: string;
  charterCode: string;
  status: 'بانتظار الاعتماد' | 'معتمد (شجرتي مفعّلة)';
}

interface SupportTicketItem {
  id: string;
  clientName: string;
  email: string;
  category: 'استفسار نسبي' | 'مشكلة دفع' | 'رمز التحقق OTP';
  subject: string;
  otpCode: string;
  status: 'مفتوح' | 'تم الحل';
  timestamp: string;
}

interface AdminStaffPortalProps {
  currentClientResult: LineageSearchResult;
  currentClientStateMode: DashboardStateMode;
  currentClientAccountType: AccountLegalType;
  currentClientEmail: string;
  isAlphaAlreadyMerged: boolean;
  onApproveAlphaMergeIntoAdam: (payload: {
    familyName: string;
    subRootName: string;
    motherTribeName: string;
    approveSources: boolean;
  }) => void;
  onPreviewClientOrder: (order: {
    firstName: string;
    fatherName: string;
    grandfatherName: string;
    familyName: string;
    originCountry: string;
    originRegion: string;
    accountType: AccountLegalType;
    stateMode: DashboardStateMode;
    email: string;
  }) => void;
  onManualUpgradeActiveClient: (
    nextMode: DashboardStateMode,
    nextLegalRole?: AccountLegalType
  ) => void;
  onBackToPlatform: () => void;
}

const INITIAL_STAFF_MEMBERS: StaffMember[] = [
  {
    id: 'stf-1',
    name: 'د. عبد الرحمن آل مقيت',
    email: 'abdulrahman@juthori.com',
    role: 'الإدارة العليا Super Admin',
    status: 'نشط',
    assignedTickets: 4,
    completedTickets: 312,
    avgCompletionTime: '1.2 ساعة',
    permissions: [
      'إدارة النظام بالكامل',
      'اعتماد شجرة آدم النهائي',
      'إدارة الصلاحيات والأسعار',
      'ترقية الحسابات يدوياً',
    ],
  },
  {
    id: 'stf-2',
    name: 'أ. د. سليمان بن راشد النجدي',
    email: 'sulaiman.najdi@juthori.com',
    role: 'كبار النسابين والباحثين Senior Researchers',
    status: 'نشط',
    assignedTickets: 9,
    completedTickets: 184,
    avgCompletionTime: '2.8 ساعة',
    permissions: [
      'تحقيق المخطوطات',
      'ربط العُقد بشجرة آدم',
      'تصدير واستيراد Adam Prime',
    ],
  },
  {
    id: 'stf-3',
    name: 'أ. مازن الفراتي',
    email: 'mazen.furati@juthori.com',
    role: 'كبار النسابين والباحثين Senior Researchers',
    status: 'نشط',
    assignedTickets: 7,
    completedTickets: 146,
    avgCompletionTime: '3.1 ساعة',
    permissions: [
      'تحقيق عشائر الشام والفرات',
      'ربط العُقد بشجرة آدم',
      'مراجعة تذاكر P1/P2',
    ],
  },
  {
    id: 'stf-4',
    name: 'أ. ريم القحطاني',
    email: 'reem.qahtani@juthori.com',
    role: 'باحثو التكويد والإثراء Junior Researchers',
    status: 'نشط',
    assignedTickets: 14,
    completedTickets: 229,
    avgCompletionTime: '1.9 ساعة',
    permissions: [
      'تكويد الطبقات FE0/B2/B0',
      'فهرسة أرقام الصفحات والمخطوطات',
    ],
  },
  {
    id: 'stf-5',
    name: 'أ. طارق السبيعي',
    email: 'tareq.support@juthori.com',
    role: 'مسؤولو خدمة العملاء وتوثيق أمناء السجلات Customer Support',
    status: 'نشط',
    assignedTickets: 6,
    completedTickets: 410,
    avgCompletionTime: '24 دقيقة',
    permissions: [
      'توثيق مواثيق أمناء السجلات',
      'مراسلة العملاء (إيميل / واتساب)',
      'حل مشاكل الدفع ورموز OTP',
    ],
  },
];

export const AdminStaffPortal: React.FC<AdminStaffPortalProps> = ({
  currentClientResult,
  currentClientStateMode,
  currentClientAccountType,
  currentClientEmail,
  isAlphaAlreadyMerged,
  onApproveAlphaMergeIntoAdam,
  onPreviewClientOrder,
  onManualUpgradeActiveClient,
  onBackToPlatform,
}) => {
  const [activeTab, setActiveTab] = useState<AdminPortalTabId>('orders_clients');
  const [studioTargetFamily, setStudioTargetFamily] = useState<string>(
    currentClientResult.familyName || 'الابو معيط'
  );

  // Orders & Clients Table State
  const [orders, setOrders] = useState<AdminClientOrderRow[]>(() => [
    {
      id: 'ORD-JTH-1001',
      fullName: 'حسن بن زهير آل مقيت',
      firstName: 'حسن',
      fatherName: 'زهير',
      grandfatherName: 'حسن',
      familyName: 'آل مقيت',
      originCountry: 'السعودية',
      originRegion: 'سراة عبيدة — عسير',
      email: 'hassan.almuqit@juthori.com',
      phone: '+966 50 482 9104',
      legalRole: AccountLegalType.RecordKeeper,
      accountStatus: 'annual_vip',
      walletBalanceUsd: 25,
      paidRevenueUsd: 60,
      matchStatus: 'auto_adam_full',
      ticketId: '#AUTO-272887',
      ticketType: 'آلي مكتمل',
      assignedResearcher: 'محرك شجرة آدم الآلي',
      slaStatus: 'مكتملة وتمت تغذية شجرة آدم',
      nodesCountLabel: '40 عقدة (آل مقيت ⬅️ آدم عليه السلام)',
    },
    {
      id: 'ORD-JTH-1002',
      fullName: 'كريم شريف الابو معيط',
      firstName: 'كريم',
      fatherName: 'شريف',
      grandfatherName: '',
      familyName: 'الابو معيط',
      originCountry: 'سوريا',
      originRegion: 'دير الزور — وادي الفرات',
      email: 'kareem.abumuait@juthori.com',
      phone: '+963 94 318 7720',
      legalRole: AccountLegalType.Individual,
      accountStatus: 'paid_5_root',
      walletBalanceUsd: 0,
      paidRevenueUsd: 5,
      matchStatus: isAlphaAlreadyMerged ? 'enriched_delivered' : 'staged_3_nodes',
      ticketId: '#ALP-ADAM-1042',
      ticketType: 'إثراء شجرة آدم P2',
      assignedResearcher: 'أ. مازن الفراتي',
      slaStatus: isAlphaAlreadyMerged ? 'مكتملة وتمت تغذية شجرة آدم' : 'قيد العمل',
      nodesCountLabel: isAlphaAlreadyMerged
        ? '42 عقدة (الابو معيط ⬅️ العقيدات ⬅️ آدم عليه السلام)'
        : '3 عُقد (الابو معيط ⬅️ خابور ⬅️ العقيدات)',
    },
    {
      id: 'ORD-JTH-1003',
      fullName: 'صالح بن محمد آل قاسم',
      firstName: 'صالح',
      fatherName: 'محمد',
      grandfatherName: 'مانع',
      familyName: 'آل قاسم',
      originCountry: 'السعودية',
      originRegion: 'نجران',
      email: 'saleh.alqasim@juthori.com',
      phone: '+966 55 910 3341',
      legalRole: AccountLegalType.RecordKeeper,
      accountStatus: 'annual_vip',
      walletBalanceUsd: 13,
      paidRevenueUsd: 72,
      matchStatus: 'auto_adam_full',
      ticketId: '#AUTO-249230',
      ticketType: 'آلي مكتمل',
      assignedResearcher: 'محرك شجرة آدم الآلي',
      slaStatus: 'مكتملة وتمت تغذية شجرة آدم',
      nodesCountLabel: '47 عقدة (آل قاسم ⬅️ يام ⬅️ آدم عليه السلام)',
    },
    {
      id: 'ORD-JTH-1004',
      fullName: 'طارق عبدالله خابور',
      firstName: 'طارق',
      fatherName: 'عبدالله',
      grandfatherName: '',
      familyName: 'خابور',
      originCountry: 'غير محدد',
      originRegion: 'شبه الجزيرة / وادي الفرات',
      email: 'tareq.khabour@juthori.com',
      phone: '+965 99 104 882',
      legalRole: AccountLegalType.Individual,
      accountStatus: 'free',
      walletBalanceUsd: 0,
      paidRevenueUsd: 0,
      matchStatus: 'pending_geo_clarification',
      ticketId: '#SRCH-P1-889',
      ticketType: 'طلب عميل P1',
      assignedResearcher: 'أ. د. سليمان بن راشد النجدي',
      slaStatus: 'جديدة',
      nodesCountLabel: 'مساران (عنزة 43 عقدة / العقيدات 3 عُقد)',
    },
    {
      id: 'ORD-JTH-1005',
      fullName: 'نواف بن فهد آل محجم',
      firstName: 'نواف',
      fatherName: 'فهد',
      grandfatherName: 'تركى',
      familyName: 'آل محجم',
      originCountry: 'السعودية',
      originRegion: 'حائل — نجد',
      email: 'nawaf.muhjam@juthori.com',
      phone: '+966 54 201 7789',
      legalRole: AccountLegalType.Individual,
      accountStatus: 'paid_5_root',
      walletBalanceUsd: 10,
      paidRevenueUsd: 5,
      matchStatus: 'staged_3_nodes',
      ticketId: '#ALP-SHAMMAR-204',
      ticketType: 'إثراء شجرة آدم P2',
      assignedResearcher: 'أ. ريم القحطاني',
      slaStatus: 'محولة لآدم برايم',
      nodesCountLabel: '5 عُقد (آل محجم ⬅️ الأوضاح ⬅️ شمر)',
    },
    {
      id: 'ORD-JTH-1006',
      fullName: 'خالد محمود آل سنجر',
      firstName: 'خالد',
      fatherName: 'محمود',
      grandfatherName: 'سنجر',
      familyName: 'آل سنجر',
      originCountry: 'مصر',
      originRegion: 'الشرقية',
      email: 'khaled.sanjar@juthori.com',
      phone: '+20 100 492 8173',
      legalRole: AccountLegalType.RecordKeeper,
      accountStatus: 'free',
      walletBalanceUsd: 0,
      paidRevenueUsd: 0,
      matchStatus: 'open_research_ticket',
      ticketId: '#SRCH-P1-904',
      ticketType: 'طلب عميل P1',
      assignedResearcher: 'أ. د. سليمان بن راشد النجدي',
      slaStatus: 'قيد العمل',
      nodesCountLabel: '1 عقدة (قيد الفهرسة من المخطوطات)',
    },
  ]);

  // Search & Filter states for Orders Hub
  const [searchQuery, setSearchQuery] = useState('');
  const [accountFilter, setAccountFilter] = useState<
    'all' | 'free' | 'paid_5_root' | 'annual_vip'
  >('all');
  const [matchFilter, setMatchFilter] = useState<
    | 'all'
    | 'auto_adam_full'
    | 'staged_3_nodes'
    | 'pending_geo_clarification'
    | 'open_research_ticket'
    | 'enriched_delivered'
  >('all');

  // Action Modals & Toast Feedback in Orders Hub
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [messageModalOrder, setMessageModalOrder] =
    useState<AdminClientOrderRow | null>(null);
  const [messageChannel, setMessageChannel] = useState<'email' | 'whatsapp'>(
    'whatsapp'
  );
  const [messageBody, setMessageBody] = useState('');

  const [assignModalOrder, setAssignModalOrder] =
    useState<AdminClientOrderRow | null>(null);
  const [selectedResearcherName, setSelectedResearcherName] = useState(
    'أ. د. سليمان بن راشد النجدي'
  );

  // Staff RBAC State
  const [staffList, setStaffList] = useState<StaffMember[]>(
    INITIAL_STAFF_MEMBERS
  );
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<StaffMember['role']>(
    'باحثو التكويد والإثراء Junior Researchers'
  );

  // Customer Support & Charter Desk State
  const [charterRequests, setCharterRequests] = useState<
    CharterUpgradeRequest[]
  >([
    {
      id: 'CHR-401',
      clientName: `${currentClientResult.clientName} ${currentClientResult.familyName}`,
      familyName: currentClientResult.familyName,
      email: currentClientEmail,
      country: currentClientResult.originCountry,
      submittedAt: 'اليوم · قبل 15 دقيقة',
      charterCode: 'JTH-CHARTER-2026-881',
      status:
        currentClientAccountType === AccountLegalType.RecordKeeper
          ? 'معتمد (شجرتي مفعّلة)'
          : 'بانتظار الاعتماد',
    },
    {
      id: 'CHR-402',
      clientName: 'كريم شريف الابو معيط',
      familyName: 'الابو معيط',
      email: 'kareem.abumuait@juthori.com',
      country: 'سوريا',
      submittedAt: 'اليوم · قبل ساعتين',
      charterCode: 'JTH-CHARTER-2026-879',
      status: 'بانتظار الاعتماد',
    },
    {
      id: 'CHR-403',
      clientName: 'حسن بن زهير آل مقيت',
      familyName: 'آل مقيت',
      email: 'hassan.almuqit@juthori.com',
      country: 'السعودية',
      submittedAt: 'أمس',
      charterCode: 'JTH-CHARTER-2026-850',
      status: 'معتمد (شجرتي مفعّلة)',
    },
  ]);

  const [supportTickets, setSupportTickets] = useState<SupportTicketItem[]>([
    {
      id: 'SUP-901',
      clientName: 'طارق عبدالله خابور',
      email: 'tareq.khabour@juthori.com',
      category: 'رمز التحقق OTP',
      subject: 'تأخر وصول رمز التحقق OTP للبريد الإلكتروني',
      otpCode: '7421',
      status: 'مفتوح',
      timestamp: 'قبل 10 دقائق',
    },
    {
      id: 'SUP-902',
      clientName: 'نواف بن فهد آل محجم',
      email: 'nawaf.muhjam@juthori.com',
      category: 'استفسار نسبي',
      subject: 'إرفاق وثيقة وقف قديمة لفرع آل محجم في حائل',
      otpCode: '5920',
      status: 'مفتوح',
      timestamp: 'قبل ساعة',
    },
    {
      id: 'SUP-903',
      clientName: 'صالح بن محمد آل قاسم',
      email: 'saleh.alqasim@juthori.com',
      category: 'مشكلة دفع',
      subject: 'استفسار عن رصيد المحفظة المجاني بعد الاشتراك السنوي',
      otpCode: '3318',
      status: 'تم الحل',
      timestamp: 'أمس',
    },
  ]);

  // Executive Dashboard Pricing Configuration State
  const [priceRootUnlock, setPriceRootUnlock] = useState(5);
  const [priceAnnualVip, setPriceAnnualVip] = useState(60);
  const [bonusWalletVip, setBonusWalletVip] = useState(25);
  const [priceAllCapsules, setPriceAllCapsules] = useState(12);

  const showTemporaryToast = (msg: string) => {
    setActionToast(msg);
    setTimeout(() => {
      setActionToast((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  // Filtered Orders
  const filteredOrders = orders.filter((ord) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      ord.fullName.toLowerCase().includes(q) ||
      ord.familyName.toLowerCase().includes(q) ||
      ord.email.toLowerCase().includes(q) ||
      ord.phone.toLowerCase().includes(q) ||
      ord.ticketId.toLowerCase().includes(q);

    const matchesAccount =
      accountFilter === 'all' || ord.accountStatus === accountFilter;
    const matchesStatus =
      matchFilter === 'all' || ord.matchStatus === matchFilter;

    return matchesSearch && matchesAccount && matchesStatus;
  });

  // KPIs Calculation
  const totalOrdersCount = orders.length;
  const autoCompletedCount = orders.filter(
    (o) =>
      o.matchStatus === 'auto_adam_full' ||
      o.matchStatus === 'enriched_delivered'
  ).length;
  const awaitingClarificationCount = orders.filter(
    (o) => o.matchStatus === 'pending_geo_clarification'
  ).length;
  const openTicketsCount = orders.filter(
    (o) =>
      o.slaStatus !== 'مكتملة وتمت تغذية شجرة آدم'
  ).length;
  const totalRevenueUsd = orders.reduce((acc, o) => acc + o.paidRevenueUsd, 0);

  // Quick Action 1: Preview Client Screen
  const handlePreviewOrderClientScreen = (ord: AdminClientOrderRow) => {
    const nextStateMode =
      ord.accountStatus === 'annual_vip'
        ? DashboardStateMode.AnnualVip
        : ord.accountStatus === 'paid_5_root'
        ? DashboardStateMode.State1Paid5Basic
        : ord.matchStatus === 'open_research_ticket'
        ? DashboardStateMode.State3Unmatched
        : DashboardStateMode.State2MatchedUnpaid;

    onPreviewClientOrder({
      firstName: ord.firstName,
      fatherName: ord.fatherName,
      grandfatherName: ord.grandfatherName,
      familyName: ord.familyName,
      originCountry: ord.originCountry === 'غير محدد' ? '' : ord.originCountry,
      originRegion: ord.originRegion,
      accountType: ord.legalRole,
      stateMode: nextStateMode,
      email: ord.email,
    });
  };

  // Quick Action 2: Open in Researcher Studio
  const handleOpenInResearcherStudio = (ord: AdminClientOrderRow) => {
    setStudioTargetFamily(ord.familyName);
    setActiveTab('researcher_studio');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  // Quick Action 3: Send Clarification / Notification (Email / WhatsApp)
  const handleOpenMessageModal = (ord: AdminClientOrderRow) => {
    setMessageModalOrder(ord);
    setMessageChannel('whatsapp');
    setMessageBody(
      `مرحباً ${ord.fullName}، نود إبلاغكم من منصة جذوري بخصوص سجل عائلة (${ord.familyName}) أن طلبكم رقم ${ord.ticketId} قد تم تحديثه في منظومة التوثيق.`
    );
  };

  const handleSendClientMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageModalOrder) return;
    showTemporaryToast(
      `تم إرسال الإشعار إلى ${messageModalOrder.fullName} عبر ${
        messageChannel === 'whatsapp' ? 'واتساب' : 'البريد الإلكتروني'
      } بنجاح ✓`
    );
    setMessageModalOrder(null);
  };

  // Quick Action 4: Manual Upgrade ($5 Root or Annual VIP)
  const handleManualUpgradeOrder = (ord: AdminClientOrderRow) => {
    const nextStatus: AdminClientOrderRow['accountStatus'] =
      ord.accountStatus === 'free'
        ? 'paid_5_root'
        : ord.accountStatus === 'paid_5_root'
        ? 'annual_vip'
        : 'annual_vip';

    const addedRevenue =
      ord.accountStatus === 'free'
        ? 5
        : ord.accountStatus === 'paid_5_root'
        ? 60
        : 0;

    setOrders((prev) =>
      prev.map((item) =>
        item.id === ord.id
          ? {
              ...item,
              accountStatus: nextStatus,
              paidRevenueUsd: item.paidRevenueUsd + addedRevenue,
              walletBalanceUsd:
                nextStatus === 'annual_vip'
                  ? item.walletBalanceUsd + 25
                  : item.walletBalanceUsd,
            }
          : item
      )
    );

    if (
      ord.familyName === currentClientResult.familyName ||
      ord.email === currentClientEmail
    ) {
      onManualUpgradeActiveClient(
        nextStatus === 'annual_vip'
          ? DashboardStateMode.AnnualVip
          : DashboardStateMode.State1Paid5Basic
      );
    }

    showTemporaryToast(
      `تمت ترقية حساب العميل (${ord.fullName}) يدوياً إلى «${
        nextStatus === 'annual_vip'
          ? 'مشترك بريميوم سنوي'
          : 'دفع $5 (الجذر مفتوح)'
      }» ✓`
    );
  };

  // Quick Action 5: Approve Result & Notify Client of Completion
  const handleApproveAndNotifyCompletion = (ord: AdminClientOrderRow) => {
    if (
      ord.familyName.includes('معيط') ||
      ord.familyName.includes('حليحل') ||
      ord.familyName.includes('خابور')
    ) {
      onApproveAlphaMergeIntoAdam({
        familyName: ord.familyName,
        subRootName: 'قبيلة خابور',
        motherTribeName: 'قبيلة العقيدات',
        approveSources: true,
      });
    }

    setOrders((prev) =>
      prev.map((item) =>
        item.id === ord.id
          ? {
              ...item,
              matchStatus: 'enriched_delivered',
              slaStatus: 'مكتملة وتمت تغذية شجرة آدم',
              nodesCountLabel:
                item.familyName.includes('معيط') ||
                item.familyName.includes('حليحل')
                  ? '42 عقدة (الابو معيط ⬅️ العقيدات ⬅️ آدم عليه السلام)'
                  : item.nodesCountLabel,
            }
          : item
      )
    );

    showTemporaryToast(
      `تم اعتماد النتيجة النهائية لعائلة (${ord.familyName}) وتغذية شجرة آدم وإشعار العميل (${ord.fullName}) بالاكتمل ✓`
    );
  };

  // Add New Staff Member Handler
  const handleAddStaffMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim() || !newStaffEmail.trim()) return;
    const created: StaffMember = {
      id: `stf-${Date.now()}`,
      name: newStaffName.trim(),
      email: newStaffEmail.trim(),
      role: newStaffRole,
      status: 'نشط',
      assignedTickets: 0,
      completedTickets: 0,
      avgCompletionTime: 'جديد',
      permissions:
        newStaffRole === 'الإدارة العليا Super Admin'
          ? ['كامل الصلاحيات الإدارية والمالية']
          : newStaffRole === 'كبار النسابين والباحثين Senior Researchers'
          ? ['اعتماد شجرة آدم', 'تحقيق المخطوطات', 'Adam Prime']
          : newStaffRole === 'باحثو التكويد والإثراء Junior Researchers'
          ? ['تكويد العُقد', 'فهرسة المصادر']
          : ['توثيق مواثيق أمناء السجلات', 'خدمة العملاء ورموز OTP'],
    };
    setStaffList((prev) => [created, ...prev]);
    setNewStaffName('');
    setNewStaffEmail('');
    setShowAddStaffModal(false);
    showTemporaryToast(`تمت إضافة الموظف (${created.name}) بنجاح ✓`);
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#F4EFE6] text-[#252321] flex flex-col">
      {/* TOP CENTRAL ADMIN HEADER */}
      <header className="bg-[#1E1C1A] text-white border-b-2 border-[#D8755B] sticky top-0 z-40 shadow-md">
        <div className="max-w-[1480px] mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <JuthoriLogo size="sm" onClick={onBackToPlatform} />
            <div className="h-7 w-px bg-white/15 hidden sm:block" />
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-[#D8755B] text-white text-[10px] font-display font-extrabold">
                  STAFF PORTAL
                </span>
                <h1 className="text-sm sm:text-lg font-display font-extrabold text-white">
                  منظومة الإدارة المركزية لمنصة جذوري
                </h1>
              </div>
              <p className="text-[11px] text-white/70 mt-0.5">
                إدارة الطلبات والعملاء · لوحة الباحثين · صلاحيات الموظفين · توثيق أمناء السجلات · تقارير الإدارة العليا
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-xs font-semibold text-[#F3D299]">
              <ShieldCheck className="w-4 h-4 text-[#D8755B]" />
              <span>دخول إداري مصرح: د. عبد الرحمن (Super Admin)</span>
            </span>

            <button
              type="button"
              onClick={onBackToPlatform}
              className="px-4 py-2 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-display font-extrabold inline-flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
            >
              <ArrowRight className="w-4 h-4" />
              <span>العودة لواجهة المنصة</span>
            </button>
          </div>
        </div>

        {/* 5 MAIN ADMIN PORTAL NAVIGATION TABS */}
        <div className="bg-[#252321] border-t border-white/10">
          <div className="max-w-[1480px] mx-auto px-4 sm:px-6 flex items-center gap-2 overflow-x-auto py-2.5 no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab('orders_clients')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-display font-bold inline-flex items-center gap-2 whitespace-nowrap cursor-pointer transition-all ${
                activeTab === 'orders_clients'
                  ? 'bg-[#D8755B] text-white shadow-xs'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span>1. إدارة الطلبات والعملاء</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('researcher_studio')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-display font-bold inline-flex items-center gap-2 whitespace-nowrap cursor-pointer transition-all ${
                activeTab === 'researcher_studio'
                  ? 'bg-[#D8755B] text-white shadow-xs'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <GitMerge className="w-4 h-4" />
              <span>2. لوحة تحكم الباحثين (Researcher Studio)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('staff_rbac')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-display font-bold inline-flex items-center gap-2 whitespace-nowrap cursor-pointer transition-all ${
                activeTab === 'staff_rbac'
                  ? 'bg-[#D8755B] text-white shadow-xs'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>3. المستخدمين والصلاحيات (RBAC)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('support_charter')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-display font-bold inline-flex items-center gap-2 whitespace-nowrap cursor-pointer transition-all ${
                activeTab === 'support_charter'
                  ? 'bg-[#D8755B] text-white shadow-xs'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Headphones className="w-4 h-4" />
              <span>4. خدمة العملاء وتوثيق أمناء السجلات</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('executive_reports')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-display font-bold inline-flex items-center gap-2 whitespace-nowrap cursor-pointer transition-all ${
                activeTab === 'executive_reports'
                  ? 'bg-[#D8755B] text-white shadow-xs'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>5. الإدارة العليا والتقارير</span>
            </button>
          </div>
        </div>
      </header>

      {/* TOAST BANNER */}
      {actionToast && (
        <div className="bg-[#1E3A2F] text-white px-4 py-3 border-b border-[#D8755B]">
          <div className="max-w-[1480px] mx-auto flex items-center justify-between gap-3 text-xs sm:text-sm font-bold">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#D8755B] shrink-0" />
              <span>{actionToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionToast(null)}
              className="text-white/70 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* MAIN PORTAL CONTENT */}
      <main className="flex-1 max-w-[1480px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* ============================================================ */}
        {/* TAB 1: ORDER & CLIENT OPERATIONS HUB                         */}
        {/* ============================================================ */}
        {activeTab === 'orders_clients' && (
          <div className="space-y-6">
            {/* Top KPIs Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="rounded-2xl bg-white border border-[#B98A78]/45 p-4 shadow-2xs">
                <div className="text-xs text-[#252321]/65 font-semibold">
                  إجمالي الطلبات
                </div>
                <div className="text-2xl sm:text-3xl font-display font-extrabold text-[#252321] mt-1 tabular-nums">
                  {totalOrdersCount}
                </div>
                <div className="text-[11px] text-[#8D4925] mt-1 font-semibold">
                  جميع السجلات المسجلة
                </div>
              </div>

              <div className="rounded-2xl bg-white border border-[#B98A78]/45 p-4 shadow-2xs">
                <div className="text-xs text-[#252321]/65 font-semibold">
                  الطلبات المكتملة آلياً
                </div>
                <div className="text-2xl sm:text-3xl font-display font-extrabold text-[#1E3A2F] mt-1 tabular-nums">
                  {autoCompletedCount}
                </div>
                <div className="text-[11px] text-[#1E3A2F] mt-1 font-semibold">
                  متصلة بشجرة آدم ✓
                </div>
              </div>

              <div className="rounded-2xl bg-white border border-[#B98A78]/45 p-4 shadow-2xs">
                <div className="text-xs text-[#252321]/65 font-semibold">
                  بانتظار توضيح العميل
                </div>
                <div className="text-2xl sm:text-3xl font-display font-extrabold text-[#D97706] mt-1 tabular-nums">
                  {awaitingClarificationCount}
                </div>
                <div className="text-[11px] text-[#D97706] mt-1 font-semibold">
                  سؤال النطاق الجغرافي
                </div>
              </div>

              <div className="rounded-2xl bg-white border border-[#B98A78]/45 p-4 shadow-2xs">
                <div className="text-xs text-[#252321]/65 font-semibold">
                  تذاكر البحث المفتوحة
                </div>
                <div className="text-2xl sm:text-3xl font-display font-extrabold text-[#D8755B] mt-1 tabular-nums">
                  {openTicketsCount}
                </div>
                <div className="text-[11px] text-[#D8755B] mt-1 font-semibold">
                  تذاكر P1 + P2 نشطة
                </div>
              </div>

              <div className="col-span-2 sm:col-span-1 rounded-2xl bg-[#252321] text-white border border-[#D8755B] p-4 shadow-sm">
                <div className="text-xs text-white/75 font-semibold">
                  إجمالي الإيرادات المحصلة
                </div>
                <div className="text-2xl sm:text-3xl font-display font-extrabold text-[#D8755B] mt-1 tabular-nums">
                  ${totalRevenueUsd}
                </div>
                <div className="text-[11px] text-[#F3D299] mt-1 font-semibold">
                  باقات الجذر $5 + الباقات السنوية
                </div>
              </div>
            </div>

            {/* Active Session Quick Sync Bar */}
            <div className="rounded-2xl bg-gradient-to-l from-[#252321] via-[#322E2A] to-[#252321] text-white p-4 sm:p-5 border border-[#D8755B]/50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#D8755B] text-white text-[11px] font-display font-bold">
                    جلسة العميل النشطة حالياً
                  </span>
                  <span className="text-sm sm:text-base font-display font-extrabold">
                    {currentClientResult.clientName} — عائلة ({currentClientResult.familyName})
                  </span>
                  <span className="text-xs text-[#F3D299]">
                    ({currentClientResult.adamSpineNodes.length} عقدة في العمود)
                  </span>
                </div>
                <p className="text-xs text-white/75">
                  يمكنك التحكم الفوري بحالة جلسة العميل الحالية أو معاينة أي عميل من الجدول بالأسفل:
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onManualUpgradeActiveClient(DashboardStateMode.State1Paid5Basic);
                    showTemporaryToast(
                      `تم فتح نقطة الربط ($5) لجلسة العميل الحالية (${currentClientResult.familyName}) ✓`
                    );
                  }}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-[#D8755B] text-white text-xs font-display font-bold transition-colors cursor-pointer"
                >
                  🔓 فتح الجذر ($5) للعميل الحالي
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onManualUpgradeActiveClient(DashboardStateMode.AnnualVip);
                    showTemporaryToast(
                      `تم تفعيل الباقة السنوية (بريميوم) لجلسة العميل الحالية (${currentClientResult.familyName}) ✓`
                    );
                  }}
                  className="px-3.5 py-2 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-display font-bold transition-colors cursor-pointer"
                >
                  👑 تفعيل الباقة السنوية للعميل الحالي
                </button>
                <button
                  type="button"
                  onClick={onBackToPlatform}
                  className="px-3.5 py-2 rounded-xl bg-white text-[#252321] hover:bg-[#F7F2E9] text-xs font-display font-bold transition-colors cursor-pointer"
                >
                  👁️ معاينة شاشة العميل الحالي
                </button>
              </div>
            </div>

            {/* Advanced Search & Filter Bar */}
            <div className="rounded-2xl bg-white border border-[#B98A78]/45 p-4 sm:p-5 shadow-2xs space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">
                <div className="md:col-span-5">
                  <label className="block text-xs font-display font-bold text-[#252321] mb-1.5">
                    بحث شامل في الطلبات والعملاء (الاسم / العائلة / البريد / الجوال / رقم التذكرة):
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="ابحث باسم العميل، اسم العائلة، الإيميل، رقم الجوال..."
                      className="w-full rounded-xl bg-[#F7F2E9] border border-[#B98A78]/55 pr-9 pl-3.5 py-2.5 text-xs sm:text-sm text-[#252321] focus:outline-none focus:border-[#D8755B]"
                    />
                    <Search className="w-4 h-4 text-[#8D4925] absolute right-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-display font-bold text-[#252321] mb-1.5">
                    فلترة حسب نوع الحساب:
                  </label>
                  <select
                    value={accountFilter}
                    onChange={(e) =>
                      setAccountFilter(
                        e.target.value as typeof accountFilter
                      )
                    }
                    className="w-full rounded-xl bg-[#F7F2E9] border border-[#B98A78]/55 px-3 py-2.5 text-xs sm:text-sm font-semibold text-[#252321] cursor-pointer"
                  >
                    <option value="all">جميع الحسابات</option>
                    <option value="free">حساب مجاني</option>
                    <option value="paid_5_root">باقة الجذر ($5)</option>
                    <option value="annual_vip">بريميوم سنوي ($60)</option>
                  </select>
                </div>

                <div className="md:col-span-4">
                  <label className="block text-xs font-display font-bold text-[#252321] mb-1.5">
                    فلترة حسب حالة المطابقة والبحث:
                  </label>
                  <select
                    value={matchFilter}
                    onChange={(e) =>
                      setMatchFilter(e.target.value as typeof matchFilter)
                    }
                    className="w-full rounded-xl bg-[#F7F2E9] border border-[#B98A78]/55 px-3 py-2.5 text-xs sm:text-sm font-semibold text-[#252321] cursor-pointer"
                  >
                    <option value="all">جميع حالات البحث</option>
                    <option value="auto_adam_full">✅ تطابق آلي كامل (شجرة آدم)</option>
                    <option value="staged_3_nodes">
                      🟠 تطابق مرحلي (بانتظار ربط الباحث بشجرة آدم)
                    </option>
                    <option value="pending_geo_clarification">
                      ❓حتاج توضيح من العميل (النطاق الجغرافي)
                    </option>
                    <option value="open_research_ticket">
                      🔍 تذكرة بحث مفتوحة
                    </option>
                    <option value="enriched_delivered">
                      ✨ تم الإثراء والتسليم
                    </option>
                  </select>
                </div>
              </div>
            </div>

            {/* Comprehensive Orders & Clients Table */}
            <div className="rounded-2xl bg-white border border-[#B98A78]/45 shadow-xs overflow-hidden">
              <div className="px-5 py-4 border-b border-[#B98A78]/30 flex flex-wrap items-center justify-between gap-2 bg-[#FAF6F0]">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-[#D8755B]" />
                  <h2 className="text-sm sm:text-base font-display font-extrabold text-[#252321]">
                    جدول الطلبات والعملاء الشامل ({filteredOrders.length} طلب)
                  </h2>
                </div>
                <span className="text-xs text-[#252321]/70">
                  يعرض كافة تفاصيل العميل، الدفع، حالة المطابقة، الـ SLA، والإجراءات الفورية الخمسة
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-[#EDE6DA]/70 text-[#252321] text-xs font-display font-bold border-b border-[#B98A78]/35">
                      <th className="py-3.5 px-4">1. بيانات العميل والعائلة</th>
                      <th className="py-3.5 px-4">2. حالة الحساب والدفع</th>
                      <th className="py-3.5 px-4">3. حالة المطابقة والبحث</th>
                      <th className="py-3.5 px-4">4. التذكرة والـ SLA</th>
                      <th className="py-3.5 px-4">5. الإجراءات السريعة (Quick Actions)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#B98A78]/25 text-xs">
                    {filteredOrders.map((ord) => (
                      <tr
                        key={ord.id}
                        className="hover:bg-[#FAF6F0]/80 transition-colors align-top"
                      >
                        {/* 1. Client Details */}
                        <td className="py-4 px-4 space-y-1 min-w-[230px]">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#EDE6DA] text-[#8D4925] font-bold">
                              {ord.id}
                            </span>
                            <span className="font-display font-extrabold text-sm text-[#252321]">
                              {ord.fullName}
                            </span>
                          </div>
                          <div className="font-bold text-[#7C3AED]">
                            العائلة المبحوثة: {ord.familyName} ({ord.originCountry} · {ord.originRegion})
                          </div>
                          <div className="text-[#252321]/70 font-mono text-[11px]" dir="ltr">
                            {ord.email} | {ord.phone}
                          </div>
                          <div>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#F7F2E9] border border-[#B98A78]/40 text-[10px] font-semibold text-[#252321]">
                              {ord.legalRole === AccountLegalType.RecordKeeper
                                ? '🏛️ رب أسرة - أمين سجل'
                                : '👤 فرد'}
                            </span>
                          </div>
                        </td>

                        {/* 2. Account & Payment Status */}
                        <td className="py-4 px-4 space-y-1.5 min-w-[175px]">
                          {ord.accountStatus === 'annual_vip' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-l from-[#D8755B] to-[#8D4925] text-white font-display font-bold text-[11px]">
                              <Crown className="w-3.5 h-3.5" />
                              <span>مشترك بريميوم سنوي</span>
                            </span>
                          ) : ord.accountStatus === 'paid_5_root' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FFF7ED] border border-[#E67E22] text-[#E67E22] font-display font-bold text-[11px]">
                              <span>دفع $5 (الجذر مفتوح)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#EDE6DA] text-[#252321]/80 font-display font-semibold text-[11px]">
                              <span>حساب مجاني</span>
                            </span>
                          )}

                          <div className="text-[11px] text-[#252321]/80 font-semibold">
                            💳 رصيد المحفظة:{' '}
                            <strong className="font-mono text-[#252321]">
                              ${ord.walletBalanceUsd}
                            </strong>
                          </div>
                          <div className="text-[11px] text-[#8D4925] font-semibold">
                            إجمالي المدفوع: ${ord.paidRevenueUsd}
                          </div>
                        </td>

                        {/* 3. Matching & Search Status */}
                        <td className="py-4 px-4 space-y-1.5 min-w-[230px]">
                          {ord.matchStatus === 'auto_adam_full' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-900 font-bold text-[11px]">
                              <span>✅ تطابق آلي كامل (شجرة آدم)</span>
                            </span>
                          )}
                          {ord.matchStatus === 'staged_3_nodes' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 font-bold text-[11px]">
                              <span>
                                🟠 تطابق مرحلي (3 عُقد - بانتظار ربط الباحث بشجرة آدم)
                              </span>
                            </span>
                          )}
                          {ord.matchStatus === 'pending_geo_clarification' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 border border-purple-300 text-purple-900 font-bold text-[11px]">
                              <span>
                                ❓ معلق - بانتظار إجابة العميل على سؤال النطاق الجغرافي
                              </span>
                            </span>
                          )}
                          {ord.matchStatus === 'open_research_ticket' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 text-red-800 font-bold text-[11px]">
                              <span>🔍 تذكرة بحث مفتوحة ({ord.ticketId})</span>
                            </span>
                          )}
                          {ord.matchStatus === 'enriched_delivered' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1E3A2F] text-white font-bold text-[11px]">
                              <span>✨ تم الإثراء والتسليم (شجرة آدم)</span>
                            </span>
                          )}

                          <div className="text-[11px] text-[#252321]/75 font-medium">
                            {ord.nodesCountLabel}
                          </div>
                        </td>

                        {/* 4. Ticket & SLA Status */}
                        <td className="py-4 px-4 space-y-1 min-w-[190px]">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-[#8D4925]">
                              {ord.ticketId}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-[#FAF5EC] border border-[#B98A78]/40 text-[10px] font-bold">
                              {ord.ticketType}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#252321]/80">
                            الباحث: <strong>{ord.assignedResearcher}</strong>
                          </div>
                          <div>
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                ord.slaStatus === 'مكتملة وتمت تغذية شجرة آدم'
                                  ? 'bg-emerald-100 text-emerald-900'
                                  : ord.slaStatus === 'محولة لآدم برايم'
                                  ? 'bg-purple-100 text-purple-900'
                                  : ord.slaStatus === 'قيد العمل'
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-[#EDE6DA] text-[#252321]'
                              }`}
                            >
                              الحالة: {ord.slaStatus}
                            </span>
                          </div>
                        </td>

                        {/* 5. Quick Actions (All 5 Approved Actions) */}
                        <td className="py-4 px-4 min-w-[260px]">
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => handlePreviewOrderClientScreen(ord)}
                              className="px-2.5 py-1.5 rounded-lg bg-[#252321] hover:bg-[#3a3734] text-white text-[11px] font-display font-bold inline-flex items-center gap-1 cursor-pointer"
                              title="معاينة شاشة العميل لهذا الطلب"
                            >
                              <Eye className="w-3.5 h-3.5 text-[#D8755B]" />
                              <span>👁️ معاينة شاشة العميل</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenInResearcherStudio(ord)}
                              className="px-2.5 py-1.5 rounded-lg bg-[#EDE6DA] hover:bg-[#D8755B] hover:text-white text-[#252321] text-[11px] font-display font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <span>👨‍🔬 فتح في لوحة الباحث</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setAssignModalOrder(ord);
                                setSelectedResearcherName(ord.assignedResearcher);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-[#F7F2E9] hover:bg-[#EDE6DA] border border-[#B98A78]/45 text-[#252321] text-[11px] font-semibold cursor-pointer"
                            >
                              <span>تعيين باحث</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenMessageModal(ord)}
                              className="px-2.5 py-1.5 rounded-lg bg-[#FAF5EC] hover:bg-[#EDE6DA] border border-[#B98A78]/45 text-[#8D4925] text-[11px] font-bold cursor-pointer"
                            >
                              <span>📩 إرسال طلب توضيح / إشعار</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleManualUpgradeOrder(ord)}
                              className="px-2.5 py-1.5 rounded-lg bg-[#FFF7ED] hover:bg-[#FFEDD5] border border-[#E67E22]/50 text-[#9A3412] text-[11px] font-bold cursor-pointer"
                            >
                              <span>🔓 ترقية الحساب يدوياً</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleApproveAndNotifyCompletion(ord)}
                              className="px-2.5 py-1.5 rounded-lg bg-[#1E3A2F] hover:bg-[#284d3f] text-white text-[11px] font-bold cursor-pointer"
                            >
                              <span>✅ اعتماد النتيجة وإشعار العميل</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: RESEARCHER STUDIO (لوحة تحكم الباحثين)                  */}
        {/* ============================================================ */}
        {activeTab === 'researcher_studio' && (
          <div className="rounded-3xl overflow-hidden border border-[#B98A78]/45 shadow-sm">
            <ResearcherStudio
              currentFamilyName={studioTargetFamily}
              isAlphaAlreadyMerged={isAlphaAlreadyMerged}
              onApproveAlphaMergeIntoAdam={(payload) => {
                onApproveAlphaMergeIntoAdam(payload);
                setOrders((prev) =>
                  prev.map((item) =>
                    item.familyName.includes('معيط') ||
                    item.familyName.includes('حليحل')
                      ? {
                          ...item,
                          matchStatus: 'enriched_delivered',
                          slaStatus: 'مكتملة وتمت تغذية شجرة آدم',
                          nodesCountLabel:
                            '42 عقدة (الابو معيط ⬅️ العقيدات ⬅️ آدم عليه السلام)',
                        }
                      : item
                  )
                );
                showTemporaryToast(
                  'تم اعتماد ربط العقيدات بشجرة آدم وتحديث عمود العميل (كريم الابو معيط) إلى 42 عقدة متصلة بآدم عليه السلام ✓'
                );
              }}
              onBackToClientDashboard={onBackToPlatform}
              onSwitchToClientPreview={(famName) => {
                onPreviewClientOrder({
                  firstName: 'كريم',
                  fatherName: 'شريف',
                  grandfatherName: '',
                  familyName: famName || 'الابو معيط',
                  originCountry: 'سوريا',
                  originRegion: 'دير الزور',
                  accountType: AccountLegalType.Individual,
                  stateMode: DashboardStateMode.State1Paid5Basic,
                  email: 'kareem.abumuait@juthori.com',
                });
              }}
            />
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: USER & STAFF MANAGEMENT - RBAC                        */}
        {/* ============================================================ */}
        {activeTab === 'staff_rbac' && (
          <div className="space-y-6">
            <div className="rounded-2xl bg-white border border-[#B98A78]/45 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
              <div>
                <span className="text-xs font-display font-bold text-[#D8755B]">
                  إدارة الموارد البشرية والصلاحيات (RBAC)
                </span>
                <h2 className="text-lg sm:text-xl font-display font-extrabold text-[#252321] mt-0.5">
                  لوحة إدارة المستخدمين والصلاحيات والأدوار الوظيفية الأربعة
                </h2>
                <p className="text-xs text-[#252321]/75 mt-1">
                  متابعة أداء النسابين والباحثين ومسؤولي خدمة العملاء، وتوزيع التذاكر، وإدارة الصلاحيات.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddStaffModal(true)}
                className="px-4 py-2.5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs sm:text-sm font-display font-extrabold inline-flex items-center gap-2 cursor-pointer shrink-0 shadow-xs"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ إضافة مستخدم نظام جديد</span>
              </button>
            </div>

            <div className="rounded-2xl bg-white border border-[#B98A78]/45 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-[#EDE6DA]/70 text-[#252321] text-xs font-display font-bold border-b border-[#B98A78]/35">
                      <th className="py-3.5 px-4">الموظف والبريد الرسمي</th>
                      <th className="py-3.5 px-4">الدور الوظيفي (Role)</th>
                      <th className="py-3.5 px-4">الحالة</th>
                      <th className="py-3.5 px-4">التذاكر المسندة / المنجزة</th>
                      <th className="py-3.5 px-4">متوسط سرعة الإنجاز</th>
                      <th className="py-3.5 px-4">الصلاحيات والإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#B98A78]/25 text-xs">
                    {staffList.map((stf) => (
                      <tr key={stf.id} className="hover:bg-[#FAF6F0]/75">
                        <td className="py-4 px-4">
                          <div className="font-display font-bold text-sm text-[#252321]">
                            {stf.name}
                          </div>
                          <div className="text-[#252321]/65 font-mono text-[11px]" dir="ltr">
                            {stf.email}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="px-2.5 py-1 rounded-lg bg-[#FAF5EC] border border-[#B98A78]/45 font-display font-bold text-[#8D4925] text-[11px]">
                            {stf.role}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              stf.status === 'نشط'
                                ? 'bg-emerald-100 text-emerald-900'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {stf.status}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="font-bold text-[#D8755B]">
                            {stf.assignedTickets} مسندة
                          </span>{' '}
                          / <strong className="text-[#1E3A2F]">{stf.completedTickets} منجزة</strong>
                        </td>
                        <td className="py-4 px-4 font-semibold text-[#252321]">
                          {stf.avgCompletionTime}
                        </td>
                        <td className="py-4 px-4 space-y-2">
                          <div className="flex flex-wrap gap-1">
                            {stf.permissions.map((perm, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded bg-[#F7F2E9] text-[#252321]/80 text-[10px] border border-[#B98A78]/30"
                              >
                                {perm}
                              </span>
                            ))}
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={() => {
                                setStaffList((prev) =>
                                  prev.map((x) =>
                                    x.id === stf.id
                                      ? {
                                          ...x,
                                          status:
                                            x.status === 'نشط' ? 'موقوف' : 'نشط',
                                        }
                                      : x
                                  )
                                );
                                showTemporaryToast(
                                  `تم تحديث حالة حساب (${stf.name}) ✓`
                                );
                              }}
                              className="px-2.5 py-1 rounded-lg bg-[#EDE6DA] hover:bg-[#252321] hover:text-white text-[#252321] text-[11px] font-bold transition-colors cursor-pointer"
                            >
                              {stf.status === 'نشط' ? 'إيقاف مؤقت' : 'إعادة تفعيل'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 4: CUSTOMER SUPPORT & CHARTER DESK                       */}
        {/* ============================================================ */}
        {activeTab === 'support_charter' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Right 7 Cols: Record Keeper Charter Verification Queue */}
            <div className="lg:col-span-7 rounded-2xl bg-white border border-[#B98A78]/45 p-5 sm:p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#B98A78]/25 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <FileSignature className="w-5 h-5 text-[#D8755B]" />
                  <div>
                    <h2 className="text-base sm:text-lg font-display font-extrabold text-[#252321]">
                      توثيق مواثيق «رب أسرة (أمين السجل)» وتفعيل تبويب شجرتي
                    </h2>
                    <p className="text-xs text-[#252321]/70">
                      مراجعة المواثيق الموقعة إلكترونياً لمنح صلاحية بناء شجرة العائلة
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {charterRequests.map((req) => (
                  <div
                    key={req.id}
                    className="rounded-xl bg-[#FAF6F0] border border-[#B98A78]/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#252321] text-white">
                          {req.charterCode}
                        </span>
                        <span className="text-sm font-display font-bold text-[#252321]">
                          {req.clientName}
                        </span>
                      </div>
                      <div className="text-xs text-[#252321]/75">
                        عائلة: <strong>{req.familyName}</strong> · {req.country} ·{' '}
                        <span className="font-mono" dir="ltr">
                          {req.email}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#8D4925]">
                        تاريخ التوقيع: {req.submittedAt}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {req.status === 'معتمد (شجرتي مفعّلة)' ? (
                        <span className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-900 text-xs font-bold inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{req.status}</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setCharterRequests((prev) =>
                              prev.map((c) =>
                                c.id === req.id
                                  ? { ...c, status: 'معتمد (شجرتي مفعّلة)' }
                                  : c
                              )
                            );
                            onManualUpgradeActiveClient(
                              currentClientStateMode,
                              AccountLegalType.RecordKeeper
                            );
                            showTemporaryToast(
                              `تم اعتماد ميثاق أمين السجل لـ (${req.clientName}) وتفعيل تبويب شجرتي ✓`
                            );
                          }}
                          className="px-3.5 py-2 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-display font-bold cursor-pointer"
                        >
                          ✅ اعتماد الميثاق وتفعيل شجرتي
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Left 5 Cols: Inquiries, Payment Issues & OTP Logs */}
            <div className="lg:col-span-5 rounded-2xl bg-white border border-[#B98A78]/45 p-5 sm:p-6 shadow-2xs space-y-4">
              <div className="flex items-center gap-2.5 border-b border-[#B98A78]/25 pb-3.5">
                <KeyRound className="w-5 h-5 text-[#D8755B]" />
                <div>
                  <h2 className="text-base sm:text-lg font-display font-extrabold text-[#252321]">
                    استفسارات العملاء والدفع ورموز التحقق (OTP)
                  </h2>
                  <p className="text-xs text-[#252321]/70">
                    متابعة التذاكر الفنية وإعادة إرسال رموز التحقق الفورية
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {supportTickets.map((sup) => (
                  <div
                    key={sup.id}
                    className="rounded-xl bg-[#FAF6F0] border border-[#B98A78]/40 p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 rounded bg-[#EDE6DA] text-[#8D4925] text-[10px] font-bold">
                        {sup.category}
                      </span>
                      <span className="text-[11px] text-[#252321]/60">
                        {sup.timestamp}
                      </span>
                    </div>
                    <div className="text-xs sm:text-sm font-display font-bold text-[#252321]">
                      {sup.subject}
                    </div>
                    <div className="text-xs text-[#252321]/75 flex items-center justify-between">
                      <span>العميل: {sup.clientName}</span>
                      <span className="font-mono font-bold text-[#D8755B]">
                        رمز OTP المسجل: {sup.otpCode}
                      </span>
                    </div>
                    <div className="pt-1 flex items-center justify-between">
                      <span
                        className={`text-[11px] font-bold ${
                          sup.status === 'تم الحل'
                            ? 'text-emerald-800'
                            : 'text-amber-800'
                        }`}
                      >
                        الحالة: {sup.status}
                      </span>
                      {sup.status !== 'تم الحل' && (
                        <button
                          type="button"
                          onClick={() => {
                            setSupportTickets((prev) =>
                              prev.map((s) =>
                                s.id === sup.id ? { ...s, status: 'تم الحل' } : s
                              )
                            );
                            showTemporaryToast(
                              `تم إرسال الحل للعميل (${sup.clientName}) وإغلاق التذكرة ✓`
                            );
                          }}
                          className="px-3 py-1 rounded-lg bg-[#252321] text-white text-[11px] font-bold cursor-pointer"
                        >
                          إرسال الرمز وإغلاق التذكرة
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 5: EXECUTIVE DASHBOARD & REPORTS                         */}
        {/* ============================================================ */}
        {activeTab === 'executive_reports' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-2xl bg-white border border-[#B98A78]/45 p-5 shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-[#8D4925]">
                  <span>معدل التحويل المالي (Conversion Rate)</span>
                  <TrendingUp className="w-4 h-4 text-[#D8755B]" />
                </div>
                <div className="text-3xl font-display font-extrabold text-[#252321] tabular-nums">
                  66.7%
                </div>
                <p className="text-xs text-[#252321]/70">
                  نسبة التحول من الفحص المجاني إلى فتح نقطة الربط ($5) أو الباقة السنوية ($60).
                </p>
              </div>

              <div className="rounded-2xl bg-white border border-[#B98A78]/45 p-5 shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-[#8D4925]">
                  <span>نمو عُقد شجرة آدم الموثقة</span>
                  <Sparkles className="w-4 h-4 text-[#D8755B]" />
                </div>
                <div className="text-3xl font-display font-extrabold text-[#1E3A2F] tabular-nums">
                  2,271,882
                </div>
                <p className="text-xs text-[#252321]/70">
                  +42 عقدة جديدة أُضيفت اليوم عبر جسر Adam Prime ولوحة الباحثين.
                </p>
              </div>

              <div className="rounded-2xl bg-white border border-[#B98A78]/45 p-5 shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-[#8D4925]">
                  <span>متوسط زمن معالجة تذاكر البحث (SLA)</span>
                  <CheckCircle2 className="w-4 h-4 text-[#D8755B]" />
                </div>
                <div className="text-3xl font-display font-extrabold text-[#252321] tabular-nums">
                  2.4 ساعة
                </div>
                <p className="text-xs text-[#252321]/70">
                  التزام بنسبة 98.4% بمؤشر الأداء القياسي لتذاكر P1 وP2.
                </p>
              </div>
            </div>

            {/* Pricing & Package Settings Card */}
            <div className="rounded-2xl bg-white border border-[#B98A78]/45 p-6 shadow-2xs space-y-5">
              <div className="flex items-center gap-2.5 border-b border-[#B98A78]/25 pb-3.5">
                <Settings className="w-5 h-5 text-[#D8755B]" />
                <div>
                  <h2 className="text-base sm:text-lg font-display font-extrabold text-[#252321]">
                    إعدادات الباقات والتسعير المعتمدة في المنصة
                  </h2>
                  <p className="text-xs text-[#252321]/70">
                    التحكم المركزي بأسعار فتح نقطة الربط، الباقة السنوية، ورصيد المحفظة المجاني
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl bg-[#FAF6F0] border border-[#B98A78]/40 p-4 space-y-1.5">
                  <label className="block text-xs font-bold text-[#252321]">
                    سعر فتح نقطة الربط (الجذر) ($):
                  </label>
                  <input
                    type="number"
                    value={priceRootUnlock}
                    onChange={(e) => setPriceRootUnlock(Number(e.target.value))}
                    className="w-full rounded-xl bg-white border border-[#B98A78]/50 px-3 py-2 text-sm font-mono font-bold"
                  />
                </div>

                <div className="rounded-xl bg-[#FAF6F0] border border-[#B98A78]/40 p-4 space-y-1.5">
                  <label className="block text-xs font-bold text-[#252321]">
                    سعر الباقة السنوية الشاملة ($/سنة):
                  </label>
                  <input
                    type="number"
                    value={priceAnnualVip}
                    onChange={(e) => setPriceAnnualVip(Number(e.target.value))}
                    className="w-full rounded-xl bg-white border border-[#B98A78]/50 px-3 py-2 text-sm font-mono font-bold"
                  />
                </div>

                <div className="rounded-xl bg-[#FAF6F0] border border-[#B98A78]/40 p-4 space-y-1.5">
                  <label className="block text-xs font-bold text-[#252321]">
                    رصيد المحفظة الهدية مع الباقة السنوية ($):
                  </label>
                  <input
                    type="number"
                    value={bonusWalletVip}
                    onChange={(e) => setBonusWalletVip(Number(e.target.value))}
                    className="w-full rounded-xl bg-white border border-[#B98A78]/50 px-3 py-2 text-sm font-mono font-bold"
                  />
                </div>

                <div className="rounded-xl bg-[#FAF6F0] border border-[#B98A78]/40 p-4 space-y-1.5">
                  <label className="block text-xs font-bold text-[#252321]">
                    سعر باقة فتح جميع الأجداد الفرعيين ($):
                  </label>
                  <input
                    type="number"
                    value={priceAllCapsules}
                    onChange={(e) => setPriceAllCapsules(Number(e.target.value))}
                    className="w-full rounded-xl bg-white border border-[#B98A78]/50 px-3 py-2 text-sm font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    showTemporaryToast(
                      'تم حفظ إعدادات الباقات والأسعار في المنظومة المركزية بنجاح ✓'
                    )
                  }
                  className="px-5 py-2.5 rounded-xl bg-[#252321] hover:bg-[#D8755B] text-white text-xs sm:text-sm font-display font-bold transition-colors cursor-pointer"
                >
                  حفظ واعتماد إعدادات الأسعار
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL A: Send Clarification / Notification (Email / WhatsApp) */}
      {messageModalOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#252321]/70 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSendClientMessage}
            className="w-full max-w-lg rounded-2xl bg-[#F7F2E9] border border-[#B98A78]/60 p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#B98A78]/25 pb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-[#D8755B]" />
                <h3 className="text-base font-display font-extrabold text-[#252321]">
                  إرسال طلب توضيح أو إشعار للعميل ({messageModalOrder.fullName})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setMessageModalOrder(null)}
                className="text-[#252321]/60 hover:text-[#252321] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setMessageChannel('whatsapp')}
                className={`py-2.5 px-3 rounded-xl text-xs font-display font-bold border cursor-pointer ${
                  messageChannel === 'whatsapp'
                    ? 'bg-[#1E3A2F] text-white border-[#1E3A2F]'
                    : 'bg-white text-[#252321] border-[#B98A78]/40'
                }`}
              >
                📱 إرسال عبر واتساب ({messageModalOrder.phone})
              </button>
              <button
                type="button"
                onClick={() => setMessageChannel('email')}
                className={`py-2.5 px-3 rounded-xl text-xs font-display font-bold border cursor-pointer ${
                  messageChannel === 'email'
                    ? 'bg-[#252321] text-white border-[#252321]'
                    : 'bg-white text-[#252321] border-[#B98A78]/40'
                }`}
              >
                ✉️ إرسال عبر البريد ({messageModalOrder.email})
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#252321] mb-1.5">
                نص الرسالة / طلب التوضيح:
              </label>
              <textarea
                rows={4}
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                className="w-full rounded-xl bg-white border border-[#B98A78]/50 p-3 text-xs text-[#252321]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMessageModalOrder(null)}
                className="px-4 py-2 rounded-xl bg-[#EDE6DA] text-xs font-bold text-[#252321] cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-display font-bold cursor-pointer"
              >
                إرسال الآن
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL B: Assign Researcher to Ticket */}
      {assignModalOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#252321]/70 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#F7F2E9] border border-[#B98A78]/60 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#B98A78]/25 pb-3">
              <h3 className="text-base font-display font-extrabold text-[#252321]">
                تعيين باحث للتذكرة ({assignModalOrder.ticketId})
              </h3>
              <button
                type="button"
                onClick={() => setAssignModalOrder(null)}
                className="text-[#252321]/60 hover:text-[#252321] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#252321] mb-1.5">
                اختر الباحث المختص لعائلة ({assignModalOrder.familyName}):
              </label>
              <select
                value={selectedResearcherName}
                onChange={(e) => setSelectedResearcherName(e.target.value)}
                className="w-full rounded-xl bg-white border border-[#B98A78]/50 px-3 py-2.5 text-xs font-bold text-[#252321]"
              >
                <option value="أ. د. سليمان بن راشد النجدي">
                  أ. د. سليمان بن راشد النجدي (كبير النسابين)
                </option>
                <option value="أ. مازن الفراتي">
                  أ. مازن الفراتي (أنساب الشام ووادي الفرات)
                </option>
                <option value="أ. ريم القحطاني">
                  أ. ريم القحطاني (تكويد وفهرسة شجرة آدم)
                </option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAssignModalOrder(null)}
                className="px-4 py-2 rounded-xl bg-[#EDE6DA] text-xs font-bold text-[#252321] cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  setOrders((prev) =>
                    prev.map((o) =>
                      o.id === assignModalOrder.id
                        ? {
                            ...o,
                            assignedResearcher: selectedResearcherName,
                            slaStatus: 'قيد العمل',
                          }
                        : o
                    )
                  );
                  showTemporaryToast(
                    `تم إسناد تذكرة عائلة (${assignModalOrder.familyName}) إلى (${selectedResearcherName}) ✓`
                  );
                  setAssignModalOrder(null);
                }}
                className="px-5 py-2 rounded-xl bg-[#D8755B] text-white text-xs font-display font-bold cursor-pointer"
              >
                تأكيد التعيين
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL C: Add New System Staff User */}
      {showAddStaffModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#252321]/70 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleAddStaffMember}
            className="w-full max-w-md rounded-2xl bg-[#F7F2E9] border border-[#B98A78]/60 p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#B98A78]/25 pb-3">
              <h3 className="text-base font-display font-extrabold text-[#252321]">
                + إضافة مستخدم نظام جديد
              </h3>
              <button
                type="button"
                onClick={() => setShowAddStaffModal(false)}
                className="text-[#252321]/60 hover:text-[#252321] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#252321] mb-1">
                الاسم الكامل للموظف / الباحث *
              </label>
              <input
                type="text"
                required
                value={newStaffName}
                onChange={(e) => setNewStaffName(e.target.value)}
                placeholder="مثال: د. خالد بن منصور"
                className="w-full rounded-xl bg-white border border-[#B98A78]/50 px-3.5 py-2 text-xs text-[#252321]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#252321] mb-1">
                البريد الإلكتروني الرسمي *
              </label>
              <input
                type="email"
                required
                dir="ltr"
                value={newStaffEmail}
                onChange={(e) => setNewStaffEmail(e.target.value)}
                placeholder="researcher@juthori.com"
                className="w-full rounded-xl bg-white border border-[#B98A78]/50 px-3.5 py-2 text-xs text-[#252321] text-right"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#252321] mb-1">
                الدور الوظيفي والصلاحيات (RBAC) *
              </label>
              <select
                value={newStaffRole}
                onChange={(e) =>
                  setNewStaffRole(e.target.value as StaffMember['role'])
                }
                className="w-full rounded-xl bg-white border border-[#B98A78]/50 px-3 py-2 text-xs font-bold text-[#252321]"
              >
                <option value="الإدارة العليا Super Admin">
                  الإدارة العليا Super Admin
                </option>
                <option value="كبار النسابين والباحثين Senior Researchers">
                  كبار النسابين والباحثين Senior Researchers
                </option>
                <option value="باحثو التكويد والإثراء Junior Researchers">
                  باحثو التكويد والإثراء Junior Researchers
                </option>
                <option value="مسؤولو خدمة العملاء وتوثيق أمناء السجلات Customer Support">
                  مسؤولو خدمة العملاء وتوثيق أمناء السجلات Customer Support
                </option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddStaffModal(false)}
                className="px-4 py-2 rounded-xl bg-[#EDE6DA] text-xs font-bold text-[#252321] cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#D8755B] text-white text-xs font-display font-bold cursor-pointer"
              >
                إضافة وتفعيل الصلاحيات
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
