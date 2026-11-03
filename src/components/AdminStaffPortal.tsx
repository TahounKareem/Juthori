import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  CheckCircle2,
  CreditCard,
  Crown,
  Eye,
  FileSignature,
  FileText,
  Filter,
  Globe,
  HeadphonesIcon,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  AccountLegalType,
  DashboardStateMode,
  LineageSearchResult,
} from '../types/juthori';
import {
  CharterRequestRecord,
  CustomerOrderRecord,
  FOUNDING_MAESTRO_MEMBER,
  KnowledgeArticleRecord,
  SupportTicketRecord,
  TeamMemberRecord,
  TeamRoleType,
  addTeamMemberToFirebase,
  approveCharterRequestInFirebase,
  authenticateTeamMemberInFirebase,
  bootstrapJuthoriFirestoreDatabase,
  deleteKnowledgeArticleFromFirebase,
  fetchAllCustomerOrdersFromFirebase,
  fetchAllResearchTicketsForStaff,
  fetchAllTeamMembersFromFirebase,
  fetchCharterRequestsFromFirebase,
  fetchKnowledgeArticlesFromFirebase,
  fetchSupportTicketsFromFirebase,
  getPermissionsForTeamRole,
  resolveSupportTicketInFirebase,
  saveKnowledgeArticleToFirebase,
  updateCustomerOrderInFirebase,
  updateTeamMemberStatusInFirebase,
} from '../services/firestoreService';
import { JuthoriLogo } from './JuthoriLogo';
import { ResearcherStudio } from './ResearcherStudio';

export type AdminModuleTab =
  | 'users_rbac'
  | 'research_studio'
  | 'orders_support'
  | 'knowledge_cms'
  | 'executive_reports';

interface AdminStaffPortalProps {
  currentClientResult: LineageSearchResult;
  currentClientStateMode: DashboardStateMode;
  currentClientAccountType: AccountLegalType;
  currentClientEmail: string;
  isAlphaAlreadyMerged?: boolean;
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
    nextRole?: AccountLegalType
  ) => void;
  onBackToPlatform: () => void;
}

const TEAM_SESSION_KEY = 'juthori_team_authenticated_session';

const ALL_TEAM_ROLES: TeamRoleType[] = [
  'المايسترو',
  'مدير عام',
  'مدير البحوث',
  'مدير إدارة الطلبات وخدمة العملاء',
  'مدير تحرير المركز المعرفي',
];

function getAllowedTabsForRole(role: TeamRoleType): AdminModuleTab[] {
  switch (role) {
    case 'المايسترو':
    case 'مدير عام':
      return [
        'users_rbac',
        'research_studio',
        'orders_support',
        'knowledge_cms',
        'executive_reports',
      ];
    case 'مدير البحوث':
      return ['research_studio'];
    case 'مدير إدارة الطلبات وخدمة العملاء':
      return ['orders_support'];
    case 'مدير تحرير المركز المعرفي':
      return ['knowledge_cms'];
  }
}

export const AdminStaffPortal: React.FC<AdminStaffPortalProps> = ({
  currentClientResult,
  currentClientStateMode,
  currentClientAccountType,
  isAlphaAlreadyMerged = false,
  onApproveAlphaMergeIntoAdam,
  onPreviewClientOrder,
  onManualUpgradeActiveClient,
  onBackToPlatform,
}) => {
  // 1. Authenticated /Team Staff State
  const [loggedInMember, setLoggedInMember] = useState<TeamMemberRecord | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = sessionStorage.getItem(TEAM_SESSION_KEY);
      return saved ? (JSON.parse(saved) as TeamMemberRecord) : null;
    } catch {
      return null;
    }
  });

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // 2. Active Module Tab (governed strictly by RBAC)
  const allowedTabs = useMemo<AdminModuleTab[]>(
    () => (loggedInMember ? getAllowedTabsForRole(loggedInMember.role) : []),
    [loggedInMember]
  );

  const [activeTab, setActiveTab] = useState<AdminModuleTab>('users_rbac');

  useEffect(() => {
    if (loggedInMember) {
      const allowed = getAllowedTabsForRole(loggedInMember.role);
      if (!allowed.includes(activeTab)) {
        setActiveTab(allowed[0]);
      }
    }
  }, [loggedInMember, activeTab]);

  // 3. Firebase Live Data Collections (Zero Mock Data)
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [staffList, setStaffList] = useState<TeamMemberRecord[]>([
    FOUNDING_MAESTRO_MEMBER,
  ]);
  const [orders, setOrders] = useState<CustomerOrderRecord[]>([]);
  const [charterRequests, setCharterRequests] = useState<CharterRequestRecord[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicketRecord[]>([]);
  const [knowledgeArticles, setKnowledgeArticles] = useState<KnowledgeArticleRecord[]>(
    []
  );
  const [researchTicketsCount, setResearchTicketsCount] = useState(0);

  // Toast feedback
  const [toastBanner, setToastBanner] = useState<string | null>(null);
  const triggerToast = (msg: string) => {
    setToastBanner(msg);
    setTimeout(() => setToastBanner(null), 5000);
  };

  // Load real data from Firebase when authenticated
  const refreshAllFirebaseData = async () => {
    if (!loggedInMember) return;
    setIsLoadingData(true);
    try {
      await bootstrapJuthoriFirestoreDatabase();
      const [
        fetchedStaff,
        fetchedOrders,
        fetchedCharters,
        fetchedSupport,
        fetchedArticles,
        fetchedResearchTickets,
      ] = await Promise.all([
        fetchAllTeamMembersFromFirebase(),
        fetchAllCustomerOrdersFromFirebase(),
        fetchCharterRequestsFromFirebase(),
        fetchSupportTicketsFromFirebase(),
        fetchKnowledgeArticlesFromFirebase(),
        fetchAllResearchTicketsForStaff(),
      ]);

      setStaffList(fetchedStaff);
      setOrders(fetchedOrders);
      setCharterRequests(fetchedCharters);
      setSupportTickets(fetchedSupport);
      setKnowledgeArticles(fetchedArticles);
      setResearchTicketsCount(fetchedResearchTickets.length);
    } catch (err) {
      console.warn('[AdminStaffPortal] refresh warning:', err);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    if (loggedInMember) {
      refreshAllFirebaseData();
    }
  }, [loggedInMember]);

  // 4. Add / Invite Team Member Modal State (in لوحة إدارة المستخدمين)
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<TeamRoleType>('مدير البحوث');
  const [isAddingStaff, setIsAddingStaff] = useState(false);

  // 5. Orders & Support Filtering State
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderFilterMatch, setOrderFilterMatch] = useState<string>('ALL');
  const [selectedOrderForModal, setSelectedOrderForModal] =
    useState<CustomerOrderRecord | null>(null);

  // 6. Knowledge Center CMS Form State
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const [articleTitle, setArticleTitle] = useState('');
  const [articleCategory, setArticleCategory] = useState('منهجية التحقيق النَّسبي');
  const [articleSummary, setArticleSummary] = useState('');
  const [articleContent, setArticleContent] = useState('');
  const [articleStatus, setArticleStatus] = useState<'published' | 'draft'>('published');
  const [isSavingArticle, setIsSavingArticle] = useState(false);

  // Handle /Team Staff Login
  const handleTeamLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setLoginError('يرجى إدخال البريد الإلكتروني وكلمة المرور الخاصة بفريق الإدارة.');
      return;
    }

    setIsLoggingIn(true);
    try {
      const { member, error } = await authenticateTeamMemberInFirebase(
        loginEmail,
        loginPassword
      );
      if (!member || error) {
        setLoginError(error || 'بيانات الدخول غير صحيحة.');
        setIsLoggingIn(false);
        return;
      }

      setLoggedInMember(member);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(TEAM_SESSION_KEY, JSON.stringify(member));
      }
      const allowed = getAllowedTabsForRole(member.role);
      setActiveTab(allowed[0]);
    } catch {
      setLoginError('تعذر الاتصال بخدمة المصادقة الإدارية.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleTeamLogout = () => {
    setLoggedInMember(null);
    setLoginPassword('');
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(TEAM_SESSION_KEY);
    }
  };

  // Add & Invite New Staff Member via Firebase + Resend API
  const handleAddStaffMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim() || !newStaffEmail.trim()) return;

    setIsAddingStaff(true);
    try {
      const { member, emailDispatched } = await addTeamMemberToFirebase({
        name: newStaffName.trim(),
        email: newStaffEmail.trim(),
        passwordHash: newStaffPassword.trim() || 'Juthori@2026',
        role: newStaffRole,
        invitedByName: loggedInMember?.name || 'كريم طاحون (المايسترو)',
      });

      setStaffList((prev) => [...prev, member]);
      setNewStaffName('');
      setNewStaffEmail('');
      setNewStaffPassword('');
      setShowAddStaffModal(false);
      triggerToast(
        emailDispatched
          ? `تم إنشاء حساب "${member.name}" (${member.role}) في Firebase وإرسال دعوة رسمية عبر info@Juthori.com ✓`
          : `تم إنشاء حساب "${member.name}" (${member.role}) وحفظه في Firebase بنجاح ✓`
      );
    } catch {
      triggerToast('تعذر إضافة عضو الفريق في قاعدة البيانات.');
    } finally {
      setIsAddingStaff(false);
    }
  };

  const handleToggleStaffStatus = async (member: TeamMemberRecord) => {
    if (member.id === FOUNDING_MAESTRO_MEMBER.id) {
      triggerToast('لا يمكن إيقاف الحساب التأسيسي للمايسترو.');
      return;
    }
    const nextStatus = member.status === 'نشط' ? 'موقوف' : 'نشط';
    await updateTeamMemberStatusInFirebase(member.id, nextStatus);
    setStaffList((prev) =>
      prev.map((m) => (m.id === member.id ? { ...m, status: nextStatus } : m))
    );
    triggerToast(`تم تحديث حالة حساب "${member.name}" إلى (${nextStatus}).`);
  };

  // Save or Update Knowledge Center Article in Firebase
  const handleSaveKnowledgeArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!articleTitle.trim() || !articleSummary.trim()) return;
    setIsSavingArticle(true);
    try {
      const saved = await saveKnowledgeArticleToFirebase({
        id: editingArticleId || undefined,
        title: articleTitle,
        category: articleCategory,
        summary: articleSummary,
        content: articleContent || articleSummary,
        authorName: loggedInMember?.name || 'هيئة تحرير المركز المعرفي',
        status: articleStatus,
      });

      setKnowledgeArticles((prev) => {
        const exists = prev.some((a) => a.id === saved.id);
        return exists
          ? prev.map((a) => (a.id === saved.id ? saved : a))
          : [saved, ...prev];
      });

      setEditingArticleId(null);
      setArticleTitle('');
      setArticleSummary('');
      setArticleContent('');
      triggerToast(`تم حفظ ونشر المقال "${saved.title}" في المركز المعرفي عبر Firebase ✓`);
    } catch {
      triggerToast('تعذر حفظ المقال في قاعدة البيانات.');
    } finally {
      setIsSavingArticle(false);
    }
  };

  const handleDeleteKnowledgeArticle = async (articleId: string) => {
    try {
      await deleteKnowledgeArticleFromFirebase(articleId);
      setKnowledgeArticles((prev) => prev.filter((a) => a.id !== articleId));
      triggerToast('تم حذف المقال من المركز المعرفي.');
    } catch {
      triggerToast('تعذر حذف المقال.');
    }
  };

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchesSearch =
        !orderSearchQuery.trim() ||
        o.fullName.includes(orderSearchQuery) ||
        o.familyName.includes(orderSearchQuery) ||
        o.id.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
        o.email.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
        o.originCountry.includes(orderSearchQuery);

      const matchesFilter =
        orderFilterMatch === 'ALL' || o.matchStatus === orderFilterMatch;

      return matchesSearch && matchesFilter;
    });
  }, [orders, orderSearchQuery, orderFilterMatch]);

  // Live Executive Metrics computed strictly from real Firebase collections
  const metrics = useMemo(() => {
    const totalRevenue = orders.reduce((acc, o) => acc + (o.paidRevenueUsd || 0), 0);
    const totalWalletDeposits = orders.reduce(
      (acc, o) => acc + (o.walletBalanceUsd || 0),
      0
    );
    const annualSubscribers = orders.filter(
      (o) => o.accountStatus === 'annual_vip'
    ).length;
    const paidRootUnlocks = orders.filter(
      (o) => o.accountStatus === 'paid_5_root'
    ).length;

    return {
      totalRevenue,
      totalWalletDeposits,
      annualSubscribers,
      paidRootUnlocks,
      totalOrders: orders.length,
      totalArticles: knowledgeArticles.length,
      openSupportCount: supportTickets.filter((t) => t.status === 'مفتوح').length,
      pendingChartersCount: charterRequests.filter(
        (c) => c.status === 'بانتظار الاعتماد'
      ).length,
    };
  }, [orders, knowledgeArticles, supportTickets, charterRequests]);

  // ===========================================================================
  // RENDER 1: INDEPENDENT /Team LOGIN GATEWAY (When unauthenticated)
  // ===========================================================================
  if (!loggedInMember) {
    return (
      <div
        dir="rtl"
        className="min-h-screen bg-[#0D0B09] text-[#F7F3EB] flex flex-col justify-between p-6 relative overflow-hidden"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(197,160,89,0.12),transparent_60%)]" />

        {/* Top Bar */}
        <header className="relative z-10 max-w-6xl w-full mx-auto flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <JuthoriLogo size="sm" />
            <span className="px-2.5 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/40 text-[#C5A059] text-[11px] font-bold">
              بوابة فريق الإدارة والعمليات (/Team) · Firebase RBAC
            </span>
          </div>

          <button
            type="button"
            onClick={onBackToPlatform}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-[#E6DEC8] transition cursor-pointer"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>العودة لواجهة المنصة</span>
          </button>
        </header>

        {/* Center Login Card */}
        <main className="relative z-10 max-w-md w-full mx-auto my-auto py-8">
          <div className="rounded-3xl bg-[#16130F] border border-[#C5A059]/30 p-7 sm:p-8 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-[#C5A059]/15 border border-[#C5A059]/40 flex items-center justify-center text-[#C5A059] mb-5">
              <Lock className="w-6 h-6" />
            </div>

            <h1 className="text-xl sm:text-2xl font-bold font-serif text-[#F7F3EB]">
              تسجيل دخول فريق العمل (/Team)
            </h1>
            <p className="text-xs text-[#A39B8B] mt-1.5 leading-relaxed">
              بوابة الإدارة والبحوث والتحرير المعرفي معزولة بالكامل عن واجهة العملاء وتخضع لصلاحيات الأدوار الخمسة في Firebase.
            </p>

            {loginError && (
              <div className="mt-4 p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs font-bold">
                {loginError}
              </div>
            )}

            <form onSubmit={handleTeamLogin} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#D6CEBF] mb-1.5">
                  البريد الإلكتروني الإداري
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#A39B8B] absolute right-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    dir="ltr"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="name@adamresearchcenter.net"
                    className="w-full pr-10 pl-3.5 py-2.5 rounded-xl bg-[#0D0B09] border border-white/15 text-sm text-white focus:outline-none focus:border-[#C5A059]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#D6CEBF] mb-1.5">
                  كلمة المرور
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#A39B8B] absolute right-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    dir="ltr"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pr-10 pl-3.5 py-2.5 rounded-xl bg-[#0D0B09] border border-white/15 text-sm text-white focus:outline-none focus:border-[#C5A059]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-3 rounded-xl bg-gradient-to-l from-[#C5A059] to-[#A3813E] hover:from-[#D4B06A] hover:to-[#B5914B] text-[#14110D] font-bold text-sm shadow-lg transition cursor-pointer disabled:opacity-50"
              >
                {isLoggingIn ? 'جاري التحقق من الصلاحيات...' : 'دخول بوابة الفريق (/Team)'}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-white/10">
              <div className="text-[11px] font-bold text-[#C5A059] mb-2">
                الأدوار الإدارية المعتمدة في المنظومة:
              </div>
              <div className="flex flex-wrap gap-1.5 text-[10px] text-[#A39B8B]">
                {ALL_TEAM_ROLES.map((role) => (
                  <span
                    key={role}
                    className="px-2 py-0.5 rounded bg-white/5 border border-white/10"
                  >
                    {role}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </main>

        <footer className="relative z-10 text-center text-[11px] text-[#7A7264]">
          منصة جذوري للأنساب العربية الموثقة · منظومة الإدارة والعمليات المحمية (/Team)
        </footer>
      </div>
    );
  }

  // ===========================================================================
  // RENDER 2: AUTHENTICATED /Team PORTAL (Role-Governed Workspace)
  // ===========================================================================
  const ALL_NAVIGATION_TABS: Array<{
    id: AdminModuleTab;
    label: string;
    icon: React.ReactNode;
    badge?: string | number;
  }> = [
    {
      id: 'users_rbac',
      label: 'لوحة إدارة المستخدمين',
      icon: <Users className="w-4 h-4" />,
      badge: staffList.length,
    },
    {
      id: 'research_studio',
      label: 'لوحة تحكم الباحثين (Researcher Studio)',
      icon: <BookOpen className="w-4 h-4" />,
      badge: researchTicketsCount,
    },
    {
      id: 'orders_support',
      label: 'لوحة إدارة الطلبات وخدمة العملاء',
      icon: <HeadphonesIcon className="w-4 h-4" />,
      badge: orders.length,
    },
    {
      id: 'knowledge_cms',
      label: 'لوحة تحرير المركز المعرفي',
      icon: <FileText className="w-4 h-4" />,
      badge: knowledgeArticles.length,
    },
    {
      id: 'executive_reports',
      label: 'لوحة التقارير',
      icon: <BarChart3 className="w-4 h-4" />,
    },
  ];

  const visibleNavigationTabs = ALL_NAVIGATION_TABS.filter((t) =>
    allowedTabs.includes(t.id)
  );

  return (
    <div dir="rtl" className="min-h-screen bg-[#F4F1EA] text-[#1A1612] flex flex-col">
      {/* Top Staff Command Bar */}
      <header className="sticky top-0 z-40 bg-[#14110D] text-[#F7F3EB] border-b border-[#C5A059]/30 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <JuthoriLogo size="sm" />
            <span className="hidden md:inline-block h-6 w-px bg-white/15" />
            <div className="flex items-center gap-2 bg-[#1F1A14] border border-[#C5A059]/40 px-3 py-1.5 rounded-xl">
              <Crown className="w-4 h-4 text-[#C5A059]" />
              <div className="text-xs">
                <span className="font-bold text-white">{loggedInMember.name}</span>
                <span className="mx-1.5 text-[#C5A059]">·</span>
                <span className="text-[#C5A059] font-bold">{loggedInMember.role}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refreshAllFirebaseData}
              disabled={isLoadingData}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-[#E6DEC8] transition cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isLoadingData ? 'animate-spin' : ''}`}
              />
              <span>تحديث البيانات</span>
            </button>

            <button
              type="button"
              onClick={onBackToPlatform}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white border border-white/15 transition cursor-pointer"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>واجهة المنصة</span>
            </button>

            <button
              type="button"
              onClick={handleTeamLogout}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-950/60 hover:bg-red-900/70 text-xs font-bold text-red-200 border border-red-500/30 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>خروج</span>
            </button>
          </div>
        </div>

        {/* Role-Governed Navigation Tabs */}
        <div className="bg-[#1C1813] border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1.5 overflow-x-auto py-2">
            {visibleNavigationTabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                    active
                      ? 'bg-[#C5A059] text-[#14110D] shadow-md'
                      : 'text-[#D6CEBF] hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                        active
                          ? 'bg-[#14110D]/20 text-[#14110D]'
                          : 'bg-white/10 text-[#C5A059]'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Toast Banner */}
      {toastBanner && (
        <div className="bg-[#1E3B2B] text-white border-b border-[#C5A059]/40 px-4 py-2.5 text-center text-xs font-bold flex items-center justify-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#C5A059] shrink-0" />
          <span>{toastBanner}</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* =====================================================================
            PANEL 1: لوحة إدارة المستخدمين والصلاحيات (Users & RBAC)
           ===================================================================== */}
        {activeTab === 'users_rbac' && allowedTabs.includes('users_rbac') && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-[#E2DACB] p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-[#14110D]">
                    لوحة إدارة المستخدمين وصلاحيات الفريق (/Team)
                  </h2>
                  <p className="text-xs text-[#6E6456] mt-0.5">
                    إدارة أعضاء فريق العمل المرتبطين بقاعدة بيانات Firebase وإرسال دعوات الانضمام الرسمية عبر Resend API (info@Juthori.com).
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#14110D] hover:bg-[#2A231B] text-[#C5A059] text-xs font-bold cursor-pointer transition shadow-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>+ إضافة عضو فريق جديد وإرسال دعوة</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-[#F9F6F0] border-b border-[#E2DACB] text-[11px] font-bold text-[#6E6456]">
                      <th className="py-3 px-4">اسم العضو</th>
                      <th className="py-3 px-4">البريد الإلكتروني</th>
                      <th className="py-3 px-4">الدور الإداري (RBAC)</th>
                      <th className="py-3 px-4">الحالة</th>
                      <th className="py-3 px-4">الصلاحيات الممنوحة</th>
                      <th className="py-3 px-4">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFEAE0] text-xs">
                    {staffList.map((st) => (
                      <tr key={st.id} className="hover:bg-[#FCFBF8]">
                        <td className="py-3.5 px-4 font-bold text-[#14110D]">
                          <div className="flex items-center gap-2">
                            <span>{st.name}</span>
                            {st.role === 'المايسترو' && (
                              <span className="px-2 py-0.5 rounded bg-[#C5A059]/20 text-[#7A5B20] text-[10px] font-bold">
                                المؤسس
                              </span>
                            )}
                          </div>
                        </td>
                        <td
                          className="py-3.5 px-4 font-mono text-[11px] text-[#5C5346]"
                          dir="ltr"
                        >
                          {st.email}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-1 rounded-full bg-[#14110D] text-[#C5A059] font-bold text-[11px]">
                            {st.role}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              st.status === 'نشط'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                            }`}
                          >
                            {st.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1">
                            {(st.permissions || getPermissionsForTeamRole(st.role)).map(
                              (perm) => (
                                <span
                                  key={perm}
                                  className="px-2 py-0.5 rounded bg-[#F4F1EA] text-[#5C5346] text-[10px]"
                                >
                                  {perm}
                                </span>
                              )
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {st.id !== FOUNDING_MAESTRO_MEMBER.id ? (
                            <button
                              type="button"
                              onClick={() => handleToggleStaffStatus(st)}
                              className="px-2.5 py-1 rounded-lg border border-[#D8D0C0] hover:bg-[#F4F1EA] text-[11px] font-bold text-[#14110D] cursor-pointer"
                            >
                              {st.status === 'نشط' ? 'إيقاف مؤقت' : 'إعادة تفعيل'}
                            </button>
                          ) : (
                            <span className="text-[11px] text-[#8C8272] font-bold">
                              حساب سيادي دائم
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            PANEL 2: لوحة تحكم الباحثين (Researcher Studio)
           ===================================================================== */}
        {activeTab === 'research_studio' &&
          allowedTabs.includes('research_studio') && (
            <div className="bg-white rounded-3xl border border-[#E2DACB] p-4 sm:p-6 shadow-sm">
              <ResearcherStudio
                currentFamilyName={currentClientResult.familyName}
                currentClientResult={currentClientResult}
                isAlphaAlreadyMerged={isAlphaAlreadyMerged}
                onApproveAlphaMergeIntoAdam={(payload) => {
                  onApproveAlphaMergeIntoAdam(payload);
                  triggerToast(
                    payload.isAdamEnrichmentOnly
                      ? `تم إثراء عقدة "${payload.familyName}" في شجرة آدم بالمصادر الإضافية وإقفال التذكرة ✓`
                      : `تم اعتماد ربط "${payload.familyName}" بفرع (${payload.subRootName} — ${payload.motherTribeName}) في شجرة آدم ✓`
                  );
                }}
                onBackToClientDashboard={() => {
                  if (allowedTabs.includes('orders_support')) {
                    setActiveTab('orders_support');
                  } else {
                    onBackToPlatform();
                  }
                }}
                onSwitchToClientPreview={(familyName) => {
                  onPreviewClientOrder({
                    firstName: currentClientResult.clientName || 'حسن',
                    fatherName: currentClientResult.fatherName || '',
                    grandfatherName: currentClientResult.grandfatherName || '',
                    familyName: familyName || currentClientResult.familyName,
                    originCountry: currentClientResult.originCountry || 'السعودية',
                    originRegion: currentClientResult.originRegion || '',
                    accountType: currentClientAccountType,
                    stateMode: currentClientStateMode,
                    email: 'preview@juthori.com',
                  });
                }}
              />
            </div>
          )}

        {/* =====================================================================
            PANEL 3: لوحة إدارة الطلبات وخدمة العملاء (Orders & Customer Care)
           ===================================================================== */}
        {activeTab === 'orders_support' && allowedTabs.includes('orders_support') && (
          <div className="space-y-6">
            {/* Search & Filters */}
            <div className="bg-white rounded-2xl border border-[#E2DACB] p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[260px]">
                <Search className="w-4 h-4 text-[#8C8272] absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={orderSearchQuery}
                  onChange={(e) => setOrderSearchQuery(e.target.value)}
                  placeholder="ابحث برقم الطلب، اسم العميل، اللقب، الدولة، أو البريد..."
                  className="w-full pr-10 pl-4 py-2 rounded-xl bg-[#F9F6F0] border border-[#E2DACB] text-xs text-[#14110D] focus:outline-none focus:border-[#C5A059]"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="w-3.5 h-3.5 text-[#8C8272]" />
                {[
                  { id: 'ALL', label: 'كل الطلبات' },
                  { id: 'auto_adam_full', label: 'تطابق شجرة آدم' },
                  { id: 'staged_3_nodes', label: 'مشاريع ألفا (3 عُقد)' },
                  { id: 'open_research_ticket', label: 'تذكرة بحث مفتوحة' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setOrderFilterMatch(f.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      orderFilterMatch === f.id
                        ? 'bg-[#14110D] text-[#C5A059]'
                        : 'bg-[#F4F1EA] text-[#5C5346] hover:bg-[#E8E2D5]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Customer Orders Table */}
            <div className="bg-white rounded-2xl border border-[#E2DACB] overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-[#E2DACB] flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#14110D]">
                  سجل طلبات العملاء الفعلي في Firebase ({filteredOrders.length})
                </h3>
              </div>

              {filteredOrders.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-sm font-bold text-[#6E6456]">
                    لا توجد سجلات حالياً
                  </p>
                  <p className="text-xs text-[#8C8272] mt-1">
                    ستظهر هنا طلبات العملاء الحقيقية فور تسجيلهم أو ترقية باقاتهم في المنصة.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-[#1C1813] text-[#D6CEBF] text-[11px] font-bold">
                        <th className="py-3.5 px-4">رقم الطلب</th>
                        <th className="py-3.5 px-4">العميل واللقب</th>
                        <th className="py-3.5 px-4">الدولة / المنطقة</th>
                        <th className="py-3.5 px-4">الباقة والمحفظة</th>
                        <th className="py-3.5 px-4">حالة التطابق</th>
                        <th className="py-3.5 px-4">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EFEAE0] text-xs">
                      {filteredOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-[#FCFBF8] transition">
                          <td className="py-3.5 px-4 font-mono font-bold text-[#14110D]">
                            {order.id}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-[#14110D]">
                              {order.fullName}
                            </div>
                            <div className="text-[11px] text-[#6E6456]">
                              اللقب: <span className="font-bold">{order.familyName}</span> ·{' '}
                              {order.email}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-[#14110D]">
                              {order.originCountry}
                            </span>
                            {order.originRegion && (
                              <div className="text-[11px] text-[#6E6456]">
                                {order.originRegion}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {order.accountStatus === 'annual_vip' ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[11px]">
                                اشتراك سنوي ($60)
                              </span>
                            ) : order.accountStatus === 'paid_5_root' ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 font-bold text-[11px]">
                                فتح الجذر ($5)
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-300 font-bold text-[11px]">
                                مجاني ($0)
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="text-[11px] font-bold text-[#5C5346]">
                              {order.nodesCountLabel}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedOrderForModal(order)}
                                className="px-2.5 py-1.5 rounded-lg bg-[#F4F1EA] hover:bg-[#E5DEC9] text-[#14110D] font-bold text-[11px] cursor-pointer"
                              >
                                إدارة الحساب
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const stateMode =
                                    order.accountStatus === 'annual_vip'
                                      ? DashboardStateMode.AnnualVip
                                      : order.accountStatus === 'paid_5_root'
                                      ? DashboardStateMode.State1Paid5Basic
                                      : order.matchStatus === 'open_research_ticket'
                                      ? DashboardStateMode.State3Unmatched
                                      : DashboardStateMode.State2MatchedUnpaid;

                                  onPreviewClientOrder({
                                    firstName: order.firstName,
                                    fatherName: order.fatherName,
                                    grandfatherName: order.grandfatherName,
                                    familyName: order.familyName,
                                    originCountry: order.originCountry,
                                    originRegion: order.originRegion,
                                    accountType:
                                      order.legalRole === 'record_keeper'
                                        ? AccountLegalType.RecordKeeper
                                        : AccountLegalType.Individual,
                                    stateMode,
                                    email: order.email,
                                  });
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#14110D] text-[#C5A059] font-bold text-[11px] cursor-pointer"
                              >
                                <Eye className="w-3 h-3" />
                                <span>معاينة</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Record Keeper Charter Requests & Support Tickets Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Record Keeper Charter Requests */}
              <div className="bg-white rounded-2xl border border-[#E2DACB] p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FileSignature className="w-5 h-5 text-[#9E7A32]" />
                    <h3 className="text-sm font-bold text-[#14110D]">
                      طلبات توثيق &quot;ميثاق أمين السجل&quot; ({charterRequests.length})
                    </h3>
                  </div>
                </div>

                {charterRequests.length === 0 ? (
                  <div className="p-8 rounded-xl bg-[#F9F6F0] border border-[#EFEAE0] text-center text-xs font-bold text-[#6E6456]">
                    لا توجد سجلات حالياً
                  </div>
                ) : (
                  <div className="space-y-3">
                    {charterRequests.map((req) => (
                      <div
                        key={req.id}
                        className="p-3.5 rounded-xl bg-[#F9F6F0] border border-[#E2DACB] flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="text-xs font-bold text-[#14110D]">
                            {req.clientName} — عائلة ({req.familyName})
                          </div>
                          <div className="text-[11px] text-[#6E6456] mt-0.5">
                            {req.country} · رمز الميثاق: {req.charterCode}
                          </div>
                        </div>

                        {req.status === 'بانتظار الاعتماد' ? (
                          <button
                            type="button"
                            onClick={async () => {
                              await approveCharterRequestInFirebase(req.id);
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
                              triggerToast(
                                `تم اعتماد ميثاق أمين السجل للعميل "${req.clientName}" ✓`
                              );
                            }}
                            className="px-3 py-1.5 rounded-xl bg-[#1E3B2B] text-white text-[11px] font-bold cursor-pointer"
                          >
                            اعتماد الميثاق
                          </button>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 text-[11px] font-bold">
                            {req.status}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Support Tickets */}
              <div className="bg-white rounded-2xl border border-[#E2DACB] p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-[#14110D]" />
                    <h3 className="text-sm font-bold text-[#14110D]">
                      تذاكر الدعم الفني والاستفسارات ({supportTickets.length})
                    </h3>
                  </div>
                </div>

                {supportTickets.length === 0 ? (
                  <div className="p-8 rounded-xl bg-[#F9F6F0] border border-[#EFEAE0] text-center text-xs font-bold text-[#6E6456]">
                    لا توجد سجلات حالياً
                  </div>
                ) : (
                  <div className="space-y-3">
                    {supportTickets.map((t) => (
                      <div
                        key={t.id}
                        className="p-3.5 rounded-xl bg-[#F9F6F0] border border-[#E2DACB] flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="text-xs font-bold text-[#14110D]">
                            {t.clientName} ({t.email})
                          </div>
                          <div className="text-[11px] text-[#5C5346] mt-0.5">
                            {t.subject}
                          </div>
                        </div>

                        {t.status === 'مفتوح' ? (
                          <button
                            type="button"
                            onClick={async () => {
                              await resolveSupportTicketInFirebase(t.id);
                              setSupportTickets((prev) =>
                                prev.map((item) =>
                                  item.id === t.id
                                    ? { ...item, status: 'تم الحل' }
                                    : item
                                )
                              );
                              triggerToast(`تم إغلاق تذكرة الدعم (${t.id}) ✓`);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-[#14110D] text-[#C5A059] text-[11px] font-bold cursor-pointer"
                          >
                            تحديد كـ &quot;تم الحل&quot;
                          </button>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                            تم الحل ✓
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            PANEL 4: لوحة تحرير المركز المعرفي (Knowledge Center CMS)
           ===================================================================== */}
        {activeTab === 'knowledge_cms' && allowedTabs.includes('knowledge_cms') && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Editor Form */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-[#E2DACB] p-5 shadow-sm">
              <h2 className="text-base font-bold text-[#14110D] mb-1">
                {editingArticleId
                  ? 'تعديل مقال أو دراسة في المركز المعرفي'
                  : 'إضافة مقال أو دراسة جديدة للمركز المعرفي'}
              </h2>
              <p className="text-xs text-[#6E6456] mb-4">
                يتم حفظ المقالات في Firebase (`knowledge_articles`) وتنعكس مباشرة في قسم المركز المعرفي بالصفحة الرئيسية.
              </p>

              <form onSubmit={handleSaveKnowledgeArticle} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-[#5C5346] mb-1">
                    عنوان المقال أو الدراسة العلمية
                  </label>
                  <input
                    type="text"
                    required
                    value={articleTitle}
                    onChange={(e) => setArticleTitle(e.target.value)}
                    placeholder="مثال: منهجية تحقيق سلاسل النسب في أمهات الكتب..."
                    className="w-full px-3.5 py-2 rounded-xl bg-[#F9F6F0] border border-[#E2DACB] text-xs font-bold text-[#14110D]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#5C5346] mb-1">
                      التصنيف المعرفي
                    </label>
                    <input
                      type="text"
                      value={articleCategory}
                      onChange={(e) => setArticleCategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#F9F6F0] border border-[#E2DACB] text-xs text-[#14110D]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#5C5346] mb-1">
                      حالة النشر
                    </label>
                    <select
                      value={articleStatus}
                      onChange={(e) =>
                        setArticleStatus(e.target.value as 'published' | 'draft')
                      }
                      className="w-full px-3 py-2 rounded-xl bg-[#F9F6F0] border border-[#E2DACB] text-xs font-bold text-[#14110D]"
                    >
                      <option value="published">منشور للجمهور</option>
                      <option value="draft">مسودة تحريرية</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#5C5346] mb-1">
                    ملخص المقال (يظهر في بطاقة المركز المعرفي)
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={articleSummary}
                    onChange={(e) => setArticleSummary(e.target.value)}
                    placeholder="اكتب خلاصة مركزة للمقال أو الدراسة..."
                    className="w-full px-3.5 py-2 rounded-xl bg-[#F9F6F0] border border-[#E2DACB] text-xs text-[#14110D]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#5C5346] mb-1">
                    النص الكامل للمقال / المراجع المحققة
                  </label>
                  <textarea
                    rows={5}
                    value={articleContent}
                    onChange={(e) => setArticleContent(e.target.value)}
                    placeholder="النص التفصيلي للمقال والمصادر التاريخية المعتمدة..."
                    className="w-full px-3.5 py-2 rounded-xl bg-[#F9F6F0] border border-[#E2DACB] text-xs text-[#14110D]"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={isSavingArticle}
                    className="flex-1 py-2.5 rounded-xl bg-[#14110D] hover:bg-[#2A231B] text-[#C5A059] text-xs font-bold transition cursor-pointer"
                  >
                    {isSavingArticle
                      ? 'جاري الحفظ...'
                      : editingArticleId
                      ? 'تحديث المقال في Firebase'
                      : 'نشر المقال في المركز المعرفي'}
                  </button>
                  {editingArticleId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingArticleId(null);
                        setArticleTitle('');
                        setArticleSummary('');
                        setArticleContent('');
                      }}
                      className="px-4 py-2.5 rounded-xl bg-[#F4F1EA] text-xs font-bold text-[#5C5346]"
                    >
                      إلغاء
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Articles List */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-[#E2DACB] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-[#14110D]">
                  سجل مقالات ودراسات المركز المعرفي ({knowledgeArticles.length})
                </h3>
              </div>

              {knowledgeArticles.length === 0 ? (
                <div className="p-12 rounded-xl bg-[#F9F6F0] border border-[#EFEAE0] text-center">
                  <p className="text-sm font-bold text-[#6E6456]">
                    لا توجد سجلات حالياً
                  </p>
                  <p className="text-xs text-[#8C8272] mt-1">
                    استخدم محرر المركز المعرفي على اليمين لإضافة ونشر المقالات والدراسات العلمية.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {knowledgeArticles.map((art) => (
                    <div
                      key={art.id}
                      className="p-4 rounded-xl bg-[#F9F6F0] border border-[#E2DACB] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-[#C5A059]/20 text-[#7A5B20] text-[10px] font-bold">
                            {art.category}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              art.status === 'published'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-stone-200 text-stone-700'
                            }`}
                          >
                            {art.status === 'published' ? 'منشور' : 'مسودة'}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-[#14110D] mt-1">
                          {art.title}
                        </h4>
                        <p className="text-xs text-[#5C5346] mt-1 line-clamp-2">
                          {art.summary}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingArticleId(art.id);
                            setArticleTitle(art.title);
                            setArticleCategory(art.category);
                            setArticleSummary(art.summary);
                            setArticleContent(art.content);
                            setArticleStatus(art.status);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-white border border-[#D8D0C0] text-[11px] font-bold text-[#14110D] cursor-pointer"
                        >
                          تحرير
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteKnowledgeArticle(art.id)}
                          className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 cursor-pointer"
                          title="حذف المقال"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* =====================================================================
            PANEL 5: لوحة التقارير والإدارة العليا (Executive Reports)
           ===================================================================== */}
        {activeTab === 'executive_reports' &&
          allowedTabs.includes('executive_reports') && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-[#E2DACB] p-5 shadow-sm">
                  <div className="text-xs font-bold text-[#8C8272]">
                    إجمالي الإيرادات الفعلية
                  </div>
                  <div className="text-2xl font-extrabold text-[#14110D] mt-1">
                    ${metrics.totalRevenue}
                  </div>
                  <div className="text-[11px] text-[#6E6456] mt-1">
                    {metrics.annualSubscribers} اشتراك سنوي · {metrics.paidRootUnlocks}{' '}
                    فتح جذر
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-[#E2DACB] p-5 shadow-sm">
                  <div className="text-xs font-bold text-[#8C8272]">
                    إجمالي طلبات العملاء المسجلة
                  </div>
                  <div className="text-2xl font-extrabold text-[#14110D] mt-1">
                    {metrics.totalOrders}
                  </div>
                  <div className="text-[11px] text-[#6E6456] mt-1">
                    مخزنة في Firebase (`customer_orders`)
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-[#E2DACB] p-5 shadow-sm">
                  <div className="text-xs font-bold text-[#8C8272]">
                    تذاكر البحث والتحقيق النَّسبي
                  </div>
                  <div className="text-2xl font-extrabold text-[#14110D] mt-1">
                    {researchTicketsCount}
                  </div>
                  <div className="text-[11px] text-[#6E6456] mt-1">
                    مخزنة في Firebase (`research_tickets`)
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-[#E2DACB] p-5 shadow-sm">
                  <div className="text-xs font-bold text-[#8C8272]">
                    أعضاء الفريق ومقالات المركز المعرفي
                  </div>
                  <div className="text-2xl font-extrabold text-[#14110D] mt-1">
                    {staffList.length} أعضاء · {metrics.totalArticles} مقال
                  </div>
                  <div className="text-[11px] text-[#6E6456] mt-1">
                    {metrics.openSupportCount} تذاكر دعم مفتوحة
                  </div>
                </div>
              </div>
            </div>
          )}
      </main>

      {/* =======================================================================
          MODAL 1: Add & Invite New Staff Member (/Team)
         ======================================================================= */}
      {showAddStaffModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-[#C5A059]/40 max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-[#14110D] mb-1">
              إضافة عضو جديد في فريق العمل (/Team)
            </h3>
            <p className="text-xs text-[#6E6456] mb-4">
              سيتم حفظ الحساب بصلاحياته في Firebase وإرسال دعوة رسمية فورية من{' '}
              <span dir="ltr" className="font-mono font-bold">
                info@Juthori.com
              </span>{' '}
              عبر Resend API.
            </p>

            <form onSubmit={handleAddStaffMember} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#5C5346] mb-1">
                  الاسم الكامل
                </label>
                <input
                  type="text"
                  required
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  placeholder="مثال: د. أحمد المنصور"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F9F6F0] border border-[#E2DACB] text-xs font-bold text-[#14110D]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#5C5346] mb-1">
                  البريد الإلكتروني الرسمي
                </label>
                <input
                  type="email"
                  dir="ltr"
                  required
                  value={newStaffEmail}
                  onChange={(e) => setNewStaffEmail(e.target.value)}
                  placeholder="member@juthori.com"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F9F6F0] border border-[#E2DACB] text-xs text-[#14110D]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#5C5346] mb-1">
                  كلمة المرور المبدئية للدخول إلى /Team
                </label>
                <input
                  type="text"
                  dir="ltr"
                  required
                  value={newStaffPassword}
                  onChange={(e) => setNewStaffPassword(e.target.value)}
                  placeholder="Juthori@2026"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F9F6F0] border border-[#E2DACB] text-xs font-mono text-[#14110D]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#5C5346] mb-1">
                  الدور الوظيفي (يحدد اللوحات المسموح بفتحها حصراً)
                </label>
                <select
                  value={newStaffRole}
                  onChange={(e) => setNewStaffRole(e.target.value as TeamRoleType)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#F9F6F0] border border-[#E2DACB] text-xs font-bold text-[#14110D]"
                >
                  {ALL_TEAM_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#F4F1EA] text-xs font-bold text-[#5C5346] cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isAddingStaff}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#14110D] text-[#C5A059] text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {isAddingStaff ? 'جاري الإرسال...' : 'اعتماد العضو وإرسال الدعوة'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =======================================================================
          MODAL 2: Manage Customer Order & Subscription Override
         ======================================================================= */}
      {selectedOrderForModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-[#C5A059]/40 max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#EFEAE0] pb-3">
              <div>
                <h3 className="text-base font-bold text-[#14110D]">
                  إدارة حساب وطلب العميل: {selectedOrderForModal.fullName}
                </h3>
                <p className="text-xs text-[#6E6456]">
                  رقم الطلب: {selectedOrderForModal.id} · {selectedOrderForModal.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderForModal(null)}
                className="px-3 py-1 rounded-lg bg-[#F4F1EA] text-xs font-bold"
              >
                إغلاق
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold text-[#5C5346]">
                ترقية أو تعديل حالة الباقة للعميل في Firebase:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: 'free', label: 'باقة مجانية ($0)', rev: 0, wal: 0 },
                  { id: 'paid_5_root', label: 'فتح الجذر ($5)', rev: 5, wal: 0 },
                  { id: 'annual_vip', label: 'اشتراك سنوي ($60)', rev: 60, wal: 25 },
                ].map((tier) => (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={async () => {
                      const nextAccStatus =
                        tier.id as CustomerOrderRecord['accountStatus'];
                      await updateCustomerOrderInFirebase(selectedOrderForModal.id, {
                        accountStatus: nextAccStatus,
                        paidRevenueUsd: tier.rev,
                        walletBalanceUsd: tier.wal,
                      });
                      setOrders((prev) =>
                        prev.map((o) =>
                          o.id === selectedOrderForModal.id
                            ? {
                                ...o,
                                accountStatus: nextAccStatus,
                                paidRevenueUsd: tier.rev,
                                walletBalanceUsd: tier.wal,
                              }
                            : o
                        )
                      );
                      setSelectedOrderForModal((prev) =>
                        prev
                          ? {
                              ...prev,
                              accountStatus: nextAccStatus,
                              paidRevenueUsd: tier.rev,
                              walletBalanceUsd: tier.wal,
                            }
                          : null
                      );
                      triggerToast(
                        `تم تحديث باقة العميل "${selectedOrderForModal.fullName}" في Firebase ✓`
                      );
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-bold cursor-pointer ${
                      selectedOrderForModal.accountStatus === tier.id
                        ? 'bg-[#14110D] text-[#C5A059] border-[#C5A059]'
                        : 'bg-[#F9F6F0] text-[#14110D] border-[#E2DACB]'
                    }`}
                  >
                    {tier.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
